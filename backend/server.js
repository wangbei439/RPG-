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
const ProjectManager = require('./engine/ProjectManager');
const ProjectStore = require('./engine/ProjectStore');
const VisualDirector = require('./engine/VisualDirector');
const AssetManager = require('./engine/AssetManager');
const LLMService = require('./utils/LLMService');
const ManasDBService = require('./utils/ManasDBService');
const { getExampleGamesList, getExampleGame } = require('./templates/ExampleGames');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TIMEOUT = 30 * 60 * 1000;
const GAME_TIMEOUT = 12 * 60 * 60 * 1000;
const CLEANUP_INTERVAL = 60 * 1000;
const COMFY_WORKFLOWS_DIR = process.env.COMFY_WORKFLOWS_DIR
    || path.join(__dirname, 'comfyui', 'workflows');
const MANASDB_CONFIG_PATH = path.join(__dirname, 'manasdb-config.json');
const PROJECT_STORE_DIR = path.join(__dirname, 'data', 'projects');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const games = new Map();
const projectStore = new ProjectStore(PROJECT_STORE_DIR);
const projects = projectStore.loadAll();
const generationSessions = new Map();
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

function getProjectOrThrow(projectId) {
    const project = projects.get(projectId);
    if (!project) {
        throw createHttpError(404, '项目不存在');
    }

    project.updatedAt = Date.now();
    return project;
}

function createGenerationSession(userInput, gameType, config, options = {}) {
    const sessionId = uuidv4();
    generationSessions.set(sessionId, {
        memory: new MemoryManager(userInput, gameType, {
            seedData: options.seedData,
            sourceProject: options.sourceProject
        }),
        config,
        projectId: options.projectId || null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    });

    return sessionId;
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
        console.error(error.stack);  // 加这一行
    }
    const status = error.status || 500;
    res.status(status).json({ error: error.message || '服务器内部错误' });
}

function asyncRoute(scope, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
    return handleApiError(res, error, scope);
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
}

function buildSceneCacheKey(gameId, visualState = {}, imageConfig = {}) {
    const signature = visualState.signature || 'default';
    const configParts = [
        imageConfig.imageSource || 'none',
        imageConfig.comfyuiModel || '',
        imageConfig.comfyuiWorkflowFile || '',
        imageConfig.comfyuiWidth || '',
        imageConfig.comfyuiHeight || '',
        imageConfig.comfyuiSteps || '',
        imageConfig.comfyuiCfg || '',
        imageConfig.comfyuiPromptPrefix || '',
        imageConfig.comfyuiPromptSuffix || ''
    ];

    return `${gameId}:${signature}:${configParts.join('|')}`;
}

function buildProjectLikeFromGame(game = {}) {
    const sourceProject = game.sourceProject || {};
    const storyBible = game.storyBible || sourceProject.storyBible || {};
    const visualBible = game.visualBible || sourceProject.visualBible || {};
    const buildArtifacts = game.buildArtifacts || sourceProject.buildArtifacts || {};

    return {
        id: sourceProject.projectId || game.id || '',
        title: sourceProject.title || game.name || storyBible.title || '未命名项目',
        storyBible,
        visualBible,
        buildArtifacts
    };
}

function getBoundAssetPrompt(projectLike, bindingType, targetId) {
    const bindings = projectLike.visualBible?.referenceBindings?.[bindingType];
    const assetId = Array.isArray(bindings)
        ? bindings.find((item) => (
            item?.characterId === targetId
            || item?.locationId === targetId
            || item?.characterName === targetId
            || item?.locationName === targetId
        ))?.assetId
        : null;

    if (!assetId) {
        return '';
    }

    return (projectLike.visualBible?.assetIndex || []).find((item) => item.id === assetId)?.prompt || '';
}

