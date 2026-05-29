// ━━━ file: backend/db/globalConfig.js ━━━
/**
 * @file globalConfig.js
 * @brief Key-value store untuk konfigurasi global (misal: password_hash global).
 */

import { getDatabase } from './connection.js';

const GLOBAL_PASSWORD_KEY = 'global_login_password_hash';

/**
 * Menyimpan hash password global ke database.
 * @param {string} passwordHash (sudah di-bcrypt)
 * @returns {boolean}
 */
export function setGlobalPasswordHash(passwordHash) {
    const db = getDatabase();
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO global_config (key, value, updated_at)
        VALUES (?, ?, ?)
    `);
    const result = stmt.run(GLOBAL_PASSWORD_KEY, passwordHash, Date.now());
    return result.changes > 0;
}

/**
 * Mendapatkan hash password global dari database.
 * @returns {string|null} password hash atau null jika belum diset
 */
export function getGlobalPasswordHash() {
    const db = getDatabase();
    const stmt = db.prepare('SELECT value FROM global_config WHERE key = ?');
    const row = stmt.get(GLOBAL_PASSWORD_KEY);
    return row ? row.value : null;
}

/**
 * Mengecek apakah password global sudah diset (bisa dipakai login).
 * @returns {boolean}
 */
export function isGlobalPasswordSet() {
    return getGlobalPasswordHash() !== null;
}

/**
 * Menghapus password global (berguna untuk reset dari admin panel).
 * @returns {boolean}
 */
export function deleteGlobalPasswordHash() {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM global_config WHERE key = ?');
    const result = stmt.run(GLOBAL_PASSWORD_KEY);
    return result.changes > 0;
}