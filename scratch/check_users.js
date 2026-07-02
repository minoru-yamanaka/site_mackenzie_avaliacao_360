const db = require('../src/models');

async function run() {
    try {
        await db.sequelize.authenticate();
        console.log('Conectado ao banco.');

        const users = await db.User.findAll({ attributes: ['id', 'name', 'email', 'role', 'is_active'] });
        console.log('USUÁRIOS NO BANCO DE DADOS:');
        console.table(users.map(u => u.toJSON()));
    } catch (err) {
        console.error('Erro:', err);
    } finally {
        await db.sequelize.close();
    }
}

run();
