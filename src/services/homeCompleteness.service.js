import { Home, Room, TechnicalPlan, ApplianceGuide, HomeInventory, Playbook, StylingGuide } from '../models/index.js';

const checks = [
    {
        key: 'basic_fields',
        check: (h) => Boolean(h.name && h.destination && h.address && h.main_image),
    },
    {
        key: 'rooms',
        check: (h) => (h.roomsCount || 0) > 0,
    },
    {
        key: 'technical_plans',
        check: (h) => (h.techPlansCount || 0) > 0,
    },
    {
        key: 'appliance_guides',
        check: (h) => (h.applianceGuidesCount || 0) > 0,
    },
    {
        key: 'inventory',
        check: (h) => (h.inventoryCount || 0) > 0,
    },
    {
        key: 'styling_guides',
        check: (h) => (h.stylingGuidesCount || 0) > 0,
    },
    {
        key: 'playbooks',
        check: (h) => (h.playbooksCount || 0) > 0,
    },
];

export async function computeHomesCompleteness() {
    // Obtenemos homes y contadores relacionados
    const homes = await Home.findAll({ raw: true });
    const homeIds = homes.map((h) => h.id);
    if (homeIds.length === 0) return [];

    const [roomsCounts, techCounts, invCounts, styCounts, playCounts, apgCounts] = await Promise.all([
        Room.count({ where: { home_id: homeIds }, group: ['home_id'] }),
        TechnicalPlan.count({ where: { home_id: homeIds }, group: ['home_id'] }),
        HomeInventory.count({ where: { home_id: homeIds }, group: ['home_id'] }),
        StylingGuide.count({
            include: [{ model: Room, attributes: [], required: true, where: { home_id: homeIds } }],
            group: ['room.home_id'],
            // Sequelize no soporta group por alias sin un atributo; usaremos un enfoque alternativo abajo si falla
        }).catch(async () => {
            // Fallback: cargar rooms y contar por home
            const roomIds = await Room.findAll({ where: { home_id: homeIds }, attributes: ['id', 'home_id'], raw: true });
            const styleCountsMap = new Map();
            if (roomIds.length) {
                const styles = await StylingGuide.count({ where: { room_id: roomIds.map((r) => r.id) }, group: ['room_id'] });
                Object.entries(styles).forEach(([roomId, count]) => {
                    const found = roomIds.find((r) => String(r.id) === String(roomId));
                    if (found) {
                        styleCountsMap.set(found.home_id, (styleCountsMap.get(found.home_id) || 0) + Number(count));
                    }
                });
            }
            return Object.fromEntries([...styleCountsMap.entries()]);
        }),
        Playbook.count({
            include: [{ model: Room, attributes: [], required: true, where: { home_id: homeIds } }],
            group: ['room.home_id'],
        }).catch(async () => {
            const roomIds = await Room.findAll({ where: { home_id: homeIds }, attributes: ['id', 'home_id'], raw: true });
            const playCountsMap = new Map();
            if (roomIds.length) {
                const plays = await Playbook.count({ where: { room_id: roomIds.map((r) => r.id) }, group: ['room_id'] });
                Object.entries(plays).forEach(([roomId, count]) => {
                    const found = roomIds.find((r) => String(r.id) === String(roomId));
                    if (found) {
                        playCountsMap.set(found.home_id, (playCountsMap.get(found.home_id) || 0) + Number(count));
                    }
                });
            }
            return Object.fromEntries([...playCountsMap.entries()]);
        }),
        // appliance_guides M:N via pivote: usamos relación inversa con consulta directa a tabla pivot
        Home.sequelize.query(
            'SELECT home_id, COUNT(*)::int as cnt FROM home_appliance_guides WHERE home_id IN (:ids) GROUP BY home_id',
            { type: Home.sequelize.QueryTypes.SELECT, replacements: { ids: homeIds } }
        ).then((rows) => Object.fromEntries(rows.map((r) => [r.home_id, Number(r.cnt)]))),
    ]);

    const roomsMap = normalizeGroupCounts(roomsCounts);
    const techMap = normalizeGroupCounts(techCounts);
    const invMap = normalizeGroupCounts(invCounts);
    const styMap = normalizeGroupCounts(styCounts);
    const playMap = normalizeGroupCounts(playCounts);
    const apgMap = apgCounts; // ya normalizado

    const results = homes.map((h) => {
        const enriched = {
            ...h,
            roomsCount: Number(roomsMap[h.id] || 0),
            techPlansCount: Number(techMap[h.id] || 0),
            inventoryCount: Number(invMap[h.id] || 0),
            stylingGuidesCount: Number(styMap[h.id] || 0),
            playbooksCount: Number(playMap[h.id] || 0),
            applianceGuidesCount: Number(apgMap[h.id] || 0),
        };

        const missing = checks.filter((c) => !c.check(enriched)).map((c) => c.key);
        const present = checks.filter((c) => c.check(enriched)).map((c) => c.key);
        const completeness = Math.round((present.length / checks.length) * 100);

        return {
            home_id: h.id,
            name: h.name,
            destination: h.destination,
            completeness,
            present,
            missing,
            counts: {
                rooms: enriched.roomsCount,
                technical_plans: enriched.techPlansCount,
                appliance_guides: enriched.applianceGuidesCount,
                inventory: enriched.inventoryCount,
                styling_guides: enriched.stylingGuidesCount,
                playbooks: enriched.playbooksCount,
            },
        };
    });

    return results;
}

function normalizeGroupCounts(groupResult) {
    if (!groupResult) return {};
    // Sequelize puede devolver objeto {id: count} o array de filas según dialecto/versión
    if (Array.isArray(groupResult)) {
        // Cuando se usa COUNT con group y raw, a veces devuelve números con claves de valor
        // No confiable; devolvemos vacío
        return {};
    }
    return Object.fromEntries(Object.entries(groupResult).map(([k, v]) => [k, Number(v)]));
}
