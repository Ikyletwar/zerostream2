// ━━━ file: backend/database.js ━━━
/**
 * @file database.js
 * @description File utama database layer yang bertindak sebagai facade/re-exporter
 * untuk fungsi-fungsi database yang telah dipecah berdasarkan domain masing-masing.
 * Menjaga backward-compatibility agar import path di file lain tetap bekerja.
 */

import { getDatabase, closeDatabase } from './db/connection.js';
import { 
    upsertAnime, 
    getAnimeById, 
    getAllAnime, 
    getAllAnimeNoPagination, 
    getAllGenres, 
    getTotalAnimeCount, 
    getStats, 
    getRecentlyUpdatedAnime, 
    getNewReleases 
} from './db/anime.js';
import { 
    saveEpisode, 
    saveEpisodes, 
    getEpisodesByAnimeId, 
    getLatestEpisodes 
} from './db/episodes.js';
import { 
    addFeedEvent, 
    getFeedEvents 
} from './db/feed.js';

export {
    getDatabase,
    closeDatabase,
    upsertAnime,
    getAnimeById,
    getAllAnime,
    getAllAnimeNoPagination,
    getAllGenres,
    getTotalAnimeCount,
    getStats,
    getRecentlyUpdatedAnime,
    getNewReleases,
    saveEpisode,
    saveEpisodes,
    getEpisodesByAnimeId,
    getLatestEpisodes,
    addFeedEvent,
    getFeedEvents
};