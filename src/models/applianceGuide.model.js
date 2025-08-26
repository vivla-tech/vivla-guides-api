export default (sequelize, DataTypes) => {
    const ApplianceGuide = sequelize.define('appliance_guides', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        equipment_name: { type: DataTypes.STRING, allowNull: false },
        brand_id: { type: DataTypes.UUID },
        model: { type: DataTypes.STRING },
        brief_description: { type: DataTypes.STRING },
        image_urls: { type: DataTypes.JSONB },
        pdf_url: { type: DataTypes.STRING },
        video_url: { type: DataTypes.STRING },
        quick_use_bullets: { type: DataTypes.TEXT },
        maintenance_bullets: { type: DataTypes.TEXT },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'appliance_guides',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    });
    return ApplianceGuide;
};
