document.addEventListener('DOMContentLoaded', async () => {
    const noticesContainer = document.getElementById('noticesContainer');
    const loader = document.getElementById('loader');
    const searchInput = document.getElementById('searchInput');
    const dateStartInput = document.getElementById('filterDateStart');
    const dateEndInput = document.getElementById('filterDateEnd');

    let allNotices = [];

    async function loadNotices() {
        try {
            const response = await fetch('/api/public/notices');
            if (!response.ok) throw new Error('Falha ao carregar avisos');
            
            allNotices = await response.json();
            loader.classList.add('hidden');
            renderNotices(allNotices);

        } catch (error) {
            console.error(error);
            loader.classList.add('hidden');
            noticesContainer.innerHTML = '<p class="text-center" style="color: red;">Erro ao carregar avisos. Tente novamente mais tarde.</p>';
        }
    }

    function renderNotices(notices) {
        noticesContainer.innerHTML = '';
        
        if (notices.length === 0) {
            noticesContainer.innerHTML = '<p class="text-center text-muted">Nenhum aviso encontrado.</p>';
            return;
        }

        notices.forEach(notice => {
            const date = new Date(notice.createdAt).toLocaleString('pt-BR');
            const authorName = notice.author ? notice.author.name : 'Sistema';
            const card = document.createElement('div');
            card.className = 'notice-card';
            
            let attachmentHtml = '';
            if (notice.file_path) {
                attachmentHtml = `
                    <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                        <a href="/api/public/notices/${notice.id}/download" class="btn btn-secondary btn-sm" target="_blank">Baixar Anexo</a>
                        <a href="/api/public/notices/${notice.id}/download?view=true" class="btn btn-primary btn-sm" target="_blank">Visualizar Anexo</a>
                    </div>
                `;
            }

            const targetName = notice.user ? notice.user.name : 'Geral';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span class="badge" style="background: var(--bg-color); color: var(--primary); border: 1px solid var(--primary); font-size: 0.75rem;">Destinatário: ${targetName}</span>
                    <span style="font-size: 0.85rem; color: var(--primary); font-weight: 500;">👤 Autor: ${authorName}</span>
                </div>
                <h3 class="notice-title">${notice.title}</h3>
                <span class="notice-date">Postado em: ${date}</span>
                <div class="notice-message" style="margin-top: 1rem;">${notice.message}</div>
                ${attachmentHtml}
            `;
            noticesContainer.appendChild(card);
        });
    }

    function applyFilters() {
        const query = searchInput.value.toLowerCase();
        const start = dateStartInput.value;
        const end = dateEndInput.value;

        const filtered = allNotices.filter(notice => {
            const authorName = (notice.author ? notice.author.name : '').toLowerCase();
            const targetName = (notice.user ? notice.user.name : '').toLowerCase();
            
            const matchesText = notice.title.toLowerCase().includes(query) || 
                                notice.message.toLowerCase().includes(query) ||
                                authorName.includes(query) ||
                                targetName.includes(query);
            
            let matchesDate = true;
            const noticeDate = new Date(notice.createdAt);
            noticeDate.setHours(0, 0, 0, 0);

            if (start) {
                const startDate = new Date(start + 'T00:00:00');
                if (noticeDate < startDate) matchesDate = false;
            }
            if (end) {
                const endDate = new Date(end + 'T00:00:00');
                if (noticeDate > endDate) matchesDate = false;
            }

            return matchesText && matchesDate;
        });

        renderNotices(filtered);
    }

    searchInput.addEventListener('input', applyFilters);
    dateStartInput.addEventListener('change', applyFilters);
    dateEndInput.addEventListener('change', applyFilters);

    loadNotices();
});
