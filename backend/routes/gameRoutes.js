'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { createHttpError, asyncRoute, sendSseEvent, createProgressSender, buildSceneCacheKey, buildRuntimeImagePayload } = require('./helpers');
const { getExampleGamesList, getExampleGame } = require('../templates/ExampleGames');
const { validateBody, schemas } = require('../middleware/validate');
const logger = require('../middleware/logger');

module.exports = function({
    games, generationSessions, projects, projectStore, generator, imageService,
    stepGenerator, finalizer, projectManager, visualDirector, assetManager,
    memoryService, sceneImageCache, db, MemoryManager, GameEngine, LLMService,
    getGameOrThrow, getSessionOrThrow, getProjectOrThrow, setGameRecord, createGenerationSession
}) {
    const router = express.Router();

    // Broadcast helper — imported from websocket module
    const { broadcastImageReady } = require('../websocket');

    // -----------------------------------------------------------------------
    // Helper: resolve LLM settings with DB fallback
    // If the frontend provides settings with llmSource, use them directly.
    // Otherwise, try to load persisted settings from the SQLite database.
    // -----------------------------------------------------------------------
    function resolveLlmSettings(frontendSettings) {
        if (frontendSettings && frontendSettings.llmSource) {
            return frontendSettings;
        }

        // Fallback: load from DB settings table
        try {
            const llmSource = db.loadSetting('llm_source');
            if (!llmSource) return frontendSettings || {};

            const settings = { llmSource };
            if (llmSource === 'openai') {
                settings.apiUrl = db.loadSetting('openai_url') || 'https://api.openai.com/v1';
                settings.apiKey = db.loadSetting('openai_api_key') || '';
                settings.model = db.loadSetting('openai_model') || 'gpt-4o';
            } else if (llmSource === 'anthropic') {
                settings.apiKey = db.loadSetting('anthropic_api_key') || '';
                settings.model = db.loadSetting('anthropic_model') || 'claude-3-5-sonnet-20241022';
            } else if (llmSource === 'local') {
                settings.apiUrl = db.loadSetting('ollama_url') || 'http://localhost:11434';
                settings.model = db.loadSetting('ollama_model') || 'llama3';
            } else if (llmSource === 'custom') {
                settings.apiUrl = db.loadSetting('custom_url') || '';
                settings.apiKey = db.loadSetting('custom_api_key') || '';
                settings.model = db.loadSetting('custom_model') || '';
            }

            console.log('[resolveLlmSettings] Loaded from DB:', llmSource, settings.apiUrl ? `(url: ${settings.apiUrl})` : '');
            return settings;
        } catch (err) {
            console.warn('[resolveLlmSettings] DB fallback failed:', err.message);
            return frontendSettings || {};
        }
    }

    // -----------------------------------------------------------------------
    // POST /api/generate  — legacy one-shot generation (SSE)
    // -----------------------------------------------------------------------
    router.post('/generate', asyncRoute('Generation error', async (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const sendProgress = createProgressSender(res);

        const config = req.body;
        const gameId = uuidv4();
        sendProgress(5, '正在初始化生成器...', '正在加载模型配置');

        const gameData = await generator.generateGame(config, sendProgress);
        setGameRecord(gameId, config, gameData);

        sendProgress(100, '游戏生成完成', `游戏 ID：${gameId}`);
        sendSseEvent(res, { type: 'complete', gameId });
        res.end();
    }, (error, req, res) => {
        // Custom SSE error handler
        sendSseEvent(res, { type: 'error', message: error.message || '生成失败' });
        res.end();
    }));

    // -----------------------------------------------------------------------
    // POST /api/games/:gameId/start
    // -----------------------------------------------------------------------
    router.post('/games/:gameId/start', asyncRoute('Start game error', async (req, res) => {
        const game = getGameOrThrow(req.params.gameId);

        // Merge frontend settings into config, with DB fallback
        const llmSettings = resolveLlmSettings(req.body?.settings);
        const configWithSettings = {
            ...game.config,
            settings: llmSettings
        };

        const engine = new GameEngine(game.data, configWithSettings, {
            gameId: game.id,
            memoryService
        });
        const gameState = await engine.start();

        game.state = gameState;
        game.engine = engine;
        game.config = configWithSettings;

        // Persist state change to SQLite
        db.saveGame(game.id, game.config, game.data, game.state);

        res.json({ gameState });
    }));

    // -----------------------------------------------------------------------
    // POST /api/games/restore
    // -----------------------------------------------------------------------
    router.post('/games/restore', asyncRoute('Restore game error', async (req, res) => {
        const { gameId, gameData, gameState, config } = req.body || {};

        if (!gameData || !gameState || !config) {
            throw createHttpError(400, '缺少恢复游戏所需的 gameData、gameState 或 config');
        }

        const restoredGameId = gameId || gameState.id || uuidv4();

        // Merge LLM settings with DB fallback
        const configWithSettings = {
            ...config,
            settings: resolveLlmSettings(config.settings)
        };

        const record = setGameRecord(restoredGameId, configWithSettings, gameData);
        const engine = new GameEngine(gameData, configWithSettings, {
            gameId: restoredGameId,
            memoryService
        });

        record.engine = engine;
        record.state = await engine.restore(gameState);
        record.updatedAt = Date.now();

        // Persist restored state to SQLite
        db.saveGame(restoredGameId, record.config, record.data, record.state);

        res.json({
            gameId: restoredGameId,
            gameState: record.state
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/games/:gameId/action
    // -----------------------------------------------------------------------
    router.post('/games/:gameId/action', asyncRoute('Process action error', async (req, res) => {
        const game = getGameOrThrow(req.params.gameId);
        const { action, streaming, settings } = req.body;

        if (!action || typeof action !== 'string') {
            throw createHttpError(400, '缺少有效的 action（必须为非空字符串）');
        }

        if (!game.engine) {
            throw createHttpError(409, '游戏尚未启动');
        }

        // Resolve LLM settings: use frontend-provided settings, or fall back to DB
        const resolvedSettings = resolveLlmSettings(settings);
        if (resolvedSettings.llmSource) {
            game.engine.reinitializeLLM(resolvedSettings);
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
                // Persist state change to SQLite
                db.saveGame(game.id, game.config, game.data, game.state);
            }

            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        // 普通模式
        const result = await game.engine.processAction(action);
        game.state = result.gameState;

        // Persist state change to SQLite
        db.saveGame(game.id, game.config, game.data, game.state);

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
                        // 缓存命中，通过 WebSocket 推送图像
                        logger.debug('Scene image cache hit');
                        broadcastImageReady(game.id, {
                            imageUrl: cachedImage.url || cachedImage.imageUrl || cachedImage,
                            prompt: imagePrompt,
                            visualState
                        });
                    } else if (imagePrompt) {
                        const sceneImage = await imageService.generateImage(imagePrompt, {
                            ...effectiveImageConfig,
                            comfyuiSeed: runtimeImage.seed ?? effectiveImageConfig.comfyuiSeed
                        });
                        if (sceneImage) {
                            sceneImageCache.set(cacheKey, sceneImage);
                            // 通过 WebSocket 推送图像生成完成
                            logger.debug('Scene image generation complete');
                            broadcastImageReady(game.id, {
                                imageUrl: sceneImage.url || sceneImage.imageUrl || sceneImage,
                                prompt: imagePrompt,
                                visualState
                            });
                        }
                    }
                } catch (imageError) {
                    logger.warn('Background image generation failed', { error: imageError.message });
                }
            })();

            return;
        }

        res.json(result);
    }));

    // -----------------------------------------------------------------------
    // POST /api/games/:gameId/generate-image
    // -----------------------------------------------------------------------
    router.post('/games/:gameId/generate-image', asyncRoute('Generate scene image error', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // GET /api/games/:gameId
    // -----------------------------------------------------------------------
    router.get('/games/:gameId', asyncRoute('Get game error', async (req, res) => {
        const game = getGameOrThrow(req.params.gameId);
        res.json({ game: game.data, state: game.state });
    }));

    // -----------------------------------------------------------------------
    // Enhanced memory debug routes
    // -----------------------------------------------------------------------

    // GET /api/games/:gameId/memory/graph
    router.get('/games/:gameId/memory/graph', asyncRoute('Get knowledge graph', async (req, res) => {
        const game = getGameOrThrow(req.params.gameId);

        if (!game.engine || !game.engine.enhancedMemory) {
            throw createHttpError(404, '增强记忆系统未初始化');
        }

        const kg = game.engine.enhancedMemory.semanticMemory.knowledgeGraph;
        res.json(kg.toJSON());
    }));

    // GET /api/games/:gameId/memory/timeline
    router.get('/games/:gameId/memory/timeline', asyncRoute('Get timeline', async (req, res) => {
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

    // GET /api/games/:gameId/memory/causal
    router.get('/games/:gameId/memory/causal', asyncRoute('Get causal chain', async (req, res) => {
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

    // GET /api/games/:gameId/memory/context
    router.get('/games/:gameId/memory/context', asyncRoute('Get current context', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // Example games API
    // -----------------------------------------------------------------------

    // GET /api/examples
    router.get('/examples', asyncRoute('List examples', async (req, res) => {
        res.json(getExampleGamesList());
    }));

    // GET /api/examples/:exampleId
    router.get('/examples/:exampleId', asyncRoute('Get example', async (req, res) => {
        const example = getExampleGame(req.params.exampleId);
        if (!example) {
            throw createHttpError(404, '示例游戏不存在');
        }
        res.json(example);
    }));

    // POST /api/examples/:exampleId/start
    router.post('/examples/:exampleId/start', asyncRoute('Start example game', async (req, res) => {
        const example = getExampleGame(req.params.exampleId);
        if (!example) {
            throw createHttpError(404, '示例游戏不存在');
        }

        const gameId = uuidv4();
        const config = {
            settings: resolveLlmSettings(req.body.settings),
            gameType: example.type
        };

        console.log('[examples/start] LLM settings:', config.settings.llmSource || '(none)',
            config.settings.apiUrl ? `(url: ${config.settings.apiUrl})` : '');

        const record = setGameRecord(gameId, config, example);
        const engine = new GameEngine(example, config, {
            gameId,
            memoryService
        });

        const gameState = await engine.start();
        record.engine = engine;
        record.state = gameState;

        // Persist example game state to SQLite
        db.saveGame(gameId, config, example, gameState);

        res.json({
            gameId,
            gameState,
            message: `示例游戏「${example.name}」已启动`
        });
    }));

    return router;
};
