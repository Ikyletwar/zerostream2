// ━━━ file: scripts/remove-anime.js ━━━
/**
 * @file remove-anime.js
 * @description Script CLI interaktif untuk menghapus anime dari database SQLite ZeroStream
 * berdasarkan slug atau URL.
 * Jalankan: node scripts/remove-anime.js
 */

import { getDatabase, getAnimeById, closeDatabase } from '../backend/database.js';
import readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Helper untuk meminta input dari user di terminal.
 * @param {string} query Pertanyaan prompt.
 * @returns {Promise<string>} Jawaban user.
 */
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Ekstrak slug anime dari string URL.
 * @param {string} url URL anime.
 * @returns {string|null} Slug anime.
 */
function extractSlugFromUrl(url) {
    const match = url.match(/\.id\/([^\/?#]+)/);
    return match ? match[1] : null;
}

/**
 * Mencari data anime di database berdasarkan slug inputan atau URL.
 * @param {string} input Input string berupa slug atau URL.
 * @returns {Promise<Object|null>} Objek anime atau null jika tidak ketemu.
 */
async function findAnime(input) {
    let anime = getAnimeById(input);
    if (anime) return anime;

    const slugFromUrl = extractSlugFromUrl(input);
    if (slugFromUrl) {
        anime = getAnimeById(slugFromUrl);
        if (anime) return anime;
    }

    return null;
}

/**
 * Menghapus anime beserta log feed-events terkait dari database.
 * @param {string} slug ID/slug anime.
 * @returns {Promise<boolean>} True jika berhasil dihapus, false jika gagal.
 */
async function removeAnime(slug) {
    const db = getDatabase();
    // Hapus feed events terkait secara manual (karena tidak ada FK cascade)
    db.prepare("DELETE FROM feed_events WHERE anime_id = ?").run(slug);
    // Hapus anime utama (cascade akan menghapus info, genres, dan episodes)
    const result = db.prepare("DELETE FROM anime WHERE id = ?").run(slug);
    return result.changes > 0;
}

/**
 * Loop interaktif utama hapus anime.
 */
async function main() {
    console.log(`
╔══════════════════════════════════════════════════╗
║           ZEROSTREAM - HAPUS ANIME               ║
╠══════════════════════════════════════════════════╣
║  Masukkan slug atau URL anime yang akan dihapus ║
║  Contoh slug: clannad-sub-indo-1                ║
║  Contoh URL: https://nimegami.id/clannad-sub-indo-1/ ║
║  Kosongkan untuk selesai                        ║
╚══════════════════════════════════════════════════╝
    `);

    let removedCount = 0;
    let notFoundCount = 0;

    while (true) {
        const input = await askQuestion('\n🔍 Masukkan slug atau URL anime (ENTER untuk selesai): ');
        if (!input.trim()) break;

        const anime = await findAnime(input.trim());
        if (!anime) {
            console.log(`❌ Anime tidak ditemukan untuk: ${input}`);
            notFoundCount++;
            continue;
        }

        console.log(`\n📋 Anime yang akan dihapus:`);
        console.log(`   ID: ${anime.id}`);
        console.log(`   Judul: ${anime.title}`);
        console.log(`   Status: ${anime.status}`);
        console.log(`   Total episode: ${anime.episodes?.length || 0}`);
        console.log(`   Genre: ${anime.info.genres.join(', ')}`);

        const confirm = await askQuestion('\n⚠️  Yakin ingin menghapus anime ini? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('Batal.');
            continue;
        }

        const success = await removeAnime(anime.id);
        if (success) {
            console.log(`✅ Anime "${anime.title}" berhasil dihapus.`);
            removedCount++;
        } else {
            console.log(`❌ Gagal menghapus anime "${anime.title}".`);
        }
    }

    console.log(`
╔══════════════════════════════════════════════════╗
║                    RINGKASAN                     ║
╠══════════════════════════════════════════════════╣
║  ✅ Berhasil dihapus: ${removedCount} anime
║  ❌ Tidak ditemukan: ${notFoundCount} anime
╚══════════════════════════════════════════════════╝
    `);

    rl.close();
    closeDatabase();
}

main().catch(err => {
    console.error('Error:', err);
    rl.close();
    process.exit(1);
});
