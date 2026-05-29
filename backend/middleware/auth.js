// ━━━ file: backend/middleware/auth.js ━━━
/**
 * @file auth.js
 * @description Middleware untuk autentikasi JWT via cookie.
 * Menyediakan:
 * - authMiddleware: validasi token, attach req.user
 * - requireRole: cek minimal role (admin)
 */

import { verifyToken } from '../auth/jwt.js';
import { getUserById } from '../db/users.js';

/**
 * Middleware utama autentikasi.
 * Membaca cookie 'token', verifikasi, lalu attach user ke req.user.
 * Jika token tidak valid atau user tidak ditemukan, return 401.
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
export async function authMiddleware(req, res, next) {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const decoded = verifyToken(token);
        // console.log('🔍 Decoded token:', decoded);
        if (!decoded) {
        console.log('❌ Token invalid');
        return res.status(401).json({ success: false,       error: 'Invalid or expired token' });
    }
    
    // Ambil user terbaru dari database untuk cek status dan role
    const user = await getUserById(decoded.userId);
    if (!user) {
        return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    // Cek status user (active, suspended, blocked)
    if (user.status !== 'active') {
        let errorMsg = 'Account is not active';
        if (user.status === 'suspended') errorMsg = 'Account suspended. Contact admin.';
        if (user.status === 'blocked') errorMsg = 'Account permanently blocked.';
        return res.status(403).json({ success: false, error: errorMsg });
    }
    
    // Attach user ke request (tanpa password_hash)
    req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status
    };
    next();
}

/**
 * Middleware untuk mengecek role user minimal 'admin'.
 * Harus dipanggil setelah authMiddleware.
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
export function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
}

/**
 * Middleware opsional: attach user jika ada token, tapi tidak memaksa login.
 * Berguna untuk endpoint publik yang tetap bisa membaca user jika sudah login.
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
export async function optionalAuth(req, res, next) {
    const token = req.cookies?.token;
    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            const user = await getUserById(decoded.userId);
            if (user && user.status === 'active') {
                req.user = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    status: user.status
                };
            }
        }
    }
    next();
}