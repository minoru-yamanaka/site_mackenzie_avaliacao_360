const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const publicController = require('../controllers/publicController');
const professorController = require('../controllers/professorController');
const adminController = require('../controllers/adminController');
const formController = require('../controllers/formController');

const { verifyToken, isAdmin, isProfessor } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

// === ROTAS PÚBLICAS ===
router.get('/ping', (req, res) => res.json({ message: 'Servidor Online' }));
router.post('/login', authController.login);
router.get('/public/forms', formController.getPublicForms);
router.get('/public/subjects', publicController.getSubjects);
router.get('/public/notices', publicController.getNotices);
router.get('/public/notices/:id/download', publicController.downloadNoticeAttachment);
router.get('/public/classes', publicController.getClasses);
router.get('/public/activity-types', publicController.getActivityTypes);
router.get('/public/subjects/:subjectId/professors', publicController.getProfessorsBySubject);
router.post('/public/submissions', upload.single('file'), publicController.submitWork);
router.post('/public/submissions/query', publicController.queryStudentSubmissions);
router.get('/public/submissions/:id/download', publicController.downloadSubmissionAttachment);
router.post('/public/messages', publicController.sendStudentMessage);
router.get('/public/professors', publicController.getProfessors);

// === ROTAS DO PROFESSOR ===
router.get('/professor/submissions', verifyToken, isProfessor, professorController.getMySubmissions);
router.get('/submissions/history/:drt', verifyToken, isProfessor, professorController.getStudentHistoryByDrt);
router.put('/professor/submissions/:id/grade', verifyToken, isProfessor, professorController.updateGradeFeedback);
router.patch('/professor/submissions/:id/toggle', verifyToken, isProfessor, professorController.toggleStatus);
router.get('/submissions/:id/download', verifyToken, isProfessor, professorController.downloadFile); // professor ou admin
router.post('/submissions/batch-download', verifyToken, isProfessor, professorController.batchDownload); // professor ou admin
router.post('/submissions/batch-send-emails', verifyToken, isProfessor, professorController.batchSendEmails); // professor ou admin
router.get('/export-excel', verifyToken, isProfessor, adminController.exportExcel); // professor ou admin

// === ROTAS COMUNS AUTENTICADAS ===
router.put('/profile', verifyToken, authController.updateProfile);
router.get('/common/users', verifyToken, adminController.getUsers);

// === ROTAS DO ADMIN (MASTER) ===
router.get('/admin/users', verifyToken, isAdmin, adminController.getUsers);
router.post('/admin/users', verifyToken, isAdmin, adminController.createUser);
router.put('/admin/users/:id', verifyToken, isAdmin, adminController.updateUser);
router.delete('/admin/users/:id', verifyToken, isAdmin, adminController.deleteUser);
router.patch('/admin/users/:id/toggle-block', verifyToken, isAdmin, adminController.toggleUserBlock);
router.get('/admin/student-messages', verifyToken, adminController.getStudentMessages);
router.patch('/admin/student-messages/:id/read', verifyToken, adminController.markStudentMessageAsRead);
router.delete('/admin/student-messages/:id', verifyToken, adminController.deleteStudentMessage);
router.put('/admin/student-messages/:id/note', verifyToken, isAdmin, adminController.updateStudentMessageNote);



router.get('/admin/submissions', verifyToken, isAdmin, adminController.getAllSubmissions);
router.put('/admin/submissions/:id', verifyToken, isAdmin, adminController.updateSubmission);
router.delete('/admin/submissions/:id', verifyToken, isAdmin, adminController.deleteSubmission);
router.post('/admin/submissions/batch-delete', verifyToken, isAdmin, adminController.batchDeleteSubmissions);
router.post('/admin/submissions/batch-delete-files', verifyToken, isAdmin, adminController.batchDeleteFiles);

router.get('/admin/notices', verifyToken, isProfessor, adminController.getNotices);
router.post('/admin/notices', verifyToken, isProfessor, upload.single('file'), adminController.createNotice);
router.put('/admin/notices/:id', verifyToken, isProfessor, upload.single('file'), adminController.updateNotice);
router.delete('/admin/notices/:id', verifyToken, isProfessor, adminController.deleteNotice);

// === EXPORT/IMPORT ===
router.get('/admin/export/users', verifyToken, isAdmin, adminController.exportUsers);
router.post('/admin/import/users', verifyToken, isAdmin, upload.single('file'), adminController.importUsers);




// ============================================================
// MÓDULO DE FORMULÁRIOS DINÂMICOS
// Adicionado para a plataforma Google Forms corporativo
// Reutiliza: verifyToken, isProfessor, isAdmin, upload
// ============================================================
const formFieldController = require('../controllers/formFieldController');

// Dashboard de formulários
router.get('/dashboard/forms', verifyToken, formController.getDashboard);

// CRUD de formulários
router.get('/forms',                        verifyToken,              formController.getForms);
router.get('/forms/:id',                    verifyToken,              formController.getFormById);
router.post('/forms',                       verifyToken, isProfessor, formController.createForm);
router.put('/forms/:id',                    verifyToken, isProfessor, formController.updateForm);
router.delete('/forms/:id',                 verifyToken, isProfessor, formController.deleteForm);
router.post('/forms/:id/duplicate',         verifyToken, isProfessor, formController.duplicateForm);
router.patch('/forms/:id/publish',          verifyToken, isProfessor, formController.togglePublish);

// Campos do formulário
router.get('/forms/:id/fields',             verifyToken,              formFieldController.getFields);
router.post('/forms/:id/fields',            verifyToken, isProfessor, formFieldController.saveFields);
router.delete('/forms/:id/fields/:fieldId', verifyToken, isProfessor, formFieldController.deleteField);

// Submissão (pública — sem verifyToken para aceitar anônimos)
router.post('/forms/:id/submit', upload.fields([{ name: 'files', maxCount: 10 }]), formController.submitForm);

// Respostas (restrito ao criador ou admin)
router.get('/forms/:id/responses',          verifyToken, isProfessor, formController.getResponses);
router.post('/forms/:id/responses/batch-delete', verifyToken, isProfessor, formController.batchDeleteResponses);

// Exportações
router.get('/forms/:id/export/excel',       verifyToken, isProfessor, formController.exportExcel);
router.get('/forms/:id/export/csv',         verifyToken, isProfessor, formController.exportCsv);
router.get('/forms/:id/export/zip',         verifyToken, isProfessor, formController.exportZip);

// Catch-all para rotas não encontradas (evita retorno de HTML 404)
router.use((req, res) => {
    console.warn(`[404] Rota não encontrada: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

module.exports = router;
