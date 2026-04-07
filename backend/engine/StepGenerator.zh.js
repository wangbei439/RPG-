const LLMService = require('../utils/LLMService');
const GameTemplates = require('../templates/GameTemplates');

class StepGenerator {
    constructor() {
        this.llm = new LLMService();
        this.steps = [
            { id: 'worldview', name: '世界观', progress: 10 },
            { id: 'coreCharacters', name: '核心角色', progress: 20 },
            { id: 'secondaryCharacters', name: '次要角色', progress: 30 },
            { id: 'items', name: '物品道具', progress: 40 },
            { id: 'puzzles', name: '谜题挑战', progress: 50 },
            { id: 'mainPlot', name: '主线剧情', progress: 65 },
            { id: 'sidePlots', name: '支线剧情', progress: 75 },
            { id: 'fragments', name: '碎片内容', progress: 85 },
            { id: 'integration', name: '整合方案', progress: 95 }
        ];
    }

    getStepInfo(stepId) {
        return this.steps.find((step) => step.id === stepId);
    }

    getNextStep(stepId) {
        const index = this.steps.findIndex((step) => step.id === stepId);
        return index < this.steps.length - 1 ? this.steps[index + 1] : null;
    }

    getPreviousStep(stepId) {
        const index = this.steps.findIndex((step) => step.id === stepId);
        return index > 0 ? this.steps[index - 1] : null;
    }

    async generateStep(stepId, memory, options = {}) {
        const llmSettings = options.llmSettings || options.config?.settings || options.settings || options.config;
        if (llmSettings) {
            this.llm.initialize(llmSettings);
        }

        const startTime = Date.now();
        const context = memory.buildContextForStep(stepId);
        const template = GameTemplates.getTemplate(context.gameType);
        const candidateCount = options.candidateCount || 2;
        const prompt = this.buildStepPrompt(stepId, context, template);
        const candidates = [];

        for (let index = 0; index < candidateCount; index += 1) {
            const variantPrompt = candidateCount > 1
                ? `${prompt}\n\n请生成与前一个方案明显不同的新方案。这是第 ${index + 1} 个候选。`
                : prompt;
            const rawResult = await this.llm.generateJSON(variantPrompt);
            candidates.push(this.normalizeCandidate(stepId, rawResult));
        }

        return {
            stepId,
            candidates,
            metadata: {
                duration: Date.now() - startTime,
                stepInfo: this.getStepInfo(stepId),
                candidateCount
            }
        };
    }

    async regenerateStep(stepId, memory, userFeedback, options = {}) {
        const llmSettings = options.llmSettings || options.config?.settings || options.config;
        if (llmSettings) {
            this.llm.initialize(llmSettings);
        }

        const context = memory.buildContextForStep(stepId);
        const template = GameTemplates.getTemplate(context.gameType);
        let prompt = this.buildStepPrompt(stepId, context, template);

        prompt += userFeedback
            ? `\n\n用户反馈：${userFeedback}\n请根据反馈重新生成，并保持与已确认内容一致。`
            : '\n\n请重新生成一个风格明显不同但仍然自洽的新方案。';

        const rawResult = await this.llm.generateJSON(prompt);

        return {
            stepId,
            candidates: [this.normalizeCandidate(stepId, rawResult)],
            metadata: {
                stepInfo: this.getStepInfo(stepId),
                regenerated: true
            }
        };
    }

    async modifyElement(stepId, elementId, changes, memory, config) {
        const llmSettings = config?.settings || config;
        if (llmSettings) {
            this.llm.initialize(llmSettings);
        }

        const existingElement = this.findElementInStore(memory.elementStore, stepId, elementId);
        const prompt = [
            '你是一名专业 RPG 设计师，请基于现有内容做精确修改。',
            `当前步骤：${this.getStepInfo(stepId)?.name || stepId}`,
            `当前元素：\n${JSON.stringify(existingElement, null, 2)}`,
            `修改要求：\n${typeof changes === 'string' ? changes : JSON.stringify(changes, null, 2)}`,
            '请只返回修改后的完整 JSON。'
        ].join('\n\n');

        return this.normalizeCandidate(stepId, await this.llm.generateJSON(prompt));
    }

    buildStepPrompt(stepId, context, template) {
        const definition = this.getStepDefinition(stepId, template);
        const sections = [
            '你是一名专业中文 RPG 游戏设计师。',
            '所有描述性内容必须以中文输出，语气自然，不要出现英文标题或英文解释。',
            `当前步骤：${definition.name}`,
            `游戏类型：${context.gameType}`,
            template?.name ? `参考模板：${template.name}` : '',
            template?.description ? `模板特征：${template.description}` : '',
            this.formatBaseContext(context),
            this.formatStructuredContext(context),
            definition.instructions
        ];

        return sections.filter(Boolean).join('\n\n');
    }

