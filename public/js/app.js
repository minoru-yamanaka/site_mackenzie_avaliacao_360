document.addEventListener('DOMContentLoaded', () => {
    const disciplinaSelect = document.getElementById('disciplina');
    const professorSelect = document.getElementById('professor');
    const form = document.getElementById('submissionForm');
    const alertDiv = document.getElementById('alertMessage');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');

    // Máscara para DRT/RA (apenas números)
    const drtInput = document.getElementById('drt');
    if (drtInput) {
        drtInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }

    // Carregar disciplinas
    fetch('/api/public/subjects')
        .then(res => res.json())
        .then(data => {
            data.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id;
                option.textContent = sub.name;
                disciplinaSelect.appendChild(option);
            });
        })
        .catch(err => showAlert('Erro ao carregar disciplinas.', 'danger'));

    // Carregar turmas
    const turmaSelect = document.getElementById('turma');
    fetch('/api/public/classes')
        .then(res => res.json())
        .then(data => {
            data.forEach(cls => {
                const option = document.createElement('option');
                // The backend controller expects the class name to be saved in student_class,
                // so we can set the value to the name for simplicity, or we can keep it as string in DB
                option.value = cls.name; 
                option.textContent = cls.name;
                turmaSelect.appendChild(option);
            });
        })
        .catch(err => showAlert('Erro ao carregar turmas.', 'danger'));

    // Carregar tipos de atividades
    const tipoAtividadeSelect = document.getElementById('tipoAtividade');
    if (tipoAtividadeSelect) {
        fetch('/api/public/activity-types')
            .then(res => res.json())
            .then(data => {
                data.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.id;
                    option.textContent = type.name;
                    tipoAtividadeSelect.appendChild(option);
                });
            })
            .catch(err => showAlert('Erro ao carregar tipos de atividades.', 'danger'));
    }

    // Quando mudar disciplina, carrega professores vinculados
    disciplinaSelect.addEventListener('change', (e) => {
        const subjectId = e.target.value;
        professorSelect.innerHTML = '<option value="">Selecione...</option>';
        
        if (!subjectId) {
            professorSelect.disabled = true;
            return;
        }

        fetch(`/api/public/subjects/${subjectId}/professors`)
            .then(res => res.json())
            .then(data => {
                professorSelect.disabled = false;
                if (data.length === 0) {
                    professorSelect.innerHTML = '<option value="">Nenhum professor vinculado</option>';
                    professorSelect.disabled = true;
                    return;
                }
                data.forEach(prof => {
                    const option = document.createElement('option');
                    option.value = prof.id;
                    option.textContent = prof.name;
                    professorSelect.appendChild(option);
                });
            })
            .catch(err => showAlert('Erro ao carregar professores.', 'danger'));
    });

    // Submeter formulário
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('file');
        const file = fileInput.files[0];

        // Validar tamanho (250MB)
        if (file && file.size > 250 * 1024 * 1024) {
            showAlert('O arquivo excede o limite de 250MB.', 'danger');
            return;
        }

        const formData = new FormData(form);

        setLoading(true);

        try {
            const response = await fetch('/api/public/submissions', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao enviar.');
            }

            showAlert(`Atividade enviada com sucesso! IMPORTANTE: Salve o seu PROTOCOLO (<strong>${result.protocol}</strong>) para poder acessar a seção "Consultar Atividades" futuramente. <button id="copyProtocolBtn" class="btn btn-secondary btn-sm" style="margin-left: 10px; padding: 4px 10px; font-size: 0.8rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">📋 Copiar</button>`, 'success', 25000);
            
            const copyBtn = document.getElementById('copyProtocolBtn');
            if (copyBtn) {
                copyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(result.protocol)
                        .then(() => {
                            copyBtn.innerHTML = '✓ Copiado!';
                            copyBtn.style.backgroundColor = '#166534';
                            copyBtn.style.color = 'white';
                            setTimeout(() => {
                                copyBtn.innerHTML = '📋 Copiar';
                                copyBtn.style.backgroundColor = '';
                                copyBtn.style.color = '';
                            }, 3000);
                        })
                        .catch(err => console.error('Erro ao copiar:', err));
                });
            }

            form.reset();
            professorSelect.innerHTML = '<option value="">Selecione a disciplina primeiro</option>';
            professorSelect.disabled = true;

        } catch (error) {
            showAlert(error.message, 'danger');
        } finally {
            setLoading(false);
        }
    });

    function showAlert(msg, type, duration = 5000) {
        alertDiv.innerHTML = msg;
        alertDiv.className = `alert alert-${type} show`;
        window.scrollTo(0, 0);
        setTimeout(() => alertDiv.classList.remove('show'), duration);
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        if (isLoading) {
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
        } else {
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    }
});
