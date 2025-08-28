import { Router } from 'express';
import { makeCrudController } from '../../controllers/factory.js';
import CrudService from '../../services/crudService.js';
import { ApplianceGuide, Home } from '../../models/index.js';
import { validate } from '../../middlewares/validate.js';
import { idParam, paginationQuery, stringField, uuidField, urlField, urlArrayField, uuidParam } from '../../validators/common.js';
import createError from 'http-errors';

const router = Router();
const service = new CrudService(ApplianceGuide);
const controller = makeCrudController(service);

router.get('/', paginationQuery, validate, controller.list);
router.get('/:id', idParam, validate, controller.getById);
router.post('/', [
    ...stringField('equipment_name', true),
    ...uuidField('brand_id'),
    ...stringField('model'),
    ...stringField('brief_description'),
    ...urlArrayField('image_urls'),
    ...urlField('pdf_url'),
    ...urlField('video_url'),
    ...stringField('quick_use_bullets', false, 5000),
    ...stringField('maintenance_bullets', false, 5000),
], validate, controller.create);
router.put('/:id', [
    ...idParam,
    ...stringField('equipment_name'),
    ...uuidField('brand_id'),
    ...stringField('model'),
    ...stringField('brief_description'),
    ...urlArrayField('image_urls'),
    ...urlField('pdf_url'),
    ...urlField('video_url'),
    ...stringField('quick_use_bullets', false, 5000),
    ...stringField('maintenance_bullets', false, 5000),
], validate, controller.update);
// Vincular guía a home
router.post('/link', [
    ...uuidField('home_id', true),
    ...uuidField('appliance_guide_id', true),
], validate, async (req, res, next) => {
    try {
        const { home_id, appliance_guide_id } = req.body;
        const home = await Home.findByPk(home_id);
        const guide = await ApplianceGuide.findByPk(appliance_guide_id);
        if (!home || !guide) throw createError(404, 'Home o guía no encontrada');
        const alreadyLinked = await home.hasAppliance_guide(guide);
        if (!alreadyLinked) {
            await home.addAppliance_guide(guide);
        }
        return res.json({ success: true });
    } catch (err) { return next(err); }
});

// Desvincular guía de home
router.delete('/link', [
    ...uuidField('home_id', true),
    ...uuidField('appliance_guide_id', true),
], validate, async (req, res, next) => {
    try {
        const { home_id, appliance_guide_id } = req.body;
        const home = await Home.findByPk(home_id);
        const guide = await ApplianceGuide.findByPk(appliance_guide_id);
        if (!home || !guide) throw createError(404, 'Home o guía no encontrada');
        await home.removeAppliance_guide(guide);
        return res.json({ success: true });
    } catch (err) { return next(err); }
});

// Listar guías de un home
router.get('/by-home/:homeId', [...uuidParam('homeId')], validate, async (req, res, next) => {
    try {
        const home = await Home.findByPk(req.params.homeId);
        if (!home) throw createError(404, 'Home no encontrado');
        const guides = await home.getAppliance_guides();
        return res.json({ success: true, data: guides });
    } catch (err) { return next(err); }
});

// Eliminar guía por id (colocado tras rutas específicas para evitar colisiones con '/link')
router.delete('/:id', idParam, validate, controller.remove);

export default router;