function buildRuntimeImagePayload(game, visualState = {}, fallbackPrompt = '') {
    const projectLike = buildProjectLikeFromGame(game?.data || {});
    const runtimePrompt = visualDirector.buildRuntimeScenePrompt(projectLike, visualState);
    const locationPrompt = getBoundAssetPrompt(projectLike, 'locations', visualState.location);
    const characterPrompts = (visualState.onStageCharacters || [])
        .map((name) => getBoundAssetPrompt(projectLike, 'characters', name))
        .filter(Boolean)
        .slice(0, 3);
    const styleBoardPrompt = (projectLike.visualBible?.referenceBindings?.styleBoard || [])
        .map((binding) => (projectLike.visualBible?.assetIndex || []).find((item) => item.id === binding.assetId)?.prompt || '')
        .filter(Boolean)
        .join('，');
    const promptParts = [
        runtimePrompt,
        locationPrompt,
        ...characterPrompts,
        styleBoardPrompt,
        visualState.prompt,
        fallbackPrompt
    ].filter((value, index, list) => value && list.indexOf(value) === index);
    const bundle = projectLike.visualBible?.seedPolicy?.bundle || {};
    const runtimeSeedBase = Number(bundle.runtimeSeed);
    const signatureHash = Math.abs(
        String(visualState.signature || fallbackPrompt || 'scene')
            .split('')
            .reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
    ) % 1000000;

    return {
        prompt: promptParts.join('，'),
        seed: Number.isFinite(runtimeSeedBase) ? runtimeSeedBase + signatureHash : null
    };
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
    const { action, streaming } = req.body;

    if (!action) {
        throw createHttpError(400, '缺少 action');
    }

    if (!game.engine) {
        throw createHttpError(409, '游戏尚未启动');
    }

    // 流式输出模式
    if (streaming) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let finalResult = null;

        await game.engine.processActionStreaming(action, (chunk) => {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            if (chunk.type === 'complete') {
                finalResult = chunk;
            }
        });

        if (finalResult) {
            game.state = finalResult.gameState;
        }

        res.write('data: [DONE]\n\n');
        res.end();
        return;
    }

    // 普通模式
    const result = await game.engine.processAction(action);
    game.state = result.gameState;

    const effectiveImageConfig = {
        ...game.config,
        ...(req.body?.imageConfig || {})
    };

    // 图像生成（异步，不阻塞响应）
    if (
        effectiveImageConfig.enableImages
        && effectiveImageConfig.imageSource !== 'none'
        && effectiveImageConfig.imageGenerationMode === 'auto'
        && result.visualSceneChanged
    ) {
        // 立即返回响应，图像在后台生成
        res.json(result);

        // 后台生成图像
        (async () => {
            try {
                const visualState = result.visualState || game.state?.visualState || {};
                const runtimeImage = buildRuntimeImagePayload(game, visualState, result.sceneDescription || result.response);
                const imagePrompt = runtimeImage.prompt || visualState.prompt || result.sceneDescription || result.response;
                const cacheKey = buildSceneCacheKey(game.id, visualState, effectiveImageConfig);
                const cachedImage = sceneImageCache.get(cacheKey);

                if (cachedImage) {
                    // 缓存命中，通过 WebSocket 发送（如果有）
                    console.log('图像缓存命中');
                } else if (imagePrompt) {
                    const sceneImage = await imageService.generateImage(imagePrompt, {
                        ...effectiveImageConfig,
                        comfyuiSeed: runtimeImage.seed ?? effectiveImageConfig.comfyuiSeed
                    });
                    if (sceneImage) {
                        sceneImageCache.set(cacheKey, sceneImage);
                        // 通过 WebSocket 发送图像（如果有）
                        console.log('图像生成完成');
                    }
                }
            } catch (imageError) {
                console.warn('后台图像生成失败:', imageError.message);
            }
        })();

        return;
    }

    res.json(result);
}));

