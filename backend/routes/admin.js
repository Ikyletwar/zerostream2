// ━━━ file: backend/routes/admin.js ━━━
import express from 'express';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { adminLimiter, requireAdminApiKey } from '../middleware.js';
import { triggerManualScrape } from '../scheduler.js';
import { getConnectedClientsCount } from '../websocket.js';
import { getTotalAnimeCount } from '../database.js';

const router = express.Router();

/**
 * Route: POST /api/admin/scrape
 * Memicu proses incremental scraping secara manual di background.
 */
router.post('/scrape', adminLimiter, requireAdminApiKey, async (req, res) => {
    try {
        logger.info('Manual scrape triggered via API');
        triggerManualScrape().then(summary => {
            if (summary && summary.newEpisodes) {
                logger.info(`Manual scrape completed: ${summary.newEpisodes.length} new episodes`);
            } else {
                logger.warn('Manual scrape completed but summary invalid');
            }
        }).catch(err => {
            logger.error('Manual scrape error', { error: err.message });
        });
        res.json({ success: true, message: 'Scrape started in background' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Route: GET /api/admin/status
 * Mengambil ringkasan status kesehatan server, memori, websocket clients, dan database.
 */
router.get('/status', requireAdminApiKey, (req, res) => {
    res.json({
        success: true,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        websocket_clients: getConnectedClientsCount(),
        db_anime_count: getTotalAnimeCount(),
        scheduler_interval_minutes: config.SCRAPE_INTERVAL_MINUTES,
        node_version: process.version,
        env: config.NODE_ENV
    });
});

export default router;
