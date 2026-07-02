// public/js/forms.js
// Script da página de listagem de formulários
// Padrão: localStorage.getItem('token') igual ao auth.js e dashboard.js existentes

document.addEventListener('DOMContentLoaded', () => {
    // ── Autenticação ──────────────────────────────────────────────
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!token || !user) { window.location.href = '/login.html'; return; }

    document.getElementById('userNameDisplay').textContent = user.name;

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    });

    // ── Estado ───────────────────────────────────────────────────
    let allForms = [];

    // ── Inicialização ─────────────────────────────────────────────
    loadDashboard();
    loadForms();

    // ── Botão Novo Formulário ─────────────────────────────────────
    document.getElementById('btnNewForm').addEventListener('click', () => {
        window.location.href = '/form-builder.html';
    });

    // ── Filtros ───────────────────────────────────────────────────
    document.getElementById('filterStatus').addEventListener('change', renderForms);
    document.getElementById('filterSearch').addEventListener('input', renderForms);

    // ═══════════════════════════════════════════════════════════════
    // FUNÇÕES PRINCIPAIS
    // ═══════════════════════════════════════════════════════════════

    async function loadDashboard() {
        try {
            const res = await apiFetch('/api/dashboard/forms');
            if (!res.ok) return;
            const data = await res.json();
            document.getElementById('statTotal').textContent = data.totalForms ?? 0;
            document.getElementById('statPublished').textContent = data.publishedForms ?? 0;
            document.getElementById('statDraft').textContent = data.draftForms ?? 0;
            document.getElementById('statResponses').textContent = data.totalResponses ?? 0;
        } catch (e) { console.warn('Erro ao carregar dashboard:', e); }
    }

    async function loadForms() {
        try {
            const res = await apiFetch('/api/forms');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro ao carregar.');
            allForms = data;
            renderForms();
        } catch (e) {
            showAlert(e.message, 'danger');
            document.getElementById('formsGrid').innerHTML = `
                <div class="empty-state"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
        }
    }

    function renderForms() {
        const statusFilter = document.getElementById('filterStatus').value;
        const search = document.getElementById('filterSearch').value.toLowerCase().trim();

        let filtered = allForms.filter(f => {
            if (statusFilter && f.status !== statusFilter) return false;
            if (search && !f.title.toLowerCase().includes(search)) return false;
            return true;
        });

        const grid = document.getElementById('formsGrid');

        if (filtered.length === 0) {
            grid.innerHTML = `<div class="empty-state">
                <div class="empty-icon">${allForms.length === 0 ? '📋' : '🔍'}</div>
                <p>${allForms.length === 0 ? 'Nenhum formulário criado ainda.' : 'Nenhum formulário corresponde ao filtro.'}</p>
                ${allForms.length === 0 ? '<button class="btn btn-primary" onclick="document.getElementById(\'btnNewForm\').click()" style="margin-top:1rem;">Criar primeiro formulário</button>' : ''}
            </div>`;
            return;
        }

        grid.innerHTML = filtered.map(f => renderFormCard(f)).join('');
    }

    function renderFormCard(form) {
        const isPublished = form.status === 'published';
        const deadline = form.deadline
            ? `Prazo: ${new Date(form.deadline).toLocaleString('pt-BR')}`
            : 'Sem prazo';
        const creator = form.creator ? form.creator.name : '—';
        const responses = form.responseCount ?? 0;

        return `
        <div class="form-card ${form.status}" id="card-${form.id}">
            <div class="form-card-header">
                <div class="form-card-title">${escapeHtml(form.title)}</div>
                <span class="badge ${isPublished ? 'badge-resolved' : 'badge-pending'}">
                    ${isPublished ? 'Publicado' : 'Rascunho'}
                </span>
            </div>
            ${form.description ? `<p style="font-size:0.85rem;color:var(--text-muted);line-height:1.4;">${escapeHtml(form.description.substring(0, 80))}${form.description.length > 80 ? '...' : ''}</p>` : ''}
            <div class="form-card-meta">
                <span>📅 ${deadline}</span>
                <span>👤 ${escapeHtml(creator)}</span>
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-top:0.25rem;">
                <span class="response-count">💬 ${responses} resposta${responses !== 1 ? 's' : ''}</span>
                ${form.allow_anonymous ? '<span class="badge" style="background:#f3f4f6;color:#6b7280;font-size:0.7rem;">Anônimo</span>' : ''}
            </div>
            <div class="form-card-actions">
                <button class="btn btn-primary btn-sm" onclick="editForm(${form.id})">✏️ Editar</button>
                <button class="btn btn-sm" style="background:#eef2ff;color:var(--primary);" onclick="viewResponses(${form.id})">💬 Respostas</button>
                <button class="btn btn-secondary btn-sm" onclick="togglePublish(${form.id}, '${form.status}')">
                    ${isPublished ? '📪 Despublicar' : '🚀 Publicar'}
                </button>
                <button class="btn btn-warning btn-sm" onclick="duplicateForm(${form.id})">📋 Duplicar</button>
                <button class="btn btn-sm" style="background:#f3f4f6;color:var(--text-muted);" onclick="shareForm(${form.id})">🔗 Link</button>
                <button class="btn btn-danger btn-sm" onclick="deleteForm(${form.id}, '${escapeHtml(form.title)}')">🗑️</button>
            </div>
        </div>`;
    }

    // ═══════════════════════════════════════════════════════════════
    // AÇÕES DOS CARDS
    // ═══════════════════════════════════════════════════════════════

    window.editForm = (id) => window.location.href = `/form-builder.html?id=${id}`;
    window.viewResponses = (id) => window.location.href = `/form-responses.html?id=${id}`;

    window.togglePublish = async (id, currentStatus) => {
        try {
            const res = await apiFetch(`/api/forms/${id}/publish`, { method: 'PATCH' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showAlert(data.message, 'success');
            await loadForms();
            await loadDashboard();
        } catch (e) { showAlert(e.message, 'danger'); }
    };

    window.duplicateForm = async (id) => {
        try {
            const res = await apiFetch(`/api/forms/${id}/duplicate`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showAlert(`Formulário duplicado: "${data.title}"`, 'success');
            await loadForms();
            await loadDashboard();
        } catch (e) { showAlert(e.message, 'danger'); }
    };

    window.deleteForm = async (id, title) => {
        if (!confirm(`Excluir "${title}"?\n\nTodas as respostas serão perdidas permanentemente.`)) return;
        try {
            const res = await apiFetch(`/api/forms/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showAlert('Formulário excluído.', 'success');
            await loadForms();
            await loadDashboard();
        } catch (e) { showAlert(e.message, 'danger'); }
    };

    window.shareForm = (id) => {
        const link = `${window.location.origin}/form-view.html?id=${id}`;
        document.getElementById('shareLinkInput').value = link;
        document.getElementById('shareOverlay').classList.remove('hidden');
        document.getElementById('shareModal').classList.remove('hidden');
    };

    window.closeShareModal = () => {
        document.getElementById('shareOverlay').classList.add('hidden');
        document.getElementById('shareModal').classList.add('hidden');
    };

    window.copyShareLink = () => {
        const input = document.getElementById('shareLinkInput');
        input.select();
        navigator.clipboard.writeText(input.value).then(() => {
            showAlert('Link copiado para a área de transferência!', 'success');
        });
    };

    // ═══════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════

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
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
});
