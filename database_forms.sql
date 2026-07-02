-- ============================================================
-- database_forms.sql
-- Script de migração para o módulo de Formulários Dinâmicos
-- Execute após o database.sql existente
-- O Sequelize cria as tabelas automaticamente via sync(),
-- mas este script serve como referência e para servidores de produção
-- ============================================================

-- Tabela: forms
CREATE TABLE IF NOT EXISTS `forms` (
    `id`                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `title`               VARCHAR(255) NOT NULL,
    `description`         TEXT NULL,
    `status`              ENUM('draft','published') NOT NULL DEFAULT 'draft',
    `allow_anonymous`     TINYINT(1) NOT NULL DEFAULT 0,
    `deadline`            DATETIME NULL,
    `allow_edit_response` TINYINT(1) NOT NULL DEFAULT 0,
    `created_by`          BIGINT UNSIGNED NOT NULL,
    `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_forms_created_by` (`created_by`),
    INDEX `idx_forms_status` (`status`),
    CONSTRAINT `fk_forms_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: form_fields
-- Armazena os campos de cada formulário (16 tipos suportados)
CREATE TABLE IF NOT EXISTS `form_fields` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `form_id`       BIGINT UNSIGNED NOT NULL,
    `type`          ENUM(
                        'short_text','long_text','number','date','time',
                        'email','phone','radio','checkbox','select',
                        'file','star_rating','scale','yes_no','cha'
                    ) NOT NULL,
    `label`         VARCHAR(500) NOT NULL,
    `placeholder`   VARCHAR(255) NULL,
    `required`      TINYINT(1) NOT NULL DEFAULT 0,
    `default_value` VARCHAR(500) NULL,
    `help_text`     TEXT NULL,
    -- JSON para radio/checkbox/select: [{"label":"Opção A","value":"A"}]
    -- JSON para cha: {"c_label":"Competência","h_label":"Habilidade","a_label":"Atitude"}
    `options`       JSON NULL,
    `position`      INT NOT NULL DEFAULT 0,
    `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_form_fields_form_id` (`form_id`),
    INDEX `idx_form_fields_position` (`position`),
    CONSTRAINT `fk_form_fields_form` FOREIGN KEY (`form_id`) REFERENCES `forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: form_responses
-- Cabeçalho de cada submissão (agrupa as respostas individuais)
CREATE TABLE IF NOT EXISTS `form_responses` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `form_id`      BIGINT UNSIGNED NOT NULL,
    -- Null para respostas anônimas
    `user_id`      BIGINT UNSIGNED NULL,
    `submitted_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `ip_address`   VARCHAR(45) NULL,
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_form_responses_form_id` (`form_id`),
    INDEX `idx_form_responses_user_id` (`user_id`),
    INDEX `idx_form_responses_submitted_at` (`submitted_at`),
    CONSTRAINT `fk_form_responses_form` FOREIGN KEY (`form_id`) REFERENCES `forms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: form_answers
-- Resposta individual de cada campo em uma submissão
-- Para tipo 'cha': value armazena JSON {"c":7.5,"h":5.0,"a":10.0,"media":7.5}
-- Para tipo 'checkbox': value armazena JSON array ["opção A","opção B"]
-- Para tipo 'file': value armazena o nome do arquivo, file_path armazena o caminho
CREATE TABLE IF NOT EXISTS `form_answers` (
    `id`                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `response_id`       BIGINT UNSIGNED NOT NULL,
    `field_id`          BIGINT UNSIGNED NOT NULL,
    `value`             TEXT NULL,
    `file_path`         VARCHAR(500) NULL,
    `original_filename` VARCHAR(255) NULL,
    `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_form_answers_response_id` (`response_id`),
    INDEX `idx_form_answers_field_id` (`field_id`),
    CONSTRAINT `fk_form_answers_response` FOREIGN KEY (`response_id`) REFERENCES `form_responses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DADOS DE EXEMPLO (opcional — remova em produção)
-- ============================================================

-- Exemplo de formulário CHA de avaliação
-- INSERT INTO forms (title, description, status, allow_anonymous, created_by)
-- VALUES ('Avaliação CHA - Turma A', 'Avalie os alunos usando a metodologia CHA', 'published', 0, 1);

-- Exemplo de campo CHA
-- INSERT INTO form_fields (form_id, type, label, required, options, position)
-- VALUES (1, 'cha', 'Avalie o aluno: João Silva', 1,
--   '{"c_label":"Conhecimento técnico","h_label":"Aplicação prática","a_label":"Proatividade"}', 0);
