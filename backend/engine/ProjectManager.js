const { v4: uuidv4 } = require('uuid');
const StoryParser = require('./StoryParser');
const SmartStoryParser = require('./SmartStoryParser');

class ProjectManager {
    constructor() {
        this.parser = new StoryParser();
        this.smartParser = new SmartStoryParser();
    }

    createImportedProject(payload = {}) {
        const parsed = this.parser.parseImportedText(payload);
        const now = Date.now();

        return {
            id: uuidv4(),
            createdAt: now,
            updatedAt: now,
            status: 'imported',
            mode: 'novel_import',
            title: parsed.sourceDocument.title,
            gameType: payload.gameType || 'custom',
            adaptationMode: payload.adaptationMode || 'balanced',
            config: this.normalizeConfig(),
            source: parsed.sourceDocument,
            storyBible: parsed.storyBible,
            gameDesign: parsed.gameDesign,
            visualBible: parsed.visualBible,
            seedData: parsed.seedData,
            buildArtifacts: this.normalizeBuildArtifacts({ generatedAt: now }, now),
            runtimeSnapshot: this.normalizeRuntimeSnapshot(),
            optimizationReport: this.buildOptimizationReport({
                storyBible: parsed.storyBible,
                gameDesign: parsed.gameDesign,
                visualBible: parsed.visualBible,
                buildArtifacts: {},
                runtimeSnapshot: null
            })
        };
    }

    async createSmartImportedProject(payload = {}, settings = {}, onProgress = null) {
        this.smartParser.initialize(settings);
        const parsed = await this.smartParser.parseImportedText(payload, onProgress);
        const now = Date.now();

        return {
            id: uuidv4(),
            createdAt: now,
            updatedAt: now,
            status: 'imported',
            mode: 'novel_import',
            title: parsed.sourceDocument.title,
            gameType: payload.gameType || 'custom',
            adaptationMode: payload.adaptationMode || 'balanced',
            config: this.normalizeConfig(),
            source: parsed.sourceDocument,
            storyBible: parsed.storyBible,
            gameDesign: parsed.gameDesign,
            visualBible: parsed.visualBible,
            seedData: parsed.seedData,
            buildArtifacts: this.normalizeBuildArtifacts({ generatedAt: now }, now),
            runtimeSnapshot: this.normalizeRuntimeSnapshot(),
            optimizationReport: this.buildOptimizationReport({
                storyBible: parsed.storyBible,
                gameDesign: parsed.gameDesign,
                visualBible: parsed.visualBible,
                buildArtifacts: {},
                runtimeSnapshot: null
            }),
            parseMethod: 'smart'
        };
    }

    importFromPackage(rawPackage = {}) {
        if (!rawPackage || typeof rawPackage !== 'object') {
            throw new Error('项目包格式无效。');
        }

        const meta = rawPackage.project || {};
        const now = Date.now();
        const project = {
            id: uuidv4(),
            createdAt: now,
            updatedAt: now,
            status: meta.status || 'imported',
            mode: meta.mode || 'novel_import',
            title: String(meta.title || '导入项目').trim(),
            gameType: meta.gameType || 'custom',
            adaptationMode: meta.adaptationMode || 'balanced',
            config: this.normalizeConfig(rawPackage.config),
            source: this.normalizeSource(rawPackage.source),
            storyBible: this.normalizeStoryBible(rawPackage.storyBible),
            gameDesign: rawPackage.gameDesign && typeof rawPackage.gameDesign === 'object' ? rawPackage.gameDesign : {},
            visualBible: this.normalizeVisualBible(rawPackage.visualBible),
            seedData: {},
            buildArtifacts: this.normalizeBuildArtifacts(rawPackage.buildArtifacts, now),
            runtimeSnapshot: this.normalizeRuntimeSnapshot(rawPackage.runtimeSnapshot)
        };

        if (!project.storyBible.summary && project.source?.excerpt) {
            project.storyBible.summary = project.source.excerpt;
        }
        if (!project.storyBible.title) {
            project.storyBible.title = project.title;
        }
        if (!project.source.title) {
            project.source.title = project.title;
        }

        project.storyBible.events = this.parser.buildEventsFromChapters(project.storyBible.chapters || []);
        project.storyBible.timeline = (project.storyBible.chapters || []).map((chapter, index) => ({
            id: `timeline_${index + 1}`,
            label: chapter.title || `章节 ${index + 1}`,
            summary: chapter.summary || ''
        }));

        project.gameDesign = Object.keys(project.gameDesign).length
            ? project.gameDesign
            : this.parser.buildGameDesign(project.storyBible, {
                gameType: project.gameType,
                adaptationMode: project.adaptationMode
            });

        project.visualBible = {
            ...this.parser.buildVisualBible(project.storyBible),
            ...project.visualBible,
            styleProfile: {
                ...(this.parser.buildVisualBible(project.storyBible).styleProfile || {}),
                ...(project.visualBible?.styleProfile || {})
            }
        };

        project.seedData = this.parser.buildSeedData(project.storyBible, {
            gameType: project.gameType,
            adaptationMode: project.adaptationMode,
            gameDesign: project.gameDesign
        });
        project.optimizationReport = this.buildOptimizationReport(project);
        return project;
    }

