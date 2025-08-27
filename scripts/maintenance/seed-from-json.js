import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';

dotenv.config();

import sequelize from '../src/config/database.js';
import { Brand, Supplier, RoomType } from '../src/models/index.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');

async function readJson(fileName) {
    const filePath = path.join(dataDir, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
}

async function importArray(model, items, uniqueFields = [], updateExisting = false) {
    for (const item of items) {
        if (uniqueFields.length > 0) {
            const where = Object.fromEntries(uniqueFields.map((f) => [f, item[f]]));
            const [record, created] = await model.findOrCreate({ where, defaults: item });
            if (!created && updateExisting) {
                await record.update(item);
            }
        } else {
            await model.create(item);
        }
    }
}

async function main() {
    const doBrands = process.argv.includes('--brands');
    const doSuppliers = process.argv.includes('--suppliers');
    const doRoomsType = process.argv.includes('--rooms-type');
    const updateExisting = process.argv.includes('--update');
    const all = !doBrands && !doSuppliers && !doRoomsType;

    await sequelize.authenticate();

    if (all || doRoomsType) {
        const data = await readJson('rooms_type.json');
        await importArray(RoomType, data, ['name'], updateExisting);
        // eslint-disable-next-line no-console
        console.log(`Importados rooms_type: ${data.length}`);
    }

    if (all || doBrands) {
        const data = await readJson('brands.json');
        await importArray(Brand, data, ['name'], updateExisting);
        // eslint-disable-next-line no-console
        console.log(`Importadas brands: ${data.length}`);
    }

    if (all || doSuppliers) {
        const data = await readJson('suppliers.json');
        await importArray(Supplier, data, ['name'], updateExisting);
        // eslint-disable-next-line no-console
        console.log(`Importados suppliers: ${data.length}`);
    }

    // homes/categorías se migrarán desde Airtable en migraciones idempotentes

    await sequelize.close();
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
});
