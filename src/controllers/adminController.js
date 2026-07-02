const db = require('../models');
const bcrypt = require('bcryptjs');
const exceljs = require('exceljs');
const fs = require('fs');
const path = require('path');

const getSemestreByDate = (dateInput) => {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '—';
    const month = date.getMonth(); // 0 = Jan, 11 = Dez
    const year = date.getFullYear();
    const semestre = month < 6 ? '1º Semestre' : '2º Semestre';
    return `${semestre} ${year}`;
};

// === USUÁRIOS (Professores) ===
exports.getUsers = async (req, res) => {
    try {
        const users = await db.User.findAll({ attributes: { exclude: ['password'] } });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuários.' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role, drt } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await db.User.create({ name, email, password: hashedPassword, role, drt: drt || null });
        res.status(201).json({ message: 'Usuário criado com sucesso.', user: { id: user.id, name: user.name, email: user.email, role: user.role, drt: user.drt } });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar usuário.' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, role, drt } = req.body;
        
        const user = await db.User.findByPk(id);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        user.name = name || user.name;
        user.email = email || user.email;
        user.role = role || user.role;
        user.drt = drt !== undefined ? drt : user.drt;

        if (password && password.trim() !== '') {
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();
        res.json({ message: 'Usuário atualizado com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await db.User.destroy({ where: { id } });
        res.json({ message: 'Usuário removido.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao remover usuário.' });
    }
};

exports.toggleUserBlock = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await db.User.findByPk(id);
        
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
        
        // Impede que o admin se bloqueie
        if (Number(id) === req.userId) {
            return res.status(400).json({ error: 'Você não pode bloquear sua própria conta.' });
        }

        user.is_active = !user.is_active;
        await user.save();
        
        const status = user.is_active ? 'desbloqueado' : 'bloqueado';
        res.json({ message: `Usuário ${status} com sucesso.`, is_active: user.is_active });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao alterar status do usuário.' });
    }
};

// === SUBMISSÕES GERAIS E EXPORTAÇÃO ===
exports.getAllSubmissions = async (req, res) => {
    try {
        const submissions = await db.Submission.findAll({
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

        // Buscar todas as respostas de formulários preenchidos
        const formResponses = await db.FormResponse.findAll({
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
        console.error(error);
        res.status(500).json({ error: `Erro ao buscar atividades: ${error.message}` });
    }
};

exports.updateSubmission = async (req, res) => {
    try {
        const sub = await db.Submission.findByPk(req.params.id);
        if (!sub) return res.status(404).json({ error: 'Atividade não encontrada.' });
        const { student_name, student_drt, student_class, grade, feedback, admin_note, subject_id, professor_id, status, activity_type_id } = req.body;
        if (student_name) sub.student_name = student_name;
        if (student_drt) sub.student_drt = student_drt;
        if (student_class) sub.student_class = student_class;
        if (grade !== undefined) sub.grade = grade;
        if (feedback !== undefined) sub.feedback = feedback;
        if (admin_note !== undefined) sub.admin_note = admin_note;
        if (subject_id) sub.subject_id = subject_id;
        if (professor_id) sub.professor_id = professor_id;
        if (status) sub.status = status;
        if (activity_type_id !== undefined) sub.activity_type_id = activity_type_id || null;
        await sub.save();
        res.json({ message: 'Atividade atualizada com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar atividade.' });
    }
};

exports.deleteSubmission = async (req, res) => {
    try {
        const sub = await db.Submission.findByPk(req.params.id);
        if (!sub) return res.status(404).json({ error: 'Atividade não encontrada.' });
        if (sub.file_path) {
            const filePath = path.join(__dirname, '../../uploads', sub.file_path);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await sub.destroy();
        res.json({ message: 'Atividade excluída com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir atividade.' });
    }
};

exports.batchDeleteSubmissions = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs inválidos.' });
        const subs = await db.Submission.findAll({ where: { id: ids } });
        for (let sub of subs) {
            if (sub.file_path) {
                const filePath = path.join(__dirname, '../../uploads', sub.file_path);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            await sub.destroy();
        }
        res.json({ message: 'Atividades excluídas com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir atividades em lote.' });
    }
};

exports.batchDeleteFiles = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs inválidos.' });
        const subs = await db.Submission.findAll({ where: { id: ids } });
        for (let sub of subs) {
            if (sub.file_path) {
                const filePath = path.join(__dirname, '../../uploads', sub.file_path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                sub.file_path = null;
                sub.original_filename = null;
                await sub.save();
            }
        }
        res.json({ message: 'Anexos excluídos com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir anexos em lote.' });
    }
};

exports.exportExcel = async (req, res) => {
    try {
        // Se for professor, exporta apenas as dele. Se admin, exporta todas.
        const whereClause = req.userRole === 'admin' ? {} : { professor_id: req.userId };
        
        const submissions = await db.Submission.findAll({
            where: whereClause,
            include: [
                { model: db.Subject, as: 'subject', attributes: ['name'] },
                { model: db.User, as: 'professor', attributes: ['name'] },
                { model: db.ActivityType, as: 'activityType', attributes: ['name'] }
            ],
            order: [['created_at', 'DESC']]
        });

        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Atividades');

        worksheet.columns = [
            { header: 'Protocolo', key: 'protocol', width: 25 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Aluno', key: 'student_name', width: 25 },
            { header: 'DRT', key: 'student_drt', width: 15 },
            { header: 'Semestre', key: 'student_class', width: 15 },
            { header: 'Tipo Atividade', key: 'activity_type', width: 20 },
            { header: 'Disciplina', key: 'subject', width: 25 },
            { header: 'Email Aluno', key: 'student_email', width: 25 },
            { header: 'Data Envio', key: 'created_at', width: 20 },
            { header: 'Data Resolução', key: 'resolved_at', width: 20 },
            { header: 'Nota/Parecer', key: 'grade', width: 15 },
            { header: 'Resposta', key: 'feedback', width: 30 },
            { header: 'Nota Interna (ADM)', key: 'admin_note', width: 30 }
        ];

        submissions.forEach(sub => {
            worksheet.addRow({
                protocol: sub.protocol,
                status: sub.status,
                student_name: sub.student_name,
                student_drt: sub.student_drt,
                student_class: getSemestreByDate(sub.createdAt || sub.created_at),
                activity_type: sub.activityType ? sub.activityType.name : 'N/A',
                subject: sub.subject ? sub.subject.name : 'N/A',
                student_email: sub.student_email,
                created_at: new Date(sub.createdAt).toLocaleString(),
                resolved_at: sub.resolved_at ? new Date(sub.resolved_at).toLocaleString() : '-',
                grade: sub.grade || '',
                feedback: sub.feedback || '',
                admin_note: sub.admin_note || ''
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + 'atividades.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao exportar para Excel.' });
    }
};

// ================= AVISOS =================
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
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar avisos.' }); }
};

exports.createNotice = async (req, res) => {
    try {
        const { title, message, user_id } = req.body;
        if (!title || !message) return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
        
        const data = { title, message, author_id: req.userId, user_id: user_id || null };
        if (req.file) {
            data.file_path = req.file.filename;
            data.original_filename = req.file.originalname;
        }

        await db.Notice.create(data);
        res.status(201).json({ message: 'Aviso criado com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro ao criar aviso.' }); }
};

exports.updateNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, message, user_id } = req.body;
        const notice = await db.Notice.findByPk(id);
        if (!notice) return res.status(404).json({ error: 'Aviso não encontrado.' });
        
        // Verifica permissão: Admin ou Autor
        if (req.userRole !== 'admin' && notice.author_id !== req.userId) {
            return res.status(403).json({ error: 'Você não tem permissão para editar este aviso.' });
        }
        
        if (title) notice.title = title;
        if (message) notice.message = message;
        if (user_id !== undefined) notice.user_id = user_id || null;
        
        if (req.file) {
            notice.file_path = req.file.filename;
            notice.original_filename = req.file.originalname;
        }

        await notice.save();
        res.json({ message: 'Aviso atualizado com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro ao atualizar aviso.' }); }
};

exports.deleteNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const notice = await db.Notice.findByPk(id);
        if (!notice) return res.status(404).json({ error: 'Aviso não encontrado.' });

        // Verifica permissão: Admin ou Autor
        if (req.userRole !== 'admin' && notice.author_id !== req.userId) {
            return res.status(403).json({ error: 'Você não tem permissão para excluir este aviso.' });
        }

        await notice.destroy();
        res.json({ message: 'Aviso excluído com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro ao excluir aviso.' }); }
};

// ================= EXPORTAÇÃO E IMPORTAÇÃO =================

// Helper para Exportar
const generateExport = async (res, filename, worksheetName, columns, data) => {
    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet(worksheetName);
    worksheet.columns = columns;
    data.forEach(item => worksheet.addRow(item));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    await workbook.xlsx.write(res);
    res.end();
};

// Usuários
exports.exportUsers = async (req, res) => {
    try {
        const users = await db.User.findAll({ order: [['name', 'ASC']] });
        const data = users.map(u => ({ name: u.name, email: u.email, role: u.role, drt: u.drt || '', password: u.password }));
        const columns = [
            { header: 'Nome', key: 'name', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Role', key: 'role', width: 15 },
            { header: 'RA_DRT_CPF', key: 'drt', width: 20 },
            { header: 'Senha (Hash ou Texto)', key: 'password', width: 60 }
        ];
        await generateExport(res, 'usuarios.xlsx', 'Usuários', columns, data);
    } catch (error) { res.status(500).json({ error: 'Erro ao exportar usuários.' }); }
};

exports.importUsers = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        const workbook = new exceljs.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.getWorksheet(1);
        const bcrypt = require('bcryptjs');

        let count = 0;
        for (let i = 2; i <= worksheet.rowCount; i++) {
            const row = worksheet.getRow(i);
            const name = row.getCell(1).value;
            const email = row.getCell(2).value;
            const role = row.getCell(3).value || 'professor';
            const drt = row.getCell(4).value;
            let password = row.getCell(5).value;

            if (name && email) {
                // Garante que email é uma string simples (pode vir como objeto {text, hyperlink} do Excel)
                const emailStr = (typeof email === 'object' && email !== null && email.text) ? email.text : String(email);
                const nameStr = String(name).trim();
                const roleStr = String(role).trim().toLowerCase() || 'professor';

                const existingUser = await db.User.findOne({ where: { email: emailStr } });
                
                if (existingUser) {
                    // Usuário já existe: atualiza apenas nome, cargo e drt, mantém a senha atual
                    existingUser.name = nameStr;
                    existingUser.role = roleStr;
                    existingUser.drt = drt ? String(drt).trim() : null;
                    await existingUser.save();
                } else {
                    // Novo usuário: define a senha (da planilha ou padrão 123456)
                    let finalPassword = password ? String(password) : '123456';
                    const isHash = typeof finalPassword === 'string' && finalPassword.startsWith('$2');
                    if (!isHash) {
                        finalPassword = await bcrypt.hash(finalPassword, 10);
                    }
                    await db.User.create({ name: nameStr, email: emailStr, role: roleStr, drt: drt ? String(drt).trim() : null, password: finalPassword });
                }
                count++;
            }
        }
        // Remove o arquivo temporário após processar
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        res.json({ message: `${count} usuário(s) importado(s)/atualizado(s) com sucesso.` });
    } catch (error) {
        console.error('[IMPORT USERS ERROR]', error);
        // Remove arquivo temporário mesmo em caso de erro
        if (req.file && req.file.path) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
        res.status(500).json({ error: `Erro ao importar usuários: ${error.message}` });
    }
};



