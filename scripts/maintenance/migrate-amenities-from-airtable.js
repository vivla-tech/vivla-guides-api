import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import path from 'path';
import url from 'url';

dotenv.config();

import sequelize from '../../src/config/database.js';
import { Amenity, Brand, Category } from '../../src/models/index.js';
import { uploadFromUrl } from '../../src/services/storage.service.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Defaults (override con flags o variables de entorno)
// Usamos la base común AT_BASIC_BASE salvo override específico
const DEFAULT_BASE = process.env.AT_AMENITIES_BASE || process.env.AT_BASIC_BASE || 'appGt0lNhV0cRxYB1';
const DEFAULT_TABLE = process.env.AT_AMENITIES_TABLE || 'tbl1HauRsoZCp3RUf';
const DEFAULT_VIEW = process.env.AT_AMENITIES_VIEW; // opcional

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

function truncate(v, max = 255) {
    if (v == null) return v;
    const s = String(v);
    return s.length > max ? s.slice(0, max) : s;
}

function normalizeTextKey(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
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

function parseUrlsFromCell(value) {
    if (!value) return [];
    if (typeof value === 'string') {
        const urls = Array.from(value.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]);
        return urls.slice(0, 5);
    }
    if (Array.isArray(value)) {
        const urls = [];
        for (const v of value) {
            if (v && typeof v === 'object' && typeof v.url === 'string') urls.push(v.url);
            else if (typeof v === 'string') urls.push(v);
            if (urls.length >= 5) break;
        }
        return urls;
    }
    return [];
}

async function getOrCreateBrand(name) {
    if (!name) return null;
    const [brand] = await Brand.findOrCreate({ where: { name }, defaults: { name } });
    return brand;
}

async function getOrCreateCategory(name) {
    if (!name) return null;
    const [category] = await Category.findOrCreate({ where: { name }, defaults: { name } });
    return category;
}

