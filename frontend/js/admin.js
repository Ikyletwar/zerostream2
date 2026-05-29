// ━━━ file: frontend/js/admin.js ━━━
(function() {
    const usersTableBody = document.getElementById('users-table-body');
    const addUserBtn = document.getElementById('add-user-btn');
    const refreshBtn = document.getElementById('refresh-users-btn');
    const userModal = document.getElementById('user-modal');
    const modalTitle = document.getElementById('modal-title');
    const userForm = document.getElementById('user-form');
    const userIdInput = document.getElementById('user-id');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const roleInput = document.getElementById('role-input');
    const statusInput = document.getElementById('status-input');
    const passwordFieldGroup = document.getElementById('password-field-group');
    const statusFieldGroup = document.getElementById('status-field-group');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const updateGlobalPasswordBtn = document.getElementById('update-global-password-btn');
    const newGlobalPasswordInput = document.getElementById('new-global-password');
    const confirmGlobalPasswordInput = document.getElementById('confirm-global-password');
    const totalUsersStat = document.getElementById('total-users-stat');
    
    let currentEditMode = false;
    
    function showToast(message, type = 'info') {
        if (window.showToast) window.showToast(message, type);
        else console.log(`[${type}] ${message}`);
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
    
    function formatDate(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleDateString('id-ID') + ' ' + date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    
    async function fetchUsers() {
        try {
            const response = await fetch('/api/admin/users', { credentials: 'include' });
            if (!response.ok) {
                if (response.status === 403) {
                    showToast('Admin access required', 'error');
                    window.location.href = '/';
                    return;
                }
                throw new Error('Failed to fetch users');
            }
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            renderUsersTable(result.data);
            updateTotalUsersStat(result.total);
            return result.data;
        } catch (error) {
            console.error('Fetch users error:', error);
            usersTableBody.innerHTML = '<tr><td colspan="8" class="empty-row"><i class="fas fa-exclamation-triangle"></i> Failed to load users</td></tr>';
            showToast('Failed to load users', 'error');
            return [];
        }
    }
    
    function renderUsersTable(users) {
        if (!users || users.length === 0) {
            usersTableBody.innerHTML = '<td><td colspan="8" class="empty-row"><i class="fas fa-users-slash"></i> No users found</td></tr>';
            return;
        }
        
        usersTableBody.innerHTML = users.map(user => `
            <tr data-user-id="${user.id}">
                <td>${user.id}</td>
                <td><strong>${escapeHtml(user.username)}</strong></td>
                <td><span class="${user.role === 'admin' ? 'role-badge-admin' : 'role-badge-user'}">${user.role}</span></td>
                <td><span class="status-badge status-${user.status}">${user.status}</span></td>
                <td>${formatDate(user.created_at)}</td>
                <td>${user.last_login ? formatDate(user.last_login) : '-'}</td>
                <td class="action-buttons">
                    <button class="icon-btn-small edit-user" data-id="${user.id}" data-username="${escapeHtml(user.username)}" data-role="${user.role}" data-status="${user.status}">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.role === 'admin' ? `
                    <button class="icon-btn-small change-admin-pwd" data-id="${user.id}" data-username="${escapeHtml(user.username)}">
                        <i class="fas fa-key"></i>
                    </button>
                    ` : ''}
                    <button class="icon-btn-small delete-user" data-id="${user.id}" data-username="${escapeHtml(user.username)}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const username = btn.dataset.username;
                const role = btn.dataset.role;
                const status = btn.dataset.status;
                openEditModal(id, username, role, status);
            });
        });
        
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const username = btn.dataset.username;
                if (confirm(`Hapus user "${username}"? Tindakan ini permanen.`)) {
                    await deleteUser(id);
                    await fetchUsers();
                }
            });
        });
        
        document.querySelectorAll('.change-admin-pwd').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const username = btn.dataset.username;
                openChangePasswordModal(id, username);
            });
        });
    }
    
    function updateTotalUsersStat(total) {
        if (totalUsersStat) {
            totalUsersStat.innerHTML = `<i class="fas fa-users"></i> <span>Total: ${total}</span>`;
        }
    }
    
    function openAddModal() {
        currentEditMode = false;
        modalTitle.textContent = 'Add User';
        userIdInput.value = '';
        usernameInput.value = '';
        passwordInput.value = '';
        roleInput.value = 'user';
        statusInput.value = 'active';
        passwordFieldGroup.style.display = 'block';
        statusFieldGroup.style.display = 'none';
        userModal.classList.add('active');
    }
    
    function openEditModal(id, username, role, status) {
        currentEditMode = true;
        modalTitle.textContent = 'Edit User';
        userIdInput.value = id;
        usernameInput.value = username;
        passwordInput.value = '';
        roleInput.value = role;
        statusInput.value = status;
        passwordFieldGroup.style.display = 'none';
        statusFieldGroup.style.display = 'block';
        userModal.classList.add('active');
    }
    
    function closeModal() {
        userModal.classList.remove('active');
        userForm.reset();
    }
    
    async function createUser(username, password, role) {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password, role })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to create user');
        return result;
    }
    
    async function updateUserStatus(userId, status) {
        const response = await fetch(`/api/admin/users/${userId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update status');
        return result;
    }
    
    async function updateUserRole(userId, role) {
        const response = await fetch(`/api/admin/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ role })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update role');
        return result;
    }
    
    async function deleteUser(userId) {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to delete user');
        showToast('User deleted', 'success');
        return result;
    }
    
    async function updateGlobalPassword(newPassword) {
        const response = await fetch('/api/admin/global-password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ newPassword })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update global password');
        return result;
    }
    
    // ========== FUNGSI BARU: ubah password admin ==========
    async function openChangePasswordModal(userId, username) {
        const newPassword = prompt(`Masukkan password baru untuk admin "${username}":`);
        if (!newPassword || newPassword.length < 4) {
            showToast('Password minimal 4 karakter', 'error');
            return;
        }
        try {
            const response = await fetch(`/api/admin/users/${userId}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ newPassword })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to update password');
            showToast('Admin password updated', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }
    // ========== END FUNGSI BARU ==========
    
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        if (!username) {
            showToast('Username required', 'error');
            return;
        }
        if (!currentEditMode) {
            const password = passwordInput.value;
            if (!password || password.length < 4) {
                showToast('Password minimal 4 karakter', 'error');
                return;
            }
            const role = roleInput.value;
            try {
                await createUser(username, password, role);
                showToast('User created successfully', 'success');
                closeModal();
                await fetchUsers();
            } catch (err) {
                showToast(err.message, 'error');
            }
        } else {
            const userId = parseInt(userIdInput.value);
            const newRole = roleInput.value;
            const newStatus = statusInput.value;
            try {
                if (newRole) await updateUserRole(userId, newRole);
                if (newStatus) await updateUserStatus(userId, newStatus);
                showToast('User updated successfully', 'success');
                closeModal();
                await fetchUsers();
            } catch (err) {
                showToast(err.message, 'error');
            }
        }
    });
    
    updateGlobalPasswordBtn.addEventListener('click', async () => {
        const newPass = newGlobalPasswordInput.value;
        const confirmPass = confirmGlobalPasswordInput.value;
        if (!newPass || newPass.length < 4) {
            showToast('Password minimal 4 karakter', 'error');
            return;
        }
        if (newPass !== confirmPass) {
            showToast('Password tidak cocok', 'error');
            return;
        }
        try {
            await updateGlobalPassword(newPass);
            showToast('Global password updated successfully', 'success');
            newGlobalPasswordInput.value = '';
            confirmGlobalPasswordInput.value = '';
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
    
    addUserBtn.addEventListener('click', openAddModal);
    refreshBtn.addEventListener('click', fetchUsers);
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === userModal) closeModal();
    });
    
    async function initAdmin() {
        const user = await window.fetchCurrentUser ? await window.fetchCurrentUser() : window.getCurrentUser();
        if (!user || user.role !== 'admin') {
            showToast('Admin access required', 'error');
            window.location.href = '/';
            return;
        }
        await fetchUsers();
    }
    
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initAdmin, 100);
    });
})();