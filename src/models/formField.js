// src/models/formField.js
// Model Sequelize para os campos de um formulário
// Suporta 16 tipos de campo, incluindo o tipo especial 'cha' (metodologia CHA)

module.exports = (sequelize, DataTypes) => {
    const FormField = sequelize.define('FormField', {
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
        // Tipo do campo — 16 tipos suportados:
        // short_text, long_text, number, date, time, email, phone,
        // radio, checkbox, select, file,
        // star_rating (1-4 estrelas), scale (0-10), yes_no, cha
        type: {
            type: DataTypes.ENUM(
                'short_text',
                'long_text',
                'number',
                'date',
                'time',
                'email',
                'phone',
                'radio',
                'checkbox',
                'select',
                'file',
                'star_rating',
                'scale',
                'yes_no',
                'cha'
            ),
            allowNull: false
        },
        // Rótulo exibido ao respondente
        label: {
            type: DataTypes.STRING(500),
            allowNull: false
        },
        // Placeholder do campo (opcional)
        placeholder: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // Campo obrigatório?
        required: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        // Valor padrão do campo (opcional)
        default_value: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        // Texto de ajuda exibido abaixo do campo
        help_text: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // Opções para radio, checkbox e select — armazenado como JSON
        // Exemplo: [{"label": "Opção A", "value": "A"}, ...]
        // Para tipo 'cha': armazena rótulos personalizados de C, H e A
        // Exemplo: {"c_label": "Conhecimento Excel", "h_label": "Uso Prático", "a_label": "Proatividade"}
        options: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                const rawValue = this.getDataValue('options');
                if (!rawValue) return null;
                try {
                    return typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
                } catch {
                    return rawValue;
                }
            },
            set(value) {
                this.setDataValue('options', value ? (typeof value === 'object' ? JSON.stringify(value) : value) : null);
            }
        },
        // Ordem de exibição do campo dentro do formulário
        position: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        tableName: 'form_fields',
        underscored: true,
        timestamps: true
    });

    return FormField;
};
