import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { Home } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField } from '../../validators/common.js';
import { computeHomesCompleteness } from '../../services/homeCompleteness.service.js';

const router = Router();
const service = new CrudService(Home);
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
router.get('/completeness', async (_req, res, next) => {
    try {
        const report = await computeHomesCompleteness();
        return res.json({ success: true, data: report });
    } catch (err) { return next(err); }
});
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [...stringField('name', true), ...stringField('destination'), ...stringField('address'), ...stringField('main_image')], validate, controller.create);
router.put('/:id', [...idParam, ...stringField('name'), ...stringField('destination'), ...stringField('address'), ...stringField('main_image')], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
