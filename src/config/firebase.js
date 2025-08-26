import admin from 'firebase-admin';
import fs from 'fs';

let initialized = false;

function getPrivateKeyFromEnv(raw) {
    if (!raw) return undefined;
    // Support both plain PEM and \n-escaped
    const cleaned = raw.replace(/\\n/g, '\n');
    return cleaned;
}

export function getFirebaseApp() {
    if (!initialized) {
        const credsFile = process.env.FIREBASE_CREDENTIALS_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const storageBucketEnv = process.env.FIREBASE_STORAGE_BUCKET;

        if (credsFile && fs.existsSync(credsFile)) {
            const json = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
            const projectIdFromFile = json.project_id;
            const storageBucket = storageBucketEnv || `${projectIdFromFile}.appspot.com`;
            admin.initializeApp({ credential: admin.credential.cert(json), storageBucket });
            initialized = true;
            return admin.app();
        }

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = getPrivateKeyFromEnv(process.env.FIREBASE_PRIVATE_KEY);
        const storageBucket = storageBucketEnv;

        if (projectId && clientEmail && privateKey && storageBucket) {
            admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }), storageBucket });
            initialized = true;
            return admin.app();
        }

        if (!storageBucketEnv) {
            throw new Error('Falta FIREBASE_STORAGE_BUCKET. Define el bucket (ej: <project-id>.appspot.com).');
        }
        admin.initializeApp({ credential: admin.credential.applicationDefault(), storageBucket: storageBucketEnv });
        initialized = true;
    }
    return admin.app();
}

export function getStorageBucket() {
    getFirebaseApp();
    return admin.storage().bucket();
}


