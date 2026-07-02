module.exports = (sequelize, DataTypes) => {
    const Notice = sequelize.define('Notice', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        file_path: {
            type: DataTypes.STRING,
            allowNull: true
        },
        original_filename: {
            type: DataTypes.STRING,
            allowNull: true
        },
        author_id: {
            type: DataTypes.BIGINT,
            allowNull: true
        },
        user_id: {
            type: DataTypes.BIGINT,
            allowNull: true
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'notices',
        timestamps: true
    });
    return Notice;
};
