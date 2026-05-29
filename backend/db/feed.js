// ━━━ file: backend/db/feed.js ━━━
import { getDatabase } from './connection.js';

/**
 * @typedef {Object} FeedEvent
 * @property {number} id ID unik log event.
 * @property {string} event_type Jenis event (misal: 'NEW_EPISODE', 'NEW_ANIME', 'ANIME_UPDATED').
 * @property {string|null} anime_id ID anime terkait.
 * @property {number|null} episode_number Nomor episode terkait.
 * @property {string} message Pesan log deskriptif.
 * @property {number} created_at Epoch timestamp pembuatan log.
 */

/**
 * Menambahkan catatan log event baru ke dalam feed database.
 * @param {string} eventType Jenis event.
 * @param {string|null} animeId ID anime terkait.
 * @param {number|null} episodeNumber Nomor episode terkait.
 * @param {string} message Pesan log deskriptif.
 */
export function addFeedEvent(eventType, animeId, episodeNumber, message) {
    const db = getDatabase();
    db.prepare(`
        INSERT INTO feed_events (event_type, anime_id, episode_number, message, created_at)
        VALUES (?, ?, ?, ?, ?)
    `).run(eventType, animeId, episodeNumber || null, message, Date.now());
}

/**
 * Mengambil daftar feed event terbaru, diurutkan terbalik berdasarkan waktu pembuatan.
 * @param {number} [limit=50] Batas jumlah item log yang dikembalikan.
 * @returns {FeedEvent[]} Daftar objek log event.
 */
export function getFeedEvents(limit = 50) {
    const db = getDatabase();
    return db.prepare(`
        SELECT id, event_type, anime_id, episode_number, message, created_at
        FROM feed_events
        ORDER BY created_at DESC
        LIMIT ?
    `).all(limit);
}
