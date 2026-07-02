// src/controllers/formController.js
// Controller principal do módulo de Formulários Dinâmicos
// Gerencia CRUD de formulários, respostas, exportações e dashboard
// Segue o padrão dos controllers existentes no projeto (adminController, professorController)

const db = require('../models');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const AdmZip = require('adm-zip');

// Valores válidos para o campo CHA (bloqueio no backend)
const CHA_VALID_VALUES = [2.5, 5.0, 7.5, 10.0];
// Rótulos da escala CHA
const CHA_LABELS = {
    2.5: 'Inicial',
    5.0: 'Em desenvolvimento',
    7.5: 'Adequado',
    10.0: 'Proficiente'
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Verifica se o usuário logado tem permissão sobre o formulário
 */
function canManageForm(form, req) {
    return req.userRole === 'admin' || Number(form.created_by) === Number(req.userId);
}

/**
 * Valida e processa resposta CHA
 * Retorna objeto { c, h, a, media } ou lança erro
 */
function processChaAnswer(value) {
    if (!value || typeof value !== 'object') {
        throw new Error('Resposta CHA inválida: envie { c, h, a }.');
    }
    const c = parseFloat(value.c);
    const h = parseFloat(value.h);
    const a = parseFloat(value.a);

    if (!CHA_VALID_VALUES.includes(c)) throw new Error(`Valor CHA 'C' inválido: ${c}. Use 2.5, 5.0, 7.5 ou 10.0`);
    if (!CHA_VALID_VALUES.includes(h)) throw new Error(`Valor CHA 'H' inválido: ${h}. Use 2.5, 5.0, 7.5 ou 10.0`);
    if (!CHA_VALID_VALUES.includes(a)) throw new Error(`Valor CHA 'A' inválido: ${a}. Use 2.5, 5.0, 7.5 ou 10.0`);

    const media = parseFloat(((c + h + a) / 3).toFixed(2));
    return { c, h, a, media };
}

// ============================================================
// FORMULÁRIOS — CRUD
// ============================================================

/**
 * GET /api/public/forms
 * Retorna lista de formulários publicados (acesso público)
 */
exports.getPublicForms = async (req, res) => {
    try {
        const forms = await db.Form.findAll({
            where: { status: 'published' },
            attributes: ['id', 'title', 'description', 'start_date', 'deadline', 'allow_anonymous', 'evaluator_type', 'evaluated_type'],
            order: [['created_at', 'DESC']]
        });
        res.json(forms);
    } catch (error) {
        console.error('Erro ao listar formulários públicos:', error);
        res.status(500).json({ error: 'Erro ao listar formulários.' });
    }
};

/**
 * GET /api/forms
 * Lista formulários do usuário logado (admin vê todos)
 */
exports.getForms = async (req, res) => {
    try {
        const where = req.userRole !== 'admin' ? { created_by: req.userId } : {};
        const forms = await db.Form.findAll({
            where,
            include: [
                { model: db.User, as: 'creator', attributes: ['id', 'name', 'email'] }
            ],
            order: [['created_at', 'DESC']]
        });

        // Adiciona contagem de respostas para cada form
        const formsWithCount = await Promise.all(forms.map(async (form) => {
            const responseCount = await db.FormResponse.count({ where: { form_id: form.id } });
            return { ...form.toJSON(), responseCount };
        }));

        res.json(formsWithCount);
    } catch (error) {
        console.error('Erro ao listar formulários:', error);
        res.status(500).json({ error: 'Erro ao listar formulários.' });
    }
};

/**
 * GET /api/forms/:id
 * Retorna formulário com seus campos
 */
exports.getFormById = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id, {
            include: [
                { model: db.FormField, as: 'fields', order: [['position', 'ASC']] },
                { model: db.User, as: 'creator', attributes: ['id', 'name', 'email'] }
            ]
        });
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });
        res.json(form);
    } catch (error) {
        console.error('Erro ao buscar formulário:', error);
        res.status(500).json({ error: 'Erro ao buscar formulário.' });
    }
};

/**
 * POST /api/forms
 * Cria novo formulário (com campos opcionais no corpo)
 * Body: { title, description, deadline, allowAnonymous, allowEditResponse, fields?: [] }
 */
