// ━━━ file: backend/db/users.js ━━━
/**
 * @file users.js
 * @description Database operations for users table.
 * Menyediakan fungsi CRUD untuk manajemen user (admin, user biasa).
 * Status: 'active', 'suspended', 'blocked'
 */

import { getDatabase } from './connection.js';

/**
 * @typedef {Object} User
 * @property {number} id
 * @property {string} username
 * @property {string} password_hash
 * @property {string} role - 'admin' or 'user'
 * @property {string} status - 'active', 'suspended', 'blocked'
 * @property {number} created_at
 * @property {number|null} last_login
 */

/**
 * Membuat user baru.
 * @param {string} username
 * @param {string} passwordHash (sudah di-bcrypt)
 * @param {string} role - 'admin' atau 'user'
 * @returns {object} Hasil run SQL (lastInsertRowid)
 */
export function createUser(username, passwordHash, role = 'user') {
    const db = getDatabase();
    const now = Date.now();
    const stmt = db.prepare(`
        INSERT INTO users (username, password_hash, role, status, created_at, last_login)
        VALUES (?, ?, ?, 'active', ?, NULL)
    `);
    const result = stmt.run(username, passwordHash, role, now);
    return result;
}

/**
 * Mendapatkan user berdasarkan username (case-sensitive).
 * @param {string} username
 * @returns {User|null}
 */
export function getUserByUsername(username) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);
    return user || null;
}

/**
 * Mendapatkan user berdasarkan ID.
 * @param {number} id
 * @returns {User|null}
 */
export function getUserById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id);
    return user || null;
}

/**
 * Mendapatkan semua user, diurutkan berdasarkan created_at DESC.
 * @returns {User[]}
 */
export function getAllUsers() {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all();
}

/**
 * Mendapatkan total jumlah user (aktif + suspended + blocked).
 * @returns {number}
 */
export function getTotalUsersCount() {
    const db = getDatabase();
    const row = db.prepare('SELECT COUNT(*) as total FROM users').get();
    return row.total;
}

/**
 * Update password hash user.
 * @param {number} userId
 * @param {string} newPasswordHash
 * @returns {boolean} true jika berhasil
 */
export function updateUserPassword(userId, newPasswordHash) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    const result = stmt.run(newPasswordHash, userId);
    return result.changes > 0;
}

/**
 * Update status user (active, suspended, blocked).
 * @param {number} userId
 * @param {string} status
 * @returns {boolean}
 */
export function updateUserStatus(userId, status) {
    const db = getDatabase();
    const validStatus = ['active', 'suspended', 'blocked'];
    if (!validStatus.includes(status)) return false;
    const stmt = db.prepare('UPDATE users SET status = ? WHERE id = ?');
    const result = stmt.run(status, userId);
    return result.changes > 0;
}

/**
 * Update role user (admin/user).
 * @param {number} userId
 * @param {string} role
 * @returns {boolean}
 */
export function updateUserRole(userId, role) {
    const db = getDatabase();
    if (!['admin', 'user'].includes(role)) return false;
    const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    const result = stmt.run(role, userId);
    return result.changes > 0;
}

/**
 * Mencatat waktu last_login user.
 * @param {number} userId
 * @returns {boolean}
 */
export function updateLastLogin(userId) {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE users SET last_login = ? WHERE id = ?');
    const result = stmt.run(Date.now(), userId);
    return result.changes > 0;
}

/**
 * Menghapus user berdasarkan ID.
 * @param {number} userId
 * @returns {boolean}
 */
export function deleteUser(userId) {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(userId);
    return result.changes > 0;
}

/**
 * Mengecek apakah username sudah ada (termasuk yang status blocked).
 * @param {string} username
 * @returns {boolean}
 */
export function isUsernameTaken(username) {
    const db = getDatabase();
    const row = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
    return !!row;
}