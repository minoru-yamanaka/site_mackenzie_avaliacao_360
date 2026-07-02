// public/js/form-responses.js
// Script da página de visualização e exportação de respostas
// Inclui tabela paginada, modal de resposta, gráfico Chart.js e exportações

document.addEventListener('DOMContentLoaded', () => {
    // ── Autenticação ──────────────────────────────────────────────
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!token || !user) { window.location.href = '/login.html'; return; }

    document.getElementById('userNameDisplay').textContent = user.name;
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token'); localStorage.removeItem('user');
        window.location.href = '/login.html';
    });

    // ── Estado ───────────────────────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    const formId = params.get('id');
    if (!formId) { window.location.href = '/forms.html'; return; }

    let currentPage = 1;
    let totalPages = 1;
    let formFields = [];
    let allResponsesData = [];
    let chart = null;

    // ── Inicialização ─────────────────────────────────────────────
    loadFormInfo();
    loadResponses();

    document.getElementById('btnEditForm')?.addEventListener('click', () => {
        window.location.href = `/form-builder.html?id=${formId}`;
    });

    // ── Exportações ───────────────────────────────────────────────
    function getExportUrl(basePath) {
        const from = document.getElementById('filterDateFrom').value;
        const to = document.getElementById('filterDateTo').value;
        let url = basePath;
        const params = [];
        if (from) params.push(`from=${from}`);
        if (to) params.push(`to=${to}`);
        if (params.length > 0) url += `?${params.join('&')}`;
        return url;
    }

    document.getElementById('btnExportExcel').addEventListener('click', () =>
        exportFile(getExportUrl(`/api/forms/${formId}/export/excel`)));
    document.getElementById('btnExportCsv').addEventListener('click', () =>
        exportFile(getExportUrl(`/api/forms/${formId}/export/csv`)));
    document.getElementById('btnExportZip').addEventListener('click', () =>
        exportFile(getExportUrl(`/api/forms/${formId}/export/zip`)));

    // ════════════════════════════════════════════════════════════
    // CARREGAR FORMULÁRIO (metadados + campos)
    // ════════════════════════════════════════════════════════════

    async function loadFormInfo() {
        try {
            const res = await apiFetch(`/api/forms/${formId}`);
            const data = await res.json();
            if (!res.ok) return;
            document.getElementById('formTitle').textContent = data.title;
            document.getElementById('formDesc').textContent = data.description || '';
            document.title = `Respostas — ${data.title}`;
            formFields = (data.fields || []).sort((a,b) => a.position - b.position);
        } catch (e) { console.warn(e); }
    }

    // ════════════════════════════════════════════════════════════
    // CARREGAR RESPOSTAS (com paginação)
    // ════════════════════════════════════════════════════════════

    async function loadResponses(page = 1) {
        try {
            const from = document.getElementById('filterDateFrom').value;
            const to = document.getElementById('filterDateTo').value;
            let url = `/api/forms/${formId}/responses?page=${page}&limit=20`;
            if (from) url += `&from=${from}`;
            if (to) url += `&to=${to}`;

            const res = await apiFetch(url);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            allResponsesData = data.responses || [];
            currentPage = data.page;
            totalPages = data.totalPages;

            updateStats(data);
            renderTable(allResponsesData);
            renderPagination();
            renderChart(allResponsesData);
        } catch (e) {
            showAlert(e.message, 'danger');
            document.getElementById('responsesTableBody').innerHTML =
                `<tr><td colspan="5" style="text-align:center;color:var(--danger);">${e.message}</td></tr>`;
        }
    }

    // ════════════════════════════════════════════════════════════
    // ESTATÍSTICAS
    // ════════════════════════════════════════════════════════════

    function updateStats(data) {
        document.getElementById('statTotal').textContent = data.total ?? 0;

        const today = new Date().toDateString();
        const todayCount = (data.responses || []).filter(r =>
            new Date(r.submitted_at).toDateString() === today).length;
        document.getElementById('statToday').textContent = todayCount;
    }

    // ════════════════════════════════════════════════════════════
    // TABELA DE RESPOSTAS
    // ════════════════════════════════════════════════════════════

    function renderTable(responses) {
        const tbody = document.getElementById('responsesTableBody');
        // Limpa o checkbox selectAllResponses e esconde a barra de lote ao renderizar
        const selectAll = document.getElementById('selectAllResponses');
        if (selectAll) selectAll.checked = false;
        const batchBar = document.getElementById('batchActionsContainer');
        if (batchBar) batchBar.classList.add('hidden');

        if (!responses.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">
                Nenhuma resposta registrada ainda.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = responses.map((r, i) => {
            const name = r.respondent ? r.respondent.name : (r.respondent_name || '');
            const drt = r.respondent ? r.respondent.drt : (r.respondent_identifier || '');

            let respondentHtml = '';
            if (name && drt) {
                respondentHtml = `<a href="/historico.html?drt=${encodeURIComponent(drt)}&nome=${encodeURIComponent(name)}" onclick="event.stopPropagation();" style="color: var(--primary); font-weight: 600; text-decoration: underline;" title="Clique para ver o histórico do aluno">${escapeHtml(name)} <span style="font-size:0.75rem;color:var(--text-muted);">(${escapeHtml(drt)})</span></a>`;
            } else if (name) {
                respondentHtml = escapeHtml(name);
            } else {
                respondentHtml = '<em style="color:var(--text-muted)">Anônimo</em>';
            }

            return `
            <tr class="response-row" onclick="viewResponse(${i})" title="Clique para ver detalhes">
                <td><input type="checkbox" class="response-checkbox" value="${r.id}" onclick="event.stopPropagation(); updateBatchUI();"></td>
                <td><strong>#${r.id}</strong></td>
                <td>${respondentHtml}</td>
                <td>${new Date(r.submitted_at).toLocaleString('pt-BR')}</td>
                <td style="font-size:.8rem;color:var(--text-muted);">${r.ip_address || '—'}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); viewResponse(${i})">
                        👁 Ver
                    </button>
                </td>
            </tr>`;
        }).join('');
    }

    // ════════════════════════════════════════════════════════════
    // MODAL: RESPOSTA INDIVIDUAL
    // ════════════════════════════════════════════════════════════

    window.viewResponse = (index) => {
        const response = allResponsesData[index];
        if (!response) return;

        const respondentDetail = response.respondent
            ? escapeHtml(response.respondent.name + ' — ' + response.respondent.email)
            : (response.respondent_name
                ? `${escapeHtml(response.respondent_name)} [${escapeHtml(response.respondent_identifier)}]`
                : 'Anônimo');

        document.getElementById('modalResponseId').textContent = response.id;
        document.getElementById('modalResponseDate').innerHTML =
            `📅 ${new Date(response.submitted_at).toLocaleString('pt-BR')} &nbsp;|&nbsp; 
             👤 ${respondentDetail}`;

        // Mapeia answers por fieldId
        const answersMap = {};
        (response.answers || []).forEach(a => { answersMap[a.field_id] = a; });

        const list = document.getElementById('modalAnswersList');
        if (formFields.length > 0) {
            list.innerHTML = formFields.map(field => {
                const answer = answersMap[field.id];
                return `
                <div class="modal-answer-item">
                    <div class="modal-field-label">${escapeHtml(field.label)} <span style="font-size:.72rem;background:#f3f4f6;padding:.1rem .4rem;border-radius:999px;">${field.type}</span></div>
                    <div class="modal-field-value">${formatAnswerValue(answer, field)}</div>
                </div>`;
            }).join('');
        } else {
            list.innerHTML = (response.answers || []).map(a => `
                <div class="modal-answer-item">
                    <div class="modal-field-label">Campo #${a.field_id}</div>
                    <div class="modal-field-value">${escapeHtml(a.value || '—')}</div>
                </div>`).join('');
        }

        document.getElementById('modalOverlay').classList.remove('hidden');
        document.getElementById('responseModal').classList.remove('hidden');
    };

    window.closeResponseModal = () => {
        document.getElementById('modalOverlay').classList.add('hidden');
        document.getElementById('responseModal').classList.add('hidden');
    };

    // ════════════════════════════════════════════════════════════
    // FORMATAÇÃO DE VALORES
    // ════════════════════════════════════════════════════════════

    const CHA_LABELS = { 2.5: 'Inicial', 5.0: 'Em desenvolvimento', 7.5: 'Adequado', 10.0: 'Proficiente' };

    function formatAnswerValue(answer, field) {
        if (!answer || (answer.value === null && !answer.file_path)) {
            return '<em style="color:var(--text-muted);">Não respondido</em>';
        }

        if (field.type === 'file') {
            if (answer.file_path) {
                return `<a href="/uploads/${answer.original_filename || answer.value}" target="_blank" style="color:var(--primary);">
                    📎 ${escapeHtml(answer.original_filename || answer.value)}
                </a>`;
            }
            return '<em>Arquivo removido</em>';
        }

        if (field.type === 'cha') {
            try {
                const cha = JSON.parse(answer.value);
                return `
                <div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.25rem;">
                    <span class="cha-badge">C: ${cha.c} (${CHA_LABELS[cha.c] || cha.c})</span>
                    <span class="cha-badge">H: ${cha.h} (${CHA_LABELS[cha.h] || cha.h})</span>
                    <span class="cha-badge">A: ${cha.a} (${CHA_LABELS[cha.a] || cha.a})</span>
                    <span class="cha-media-badge">Média: ${parseFloat(cha.media).toFixed(2).replace('.',',')}</span>
                </div>`;
            } catch { return escapeHtml(answer.value); }
        }

        if (field.type === 'star_rating') {
            const stars = parseInt(answer.value) || 0;
            return '⭐'.repeat(stars) + ` (${stars}/4)`;
        }

        if (field.type === 'yes_no') {
            return answer.value === 'sim'
                ? '<span style="color:#065f46;font-weight:600;">👍 Sim</span>'
                : '<span style="color:#991b1b;font-weight:600;">👎 Não</span>';
        }

        if (field.type === 'checkbox') {
            try {
                const arr = JSON.parse(answer.value);
                if (Array.isArray(arr)) return arr.map(v => `<span style="background:#f3f4f6;padding:.15rem .5rem;border-radius:999px;font-size:.85rem;margin-right:.3rem;">${escapeHtml(v)}</span>`).join('');
            } catch {}
        }

        return escapeHtml(answer.value || '—');
    }

    // ════════════════════════════════════════════════════════════
    // GRÁFICO (Chart.js)
    // ════════════════════════════════════════════════════════════

    function renderChart(responses) {
        const ctx = document.getElementById('responsesChart').getContext('2d');

        // Agrupa por data (últimos 7 dias)
        const days = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days[d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })] = 0;
        }
        responses.forEach(r => {
            const d = new Date(r.submitted_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
            if (d in days) days[d]++;
        });

        const labels = Object.keys(days);
        const values = Object.values(days);

        if (chart) chart.destroy();
        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Respostas',
                    data: values,
                    backgroundColor: 'rgba(79, 70, 229, 0.7)',
                    borderColor: 'rgba(79, 70, 229, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    // ════════════════════════════════════════════════════════════
    // PAGINAÇÃO
    // ════════════════════════════════════════════════════════════

    function renderPagination() {
        const container = document.getElementById('pagination');
        if (totalPages <= 1) { container.innerHTML = ''; return; }

        let html = '';
        if (currentPage > 1) html += `<button class="page-btn" onclick="goPage(${currentPage-1})">‹ Anterior</button>`;
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
                html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
            } else if (Math.abs(i - currentPage) === 3) {
                html += `<span style="padding:.4rem;">…</span>`;
            }
        }
        if (currentPage < totalPages) html += `<button class="page-btn" onclick="goPage(${currentPage+1})">Próxima ›</button>`;
        container.innerHTML = html;
    }

    window.goPage = (page) => loadResponses(page);

    // ════════════════════════════════════════════════════════════
    // FILTROS
    // ════════════════════════════════════════════════════════════

    window.applyFilter = () => loadResponses(1);
    window.clearFilter = () => {
        const sem = document.getElementById('filterSemester');
        if (sem) sem.value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        loadResponses(1);
    };

    // Auto-preenchimento das datas e acionamento do filtro ao alterar o semestre
    document.getElementById('filterSemester')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const fromInput = document.getElementById('filterDateFrom');
        const toInput = document.getElementById('filterDateTo');
        if (!val) {
            fromInput.value = '';
            toInput.value = '';
            loadResponses(1);
            return;
        }
        const [year, semester] = val.split('-');
        if (semester === '1') {
            fromInput.value = `${year}-01-01`;
            toInput.value = `${year}-06-30`;
        } else if (semester === '2') {
            fromInput.value = `${year}-07-01`;
            toInput.value = `${year}-12-31`;
        }
        loadResponses(1);
    });

    // ════════════════════════════════════════════════════════════
    // SELEÇÃO E EXCLUSÃO EM LOTE
    // ════════════════════════════════════════════════════════════

    window.updateBatchUI = () => {
        const checkboxes = document.querySelectorAll('.response-checkbox');
        const checked = document.querySelectorAll('.response-checkbox:checked');
        const selectAll = document.getElementById('selectAllResponses');
        const batchBar = document.getElementById('batchActionsContainer');
        const selectedCount = document.getElementById('selectedCount');

        if (selectAll) {
            selectAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
        }

        if (batchBar) {
            if (checked.length > 0) {
                selectedCount.textContent = checked.length;
                batchBar.classList.remove('hidden');
            } else {
                batchBar.classList.add('hidden');
            }
        }
    };

    document.getElementById('selectAllResponses')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        document.querySelectorAll('.response-checkbox').forEach(cb => {
            cb.checked = checked;
        });
        updateBatchUI();
    });

    document.getElementById('btnBatchDelete')?.addEventListener('click', async () => {
        const checked = document.querySelectorAll('.response-checkbox:checked');
        const ids = Array.from(checked).map(cb => Number(cb.value));
        if (ids.length === 0) return;

        if (!confirm(`Tem certeza que deseja excluir permanentemente as ${ids.length} resposta(s) selecionada(s)? Esta ação não poderá ser desfeita e removerá todas as respostas dos campos.`)) {
            return;
        }

        try {
            const res = await apiFetch(`/api/forms/${formId}/responses/batch-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            showAlert(data.message, 'success');
            loadResponses(1);
        } catch (e) {
            showAlert(e.message, 'danger');
        }
    });

    // ════════════════════════════════════════════════════════════
    // EXPORTAÇÃO
    // ════════════════════════════════════════════════════════════

    async function exportFile(url) {
        try {
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Erro na exportação.');
            }
            const blob = await res.blob();
            const disposition = res.headers.get('Content-Disposition') || '';
            const match = disposition.match(/filename="([^"]+)"/);
            const filename = match ? match[1] : 'export';

            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (e) { showAlert(e.message, 'danger'); }
    }

    // ════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════

    function apiFetch(url, opts = {}) {
        return fetch(url, {
            ...opts,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(opts.headers || {}) }
        });
    }

    function showAlert(msg, type) {
        const el = document.getElementById('alertMessage');
        el.textContent = msg;
        el.className = `alert alert-${type} show`;
        setTimeout(() => el.classList.remove('show'), 4000);
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
});
