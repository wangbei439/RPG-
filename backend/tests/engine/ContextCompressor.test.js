const ContextCompressor = require('../../engine/ContextCompressor');
const Timeline = require('../../engine/Timeline');
const KnowledgeGraph = require('../../engine/KnowledgeGraph');

/**
 * 创建模拟的 MemoryManager 对象
 */
function createMockMemoryManager() {
    const timeline = new Timeline();
    const knowledgeGraph = new KnowledgeGraph();

    // 添加一些事件用于压缩器测试
    timeline.addEvent({
        turn: 1, chapter: '第一章', type: 'action',
        summary: '主角进入村庄', importance: 4, participants: ['李明']
    });
    timeline.addEvent({
        turn: 2, chapter: '第一章', type: 'conflict',
        summary: '遭遇敌人袭击', importance: 5, participants: ['李明', '敌人']
    });

    return {
        semanticMemory: {
            knowledgeGraph,
            timeline
        }
    };
}

/**
 * 创建一个典型的游戏上下文
 */
function createTestContext() {
    return {
        turn: 5,
        chapter: {
            id: 'chapter_1',
            title: '初入江湖',
            goal: '找到师父',
            summary: '主角来到小镇寻找失踪的师父',
            description: '主角带着师父留下的信件来到小镇'
        },
        player: {
            name: '李明',
            location: '村庄',
            level: 3,
            stats: { hp: 80 }
        },
        quests: [
            { id: 'q1', name: '寻找师父', completed: false },
            { id: 'q2', name: '收集情报', completed: true }
        ],
        sceneDescription: '村口的老槐树下，几个村民正在低声交谈',
        history: [
            { turn: 1, action: '进入村庄', response: '你来到了宁静的村庄' },
            { turn: 2, action: '与村民交谈', response: '村民告诉你最近有些奇怪' },
            { turn: 3, action: '调查线索', response: '你发现了一些蛛丝马迹' },
            { turn: 4, action: '战斗', response: '你击退了敌人' },
            { turn: 5, action: '休息', response: '你在客栈休息了一夜' },
            { turn: 6, action: '出发', response: '你继续前行' },
            { turn: 7, action: '遭遇伏击', response: '你遭到了伏击' },
            { turn: 8, action: '逃离', response: '你成功逃脱' }
        ],
        characters: [
            {
                id: 'char_1', name: '王芳', role: '伙伴',
                personality: '勇敢、机智、忠诚',
                currentState: '同行'
            },
            {
                id: 'char_2', name: '赵强', role: '对手',
                personality: '阴险、狡猾、冷酷',
                currentState: '敌对'
            }
        ],
        activeCharacters: ['char_1', 'char_2'],
        inventory: [
            { id: 'sword', name: '长剑' },
            { id: 'potion', name: '药水' },
            { id: 'map', name: '地图' }
        ],
        worldview: {
            name: '武侠世界',
            description: '一个充满江湖恩怨的武侠世界，各门各派争夺武林霸主之位。英雄豪杰辈出，恩怨情仇交织。',
            theme: '武侠',
            rules: ['武功招式', '内力系统', '门派关系']
        },
        recalledMemories: ['上次在茶馆听到的消息', '师父留下的线索'],
        action: '调查'
    };
}