app.post('/api/games/:gameId/generate-image', asyncRoute('Generate scene image error', async (req, res) => {
    const game = getGameOrThrow(req.params.gameId);

    if (!game.config.enableImages || game.config.imageSource === 'none') {
        throw createHttpError(400, '当前游戏未启用图像生成');
    }

    const visualState = game.state?.visualState || {};
    const runtimeImage = buildRuntimeImagePayload(game, visualState, req.body?.prompt || game.state?.sceneDescription || game.state?.initialLog || '');
    const prompt = runtimeImage.prompt || req.body?.prompt || game.state?.sceneDescription || game.state?.initialLog || '';
    if (!prompt) {
        throw createHttpError(400, '缺少可用于生成图片的场景描述');
    }

    const config = {
        ...game.config,
        ...req.body,
        comfyuiImageCount: req.body?.count ?? req.body?.comfyuiImageCount ?? game.config.comfyuiImageCount ?? 1
    };

    const images = await imageService.generateImages(prompt, {
        ...config,
        comfyuiSeed: runtimeImage.seed ?? config.comfyuiSeed
    });
    if (images[0] && visualState.signature) {
        sceneImageCache.set(buildSceneCacheKey(game.id, visualState, config), images[0]);
    }
    res.json({
        prompt,
        count: images.length,
        images,
        visualState
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
        projectsCount: projects.size,
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

app.post('/api/projects/import-text', asyncRoute('Import text project error', async (req, res) => {
    const { title, content, gameType, adaptationMode, useSmart } = req.body || {};

    if (!content || !String(content).trim()) {
        throw createHttpError(400, '缺少导入文本内容');
    }

    // 如果启用智能解析，使用新的解析器
    if (useSmart) {
        const settings = req.body.settings || {};

        // 设置 SSE 响应头以支持进度推送
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const onProgress = (percent, message) => {
            res.write(`data: ${JSON.stringify({ type: 'progress', percent, message })}\n\n`);
        };

        try {
            const project = await projectManager.createSmartImportedProject({
                title,
                content,
                gameType,
                adaptationMode
            }, settings, onProgress);

            projects.set(project.id, project);
            projectStore.save(project);

            res.write(`data: ${JSON.stringify({ type: 'complete', project })}\n\n`);
            res.end();
        } catch (error) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        }
    } else {
        // 使用旧的快速解析器
        const project = projectManager.createImportedProject({
            title,
            content,
            gameType,
            adaptationMode
        });

        projects.set(project.id, project);
        projectStore.save(project);

        res.json({
            success: true,
            project
        });
    }
}));

app.post('/api/projects/import-package', asyncRoute('Import package project error', async (req, res) => {
    const pkg = req.body?.package || req.body;
    if (!pkg || typeof pkg !== 'object') {
        throw createHttpError(400, '缺少项目包内容');
    }

    const project = projectManager.importFromPackage(pkg);
    projects.set(project.id, project);
    projectStore.save(project);

    res.json({
        success: true,
        project
    });
}));

app.get('/api/projects/:projectId', asyncRoute('Get project error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    res.json({ project });
}));

app.get('/api/projects', asyncRoute('List projects error', async (_req, res) => {
    const list = Array.from(projects.values())
        .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
        .map((project) => ({
            id: project.id,
            title: project.title,
            mode: project.mode,
            gameType: project.gameType,
            adaptationMode: project.adaptationMode,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            summary: project.storyBible?.summary || project.source?.excerpt || ''
        }));

    res.json({ projects: list });
}));

app.post('/api/projects/:projectId/update', asyncRoute('Update project error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    const edits = req.body?.edits || req.body || {};
    const updatedProject = projectManager.applyProjectEdits(project, edits);

    projects.set(updatedProject.id, updatedProject);
    projectStore.save(updatedProject);

    res.json({
        success: true,
        project: updatedProject
    });
}));

app.post('/api/projects/:projectId/adaptation/rebuild', asyncRoute('Rebuild adaptation error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    const rebuilt = projectManager.rebuildAdaptation(project, req.body || {});
    projects.set(rebuilt.id, rebuilt);
    projectStore.save(rebuilt);

    res.json({
        success: true,
        project: rebuilt
    });
}));

app.post('/api/projects/:projectId/visual-bible/rebuild', asyncRoute('Rebuild visual bible error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    const rebuilt = projectManager.rebuildVisualBible(project, req.body || {});
    projects.set(rebuilt.id, rebuilt);
    projectStore.save(rebuilt);

    res.json({
        success: true,
        project: rebuilt
    });
}));

app.post('/api/projects/:projectId/refine', asyncRoute('Refine project error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    const refined = projectManager.applyRefinement(project, req.body || {});
    projects.set(refined.id, refined);
    projectStore.save(refined);

    res.json({
        success: true,
        project: refined
    });
}));

app.post('/api/projects/:projectId/optimize', asyncRoute('Optimize project error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    const optimized = projectManager.optimizeProject(project, {
        preserveAssets: req.body?.preserveAssets !== false
    });
    projects.set(optimized.id, optimized);
    projectStore.save(optimized);

    res.json({
        success: true,
        project: optimized,
        optimizationReport: optimized.optimizationReport
    });
}));