    normalizeConfig(config = {}) {
        const fallback = {
            pacing: 'balanced',
            refinement: {
                characterVisualStrength: 0.6,
                styleLock: 0.7,
                adaptationStrength: 0.5
            }
        };

        return {
            ...fallback,
            ...(config && typeof config === 'object' ? config : {}),
            refinement: {
                ...fallback.refinement,
                ...((config && typeof config === 'object' && config.refinement) ? config.refinement : {})
            }
        };
    }

    normalizeSource(source = {}) {
        if (!source || typeof source !== 'object') {
            return {
                title: '导入项目',
                mode: 'novel_import',
                content: '',
                excerpt: '',
                wordCount: 0,
                paragraphCount: 0,
                importedAt: new Date().toISOString()
            };
        }

        return {
            title: String(source.title || '导入项目'),
            mode: source.mode || 'novel_import',
            content: String(source.content || ''),
            excerpt: String(source.excerpt || '').slice(0, 1200),
            wordCount: Number(source.wordCount) || String(source.content || '').length,
            paragraphCount: Number(source.paragraphCount) || 0,
            importedAt: source.importedAt || new Date().toISOString()
        };
    }

    normalizeStoryBible(storyBible = {}) {
        const empty = {
            title: '',
            summary: '',
            themes: [],
            worldview: {},
            characters: [],
            locations: [],
            chapters: [],
            events: [],
            relationships: [],
            rules: [],
            timeline: []
        };
        const next = {
            ...empty,
            ...(storyBible && typeof storyBible === 'object' ? storyBible : {})
        };
        next.themes = Array.isArray(next.themes) ? next.themes : [];
        next.characters = Array.isArray(next.characters) ? next.characters : [];
        next.locations = Array.isArray(next.locations) ? next.locations : [];
        next.chapters = Array.isArray(next.chapters) ? next.chapters : [];
        next.events = Array.isArray(next.events) ? next.events : [];
        next.relationships = Array.isArray(next.relationships) ? next.relationships : [];
        next.rules = Array.isArray(next.rules) ? next.rules : [];
        next.timeline = Array.isArray(next.timeline) ? next.timeline : [];
        next.worldview = next.worldview && typeof next.worldview === 'object' ? next.worldview : {};
        return next;
    }

