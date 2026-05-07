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

            -- Encrypted settings storage (API keys, LLM config, etc.)
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                encrypted INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            -- Schema version tracking for migrations
            CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER PRIMARY KEY,
                applied_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
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

                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL,
                        encrypted INTEGER NOT NULL DEFAULT 0,
                        created_at INTEGER NOT NULL,
                        updated_at INTEGER NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS schema_version (
                        version INTEGER PRIMARY KEY,
                        applied_at INTEGER NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
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

// ===== Settings (encrypted storage) =====

const { encrypt, decrypt, maskSecret } = require('./utils/encryption');

/**
 * Keys that contain sensitive data and should be encrypted at rest.
 */
const SENSITIVE_KEY_PATTERNS = [
    /api[_-]?key/i,
    /secret/i,
    /password/i,
    /token/i,
    /credential/i,
    /auth/i
];

function isSensitiveKey(key) {
    return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Save a setting. Sensitive keys are automatically encrypted.
 *
 * @param {string} key - Setting key (e.g., 'openai_api_key', 'llm_config')
 * @param {string|object} value - Setting value (objects are JSON-serialized)
 * @returns {boolean} Success
 */
function saveSetting(key, value) {
    const database = getDb();
    if (!database) return false;

    try {
        const now = Date.now();
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        const sensitive = isSensitiveKey(key);
        const storedValue = sensitive ? encrypt(valueStr) : valueStr;
        const encrypted = sensitive ? 1 : 0;

        database.prepare(`
            INSERT INTO settings (key, value, encrypted, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                encrypted = excluded.encrypted,
                updated_at = excluded.updated_at
        `).run(key, storedValue, encrypted, now, now);

        return true;
    } catch (error) {
        console.error(`[Database] Failed to save setting ${key}:`, error.message);
        return false;
    }
}

/**
 * Load a setting. Encrypted values are automatically decrypted.
 *
 * @param {string} key - Setting key
 * @returns {string|null} Decrypted setting value, or null if not found
 */
function loadSetting(key) {
    const database = getDb();
    if (!database) return null;

    try {
        const row = database.prepare('SELECT * FROM settings WHERE key = ?').get(key);
        if (!row) return null;

        if (row.encrypted) {
            return decrypt(row.value);
        }

        // Try to parse as JSON, fall back to raw string
        try {
            return JSON.parse(row.value);
        } catch {
            return row.value;
        }
    } catch (error) {
        console.error(`[Database] Failed to load setting ${key}:`, error.message);
        return null;
    }
}

/**
 * Load all settings. Encrypted values are masked for safe display.
 *
 * @param {object} [options] - Options
 * @param {boolean} [options.revealSecrets=false] - If true, decrypt and return sensitive values
 * @returns {object} Key-value map of settings
 */
function loadAllSettings(options = {}) {
    const database = getDb();
    if (!database) return {};

    try {
        const rows = database.prepare('SELECT * FROM settings').all();
        const result = {};
        for (const row of rows) {
            if (row.encrypted) {
                if (options.revealSecrets) {
                    const decrypted = decrypt(row.value);
                    try {
                        result[row.key] = JSON.parse(decrypted);
                    } catch {
                        result[row.key] = decrypted;
                    }
                } else {
                    // Return a masked placeholder
                    const decrypted = decrypt(row.value);
                    result[row.key] = decrypted ? maskSecret(String(decrypted)) : '****';
                }
            } else {
                try {
                    result[row.key] = JSON.parse(row.value);
                } catch {
                    result[row.key] = row.value;
                }
            }
        }
        return result;
    } catch (error) {
        console.error('[Database] Failed to load all settings:', error.message);
        return {};
    }
}

/**
 * Delete a setting.
 *
 * @param {string} key - Setting key
 * @returns {boolean} Success
 */
function deleteSetting(key) {
    const database = getDb();
    if (!database) return false;

    try {
        database.prepare('DELETE FROM settings WHERE key = ?').run(key);
        return true;
    } catch (error) {
        console.error(`[Database] Failed to delete setting ${key}:`, error.message);
        return false;
    }
}

/**
 * Save multiple settings at once in a single transaction.
 *
 * @param {object} settingsMap - Key-value pairs to save
 * @returns {boolean} Success
 */
function saveSettingsBatch(settingsMap) {
    const database = getDb();
    if (!database) return false;

    try {
        const transaction = database.transaction(() => {
            for (const [key, value] of Object.entries(settingsMap)) {
                saveSetting(key, value);
            }
        });
        transaction();
        return true;
    } catch (error) {
        console.error('[Database] Failed to save settings batch:', error.message);
        return false;
    }
}

// ===== Schema Migrations =====

/**
 * Get the current schema version.
 * @returns {number} Current version (0 if no migrations applied)
 */
function getSchemaVersion() {
    const database = getDb();
    if (!database) return 0;

    try {
        const row = database.prepare('SELECT MAX(version) as version FROM schema_version').get();
        return row?.version || 0;
    } catch {
        return 0;
    }
}

/**
 * Migration definitions. Each migration has a version number and an `up` function.
 * Migrations are applied in order when the database schema version is lower.
 */
const MIGRATIONS = [
    {
        version: 1,
        description: 'Add settings and schema_version tables',
        up: () => {
            // These tables are created in initDatabase, so this is a no-op for new DBs
            // But for existing DBs that were created before P2, we need to add them
            const database = getDb();
            database.exec(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    encrypted INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS schema_version (
                    version INTEGER PRIMARY KEY,
                    applied_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
            `);
        }
    }
];

/**
 * Run pending database migrations.
 * Applies all migrations with a version higher than the current schema version.
 */
function runMigrations() {
    const database = getDb();
    if (!database) return;

    const currentVersion = getSchemaVersion();
    const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);

    if (pending.length === 0) {
        return;
    }

    console.log(`[Database] Running ${pending.length} pending migration(s) (current: v${currentVersion})...`);

    const transaction = database.transaction(() => {
        for (const migration of pending) {
            console.log(`[Database] Applying migration v${migration.version}: ${migration.description}`);
            migration.up();
            database.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(migration.version, Date.now());
        }
    });

    try {
        transaction();
        console.log(`[Database] Migrations complete. Schema version: v${pending[pending.length - 1].version}`);
    } catch (error) {
        console.error(`[Database] Migration failed: ${error.message}`);
        throw error;
    }
}

module.exports = {
    initDatabase,
    getDb,
    closeDatabase,
    runMigrations,
    getSchemaVersion,
    // Games
    saveGame,
    loadGame,
    deleteGame,
    loadAllGames,
    // Sessions
    saveSession,
    loadSession,
    deleteSession,
    loadAllSessions,
    // Projects
    saveProject,
    loadProject,
    deleteProject,
    loadAllProjects,
    // Settings
    saveSetting,
    loadSetting,
    loadAllSettings,
    deleteSetting,
    saveSettingsBatch,
    // Cleanup
    cleanupExpired
};
