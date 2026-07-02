// src/models/form.js
// Model Sequelize para formulários dinâmicos
// Criado para o módulo de Plataforma de Formulários (Google Forms corporativo)

module.exports = (sequelize, DataTypes) => {
    const Form = sequelize.define('Form', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        // Título do formulário (obrigatório)
        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        // Descrição/instruções exibidas ao respondente
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Status: 'draft' (rascunho) ou 'published' (publicado)
        status: {
            type: DataTypes.ENUM('draft', 'published'),
            defaultValue: 'draft',
            allowNull: false
        },
        // Permite respostas sem autenticação (anônimas)
        allow_anonymous: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        // Quem está avaliando (ex: Aluno, Professor, Preceptor, Todos)
        evaluator_type: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: 'Aluno / Discente'
        },
        // Quem está sendo avaliado (ex: O próprio Aluno, Professor, Preceptor, Colega)
        evaluated_type: {
            type: DataTypes.STRING(255),
            allowNull: true,
            defaultValue: 'Professor / Docente'
        },
        // Prazo de abertura do formulário (null = aberto imediatamente)
        start_date: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Prazo para encerramento das respostas (null = sem prazo)
        deadline: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Permite que o respondente edite sua própria resposta após envio
        allow_edit_response: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        // FK para users.id — quem criou o formulário
        created_by: {
            type: DataTypes.BIGINT,
            allowNull: false
        }
    }, {
        tableName: 'forms',
        underscored: true,
        timestamps: true   // created_at e updated_at gerados automaticamente
    });

    return Form;
};
