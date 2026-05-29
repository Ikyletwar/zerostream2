// ━━━ file: backend/routes/pages.js ━━━
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Tentukan path absolut untuk folder frontend
const FRONTEND_DIR = path.join(__dirname, '../../frontend');

/**
 * Route: GET /
 * Melayani halaman utama index.html.
 */
router.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

/**
 * Route: GET /anime
 * Melayani halaman detail tontonan anime.html.
 */
router.get('/anime', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'anime.html'));
});

/**
 * Route: GET /schedule
 * Melayani halaman jadwal rilis schedule.html.
 */
router.get('/schedule', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'schedule.html'));
});

/**
 * Route: GET /history
 * Melayani halaman riwayat tontonan history.html.
 */
router.get('/history', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'history.html'));
});

export default router;
