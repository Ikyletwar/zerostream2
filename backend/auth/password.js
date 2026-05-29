// ━━━ file: backend/auth/password.js ━━━
/**
 * @file password.js
 * @description Wrapper untuk bcrypt hashing & verification password user dan global password.
 * Alasan: Memisahkan logika hashing agar mudah diganti algoritma nanti.
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash password plain text.
 * @param {string} plainPassword
 * @returns {Promise<string>} Hash
 */
export async function hashPassword(plainPassword) {
    return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verifikasi apakah plain password cocok dengan hash.
 * @param {string} plainPassword
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, hash) {
    return await bcrypt.compare(plainPassword, hash);
}