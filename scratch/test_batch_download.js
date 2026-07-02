const db = require('../src/models');
const professorController = require('../src/controllers/professorController');

async function test() {
    try {
        console.log('Buscando submissões...');
        const submissions = await db.Submission.findAll({ limit: 5 });
        if (submissions.length === 0) {
            console.log('Nenhuma submissão para testar.');
            return;
        }

        const ids = submissions.map(s => s.id);
        console.log('Testando batchDownload com os IDs:', ids);

        // Mocks de req e res
        const req = {
            body: { ids, ignoreEmpty: false },
            userId: submissions[0].professor_id || 1,
            userRole: 'admin'
        };

        const res = {
            headers: {},
            statusCode: 200,
            setHeader(name, value) {
                this.headers[name] = value;
                console.log(`HEADER: ${name} = ${value}`);
            },
            status(code) {
                this.statusCode = code;
                console.log(`STATUS CODE: ${code}`);
                return this;
            },
            send(data) {
                console.log(`SEND: Enviou dados. Tamanho: ${data.length} bytes.`);
            },
            json(obj) {
                console.log('JSON RESPONSE:', JSON.stringify(obj, null, 2));
            }
        };

        await professorController.batchDownload(req, res);
        console.log('Teste executado!');

    } catch (err) {
        console.error('Erro geral no teste:', err);
    } finally {
        await db.sequelize.close();
    }
}

test();
