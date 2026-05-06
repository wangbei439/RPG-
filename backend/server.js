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

app.use(cors());
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

server.listen(PORT, () => {
    console.log(`RPG Generator Backend running on http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});
