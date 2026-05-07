const KnowledgeGraph = require('./KnowledgeGraph');
const Timeline = require('./Timeline');
const CausalChain = require('./CausalChain');

/**
 * 增强记忆管理器 - 三层记忆架构
 * 工作记忆 + 情节记忆 + 语义记忆
 */
class EnhancedMemoryManager {
    constructor(userInput, gameType, options = {}) {
        // 全局上下文
        this.globalContext = {
            userInput,
            gameType,
            confirmedElements: [],
            constraints: [],
            sourceProject: options.sourceProject || null
        };

        // 第一层：工作记忆（当前场景，短期）
        this.workingMemory = {
            currentScene: null,
            activeCharacters: [],
            recentEvents: [], // 最近 10 个事件
            currentLocation: null,
            currentObjectives: []
        };

        // 第二层：情节记忆（当前章节，中期）
        this.episodicMemory = {
            currentChapter: 0,
            chapterSummary: '',
            keyEvents: [],
            characterArcs: {}, // 角色在本章的变化
            locationVisits: {}
        };

        // 第三层：语义记忆（全局知识，长期）
        this.semanticMemory = {
            knowledgeGraph: new KnowledgeGraph(),
            timeline: new Timeline(),
            causalChain: new CausalChain()
        };

        // 元素存储（兼容旧系统）
        this.elementStore = {
            worldview: null,
            coreCharacters: [],
            secondaryCharacters: [],
            items: [],
            puzzles: [],
            mainPlot: null,
            sidePlots: [],
            fragments: [],
            integration: null,
            summary: ''
        };

        if (options.seedData) {
            this.seedFromData(options.seedData);
        }
    }

    /**
     * 初始化知识图谱（从游戏数据）
     */
    initializeFromGameData(gameData) {
        const kg = this.semanticMemory.knowledgeGraph;

        // 添加角色实体
        if (gameData.characters) {
            for (const char of gameData.characters) {
                kg.addEntity('character', char.id, {
                    name: char.name,
                    role: char.role,
                    description: char.description,
                    personality: char.personality
                });
            }
        }

        // 添加地点实体
        if (gameData.worldview?.locations) {
            for (const loc of gameData.worldview.locations) {
                kg.addEntity('location', loc.id, {
                    name: loc.name,
                    description: loc.description,
                    type: loc.type
                });
            }
        }

        // 添加物品实体
        if (gameData.items) {
            for (const item of gameData.items) {
                kg.addEntity('item', item.id, {
                    name: item.name,
                    description: item.description,
                    type: item.type
                });
            }
        }

        // 添加角色关系
        if (gameData.relationships) {
            for (const rel of gameData.relationships) {
                kg.addRelation(rel.from, rel.to, rel.type, {
                    description: rel.description,
                    strength: rel.strength || 5
                });
            }
        }
    }

    /**
     * 更新工作记忆（每回合）
     */
    updateWorkingMemory(turnData) {
        // 更新当前场景
        if (turnData.sceneDescription) {
            this.workingMemory.currentScene = turnData.sceneDescription;
        }

        // 更新活跃角色
        if (turnData.activeCharacters) {
            this.workingMemory.activeCharacters = turnData.activeCharacters;
        }

        // 更新当前地点
        if (turnData.location) {
            this.workingMemory.currentLocation = turnData.location;
        }

        // 添加最近事件
        if (turnData.event) {
            this.workingMemory.recentEvents.push(turnData.event);
            // 只保留最近 10 个
            if (this.workingMemory.recentEvents.length > 10) {
                this.workingMemory.recentEvents.shift();
            }
        }
    }

    /**
     * 更新情节记忆（章节级别）
     */
    updateEpisodicMemory(chapterData) {
        this.episodicMemory.currentChapter = chapterData.chapter;

        // 更新章节摘要
        if (chapterData.summary) {
            this.episodicMemory.chapterSummary = chapterData.summary;
        }

        // 添加关键事件
        if (chapterData.keyEvent) {
            this.episodicMemory.keyEvents.push(chapterData.keyEvent);
        }

        // 更新角色弧光
        if (chapterData.characterChange) {
            const { characterId, change } = chapterData.characterChange;
            if (!this.episodicMemory.characterArcs[characterId]) {
                this.episodicMemory.characterArcs[characterId] = [];
            }
            this.episodicMemory.characterArcs[characterId].push(change);
        }
    }

    /**
     * 更新语义记忆（长期知识）
     */
    updateSemanticMemory(data) {
        const { knowledgeGraph, timeline, causalChain } = this.semanticMemory;

        // 更新知识图谱
        if (data.entity) {
            knowledgeGraph.addEntity(data.entity.type, data.entity.id, data.entity.properties);
        }

        if (data.relation) {
            knowledgeGraph.addRelation(
                data.relation.from,
                data.relation.to,
                data.relation.type,
                data.relation.properties
            );
        }

        // 更新时间线
        if (data.event) {
            timeline.addEvent(data.event);
        }

        // 更新因果链
        if (data.causal) {
            causalChain.addCause(data.causal.cause, data.causal.effect, data.causal.options);
        }
    }

