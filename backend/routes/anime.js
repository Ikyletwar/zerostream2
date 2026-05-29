// ━━━ file: backend/routes/anime.js ━━━
import express from 'express';
import { logger } from '../logger.js';
import { cacheMiddleware } from '../middleware.js';
import { 
    getAnimeById, getAllAnime, getAllAnimeNoPagination,
    getAllGenres, getStats, getLatestEpisodes, 
    getRecentlyUpdatedAnime, getNewReleases, getFeedEvents
} from '../database.js';

const router = express.Router();

/**
 * Route: GET /api/anime/all
 * Mengambil semua anime tanpa paginasi (untuk pencarian local index).
 */
router.get('/all', cacheMiddleware(), (req, res) => {
    try {
        const data = getAllAnimeNoPagination();
        res.json({ success: true, total: data.length, data });
    } catch (error) {
        logger.error('Error in /api/anime/all', { error: error.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Route: GET /api/anime
 * Mengambil list anime terpaginasi dengan filter & sorting.
 */
router.get('/', cacheMiddleware(30), (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const sort = req.query.sort || 'latest';
        
        const result = getAllAnime({
            page, limit,
            genre: req.query.genre,
            status: req.query.status,
            search: req.query.search,
            sort: sort,
            order: req.query.order
        });
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error('Error in /api/anime', { error: error.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Route: GET /api/genres
 * Mengambil semua genre unik yang tersedia.
 */
router.get('/genres', cacheMiddleware(3600), (req, res) => {
    try {
        const genres = getAllGenres();
        res.json({ success: true, total: genres.length, data: genres });
    } catch (error) {
        logger.error('Error in /api/genres', { error: error.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Route: GET /api/stats
 * Mengambil informasi statistik database.
 */
router.get('/stats', cacheMiddleware(300), (req, res) => {
    try {
        const stats = getStats();
        res.json({ success: true, stats });
    } catch (error) {
        logger.error('Error in /api/stats', { error: error.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Route: GET /api/latest/episodes
 * Mengambil list episode terbaru yang di-upload.
 */
router.get('/latest/episodes', cacheMiddleware(30), (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const episodes = getLatestEpisodes(limit);
        res.json({ success: true, data: episodes });
    } catch (error) {
        logger.error('Error in /api/latest/episodes', { error: error.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Route: GET /api/latest/anime
 * Mengambil list anime terbaru berdasarkan tipe (recently_updated atau new_release).
 */
router.get('/latest/anime', cacheMiddleware(60), (req, res) => {
    try {
        const type = req.query.type || 'new_release';
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const data = type === 'recently_updated' ? getRecentlyUpdatedAnime(limit) : getNewReleases(limit);
        res.json({ success: true, type, data });
    } catch (error) {
        logger.error('Error in /api/latest/anime', { error: error.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Route: GET /api/live-feed
 * Mengambil event logs aktivitas live feed server.
 */
router.get('/live-feed', cacheMiddleware(10), (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 30, 100);
        const events = getFeedEvents(limit);
        res.json({ success: true, data: events });
    } catch (error) {
        logger.error('Error in /api/live-feed', { error: error.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * Route: GET /api/anime/:id
 * Mengambil detail anime berdasarkan ID/slug.
 */
router.get('/:id', cacheMiddleware(300), (req, res) => {
    try {
        const anime = getAnimeById(req.params.id);
        if (!anime) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: anime });
    } catch (error) {
        logger.error('Error in /api/anime/:id', { id: req.params.id, error: error.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;
