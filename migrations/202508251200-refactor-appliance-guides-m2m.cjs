"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // Eliminar home_id de appliance_guides
        const table = await queryInterface.describeTable('appliance_guides');
        if (table.home_id) {
            await queryInterface.removeColumn('appliance_guides', 'home_id');
        }

        // Crear tabla pivot
        await queryInterface.createTable('home_appliance_guides', {
            home_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'homes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            appliance_guide_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'appliance_guides', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        });

        // PK compuesta
        await queryInterface.addConstraint('home_appliance_guides', {
            fields: ['home_id', 'appliance_guide_id'],
            type: 'primary key',
            name: 'pk_home_appliance_guides',
        });

        // Índices útiles
        await queryInterface.addIndex('home_appliance_guides', ['home_id'], { name: 'idx_hag_home' });
        await queryInterface.addIndex('home_appliance_guides', ['appliance_guide_id'], { name: 'idx_hag_guide' });
    },

    async down(queryInterface, Sequelize) {
        // Revertir: eliminar pivot y agregar home_id de nuevo
        await queryInterface.dropTable('home_appliance_guides');
        await queryInterface.addColumn('appliance_guides', 'home_id', { type: Sequelize.UUID, allowNull: false, references: { model: 'homes', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' });
    },
};
