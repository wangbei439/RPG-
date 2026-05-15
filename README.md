# 叙游工坊 - AI一键生成角色扮演游戏

一个基于多步骤协作流水线的角色扮演游戏生成器。用户输入游戏描述，AI按步骤依次生成世界观、角色、剧情、系统等游戏要素，生成后即可开始实时AI驱动的文字冒险。支持10种RPG游戏类型，集成多种AI模型和图像生成方式。

## 特性

### 游戏生成
- 🎮 **10种RPG游戏类型**: 冒险、地牢、恋爱、推理、奇幻、科幻、生存、王国、修仙、自定义
- 🔄 **9步分步生成流水线**: 世界观 → 核心角色 → 次要角色 → 物品道具 → 谜题挑战 → 主线剧情 → 支线剧情 → 碎片内容 → 整合方案
- 📝 **候选方案选择**: 每步生成多个候选方案，用户可选择或要求重新生成
- ✏️ **精细修改**: 支持对已生成的单个元素进行AI辅助修改

### 游戏运行
- 🎲 **D&D风格骰子检定**: 1d20 + 属性修饰 vs 难度等级，大成功/大失败机制
- 🧠 **增强记忆系统**: 工作记忆 + 语义记忆 + 知识图谱 + 因果链，AI能记住前文
- ✅ **一致性验证**: 自动检测AI输出与已确认设定的冲突
- 📦 **上下文智能压缩**: 长对话自动压缩上下文，保证LLM输入质量
- 🔮 **预测引擎**: 预生成下一步选项，提升响应速度
- 💾 **存档系统**: SQLite持久化保存和加载游戏进度
- 🌊 **流式响应**: 支持WebSocket实时流式输出

### 技术架构
- 🤖 **多AI模型支持**: OpenAI、Anthropic Claude、Ollama本地模型、自定义API（兼容OpenAI格式）
- 🎨 **5种图像生成方式**: ComfyUI本地部署 / OpenAI API / Pollinations（免费无需Key） / z-ai-generate / Puter
- 🔐 **JWT认证系统**: 管理员密码登录 + Token认证
- 🛡️ **API限流**: 分级限流（默认/认证/LLM调用）
- 🐳 **Docker一键部署**: docker-compose up 即可运行
- 🌐 **响应式界面**: 支持桌面和移动端

## 快速开始

### 方式一：Docker部署（推荐）

```bash
# 克隆仓库
git clone https://github.com/wangbei439/RPG-.git
cd RPG-

# 设置环境变量
cp .env.example .env
# 编辑 .env 填写必要的配置（见下方环境变量说明）

# 启动
docker-compose up -d

# 访问
# http://localhost:3000
```

### 方式二：本地开发

```bash
# 1. 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 配置API密钥
# 编辑 config/default.json 或在前端设置界面中配置：
{
  "llmSource": "openai",
  "apiKey": "your-api-key",
  "model": "gpt-4o"
}

# 3. 启动后端（同时提供API和静态文件）
cd backend
npm run dev    # 开发模式（nodemon热重载）
# 或
npm start      # 生产模式

# 4. 启动前端开发服务器（仅开发时需要）
cd frontend
npm run dev    # Vite开发服务器，http://localhost:5173
```