function slugForPath(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

async function migrateAmenities({ baseId, table, view, updateExisting = false, dryRun = false, limit }) {
    let offset;
    let processed = 0;
    let created = 0;
    let updated = 0;

    // No limitamos campos en la petición para evitar errores de nombre desconocido;
    // usaremos pick() con múltiples alias al parsear.
    const wantedFields = undefined;

    // Precargar categorías y alias para normalizar nombres y evitar duplicados por tildes/casos
    const categories = await Category.findAll({ attributes: ['id', 'name'] });
    const categoryKeyToObj = new Map();
    for (const c of categories) categoryKeyToObj.set(normalizeTextKey(c.name), c);
    let categoryAliasMap = new Map();
    try {
        const aliasPath = path.resolve(__dirname, '../data/category_aliases.json');
        const fs = await import('fs');
        if (fs.default.existsSync(aliasPath)) {
            const aliases = JSON.parse(fs.default.readFileSync(aliasPath, 'utf8'));
            categoryAliasMap = new Map(Object.entries(aliases).map(([a, t]) => [normalizeTextKey(a), normalizeTextKey(t)]));
        }
    } catch { }

    async function getOrCreateCategoryNormalized(nameRaw) {
        const keyRaw = normalizeTextKey(nameRaw);
        const targetKey = categoryAliasMap.get(keyRaw) || keyRaw;
        if (!targetKey) return null;
        let cat = categoryKeyToObj.get(targetKey);
        if (cat) return cat;
        // si no existe, crear con el mejor nombre disponible (preferimos alias target si existe en mapa)
        const displayName = nameRaw || targetKey;
        const [createdCat] = await Category.findOrCreate({ where: { name: displayName }, defaults: { name: displayName } });
        categoryKeyToObj.set(targetKey, createdCat);
        return createdCat;
    }

    do {
        const page = await airtableRequest({ baseId, table, view, offset, fields: wantedFields });
        const records = Array.isArray(page.records) ? page.records : [];
        for (const row of records) {
            const rec = row.fields || {};
            const name = truncate(normalizeString(pick(rec, ['item', 'name', 'Name'])));
            if (!name) continue;

            const brandName = truncate(normalizeString(pick(rec, ['brand', 'Brand', 'marca', 'Marca'])));
            const categoryName = truncate(normalizeString(pick(rec, ['category', 'Category', 'categoria', 'Categoría', 'group', 'Group', 'tipo', 'Tipo'])));
            const reference = truncate(normalizeString(pick(rec, ['reference', 'ref', 'Reference', 'REF'])));
            const model = truncate(normalizeString(pick(rec, ['model', 'Model', 'modelo', 'Modelo'])));
            const description = normalizeString(pick(rec, ['description', 'Description', 'descripcion', 'Descripción']));
            const basePriceStr = normalizeString(pick(rec, ['base_price', 'price', 'Price']));
            const basePrice = basePriceStr ? Number(String(basePriceStr).replace(/[^0-9.,]/g, '').replace(',', '.')) : null;
            const imageSources = parseUrlsFromCell(pick(rec, ['images', 'gallery', 'image', 'Image']));

            processed += 1;
            if (limit && processed > Number(limit)) break;
            if (dryRun) continue;

            const brand = await getOrCreateBrand(brandName);
            const catObj = await getOrCreateCategoryNormalized(categoryName);
            const categoryId = catObj?.id || null;

            // Unicidad por (name + brand + model + reference + category)
            const where = { name, brand_id: brand?.id || null, model: model || null, reference: reference || null, category_id: categoryId };
            const defaults = { ...where, description: description || null, base_price: basePrice || null };
            const [amenity, isCreated] = await Amenity.findOrCreate({ where, defaults });
            if (isCreated) {
                created += 1;
            } else if (updateExisting) {
                const updates = {};
                if (categoryId && amenity.category_id !== categoryId) updates.category_id = categoryId;
                if (description) updates.description = description;
                if (basePrice != null) updates.base_price = basePrice;
                if (Object.keys(updates).length) { await amenity.update(updates); updated += 1; }
            } else if (!amenity.category_id && categoryId) {
                try { await amenity.update({ category_id: categoryId }); } catch { }
            }

            // Subir imágenes (hasta 5) con ruta determinista para idempotencia
            if (imageSources.length && (isCreated || updateExisting || !amenity.images || amenity.images.length === 0)) {
                const uploaded = [];
                for (let i = 0; i < Math.min(imageSources.length, 5); i++) {
                    const src = imageSources[i];
                    try {
                        const ext = path.extname(new URL(src).pathname) || '.jpg';
                        const key = `amenities/${slugForPath(name)}${reference ? '-' + slugForPath(reference) : ''}${model ? '-' + slugForPath(model) : ''}/image-${i + 1}${ext}`;
                        const publicUrl = await uploadFromUrl({ url: src, destinationPath: key });
                        uploaded.push(publicUrl);
                    } catch { }
                }
                if (uploaded.length) {
                    await amenity.update({ images: uploaded });
                }
            }
        }
        offset = page.offset;
        if (offset) await new Promise((r) => setTimeout(r, 250));
        if (limit && processed >= Number(limit)) break;
    } while (offset);

    return { processed, created, updated };
}

function parseArgs() {
    const baseIdx = process.argv.findIndex((a) => a === '--base');
    const tableIdx = process.argv.findIndex((a) => a === '--table');
    const viewIdx = process.argv.findIndex((a) => a === '--view');
    const updateExisting = process.argv.includes('--update');
    const dryRun = process.argv.includes('--dry-run');
    const limitIdx = process.argv.findIndex((a) => a === '--limit');
    const baseId = baseIdx !== -1 ? process.argv[baseIdx + 1] : DEFAULT_BASE;
    const table = tableIdx !== -1 ? process.argv[tableIdx + 1] : DEFAULT_TABLE;
    const view = viewIdx !== -1 ? process.argv[viewIdx + 1] : DEFAULT_VIEW;
    return { baseId, table, view, updateExisting, dryRun, limit: limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : undefined };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const res = await migrateAmenities(args);
    await sequelize.close();
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


