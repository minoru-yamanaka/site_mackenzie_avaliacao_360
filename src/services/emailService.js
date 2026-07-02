const nodemailer = require('nodemailer');

let transporter;

// Inicializa o transporte do Nodemailer
async function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // Se as credenciais de SMTP estiverem configuradas no .env, utiliza elas
    if (host && user && pass) {
        console.log(`[EmailService] SMTP configurado detectado. Usando host: ${host}`);
        transporter = nodemailer.createTransport({
            host: host,
            port: parseInt(port) || 587,
            secure: parseInt(port) === 465, // true para 465, false para outras portas
            auth: {
                user: user,
                pass: pass
            }
        });
    } else {
        // Caso contrário, cria uma conta de teste no Ethereal para fins de desenvolvimento
        console.warn('[EmailService] SMTP não configurado. Criando conta de teste temporária no Ethereal Email...');
        try {
            const testAccount = await nodemailer.createTestAccount();
            console.log(`[EmailService] Conta de teste criada no Ethereal. Usuário: ${testAccount.user}`);
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            
            // Armazena a conta de teste nas variáveis globais do serviço para expor a URL de visualização mais tarde
            transporter._isTestAccount = true;
        } catch (err) {
            console.error('[EmailService] Erro ao criar conta de teste do Ethereal:', err);
            throw err;
        }
    }

    return transporter;
}

/**
 * Envia um e-mail com a nota e o feedback para o aluno.
 * @param {Object} submission - Objeto da submissão contendo os dados do aluno e atividade.
 * @param {string} professorName - Nome do professor avaliador.
 */
async function sendGradeEmail(submission, professorName) {
    try {
        const client = await getTransporter();
        
        const studentName = submission.student_name;
        const studentEmail = submission.student_email;
        const protocol = submission.protocol || 'Não informado';
        const grade = submission.grade !== null && submission.grade !== undefined ? submission.grade : 'Sem Nota (Apenas Parecer)';
        const feedback = submission.feedback || 'Nenhum comentário adicional.';
        
        const subjectName = submission.subject ? submission.subject.name : 'Disciplina/Núcleo Geral';
        const activityType = submission.activityType ? submission.activityType.name : 'Atividade';

        const smtpFrom = process.env.SMTP_FROM || '"Portal de Atividades" <no-reply@exemplo.com>';

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body {
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                        background-color: #f8fafc;
                        color: #1e293b;
                        margin: 0;
                        padding: 0;
                        -webkit-font-smoothing: antialiased;
                    }
                    .container {
                        max-width: 600px;
                        margin: 20px auto;
                        background: #ffffff;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
                        border: 1px solid #e2e8f0;
                    }
                    .header {
                        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                        color: #ffffff;
                        padding: 30px;
                        text-align: center;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 24px;
                        font-weight: 700;
                        letter-spacing: -0.025em;
                    }
                    .header p {
                        margin: 5px 0 0 0;
                        font-size: 14px;
                        opacity: 0.9;
                    }
                    .content {
                        padding: 30px;
                    }
                    .student-greeting {
                        font-size: 18px;
                        font-weight: 600;
                        margin-top: 0;
                        margin-bottom: 20px;
                    }
                    .activity-card {
                        background-color: #f1f5f9;
                        border-radius: 8px;
                        padding: 20px;
                        margin-bottom: 25px;
                        border-left: 4px solid #3b82f6;
                    }
                    .activity-title {
                        font-weight: 700;
                        font-size: 16px;
                        margin-bottom: 10px;
                        color: #0f172a;
                    }
                    .activity-details {
                        font-size: 14px;
                        line-height: 1.6;
                        color: #475569;
                    }
                    .grade-box {
                        text-align: center;
                        margin: 25px 0;
                        padding: 20px;
                        background: #ecfdf5;
                        border: 1px solid #a7f3d0;
                        border-radius: 8px;
                    }
                    .grade-label {
                        font-size: 13px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: #065f46;
                        font-weight: 600;
                    }
                    .grade-value {
                        font-size: 36px;
                        font-weight: 800;
                        color: #047857;
                        margin-top: 5px;
                    }
                    .feedback-section {
                        border-top: 1px solid #e2e8f0;
                        padding-top: 20px;
                        margin-top: 20px;
                    }
                    .feedback-title {
                        font-size: 14px;
                        font-weight: 700;
                        color: #334155;
                        margin-bottom: 8px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .feedback-content {
                        font-size: 14px;
                        line-height: 1.6;
                        color: #334155;
                        font-style: italic;
                        background-color: #fafafa;
                        padding: 15px;
                        border-radius: 6px;
                        border: 1px solid #f1f5f9;
                    }
                    .footer {
                        background-color: #f8fafc;
                        padding: 20px 30px;
                        text-align: center;
                        border-top: 1px solid #e2e8f0;
                        font-size: 12px;
                        color: #64748b;
                        line-height: 1.5;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Avaliação Disponível</h1>
                        <p>Portal de Envio de Atividades Acadêmicas</p>
                    </div>
                    <div class="content">
                        <div class="student-greeting">Olá, ${studentName}!</div>
                        <p>A sua atividade enviada ao portal foi avaliada pelo(a) professor(a) <strong>${professorName}</strong>.</p>
                        
                        <div class="activity-card">
                            <div class="activity-title">${activityType} - ${subjectName}</div>
                            <div class="activity-details">
                                <strong>Código do Protocolo:</strong> ${protocol}<br>
                                <strong>Data de Envio:</strong> ${new Date(submission.createdAt || new Date()).toLocaleDateString('pt-BR')}<br>
                            </div>
                        </div>

                        <div class="grade-box">
                            <div class="grade-label">Parecer / Nota Obtida</div>
                            <div class="grade-value">${grade}</div>
                        </div>

                        <div class="feedback-section">
                            <div class="feedback-title">Comentários do Docente:</div>
                            <div class="feedback-content">${feedback.replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                    <div class="footer">
                        Este é um e-mail automático enviado pelo Portal de Envio de Atividades.<br>
                        Por favor, não responda a esta mensagem. Para dúvidas, contate o professor responsável.
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: smtpFrom,
            to: studentEmail,
            subject: `[Portal de Atividades] Nota Disponível: ${activityType} - ${subjectName}`,
            html: htmlContent
        };

        const info = await client.sendMail(mailOptions);
        console.log(`[EmailService] E-mail de nota enviado para ${studentEmail}. MessageId: ${info.messageId}`);
        
        if (client._isTestAccount) {
            // Se for Ethereal, loga o link para o usuário visualizar o e-mail no terminal
            console.log(`[EmailService] [Ethereal Test] Visualize o e-mail enviado em: ${nodemailer.getTestMessageUrl(info)}`);
        }

        return true;
    } catch (err) {
        console.error(`[EmailService] Erro ao enviar e-mail de nota para o aluno da submissão ID ${submission.id}:`, err);
        throw err;
    }
}

module.exports = {
    sendGradeEmail
};
