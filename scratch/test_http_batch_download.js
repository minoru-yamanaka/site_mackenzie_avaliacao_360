const jwt = require('jsonwebtoken');
require('dotenv').config();

async function run() {
    // Gerar token de professor/admin
    const token = jwt.sign(
        { id: 38, role: 'admin' },
        process.env.JWT_SECRET || 'super_secret_jwt_key_12345',
        { expiresIn: '1h' }
    );

    console.log('Token JWT gerado:', token);

    // Corpo do POST
    const body = {
        ids: [1, 2, 3, 4, 5],
        ignoreEmpty: true
    };

    console.log('Fazendo requisição HTTP POST para o servidor na porta 3000...');
    try {
        const res = await fetch('http://localhost:3000/api/submissions/batch-download', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        console.log('Status Code:', res.status);
        console.log('Content-Type:', res.headers.get('content-type'));

        if (res.ok) {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            console.log(`Sucesso! Recebido arquivo ZIP de ${buffer.length} bytes.`);
        } else {
            const text = await res.text();
            console.log('Erro retornado:', text);
        }
    } catch (err) {
        console.error('Erro de requisição:', err);
    }
}

run();
