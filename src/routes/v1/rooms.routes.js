import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { Room } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField, uuidField } from '../../validators/common.js';

const router = Router();
const service = new CrudService(Room);
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
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