    normalizeVisualBible(visualBible = {}) {
        const fallback = this.parser.buildVisualBible({ title: '', themes: [], worldview: {}, characters: [], locations: [], chapters: [] });
        const next = {
            ...fallback,
            ...(visualBible && typeof visualBible === 'object' ? visualBible : {})
        };
        next.characterSheets = Array.isArray(next.characterSheets) ? next.characterSheets : [];
        next.locationSheets = Array.isArray(next.locationSheets) ? next.locationSheets : [];
        next.sceneTemplates = Array.isArray(next.sceneTemplates) ? next.sceneTemplates : [];
        next.assetIndex = Array.isArray(next.assetIndex) ? next.assetIndex : [];
        next.referenceBindings = next.referenceBindings && typeof next.referenceBindings === 'object'
            ? next.referenceBindings
            : { characters: [], locations: [], styleBoard: [] };
        next.seedPolicy = next.seedPolicy && typeof next.seedPolicy === 'object' ? next.seedPolicy : {};
        next.promptTemplates = next.promptTemplates && typeof next.promptTemplates === 'object'
            ? next.promptTemplates
            : fallback.promptTemplates;
        next.styleProfile = next.styleProfile && typeof next.styleProfile === 'object'
            ? next.styleProfile
            : fallback.styleProfile;
        return next;
    }

    normalizeBuildArtifacts(buildArtifacts = {}, now = Date.now()) {
        const next = buildArtifacts && typeof buildArtifacts === 'object' ? buildArtifacts : {};
        return {
            generatedAt: Number(next.generatedAt) || now,
            visualAssets: Array.isArray(next.visualAssets) ? next.visualAssets : [],
            bundles: Array.isArray(next.bundles) ? next.bundles : [],
            exportHistory: Array.isArray(next.exportHistory) ? next.exportHistory : [],
            latestPlayable: next.latestPlayable && typeof next.latestPlayable === 'object'
                ? {
                    gameId: next.latestPlayable.gameId || null,
                    gameData: next.latestPlayable.gameData || null,
                    config: next.latestPlayable.config || {},
                    updatedAt: next.latestPlayable.updatedAt || null
                }
                : null
        };
    }

    normalizeRuntimeSnapshot(runtimeSnapshot = null) {
        if (!runtimeSnapshot || typeof runtimeSnapshot !== 'object') {
            return {
                chapterId: null,
                sceneNodeId: null,
                plotBeatId: null,
                visualState: null,
                history: []
            };
        }
        return {
            chapterId: runtimeSnapshot.chapterId ?? null,
            sceneNodeId: runtimeSnapshot.sceneNodeId ?? null,
            plotBeatId: runtimeSnapshot.plotBeatId ?? null,
            playerState: runtimeSnapshot.playerState || {},
            worldState: runtimeSnapshot.worldState || {},
            relationshipState: Array.isArray(runtimeSnapshot.relationshipState) ? runtimeSnapshot.relationshipState : [],
            inventory: Array.isArray(runtimeSnapshot.inventory) ? runtimeSnapshot.inventory : [],
            activeQuests: Array.isArray(runtimeSnapshot.activeQuests) ? runtimeSnapshot.activeQuests : [],
            visualState: runtimeSnapshot.visualState || null,
            history: Array.isArray(runtimeSnapshot.history) ? runtimeSnapshot.history : []
        };
    }

    buildGenerationSeed(project, overrides = {}) {
        return {
            userInput: overrides.userInput || project.storyBible?.summary || project.source?.excerpt || '',
            gameType: overrides.gameType || project.gameType || 'custom',
            seedData: project.seedData || {},
            sourceProject: {
                projectId: project.id,
                title: project.title,
                mode: project.mode,
                adaptationMode: project.adaptationMode,
                storyBible: project.storyBible || null,
                gameDesign: project.gameDesign || null,
                visualBible: project.visualBible || null,
                buildArtifacts: project.buildArtifacts || null,
                runtimeSnapshot: project.runtimeSnapshot || null
            }
        };
    }

    attachLatestPlayable(project, playable = {}) {
        const nextProject = JSON.parse(JSON.stringify(project || {}));
        nextProject.buildArtifacts = this.normalizeBuildArtifacts(nextProject.buildArtifacts);
        nextProject.buildArtifacts.latestPlayable = {
            gameId: playable.gameId || null,
            gameData: playable.gameData || null,
            config: playable.config || {},
            updatedAt: playable.updatedAt || Date.now()
        };
        nextProject.updatedAt = Date.now();
        nextProject.optimizationReport = this.buildOptimizationReport(nextProject);
        return nextProject;
    }

