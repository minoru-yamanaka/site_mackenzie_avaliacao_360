module.exports = (sequelize, DataTypes) => {
    const StudentClass = sequelize.define('StudentClass', {
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
        tableName: 'student_classes',
        underscored: true,
        timestamps: true
    });

    return StudentClass;
};
