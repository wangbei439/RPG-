const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'rpg-generator.db');

let db = null;

/**
 * Initialize the SQLite database and create tables if they don't exist.
 * Uses WAL mode for better concurrent read performance.
 */
function initDatabase() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    try {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('foreign_keys = ON');

        db.exec(`
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                config TEXT NOT NULL,
                data TEXT NOT NULL,
                state TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS generation_sessions (
                id TEXT PRIMARY KEY,
                memory_state TEXT NOT NULL,
                config TEXT NOT NULL,
                project_id TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_games_updated ON games(updated_at);
            CREATE INDEX IF NOT EXISTS idx_sessions_updated ON generation_sessions(updated_at);
            CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);
        `);

        console.log(`[Database] SQLite database initialized at ${DB_PATH}`);
        return db;
    } catch (error) {
        console.error(`[Database] Failed to initialize database: ${error.message}`);
        // If the DB file is corrupted, try to recover by removing it
        if (fs.existsSync(DB_PATH)) {
            console.warn('[Database] Attempting to recover by removing corrupted database file...');
            try {
                fs.unlinkSync(DB_PATH);
                // Also remove WAL and SHM files if they exist
                const walPath = DB_PATH + '-wal';
                const shmPath = DB_PATH + '-shm';
                if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
                if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

                db = new Database(DB_PATH);
                db.pragma('journal_mode = WAL');
                db.pragma('synchronous = NORMAL');
                db.pragma('foreign_keys = ON');

                db.exec(`
                    CREATE TABLE IF NOT EXISTS games (
                        id TEXT PRIMARY KEY,
                        config TEXT NOT NULL,
                        data TEXT NOT NULL,
                        state TEXT,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS generation_sessions (
                        id TEXT PRIMARY KEY,
                        memory_state TEXT NOT NULL,
                        config TEXT NOT NULL,
                        project_id TEXT,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS projects (
                        id TEXT PRIMARY KEY,
                        data TEXT NOT NULL,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_games_updated ON games(updated_at);
                    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON generation_sessions(updated_at);
                    CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);
                `);

                console.log('[Database] Database recovered successfully');
                return db;
            } catch (recoveryError) {
                console.error(`[Database] Recovery failed: ${recoveryError.message}`);
                db = null;
                return null;
            }
        }
        db = null;
        return null;
    }
}

function getDb() {
    if (!db) {
        initDatabase();
    }
    return db;
}

// ===== Games =====

function saveGame(id, config, data, state) {
    const database = getDb();
    if (!database) return false;

    try {
        const now = Date.now();
        const configJson = typeof config === 'string' ? config : JSON.stringify(config);
        const dataJson = typeof data === 'string' ? data : JSON.stringify(data);
        const stateJson = state ? (typeof state === 'string' ? state : JSON.stringify(state)) : null;

        database.prepare(`
            INSERT INTO games (id, config, data, state, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                config = excluded.config,
                data = excluded.data,
                state = excluded.state,
                updated_at = excluded.updated_at
        `).run(id, configJson, dataJson, stateJson, now, now);

        return true;
    } catch (error) {
        console.error(`[Database] Failed to save game ${id}:`, error.message);
        return false;
    }
}

