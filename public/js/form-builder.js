// public/js/form-builder.js
// Editor visual de formulários com drag-and-drop e salvamento automático
// Suporta todos os 16 tipos de campo incluindo CHA

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

    // ── Estado do editor ─────────────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    let formId = params.get('id') || null;
    let formStatus = 'draft';
    let fields = [];
    let autoSaveTimer = null;
    let isDirty = false;

    // ── Inicialização ─────────────────────────────────────────────
    if (formId) {
        loadForm(formId);
    } else {
        setAutosaveStatus('Novo formulário');
        updateFieldCount();
    }

    // ── Eventos da toolbar ────────────────────────────────────────
    document.getElementById('btnSave').addEventListener('click', () => saveForm());
    document.getElementById('btnPublish').addEventListener('click', togglePublish);
    document.getElementById('btnPreview').addEventListener('click', previewForm);

    // Salvamento automático ao alterar qualquer campo de metadados
    ['formTitle', 'formDescription', 'formEvaluator', 'formEvaluated', 'formStartDate', 'formDeadline', 'formAllowEdit']
        .forEach(id => document.getElementById(id)?.addEventListener('input', scheduleSave));

    // ════════════════════════════════════════════════════════════
    // LOAD / SAVE
    // ════════════════════════════════════════════════════════════

    async function loadForm(id) {
        try {
            setAutosaveStatus('Carregando...');
            const res = await apiFetch(`/api/forms/${id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Preenche metadados
            document.getElementById('formTitle').value = data.title || '';
            document.getElementById('formDescription').value = data.description || '';
            document.getElementById('formEvaluator').value = data.evaluator_type || '';
            document.getElementById('formEvaluated').value = data.evaluated_type || '';
            document.getElementById('formStartDate').value = data.start_date
                ? new Date(data.start_date).toISOString().slice(0,16) : '';
            document.getElementById('formDeadline').value = data.deadline
                ? new Date(data.deadline).toISOString().slice(0,16) : '';
            document.getElementById('formAllowEdit').checked = !!data.allow_edit_response;
            document.getElementById('formIdInfo').textContent = `ID: ${data.id}`;
            document.getElementById('toolbarTitle').textContent = data.title;

            formStatus = data.status;
            updateStatusBadge();

            // Carrega campos
            fields = (data.fields || []).map(f => {
                if (typeof f.options === 'string') {
                    try { f.options = JSON.parse(f.options); } catch (e) {}
                }
                return f;
            }).sort((a, b) => a.position - b.position);
            renderAllFields();
            const now = new Date();
            setAutosaveStatus(`Atualizado em: ${now.toLocaleTimeString('pt-BR')}`);
        } catch (e) {
            showAlert(e.message, 'danger');
        }
    }

    async function saveForm(silent = false) {
        const title = document.getElementById('formTitle').value.trim();
        if (!title) {
            if (!silent) showAlert('O título é obrigatório.', 'danger');
            return false;
        }

        const payload = {
            title,
            description: document.getElementById('formDescription').value.trim(),
            evaluator_type: document.getElementById('formEvaluator').value.trim() || null,
            evaluated_type: document.getElementById('formEvaluated').value.trim() || null,
            start_date: document.getElementById('formStartDate').value || null,
            deadline: document.getElementById('formDeadline').value || null,
            allow_anonymous: false,
            allow_edit_response: document.getElementById('formAllowEdit').checked
        };

        try {
            setAutosaveStatus('Salvando...');
            let res, data;

            if (formId) {
                // Atualizar metadados
                res = await apiFetch(`/api/forms/${formId}`, { method: 'PUT', body: JSON.stringify(payload) });
                data = await res.json();
                if (!res.ok) throw new Error(data.error);

                // Salvar campos
                const fieldsRes = await apiFetch(`/api/forms/${formId}/fields`, {
                    method: 'POST',
                    body: JSON.stringify({ fields })
                });
                const fieldsData = await fieldsRes.json();
                if (!fieldsRes.ok) throw new Error(fieldsData.error);
                
                // Atualiza os IDs no array local para sincronizar com o BD sem perder referências do DOM
                if (fieldsData.fields && fieldsData.fields.length === fields.length) {
                    fields.forEach((f, idx) => {
                        f.id = fieldsData.fields[idx].id;
                    });
                } else {
                    fields = fieldsData.fields || fields;
                }

                // Apenas renderiza novamente caso NÃO seja autosave silencioso (previne perda de foco ao digitar)
                if (!silent) {
                    renderAllFields();
                }
            } else {
                // Criar novo form com campos
                res = await apiFetch('/api/forms', { method: 'POST', body: JSON.stringify({ ...payload, fields }) });
                data = await res.json();
                if (!res.ok) throw new Error(data.error);
                formId = data.id;
                formStatus = data.status;
                fields = data.fields || fields;
                history.replaceState(null, '', `/form-builder.html?id=${formId}`);
                document.getElementById('formIdInfo').textContent = `ID: ${formId}`;
                updateStatusBadge();
                renderAllFields();
            }

            document.getElementById('toolbarTitle').textContent = title;
            const now = new Date();
            setAutosaveStatus(`Atualizado em: ${now.toLocaleTimeString('pt-BR')}`);
            isDirty = false;
            if (!silent) showAlert('Formulário salvo com sucesso!', 'success');
            return true;
        } catch (e) {
            setAutosaveStatus('Erro ao salvar');
            if (!silent) showAlert(e.message, 'danger');
            return false;
        }
    }

    function scheduleSave() {
        isDirty = true;
        setAutosaveStatus('Aguardando...');
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => saveForm(true), 2000);
    }

    // ════════════════════════════════════════════════════════════
    // PUBLICAR / DESPUBLICAR
    // ════════════════════════════════════════════════════════════

    async function togglePublish() {
        if (!formId) {
            const saved = await saveForm();
            if (!saved) return;
        }
        try {
            const res = await apiFetch(`/api/forms/${formId}/publish`, { method: 'PATCH' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            formStatus = data.status;
            updateStatusBadge();
            showAlert(data.message, 'success');
        } catch (e) { showAlert(e.message, 'danger'); }
    }

    function updateStatusBadge() {
        const badge = document.getElementById('statusBadge');
        const btn = document.getElementById('btnPublish');
        if (formStatus === 'published') {
            badge.className = 'status-badge-toolbar status-published';
            badge.textContent = 'Publicado';
            btn.textContent = '📪 Despublicar';
        } else {
            badge.className = 'status-badge-toolbar status-draft';
            badge.textContent = 'Rascunho';
            btn.textContent = '🚀 Publicar';
        }
    }

    // ════════════════════════════════════════════════════════════
    // PRÉ-VISUALIZAÇÃO
    // ════════════════════════════════════════════════════════════

    function previewForm() {
        if (!formId) { showAlert('Salve o formulário antes de pré-visualizar.', 'danger'); return; }
        window.open(`/form-view.html?id=${formId}`, '_blank');
    }

    // ════════════════════════════════════════════════════════════
    // GERENCIAR CAMPOS
    // ════════════════════════════════════════════════════════════

    const FIELD_TYPES = {
        short_text: { label: 'Texto Curto', icon: 'T' },
        long_text:  { label: 'Texto Longo', icon: '¶' },
        number:     { label: 'Número', icon: '#' },
        date:       { label: 'Data', icon: '📅' },
        time:       { label: 'Hora', icon: '🕐' },
        email:      { label: 'E-mail', icon: '@' },
        phone:      { label: 'Telefone', icon: '📞' },
        radio:      { label: 'Seleção Única', icon: '○' },
        checkbox:   { label: 'Múltipla Escolha', icon: '☑' },
        select:     { label: 'Lista Suspensa', icon: '▾' },
        file:       { label: 'Upload de Arquivo', icon: '📎' },
        star_rating:{ label: 'Estrelas (1–4)', icon: '⭐' },
        scale:      { label: 'Escala (0–10)', icon: '📊' },
        yes_no:     { label: 'Sim / Não', icon: '✓✗' },
        cha:        { label: 'Avaliação CHA', icon: '🎓' }
    };

    // Expõe addField globalmente (chamado pelos botões do toolbox no HTML)
    window.addField = (type) => {
        const newField = {
            _key: Date.now() + Math.random(),  // chave única local
            id: null,
            type,
            label: `${FIELD_TYPES[type]?.label || type}`,
            placeholder: '',
            required: false,
            default_value: '',
            help_text: '',
            options: getDefaultOptions(type),
            position: fields.length
        };
        fields.push(newField);
        renderAllFields();
        scheduleSave();
        // Scroll até o novo campo
        setTimeout(() => {
            const last = document.querySelector('#fieldsList .field-card:last-child');
            if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    function getDefaultOptions(type) {
        if (['radio', 'checkbox', 'select'].includes(type)) {
            return [{ label: 'Opção 1', value: 'opcao_1' }];
        }
        if (type === 'cha') {
            return { c_label: 'Competência', h_label: 'Habilidade', a_label: 'Atitude' };
        }
        return null;
    }

    window.removeField = (key) => {
        fields = fields.filter(f => (f._key || f.id) != key);
        renderAllFields();
        scheduleSave();
    };

    window.updateField = (key, prop, value) => {
        const field = fields.find(f => (f._key || f.id) == key);
        if (field) { field[prop] = value; scheduleSave(); }
    };

    function renderAllFields() {
        const container = document.getElementById('fieldsList');
        const dropZone = document.getElementById('dropZone');

        if (fields.length === 0) {
            container.innerHTML = '';
            if (dropZone) dropZone.classList.remove('hidden');
            else container.innerHTML = `<div class="drop-zone" id="dropZone">
                <div style="font-size:2.5rem;margin-bottom:.75rem;">📋</div>
                <p style="font-weight:500;">Nenhum campo ainda</p>
                <p style="font-size:.85rem;margin-top:.5rem;">Clique em um tipo à direita para adicionar</p>
            </div>`;
            updateFieldCount();
            return;
        }

        container.innerHTML = fields.map((f, i) => renderFieldCard(f, i)).join('');
        updateFieldCount();
        initDragAndDrop();
    }

    function renderFieldCard(field, index) {
        const key = field._key || field.id;
        const typeInfo = FIELD_TYPES[field.type] || { label: field.type, icon: '?' };
        const hasOptions = ['radio', 'checkbox', 'select'].includes(field.type);
        const isCha = field.type === 'cha';

        return `
        <div class="field-card" draggable="true" data-key="${key}" data-index="${index}">
            <div class="field-card-header">
                <span class="drag-handle" title="Arrastar para reordenar">⠿</span>
                <span class="field-type-badge">${typeInfo.icon} ${typeInfo.label}</span>
                <div class="field-actions">
                    <button class="btn btn-danger btn-sm" onclick="removeField('${key}')">Apagar</button>
                </div>
            </div>

            <div class="form-group" style="margin-bottom:.75rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.25rem;">
                    <label style="font-size:.8rem; margin:0;">Pergunta / Rótulo *</label>
                    <label style="display:flex; align-items:center; gap:.3rem; cursor:pointer; font-size:.8rem; margin:0; font-weight:600; color:var(--text-muted);">
                        <input type="checkbox" ${field.required ? 'checked' : ''}
                            onchange="updateField('${key}', 'required', this.checked)">
                        Obrigatório
                    </label>
                </div>
                <input type="text" class="form-control" value="${escapeAttr(field.label)}"
                    oninput="updateField('${key}', 'label', this.value)"
                    placeholder="Digite a pergunta...">
            </div>

            ${!isCha ? `
            <div style="display:flex; gap:.75rem; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:180px; margin-bottom:.5rem;">
                    <label style="font-size:.8rem;">Placeholder</label>
                    <input type="text" class="form-control" value="${escapeAttr(field.placeholder || '')}"
                        oninput="updateField('${key}', 'placeholder', this.value)"
                        placeholder="Texto de exemplo...">
                </div>
            </div>
            <div class="form-group" style="margin-bottom:.5rem;">
                <label style="font-size:.8rem;">Texto de Ajuda</label>
                <input type="text" class="form-control" value="${escapeAttr(field.help_text || '')}"
                    oninput="updateField('${key}', 'help_text', this.value)"
                    placeholder="Dica exibida abaixo do campo...">
            </div>` : ''}

            ${hasOptions ? renderOptionsEditor(key, field) : ''}
            ${isCha ? renderChaEditor(key, field) : ''}
        </div>`;
    }

    function renderOptionsEditor(key, field) {
        const opts = Array.isArray(field.options) ? field.options : [];
        return `
        <div style="margin-top:.5rem;">
            <label style="font-size:.8rem; font-weight:500;">Opções</label>
            <div class="options-list" id="opts-${key}">
                ${opts.map((opt, i) => `
                <div class="option-item">
                    <input type="text" class="form-control" value="${escapeAttr(opt.label)}"
                        oninput="updateOption('${key}', ${i}, 'label', this.value)"
                        placeholder="Opção ${i + 1}" style="font-size:.85rem;">
                    <button class="btn btn-danger btn-sm" onclick="removeOption('${key}', ${i})" title="Remover">✕</button>
                </div>`).join('')}
            </div>
            <button class="add-option-btn" onclick="addOption('${key}')">＋ Adicionar opção</button>
        </div>`;
    }

    function renderChaEditor(key, field) {
        const opts = field.options || {};
        return `
        <div style="margin-top:.5rem;">
            <label style="font-size:.8rem; font-weight:600; color:var(--primary);">
                🎓 Rótulos das dimensões CHA
            </label>
            <p style="font-size:.75rem; color:var(--text-muted); margin:.25rem 0 .75rem;">
                Escala fixa: 2,5 Inicial · 5,0 Em desenvolvimento · 7,5 Adequado · 10,0 Proficiente
            </p>
            <div class="cha-editor-row">
                <label>C</label>
                <input type="text" class="form-control" value="${escapeAttr(opts.c_label || 'Competência')}"
                    oninput="updateChaLabel('${key}', 'c_label', this.value)"
                    placeholder="Ex.: Conhecimento técnico">
            </div>
            <div class="cha-editor-row">
                <label>H</label>
                <input type="text" class="form-control" value="${escapeAttr(opts.h_label || 'Habilidade')}"
                    oninput="updateChaLabel('${key}', 'h_label', this.value)"
                    placeholder="Ex.: Aplicação prática">
            </div>
            <div class="cha-editor-row">
                <label>A</label>
                <input type="text" class="form-control" value="${escapeAttr(opts.a_label || 'Atitude')}"
                    oninput="updateChaLabel('${key}', 'a_label', this.value)"
                    placeholder="Ex.: Proatividade">
            </div>
        </div>`;
    }

    // Opções de radio/checkbox/select
    window.addOption = (key) => {
        const field = fields.find(f => (f._key || f.id) == key);
        if (!field) return;
        if (!Array.isArray(field.options)) field.options = [];
        const n = field.options.length + 1;
        field.options.push({ label: `Opção ${n}`, value: `opcao_${n}` });
        renderAllFields();
        scheduleSave();
    };

    window.removeOption = (key, index) => {
        const field = fields.find(f => (f._key || f.id) == key);
        if (!field || !Array.isArray(field.options)) return;
        field.options.splice(index, 1);
        renderAllFields();
        scheduleSave();
    };

    window.updateOption = (key, index, prop, value) => {
        const field = fields.find(f => (f._key || f.id) == key);
        if (!field || !Array.isArray(field.options)) return;
        field.options[index][prop] = value;
        if (prop === 'label') field.options[index].value = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        scheduleSave();
    };

    window.updateChaLabel = (key, prop, value) => {
        const field = fields.find(f => (f._key || f.id) == key);
        if (!field) return;
        if (!field.options || typeof field.options !== 'object') field.options = {};
        field.options[prop] = value;
        scheduleSave();
    };

    // ════════════════════════════════════════════════════════════
    // DRAG AND DROP (HTML5 Drag API)
    // ════════════════════════════════════════════════════════════

    function initDragAndDrop() {
        const cards = document.querySelectorAll('#fieldsList .field-card');
        let dragSrc = null;

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                dragSrc = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.dataset.index);
            });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); dragSrc = null; });
            card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; card.classList.add('drag-over'); });
            card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (dragSrc && dragSrc !== card) {
                    const fromIdx = parseInt(dragSrc.dataset.index);
                    const toIdx = parseInt(card.dataset.index);
                    const moved = fields.splice(fromIdx, 1)[0];
                    fields.splice(toIdx, 0, moved);
                    // Atualiza posições
                    fields.forEach((f, i) => { f.position = i; });
                    renderAllFields();
                    scheduleSave();
                }
            });
        });
    }

    // ════════════════════════════════════════════════════════════
    // HELPERS UI
    // ════════════════════════════════════════════════════════════

    function updateFieldCount() {
        document.getElementById('fieldCount').textContent = fields.length;
    }

    function setAutosaveStatus(msg) {
        document.getElementById('autosaveIndicator').innerHTML =
            `<div class="autosave-dot"></div> ${msg}`;
    }

    function showAlert(msg, type) {
        const el = document.getElementById('alertMessage');
        el.textContent = msg;
        el.className = `alert alert-${type} show`;
        setTimeout(() => el.classList.remove('show'), 4000);
    }

    function apiFetch(url, opts = {}) {
        return fetch(url, {
            ...opts,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(opts.headers || {}) }
        });
    }

    function escapeAttr(str) { return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
});
