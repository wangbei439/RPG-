const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');

const GameGenerator = require('./engine/GameGenerator');
const GameEngine = require('./engine/GameEngine');
const ImageService = require('./utils/ImageService');
const MemoryManager = require('./engine/MemoryManager');
const StepGenerator = require('./engine/StepGenerator');
const GameFinalizer = require('./engine/GameFinalizer');
const ProjectManager = require('./engine/ProjectManager');
const ProjectStore = require('./engine/ProjectStore');
const VisualDirector = require('./engine/VisualDirector');
const AssetManager = require('./engine/AssetManager');
const LLMService = require('./utils/LLMService');
const ManasDBService = require('./utils/ManasDBService');
const { initWebSocket } = require('./websocket');
const db = require('./database');
const { createHelpers } = require('./routes/helpers');

// Middleware
const { authMiddleware } = require('./middleware/auth');
const { defaultLimiter, authLimiter } = require('./middleware/rateLimiter');

// Route modules
const createGameRoutes = require('./routes/gameRoutes');
const createGenerateRoutes = require('./routes/generateRoutes');
const createProjectRoutes = require('./routes/projectRoutes');
const createComfyuiRoutes = require('./routes/comfyuiRoutes');
const createSystemRoutes = require('./routes/systemRoutes');
const createAuthRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TIMEOUT = 30 * 60 * 1000;
const GAME_TIMEOUT = 12 * 60 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 1000;
const MANASDB_CONFIG_PATH = path.join(__dirname, 'manasdb-config.json');
const PROJECT_STORE_DIR = path.join(__dirname, 'data', 'projects');

// Trust proxy for correct IP in rate limiting (needed behind reverse proxy)
app.set('trust proxy', 1);

// Configure CORS - restrict origins in production
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // Preflight cache: 24 hours
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting (applied before auth so brute-force attempts are limited)
app.use('/api/auth', authLimiter.middleware());
app.use(defaultLimiter.middleware());

// Authentication middleware (skip for auth routes themselves)
app.use('/api/auth', createAuthRoutes());
app.use(authMiddleware);

// Initialize SQLite database before anything else
db.initDatabase();

const games = new Map();
const projectStore = new ProjectStore(PROJECT_STORE_DIR);
const projects = projectStore.loadAll();
const generationSessions = new Map();

// Recover persisted games from database into memory on startup
(function recoverGamesFromDB() {
    const persistedGames = db.loadAllGames();
    for (const pg of persistedGames) {
        games.set(pg.id, {
            id: pg.id,
            config: pg.config,
            data: pg.data,
            state: pg.state,
            engine: null,
            createdAt: pg.createdAt,
            updatedAt: pg.updatedAt
        });
    }
    if (persistedGames.length > 0) {
        console.log(`[Startup] Recovered ${persistedGames.length} game(s) from database`);
    }
})();

// Recover persisted generation sessions from database on startup
(function recoverSessionsFromDB() {
    const persistedSessions = db.loadAllSessions();
    for (const ps of persistedSessions) {
        const memState = ps.memoryState || {};
        const memory = new MemoryManager(
            memState.globalContext?.userInput || '',
            memState.globalContext?.gameType || 'custom',
            {
                seedData: memState.elementStore || {},
                sourceProject: memState.globalContext?.sourceProject || null
            }
        );
        if (memState.globalContext) {
            memory.globalContext = memState.globalContext;
        }
        if (memState.elementStore) {
            memory.elementStore = memState.elementStore;
        }
        if (memState.workingMemory) {
            memory.workingMemory = memState.workingMemory;
        }

        generationSessions.set(ps.id, {
            memory,
            config: ps.config,
            projectId: ps.projectId,
            createdAt: ps.createdAt,
            updatedAt: ps.updatedAt
        });
    }
    if (persistedSessions.length > 0) {
        console.log(`[Startup] Recovered ${persistedSessions.length} generation session(s) from database`);
    }
})();

// Initialize services
const generator = new GameGenerator();
const imageService = new ImageService();
const stepGenerator = new StepGenerator();
const finalizer = new GameFinalizer();
const projectManager = new ProjectManager();
const visualDirector = new VisualDirector();
const assetManager = new AssetManager(visualDirector);
const manasConfig = loadManasConfig();
const memoryService = manasConfig.enabled ? new ManasDBService(manasConfig) : null;
const sceneImageCache = new Map();

// Create bound helpers
const helpers = createHelpers({ games, generationSessions, projects, MemoryManager, db, visualDirector });