app.delete('/api/projects/:projectId', asyncRoute('Delete project error', async (req, res) => {
    const projectId = req.params.projectId;
    getProjectOrThrow(projectId);

    projects.delete(projectId);
    projectStore.remove(projectId);

    res.json({
        success: true,
        projectId
    });
}));

app.get('/api/projects/:projectId/assets', asyncRoute('List project assets error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    res.json({
        projectId: project.id,
        assets: assetManager.listAssets(project)
    });
}));

app.post('/api/projects/:projectId/assets/generate-base', asyncRoute('Generate base assets error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    const imageConfig = {
        ...req.body?.imageConfig,
        ...req.body
    };
    const options = {
        dryRun: Boolean(req.body?.dryRun),
        characterLimit: Number(req.body?.characterLimit),
        locationLimit: Number(req.body?.locationLimit)
    };

    const result = await assetManager.generateBaseAssets(project, imageService, imageConfig, options);
    projects.set(project.id, result.project);
    projectStore.save(result.project);

    res.json({
        success: true,
        projectId: project.id,
        dryRun: options.dryRun,
        generatedAssets: result.generatedAssets,
        assetsCount: (result.project.visualBible?.assetIndex || []).length
    });
}));

app.post('/api/projects/:projectId/init-session', asyncRoute('Init imported project session error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    const config = req.body?.config || {};
    const seed = projectManager.buildGenerationSeed(project, {
        gameType: req.body?.gameType,
        userInput: req.body?.userInput
    });
    const sessionId = createGenerationSession(seed.userInput, seed.gameType, config, {
        seedData: seed.seedData,
        sourceProject: seed.sourceProject,
        projectId: project.id
    });

    res.json({
        success: true,
        projectId: project.id,
        sessionId,
        firstStep: 'worldview',
        steps: stepGenerator.steps,
        runtimeSnapshot: project.runtimeSnapshot || null,
        hasPlayableBuild: Boolean(project.buildArtifacts?.latestPlayable?.gameData),
        seededCategories: Object.keys(seed.seedData || {}).filter((key) => {
            const value = seed.seedData[key];
            return Array.isArray(value) ? value.length > 0 : Boolean(value && (typeof value !== 'object' || Object.keys(value).length > 0));
        })
    });
}));

app.post('/api/projects/:projectId/play', asyncRoute('Play project error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    const playable = project.buildArtifacts?.latestPlayable;

    if (!playable?.gameData) {
        throw createHttpError(409, '当前项目还没有可试玩版本，请先完成整合生成。');
    }

    const config = {
        ...(playable.config || {}),
        ...(req.body?.config || {})
    };
    const gameId = req.body?.restart === true ? uuidv4() : (playable.gameId || uuidv4());
    const record = setGameRecord(gameId, config, playable.gameData);
    const engine = new GameEngine(playable.gameData, config, {
        gameId,
        memoryService
    });

    record.engine = engine;
    record.state = (project.runtimeSnapshot && req.body?.restart !== true)
        ? await engine.restore(project.runtimeSnapshot)
        : await engine.start();
    record.updatedAt = Date.now();

    res.json({
        success: true,
        gameId,
        gameState: record.state,
        resumed: Boolean(project.runtimeSnapshot && req.body?.restart !== true)
    });
}));

app.post('/api/projects/:projectId/runtime-snapshot', asyncRoute('Save runtime snapshot error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    project.runtimeSnapshot = req.body?.runtimeSnapshot || req.body || null;
    project.updatedAt = Date.now();
    projects.set(project.id, project);
    projectStore.save(project);

    res.json({
        success: true,
        projectId: project.id,
        runtimeSnapshot: project.runtimeSnapshot
    });
}));

app.get('/api/projects/:projectId/export-package', asyncRoute('Export package error', async (req, res) => {
    const project = getProjectOrThrow(req.params.projectId);
    const pkg = projectManager.buildExportPackage(project);
    project.buildArtifacts = project.buildArtifacts || {};
    project.buildArtifacts.exportHistory = Array.isArray(project.buildArtifacts.exportHistory)
        ? project.buildArtifacts.exportHistory
        : [];
    project.buildArtifacts.exportHistory.push({
        exportedAt: pkg.exportedAt,
        packageVersion: pkg.packageVersion
    });
    project.updatedAt = Date.now();
    projects.set(project.id, project);
    projectStore.save(project);

    res.json({
        success: true,
        projectId: project.id,
        package: pkg
    });
}));

