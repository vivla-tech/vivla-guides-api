import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { StylingGuide, Room } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField, uuidField, urlField, urlArrayField, uuidQuery } from '../../validators/common.js';

const router = Router();
const service = new CrudService(StylingGuide);
const controller = makeCrudController(service);

router.get('/', [
    ...paginationQuery,
    ...uuidQuery('home_id'),
], validate, async (req, res, next) => {
    try {
        const { home_id } = req.query;
        const include = home_id ? [{ model: Room, where: { home_id }, required: true }] : [];
        const result = await service.list(req.query, { include });
        return res.json({ success: true, data: result.items, meta: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages } });
    } catch (err) { return next(err); }
});
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [
    ...uuidField('room_id', true),
    ...stringField('title', true),
    ...urlField('reference_photo_url'),
    ...urlField('qr_code_url'),
    ...urlArrayField('image_urls'),
], validate, controller.create);
router.put('/:id', [
    ...idParam,
    ...uuidField('room_id'),
    ...stringField('title'),
    ...urlField('reference_photo_url'),
    ...urlField('qr_code_url'),
    ...urlArrayField('image_urls'),
], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
