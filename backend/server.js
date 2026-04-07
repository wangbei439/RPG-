const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const GameGenerator = require('./engine/GameGenerator');
const GameEngine = require('./engine/GameEngine');
const ImageService = require('./utils/ImageService');
const MemoryManager = require('./engine/MemoryManager');
const StepGenerator = require('./engine/StepGenerator');
const GameFinalizer = require('./engine/GameFinalizer');
const LLMService = require('./utils/LLMService');
const ManasDBService = require('./utils/ManasDBService');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TIMEOUT = 30 * 60 * 1000;
const GAME_TIMEOUT = 12 * 60 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 1000;
const COMFY_WORKFLOWS_DIR = 'G:\\comfy\\wenjian\\user\\default\\workflows';
const MANASDB_CONFIG_PATH = path.join(__dirname, 'manasdb-config.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const games = new Map();
const generationSessions = new Map();
const generator = new GameGenerator();
const imageService = new ImageService();
const stepGenerator = new StepGenerator();
const finalizer = new GameFinalizer();
const memoryService = new ManasDBService(loadManasConfig());

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
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

function listComfyWorkflowFiles() {
    if (!fs.existsSync(COMFY_WORKFLOWS_DIR)) {
        throw createHttpError(404, `未找到工作流目录：${COMFY_WORKFLOWS_DIR}`);
    }

    return fs.readdirSync(COMFY_WORKFLOWS_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
        .map((entry) => {
            const fullPath = path.join(COMFY_WORKFLOWS_DIR, entry.name);
            const stats = fs.statSync(fullPath);
            return {
                name: entry.name,
                path: fullPath,
                size: stats.size,
                updatedAt: stats.mtime.toISOString()
            };
        })
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function resolveComfyWorkflowFile(fileName) {
    if (!fileName || typeof fileName !== 'string') {
        throw createHttpError(400, '缺少工作流文件名');
    }

    const safeName = path.basename(fileName);
    const fullPath = path.resolve(COMFY_WORKFLOWS_DIR, safeName);
    const basePath = path.resolve(COMFY_WORKFLOWS_DIR);

    if (!fullPath.startsWith(basePath + path.sep) && fullPath !== basePath) {
        throw createHttpError(400, '工作流文件路径非法');
    }

    if (!fs.existsSync(fullPath)) {
        throw createHttpError(404, `未找到工作流文件：${safeName}`);
    }

    return fullPath;
}

function createGameRecord(id, config, data) {
    const now = Date.now();
    return {
        id,
        config,
        data,
        state: null,
        engine: null,
        createdAt: now,
        updatedAt: now
    };
}

function setGameRecord(id, config, data) {
    const record = createGameRecord(id, config, data);
    games.set(id, record);
    return record;
}

function getGameOrThrow(gameId) {
    const game = games.get(gameId);
    if (!game) {
        throw createHttpError(404, '游戏不存在');
    }

    game.updatedAt = Date.now();
    return game;
}

function getSessionOrThrow(sessionId) {
    const session = generationSessions.get(sessionId);
    if (!session) {
        throw createHttpError(404, '生成会话不存在或已过期');
    }

    session.updatedAt = Date.now();
    return session;
}

function sendSseEvent(res, payload) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function createProgressSender(res) {
    return (progress, message, details) => {
        sendSseEvent(res, { type: 'progress', progress, message, details });
    };
}

function handleApiError(res, error, scope) {
    if (scope) {
        console.error(`${scope}:`, error);
    }

    const status = error.status || 500;
    res.status(status).json({ error: error.message || '服务器内部错误' });
}

function asyncRoute(scope, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            handleApiError(res, error, scope);
        }
    };
}

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
        }
    }
}

setInterval(cleanupExpiredRecords, CLEANUP_INTERVAL);

app.post('/api/generate', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendProgress = createProgressSender(res);

    try {
        const config = req.body;
        const gameId = uuidv4();
        sendProgress(5, '正在初始化生成器...', '正在加载模型配置');

        const gameData = await generator.generateGame(config, sendProgress);
        setGameRecord(gameId, config, gameData);

        sendProgress(100, '游戏生成完成', `游戏 ID：${gameId}`);
        sendSseEvent(res, { type: 'complete', gameId });
        res.end();
    } catch (error) {
        console.error('Generation error:', error);
        sendSseEvent(res, { type: 'error', message: error.message || '生成失败' });
        res.end();
    }
});

