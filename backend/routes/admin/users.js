// ━━━ file: backend/routes/admin/users.js ━━━
import express from 'express';
import { hashPassword, verifyPassword } from '../../auth/password.js';
import { 
    getAllUsers, getUserById, createUser, updateUserStatus, 
    updateUserRole, deleteUser, isUsernameTaken, getTotalUsersCount,
    updateUserPassword
} from '../../db/users.js';
import { setGlobalPasswordHash, getGlobalPasswordHash, isGlobalPasswordSet } from '../../db/globalConfig.js';

const router = express.Router();

const validRoles = ['admin', 'user'];
const validStatuses = ['active', 'suspended', 'blocked'];

router.get('/', async (req, res) => {
    try {
        const users = await getAllUsers();
        const safeUsers = users.map(({ password_hash, ...rest }) => rest);
        res.json({ success: true, data: safeUsers, total: safeUsers.length });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Username required' });
        }
        if (!password || password.length < 4) {
            return res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
        }
        const finalRole = validRoles.includes(role) ? role : 'user';
        const usernameTaken = await isUsernameTaken(username.trim());
        if (usernameTaken) {
            return res.status(409).json({ success: false, error: 'Username already exists' });
        }
        const passwordHash = await hashPassword(password);
        const result = await createUser(username.trim(), passwordHash, finalRole);
        const newUser = await getUserById(result.lastInsertRowid);
        const { password_hash, ...safeUser } = newUser;
        res.status(201).json({ success: true, data: safeUser });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, error: 'Failed to create user' });
    }
});

router.put('/:id/status', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        const { status } = req.body;
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        if (req.user && req.user.id === userId && status !== 'active') {
            return res.status(403).json({ success: false, error: 'You cannot suspend or block yourself' });
        }
        const success = await updateUserStatus(userId, status);
        if (!success) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, message: `User status updated to ${status}` });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ success: false, error: 'Failed to update status' });
    }
});

router.put('/:id/role', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        const { role } = req.body;
        if (!validRoles.includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid role' });
        }
        const success = await updateUserRole(userId, role);
        if (!success) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, message: `User role updated to ${role}` });
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ success: false, error: 'Failed to update role' });
    }
});

// ========== ENDPOINT BARU: ubah password khusus admin ==========
router.put('/:id/password', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
        }
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        if (user.role !== 'admin') {
            return res.status(400).json({ success: false, error: 'Only admin users can have password changed via this endpoint' });
        }
        const newHash = await hashPassword(newPassword);
        const success = await updateUserPassword(userId, newHash);
        if (success) {
            res.json({ success: true, message: 'Admin password updated successfully' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to update password' });
        }
    } catch (error) {
        console.error('Update admin password error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});
// ========== END ENDPOINT ==========

router.delete('/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) return res.status(400).json({ success: false, error: 'Invalid user ID' });
        if (req.user && req.user.id === userId) {
            return res.status(403).json({ success: false, error: 'You cannot delete your own account' });
        }
        const success = await deleteUser(userId);
        if (!success) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});

router.put('/global-password', async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 4) {
            return res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
        }
        const hashed = await hashPassword(newPassword);
        await setGlobalPasswordHash(hashed);
        res.json({ success: true, message: 'Global password updated successfully' });
    } catch (error) {
        console.error('Update global password error:', error);
        res.status(500).json({ success: false, error: 'Failed to update global password' });
    }
});

router.get('/global-password-status', async (req, res) => {
    try {
        const isSet = await isGlobalPasswordSet();
        res.json({ success: true, isSet });
    } catch (error) {
        console.error('Global password status error:', error);
        res.status(500).json({ success: false, error: 'Failed to check status' });
    }
});

router.get('/stats/users', async (req, res) => {
    try {
        const total = await getTotalUsersCount();
        res.json({ success: true, totalUsers: total });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to get user count' });
    }
});

export default router;