import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import url from 'url';

dotenv.config();

import sequelize from '../src/config/database.js';
import { ApplianceGuide, Brand, Home } from '../src/models/index.js';
import { uploadFromUrl } from '../src/services/storage.service.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Defaults (override con flags o variables de entorno)
const DEFAULT_BASE = process.env.AT_GUIDES_BASE || process.env.AT_BASIC_BASE || 'appGt0lNhV0cRxYB1';
// Para guías necesitamos el TABLE ID real; si no viene por env/flag, fallamos con mensaje claro
const DEFAULT_TABLE = process.env.AT_GUIDES_TABLE || undefined;
const DEFAULT_VIEW = process.env.AT_GUIDES_VIEW || 'migrate_guides';

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
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`Airtable API error ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

function parseUrlFromCell(value) {
    if (!value) return undefined;
    if (typeof value === 'string') {
        const m = value.match(/https?:\/\/[^\s)]+/);
        return m ? m[0] : undefined;
    }
    if (Array.isArray(value)) {
        const first = value[0];
        if (first && typeof first === 'object' && typeof first.url === 'string') return first.url;
        if (typeof first === 'string') return parseUrlFromCell(first);
    }
    return undefined;
}

async function getOrCreateBrand(name) {
    if (!name) return null;
    const [brand] = await Brand.findOrCreate({ where: { name }, defaults: { name } });
    return brand;
}

function toArrayOfNames(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
    return String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

async function migrateGuides({ baseId, table, view, updateExisting = false, dryRun = false }) {
    let offset;
    let processed = 0;
    let created = 0;
    let updated = 0;
    let linked = 0;

    // Normalización de nombres de homes y mapa de alias
    const normalizeHomeName = (s) =>
        String(s || '')
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase()
            .replace(/^\s*(casa|villa|apartamento|apartment|apt\.?|house)\s+/i, '')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();

    const homes = await Home.findAll({ attributes: ['id', 'name'] });
    const homeKeyToId = new Map();
    for (const h of homes) homeKeyToId.set(normalizeHomeName(h.name), h.id);

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

    const wantedFields = ['name', 'gallery', 'pdf_guide', 'description', 'homes'];

    do {
        const page = await airtableRequest({ baseId, table, view, offset, fields: wantedFields });
        const records = Array.isArray(page.records) ? page.records : [];
        for (const row of records) {
            const rec = row.fields || {};
            const name = normalizeString(pick(rec, ['name', 'Name', 'equipment_name', 'Equipo']));
            if (!name) continue;

            const brandName = normalizeString(pick(rec, ['brand', 'Brand', 'Marca']));
            const model = normalizeString(pick(rec, ['model', 'Model', 'Modelo']));
            const description = normalizeString(pick(rec, ['description', 'Description', 'brief_description']));
            const imageUrl = parseUrlFromCell(pick(rec, ['gallery', 'image', 'Image']));
            const pdfUrlSrc = parseUrlFromCell(pick(rec, ['pdf_guide', 'PDF', 'pdf']));
            const videoUrlSrc = undefined;
            const homeNames = toArrayOfNames(pick(rec, ['homes', 'Homes']));

            processed += 1;
            if (dryRun) continue;

            const brand = await getOrCreateBrand(brandName);

            // Upsert guide por (name + brand + model)
            const where = { equipment_name: name, brand_id: brand?.id || null, model: model || null };
            const defaults = { equipment_name: name, brand_id: brand?.id || null, model: model || null, brief_description: description || null };
            const [guide, isCreated] = await ApplianceGuide.findOrCreate({ where, defaults });
            if (isCreated) created += 1; else if (updateExisting) { await guide.update(defaults); updated += 1; }

            // Subidas de medios
            const imageUrls = [];
            if (imageUrl) {
                try {
                    const key = `guides/${encodeURIComponent(name)}/image${path.extname(new URL(imageUrl).pathname) || '.jpg'}`;
                    const publicUrl = await uploadFromUrl({ url: imageUrl, destinationPath: key });
                    imageUrls.push(publicUrl);
                } catch { }
            }
            let pdfUrl;
            if (pdfUrlSrc) {
                try {
                    const key = `guides/${encodeURIComponent(name)}/manual${path.extname(new URL(pdfUrlSrc).pathname) || '.pdf'}`;
                    pdfUrl = await uploadFromUrl({ url: pdfUrlSrc, destinationPath: key, contentType: 'application/pdf' });
                } catch { }
            }
            const updateMedia = {};
            if (imageUrls.length) updateMedia.image_urls = imageUrls;
            if (pdfUrl) updateMedia.pdf_url = pdfUrl;
            // video no presente en esta tabla
            if (Object.keys(updateMedia).length) await guide.update(updateMedia);

            // Vincular a homes por nombre (múltiples) con normalización y alias
            for (const hn of homeNames) {
                const key = normalizeHomeName(hn);
                const targetKey = aliasToKey.get(key) || key;
                const homeId = homeKeyToId.get(targetKey);
                if (!homeId) continue;
                try {
                    await guide.addHome(homeId); // M:N idempotente
                    linked += 1;
                } catch { }
            }
        }
        offset = page.offset;
        if (offset) await new Promise((r) => setTimeout(r, 250));
    } while (offset);

    return { processed, created, updated, linked };
}

function parseArgs() {
    const baseIdx = process.argv.findIndex((a) => a === '--base');
    const tableIdx = process.argv.findIndex((a) => a === '--table');
    const viewIdx = process.argv.findIndex((a) => a === '--view');
    const updateExisting = process.argv.includes('--update');
    const dryRun = process.argv.includes('--dry-run');
    const baseId = baseIdx !== -1 ? process.argv[baseIdx + 1] : DEFAULT_BASE;
    const table = tableIdx !== -1 ? process.argv[tableIdx + 1] : DEFAULT_TABLE;
    const view = viewIdx !== -1 ? process.argv[viewIdx + 1] : DEFAULT_VIEW;
    if (!table) {
        console.error('Falta AT_GUIDES_TABLE (ID de tabla, p.ej. tblXXXXXXXXXXXX). Defínelo en .env o pásalo con --table.');
        process.exit(1);
    }
    return { baseId, table, view, updateExisting, dryRun };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const res = await migrateGuides(args);
    await sequelize.close();
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