app.post('/api/games/:gameId/start', asyncRoute('Start game error', async (req, res) => {
    const game = getGameOrThrow(req.params.gameId);
    const engine = new GameEngine(game.data, game.config, {
        gameId: game.id,
        memoryService
    });
    const gameState = await engine.start();

    game.state = gameState;
    game.engine = engine;

    res.json({ gameState });
}));

app.post('/api/games/restore', asyncRoute('Restore game error', async (req, res) => {
    const { gameId, gameData, gameState, config } = req.body || {};

    if (!gameData || !gameState || !config) {
        throw createHttpError(400, '缺少恢复游戏所需的 gameData、gameState 或 config');
    }

    const restoredGameId = gameId || gameState.id || uuidv4();
    const record = setGameRecord(restoredGameId, config, gameData);
    const engine = new GameEngine(gameData, config, {
        gameId: restoredGameId,
        memoryService
    });

    record.engine = engine;
    record.state = await engine.restore(gameState);
    record.updatedAt = Date.now();

    res.json({
        gameId: restoredGameId,
        gameState: record.state
    });
}));

app.post('/api/games/:gameId/action', asyncRoute('Process action error', async (req, res) => {
    const game = getGameOrThrow(req.params.gameId);
    const { action } = req.body;

    if (!action) {
        throw createHttpError(400, '缺少 action');
    }

    if (!game.engine) {
        throw createHttpError(409, '游戏尚未启动');
    }

    const result = await game.engine.processAction(action);
    game.state = result.gameState;

    const effectiveImageConfig = {
        ...game.config,
        ...(req.body?.imageConfig || {})
    };

    if (effectiveImageConfig.enableImages && effectiveImageConfig.imageSource !== 'none' && effectiveImageConfig.imageGenerationMode === 'auto') {
        try {
            const imagePrompt = result.sceneDescription || result.response;
            result.sceneImage = await imageService.generateImage(imagePrompt, effectiveImageConfig);
        } catch (imageError) {
            console.warn('Image generation failed:', imageError.message);
        }
    }

    res.json(result);
}));

app.post('/api/games/:gameId/generate-image', asyncRoute('Generate scene image error', async (req, res) => {
    const game = getGameOrThrow(req.params.gameId);

    if (!game.config.enableImages || game.config.imageSource === 'none') {
        throw createHttpError(400, '当前游戏未启用图像生成');
    }

    const prompt = req.body?.prompt || game.state?.sceneDescription || game.state?.initialLog || '';
    if (!prompt) {
        throw createHttpError(400, '缺少可用于生成图片的场景描述');
    }

    const config = {
        ...game.config,
        ...req.body,
        comfyuiImageCount: req.body?.count ?? req.body?.comfyuiImageCount ?? game.config.comfyuiImageCount ?? 1
    };

    const images = await imageService.generateImages(prompt, config);
    res.json({
        prompt,
        count: images.length,
        images
    });
}));

app.get('/api/games/:gameId', asyncRoute('Get game error', async (req, res) => {
    const game = getGameOrThrow(req.params.gameId);
    res.json({ game: game.data, state: game.state });
}));

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        gamesCount: games.size,
        sessionsCount: generationSessions.size,
        memory: memoryService.getStatus()
    });
});

app.get('/api/memory/stats', asyncRoute('Memory stats error', async (_req, res) => {
    const stats = await memoryService.getStats();
    res.json(stats);
}));

app.get('/api/memory/graph/:gameId', asyncRoute('Memory graph error', async (req, res) => {
    res.json(memoryService.getGraph(req.params.gameId));
}));

app.get('/api/comfyui/options', asyncRoute('ComfyUI options error', async (req, res) => {
    const options = await imageService.getComfyUIOptions({
        comfyuiUrl: req.query.comfyuiUrl
    });
    res.json(options);
}));

app.get('/api/comfyui/workflows', asyncRoute('ComfyUI workflows error', async (_req, res) => {
    res.json({
        directory: COMFY_WORKFLOWS_DIR,
        workflows: listComfyWorkflowFiles()
    });
}));

