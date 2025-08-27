import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import url from 'url';

dotenv.config();

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function getEnv(name) {
    return process.env[name];
}

// Defaults (override por flags o variables AT_STYLING_*, con fallback a AT_BASIC_BASE)
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
        const aliasPath = path.resolve(__dirname, '../../data/room_type_aliases.json');
        if (fs.existsSync(aliasPath)) {
            const obj = JSON.parse(fs.readFileSync(aliasPath, 'utf8'));
            const map = new Map();
            for (const [k, v] of Object.entries(obj)) map.set(normalizeText(k), String(v));
            return map;
        }
    } catch { }
    return new Map();
}

// Orden de prioridad para evitar falsos positivos (p. ej. "Dormitorio con baño en suite" → Dormitorio)
const RULES = [
    // Priorizar estancias comunes para evitar falsos positivos (p. ej. "Salón principal" nunca debe caer en dormitorio)
    { key: 'salón', patterns: ['salon', 'sala', 'estar', 'living'] },
    { key: 'cocina', patterns: ['cocina', 'kitchen'] },
    { key: 'baño', patterns: ['baño', 'bano', 'aseo', 'bath'] },
    { key: 'dormitorio', patterns: ['dormitorio', 'habitacion', 'hab ', 'ppal', 'principal', 'master', 'suite', 'alcoba', 'bedroom'] },
    { key: 'comedor', patterns: ['comedor', 'dining'] },
    { key: 'exterior', patterns: ['terraza', 'balcon', 'balcón', 'patio', 'jardin', 'jardín', 'exterior'] },
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
    { key: 'habitacion infantil', patterns: ['infantil', 'kids', 'ninos', 'niños', 'bebe', 'bebé'] },
];

function detectRoomType(name, aliasMap) {
    const n = normalizeText(name);
    if (!n) return null;
    // Alias: si el alias está incluido en el nombre normalizado
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

async function reportRoomTypes({ baseId, table, view }) {
    const aliasMap = loadAliasMap();
    let offset;
    let processed = 0;
    const typeCounts = new Map();
    const samplesPerType = new Map();
    const unknownExamples = new Set();

    do {
        const page = await airtableRequest({ baseId, table, view, offset });
        const records = Array.isArray(page.records) ? page.records : [];
        for (const row of records) {
            const f = row.fields || {};
            const name = f.name || f.Name || f.room || f.Room;
            if (!name) continue;
            processed += 1;
            const typ = detectRoomType(name, aliasMap) || 'Otro';
            typeCounts.set(typ, (typeCounts.get(typ) || 0) + 1);
            if (!samplesPerType.has(typ)) samplesPerType.set(typ, []);
            const arr = samplesPerType.get(typ);
            if (arr.length < 5) arr.push(String(name));
            if (typ === 'Otro' && unknownExamples.size < 20) unknownExamples.add(String(name));
        }
        offset = page.offset;
    } while (offset);

    const countsObj = Object.fromEntries([...typeCounts.entries()].sort((a, b) => b[1] - a[1]));
    const samplesObj = Object.fromEntries([...samplesPerType.entries()]);
    return {
        processed,
        typeCounts: countsObj,
        unknownCount: countsObj.Otro || 0,
        unknownExamples: [...unknownExamples],
        samplesPerType: samplesObj,
    };
}

function parseArgs() {
    const baseIdx = process.argv.findIndex((a) => a === '--base');
    const tableIdx = process.argv.findIndex((a) => a === '--table');
    const viewIdx = process.argv.findIndex((a) => a === '--view');
    const baseId = baseIdx !== -1 ? process.argv[baseIdx + 1] : DEFAULT_BASE;
    const table = tableIdx !== -1 ? process.argv[tableIdx + 1] : DEFAULT_TABLE;
    const view = viewIdx !== -1 ? process.argv[viewIdx + 1] : DEFAULT_VIEW;
    if (!baseId || !table) {
        console.error('Uso: npm run report:room-types -- --base BASE_ID --table TABLE_ID [--view VIEW]');
        process.exit(1);
    }
    return { baseId, table, view };
}

async function main() {
    const args = parseArgs();
    const res = await reportRoomTypes(args);
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


