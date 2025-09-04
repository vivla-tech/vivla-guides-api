"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        // Añadir campos de texto largo a la tabla homes
        await queryInterface.addColumn('homes', 'access', {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await queryInterface.addColumn('homes', 'parking', {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await queryInterface.addColumn('homes', 'wifi', {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await queryInterface.addColumn('homes', 'alarm', {
            type: Sequelize.TEXT,
            allowNull: true,
        });
    },

    async down(queryInterface, Sequelize) {
        // Revertir los cambios eliminando las columnas
        await queryInterface.removeColumn('homes', 'access');
        await queryInterface.removeColumn('homes', 'parking');
        await queryInterface.removeColumn('homes', 'wifi');
        await queryInterface.removeColumn('homes', 'alarm');
    }
};
