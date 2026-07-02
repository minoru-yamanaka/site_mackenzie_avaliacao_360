const db = require('../src/models');

async function run() {
    try {
        await db.sequelize.authenticate();
        console.log('Conectado ao banco de dados.');

        // Executa ALTER TABLE para garantir que a coluna exista se estiver faltando
        try {
            console.log('Tentando adicionar a coluna activity_type_id caso não exista...');
            await db.sequelize.query('ALTER TABLE `submissions` ADD COLUMN `activity_type_id` INT NULL;');
            console.log('Coluna activity_type_id adicionada com sucesso.');
        } catch (alterError) {
            // Se der erro porque a coluna já existe, ignoramos.
            if (alterError.parent && alterError.parent.errno === 1060) {
                console.log('A coluna activity_type_id já existe.');
            } else {
                console.warn('Erro ao alterar tabela (pode já estar criada):', alterError.message);
            }
        }

        // 1. Garantir que temos um Subject
        let subject = await db.Subject.findOne();
        if (!subject) {
            subject = await db.Subject.create({ name: 'Disciplina de Teste' });
            console.log('Disciplina de teste criada.');
        }

        // 2. Garantir que temos um Professor (User do tipo professor ou admin)
        let professor = await db.User.findOne({ where: { role: 'professor' } });
        if (!professor) {
            professor = await db.User.findOne({ where: { role: 'admin' } });
        }
        if (!professor) {
            professor = await db.User.create({
                name: 'Professor de Teste',
                email: 'professor@teste.com',
                password: 'senha_criptografada_qualquer',
                role: 'professor'
            });
            console.log('Professor de teste criado.');
        }

        // 3. Inserir a Submissão de Teste
        const testDrt = '123456';
        const testName = 'Aluno de Teste';
        const testProtocol = 'AT-123456-789';

        let submission = await db.Submission.findOne({ where: { protocol: testProtocol } });
        if (!submission) {
            submission = await db.Submission.create({
                student_name: testName,
                student_drt: testDrt,
                student_class: 'Turma A',
                student_email: 'aluno@teste.com',
                message: 'Olá, envio a minha atividade de teste.',
                file_path: 'uploads/teste.pdf',
                original_filename: 'teste.pdf',
                file_mimetype: 'application/pdf',
                grade: 9.5,
                feedback: 'Excelente trabalho!',
                status: 'Concluído',
                protocol: testProtocol,
                subject_id: subject.id,
                professor_id: professor.id
            });
            console.log('Submissão de teste criada com sucesso!');
        } else {
            console.log('Submissão de teste já existe.');
        }

        console.log('--- DADOS PARA O TESTE ---');
        console.log(`Nome Completo: Aluno de Teste`);
        console.log(`DRT: ${testDrt}`);
        console.log(`Protocolo: ${testProtocol}`);
        console.log('--------------------------');

    } catch (error) {
        console.error('Erro ao processar dados de teste:', error);
    } finally {
        await db.sequelize.close();
    }
}

run();