    applyProjectEdits(project, edits = {}) {
        const nextProject = JSON.parse(JSON.stringify(project || {}));
        nextProject.storyBible = nextProject.storyBible || {};
        nextProject.source = nextProject.source || {};
        nextProject.config = nextProject.config || this.normalizeConfig();
        nextProject.buildArtifacts = this.normalizeBuildArtifacts(nextProject.buildArtifacts);
        nextProject.runtimeSnapshot = this.normalizeRuntimeSnapshot(nextProject.runtimeSnapshot);

        const storyBible = nextProject.storyBible;
        const worldview = storyBible.worldview || {};

        if (typeof edits.title === 'string' && edits.title.trim()) {
            const title = edits.title.trim();
            nextProject.title = title;
            nextProject.source.title = title;
            storyBible.title = title;
            worldview.worldName = title;
        }

        if (typeof edits.summary === 'string' && edits.summary.trim()) {
            const summary = edits.summary.trim();
            storyBible.summary = summary;
            worldview.description = summary;
        }

        if (typeof edits.adaptationMode === 'string' && edits.adaptationMode.trim()) {
            nextProject.adaptationMode = edits.adaptationMode.trim();
        }

        if (typeof edits.gameType === 'string' && edits.gameType.trim()) {
            nextProject.gameType = edits.gameType.trim();
        }

        if (typeof edits.pacing === 'string' && edits.pacing.trim()) {
            nextProject.config.pacing = edits.pacing.trim();
        }

        if (edits.refinement && typeof edits.refinement === 'object') {
            nextProject.config.refinement = {
                ...(nextProject.config.refinement || {}),
                ...edits.refinement
            };
        }

        if (Array.isArray(edits.characters)) {
            storyBible.characters = edits.characters
                .map((character, index) => ({
                    id: character.id || `import_char_${index + 1}`,
                    name: String(character.name || '').trim(),
                    role: String(character.role || '待定角色').trim(),
                    description: String(character.description || '').trim(),
                    personality: String(character.personality || '待补充').trim(),
                    tone: String(character.tone || '待补充').trim(),
                    motivation: String(character.motivation || '待补充').trim(),
                    worldConnection: String(character.worldConnection || '来源于导入长文本').trim()
                }))
                .filter((character) => character.name);
        }

        if (Array.isArray(edits.chapters)) {
            storyBible.chapters = edits.chapters
                .map((chapter, index) => ({
                    id: chapter.id || `chapter_${index + 1}`,
                    title: String(chapter.title || `导入章节 ${index + 1}`).trim(),
                    summary: String(chapter.summary || '').trim(),
                    excerpt: String(chapter.excerpt || chapter.summary || '').trim().slice(0, 1000),
                    order: index + 1
                }))
                .filter((chapter) => chapter.title || chapter.summary);
        }

        if (Array.isArray(edits.locations)) {
            storyBible.locations = edits.locations
                .map((location, index) => ({
                    id: location.id || `import_loc_${index + 1}`,
                    name: String(location.name || '').trim(),
                    description: String(location.description || '').trim(),
                    dangerLevel: Number(location.dangerLevel) || 2
                }))
                .filter((location) => location.name);
        }

        worldview.locations = storyBible.locations || worldview.locations || [];
        worldview.history = (storyBible.chapters || [])
            .slice(0, 5)
            .map((chapter) => chapter.summary)
            .filter(Boolean)
            .join(' ');
        storyBible.worldview = worldview;

        return this.optimizeProject(nextProject, { preserveAssets: true, markStatus: false });
    }

    rebuildAdaptation(project, options = {}) {
        const nextProject = JSON.parse(JSON.stringify(project || {}));
        nextProject.storyBible = this.normalizeStoryBible(nextProject.storyBible);
        nextProject.gameType = options.gameType || nextProject.gameType || 'custom';
        nextProject.adaptationMode = options.adaptationMode || nextProject.adaptationMode || 'balanced';
        nextProject.gameDesign = this.parser.buildGameDesign(nextProject.storyBible, {
            gameType: nextProject.gameType,
            adaptationMode: nextProject.adaptationMode,
            playerRole: options.playerRole
        });
        nextProject.seedData = this.parser.buildSeedData(nextProject.storyBible, {
            gameType: nextProject.gameType,
            adaptationMode: nextProject.adaptationMode,
            gameDesign: nextProject.gameDesign
        });
        nextProject.updatedAt = Date.now();
        nextProject.optimizationReport = this.buildOptimizationReport(nextProject);
        return nextProject;
    }

