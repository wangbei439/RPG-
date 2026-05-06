'use strict';

const express = require('express');
const { asyncRoute } = require('./helpers');

module.exports = function({
    games, generationSessions, projects, projectStore, generator, imageService,
    stepGenerator, finalizer, projectManager, visualDirector, assetManager,
    memoryService, sceneImageCache, db, MemoryManager, GameEngine, LLMService
}) {
    const router = express.Router();

    // -----------------------------------------------------------------------
    // GET /api/health
    // -----------------------------------------------------------------------
    router.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            gamesCount: games.size,
            projectsCount: projects.size,
            sessionsCount: generationSessions.size,
            memory: memoryService?.getStatus?.() ?? { enabled: false }
        });
    });

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
        const { llmSource, apiKey, apiUrl, model, ollamaUrl, ollamaModel } = req.body || {};

        const llm = new LLMService();
        llm.initialize({
            llmSource,
            apiKey,
            apiUrl,
            model,
            ollamaUrl,
            ollamaModel
        });
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
