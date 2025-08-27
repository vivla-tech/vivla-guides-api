import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import url from 'url';

dotenv.config();

import sequelize from '../src/config/database.js';
import { RoomType } from '../src/models/index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function getEnv(name) { return process.env[name]; }
const DEFAULT_BASE = getEnv('AT_BASIC_BASE') || '';
const DEFAULT_TABLE = getEnv('AT_STYLING_TABLE') || '';
const DEFAULT_VIEW = getEnv('AT_STYLING_VIEW') || undefined;

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

function normalizeText(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}

function loadAliasMap() {
    try {
        const aliasPath = path.resolve(__dirname, '../data/room_type_aliases.json');
        if (fs.existsSync(aliasPath)) {
            const obj = JSON.parse(fs.readFileSync(aliasPath, 'utf8'));
            const map = new Map();
            for (const [k, v] of Object.entries(obj)) map.set(normalizeText(k), String(v));
            return map;
        }
    } catch { }
    return new Map();
}

const RULES = [
    { key: 'salón', patterns: ['salon', 'sala', 'estar', 'living'] },
    { key: 'cocina', patterns: ['cocina', 'kitchen'] },
    { key: 'baño', patterns: ['baño', 'bano', 'aseo', 'bath'] },
    { key: 'dormitorio', patterns: ['dormitorio', 'habitacion', 'hab ', 'ppal', 'principal', 'master', 'suite', 'alcoba', 'bedroom'] },
    { key: 'comedor', patterns: ['comedor', 'dining'] },
    { key: 'exterior', patterns: ['terraza', 'balcon', 'balcón', 'patio', 'jardin', 'jardín', 'exterior', 'porche'] },
    { key: 'lavadero', patterns: ['lavadero', 'laundry'] },
    { key: 'despacho', patterns: ['despacho', 'oficina', 'office', 'estudio'] },
    { key: 'vestidor', patterns: ['vestidor'] },
    { key: 'garaje', patterns: ['garaje', 'garage'] },
    { key: 'trastero', patterns: ['trastero', 'almacen', 'almacén'] },
    { key: 'pasillo', patterns: ['pasillo'] },
    { key: 'distribuidor', patterns: ['distribuidor', 'recibidor', 'entrada', 'hall'] },
    { key: 'gimnasio', patterns: ['gimnasio', 'gym'] },
    { key: 'spa', patterns: ['spa', 'sauna'] },
    { key: 'piscina', patterns: ['piscina', 'pool'] },
    { key: 'habitación infantil', patterns: ['infantil', 'kids', 'ninos', 'niños', 'bebe', 'bebé'] },
];

function detectRoomType(name, aliasMap) {
    const n = normalizeText(name);
    if (!n) return null;
    for (const [aliasKey, target] of aliasMap.entries()) {
        if (aliasKey && n.includes(aliasKey)) return target;
    }
    for (const rule of RULES) {
        for (const p of rule.patterns) {
            if (n.includes(p)) return rule.key;
        }
    }
    return null;
}

async function migrateRoomTypes({ baseId, table, view, dryRun = false }) {
    const aliasMap = loadAliasMap();
    let offset;
    const detected = new Map();
    let processed = 0;

    do {
        const page = await airtableRequest({ baseId, table, view, offset });
        const records = Array.isArray(page.records) ? page.records : [];
        for (const row of records) {
            const f = row.fields || {};
            const name = f.name || f.Name || f.room || f.Room;
            if (!name) continue;
            processed += 1;
            const typ = detectRoomType(name, aliasMap);
            const key = typ || 'Otro';
            detected.set(key, (detected.get(key) || 0) + 1);
        }
        offset = page.offset;
    } while (offset);

    const typesToCreate = [...detected.keys()].filter((t) => t && t !== 'Otro');
    let created = 0, existed = 0;
    if (!dryRun) {
        for (const t of typesToCreate) {
            const [rec, isCreated] = await RoomType.findOrCreate({ where: { name: t }, defaults: { name: t } });
            if (isCreated) created += 1; else existed += 1;
        }
    }
    return { processed, detected: Object.fromEntries(detected), created, existed };
}

function parseArgs() {
    const baseIdx = process.argv.findIndex((a) => a === '--base');
    const tableIdx = process.argv.findIndex((a) => a === '--table');
    const viewIdx = process.argv.findIndex((a) => a === '--view');
    const dryRun = process.argv.includes('--dry-run');
    const baseId = baseIdx !== -1 ? process.argv[baseIdx + 1] : DEFAULT_BASE;
    const table = tableIdx !== -1 ? process.argv[tableIdx + 1] : DEFAULT_TABLE;
    const view = viewIdx !== -1 ? process.argv[viewIdx + 1] : DEFAULT_VIEW;
    if (!baseId || !table) {
        console.error('Uso: npm run migrate:room-types -- --base BASE_ID --table TABLE_ID [--view VIEW] [--dry-run]');
        process.exit(1);
    }
    return { baseId, table, view, dryRun };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const res = await migrateRoomTypes(args);
    await sequelize.close();
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });

