import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import url from 'url';

dotenv.config();

import sequelize from '../src/config/database.js';
import { Home, Room, Amenity, Brand, Category, HomeInventory } from '../src/models/index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function getEnvOrThrow(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Falta variable de entorno ${name}`);
    return v;
}

function airtableRequest({ baseId, table, view, offset }) {
    const token = getEnvOrThrow('AIRTABLE_TOKEN');
    const params = { pageSize: 100, cellFormat: 'string', timeZone: 'Europe/Madrid', userLocale: 'es' };
    if (view) params.view = view;
    if (offset) params.offset = offset;
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

function normalizeString(v) {
    if (v == null) return undefined;
    return String(v).replace(/\s+/g, ' ').trim();
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

function normalizeTextKey(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/^ref\.?\s*/, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

async function buildDbTupleSet() {
    const all = await HomeInventory.findAll({ attributes: ['home_id', 'amenity_id', 'room_id'], raw: true });
    const set = new Set();
    for (const r of all) set.add(`${r.home_id}|${r.amenity_id}|${r.room_id || 'null'}`);
    return set;
}

async function buildResolvers() {
    // Homes
    const homes = await Home.findAll({ attributes: ['id', 'name'], raw: true });
    const homeKeyToId = new Map();
    for (const h of homes) homeKeyToId.set(normalizeHomeName(h.name), h.id);
    const homeAliasToKey = new Map();
    try {
        const aliasPath = path.resolve(__dirname, '../data/home_aliases.json');
        if (fs.existsSync(aliasPath)) {
            const aliases = JSON.parse(fs.readFileSync(aliasPath, 'utf8'));
            for (const [alias, target] of Object.entries(aliases)) homeAliasToKey.set(normalizeHomeName(alias), normalizeHomeName(target));
        }
    } catch { }

    // Amenities index by normalized key (name+brand+category+model+reference)
    const amenities = await Amenity.findAll({ attributes: ['id', 'name', 'brand_id', 'category_id', 'model', 'reference'], raw: true });
    const amenityKeyToId = new Map();
    const amenityNameOnlyToIds = new Map();
    for (const a of amenities) {
        const nameKey = normalizeTextKey(a.name);
        const modelKey = normalizeTextKey(a.model);
        const refKey = normalizeTextKey(a.reference);
        const b = a.brand_id || 'null';
        const c = a.category_id || 'null';
        const key = `n:${nameKey}|b:${b}|c:${c}|m:${modelKey}|r:${refKey}`;
        amenityKeyToId.set(key, a.id);
        if (!amenityNameOnlyToIds.has(nameKey)) amenityNameOnlyToIds.set(nameKey, []);
        amenityNameOnlyToIds.get(nameKey).push(a.id);
    }

    async function resolveBrandId(name) {
        if (!name) return null;
        const b = await Brand.findOne({ where: { name }, attributes: ['id'], raw: true });
        return b ? b.id : null;
    }
    async function resolveCategoryId(name) {
        if (!name) return null;
        const c = await Category.findOne({ where: { name }, attributes: ['id'], raw: true });
        return c ? c.id : null;
    }

    return { homeKeyToId, homeAliasToKey, amenityKeyToId, amenityNameOnlyToIds, resolveBrandId, resolveCategoryId };
}

async function buildAirtableTupleSet({ baseId, table, view }) {
    const { homeKeyToId, homeAliasToKey, amenityKeyToId, amenityNameOnlyToIds, resolveBrandId, resolveCategoryId } = await buildResolvers();
    let offset;
    const tupleSet = new Set();
    let processed = 0;
    let skippedNoHome = 0;
    let skippedNoAmenity = 0;
    let duplicates = 0;
    const seenTuples = new Set();

    do {
        const page = await airtableRequest({ baseId, table, view, offset });
        const records = Array.isArray(page.records) ? page.records : [];
        for (const row of records) {
            const f = row.fields || {};
            const itemName = normalizeString(f.item || f.amenity || f.name || f.Name);
            const brandName = normalizeString(f.brand || f.Brand || f.marca || f.Marca);
            const model = normalizeString(f.model || f.Model || f.modelo || f.Modelo);
            const reference = normalizeString(f.reference || f.ref || f.Reference || f.REF);
            const categoryName = normalizeString(f.category || f.Category || f.categoria || f['Categoría']);
            const homeNameRaw = normalizeString(f.home_ref || f.home || f.Home);
            const roomName = normalizeString(f.room || f.Room || f.room_name || f.ubicacion || f['ubicación']);

            processed += 1;
            if (!homeNameRaw) { skippedNoHome += 1; continue; }
            if (!itemName) { skippedNoAmenity += 1; continue; }

            const k0 = normalizeHomeName(homeNameRaw);
            const homeKey = homeAliasToKey.get(k0) || k0;
            const homeId = homeKeyToId.get(homeKey);
            if (!homeId) { skippedNoHome += 1; continue; }

            const brandId = await resolveBrandId(brandName);
            const categoryId = await resolveCategoryId(categoryName);
            const keyAmenity = `n:${normalizeTextKey(itemName)}|b:${brandId || 'null'}|c:${categoryId || 'null'}|m:${normalizeTextKey(model)}|r:${normalizeTextKey(reference)}`;
            let amenityId = amenityKeyToId.get(keyAmenity);
            if (!amenityId) {
                const ids = amenityNameOnlyToIds.get(normalizeTextKey(itemName)) || [];
                if (ids.length === 1) amenityId = ids[0];
            }
            if (!amenityId) { skippedNoAmenity += 1; continue; }

            // resolver room opcionalmente
            let roomId = null;
            if (roomName) {
                const room = await Room.findOne({ where: { name: roomName, home_id: homeId }, attributes: ['id'], raw: true });
                if (room) roomId = room.id;
            }

            const tuple = `${homeId}|${amenityId}|${roomId || 'null'}`;
            if (seenTuples.has(tuple)) duplicates += 1; else { seenTuples.add(tuple); tupleSet.add(tuple); }
        }
        offset = page.offset;
    } while (offset);

    return { tupleSet, processed, skippedNoHome, skippedNoAmenity, duplicates };
}

function diffSets(dbSet, atSet) {
    let onlyDb = 0, onlyAt = 0;
    for (const k of dbSet) if (!atSet.has(k)) onlyDb += 1;
    for (const k of atSet) if (!dbSet.has(k)) onlyAt += 1;
    return { onlyDb, onlyAt };
}

function parseArgs() {
    const baseIdx = process.argv.findIndex((a) => a === '--base');
    const tableIdx = process.argv.findIndex((a) => a === '--table');
    const viewIdx = process.argv.findIndex((a) => a === '--view');
    if (baseIdx === -1 || tableIdx === -1) {
        console.error('Uso: npm run report:inventory -- --base BASE_ID --table TABLE [--view VIEW]');
        process.exit(1);
    }
    return { baseId: process.argv[baseIdx + 1], table: process.argv[tableIdx + 1], view: viewIdx !== -1 ? process.argv[viewIdx + 1] : undefined };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const dbSet = await buildDbTupleSet();
    const { tupleSet: atSet, processed, skippedNoHome, skippedNoAmenity, duplicates } = await buildAirtableTupleSet(args);
    await sequelize.close();
    const { onlyDb, onlyAt } = diffSets(dbSet, atSet);
    console.log(JSON.stringify({ airtableProcessed: processed, airtableUnique: atSet.size, dbUnique: dbSet.size, skippedNoHome, skippedNoAmenity, airtableDuplicates: duplicates, onlyInDb: onlyDb, onlyInAirtable: onlyAt }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


