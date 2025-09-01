import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { Amenity } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField, decimalField, uuidField } from '../../validators/common.js';

const router = Router();
const service = new CrudService(Amenity);
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [
    ...stringField('name', true),
    ...uuidField('category_id'),
    ...uuidField('brand_id'),
    ...stringField('reference'),
    ...stringField('model'),
    ...stringField('description', false, 5000),
    ...decimalField('base_price'),
], validate, controller.create);
router.put('/:id', [
    ...idParam,
    ...stringField('name'),
    ...uuidField('category_id'),
    ...uuidField('brand_id'),
    ...stringField('reference'),
    ...stringField('model'),
    ...stringField('description', false, 5000),
    ...decimalField('base_price'),
], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
