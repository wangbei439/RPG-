const LLMService = require('../utils/LLMService');
const EnhancedMemoryManager = require('./EnhancedMemoryManager');
const ConsistencyValidator = require('./ConsistencyValidator');
const ContextCompressor = require('./ContextCompressor');
const PredictiveEngine = require('./PredictiveEngine');

class GameEngine {
    constructor(gameData, config, services = {}) {
        this.gameData = gameData;
        this.config = config;
        this.llm = new LLMService();
        this.state = null;
        this.gameId = services.gameId || gameData?.id || null;
        this.memoryService = services.memoryService || null;
        this.memoryBootstrapped = false;

        // 新增：增强记忆系统
        this.enhancedMemory = new EnhancedMemoryManager(
            gameData?.name || '未命名游戏',
            gameData?.type || 'custom',
            { seedData: gameData }
        );

        // 新增：一致性验证器
        this.validator = new ConsistencyValidator(this.enhancedMemory);
        this.validator.initializeDefaultRules();

        // 新增：上下文压缩器
        this.compressor = new ContextCompressor(this.enhancedMemory);

        // 新增：预测引擎
        this.predictiveEngine = new PredictiveEngine(this);
    }

    async restore(state) {
        if (this.config?.settings?.llmSource) {
            this.llm.initialize(this.config.settings);
        }
        this.state = await this.normalizeRestoredState(state);
        if (this.state) {
            this.state.visualDirectives = this.state.visualDirectives || this.buildVisualDirectives({});
            this.state.visualState = this.buildVisualState();
        }
        await this.ensureMemoryBootstrap();
        return this.state;
    }

    async start() {
        if (this.config?.settings?.llmSource) {
            this.llm.initialize(this.config.settings);
        }
        this.state = this.createInitialState();
        this.state.visualDirectives = this.buildVisualDirectives({});
        this.state.visualState = this.buildVisualState();

        // 初始化增强记忆系统
        this.enhancedMemory.initializeFromGameData(this.gameData);

        await this.ensureMemoryBootstrap();
        return this.state;
    }

    createInitialState() {
        const opening = this.gameData.openingScene || {};
        const firstChapter = this.gameData.chapters?.[0] || {};

        return {
            id: this.gameData.id,
            name: this.gameData.name,
            currentChapter: 0,
            currentScene: 'opening',
            turn: 0,
            player: {
                name: '冒险者',
                level: 1,
                xp: 0,
                stats: this.initializePlayerStats(),
                location: opening.startingLocation || '起始地点',
                emotion: '平静'
            },
            inventory: [],
            quests: firstChapter.goal ? [{
                id: 'main_quest_1',
                name: firstChapter.goal,
                description: firstChapter.description || firstChapter.goal,
                completed: false,
                main: true
            }] : [],
            characterStates: this.initializeCharacterStates(),
            worldState: {
                time: '白天',
                weather: '晴朗',
                events: []
            },
            history: [],
            sceneDescription: opening.description || '',
            initialLog: opening.narration || '',
            gameOver: false,
            visualDirectives: null,
            visualState: null
        };
    }

    async normalizeRestoredState(state) {
        if (!state || typeof state !== 'object') {
            return null;
        }

        if (state.player || state.playerState) {
            const nextState = this.createInitialState();
            const snapshot = JSON.parse(JSON.stringify(state));

            if (snapshot.player) {
                return {
                    ...nextState,
                    ...snapshot,
                    player: {
                        ...nextState.player,
                        ...(snapshot.player || {})
                    },
                    worldState: {
                        ...nextState.worldState,
                        ...(snapshot.worldState || {})
                    },
                    inventory: Array.isArray(snapshot.inventory) ? snapshot.inventory : nextState.inventory,
                    quests: Array.isArray(snapshot.quests)
                        ? snapshot.quests
                        : Array.isArray(snapshot.activeQuests)
                            ? snapshot.activeQuests
                            : nextState.quests,
                    characterStates: Array.isArray(snapshot.characterStates)
                        ? snapshot.characterStates
                        : Array.isArray(snapshot.relationshipState)
                            ? snapshot.relationshipState
                            : nextState.characterStates,
                    history: Array.isArray(snapshot.history) ? snapshot.history : nextState.history
                };
            }

            return {
                ...nextState,
                currentChapter: snapshot.chapterId ?? nextState.currentChapter,
                currentScene: snapshot.sceneNodeId || nextState.currentScene,
                turn: snapshot.plotBeatId ?? nextState.turn,
                player: {
                    ...nextState.player,
                    ...(snapshot.playerState || {})
                },
                worldState: {
                    ...nextState.worldState,
                    ...(snapshot.worldState || {})
                },
                inventory: Array.isArray(snapshot.inventory) ? snapshot.inventory : nextState.inventory,
                quests: Array.isArray(snapshot.activeQuests) ? snapshot.activeQuests : nextState.quests,
                characterStates: Array.isArray(snapshot.relationshipState)
                    ? snapshot.relationshipState
                    : nextState.characterStates,
                visualState: snapshot.visualState || null,
                history: Array.isArray(snapshot.history) ? snapshot.history : nextState.history
            };
        }

        return JSON.parse(JSON.stringify(state));
    }

