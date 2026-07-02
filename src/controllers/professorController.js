const db = require('../models');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const emailService = require('../services/emailService');

const getSemestreByDate = (dateInput) => {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';
    const month = date.getMonth(); // 0 = Jan, 11 = Dez
    const year = date.getFullYear();
    const semestre = month < 6 ? '1º Semestre' : '2º Semestre';
    return `${semestre} ${year}`;
};

exports.getMySubmissions = async (req, res) => {
    try {
        const submissions = await db.Submission.findAll({
            where: { professor_id: req.userId },
            include: [
                { model: db.Subject, as: 'subject', attributes: ['name'] },
                { model: db.ActivityType, as: 'activityType', attributes: ['name'] }
            ],
            order: [['created_at', 'DESC']]
        });

        const formattedSubs = submissions.map(sub => {
            const data = sub.get({ plain: true });
            data.student_class = getSemestreByDate(sub.createdAt || sub.created_at);
            return data;
        });

        // Buscar formulários criados por este professor
        const forms = await db.Form.findAll({
            where: { created_by: req.userId },
            attributes: ['id', 'title']
        });
        const formIds = forms.map(f => f.id);

        let formResponses = [];
        if (formIds.length > 0) {
            formResponses = await db.FormResponse.findAll({
                where: { form_id: formIds },
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
        }

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
                student_class: getSemestreByDate(fr.submitted_at || fr.created_at),
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

        const combined = [...formattedSubs, ...formSubs].sort((a, b) => {
            return new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at);
        });

        res.json(combined);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: `Erro ao buscar atividades: ${error.message}` });
    }
};

exports.updateGradeFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { grade, feedback, admin_note, send_email } = req.body;

        // Admin can update any, Professor only their own
        const whereClause = req.userRole === 'admin' ? { id } : { id, professor_id: req.userId };

        const submission = await db.Submission.findOne({
            where: whereClause,
            include: [
                { model: db.Subject, as: 'subject', attributes: ['name'] },
                { model: db.ActivityType, as: 'activityType', attributes: ['name'] }
            ]
        });

        if (!submission) {
            return res.status(404).json({ error: 'Atividade não encontrada ou acesso negado.' });
        }

        if (grade !== undefined) submission.grade = (grade === '' || grade === null) ? null : grade;
        if (feedback !== undefined) submission.feedback = feedback;
        
        if (req.userRole === 'admin' && admin_note !== undefined) {
            submission.admin_note = admin_note;
        }

        await submission.save();

        let emailSent = false;

        // Apenas marca como enviado se solicitado e se a nota for diferente de nula
        // O envio real (abertura da janela de e-mail) será feito no frontend
        if (send_email && submission.grade !== null) {
            submission.grade_sent = true;
            await submission.save();
            emailSent = true;
        }

        // Obter o nome do professor ou admin que está avaliando
        const user = await db.User.findByPk(req.userId);
        const professorName = user ? user.name : 'Professor Responsável';

        res.json({ 
            message: 'Dados salvos com sucesso.', 
            submission,
            email_sent: emailSent,
            professor_name: professorName
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar dados.' });
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Admin can toggle any submission, Professor only their own
        const whereClause = req.userRole === 'admin' ? { id } : { id, professor_id: req.userId };

        const submission = await db.Submission.findOne({
            where: whereClause
        });

        if (!submission) {
            return res.status(404).json({ error: 'Atividade não encontrada.' });
        }

        const currentStatus = (submission.status || '').toString().trim();
        
        if (currentStatus === 'Concluído') {
            submission.status = 'Em Andamento';
            submission.resolved_at = null;
        } else {
            submission.status = 'Concluído';
            submission.resolved_at = new Date();
            submission.resolver_id = req.userId;
        }

        await submission.save();

        res.json({ message: `Status alterado para ${submission.status}`, status: submission.status });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao alterar status.' });
    }
};

exports.downloadFile = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Either the professor owns this submission, or the user is an admin
        const whereClause = req.userRole === 'admin' ? { id } : { id, professor_id: req.userId };

        const submission = await db.Submission.findOne({ where: whereClause });

        if (!submission) {
            return res.status(404).json({ error: 'Atividade não encontrada ou acesso negado.' });
        }

        if (!submission.file_path) {
            return res.status(404).json({ error: 'O anexo desta atividade foi excluído.' });
        }

        const filePath = path.join(__dirname, '../../uploads', submission.file_path);

        if (fs.existsSync(filePath)) {
            if (req.query.view === 'true') {
                res.sendFile(filePath);
            } else {
                res.download(filePath, submission.original_filename);
            }
        } else {
            res.status(404).json({ error: 'Arquivo não encontrado no servidor físico.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao baixar arquivo.' });
    }
};

