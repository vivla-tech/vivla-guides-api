export default (sequelize, DataTypes) => {
    const StylingGuide = sequelize.define('styling_guides', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        room_id: { type: DataTypes.UUID, allowNull: false },
        title: { type: DataTypes.STRING, allowNull: false },
        reference_photo_url: { type: DataTypes.STRING },
        qr_code_url: { type: DataTypes.STRING },
        image_urls: { type: DataTypes.JSONB },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'styling_guides',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    });
    return StylingGuide;
};