    async processAction(action) {
        if (this.state.gameOver) {
            return { response: '游戏已经结束。', gameState: this.state };
        }

        this.state.turn += 1;
        this.state.history.push({ turn: this.state.turn, action });

        // 更新工作记忆
        this.enhancedMemory.updateWorkingMemory({
            turn: this.state.turn,
            action,
            location: this.state.player.location,
            activeCharacters: this.getActiveCharacters()
        });

        const previousVisualState = this.cloneVisualState(this.state.visualState);
        const context = await this.buildEnhancedContext(action);

        // 使用智能压缩
        const compressedContext = this.compressor.compressContext(context, {
            maxTokens: 4000,
            priorityLevel: 'balanced'
        });

        const prompt = this.buildGamePrompt(compressedContext, action);
        const result = await this.llm.generateJSON(prompt);

        // 一致性验证
        const validation = this.validator.validate(result, context);
        if (!validation.isValid && validation.errors.length > 0) {
            console.warn('一致性验证失败:', validation.errors);
            // 可以选择重新生成或修正
        }

        this.updateState(result);

        // 更新语义记忆
        this.updateSemanticMemory(action, result);

        this.state.visualState = this.buildVisualState();

        const choices = Array.isArray(result.choices) ? result.choices : [];
        const response = result.narration || result.response || '故事继续推进。';
        const visualSceneChanged = this.hasVisualSceneChanged(previousVisualState, this.state.visualState);
        this.updateLatestHistoryEntry(response);

        await Promise.all([
            this.persistTurnMemory(action, response, result),
            this.maybePersistTurnSummary(response, result)
        ]);

        // 预生成下一步选项
        if (choices.length > 0) {
            this.predictiveEngine.pregenerateChoices(this.state, choices).catch(err => {
                console.error('预生成失败:', err);
            });
        }

        return {
            response,
            choices,
            gameState: this.state,
            sceneDescription: this.state.sceneDescription,
            visualState: this.state.visualState,
            visualSceneChanged,
            gameOver: this.state.gameOver,
            gameOverMessage: this.state.gameOverMessage,
            recalledMemories: context.recalledMemories || [],
            validation: validation.isValid ? null : validation
        };
    }

