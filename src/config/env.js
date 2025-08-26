import dotenv from 'dotenv';

dotenv.config();

export const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 3000),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        name: process.env.DB_NAME || 'vivla_guides_dev',
        user: process.env.DB_USER || 'postgres',
        pass: process.env.DB_PASSWORD || null,
        ssl: process.env.DB_SSL === 'true',
    },
};
