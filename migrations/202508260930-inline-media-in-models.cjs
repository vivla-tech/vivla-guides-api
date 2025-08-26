/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // amenities: drop default_image_id, add images jsonb
        if (await queryInterface.describeTable('amenities').then(d => d.default_image_id)) {
            await queryInterface.removeColumn('amenities', 'default_image_id');
        }
        await queryInterface.addColumn('amenities', 'images', { type: Sequelize.JSONB, allowNull: true });

        // technical_plans: drop plan_file_id, add plan_file_url
        if (await queryInterface.describeTable('technical_plans').then(d => d.plan_file_id)) {
            await queryInterface.removeColumn('technical_plans', 'plan_file_id');
        }
        await queryInterface.addColumn('technical_plans', 'plan_file_url', { type: Sequelize.STRING, allowNull: true });

        // appliance_guides: drop image_id/pdf_guide_id/video_guide_id, add image_urls/pdf_url/video_url
        const apDesc = await queryInterface.describeTable('appliance_guides');
        if (apDesc.image_id) await queryInterface.removeColumn('appliance_guides', 'image_id');
        if (apDesc.pdf_guide_id) await queryInterface.removeColumn('appliance_guides', 'pdf_guide_id');
        if (apDesc.video_guide_id) await queryInterface.removeColumn('appliance_guides', 'video_guide_id');
        await queryInterface.addColumn('appliance_guides', 'image_urls', { type: Sequelize.JSONB, allowNull: true });
        await queryInterface.addColumn('appliance_guides', 'pdf_url', { type: Sequelize.STRING, allowNull: true });
        await queryInterface.addColumn('appliance_guides', 'video_url', { type: Sequelize.STRING, allowNull: true });

        // styling_guides: drop reference_photo_id, qr_code_id, add urls
        const stDesc = await queryInterface.describeTable('styling_guides');
        if (stDesc.reference_photo_id) await queryInterface.removeColumn('styling_guides', 'reference_photo_id');
        if (stDesc.qr_code_id) await queryInterface.removeColumn('styling_guides', 'qr_code_id');
        await queryInterface.addColumn('styling_guides', 'reference_photo_url', { type: Sequelize.STRING, allowNull: true });
        await queryInterface.addColumn('styling_guides', 'qr_code_url', { type: Sequelize.STRING, allowNull: true });

        // drop media_files table if exists
        const tables = await queryInterface.showAllTables();
        if (tables.includes('media_files')) {
            await queryInterface.dropTable('media_files');
        }
    },

    async down(queryInterface, Sequelize) {
        // recreate media_files table (minimal) and columns
        await queryInterface.createTable('media_files', {
            id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
            filename: { type: Sequelize.STRING, allowNull: false },
            url: { type: Sequelize.STRING, allowNull: false },
            mime_type: { type: Sequelize.STRING },
            size_bytes: { type: Sequelize.INTEGER },
            uploaded_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
        });

        await queryInterface.removeColumn('amenities', 'images');
        await queryInterface.addColumn('amenities', 'default_image_id', { type: Sequelize.UUID, allowNull: true });

        await queryInterface.removeColumn('technical_plans', 'plan_file_url');
        await queryInterface.addColumn('technical_plans', 'plan_file_id', { type: Sequelize.UUID, allowNull: true });

        await queryInterface.removeColumn('appliance_guides', 'image_urls');
        await queryInterface.removeColumn('appliance_guides', 'pdf_url');
        await queryInterface.removeColumn('appliance_guides', 'video_url');
        await queryInterface.addColumn('appliance_guides', 'image_id', { type: Sequelize.UUID, allowNull: true });
        await queryInterface.addColumn('appliance_guides', 'pdf_guide_id', { type: Sequelize.UUID, allowNull: true });
        await queryInterface.addColumn('appliance_guides', 'video_guide_id', { type: Sequelize.UUID, allowNull: true });

        await queryInterface.removeColumn('styling_guides', 'reference_photo_url');
        await queryInterface.removeColumn('styling_guides', 'qr_code_url');
        await queryInterface.addColumn('styling_guides', 'reference_photo_id', { type: Sequelize.UUID, allowNull: true });
        await queryInterface.addColumn('styling_guides', 'qr_code_id', { type: Sequelize.UUID, allowNull: true });
    }
};