exports.createForm = async (req, res) => {
    try {
        const { title, description, start_date, deadline, allow_anonymous, allow_edit_response, evaluator_type, evaluated_type, fields = [] } = req.body;

        if (!title) return res.status(400).json({ error: 'O título é obrigatório.' });

        const form = await db.Form.create({
            title,
            description: description || null,
            status: 'draft',
            allow_anonymous: !!allow_anonymous,
            evaluator_type: evaluator_type || null,
            evaluated_type: evaluated_type || null,
            start_date: start_date || null,
            deadline: deadline || null,
            allow_edit_response: !!allow_edit_response,
            created_by: req.userId
        });

        // Cria campos se fornecidos
        if (fields.length > 0) {
            const fieldRecords = fields.map((f, i) => ({
                form_id: form.id,
                type: f.type,
                label: f.label || 'Campo',
                placeholder: f.placeholder || null,
                required: !!f.required,
                default_value: f.default_value || null,
                help_text: f.help_text || null,
                options: f.options || null,
                position: i
            }));
            await db.FormField.bulkCreate(fieldRecords);
        }

        const formWithFields = await db.Form.findByPk(form.id, {
            include: [{ model: db.FormField, as: 'fields', order: [['position', 'ASC']] }]
        });

        res.status(201).json(formWithFields);
    } catch (error) {
        console.error('Erro ao criar formulário:', error);
        res.status(500).json({ error: 'Erro ao criar formulário.' });
    }
};

/**
 * PUT /api/forms/:id
 * Atualiza metadados do formulário
 * Body: { title, description, deadline, allowAnonymous, allowEditResponse }
 */
exports.updateForm = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });

        if (!canManageForm(form, req)) {
            return res.status(403).json({ error: 'Sem permissão para editar este formulário.' });
        }

        const { title, description, start_date, deadline, allow_anonymous, allow_edit_response, evaluator_type, evaluated_type } = req.body;

        if (title) form.title = title;
        if (description !== undefined) form.description = description;
        if (start_date !== undefined) form.start_date = start_date || null;
        if (deadline !== undefined) form.deadline = deadline || null;
        if (allow_anonymous !== undefined) form.allow_anonymous = !!allow_anonymous;
        if (allow_edit_response !== undefined) form.allow_edit_response = !!allow_edit_response;
        if (evaluator_type !== undefined) form.evaluator_type = evaluator_type || null;
        if (evaluated_type !== undefined) form.evaluated_type = evaluated_type || null;

        await form.save();
        res.json(form);
    } catch (error) {
        console.error('Erro ao atualizar formulário:', error);
        res.status(500).json({ error: 'Erro ao atualizar formulário.' });
    }
};

/**
 * DELETE /api/forms/:id
 * Exclui formulário (e em cascade: campos, respostas, answers)
 */
exports.deleteForm = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });

        if (!canManageForm(form, req)) {
            return res.status(403).json({ error: 'Sem permissão para excluir este formulário.' });
        }

        await form.destroy();
        res.json({ message: 'Formulário excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir formulário:', error);
        res.status(500).json({ error: 'Erro ao excluir formulário.' });
    }
};

/**
 * POST /api/forms/:id/duplicate
 * Duplica formulário e todos os seus campos
 */
exports.duplicateForm = async (req, res) => {
    try {
        const original = await db.Form.findByPk(req.params.id, {
            include: [{ model: db.FormField, as: 'fields' }]
        });
        if (!original) return res.status(404).json({ error: 'Formulário não encontrado.' });

        if (!canManageForm(original, req)) {
            return res.status(403).json({ error: 'Sem permissão para duplicar este formulário.' });
        }

        // Cria cópia do form
        const copy = await db.Form.create({
            title: `${original.title} (cópia)`,
            description: original.description,
            status: 'draft',   // sempre começa como rascunho
            allow_anonymous: original.allow_anonymous,
            deadline: null,    // prazo não é copiado
            allow_edit_response: original.allow_edit_response,
            created_by: req.userId
        });

        // Copia os campos
        if (original.fields && original.fields.length > 0) {
            const copiedFields = original.fields.map(f => ({
                form_id: copy.id,
                type: f.type,
                label: f.label,
                placeholder: f.placeholder,
                required: f.required,
                default_value: f.default_value,
                help_text: f.help_text,
                options: f.options,
                position: f.position
            }));
            await db.FormField.bulkCreate(copiedFields);
        }

        const result = await db.Form.findByPk(copy.id, {
            include: [{ model: db.FormField, as: 'fields', order: [['position', 'ASC']] }]
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Erro ao duplicar formulário:', error);
        res.status(500).json({ error: 'Erro ao duplicar formulário.' });
    }
};

/**
 * PATCH /api/forms/:id/publish
 * Alterna status entre 'draft' e 'published'
 */
exports.togglePublish = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });

        if (!canManageForm(form, req)) {
            return res.status(403).json({ error: 'Sem permissão para publicar este formulário.' });
        }

        form.status = form.status === 'published' ? 'draft' : 'published';
        await form.save();

        res.json({
            message: form.status === 'published' ? 'Formulário publicado.' : 'Formulário despublicado.',
            status: form.status
        });
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        res.status(500).json({ error: 'Erro ao alterar status do formulário.' });
    }
};

