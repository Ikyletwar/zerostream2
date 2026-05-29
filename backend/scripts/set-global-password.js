// ━━━ file: backend/scripts/set-global-password.js ━━━
/**
 * @file set-global-password.js
 * @description CLI script untuk mengatur password global pertama kali (fallback jika admin panel belum ada).
 * Jalankan: npm run set-global-password
 */

import readline from 'readline';
import { hashPassword } from '../auth/password.js';
import { setGlobalPasswordHash, isGlobalPasswordSet } from '../db/globalConfig.js';
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
║      SET GLOBAL LOGIN PASSWORD - ZEROSTREAM      ║
╠══════════════════════════════════════════════════╣
║  Password ini akan digunakan oleh SEMUA user     ║
║  untuk login (bersama dengan username bebas).    ║
╚══════════════════════════════════════════════════╝
`);

    getDatabase();

    const alreadySet = await isGlobalPasswordSet();
    if (alreadySet) {
        const confirm = await askQuestion('⚠️  Password global sudah ada. Yakin ingin mengganti? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('Batal.');
            rl.close();
            closeDatabase();
            process.exit(0);
        }
    }

    const password = await askQuestion('Masukkan password global (minimal 4 karakter): ');
    if (!password || password.length < 4) {
        console.log('❌ Password minimal 4 karakter.');
        rl.close();
        closeDatabase();
        process.exit(1);
    }

    const confirmPassword = await askQuestion('Ulangi password: ');
    if (password !== confirmPassword) {
        console.log('❌ Password tidak cocok.');
        rl.close();
        closeDatabase();
        process.exit(1);
    }

    const hashed = await hashPassword(password);
    await setGlobalPasswordHash(hashed);

    console.log('\n✅ Password global berhasil disimpan!');
    console.log('   Sekarang user bisa login dengan username apapun dan password di atas.\n');

    rl.close();
    closeDatabase();
}

main().catch(err => {
    console.error('Error:', err);
    rl.close();
    closeDatabase();
    process.exit(1);
});