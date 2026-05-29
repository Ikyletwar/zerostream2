// ━━━ file: backend/db/connection.js ━━━
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'nimegami.db');

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;

/**
 * Mendapatkan atau menginisialisasi instansi SQLite database (Singleton).
 * @returns {DatabaseSync} Instansi database SQLite.
 */
export function getDatabase() {
    if (!dbInstance) {
        dbInstance = new DatabaseSync(DB_PATH);
        dbInstance.exec('PRAGMA journal_mode = WAL;');
        dbInstance.exec('PRAGMA synchronous = NORMAL;');
        dbInstance.exec('PRAGMA cache_size = 10000;');
        dbInstance.exec('PRAGMA foreign_keys = ON;');
        initializeSchema(dbInstance);
    }
    return dbInstance;
}

/**
 * Inisialisasi skema tabel jika belum ada.
 * @param {DatabaseSync} db Instansi database SQLite.
 */
function initializeSchema(db) {
    // Tabel anime (existing)
    db.exec(`
        CREATE TABLE IF NOT EXISTS anime (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            slug TEXT UNIQUE,
            url TEXT,
            status TEXT CHECK(status IN ('ongoing', 'complete')),
            poster_url TEXT,
            rating REAL,
            synopsis TEXT,
            created_at INTEGER,
            updated_at INTEGER
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS anime_info (
            anime_id TEXT PRIMARY KEY,
            alternative_title TEXT,
            duration TEXT,
            studio TEXT,
            season TEXT,
            type TEXT,
            total_episodes INTEGER DEFAULT 0,
            subtitle TEXT,
            credit TEXT,
            series_name TEXT,
            FOREIGN KEY(anime_id) REFERENCES anime(id) ON DELETE CASCADE
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS episodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            anime_id TEXT NOT NULL,
            episode_number INTEGER NOT NULL,
            title TEXT,
            stream_urls_json TEXT NOT NULL,
            created_at INTEGER,
            updated_at INTEGER,
            UNIQUE(anime_id, episode_number),
            FOREIGN KEY(anime_id) REFERENCES anime(id) ON DELETE CASCADE
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS anime_genres (
            anime_id TEXT NOT NULL,
            genre TEXT NOT NULL,
            PRIMARY KEY(anime_id, genre),
            FOREIGN KEY(anime_id) REFERENCES anime(id) ON DELETE CASCADE
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at INTEGER NOT NULL
        )
    `);
    db.exec(`
        CREATE TABLE IF NOT EXISTS feed_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            anime_id TEXT,
            episode_number INTEGER,
            message TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    `);
    
    // ========== TABEL BARU UNTUK AUTH ==========
    // Tabel users
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
            created_at INTEGER NOT NULL,
            last_login INTEGER
        )
    `);
    
    // Tabel global_config (key-value store)
    db.exec(`
        CREATE TABLE IF NOT EXISTS global_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER
        )
    `);
    
    // Index untuk performa query
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)`);
    
    // Migrasi existing (feed_events) - tetap dijalankan
    const migration = db.prepare("SELECT 1 FROM migrations WHERE name = 'v3_feed_events'").get();
    if (!migration) {
        db.prepare("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run('v3_feed_events', Date.now());
    }
    
    // Migrasi untuk tabel users & global_config
    const authMigration = db.prepare("SELECT 1 FROM migrations WHERE name = 'v4_auth_tables'").get();
    if (!authMigration) {
        db.prepare("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run('v4_auth_tables', Date.now());
    }
}

/**
 * Menutup koneksi database.
 */
export function closeDatabase() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}