// ============================================================
// RESPOSTAS
// ============================================================

/**
 * POST /api/forms/:id/submit
 * Registra resposta ao formulário (público — não exige autenticação)
 * Suporta anônimos e upload de arquivos
 * Body (multipart/form-data):
 *   answers: JSON string com { fieldId: value, ... }
 *   files: arquivos (campo "files" via Multer)
 */
exports.submitForm = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id, {
            include: [{ model: db.FormField, as: 'fields' }]
        });

        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });
        if (form.status !== 'published') return res.status(403).json({ error: 'Este formulário não está disponível para respostas.' });

        // Verifica prazo de abertura
        if (form.start_date && new Date() < new Date(form.start_date)) {
            return res.status(403).json({ error: 'O prazo para resposta deste formulário ainda não iniciou.' });
        }

        // Verifica prazo de encerramento
        if (form.deadline && new Date() > new Date(form.deadline)) {
            return res.status(403).json({ error: 'O prazo para resposta deste formulário encerrou.' });
        }

        // Se o formulário não for anônimo, Nome e RA/DRT/CPF são obrigatórios
        let respondent_name = null;
        let respondent_identifier = null;

        if (!form.allow_anonymous) {
            respondent_name = req.body.respondent_name;
            respondent_identifier = req.body.respondent_identifier;
            
            if (!respondent_name || !respondent_identifier) {
                return res.status(400).json({ 
                    error: 'Identificação necessária.', 
                    message: 'Este formulário não é anônimo. O Nome e o Documento (RA/DRT/CPF) são obrigatórios.' 
                });
            }
        }

        // Processa answers do body (JSON string ou objeto)
        let answers = req.body.answers;
        if (typeof answers === 'string') {
            try { answers = JSON.parse(answers); } catch { answers = {}; }
        }
        if (!answers || typeof answers !== 'object') answers = {};

        // Valida campos obrigatórios
        const fields = form.fields || [];
        for (const field of fields) {
            if (field.required && !answers[field.id] && field.type !== 'file') {
                return res.status(400).json({ error: `Campo obrigatório não preenchido: "${field.label}"` });
            }
        }

        // Cria o cabeçalho da resposta
        const response = await db.FormResponse.create({
            form_id: form.id,
            user_id: req.userId || null,
            submitted_at: new Date(),
            ip_address: req.ip || null,
            respondent_name: respondent_name ? String(respondent_name).trim() : null,
            respondent_identifier: respondent_identifier ? String(respondent_identifier).trim() : null
        });

        // Mapeia arquivos uploaded por fieldId (enviados como "file_<fieldId>")
        const uploadedFiles = {};
        if (req.files && req.files.files) {
            req.files.files.forEach(f => {
                // Extrai fieldId do nome original ou do campo customizado
                const match = f.fieldname ? f.fieldname.match(/(\d+)/) : null;
                if (match) uploadedFiles[match[1]] = f;
            });
        }

        // Cria uma FormAnswer para cada campo
        const answerRecords = [];
        for (const field of fields) {
            const rawValue = answers[field.id];
            let finalValue = null;
            let filePath = null;
            let originalFilename = null;

            if (field.type === 'file') {
                // Processa upload de arquivo
                const uploadedFile = uploadedFiles[field.id];
                if (uploadedFile) {
                    filePath = uploadedFile.path;
                    originalFilename = uploadedFile.originalname;
                    finalValue = uploadedFile.filename;
                }
            } else if (field.type === 'cha') {
                // Valida e calcula média CHA no backend
                try {
                    const chaResult = processChaAnswer(rawValue);
                    finalValue = JSON.stringify(chaResult);
                } catch (chaErr) {
                    if (field.required) {
                        // Limpa arquivos já salvos
                        await response.destroy();
                        return res.status(400).json({ error: chaErr.message });
                    }
                    finalValue = null;
                }
            } else if (field.type === 'checkbox' && Array.isArray(rawValue)) {
                finalValue = JSON.stringify(rawValue);
            } else {
                finalValue = rawValue !== undefined && rawValue !== null ? String(rawValue) : null;
            }

            answerRecords.push({
                response_id: response.id,
                field_id: field.id,
                value: finalValue,
                file_path: filePath,
                original_filename: originalFilename
            });
        }

        await db.FormAnswer.bulkCreate(answerRecords);

        res.status(201).json({
            message: 'Resposta enviada com sucesso!',
            responseId: response.id
        });
    } catch (error) {
        console.error('Erro ao enviar resposta:', error);
        res.status(500).json({ error: 'Erro ao processar resposta.' });
    }
};