    rebuildVisualBible(project, options = {}) {
        const nextProject = JSON.parse(JSON.stringify(project || {}));
        const previousVisual = this.normalizeVisualBible(nextProject.visualBible);
        const rebuilt = this.parser.buildVisualBible(nextProject.storyBible || {});

        rebuilt.styleProfile = {
            ...(rebuilt.styleProfile || {}),
            ...(previousVisual.styleProfile || {}),
            ...(options.styleProfile || {})
        };
        rebuilt.assetIndex = Array.isArray(previousVisual.assetIndex) ? previousVisual.assetIndex : [];
        rebuilt.referenceBindings = previousVisual.referenceBindings || rebuilt.referenceBindings || {
            characters: [],
            locations: [],
            styleBoard: []
        };
        rebuilt.seedPolicy = {
            ...(rebuilt.seedPolicy || {}),
            ...(previousVisual.seedPolicy || {})
        };

        nextProject.visualBible = rebuilt;
        nextProject.updatedAt = Date.now();
        nextProject.optimizationReport = this.buildOptimizationReport(nextProject);
        return nextProject;
    }

    applyRefinement(project, refinement = {}) {
        const nextProject = JSON.parse(JSON.stringify(project || {}));
        nextProject.config = this.normalizeConfig(nextProject.config);
        nextProject.config.refinement = {
            ...(nextProject.config.refinement || {}),
            ...(refinement.refinement || {})
        };

        if (typeof refinement.pacing === 'string' && refinement.pacing.trim()) {
            nextProject.config.pacing = refinement.pacing.trim();
        }

        if (refinement.styleProfile && typeof refinement.styleProfile === 'object') {
            nextProject.visualBible = this.normalizeVisualBible(nextProject.visualBible);
            nextProject.visualBible.styleProfile = {
                ...(nextProject.visualBible.styleProfile || {}),
                ...refinement.styleProfile
            };
        }

        if (typeof refinement.adaptationMode === 'string' && refinement.adaptationMode.trim()) {
            nextProject.adaptationMode = refinement.adaptationMode.trim();
            nextProject.gameDesign = this.parser.buildGameDesign(nextProject.storyBible || {}, {
                gameType: nextProject.gameType,
                adaptationMode: nextProject.adaptationMode
            });
        }

        nextProject.updatedAt = Date.now();
        nextProject.optimizationReport = this.buildOptimizationReport(nextProject);
        return nextProject;
    }

