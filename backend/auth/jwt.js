// ━━━ file: backend/auth/jwt.js ━━━
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
console.log('🔐 JWT_SECRET loaded:', JWT_SECRET ? 'YES (length=' + JWT_SECRET.length + ')' : 'MISSING');

export function generateToken(user) {
    const payload = {
        userId: user.id,
        username: user.username,
        role: user.role
    };
    return jwt.sign(payload, JWT_SECRET);
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

export function getCookieOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: false, // ← PASTIKAN false untuk development (localhost)
        sameSite: 'lax',
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 tahun
    };
}