/**
 * ManasDB 使用示例
 * 展示如何在你原有的代码中按需使用 ManasDB
 */

const ManasDBService = require('./ManasDBService');
const config = require('../manasdb-config.json');

// 1. 初始化服务
const memoryService = new ManasDBService({
    enabled: config.enabled,
    namespace: config.namespace,
    embeddingModel: config.embeddingModel
});

// 2. 保存记忆示例
async function exampleSaveMemory() {
    // 保存角色信息
    await memoryService.saveMemory(
        'character:player1',
        {
            name: '勇者',
            class: '战士',
            level: 10,
            stats: { strength: 20, intelligence: 12 }
        },
        { type: 'character', game: 'rpg-generator' }
    );

    // 保存剧情节点
    await memoryService.saveMemory(
        'plot:chapter1',
        {
            chapter: 1,
            title: '勇者出发',
            summary: '勇者从村庄出发，踏上冒险之旅...',
            choices: ['去森林', '去城堡', '回村庄']
        },
        { type: 'plot', game: 'rpg-generator' }
    );
}

// 3. 检索记忆示例
async function exampleRetrieveMemory() {
    // 根据关键词检索
    const result = await memoryService.retrieveMemory('勇者 出发');

    if (result.success) {
        console.log('找到相关记忆:');
        result.results.forEach(item => {
            console.log(`- [${item.score.toFixed(4)}] ${item.key}`);
            console.log(`  内容: ${JSON.stringify(item.value).substring(0, 100)}...`);
        });
    }

    // 根据类型筛选
    const characterResult = await memoryService.retrieveMemory('勇者', {
        limit: 3,
        filter: { type: 'character' }
    });
}

// 4. 批量保存示例
async function exampleBatchSave() {
    const entries = [
        {
            key: 'world:setting',
            value: '奇幻世界，魔法与剑的时代',
            metadata: { type: 'world', game: 'rpg-generator' }
        },
        {
            key: 'item:sword',
            value: '传说之剑，可以斩断一切',
            metadata: { type: 'item', game: 'rpg-generator' }
        },
        {
            key: 'enemy:dragon',
            value: '火龙，守护着宝藏',
            metadata: { type: 'enemy', game: 'rpg-generator' }
        }
    ];

    const result = await memoryService.saveMemories(entries);
    console.log(`成功保存 ${result.count} 条记忆`);
}

// 5. 获取状态示例
async function exampleGetStatus() {
    const status = memoryService.getStatus();
    console.log('ManasDB 状态:', status);

    // 检查是否启用
    if (status.enabled) {
        console.log('✅ ManasDB 已启用');
    } else {
        console.log('❌ ManasDB 未启用');
    }
}

// 6. 在游戏生成后保存记忆
async function saveGameToMemory(gameData) {
    await memoryService.saveMemory(
        `game:${gameData.id}`,
        gameData,
        {
            type: 'game',
            createdAt: new Date().toISOString()
        }
    );

    // 保存关键元素
    await memoryService.saveMemories(
        gameData.characters.map((char, idx) => ({
            key: `character:game${gameData.id}:${idx}`,
            value: char,
            metadata: { type: 'character', gameId: gameData.id }
        }))
    );
}

// 7. 在游戏进行时检索相关记忆
async function retrieveRelevantMemory(context, query) {
    const result = await memoryService.retrieveMemory(query, {
        limit: 3,
        filter: { type: context.type }
    });

    return result.results;
}

// 运行示例
async function runExamples() {
    console.log('=== ManasDB 使用示例 ===\n');

    // 示例 1: 保存记忆
    console.log('1. 保存记忆...');
    await exampleSaveMemory();

    // 示例 2: 检索记忆
    console.log('\n2. 检索记忆...');
    await exampleRetrieveMemory();

    // 示例 3: 批量保存
    console.log('\n3. 批量保存...');
    await exampleBatchSave();

    // 示例 4: 获取状态
    console.log('\n4. 获取状态...');
    await exampleGetStatus();

    console.log('\n=== 示例完成 ===');
}

// 如果需要单独测试
if (require.main === module) {
    runExamples().catch(console.error);
}

module.exports = {
    memoryService,
    exampleSaveMemory,
    exampleRetrieveMemory,
    exampleBatchSave,
    exampleGetStatus,
    saveGameToMemory,
    retrieveRelevantMemory
};