exports.batchDownload = async (req, res) => {
    try {
        const { ids, ignoreEmpty } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Nenhum ID fornecido.' });
        }

        // Filtro de propriedade: se não for admin, só pode acessar submissões vinculadas ao seu ID de professor
        const whereClause = req.userRole === 'admin' 
            ? { id: ids } 
            : { id: ids, professor_id: req.userId };

        const submissions = await db.Submission.findAll({ where: whereClause });

        if (submissions.length === 0) {
            return res.status(404).json({ error: 'Nenhuma atividade válida encontrada ou acesso negado.' });
        }

        const zip = new AdmZip();
        let filesAdded = 0;

        for (const sub of submissions) {
            const hasFilePath = !!sub.file_path;
            const filePath = hasFilePath ? path.join(__dirname, '../../uploads', sub.file_path) : '';
            const fileExists = hasFilePath && fs.existsSync(filePath);
            const hasAnexo = hasFilePath && fileExists;

            // Se ignoreEmpty for true e o aluno não tiver anexo válido, ignoramos ele totalmente do ZIP
            if (ignoreEmpty && !hasAnexo) {
                continue;
            }

            // Sanitização do nome do aluno e do DRT para a pasta
            const safeStudentName = sub.student_name.replace(/[\\/:*?"<>|]/g, '_');
            const safeStudentDrt = sub.student_drt.replace(/[\\/:*?"<>|]/g, '_');
            const folderName = `${safeStudentName} (${safeStudentDrt})`;

            // Criar a pasta do aluno no ZIP (adiciona um diretório vazio no ZIP usando Buffer.alloc(0))
            zip.addFile(`${folderName}/`, Buffer.alloc(0));
            filesAdded++; // Conta a criação do diretório para não dar erro de ZIP vazio se houver apenas pastas vazias

            // Se não tiver anexo físico, pula para o próximo sem tentar ler o arquivo
            if (!hasAnexo) {
                continue;
            }

            const safeStudentClass = sub.student_class.replace(/[\\/:*?"<>|]/g, '_');
            const originalFilename = sub.original_filename || 'arquivo';

            // Obter e formatar a data de inserção (createdAt)
            const dateObj = new Date(sub.createdAt || sub.created_at || new Date());
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            const formattedDate = `${day}-${month}-${year}`;

            const zipFilePath = `${folderName}/${safeStudentName} (${safeStudentDrt}) - ${safeStudentClass} - ${formattedDate} - ${originalFilename}`;

            // Lê o arquivo e adiciona ao zip no caminho separado por pasta
            const fileBuffer = fs.readFileSync(filePath);
            zip.addFile(zipFilePath, fileBuffer);
        }

        if (filesAdded === 0) {
            return res.status(404).json({ error: 'Nenhum arquivo físico encontrado para download.' });
        }

        const zipBuffer = zip.toBuffer();

        res.setHeader('Content-Disposition', 'attachment; filename="atividades.zip"');
        res.setHeader('Content-Type', 'application/zip');
        res.send(zipBuffer);

    } catch (error) {
        console.error('Erro no download em lote:', error);
        res.status(500).json({ error: 'Erro ao gerar arquivo compactado em lote.' });
    }
};

exports.batchSendEmails = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Nenhum ID fornecido.' });
        }

        // Filtro de propriedade: se não for admin, só pode acessar submissões vinculadas ao seu ID de professor
        const whereClause = req.userRole === 'admin' 
            ? { id: ids } 
            : { id: ids, professor_id: req.userId };

        const submissions = await db.Submission.findAll({ 
            where: whereClause,
            include: [
                { model: db.Subject, as: 'subject', attributes: ['name'] },
                { model: db.ActivityType, as: 'activityType', attributes: ['name'] }
            ]
        });

        if (submissions.length === 0) {
            return res.status(404).json({ error: 'Nenhuma atividade válida encontrada ou acesso negado.' });
        }

        // Buscar nome do professor ou admin avaliador
        const user = await db.User.findByPk(req.userId);
        const professorName = user ? user.name : 'Professor Responsável';

        const updatedSubmissions = [];
        const skippedSubmissions = [];

        for (const sub of submissions) {
            // Só marca como enviado se a nota já tiver sido lançada
            if (sub.grade !== null && sub.grade !== undefined) {
                sub.grade_sent = true;
                await sub.save();
                updatedSubmissions.push(sub);
            } else {
                skippedSubmissions.push({ id: sub.id, protocol: sub.protocol || sub.id, reason: 'Atividade sem nota lançada.' });
            }
        }

        res.json({ 
            message: `Processamento concluído. ${updatedSubmissions.length} nota(s) marcada(s) para envio. ${skippedSubmissions.length} ignorada(s) por falta de nota.`,
            submissions: updatedSubmissions,
            skipped: skippedSubmissions,
            professor_name: professorName
        });
    } catch (error) {
        console.error('Erro no processamento em lote:', error);
        res.status(500).json({ error: 'Erro ao processar e-mails em lote.' });
    }
};

exports.getStudentHistoryByDrt = async (req, res) => {
    try {
        const { drt } = req.params;
        if (!drt) {
            return res.status(400).json({ error: 'DRT/RA do aluno é obrigatório.' });
        }

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

        const formattedSubs = submissions.map(sub => {
            const data = sub.get({ plain: true });
            data.student_class = getSemestreByDate(sub.createdAt || sub.created_at);
            return data;
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
                student_class: getSemestreByDate(fr.submitted_at || fr.created_at),
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

        const combined = [...formattedSubs, ...formSubs].sort((a, b) => {
            return new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at);
        });

        res.json(combined);
    } catch (error) {
        console.error('Erro ao buscar histórico do aluno por DRT:', error);
        res.status(500).json({ error: `Erro ao buscar histórico do aluno: ${error.message}` });
    }
};