/**
 * GET /api/forms/:id/responses
 * Lista respostas do formulário com paginação
 * Query params: page (default 1), limit (default 20)
 */
exports.getResponses = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });

        if (!canManageForm(form, req)) {
            return res.status(403).json({ error: 'Sem permissão para ver respostas deste formulário.' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const where = { form_id: form.id };
        const { from, to } = req.query;

        if (from || to) {
            const { Op } = require('sequelize');
            where.submitted_at = {};
            if (from) {
                where.submitted_at[Op.gte] = new Date(`${from}T00:00:00`);
            }
            if (to) {
                where.submitted_at[Op.lte] = new Date(`${to}T23:59:59`);
            }
        }

        const { count, rows } = await db.FormResponse.findAndCountAll({
            where,
            include: [
                {
                    model: db.FormAnswer,
                    as: 'answers',
                    include: [{ model: db.FormField, as: 'field', attributes: ['id', 'label', 'type'] }]
                },
                { model: db.User, as: 'respondent', attributes: ['id', 'name', 'email', 'drt'] }
            ],
            order: [['submitted_at', 'DESC']],
            limit,
            offset
        });

        res.json({
            total: count,
            page,
            totalPages: Math.ceil(count / limit),
            responses: rows
        });
    } catch (error) {
        console.error('Erro ao listar respostas:', error);
        res.status(500).json({ error: 'Erro ao listar respostas.' });
    }
};

/**
 * POST /api/forms/:id/responses/batch-delete
 * Exclui respostas do formulário em lote (e suas respostas associadas)
 */
exports.batchDeleteResponses = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });

        if (!canManageForm(form, req)) {
            return res.status(403).json({ error: 'Sem permissão para gerenciar as respostas deste formulário.' });
        }

        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Nenhum ID de resposta fornecido.' });
        }

        // Deleta as FormAnswers associadas às respostas que serão excluídas
        await db.FormAnswer.destroy({
            where: { response_id: ids }
        });

        // Deleta as FormResponses
        await db.FormResponse.destroy({
            where: { id: ids, form_id: form.id }
        });

        res.json({ message: `${ids.length} resposta(s) excluída(s) com sucesso.` });
    } catch (error) {
        console.error('Erro ao excluir respostas em lote:', error);
        res.status(500).json({ error: 'Erro ao excluir respostas selecionadas.' });
    }
};

// ============================================================
// EXPORTAÇÕES
// ============================================================

/**
 * Função auxiliar: carrega form completo com campos e respostas
 */
async function loadFormWithResponses(formId, from = null, to = null) {
    const whereResponse = { form_id: formId };
    if (from || to) {
        const { Op } = require('sequelize');
        whereResponse.submitted_at = {};
        if (from) whereResponse.submitted_at[Op.gte] = new Date(`${from}T00:00:00`);
        if (to) whereResponse.submitted_at[Op.lte] = new Date(`${to}T23:59:59`);
    }

    return db.Form.findByPk(formId, {
        include: [
            { model: db.FormField, as: 'fields', order: [['position', 'ASC']] },
            {
                model: db.FormResponse,
                as: 'responses',
                where: whereResponse,
                required: false,
                include: [
                    { model: db.FormAnswer, as: 'answers' },
                    { model: db.User, as: 'respondent', attributes: ['name', 'email', 'drt'] }
                ],
                order: [['submitted_at', 'DESC']]
            }
        ]
    });
}

