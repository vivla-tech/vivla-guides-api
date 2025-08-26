import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { Playbook } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField, uuidField } from '../../validators/common.js';

const router = Router();
const service = new CrudService(Playbook);
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [
    ...uuidField('room_id', true),
    ...stringField('type'),
    ...stringField('title', true),
    ...stringField('estimated_time'),
    ...stringField('tasks', false, 5000),
    ...stringField('materials'),
], validate, controller.create);
router.put('/:id', [
    ...idParam,
    ...uuidField('room_id'),
    ...stringField('type'),
    ...stringField('title'),
    ...stringField('estimated_time'),
    ...stringField('tasks', false, 5000),
    ...stringField('materials'),
], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
