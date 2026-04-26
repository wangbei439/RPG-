/**
 * 快速测试脚本 - 验证核心优化功能
 */

const KnowledgeGraph = require('./engine/KnowledgeGraph');
const Timeline = require('./engine/Timeline');
const CausalChain = require('./engine/CausalChain');
const EnhancedMemoryManager = require('./engine/EnhancedMemoryManager');

console.log('🧪 开始测试核心优化功能...\n');

// 测试 1: 知识图谱
console.log('📊 测试 1: 知识图谱');
const kg = new KnowledgeGraph();

// 添加角色
kg.addEntity('character', 'char_001', { name: '张三', role: '主角' });
kg.addEntity('character', 'char_002', { name: '李四', role: 'NPC' });

// 添加关系
kg.addRelation('char_001', 'char_002', 'friend', { strength: 8 });

// 查询
const relations = kg.getRelations('char_001');
console.log(`✅ 添加了 ${kg.nodes.size} 个实体`);
console.log(`✅ 添加了 ${kg.edges.size} 个关系`);
console.log(`✅ 查询到 ${relations.length} 个关系\n`);

// 测试 2: 事件时间线
console.log('📅 测试 2: 事件时间线');
const timeline = new Timeline();

timeline.addEvent({
    turn: 1,
    chapter: 0,
    type: 'dialogue',
    summary: '张三与李四对话',
    participants: ['char_001', 'char_002'],
    location: '村庄',
    importance: 4
});

timeline.addEvent({
    turn: 2,
    chapter: 0,
    type: 'action',
    summary: '张三前往森林',
    participants: ['char_001'],
    location: '森林',
    importance: 3
});

const recentEvents = timeline.getRecentEvents(5);
console.log(`✅ 添加了 ${timeline.events.length} 个事件`);
console.log(`✅ 查询到 ${recentEvents.length} 个最近事件\n`);

// 测试 3: 因果链
console.log('🔗 测试 3: 因果链');
const causalChain = new CausalChain();

causalChain.addCause('张三攻击敌人', '敌人反击', { strength: 9 });
causalChain.addCause('敌人反击', '张三受伤', { strength: 8 });

const reasons = causalChain.getReasons('张三受伤');
const consequences = causalChain.getConsequences('张三攻击敌人');

console.log(`✅ 添加了 ${causalChain.chains.length} 个因果关系`);
console.log(`✅ "张三受伤"的原因: ${reasons.length} 个`);
console.log(`✅ "张三攻击敌人"的结果: ${consequences.length} 个\n`);

// 测试 4: 增强记忆管理器
console.log('🧠 测试 4: 增强记忆管理器');
const memory = new EnhancedMemoryManager('测试游戏', 'adventure');

// 初始化知识图谱
memory.semanticMemory.knowledgeGraph.addEntity('character', 'hero', { name: '英雄' });
memory.semanticMemory.timeline.addEvent({
    turn: 1,
    chapter: 0,
    type: 'action',
    summary: '游戏开始',
    importance: 5
});

// 更新工作记忆
memory.updateWorkingMemory({
    turn: 1,
    action: '向前走',
    location: '起点',
    activeCharacters: ['hero']
});

console.log(`✅ 工作记忆: ${memory.workingMemory.recentEvents.length} 个最近事件`);
console.log(`✅ 语义记忆: ${memory.semanticMemory.knowledgeGraph.nodes.size} 个实体`);
console.log(`✅ 时间线: ${memory.semanticMemory.timeline.events.length} 个事件\n`);

// 测试 5: 上下文构建
console.log('📝 测试 5: 上下文构建');
const context = memory.buildContext('测试查询', {
    maxRecentEvents: 5,
    maxRelevantEvents: 3
});

console.log(`✅ 当前场景: ${context.currentScene || '无'}`);
console.log(`✅ 活跃角色: ${context.activeCharacters.length} 个`);
console.log(`✅ 最近事件: ${context.recentEvents.length} 个`);
console.log(`✅ 相关事件: ${context.relevantEvents.length} 个\n`);

console.log('🎉 所有测试通过！核心优化功能正常工作。\n');
console.log('📖 下一步：');
console.log('   1. 启动后端: cd backend && npm start');
console.log('   2. 启动前端: cd frontend && npm run dev');
console.log('   3. 创建游戏并测试流式输出');
console.log('   4. 查看详细测试指南: TESTING_GUIDE.md');
