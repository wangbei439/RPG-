# 叙游工坊 - AI一键生成角色扮演游戏

一个更适合互动叙事工作流的一键式角色扮演游戏生成器。支持多种游戏类型，集成 AI 模型（接口或本地）和图像生成（ComfyUI 或接口）。

## 特性

- 🎮 **10种RPG游戏类型**: 冒险、地牢、恋爱、推理、奇幻、科幻、生存、王国、修仙、自定义
- 🤖 **多AI模型支持**: OpenAI、Anthropic Claude、Ollama本地模型、自定义API
- 🎨 **图像生成**: ComfyUI本地部署或API服务
- 📊 **完整游戏系统**: 属性、物品、任务、章节、多结局
- 💾 **存档系统**: 本地保存和加载游戏进度
- 🌐 **响应式界面**: 支持桌面和移动端

## 快速开始

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd frontend
npm install
```

### 2. 配置API密钥

编辑 `config/default.json` 或在设置界面中配置：

```json
{
  "llmSource": "openai",
  "apiKey": "your-api-key",
  "model": "gpt-4o"
}
```

### 3. 启动服务

```bash
# 后端
cd backend
npm start

# 前端
cd frontend
npm run dev
```

### 4. 访问应用

打开浏览器访问 `http://localhost:5173`

## 游戏类型

| 类型 | 描述 | 特点 |
|------|------|------|
| ⚔️ 冒险RPG | 经典冒险探索 | 开放世界、多分支剧情 |
| 🏰 地牢探索 | 深入地牢寻宝 | 资源管理、永久死亡风险 |
| 💕 恋爱模拟 | 发展浪漫关系 | 好感度系统、多结局 |
| 🔍 推理探案 | 收集线索推理 | 线索板、人物关系图 |
| 🧙 奇幻魔法 | 魔法世界冒险 | 魔法学习、元素相克 |
| 🚀 科幻星际 | 星际旅行探索 | 飞船管理、外星种族 |
| 🏕️ 生存挑战 | 恶劣环境求生 | 资源收集、基地建设 |
| 👑 王国建设 | 管理国家命运 | 朝会决策、大臣互动 |
| 🐉 修仙问道 | 修炼成仙之路 | 境界系统、天劫考验 |
| ✨ 自定义 | 完全自定义 | 自由创造 |

## 架构

```
rpg生成器/
├── backend/
│   ├── engine/
│   │   ├── GameGenerator.js  # 游戏生成引擎
│   │   └── GameEngine.js     # 游戏运行引擎
│   ├── templates/
│   │   └── GameTemplates.js  # 游戏模板
│   ├── utils/
│   │   ├── LLMService.js     # AI模型服务
│   │   └── ImageService.js   # 图像生成服务
│   └── server.js             # 后端服务器
├── frontend/
│   ├── src/
│   │   ├── main.js           # 前端主逻辑
│   │   └── styles/
│   │       └── main.css      # 样式
│   └── index.html            # 主页面
└── config/
    └── default.json          # 默认配置
```

## 工作流程

1. **选择游戏类型** - 从10种RPG类型中选择
2. **配置游戏** - 设置名称、描述、难度等
3. **AI生成** - 多Agent协作生成:
   - 世界观Agent: 构建世界设定
   - 角色Agent: 创建NPC角色
   - 章节Agent: 设计游戏流程
   - 系统Agent: 配置游戏机制
4. **开始游戏** - 实时AI驱动的互动体验
5. **图像生成** - 可选的场景图像生成

## ComfyUI集成

### 本地ComfyUI

1. 安装并启动ComfyUI
2. 在前端设置中配置ComfyUI地址
3. 启用图像生成

### API图像生成

支持任何兼容OpenAI Images API的服务

## 环境变量

```bash
LLM_SOURCE=openai
OPENAI_API_KEY=your-key
OPENAI_MODEL=gpt-4o
PORT=3000
```
