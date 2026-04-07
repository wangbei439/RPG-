const LLMService = require('../utils/LLMService');

class GameFinalizer {
    constructor() {
        this.llm = new LLMService();
    }

    async finalize(memory, config = {}) {
        this.llm.initialize(config.settings || config || {});
        const gameData = memory.exportGameData();

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

    async generateGameSystems(gameData) {
        const prompt = [
            '你是一名专业中文 RPG 系统设计师。',
            `游戏类型：${gameData.type}`,
            `世界观：${JSON.stringify(gameData.worldview)}`,
            `角色概览：${JSON.stringify(gameData.characters?.map((item) => ({ name: item.name, role: item.role })))}`,
            '请只返回一个 JSON 对象，结构如下：',
            '{"stats":{"属性名":{"description":"描述","baseValue":10,"maxValue":100}},"combatSystem":{"type":"回合制/即时制/混合制","mechanics":["机制"]},"inventory":{"maxSlots":20,"categories":["武器","防具","消耗品","任务物品"]},"levelSystem":{"enabled":true,"maxLevel":50,"xpPerLevel":100},"specialMechanics":["特殊机制"]}',
            '要求：所有内容必须是中文，并与世界观、角色和剧情设定保持一致。'
        ].join('\n\n');

        return this.llm.generateJSON(prompt);
    }

    async generateOpeningScene(gameData) {
        const firstChapter = gameData.mainPlot?.chapters?.[0];
        const prompt = [
            '你是一名专业中文 RPG 编剧。',
            `游戏类型：${gameData.type}`,
            `世界观：${gameData.worldview?.description || ''}`,
            firstChapter ? `第一章信息：${JSON.stringify(firstChapter)}` : '',
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
            '只返回游戏名，不要输出其他内容。'
        ].join('\n');

        const result = await this.llm.generateText(prompt, { maxTokens: 30 });
        return result.trim().replace(/["']/g, '');
    }
}

module.exports = GameFinalizer;
