const db = require('../src/models');

async function debugQuery() {
    try {
        console.log('--- DADOS DE CONEXÃO DO SEQUELIZE NO AMBIENTE ---');
        console.log('DB_NAME da config:', db.sequelize.config.database);
        console.log('DB_HOST da config:', db.sequelize.config.host);
        console.log('DB_USER da config:', db.sequelize.config.username);
        console.log('-------------------------------------------------');

        console.log('Executando a busca exata que a rota getMySubmissions faz...');
        
        // Ativa logging para o console nesta consulta específica
        const submissions = await db.Submission.findAll({
            include: [
                { model: db.Subject, as: 'subject', attributes: ['name'] },
                { model: db.ActivityType, as: 'activityType', attributes: ['name'] }
            ],
            logging: console.log
        });

        console.log(`Sucesso! Encontrou ${submissions.length} submissões.`);
    } catch (err) {
        console.error('Ocorreu o erro durante a busca:');
        console.error(err);
    } finally {
        await db.sequelize.close();
    }
}

debugQuery();
