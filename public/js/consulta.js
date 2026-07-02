document.addEventListener('DOMContentLoaded', () => {
    const queryForm = document.getElementById('queryForm');
    const searchSection = document.getElementById('searchSection');
    const resultsSection = document.getElementById('resultsSection');
    const activitiesList = document.getElementById('activitiesList');
    const studentNameDisplay = document.getElementById('studentNameDisplay');
    const studentDrtDisplay = document.getElementById('studentDrtDisplay');
    const backBtn = document.getElementById('backBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    
    const alertDiv = document.getElementById('alertMessage');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');

    let currentQueryData = {
        name: '',
        drt: '',
        protocol: ''
    };

    let isTeacherView = false;
    let allSubmissions = [];
    let filteredSubmissions = [];
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    // Atualiza o menu de navegação dinamicamente se estiver logado
    if (token && user) {
        const loginLink = document.querySelector('a[href="/login.html"]');
        if (loginLink) {
            loginLink.href = '/dashboard.html';
            loginLink.textContent = 'Dashboard';
        }
    }

    // Carrega opções dos filtros dinamicamente
    function loadFilterOptions() {
        fetch('/api/public/subjects')
            .then(res => res.json())
            .then(data => {
                const select = document.getElementById('filterSubject');
                if (select) {
                    select.innerHTML = '<option value="">Todas</option>';
                    data.forEach(sub => {
                        const opt = document.createElement('option');
                        opt.value = sub.id;
                        opt.textContent = sub.name;
                        select.appendChild(opt);
                    });
                }
            })
            .catch(err => console.error('Erro ao carregar disciplinas para filtro:', err));



        fetch('/api/public/activity-types')
            .then(res => res.json())
            .then(data => {
                const select = document.getElementById('filterActivityType');
                if (select) {
                    select.innerHTML = '<option value="">Todos</option>';
                    data.forEach(type => {
                        const opt = document.createElement('option');
                        opt.value = type.id;
                        opt.textContent = type.name;
                        select.appendChild(opt);
                    });
                }
            })
            .catch(err => console.error('Erro ao carregar tipos de atividades para filtro:', err));
    }

    function applyFilters() {
        const subjectId = document.getElementById('filterSubject')?.value || '';

        const activityTypeId = document.getElementById('filterActivityType')?.value || '';
        const startDate = document.getElementById('filterStartDate')?.value || '';
        const endDate = document.getElementById('filterEndDate')?.value || '';

        const filtered = allSubmissions.filter(sub => {
            let matchesSubject = true;
            if (subjectId) {
                matchesSubject = String(sub.subject_id || (sub.subject && sub.subject.id)) === String(subjectId);
            }



            let matchesActivityType = true;
            if (activityTypeId) {
                matchesActivityType = String(sub.activity_type_id || (sub.activityType && sub.activityType.id)) === String(activityTypeId);
            }



            let matchesDate = true;
            const dateStr = sub.createdAt || sub.created_at;
            if (dateStr) {
                const subDate = new Date(dateStr);
                subDate.setHours(0, 0, 0, 0);

                if (startDate) {
                    const start = new Date(startDate + 'T00:00:00');
                    if (subDate < start) matchesDate = false;
                }
                if (endDate) {
                    const end = new Date(endDate + 'T00:00:00');
                    if (subDate > end) matchesDate = false;
                }
            }

            return matchesSubject && matchesActivityType && matchesDate;
        });

        filteredSubmissions = filtered;
        renderSubmissions(filtered);
    }

    // Função de auxílio para carregar o histórico autenticado do professor/admin
    async function loadHistoryTeacher(drt) {
        setLoader(true);
        try {
            const res = await fetch(`/api/submissions/history/${encodeURIComponent(drt)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao consultar o histórico.');
            }

            // Armazena dados
            currentQueryData = { name: data.length > 0 ? data[0].student_name : 'Sem Nome', drt: drt, protocol: '' };
            allSubmissions = data;
            filteredSubmissions = data;

            // Renderiza resultados
            renderSubmissions(allSubmissions);

            // Transiciona telas
            studentNameDisplay.textContent = currentQueryData.name;
            studentDrtDisplay.textContent = drt;
            searchSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');

            // Altera botão voltar para ir ao Dashboard
            if (backBtn) {
                backBtn.textContent = '🏠 Voltar ao Dashboard';
            }
        } catch (error) {
            showAlert(error.message, 'danger');
        } finally {
            setLoader(false);
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const drtParam = urlParams.get('drt');
    const nomeParam = urlParams.get('nome');
    const protocolParam = urlParams.get('protocol');

    // Inicializa carregamento dos filtros
    loadFilterOptions();

    // Bind de eventos dos filtros
    document.getElementById('filterSubject')?.addEventListener('change', applyFilters);

    document.getElementById('filterActivityType')?.addEventListener('change', applyFilters);

    document.getElementById('filterStartDate')?.addEventListener('change', applyFilters);
    document.getElementById('filterEndDate')?.addEventListener('change', applyFilters);

    // Executa a busca automática ao carregar se os parâmetros estiverem presentes
    if (drtParam) {
        if (token && user && (user.role === 'admin' || user.role === 'professor')) {
            // Visão do Docente/Admin (Autenticada por DRT)
            isTeacherView = true;
            loadHistoryTeacher(drtParam);
        } else if (nomeParam && protocolParam) {
            // Visão Pública Completa automatizada via URL
            document.getElementById('nome').value = nomeParam;
            document.getElementById('drt').value = drtParam;
            document.getElementById('protocol').value = protocolParam;
            // Executa a busca simulando o submit do formulário
            setTimeout(() => {
                queryForm.dispatchEvent(new Event('submit'));
            }, 100);
        }
    }

    function showAlert(msg, type) {
        alertDiv.textContent = msg;
        alertDiv.className = `alert alert-${type} show`;
        setTimeout(() => alertDiv.classList.remove('show'), 4000);
    }

    function setLoader(loading) {
        if (loading) {
            submitBtn.disabled = true;
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
        } else {
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    }

    queryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('nome').value.trim();
        const drt = document.getElementById('drt').value.trim();
        const protocol = document.getElementById('protocol').value.trim();

        setLoader(true);

        try {
            const res = await fetch('/api/public/submissions/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: nome, drt, protocol })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao consultar as atividades.');
            }

            // Armazena dados da consulta bem-sucedida para requisições de download
            currentQueryData = { name: nome, drt, protocol };
            allSubmissions = data;
            filteredSubmissions = data;

            // Renderiza resultados
            renderSubmissions(allSubmissions);

            // Transiciona telas
            studentNameDisplay.textContent = nome;
            studentDrtDisplay.textContent = drt;
            searchSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');

        } catch (error) {
            showAlert(error.message, 'danger');
        } finally {
            setLoader(false);
        }
    });

    backBtn.addEventListener('click', () => {
        // Resetar os inputs dos filtros
        const fSubject = document.getElementById('filterSubject');
        const fActivity = document.getElementById('filterActivityType');
        const fStart = document.getElementById('filterStartDate');
        const fEnd = document.getElementById('filterEndDate');
        
        if (fSubject) fSubject.value = '';

        if (fActivity) fActivity.value = '';

        if (fStart) fStart.value = '';
        if (fEnd) fEnd.value = '';
        allSubmissions = [];
        filteredSubmissions = [];

        if (isTeacherView) {
            window.location.href = '/dashboard.html';
        } else {
            resultsSection.classList.add('hidden');
            searchSection.classList.remove('hidden');
            queryForm.reset();
        }
    });

    // Event listener para exportar para o Excel
    exportExcelBtn.addEventListener('click', () => {
        if (!filteredSubmissions || filteredSubmissions.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }

        // Mapear os dados para um formato amigável para o Excel
        const dataToExport = filteredSubmissions.map(sub => {
            const date = new Date(sub.createdAt || sub.created_at).toLocaleString('pt-BR');
            const subjectName = sub.subject?.name || 'Geral';
            const professorName = sub.professor?.name || 'Não atribuído';
            const actTypeName = sub.activityType?.name || '—';
            const className = sub.student_class || sub.class?.name || '—';
            const statusLabel = sub.status || 'Em Andamento';
            
            // Tratamento da nota
            let gradeDisplay = 'Aguardando';
            if (sub.grade !== null && sub.grade !== undefined) {
                gradeDisplay = parseFloat(sub.grade);
            }

            const feedbackText = sub.feedback && sub.feedback.trim() ? sub.feedback : '—';
            const studentMessage = sub.message && sub.message.trim() ? sub.message : '—';

            return {
                'Protocolo': sub.protocol || '—',
                'Arquivo Anexo': sub.original_filename && sub.file_path ? sub.original_filename : 'Sem anexo',
                'Data de Envio': date,
                'Disciplina': subjectName,
                'Tipo de Atividade': actTypeName,
                'Semestre': className,
                'Status': statusLabel,
                'Nota': gradeDisplay,
                'Feedback do Docente': feedbackText,
                'Mensagem do Aluno': studentMessage
            };
        });

        // Criar worksheet a partir dos dados mapeados
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        
        // Criar workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Histórico');

        // Configurar nome do arquivo com base nas informações do aluno
        const drtValue = studentDrtDisplay.textContent ? studentDrtDisplay.textContent.trim() : 'aluno';
        const nameValue = studentNameDisplay.textContent ? studentNameDisplay.textContent.trim().replace(/\s+/g, '_') : '';
        const filename = `historico_atividades_${drtValue}${nameValue ? '_' + nameValue : ''}.xlsx`;

        // Gerar o download
        XLSX.writeFile(workbook, filename);
    });

    function renderSubmissions(submissions) {
        activitiesList.innerHTML = '';

        if (submissions.length === 0) {
            activitiesList.innerHTML = '<p class="text-center text-muted">Nenhuma atividade encontrada.</p>';
            return;
        }

        submissions.forEach(sub => {
            const card = document.createElement('div');
            card.className = 'activity-card';

            const date = new Date(sub.createdAt).toLocaleString('pt-BR');
            const subjectName = sub.subject ? sub.subject.name : 'Geral';
            const professorName = sub.professor ? sub.professor.name : 'Não atribuído';
            const activityTypeName = sub.activityType ? sub.activityType.name : '-';

            // Badge de status
            const statusClass = sub.status === 'Concluído' ? 'badge-resolved' : 'badge-pending';
            const statusLabel = sub.status || 'Em Andamento';

            // Anexo HTML
            let fileHtml = '';
            if (sub.file_path) {
                fileHtml = `
                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="downloadMyFile(${sub.id}, '${sub.original_filename}')">Download do Arquivo</button>
                        <button class="btn btn-primary btn-sm" onclick="viewMyFile(${sub.id}, '${sub.original_filename}')">Visualizar Arquivo</button>
                    </div>
                `;
            } else {
                fileHtml = `
                    <div style="margin-top: 1rem;">
                        <span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">Sem arquivo anexo ou arquivo excluído.</span>
                    </div>
                `;
            }

            // Nota e Feedback
            let evaluationHtml = '';
            if (sub.grade !== null || (sub.feedback && sub.feedback.trim() !== '')) {
                const gradeLabel = sub.grade !== null ? sub.grade : 'Sem nota';
                const feedbackLabel = sub.feedback && sub.feedback.trim() !== '' 
                    ? `<div class="feedback-text"><strong>Mensagem do Docente:</strong><br>${sub.feedback}</div>` 
                    : '';

                evaluationHtml = `
                    <div class="grade-box">
                        <div class="grade-title">Avaliação & Feedback</div>
                        <div class="d-flex align-center gap-3">
                            <div>
                                <span style="font-size: 0.8rem; color: #166534; display: block; font-weight: 500;">Parecer / Nota:</span>
                                <span class="grade-value">${gradeLabel}</span>
                            </div>
                        </div>
                        ${feedbackLabel}
                    </div>
                `;
            } else {
                evaluationHtml = '';
            }

            // Mensagem do Aluno (opcional)
            let studentMessageHtml = '';
            if (sub.message && sub.message.trim() !== '') {
                studentMessageHtml = `
                    <div style="margin-top: 1rem; padding: 0.75rem; background-color: #f3f4f6; border-radius: var(--radius); border-left: 4px solid var(--primary); font-size: 0.9rem;">
                        <strong>Mensagem do Aluno:</strong>
                        <div style="margin-top: 0.25rem; white-space: pre-wrap; color: var(--text-main);">${sub.message}</div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="activity-header">
                    <span class="activity-title">Protocolo: ${sub.protocol || '-'}</span>
                    <span class="badge ${statusClass}">${statusLabel}</span>
                </div>
                <div class="activity-details">
                    <div class="detail-item">
                        <div class="detail-label">Data de Envio</div>
                        <div class="detail-value">${date}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Disciplina / Núcleo</div>
                        <div class="detail-value">${subjectName}</div>
                    </div>

                    <div class="detail-item">
                        <div class="detail-label">Tipo de Atividade</div>
                        <div class="detail-value">${activityTypeName}</div>
                    </div>
                </div>
                ${studentMessageHtml}
                ${evaluationHtml}
                ${fileHtml}
            `;

            activitiesList.appendChild(card);
        });
    }

    // Funções de Download e Visualização para o Aluno e Professor
    window.downloadMyFile = async (id, filename) => {
        try {
            let res;
            if (isTeacherView && token) {
                res = await fetch(`/api/submissions/${id}/download`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                const { drt, protocol } = currentQueryData;
                res = await fetch(`/api/public/submissions/${id}/download?drt=${drt}&protocol=${protocol}`);
            }
            
            if (!res.ok) {
                let errorMsg = 'Erro ao baixar arquivo.';
                try {
                    const err = await res.json();
                    errorMsg = err.error || errorMsg;
                } catch(e) {}
                throw new Error(errorMsg);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert(error.message);
        }
    };

    window.viewMyFile = async (id, filename) => {
        try {
            let res;
            if (isTeacherView && token) {
                res = await fetch(`/api/submissions/${id}/download?view=true`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                const { drt, protocol } = currentQueryData;
                res = await fetch(`/api/public/submissions/${id}/download?drt=${drt}&protocol=${protocol}&view=true`);
            }
            
            if (!res.ok) {
                let errorMsg = 'Erro ao visualizar arquivo.';
                try {
                    const err = await res.json();
                    errorMsg = err.error || errorMsg;
                } catch(e) {}
                throw new Error(errorMsg);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (error) {
            alert(error.message);
        }
    };
});
