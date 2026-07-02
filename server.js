require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/models');
const routes = require('./src/routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api', routes);

// Static files (Frontend and Uploads)
app.use(express.static(path.join(__dirname, 'public')));

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ 
            error: 'Arquivo muito grande.', 
            message: 'O arquivo enviado excede o limite máximo permitido de 250MB.' 
        });
    }

    if (err.name === 'MulterError') {
        return res.status(400).json({ 
            error: 'Erro no upload de arquivo.', 
            message: err.message 
        });
    }

    res.status(500).json({ error: 'Erro interno no servidor.', message: err.message });
});

const PORT = process.env.PORT || 3000;

// Init DB and Start Server
db.sequelize.sync().then(async () => {
    console.log('Banco de dados sincronizado.');
    console.log('--- DADOS DE CONEXÃO DO BANCO ---');
    console.log('Banco de Dados:', db.sequelize.config.database);
    console.log('Host:', db.sequelize.config.host);
    console.log('Usuário:', db.sequelize.config.username);
    console.log('---------------------------------');

    // Executar migração manual de colunas novas (para atualizar servidores de hospedagem como Coolify)
    try {
        console.log('Verificando migrações de banco de dados...');
        
        // 1. Coluna grade_sent
        const [columnsSub] = await db.sequelize.query("SHOW COLUMNS FROM `submissions` LIKE 'grade_sent'");
        if (columnsSub.length === 0) {
            console.log('Adicionando coluna grade_sent ao banco de dados...');
            await db.sequelize.query("ALTER TABLE `submissions` ADD COLUMN `grade_sent` TINYINT(1) DEFAULT 0");
            console.log('Coluna grade_sent adicionada com sucesso!');
        } else {
            console.log('Coluna grade_sent já existe no banco de dados.');
        }

        // 2. Colunas respondent_name e respondent_identifier na tabela form_responses
        const [columnsRespName] = await db.sequelize.query("SHOW COLUMNS FROM `form_responses` LIKE 'respondent_name'");
        if (columnsRespName.length === 0) {
            console.log('Adicionando colunas de identificação à tabela form_responses...');
            await db.sequelize.query("ALTER TABLE `form_responses` ADD COLUMN `respondent_name` VARCHAR(255) NULL");
            await db.sequelize.query("ALTER TABLE `form_responses` ADD COLUMN `respondent_identifier` VARCHAR(50) NULL");
            console.log('Colunas respondent_name e respondent_identifier adicionadas com sucesso!');
        } else {
            console.log('Colunas de identificação já existem na tabela form_responses.');
        }

        // 3. Coluna start_date na tabela forms
        const [columnsStartDate] = await db.sequelize.query("SHOW COLUMNS FROM `forms` LIKE 'start_date'");
        if (columnsStartDate.length === 0) {
            console.log('Adicionando coluna start_date à tabela forms...');
            await db.sequelize.query("ALTER TABLE `forms` ADD COLUMN `start_date` DATETIME NULL AFTER `allow_anonymous`");
            console.log('Coluna start_date adicionada com sucesso!');
        } else {
            console.log('Coluna start_date já existe na tabela forms.');
        }

        // 4. Colunas evaluator_type e evaluated_type na tabela forms
        const [columnsEvalType] = await db.sequelize.query("SHOW COLUMNS FROM `forms` LIKE 'evaluator_type'");
        if (columnsEvalType.length === 0) {
            console.log('Adicionando colunas evaluator_type e evaluated_type à tabela forms...');
            await db.sequelize.query("ALTER TABLE `forms` ADD COLUMN `evaluator_type` VARCHAR(255) NULL DEFAULT 'Aluno / Discente' AFTER `allow_anonymous`");
            await db.sequelize.query("ALTER TABLE `forms` ADD COLUMN `evaluated_type` VARCHAR(255) NULL DEFAULT 'Professor / Docente' AFTER `evaluator_type`");
            console.log('Colunas de papéis adicionadas com sucesso à tabela forms!');
        } else {
            console.log('Colunas de papéis já existem na tabela forms.');
        }

        // 5. Coluna drt na tabela users
        const [columnsDrt] = await db.sequelize.query("SHOW COLUMNS FROM `users` LIKE 'drt'");
        if (columnsDrt.length === 0) {
            console.log('Adicionando coluna drt à tabela users...');
            await db.sequelize.query("ALTER TABLE `users` ADD COLUMN `drt` VARCHAR(50) NULL AFTER `email`");
            console.log('Coluna drt adicionada com sucesso!');
        } else {
            console.log('Coluna drt já existe na tabela users.');
        }
    } catch (err) {
        console.error('Erro ao executar migrações manuais:', err);
    }

    // Limpeza de Status: Garantir que todos tenham um valor válido
    try {
        await db.sequelize.query("UPDATE submissions SET status = 'Em Andamento' WHERE status IS NULL OR status = '' OR status NOT IN ('Concluído', 'Em Andamento')");
        console.log('Dados de status normalizados para "Em Andamento".');
    } catch (e) {
        console.log('Aviso: Erro ao normalizar dados antigos.');
    }

    
    // Seed initial admin if none exists
    let adminUser = await db.User.findOne({ where: { role: 'admin' } });
    if (!adminUser) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        adminUser = await db.User.create({
            name: 'Administrador Master',
            email: 'admin@sistema.com',
            password: hashedPassword,
            role: 'admin'
        });
        console.log('Admin inicial criado: admin@sistema.com / admin123');
    }
    try {
        const allowedTitles = [
            'Autoavaliação Discente / Aluno',
            'Avaliação Docente / Professor',
            'Avaliação de Preceptor',
            'Avaliação Interpares (Grupo)',
            'Avaliação Gerencial / Coordenação',
            'Avaliação de Componentes Curriculares',
            'Percepção Geral e NPS de Satisfação'
        ];
        const formsToDelete = await db.Form.findAll({
            where: {
                title: {
                    [db.Sequelize.Op.notIn]: allowedTitles
                }
            }
        });
        for (const form of formsToDelete) {
            const responseIds = (await db.FormResponse.findAll({ where: { form_id: form.id }, attributes: ['id'] })).map(r => r.id);
            if (responseIds.length > 0) {
                await db.FormAnswer.destroy({ where: { response_id: responseIds } });
                await db.FormResponse.destroy({ where: { id: responseIds } });
            }
            await db.FormField.destroy({ where: { form_id: form.id } });
            await form.destroy();
            console.log(`[CLEANUP] Formulário antigo "${form.title}" e suas dependências foram apagados.`);
        }

        // Garante que TODOS os formulários existentes e novos requeiram identificação (não anônimos)
        await db.Form.update({ allow_anonymous: false }, { where: {} });
        console.log('[MIGRATION] Todos os formulários foram definidos para REQUERER IDENTIFICAÇÃO (não anônimos).');
    } catch (err) {
        console.error('Erro no cleanup/atualização de formulários:', err);
    }

    // Função auxiliar para criar os formulários solicitados caso não existam
    const seedFormIfMissing = async (title, description, allow_anonymous, evaluator_type, evaluated_type, fields) => {
        let form = await db.Form.findOne({ where: { title } });
        if (!form) {
            form = await db.Form.create({
                title,
                description,
                status: 'published',
                allow_anonymous,
                evaluator_type,
                evaluated_type,
                created_by: adminUser.id
            });
            const fieldRecords = fields.map((f, i) => ({
                form_id: form.id,
                type: f.type,
                label: f.label,
                placeholder: f.placeholder || null,
                required: !!f.required,
                default_value: f.default_value || null,
                help_text: f.help_text || null,
                options: f.options || null,
                position: i
            }));
            await db.FormField.bulkCreate(fieldRecords);
            console.log(`Formulário "${title}" criado com sucesso no banco de dados!`);
        } else {
            // Garante que os papéis estejam atualizados caso o formulário já exista
            form.evaluator_type = evaluator_type;
            form.evaluated_type = evaluated_type;
            await form.save();
        }
    };

    // 1. Autoavaliação Discente/Aluno
    await seedFormIfMissing(
        'Autoavaliação Discente / Aluno',
        'Formulário para que o estudante faça a autoavaliação de seu próprio desempenho acadêmico e prático com base nos critérios CHA.',
        false, // Não anônimo: Requer identificação
        'Aluno / Discente',
        'O próprio Aluno',
        [
            {
                type: 'cha',
                label: 'Autoavaliação CHA',
                required: true,
                options: {
                    c_label: 'Conhecimento (Saber) - Compreensão teórica e domínio dos conteúdos das aulas.',
                    h_label: 'Habilidade (Saber Fazer) - Aplicação prática em exercícios, projetos ou atendimentos.',
                    a_label: 'Atitude (Querer Fazer) - Proatividade, dedicação, pontualidade e engajamento.'
                }
            },
            {
                type: 'star_rating',
                label: 'Como você avalia seu desempenho geral e dedicação neste período?',
                required: true
            },
            {
                type: 'long_text',
                label: 'Descreva seus principais pontos fortes e aspects que você precisa desenvolver.'
            }
        ]
    );

    // 2. Avaliação Docente/Professor
    await seedFormIfMissing(
        'Avaliação Docente / Professor',
        'Avaliação do corpo docente pelo discente, focando no domínio de conteúdo, didática e comportamento de suporte ao aluno.',
        false, // Não anônimo: Requer identificação
        'Aluno / Discente',
        'Professor / Docente',
        [
            {
                type: 'short_text',
                label: 'Nome do Professor / Docente avaliado',
                placeholder: 'Digite o nome completo do professor...',
                required: true
            },
            {
                type: 'cha',
                label: 'Avaliação das dimensões CHA do Docente',
                required: true,
                options: {
                    c_label: 'Conhecimento (Saber) - Domínio do conteúdo, profundidade e clareza nas explicações.',
                    h_label: 'Habilidade (Saber Fazer) - Didática, mediação do aprendizado e condução das atividades.',
                    a_label: 'Atitude (Querer Fazer) - Respeito, empatia, suporte extraclasse e pontualidade.'
                }
            },
            {
                type: 'long_text',
                label: 'Pontos positivos e sugestões de melhoria para a conduta ou ensino do docente.'
            }
        ]
    );

    // 3. Avaliação Preceptor
    await seedFormIfMissing(
        'Avaliação de Preceptor',
        'Avaliação do preceptor de estágio ou campo prático pelo discente.',
        false, // Não anônimo: Requer identificação
        'Aluno / Discente',
        'Preceptor',
        [
            {
                type: 'short_text',
                label: 'Nome do Preceptor avaliado',
                placeholder: 'Digite o nome do preceptor...',
                required: true
            },
            {
                type: 'cha',
                label: 'Avaliação das dimensões CHA do Preceptor',
                required: true,
                options: {
                    c_label: 'Conhecimento (Saber) - Domínio técnico e profissional da prática em campo.',
                    h_label: 'Habilidade (Saber Fazer) - Orientação no dia a dia e compartilhamento de vivências.',
                    a_label: 'Atitude (Querer Fazer) - Postura ética, atenção aos alunos e receptividade a dúvidas.'
                }
            },
            {
                type: 'long_text',
                label: 'Comentários adicionais sobre a mentoria e o suporte em campo de estágio.'
            }
        ]
    );

    // 4. Avaliação Interpares
    await seedFormIfMissing(
        'Avaliação Interpares (Grupo)',
        'Formulário para avaliação mútua entre os membros de um mesmo grupo de trabalho/projeto acadêmico.',
        false, // Não anônimo: Requer identificação
        'Aluno / Discente',
        'Colegas de Grupo',
        [
            {
                type: 'short_text',
                label: 'Nome do Colega de Grupo a ser avaliado',
                placeholder: 'Digite o nome completo do colega...',
                required: true
            },
            {
                type: 'cha',
                label: 'Avaliação das dimensões CHA do colega',
                required: true,
                options: {
                    c_label: 'Conhecimento (Saber) - Qualidade intelectual e técnica das contribuições para o trabalho.',
                    h_label: 'Habilidade (Saber Fazer) - Execução prática das tarefas designadas e entrega nos prazos.',
                    a_label: 'Atitude (Querer Fazer) - Cooperação, respeito com o grupo, comunicação e presença.'
                }
            },
            {
                type: 'star_rating',
                label: 'Como você avalia a parceria geral com este colega? (1 a 4 estrelas)',
                required: true
            },
            {
                type: 'long_text',
                label: 'Mensagem construtiva para o colega (o que ele faz muito bem e o que pode melhorar).'
            }
        ]
    );

    // 5. Avaliação Gerencial
    await seedFormIfMissing(
        'Avaliação Gerencial / Coordenação',
        'Avaliação da gestão administrativa, acadêmica e coordenação do curso ou unidade pelos alunos e docentes.',
        false, // Não anônimo: Requer identificação
        'Todos (Aluno, Docente, Preceptor)',
        'Coordenação / Gestão',
        [
            {
                type: 'cha',
                label: 'Avaliação das dimensões CHA da Gestão',
                required: true,
                options: {
                    c_label: 'Conhecimento (Saber) - Planejamento estratégico, organization e estruturação do curso.',
                    h_label: 'Habilidade (Saber Fazer) - Resolução ágil de problemas e apoio nas demandas discentes/docentes.',
                    a_label: 'Atitude (Querer Fazer) - Acessibilidade, escuta ativa, liderança transparente e simpatia.'
                }
            },
            {
                type: 'star_rating',
                label: 'Avaliação geral da gestão do curso (1 a 4 estrelas)',
                required: true
            },
            {
                type: 'long_text',
                label: 'Sugestões ou críticas construtivas para a coordenação do curso.'
            }
        ]
    );

    // 6. Avaliação de Componentes
    await seedFormIfMissing(
        'Avaliação de Componentes Curriculares',
        'Avaliação das disciplinas, módulos acadêmicos ou componentes da matriz curricular.',
        false, // Não anônimo: Requer identificação
        'Aluno / Discente',
        'Componente Curricular (Disciplina)',
        [
            {
                type: 'short_text',
                label: 'Nome do Componente Curricular / Disciplina',
                placeholder: 'Ex.: Algoritmos e Programação, Gestão de Projetos...',
                required: true
            },
            {
                type: 'star_rating',
                label: 'Coerência dos objetivos da disciplina e do plano de ensino (1 a 4 estrelas)',
                required: true
            },
            {
                type: 'yes_no',
                label: 'A carga horária total foi suficiente para cobrir os conteúdos planejados?',
                required: true
            },
            {
                type: 'scale',
                label: 'Relevância da disciplina para a sua futura atuação profissional (0 a 10)',
                required: true
            },
            {
                type: 'long_text',
                label: 'Comentários sobre a estrutura da disciplina, infraestrutura ou materiais de apoio.'
            }
        ]
    );

    // 7. Percepção Geral da Avaliação + NPS de Satisfação
    await seedFormIfMissing(
        'Percepção Geral e NPS de Satisfação',
        'Pesquisa de satisfação geral sobre a instituição, experiência educacional e indicador de Net Promoter Score.',
        false, // Não anônimo: Requer identificação
        'Aluno / Discente',
        'Instituição / Curso',
        [
            {
                type: 'scale',
                label: 'De 0 a 10, qual a probabilidade de você recomendar nossa instituição/curso para um amigo ou familiar?',
                required: true,
                help_text: 'Índice de Recomendação Líquida (NPS - Net Promoter Score)'
            },
            {
                type: 'star_rating',
                label: 'Como avalia a facilidade de uso do nosso portal acadêmico? (1 a 4 estrelas)',
                required: true
            },
            {
                type: 'yes_no',
                label: 'Os processos de avaliação aplicados têm te ajudado a progredir nos estudos?',
                required: true
            },
            {
                type: 'long_text',
                label: 'O que podemos fazer para tornar a sua experiência educacional ainda melhor?'
            }
        ]
    );

    app.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}).catch(err => {
    console.error('Erro ao sincronizar banco de dados:', err);
    if (err.parent) {
        console.error('Detalhe técnico:', err.parent.sqlMessage || err.parent);
    }
});