/**
 * Formata o valor de uma resposta para exibição em exportação
 */
function formatAnswerValue(answer, field) {
    if (!answer || answer.value === null || answer.value === undefined) return '';

    if (field && field.type === 'cha') {
        try {
            const cha = JSON.parse(answer.value);
            return `C=${cha.c}(${CHA_LABELS[cha.c]}) H=${cha.h}(${CHA_LABELS[cha.h]}) A=${cha.a}(${CHA_LABELS[cha.a]}) Média=${cha.media}`;
        } catch { return answer.value; }
    }

    if (field && field.type === 'file') return answer.original_filename || answer.value || '';

    if (field && field.type === 'checkbox') {
        try {
            const arr = JSON.parse(answer.value);
            return Array.isArray(arr) ? arr.join(', ') : answer.value;
        } catch { return answer.value; }
    }

    return answer.value;
}

/**
 * GET /api/forms/:id/export/excel
 * Exporta respostas em formato Excel (.xlsx) via ExcelJS
 */
exports.exportExcel = async (req, res) => {
    try {
        const { from, to } = req.query;
        const form = await loadFormWithResponses(req.params.id, from, to);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });
        if (!canManageForm(form, req)) return res.status(403).json({ error: 'Sem permissão.' });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema de Formulários';
        const sheet = workbook.addWorksheet('Respostas');

        // Cabeçalhos
        const headers = [
            { header: 'ID Resposta', key: 'id', width: 12 },
            { header: 'Respondente', key: 'respondent', width: 25 },
            { header: 'Data/Hora', key: 'submitted_at', width: 20 },
            ...form.fields.map(f => ({ header: f.label, key: `field_${f.id}`, width: 30 }))
        ];
        sheet.columns = headers;

        // Estilo do cabeçalho
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: 'FF4F46E5' }
        };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Linhas de dados
        (form.responses || []).forEach(response => {
            const respondentText = response.respondent
                ? `${response.respondent.name} (${response.respondent.email})`
                : (response.respondent_name
                    ? `${response.respondent_name} [${response.respondent_identifier}]`
                    : 'Anônimo');

            const row = {
                id: response.id,
                respondent: respondentText,
                submitted_at: new Date(response.submitted_at).toLocaleString('pt-BR')
            };

            // Mapeia answers por fieldId
            const answersMap = {};
            (response.answers || []).forEach(a => { answersMap[a.field_id] = a; });

            form.fields.forEach(field => {
                const answer = answersMap[field.id];
                row[`field_${field.id}`] = formatAnswerValue(answer, field);
            });

            sheet.addRow(row);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="respostas_form_${form.id}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        res.status(500).json({ error: 'Erro ao gerar arquivo Excel.' });
    }
};

/**
 * GET /api/forms/:id/export/csv
 * Exporta respostas em formato CSV
 */