app.post('/api/generate/init', asyncRoute('Init generation error', async (req, res) => {
    const {
        userInput,
        gameType,
        config,
        seedData,
        sourceProject
    } = req.body;

    if (!userInput || !gameType) {
        throw createHttpError(400, '缺少必要参数：userInput、gameType');
    }

    const sessionId = createGenerationSession(userInput, gameType, config, {
        seedData,
        sourceProject
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
    if (session.projectId) {
        const project = getProjectOrThrow(session.projectId);
        const updatedProject = projectManager.attachLatestPlayable(project, {
            gameId,
            gameData,
            config,
            updatedAt: Date.now()
        });
        projects.set(updatedProject.id, updatedProject);
        projectStore.save(updatedProject);
    }
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

// 调试 API：查看增强记忆状态
app.get('/api/games/:gameId/memory/graph', asyncRoute('Get knowledge graph', async (req, res) => {
    const game = getGameOrThrow(req.params.gameId);

    if (!game.engine || !game.engine.enhancedMemory) {
        throw createHttpError(404, '增强记忆系统未初始化');
    }

    const kg = game.engine.enhancedMemory.semanticMemory.knowledgeGraph;
    res.json(kg.toJSON());
}));

app.get('/api/games/:gameId/memory/timeline', asyncRoute('Get timeline', async (req, res) => {
    const game = getGameOrThrow(req.params.gameId);

    if (!game.engine || !game.engine.enhancedMemory) {
        throw createHttpError(404, '增强记忆系统未初始化');
    }

    const timeline = game.engine.enhancedMemory.semanticMemory.timeline;
    res.json({
        events: timeline.events,
        summary: timeline.getSummary()
    });
}));

app.get('/api/games/:gameId/memory/causal', asyncRoute('Get causal chain', async (req, res) => {
    const game = getGameOrThrow(req.params.gameId);

    if (!game.engine || !game.engine.enhancedMemory) {
        throw createHttpError(404, '增强记忆系统未初始化');
    }

    const causalChain = game.engine.enhancedMemory.semanticMemory.causalChain;
    res.json({
        chains: causalChain.chains,
        summary: causalChain.getSummary()
    });
}));

app.get('/api/games/:gameId/memory/context', asyncRoute('Get current context', async (req, res) => {
    const game = getGameOrThrow(req.params.gameId);

    if (!game.engine || !game.engine.enhancedMemory) {
        throw createHttpError(404, '增强记忆系统未初始化');
    }

    const context = game.engine.enhancedMemory.buildContext('查看当前上下文', {
        maxRecentEvents: 10,
        maxRelevantEvents: 5,
        includeGraph: true
    });

    res.json(context);
}));

// ===== 示例游戏 API =====

app.get('/api/examples', asyncRoute('List examples', async (req, res) => {
    res.json(getExampleGamesList());
}));

app.get('/api/examples/:exampleId', asyncRoute('Get example', async (req, res) => {
    const example = getExampleGame(req.params.exampleId);
    if (!example) {
        throw createHttpError(404, '示例游戏不存在');
    }
    res.json(example);
}));

app.post('/api/examples/:exampleId/start', asyncRoute('Start example game', async (req, res) => {
    const example = getExampleGame(req.params.exampleId);
    if (!example) {
        throw createHttpError(404, '示例游戏不存在');
    }

    const gameId = uuidv4();
    const config = {
        settings: req.body.settings || {},
        gameType: example.type
    };

    const record = setGameRecord(gameId, config, example);
    const engine = new GameEngine(example, config, {
        gameId,
        memoryService
    });

    const gameState = await engine.start();
    record.engine = engine;
    record.state = gameState;

    res.json({
        gameId,
        gameState,
        message: `示例游戏「${example.name}」已启动`
    });
}));

// ===== 缓存统计 API =====

app.get('/api/debug/cache', asyncRoute('Cache stats', async (req, res) => {
    const llm = new LLMService();
    res.json(llm.getCacheStats());
}));

// ===== 系统健康检查 =====

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        activeGames: games.size,
        activeSessions: generationSessions.size,
        activeProjects: projects.size,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`RPG Generator Backend running on http://localhost:${PORT}`);
});
