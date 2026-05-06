'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { createHttpError, asyncRoute } = require('./helpers');

module.exports = function({
    games, generationSessions, projects, projectStore, generator, imageService,
    stepGenerator, finalizer, projectManager, visualDirector, assetManager,
    memoryService, sceneImageCache, db, MemoryManager, GameEngine, LLMService,
    getGameOrThrow, getSessionOrThrow, getProjectOrThrow, setGameRecord, createGenerationSession
}) {
    const router = express.Router();

    // -----------------------------------------------------------------------
    // POST /api/projects/import-text
    // -----------------------------------------------------------------------
    router.post('/import-text', asyncRoute('Import text project error', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // POST /api/projects/import-package
    // -----------------------------------------------------------------------
    router.post('/import-package', asyncRoute('Import package project error', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // GET /api/projects/:projectId
    // -----------------------------------------------------------------------
    router.get('/:projectId', asyncRoute('Get project error', async (req, res) => {
        const project = getProjectOrThrow(req.params.projectId);
        res.json({ project });
    }));

    // -----------------------------------------------------------------------
    // GET /api/projects
    // -----------------------------------------------------------------------
    router.get('/', asyncRoute('List projects error', async (_req, res) => {
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

    // -----------------------------------------------------------------------
    // POST /api/projects/:projectId/update
    // -----------------------------------------------------------------------
    router.post('/:projectId/update', asyncRoute('Update project error', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // POST /api/projects/:projectId/adaptation/rebuild
    // -----------------------------------------------------------------------
    router.post('/:projectId/adaptation/rebuild', asyncRoute('Rebuild adaptation error', async (req, res) => {
        const project = getProjectOrThrow(req.params.projectId);
        const rebuilt = projectManager.rebuildAdaptation(project, req.body || {});
        projects.set(rebuilt.id, rebuilt);
        projectStore.save(rebuilt);

        res.json({
            success: true,
            project: rebuilt
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/projects/:projectId/visual-bible/rebuild
    // -----------------------------------------------------------------------
    router.post('/:projectId/visual-bible/rebuild', asyncRoute('Rebuild visual bible error', async (req, res) => {
        const project = getProjectOrThrow(req.params.projectId);
        const rebuilt = projectManager.rebuildVisualBible(project, req.body || {});
        projects.set(rebuilt.id, rebuilt);
        projectStore.save(rebuilt);

        res.json({
            success: true,
            project: rebuilt
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/projects/:projectId/refine
    // -----------------------------------------------------------------------
    router.post('/:projectId/refine', asyncRoute('Refine project error', async (req, res) => {
        const project = getProjectOrThrow(req.params.projectId);
        const refined = projectManager.applyRefinement(project, req.body || {});
        projects.set(refined.id, refined);
        projectStore.save(refined);

        res.json({
            success: true,
            project: refined
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/projects/:projectId/optimize
    // -----------------------------------------------------------------------
    router.post('/:projectId/optimize', asyncRoute('Optimize project error', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // DELETE /api/projects/:projectId
    // -----------------------------------------------------------------------
    router.delete('/:projectId', asyncRoute('Delete project error', async (req, res) => {
        const projectId = req.params.projectId;
        getProjectOrThrow(projectId);

        projects.delete(projectId);
        projectStore.remove(projectId);

        res.json({
            success: true,
            projectId
        });
    }));

    // -----------------------------------------------------------------------
    // GET /api/projects/:projectId/assets
    // -----------------------------------------------------------------------
    router.get('/:projectId/assets', asyncRoute('List project assets error', async (req, res) => {
        const project = getProjectOrThrow(req.params.projectId);
        res.json({
            projectId: project.id,
            assets: assetManager.listAssets(project)
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/projects/:projectId/assets/generate-base
    // -----------------------------------------------------------------------
    router.post('/:projectId/assets/generate-base', asyncRoute('Generate base assets error', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // POST /api/projects/:projectId/init-session
    // -----------------------------------------------------------------------
    router.post('/:projectId/init-session', asyncRoute('Init imported project session error', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // POST /api/projects/:projectId/play
    // -----------------------------------------------------------------------
    router.post('/:projectId/play', asyncRoute('Play project error', async (req, res) => {
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

        // Persist play state to SQLite
        db.saveGame(gameId, config, playable.gameData, record.state);

        res.json({
            success: true,
            gameId,
            gameState: record.state,
            resumed: Boolean(project.runtimeSnapshot && req.body?.restart !== true)
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/projects/:projectId/runtime-snapshot
    // -----------------------------------------------------------------------
    router.post('/:projectId/runtime-snapshot', asyncRoute('Save runtime snapshot error', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // GET /api/projects/:projectId/export-package
    // -----------------------------------------------------------------------
    router.get('/:projectId/export-package', asyncRoute('Export package error', async (req, res) => {
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

    return router;
};