describe('ContextCompressor - 智能上下文压缩器', () => {
    let compressor;
    let mockMemory;

    beforeEach(() => {
        mockMemory = createMockMemoryManager();
        compressor = new ContextCompressor(mockMemory);
    });

    describe('compressContext - 三优先级压缩', () => {
        test('应返回包含 core、important、supplementary 三层的压缩结果', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context);

            expect(result.core).toBeDefined();
            expect(result.important).toBeDefined();
            expect(result.supplementary).toBeDefined();
        });

        test('core 层应包含核心状态信息', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context);

            expect(result.core.currentTurn).toBe(5);
            expect(result.core.currentLocation).toBe('村庄');
            expect(result.core.playerName).toBe('李明');
            expect(result.core.playerLevel).toBe(3);
            expect(result.core.playerHP).toBe(80);
        });

        test('core 层应包含未完成的任务', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context);

            expect(result.core.activeQuests).toHaveLength(1);
            expect(result.core.activeQuests[0].name).toBe('寻找师父');
        });

        test('important 层应包含历史和角色信息', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context);

            expect(result.important.recentHistory).toBeDefined();
            expect(result.important.activeCharacters).toBeDefined();
        });

        test('supplementary 层应包含世界观和物品信息', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context);

            expect(result.supplementary.worldview).toBeDefined();
            expect(result.supplementary.inventory).toBeDefined();
        });
    });

    describe('优先级模式 - priorityLevel', () => {
        test('minimal 模式应只保留最少的历史', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context, { priorityLevel: 'minimal' });

            expect(result.important.recentHistory.length).toBeLessThanOrEqual(3);
        });

        test('balanced 模式应保留适中数量的历史', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context, { priorityLevel: 'balanced' });

            expect(result.important.recentHistory.length).toBeLessThanOrEqual(6);
        });

        test('detailed 模式应保留最多数量的历史', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context, { priorityLevel: 'detailed' });

            expect(result.important.recentHistory.length).toBeLessThanOrEqual(10);
        });

        test('minimal 模式不应包含 supplementary 信息', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context, { priorityLevel: 'minimal' });

            expect(result.supplementary).toEqual({});
        });

        test('detailed 模式应包含关系信息', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context, { priorityLevel: 'detailed' });

            expect(result.supplementary.relationships).toBeDefined();
        });
    });

    describe('fitToTokenLimit - Token预算裁剪', () => {
        test('在 token 限制内应保留所有信息', () => {
            const context = createTestContext();
            const result = compressor.compressContext(context, { maxTokens: 100000 });

            expect(result.core).toBeDefined();
            expect(result.important).toBeDefined();
            expect(result.supplementary).toBeDefined();
        });

        test('超出 token 限制应首先移除 supplementary 信息', () => {
            const context = createTestContext();
            // 使用非常小的 token 限制
            const result = compressor.compressContext(context, { maxTokens: 200 });

            // supplementary 应被移除
            expect(result.supplementary).toBeUndefined();
        });

        test('核心内容应始终被保留', () => {
            const context = createTestContext();
            // 使用极小的 token 限制
            const result = compressor.compressContext(context, { maxTokens: 50 });

            expect(result.core).toBeDefined();
            expect(result.core.playerName).toBe('李明');
        });
    });

    describe('extractCore - 核心信息提取', () => {
        test('应提取当前回合和地点', () => {
            const context = createTestContext();
            const core = compressor.extractCore(context);

            expect(core.currentTurn).toBe(5);
            expect(core.currentLocation).toBe('村庄');
        });

        test('应提取玩家核心属性', () => {
            const context = createTestContext();
            const core = compressor.extractCore(context);

            expect(core.playerName).toBe('李明');
            expect(core.playerLevel).toBe(3);
            expect(core.playerHP).toBe(80);
        });

        test('空上下文应不崩溃', () => {
            const core = compressor.extractCore({});
            expect(core).toBeDefined();
            // quests 为 undefined 时 activeQuests 也为 undefined
            expect(core.activeQuests).toBeUndefined();
        });
    });

    describe('formatForPrompt - 格式化为提示文本', () => {
        test('应能将压缩结果格式化为可读文本', () => {
            const context = createTestContext();
            const compressed = compressor.compressContext(context);
            const text = compressor.formatForPrompt(compressed);

            expect(typeof text).toBe('string');
            expect(text).toContain('当前状态');
            expect(text).toContain('李明');
        });

        test('只有 core 信息时也应能格式化', () => {
            const compressed = { core: { currentTurn: 1, currentLocation: '村庄', playerName: '李明', playerLevel: 1 } };
            const text = compressor.formatForPrompt(compressed);
            expect(text).toContain('李明');
        });
    });
});
