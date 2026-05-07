'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { createHttpError, asyncRoute } = require('./helpers');

module.exports = function({
    games, generationSessions, projects, projectStore, generator, imageService,
    stepGenerator, finalizer, projectManager, visualDirector, assetManager,
    memoryService, sceneImageCache, db, MemoryManager, GameEngine, LLMService
}) {
    const router = express.Router();

    const COMFY_WORKFLOWS_DIR = process.env.COMFY_WORKFLOWS_DIR
        || path.join(__dirname, '..', 'comfyui', 'workflows');

    // ----- ComfyUI-specific helpers (only used in this module) -----

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

    // -----------------------------------------------------------------------
    // GET /api/comfyui/options
    // -----------------------------------------------------------------------
    // GET /api/comfyui/options — also aliased as POST /models for frontend compat
    router.get('/options', asyncRoute('ComfyUI options error', async (req, res) => {
        const options = await imageService.getComfyUIOptions({
            comfyuiUrl: req.query.comfyuiUrl
        });
        res.json(options);
    }));

    // POST /api/comfyui/models — frontend sends POST with { url } body
    router.post('/models', asyncRoute('ComfyUI models error', async (req, res) => {
        const { url } = req.body || {};
        const options = await imageService.getComfyUIOptions({
            comfyuiUrl: url || req.query.comfyuiUrl
        });
        res.json(options);
    }));

    // -----------------------------------------------------------------------
    // GET /api/comfyui/workflows
    // -----------------------------------------------------------------------
    // GET /api/comfyui/workflows
    router.get('/workflows', asyncRoute('ComfyUI workflows error', async (_req, res) => {
        res.json({
            directory: COMFY_WORKFLOWS_DIR,
            workflows: listComfyWorkflowFiles()
        });
    }));

    // POST /api/comfyui/workflows — frontend sends POST with { url } body
    router.post('/workflows', asyncRoute('ComfyUI workflows list error', async (req, res) => {
        res.json({
            directory: COMFY_WORKFLOWS_DIR,
            workflows: listComfyWorkflowFiles()
        });
    }));

    // -----------------------------------------------------------------------
    // GET /api/comfyui/workflows/:fileName
    // -----------------------------------------------------------------------
    // GET /api/comfyui/workflows/:fileName
    router.get('/workflows/:fileName', asyncRoute('ComfyUI workflow file error', async (req, res) => {
        const fullPath = resolveComfyWorkflowFile(req.params.fileName);
        const content = fs.readFileSync(fullPath, 'utf8');

        res.json({
            name: path.basename(fullPath),
            path: fullPath,
            content
        });
    }));

    // POST /api/comfyui/workflow/load — frontend sends POST with { url, file }
    router.post('/workflow/load', asyncRoute('ComfyUI workflow load error', async (req, res) => {
        const { file } = req.body || {};
        const fileName = file || req.body?.fileName;
        if (!fileName) {
            throw createHttpError(400, '缺少工作流文件名');
        }
        const fullPath = resolveComfyWorkflowFile(fileName);
        const content = fs.readFileSync(fullPath, 'utf8');

        res.json({
            name: path.basename(fullPath),
            path: fullPath,
            content
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/comfyui/test
    // -----------------------------------------------------------------------
    router.post('/test', asyncRoute('ComfyUI test error', async (req, res) => {
        const result = await imageService.testComfyUI(req.body || {});
        res.json(result);
    }));

    // -----------------------------------------------------------------------
    // POST /api/comfyui/validate-workflow
    // -----------------------------------------------------------------------
    // POST /api/comfyui/validate-workflow (also aliased as /validate for frontend compat)
    router.post('/validate-workflow', asyncRoute('ComfyUI workflow validation error', async (req, res) => {
        const result = await imageService.validateComfyUIWorkflow(req.body || {});
        res.json(result);
    }));

    // POST /api/comfyui/validate — frontend alias
    router.post('/validate', asyncRoute('ComfyUI workflow validation error', async (req, res) => {
        const result = await imageService.validateComfyUIWorkflow(req.body || {});
        res.json(result);
    }));

    return router;
};
