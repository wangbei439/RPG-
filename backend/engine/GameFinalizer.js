const LLMService = require('../utils/LLMService');

class GameFinalizer {
    constructor() {
        this.llm = new LLMService();
    }

    async finalize(memory, config = {}) {
        this.llm.initialize(config.settings || config || {});
        let gameData = memory.exportGameData();
        gameData = this.applySourceProjectContext(gameData);

        if (!gameData.gameSystems || Object.keys(gameData.gameSystems).length === 0) {
            gameData.gameSystems = await this.generateGameSystems(gameData);
        }

        if (!gameData.openingScene || Object.keys(gameData.openingScene).length === 0) {
            gameData.openingScene = await this.generateOpeningScene(gameData);
        }

        if (!gameData.name) {
            gameData.name = await this.generateGameName(gameData);
        }

        gameData.config = {
            difficulty: config.difficulty || 'normal',
            length: config.length || 'medium',
            enableImages: config.enableImages !== false,
            imageSource: config.imageSource || 'none',
            imageGenerationMode: config.imageGenerationMode || 'manual',
            comfyuiUrl: config.comfyuiUrl || 'http://127.0.0.1:8000',
            comfyuiImageCount: config.comfyuiImageCount || 1,
            imageApiUrl: config.imageApiUrl || '',
            imageApiKey: config.imageApiKey || ''
        };

        gameData.chapters = gameData.mainPlot?.chapters || [];
        gameData.sideQuests = gameData.sidePlots || [];
        gameData.fragments = gameData.fragments || [];
        return gameData;
    }

    applySourceProjectContext(gameData) {
        const sourceProject = gameData.sourceProject || {};
        const storyBible = sourceProject.storyBible || null;
        const gameDesign = sourceProject.gameDesign || null;
        const visualBible = sourceProject.visualBible || null;
        const buildArtifacts = sourceProject.buildArtifacts || null;

        if (!storyBible && !gameDesign && !visualBible) {
            return gameData;
        }

        const next = JSON.parse(JSON.stringify(gameData || {}));
        next.storyBible = next.storyBible || storyBible || null;
        next.gameDesign = next.gameDesign || gameDesign || null;
        next.visualBible = next.visualBible || visualBible || null;
        next.buildArtifacts = next.buildArtifacts || buildArtifacts || null;

        if ((!next.worldview || Object.keys(next.worldview).length === 0) && storyBible?.worldview) {
            next.worldview = storyBible.worldview;
        }

        if ((!Array.isArray(next.characters) || next.characters.length === 0) && Array.isArray(storyBible?.characters)) {
            next.characters = storyBible.characters;
        }

        if ((!next.mainPlot || Object.keys(next.mainPlot).length === 0) && storyBible) {
            next.mainPlot = this.buildMainPlotFromBibles(storyBible, gameDesign);
        }

        if ((!Array.isArray(next.sidePlots) || next.sidePlots.length === 0) && Array.isArray(gameDesign?.branches)) {
            next.sidePlots = gameDesign.branches.map((item, index) => ({
                id: item.id || `branch_${index + 1}`,
                name: item.title || `支线 ${index + 1}`,
                description: item.impact || item.trigger || '分支剧情',
                trigger: item.trigger || '',
                type: item.nodeType || 'decision'
            }));
        }

        if (!next.integration || Object.keys(next.integration).length === 0) {
            next.integration = {
                gameName: next.name || storyBible?.title || sourceProject.title || '',
                gameplayDesign: `改编模式：${sourceProject.adaptationMode || 'balanced'}`,
                openingScene: next.openingScene || {},
                gameSystems: next.gameSystems || {}
            };
        }

        return next;
    }

    buildMainPlotFromBibles(storyBible, gameDesign) {
        const chapters = Array.isArray(storyBible?.chapters) ? storyBible.chapters : [];
        return {
            title: storyBible.title || '主线剧情',
            summary: storyBible.summary || '',
            theme: Array.isArray(storyBible.themes) ? storyBible.themes.join('、') : '',
            anchors: Array.isArray(gameDesign?.mainAnchors) ? gameDesign.mainAnchors : [],
            chapters: chapters.map((chapter, index) => ({
                id: chapter.id || `chapter_${index + 1}`,
                name: chapter.title || `章节 ${index + 1}`,
                title: chapter.title || `章节 ${index + 1}`,
                description: chapter.summary || '',
                goal: `推进到 ${chapter.title || `章节 ${index + 1}`}`,
                conflict: chapter.conflict || chapter.summary || '',
                order: index + 1,
                interactiveHooks: chapter.interactiveHooks || []
            }))
        };
    }

    async generateGameSystems(gameData) {
        const prompt = [
            '你是一名专业中文 RPG 系统设计师。',
            `游戏类型：${gameData.type}`,
            `世界观：${JSON.stringify(gameData.worldview || {})}`,
            `角色概览：${JSON.stringify((gameData.characters || []).map((item) => ({ name: item.name, role: item.role })))}`,
            gameData.gameDesign ? `改编策略：${JSON.stringify(gameData.gameDesign.branchingPolicy || {})}` : '',
            '请只返回一个 JSON 对象，结构如下：',
            '{"stats":{"属性名":{"description":"描述","baseValue":10,"maxValue":100}},"combatSystem":{"type":"回合制/即时制/混合制","mechanics":["机制"]},"inventory":{"maxSlots":20,"categories":["武器","防具","消耗品","任务物品"]},"levelSystem":{"enabled":true,"maxLevel":50,"xpPerLevel":100},"specialMechanics":["特殊机制"]}',
            '要求：所有内容必须是中文，并且与世界观、角色和剧情保持一致。'
        ].filter(Boolean).join('\n\n');

        return this.llm.generateJSON(prompt);
    }

    async generateOpeningScene(gameData) {
        const firstChapter = gameData.mainPlot?.chapters?.[0];
        const prompt = [
            '你是一名专业中文 RPG 编剧。',
            `游戏类型：${gameData.type}`,
            `世界观：${gameData.worldview?.description || ''}`,
            firstChapter ? `第一章信息：${JSON.stringify(firstChapter)}` : '',
            `玩家身份：${gameData.gameDesign?.playerRole || '冒险者'}`,
            '请只返回一个 JSON 对象，结构如下：',
            '{"description":"开场场景描述","narration":"开场旁白","initialChoices":[{"text":"选项文本","action":"对应行动"}],"startingLocation":"起始地点","mood":"场景氛围"}',
            '要求：内容必须是中文，并自然引导玩家进入游戏。'
        ].filter(Boolean).join('\n\n');

        return this.llm.generateJSON(prompt);
    }

    async generateGameName(gameData) {
        const prompt = [
            '请根据下面内容，为这个 RPG 生成一个简洁、有辨识度的中文游戏名。',
            `世界观：${gameData.worldview?.description || ''}`,
            `游戏类型：${gameData.type}`,
            `主线主题：${gameData.mainPlot?.theme || ''}`,
            gameData.gameDesign?.adaptationProfile ? `改编风格：${gameData.gameDesign.adaptationProfile}` : '',
            '只返回游戏名，不要输出其他内容。'
        ].filter(Boolean).join('\n');

        const result = await this.llm.generateText(prompt, { maxTokens: 30 });
        return result.trim().replace(/["']/g, '');
    }
}

module.exports = GameFinalizer;
