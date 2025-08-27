import https from 'https';
import querystring from 'querystring';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import url from 'url';

dotenv.config();

import sequelize from '../src/config/database.js';
import { Home, Room, RoomType, StylingGuide, Playbook } from '../src/models/index.js';
import { uploadFromUrl } from '../src/services/storage.service.js';

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

function normalizeHomeName(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/^\s*(casa|villa|apartamento|apartment|apt\.?|house)\s+/, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function slugForPath(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseUrlsFromCell(value) {
    if (!value) return [];
    if (typeof value === 'string') {
        const urls = Array.from(value.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]);
        return urls;
    }
    if (Array.isArray(value)) {
        const urls = [];
        for (const v of value) {
            if (v && typeof v === 'object' && typeof v.url === 'string') urls.push(v.url);
            else if (typeof v === 'string') urls.push(v);
        }
        return urls;
    }
    return [];
}

function splitDescriptionToBullets(desc) {
    if (!desc) return null;
    const lines = String(desc).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const items = [];
    for (let l of lines) {
        l = l.replace(/^[-•–]\s*/, '').trim();
        if (l) items.push(`- ${l}`);
    }
    return items.length ? items.join('\n') : null;
}

function loadHomeAliases() {
    const map = new Map();
    try {
        const aliasPath = path.resolve(__dirname, '../data/home_aliases.json');
        if (fs.existsSync(aliasPath)) {
            const obj = JSON.parse(fs.readFileSync(aliasPath, 'utf8'));
            for (const [alias, target] of Object.entries(obj)) map.set(normalizeHomeName(alias), normalizeHomeName(target));
        }
    } catch { }
    return map;
}

function loadRoomTypeAliasMap() {
    const map = new Map();
    try {
        const aliasPath = path.resolve(__dirname, '../data/room_type_aliases.json');
        if (fs.existsSync(aliasPath)) {
            const obj = JSON.parse(fs.readFileSync(aliasPath, 'utf8'));
            for (const [k, v] of Object.entries(obj)) map.set(normalizeText(k), String(v));
        }
    } catch { }
    return map;
}

const ROOM_RULES = [
    { key: 'salón', patterns: ['salon', 'sala', 'estar', 'living'] },
    { key: 'cocina', patterns: ['cocina', 'kitchen'] },
    { key: 'baño', patterns: ['baño', 'bano', 'aseo', 'bath'] },
    { key: 'dormitorio', patterns: ['dormitorio', 'habitacion', 'hab ', 'ppal', 'principal', 'master', 'suite', 'alcoba', 'bedroom'] },
    { key: 'comedor', patterns: ['comedor', 'dining'] },
    { key: 'exterior', patterns: ['terraza', 'balcon', 'balcón', 'patio', 'jardin', 'jardín', 'exterior', 'porche'] },
];

function detectRoomType(name, aliasMap) {
    const n = normalizeText(name);
    if (!n) return null;
    for (const [aliasKey, target] of aliasMap.entries()) { if (aliasKey && n.includes(aliasKey)) return target; }
    for (const r of ROOM_RULES) { for (const p of r.patterns) { if (n.includes(p)) return r.key; } }
    return null;
}

async function migrateStyling({ baseId, table, view, updateExisting = false, dryRun = false, limit, reuploadMedia = false }) {
    // Preload homes map (normalización robusta)
    const homes = await Home.findAll({ attributes: ['id', 'name'], raw: true });
    const homeKeyToId = new Map();
    for (const h of homes) homeKeyToId.set(normalizeHomeName(h.name), h.id);
    const homeAliasToKey = loadHomeAliases();

    // Preload room types
    const roomTypes = await RoomType.findAll({ attributes: ['id', 'name'], raw: true });
    const roomTypeNameToId = new Map(roomTypes.map((rt) => [normalizeText(rt.name), rt.id]));
    const rtAlias = loadRoomTypeAliasMap();

    let offset; let processed = 0; let createdSG = 0; let updatedSG = 0; let createdPB = 0; let updatedPB = 0; let createdRooms = 0;

    do {
        const page = await airtableRequest({ baseId, table, view, offset });
        const records = Array.isArray(page.records) ? page.records : [];
        for (const row of records) {
            const f = row.fields || {};
            const roomNameRaw = f.name || f.Name || f.room || f.Room;
            const homeNameRaw = f.guides || f['guides 2'] || f['guides 3'];
            if (!roomNameRaw || !homeNameRaw) { processed += 1; continue; }

            const raw = normalizeText(homeNameRaw)
                .replace(/^guia de casa\s+/i, '')
                .replace(/^guia de /i, '')
                .replace(/^guía de casa\s+/i, '')
                .replace(/^guía de /i, '');
            const normalized = normalizeHomeName(raw);
            const targetKey = homeAliasToKey.get(normalized) || normalized;
            const homeId = homeKeyToId.get(targetKey);
            if (!homeId) { processed += 1; continue; }

            // Resolve or create room
            const roomName = String(roomNameRaw).trim();
            let room = await Room.findOne({ where: { name: roomName, home_id: homeId } });
            if (!room) {
                // detect room type
                const rtName = detectRoomType(roomName, rtAlias);
                const rtId = rtName ? roomTypeNameToId.get(normalizeText(rtName)) || null : null;
                if (!dryRun) {
                    room = await Room.create({ name: roomName, home_id: homeId, room_type_id: rtId });
                }
                createdRooms += 1;
            }

            // Build media
            const galleryUrls = parseUrlsFromCell(f.gallery || f.Gallery);
            let refUrl;
            const uploaded = [];
            if (!dryRun && galleryUrls.length) {
                for (let i = 0; i < galleryUrls.length; i++) {
                    const src = galleryUrls[i];
                    try {
                        const ext = path.extname(new URL(src).pathname) || '.jpg';
                        const key = `styling/${slugForPath(targetKey)}/${slugForPath(roomName)}/image-${i + 1}${ext}`;
                        const publicUrl = await uploadFromUrl({ url: src, destinationPath: key });
                        uploaded.push(publicUrl);
                    } catch (e) { /* no fallback: forzamos subida a storage únicamente */ }
                }
                if (uploaded.length) refUrl = uploaded[0];
            }

            // StylingGuide upsert by (room_id, title)
            const title = roomName;
            let sg;
            const whereSG = { room_id: room?.id || null, title };
            if (!dryRun) {
                const [rec, isCreated] = await StylingGuide.findOrCreate({ where: whereSG, defaults: { ...whereSG, reference_photo_url: refUrl || null, image_urls: uploaded.length ? uploaded : null } });
                sg = rec;
                if (!isCreated && (updateExisting || reuploadMedia)) {
                    const updates = {};
                    if (refUrl && sg.reference_photo_url !== refUrl) updates.reference_photo_url = refUrl;
                    if (uploaded.length) updates.image_urls = uploaded;
                    if (Object.keys(updates).length) { await sg.update(updates); updatedSG += 1; }
                } else if (isCreated) { createdSG += 1; }
            }

            // Playbook upsert by (room_id, type, title)
            const tasksText = splitDescriptionToBullets(f.description || f.Description);
            if (!dryRun) {
                const wherePB = { room_id: room?.id || null, type: 'styling', title };
                const defaultsPB = { ...wherePB, tasks: tasksText || null };
                const [pb, isCreatedPB] = await Playbook.findOrCreate({ where: wherePB, defaults: defaultsPB });
                if (!isCreatedPB && updateExisting) {
                    // Actualiza tareas si ahora hay contenido nuevo
                    if (tasksText != null && pb.tasks !== tasksText) { await pb.update({ tasks: tasksText }); updatedPB += 1; }
                } else if (isCreatedPB) { createdPB += 1; }
            }

            processed += 1;
            if (limit && processed >= Number(limit)) break;
        }
        offset = page.offset;
        if (limit && processed >= Number(limit)) break;
    } while (offset);

    return { processed, createdRooms, createdSG, updatedSG, createdPB, updatedPB };
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
    const limit = limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : undefined;
    const reuploadMedia = process.argv.includes('--reupload-media');
    if (!baseId || !table) {
        console.error('Uso: npm run migrate:styling -- --base BASE_ID --table TABLE_ID [--view VIEW] [--update] [--dry-run] [--limit N]');
        process.exit(1);
    }
    return { baseId, table, view, updateExisting, dryRun, limit, reuploadMedia };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const res = await migrateStyling(args);
    await sequelize.close();
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


