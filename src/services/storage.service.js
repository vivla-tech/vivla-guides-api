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
    const buffer = await fetchToBuffer(url);
    return uploadBuffer({ buffer, destinationPath, contentType });
}

export async function deleteObject(destinationPath) {
    const bucket = getStorageBucket();
    const file = bucket.file(destinationPath);
    await file.delete({ ignoreNotFound: true });
}

function fetchToBuffer(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode} al descargar ${url}`));
                return;
            }
            const chunks = [];
            res.on('data', (d) => chunks.push(d));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}


