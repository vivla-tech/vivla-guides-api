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
}