exports.exportCsv = async (req, res) => {
    try {
        const { from, to } = req.query;
        const form = await loadFormWithResponses(req.params.id, from, to);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });
        if (!canManageForm(form, req)) return res.status(403).json({ error: 'Sem permissão.' });

        const escape = v => `"${String(v || '').replace(/"/g, '""')}"`;

        // Linha de cabeçalho
        const headerRow = ['ID', 'Respondente', 'Data/Hora', ...form.fields.map(f => f.label)]
            .map(escape).join(',');

        const rows = [headerRow];

        (form.responses || []).forEach(response => {
            const answersMap = {};
            (response.answers || []).forEach(a => { answersMap[a.field_id] = a; });

            const respondent = response.respondent
                ? `${response.respondent.name} (${response.respondent.email})`
                : 'Anônimo';

            const cols = [
                response.id,
                respondent,
                new Date(response.submitted_at).toLocaleString('pt-BR'),
                ...form.fields.map(field => formatAnswerValue(answersMap[field.id], field))
            ];
            rows.push(cols.map(escape).join(','));
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="respostas_form_${form.id}.csv"`);
        res.send('\uFEFF' + rows.join('\r\n'));  // BOM para Excel reconhecer UTF-8
    } catch (error) {
        console.error('Erro ao exportar CSV:', error);
        res.status(500).json({ error: 'Erro ao gerar arquivo CSV.' });
    }
};

/**
 * GET /api/forms/:id/export/zip
 * Gera ZIP com todos os arquivos uploaded das respostas via ADM-ZIP
 */
exports.exportZip = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });
        if (!canManageForm(form, req)) return res.status(403).json({ error: 'Sem permissão.' });

        const { from, to } = req.query;
        const whereResponse = { form_id: form.id };
        if (from || to) {
            const { Op } = require('sequelize');
            whereResponse.submitted_at = {};
            if (from) whereResponse.submitted_at[Op.gte] = new Date(`${from}T00:00:00`);
            if (to) whereResponse.submitted_at[Op.lte] = new Date(`${to}T23:59:59`);
        }

        // Busca todas as answers com arquivo filtrando pela data da resposta
        const answers = await db.FormAnswer.findAll({
            include: [
                { model: db.FormResponse, as: undefined, where: whereResponse, attributes: ['id', 'submitted_at'] }
            ],
            where: { file_path: { [db.Sequelize.Op.ne]: null } }
        });

        const zip = new AdmZip();
        let fileCount = 0;

        answers.forEach(answer => {
            if (answer.file_path && fs.existsSync(answer.file_path)) {
                const filename = answer.original_filename || path.basename(answer.file_path);
                zip.addLocalFile(answer.file_path, '', `resposta_${answer.response_id}_${filename}`);
                fileCount++;
            }
        });

        if (fileCount === 0) {
            return res.status(404).json({ error: 'Nenhum arquivo encontrado nas respostas deste formulário.' });
        }

        const zipBuffer = zip.toBuffer();
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="anexos_form_${form.id}.zip"`);
        res.send(zipBuffer);
    } catch (error) {
        console.error('Erro ao gerar ZIP:', error);
        res.status(500).json({ error: 'Erro ao gerar arquivo ZIP.' });
    }
};

// ============================================================
// DASHBOARD
// ============================================================

/**
 * GET /api/dashboard/forms
 * Retorna estatísticas do dashboard de formulários
 * Admin: todos os dados; Professor: apenas seus dados
 */
exports.getDashboard = async (req, res) => {
    try {
        const isAdmin = req.userRole === 'admin';
        const whereForm = isAdmin ? {} : { created_by: req.userId };

        // Total de formulários
        const totalForms = await db.Form.count({ where: whereForm });
        const publishedForms = await db.Form.count({ where: { ...whereForm, status: 'published' } });

        // IDs dos formulários do usuário
        const userForms = await db.Form.findAll({ where: whereForm, attributes: ['id'] });
        const formIds = userForms.map(f => f.id);

        // Total de respostas
        const totalResponses = formIds.length > 0
            ? await db.FormResponse.count({ where: { form_id: formIds } })
            : 0;

        // Formulários mais respondidos (top 5)
        const topForms = await db.Form.findAll({
            where: whereForm,
            attributes: [
                'id', 'title', 'status',
                [db.Sequelize.fn('COUNT', db.Sequelize.col('responses.id')), 'responseCount']
            ],
            include: [{ model: db.FormResponse, as: 'responses', attributes: [] }],
            group: ['Form.id'],
            order: [[db.Sequelize.literal('responseCount'), 'DESC']],
            limit: 5,
            subQuery: false
        });

        // Respostas por período (últimos 7 dias)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const responsesByDay = await db.FormResponse.findAll({
            where: formIds.length > 0
                ? { form_id: formIds, submitted_at: { [db.Sequelize.Op.gte]: sevenDaysAgo } }
                : { submitted_at: { [db.Sequelize.Op.gte]: sevenDaysAgo }, form_id: { [db.Sequelize.Op.eq]: -1 } },
            attributes: [
                [db.Sequelize.fn('DATE', db.Sequelize.col('submitted_at')), 'date'],
                [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']
            ],
            group: [db.Sequelize.fn('DATE', db.Sequelize.col('submitted_at'))],
            order: [[db.Sequelize.fn('DATE', db.Sequelize.col('submitted_at')), 'ASC']]
        });

        res.json({
            totalForms,
            publishedForms,
            draftForms: totalForms - publishedForms,
            totalResponses,
            topForms,
            responsesByDay
        });
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        res.status(500).json({ error: 'Erro ao carregar dashboard.' });
    }
};
