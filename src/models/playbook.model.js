export default (sequelize, DataTypes) => {
    const Playbook = sequelize.define('playbooks', {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        room_id: { type: DataTypes.UUID, allowNull: false },
        type: { type: DataTypes.STRING },
        title: { type: DataTypes.STRING, allowNull: false },
        estimated_time: { type: DataTypes.STRING },
        tasks: { type: DataTypes.TEXT },
        materials: { type: DataTypes.STRING },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'playbooks',
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    });
    return Playbook;
};
