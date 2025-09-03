import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { Room } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField, uuidField } from '../../validators/common.js';
import { ok } from '../../utils/response.js';

const router = Router();
const service = new CrudService(Room);
const controller = makeCrudController(service);

// Listar habitaciones con filtro por home_id
router.get('/', paginationQuery, validate, async (req, res, next) => {
    try {
        const { home_id, ...paginationParams } = req.query;
        const where = {};

        if (home_id) {
            where.home_id = home_id;
        }

        const result = await service.list(paginationParams, { where });
        return ok(res, result.items, {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages
        });
    } catch (err) { return next(err); }
});

router.get('/:id', idParam, validate, controller.getById);
router.post('/', [
    ...stringField('name', true),
    ...uuidField('home_id', true),
    ...uuidField('room_type_id'),
    ...stringField('description'),
], validate, controller.create);
router.put('/:id', [
    ...idParam,
    ...stringField('name'),
    ...uuidField('home_id'),
    ...uuidField('room_type_id'),
    ...stringField('description'),
], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
