// src/models/formResponse.js
// Model Sequelize para o cabeçalho de uma resposta a um formulário
// Uma FormResponse agrupa todas as FormAnswers de um envio

module.exports = (sequelize, DataTypes) => {
    const FormResponse = sequelize.define('FormResponse', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        // FK para forms.id
        form_id: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        // FK para users.id — null quando a resposta é anônima
        user_id: {
            type: DataTypes.BIGINT,
            allowNull: true
        },
        // Data e hora do envio
        submitted_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        // IP do respondente (para rastreabilidade de respostas anônimas)
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true
        },
        // Nome do respondente (obrigatório se não for anônimo)
        respondent_name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Documento de identificação: RA, DRT ou CPF (obrigatório se não for anônimo)
        respondent_identifier: {
            type: DataTypes.STRING(50),
            allowNull: true
        }
    }, {
        tableName: 'form_responses',
        underscored: true,
        timestamps: true
    });

    return FormResponse;
};
