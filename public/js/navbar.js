// public/js/navbar.js
// Script dinâmico para renderizar uma única e unificada barra de navegação (navbar) em todas as páginas.
// Garante consistência de estilo, responsividade e exibe as rotas corretas baseadas no login.

document.addEventListener('DOMContentLoaded', () => {
    const navbarEl = document.querySelector('nav.navbar') || document.querySelector('.navbar');
    if (!navbarEl) return;

    // Remove classes antigas e aplica o estilo padrão
    navbarEl.className = 'navbar';
    navbarEl.style.display = 'flex';
    navbarEl.style.justifyContent = 'space-between';
    navbarEl.style.alignItems = 'center';
    navbarEl.style.flexWrap = 'wrap';

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const isLoggedIn = !!(token && user);

    // Obtém o nome da página atual para destacar o link ativo
    const currentPath = window.location.pathname;

    // Define todos os links do sistema
    const menuItems = [
        { label: '🏫 Portal de Formulários Dinâmicos', path: '/' },
        { label: '📢 Mural de Avisos', path: '/mural.html' },
        { label: '✉️ Enviar Mensagem', path: '/fale-conosco.html' }
    ];

    // Se estiver logado, exibe páginas administrativas extras
    if (isLoggedIn) {
        menuItems.push({ label: '🗂️ Meus Formulários', path: '/forms.html' });
        if (user.role === 'admin') {
            menuItems.push({ label: '👤 Gerenciar Usuários', path: '/dashboard.html?view=users' });
        }
    }

    // Gera o HTML do menu
    const menuLinksHtml = menuItems.map(item => {
        const itemUrl = new URL(item.path, window.location.origin);
        const isActive = (window.location.pathname === itemUrl.pathname) && 
                         (itemUrl.search === '' || window.location.search === itemUrl.search || (itemUrl.pathname === '/' && (window.location.pathname === '/index.html' || window.location.pathname === '')));
        const activeStyle = isActive ? 'border-bottom: 2px solid white; opacity: 1; font-weight: 600;' : 'opacity: 0.9;';
        return `<a href="${item.path}" style="color: white; text-decoration: none; margin-left: 1.25rem; font-size: 0.92rem; padding: 0.25rem 0; transition: opacity 0.2s, border-color 0.2s; ${activeStyle}">${item.label}</a>`;
    }).join('');

    // HTML do bloco de autenticação (direita)
    let authBlockHtml = '';
    if (isLoggedIn) {
        authBlockHtml = `
            <div class="nav-auth-user" style="display: flex; align-items: center; gap: 0.75rem; margin-left: 1.5rem;">
                <span class="user-badge" style="background: rgba(255,255,255,0.2); color: white; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; font-weight: 500;">
                    👤 ${escapeHtml(user.name)}
                </span>
                <button id="navLogoutBtn" class="btn btn-danger" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; border-radius: 6px;">Sair</button>
            </div>
        `;
    } else {
        authBlockHtml = `
            <a href="/login.html" class="btn btn-secondary" style="padding: 0.4rem 1rem; font-size: 0.85rem; color: white; margin-left: 1.5rem; text-decoration: none; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.25rem;">
                🔑 Acesso Docente
            </a>
        `;
    }

    // Renderiza a estrutura completa da navbar
    navbarEl.innerHTML = `
        <a href="/" class="navbar-brand" style="font-size: 1.15rem; font-weight: 700; color: white; text-decoration: none; display: flex; align-items: center; gap: 0.5rem;">
            🏫 Portal Acadêmico & Formulários
        </a>
        <button class="hamburger" id="navbarToggleBtn" style="display: none; background: none; border: none; font-size: 1.8rem; cursor: pointer; color: white;">&#9776;</button>
        <div class="nav-links d-flex align-center" id="navLinks" style="display: flex; align-items: center;">
            ${menuLinksHtml}
            ${authBlockHtml}
        </div>
    `;

    // Configura evento de logout
    const logoutBtn = document.getElementById('navLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        });
    }

    // Responsividade do menu hambúrguer
    const toggleBtn = document.getElementById('navbarToggleBtn');
    const navLinksContainer = document.getElementById('navLinks');
    
    if (toggleBtn && navLinksContainer) {
        // Exibe o hambúrguer e ajusta layouts no CSS para telas menores
        const handleResize = () => {
            if (window.innerWidth <= 860) {
                toggleBtn.style.display = 'block';
                navLinksContainer.style.display = 'none';
                navLinksContainer.style.width = '100%';
                navLinksContainer.style.flexDirection = 'column';
                navLinksContainer.style.alignItems = 'stretch';
                navLinksContainer.style.marginTop = '1rem';
                
                // Ajusta margens dos links no mobile
                navLinksContainer.querySelectorAll('a').forEach(a => {
                    a.style.marginLeft = '0';
                    a.style.padding = '0.6rem 0';
                    a.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                    a.style.textAlign = 'center';
                });
                
                const authDiv = navLinksContainer.querySelector('.nav-auth-user');
                if (authDiv) {
                    authDiv.style.marginLeft = '0';
                    authDiv.style.marginTop = '0.75rem';
                    authDiv.style.flexDirection = 'column';
                    authDiv.style.alignItems = 'stretch';
                }
            } else {
                toggleBtn.style.display = 'none';
                navLinksContainer.style.display = 'flex';
                navLinksContainer.style.width = 'auto';
                navLinksContainer.style.flexDirection = 'row';
                navLinksContainer.style.alignItems = 'center';
                navLinksContainer.style.marginTop = '0';

                // Restaura margens no desktop
                navLinksContainer.querySelectorAll('a').forEach(a => {
                    a.style.marginLeft = '1.25rem';
                    a.style.padding = '0.25rem 0';
                    a.style.borderBottom = '';
                    a.style.textAlign = 'left';
                });
                
                const authDiv = navLinksContainer.querySelector('.nav-auth-user');
                if (authDiv) {
                    authDiv.style.marginLeft = '1.5rem';
                    authDiv.style.marginTop = '0';
                    authDiv.style.flexDirection = 'row';
                    authDiv.style.alignItems = 'center';
                }
            }
        };

        toggleBtn.addEventListener('click', () => {
            if (navLinksContainer.style.display === 'none') {
                navLinksContainer.style.display = 'flex';
            } else {
                navLinksContainer.style.display = 'none';
            }
        });

        window.addEventListener('resize', handleResize);
        handleResize(); // Executa uma vez no início
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
});
