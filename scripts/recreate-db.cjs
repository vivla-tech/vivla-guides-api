const { Client } = require('pg');
require('dotenv').config();

async function main() {
    const env = process.env;
    const dbName = env.DB_NAME || 'vivla_guides_dev';
    const client = new Client({
        host: env.DB_HOST || '127.0.0.1',
        port: Number(env.DB_PORT || 5432),
        user: env.DB_USER || 'postgres',
        password: env.DB_PASSWORD || '',
        database: 'postgres',
    });
    await client.connect();
    await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();`, [dbName]);
    await client.query(`DROP DATABASE IF EXISTS "${dbName}";`);
    await client.query(`CREATE DATABASE "${dbName}";`);
    await client.end();
    // eslint-disable-next-line no-console
    console.log(`Recreada base de datos: ${dbName}`);
}

main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
});