    formatBaseContext(context) {
        const sections = [`用户需求：${context.userInput}`];
        if (context.summary) {
            sections.push(`已确认摘要：\n${context.summary}`);
        }
        return sections.join('\n\n');
    }

    formatStructuredContext(context) {
        const structuredContext = {};

        for (const [key, value] of Object.entries(context)) {
            if (['userInput', 'gameType', 'summary', 'confirmedSteps'].includes(key)) {
                continue;
            }
            if (value == null) {
                continue;
            }
            if (Array.isArray(value) && value.length === 0) {
                continue;
            }
            structuredContext[key] = value;
        }

        if (context.confirmedSteps?.length) {
            structuredContext.confirmedSteps = context.confirmedSteps;
        }

        return Object.keys(structuredContext).length > 0
            ? `结构化上下文：\n${JSON.stringify(structuredContext, null, 2)}`
            : '';
    }

    getStepDefinition(stepId, template) {
        const characterCount = template?.characterCount || 5;

        const definitions = {
            worldview: {
                name: '世界观',
                instructions: [
                    '请只返回一个 JSON 对象。',
                    '结构如下：',
                    '{"worldName":"世界名称","description":"详细世界描述","era":"时代背景","factions":[{"name":"势力名称","description":"势力描述","attitude":"友好/中立/敌对"}],"locations":[{"name":"地点名称","description":"地点描述","dangerLevel":1}],"rules":["世界规则"],"atmosphere":"整体氛围","history":"关键历史"}',
                    '要求：设定要有辨识度，地点、势力、规则之间要互相呼应。'
                ].join('\n')
            },
            coreCharacters: {
                name: '核心角色',
                instructions: [
                    `请只返回 JSON 数组，生成 ${Math.max(4, characterCount - 1)} 到 ${characterCount} 名核心角色。`,
                    '[{"id":"core_char_1","name":"角色名","role":"主角/盟友/导师/反派","description":"外观与背景","personality":"性格特点","tone":"说话风格","motivation":"核心动机","stats":{"生命值":{"current":100,"max":100}},"skills":["技能"],"relationship":0,"secrets":["秘密"],"dialogueStyle":"对白风格","goals":["目标"],"items":["初始物品"],"worldConnection":"与世界观的联系"}]',
                    '要求：角色之间必须存在冲突、联盟或依赖关系。'
                ].join('\n')
            },
            secondaryCharacters: {
                name: '次要角色',
                instructions: [
                    '请只返回 JSON 数组，生成 5 到 8 名次要角色。',
                    '[{"id":"sec_char_1","name":"角色名","role":"商人/守卫/村民/学者/流浪者","description":"角色背景","personality":"性格特点","tone":"说话风格","location":"常驻地点","services":["可提供的帮助"],"relationship":0,"secrets":["秘密"],"dialogueStyle":"对白风格","goals":["目标"],"items":["携带物品"],"worldConnection":"与世界的联系","relatedToCoreChars":"与核心角色的关系"}]',
                    '要求：次要角色主要承担补充世界细节与支撑剧情的作用。'
                ].join('\n')
            },
            items: {
                name: '物品道具',
                instructions: [
                    '请只返回 JSON 数组，生成 10 到 15 个物品。',
                    '[{"id":"item_1","name":"物品名","type":"武器/防具/消耗品/任务物品/特殊道具/材料","description":"用途与背景","rarity":"普通/稀有/史诗/传说","stats":{"攻击":5},"effects":["效果"],"relatedTo":"关联人物或地点","acquisition":"获取方式"}]',
                    '要求：物品要服务于世界观、人物关系和剧情推进。'
                ].join('\n')
            },
            puzzles: {
                name: '谜题挑战',
                instructions: [
                    '请只返回 JSON 数组，生成 5 到 8 个谜题或挑战。',
                    '[{"id":"puzzle_1","name":"谜题名","type":"逻辑/机关/战斗/探索/对话","description":"详细描述","location":"发生地点","difficulty":1,"clues":["线索"],"solution":"解法","reward":"奖励","failConsequence":"失败后果","relatedTo":"关联人物或剧情"}]',
                    '要求：难度递进，并与主线或关键地点形成联系。'
                ].join('\n')
            },
            mainPlot: {
                name: '主线剧情',
                instructions: [
                    '请只返回一个 JSON 对象。',
                    '{"title":"主线标题","summary":"剧情概要","theme":"主题","incitingIncident":"引发事件","chapters":[{"id":"chapter_1","name":"章节名","description":"章节内容","goal":"章节目标","characters":["角色ID"],"locations":["地点"],"encounters":[{"type":"combat/dialogue/puzzle/event","description":"遭遇说明"}],"keyDecisions":["关键抉择"],"rewards":["奖励"],"failCondition":"失败条件","ending":"章节结尾","leadsTo":"下一章节"}],"climax":"高潮","resolution":"结局说明","multipleEndings":[{"condition":"达成条件","description":"结局描述"}]}',
                    '要求：必须复用已确认的人物、地点、道具、谜题，不要另起炉灶。'
                ].join('\n')
            },
            sidePlots: {
                name: '支线剧情',
                instructions: [
                    '请只返回 JSON 数组，生成 3 到 5 条支线。',
                    '[{"id":"side_1","name":"支线名","type":"人物支线/探索支线/收集任务/历史揭秘/道德抉择","description":"支线内容","trigger":"触发条件","characters":["角色ID"],"locations":["地点"],"steps":[{"description":"步骤说明","type":"explore/combat/dialogue/puzzle"}],"rewards":["奖励"],"relationToMainPlot":"与主线的联系","optional":true,"ending":"支线结局"}]',
                    '要求：每条支线都要强化主线或角色弧光。'
                ].join('\n')
            },
            fragments: {
                name: '碎片内容',
                instructions: [
                    '请只返回 JSON 数组，生成 5 到 8 条碎片内容。',
                    '[{"id":"frag_1","type":"传说/历史/地点/人物/文化/机制","name":"碎片标题","description":"碎片内容","discoveryMethod":"发现方式","relatedTo":"关联对象","impact":"对体验的价值"}]',
                    '要求：碎片内容要增强沉浸感和探索价值。'
                ].join('\n')
            },
            integration: {
                name: '整合方案',
                instructions: [
                    '请只返回一个 JSON 对象。',
                    '{"gameSystems":{"stats":{"属性名":{"description":"描述","baseValue":10,"maxValue":100}},"combatSystem":{"type":"回合制/即时制/混合制","mechanics":["机制"]},"inventory":{"maxSlots":20,"categories":["武器","防具","消耗品","任务物品"]},"levelSystem":{"enabled":true,"maxLevel":50,"xpPerLevel":100},"specialMechanics":["特殊机制"]},"openingScene":{"description":"开场场景","narration":"开场旁白","initialChoices":[{"text":"选项文本","action":"对应行动"}],"startingLocation":"起始地点","mood":"氛围"},"gameName":"游戏名","gameplayDesign":"整体玩法说明","balancingNotes":"平衡性说明"}',
                    '要求：整合方案必须建立在已确认内容之上，不能重新发明另一套游戏。'
                ].join('\n')
            }
        };

        return definitions[stepId] || {
            name: stepId,
            instructions: '请只返回与当前步骤匹配的 JSON 结构。'
        };
    }