    optimizeProject(project, options = {}) {
        const nextProject = JSON.parse(JSON.stringify(project || {}));
        nextProject.config = this.normalizeConfig(nextProject.config);
        nextProject.storyBible = this.normalizeStoryBible(nextProject.storyBible);
        nextProject.visualBible = this.normalizeVisualBible(nextProject.visualBible);
        nextProject.buildArtifacts = this.normalizeBuildArtifacts(nextProject.buildArtifacts);
        nextProject.runtimeSnapshot = this.normalizeRuntimeSnapshot(nextProject.runtimeSnapshot);

        const sourceContent = nextProject.source?.content || '';
        const contentForParsing = sourceContent || [
            nextProject.storyBible.summary || '',
            ...(nextProject.storyBible.chapters || []).map((chapter) => `${chapter.title || ''}\n${chapter.summary || ''}`)
        ].filter(Boolean).join('\n\n');

        if (contentForParsing) {
            const baseChapters = (nextProject.storyBible.chapters || []).length
                ? nextProject.storyBible.chapters
                : this.parser.extractChapters(contentForParsing);
            const enrichedChapters = this.parser.enrichChapters(
                baseChapters,
                contentForParsing,
                nextProject.storyBible.characters || [],
                nextProject.storyBible.locations || []
            );
            nextProject.storyBible.chapters = enrichedChapters;

            if (!nextProject.storyBible.summary) {
                nextProject.storyBible.summary = this.parser.buildSummary(enrichedChapters, contentForParsing);
            }

            if (!(nextProject.storyBible.relationships || []).length) {
                nextProject.storyBible.relationships = this.parser.extractRelationships(
                    contentForParsing,
                    nextProject.storyBible.characters || []
                );
            }
        }

        nextProject.storyBible.characters = this.parser.enrichCharacterDetails(
            nextProject.storyBible.characters || [],
            nextProject.storyBible.chapters || [],
            nextProject.storyBible.summary || ''
        );
        nextProject.storyBible.events = this.parser.buildEventsFromChapters(nextProject.storyBible.chapters || []);
        nextProject.storyBible.timeline = (nextProject.storyBible.chapters || []).map((chapter, index) => ({
            id: `timeline_${index + 1}`,
            label: chapter.title || `章节 ${index + 1}`,
            summary: chapter.summary || ''
        }));
        nextProject.storyBible.worldview = {
            ...(nextProject.storyBible.worldview || {}),
            worldName: nextProject.storyBible.worldview?.worldName || nextProject.title || nextProject.storyBible.title || '',
            description: nextProject.storyBible.worldview?.description || nextProject.storyBible.summary || '',
            atmosphere: nextProject.storyBible.worldview?.atmosphere || this.parser.inferAtmosphere(contentForParsing),
            locations: nextProject.storyBible.locations || []
        };

        nextProject.gameDesign = this.parser.buildGameDesign(nextProject.storyBible, {
            gameType: nextProject.gameType,
            adaptationMode: nextProject.adaptationMode
        });

        const rebuiltVisual = this.parser.buildVisualBible(nextProject.storyBible);
        nextProject.visualBible = {
            ...rebuiltVisual,
            ...nextProject.visualBible,
            styleProfile: {
                ...(rebuiltVisual.styleProfile || {}),
                ...(nextProject.visualBible?.styleProfile || {})
            },
            promptTemplates: {
                ...(rebuiltVisual.promptTemplates || {}),
                ...(nextProject.visualBible?.promptTemplates || {})
            },
            seedPolicy: {
                ...(rebuiltVisual.seedPolicy || {}),
                ...(nextProject.visualBible?.seedPolicy || {})
            },
            referenceBindings: options.preserveAssets !== false
                ? (nextProject.visualBible?.referenceBindings || rebuiltVisual.referenceBindings)
                : rebuiltVisual.referenceBindings,
            assetIndex: options.preserveAssets !== false
                ? (nextProject.visualBible?.assetIndex || [])
                : []
        };

        nextProject.seedData = this.parser.buildSeedData(nextProject.storyBible, {
            gameType: nextProject.gameType,
            adaptationMode: nextProject.adaptationMode,
            gameDesign: nextProject.gameDesign
        });
        nextProject.updatedAt = Date.now();
        if (options.markStatus !== false) {
            nextProject.status = 'optimized';
        }
        nextProject.optimizationReport = this.buildOptimizationReport(nextProject);
        return nextProject;
    }

    buildOptimizationReport(project = {}) {
        const storyBible = project.storyBible || {};
        const gameDesign = project.gameDesign || {};
        const visualBible = project.visualBible || {};
        const buildArtifacts = project.buildArtifacts || {};
        const runtimeSnapshot = project.runtimeSnapshot || null;

        const metrics = {
            characters: Array.isArray(storyBible.characters) ? storyBible.characters.length : 0,
            locations: Array.isArray(storyBible.locations) ? storyBible.locations.length : 0,
            chapters: Array.isArray(storyBible.chapters) ? storyBible.chapters.length : 0,
            relationships: Array.isArray(storyBible.relationships) ? storyBible.relationships.length : 0,
            interactiveNodes: Array.isArray(gameDesign.interactiveNodes) ? gameDesign.interactiveNodes.length : 0,
            sceneTemplates: Array.isArray(visualBible.sceneTemplates) ? visualBible.sceneTemplates.length : 0,
            visualAssets: Array.isArray(visualBible.assetIndex) ? visualBible.assetIndex.length : 0
        };

        const readiness = {
            story: this.computeReadinessScore([
                Boolean(storyBible.summary),
                metrics.characters >= 2,
                metrics.locations >= 1,
                metrics.chapters >= 2,
                metrics.relationships >= 1
            ]),
            adaptation: this.computeReadinessScore([
                Array.isArray(gameDesign.mainAnchors) && gameDesign.mainAnchors.length >= 1,
                Array.isArray(gameDesign.branches) && gameDesign.branches.length >= 1,
                metrics.interactiveNodes >= 2,
                Array.isArray(gameDesign.conflictMap) && gameDesign.conflictMap.length >= 1
            ]),
            visual: this.computeReadinessScore([
                Boolean(visualBible.styleProfile?.stylePreset),
                metrics.sceneTemplates >= 1,
                metrics.visualAssets >= 1
            ]),
            playable: this.computeReadinessScore([
                Boolean(buildArtifacts.latestPlayable?.gameData),
                Boolean(runtimeSnapshot?.history?.length || runtimeSnapshot?.plotBeatId != null)
            ])
        };

        const recommendations = [];
        if (metrics.characters < 2) {
            recommendations.push('补充至少 2 名关键角色，主线和互动会稳定很多。');
        }
        if (metrics.relationships < 1) {
            recommendations.push('补充人物关系，能显著提升剧情分支和好感度玩法的质量。');
        }
        if (metrics.interactiveNodes < 3) {
            recommendations.push('增加可互动节点，避免导入内容只有“能读”但“不够能玩”。');
        }
        if (metrics.sceneTemplates < 2) {
            recommendations.push('补充场景模板，让运行时画面更容易保持章节级一致性。');
        }
        if (metrics.visualAssets < 1) {
            recommendations.push('生成角色/地点基准图，后续运行时出图会更稳定。');
        }
        if (!buildArtifacts.latestPlayable?.gameData) {
            recommendations.push('完成一次整合生成，形成可试玩版本。');
        }

        const strengths = [];
        if (metrics.chapters >= 3) {
            strengths.push('章节骨架已经具备，适合继续做主支线展开。');
        }
        if (metrics.relationships >= 1) {
            strengths.push('人物关系已成形，可支撑关系推进玩法。');
        }
        if (metrics.visualAssets >= 1) {
            strengths.push('视觉基准已存在，适合进一步锁定角色和地点一致性。');
        }
        if (buildArtifacts.latestPlayable?.gameData) {
            strengths.push('项目已经具备试玩版本，可直接做体验迭代。');
        }

        const nextActions = this.buildNextActions({
            metrics,
            buildArtifacts,
            readiness
        });
        const relationshipGraph = this.buildRelationshipGraphSummary(storyBible);
        const playableChapters = this.buildPlayableChapterSummary(storyBible, gameDesign);

        return {
            updatedAt: new Date().toISOString(),
            metrics,
            readiness,
            recommendations,
            strengths,
            nextActions,
            relationshipGraph,
            playableChapters,
            overallScore: Math.round((readiness.story + readiness.adaptation + readiness.visual + readiness.playable) / 4)
        };
    }

    computeReadinessScore(checks = []) {
        if (!checks.length) {
            return 0;
        }
        const hit = checks.filter(Boolean).length;
        return Math.round((hit / checks.length) * 100);
    }

    buildNextActions({ metrics = {}, buildArtifacts = {}, readiness = {} } = {}) {
        const actions = [];

        if (!buildArtifacts.latestPlayable?.gameData) {
            actions.push({
                key: 'finalize_playable',
                priority: 100,
                label: '先整合生成一个可试玩版本',
                reason: '没有试玩版本时，很难判断节奏、分支和沉浸感是否成立。'
            });
        }

        if ((metrics.visualAssets || 0) < 1) {
            actions.push({
                key: 'generate_base_assets',
                priority: 95,
                label: '生成角色/地点基准图',
                reason: '没有视觉基准时，后续运行时生图更容易漂移。'
            });
        }

        if ((metrics.interactiveNodes || 0) < 3) {
            actions.push({
                key: 'expand_interactive_nodes',
                priority: 90,
                label: '补强章节可玩点',
                reason: '互动节点偏少会导致“能读但不够能玩”。'
            });
        }

        if ((metrics.relationships || 0) < 2) {
            actions.push({
                key: 'expand_relationships',
                priority: 85,
                label: '补充关键人物关系',
                reason: '人物关系不足会削弱支线、站队和好感度玩法。'
            });
        }

        if ((metrics.characters || 0) < 3) {
            actions.push({
                key: 'expand_cast',
                priority: 80,
                label: '补充关键角色',
                reason: '角色数量太少时，互动层会显得单薄。'
            });
        }

        if ((readiness.story || 0) >= 70 && (readiness.adaptation || 0) >= 70 && (readiness.visual || 0) >= 70) {
            actions.push({
                key: 'polish_runtime',
                priority: 60,
                label: '进入试玩打磨阶段',
                reason: '故事、改编和视觉基础已经够用，可以开始用试玩反馈迭代。'
            });
        }

        return actions
            .sort((left, right) => right.priority - left.priority)
            .slice(0, 5);
    }

    buildRelationshipGraphSummary(storyBible = {}) {
        const relationships = Array.isArray(storyBible.relationships) ? storyBible.relationships : [];
        const characters = Array.isArray(storyBible.characters) ? storyBible.characters : [];
        const nodes = characters.slice(0, 12).map((character) => ({
            id: character.id,
            name: character.name,
            role: character.role
        }));
        const edges = relationships.slice(0, 16).map((item) => ({
            id: item.id,
            source: item.source,
            target: item.target,
            relation: item.relation || '待确认',
            tension: item.tension || '中',
            summary: item.summary || ''
        }));

        const hubs = nodes.map((node) => ({
            name: node.name,
            degree: edges.filter((edge) => edge.source === node.name || edge.target === node.name).length
        }))
            .sort((left, right) => right.degree - left.degree)
            .slice(0, 5);

        return {
            nodes,
            edges,
            hubs
        };
    }

    buildPlayableChapterSummary(storyBible = {}, gameDesign = {}) {
        const chapters = Array.isArray(storyBible.chapters) ? storyBible.chapters : [];
        const flows = Array.isArray(gameDesign.chapterFlow) ? gameDesign.chapterFlow : [];

        return chapters.slice(0, 12).map((chapter, index) => {
            const flow = flows.find((item) => item.chapterId === chapter.id) || {};
            return {
                chapterId: chapter.id,
                title: chapter.title || `章节 ${index + 1}`,
                conflict: chapter.conflict || chapter.summary || '',
                stakes: chapter.stakes || '',
                interactiveTypes: Array.isArray(flow.interactionTypes) ? flow.interactionTypes : [],
                keyNodes: Array.isArray(flow.keyNodeLabels) ? flow.keyNodeLabels : [],
                branchSlotCount: flow.branchSlotCount || 0
            };
        });
    }

    buildExportPackage(project) {
        const now = new Date().toISOString();
        return {
            packageVersion: '1.1.0',
            exportedAt: now,
            project: {
                id: project.id,
                title: project.title,
                mode: project.mode,
                gameType: project.gameType,
                adaptationMode: project.adaptationMode,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                status: project.status
            },
            config: project.config || {},
            source: project.source || {},
            storyBible: project.storyBible || {},
            gameDesign: project.gameDesign || {},
            visualBible: project.visualBible || {},
            buildArtifacts: project.buildArtifacts || {},
            runtimeSnapshot: project.runtimeSnapshot || null,
            optimizationReport: project.optimizationReport || this.buildOptimizationReport(project),
            assetManifest: (project.visualBible?.assetIndex || []).map((asset) => ({
                id: asset.id,
                key: asset.key,
                type: asset.type,
                targetId: asset.targetId,
                targetName: asset.targetName,
                status: asset.status,
                createdAt: asset.createdAt
            }))
        };
    }
}

module.exports = ProjectManager;
