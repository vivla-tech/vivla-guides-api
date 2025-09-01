export default (sequelize, DataTypes) => {
    const Amenity = sequelize.define('amenities', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        name: { type: DataTypes.STRING, allowNull: false },
        category_id: { type: DataTypes.UUID },
        brand_id: { type: DataTypes.UUID },
        reference: { type: DataTypes.STRING },
        model: { type: DataTypes.STRING },
        description: { type: DataTypes.TEXT },
        base_price: { type: DataTypes.DECIMAL },
        images: { type: DataTypes.JSONB },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'amenities',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    });
    return Amenity;
};
