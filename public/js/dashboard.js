document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = '/login.html';
        return;
    }

    // Header Init — usa optional chaining pois o navbar.js pode substituir esses elementos
    document.getElementById('userNameDisplay')?.textContent && (document.getElementById('userNameDisplay').textContent = user.name);
    document.getElementById('userRoleTitle')?.textContent && (document.getElementById('userRoleTitle').textContent = user.role === 'admin' ? 'Master Admin' : 'Portal do Professor');
    document.getElementById('adminMenu')?.classList.remove('hidden');

    // Exibe ou oculta elementos baseados na role
    if (user.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    } else {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
    }

    const alertDiv = document.getElementById('alertMessage');
    function showAlert(msg, type) {
        alertDiv.textContent = msg;
        alertDiv.className = `alert alert-${type} show`;
        setTimeout(() => alertDiv.classList.remove('show'), 3000);
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // API Helper
    async function apiFetch(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        // Garante que a URL seja absoluta em relação à raiz do servidor
        const absoluteUrl = url.startsWith('http') ? url : window.location.origin + (url.startsWith('/') ? url : '/' + url);
        const res = await fetch(absoluteUrl, { ...options, headers });
        
        if (!res.ok) {
            let errorMsg = 'Erro na requisição';
            try {
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const err = await res.json();
                    errorMsg = err.error || errorMsg;
                } else {
                    errorMsg = `Erro ${res.status}: O servidor retornou uma página inesperada.`;
                }
            } catch (e) {
                errorMsg = `Erro ${res.status}`;
            }
            throw new Error(errorMsg);
        }

        if (options.isDownload) return res.blob();
        
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return res.json();
        }
        return res;
    }

    // Export/Import Helpers
    window.exportData = async (type) => {
        try {
            const blob = await apiFetch(`/api/admin/export/${type}`, { isDownload: true });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) { showAlert(error.message, 'danger'); }
    };

    window.importData = async (type, input) => {
        if (!input.files[0]) return;
        const formData = new FormData();
        formData.append('file', input.files[0]);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/import/${type}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Erro na importação');
            showAlert(result.message, 'success');
            
            // Recarregar dados da seção
            if (type === 'users') loadUsers();
            if (type === 'subjects') loadSubjects();
            if (type === 'classes') loadClasses();
            if (type === 'assigns') loadAssignsData();
            
            input.value = ''; // Reset input
        } catch (error) { showAlert(error.message, 'danger'); }
    };

    // Configurar seletor de e-mail com a preferência salva
    const emailClientSelect = document.getElementById('preferredEmailClient');
    if (emailClientSelect) {
        const savedClient = localStorage.getItem('preferredEmailClient') || 'gmail';
        emailClientSelect.value = savedClient;
        
        emailClientSelect.addEventListener('change', (e) => {
            localStorage.setItem('preferredEmailClient', e.target.value);
            showAlert(`Preferência de e-mail atualizada para: ${e.target.options[e.target.selectedIndex].text}`, 'success');
        });
    }

    function getEmailDetails(sub, professorName) {
        const studentName = sub.student_name;
        const studentEmail = sub.student_email;
        const protocol = sub.protocol || 'Não informado';
        const grade = sub.grade !== null && sub.grade !== undefined ? sub.grade : 'Sem Nota (Apenas Parecer)';
        const feedback = sub.feedback || 'Nenhum comentário adicional.';
        
        const subjectName = sub.subject ? sub.subject.name : 'Disciplina/Núcleo Geral';
        const activityType = sub.activityType ? sub.activityType.name : 'Atividade';

        const subject = `[Portal de Atividades] Nota Disponível: ${activityType} - ${subjectName}`;
        
        const body = `Olá, ${studentName}!

A sua atividade enviada ao portal foi avaliada pelo(a) professor(a) ${professorName}.

Atividade: ${activityType} - ${subjectName}
Código do Protocolo: ${protocol}
Data de Envio: ${new Date(sub.createdAt || sub.created_at || new Date()).toLocaleDateString('pt-BR')}

Parecer / Nota Obtida: ${grade}

Comentários do Docente:
${feedback}

Atenciosamente,
Portal de Atividades`;

        return { email: studentEmail, subject, body };
    }

    function openEmailClient(sub, clientType, professorName) {
        const { email, subject, body } = getEmailDetails(sub, professorName);
        
        const encEmail = encodeURIComponent(email);
        const encSubject = encodeURIComponent(subject);
        const encBody = encodeURIComponent(body);

        let url = '';
        if (clientType === 'gmail') {
            url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encEmail}&su=${encSubject}&body=${encBody}`;
        } else if (clientType === 'outlook') {
            url = `https://outlook.live.com/mail/0/deeplink/compose?to=${encEmail}&subject=${encSubject}&body=${encBody}`;
        } else {
            // Local mailto
            url = `mailto:${encEmail}?subject=${encSubject}&body=${encBody}`;
        }

        window.open(url, '_blank');
    }

    // Navigation Logic
    const views = {
        navSubmissions: document.getElementById('viewSubmissions'),
        navUsers: document.getElementById('viewUsers'),
        navNotices: document.getElementById('viewNotices'),
        navProfile: document.getElementById('viewProfile'),
        navStudentMessages: document.getElementById('viewStudentMessages')
    };

    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        // Remove existing overlay if any
        hideModal(modalId);

        const overlay = document.createElement('div');
        overlay.className = 'modal-open-overlay';
        overlay.id = modalId + '-overlay';
        overlay.onclick = () => hideModal(modalId);
        document.body.appendChild(overlay);
        
        modal.classList.remove('hidden');
    }

    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
        
        const overlay = document.getElementById(modalId + '-overlay');
        if (overlay) overlay.remove();
    }

    function switchView(viewId) {
        Object.keys(views).forEach(key => {
            if (views[key]) views[key].classList.add('hidden');
            const navLink = document.getElementById(key);
            if (navLink) navLink.classList.remove('active');
        });
        const targetView = document.getElementById(`view${viewId.replace('nav', '')}`);
        if (targetView) targetView.classList.remove('hidden');
        const targetLink = document.getElementById(viewId);
        if (targetLink) targetLink.classList.add('active');
        
        // Fechar todos os overlays de modal
        document.querySelectorAll('.modal-open-overlay').forEach(el => el.remove());
        document.querySelectorAll('.card').forEach(el => {
            if (el.id.includes('Modal')) el.classList.add('hidden');
        });
    }

    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href !== '#' && href !== '') {
                return;
            }
            e.preventDefault();
            switchView(e.target.id);
            if (e.target.id === 'navSubmissions') loadSubmissions();
            if (e.target.id === 'navUsers') loadUsers();
            if (e.target.id === 'navNotices') loadNotices();
            if (e.target.id === 'navProfile') loadProfile();
            if (e.target.id === 'navStudentMessages') loadStudentMessages();
        });
    });

    // O navbar.js usa id="navLogoutBtn"; o HTML estático usa id="logoutBtn" — suporta ambos
    const logoutBtn = document.getElementById('navLogoutBtn') || document.getElementById('logoutBtn');
    logoutBtn?.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/login.html';
    });

    // === SUBMISSÕES ===
    let currentSubmissions = [];
    async function loadSubmissions() {
        try {
            const url = user.role === 'admin' ? '/api/admin/submissions' : '/api/professor/submissions';
            const data = await apiFetch(url);
            currentSubmissions = data;
            
            // Popular filtro de Núcleos (apenas uma vez ou quando carregar)
            const subjectFilter = document.getElementById('filterSubmissionsSubject');
            if (subjectFilter && subjectFilter.options.length === 1) {
                const subjects = await apiFetch('/api/public/subjects');
                subjects.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    subjectFilter.appendChild(opt);
                });
            }

            // Popular filtro de Tipos de Atividade (apenas uma vez ou quando carregar)
            const typeFilter = document.getElementById('filterSubmissionsActivityType');
            if (typeFilter && typeFilter.options.length === 1) {
                const types = await apiFetch('/api/public/activity-types');
                types.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.id;
                    opt.textContent = t.name;
                    typeFilter.appendChild(opt);
                });
            }

            renderSubmissions(currentSubmissions);
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    }
    
    function renderSubmissions(subs) {
        const tbody = document.querySelector('#submissionsTable tbody');
        tbody.innerHTML = '';
        const isAdmin = user.role === 'admin';
        const isProfessor = user.role === 'professor';
        const canSelect = isAdmin || isProfessor;
        
        const thCheckbox = document.getElementById('thSelectAllSubs');
        if (thCheckbox) thCheckbox.style.display = canSelect ? '' : 'none';
        
        subs.forEach(sub => {
            const tr = document.createElement('tr');
            
            let checkboxTd = '';
            if (canSelect) {
                if (sub.isFormResponse) {
                    checkboxTd = `<td><input type="checkbox" disabled style="opacity: 0.5;"></td>`;
                } else {
                    checkboxTd = `<td><input type="checkbox" class="sub-checkbox" value="${sub.id}"></td>`;
                }
            } else {
                checkboxTd = '<td style="display:none;"></td>';
            }
            
            let downloadBtn = '';
            if (sub.isFormResponse) {
                downloadBtn = `<span style="color: var(--text-muted); font-size: 0.82rem;">Sem anexo (Formulário)</span>`;
            } else if (sub.file_path) {
                downloadBtn = `
                    <button class="btn btn-secondary btn-sm" onclick="downloadFile(${sub.id}, '${sub.original_filename}')">Download</button>
                    <button class="btn btn-primary btn-sm" onclick="viewFile(${sub.id}, '${sub.original_filename}')">Visualizar</button>
                `;
            } else {
                downloadBtn = `<button class="btn btn-danger btn-sm" disabled>Anexo excluído</button>`;
            }

            let detailBtn = sub.isFormResponse
                ? `<button class="btn btn-primary btn-sm" onclick="openGradeModal('${sub.id}')">Ver Respostas</button>`
                : `<button class="btn btn-primary btn-sm" onclick="openGradeModal(${sub.id})">${isAdmin ? 'Ver/Responder' : 'Avaliar'}</button>`;
            
            let toggleBtn = '';
            let gradeInput = '';
            let sendEmailBtn = '';
            
            if (sub.isFormResponse) {
                toggleBtn = `<span class="badge badge-resolved" style="background-color: var(--primary); color: white; display: inline-block;">Formulário</span>`;
                gradeInput = `<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>`;
                sendEmailBtn = `<span style="color: var(--text-muted); font-size: 0.85rem;">—</span>`;
            } else {
                toggleBtn = sub.status === 'Concluído'
                    ? `<button class="btn btn-warning btn-sm" onclick="toggleStatus(${sub.id})">Reabrir</button>`
                    : `<button class="btn btn-secondary btn-sm" onclick="toggleStatus(${sub.id})">Concluir</button>`;
                
                const gradeVal = sub.grade !== null ? sub.grade : '';
                gradeInput = `
                    <input type="number" step="0.1" min="0" max="10" placeholder="Nota" value="${gradeVal}" 
                        style="width: 65px; text-align: center; border: 1px solid var(--border); border-radius: var(--radius); padding: 0.25rem; font-size: 0.85rem;"
                        onchange="updateGradeQuick(${sub.id}, this.value)">
                `;

                if (sub.grade === null || sub.grade === undefined) {
                    sendEmailBtn = `<button class="btn btn-secondary btn-sm" style="background-color: #cbd5e1; border: none; color: #64748b; cursor: not-allowed;" disabled title="Cadastre a nota primeiro para poder enviar">📧 Enviar Nota</button>`;
                } else {
                    sendEmailBtn = `<button class="btn btn-info btn-sm" style="background-color: #17a2b8; color: white; border: none;" onclick="sendGradeEmailSingle(${sub.id})">📧 Enviar Nota</button>`;
                }
            }

            let adminActions = isAdmin ? (
                sub.isFormResponse 
                    ? `<button class="btn btn-danger btn-sm" onclick="deleteFormResponse('${sub.id}')">Apagar</button>`
                    : `
                        <button class="btn btn-primary btn-sm" onclick="openEditSubmissionModal(${sub.id})">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSubmission(${sub.id})">Apagar</button>
                        <span style="font-size: 0.8rem; margin-left: 0.5rem; color: var(--text-muted);">Prof: ${sub.professor ? sub.professor.name : '-'}</span>
                    `
            ) : '';

            let emailSentBadge = '';
            if (!sub.isFormResponse && sub.grade !== null && sub.grade !== undefined) {
                if (sub.grade_sent) {
                    emailSentBadge = `<span class="badge" style="background-color: #10b981; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; margin-top: 3px;" title="Nota enviada ao aluno por e-mail">✉️ Enviado</span>`;
                } else {
                    emailSentBadge = `<span class="badge" style="background-color: #64748b; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; margin-top: 3px;" title="Nota ainda não enviada">✉️ Não enviado</span>`;
                }
            }

            tr.innerHTML = `
                ${checkboxTd}
                <td>${sub.protocol || '-'}</td>
                <td>
                    <div class="d-flex flex-column gap-2" style="align-items: flex-start;">
                        <span class="badge ${sub.status === 'Concluído' ? 'badge-resolved' : 'badge-pending'}">
                            ${sub.status || 'Em Andamento'}
                        </span>
                        ${emailSentBadge}
                    </div>
                </td>

                <td><a href="/consulta.html?drt=${encodeURIComponent(sub.student_drt)}" target="_blank" style="text-decoration: underline; color: var(--primary); font-weight: 500;">${sub.student_name} (${sub.student_drt})</a></td>
                <td>${sub.student_class}</td>
                <td>${sub.subject ? sub.subject.name : '-'}</td>
                <td>${sub.activityType ? sub.activityType.name : '-'}</td>
                <td>
                    <div class="d-flex gap-2 align-center flex-wrap">
                        ${gradeInput}
                        ${toggleBtn}
                        ${sendEmailBtn}
                        ${downloadBtn}
                        ${detailBtn}
                        ${adminActions}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        updateBatchActionsUI();
    }

    // Filtros
    function applySubmissionsFilters() {
        const text = document.getElementById('filterSubmissionsText')?.value.toLowerCase() || '';
        const start = document.getElementById('filterSubmissionsStart')?.value;
        const end = document.getElementById('filterSubmissionsEnd')?.value;
        const status = document.getElementById('filterSubmissionsStatus')?.value;
        const subjectId = document.getElementById('filterSubmissionsSubject')?.value;
        const activityTypeId = document.getElementById('filterSubmissionsActivityType')?.value;

        const filtered = currentSubmissions.filter(sub => {
            const matchesText = sub.student_name.toLowerCase().includes(text) || 
                                sub.student_drt.toLowerCase().includes(text) || 
                                sub.student_class.toLowerCase().includes(text) ||
                                (sub.protocol && sub.protocol.toLowerCase().includes(text)) ||
                                (sub.subject && sub.subject.name.toLowerCase().includes(text));
            
            let matchesDate = true;
            const subDate = new Date(sub.createdAt);
            subDate.setHours(0, 0, 0, 0);

            if (start) {
                const startDate = new Date(start + 'T00:00:00');
                if (subDate < startDate) matchesDate = false;
            }
            if (end) {
                const endDate = new Date(end + 'T00:00:00');
                if (subDate > endDate) matchesDate = false;
            }

            const matchesStatus = !status || sub.status === status;
            const matchesSubject = !subjectId || String(sub.subject_id) === String(subjectId);
            const matchesActivityType = !activityTypeId || String(sub.activity_type_id) === String(activityTypeId);

            return matchesText && matchesDate && matchesStatus && matchesSubject && matchesActivityType;
        });

        renderSubmissions(filtered);
    }

    document.getElementById('filterSubmissionsText')?.addEventListener('input', applySubmissionsFilters);
    document.getElementById('filterSubmissionsStatus')?.addEventListener('change', applySubmissionsFilters);
    document.getElementById('filterSubmissionsSubject')?.addEventListener('change', applySubmissionsFilters);
    document.getElementById('filterSubmissionsActivityType')?.addEventListener('change', applySubmissionsFilters);
    document.getElementById('filterSubmissionsStart')?.addEventListener('change', applySubmissionsFilters);
    document.getElementById('filterSubmissionsEnd')?.addEventListener('change', applySubmissionsFilters);

    // Lógica de Checkbox e Lote
    function updateBatchActionsUI() {
        const isAdmin = user.role === 'admin';
        const isProfessor = user.role === 'professor';
        if (!isAdmin && !isProfessor) return;

        const checkboxes = document.querySelectorAll('.sub-checkbox');
        const checkedCount = document.querySelectorAll('.sub-checkbox:checked').length;
        const container = document.getElementById('batchActionsContainer');
        const selectAll = document.getElementById('selectAllSubs');
        
        if (selectAll) {
            selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
        }

        if (container) {
            document.getElementById('selectedCount').textContent = checkedCount;
            if (checkedCount > 0) {
                container.classList.remove('hidden');
                
                // Controlar botões administrativos e pedagógicos
                const btnDeleteFiles = document.getElementById('batchDeleteFilesBtn');
                const btnDeleteSubs = document.getElementById('batchDeleteSubsBtn');
                const btnSendEmails = document.getElementById('batchSendEmailBtn');
                
                if (btnDeleteFiles) {
                    if (isAdmin) btnDeleteFiles.style.display = '';
                    else btnDeleteFiles.style.display = 'none';
                }
                
                if (btnDeleteSubs) {
                    if (isAdmin) btnDeleteSubs.style.display = '';
                    else btnDeleteSubs.style.display = 'none';
                }

                if (btnSendEmails) {
                    btnSendEmails.style.display = '';
                }
            } else {
                container.classList.add('hidden');
            }
        }
    }

    document.getElementById('submissionsTable')?.addEventListener('change', (e) => {
        if (e.target.id === 'selectAllSubs') {
            const isChecked = e.target.checked;
            document.querySelectorAll('.sub-checkbox').forEach(cb => cb.checked = isChecked);
        } else if (e.target.classList.contains('sub-checkbox')) {
            // just update UI
        }
        updateBatchActionsUI();
    });

    function getSelectedIds() {
        return Array.from(document.querySelectorAll('.sub-checkbox:checked')).map(cb => cb.value);
    }

    document.getElementById('batchDownloadBtn')?.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        
        showAlert('Preparando o download em lote... Por favor, aguarde alguns instantes.', 'info');
        const btn = document.getElementById('batchDownloadBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '📥 Baixando...';

        try {
            const blob = await apiFetch('/api/submissions/batch-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids }),
                isDownload: true
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'atividades.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showAlert('Download em lote iniciado com sucesso!', 'success');
        } catch (error) {
            showAlert(error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });

    document.getElementById('batchDownloadIgnoreEmptyBtn')?.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        
        showAlert('Preparando o download com anexo em lote... Por favor, aguarde alguns instantes.', 'info');
        const btn = document.getElementById('batchDownloadIgnoreEmptyBtn');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '📥 Baixando...';

        try {
            const blob = await apiFetch('/api/submissions/batch-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, ignoreEmpty: true }),
                isDownload: true
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'atividades_com_anexo.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showAlert('Download dos arquivos com anexo iniciado com sucesso!', 'success');
        } catch (error) {
            showAlert(error.message, 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });

    document.getElementById('batchSendEmailBtn')?.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;
        
        const clientType = localStorage.getItem('preferredEmailClient') || 'gmail';
        const clientText = clientType === 'gmail' ? 'Gmail Web' : (clientType === 'outlook' ? 'Outlook Web' : 'Outlook / App Local');
        
        if (!confirm(`Deseja abrir o ${clientText} para enviar as notas dos ${ids.length} aluno(s) selecionado(s)?\nApenas alunos com notas cadastradas serão processados.`)) return;

        try {
            const res = await apiFetch('/api/submissions/batch-send-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });

            showAlert(res.message, 'success');

            if (res.submissions && res.submissions.length > 0) {
                // Abre cada aba de e-mail sequencialmente com um pequeno atraso de 350ms para contornar o bloqueio de popups
                res.submissions.forEach((sub, index) => {
                    setTimeout(() => {
                        openEmailClient(sub, clientType, res.professor_name);
                    }, index * 350);
                });
            }
            
            loadSubmissions();
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    });

    document.getElementById('batchExportExcelBtn')?.addEventListener('click', () => {
        const ids = getSelectedIds();
        if (ids.length === 0) return;

        const idsSet = new Set(ids.map(id => Number(id)));
        const selectedSubmissions = currentSubmissions.filter(sub => idsSet.has(sub.id));

        if (selectedSubmissions.length === 0) {
            alert('Nenhuma atividade correspondente encontrada.');
            return;
        }

        // Mapear dados para o formato amigável no Excel
        const dataToExport = selectedSubmissions.map(sub => {
            const date = new Date(sub.createdAt || sub.created_at).toLocaleString('pt-BR');
            const subjectName = sub.subject?.name || 'Geral';
            const professorName = sub.professor?.name || 'Não atribuído';
            const actTypeName = sub.activityType?.name || '—';
            const className = sub.student_class || sub.class?.name || '—';
            const statusLabel = sub.status || 'Em Andamento';
            
            let gradeDisplay = 'Aguardando';
            if (sub.grade !== null && sub.grade !== undefined) {
                gradeDisplay = parseFloat(sub.grade);
            }

            const feedbackText = sub.feedback && sub.feedback.trim() ? sub.feedback : '—';
            const studentMessage = sub.message && sub.message.trim() ? sub.message : '—';

            return {
                'Protocolo': sub.protocol || '—',
                'Aluno': sub.student_name,
                'DRT': sub.student_drt,
                'Semestre': className,
                'Arquivo Anexo': sub.original_filename && sub.file_path ? sub.original_filename : 'Sem anexo',
                'Data de Envio': date,
                'Disciplina': subjectName,
                'Tipo de Atividade': actTypeName,
                'Status': statusLabel,
                'Nota': gradeDisplay,
                'Feedback do Docente': feedbackText,
                'Mensagem do Aluno': studentMessage
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Entregas Selecionadas');

        const filename = `atividades_selecionadas_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(workbook, filename);
        showAlert('Exportação das atividades selecionadas concluída!', 'success');
    });

    document.getElementById('batchDeleteFilesBtn')?.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if(ids.length === 0) return;
        if(!confirm(`Tem certeza que deseja apagar OS ANEXOS de ${ids.length} atividade(s)? Os dados continuarão salvos, mas o arquivo sumirá para economizar espaço.`)) return;
        
        try {
            await apiFetch('/api/admin/submissions/batch-delete-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
            showAlert('Anexos apagados com sucesso!', 'success');
            loadSubmissions();
        } catch (error) { showAlert(error.message, 'danger'); }
    });

    document.getElementById('batchDeleteSubsBtn')?.addEventListener('click', async () => {
        const ids = getSelectedIds();
        if(ids.length === 0) return;
        if(!confirm(`Tem certeza que deseja apagar COMPLETAMENTE ${ids.length} atividade(s)? Esta ação não pode ser desfeita.`)) return;
        
        try {
            await apiFetch('/api/admin/submissions/batch-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
            showAlert('Atividades apagadas com sucesso!', 'success');
            loadSubmissions();
        } catch (error) { showAlert(error.message, 'danger'); }
    });

    // Ações Individuais (Admin)
    window.openEditSubmissionModal = async (id) => {
        const sub = currentSubmissions.find(s => s.id === id);
        if(!sub) return;
        
        // Carregar opções de disciplinas, professores e tipos de atividade se não houver
        const [subjects, users, activityTypes] = await Promise.all([
            apiFetch('/api/admin/subjects'),
            apiFetch('/api/admin/users'),
            apiFetch('/api/admin/activity-types')
        ]);
        
        const selSub = document.getElementById('editSubSubject');
        const selAct = document.getElementById('editSubActivityType');
        
        selSub.innerHTML = subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        selAct.innerHTML = '<option value="">Selecione...</option>' + activityTypes.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        showModal('editSubmissionModal');
        document.getElementById('editSubId').value = sub.id;
        document.getElementById('editSubName').value = sub.student_name;
        document.getElementById('editSubDRT').value = sub.student_drt;
        document.getElementById('editSubClass').value = sub.student_class;
        document.getElementById('editSubSubject').value = sub.subject_id;
        document.getElementById('editSubActivityType').value = sub.activity_type_id || '';
        document.getElementById('editSubStatus').value = sub.status || 'Em Andamento';
    };

    document.getElementById('closeEditSubmissionModalBtn')?.addEventListener('click', () => {
        hideModal('editSubmissionModal');
    });

    document.getElementById('editSubmissionForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editSubId').value;
        const body = {
            student_name: document.getElementById('editSubName').value,
            student_drt: document.getElementById('editSubDRT').value,
            student_class: document.getElementById('editSubClass').value,
            subject_id: document.getElementById('editSubSubject').value,
            activity_type_id: document.getElementById('editSubActivityType').value || null,
            status: document.getElementById('editSubStatus').value
        };
        try {
            await apiFetch(`/api/admin/submissions/${id}`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(body) 
            });
            showAlert('Atividade editada!', 'success');
            hideModal('editSubmissionModal');
            loadSubmissions();
        } catch (error) { showAlert(error.message, 'danger'); }
    });

    window.deleteSubmission = async (id) => {
        if(!confirm('Tem certeza que deseja excluir esta atividade inteira?')) return;
        try {
            await apiFetch(`/api/admin/submissions/${id}`, { method: 'DELETE' });
            showAlert('Atividade excluída!', 'success');
            loadSubmissions();
        } catch (error) { showAlert(error.message, 'danger'); }
    };

    window.deleteFormResponse = async (combinedId) => {
        const id = Number(combinedId.replace('form_resp_', ''));
        const sub = currentSubmissions.find(s => s.id === combinedId);
        if (!sub) return;

        if (!confirm('Tem certeza que deseja excluir esta resposta de formulário permanentemente?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/forms/${sub.formId}/responses/batch-delete`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ids: [id] })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao excluir resposta');
            showAlert(data.message || 'Resposta de formulário excluída!', 'success');
            loadSubmissions();
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    };

    window.downloadFile = async (id, filename) => {
        try {
            const blob = await apiFetch(`/api/submissions/${id}/download`, { isDownload: true });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    };

    window.viewFile = async (id, filename) => {
        try {
            const blob = await apiFetch(`/api/submissions/${id}/download?view=true`, { isDownload: true });
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    };

    window.updateGradeQuick = async (id, val) => {
        try {
            await apiFetch(`/api/professor/submissions/${id}/grade`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grade: val === '' ? null : parseFloat(val) })
            });
            showAlert('Nota salva com sucesso!', 'success');
            
            // Atualiza os dados locais para manter consistência sem precisar recarregar tudo do servidor
            const sub = currentSubmissions.find(s => s.id === id);
            if (sub) {
                sub.grade = val === '' ? null : parseFloat(val);
            }
        } catch (error) {
            showAlert(error.message, 'danger');
            loadSubmissions(); // Restaura o valor correto se houver falha
        }
    };

    window.toggleStatus = async (id) => {
        try {
            await apiFetch(`/api/professor/submissions/${id}/toggle`, { method: 'PATCH' });
            showAlert('Status da mensagem atualizado!', 'success');
            loadSubmissions();
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    };

    window.sendGradeEmailSingle = async (id) => {
        const sub = currentSubmissions.find(s => s.id === id);
        if (!sub) return;

        if (sub.grade === null || sub.grade === undefined) {
            showAlert('Não é possível enviar o e-mail de nota porque a atividade ainda não foi avaliada (sem nota).', 'warning');
            return;
        }

        const clientType = localStorage.getItem('preferredEmailClient') || 'gmail';
        const clientText = clientType === 'gmail' ? 'Gmail Web' : (clientType === 'outlook' ? 'Outlook Web' : 'Outlook / App Local');

        if (!confirm(`Deseja abrir o ${clientText} para enviar a nota do aluno ${sub.student_name}?`)) return;

        try {
            const res = await apiFetch(`/api/professor/submissions/${id}/grade`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ send_email: true })
            });

            showAlert('Dados de e-mail preparados!', 'success');

            if (res.email_sent && res.submission) {
                openEmailClient(res.submission, clientType, res.professor_name);
            }
            
            loadSubmissions();
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    };

    document.getElementById('exportExcelBtn').addEventListener('click', async () => {
        try {
            const blob = await apiFetch(`/api/export-excel`, { isDownload: true });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'atividades.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            showAlert('Erro ao exportar Excel.', 'danger');
        }
    });

    // === AVALIAÇÃO (Professor) ===
    window.openGradeModal = (id) => {
        const sub = currentSubmissions.find(s => s.id === id);
        if (!sub) return;

        const isAdmin = user.role === 'admin';
        showModal('gradeModal');
        document.getElementById('evalStudentName').textContent = sub.student_name;
        document.getElementById('evalSubmissionId').value = sub.id;
        
        const evalSendEmail = document.getElementById('evalSendEmail');
        const adminNoteGroup = document.getElementById('adminNoteGroup');
        const evalAdminNote = document.getElementById('evalAdminNote');
        const msgGroup = document.getElementById('studentMessageGroup');
        const msgDiv = document.getElementById('evalStudentMessage');

        if (sub.isFormResponse) {
            // Se for resposta do form, exibe as respostas nos campos da mensagem
            const answersListHtml = (sub.formattedAnswers || []).map(ans => `
                <div style="margin-bottom: 0.5rem; text-align: left;">
                    <div style="font-weight: 600; font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(ans.label)}</div>
                    <div style="font-size: 0.88rem; color: var(--text-main); margin-top: 0.15rem;">${escapeHtml(ans.value || '—')}</div>
                </div>
            `).join('<hr style="border: 0; border-top: 1px solid var(--border); margin: 0.4rem 0;">');

            msgDiv.innerHTML = answersListHtml || 'Nenhuma resposta.';
            msgGroup.querySelector('label').textContent = 'Respostas do Formulário:';
            msgGroup.style.display = 'block';

            // Oculta nota, feedback, rodapé de enviar email e notas
            document.getElementById('evalGrade').parentElement.style.display = 'none';
            document.getElementById('evalFeedback').parentElement.style.display = 'none';
            if (evalSendEmail) evalSendEmail.parentElement.style.display = 'none';
            adminNoteGroup.classList.add('hidden');
            
            // Oculta o botão de salvar do formulário
            const gradeFormSubmit = document.querySelector('#gradeForm button[type="submit"]');
            if (gradeFormSubmit) gradeFormSubmit.style.display = 'none';
        } else {
            // Restaura
            document.getElementById('evalGrade').parentElement.style.display = '';
            document.getElementById('evalFeedback').parentElement.style.display = '';
            if (evalSendEmail) evalSendEmail.parentElement.style.display = '';
            msgGroup.querySelector('label').textContent = 'Mensagem do Aluno:';
            
            document.getElementById('evalGrade').value = sub.grade !== null ? sub.grade : '';
            document.getElementById('evalFeedback').value = sub.feedback !== null ? sub.feedback : '';
            
            if (evalSendEmail) {
                evalSendEmail.checked = !sub.grade_sent;
            }

            if (isAdmin) {
                adminNoteGroup.classList.remove('hidden');
                evalAdminNote.value = sub.admin_note || '';
            } else {
                adminNoteGroup.classList.add('hidden');
            }

            if (sub.message && sub.message.trim() !== '') {
                msgDiv.textContent = sub.message;
                msgGroup.style.display = 'block';
            } else {
                msgGroup.style.display = 'none';
            }
            
            const gradeFormSubmit = document.querySelector('#gradeForm button[type="submit"]');
            if (gradeFormSubmit) gradeFormSubmit.style.display = '';
        }
    };

    document.getElementById('closeGradeModalBtn').addEventListener('click', () => {
        hideModal('gradeModal');
    });

    document.getElementById('gradeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('evalSubmissionId').value;
        const grade = document.getElementById('evalGrade').value;
        const feedback = document.getElementById('evalFeedback').value;
        const admin_note = document.getElementById('evalAdminNote')?.value;
        const send_email = document.getElementById('evalSendEmail')?.checked || false;

        try {
            const res = await apiFetch(`/api/professor/submissions/${id}/grade`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grade, feedback, admin_note, send_email })
            });
            
            showAlert(res.message || 'Dados salvos com sucesso.', 'success');
            hideModal('gradeModal');
            
            // Abre o cliente de e-mail preferido se o envio foi solicitado
            if (send_email && res.email_sent && res.submission) {
                const clientType = localStorage.getItem('preferredEmailClient') || 'gmail';
                openEmailClient(res.submission, clientType, res.professor_name);
            }
            
            loadSubmissions();
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    });

    // Lógica do Modal de Histórico de Atividades por RA/DRT - Redireciona para consulta.html
    const showStudentHistoryBtn = document.getElementById('showStudentHistoryBtn');
    if (showStudentHistoryBtn) {
        showStudentHistoryBtn.addEventListener('click', () => {
            const drtInput = document.getElementById('searchStudentRa');
            if (!drtInput) return;
            const drt = drtInput.value.trim();
            if (!drt) {
                showAlert('Por favor, digite o RA/DRT do aluno.', 'warning');
                return;
            }
            window.open(`/consulta.html?drt=${encodeURIComponent(drt)}`, '_blank');
        });
    }

    // === ADMIN: USUÁRIOS & ACESSOS ===
    let currentUsers = [];

    const roleLabels = {
        admin: 'Administrador',
        professor: 'Professor',
        student: 'Aluno',
        preceptor: 'Preceptor'
    };

    function renderUsers(users) {
        const tbody = document.querySelector('#usersTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        users.forEach(u => {
            const tr = document.createElement('tr');
            const isBlocked = u.is_active === false;
            const isMe = Number(u.id) === Number(user.id);

            // ── Coluna: Checkbox ──────────────────────────────────────────
            const tdCheck = document.createElement('td');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            if (isMe) {
                cb.disabled = true;
                cb.style.opacity = '0.5';
                cb.title = 'Você não pode executar ações em lote na sua própria conta';
            } else {
                cb.className = 'user-checkbox';
                cb.value = u.id;
            }
            tdCheck.appendChild(cb);

            // ── Coluna: Nome ──────────────────────────────────────────────
            const tdName = document.createElement('td');
            const strong = document.createElement('strong');
            if (u.drt) {
                const link = document.createElement('a');
                link.href = `/historico.html?drt=${encodeURIComponent(u.drt)}`;
                link.textContent = u.name;
                link.style.color = 'var(--primary)';
                link.style.textDecoration = 'none';
                link.addEventListener('mouseover', () => { link.style.textDecoration = 'underline'; });
                link.addEventListener('mouseout', () => { link.style.textDecoration = 'none'; });
                strong.appendChild(link);
            } else {
                strong.textContent = u.name;
            }
            tdName.appendChild(strong);

            // ── Coluna: E-mail ────────────────────────────────────────────
            const tdEmail = document.createElement('td');
            tdEmail.textContent = u.email;

            // ── Coluna: DRT/RA ────────────────────────────────────────────
            const tdDrt = document.createElement('td');
            tdDrt.textContent = u.drt || '---';

            // ── Coluna: Nível de Acesso (select) ──────────────────────────
            const tdRole = document.createElement('td');
            const sel = document.createElement('select');
            sel.className = 'form-control';
            sel.style.cssText = 'width: auto; padding: 0.3rem 0.6rem; font-size: 0.85rem; height: auto;';
            [['student','Aluno'],['professor','Professor'],['preceptor','Preceptor'],['admin','Administrador']].forEach(([val, label]) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = label;
                if (u.role === val) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.addEventListener('change', () => changeUserRole(u.id, sel.value));
            tdRole.appendChild(sel);

            // ── Coluna: Status de Acesso (badge) ──────────────────────────
            const tdStatus = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'badge';
            if (!isBlocked) {
                badge.style.cssText = 'background: rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.25); padding:0.35rem 0.75rem; border-radius:999px; font-weight:600; font-size:0.8rem; display:inline-flex; align-items:center; gap:0.3rem;';
                badge.textContent = '● Ativo';
            } else {
                badge.style.cssText = 'background: rgba(239,68,68,0.12); color:#ef4444; border:1px solid rgba(239,68,68,0.25); padding:0.35rem 0.75rem; border-radius:999px; font-weight:600; font-size:0.8rem; display:inline-flex; align-items:center; gap:0.3rem;';
                badge.textContent = '● Bloqueado';
            }
            tdStatus.appendChild(badge);

            // ── Coluna: Ações ─────────────────────────────────────────────
            const tdActions = document.createElement('td');
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'd-flex gap-2';

            // Botão Bloquear/Ativar
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn btn-sm';
            if (isMe) {
                toggleBtn.className += ' btn-secondary';
                toggleBtn.disabled = true;
                toggleBtn.style.cssText = 'opacity:0.5; cursor:not-allowed; padding:0.4rem 0.8rem; font-size:0.82rem; border-radius:6px;';
                toggleBtn.textContent = 'Bloquear';
                toggleBtn.title = 'Você não pode bloquear sua própria conta';
            } else if (!isBlocked) {
                toggleBtn.className += ' btn-danger';
                toggleBtn.style.cssText = 'padding:0.4rem 0.8rem; font-size:0.82rem; border-radius:6px; background-color:#ef4444; border-color:#ef4444;';
                toggleBtn.textContent = 'Bloquear';
                toggleBtn.addEventListener('click', () => toggleUserAccess(u.id));
            } else {
                toggleBtn.className += ' btn-success';
                toggleBtn.style.cssText = 'padding:0.4rem 0.8rem; font-size:0.82rem; border-radius:6px; background-color:#10b981; border-color:#10b981; color:white;';
                toggleBtn.textContent = 'Ativar';
                toggleBtn.addEventListener('click', () => toggleUserAccess(u.id));
            }

            // Botão Editar
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-secondary btn-sm';
            editBtn.textContent = 'Editar';
            editBtn.addEventListener('click', () => openEditUserModal(u.id));

            // Botão Excluir
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-danger btn-sm';
            delBtn.textContent = 'Excluir';
            delBtn.addEventListener('click', () => deleteUser(u.id));

            actionsDiv.appendChild(toggleBtn);
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(delBtn);
            tdActions.appendChild(actionsDiv);

            // ── Monta a linha ─────────────────────────────────────────────
            tr.appendChild(tdCheck);
            tr.appendChild(tdName);
            tr.appendChild(tdEmail);
            tr.appendChild(tdDrt);
            tr.appendChild(tdRole);
            tr.appendChild(tdStatus);
            tr.appendChild(tdActions);
            tbody.appendChild(tr);
        });

        updateBatchUserActionsUI();
    }

    // Gerenciador de eventos para checkboxes de usuários
    document.getElementById('usersTable')?.addEventListener('change', (e) => {
        if (e.target.id === 'selectAllUsers') {
            const isChecked = e.target.checked;
            document.querySelectorAll('.user-checkbox').forEach(cb => {
                if (!cb.disabled) cb.checked = isChecked;
            });
        }
        updateBatchUserActionsUI();
    });

    function updateBatchUserActionsUI() {
        const checkboxes = document.querySelectorAll('.user-checkbox');
        const checkedCount = document.querySelectorAll('.user-checkbox:checked').length;
        const container = document.getElementById('batchUserActionsContainer');
        const selectAll = document.getElementById('selectAllUsers');
        
        if (selectAll) {
            const enabledCheckboxes = Array.from(checkboxes).filter(cb => !cb.disabled);
            selectAll.checked = enabledCheckboxes.length > 0 && checkedCount === enabledCheckboxes.length;
        }

        if (container) {
            document.getElementById('selectedUsersCount').textContent = checkedCount;
            if (checkedCount > 0) {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        }
    }

    function getSelectedUserIds() {
        return Array.from(document.querySelectorAll('.user-checkbox:checked')).map(cb => Number(cb.value));
    }

    // Ação em Lote: Deletar usuários
    document.getElementById('btnBatchDeleteUsers')?.addEventListener('click', async () => {
        const ids = getSelectedUserIds();
        if (ids.length === 0) return;
        
        if (!confirm(`Tem certeza que deseja apagar COMPLETAMENTE os ${ids.length} usuário(s) selecionado(s)? Esta ação não pode ser desfeita.`)) return;
        
        showAlert('Apagando usuários selecionados...', 'info');
        try {
            await Promise.all(ids.map(id => apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' })));
            showAlert('Usuários excluídos com sucesso!', 'success');
            currentUsers = currentUsers.filter(u => !ids.includes(Number(u.id)));
            renderUsers(currentUsers);
        } catch (error) {
            showAlert(error.message, 'danger');
            loadUsers();
        }
    });

    // Ação em Lote: Mudar Função
    document.getElementById('btnBatchChangeRole')?.addEventListener('click', async () => {
        const ids = getSelectedUserIds();
        if (ids.length === 0) return;
        
        const newRole = document.getElementById('batchUserRole').value;
        if (!confirm(`Deseja alterar a função de ${ids.length} usuário(s) para "${roleLabels[newRole]}"?`)) return;
        
        showAlert('Atualizando funções dos usuários...', 'info');
        try {
            await Promise.all(ids.map(id => {
                const u = currentUsers.find(user => user.id === id);
                if (!u) return Promise.resolve();
                
                const body = {
                    name: u.name,
                    email: u.email,
                    drt: u.drt,
                    role: newRole
                };
                return apiFetch(`/api/admin/users/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
            }));
            
            showAlert('Funções atualizadas com sucesso!', 'success');
            
            // Atualiza localmente
            ids.forEach(id => {
                const u = currentUsers.find(user => user.id === id);
                if (u) u.role = newRole;
            });
            
            renderUsers(currentUsers);
        } catch (error) {
            showAlert(error.message, 'danger');
            loadUsers();
        }
    });

    // Ação em Lote: Bloquear Acesso
    document.getElementById('btnBatchBlockUsers')?.addEventListener('click', async () => {
        const ids = getSelectedUserIds();
        if (ids.length === 0) return;
        
        // Filtra apenas quem está ativo para fazer a chamada toggle
        const usersToBlock = currentUsers.filter(u => ids.includes(Number(u.id)) && u.is_active !== false);
        
        if (usersToBlock.length === 0) {
            showAlert('Os usuários selecionados já estão bloqueados.', 'warning');
            return;
        }

        if (!confirm(`Deseja BLOQUEAR o acesso de ${usersToBlock.length} usuário(s)?`)) return;

        showAlert('Bloqueando acessos...', 'info');
        try {
            await Promise.all(usersToBlock.map(u => apiFetch(`/api/admin/users/${u.id}/toggle-block`, { method: 'PATCH' })));
            showAlert('Acessos bloqueados com sucesso!', 'success');
            
            usersToBlock.forEach(u => u.is_active = false);
            renderUsers(currentUsers);
        } catch (error) {
            showAlert(error.message, 'danger');
            loadUsers();
        }
    });

    // Ação em Lote: Ativar Acesso
    document.getElementById('btnBatchActivateUsers')?.addEventListener('click', async () => {
        const ids = getSelectedUserIds();
        if (ids.length === 0) return;
        
        // Filtra apenas quem está suspenso
        const usersToActivate = currentUsers.filter(u => ids.includes(Number(u.id)) && u.is_active === false);
        
        if (usersToActivate.length === 0) {
            showAlert('Os usuários selecionados já estão ativos.', 'warning');
            return;
        }

        if (!confirm(`Deseja LIBERAR o acesso de ${usersToActivate.length} usuário(s)?`)) return;

        showAlert('Liberando acessos...', 'info');
        try {
            await Promise.all(usersToActivate.map(u => apiFetch(`/api/admin/users/${u.id}/toggle-block`, { method: 'PATCH' })));
            showAlert('Acessos liberados com sucesso!', 'success');
            
            usersToActivate.forEach(u => u.is_active = true);
            renderUsers(currentUsers);
        } catch (error) {
            showAlert(error.message, 'danger');
            loadUsers();
        }
    });

    // Ações de alteração de acessos via API
    window.toggleUserAccess = async (id) => {
        try {
            const res = await apiFetch(`/api/admin/users/${id}/toggle-block`, { method: 'PATCH' });
            showAlert(res.message, 'success');
            
            const u = currentUsers.find(user => user.id === id);
            if (u) {
                u.is_active = res.is_active;
            }
            
            renderUsers(currentUsers);
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    };

    window.changeUserRole = async (id, newRole) => {
        const u = currentUsers.find(user => user.id === id);
        if (!u) return;
        
        const body = {
            name: u.name,
            email: u.email,
            drt: u.drt,
            role: newRole
        };
        
        try {
            await apiFetch(`/api/admin/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            showAlert('Nível de acesso atualizado com sucesso!', 'success');
            
            u.role = newRole;
            renderUsers(currentUsers);
        } catch (error) {
            showAlert(error.message, 'danger');
            loadUsers();
        }
    };

    async function loadUsers() {
        try {
            const data = await apiFetch('/api/admin/users');
            currentUsers = data;
            renderUsers(currentUsers);
        } catch (error) { showAlert(error.message, 'danger'); }
    }

    document.getElementById('filterUsersInput')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = currentUsers.filter(u => 
            u.name.toLowerCase().includes(query) || 
            u.email.toLowerCase().includes(query) || 
            (u.drt && u.drt.toLowerCase().includes(query)) ||
            (roleLabels[u.role] || u.role).toLowerCase().includes(query) ||
            (u.is_active === false ? 'bloqueado' : 'ativo').includes(query)
        );
        renderUsers(filtered);
    });

    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            name: document.getElementById('newUserName').value,
            email: document.getElementById('newUserEmail').value,
            drt: document.getElementById('newUserDrt').value.trim() || null,
            password: document.getElementById('newUserPassword').value,
            role: document.getElementById('newUserRole').value
        };
        try {
            await apiFetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            showAlert('Usuário criado!', 'success');
            document.getElementById('userForm').reset();
            loadUsers();
        } catch (error) { showAlert(error.message, 'danger'); }
    });

    window.deleteUser = async (id) => {
        if(confirm('Tem certeza?')) {
            try {
                await apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
                loadUsers();
            } catch (error) { showAlert(error.message, 'danger'); }
        }
    };

    window.downloadUserExampleTemplate = () => {
        const headers = [['Nome', 'E-mail', 'Função (professor/admin/student/preceptor)', 'RA / DRT / CPF', 'Senha']];
        const data = [
            ['Maria Souza', 'maria.souza@universidade.edu', 'student', '22019483', 'senha123'],
            ['Prof. João Silva', 'joao.silva@universidade.edu', 'professor', 'DRT88291', 'senha456']
        ];
        const ws = XLSX.utils.aoa_to_sheet(headers.concat(data));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
        XLSX.writeFile(wb, 'modelo_importacao_usuarios.xlsx');
    };

    window.openEditUserModal = (id) => {
        const u = currentUsers.find(user => user.id === id);
        if (!u) return;

        showModal('editUserModal');
        document.getElementById('editUserNameDisplay').textContent = u.name;
        document.getElementById('editUserId').value = u.id;
        document.getElementById('editUserName').value = u.name;
        document.getElementById('editUserEmail').value = u.email;
        document.getElementById('editUserDrt').value = u.drt || '';
        document.getElementById('editUserRole').value = u.role;
        document.getElementById('editUserPassword').value = '';
    };

    document.getElementById('closeEditUserModalBtn')?.addEventListener('click', () => {
        hideModal('editUserModal');
    });

    document.getElementById('editUserForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editUserId').value;
        const body = {
            name: document.getElementById('editUserName').value,
            email: document.getElementById('editUserEmail').value,
            drt: document.getElementById('editUserDrt').value.trim() || null,
            password: document.getElementById('editUserPassword').value,
            role: document.getElementById('editUserRole').value
        };

        try {
            await apiFetch(`/api/admin/users/${id}`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(body) 
            });
            showAlert('Usuário atualizado com sucesso!', 'success');
            hideModal('editUserModal');
            switchView('navUsers');
            loadUsers();
        } catch (error) { 
            showAlert(error.message, 'danger'); 
        }
    });

    // === ADMIN: AVISOS ===
    let currentNotices = [];
    async function loadNotices() {
        try {
            const data = await apiFetch('/api/admin/notices');
            currentNotices = data;
            
            // Popular selects de usuários nos avisos
            const newNoticeUser = document.getElementById('newNoticeUser');
            const editNoticeUser = document.getElementById('editNoticeUser');
            if (newNoticeUser && newNoticeUser.options.length === 1) {
                const users = await apiFetch('/api/admin/users');
                users.forEach(u => {
                    const opt1 = document.createElement('option');
                    opt1.value = u.id;
                    opt1.textContent = `${u.name} (${u.role})`;
                    newNoticeUser.appendChild(opt1);
                    
                    const opt2 = document.createElement('option');
                    opt2.value = u.id;
                    opt2.textContent = `${u.name} (${u.role})`;
                    editNoticeUser.appendChild(opt2);
                });
            }

            renderNotices(currentNotices);
        } catch (error) { showAlert(error.message, 'danger'); }
    }

    function renderNotices(notices) {
        const tbody = document.querySelector('#noticesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        notices.forEach(n => {
            const authorName = n.author ? n.author.name : 'Sistema';
            const canManage = user.role === 'admin' || n.author_id == user.id;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(n.createdAt).toLocaleDateString()}</td>
                <td>${n.title}</td>
                <td><span style="font-size: 0.85rem; color: var(--text-muted);">👤 ${authorName}</span></td>
                <td>
                    <div class="d-flex gap-2">
                        ${canManage ? `
                            <button class="btn btn-secondary btn-sm" onclick="openEditNoticeModal(${n.id})">Editar</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteNotice(${n.id})">Excluir</button>
                        ` : '<span style="font-size: 0.8rem; color: #ccc;">Sem permissão</span>'}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function applyNoticesFilters() {
        const text = document.getElementById('filterNoticesText')?.value.toLowerCase() || '';
        const start = document.getElementById('filterNoticesStart')?.value;
        const end = document.getElementById('filterNoticesEnd')?.value;

        const filtered = currentNotices.filter(n => {
            const userName = (n.user ? n.user.name : '').toLowerCase();
            const authorName = (n.author ? n.author.name : '').toLowerCase();
            const matchesText = n.title.toLowerCase().includes(text) || 
                                n.message.toLowerCase().includes(text) ||
                                userName.includes(text) ||
                                authorName.includes(text);
            
            let matchesDate = true;
            const subDate = new Date(n.createdAt);
            subDate.setHours(0, 0, 0, 0);

            if (start) {
                const startDate = new Date(start + 'T00:00:00');
                if (subDate < startDate) matchesDate = false;
            }
            if (end) {
                const endDate = new Date(end + 'T00:00:00');
                if (subDate > endDate) matchesDate = false;
            }

            return matchesText && matchesDate;
        });

        renderNotices(filtered);
    }

    document.getElementById('filterNoticesText')?.addEventListener('input', applyNoticesFilters);
    document.getElementById('filterNoticesStart')?.addEventListener('change', applyNoticesFilters);
    document.getElementById('filterNoticesEnd')?.addEventListener('change', applyNoticesFilters);

    document.getElementById('noticeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('title', document.getElementById('newNoticeTitle').value);
        formData.append('message', document.getElementById('newNoticeMessage').value);
        formData.append('user_id', document.getElementById('newNoticeUser').value);
        const fileInput = document.getElementById('newNoticeFile');
        if (fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }
        try {
            // Não defina Content-Type para FormData, o navegador fará isso automaticamente com o boundary
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/notices', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Erro ao criar aviso');
            showAlert('Aviso criado!', 'success');
            document.getElementById('noticeForm').reset();
            loadNotices();
        } catch (error) { showAlert(error.message, 'danger'); }
    });

    window.openEditNoticeModal = (id) => {
        const notice = currentNotices.find(n => n.id === id);
        if(!notice) return;
        showModal('editNoticeModal');
        document.getElementById('editNoticeId').value = notice.id;
        document.getElementById('editNoticeTitle').value = notice.title;
        document.getElementById('editNoticeMessage').value = notice.message;
        document.getElementById('editNoticeUser').value = notice.user_id || '';
    };

    document.getElementById('closeEditNoticeModalBtn')?.addEventListener('click', () => {
        hideModal('editNoticeModal');
    });

    document.getElementById('editNoticeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editNoticeId').value;
        const formData = new FormData();
        formData.append('title', document.getElementById('editNoticeTitle').value);
        formData.append('message', document.getElementById('editNoticeMessage').value);
        formData.append('user_id', document.getElementById('editNoticeUser').value);
        const fileInput = document.getElementById('editNoticeFile');
        if (fileInput.files[0]) {
            formData.append('file', fileInput.files[0]);
        }
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/notices/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Erro ao atualizar aviso');
            showAlert('Aviso atualizado!', 'success');
            document.getElementById('editNoticeModal').classList.add('hidden');
            loadNotices();
        } catch (error) { showAlert(error.message, 'danger'); }
    });

    window.deleteNotice = async (id) => {
        if(confirm('Tem certeza que deseja excluir este aviso?')) {
            try {
                await apiFetch(`/api/admin/notices/${id}`, { method: 'DELETE' });
                showAlert('Aviso excluído.', 'success');
                loadNotices();
            } catch (error) { showAlert(error.message, 'danger'); }
        }
    };

    // === PERFIL DO USUÁRIO ===
    function loadProfile() {
        document.getElementById('profileName').value = user.name || '';
        document.getElementById('profileEmail').value = user.email || '';
        document.getElementById('profilePassword').value = '';
    }

    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profileName').value;
        const email = document.getElementById('profileEmail').value;
        const password = document.getElementById('profilePassword').value;
        try {
            const data = await apiFetch('/api/profile', { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ name, email, password }) 
            });
            showAlert(data.message, 'success');
            
            // Atualiza os dados locais
            user.name = data.user.name;
            user.email = data.user.email;
            localStorage.setItem('user', JSON.stringify(user));
            document.getElementById('userNameDisplay')?.textContent && (document.getElementById('userNameDisplay').textContent = `Olá, ${user.name}`);
            
            document.getElementById('profilePassword').value = '';
        } catch (error) { 
            showAlert(error.message, 'danger'); 
        }
    });

    // === MENSAGENS DO NUMQ (STUDENT MESSAGES) ===
    let currentStudentMessages = [];
    async function loadStudentMessages() {
        try {
            const data = await apiFetch('/api/admin/student-messages');
            currentStudentMessages = data;
            renderStudentMessages(currentStudentMessages);
        } catch (error) { showAlert(error.message, 'danger'); }
    }

    function renderStudentMessages(messages) {
        const tbody = document.querySelector('#studentMessagesTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        messages.forEach(msg => {
            const tr = document.createElement('tr');
            const targetName = msg.professor ? `Prof. ${msg.professor.name}` : 'NuMQ (Geral)';
            tr.innerHTML = `
                <td>${new Date(msg.createdAt).toLocaleString()}</td>
                <td>
                    <strong>${msg.name}</strong><br>
                    <small>${msg.email}</small>
                </td>
                <td>${msg.subject}</td>
                <td>${targetName}</td>
                <td>
                    <span class="badge ${msg.read ? 'badge-resolved' : 'badge-pending'}">
                        ${msg.read ? 'Lida' : 'Nova'}
                    </span>
                </td>
                <td>
                    <div class="d-flex gap-2 align-center flex-wrap">
                        <button class="btn btn-primary btn-sm" onclick="viewStudentMessage(${msg.id})">👁️ Ver</button>
                        ${!msg.read ? `<button class="btn btn-secondary btn-sm" onclick="markStudentMessageRead(${msg.id})">✓ Lida</button>` : ''}
                        <button class="btn btn-danger btn-sm" onclick="deleteStudentMessage(${msg.id})">🗑️ Excluir</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.viewStudentMessage = (id) => {
        const msg = currentStudentMessages.find(m => m.id === id);
        if (!msg) return;
        const targetText = msg.professor ? `Prof. ${msg.professor.name}` : 'NuMQ (Administração Geral)';
        
        document.getElementById('msgStudentName').textContent = msg.name;
        document.getElementById('msgStudentEmail').textContent = msg.email;
        document.getElementById('msgDestinatario').textContent = targetText;
        document.getElementById('msgAssunto').textContent = msg.subject;
        document.getElementById('msgDataEnvio').textContent = new Date(msg.createdAt).toLocaleString('pt-BR');
        document.getElementById('msgConteudo').textContent = msg.content;

        const isAdmin = user.role === 'admin';
        const adminNoteGroup = document.getElementById('msgAdminNoteGroup');
        const adminNoteInput = document.getElementById('msgAdminNote');
        
        if (isAdmin && adminNoteGroup) {
            adminNoteGroup.classList.remove('hidden');
            adminNoteInput.value = msg.admin_note || '';
            
            // Substitui o botão para evitar acumular múltiplos event listeners
            const saveBtn = document.getElementById('saveMsgAdminNoteBtn');
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            
            newSaveBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const noteVal = adminNoteInput.value;
                try {
                    await apiFetch(`/api/admin/student-messages/${msg.id}/note`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ admin_note: noteVal })
                    });
                    showAlert('Nota interna salva com sucesso!', 'success');
                    
                    // Atualiza a nota localmente no array
                    msg.admin_note = noteVal;
                } catch (err) {
                    showAlert(err.message, 'danger');
                }
            });
        } else if (adminNoteGroup) {
            adminNoteGroup.classList.add('hidden');
        }

        showModal('viewStudentMessageModal');
        
        if (!msg.read) {
            markStudentMessageRead(id);
        }
    };

    document.getElementById('closeMsgModalBtn')?.addEventListener('click', () => {
        hideModal('viewStudentMessageModal');
    });

    window.markStudentMessageRead = async (id) => {
        try {
            await apiFetch(`/api/admin/student-messages/${id}/read`, { method: 'PATCH' });
            loadStudentMessages();
        } catch (error) { showAlert(error.message, 'danger'); }
    };

    window.deleteStudentMessage = async (id) => {
        if (!confirm('Excluir esta mensagem permanentemente?')) return;
        try {
            await apiFetch(`/api/admin/student-messages/${id}`, { method: 'DELETE' });
            showAlert('Mensagem excluída.', 'success');
            loadStudentMessages();
        } catch (error) { showAlert(error.message, 'danger'); }
    };

    // Init
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam === 'users' && user.role === 'admin') {
        switchView('navUsers');
        loadUsers();
    } else {
        loadSubmissions();
    }
});
