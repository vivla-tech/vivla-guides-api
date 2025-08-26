import sequelize from '../config/database.js';
import { DataTypes } from 'sequelize';

import BrandModel from './brand.model.js';
import CategoryModel from './category.model.js';
import SupplierModel from './supplier.model.js';
import RoomTypeModel from './roomType.model.js';
import HomeModel from './home.model.js';
import RoomModel from './room.model.js';
import AmenityModel from './amenity.model.js';
import TechnicalPlanModel from './technicalPlan.model.js';
import ApplianceGuideModel from './applianceGuide.model.js';
import HomeInventoryModel from './homeInventory.model.js';
import StylingGuideModel from './stylingGuide.model.js';
import PlaybookModel from './playbook.model.js';

// Inicialización de modelos
const Brand = BrandModel(sequelize, DataTypes);
const Category = CategoryModel(sequelize, DataTypes);
const Supplier = SupplierModel(sequelize, DataTypes);
const RoomType = RoomTypeModel(sequelize, DataTypes);
const Home = HomeModel(sequelize, DataTypes);
const Room = RoomModel(sequelize, DataTypes);
const Amenity = AmenityModel(sequelize, DataTypes);
const TechnicalPlan = TechnicalPlanModel(sequelize, DataTypes);
const ApplianceGuide = ApplianceGuideModel(sequelize, DataTypes);
const HomeInventory = HomeInventoryModel(sequelize, DataTypes);
const StylingGuide = StylingGuideModel(sequelize, DataTypes);
const Playbook = PlaybookModel(sequelize, DataTypes);

// Asociaciones
Home.hasMany(Room, { foreignKey: 'home_id' });
Room.belongsTo(Home, { foreignKey: 'home_id' });

RoomType.hasMany(Room, { foreignKey: 'room_type_id' });
Room.belongsTo(RoomType, { foreignKey: 'room_type_id' });

Home.hasMany(TechnicalPlan, { foreignKey: 'home_id' });
TechnicalPlan.belongsTo(Home, { foreignKey: 'home_id' });

Brand.hasMany(Amenity, { foreignKey: 'brand_id' });
Category.hasMany(Amenity, { foreignKey: 'category_id' });
Amenity.belongsTo(Brand, { foreignKey: 'brand_id' });
Amenity.belongsTo(Category, { foreignKey: 'category_id' });

Supplier.hasMany(HomeInventory, { foreignKey: 'supplier_id' });
HomeInventory.belongsTo(Supplier, { foreignKey: 'supplier_id' });
HomeInventory.belongsTo(Home, { foreignKey: 'home_id' });
HomeInventory.belongsTo(Amenity, { foreignKey: 'amenity_id' });
HomeInventory.belongsTo(Room, { foreignKey: 'room_id' });
Home.hasMany(HomeInventory, { foreignKey: 'home_id' });
Amenity.hasMany(HomeInventory, { foreignKey: 'amenity_id' });
Room.hasMany(HomeInventory, { foreignKey: 'room_id' });

// ApplianceGuides M:N con Home
Home.belongsToMany(ApplianceGuide, { through: 'home_appliance_guides', foreignKey: 'home_id', otherKey: 'appliance_guide_id' });
ApplianceGuide.belongsToMany(Home, { through: 'home_appliance_guides', foreignKey: 'appliance_guide_id', otherKey: 'home_id' });
ApplianceGuide.belongsTo(Brand, { foreignKey: 'brand_id' });

Room.hasMany(StylingGuide, { foreignKey: 'room_id' });
StylingGuide.belongsTo(Room, { foreignKey: 'room_id' });

Room.hasMany(Playbook, { foreignKey: 'room_id' });
Playbook.belongsTo(Room, { foreignKey: 'room_id' });

export {
    sequelize,
    Brand,
    Category,
    Supplier,
    RoomType,
    Home,
    Room,
    Amenity,
    TechnicalPlan,
    ApplianceGuide,
    HomeInventory,
    StylingGuide,
    Playbook,
};
