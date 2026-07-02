const { Sequelize } = require('sequelize');
require('dotenv').config();

async function checkAll() {
    // Conecta ao MySQL sem especificar base de dados
    const sequelize = new Sequelize(
        '',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD || '',
        {
            host: process.env.DB_HOST || 'localhost',
            dialect: 'mysql',
            logging: false
        }
    );

    try {
        console.log('Buscando todos os bancos de dados locais...');
        const [databases] = await sequelize.query('SHOW DATABASES');
        
        for (const dbObj of databases) {
            const dbName = dbObj.Database;
            if (['information_schema', 'mysql', 'performance_schema', 'sys', 'phpmyadmin'].includes(dbName)) {
                continue;
            }
            
            console.log(`\nVerificando banco de dados: ${dbName}`);
            const dbSequelize = new Sequelize(
                dbName,
                process.env.DB_USER || 'root',
                process.env.DB_PASSWORD || '',
                {
                    host: process.env.DB_HOST || 'localhost',
                    dialect: 'mysql',
                    logging: false
                }
            );
            
            try {
                // Verifica se a tabela submissions existe
                const [tables] = await dbSequelize.query(`SHOW TABLES LIKE 'submissions'`);
                if (tables.length > 0) {
                    console.log(` -> Tabela 'submissions' existe no banco '${dbName}'.`);
                    const [columns] = await dbSequelize.query(`DESCRIBE \`submissions\``);
                    const gradeSentCol = columns.find(col => col.Field === 'grade_sent');
                    if (gradeSentCol) {
                        console.log(`   -> Coluna 'grade_sent' EXISTE! Tipo: ${gradeSentCol.Type}, Default: ${gradeSentCol.Default}`);
                    } else {
                        console.log(`   -> Coluna 'grade_sent' NÃO EXISTE neste banco de dados!`);
                    }
                } else {
                    console.log(` -> Tabela 'submissions' NÃO existe no banco '${dbName}'.`);
                }
            } catch (err) {
                console.log(` -> Erro ao verificar banco '${dbName}':`, err.message);
            } finally {
                await dbSequelize.close();
            }
        }
    } catch (err) {
        console.error('Erro geral:', err);
    } finally {
        await sequelize.close();
    }
}

checkAll();
