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

        onProgress(25, '正在创建角色...', '设计NPC角色和属性');
        const characters = await this.generateCharacters(config, worldview, template);

        onProgress(45, '正在设计章节...', '创建游戏流程和任务');
        const chapters = await this.generateChapters(config, worldview, characters, template);

        onProgress(65, '正在设计游戏系统...', '配置属性、物品和技能');
        const gameSystems = await this.generateGameSystems(config, worldview, template);

        onProgress(80, '正在生成初始场景...', '创建游戏开场');
        const openingScene = await this.generateOpeningScene(config, worldview, characters, chapters);

        onProgress(90, '正在整合游戏数据...', '组装完整游戏配置');
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

        onProgress(95, '正在优化游戏平衡...', '调整难度和奖励');
        await this.balanceGame(gameData);

        onProgress(100, '游戏生成完成！');
        return gameData;
    }

    async generateWorldview(config, template) {
        const prompt = `
你是一个专业的RPG游戏设计师。请根据以下信息生成详细的世界观设定：

游戏类型: ${config.type}
游戏描述: ${config.description || '无'}
难度: ${config.difficulty}
游戏长度: ${config.length}

参考模板: ${template.name}

请生成以下JSON格式的世界观设定（只返回JSON，不要其他内容）：
{
    "worldName": "世界名称",
    "description": "世界详细描述，包括地理、历史、文化等",
    "era": "时代背景",
    "factions": [{"name": "势力名称", "description": "势力描述", "attitude": "友好/中立/敌对"}],
    "locations": [{"name": "地点名称", "description": "地点描述", "dangerLevel": 1-5}],
    "rules": ["世界规则1", "世界规则2"],
    "atmosphere": "整体氛围描述"
}
`;
        const result = await this.llm.generateJSON(prompt);
        return result;
    }

    async generateCharacters(config, worldview, template) {
        const characterCount = template.characterCount || 5;
        const prompt = `
你是一个专业的RPG游戏设计师。请根据以下世界观生成${characterCount}个NPC角色：

世界观: ${JSON.stringify(worldview)}
游戏类型: ${config.type}
游戏描述: ${config.description || '无'}

请生成以下JSON格式的角色列表（只返回JSON数组）：
[{
    "id": "char_1",
    "name": "角色名称",
    "role": "角色定位(盟友/敌人/商人/导师等)",
    "description": "角色外观和背景描述",
    "personality": "性格特点",
    "tone": "说话风格",
    "stats": {"生命值": {"current": 100, "max": 100}, "攻击力": 10, "防御力": 10},
    "skills": ["技能1", "技能2"],
    "relationship": 0,
    "secrets": ["秘密1"],
    "dialogueStyle": "对话风格描述",
    "goals": ["角色目标1"],
    "items": ["初始物品1"]
}]
`;
        const result = await this.llm.generateJSON(prompt);
        return Array.isArray(result) ? result : [];
    }

    async generateChapters(config, worldview, characters, template) {
        const chapterCount = config.length === 'short' ? 3 : config.length === 'medium' ? 5 : 8;
        const prompt = `
你是一个专业的RPG游戏设计师。请根据以下信息生成${chapterCount}个游戏章节：

世界观: ${JSON.stringify(worldview)}
角色: ${JSON.stringify(characters.map(c => ({ name: c.name, role: c.role })))}
游戏类型: ${config.type}
难度: ${config.difficulty}

请生成以下JSON格式的章节列表（只返回JSON数组）：
[{
    "id": "chapter_1",
    "name": "章节名称",
    "description": "章节背景故事",
    "goal": "章节主要目标",
    "failCondition": "失败条件",
    "locations": ["涉及地点"],
    "characters": ["参与角色ID"],
    "encounters": [{"type": "combat/dialogue/puzzle/event", "description": "遭遇描述"}],
    "rewards": ["奖励物品或经验"],
    "ending": "章节结束描述"
}]
`;
        const result = await this.llm.generateJSON(prompt);
        return Array.isArray(result) ? result : [];
    }

    async generateGameSystems(config, worldview, template) {
        const prompt = `
你是一个专业的RPG游戏设计师。请根据以下信息设计游戏系统：

游戏类型: ${config.type}
世界观: ${JSON.stringify(worldview)}

请生成以下JSON格式的游戏系统配置（只返回JSON）：
{
    "stats": {"属性名称": {"description": "描述", "baseValue": 数值, "maxValue": 数值}},
    "combatSystem": {
        "type": "回合制/即时/混合",
        "mechanics": ["战斗机制1", "战斗机制2"]
    },
    "inventory": {
        "maxSlots": 20,
        "categories": ["武器", "防具", "消耗品", "任务物品"]
    },
    "levelSystem": {
        "enabled": true,
        "maxLevel": 数值,
        "xpPerLevel": 每级所需经验
    },
    "specialMechanics": ["特殊机制1", "特殊机制2"]
}
`;
        const result = await this.llm.generateJSON(prompt);
        return result;
    }

    async generateOpeningScene(config, worldview, characters, chapters) {
        const prompt = `
你是一个专业的RPG游戏设计师。请为以下游戏生成开场场景：

游戏类型: ${config.type}
世界观: ${worldview.description}
第一章: ${JSON.stringify(chapters[0])}

请生成以下JSON格式的开场场景（只返回JSON）：
{
    "description": "开场场景的详细描述",
    "narration": "旁白开场白",
    "initialChoices": [{"text": "选项文本", "action": "对应行动"}],
    "startingLocation": "起始地点",
    "mood": "氛围描述"
}
`;
        const result = await this.llm.generateJSON(prompt);
        return result;
    }

    async generateGameName(config, worldview) {
        const prompt = `根据以下世界观，为这个RPG游戏生成一个吸引人的中文游戏名称（只返回名称，不要其他内容）：
世界观: ${worldview.description}
类型: ${config.type}`;
        const result = await this.llm.generateText(prompt, { maxTokens: 30 });
        return result.trim().replace(/["']/g, '');
    }

    async balanceGame(gameData) {
        const prompt = `
你是一个专业的游戏平衡设计师。请检查并优化以下游戏数据的平衡性：

${JSON.stringify(gameData, null, 2)}

请返回优化后的完整JSON（只返回JSON）：
- 确保角色属性与难度匹配
- 确保任务奖励合理
- 确保战斗难度渐进
`;
        const result = await this.llm.generateJSON(prompt);
        return Object.assign(gameData, result);
    }
}

module.exports = GameGenerator;
