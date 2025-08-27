/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const desc = await queryInterface.describeTable('styling_guides');
        if (!desc.image_urls) {
            await queryInterface.addColumn('styling_guides', 'image_urls', { type: Sequelize.JSONB, allowNull: true });
        }
    },

    async down(queryInterface, Sequelize) {
        const desc = await queryInterface.describeTable('styling_guides');
        if (desc.image_urls) {
            await queryInterface.removeColumn('styling_guides', 'image_urls');
        }
    },
};


