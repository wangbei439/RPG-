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
    // POST /api/generate/init
    // -----------------------------------------------------------------------
    router.post('/init', asyncRoute('Init generation error', async (req, res) => {
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

    // -----------------------------------------------------------------------
    // POST /api/generate/step
    // -----------------------------------------------------------------------
    router.post('/step', asyncRoute('Step generation error', async (req, res) => {
        const { sessionId, stepId, options } = req.body;
        const session = getSessionOrThrow(sessionId);
        const result = await stepGenerator.generateStep(stepId, session.memory, {
            ...(options || {}),
            config: session.config
        });

        res.json(result);
    }));

    // -----------------------------------------------------------------------
    // POST /api/generate/confirm
    // -----------------------------------------------------------------------
    router.post('/confirm', asyncRoute('Confirm error', async (req, res) => {
        const { sessionId, stepId, candidate } = req.body;
        const session = getSessionOrThrow(sessionId);

        session.memory.confirmStep(stepId, candidate);

        // Persist session state change to SQLite
        db.saveSession(sessionId, {
            globalContext: session.memory.globalContext,
            elementStore: session.memory.elementStore,
            workingMemory: session.memory.workingMemory
        }, session.config, session.projectId);

        const nextStep = stepGenerator.getNextStep(stepId);
        res.json({
            success: true,
            nextStep: nextStep ? nextStep.id : null,
            allSteps: stepGenerator.steps
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/generate/regenerate
    // -----------------------------------------------------------------------
    router.post('/regenerate', asyncRoute('Regenerate error', async (req, res) => {
        const { sessionId, stepId, feedback } = req.body;
        const session = getSessionOrThrow(sessionId);
        const result = await stepGenerator.regenerateStep(stepId, session.memory, feedback || '', session.config);
        res.json(result);
    }));

    // -----------------------------------------------------------------------
    // POST /api/generate/modify
    // -----------------------------------------------------------------------
    router.post('/modify', asyncRoute('Modify error', async (req, res) => {
        const { sessionId, stepId, elementId, changes } = req.body;
        const session = getSessionOrThrow(sessionId);
        const result = await stepGenerator.modifyElement(stepId, elementId, changes, session.memory, session.config);

        if (result && !result.error) {
            session.memory.updateElement(stepId, elementId, result);
            // Persist session state change to SQLite
            db.saveSession(sessionId, {
                globalContext: session.memory.globalContext,
                elementStore: session.memory.elementStore,
                workingMemory: session.memory.workingMemory
            }, session.config, session.projectId);
        }

        res.json({
            success: !result?.error,
            modified: result
        });
    }));

    // -----------------------------------------------------------------------
    // GET /api/generate/:sessionId/status
    // -----------------------------------------------------------------------
    router.get('/:sessionId/status', asyncRoute('Status error', async (req, res) => {
        const session = getSessionOrThrow(req.params.sessionId);
        res.json({
            memory: session.memory.elementStore,
            completedSteps: session.memory.globalContext.confirmedElements,
            summary: session.memory.elementStore.summary,
            steps: stepGenerator.steps
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/generate/:sessionId/finalize
    // -----------------------------------------------------------------------
    router.post('/:sessionId/finalize', asyncRoute('Finalize error', async (req, res) => {
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
        // Remove session from database after finalization
        db.deleteSession(req.params.sessionId);

        res.json({
            success: true,
            gameId,
            gameData
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/generate/:sessionId/back
    // -----------------------------------------------------------------------
    router.post('/:sessionId/back', asyncRoute('Back error', async (req, res) => {
        const { stepId } = req.body;
        getSessionOrThrow(req.params.sessionId);

        const previousStep = stepGenerator.getPreviousStep(stepId);
        res.json({
            prevStep: previousStep ? previousStep.id : null,
            allSteps: stepGenerator.steps
        });
    }));

    return router;
};
