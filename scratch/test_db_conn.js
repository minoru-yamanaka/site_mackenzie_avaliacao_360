const db = require('../src/models');

async function testConn() {
    try {
        console.log('Testando conexão do Sequelize com as configurações do app...');
        console.log('DB Config Name:', db.sequelize.config.database);
        console.log('DB Config Host:', db.sequelize.config.host);
        console.log('DB Config User:', db.sequelize.config.username);
        
        console.log('Buscando uma submissão usando db.Submission.findOne()...');
        const sub = await db.Submission.findOne({
            include: [
                { model: db.Subject, as: 'subject', attributes: ['name'] },
                { model: db.ActivityType, as: 'activityType', attributes: ['name'] }
            ]
        });
        console.log('Executando SHOW DATABASES...');
        const [databases] = await db.sequelize.query('SHOW DATABASES');
        console.log('BANCOS DE DADOS LOCAL:', databases);
    } catch (err) {
        console.error('ERRO:', err);
    } finally {
        await db.sequelize.close();
    }
}

testConn();