> 生产环境下，后端（Express）会同时serve前端静态文件，只需启动后端即可访问 `http://localhost:3000`。

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
RPG-/
├── backend/
│   ├── engine/
│   │   ├── GameGenerator.js      # 一键生成引擎（快速模式）
│   │   ├── GameEngine.js         # 游戏运行引擎（处理玩家行动）
│   │   ├── StepGenerator.js      # 分步生成引擎（9步流水线）
│   │   ├── GameFinalizer.js      # 游戏终稿整理
│   │   ├── MemoryManager.js      # 生成期记忆管理
│   │   ├── EnhancedMemoryManager.js  # 运行期增强记忆
│   │   ├── ConsistencyValidator.js   # 一致性验证器
│   │   ├── ContextCompressor.js     # 上下文压缩器
│   │   ├── PredictiveEngine.js      # 预测引擎
│   │   ├── KnowledgeGraph.js        # 知识图谱
│   │   ├── CausalChain.js           # 因果链
│   │   ├── Timeline.js              # 时间线
│   │   ├── VisualDirector.js        # 视觉导演（场景图提示词）
│   │   ├── AssetManager.js          # 资源管理
│   │   ├── ProjectManager.js        # 项目管理
│   │   ├── ProjectStore.js          # 项目持久化
│   │   ├── StoryParser.js           # 故事解析器
│   │   ├── SmartStoryParser.js      # 智能故事解析器
│   │   └── NovelAdapter.js          # 小说适配器
│   ├── routes/                    # API路由模块
│   │   ├── gameRoutes.js          #   游戏运行
│   │   ├── generateRoutes.js      #   游戏生成
│   │   ├── projectRoutes.js       #   项目管理
│   │   ├── comfyuiRoutes.js       #   ComfyUI相关
│   │   ├── settingsRoutes.js      #   设置
│   │   ├── authRoutes.js          #   认证
│   │   ├── systemRoutes.js        #   系统状态
│   │   ├── phase4Routes.js        #   阶段4功能
│   │   └── helpers.js             #   共享辅助函数
│   ├── middleware/                 # 中间件
│   │   ├── auth.js                #   JWT认证
│   │   ├── rateLimiter.js         #   API限流
│   │   ├── errorHandler.js        #   全局错误处理
│   │   ├── requestId.js           #   请求追踪
│   │   ├── healthCheck.js         #   健康检查
│   │   ├── logger.js              #   日志
│   │   └── validate.js            #   参数校验
│   ├── templates/
│   │   └── GameTemplates.js       # 游戏类型模板
│   ├── utils/
│   │   ├── LLMService.js          # LLM服务（多模型适配）
│   │   ├── ImageService.js        # 图像生成服务（5种方式）
│   │   ├── CacheService.js        # LLM结果缓存
│   │   ├── encryption.js          # 加密工具
│   │   └── ManasDBService.js      # ManasDB向量数据库
│   ├── database.js                # SQLite数据库（better-sqlite3）
│   ├── websocket.js               # WebSocket服务
│   └── server.js                  # 入口（Express + HTTP + WS）
├── frontend/
│   ├── src/
│   │   ├── main.js                # 前端主逻辑
│   │   ├── modules/
│   │   │   ├── game.js            #   游戏运行界面
│   │   │   ├── workbench.js       #   分步生成工作台
│   │   │   ├── home.js            #   首页
│   │   │   ├── phase4.js          #   阶段4功能
│   │   │   ├── saved-games.js     #   存档管理
│   │   │   ├── config.js          #   配置
│   │   │   ├── comfyui.js         #   ComfyUI设置
│   │   │   ├── import.js          #   导入
│   │   │   ├── navigation.js      #   导航
│   │   │   ├── state.js           #   全局状态
│   │   │   └── utils.js           #   工具函数
│   │   └── services/
│   │       ├── api.js             #   API客户端
│   │       ├── websocket.js       #   WebSocket客户端
│   │       ├── settings.js        #   设置服务
│   │       └── toast.js           #   消息提示
│   └── styles/
│       └── main.css               # 样式
├── config/
│   └── default.json               # 默认配置
├── Dockerfile                     # Docker构建
├── docker-compose.yml             # Docker编排
└── start.sh / start.bat           # 一键启动脚本
```

## 生成工作流程

项目提供两种生成模式：

### 快速生成（GameGenerator）

一键输入游戏描述，AI自动依次生成所有要素：

1. **生成世界观** — 世界设定、势力、地点、规则
2. **创建角色** — 基于世界观生成NPC
3. **设计章节** — 规划游戏流程
4. **设计系统** — 属性、战斗、物品、等级
5. **生成开场** — 创建游戏开局场景
6. **平衡优化** — AI优化游戏数值平衡

### 分步生成工作台（StepGenerator + MemoryManager）

逐步生成，每步可预览、选择、修改：

| 步骤 | 内容 | 说明 |
|------|------|------|
| 1. 世界观 | 世界设定、势力、地点 | 整个游戏的基础 |
| 2. 核心角色 | 主角、反派、盟友、导师 | 4-5名，互有关联 |
| 3. 次要角色 | 商人、守卫、村民等 | 5-8名，丰富世界 |
| 4. 物品道具 | 武器、防具、消耗品、任务物品 | 10-15个 |
| 5. 谜题挑战 | 逻辑、机关、战斗、探索 | 5-8个，递进难度 |
| 6. 主线剧情 | 章节、遭遇、关键抉择、多结局 | 复用已确认内容 |
| 7. 支线剧情 | 人物支线、探索支线、收集任务 | 3-5条，强化主线 |
| 8. 碎片内容 | 传说、历史、文化、机制 | 5-8条，增强沉浸感 |
| 9. 整合方案 | 游戏系统、开场场景、游戏名 | 最终整合 |

每步生成2个候选方案供选择，支持重新生成和精细修改。

## 游戏运行机制

开始游戏后，GameEngine 接管实时交互：

- **AI驱动的文字冒险**: 玩家自由输入行动，AI生成旁白、对话、选项
- **骰子检定**: 涉及风险时自动触发1d20骰子检定，结果影响叙事
- **记忆召回**: AI自动检索长期记忆，保证前后一致
- **角色关系追踪**: NPC好感度、情绪、位置实时更新
- **场景图像联动**: 场景变化时自动触发图像生成

## 图像生成配置

支持5种图像生成方式，在前端设置中选择：

| 方式 | 说明 | 是否需要Key |
|------|------|------------|
| ComfyUI | 本地部署，完全控制 | 否（需本地运行） |
| Pollinations | 免费在线生成，开箱即用 | 否 |
| z-ai-generate | 内置AI图片生成 | 否 |
| API | 兼容OpenAI Images API的服务 | 是 |
| Puter | Puter平台 | 否 |

## 环境变量

```bash
# 服务器
PORT=3000
NODE_ENV=production

# 认证
ADMIN_PASSWORD=your-admin-password    # 管理员密码（Docker部署必填）
JWT_SECRET=your-jwt-secret-min-32chars # JWT密钥（Docker部署必填，至少32字符）
AUTH_DISABLED=false                    # 开发模式可设为true禁用认证

# AI模型
LLM_SOURCE=openai                     # openai / anthropic / local / custom
OPENAI_API_KEY=your-key
OPENAI_URL=https://api.openai.com/v1  # 自定义baseURL
OPENAI_MODEL=gpt-4o

# 图像生成
IMAGE_SOURCE=none                     # none / comfyui / api / pollinations / zai / puter
COMFYUI_URL=http://host.docker.internal:8000  # Docker中访问宿主机

# 跨域
CORS_ORIGIN=*                         # 允许的前端域名
```

## 技术栈

- **后端**: Node.js + Express + better-sqlite3 + WebSocket (ws)
- **前端**: 原生JavaScript + Vite
- **AI**: OpenAI SDK（兼容多种模型）/ Anthropic API / Ollama
- **图像**: ComfyUI / Pollinations / z-ai-generate / Puter / OpenAI Images API
- **数据库**: SQLite（better-sqlite3）
- **部署**: Docker + docker-compose
