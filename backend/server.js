// ━━━ file: backend/server.js ━━━
import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';

import { config } from './config.js';
import { logger } from './logger.js';
import { 
    apiLimiter, requestLogger, securityHeaders, cacheMiddleware 
} from './middleware.js';
import { getTotalAnimeCount, getAllGenres } from './database.js';
import { initScheduler, triggerManualScrape } from './scheduler.js';
import { initWebSocketServer } from './websocket.js';
import { authMiddleware, requireAdmin, optionalAuth } from './middleware/auth.js';

// Import Router Modular
import animeRouter from './routes/anime.js';
import scheduleRouter from './routes/schedule.js';
import adminRouter from './routes/admin.js';
import pagesRouter from './routes/pages.js';
import authRouter from './routes/auth.js';
import adminUsersRouter from './routes/admin/users.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.PORT;

// JWT_SECRET validation
if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET environment variable is not set. Server cannot start.');
    process.exit(1);
}

// Middleware Global
app.use(cors({ 
    origin: 'http://localhost:3000', 
    credentials: true 
}));
app.use(express.json());
app.use(cookieParser());
app.use(securityHeaders);
app.use(requestLogger);

// Melayani file statis frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate Limiting khusus untuk jalur API
app.use('/api', apiLimiter);

// ========== AUTH ROUTES (publik) ==========
app.use('/api/auth', authRouter);

// ========== PROTECTED API ROUTES ==========
app.use('/api/anime', authMiddleware, animeRouter);
app.use('/api/schedule', authMiddleware, scheduleRouter);
app.use('/api/admin', authMiddleware, requireAdmin, adminRouter);
app.use('/api/admin/users', authMiddleware, requireAdmin, adminUsersRouter);

// Endpoint genres global (kompatibilitas)
app.get('/api/genres', authMiddleware, cacheMiddleware(3600), (req, res) => {
    try {
        const genres = getAllGenres();
        res.json({ success: true, total: genres.length, data: genres });
    } catch (error) {
        logger.error('Error fetching genres in server.js', { error: error.message });
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Root API (public info, optional auth)
app.get('/api', optionalAuth, (req, res) => {
    res.json({
        name: 'ZeroStream API',
        version: '4.0.0',
        total_anime: getTotalAnimeCount(),
        database: 'SQLite',
        websocket: 'enabled',
        scheduler: `active (every ${config.SCRAPE_INTERVAL_MINUTES} min)`,
        uptime: process.uptime(),
        authenticated: !!req.user,
        endpoints: ['/api/anime', '/api/anime/:id', '/api/genres', '/api/stats', '/api/latest/*', '/api/schedule', '/api/live-feed']
    });
});

// Endpoint health (public)
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

// Halaman HTML statis
app.use('/', pagesRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ========== SERVER STARTUP ==========
const server = http.createServer(app);

initWebSocketServer(server);
initScheduler();

// Jalankan scrape awal
triggerManualScrape().catch(err => logger.error('Initial scrape failed', err));

server.listen(PORT, '0.0.0.0', async () => {
    logger.info(`ZeroStream server started on port ${PORT}`);
    
    const { isGlobalPasswordSet } = await import('./db/globalConfig.js');
    const globalPasswordStatus = isGlobalPasswordSet() ? 'SET' : 'NOT SET (run setup)';
    
    console.log(`
╔══════════════════════════════════════════════════╗
║        🎬 ZEROSTREAM STREAMING SERVER 🎬        ║
╠══════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                 ║
║  API: http://localhost:${PORT}/api               ║
║  WebSocket: ws://localhost:${PORT}                ║
║  Environment: ${config.NODE_ENV}                    ║
║  Auth: JWT + HttpOnly cookie                     ║
║  Global Password: ${globalPasswordStatus}
╚══════════════════════════════════════════════════╝
    `);
});