    normalizeCandidate(stepId, rawCandidate) {
        const arraySteps = new Set(['coreCharacters', 'secondaryCharacters', 'items', 'puzzles', 'sidePlots', 'fragments']);

        if (arraySteps.has(stepId)) {
            return this.normalizeArrayCandidate(stepId, rawCandidate);
        }

        return this.normalizeObjectCandidate(stepId, rawCandidate);
    }

    normalizeArrayCandidate(stepId, rawCandidate) {
        if (Array.isArray(rawCandidate)) {
            return rawCandidate;
        }

        const fieldMap = {
            coreCharacters: ['coreCharacters', 'characters', 'items'],
            secondaryCharacters: ['secondaryCharacters', 'characters', 'items'],
            items: ['items', 'equipment', 'list'],
            puzzles: ['puzzles', 'challenges', 'list'],
            sidePlots: ['sidePlots', 'plots', 'list'],
            fragments: ['fragments', 'entries', 'list']
        };

        for (const field of fieldMap[stepId] || []) {
            if (Array.isArray(rawCandidate?.[field])) {
                return rawCandidate[field];
            }
        }

        return rawCandidate ? [rawCandidate] : [];
    }

    normalizeObjectCandidate(stepId, rawCandidate) {
        if (!rawCandidate || Array.isArray(rawCandidate)) {
            return {};
        }

        const fieldMap = {
            worldview: ['worldview'],
            mainPlot: ['mainPlot', 'plot'],
            integration: ['integration']
        };

        for (const field of fieldMap[stepId] || []) {
            if (rawCandidate[field] && typeof rawCandidate[field] === 'object' && !Array.isArray(rawCandidate[field])) {
                return rawCandidate[field];
            }
        }

        return rawCandidate;
    }

    findElementInStore(store, stepId, elementId) {
        const categoryMap = {
            worldview: 'worldview',
            coreCharacters: 'coreCharacters',
            secondaryCharacters: 'secondaryCharacters',
            items: 'items',
            puzzles: 'puzzles',
            mainPlot: 'mainPlot',
            sidePlots: 'sidePlots',
            fragments: 'fragments',
            integration: 'integration'
        };

        const category = categoryMap[stepId];
        if (!category || !store[category]) {
            return null;
        }

        if (Array.isArray(store[category])) {
            return store[category].find((item) => item.id === elementId || item.name === elementId);
        }

        return store[category];
    }
}

module.exports = StepGenerator;
