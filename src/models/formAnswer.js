// src/models/formAnswer.js
// Model Sequelize para cada resposta individual a um campo do formulário
// Cada FormAnswer corresponde a um campo (FormField) dentro de uma resposta (FormResponse)

module.exports = (sequelize, DataTypes) => {
    const FormAnswer = sequelize.define('FormAnswer', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        // FK para form_responses.id
        response_id: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        // FK para form_fields.id
        field_id: {
            type: DataTypes.BIGINT,
            allowNull: false
        },
        // Valor da resposta em texto
        // Para campos simples: string direta ("João", "42", "2024-01-15")
        // Para checkbox: JSON array ["opção A", "opção B"]
        // Para star_rating: "3" (número de 1 a 4)
        // Para yes_no: "sim" ou "não"
        // Para cha: JSON com cálculo da média (calculada no backend):
        //   {"c": 7.5, "h": 5.0, "a": 10.0, "media": 7.5}
        value: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Caminho do arquivo no servidor (usado quando field.type === 'file')
        file_path: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Nome original do arquivo enviado
        original_filename: {
            type: DataTypes.STRING(255),
            allowNull: true
        }
    }, {
        tableName: 'form_answers',
        underscored: true,
        timestamps: true
    });

    return FormAnswer;
};
