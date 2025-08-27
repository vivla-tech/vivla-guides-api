import dotenv from 'dotenv';
import sequelize from '../../src/config/database.js';
import { Amenity, HomeInventory, Category } from '../../src/models/index.js';

dotenv.config();

function normalizeKeyPart(v) {
    if (v == null) return 'null';
    const s = String(v).trim().toLowerCase();
    return s.replace(/^ref\.?\s*/, '').replace(/\s+/g, ' ');
}

async function consolidate({ dryRun = true, limitGroups }) {
    const amenities = await Amenity.findAll({
        attributes: ['id', 'name', 'brand_id', 'reference', 'model', 'category_id', 'created_at'],
        raw: true,
    });

    // Pre-cargar categorías para asegurar consistencia si fuera necesario (ahora solo para futuro uso)
    const categories = await Category.findAll({ attributes: ['id', 'name'], raw: true });
    const categoryIdToName = new Map(categories.map((c) => [c.id, c.name]));

    const groups = new Map();
    for (const a of amenities) {
        const key = [
            normalizeKeyPart(a.name),
            a.brand_id || 'null',
            normalizeKeyPart(a.model),
            normalizeKeyPart(a.reference),
            a.category_id || 'null',
        ].join('|');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
    }

    let totalGroups = 0;
    let duplicateGroups = 0;
    let duplicatesCount = 0;
    let inventoryUpdates = 0;
    const examples = [];

    // Orden canónico: más antiguo primero (created_at ASC, fallback id ASC)
    function sortCanonical(a, b) {
        const ca = new Date(a.created_at).getTime();
        const cb = new Date(b.created_at).getTime();
        if (ca !== cb) return ca - cb;
        return String(a.id).localeCompare(String(b.id));
    }

    // Podemos limitar grupos procesados en seco
    let processedGroups = 0;

    for (const [key, list] of groups.entries()) {
        totalGroups += 1;
        if (list.length <= 1) continue;
        duplicateGroups += 1;
        list.sort(sortCanonical);
        const canonical = list[0];
        const dups = list.slice(1);
        duplicatesCount += dups.length;

        // Contar inventario a mover
        const dupIds = dups.map((d) => d.id);
        const invCount = await HomeInventory.count({ where: { amenity_id: dupIds } });
        inventoryUpdates += invCount;

        if (examples.length < 5) {
            examples.push({ key, canonical: canonical.id, duplicates: dupIds.slice(0, 5), inventoryToMove: invCount });
        }

        if (!dryRun) {
            await sequelize.transaction(async (t) => {
                // Reasignar inventario
                await HomeInventory.update(
                    { amenity_id: canonical.id },
                    { where: { amenity_id: dupIds }, transaction: t }
                );
                // Borrar duplicados
                await Amenity.destroy({ where: { id: dupIds }, transaction: t });
            });
        }

        processedGroups += 1;
        if (limitGroups && processedGroups >= limitGroups) break;
    }

    return { totalAmenities: amenities.length, totalGroups, duplicateGroups, duplicatesCount, inventoryUpdates, examples };
}

function parseArgs() {
    const dryRun = process.argv.includes('--dry-run');
    const limitIdx = process.argv.findIndex((a) => a === '--limit-groups');
    return { dryRun, limitGroups: limitIdx !== -1 ? Number(process.argv[limitIdx + 1]) : undefined };
}

async function main() {
    const args = parseArgs();
    await sequelize.authenticate();
    const res = await consolidate(args);
    await sequelize.close();
    console.log(JSON.stringify(res, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });


