'use strict';

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function handleApiError(res, error, scope) {
    if (scope) {
        console.error(`${scope}:`, error);
        console.error(error.stack);
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

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sendSseEvent(res, payload) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function createProgressSender(res) {
    return (progress, message, details) => {
        sendSseEvent(res, { type: 'progress', progress, message, details });
    };
}

// ---------------------------------------------------------------------------
// Cache key helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Project-like helpers
// ---------------------------------------------------------------------------

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
    // visualDirector is attached to this function at setup time (see createHelpers)
    const projectLike = buildProjectLikeFromGame(game?.data || {});
    const runtimePrompt = buildRuntimeImagePayload._visualDirector.buildRuntimeScenePrompt(projectLike, visualState);
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

// ---------------------------------------------------------------------------
// Record retrieval helpers (closures over shared maps + db)
// ---------------------------------------------------------------------------

/**
 * Creates a getGameOrThrow function bound to the given games Map and db.
 */
function makeGetGameOrThrow(games, db) {
    return function getGameOrThrow(gameId) {
        let game = games.get(gameId);

        // If not in memory, try loading from database
        if (!game) {
            const persisted = db.loadGame(gameId);
            if (persisted) {
                game = {
                    id: persisted.id,
                    config: persisted.config,
                    data: persisted.data,
                    state: persisted.state,
                    engine: null,
                    createdAt: persisted.createdAt,
                    updatedAt: persisted.updatedAt
                };
                games.set(gameId, game);
            }
        }

        if (!game) {
            throw createHttpError(404, '游戏不存在');
        }

        game.updatedAt = Date.now();
        return game;
    };
}

/**
 * Creates a getSessionOrThrow function bound to the given generationSessions Map, MemoryManager, and db.
 */
function makeGetSessionOrThrow(generationSessions, MemoryManager, db) {
    return function getSessionOrThrow(sessionId) {
        let session = generationSessions.get(sessionId);

        // If not in memory, try loading from database
        if (!session) {
            const persisted = db.loadSession(sessionId);
            if (persisted) {
                const memState = persisted.memoryState || {};
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

                session = {
                    memory,
                    config: persisted.config,
                    projectId: persisted.projectId,
                    createdAt: persisted.createdAt,
                    updatedAt: persisted.updatedAt
                };
                generationSessions.set(sessionId, session);
            }
        }

        if (!session) {
            throw createHttpError(404, '生成会话不存在或已过期');
        }

        session.updatedAt = Date.now();
        return session;
    };
}

/**
 * Creates a getProjectOrThrow function bound to the given projects Map.
 */
function makeGetProjectOrThrow(projects) {
    return function getProjectOrThrow(projectId) {
        const project = projects.get(projectId);
        if (!project) {
            throw createHttpError(404, '项目不存在');
        }

        project.updatedAt = Date.now();
        return project;
    };
}

// ---------------------------------------------------------------------------
// Record creation helpers (closures over shared maps + db)
// ---------------------------------------------------------------------------

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

/**
 * Creates a setGameRecord function bound to the given games Map and db.
 */
function makeSetGameRecord(games, db) {
    return function setGameRecord(id, config, data) {
        const record = createGameRecord(id, config, data);
        games.set(id, record);
        // Persist to SQLite
        db.saveGame(id, config, data, record.state);
        return record;
    };
}

/**
 * Creates a createGenerationSession function bound to the given generationSessions Map, MemoryManager, and db.
 */
function makeCreateGenerationSession(generationSessions, MemoryManager, db) {
    return function createGenerationSession(userInput, gameType, config, options = {}) {
        const sessionId = uuidv4();
        const memory = new MemoryManager(userInput, gameType, {
            seedData: options.seedData,
            sourceProject: options.sourceProject
        });
        const session = {
            memory,
            config,
            projectId: options.projectId || null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        generationSessions.set(sessionId, session);

        // Persist to SQLite
        db.saveSession(sessionId, {
            globalContext: memory.globalContext,
            elementStore: memory.elementStore,
            workingMemory: memory.workingMemory
        }, config, options.projectId || null);

        return sessionId;
    };
}

// ---------------------------------------------------------------------------
// Factory: create all helpers bound to the given dependencies
// ---------------------------------------------------------------------------

function createHelpers({ games, generationSessions, projects, MemoryManager, db, visualDirector }) {
    // Bind visualDirector to buildRuntimeImagePayload
    buildRuntimeImagePayload._visualDirector = visualDirector;

    return {
        createHttpError,
        handleApiError,
        asyncRoute,
        sendSseEvent,
        createProgressSender,
        buildSceneCacheKey,
        buildProjectLikeFromGame,
        getBoundAssetPrompt,
        buildRuntimeImagePayload,
        getGameOrThrow: makeGetGameOrThrow(games, db),
        getSessionOrThrow: makeGetSessionOrThrow(generationSessions, MemoryManager, db),
        getProjectOrThrow: makeGetProjectOrThrow(projects),
        setGameRecord: makeSetGameRecord(games, db),
        createGenerationSession: makeCreateGenerationSession(generationSessions, MemoryManager, db)
    };
}

module.exports = { createHelpers, createHttpError, handleApiError, asyncRoute, sendSseEvent, createProgressSender, buildSceneCacheKey, buildProjectLikeFromGame, getBoundAssetPrompt, buildRuntimeImagePayload };