    /**
     * 构建上下文（用于 AI 生成）
     */
    buildContext(query, options = {}) {
        const { maxRecentEvents = 10, maxRelevantEvents = 5, includeGraph = true } = options;

        const context = {
            // 工作记忆
            currentScene: this.workingMemory.currentScene,
            activeCharacters: this.workingMemory.activeCharacters,
            currentLocation: this.workingMemory.currentLocation,
            recentEvents: this.workingMemory.recentEvents.slice(-maxRecentEvents),

            // 情节记忆
            chapterSummary: this.episodicMemory.chapterSummary,
            keyEvents: this.episodicMemory.keyEvents,

            // 语义记忆
            relevantEvents: [],
            relevantEntities: [],
            causalContext: []
        };

        // 查询相关事件
        const relevantEvents = this.semanticMemory.timeline.queryRelevantEvents(query, {
            limit: maxRelevantEvents,
            minImportance: 3
        });
        context.relevantEvents = relevantEvents;

        // 查询相关实体（如果需要）
        if (includeGraph && query) {
            const entities = this.extractEntities(query);
            if (entities.length > 0) {
                context.relevantEntities = this.semanticMemory.knowledgeGraph.queryRelevant(
                    entities,
                    { maxDepth: 2, limit: 10 }
                );
            }
        }

        return context;
    }

    /**
     * 从查询中提取实体ID
     */
    extractEntities(query) {
        const entities = [];
        const kg = this.semanticMemory.knowledgeGraph;

        // 简单的实体匹配（可以用更复杂的 NER）
        for (const [id, entity] of kg.nodes) {
            if (query.includes(entity.name)) {
                entities.push(id);
            }
        }

        // 添加当前活跃的角色
        entities.push(...this.workingMemory.activeCharacters);

        return [...new Set(entities)];
    }

    /**
     * 获取记忆摘要（用于 prompt）
     */
    getMemorySummary() {
        return {
            workingMemory: {
                scene: this.workingMemory.currentScene,
                characters: this.workingMemory.activeCharacters.length,
                recentEvents: this.workingMemory.recentEvents.length
            },
            episodicMemory: {
                chapter: this.episodicMemory.currentChapter,
                keyEvents: this.episodicMemory.keyEvents.length
            },
            semanticMemory: {
                entities: this.semanticMemory.knowledgeGraph.nodes.size,
                relations: this.semanticMemory.knowledgeGraph.edges.size,
                events: this.semanticMemory.timeline.events.length,
                causalChains: this.semanticMemory.causalChain.chains.length
            }
        };
    }

    // ===== 兼容旧系统的方法 =====

    getCategoryForStep(stepId) {
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
        return categoryMap[stepId] || stepId;
    }

    confirmStep(stepId, data) {
        this.addElement(this.getCategoryForStep(stepId), data);
    }

    addElement(category, data) {
        if (Array.isArray(data)) {
            this.elementStore[category] = [...(this.elementStore[category] || []), ...data];
        } else {
            this.elementStore[category] = data;
        }

        if (!this.globalContext.confirmedElements.includes(category)) {
            this.globalContext.confirmedElements.push(category);
        }

        this.updateSummary();
    }

    seedFromData(seedData = {}) {
        const categories = [
            'worldview',
            'coreCharacters',
            'secondaryCharacters',
            'items',
            'puzzles',
            'mainPlot',
            'sidePlots',
            'fragments',
            'integration'
        ];

        categories.forEach((category) => {
            const value = seedData[category];
            if (value == null) return;

            const hasContent = Array.isArray(value)
                ? value.length > 0
                : typeof value === 'object'
                    ? Object.keys(value).length > 0
                    : Boolean(value);

            if (!hasContent) return;

            this.elementStore[category] = JSON.parse(JSON.stringify(value));

            if (!this.globalContext.confirmedElements.includes(category)) {
                this.globalContext.confirmedElements.push(category);
            }
        });

        this.updateSummary();
    }

    updateSummary() {
        const parts = [];
        if (this.elementStore.worldview) parts.push('世界观');
        if (this.elementStore.coreCharacters?.length) parts.push(`${this.elementStore.coreCharacters.length}个核心角色`);
        if (this.elementStore.mainPlot) parts.push('主线剧情');
        this.elementStore.summary = parts.join('、');
    }

    getGlobalContext() {
        return this.globalContext;
    }

    getElementStore() {
        return this.elementStore;
    }

    /**
     * 导出为 JSON
     */
    toJSON() {
        return {
            globalContext: this.globalContext,
            workingMemory: this.workingMemory,
            episodicMemory: this.episodicMemory,
            semanticMemory: {
                knowledgeGraph: this.semanticMemory.knowledgeGraph.toJSON(),
                timeline: this.semanticMemory.timeline.toJSON(),
                causalChain: this.semanticMemory.causalChain.toJSON()
            },
            elementStore: this.elementStore
        };
    }

    /**
     * 从 JSON 恢复
     */
    fromJSON(data) {
        if (data.globalContext) this.globalContext = data.globalContext;
        if (data.workingMemory) this.workingMemory = data.workingMemory;
        if (data.episodicMemory) this.episodicMemory = data.episodicMemory;
        if (data.elementStore) this.elementStore = data.elementStore;

        if (data.semanticMemory) {
            if (data.semanticMemory.knowledgeGraph) {
                this.semanticMemory.knowledgeGraph.fromJSON(data.semanticMemory.knowledgeGraph);
            }
            if (data.semanticMemory.timeline) {
                this.semanticMemory.timeline.fromJSON(data.semanticMemory.timeline);
            }
            if (data.semanticMemory.causalChain) {
                this.semanticMemory.causalChain.fromJSON(data.semanticMemory.causalChain);
            }
        }
    }
}

module.exports = EnhancedMemoryManager;