"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // Habilitar pgcrypto para gen_random_uuid()
        await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

        // Tablas base sin dependencias
        // media_files eliminado: ahora se guardan URLs directamente en cada tabla

        await queryInterface.createTable('brands', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            name: { type: Sequelize.STRING, allowNull: false },
            website: { type: Sequelize.STRING },
            contact_info: { type: Sequelize.STRING },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('categories', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            name: { type: Sequelize.STRING, allowNull: false },
            description: { type: Sequelize.STRING },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('suppliers', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            name: { type: Sequelize.STRING, allowNull: false },
            website: { type: Sequelize.STRING },
            contact_email: { type: Sequelize.STRING },
            phone: { type: Sequelize.STRING },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('rooms_type', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            name: { type: Sequelize.STRING, allowNull: false },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('homes', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            name: { type: Sequelize.STRING, allowNull: false },
            destination: { type: Sequelize.STRING },
            address: { type: Sequelize.STRING },
            main_image: { type: Sequelize.STRING },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('rooms', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            name: { type: Sequelize.STRING, allowNull: false },
            home_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'homes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            room_type_id: { type: Sequelize.UUID, references: { model: 'rooms_type', key: 'id' }, onUpdate: 'SET NULL', onDelete: 'SET NULL' },
            description: { type: Sequelize.STRING },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('amenities', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            name: { type: Sequelize.STRING, allowNull: false },
            category_id: { type: Sequelize.UUID, references: { model: 'categories', key: 'id' }, onUpdate: 'SET NULL', onDelete: 'SET NULL' },
            brand_id: { type: Sequelize.UUID, references: { model: 'brands', key: 'id' }, onUpdate: 'SET NULL', onDelete: 'SET NULL' },
            reference: { type: Sequelize.STRING },
            model: { type: Sequelize.STRING },
            description: { type: Sequelize.TEXT },
            base_price: { type: Sequelize.DECIMAL },
            images: { type: Sequelize.JSONB },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('technical_plans', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            home_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'homes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            title: { type: Sequelize.STRING, allowNull: false },
            description: { type: Sequelize.STRING },
            plan_file_url: { type: Sequelize.STRING },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('appliance_guides', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            equipment_name: { type: Sequelize.STRING, allowNull: false },
            brand_id: { type: Sequelize.UUID, references: { model: 'brands', key: 'id' }, onUpdate: 'SET NULL', onDelete: 'SET NULL' },
            model: { type: Sequelize.STRING },
            brief_description: { type: Sequelize.STRING },
            image_urls: { type: Sequelize.JSONB },
            pdf_url: { type: Sequelize.STRING },
            video_url: { type: Sequelize.STRING },
            quick_use_bullets: { type: Sequelize.TEXT },
            maintenance_bullets: { type: Sequelize.TEXT },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        // Tabla pivot Home ⇄ ApplianceGuides
        await queryInterface.createTable('home_appliance_guides', {
            home_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'homes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            appliance_guide_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'appliance_guides', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });
        await queryInterface.addConstraint('home_appliance_guides', {
            fields: ['home_id', 'appliance_guide_id'],
            type: 'primary key',
            name: 'pk_home_appliance_guides',
        });

        await queryInterface.createTable('styling_guides', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            room_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'rooms', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            title: { type: Sequelize.STRING, allowNull: false },
            reference_photo_url: { type: Sequelize.TEXT },
            qr_code_url: { type: Sequelize.TEXT },
            image_urls: { type: Sequelize.JSONB },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('playbooks', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            room_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'rooms', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            type: { type: Sequelize.STRING },
            title: { type: Sequelize.STRING, allowNull: false },
            estimated_time: { type: Sequelize.STRING },
            tasks: { type: Sequelize.TEXT },
            materials: { type: Sequelize.STRING },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.createTable('home_inventory', {
            id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
            home_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'homes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            amenity_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'amenities', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            room_id: { type: Sequelize.UUID, references: { model: 'rooms', key: 'id' }, onUpdate: 'SET NULL', onDelete: 'SET NULL' },
            quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
            location_details: { type: Sequelize.STRING },
            minimum_threshold: { type: Sequelize.INTEGER },
            supplier_id: { type: Sequelize.UUID, references: { model: 'suppliers', key: 'id' }, onUpdate: 'SET NULL', onDelete: 'SET NULL' },
            purchase_link: { type: Sequelize.STRING },
            purchase_price: { type: Sequelize.DECIMAL },
            last_restocked_date: { type: Sequelize.DATE },
            notes: { type: Sequelize.TEXT },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });
    },

    async down(queryInterface) {
        // Eliminar en orden inverso por dependencias
        await queryInterface.dropTable('home_inventory');
        await queryInterface.dropTable('playbooks');
        await queryInterface.dropTable('styling_guides');
        await queryInterface.dropTable('home_appliance_guides');
        await queryInterface.dropTable('appliance_guides');
        await queryInterface.dropTable('technical_plans');
        await queryInterface.dropTable('amenities');
        await queryInterface.dropTable('rooms');
        await queryInterface.dropTable('homes');
        await queryInterface.dropTable('rooms_type');
        await queryInterface.dropTable('suppliers');
        await queryInterface.dropTable('categories');
        await queryInterface.dropTable('brands');
        // media_files ya no existe en el esquema consolidado

        await queryInterface.sequelize.query('DROP EXTENSION IF EXISTS "pgcrypto";');
    },
};
