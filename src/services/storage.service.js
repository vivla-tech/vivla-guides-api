import { getStorageBucket } from '../config/firebase.js';
import { extname } from 'path';
import { lookup as lookupMime } from 'mime-types';
import https from 'https';

export async function uploadBuffer({ buffer, destinationPath, contentType }) {
    const bucket = getStorageBucket();
    const file = bucket.file(destinationPath);
    const options = { metadata: { contentType: contentType || lookupMime(extname(destinationPath)) || 'application/octet-stream' }, resumable: false, public: true };
    await file.save(buffer, options);
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${encodeURI(destinationPath)}`;
}

export async function uploadFromUrl({ url, destinationPath, contentType }) {
    const buffer = await fetchToBufferWithRetry(url, 3);
    return uploadBuffer({ buffer, destinationPath, contentType });
}

export async function deleteObject(destinationPath) {
    const bucket = getStorageBucket();
    const file = bucket.file(destinationPath);
    await file.delete({ ignoreNotFound: true });
}

function fetchToBufferOnce(urlStr) {
    return new Promise((resolve, reject) => {
        const req = https.get(urlStr, { headers: { 'User-Agent': 'vivla-guides-uploader/1.0' }, timeout: 15000 }, (res) => {
            // Soportar redirecciones simples (3xx)
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(fetchToBufferOnce(res.headers.location));
                return;
            }
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode} al descargar ${urlStr}`));
                return;
            }
            const chunks = [];
            res.on('data', (d) => chunks.push(d));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(new Error(`Timeout al descargar ${urlStr}`)); });
    });
}

async function fetchToBufferWithRetry(urlStr, retries = 2) {
    let attempt = 0;
    while (true) {
        try {
            return await fetchToBufferOnce(urlStr);
        } catch (e) {
            if (attempt >= retries) throw e;
            await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
            attempt += 1;
        }
    }
}


