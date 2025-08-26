export default (sequelize, DataTypes) => {
    const HomeInventory = sequelize.define('home_inventory', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        home_id: { type: DataTypes.UUID, allowNull: false },
        amenity_id: { type: DataTypes.UUID, allowNull: false },
        room_id: { type: DataTypes.UUID },
        quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
        location_details: { type: DataTypes.STRING },
        minimum_threshold: { type: DataTypes.INTEGER },
        supplier_id: { type: DataTypes.UUID },
        purchase_link: { type: DataTypes.STRING },
        purchase_price: { type: DataTypes.DECIMAL },
        last_restocked_date: { type: DataTypes.DATE },
        notes: { type: DataTypes.TEXT },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'home_inventory',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    });
    return HomeInventory;
};
