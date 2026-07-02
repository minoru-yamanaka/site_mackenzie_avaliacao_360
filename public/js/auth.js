document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const alertDiv = document.getElementById('alertMessage');

    // Se já tiver token, redireciona para o dashboard
    if (localStorage.getItem('token')) {
        window.location.href = '/dashboard.html';
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro no login.');
            }

            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            
            window.location.href = '/dashboard.html';

        } catch (error) {
            showAlert(error.message, 'danger');
        }
    });

    function showAlert(msg, type) {
        alertDiv.textContent = msg;
        alertDiv.className = `alert alert-${type} show`;
        setTimeout(() => alertDiv.classList.remove('show'), 3000);
    }
});
