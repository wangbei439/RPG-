const LLMService = require('../utils/LLMService');
const GameTemplates = require('../templates/GameTemplates');

class GameGenerator {
    constructor() {
        this.llm = new LLMService();
    }

    async generateGame(config, onProgress) {
        this.llm.initialize(config.settings || {});
        const template = GameTemplates.getTemplate(config.type);

        onProgress(10, '正在生成世界观...', '构建游戏世界设定');
        const worldview = await this.generateWorldview(config, template);

        onProgress(25, '正在创建角色...', '设计 NPC 角色与属性');
        const characters = await this.generateCharacters(config, worldview, template);

        onProgress(45, '正在设计章节...', '创建游戏流程与任务');
        const chapters = await this.generateChapters(config, worldview, characters);

        onProgress(65, '正在设计游戏系统...', '配置属性、物品与机制');
        const gameSystems = await this.generateGameSystems(config, worldview);

        onProgress(80, '正在生成开场场景...', '创建游戏开局');
        const openingScene = await this.generateOpeningScene(config, worldview, chapters);

        onProgress(90, '正在整合游戏数据...', '组装完整配置');
        const gameData = {
            id: Date.now().toString(),
            name: config.name || await this.generateGameName(config, worldview),
            type: config.type,
            worldview,
            characters,
            chapters,
            gameSystems,
            openingScene,
            config: {
                difficulty: config.difficulty,
                length: config.length,
                enableImages: config.enableImages
            }
        };

        onProgress(95, '正在优化游戏平衡...', '调整难度和奖励分配');
        await this.balanceGame(gameData);
        onProgress(100, '游戏生成完成');
        return gameData;
    }

    async generateWorldview(config, template) {
        const prompt = [
            '你是一名专业中文 RPG 游戏设计师。',
            `游戏类型：${this.getGameTypeLabel(config.type)}`,
            `游戏描述：${config.description || '无'}`,
            `难度：${this.getDifficultyLabel(config.difficulty)}`,
            `游戏长度：${this.getLengthLabel(config.length)}`,
            template?.name ? `参考模板：${template.name}` : '',
            '请只返回 JSON：',
            '{"worldName":"世界名称","description":"世界详细描述","era":"时代背景","factions":[{"name":"势力名称","description":"势力描述","attitude":"友好/中立/敌对"}],"locations":[{"name":"地点名称","description":"地点描述","dangerLevel":1}],"rules":["世界规则"],"atmosphere":"整体氛围","history":"关键历史"}'
        ].filter(Boolean).join('\n\n');
        return this.llm.generateJSON(prompt);
    }

    async generateCharacters(config, worldview, template) {
        const characterCount = template.characterCount || 5;
        const prompt = [
            '你是一名专业中文 RPG 游戏设计师。',
            `请基于以下世界观生成 ${characterCount} 名角色。`,
            `世界观：${JSON.stringify(worldview)}`,
            `游戏类型：${this.getGameTypeLabel(config.type)}`,
            '请只返回 JSON 数组：',
            '[{"id":"char_1","name":"角色名","role":"角色定位","description":"角色背景","personality":"性格特点","tone":"说话风格","stats":{"生命值":{"current":100,"max":100}},"skills":["技能"],"relationship":0,"secrets":["秘密"],"goals":["目标"],"items":["初始物品"]}]'
        ].join('\n\n');
        const result = await this.llm.generateJSON(prompt);
        return Array.isArray(result) ? result : [];
    }

    async generateChapters(config, worldview, characters) {
        const chapterCount = config.length === 'short' ? 3 : config.length === 'medium' ? 5 : 8;
        const prompt = [
            '你是一名专业中文 RPG 游戏设计师。',
            `请生成 ${chapterCount} 个章节。`,
            `世界观：${JSON.stringify(worldview)}`,
            `角色概览：${JSON.stringify((characters || []).map((c) => ({ name: c.name, role: c.role })))}`,
            `游戏类型：${this.getGameTypeLabel(config.type)}`,
            `难度：${this.getDifficultyLabel(config.difficulty)}`,
            '请只返回 JSON 数组：',
            '[{"id":"chapter_1","name":"章节名称","description":"章节内容","goal":"章节目标","failCondition":"失败条件","locations":["地点"],"characters":["角色ID"],"encounters":[{"type":"战斗/对话/谜题/事件","description":"遭遇说明"}],"rewards":["奖励"],"ending":"章节结尾"}]'
        ].join('\n\n');
        const result = await this.llm.generateJSON(prompt);
        return Array.isArray(result) ? result : [];
    }

    async generateGameSystems(config, worldview) {
        const prompt = [
            '你是一名专业中文 RPG 系统设计师。',
            `游戏类型：${this.getGameTypeLabel(config.type)}`,
            `世界观：${JSON.stringify(worldview)}`,
            '请只返回 JSON：',
            '{"stats":{"属性名":{"description":"描述","baseValue":10,"maxValue":100}},"combatSystem":{"type":"回合制/即时制/混合制","mechanics":["机制"]},"inventory":{"maxSlots":20,"categories":["武器","防具","消耗品","任务物品"]},"levelSystem":{"enabled":true,"maxLevel":50,"xpPerLevel":100},"specialMechanics":["特殊机制"]}'
        ].join('\n\n');
        return this.llm.generateJSON(prompt);
    }

    async generateOpeningScene(config, worldview, chapters) {
        const prompt = [
            '你是一名专业中文 RPG 编剧。',
            `游戏类型：${this.getGameTypeLabel(config.type)}`,
            `世界观：${worldview?.description || ''}`,
            `第一章：${JSON.stringify((chapters || [])[0] || {})}`,
            '请只返回 JSON：',
            '{"description":"开场场景描述","narration":"开场旁白","initialChoices":[{"text":"选项文本","action":"对应行动"}],"startingLocation":"起始地点","mood":"场景氛围"}'
        ].join('\n\n');
        return this.llm.generateJSON(prompt);
    }

    async generateGameName(config, worldview) {
        const prompt = [
            '请根据以下信息生成一个简洁有辨识度的中文游戏名。',
            `世界观：${worldview?.description || ''}`,
            `类型：${this.getGameTypeLabel(config.type)}`,
            '只返回游戏名。'
        ].join('\n');
        const result = await this.llm.generateText(prompt, { maxTokens: 30 });
        return result.trim().replace(/["']/g, '');
    }

    async balanceGame(gameData) {
        const prompt = [
            '你是一名专业游戏平衡设计师。',
            '请在保持设定不变的前提下，优化以下游戏数据平衡性。',
            JSON.stringify(gameData, null, 2),
            '只返回优化后的完整 JSON。'
        ].join('\n\n');
        const result = await this.llm.generateJSON(prompt);
        return Object.assign(gameData, result);
    }

    getGameTypeLabel(type) {
        const labels = {
            adventure: '冒险 RPG', dungeon: '地牢探索', romance: '恋爱模拟',
            mystery: '推理解谜', fantasy: '奇幻魔法', scifi: '科幻星际',
            survival: '生存挑战', kingdom: '王国建设', cultivation: '修仙问道',
            custom: '自定义 RPG'
        };
        return labels[type] || type || '自定义 RPG';
    }

    getDifficultyLabel(difficulty) {
        const labels = { easy: '简单', normal: '普通', hard: '困难', nightmare: '噩梦' };
        return labels[difficulty] || difficulty || '普通';
    }

    getLengthLabel(length) {
        const labels = { short: '短篇', medium: '中篇', long: '长篇' };
        return labels[length] || length || '中篇';
    }
}

module.exports = GameGenerator;