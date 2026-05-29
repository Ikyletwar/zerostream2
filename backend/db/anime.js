// ━━━ file: backend/db/anime.js ━━━
import { getDatabase } from './connection.js';
import { getEpisodesByAnimeId } from './episodes.js';

/**
 * @typedef {Object} AnimeInfo
 * @property {string} [alternative_title]
 * @property {string} [duration]
 * @property {string} [studio]
 * @property {string[]} [genres]
 * @property {string} [season]
 * @property {string} [type]
 * @property {number} [total_episodes]
 * @property {string} [subtitle]
 * @property {string} [credit]
 * @property {string} [series_name]
 * @property {boolean} [is_complete]
 */

/**
 * @typedef {Object} Anime
 * @property {string} id
 * @property {string} title
 * @property {string} slug
 * @property {string} url
 * @property {string} status
 * @property {string} poster_url
 * @property {number} [rating]
 * @property {string} [synopsis]
 * @property {AnimeInfo} info
 * @property {Array} [episodes]
 * @property {number} [created_at]
 * @property {number} [updated_at]
 */

/**
 * Menambahkan atau memperbarui data anime beserta detail info dan genre.
 * @param {Anime} anime Objek data anime.
 * @returns {Anime} Objek data anime yang berhasil disimpan.
 */
export function upsertAnime(anime) {
    const db = getDatabase();
    const now = Date.now();
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO anime 
        (id, title, slug, url, status, poster_url, rating, synopsis, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, ?), ?)
    `);
    stmt.run(
        anime.id,
        anime.title,
        anime.slug || anime.id,
        anime.url,
        anime.status,
        anime.poster_url,
        anime.rating || null,
        anime.synopsis || '',
        anime.created_at || now,
        now
    );
    
    const infoStmt = db.prepare(`
        INSERT OR REPLACE INTO anime_info 
        (anime_id, alternative_title, duration, studio, season, type, total_episodes, subtitle, credit, series_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    infoStmt.run(
        anime.id,
        anime.info?.alternative_title || null,
        anime.info?.duration || null,
        anime.info?.studio || null,
        anime.info?.season || null,
        anime.info?.type || null,
        anime.info?.total_episodes || 0,
        anime.info?.subtitle || 'Indonesia',
        anime.info?.credit || null,
        anime.info?.series_name || null
    );
    
    db.prepare("DELETE FROM anime_genres WHERE anime_id = ?").run(anime.id);
    if (anime.info?.genres && Array.isArray(anime.info.genres)) {
        const genreStmt = db.prepare("INSERT INTO anime_genres (anime_id, genre) VALUES (?, ?)");
        for (const genre of anime.info.genres) {
            genreStmt.run(anime.id, genre);
        }
    }
    return anime;
}

/**
 * Mengambil detail anime berdasarkan ID/slug lengkap beserta list episode dan genre.
 * @param {string} id ID atau slug anime.
 * @returns {Anime|null} Objek anime jika ditemukan, null jika tidak.
 */
