module.exports = (sequelize, DataTypes) => {
    const Subject = sequelize.define('Subject', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: 'subjects',
        underscored: true,
        timestamps: true
    });

    return Subject;
};
