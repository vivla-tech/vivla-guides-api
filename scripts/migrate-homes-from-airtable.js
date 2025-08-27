import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import path from 'path';
import url from 'url';

// npm run migrate:homes -- --base appwg5nZZ8ca5rLAh --table tbl5ZNGd5xeS4IrAc --view migrate_homes --update

dotenv.config();

import sequelize from '../src/config/database.js';
import { Home } from '../src/models/index.js';
import { uploadFromUrl } from '../src/services/storage.service.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Defaults (override con flags o variables de entorno)
const DEFAULT_BASE = process.env.AT_HOMES_BASE || 'appwg5nZZ8ca5rLAh';
const DEFAULT_TABLE = process.env.AT_HOMES_TABLE || 'tbl5ZNGd5xeS4IrAc';
const DEFAULT_VIEW = process.env.AT_HOMES_VIEW || 'viwsaWWd8LoiWxugb';

function pick(record, keys) {
    for (const k of keys) {
        if (record[k] != null && String(record[k]).trim() !== '') return record[k];
    }
    return undefined;
}

function normalizeString(value) {
    if (value == null) return undefined;
    return String(value).replace(/\s+/g, ' ').trim();
}

function slugify(value) {
    return String(value)
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
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
    const options = {
        hostname: 'api.airtable.com',
        port: 443,
        path: pathReq,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
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

// Simplificada: solo toma "Main Image"; si no, cae a "Gallery" y extrae la primera URL
function parseUrlFromCell(value) {
    if (!value) return undefined;
    if (typeof value === 'string') {
        // Formato "archivo (https://...)" o URL directa
        const match = value.match(/https?:\/\/[^\s)]+/);
        return match ? match[0] : undefined;
    }
    if (Array.isArray(value)) {
        const first = value[0];
        if (first && typeof first === 'object' && typeof first.url === 'string') return first.url;
        if (typeof first === 'string') return parseUrlFromCell(first);
    }
    return undefined;
}

async function migrateHomes({ baseId, table, view, updateExisting = false, dryRun = false }) {
    let offset;
    let processed = 0;
    let created = 0;
    let updated = 0;
    const errors = [];

    do {
        const page = await airtableRequest({ baseId, table, view, offset });
        const records = Array.isArray(page.records) ? page.records : [];
        for (const row of records) {
            const rec = row.fields || {};
            const name = normalizeString(pick(rec, ['Name', 'Nombre', 'name', 'Home', 'Casa']));
            if (!name) continue;
            const destination = normalizeString(pick(rec, ['Destination Name', 'Destino', 'Destination', 'destino']));
            const address = normalizeString(pick(rec, ['Address', 'Dirección', 'direccion']));
            // Imagen principal: prioriza "Main Image", si no existe usa la primera de "Gallery"
            const mainImageUrl = parseUrlFromCell(rec['Main Image']) || parseUrlFromCell(rec['Gallery']);

            processed += 1;
            if (dryRun) continue;

            const where = { name };
            const defaults = { name, destination: destination || null, address: address || null };
            const [home, isCreated] = await Home.findOrCreate({ where, defaults });
            if (isCreated) created += 1; else if (updateExisting) {
                await home.update(defaults);
                updated += 1;
            }

            // Subir primera imagen (si hay) como main_image
            if (mainImageUrl) {
                try {
                    const key = `homes/${slugify(name)}/main${path.extname(new URL(mainImageUrl).pathname) || '.jpg'}`;
                    const publicUrl = await uploadFromUrl({ url: mainImageUrl, destinationPath: key });
                    if (home.main_image !== publicUrl) {
                        await home.update({ main_image: publicUrl });
                    }
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.warn('Error subiendo imagen de', name, e.message);
                }
            }
        }
        offset = page.offset;
        if (offset) await new Promise((r) => setTimeout(r, 250));
    } while (offset);

    return { processed, created, updated, errors };
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
    return { baseId, table, view, updateExisting, dryRun };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const res = await migrateHomes(args);
    await sequelize.close();
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