// Build shared dependencies object for route modules
const dependencies = {
    games, generationSessions, projects, projectStore, generator, imageService,
    stepGenerator, finalizer, projectManager, visualDirector, assetManager,
    memoryService, sceneImageCache, db, MemoryManager, GameEngine, LLMService,
    ...helpers
};

// Mount route modules
app.use('/', createGameRoutes(dependencies));
app.use('/', createGenerateRoutes(dependencies));
app.use('/', createProjectRoutes(dependencies));
app.use('/', createComfyuiRoutes(dependencies));
app.use('/', createSystemRoutes(dependencies));

// Global error handler (must be after all routes)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Cleanup interval
setInterval(cleanupExpiredRecords, CLEANUP_INTERVAL);

function cleanupExpiredRecords() {
    const now = Date.now();

    for (const [id, session] of generationSessions.entries()) {
        if (now - (session.updatedAt || session.createdAt) > SESSION_TIMEOUT) {
            generationSessions.delete(id);
        }
    }

    for (const [id, game] of games.entries()) {
        if (now - (game.updatedAt || game.createdAt) > GAME_TIMEOUT) {
            games.delete(id);
            for (const cacheKey of sceneImageCache.keys()) {
                if (cacheKey.startsWith(`${id}:`)) {
                    sceneImageCache.delete(cacheKey);
                }
            }
        }
    }

    for (const project of projects.values()) {
        if (project) {
            project.updatedAt = project.updatedAt || project.createdAt || now;
        }
    }

    // Cleanup expired records from database as well
    const sessionCutoff = now - SESSION_TIMEOUT;
    const gameCutoff = now - GAME_TIMEOUT;
    const cleaned = db.cleanupExpired(Math.max(sessionCutoff, gameCutoff));
    if (cleaned.games > 0 || cleaned.sessions > 0) {
        console.log(`[Cleanup] Database: removed ${cleaned.games} game(s), ${cleaned.sessions} session(s)`);
    }
}

function loadManasConfig() {
    try {
        if (!fs.existsSync(MANASDB_CONFIG_PATH)) {
            return { enabled: false };
        }

        return JSON.parse(fs.readFileSync(MANASDB_CONFIG_PATH, 'utf8'));
    } catch (error) {
        console.warn('加载 ManasDB 配置失败，将以禁用模式继续运行:', error.message);
        return { enabled: false };
    }
}

const server = http.createServer(app);

// 初始化 WebSocket 服务器
initWebSocket(server);

// ---------------------------------------------------------------------------
// In-memory state size limits
// ---------------------------------------------------------------------------
const MAX_GAMES = parseInt(process.env.MAX_GAMES, 10) || 500;
const MAX_SESSIONS = parseInt(process.env.MAX_SESSIONS, 10) || 200;
const MAX_SCENE_CACHE = parseInt(process.env.MAX_SCENE_CACHE, 10) || 1000;

function enforceMapLimit(map, maxItems, label) {
    if (map.size <= maxItems) return;
    // Evict oldest entries (first inserted)
    const evictCount = map.size - maxItems;
    let evicted = 0;
    for (const key of map.keys()) {
        if (evicted >= evictCount) break;
        map.delete(key);
        evicted++;
    }
    console.warn(`[Memory] ${label} exceeded limit (${map.size + evicted} > ${maxItems}), evicted ${evicted} entries`);
}

// Periodic memory enforcement
setInterval(() => {
    enforceMapLimit(games, MAX_GAMES, 'games');
    enforceMapLimit(generationSessions, MAX_SESSIONS, 'generationSessions');
    enforceMapLimit(sceneImageCache, MAX_SCENE_CACHE, 'sceneImageCache');
}, 5 * 60 * 1000); // Every 5 minutes

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
    console.log(`RPG Generator Backend running on http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (process.env.AUTH_DISABLED === 'true' && process.env.NODE_ENV !== 'production') {
        console.warn('[SECURITY] Auth is DISABLED (AUTH_DISABLED=true). Do not use in production!');
    }
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
function gracefulShutdown(signal) {
    console.log(`\n[Shutdown] Received ${signal}. Shutting down gracefully...`);

    // Stop accepting new connections
    server.close(() => {
        console.log('[Shutdown] HTTP server closed.');

        // Close database connection
        try {
            db.closeDatabase();
            console.log('[Shutdown] Database connection closed.');
        } catch (err) {
            console.error('[Shutdown] Error closing database:', err.message);
        }

        // Clear intervals
        clearInterval(cleanupInterval);
        console.log('[Shutdown] Cleanup intervals cleared.');

        console.log('[Shutdown] Complete. Exiting.');
        process.exit(0);
    });

    // Force exit after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
        console.error('[Shutdown] Forced exit after 10s timeout.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});
