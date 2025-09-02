import CrudService from './crudService.js';
import { HomeInventory, Home, Amenity, Category, Brand, Room, Supplier } from '../models/index.js';

export default class HomeInventoryService extends CrudService {
    constructor() {
        super(HomeInventory, {
            include: [
                {
                    model: Home,
                    as: 'home',
                    attributes: ['id', 'name', 'destination', 'address', 'main_image']
                },
                {
                    model: Amenity,
                    as: 'amenity',
                    include: [
                        {
                            model: Category,
                            as: 'category',
                            attributes: ['id', 'name', 'description']
                        },
                        {
                            model: Brand,
                            as: 'brand',
                            attributes: ['id', 'name', 'website', 'contact_info']
                        }
                    ],
                    attributes: ['id', 'name', 'reference', 'model', 'description', 'base_price', 'images']
                },
                {
                    model: Room,
                    as: 'room',
                    attributes: ['id', 'name', 'description']
                },
                {
                    model: Supplier,
                    as: 'supplier',
                    attributes: ['id', 'name', 'website', 'contact_email', 'phone']
                }
            ]
        });
    }

    async list(query = {}, findOptions = {}) {
        const where = { ...(findOptions.where || {}) };
        if (query.home_id) where.home_id = query.home_id;
        if (query.amenity_id) where.amenity_id = query.amenity_id;
        if (query.room_id) where.room_id = query.room_id;
        if (query.supplier_id) where.supplier_id = query.supplier_id;
        return super.list(query, { ...findOptions, where });
    }
}
