# ManasDB 可选集成说明

## 📋 概述

ManasDB 是一个可选的记忆服务集成，用于为 RPG 生成器提供智能记忆管理功能。

**特点**:
- ✅ 完全不影响原有代码逻辑
- ✅ 按需启用/禁用
- ✅ 支持向量检索
- ✅ 支持分类存储
- ✅ 可扩展（可替换为 Qdrant 等数据库）

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd E:\rpg生成器\backend
npm install @manasdb/core
```

已完成 ✅

### 2. 配置

编辑 `manasdb-config.json`:

```json
{
  "enabled": true,           // 是否启用（true/false）
  "namespace": "rpg-generator",  // 命名空间
  "embeddingModel": "all-MiniLM-L6-v2"  // 嵌入模型
}
```

### 3. 使用示例

```javascript
const ManasDBService = require('./utils/ManasDBService');
const config = require('./manasdb-config.json');

// 初始化服务
const memoryService = new ManasDBService({
    enabled: config.enabled,
    namespace: config.namespace
});

// 保存记忆
await memoryService.saveMemory('character:player1', {
    name: '勇者',
    class: '战士',
    level: 10
});

// 检索记忆
const result = await memoryService.retrieveMemory('勇者');
console.log(result.results);
```

---

## 📖 API 文档

### `new ManasDBService(options)`

初始化记忆服务。

**参数**:
- `options.enabled` (boolean) - 是否启用，默认 true
- `options.namespace` (string) - 命名空间，默认 'rpg-generator'
- `options.embeddingModel` (string) - 嵌入模型，默认 'all-MiniLM-L6-v2'

### `saveMemory(key, value, metadata)`

保存单条记忆。

**参数**:
- `key` (string) - 记忆键
- `value` (any) - 记忆值
- `metadata` (object) - 元数据

**返回**: `{ success: boolean, error?: string }`

### `retrieveMemory(query, options)`

检索记忆。

**参数**:
- `query` (string) - 检索查询
- `options.limit` (number) - 返回数量限制，默认 5
- `options.filter` (object) - 筛选条件

**返回**: `{ success: boolean, results: Array<{key, value, score, metadata}> }`

### `saveMemories(entries)`

批量保存记忆。

**参数**:
- `entries` (Array<{key, value, metadata}>) - 记忆条目数组

**返回**: `{ success: boolean, count?: number, error?: string }`

### `clearNamespace()`

清空命名空间。

**返回**: `{ success: boolean, error?: string }`

### `getStatus()`

获取服务状态。

**返回**: `{ enabled, namespace, model }`

---

## 💡 使用场景

### 场景 1: 保存游戏角色

```javascript
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
```

### 场景 2: 检索相关剧情

```javascript
const result = await memoryService.retrieveMemory('森林 冒险', {
    limit: 3,
    filter: { type: 'plot' }
});

result.results.forEach(item => {
    console.log(`${item.score.toFixed(4)} - ${item.key}`);
    console.log(item.value);
});
```

### 场景 3: 批量保存关卡元素

```javascript
const entries = level.elements.map((elem, idx) => ({
    key: `level:${levelId}:element:${idx}`,
    value: elem,
    metadata: { type: 'element', levelId }
}));

await memoryService.saveMemories(entries);
```

### 场景 4: 在游戏生成后保存记忆

```javascript
// 在 GameFinalizer 中添加
const memoryService = new ManasDBService();
await memoryService.saveMemory(`game:${gameId}`, gameData, {
    type: 'game',
    createdAt: new Date().toISOString()
});
```

---

## 🔧 高级用法

### 自定义嵌入模型

```javascript
const memoryService = new ManasDBService({
    enabled: true,
    embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2'
});
```

### 结合原有 MemoryManager

```javascript
// 原有 MemoryManager 继续工作
const memoryManager = new MemoryManager(userInput, gameType);

// ManasDB 作为可选的增强层
const memoryService = new ManasDBService();

// 需要时检索记忆
const result = await memoryService.retrieveMemory('关键剧情');
```

---

## 📊 性能优化建议

1. **批量操作**: 使用 `saveMemories` 代替多次 `saveMemory`
2. **合理设置 limit**: 检索时限制返回数量
3. **使用 filter**: 根据类型、游戏等筛选
4. **定期清理**: 使用 `clearNamespace` 清理旧数据

---

## 🐛 故障排除

### ManasDB 未启用

**症状**: 调用 API 返回 `{ success: false, reason: 'ManasDB 未启用' }`

**解决**: 检查 `manasdb-config.json` 中的 `enabled` 是否为 `true`

### 嵌入模型下载失败

**症状**: 初始化时出错

**解决**:
1. 检查网络连接
2. 手动下载模型到 `~/.cache/torch/sentence_transformers/`
3. 或使用本地模型路径

---

## 📝 注意事项

- ManasDB 使用内存存储，重启服务后数据会丢失
- 生产环境建议替换为 Qdrant、Pinecone 等持久化存储
- 当前版本使用 `all-MiniLM-L6-v2` 模型，首次运行会自动下载
- 命名空间隔离不同游戏的数据

---

## 📚 相关文件

- `utils/ManasDBService.js` - 核心服务模块
- `utils/ManasDBService.example.js` - 使用示例
- `manasdb-config.json` - 配置文件

---

## 🔄 未来计划

- [ ] 支持 Qdrant 本地部署
- [ ] 持久化存储支持
- [ ] 记忆版本管理
- [ ] 跨会话记忆共享
