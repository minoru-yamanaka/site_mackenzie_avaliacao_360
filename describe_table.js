const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'academico_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: process.env.DB_DIALECT || 'mysql',
        logging: false
    }
);

async function run() {
    try {
        console.log('Descrevendo a tabela submissions...');
        const [columns] = await sequelize.query('DESCRIBE `submissions`');
        console.log('ESTRUTURA DA TABELA submissions:');
        console.table(columns);
    } catch (error) {
        console.error('Erro ao descrever a tabela:', error);
    } finally {
        await sequelize.close();
    }
}

run();
