import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { Home, sequelize } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField } from '../../validators/common.js';
import { computeHomesCompleteness } from '../../services/homeCompleteness.service.js';

const router = Router();
const service = new CrudService(Home);
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
router.get('/with-completeness', paginationQuery, validate, async (req, res, next) => {
    try {
        const list = await service.list(req.query);
        const report = await computeHomesCompleteness();
        const reportMap = new Map(report.map((r) => [r.home_id, r]));

        const items = list.items.map((h) => {
            const r = reportMap.get(h.id) || {};
            return {
                ...h.toJSON(),
                completeness: r.completeness ?? 0,
                present: r.present ?? [],
                missing: r.missing ?? [],
                counts: r.counts ?? {
                    rooms: 0,
                    technical_plans: 0,
                    appliance_guides: 0,
                    inventory: 0,
                    styling_guides: 0,
                    playbooks: 0,
                },
            };
        });

        return res.json({
            success: true,
            data: items,
            meta: {
                page: list.page,
                pageSize: list.pageSize,
                total: list.total,
                totalPages: list.totalPages,
            },
        });
    } catch (err) { return next(err); }
});
router.get('/destinations', async (_req, res, next) => {
    try {
        const rows = await Home.findAll({
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('destination')), 'destination']],
            raw: true,
        });
        const destinations = rows
            .map((r) => r.destination)
            .filter((d) => d && String(d).trim().length > 0)
            .sort((a, b) => String(a).localeCompare(String(b)));
        return res.json({ success: true, data: destinations });
    } catch (err) { return next(err); }
});
router.get('/completeness', async (_req, res, next) => {
    try {
        const report = await computeHomesCompleteness();
        return res.json({ success: true, data: report });
    } catch (err) { return next(err); }
});
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [
    ...stringField('name', true),
    ...stringField('destination'),
    ...stringField('address'),
    ...stringField('main_image'),
    // Campos de texto largo (hasta 5000)
    ...stringField('access', false, 5000),
    ...stringField('parking', false, 5000),
    ...stringField('wifi', false, 5000),
    ...stringField('alarm', false, 5000),
], validate, controller.create);
router.put('/:id', [
    ...idParam,
    ...stringField('name'),
    ...stringField('destination'),
    ...stringField('address'),
    ...stringField('main_image'),
    // Campos de texto largo (hasta 5000)
    ...stringField('access', false, 5000),
    ...stringField('parking', false, 5000),
    ...stringField('wifi', false, 5000),
    ...stringField('alarm', false, 5000),
], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
