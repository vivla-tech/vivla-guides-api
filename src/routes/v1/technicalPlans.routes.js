import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { TechnicalPlan } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField, uuidField } from '../../validators/common.js';

const router = Router();
const service = new CrudService(TechnicalPlan);
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [
    ...uuidField('home_id', true),
    ...stringField('title', true),
    ...stringField('description'),
    ...uuidField('plan_file_id'),
], validate, controller.create);
router.put('/:id', [
    ...idParam,
    ...uuidField('home_id'),
    ...stringField('title'),
    ...stringField('description'),
    ...uuidField('plan_file_id'),
], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
