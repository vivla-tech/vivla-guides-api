import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { Brand } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField } from '../../validators/common.js';

const router = Router();
const service = new CrudService(Brand);
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [...stringField('name', true), ...stringField('website'), ...stringField('contact_info')], validate, controller.create);
router.put('/:id', [...idParam, ...stringField('name'), ...stringField('website'), ...stringField('contact_info')], validate, controller.update);
router.delete('/:id', idParam, validate, controller.remove);

export default router;
