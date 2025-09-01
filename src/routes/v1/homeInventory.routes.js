import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import HomeInventoryService from '../../services/homeInventoryService.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField, intField, decimalField, uuidField } from '../../validators/common.js';

const router = Router();
const service = new HomeInventoryService();
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [
    ...uuidField('home_id', true),
    ...uuidField('amenity_id', true),
    ...uuidField('room_id'),
    ...intField('quantity'),
    ...stringField('location_details'),
    ...intField('minimum_threshold'),
    ...uuidField('supplier_id'),
    ...stringField('purchase_link'),
    ...decimalField('purchase_price'),
    ...stringField('notes', false, 5000),
], validate, controller.create);
router.put('/:id', [
    ...idParam,
    ...uuidField('home_id'),
    ...uuidField('amenity_id'),
    ...uuidField('room_id'),
    ...intField('quantity'),
    ...stringField('location_details'),
    ...intField('minimum_threshold'),
    ...uuidField('supplier_id'),
    ...stringField('purchase_link'),
    ...decimalField('purchase_price'),
    ...stringField('notes', false, 5000),
], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
