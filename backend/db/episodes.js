// ━━━ file: backend/db/episodes.js ━━━
import { getDatabase } from './connection.js';

/**
 * @typedef {Object} Episode
 * @property {number} episode_number Nomor episode.
 * @property {string} [title] Judul episode.
 * @property {Object} stream_urls Kumpulan URL stream berdasarkan resolusi (misal: '360p', '720p').
 * @property {number} [created_at] Epoch timestamp pembuatan.
 * @property {number} [updated_at] Epoch timestamp pembaharuan.
 */

/**
 * Menyimpan data episode anime tunggal.
 * @param {string} animeId ID anime pemilik episode.
 * @param {Episode} episode Objek data episode.
 */
export function saveEpisode(animeId, episode) {
    const db = getDatabase();
    const now = Date.now();
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO episodes
        (anime_id, episode_number, title, stream_urls_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        animeId,
        episode.episode_number,
        episode.title || `Episode ${episode.episode_number}`,
        JSON.stringify(episode.stream_urls || {}),
        now,
        now
    );
}

/**
 * Menyimpan banyak data episode secara batch dan memperbarui total_episodes pada info anime.
 * @param {string} animeId ID anime pemilik episode.
 * @param {Episode[]} episodes Daftar objek episode.
 */
export function saveEpisodes(animeId, episodes) {
    for (const ep of episodes) {
        saveEpisode(animeId, ep);
    }
    const db = getDatabase();
    const maxEp = db.prepare("SELECT MAX(episode_number) as max FROM episodes WHERE anime_id = ?").get(animeId);
    if (maxEp && maxEp.max) {
        db.prepare("UPDATE anime_info SET total_episodes = ? WHERE anime_id = ?").run(maxEp.max, animeId);
    }
}

/**
 * Mengambil daftar episode berdasarkan ID anime, berurutan menaik dari episode terkecil.
 * @param {string} animeId ID anime.
 * @returns {Episode[]} Daftar objek episode.
 */
export function getEpisodesByAnimeId(animeId) {
    const db = getDatabase();
    const rows = db.prepare(`
        SELECT episode_number, title, stream_urls_json
        FROM episodes
        WHERE anime_id = ?
        ORDER BY episode_number ASC
    `).all(animeId);
    return rows.map(row => ({
        episode_number: row.episode_number,
        title: row.title,
        stream_urls: JSON.parse(row.stream_urls_json)
    }));
}

/**
 * Mengambil daftar episode terbaru yang baru saja di-upload beserta info ringkas anime.
 * @param {number} [limit=10] Batas jumlah item yang dikembalikan.
 * @returns {Object[]} Daftar episode terbaru.
 */
export function getLatestEpisodes(limit = 10) {
    const db = getDatabase();
    return db.prepare(`
        SELECT e.anime_id, a.title as anime_title, a.poster_url,
               e.episode_number, e.title as episode_title, e.created_at
        FROM episodes e
        JOIN anime a ON a.id = e.anime_id
        ORDER BY e.created_at DESC
        LIMIT ?
    `).all(limit);
}
