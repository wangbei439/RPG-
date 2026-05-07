'use strict';

const express = require('express');
const { asyncRoute } = require('./helpers');

module.exports = function({
    games, generationSessions, projects, projectStore, generator, imageService,
    stepGenerator, finalizer, projectManager, visualDirector, assetManager,
    memoryService, sceneImageCache, db, MemoryManager, GameEngine, LLMService
}) {
    const router = express.Router();

    // NOTE: /api/health is now handled by the enhanced healthCheck middleware
    // registered directly in server.js (includes DB check, system resources, etc.)

    // -----------------------------------------------------------------------
    // GET /api/memory/stats
    // -----------------------------------------------------------------------
    router.get('/memory/stats', asyncRoute('Memory stats error', async (_req, res) => {
        const stats = await memoryService.getStats();
        res.json(stats);
    }));

    // -----------------------------------------------------------------------
    // GET /api/memory/graph/:gameId
    // -----------------------------------------------------------------------
    router.get('/memory/graph/:gameId', asyncRoute('Memory graph error', async (req, res) => {
        res.json(memoryService.getGraph(req.params.gameId));
    }));

    // -----------------------------------------------------------------------
    // POST /api/test-connection
    // Tests LLM connection with provided configuration.
    // Only the necessary fields are extracted from the request body
    // to avoid logging or caching unnecessary data.
    // -----------------------------------------------------------------------
    router.post('/test-connection', asyncRoute('Test connection error', async (req, res) => {
        const { llmSource, apiKey, apiUrl, model } = req.body || {};

        // Build a normalized settings object for LLMService.initialize()
        // The frontend `collectLlmSettings()` uses `apiUrl`/`model` for all sources,
        // so we map them to what each LLM source expects.
        const settings = { llmSource, model };

        switch (llmSource) {
            case 'openai':
                settings.apiKey = apiKey;
                settings.apiUrl = apiUrl || 'https://api.openai.com/v1';
                break;
            case 'anthropic':
                settings.apiKey = apiKey;
                break;
            case 'local':
                // Frontend sends `apiUrl` for Ollama URL
                settings.apiUrl = apiUrl || 'http://localhost:11434';
                settings.apiKey = 'ollama';
                break;
            case 'custom':
                if (!model) {
                    return res.json({ success: false, error: '自定义接口必须提供模型名称' });
                }
                settings.apiKey = apiKey || 'custom';
                settings.apiUrl = apiUrl;
                break;
            default:
                return res.json({ success: false, error: '不支持的 LLM 来源' });
        }

        const llm = new LLMService();
        llm.initialize(settings);
        const result = await llm.testConnection();
        res.json(result);
    }));

    // -----------------------------------------------------------------------
    // GET /api/debug/cache
    // Debug endpoint - only available in non-production environments
    // -----------------------------------------------------------------------
    router.get('/debug/cache', asyncRoute('Cache stats', async (req, res) => {
        // Block debug endpoints in production
        if (process.env.NODE_ENV === 'production') {
            return res.status(404).json({ error: 'Not found' });
        }

        const llm = new LLMService();
        res.json(llm.getCacheStats());
    }));

    return router;
};
