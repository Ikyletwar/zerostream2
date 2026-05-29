// ━━━ file: backend/routes/schedule.js ━━━
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';
import { cacheMiddleware } from '../middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * Route: GET /api/schedule
 * Mengambil cache jadwal rilis anime ongoing mingguan dari file JSON.
 */
router.get('/', cacheMiddleware(3600), (req, res) => {
    try {
        const cachePath = path.join(__dirname, '../data/ongoing_schedule_cache.json');
        if (!fs.existsSync(cachePath)) {
            return res.json({ success: true, data: [], cachedAt: Date.now() });
        }
        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        res.json({ success: true, data: cache.data, cachedAt: cache.timestamp });
    } catch (error) {
        logger.error('Error in /api/schedule', { error: error.message });
        res.status(500).json({ success: false, error: 'Schedule not available' });
    }
});

export default router;
