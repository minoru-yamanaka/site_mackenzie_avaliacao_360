const { Sequelize } = require('sequelize');
require('dotenv').config();

async function run() {
    // Conecta especificamente ao banco numq_db
    const sequelize = new Sequelize(
        'numq_db',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD || '',
        {
            host: process.env.DB_HOST || 'localhost',
            dialect: 'mysql',
            logging: false
        }
    );

    try {
        console.log('Adicionando a coluna grade_sent ao banco numq_db...');
        // Verifica primeiro se a coluna existe antes de adicionar
        const [columns] = await sequelize.query('DESCRIBE `submissions`');
        const gradeSentCol = columns.find(col => col.Field === 'grade_sent');
        
        if (!gradeSentCol) {
            await sequelize.query('ALTER TABLE `submissions` ADD COLUMN `grade_sent` TINYINT(1) DEFAULT 0 AFTER `activity_type_id`');
            console.log('Sucesso! Coluna grade_sent adicionada com sucesso à tabela submissions do banco numq_db.');
        } else {
            console.log('A coluna grade_sent já existe no banco numq_db.');
        }
    } catch (error) {
        console.error('Erro ao adicionar coluna no banco numq_db:', error);
    } finally {
        await sequelize.close();
    }
}

run();
