/**
 * historico.js — Lógica da tela de Histórico de Atividades
 *
 * Modos de acesso:
 *  - Público  (aluno): preenche Nome + DRT + Protocolo → POST /api/public/submissions/query
 *  - Docente/Admin   : token no localStorage + ?drt=... na URL → GET /api/submissions/history/:drt
 */

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // Referências ao DOM
    // ============================================================
    const searchSection   = document.getElementById('searchSection');
    const resultsSection  = document.getElementById('resultsSection');
    const queryForm       = document.getElementById('queryForm');
    const submitBtn       = document.getElementById('submitBtn');
    const btnText         = document.getElementById('btnText');
    const btnSpinner      = document.getElementById('btnSpinner');
    const searchAlertMsg  = document.getElementById('searchAlertMsg');
    const searchAlert     = document.getElementById('searchAlert');

    const displayName     = document.getElementById('displayName');
    const displayDrt      = document.getElementById('displayDrt');
    const backBtn         = document.getElementById('backBtn');
    const exportExcelBtn  = document.getElementById('exportExcelBtn');
    const backBtnIcon     = document.getElementById('backBtnIcon');
    const backBtnText     = document.getElementById('backBtnText');
    const activitiesList  = document.getElementById('activitiesList');

    // Estatísticas
    const statTotal   = document.getElementById('statTotal');
    const statDone    = document.getElementById('statDone');
    const statPending = document.getElementById('statPending');
    const statAvg     = document.getElementById('statAvg');

    // Filtros
    const filterSubject      = document.getElementById('filterSubject');

    const filterActivityType = document.getElementById('filterActivityType');

    const filterDateStart    = document.getElementById('filterDateStart');
    const filterDateEnd      = document.getElementById('filterDateEnd');
    const clearFiltersBtn    = document.getElementById('clearFiltersBtn');

    // Painel colapsável de filtros
    const filterToggle = document.getElementById('filterToggle');
    const filterBody   = document.getElementById('filterBody');
    const filterChevron = document.getElementById('filterChevron');

    // ============================================================
    // Estado da aplicação
    // ============================================================
    let allSubmissions  = [];   // Dados brutos vindos da API
    let filteredSubmissions = []; // Dados filtrados exibidos na tela
    let isTeacherView   = false;
    let currentQuery    = { name: '', drt: '', protocol: '' };

    const token = localStorage.getItem('token');
    let user = null;
    try { user = JSON.parse(localStorage.getItem('user')); } catch (_) {}

    // ============================================================
    // Ajusta navbar: se logado, troca "Acesso Docente" → "Dashboard"
    // ============================================================
    const navAuthLink = document.getElementById('navAuthLink');
    if (token && user) {
        if (navAuthLink) {
            navAuthLink.href        = '/dashboard.html';
            navAuthLink.textContent = 'Dashboard';
        }
    }

    // ============================================================
    // Parâmetros de URL
    // ============================================================
    const urlParams   = new URLSearchParams(window.location.search);
    const drtParam    = urlParams.get('drt');
    const nomeParam   = urlParams.get('nome');
    const protocolParam = urlParams.get('protocol');

    // ============================================================
    // Carrega opções dos filtros (selects) de forma assíncrona
    // ============================================================
    function loadFilterOptions() {
        // Disciplinas
        fetch('/api/public/subjects')
            .then(r => r.json())
            .then(data => {
                filterSubject.innerHTML = '<option value="">Todas</option>';
                data.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value       = s.id;
                    opt.textContent = s.name;
                    filterSubject.appendChild(opt);
                });
            })
            .catch(() => {});



        // Tipos de atividade
        fetch('/api/public/activity-types')
            .then(r => r.json())
            .then(data => {
                filterActivityType.innerHTML = '<option value="">Todos</option>';
                data.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value       = t.id;
                    opt.textContent = t.name;
                    filterActivityType.appendChild(opt);
                });
            })
            .catch(() => {});
    }

    // ============================================================
    // Aplica filtros localmente sobre allSubmissions e re-renderiza
    // ============================================================
    function applyFilters() {
        const subjectId    = filterSubject.value;

        const actTypeId    = filterActivityType.value;

        const startDateStr = filterDateStart.value;
        const endDateStr   = filterDateEnd.value;

        const filtered = allSubmissions.filter(sub => {
            // — Disciplina
            if (subjectId) {
                const id = String(sub.subject_id ?? sub.subject?.id ?? '');
                if (id !== String(subjectId)) return false;
            }



            // — Tipo de Atividade
            if (actTypeId) {
                const id = String(sub.activity_type_id ?? sub.activityType?.id ?? '');
                if (id !== String(actTypeId)) return false;
            }



            // — Datas
            const rawDate = sub.createdAt || sub.created_at;
            if (rawDate) {
                const d = new Date(rawDate);
                d.setHours(0, 0, 0, 0);
                if (startDateStr) {
                    const start = new Date(startDateStr + 'T00:00:00');
                    if (d < start) return false;
                }
                if (endDateStr) {
                    const end = new Date(endDateStr + 'T00:00:00');
                    if (d > end) return false;
                }
            }

            return true;
        });

        filteredSubmissions = filtered;
        renderSubmissions(filtered);
    }

    // ============================================================
    // Calcula e exibe estatísticas (sobre TODOS os registros,
    // não sobre o subconjunto filtrado)
    // ============================================================
    function updateStats(submissions) {
        const total   = submissions.length;
        const done    = submissions.filter(s => s.grade !== null && s.grade !== undefined || (s.feedback && s.feedback.trim())).length;
        const pending = total - done;

        const grades = submissions
            .map(s => parseFloat(s.grade))
            .filter(n => !isNaN(n));

        const avg = grades.length > 0
            ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1)
            : null;

        statTotal.textContent   = total;
        statDone.textContent    = done;
        statPending.textContent = pending;
        statAvg.textContent     = avg !== null ? avg : '—';
    }

    // ============================================================
    // Renderiza os cards de atividade
    // ============================================================
    function renderSubmissions(submissions) {
        activitiesList.innerHTML = '';

        if (!submissions || submissions.length === 0) {
            activitiesList.innerHTML = `
                <div class="empty-state">
                    <span class="empty-state-icon">📭</span>
                    <h3>Nenhuma atividade encontrada</h3>
                    <p>Tente ajustar os filtros ou verifique os dados informados.</p>
                </div>
            `;
            return;
        }

        submissions.forEach((sub, index) => {
            const card = document.createElement('div');

            const isConcluido = sub.status === 'Concluído';
            card.className = `activity-card ${isConcluido ? 'status-concluido' : 'status-andamento'}`;
            // Escalonamento suave da animação
            card.style.animationDelay = `${index * 0.06}s`;

            const date          = new Date(sub.createdAt || sub.created_at).toLocaleString('pt-BR');
            const subjectName   = sub.subject?.name    || 'Geral';
            const professorName = sub.professor?.name  || 'Não atribuído';
            const actTypeName   = sub.activityType?.name || '—';
            const className     = sub.student_class    || sub.class?.name || '—';
            const protocol      = sub.protocol         || '—';
            const statusLabel   = sub.status           || 'Em Andamento';
            const statusClass   = isConcluido          ? 'badge-resolved' : 'badge-pending';

            // — Mensagem do aluno
            let studentMsgHtml = '';
            if (sub.message && sub.message.trim()) {
                studentMsgHtml = `
                    <div class="student-message-box">
                        <div class="msg-label">💬 Mensagem do Aluno</div>
                        <div class="msg-text">${escapeHtml(sub.message)}</div>
                    </div>
                `;
            }

            // — Bloco de avaliação / nota
            let evalHtml = '';
            const hasGrade    = sub.grade !== null && sub.grade !== undefined;
            const hasFeedback = sub.feedback && sub.feedback.trim() !== '';

            if (hasGrade || hasFeedback) {
                const gradeDisplay = hasGrade ? sub.grade : '—';
                const feedbackHtml = hasFeedback
                    ? `<div class="eval-feedback"><strong>Mensagem do Docente:</strong><br>${escapeHtml(sub.feedback)}</div>`
                    : '';

                evalHtml = `
                    <div class="eval-box evaluated">
                        <div class="eval-title">🏆 Avaliação &amp; Feedback</div>
                        <div class="eval-grade-row">
                            <span class="eval-grade-number">${gradeDisplay}</span>
                            ${hasGrade ? '<span class="eval-grade-unit">/ nota</span>' : ''}
                        </div>
                        ${feedbackHtml}
                    </div>
                `;
            } else {
                evalHtml = '';
            }

            // — Área de arquivo ou respostas do formulário
            let fileHtml = '';
            if (sub.isFormResponse) {
                const uniqueId = `formAnswers_${sub.responseId}`;
                const answersListHtml = (sub.formattedAnswers || []).map(ans => `
                    <div style="margin-bottom: 0.5rem; text-align: left;">
                        <div style="font-weight: 600; font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(ans.label)}</div>
                        <div style="font-size: 0.88rem; color: var(--text-main); margin-top: 0.15rem;">${escapeHtml(ans.value || '—')}</div>
                    </div>
                `).join('<hr style="border: 0; border-top: 1px solid var(--border); margin: 0.4rem 0;">');

                fileHtml = `
                    <div class="file-area" style="flex-direction: column; align-items: stretch; gap: 0.5rem; width: 100%;">
                        <button class="btn btn-primary" onclick="document.getElementById('${uniqueId}').classList.toggle('hidden');" style="padding: 0.5rem 1rem; width: 100%; font-weight: 600; text-align: center; font-family: inherit;">
                            👁️ Ver Respostas do Formulário
                        </button>
                        <div id="${uniqueId}" class="hidden" style="margin-top: 0.75rem; padding: 1rem; background: var(--bg-color); border: 1px solid var(--border); border-radius: var(--radius); display: flex; flex-direction: column; gap: 0.2rem;">
                            ${answersListHtml || '<div style="color: var(--text-muted); text-align: center;">Nenhuma resposta registrada.</div>'}
                        </div>
                    </div>
                `;
            } else if (sub.file_path) {
                const safeFilename = escapeAttr(sub.original_filename || 'arquivo');
                fileHtml = `
                    <div class="file-area">
                        <button class="btn-download btn-dl-green"
                                onclick="window.downloadMyFile(${sub.id}, '${safeFilename}')">
                            ⬇️ Download
                        </button>
                        <button class="btn-download btn-dl-indigo"
                                onclick="window.viewMyFile(${sub.id}, '${safeFilename}')">
                            👁️ Visualizar
                        </button>
                    </div>
                `;
            } else {
                fileHtml = `<p class="no-file-text">Sem arquivo anexo.</p>`;
            }

            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <div class="protocol-label">Protocolo de Envio</div>
                        <div class="protocol-value">${escapeHtml(protocol)}</div>
                        <div class="card-date">🕐 Enviado em: ${date}</div>
                    </div>
                    <span class="badge ${statusClass}">${escapeHtml(statusLabel)}</span>
                </div>

                <div class="details-grid">
                    <div class="detail-item">
                        <div class="detail-label">Disciplina / Núcleo</div>
                        <div class="detail-value">${escapeHtml(subjectName)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Tipo de Atividade</div>
                        <div class="detail-value">${escapeHtml(actTypeName)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Semestre</div>
                        <div class="detail-value">${escapeHtml(className)}</div>
                    </div>
                </div>

                ${studentMsgHtml}
                ${evalHtml}
                ${fileHtml}
            `;

            activitiesList.appendChild(card);
        });
    }

    // ============================================================
    // Exibe a seção de resultados, preenchendo nome e DRT
    // ============================================================
    function showResults(name, drt, submissions) {
        allSubmissions = submissions;
        filteredSubmissions = submissions;

        displayName.textContent = name;
        displayDrt.textContent  = drt;

        updateStats(allSubmissions);
        renderSubmissions(allSubmissions);

        searchSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    }

    // ============================================================
    // Controle do loader do botão de busca
    // ============================================================
    function setLoading(loading) {
        submitBtn.disabled = loading;
        if (loading) {
            btnText.textContent = 'Buscando...';
            btnSpinner.classList.add('show');
        } else {
            btnText.textContent = '🔍 Buscar Histórico';
            btnSpinner.classList.remove('show');
        }
    }

    // ============================================================
    // Exibe alerta de erro no formulário
    // ============================================================
    function showSearchError(msg) {
        searchAlertMsg.textContent = msg;
        searchAlert.classList.add('show');
        setTimeout(() => searchAlert.classList.remove('show'), 6000);
    }

    // ============================================================
    // Busca autenticada (modo docente/admin) por DRT
    // ============================================================
    async function loadHistoryTeacher(drt) {
        setLoading(true);
        try {
            const res  = await fetch(`/api/submissions/history/${encodeURIComponent(drt)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Erro ao consultar o histórico.');
            }

            let name = data.length > 0 ? data[0].student_name : drt;

            if (data.length === 0) {
                try {
                    const usersRes = await fetch('/api/common/users', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (usersRes.ok) {
                        const users = await usersRes.json();
                        const foundUser = users.find(u => String(u.drt) === String(drt));
                        if (foundUser) {
                            name = foundUser.name;
                        }
                    }
                } catch (e) {
                    console.error('Erro ao buscar o nome do usuário pelo DRT:', e);
                }
            }

            // Botão "Voltar ao Dashboard"
            backBtnIcon.textContent = '🏠';
            backBtnText.textContent = 'Voltar ao Dashboard';

            showResults(name, drt, data);
        } catch (err) {
            showSearchError(err.message || 'Erro inesperado ao buscar histórico.');
            // Garante que o formulário seja visível
            searchSection.classList.remove('hidden');
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // Busca pública (modo aluno) — POST /api/public/submissions/query
    // ============================================================
    async function loadHistoryPublic(name, drt, protocol) {
        setLoading(true);
        try {
            const res  = await fetch('/api/public/submissions/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, drt, protocol })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Dados inválidos ou protocolo não encontrado.');
            }

            currentQuery = { name, drt, protocol };

            showResults(name, drt, data);
        } catch (err) {
            showSearchError(err.message || 'Erro inesperado. Verifique os dados e tente novamente.');
        } finally {
            setLoading(false);
        }
    }

    // ============================================================
    // Inicialização — detecta modo e parâmetros de URL
    // ============================================================
    loadFilterOptions();

    if (drtParam) {
        if (token && user && (user.role === 'admin' || user.role === 'professor')) {
            // Modo docente/admin — autenticado via token
            isTeacherView = true;
            loadHistoryTeacher(drtParam);
        } else if (nomeParam && protocolParam) {
            // Modo aluno via URL completa
            document.getElementById('inputNome').value     = nomeParam;
            document.getElementById('inputDrt').value      = drtParam;
            document.getElementById('inputProtocol').value = protocolParam;
            setTimeout(() => queryForm.dispatchEvent(new Event('submit')), 100);
        } else {
            // DRT na URL mas sem protocolo/nome → pré-preenche só o DRT
            document.getElementById('inputDrt').value = drtParam;
        }
    }

    // ============================================================
    // Submit do formulário (modo aluno)
    // ============================================================
    queryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        searchAlert.classList.remove('show');

        const nome     = document.getElementById('inputNome').value.trim();
        const drt      = document.getElementById('inputDrt').value.trim();
        const protocol = document.getElementById('inputProtocol').value.trim();

        if (!nome || !drt || !protocol) {
            showSearchError('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        await loadHistoryPublic(nome, drt, protocol);
    });

    // ============================================================
    // Botão "Voltar" / "Consultar Outro"
    // ============================================================
    backBtn.addEventListener('click', () => {
        if (isTeacherView) {
            window.location.href = '/dashboard.html';
        } else {
            // Limpa estado e volta ao formulário
            allSubmissions = [];
            filteredSubmissions = [];
            currentQuery   = { name: '', drt: '', protocol: '' };
            queryForm.reset();
            searchAlert.classList.remove('show');
            resultsSection.classList.add('hidden');
            searchSection.classList.remove('hidden');
            // Reseta filtros
            clearAllFilters();
        }
    });

    // ============================================================
    // Botão "Exportar Excel"
    // ============================================================
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
        const drtValue = displayDrt.textContent ? displayDrt.textContent.trim() : 'aluno';
        const nameValue = displayName.textContent ? displayName.textContent.trim().replace(/\s+/g, '_') : '';
        const filename = `historico_atividades_${drtValue}${nameValue ? '_' + nameValue : ''}.xlsx`;

        // Gerar o download
        XLSX.writeFile(workbook, filename);
    });

    // ============================================================
    // Painel colapsável de filtros
    // ============================================================
    filterToggle.addEventListener('click', () => {
        const isOpen = !filterBody.classList.contains('collapsed');
        filterBody.classList.toggle('collapsed', isOpen);
        filterChevron.classList.toggle('open', !isOpen);
        filterToggle.setAttribute('aria-expanded', String(!isOpen));
    });

    // ============================================================
    // Bind dos filtros
    // ============================================================
    function bindFilter(el) {
        if (el) el.addEventListener('change', applyFilters);
    }
    bindFilter(filterSubject);
    bindFilter(filterActivityType);

    bindFilter(filterDateStart);
    bindFilter(filterDateEnd);

    // ============================================================
    // Limpar todos os filtros
    // ============================================================
    function clearAllFilters() {
        filterSubject.value      = '';
        filterActivityType.value = '';

        filterDateStart.value    = '';
        filterDateEnd.value      = '';
        filteredSubmissions = allSubmissions;
        renderSubmissions(allSubmissions);
    }

    clearFiltersBtn.addEventListener('click', clearAllFilters);

    // ============================================================
    // Download de arquivo (público e autenticado)
    // ============================================================
    window.downloadMyFile = async (id, filename) => {
        try {
            let res;
            if (isTeacherView && token) {
                res = await fetch(`/api/submissions/${id}/download`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                const { drt, protocol } = currentQuery;
                res = await fetch(
                    `/api/public/submissions/${id}/download?drt=${encodeURIComponent(drt)}&protocol=${encodeURIComponent(protocol)}`
                );
            }

            if (!res.ok) {
                let msg = 'Erro ao baixar o arquivo.';
                try { const err = await res.json(); msg = err.error || msg; } catch (_) {}
                throw new Error(msg);
            }

            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('⚠️ ' + (err.message || 'Não foi possível fazer o download.'));
        }
    };

    // ============================================================
    // Visualizar arquivo em nova aba (público e autenticado)
    // ============================================================
    window.viewMyFile = async (id, filename) => {
        try {
            let res;
            if (isTeacherView && token) {
                res = await fetch(`/api/submissions/${id}/download?view=true`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                const { drt, protocol } = currentQuery;
                res = await fetch(
                    `/api/public/submissions/${id}/download?drt=${encodeURIComponent(drt)}&protocol=${encodeURIComponent(protocol)}&view=true`
                );
            }

            if (!res.ok) {
                let msg = 'Erro ao visualizar o arquivo.';
                try { const err = await res.json(); msg = err.error || msg; } catch (_) {}
                throw new Error(msg);
            }

            const blob = await res.blob();
            const url  = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (err) {
            alert('⚠️ ' + (err.message || 'Não foi possível visualizar o arquivo.'));
        }
    };

    // ============================================================
    // Utilitários de segurança — escapa HTML e atributos
    // ============================================================
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeAttr(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'");
    }

}); // fim DOMContentLoaded