function loadGame(id) {
    const database = getDb();
    if (!database) return null;

    try {
        const row = database.prepare('SELECT * FROM games WHERE id = ?').get(id);
        if (!row) return null;

        return {
            id: row.id,
            config: JSON.parse(row.config),
            data: JSON.parse(row.data),
            state: row.state ? JSON.parse(row.state) : null,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error(`[Database] Failed to load game ${id}:`, error.message);
        return null;
    }
}

function deleteGame(id) {
    const database = getDb();
    if (!database) return false;

    try {
        database.prepare('DELETE FROM games WHERE id = ?').run(id);
        return true;
    } catch (error) {
        console.error(`[Database] Failed to delete game ${id}:`, error.message);
        return false;
    }
}

function loadAllGames() {
    const database = getDb();
    if (!database) return [];

    try {
        const rows = database.prepare('SELECT * FROM games').all();
        return rows.map((row) => {
            try {
                return {
                    id: row.id,
                    config: JSON.parse(row.config),
                    data: JSON.parse(row.data),
                    state: row.state ? JSON.parse(row.state) : null,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                };
            } catch (parseError) {
                console.warn(`[Database] Failed to parse game ${row.id}:`, parseError.message);
                return null;
            }
        }).filter(Boolean);
    } catch (error) {
        console.error('[Database] Failed to load all games:', error.message);
        return [];
    }
}

// ===== Generation Sessions =====

function saveSession(id, memoryState, config, projectId) {
    const database = getDb();
    if (!database) return false;

    try {
        const now = Date.now();
        const memoryStateJson = typeof memoryState === 'string' ? memoryState : JSON.stringify(memoryState);
        const configJson = typeof config === 'string' ? config : JSON.stringify(config);

        database.prepare(`
            INSERT INTO generation_sessions (id, memory_state, config, project_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                memory_state = excluded.memory_state,
                config = excluded.config,
                project_id = excluded.project_id,
                updated_at = excluded.updated_at
        `).run(id, memoryStateJson, configJson, projectId || null, now, now);

        return true;
    } catch (error) {
        console.error(`[Database] Failed to save session ${id}:`, error.message);
        return false;
    }
}

function loadSession(id) {
    const database = getDb();
    if (!database) return null;

    try {
        const row = database.prepare('SELECT * FROM generation_sessions WHERE id = ?').get(id);
        if (!row) return null;

        return {
            id: row.id,
            memoryState: JSON.parse(row.memory_state),
            config: JSON.parse(row.config),
            projectId: row.project_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    } catch (error) {
        console.error(`[Database] Failed to load session ${id}:`, error.message);
        return null;
    }
}

function deleteSession(id) {
    const database = getDb();
    if (!database) return false;

    try {
        database.prepare('DELETE FROM generation_sessions WHERE id = ?').run(id);
        return true;
    } catch (error) {
        console.error(`[Database] Failed to delete session ${id}:`, error.message);
        return false;
    }
}

function loadAllSessions() {
    const database = getDb();
    if (!database) return [];

    try {
        const rows = database.prepare('SELECT * FROM generation_sessions').all();
        return rows.map((row) => {
            try {
                return {
                    id: row.id,
                    memoryState: JSON.parse(row.memory_state),
                    config: JSON.parse(row.config),
                    projectId: row.project_id,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                };
            } catch (parseError) {
                console.warn(`[Database] Failed to parse session ${row.id}:`, parseError.message);
                return null;
            }
        }).filter(Boolean);
    } catch (error) {
        console.error('[Database] Failed to load all sessions:', error.message);
        return [];
    }
}

// ===== Projects =====

function saveProject(id, data) {
    const database = getDb();
    if (!database) return false;

    try {
        const now = Date.now();
        const dataJson = typeof data === 'string' ? data : JSON.stringify(data);

        database.prepare(`
            INSERT INTO projects (id, data, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                updated_at = excluded.updated_at
        `).run(id, dataJson, now, now);

        return true;
    } catch (error) {
        console.error(`[Database] Failed to save project ${id}:`, error.message);
        return false;
    }
}

function loadProject(id) {
    const database = getDb();
    if (!database) return null;

    try {
        const row = database.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        if (!row) return null;

        return JSON.parse(row.data);
    } catch (error) {
        console.error(`[Database] Failed to load project ${id}:`, error.message);
        return null;
    }
}

function deleteProject(id) {
    const database = getDb();
    if (!database) return false;

    try {
        database.prepare('DELETE FROM projects WHERE id = ?').run(id);
        return true;
    } catch (error) {
        console.error(`[Database] Failed to delete project ${id}:`, error.message);
        return false;
    }
}

function loadAllProjects() {
    const database = getDb();
    if (!database) return [];

    try {
        const rows = database.prepare('SELECT * FROM projects').all();
        return rows.map((row) => {
            try {
                const project = JSON.parse(row.data);
                return project;
            } catch (parseError) {
                console.warn(`[Database] Failed to parse project ${row.id}:`, parseError.message);
                return null;
            }
        }).filter(Boolean);
    } catch (error) {
        console.error('[Database] Failed to load all projects:', error.message);
        return [];
    }
}

// ===== Cleanup =====

function cleanupExpired(beforeTimestamp) {
    const database = getDb();
    if (!database) return { games: 0, sessions: 0, projects: 0 };

    try {
        const gamesResult = database.prepare('DELETE FROM games WHERE updated_at < ?').run(beforeTimestamp);
        const sessionsResult = database.prepare('DELETE FROM generation_sessions WHERE updated_at < ?').run(beforeTimestamp);
        // Don't auto-delete projects - they are explicitly managed by users

        return {
            games: gamesResult.changes,
            sessions: sessionsResult.changes,
            projects: 0
        };
    } catch (error) {
        console.error('[Database] Failed to cleanup expired records:', error.message);
        return { games: 0, sessions: 0, projects: 0 };
    }
}

/**
 * Close the database connection gracefully.
 */
function closeDatabase() {
    if (db) {
        try {
            db.close();
            console.log('[Database] Database connection closed');
        } catch (error) {
            console.error('[Database] Error closing database:', error.message);
        }
        db = null;
    }
}

module.exports = {
    initDatabase,
    getDb,
    closeDatabase,
    saveGame,
    loadGame,
    deleteGame,
    loadAllGames,
    saveSession,
    loadSession,
    deleteSession,
    loadAllSessions,
    saveProject,
    loadProject,
    deleteProject,
    loadAllProjects,
    cleanupExpired
};
