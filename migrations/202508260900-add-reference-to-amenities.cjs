/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('amenities', 'reference', {
            type: Sequelize.STRING,
            allowNull: true,
            after: 'brand_id',
        });
        await queryInterface.addIndex('amenities', ['reference'], { name: 'amenities_reference_idx' });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('amenities', 'amenities_reference_idx');
        await queryInterface.removeColumn('amenities', 'reference');
    }
};


