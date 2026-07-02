const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT || 'mysql',
        logging: console.log,
        timezone: '-03:00',
        dialectOptions: {
            dateStrings: true,
            typeCast: true
        }
    }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Models
db.User = require('./user.js')(sequelize, Sequelize);
db.Subject = require('./subject.js')(sequelize, Sequelize);
db.Submission = require('./submission.js')(sequelize, Sequelize);
db.StudentClass = require('./studentClass.js')(sequelize, Sequelize);
db.Notice = require('./notice.js')(sequelize, Sequelize);
db.StudentMessage = require('./studentMessage.js')(sequelize, Sequelize);
db.ActivityType = require('./activityType.js')(sequelize, Sequelize);

// =============================================
// MÓDULO DE FORMULÁRIOS DINÂMICOS
// Adicionado para o módulo Google Forms corporativo
// =============================================
db.Form         = require('./form.js')(sequelize, Sequelize);
db.FormField    = require('./formField.js')(sequelize, Sequelize);
db.FormResponse = require('./formResponse.js')(sequelize, Sequelize);
db.FormAnswer   = require('./formAnswer.js')(sequelize, Sequelize);

// Associations
db.User.belongsToMany(db.Subject, { through: 'professor_subjects', as: 'subjects', foreignKey: 'professor_id' });
db.Subject.belongsToMany(db.User, { through: 'professor_subjects', as: 'professors', foreignKey: 'subject_id' });

db.Submission.belongsTo(db.User, { as: 'professor', foreignKey: 'professor_id' });
db.Submission.belongsTo(db.Subject, { as: 'subject', foreignKey: 'subject_id' });
db.Submission.belongsTo(db.User, { as: 'resolver', foreignKey: 'resolver_id' });
db.Submission.belongsTo(db.ActivityType, { as: 'activityType', foreignKey: 'activity_type_id' });

db.Notice.belongsTo(db.User, { as: 'author', foreignKey: 'author_id', constraints: false });
db.Notice.belongsTo(db.User, { as: 'user', foreignKey: 'user_id', constraints: false });
db.StudentMessage.belongsTo(db.User, { as: 'professor', foreignKey: 'professor_id' });

// =============================================
// ASSOCIAÇÕES DO MÓDULO DE FORMULÁRIOS
// =============================================
// Form pertence ao usuário que criou
db.Form.belongsTo(db.User, { as: 'creator', foreignKey: 'created_by' });
db.User.hasMany(db.Form, { as: 'forms', foreignKey: 'created_by' });

// Form possui muitos campos (cascade: excluir campos ao excluir form)
db.Form.hasMany(db.FormField, { as: 'fields', foreignKey: 'form_id', onDelete: 'CASCADE', hooks: true });
db.FormField.belongsTo(db.Form, { foreignKey: 'form_id' });

// Form possui muitas respostas (cascade: excluir respostas ao excluir form)
db.Form.hasMany(db.FormResponse, { as: 'responses', foreignKey: 'form_id', onDelete: 'CASCADE', hooks: true });
db.FormResponse.belongsTo(db.Form, { foreignKey: 'form_id' });

// FormResponse pertence ao usuário (null para anônimos)
db.FormResponse.belongsTo(db.User, { as: 'respondent', foreignKey: 'user_id', constraints: false });

// FormResponse possui muitas respostas individuais (cascade)
db.FormResponse.hasMany(db.FormAnswer, { as: 'answers', foreignKey: 'response_id', onDelete: 'CASCADE', hooks: true });
db.FormAnswer.belongsTo(db.FormResponse, { foreignKey: 'response_id' });

// FormAnswer pertence ao campo do formulário
db.FormAnswer.belongsTo(db.FormField, { as: 'field', foreignKey: 'field_id', constraints: false });

module.exports = db;

