module.exports = (sequelize, DataTypes) => {
    const ActivityType = sequelize.define('ActivityType', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        }
    }, {
        tableName: 'activity_types',
        underscored: true,
        timestamps: true
    });

    return ActivityType;
};
