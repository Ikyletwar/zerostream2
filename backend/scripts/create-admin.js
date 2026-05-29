// ━━━ file: backend/scripts/create-admin.js ━━━
/**
 * @file create-admin.js
 * @description CLI script untuk membuat akun admin pertama.
 * Jalankan: npm run create-admin
 * 
 * Script ini akan meminta username dan password, lalu menyimpan user dengan role 'admin'.
 * Password global (global_login) tidak diatur di sini; gunakan set-global-password.js atau nanti via admin panel.
 */

import readline from 'readline';
import { hashPassword } from '../auth/password.js';
import { createUser, getUserByUsername } from '../db/users.js';
import { getDatabase, closeDatabase } from '../db/connection.js';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log(`
╔══════════════════════════════════════════════════╗
║         CREATE ADMIN USER - ZEROSTREAM           ║
╠══════════════════════════════════════════════════╣
║  Script ini akan membuat akun administrator.     ║
║  Pastikan Anda sudah mengatur JWT_SECRET di .env ║
╚══════════════════════════════════════════════════╝
`);

    // Inisialisasi database (memastikan tabel users ada)
    getDatabase();

    const username = await askQuestion('Username admin: ');
    if (!username || username.trim().length === 0) {
        console.log('❌ Username tidak boleh kosong.');
        rl.close();
        closeDatabase();
        process.exit(1);
    }
    const normalizedUsername = username.trim();

    const existing = await getUserByUsername(normalizedUsername);
    if (existing) {
        console.log(`❌ Username "${normalizedUsername}" sudah ada.`);
        rl.close();
        closeDatabase();
        process.exit(1);
    }

    const password = await askQuestion('Password admin (minimal 4 karakter): ');
    if (!password || password.length < 4) {
        console.log('❌ Password minimal 4 karakter.');
        rl.close();
        closeDatabase();
        process.exit(1);
    }

    const passwordHash = await hashPassword(password);
    await createUser(normalizedUsername, passwordHash, 'admin');

    console.log(`\n✅ Admin user "${normalizedUsername}" berhasil dibuat!`);
    console.log('   Anda sekarang bisa login menggunakan username tersebut dan password global yang akan diatur.\n');
    console.log('⚠️  Jangan lupa untuk mengatur password global terlebih dahulu jika belum:');
    console.log('   - Via admin panel (setelah login sebagai admin)');
    console.log('   - Atau jalankan: npm run set-global-password\n');

    rl.close();
    closeDatabase();
}

main().catch(err => {
    console.error('Error:', err);
    rl.close();
    closeDatabase();
    process.exit(1);
});