app.get('/api/comfyui/workflows/:fileName', asyncRoute('ComfyUI workflow file error', async (req, res) => {
    const fullPath = resolveComfyWorkflowFile(req.params.fileName);
    const content = fs.readFileSync(fullPath, 'utf8');

    res.json({
        name: path.basename(fullPath),
        path: fullPath,
        content
    });
}));

app.post('/api/comfyui/test', asyncRoute('ComfyUI test error', async (req, res) => {
    const result = await imageService.testComfyUI(req.body || {});
    res.json(result);
}));

app.post('/api/comfyui/validate-workflow', asyncRoute('ComfyUI workflow validation error', async (req, res) => {
    const result = await imageService.validateComfyUIWorkflow(req.body || {});
    res.json(result);
}));

app.post('/api/test-connection', asyncRoute('Test connection error', async (req, res) => {
    const llm = new LLMService();
    llm.initialize(req.body);
    const result = await llm.testConnection();
    res.json(result);
}));

app.post('/api/generate/init', asyncRoute('Init generation error', async (req, res) => {
    const { userInput, gameType, config } = req.body;

    if (!userInput || !gameType) {
        throw createHttpError(400, '缺少必要参数：userInput、gameType');
    }

    const sessionId = uuidv4();
    generationSessions.set(sessionId, {
        memory: new MemoryManager(userInput, gameType),
        config,
        createdAt: Date.now(),
        updatedAt: Date.now()
    });

    res.json({
        sessionId,
        firstStep: 'worldview',
        steps: stepGenerator.steps
    });
}));

app.post('/api/generate/step', asyncRoute('Step generation error', async (req, res) => {
    const { sessionId, stepId, options } = req.body;
    const session = getSessionOrThrow(sessionId);
    const result = await stepGenerator.generateStep(stepId, session.memory, {
        ...(options || {}),
        config: session.config
    });

    res.json(result);
}));

app.post('/api/generate/confirm', asyncRoute('Confirm error', async (req, res) => {
    const { sessionId, stepId, candidate } = req.body;
    const session = getSessionOrThrow(sessionId);

    session.memory.confirmStep(stepId, candidate);

    const nextStep = stepGenerator.getNextStep(stepId);
    res.json({
        success: true,
        nextStep: nextStep ? nextStep.id : null,
        allSteps: stepGenerator.steps
    });
}));

app.post('/api/generate/regenerate', asyncRoute('Regenerate error', async (req, res) => {
    const { sessionId, stepId, feedback } = req.body;
    const session = getSessionOrThrow(sessionId);
    const result = await stepGenerator.regenerateStep(stepId, session.memory, feedback || '', session.config);
    res.json(result);
}));

app.post('/api/generate/modify', asyncRoute('Modify error', async (req, res) => {
    const { sessionId, stepId, elementId, changes } = req.body;
    const session = getSessionOrThrow(sessionId);
    const result = await stepGenerator.modifyElement(stepId, elementId, changes, session.memory, session.config);

    if (result && !result.error) {
        session.memory.updateElement(stepId, elementId, result);
    }

    res.json({
        success: !result?.error,
        modified: result
    });
}));

app.get('/api/generate/:sessionId/status', asyncRoute('Status error', async (req, res) => {
    const session = getSessionOrThrow(req.params.sessionId);
    res.json({
        memory: session.memory.elementStore,
        completedSteps: session.memory.globalContext.confirmedElements,
        summary: session.memory.elementStore.summary,
        steps: stepGenerator.steps
    });
}));

app.post('/api/generate/:sessionId/finalize', asyncRoute('Finalize error', async (req, res) => {
    const session = getSessionOrThrow(req.params.sessionId);
    const config = { ...session.config, ...(req.body.config || {}) };
    const gameData = await finalizer.finalize(session.memory, config);
    const gameId = uuidv4();

    setGameRecord(gameId, config, gameData);
    generationSessions.delete(req.params.sessionId);

    res.json({
        success: true,
        gameId,
        gameData
    });
}));

app.post('/api/generate/:sessionId/back', asyncRoute('Back error', async (req, res) => {
    const { stepId } = req.body;
    getSessionOrThrow(req.params.sessionId);

    const previousStep = stepGenerator.getPreviousStep(stepId);
    res.json({
        prevStep: previousStep ? previousStep.id : null,
        allSteps: stepGenerator.steps
    });
}));

app.listen(PORT, () => {
    console.log(`RPG Generator Backend running on http://localhost:${PORT}`);
});
