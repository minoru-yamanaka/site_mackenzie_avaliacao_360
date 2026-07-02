const db = require('../models');

exports.getSubjects = async (req, res) => {
    try {
        const subjects = await db.Subject.findAll({
            order: [['name', 'ASC']]
        });
        res.json(subjects);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar disciplinas.' });
    }
};

exports.getNotices = async (req, res) => {
    try {
        const notices = await db.Notice.findAll({
            include: [
                { model: db.User, as: 'author', attributes: ['name'] },
                { model: db.User, as: 'user', attributes: ['name'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(notices);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar avisos.' });
    }
};

exports.downloadNoticeAttachment = async (req, res) => {
    try {
        const notice = await db.Notice.findByPk(req.params.id);
        if (!notice || !notice.file_path) {
            return res.status(404).json({ error: 'Anexo não encontrado.' });
        }
        const filePath = require('path').join(__dirname, '../../uploads', notice.file_path);
        if (req.query.view === 'true') {
            res.sendFile(filePath);
        } else {
            res.download(filePath, notice.original_filename);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao baixar anexo.' });
    }
};

exports.getClasses = async (req, res) => {
    try {
        const classes = await db.StudentClass.findAll({
            order: [['name', 'ASC']]
        });
        res.json(classes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar turmas.' });
    }
};

exports.getProfessorsBySubject = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const subject = await db.Subject.findByPk(subjectId, {
            include: [{
                model: db.User,
                as: 'professors',
                attributes: ['id', 'name']
            }]
        });

        if (!subject) {
            return res.status(404).json({ error: 'Disciplina não encontrada.' });
        }

        res.json(subject.professors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar professores da disciplina.' });
    }
};

exports.submitWork = async (req, res) => {
    try {
        const {
            nome, drt, turma, disciplina, professor, email, mensagem, tipoAtividade
        } = req.body;

        if (!nome || !drt || !turma || !disciplina || !professor || !email || !tipoAtividade) {
            return res.status(400).json({ error: 'Todos os campos obrigatórios devem ser preenchidos.' });
        }

        // Valida se o professor dá essa disciplina
        const subject = await db.Subject.findByPk(disciplina, {
            include: [{
                model: db.User,
                as: 'professors',
                where: { id: professor }
            }]
        });

        if (!subject || subject.professors.length === 0) {
            return res.status(400).json({ error: 'Professor selecionado não leciona esta disciplina.' });
        }

        const protocol = `AT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const submissionData = {
            student_name: nome,
            student_drt: drt,
            student_class: turma,
            student_email: email,
            message: mensagem || '',
            subject_id: disciplina,
            professor_id: professor,
            protocol: protocol,
            activity_type_id: tipoAtividade
        };

        if (req.file) {
            submissionData.file_path = req.file.filename;
            submissionData.original_filename = req.file.originalname;
            submissionData.file_mimetype = req.file.mimetype;
        }

        const submission = await db.Submission.create(submissionData);

        res.status(201).json({ 
            message: 'Atividade enviada com sucesso!', 
            protocol: protocol,
            submissionId: submission.id 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao enviar a atividade.' });
    }
};

exports.sendStudentMessage = async (req, res) => {
    try {
        const { name, email, subject, content, professorId } = req.body;

        if (!name || !email || !subject || !content) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        }

        const messageData = {
            name,
            email,
            subject,
            content,
            professor_id: professorId || null
        };

        const message = await db.StudentMessage.create(messageData);

        const targetMessage = professorId ? 'enviada ao docente com sucesso!' : 'enviada ao NuMQ com sucesso!';

        res.status(201).json({ 
            message: `Sua mensagem foi ${targetMessage}`,
            data: message 
        });
    } catch (error) {
        console.error('[PUBLIC] sendStudentMessage error:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
};

exports.queryStudentSubmissions = async (req, res) => {
    try {
        const { name, drt, protocol } = req.body;

        if (!name || !drt || !protocol) {
            return res.status(400).json({ error: 'Todos os campos (Nome, DRT e Protocolo) são obrigatórios.' });
        }

        let isMatch = false;

        if (protocol.toString().trim().startsWith('FORM-')) {
            const respId = protocol.toString().trim().replace('FORM-', '');
            const matchForm = await db.FormResponse.findOne({
                where: {
                    id: respId,
                    respondent_name: name.toString().trim(),
                    respondent_identifier: drt.toString().trim()
                }
            });
            if (matchForm) isMatch = true;
        } else {
            const match = await db.Submission.findOne({
                where: {
                    student_name: name.toString().trim(),
                    student_drt: drt.toString().trim(),
                    protocol: protocol.toString().trim()
                }
            });
            if (match) isMatch = true;
        }

        if (!isMatch) {
            return res.status(404).json({ error: 'Os dados informados não coincidem com nenhuma atividade cadastrada.' });
        }

        // Traz todas as submissões desse mesmo DRT
        const submissions = await db.Submission.findAll({
            where: {
                student_drt: drt.toString().trim()
            },
            include: [
                { model: db.Subject, as: 'subject', attributes: ['name'] },
                { model: db.User, as: 'professor', attributes: ['name'] },
                { model: db.ActivityType, as: 'activityType', attributes: ['name'] }
            ],
            order: [['created_at', 'DESC']]
        });

        // Buscar respostas de formulários preenchidos por este aluno
        const formResponses = await db.FormResponse.findAll({
            where: {
                respondent_identifier: drt.toString().trim()
            },
            include: [
                { model: db.Form, attributes: ['title'] },
                { model: db.User, as: 'respondent', attributes: ['name', 'email', 'drt'] },
                {
                    model: db.FormAnswer,
                    as: 'answers',
                    include: [{ model: db.FormField, as: 'field', attributes: ['id', 'label', 'type', 'options'] }]
                }
            ],
            order: [['submitted_at', 'DESC']]
        });

        const formSubs = formResponses.map(fr => {
            const formattedAnswers = (fr.answers || []).map(ans => {
                const label = ans.field ? ans.field.label : 'Campo';
                let valText = ans.value || '';
                if (ans.field && ans.field.type === 'cha') {
                    try {
                        const cha = JSON.parse(ans.value);
                        valText = `C: ${cha.c} | H: ${cha.h} | A: ${cha.a} (Média: ${cha.media})`;
                    } catch (_) {}
                }
                if (ans.field && ans.field.type === 'checkbox') {
                    try {
                        const parsed = JSON.parse(ans.value);
                        if (Array.isArray(parsed)) valText = parsed.join(', ');
                    } catch (_) {}
                }
                return { label, value: valText };
            });

            return {
                id: `form_resp_${fr.id}`,
                student_name: fr.respondent_name || (fr.respondent ? fr.respondent.name : ''),
                student_drt: fr.respondent_identifier || (fr.respondent ? fr.respondent.drt : ''),
                student_class: '—',
                student_email: fr.respondent ? fr.respondent.email : '—',
                message: 'Avaliação/Formulário preenchido.',
                file_path: null,
                original_filename: null,
                grade: null,
                feedback: null,
                status: 'Concluído',
                protocol: `FORM-${fr.id}`,
                createdAt: fr.submitted_at || fr.created_at,
                subject: { name: 'Formulários' },
                professor: { name: '—' },
                activityType: { name: fr.Form ? fr.Form.title : 'Avaliação' },
                isFormResponse: true,
                formId: fr.form_id,
                responseId: fr.id,
                formattedAnswers
            };
        });

        const combined = [...submissions, ...formSubs].sort((a, b) => {
            return new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at);
        });

        res.json(combined);

    } catch (error) {
        console.error('[PUBLIC] queryStudentSubmissions error:', error);
        res.status(500).json({ error: 'Erro ao consultar atividades.' });
    }
};

exports.downloadSubmissionAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        const { protocol, drt, view } = req.query;

        if (!protocol || !drt) {
            return res.status(400).json({ error: 'Parâmetros insuficientes para autorizar o download.' });
        }

        const submission = await db.Submission.findOne({
            where: {
                id: id,
                protocol: protocol.toString().trim(),
                student_drt: drt.toString().trim()
            }
        });

        if (!submission) {
            return res.status(404).json({ error: 'Arquivo não encontrado ou acesso não autorizado.' });
        }

        if (!submission.file_path) {
            return res.status(404).json({ error: 'O arquivo desta atividade foi excluído.' });
        }

        const filePath = require('path').join(__dirname, '../../uploads', submission.file_path);

        if (require('fs').existsSync(filePath)) {
            if (view === 'true') {
                res.sendFile(filePath);
            } else {
                res.download(filePath, submission.original_filename);
            }
        } else {
            res.status(404).json({ error: 'Arquivo físico não encontrado no servidor.' });
        }
    } catch (error) {
        console.error('[PUBLIC] downloadSubmissionAttachment error:', error);
        res.status(500).json({ error: 'Erro ao baixar arquivo.' });
    }
};

exports.getActivityTypes = async (req, res) => {
    try {
        const types = await db.ActivityType.findAll({
            order: [['name', 'ASC']]
        });
        res.json(types);
    } catch (error) {
        console.error('[PUBLIC] getActivityTypes error:', error);
        res.status(500).json({ error: 'Erro ao buscar tipos de atividade.' });
    }
};

exports.getProfessors = async (req, res) => {
    try {
        const professors = await db.User.findAll({
            where: { role: 'professor' },
            attributes: ['id', 'name'],
            order: [['name', 'ASC']]
        });
        res.json(professors);
    } catch (error) {
        console.error('[PUBLIC] getProfessors error:', error);
        res.status(500).json({ error: 'Erro ao buscar professores.' });
    }
};
