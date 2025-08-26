import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { Supplier } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField } from '../../validators/common.js';

const router = Router();
const service = new CrudService(Supplier);
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [...stringField('name', true), ...stringField('website'), ...stringField('contact_email'), ...stringField('phone')], validate, controller.create);
router.put('/:id', [...idParam, ...stringField('name'), ...stringField('website'), ...stringField('contact_email'), ...stringField('phone')], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