    /**
     * 流式处理动作（新增）
     */
    async processActionStreaming(action, onChunk) {
        if (this.state.gameOver) {
            onChunk({ type: 'complete', response: '游戏已经结束。', gameState: this.state });
            return;
        }

        this.state.turn += 1;
        this.state.history.push({ turn: this.state.turn, action });

        // 检查是否有预生成的结果
        const predicted = this.predictiveEngine.getPrediction(action);
        if (predicted) {
            console.log('使用预生成结果');
            // 直接返回预生成的结果（模拟流式输出）
            const response = predicted.response;
            for (let i = 0; i < response.length; i += 10) {
                onChunk({
                    type: 'narration',
                    text: response.slice(i, i + 10),
                    complete: false
                });
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            onChunk({
                type: 'complete',
                choices: predicted.choices,
                gameState: predicted.gameState
            });
            this.state = predicted.gameState;
            return;
        }

        // 更新工作记忆
        this.enhancedMemory.updateWorkingMemory({
            turn: this.state.turn,
            action,
            location: this.state.player.location,
            activeCharacters: this.getActiveCharacters()
        });

        const previousVisualState = this.cloneVisualState(this.state.visualState);
        const context = await this.buildEnhancedContext(action);

        // 使用智能压缩
        const compressedContext = this.compressor.compressContext(context, {
            maxTokens: 4000,
            priorityLevel: 'balanced'
        });

        const prompt = this.buildGamePrompt(compressedContext, action);

        let fullResult = null;

        // 流式生成
        await this.llm.generateJSONStreaming(prompt, (partialResult) => {
            if (partialResult.narration) {
                onChunk({
                    type: 'narration',
                    text: partialResult.narration,
                    complete: false
                });
            }
            fullResult = partialResult;
        });

        if (!fullResult) {
            throw new Error('流式生成失败');
        }

        // 一致性验证
        const validation = this.validator.validate(fullResult, context);
        if (!validation.isValid && validation.errors.length > 0) {
            console.warn('一致性验证失败:', validation.errors);
        }

        this.updateState(fullResult);

        // 更新语义记忆
        this.updateSemanticMemory(action, fullResult);

        this.state.visualState = this.buildVisualState();

        const choices = Array.isArray(fullResult.choices) ? fullResult.choices : [];
        const response = fullResult.narration || fullResult.response || '故事继续推进。';
        const visualSceneChanged = this.hasVisualSceneChanged(previousVisualState, this.state.visualState);
        this.updateLatestHistoryEntry(response);

        await Promise.all([
            this.persistTurnMemory(action, response, fullResult),
            this.maybePersistTurnSummary(response, fullResult)
        ]);

        // 预生成下一步选项
        if (choices.length > 0) {
            this.predictiveEngine.pregenerateChoices(this.state, choices).catch(err => {
                console.error('预生成失败:', err);
            });
        }

        // 发送完成信号
        onChunk({
            type: 'complete',
            choices,
            gameState: this.state,
            sceneDescription: this.state.sceneDescription,
            visualState: this.state.visualState,
            visualSceneChanged,
            gameOver: this.state.gameOver,
            gameOverMessage: this.state.gameOverMessage,
            validation: validation.isValid ? null : validation
        });
    }

    async buildContext(action) {
        const chapter = this.gameData.chapters?.[this.state.currentChapter] || null;
        const worldview = this.gameData.worldview || {};
        const characters = this.gameData.characters || [];
        const [recalledMemories, graphFacts] = await Promise.all([
            this.retrieveRelevantMemories(action),
            this.retrieveRelevantGraphFacts(action)
        ]);

        return {
            turn: this.state.turn,
            chapter,
            worldview,
            characters,
            player: this.state.player,
            inventory: this.state.inventory,
            quests: this.state.quests,
            characterStates: this.state.characterStates,
            worldState: this.state.worldState,
            history: this.state.history.slice(-6),
            action,
            recalledMemories,
            graphFacts
        };
    }

    /**
     * 构建增强上下文（使用增强记忆系统）
     */
    async buildEnhancedContext(action) {
        const basicContext = await this.buildContext(action);

        // 从增强记忆系统获取额外信息
        const enhancedContext = this.enhancedMemory.buildContext(action, {
            maxRecentEvents: 10,
            maxRelevantEvents: 5,
            includeGraph: true
        });

        return {
            ...basicContext,
            ...enhancedContext,
            activeCharacters: this.getActiveCharacters(),
            currentLocation: this.state.player.location,
            sceneDescription: this.state.sceneDescription
        };
    }

    /**
     * 获取当前活跃角色
     */
    getActiveCharacters() {
        // 简单实现：返回最近互动的角色
        const recentHistory = this.state.history.slice(-5);
        const activeChars = new Set();

        for (const entry of recentHistory) {
            // 从历史记录中提取角色ID（简化版）
            if (entry.characters) {
                entry.characters.forEach(c => activeChars.add(c));
            }
        }

        return Array.from(activeChars);
    }

    /**
     * 更新语义记忆
     */
    updateSemanticMemory(action, result) {
        // 添加事件到时间线
        this.enhancedMemory.updateSemanticMemory({
            event: {
                turn: this.state.turn,
                chapter: this.state.currentChapter,
                type: this.classifyEventType(action, result),
                summary: `${action} -> ${result.narration?.slice(0, 100)}`,
                participants: this.getActiveCharacters(),
                location: this.state.player.location,
                importance: this.calculateImportance(result),
                consequences: result.consequences || []
            }
        });

        // 更新因果链
        if (result.cause && result.effect) {
            this.enhancedMemory.updateSemanticMemory({
                causal: {
                    cause: result.cause,
                    effect: result.effect,
                    options: { strength: result.causalStrength || 5 }
                }
            });
        }

        // 更新角色关系
        if (result.relationshipChange) {
            this.enhancedMemory.updateSemanticMemory({
                relation: {
                    from: result.relationshipChange.from,
                    to: result.relationshipChange.to,
                    type: result.relationshipChange.type,
                    properties: { strength: result.relationshipChange.strength }
                }
            });
        }
    }

    /**
     * 分类事件类型
     */
    classifyEventType(action, result) {
        const actionLower = action.toLowerCase();

        if (actionLower.includes('说') || actionLower.includes('问') || actionLower.includes('回答')) {
            return 'dialogue';
        }
        if (actionLower.includes('发现') || actionLower.includes('找到')) {
            return 'discovery';
        }
        if (actionLower.includes('战斗') || actionLower.includes('攻击') || actionLower.includes('打')) {
            return 'conflict';
        }
        if (result.questUpdates && result.questUpdates.length > 0) {
            return 'resolution';
        }

        return 'action';
    }

    /**
     * 计算事件重要性
     */
    calculateImportance(result) {
        let importance = 3; // 默认

        // 任务相关 +1
        if (result.questUpdates && result.questUpdates.length > 0) {
            importance += 1;
        }

        // 角色关系变化 +1
        if (result.relationshipChange) {
            importance += 1;
        }

        // 重大发现 +1
        if (result.discovery) {
            importance += 1;
        }

        // 战斗或冲突 +1
        if (result.conflict) {
            importance += 1;
        }

        return Math.min(importance, 5);
    }

    buildGamePrompt(context, action) {
        const template = this.getGameTypeTemplate();
        const recentHistory = context.history.length
            ? context.history.map((item) => [
                `第${item.turn}回合`,
                `玩家行动：${item.action}`,
                item.response ? `系统反馈：${item.response}` : ''
            ].filter(Boolean).join('\n')).join('\n\n')
            : '暂无';
        const recalledMemories = this.formatRecalledMemories(context.recalledMemories);
        const compactWorldview = this.summarizeWorldview(context.worldview);
        const compactChapter = this.summarizeChapter(context.chapter);
        const compactPlayer = this.summarizePlayer(context.player);
        const compactInventory = this.summarizeInventory(context.inventory);
        const compactQuests = this.summarizeQuests(context.quests);
        const compactCharacters = this.summarizeCharacters(context.characterStates);
        const compactWorldState = this.summarizeWorldState(context.worldState);
        const compactGraphFacts = this.formatGraphFacts(context.graphFacts);

        return [
            '你是一台中文 RPG 游戏引擎，需要根据玩家行动推进故事。',
            `游戏类型：${this.gameData.type}`,
            `风格要求：${template.systemPrompt}`,
            '所有旁白、对白、选项和提示都必须使用中文。',
            '请严格只返回 JSON，不要输出解释。',
            `世界观摘要：${compactWorldview}`,
            `当前章节摘要：${compactChapter}`,
            `玩家状态摘要：${compactPlayer}`,
            `物品栏摘要：${compactInventory}`,
            `任务摘要：${compactQuests}`,
            `重要角色状态：${compactCharacters}`,
            `世界状态：${compactWorldState}`,
            `最近历史：${recentHistory}`,
            `长期记忆召回：${recalledMemories}`,
            `知识图谱事实：${compactGraphFacts}`,
            `玩家行动：${action}`,
            '请返回如下结构：',
            '{"narration":"旁白描述","dialogues":[{"speaker":"角色名","content":"对白内容"}],"choices":[{"text":"选项文本","action":"对应行动"}],"statChanges":{"属性名":-5},"newItems":[{"name":"物品名","description":"物品描述"}],"questUpdates":[{"questId":"任务ID","completed":false,"progress":"进度说明"}],"sceneChange":"新的场景描述","stateUpdates":{"playerLocation":"新地点","playerEmotion":"当前情绪","currentScene":"场景标识","world":{"time":"时间","weather":"天气","eventsAdd":["新增世界事件"]},"chapterAdvance":false},"relationshipUpdates":[{"characterId":"角色ID或空","characterName":"角色名","relationshipDelta":2,"mood":"情绪","state":"状态","location":"地点"}],"memoryFacts":[{"subject":"主体","subjectType":"player/character/location/item/quest/world","predicate":"关系","object":"客体","objectType":"character/location/item/quest/world/event","attributes":{"key":"value"}}],"visualCue":{"focus":"本回合画面焦点","camera":"远景/中景/近景等","mood":"画面氛围","onStageCharacters":["当前画面中最重要的角色"],"shouldChangeBackground":false},"gameOver":false,"gameOverMessage":"结束提示"}',
            '要求：叙事连贯，选项有意义，角色性格保持一致，避免脱离已确认设定。stateUpdates、relationshipUpdates、memoryFacts 只填写本回合真正产生的新变化，没有就返回空对象或空数组。visualCue 用来描述画面焦点；只有场景底图确实应当明显变化时，shouldChangeBackground 才返回 true。'
        ].join('\n\n');
    }

    getGameTypeTemplate() {
        const templates = {
            adventure: { systemPrompt: '突出探索、战斗和任务推进，鼓励玩家在世界中主动冒险。' },
            dungeon: { systemPrompt: '突出危险探索、资源管理和高压决策，营造地牢压迫感。' },
            romance: { systemPrompt: '突出情感推进、关系互动和角色心境变化。' },
            mystery: { systemPrompt: '突出线索搜集、逻辑推理和真相揭示。' },
            fantasy: { systemPrompt: '突出魔法、奇幻生物和史诗冒险氛围。' },
            scifi: { systemPrompt: '突出未来科技、星际文明与未知探索。' },
            survival: { systemPrompt: '突出求生压力、资源匮乏和环境威胁。' },
            kingdom: { systemPrompt: '突出治理、抉择、派系影响和王国发展。' },
            cultivation: { systemPrompt: '突出修行成长、境界突破、机缘与因果。' },
            custom: { systemPrompt: '严格依据已生成设定推进，保持风格统一。' }
        };

        return templates[this.gameData.type] || templates.custom;
    }

    updateState(result) {
        if (result.statChanges) {
            for (const [stat, change] of Object.entries(result.statChanges)) {
                if (!Object.prototype.hasOwnProperty.call(this.state.player.stats, stat)) {
                    continue;
                }

                if (typeof this.state.player.stats[stat] === 'object' && this.state.player.stats[stat] !== null) {
                    const current = this.state.player.stats[stat].current || 0;
                    this.state.player.stats[stat].current = Math.max(0, current + change);
                } else if (typeof this.state.player.stats[stat] === 'number') {
                    this.state.player.stats[stat] += change;
                }
            }
        }

        if (Array.isArray(result.newItems) && result.newItems.length) {
            this.state.inventory.push(...result.newItems);
        }

        if (Array.isArray(result.questUpdates)) {
            for (const update of result.questUpdates) {
                const quest = this.state.quests.find((item) => item.id === update.questId);
                if (!quest) {
                    continue;
                }

                if (update.completed !== undefined) {
                    quest.completed = update.completed;
                }

                if (update.progress) {
                    quest.progress = update.progress;
                }
            }
        }

        this.applyRelationshipUpdates(result.relationshipUpdates);
        this.applyStateUpdates(result.stateUpdates);

        if (result.sceneChange) {
            this.state.sceneDescription = result.sceneChange;
        }

        if (result.gameOver) {
            this.state.gameOver = true;
            this.state.gameOverMessage = result.gameOverMessage || '游戏结束';
        }

        if (result.dialogues) {
            this.state.lastDialogues = result.dialogues;
        }

        this.state.visualDirectives = this.buildVisualDirectives(result);
    }

    applyRelationshipUpdates(updates) {
        if (!Array.isArray(updates) || updates.length === 0) {
            return;
        }

        for (const update of updates) {
            const target = this.state.characterStates.find((item) =>
                (update.characterId && item.id === update.characterId)
                || (update.characterName && item.name === update.characterName)
            );

            if (!target) {
                continue;
            }

            if (typeof update.relationshipDelta === 'number') {
                target.relationship = (target.relationship || 0) + update.relationshipDelta;
            }

            if (update.mood) {
                target.mood = update.mood;
            }

            if (update.state) {
                target.state = update.state;
            }

            if (update.location) {
                target.location = update.location;
            }
        }
    }

    applyStateUpdates(stateUpdates) {
        if (!stateUpdates || typeof stateUpdates !== 'object') {
            return;
        }

        if (stateUpdates.playerLocation) {
            this.state.player.location = stateUpdates.playerLocation;
        }

        if (stateUpdates.playerEmotion) {
            this.state.player.emotion = stateUpdates.playerEmotion;
        }

        if (stateUpdates.currentScene) {
            this.state.currentScene = stateUpdates.currentScene;
        }

        if (stateUpdates.world && typeof stateUpdates.world === 'object') {
            if (stateUpdates.world.time) {
                this.state.worldState.time = stateUpdates.world.time;
            }

            if (stateUpdates.world.weather) {
                this.state.worldState.weather = stateUpdates.world.weather;
            }

            if (Array.isArray(stateUpdates.world.eventsAdd) && stateUpdates.world.eventsAdd.length) {
                const nextEvents = [
                    ...(this.state.worldState.events || []),
                    ...stateUpdates.world.eventsAdd
                ];
                this.state.worldState.events = nextEvents.slice(-12);
            }
        }

        if (stateUpdates.chapterAdvance === true && this.state.currentChapter < (this.gameData.chapters?.length || 1) - 1) {
            this.state.currentChapter += 1;
        }
    }

    updateLatestHistoryEntry(response) {
        const latest = this.state.history[this.state.history.length - 1];
        if (!latest) {
            return;
        }

        latest.response = response;
        latest.sceneDescription = this.state.sceneDescription;
        latest.location = this.state.player?.location || '';
        latest.visualSignature = this.state.visualState?.signature || '';
    }

    buildVisualState() {
        const location = this.state?.player?.location || this.gameData?.openingScene?.startingLocation || '未知地点';
        const currentScene = this.state?.currentScene || 'scene';
        const timeOfDay = this.state?.worldState?.time || '未知时间';
        const weather = this.state?.worldState?.weather || '未知天气';
        const directives = this.state?.visualDirectives || {};
        const mood = directives.mood || this.state?.player?.emotion || '平静';
        const focus = directives.focus || currentScene;
        const camera = directives.camera || '中景';
        const onStageCharacters = Array.isArray(directives.onStageCharacters) ? directives.onStageCharacters.slice(0, 4) : [];
        const castSignature = onStageCharacters.join('+');
        const signatureParts = [currentScene, location, timeOfDay, weather, mood, focus, camera]
            .map((value) => String(value || '').trim())
            .filter(Boolean);

        return {
            sceneId: currentScene,
            location,
            timeOfDay,
            weather,
            mood,
            focus,
            camera,
            onStageCharacters,
            castSignature,
            forceBackgroundRefresh: directives.shouldChangeBackground === true,
            prompt: this.state?.sceneDescription || this.state?.initialLog || '',
            signature: signatureParts.join('|')
        };
    }

    cloneVisualState(visualState) {
        return visualState ? JSON.parse(JSON.stringify(visualState)) : null;
    }

    hasVisualSceneChanged(previousVisualState, nextVisualState) {
        if (!previousVisualState && nextVisualState) {
            return true;
        }

        if (!nextVisualState) {
            return false;
        }

        return nextVisualState.forceBackgroundRefresh === true
            || previousVisualState?.signature !== nextVisualState.signature
            || (
                previousVisualState?.castSignature
                && nextVisualState.castSignature
                && previousVisualState.castSignature !== nextVisualState.castSignature
                && previousVisualState.location !== nextVisualState.location
            );
    }

    buildVisualDirectives(result = {}) {
        const visualCue = result.visualCue && typeof result.visualCue === 'object' ? result.visualCue : {};
        const fallbackCharacters = this.extractDialogueCharacters(result.dialogues || this.state?.lastDialogues || []);
        const onStageCharacters = this.normalizeCharacterList(
            Array.isArray(visualCue.onStageCharacters) && visualCue.onStageCharacters.length
                ? visualCue.onStageCharacters
                : fallbackCharacters
        );

        return {
            focus: String(visualCue.focus || result.sceneChange || this.state?.currentScene || '').trim(),
            camera: String(visualCue.camera || '中景').trim(),
            mood: String(visualCue.mood || this.state?.player?.emotion || '平静').trim(),
            onStageCharacters,
            shouldChangeBackground: visualCue.shouldChangeBackground === true
        };
    }

    extractDialogueCharacters(dialogues = []) {
        if (!Array.isArray(dialogues) || dialogues.length === 0) {
            return [];
        }

        return dialogues
            .map((item) => String(item?.speaker || '').trim())
            .filter((name) => name && !['旁白', '系统', '玩家', '冒险者'].includes(name));
    }

    normalizeCharacterList(list = []) {
        if (!Array.isArray(list)) {
            return [];
        }

        return [...new Set(
            list
                .map((item) => String(item || '').trim())
                .filter(Boolean)
        )].slice(0, 4);
    }

    async ensureMemoryBootstrap() {
        if (!this.memoryService || !this.gameId || this.memoryBootstrapped === true) {
            return;
        }

        const entries = this.buildBootstrapMemories();
        const graphFacts = this.buildBootstrapGraphFacts();
        if (!entries.length) {
            this.memoryBootstrapped = true;
        } else {
            const saveMemories = typeof this.memoryService.saveMemoriesFast === 'function'
                ? this.memoryService.saveMemoriesFast.bind(this.memoryService)
                : this.memoryService.saveMemories.bind(this.memoryService);
            await saveMemories(entries);
        }

        if (graphFacts.length) {
            await this.memoryService.upsertFacts(this.gameId, graphFacts);
        }

        this.memoryBootstrapped = true;
    }

    buildBootstrapMemories() {
        const entries = [];
        const worldviewText = this.gameData.worldview?.description
            || JSON.stringify(this.gameData.worldview || {});
        const opening = this.gameData.openingScene || {};

        if (worldviewText && worldviewText !== '{}') {
            entries.push({
                key: `game:${this.gameId}:fact:worldview`,
                value: `这是游戏《${this.gameData.name || '未命名 RPG'}》的核心世界观：${worldviewText}`,
                metadata: {
                    gameId: this.gameId,
                    memoryType: 'fact',
                    factType: 'worldview',
                    importance: 9
                }
            });
        }

        if (opening.description || opening.narration) {
            entries.push({
                key: `game:${this.gameId}:fact:opening`,
                value: `开场场景：${opening.description || ''}\n开场旁白：${opening.narration || ''}`.trim(),
                metadata: {
                    gameId: this.gameId,
                    memoryType: 'fact',
                    factType: 'opening',
                    scene: 'opening',
                    location: opening.startingLocation || '起始地点',
                    importance: 8
                }
            });
        }

        for (const character of (this.gameData.characters || []).slice(0, 12)) {
            entries.push({
                key: `game:${this.gameId}:fact:character:${character.id || character.name}`,
                value: `角色：${character.name || '未知角色'}；身份：${character.role || '未知'}；简介：${character.description || ''}`,
                metadata: {
                    gameId: this.gameId,
                    memoryType: 'fact',
                    factType: 'character',
                    characterName: character.name || '',
                    importance: 6
                }
            });
        }

        for (const chapter of (this.gameData.chapters || []).slice(0, 5)) {
            entries.push({
                key: `game:${this.gameId}:fact:chapter:${chapter.id || chapter.name || entries.length}`,
                value: `章节：${chapter.name || chapter.title || '未命名章节'}；目标：${chapter.goal || ''}；描述：${chapter.description || ''}`,
                metadata: {
                    gameId: this.gameId,
                    memoryType: 'fact',
                    factType: 'chapter',
                    importance: 6
                }
            });
        }

        return entries;
    }

    buildBootstrapGraphFacts() {
        const facts = [];
        const worldId = `world:${this.gameId}`;
        const opening = this.gameData.openingScene || {};
        const openingLocation = opening.startingLocation || '起始地点';
        const openingLocationId = `location:${this.gameId}:${openingLocation}`;
        const playerId = `player:${this.gameId}`;

        facts.push({
            source: {
                id: worldId,
                label: this.gameData.name || '游戏世界',
                type: 'world',
                attributes: {
                    type: this.gameData.type || 'custom'
                }
            },
            type: 'has_opening_location',
            target: {
                id: openingLocationId,
                label: openingLocation,
                type: 'location'
            }
        });

        facts.push({
            source: {
                id: playerId,
                label: this.state?.player?.name || '冒险者',
                type: 'player'
            },
            type: 'located_in',
            target: {
                id: openingLocationId,
                label: openingLocation,
                type: 'location'
            }
        });

        for (const character of (this.gameData.characters || []).slice(0, 12)) {
            facts.push({
                source: {
                    id: `character:${this.gameId}:${character.id || character.name}`,
                    label: character.name || '未知角色',
                    type: 'character',
                    attributes: {
                        role: character.role || '',
                        description: character.description || ''
                    }
                },
                type: 'exists_in_world',
                target: {
                    id: worldId,
                    label: this.gameData.name || '游戏世界',
                    type: 'world'
                }
            });
        }

        for (const chapter of (this.gameData.chapters || []).slice(0, 5)) {
            facts.push({
                source: {
                    id: `chapter:${this.gameId}:${chapter.id || chapter.name || facts.length}`,
                    label: chapter.name || chapter.title || '未命名章节',
                    type: 'chapter',
                    attributes: {
                        goal: chapter.goal || '',
                        description: chapter.description || ''
                    }
                },
                type: 'belongs_to_world',
                target: {
                    id: worldId,
                    label: this.gameData.name || '游戏世界',
                    type: 'world'
                }
            });
        }

        return facts;
    }

    async retrieveRelevantMemories(action) {
        if (!this.memoryService || !this.gameId) {
            return [];
        }

        const query = [
            this.gameData.name ? `游戏名 ${this.gameData.name}` : '',
            this.state.sceneDescription ? `当前场景 ${this.state.sceneDescription}` : '',
            this.state.player?.location ? `当前位置 ${this.state.player.location}` : '',
            this.state.player?.emotion ? `玩家情绪 ${this.state.player.emotion}` : '',
            this.state.quests?.length
                ? `当前任务 ${this.state.quests.filter((item) => !item.completed).map((item) => item.name || item.description).join('，')}`
                : '',
            this.state.characterStates?.length
                ? `相关角色 ${this.state.characterStates.slice(0, 6).map((item) => item.name).filter(Boolean).join('，')}`
                : '',
            `玩家行动 ${action}`
        ].filter(Boolean).join('\n');

        const retrieve = typeof this.memoryService.retrieveMemoryFast === 'function'
            ? this.memoryService.retrieveMemoryFast.bind(this.memoryService)
            : this.memoryService.retrieveMemory.bind(this.memoryService);
        const result = await retrieve(query, {
            limit: 12,
            filter: { gameId: this.gameId },
            preferFastLocal: true
        });

        if (!result.success) {
            return [];
        }

        const prioritized = result.results
            .filter((item) => item.value)
            .sort((left, right) => {
                const leftWeight = this.getMemoryPriorityWeight(left.metadata);
                const rightWeight = this.getMemoryPriorityWeight(right.metadata);
                return (right.score + rightWeight) - (left.score + leftWeight);
            })
            .slice(0, 6);

        return prioritized;
    }

    async retrieveRelevantGraphFacts(action) {
        if (!this.memoryService || !this.gameId) {
            return [];
        }

        return this.memoryService.getRelevantFacts([
            this.gameData.name || '',
            this.state.sceneDescription || '',
            this.state.player?.location || '',
            action
        ].filter(Boolean).join('\n'), {
            gameId: this.gameId,
            limit: 6
        });
    }

    formatRecalledMemories(memories) {
        if (!Array.isArray(memories) || memories.length === 0) {
            return '暂无';
        }

        return memories.map((item, index) => {
            const label = item.metadata?.memoryType === 'summary'
                ? '摘要'
                : item.metadata?.memoryType === 'fact'
                    ? '事实'
                    : '回合';
            const score = typeof item.score === 'number' ? item.score.toFixed(2) : '0.00';
            const value = String(item.value || '').replace(/\s+/g, ' ').trim().slice(0, 220);
            return `${index + 1}. [${label} ${score}] ${value}`;
        }).join('\n');
    }

    getMemoryPriorityWeight(metadata = {}) {
        const memoryType = metadata.memoryType || 'turn';
        const importance = Number(metadata.importance || 0);

        if (memoryType === 'summary') {
            return 3 + importance * 0.35;
        }

        if (memoryType === 'fact') {
            return 1.5 + importance * 0.25;
        }

        return importance * 0.15;
    }

    formatGraphFacts(facts) {
        if (!Array.isArray(facts) || facts.length === 0) {
            return '暂无';
        }

        return facts.map((item, index) => {
            const score = typeof item.score === 'number' ? item.score.toFixed(2) : '0.00';
            return `${index + 1}. [事实 ${score}] ${item.text}`;
        }).join('\n');
    }

    formatExplicitMemoryFacts(facts) {
        if (!Array.isArray(facts) || facts.length === 0) {
            return '';
        }

        return facts.map((fact) => [
            `主体: ${fact.subject || ''}`,
            `关系: ${fact.predicate || ''}`,
            `客体: ${fact.object || ''}`
        ].filter(Boolean).join('；')).join('\n');
    }

    summarizeWorldview(worldview = {}) {
        if (!worldview || typeof worldview !== 'object') {
            return '暂无';
        }

        return JSON.stringify({
            worldName: worldview.worldName || worldview.name || '',
            theme: worldview.theme || '',
            description: worldview.description || '',
            factions: Array.isArray(worldview.factions)
                ? worldview.factions.slice(0, 5).map((item) => item.name || item.title || String(item))
                : []
        });
    }

    summarizeChapter(chapter = null) {
        if (!chapter || typeof chapter !== 'object') {
            return '暂无';
        }

        return JSON.stringify({
            name: chapter.name || chapter.title || '',
            goal: chapter.goal || '',
            description: chapter.description || '',
            conflict: chapter.conflict || ''
        });
    }

    summarizePlayer(player = {}) {
        return JSON.stringify({
            name: player.name || '',
            level: player.level || 1,
            location: player.location || '',
            emotion: player.emotion || '',
            stats: player.stats || {}
        });
    }

    summarizeInventory(inventory = []) {
        if (!Array.isArray(inventory) || inventory.length === 0) {
            return '暂无';
        }

        return inventory.slice(0, 12).map((item) => item.name || String(item)).join('，');
    }

    summarizeQuests(quests = []) {
        if (!Array.isArray(quests) || quests.length === 0) {
            return '暂无';
        }

        return quests.slice(0, 8).map((item) => JSON.stringify({
            id: item.id || '',
            name: item.name || item.description || '任务',
            completed: item.completed === true,
            progress: item.progress || ''
        })).join('；');
    }

    summarizeCharacters(characterStates = []) {
        if (!Array.isArray(characterStates) || characterStates.length === 0) {
            return '暂无';
        }

        return characterStates.slice(0, 8).map((item) => JSON.stringify({
            name: item.name || '',
            relationship: item.relationship || 0,
            location: item.location || '',
            mood: item.mood || '',
            state: item.state || ''
        })).join('；');
    }

    summarizeWorldState(worldState = {}) {
        return JSON.stringify({
            time: worldState.time || '',
            weather: worldState.weather || '',
            events: Array.isArray(worldState.events) ? worldState.events.slice(-3) : []
        });
    }

    async persistTurnMemory(action, response, result) {
        if (!this.memoryService || !this.gameId) {
            return;
        }

        const entries = [{
            key: `game:${this.gameId}:turn:${this.state.turn}`,
            value: [
                `第${this.state.turn}回合`,
                `玩家行动：${action}`,
                `系统回应：${response}`,
                this.state.sceneDescription ? `场景变化：${this.state.sceneDescription}` : '',
                result.stateUpdates?.playerLocation ? `玩家位置变化：${result.stateUpdates.playerLocation}` : '',
                result.stateUpdates?.playerEmotion ? `玩家情绪变化：${result.stateUpdates.playerEmotion}` : '',
                Array.isArray(result.relationshipUpdates) && result.relationshipUpdates.length
                    ? `关系变化：${result.relationshipUpdates.map((item) => {
                        const delta = Number(item.relationshipDelta || 0);
                        const changeLabel = delta > 0 ? `提升 ${delta}` : delta < 0 ? `下降 ${Math.abs(delta)}` : '无变化';
                        return `${item.characterName || item.characterId || '角色'} 关系${changeLabel}，情绪 ${item.mood || '未说明'}`;
                    }).join('；')}`
                    : '',
                Array.isArray(result.newItems) && result.newItems.length
                    ? `新增物品：${result.newItems.map((item) => item.name || String(item)).join('，')}`
                    : '',
                Array.isArray(result.questUpdates) && result.questUpdates.length
                    ? `任务更新：${result.questUpdates.map((item) => `${item.questId || '任务'} ${item.progress || ''}`.trim()).join('；')}`
                    : '',
                Array.isArray(result.memoryFacts) && result.memoryFacts.length
                    ? `显式事实：${this.formatExplicitMemoryFacts(result.memoryFacts)}`
                    : ''
            ].filter(Boolean).join('\n'),
            metadata: {
                gameId: this.gameId,
                memoryType: 'turn',
                turn: this.state.turn,
                scene: this.state.currentScene || 'unknown',
                location: this.state.player?.location || '',
                importance: this.estimateTurnImportance(result)
            }
        }];

        if (Array.isArray(result.newItems)) {
            result.newItems.forEach((item, index) => {
                entries.push({
                    key: `game:${this.gameId}:fact:item:${this.state.turn}:${index}`,
                    value: `玩家在第${this.state.turn}回合获得了物品：${item.name || '未知物品'}；描述：${item.description || ''}`,
                    metadata: {
                        gameId: this.gameId,
                        memoryType: 'fact',
                        factType: 'item',
                        turn: this.state.turn,
                        importance: 6
                    }
                });
            });
        }

        if (Array.isArray(result.questUpdates)) {
            result.questUpdates.forEach((item, index) => {
                entries.push({
                    key: `game:${this.gameId}:fact:quest:${this.state.turn}:${index}`,
                    value: `任务状态更新：${item.questId || '未知任务'}；完成：${item.completed === true ? '是' : '否'}；进度：${item.progress || '无'}`,
                    metadata: {
                        gameId: this.gameId,
                        memoryType: 'fact',
                        factType: 'quest',
                        turn: this.state.turn,
                        importance: item.completed === true ? 8 : 7
                    }
                });
            });
        }

        if (Array.isArray(result.memoryFacts)) {
            result.memoryFacts.forEach((fact, index) => {
                entries.push({
                    key: `game:${this.gameId}:fact:explicit:${this.state.turn}:${index}`,
                    value: [
                        `主体：${fact.subject || ''}`,
                        `关系：${fact.predicate || ''}`,
                        fact.object ? `客体：${fact.object}` : '',
                        fact.attributes ? `属性：${JSON.stringify(fact.attributes)}` : ''
                    ].filter(Boolean).join('\n'),
                    metadata: {
                        gameId: this.gameId,
                        memoryType: 'fact',
                        factType: 'explicit',
                        turn: this.state.turn,
                        importance: 7
                    }
                });
            });
        }

        const saveMemories = typeof this.memoryService.saveMemoriesFast === 'function'
            ? this.memoryService.saveMemoriesFast.bind(this.memoryService)
            : this.memoryService.saveMemories.bind(this.memoryService);
        await saveMemories(entries);
        await this.memoryService.upsertFacts(this.gameId, this.buildTurnGraphFacts(result));
    }

    async maybePersistTurnSummary(response, result) {
        if (!this.memoryService || !this.gameId) {
            return;
        }

        const shouldSummarize = this.state.turn % 3 === 0 || result.gameOver === true;
        if (!shouldSummarize) {
            return;
        }

        const recentTurns = this.state.history.slice(-3);
        const summaryText = [
            `阶段总结：第${recentTurns[0]?.turn || this.state.turn}到第${recentTurns[recentTurns.length - 1]?.turn || this.state.turn}回合`,
            ...recentTurns.map((item) => `第${item.turn}回合 玩家:${item.action} 系统:${item.response || ''}`),
            `当前场景：${this.state.sceneDescription || ''}`,
            `当前地点：${this.state.player?.location || ''}`,
            `当前任务：${this.state.quests.filter((item) => !item.completed).map((item) => item.name || item.description).join('，') || '暂无'}`,
            `显式记忆事实：${this.formatExplicitMemoryFacts(result.memoryFacts) || '暂无'}`
        ].join('\n');

        const saveMemory = typeof this.memoryService.saveMemoryFast === 'function'
            ? this.memoryService.saveMemoryFast.bind(this.memoryService)
            : this.memoryService.saveMemory.bind(this.memoryService);
        await saveMemory(
            `game:${this.gameId}:summary:${this.state.turn}`,
            summaryText,
            {
                gameId: this.gameId,
                memoryType: 'summary',
                turn: this.state.turn,
                location: this.state.player?.location || '',
                summaryType: result.gameOver === true ? 'ending' : 'checkpoint',
                importance: result.gameOver === true ? 10 : 8
            }
        );

        await this.memoryService.compressGameMemories(this.gameId, {
            keepRecentTurns: 8,
            maxTurnMemories: 14,
            chunkSize: 3
        });
    }

    estimateTurnImportance(result = {}) {
        let importance = 4;

        if (Array.isArray(result.newItems) && result.newItems.length) {
            importance += 1;
        }

        if (Array.isArray(result.questUpdates) && result.questUpdates.length) {
            importance += 1;
        }

        if (Array.isArray(result.relationshipUpdates) && result.relationshipUpdates.length) {
            importance += 1;
        }

        if (Array.isArray(result.memoryFacts) && result.memoryFacts.length) {
            importance += 1;
        }

        if (result.sceneChange || result.stateUpdates?.playerLocation) {
            importance += 1;
        }

        if (result.gameOver === true) {
            importance += 2;
        }

        return Math.min(10, importance);
    }

    buildTurnGraphFacts(result) {
        const facts = [];
        const playerId = `player:${this.gameId}`;
        const currentLocation = this.state.player?.location || this.state.currentScene || '未知地点';
        const locationId = `location:${this.gameId}:${currentLocation}`;

        facts.push({
            source: {
                id: playerId,
                label: this.state.player?.name || '冒险者',
                type: 'player',
                attributes: {
                    level: this.state.player?.level || 1,
                    emotion: this.state.player?.emotion || '',
                    turn: this.state.turn
                }
            },
            type: 'located_in',
            target: {
                id: locationId,
                label: currentLocation,
                type: 'location'
            }
        });

        for (const item of (this.state.inventory || []).slice(-8)) {
            facts.push({
                source: {
                    id: playerId,
                    label: this.state.player?.name || '冒险者',
                    type: 'player'
                },
                type: 'has_item',
                target: {
                    id: `item:${this.gameId}:${item.name || item.id || 'unknown'}`,
                    label: item.name || '未知物品',
                    type: 'item',
                    attributes: {
                        description: item.description || ''
                    }
                }
            });
        }

        for (const quest of (this.state.quests || []).slice(0, 8)) {
            facts.push({
                source: {
                    id: playerId,
                    label: this.state.player?.name || '冒险者',
                    type: 'player'
                },
                type: quest.completed ? 'completed_quest' : 'pursues_quest',
                target: {
                    id: `quest:${this.gameId}:${quest.id || quest.name || 'unknown'}`,
                    label: quest.name || quest.description || '任务',
                    type: 'quest',
                    attributes: {
                        progress: quest.progress || '',
                        completed: quest.completed === true
                    }
                }
            });
        }

        for (const character of (this.state.characterStates || []).slice(0, 10)) {
            const characterId = `character:${this.gameId}:${character.id || character.name}`;
            facts.push({
                source: {
                    id: characterId,
                    label: character.name || '未知角色',
                    type: 'character',
                    attributes: {
                        mood: character.mood || '',
                        state: character.state || ''
                    }
                },
                type: 'located_in',
                target: {
                    id: `location:${this.gameId}:${character.location || currentLocation}`,
                    label: character.location || currentLocation,
                    type: 'location'
                }
            });

            facts.push({
                source: {
                    id: characterId,
                    label: character.name || '未知角色',
                    type: 'character'
                },
                type: 'relation_to_player',
                target: {
                    id: playerId,
                    label: this.state.player?.name || '冒险者',
                    type: 'player'
                },
                attributes: {
                    relationship: character.relationship || 0,
                    mood: character.mood || ''
                }
            });
        }

        if (result.gameOver === true) {
            facts.push({
                source: {
                    id: `game:${this.gameId}`,
                    label: this.gameData.name || '当前游戏',
                    type: 'game'
                },
                type: 'ended_with',
                target: {
                    id: `ending:${this.gameId}:${this.state.turn}`,
                    label: result.gameOverMessage || '游戏结束',
                    type: 'ending'
                }
            });
        }

        if (Array.isArray(result.memoryFacts)) {
            for (const fact of result.memoryFacts) {
                const normalized = this.normalizeExplicitFact(fact);
                if (normalized) {
                    facts.push(normalized);
                }
            }
        }

        return facts;
    }

    normalizeExplicitFact(fact) {
        if (!fact || !fact.subject || !fact.predicate) {
            return null;
        }

        const subjectLabel = String(fact.subject).trim();
        const objectLabel = String(fact.object || '').trim();
        const subjectType = fact.subjectType || 'entity';
        const objectType = fact.objectType || 'entity';

        return {
            source: {
                id: `${subjectType}:${this.gameId}:${subjectLabel}`,
                label: subjectLabel,
                type: subjectType
            },
            type: fact.predicate,
            target: objectLabel ? {
                id: `${objectType}:${this.gameId}:${objectLabel}`,
                label: objectLabel,
                type: objectType
            } : null,
            attributes: { ...(fact.attributes || {}) }
        };
    }

    initializePlayerStats() {
        const typeStats = {
            adventure: { 生命值: { current: 100, max: 100 }, 攻击力: 15, 防御力: 10, 敏捷: 12 },
            dungeon: { 生命值: { current: 80, max: 80 }, 攻击力: 12, 防御力: 15, 幸运: 10 },
            romance: { 魅力: 15, 情感: { current: 50, max: 100 }, 智力: 12, 体力: 10 },
            mystery: { 观察力: 18, 推理力: 15, 体力: 10, 人脉: 8 },
            fantasy: { 生命值: { current: 90, max: 90 }, 魔力: { current: 50, max: 50 }, 智力: 16, 精神: 12 },
            scifi: { 生命值: { current: 100, max: 100 }, 能量: { current: 100, max: 100 }, 科技: 14, 体能: 12 },
            survival: { 生命值: { current: 100, max: 100 }, 饥饿度: { current: 80, max: 100 }, 体力: { current: 100, max: 100 }, 精神: { current: 80, max: 100 } },
            kingdom: { 威望: 15, 智慧: 14, 军事: 10, 财政: { current: 1000, max: 9999 } },
            cultivation: { 生命值: { current: 100, max: 100 }, 灵力: { current: 50, max: 50 }, 修为: 1, 境界: '炼气一层' },
            custom: { 生命值: { current: 100, max: 100 }, 攻击力: 10, 防御力: 10, 敏捷: 10 }
        };

        return typeStats[this.gameData.type] || typeStats.custom;
    }

    initializeCharacterStates() {
        const characters = this.gameData.characters || [];
        return characters.map((char) => ({
            id: char.id,
            name: char.name,
            relationship: char.relationship || 0,
            location: char.location || '未知',
            state: '活跃',
            mood: '平静',
            secrets: char.secrets || [],
            goals: char.goals || []
        }));
    }
}

module.exports = GameEngine;
