module.exports = (sequelize, DataTypes) => {
    const Submission = sequelize.define('Submission', {
        student_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        student_drt: {
            type: DataTypes.STRING,
            allowNull: false
        },
        student_class: {
            type: DataTypes.STRING,
            allowNull: false
        },
        student_email: {
            type: DataTypes.STRING,
            allowNull: false
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        file_path: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        original_filename: {
            type: DataTypes.STRING,
            allowNull: true
        },
        file_mimetype: {
            type: DataTypes.STRING,
            allowNull: true
        },
        grade: {
            type: DataTypes.NUMERIC(5, 2),
            allowNull: true
        },
        feedback: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'Em Andamento'
        },
        protocol: {
            type: DataTypes.STRING,
            unique: true
        },
        resolved_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        admin_note: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        activity_type_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        grade_sent: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'submissions',
        underscored: true,
        timestamps: true
    });

    return Submission;
};
