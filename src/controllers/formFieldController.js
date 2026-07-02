// src/controllers/formFieldController.js
// Controller para gerenciar os campos de um formulário
// Segue o padrão dos controllers existentes no projeto

const db = require('../models');

/**
 * GET /api/forms/:id/fields
 * Lista todos os campos de um formulário, ordenados por posição
 * Acessível por qualquer usuário autenticado
 */
exports.getFields = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });

        const fields = await db.FormField.findAll({
            where: { form_id: req.params.id },
            order: [['position', 'ASC']]
        });

        res.json(fields);
    } catch (error) {
        console.error('Erro ao listar campos:', error);
        res.status(500).json({ error: 'Erro ao listar campos do formulário.' });
    }
};

/**
 * POST /api/forms/:id/fields
 * Salva (upsert bulk) todos os campos do formulário
 * Recebe array completo de campos; remove os que não vieram no array
 * Body: { fields: [{ id?, type, label, placeholder, required, defaultValue, helpText, options, position }] }
 */
exports.saveFields = async (req, res) => {
    try {
        const formId = req.params.id;
        const form = await db.Form.findByPk(formId);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });

        // Verificar permissão: apenas o criador ou admin pode editar
        if (req.userRole !== 'admin' && form.created_by !== req.userId) {
            return res.status(403).json({ error: 'Sem permissão para editar este formulário.' });
        }

        const { fields = [] } = req.body;
        console.log('>>> PAYLOAD DE CAMPOS RECEBIDO:', JSON.stringify(fields, null, 2));

        // IDs recebidos (campos que devem ser mantidos)
        const receivedIds = fields.filter(f => f.id).map(f => f.id);

        // Excluir campos que não estão no array recebido (foram removidos)
        await db.FormField.destroy({
            where: {
                form_id: formId,
                ...(receivedIds.length > 0 ? { id: { [db.Sequelize.Op.notIn]: receivedIds } } : {})
            }
        });

        // Upsert de cada campo recebido
        const savedFields = [];
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const fieldData = {
                form_id: formId,
                type: f.type,
                label: f.label || 'Campo sem título',
                placeholder: f.placeholder || null,
                required: !!f.required,
                default_value: f.default_value || null,
                help_text: f.help_text || null,
                options: (() => {
                    let opts = f.options;
                    // Desembrulha strings JSON aninhadas (defesa contra loops de escape)
                    while (typeof opts === 'string') {
                        try {
                            const parsed = JSON.parse(opts);
                            if (parsed === opts) break;
                            opts = parsed;
                        } catch {
                            break;
                        }
                    }
                    return opts || null;
                })(),
                position: i   // posição definida pela ordem do array
            };

            let field;
            if (f.id) {
                // Atualizar campo existente
                await db.FormField.update(fieldData, { where: { id: f.id, form_id: formId } });
                field = await db.FormField.findByPk(f.id);
            } else {
                // Criar novo campo
                field = await db.FormField.create(fieldData);
            }
            savedFields.push(field);
        }

        res.json({ message: 'Campos salvos com sucesso.', fields: savedFields });
    } catch (error) {
        console.error('Erro ao salvar campos:', error);
        res.status(500).json({ error: 'Erro ao salvar campos do formulário.' });
    }
};

/**
 * DELETE /api/forms/:id/fields/:fieldId
 * Remove um campo específico do formulário
 */
exports.deleteField = async (req, res) => {
    try {
        const form = await db.Form.findByPk(req.params.id);
        if (!form) return res.status(404).json({ error: 'Formulário não encontrado.' });

        if (req.userRole !== 'admin' && form.created_by !== req.userId) {
            return res.status(403).json({ error: 'Sem permissão para editar este formulário.' });
        }

        const deleted = await db.FormField.destroy({
            where: { id: req.params.fieldId, form_id: req.params.id }
        });

        if (!deleted) return res.status(404).json({ error: 'Campo não encontrado.' });

        res.json({ message: 'Campo removido com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir campo:', error);
        res.status(500).json({ error: 'Erro ao excluir campo.' });
    }
};
