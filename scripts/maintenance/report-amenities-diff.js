import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import sequelize from '../src/config/database.js';
import { Amenity, Brand, Category } from '../src/models/index.js';

dotenv.config();

function normalizeKeyPart(v) {
    if (v == null) return 'null';
    return String(v).trim().toLowerCase().replace(/^ref\.?\s*/, '').replace(/\s+/g, ' ');
}

function keyFromParts({ name, brandId, categoryId, model, reference }) {
    return [normalizeKeyPart(name), brandId || 'null', normalizeKeyPart(model), normalizeKeyPart(reference), categoryId || 'null'].join('|');
}

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

async function buildDbIndex() {
    const amenities = await Amenity.findAll({ attributes: ['name', 'brand_id', 'category_id', 'model', 'reference'], raw: true });
    const idx = new Map();
    for (const a of amenities) {
        const k = keyFromParts(a);
        idx.set(k, (idx.get(k) || 0) + 1);
    }
    return idx;
}

async function buildAirtableIndex({ baseId, table, view }) {
    let offset;
    const idx = new Map();
    const brandCache = new Map();
    const categoryCache = new Map();

    async function resolveBrandId(name) {
        if (!name) return null;
        const key = name.trim().toLowerCase();
        if (brandCache.has(key)) return brandCache.get(key);
        const found = await Brand.findOne({ where: { name }, attributes: ['id'], raw: true });
        const id = found ? found.id : null;
        brandCache.set(key, id);
        return id;
    }

    async function resolveCategoryId(name) {
        if (!name) return null;
        const key = name.trim().toLowerCase();
        if (categoryCache.has(key)) return categoryCache.get(key);
        const found = await Category.findOne({ where: { name }, attributes: ['id'], raw: true });
        const id = found ? found.id : null;
        categoryCache.set(key, id);
        return id;
    }

    do {
        const page = await airtableRequest({ baseId, table, view, offset });
        const recs = Array.isArray(page.records) ? page.records : [];
        for (const r of recs) {
            const f = r.fields || {};
            const name = f.item || f.name || f.Name;
            if (!name) continue;
            const brandName = f.brand || f.Brand || f.marca || f.Marca;
            const categoryName = f.category || f.Category || f.categoria || f['Categoría'] || f.group || f.Group || f.tipo || f['Tipo'];
            const reference = f.reference || f.ref || f.Reference || f.REF;
            const model = f.model || f.Model || f.modelo || f.Modelo;
            const brand_id = await resolveBrandId(brandName);
            const category_id = await resolveCategoryId(categoryName);
            const k = keyFromParts({ name, brandId: brand_id, categoryId: category_id, model, reference });
            idx.set(k, (idx.get(k) || 0) + 1);
        }
        offset = page.offset;
    } while (offset);
    return idx;
}

function diffIndexes(dbIdx, atIdx) {
    const onlyDb = [];
    const onlyAt = [];
    for (const k of dbIdx.keys()) if (!atIdx.has(k)) onlyDb.push(k);
    for (const k of atIdx.keys()) if (!dbIdx.has(k)) onlyAt.push(k);
    return { onlyDbCount: onlyDb.length, onlyAtCount: onlyAt.length, onlyDb, onlyAt };
}

function parseArgs() {
    const baseIdx = process.argv.findIndex((a) => a === '--base');
    const tableIdx = process.argv.findIndex((a) => a === '--table');
    const viewIdx = process.argv.findIndex((a) => a === '--view');
    if (baseIdx === -1 || tableIdx === -1) {
        console.error('Uso: npm run report:amenities -- --base BASE_ID --table TABLE_NAME [--view VIEW]');
        process.exit(1);
    }
    return { baseId: process.argv[baseIdx + 1], table: process.argv[tableIdx + 1], view: viewIdx !== -1 ? process.argv[viewIdx + 1] : undefined };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const dbIdx = await buildDbIndex();
    const atIdx = await buildAirtableIndex(args);
    await sequelize.close();
    const diff = diffIndexes(dbIdx, atIdx);
    console.log(JSON.stringify({ dbUnique: dbIdx.size, atUnique: atIdx.size, ...diff }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


