// ━━━ file: frontend/js/login.js ━━━
/**
 * @file login.js
 * @description Handle form login, API call, redirect after success.
 * Tidak memerlukan common.js karena halaman login independen.
 */

(function() {
    const form = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('login-btn');
    const togglePasswordBtn = document.getElementById('toggle-password');
    const errorContainer = document.getElementById('error-container');
    const infoContainer = document.getElementById('info-container');
    
    let isLoading = false;
    
    // Toggle password visibility
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = togglePasswordBtn.querySelector('i');
            icon.className = type === 'password' ? 'fas fa-eye-slash' : 'fas fa-eye';
        });
    }
    
    // Clear previous messages
    function clearMessages() {
        if (errorContainer) errorContainer.innerHTML = '';
        if (infoContainer) infoContainer.innerHTML = '';
    }
    
    function showError(message) {
        if (errorContainer) {
            errorContainer.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(message)}</div>`;
        }
        setTimeout(() => {
            if (errorContainer) errorContainer.innerHTML = '';
        }, 5000);
    }
    
    function showInfo(message) {
        if (infoContainer) {
            infoContainer.innerHTML = `<div class="info-message"><i class="fas fa-info-circle"></i> ${escapeHtml(message)}</div>`;
        }
        setTimeout(() => {
            if (infoContainer) infoContainer.innerHTML = '';
        }, 5000);
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    async function handleLogin(event) {
        event.preventDefault();
        if (isLoading) return;
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username) {
            showError('Username is required');
            usernameInput.focus();
            return;
        }
        if (!password) {
            showError('Password is required');
            passwordInput.focus();
            return;
        }
        
        clearMessages();
        isLoading = true;
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Signing in...';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // penting untuk cookie
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                let errorMsg = result.error || 'Login failed';
                if (response.status === 503) errorMsg = 'Global password not configured yet. Please contact admin.';
                if (response.status === 403) errorMsg = result.error || 'Account is not active';
                showError(errorMsg);
                return;
            }
            
            // Login berhasil: simpan user info ke localStorage (opsional, untuk fallback cepat)
            if (result.user) {
                localStorage.setItem('zerostream_user', JSON.stringify({
                    id: result.user.id,
                    username: result.user.username,
                    role: result.user.role,
                    status: result.user.status
                }));
                localStorage.setItem('zerostream_totalUsers', result.totalUsers || 0);
            }
            
            // Redirect ke halaman sebelumnya atau home
            const redirectTo = sessionStorage.getItem('login_redirect') || '/';
            sessionStorage.removeItem('login_redirect');
            window.location.href = redirectTo;
            
        } catch (error) {
            console.error('Login error:', error);
            showError('Network error. Please check your connection.');
        } finally {
            isLoading = false;
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i> Sign In';
        }
    }
    
    form.addEventListener('submit', handleLogin);
    
    // Jika sudah login sebelumnya dan mengakses halaman login, redirect ke home
    async function checkAlreadyLoggedIn() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.user) {
                    window.location.href = '/';
                }
            }
        } catch (e) {
            // ignore
        }
    }
    checkAlreadyLoggedIn();
})();