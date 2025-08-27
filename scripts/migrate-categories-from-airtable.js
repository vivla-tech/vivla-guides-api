import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import path from 'path';
import url from 'url';

dotenv.config();

import sequelize from '../src/config/database.js';
import { Category } from '../src/models/index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Defaults (override con flags o variables de entorno)
const DEFAULT_BASE = process.env.AT_CATEGORIES_BASE || process.env.AT_BASIC_BASE || 'appGt0lNhV0cRxYB1';
const DEFAULT_TABLE = process.env.AT_CATEGORIES_TABLE || 'tbl1HauRsoZCp3RUf';
const DEFAULT_VIEW = process.env.AT_CATEGORIES_VIEW; // opcional

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

function normalize(v) {
    if (v == null) return undefined;
    return String(v).replace(/\s+/g, ' ').trim();
}

async function migrateCategories({ baseId, table, view, categoryField = 'category' }) {
    let offset;
    const seen = new Set();
    let created = 0;
    let processed = 0;

    do {
        const page = await airtableRequest({ baseId, table, view, offset });
        const records = Array.isArray(page.records) ? page.records : [];
        for (const row of records) {
            const rec = row.fields || {};
            const raw = rec[categoryField] ?? rec['Category'] ?? rec['categoria'] ?? rec['Categoría'] ?? rec['group'] ?? rec['Group'];
            const names = Array.isArray(raw) ? raw : [raw];
            for (const n of names) {
                const name = normalize(n);
                if (!name || seen.has(name)) continue;
                seen.add(name);
                processed += 1;
                const [cat, isCreated] = await Category.findOrCreate({ where: { name }, defaults: { name } });
                if (isCreated) created += 1;
            }
        }
        offset = page.offset;
        if (offset) await new Promise((r) => setTimeout(r, 250));
    } while (offset);

    return { processed, created, total: seen.size };
}

function parseArgs() {
    const baseIdx = process.argv.findIndex((a) => a === '--base');
    const tableIdx = process.argv.findIndex((a) => a === '--table');
    const viewIdx = process.argv.findIndex((a) => a === '--view');
    const fieldIdx = process.argv.findIndex((a) => a === '--field');
    const baseId = baseIdx !== -1 ? process.argv[baseIdx + 1] : DEFAULT_BASE;
    const table = tableIdx !== -1 ? process.argv[tableIdx + 1] : DEFAULT_TABLE;
    const view = viewIdx !== -1 ? process.argv[viewIdx + 1] : DEFAULT_VIEW;
    return { baseId, table, view, categoryField: fieldIdx !== -1 ? process.argv[fieldIdx + 1] : 'category' };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const res = await migrateCategories(args);
    await sequelize.close();
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