// ================= MENSAGENS DO NUMQ (STUDENT MESSAGES) =================
exports.getStudentMessages = async (req, res) => {
    try {
        const whereClause = {};
        if (req.userRole === 'professor') {
            whereClause.professor_id = req.userId;
        }

        const messages = await db.StudentMessage.findAll({
            where: whereClause,
            include: [{ model: db.User, as: 'professor', attributes: ['id', 'name'] }],
            order: [['createdAt', 'DESC']]
        });
        res.json(messages);
    } catch (error) {
        console.error('[ADMIN] getStudentMessages error:', error);
        res.status(500).json({ error: 'Erro ao buscar mensagens.' });
    }
};

exports.markStudentMessageAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await db.StudentMessage.findByPk(id);
        if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });

        if (req.userRole === 'professor' && String(message.professor_id) !== String(req.userId)) {
            return res.status(403).json({ error: 'Sem permissão para atualizar esta mensagem.' });
        }

        message.read = true;
        await message.save();
        res.json({ message: 'Mensagem marcada como lida.' });
    } catch (error) {
        console.error('[ADMIN] markStudentMessageAsRead error:', error);
        res.status(500).json({ error: 'Erro ao atualizar mensagem.' });
    }
};

exports.deleteStudentMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const message = await db.StudentMessage.findByPk(id);
        if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });

        if (req.userRole === 'professor' && String(message.professor_id) !== String(req.userId)) {
            return res.status(403).json({ error: 'Sem permissão para excluir esta mensagem.' });
        }

        await message.destroy();
        res.json({ message: 'Mensagem excluída com sucesso.' });
    } catch (error) {
        console.error('[ADMIN] deleteStudentMessage error:', error);
        res.status(500).json({ error: 'Erro ao remover mensagem.' });
    }
};

exports.updateStudentMessageNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { admin_note } = req.body;
        
        const message = await db.StudentMessage.findByPk(id);
        if (!message) return res.status(404).json({ error: 'Mensagem não encontrada.' });

        message.admin_note = admin_note || null;
        await message.save();
        
        res.json({ message: 'Nota interna atualizada com sucesso.' });
    } catch (error) {
        console.error('[ADMIN] updateStudentMessageNote error:', error);
        res.status(500).json({ error: 'Erro ao atualizar nota interna.' });
    }
};