export function getAnimeById(id) {
    const db = getDatabase();
    const row = db.prepare(`
        SELECT a.*, 
               ai.alternative_title, ai.duration, ai.studio, ai.season, ai.type, 
               ai.total_episodes, ai.subtitle, ai.credit, ai.series_name
        FROM anime a
        LEFT JOIN anime_info ai ON a.id = ai.anime_id
        WHERE a.id = ?
    `).get(id);
    if (!row) return null;
    const genres = db.prepare("SELECT genre FROM anime_genres WHERE anime_id = ?").all(id).map(r => r.genre);
    const episodes = getEpisodesByAnimeId(id);
    return {
        id: row.id,
        url: row.url,
        title: row.title,
        slug: row.slug,
        status: row.status,
        poster_url: row.poster_url,
        poster_dimensions: { width: null, height: null },
        rating: row.rating,
        synopsis: row.synopsis,
        info: {
            alternative_title: row.alternative_title,
            duration: row.duration,
            studio: row.studio,
            genres,
            season: row.season,
            type: row.type,
            total_episodes: row.total_episodes,
            subtitle: row.subtitle,
            credit: row.credit,
            series_name: row.series_name,
            is_complete: row.status === 'complete'
        },
        episodes,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

/**
 * Mengambil daftar anime terpaginasi dengan filter genre, status, search pencarian, dan opsi sorting.
 * @param {Object} [options] Opsi parameter query.
 * @param {number} [options.page=1] Halaman aktif.
 * @param {number} [options.limit=50] Batas jumlah item per halaman.
 * @param {string|null} [options.genre=null] Filter berdasarkan genre.
 * @param {string|null} [options.status=null] Filter berdasarkan status (ongoing/complete).
 * @param {string|null} [options.search=null] Query kata kunci pencarian.
 * @param {string} [options.sort='latest'] Urutan sorting ('latest', 'rating', 'title', 'title-desc').
 * @param {string} [options.order='asc'] Arah urutan sorting.
 * @returns {Object} Data list anime terpaginasi beserta informasi halaman.
 */
export function getAllAnime({ page = 1, limit = 50, genre = null, status = null, search = null, sort = 'latest', order = 'asc' } = {}) {
    const db = getDatabase();
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];
    
    if (genre && genre !== 'all') {
        conditions.push(`a.id IN (SELECT anime_id FROM anime_genres WHERE genre = ?)`);
        params.push(genre);
    }
    if (status && status !== 'all') {
        conditions.push(`a.status = ?`);
        params.push(status);
    }
    if (search && search.trim()) {
        conditions.push(`(a.title LIKE ? OR ai.alternative_title LIKE ?)`);
        const pat = `%${search.trim()}%`;
        params.push(pat, pat);
    }
    
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const countSql = `
        SELECT COUNT(DISTINCT a.id) as total 
        FROM anime a 
        LEFT JOIN anime_info ai ON a.id = ai.anime_id
        ${whereClause}
    `;
    const { total } = db.prepare(countSql).get(...params.filter(p => typeof p !== 'number' && p !== undefined));
    
    let orderBy = '';
    let queryParams = [...params];
    
    switch (sort) {
        case 'rating':
            orderBy = 'ORDER BY a.rating DESC NULLS LAST';
            break;
        case 'title-desc':
            orderBy = 'ORDER BY a.title DESC';
            break;
        case 'latest':
            orderBy = `
                ORDER BY COALESCE(
                    (SELECT MAX(e.created_at) FROM episodes e WHERE e.anime_id = a.id),
                    a.created_at
                ) DESC
            `;
            break;
        case 'title':
        default:
            orderBy = 'ORDER BY a.title ASC';
            break;
    }
    
    const sql = `
        SELECT DISTINCT a.id, a.title, a.status, a.poster_url, a.rating, a.synopsis, a.created_at,
               ai.total_episodes, ai.studio, ai.series_name,
               (SELECT GROUP_CONCAT(genre, ',') FROM anime_genres WHERE anime_id = a.id) as genres_csv
        FROM anime a
        LEFT JOIN anime_info ai ON a.id = ai.anime_id
        ${whereClause}
        ${orderBy}
        LIMIT ? OFFSET ?
    `;
    
    queryParams.push(limit, offset);
    const rows = db.prepare(sql).all(...queryParams);
    
    const data = rows.map(row => ({
        id: row.id,
        title: row.title,
        status: row.status,
        poster_url: row.poster_url,
        rating: row.rating,
        synopsis: row.synopsis,
        info: {
            total_episodes: row.total_episodes,
            studio: row.studio,
            series_name: row.series_name,
            genres: row.genres_csv ? row.genres_csv.split(',') : []
        }
    }));
    
    return {
        data,
        pagination: {
            current_page: page,
            per_page: limit,
            total_items: total,
            total_pages: Math.ceil(total / limit),
            has_next: page < Math.ceil(total / limit),
            has_prev: page > 1
        }
    };
}

/**
 * Mengambil seluruh daftar anime secara lengkap tanpa paginasi untuk kebutuhan index lokal.
 * @returns {Anime[]} Daftar seluruh objek anime.
 */
export function getAllAnimeNoPagination() {
    const db = getDatabase();
    const rows = db.prepare(`
        SELECT a.id, a.title, a.status, a.poster_url, a.rating, a.synopsis, a.url,
               ai.total_episodes, ai.studio, ai.series_name, ai.alternative_title, ai.duration, ai.season, ai.type, ai.credit,
               (SELECT GROUP_CONCAT(genre, ',') FROM anime_genres WHERE anime_id = a.id) as genres_csv
        FROM anime a
        LEFT JOIN anime_info ai ON a.id = ai.anime_id
        ORDER BY a.title ASC
    `).all();
    return rows.map(row => ({
        id: row.id,
        url: row.url,
        title: row.title,
        status: row.status,
        poster_url: row.poster_url,
        rating: row.rating,
        synopsis: row.synopsis,
        info: {
            alternative_title: row.alternative_title,
            duration: row.duration,
            studio: row.studio,
            season: row.season,
            type: row.type,
            total_episodes: row.total_episodes,
            subtitle: 'Indonesia',
            credit: row.credit,
            series_name: row.series_name,
            genres: row.genres_csv ? row.genres_csv.split(',') : []
        }
    }));
}

/**
 * Mengambil daftar genre unik yang ada di database.
 * @returns {string[]} Array nama genre berurutan abjad.
 */
export function getAllGenres() {
    const db = getDatabase();
    const rows = db.prepare("SELECT DISTINCT genre FROM anime_genres ORDER BY genre ASC").all();
    return rows.map(r => r.genre);
}

/**
 * Mendapatkan jumlah total anime di database.
 * @returns {number} Jumlah total anime.
 */
export function getTotalAnimeCount() {
    const db = getDatabase();
    const row = db.prepare("SELECT COUNT(*) as total FROM anime").get();
    return row.total;
}

/**
 * Mendapatkan statistik ringkasan database (total anime, ongoing, complete, episodes, dll).
 * @returns {Object} Objek statistik.
 */
export function getStats() {
    const db = getDatabase();
    const total = db.prepare("SELECT COUNT(*) as total FROM anime").get().total;
    const ongoing = db.prepare("SELECT COUNT(*) as total FROM anime WHERE status = 'ongoing'").get().total;
    const complete = db.prepare("SELECT COUNT(*) as total FROM anime WHERE status = 'complete'").get().total;
    const epRow = db.prepare("SELECT SUM(total_episodes) as total FROM anime_info").get();
    const totalEpisodes = epRow.total || 0;
    const lastEvent = db.prepare("SELECT created_at FROM feed_events ORDER BY created_at DESC LIMIT 1").get();
    return {
        total_anime: total,
        ongoing_anime: ongoing,
        complete_anime: complete,
        total_episodes: totalEpisodes,
        last_updated: lastEvent ? lastEvent.created_at : null,
        scraped_at: null
    };
}

/**
 * Mengambil daftar anime yang baru saja di-update episodenya dalam 24 jam terakhir.
 * @param {number} [limit=10] Batas jumlah item yang dikembalikan.
 * @returns {Object[]} Daftar anime baru terupdate.
 */
export function getRecentlyUpdatedAnime(limit = 10) {
    const db = getDatabase();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return db.prepare(`
        SELECT DISTINCT a.id, a.title, a.slug, a.status, a.poster_url, a.rating,
               ai.total_episodes, MAX(e.created_at) as last_episode_at
        FROM anime a
        JOIN episodes e ON e.anime_id = a.id
        LEFT JOIN anime_info ai ON ai.anime_id = a.id
        WHERE e.created_at > ?
        GROUP BY a.id
        ORDER BY last_episode_at DESC
        LIMIT ?
    `).all(oneDayAgo, limit);
}

/**
 * Mengambil daftar anime yang baru saja ditambahkan ke database (berdasarkan tanggal entry dibuat).
 * @param {number} [limit=10] Batas jumlah item yang dikembalikan.
 * @returns {Object[]} Daftar anime rilis baru.
 */
export function getNewReleases(limit = 10) {
    const db = getDatabase();
    return db.prepare(`
        SELECT a.id, a.title, a.slug, a.status, a.poster_url, a.rating, a.created_at,
               ai.total_episodes
        FROM anime a
        LEFT JOIN anime_info ai ON ai.anime_id = a.id
        ORDER BY a.created_at DESC
        LIMIT ?
    `).all(limit);
}
