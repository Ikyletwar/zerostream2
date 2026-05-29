// ━━━ file: backend/routes/auth.js ━━━
import express from 'express';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { generateToken, getCookieOptions } from '../auth/jwt.js';
import { getUserByUsername, createUser, updateLastLogin, getTotalUsersCount } from '../db/users.js';
import { getGlobalPasswordHash, isGlobalPasswordSet } from '../db/globalConfig.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

async function ensureGlobalPasswordSet(res) {
    if (!(await isGlobalPasswordSet())) {
        res.status(503).json({
            success: false,
            error: 'Global password not configured. Please contact admin.'
        });
        return false;
    }
    return true;
}

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            return res.status(400).json({ success: false, error: 'Username required' });
        }
        if (!password || typeof password !== 'string' || password.length === 0) {
            return res.status(400).json({ success: false, error: 'Password required' });
        }
        const normalizedUsername = username.trim();

        let user = await getUserByUsername(normalizedUsername);

        // CASE 1: User belum ada → auto-create (hanya bisa dengan global password)
        if (!user) {
            if (!(await ensureGlobalPasswordSet(res))) return;
            const globalHash = await getGlobalPasswordHash();
            const isGlobalValid = await verifyPassword(password, globalHash);
            if (!isGlobalValid) {
                return res.status(401).json({ success: false, error: 'Invalid password' });
            }
            const passwordHashForNewUser = await hashPassword(password);
            await createUser(normalizedUsername, passwordHashForNewUser, 'user');
            user = await getUserByUsername(normalizedUsername);
            if (!user) return res.status(500).json({ success: false, error: 'Failed to create user' });
        }
        // CASE 2: User sudah ada
        else {
            if (user.role === 'admin') {
                // Admin login pakai password khusus (tersimpan di password_hash)
                const isAdminValid = await verifyPassword(password, user.password_hash);
                if (!isAdminValid) {
                    return res.status(401).json({ success: false, error: 'Invalid admin credentials' });
                }
            } else {
                // User biasa login pakai global password
                if (!(await ensureGlobalPasswordSet(res))) return;
                const globalHash = await getGlobalPasswordHash();
                const isGlobalValid = await verifyPassword(password, globalHash);
                if (!isGlobalValid) {
                    return res.status(401).json({ success: false, error: 'Invalid password' });
                }
            }
        }

        // Cek status akun
        if (user.status !== 'active') {
            let errorMsg = 'Account not active';
            if (user.status === 'suspended') errorMsg = 'Account suspended';
            if (user.status === 'blocked') errorMsg = 'Account permanently blocked';
            return res.status(403).json({ success: false, error: errorMsg });
        }

        await updateLastLogin(user.id);
        const token = generateToken({ id: user.id, username: user.username, role: user.role });
        res.cookie('token', token, getCookieOptions());
        const totalUsers = await getTotalUsersCount();
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                status: user.status,
                created_at: user.created_at,
                last_login: user.last_login
            },
            totalUsers
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token', getCookieOptions());
    res.json({ success: true, message: 'Logged out' });
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const totalUsers = await getTotalUsersCount();
        res.json({
            success: true,
            user: req.user,
            totalUsers
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;