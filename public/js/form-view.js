// public/js/form-view.js
// Script da página pública de resposta ao formulário
// Renderiza dinamicamente todos os 16 tipos de campo
// CHA: escala fixa 2.5/5.0/7.5/10.0 com rótulos Inicial/Em desenvolvimento/Adequado/Proficiente

document.addEventListener('DOMContentLoaded', () => {
    // ── Parâmetros ───────────────────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    const formId = params.get('id');
    if (!formId) { showUnavailable('ID do formulário não informado.'); return; }

    // Objeto que armazena as respostas do usuário: { fieldId: value }
    const answers = {};
    let formData = null;

    // ── Escala CHA (fixa — não editável pelo usuário) ─────────────
    const CHA_SCALE = [
        { value: 2.5,  label: 'Inicial' },
        { value: 5.0,  label: 'Em desenvolvimento' },
        { value: 7.5,  label: 'Adequado' },
        { value: 10.0, label: 'Proficiente' }
    ];

    // ── Inicialização ─────────────────────────────────────────────
    loadForm();

    document.getElementById('btnSubmit').addEventListener('click', submitForm);
    document.getElementById('btnReset').addEventListener('click', resetForm);

    // ════════════════════════════════════════════════════════════
    // CARREGAR E RENDERIZAR FORMULÁRIO
    // ════════════════════════════════════════════════════════════

    async function loadForm() {
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
            const res = await fetch(`/api/forms/${formId}`, { headers });
            const data = await res.json();

            if (!res.ok) { showUnavailable(data.error || 'Formulário não encontrado.'); return; }
            if (data.status !== 'published') { showUnavailable('Este formulário não está disponível para respostas.'); return; }

            // Verifica prazo de abertura e encerramento
            if (data.start_date && new Date() < new Date(data.start_date)) {
                showUnavailable(`Este formulário estará disponível para respostas a partir de ${new Date(data.start_date).toLocaleString('pt-BR')}.`);
                return;
            }
            if (data.deadline && new Date() > new Date(data.deadline)) {
                showUnavailable(`O prazo para resposta encerrou em ${new Date(data.deadline).toLocaleString('pt-BR')}.`);
                return;
            }

            formData = data;

            // Preenche cabeçalho
            document.getElementById('formTitle').textContent = data.title;
            document.title = `${data.title} | Portal de Atividades`;
            const descEl = document.getElementById('formDescription');
            descEl.textContent = data.description || '';
            if (!data.description) descEl.style.display = 'none';

            // Meta info
            const metaEl = document.getElementById('formMeta');
            const parts = [];
            if (data.start_date) parts.push(`🛫 Abertura: ${new Date(data.start_date).toLocaleString('pt-BR')}`);
            if (data.deadline) parts.push(`📅 Encerramento: ${new Date(data.deadline).toLocaleString('pt-BR')}`);
            if (data.allow_anonymous) parts.push('👤 Respostas anônimas aceitas');
            metaEl.innerHTML = parts.map(p => `<span>${p}</span>`).join('');

            // Renderiza campos
            const fields = (data.fields || []).sort((a, b) => a.position - b.position);
            const container = document.getElementById('fieldsContainer');

            let identificationHtml = '';
            if (!data.allow_anonymous) {
                identificationHtml = `
                <div class="field-card-view" id="identification-section" style="border-left: 4px solid #ef4444;">
                    <span style="font-weight: 700; color: #ef4444; font-size: 0.82rem; text-transform: uppercase; display: block; margin-bottom: 0.75rem; letter-spacing: 0.05em;">
                        🔒 Identificação Requerida
                    </span>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
                        Este formulário não aceita respostas anônimas. Por favor, forneça sua identificação abaixo.
                    </p>
                    <div class="form-group" style="margin-bottom: 1.25rem;">
                        <label class="field-label" for="respondentName">Nome Completo <span class="field-required">*</span></label>
                        <input type="text" class="form-control" id="respondentName" placeholder="Seu nome completo..." required>
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                        <label class="field-label" for="respondentIdentifier">Matrícula / Documento (RA, DRT ou CPF) <span class="field-required">*</span></label>
                        <input type="text" class="form-control" id="respondentIdentifier" placeholder="Digite seu RA, DRT ou CPF..." required>
                    </div>
                </div>
                `;
            }

            container.innerHTML = identificationHtml + fields.map(f => renderField(f)).join('');

            // Inicializa controles interativos
            fields.forEach(f => initFieldInteractions(f));

            document.getElementById('formScreen').classList.remove('hidden');
        } catch (e) {
            showUnavailable('Erro ao carregar o formulário. Tente novamente.');
            console.error(e);
        }
    }

    // ════════════════════════════════════════════════════════════
    // RENDERIZAR CADA TIPO DE CAMPO
    // ════════════════════════════════════════════════════════════

    function renderField(field) {
        const required = field.required ? '<span class="field-required" title="Obrigatório"> *</span>' : '';
        const help = field.help_text
            ? `<div class="field-help">${escapeHtml(field.help_text)}</div>` : '';

        let control = '';
        switch (field.type) {
            case 'short_text':
                control = `<input type="text" class="form-control" id="field-${field.id}"
                    placeholder="${escapeAttr(field.placeholder || '')}"
                    oninput="setAnswer(${field.id}, this.value)">`;
                break;
            case 'long_text':
                control = `<textarea class="form-control" id="field-${field.id}" rows="4"
                    placeholder="${escapeAttr(field.placeholder || '')}"
                    oninput="setAnswer(${field.id}, this.value)"></textarea>`;
                break;
            case 'number':
                control = `<input type="number" class="form-control" id="field-${field.id}"
                    placeholder="${escapeAttr(field.placeholder || '')}"
                    oninput="setAnswer(${field.id}, this.value)">`;
                break;
            case 'date':
                control = `<input type="date" class="form-control" id="field-${field.id}"
                    onchange="setAnswer(${field.id}, this.value)">`;
                break;
            case 'time':
                control = `<input type="time" class="form-control" id="field-${field.id}"
                    onchange="setAnswer(${field.id}, this.value)">`;
                break;
            case 'email':
                control = `<input type="email" class="form-control" id="field-${field.id}"
                    placeholder="${escapeAttr(field.placeholder || 'seu@email.com')}"
                    oninput="setAnswer(${field.id}, this.value)">`;
                break;
            case 'phone':
                control = `<input type="tel" class="form-control" id="field-${field.id}"
                    placeholder="${escapeAttr(field.placeholder || '(11) 99999-9999')}"
                    oninput="setAnswer(${field.id}, this.value)">`;
                break;
            case 'radio': {
                const opts = Array.isArray(field.options) ? field.options : [];
                control = opts.map(opt => `
                    <label class="radio-option">
                        <input type="radio" name="field-${field.id}" value="${escapeAttr(opt.value || opt.label)}"
                            onchange="setAnswer(${field.id}, this.value)">
                        ${escapeHtml(opt.label)}
                    </label>`).join('');
                break;
            }
            case 'checkbox': {
                const opts = Array.isArray(field.options) ? field.options : [];
                control = opts.map((opt, i) => `
                    <label class="checkbox-option">
                        <input type="checkbox" id="field-${field.id}-${i}" value="${escapeAttr(opt.value || opt.label)}"
                            onchange="updateCheckbox(${field.id})">
                        ${escapeHtml(opt.label)}
                    </label>`).join('');
                break;
            }
            case 'select': {
                const opts = Array.isArray(field.options) ? field.options : [];
                control = `<select class="form-control" id="field-${field.id}" onchange="setAnswer(${field.id}, this.value)">
                    <option value="">Selecione...</option>
                    ${opts.map(opt => `<option value="${escapeAttr(opt.value || opt.label)}">${escapeHtml(opt.label)}</option>`).join('')}
                </select>`;
                break;
            }
            case 'file':
                control = `<input type="file" class="form-control" id="field-${field.id}"
                    style="padding:.4rem;">`;
                break;
            case 'star_rating':
                // 4 estrelas — não 5
                control = `<div class="star-rating" id="star-${field.id}" role="group" aria-label="Avaliação de 1 a 4 estrelas">
                    ${[1,2,3,4].map(n => `
                    <button type="button" class="star-btn" data-value="${n}"
                        onclick="selectStar(${field.id}, ${n})"
                        title="${n} estrela${n > 1 ? 's' : ''}"
                        aria-label="${n} estrela${n > 1 ? 's' : ''}">⭐</button>`).join('')}
                    <span id="star-label-${field.id}" style="font-size:.85rem;color:var(--text-muted);margin-left:.5rem;"></span>
                </div>`;
                break;
            case 'scale':
                control = `<div>
                    <div class="scale-container" id="scale-${field.id}" role="group" aria-label="Escala de 0 a 10">
                        ${[0,1,2,3,4,5,6,7,8,9,10].map(n => `
                        <button type="button" class="scale-btn" data-value="${n}"
                            onclick="selectScale(${field.id}, ${n})"
                            title="Nota ${n}" aria-label="Nota ${n}">${n}</button>`).join('')}
                    </div>
                    <div class="scale-labels"><span>Discordo totalmente</span><span>Concordo totalmente</span></div>
                </div>`;
                break;
            case 'yes_no':
                control = `<div class="yes-no-container" id="yesno-${field.id}">
                    <button type="button" class="yes-no-btn yes"
                        onclick="selectYesNo(${field.id}, 'sim')">👍 Sim</button>
                    <button type="button" class="yes-no-btn no"
                        onclick="selectYesNo(${field.id}, 'não')">👎 Não</button>
                </div>`;
                break;
            case 'cha': {
                const opts = field.options || {};
                control = `<div class="cha-container" id="cha-${field.id}">
                    ${['c','h','a'].map(dim => {
                        const dimLabel = opts[`${dim}_label`] || { c:'Competência', h:'Habilidade', a:'Atitude' }[dim];
                        const dimTitle = { c:'C — Competência', h:'H — Habilidade', a:'A — Atitude' }[dim];
                        return `
                        <div class="cha-dimension" id="cha-dim-${field.id}-${dim}">
                            <div class="cha-dimension-title">${dimTitle}</div>
                            <div style="font-size:.8rem; color:var(--text-muted); margin-bottom:.5rem;">${escapeHtml(dimLabel)}</div>
                            <div class="cha-options">
                                ${CHA_SCALE.map(opt => `
                                <button type="button" class="cha-option-btn"
                                    data-field="${field.id}" data-dim="${dim}" data-value="${opt.value}"
                                    onclick="selectCha(${field.id}, '${dim}', ${opt.value})">
                                    <span class="cha-note-value">${opt.value.toFixed(1).replace('.',',')}</span>
                                    <span class="cha-note-label">${opt.label}</span>
                                </button>`).join('')}
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
                break;
            }
            default:
                control = `<input type="text" class="form-control" id="field-${field.id}"
                    oninput="setAnswer(${field.id}, this.value)">`;
        }

        return `
        <div class="field-card-view" id="field-container-${field.id}">
            <span class="field-label">${escapeHtml(field.label)}${required}</span>
            ${control}
            ${help}
            <div class="field-error" id="error-${field.id}"
                style="color:var(--danger);font-size:.8rem;margin-top:.25rem;display:none;"></div>
        </div>`;
    }

    function initFieldInteractions(field) {
        // Nada extra necessário — interações são via onclick inline
    }

    // ════════════════════════════════════════════════════════════
    // INTERAÇÕES COM CAMPOS ESPECIAIS
    // ════════════════════════════════════════════════════════════

    window.setAnswer = (fieldId, value) => { answers[fieldId] = value; };

    window.updateCheckbox = (fieldId) => {
        const checked = [...document.querySelectorAll(`input[id^="field-${fieldId}-"]:checked`)]
            .map(el => el.value);
        answers[fieldId] = checked;
    };

    // Estrelas 1–4
    window.selectStar = (fieldId, value) => {
        answers[fieldId] = String(value);
        const btns = document.querySelectorAll(`#star-${fieldId} .star-btn`);
        btns.forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.value) <= value));
        const label = document.getElementById(`star-label-${fieldId}`);
        if (label) label.textContent = `${value} estrela${value > 1 ? 's' : ''}`;
    };

    // Escala 0–10
    window.selectScale = (fieldId, value) => {
        answers[fieldId] = String(value);
        document.querySelectorAll(`#scale-${fieldId} .scale-btn`)
            .forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.value) === value));
    };

    // Sim / Não
    window.selectYesNo = (fieldId, value) => {
        answers[fieldId] = value;
        document.querySelectorAll(`#yesno-${fieldId} .yes-no-btn`).forEach(btn => {
            btn.classList.toggle('active', btn.classList.contains(value === 'sim' ? 'yes' : 'no'));
        });
    };

    // CHA — escala fixa, sem entrada livre
    // Atualiza objeto cha para o campo
    const chaValues = {};  // { fieldId: { c, h, a } }
    window.selectCha = (fieldId, dim, value) => {
        if (!chaValues[fieldId]) chaValues[fieldId] = {};
        chaValues[fieldId][dim] = value;
        // Salva no answers como objeto { c, h, a }
        answers[fieldId] = { ...chaValues[fieldId] };
        // Atualiza botões visuais
        document.querySelectorAll(
            `[data-field="${fieldId}"][data-dim="${dim}"].cha-option-btn`
        ).forEach(btn => btn.classList.toggle('active', parseFloat(btn.dataset.value) === value));
    };

    // ════════════════════════════════════════════════════════════
    // VALIDAÇÃO E ENVIO
    // ════════════════════════════════════════════════════════════

    function validateForm() {
        let valid = true;

        // Validação da seção de identificação (se aplicável)
        if (formData && !formData.allow_anonymous) {
            const nameInput = document.getElementById('respondentName');
            const identInput = document.getElementById('respondentIdentifier');
            const identificationSection = document.getElementById('identification-section');

            if (identificationSection) {
                identificationSection.style.borderLeft = '4px solid #ef4444';
            }

            if (!nameInput || !nameInput.value.trim()) {
                if (nameInput) nameInput.style.borderColor = '#ef4444';
                valid = false;
            } else {
                if (nameInput) nameInput.style.borderColor = '';
            }

            if (!identInput || !identInput.value.trim()) {
                if (identInput) identInput.style.borderColor = '#ef4444';
                valid = false;
            } else {
                if (identInput) identInput.style.borderColor = '';
            }
        }

        const fields = (formData?.fields || []);
        fields.forEach(field => {
            clearError(field.id);
            if (!field.required) return;

            const val = answers[field.id];
            let empty = false;

            if (field.type === 'cha') {
                const cha = val || {};
                if (!cha.c || !cha.h || !cha.a) empty = true;
            } else if (field.type === 'checkbox') {
                if (!val || val.length === 0) empty = true;
            } else if (field.type === 'file') {
                const fileInput = document.getElementById(`field-${field.id}`);
                if (!fileInput || !fileInput.files || fileInput.files.length === 0) empty = true;
            } else {
                if (val === undefined || val === null || val === '') empty = true;
            }

            if (empty) {
                showError(field.id, 'Este campo é obrigatório.');
                valid = false;
            }

            // Validação de email
            if (field.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                showError(field.id, 'E-mail inválido.');
                valid = false;
            }
        });
        return valid;
    }

    async function submitForm() {
        if (!validateForm()) {
            showAlert('Preencha todos os campos obrigatórios e de identificação.', 'danger');
            // Scroll até o primeiro erro de identificação ou de campo
            const firstInputError = document.querySelector('input[style*="border-color"]');
            if (firstInputError) {
                firstInputError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                const firstError = document.querySelector('.field-error[style*="block"]');
                if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        const btn = document.getElementById('btnSubmit');
        btn.disabled = true;
        btn.innerHTML = '<div class="loader" style="width:18px;height:18px;border-width:3px;"></div> Enviando...';

        try {
            const formEl = document.createElement('form');
            const formDataObj = new FormData();
            
            // Adiciona dados de identificação caso não seja anônimo
            if (!formData.allow_anonymous) {
                formDataObj.append('respondent_name', document.getElementById('respondentName').value.trim());
                formDataObj.append('respondent_identifier', document.getElementById('respondentIdentifier').value.trim());
            }

            const answersPayload = {};
            const fields = formData?.fields || [];

            fields.forEach(field => {
                if (field.type === 'file') {
                    const fileInput = document.getElementById(`field-${field.id}`);
                    if (fileInput && fileInput.files[0]) {
                        formDataObj.append(`file_${field.id}`, fileInput.files[0]);
                    }
                } else {
                    answersPayload[field.id] = answers[field.id] ?? null;
                }
            });

            formDataObj.append('answers', JSON.stringify(answersPayload));

            // Adiciona token se logado
            const token = localStorage.getItem('token');
            const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

            const res = await fetch(`/api/forms/${formId}/submit`, {
                method: 'POST',
                headers,
                body: formDataObj
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Mostra tela de sucesso
            document.getElementById('formScreen').classList.add('hidden');
            document.getElementById('successScreen').classList.remove('hidden');
            document.getElementById('successDetail').textContent = `Protocolo: #${data.responseId}`;
        } catch (e) {
            showAlert(e.message, 'danger');
            btn.disabled = false;
            btn.innerHTML = 'Enviar Resposta';
        }
    }

    function resetForm() {
        Object.keys(answers).forEach(k => delete answers[k]);
        document.querySelectorAll('.form-control').forEach(el => { el.value = ''; });
        document.querySelectorAll('.star-btn, .scale-btn, .yes-no-btn, .cha-option-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(el => { el.checked = false; });
        document.querySelectorAll('.field-error').forEach(el => { el.style.display = 'none'; });
        Object.keys(chaValues).forEach(k => delete chaValues[k]);
    }

    // ════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════

    function showUnavailable(msg) {
        document.getElementById('unavailableMsg').textContent = msg;
        document.getElementById('unavailableScreen').classList.remove('hidden');
    }

    function showError(fieldId, msg) {
        const el = document.getElementById(`error-${fieldId}`);
        if (el) { el.textContent = msg; el.style.display = 'block'; }
        const container = document.getElementById(`field-container-${fieldId}`);
        if (container) container.style.borderLeft = '3px solid var(--danger)';
    }

    function clearError(fieldId) {
        const el = document.getElementById(`error-${fieldId}`);
        if (el) { el.textContent = ''; el.style.display = 'none'; }
        const container = document.getElementById(`field-container-${fieldId}`);
        if (container) container.style.borderLeft = '';
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
    function escapeAttr(str) { return String(str || '').replace(/"/g,'&quot;'); }
});
