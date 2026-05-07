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

        // Debug: log incoming request for troubleshooting
        console.log('[test-connection] Request body:', JSON.stringify({
            llmSource,
            apiUrl: apiUrl ? `${apiUrl.slice(0, 30)}...` : '(empty)',
            model: model || '(empty)',
            apiKeyProvided: !!apiKey
        }));

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
                if (!apiUrl) {
                    return res.json({ success: false, error: '自定义接口必须提供接口地址' });
                }
                if (!model) {
                    return res.json({ success: false, error: '自定义接口必须提供模型名称' });
                }
                settings.apiKey = apiKey || 'custom';
                settings.apiUrl = apiUrl;
                break;
            default:
                return res.json({ success: false, error: '不支持的 LLM 来源' });
        }

        console.log('[test-connection] Settings for LLMService:', JSON.stringify({
            llmSource: settings.llmSource,
            model: settings.model,
            apiUrl: settings.apiUrl ? `${settings.apiUrl.slice(0, 50)}` : '(empty)',
            apiKeyProvided: !!settings.apiKey
        }));

        try {
            const llm = new LLMService();
            llm.initialize(settings);
            console.log('[test-connection] LLMService initialized, client.baseURL:',
                llm.client?.baseURL || llm.client?.type || 'N/A');
            const result = await llm.testConnection();
            console.log('[test-connection] Result:', JSON.stringify(result));
            res.json(result);
        } catch (initError) {
            console.error('[test-connection] Init error:', initError.message);
            res.json({ success: false, error: initError.message });
        }
    }));

    // -----------------------------------------------------------------------
    // POST /api/test-connection-raw
    // Raw fetch diagnostic — bypasses OpenAI SDK, directly tests if the
    // server can reach the given URL. Returns the HTTP status and a snippet
    // of the response body. Useful for debugging ECONNREFUSED / DNS issues.
    // -----------------------------------------------------------------------
    router.post('/test-connection-raw', asyncRoute('Raw test error', async (req, res) => {
        const { apiUrl } = req.body || {};
        if (!apiUrl) {
            return res.json({ success: false, error: '请提供 apiUrl' });
        }

        // Normalize URL: auto-append /v1 if needed
        let testURL = apiUrl.replace(/\/+$/, '');
        if (!testURL.match(/\/v\d(?:\/|$)/i)) {
            testURL += '/v1';
        }
        testURL += '/chat/completions';

        console.log('[test-connection-raw] Fetching:', testURL);

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(testURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'test',
                    messages: [{ role: 'user', content: 'hi' }],
                    max_tokens: 1
                }),
                signal: controller.signal
            });

            clearTimeout(timeout);
            const body = await response.text().catch(() => '');
            console.log('[test-connection-raw] Response status:', response.status);

            res.json({
                success: true,
                httpStatus: response.status,
                url: testURL,
                bodyPreview: body.slice(0, 300),
                note: response.status === 401
                    ? '连接成功！401 表示认证失败，说明接口可达，请检查 API 密钥'
                    : response.status === 404
                        ? '接口可达但返回 404，请检查 URL 路径是否正确'
                        : undefined
            });
        } catch (error) {
            const causeCode = error.cause?.code || error.code || '';
            console.error('[test-connection-raw] Error:', error.message, causeCode);
            res.json({
                success: false,
                url: testURL,
                error: error.message,
                causeCode,
                hint: causeCode === 'ECONNREFUSED'
                    ? '服务器无法连接到该地址。可能原因：1) 地址有误 2) 目标服务未启动 3) 服务器网络受限'
                    : causeCode === 'ENOTFOUND'
                        ? '域名解析失败，请检查 URL 拼写'
                        : error.name === 'AbortError'
                            ? '连接超时（10秒），请检查网络或地址是否可达'
                            : undefined
            });
        }
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
