/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const desc = await queryInterface.describeTable('styling_guides');
        if (desc.reference_photo_url && desc.reference_photo_url.type.toLowerCase().includes('character varying')) {
            await queryInterface.changeColumn('styling_guides', 'reference_photo_url', { type: Sequelize.TEXT, allowNull: true });
        }
        if (desc.qr_code_url && desc.qr_code_url.type.toLowerCase().includes('character varying')) {
            await queryInterface.changeColumn('styling_guides', 'qr_code_url', { type: Sequelize.TEXT, allowNull: true });
        }
    },
    async down(queryInterface, Sequelize) {
        // Revertir a VARCHAR(255)
        const desc = await queryInterface.describeTable('styling_guides');
        if (desc.reference_photo_url) {
            await queryInterface.changeColumn('styling_guides', 'reference_photo_url', { type: Sequelize.STRING, allowNull: true });
        }
        if (desc.qr_code_url) {
            await queryInterface.changeColumn('styling_guides', 'qr_code_url', { type: Sequelize.STRING, allowNull: true });
        }
    },
};


