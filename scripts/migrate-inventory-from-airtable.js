import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import url from 'url';

dotenv.config();

import sequelize from '../src/config/database.js';
import { HomeInventory, Home, Amenity, Room, Brand, Category } from '../src/models/index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Defaults (override con flags o variables de entorno)
const DEFAULT_BASE = process.env.AT_INVENTORY_BASE || process.env.AT_BASIC_BASE || 'appGt0lNhV0cRxYB1';
const DEFAULT_TABLE = process.env.AT_INVENTORY_TABLE || 'tbl1HauRsoZCp3RUf';
const DEFAULT_VIEW = process.env.AT_INVENTORY_VIEW || 'inventory_migrate';

function pick(rec, keys) {
    for (const k of keys) {
        if (rec[k] != null && String(rec[k]).trim() !== '') return rec[k];
    }
    return undefined;
}

function normalizeString(v) {
    if (v == null) return undefined;
    return String(v).replace(/\s+/g, ' ').trim();
}

function normalizeTextKey(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function toInt(v, fallback = 1) {
    if (v == null || v === '') return fallback;
    const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(n) ? n : fallback;
}

function getEnvOrThrow(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Falta variable de entorno ${name}`);
    return v;
}

function airtableRequest({ baseId, table, view, offset, fields }) {
    const token = getEnvOrThrow('AIRTABLE_TOKEN');
    const params = { pageSize: 100, cellFormat: 'string', timeZone: 'Europe/Madrid', userLocale: 'es' };
    if (view) params.view = view;
    if (offset) params.offset = offset;
    if (fields && fields.length) fields.forEach((f, i) => (params[`fields[${i}]`] = f));
    const qs = querystring.stringify(params);
    const pathReq = `/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}?${qs}`;
    const options = { hostname: 'api.airtable.com', port: 443, path: pathReq, method: 'GET', headers: { Authorization: `Bearer ${token}` } };
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                } else {
                    reject(new Error(`Airtable API error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function normalizeHomeName(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/^\s*(casa|villa|apartamento|apartment|apt\.?|house)\s+/i, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

async function migrateInventory({ baseId, table, view, updateExisting = false, dryRun = false, limit, report = false, strict = false }) {
    let offset;
    let processed = 0;
    let created = 0;
    let updated = 0;
    let skippedNoHome = 0;
    let skippedNoAmenity = 0;
    const seenTuples = new Set();
    let duplicates = 0;
    let unresolvedRoomWithName = 0;

    // Mapa de homes normalizados -> id
    const homes = await Home.findAll({ attributes: ['id', 'name'] });
    const homeKeyToId = new Map();
    for (const h of homes) homeKeyToId.set(normalizeHomeName(h.name), h.id);

    // Aliases opcionales
    const aliasToKey = new Map();
    try {
        const aliasPath = path.resolve(__dirname, '../data/home_aliases.json');
        if (fs.existsSync(aliasPath)) {
            const aliases = JSON.parse(fs.readFileSync(aliasPath, 'utf8'));
            for (const [alias, target] of Object.entries(aliases)) {
                aliasToKey.set(normalizeHomeName(alias), normalizeHomeName(target));
            }
        }
    } catch { }

    // Pre-cargar amenities e índices normalizados
    const amenities = await Amenity.findAll({ attributes: ['id', 'name', 'brand_id', 'reference', 'model', 'category_id'] });
    const amenityKeyToId = new Map();
    const amenityNameOnlyToIds = new Map();
    for (const a of amenities) {
        const nameKey = normalizeTextKey(a.name);
        const refKey = (a.reference && String(a.reference)) || null;
        const modelKey = (a.model && normalizeTextKey(a.model)) || null;
        const b = a.brand_id || null;
        const c = a.category_id || null;
        const brandVals = [b, null];
        const catVals = [c, null];
        const modelVals = [modelKey, null];
        const refVals = [refKey, null];
        for (const bv of brandVals) {
            for (const cv of catVals) {
                for (const mv of modelVals) {
                    for (const rv of refVals) {
                        const key = `n:${nameKey}|b:${bv}|c:${cv}|m:${mv}|r:${rv}`;
                        if (!amenityKeyToId.has(key)) amenityKeyToId.set(key, a.id);
                    }
                }
            }
        }
        if (!amenityNameOnlyToIds.has(nameKey)) amenityNameOnlyToIds.set(nameKey, []);
        amenityNameOnlyToIds.get(nameKey).push(a.id);
    }

    // Aliases de amenity opcionales
    const amenityAliasToName = new Map();
    try {
        const aliasPath = path.resolve(__dirname, '../data/amenity_aliases.json');
        if (fs.existsSync(aliasPath)) {
            const aliases = JSON.parse(fs.readFileSync(aliasPath, 'utf8'));
            for (const [alias, target] of Object.entries(aliases)) {
                amenityAliasToName.set(normalizeTextKey(alias), normalizeTextKey(target));
            }
        }
    } catch { }

    const wantedFields = undefined; // no limitamos campos

    do {
        const page = await airtableRequest({ baseId, table, view, offset, fields: wantedFields });
        const records = Array.isArray(page.records) ? page.records : [];
        for (const row of records) {
            const rec = row.fields || {};

            let itemName = normalizeString(pick(rec, ['item', 'amenity', 'name', 'Item']));
            const homeNameRaw = normalizeString(pick(rec, ['home_ref', 'home', 'Home']));
            const quantity = toInt(pick(rec, ['quantity', 'qty', 'Quantity']), 1);
            const roomName = normalizeString(pick(rec, ['room', 'Room', 'room_name', 'ubicacion', 'ubicación']));
            const locationDetails = normalizeString(pick(rec, ['location_details', 'location', 'Ubicación', 'ubicación', 'loc']));
            const brandName = normalizeString(pick(rec, ['brand', 'Brand', 'marca', 'Marca']));
            const reference = normalizeString(pick(rec, ['reference', 'ref', 'Reference', 'REF']));
            const model = normalizeString(pick(rec, ['model', 'Model', 'modelo', 'Modelo']));
            const categoryName = normalizeString(pick(rec, ['category', 'Category', 'categoria', 'Categoría']));

            processed += 1;
            if (limit && processed > Number(limit)) break;

            if (!homeNameRaw) { skippedNoHome += 1; continue; }
            if (!itemName) { skippedNoAmenity += 1; continue; }

            // Resolver home
            const key = normalizeHomeName(homeNameRaw);
            const targetKey = aliasToKey.get(key) || key;
            const homeId = homeKeyToId.get(targetKey);
            if (!homeId) { skippedNoHome += 1; continue; }

            // Resolver amenity con índices normalizados y alias
            const nameKeyRaw = normalizeTextKey(itemName);
            const nameKey = amenityAliasToName.get(nameKeyRaw) || nameKeyRaw;
            let brandId = null;
            if (brandName) {
                const b = await Brand.findOne({ where: { name: brandName } });
                if (b) brandId = b.id;
            }
            const refKey = reference || null;
            const modelKey = model ? normalizeTextKey(model) : null;
            let categoryId = null;
            if (categoryName) {
                const cat = await Category.findOne({ where: { name: categoryName } });
                if (cat) categoryId = cat.id;
            }
            const candidates = [
                `n:${nameKey}|b:${brandId}|c:${categoryId}|m:${modelKey}|r:${refKey}`,
                `n:${nameKey}|b:${brandId}|c:${categoryId}|m:${modelKey}|r:null`,
                `n:${nameKey}|b:${brandId}|c:${categoryId}|m:null|r:${refKey}`,
                `n:${nameKey}|b:${brandId}|c:${categoryId}|m:null|r:null`,
                `n:${nameKey}|b:${brandId}|c:null|m:${modelKey}|r:${refKey}`,
                `n:${nameKey}|b:${brandId}|c:null|m:${modelKey}|r:null`,
                `n:${nameKey}|b:null|c:${categoryId}|m:${modelKey}|r:${refKey}`,
                `n:${nameKey}|b:null|c:${categoryId}|m:${modelKey}|r:null`,
                `n:${nameKey}|b:null|c:null|m:${modelKey}|r:${refKey}`,
                `n:${nameKey}|b:null|c:null|m:${modelKey}|r:null`,
                `n:${nameKey}|b:${brandId}|c:${categoryId}|m:null|r:null`,
                `n:${nameKey}|b:null|c:${categoryId}|m:null|r:null`,
                `n:${nameKey}|b:${brandId}|c:null|m:null|r:null`,
            ];
            let amenityId = null;
            for (const k of candidates) { if (amenityKeyToId.has(k)) { amenityId = amenityKeyToId.get(k); break; } }
            if (!amenityId && !strict) {
                const ids = amenityNameOnlyToIds.get(nameKey) || [];
                if (ids.length === 1) amenityId = ids[0];
            }
            if (!amenityId) { skippedNoAmenity += 1; continue; }

            // Resolver room si viene
            let roomId = null;
            if (roomName) {
                const room = await Room.findOne({ where: { name: roomName, home_id: homeId } });
                if (room) roomId = room.id; else unresolvedRoomWithName += 1;
            }

            // Contabilizar tuplas únicas y duplicados incluso en dry-run
            const tupleKey = `${homeId}|${amenityId}|${roomId || 'null'}`;
            if (seenTuples.has(tupleKey)) duplicates += 1; else seenTuples.add(tupleKey);

            if (dryRun) continue;

            const where = { home_id: homeId, amenity_id: amenityId, room_id: roomId };
            const defaults = { ...where, quantity: quantity || 1, location_details: locationDetails || null };
            const [inv, isCreated] = await HomeInventory.findOrCreate({ where, defaults });
            if (isCreated) {
                created += 1;
            } else if (updateExisting) {
                const updates = {};
                if (typeof quantity === 'number' && inv.quantity !== quantity) updates.quantity = quantity;
                if (locationDetails && inv.location_details !== locationDetails) updates.location_details = locationDetails;
                if (Object.keys(updates).length) {
                    await inv.update(updates);
                    updated += 1;
                }
            }
        }
        offset = page.offset;
        if (offset) await new Promise((r) => setTimeout(r, 250));
        if (limit && processed >= Number(limit)) break;
    } while (offset);

    const res = { processed, created, updated, skippedNoHome, skippedNoAmenity };
    if (report) Object.assign(res, { uniqueTuples: seenTuples.size, duplicates, unresolvedRoomWithName });
    return res;
}

function parseArgs() {
    const baseIdx = process.argv.findIndex((a) => a === '--base');
    const tableIdx = process.argv.findIndex((a) => a === '--table');
    const viewIdx = process.argv.findIndex((a) => a === '--view');
    const updateExisting = process.argv.includes('--update');
    const dryRun = process.argv.includes('--dry-run');
    const limitIdx = process.argv.findIndex((a) => a === '--limit');
    const report = process.argv.includes('--report');
    const strict = process.argv.includes('--strict');
    const baseId = baseIdx !== -1 ? process.argv[baseIdx + 1] : DEFAULT_BASE;
    const table = tableIdx !== -1 ? process.argv[tableIdx + 1] : DEFAULT_TABLE;
    const view = viewIdx !== -1 ? process.argv[viewIdx + 1] : DEFAULT_VIEW;
    return {
        baseId,
        table,
        view,
        updateExisting,
        dryRun,
        limit: limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : undefined,
        report,
        strict,
    };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const res = await migrateInventory(args);
    await sequelize.close();
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


