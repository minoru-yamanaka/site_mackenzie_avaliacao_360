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
    navbarEl.style.flexWrap = 'nowrap';

    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const isLoggedIn = !!(token && user);

    // Obtém o nome da página atual para destacar o link ativo
    const currentPath = window.location.pathname;

    // Define todos os links do sistema
    const menuItems = [
        { label: '📝 Mackenzie 360°', path: '/' },
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
        return `<a href="${item.path}" style="color: white; text-decoration: none; margin-left: 0.75rem; font-size: 0.85rem; padding: 0.25rem 0; transition: opacity 0.2s, border-color 0.2s; ${activeStyle}">${item.label}</a>`;
    }).join('');

    // HTML do bloco de autenticação (direita)
    let authBlockHtml = '';
    if (isLoggedIn) {
        authBlockHtml = `
            <div class="nav-auth-user" style="display: flex; align-items: center; gap: 0.6rem; margin-left: 1rem;">
                <span class="user-badge" style="background: rgba(255,255,255,0.2); color: white; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; font-weight: 500;">
                    👤 ${escapeHtml(user.name)}
                </span>
                <button id="navLogoutBtn" class="btn btn-danger" style="padding: 0.35rem 0.7rem; font-size: 0.8rem; border-radius: 6px;">Sair</button>
            </div>
        `;
    } else {
        authBlockHtml = `
            <a href="/login.html" class="btn btn-secondary" style="padding: 0.35rem 0.85rem; font-size: 0.8rem; color: white; margin-left: 1rem; text-decoration: none; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.25rem;">
                🔑 Acesso Docente
            </a>
        `;
    }

    // Renderiza a estrutura completa da navbar
    navbarEl.innerHTML = `
        <a href="/" class="navbar-brand" style="font-size: 1.05rem; font-weight: 700; color: white; text-decoration: none; display: flex; align-items: center; gap: 0.5rem;">
            🏢 Mackenzie 360° | Hub de Avaliação Acadêmica
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
            if (window.innerWidth <= 960) {
                navbarEl.style.flexWrap = 'wrap';
                navbarEl.style.padding = '0.75rem 1.25rem';
                
                toggleBtn.style.display = 'block';
                toggleBtn.style.color = 'white';
                toggleBtn.style.fontSize = '1.8rem';
                toggleBtn.style.padding = '0.25rem 0.5rem';
                toggleBtn.style.cursor = 'pointer';
                toggleBtn.style.background = 'transparent';
                toggleBtn.style.border = 'none';
                toggleBtn.style.borderRadius = '0';
                toggleBtn.style.transition = 'none';
                
                navLinksContainer.style.display = 'none';
                navLinksContainer.style.width = '100%';
                navLinksContainer.style.flexDirection = 'column';
                navLinksContainer.style.alignItems = 'stretch';
                navLinksContainer.style.marginTop = '0.75rem';
                navLinksContainer.style.background = '#ffffff';
                navLinksContainer.style.padding = '1.25rem';
                navLinksContainer.style.borderRadius = '16px';
                navLinksContainer.style.border = '1px solid var(--border)';
                navLinksContainer.style.boxShadow = 'var(--shadow-lg)';
                
                // Ajusta margens e estilos dos links no mobile
                navLinksContainer.querySelectorAll('a').forEach(a => {
                    a.style.marginLeft = '0';
                    a.style.padding = '0.65rem 0.9rem';
                    a.style.borderBottom = 'none';
                    a.style.borderRadius = '8px';
                    a.style.textAlign = 'left';
                    a.style.display = 'flex';
                    a.style.alignItems = 'center';
                    a.style.gap = '0.5rem';
                    a.style.fontSize = '0.9rem';
                    a.style.fontWeight = '500';
                    a.style.color = 'var(--text-main)';
                    a.style.transition = 'background-color 0.2s';
                    
                    // Hover/Active effect
                    a.addEventListener('mouseenter', () => a.style.background = '#f1f5f9');
                    a.addEventListener('mouseleave', () => a.style.background = 'transparent');
                });
                
                const authDiv = navLinksContainer.querySelector('.nav-auth-user');
                if (authDiv) {
                    authDiv.style.marginLeft = '0';
                    authDiv.style.marginTop = '0.5rem';
                    authDiv.style.paddingTop = '0.75rem';
                    authDiv.style.borderTop = '1px solid var(--border)';
                    authDiv.style.flexDirection = 'column';
                    authDiv.style.alignItems = 'stretch';
                    authDiv.style.gap = '0.6rem';

                    const badge = authDiv.querySelector('.user-badge');
                    if (badge) {
                        badge.style.background = '#f1f5f9';
                        badge.style.border = '1px solid var(--border)';
                        badge.style.color = 'var(--text-main)';
                        badge.style.padding = '0.5rem 1rem';
                        badge.style.borderRadius = '8px';
                        badge.style.fontSize = '0.82rem';
                        badge.style.textAlign = 'center';
                    }

                    const logoutBtnEl = authDiv.querySelector('#navLogoutBtn');
                    if (logoutBtnEl) {
                        logoutBtnEl.style.padding = '0.55rem';
                        logoutBtnEl.style.fontSize = '0.85rem';
                        logoutBtnEl.style.fontWeight = '600';
                        logoutBtnEl.style.borderRadius = '8px';
                        logoutBtnEl.style.background = '#ef4444';
                        logoutBtnEl.style.border = 'none';
                        logoutBtnEl.style.color = 'white';
                        logoutBtnEl.style.cursor = 'pointer';
                        logoutBtnEl.style.transition = 'background-color 0.2s';
                    }
                }
            } else {
                navbarEl.style.flexWrap = 'nowrap';
                navbarEl.style.padding = '0.75rem 1.25rem';
                toggleBtn.style.display = 'none';
                
                navLinksContainer.style.display = 'flex';
                navLinksContainer.style.width = 'auto';
                navLinksContainer.style.flexDirection = 'row';
                navLinksContainer.style.alignItems = 'center';
                navLinksContainer.style.marginTop = '0';
                navLinksContainer.style.background = 'transparent';
                navLinksContainer.style.backdropFilter = 'none';
                navLinksContainer.style.webkitBackdropFilter = 'none';
                navLinksContainer.style.padding = '0';
                navLinksContainer.style.borderRadius = '0';
                navLinksContainer.style.border = 'none';
                navLinksContainer.style.boxShadow = 'none';
                navLinksContainer.style.opacity = '1';
                navLinksContainer.style.transform = 'none';
                navLinksContainer.style.transition = 'none';

                // Restaura margens no desktop
                navLinksContainer.querySelectorAll('a').forEach(a => {
                    a.style.marginLeft = '0.75rem';
                    a.style.padding = '0.25rem 0';
                    a.style.fontSize = '0.85rem';
                    a.style.color = 'white';
                    a.style.borderBottom = '';
                    a.style.borderRadius = '0';
                    a.style.background = 'transparent';
                    a.style.textAlign = 'left';
                    a.style.display = 'inline-block';
                });
                
                const authDiv = navLinksContainer.querySelector('.nav-auth-user');
                if (authDiv) {
                    authDiv.style.marginLeft = '1rem';
                    authDiv.style.marginTop = '0';
                    authDiv.style.padding = '0';
                    authDiv.style.borderTop = 'none';
                    authDiv.style.flexDirection = 'row';
                    authDiv.style.alignItems = 'center';
                    authDiv.style.gap = '0.6rem';

                    const badge = authDiv.querySelector('.user-badge');
                    if (badge) {
                        badge.style.background = 'rgba(255,255,255,0.2)';
                        badge.style.border = 'none';
                        badge.style.color = 'white';
                        badge.style.padding = '0.25rem 0.75rem';
                        badge.style.borderRadius = '999px';
                        badge.style.fontSize = '0.85rem';
                        badge.style.textAlign = 'left';
                    }

                    const logoutBtnEl = authDiv.querySelector('#navLogoutBtn');
                    if (logoutBtnEl) {
                        logoutBtnEl.style.padding = '0.4rem 0.8rem';
                        logoutBtnEl.style.fontSize = '0.85rem';
                        logoutBtnEl.style.fontWeight = '400';
                        logoutBtnEl.style.borderRadius = '6px';
                        logoutBtnEl.style.background = '';
                        logoutBtnEl.style.border = '';
                        logoutBtnEl.style.color = '';
                    }
                }
            }
        };

        let clickTimeout = null;
        toggleBtn.addEventListener('click', () => {
            if (clickTimeout) clearTimeout(clickTimeout);
            
            if (navLinksContainer.style.display === 'none') {
                navLinksContainer.style.display = 'flex';
                navLinksContainer.style.opacity = '0';
                navLinksContainer.style.transform = 'translateY(-8px)';
                
                // Reflow
                navLinksContainer.offsetHeight;
                
                navLinksContainer.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
                navLinksContainer.style.opacity = '1';
                navLinksContainer.style.transform = 'translateY(0)';
            } else {
                navLinksContainer.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                navLinksContainer.style.opacity = '0';
                navLinksContainer.style.transform = 'translateY(-8px)';
                
                clickTimeout = setTimeout(() => {
                    if (navLinksContainer.style.opacity === '0') {
                        navLinksContainer.style.display = 'none';
                    }
                }, 200);
            }
        });

        window.addEventListener('resize', handleResize);
        handleResize(); // Executa uma vez no início
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
});
