import { Router } from 'express';

import homesRouter from './v1/homes.routes.js';
import brandsRouter from './v1/brands.routes.js';
import categoriesRouter from './v1/categories.routes.js';
import suppliersRouter from './v1/suppliers.routes.js';
import amenitiesRouter from './v1/amenities.routes.js';
import homeInventoryRouter from './v1/homeInventory.routes.js';
import technicalPlansRouter from './v1/technicalPlans.routes.js';
import applianceGuidesRouter from './v1/applianceGuides.routes.js';
import roomsRouter from './v1/rooms.routes.js';
import roomsTypeRouter from './v1/roomsType.routes.js';
import stylingGuidesRouter from './v1/stylingGuides.routes.js';
import playbooksRouter from './v1/playbooks.routes.js';

const router = Router();

router.use('/homes', homesRouter);
router.use('/brands', brandsRouter);
router.use('/categories', categoriesRouter);
router.use('/suppliers', suppliersRouter);
router.use('/amenities', amenitiesRouter);
router.use('/home-inventory', homeInventoryRouter);
router.use('/technical-plans', technicalPlansRouter);
router.use('/appliance-guides', applianceGuidesRouter);
router.use('/rooms', roomsRouter);
router.use('/rooms-type', roomsTypeRouter);
router.use('/styling-guides', stylingGuidesRouter);
router.use('/playbooks', playbooksRouter);

export default router;
