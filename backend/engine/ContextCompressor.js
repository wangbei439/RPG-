/**
 * 智能上下文压缩器 - 保留关键信息，压缩次要细节
 */
class ContextCompressor {
    constructor(memoryManager) {
        this.memory = memoryManager;
    }

    /**
     * 压缩上下文（智能保留关键信息）
     */
    compressContext(context, options = {}) {
        const {
            maxTokens = 4000,
            priorityLevel = 'balanced' // 'minimal', 'balanced', 'detailed'
        } = options;

        const compressed = {
            // 核心信息（永远保留）
            core: this.extractCore(context),

            // 重要信息（高优先级）
            important: this.extractImportant(context, priorityLevel),

            // 补充信息（低优先级，可裁剪）
            supplementary: this.extractSupplementary(context, priorityLevel)
        };

        // 估算 token 数量并裁剪
        return this.fitToTokenLimit(compressed, maxTokens);
    }

    /**
     * 提取核心信息（必须保留）
     */
    extractCore(context) {
        return {
            // 当前状态
            currentTurn: context.turn,
            currentChapter: context.chapter?.id,
            currentLocation: context.player?.location,

            // 玩家核心状态
            playerName: context.player?.name,
            playerLevel: context.player?.level,
            playerHP: context.player?.stats?.hp,

            // 当前目标
            activeQuests: context.quests?.filter(q => !q.completed).map(q => ({
                id: q.id,
                name: q.name
            })),

            // 当前场景
            sceneDescription: context.sceneDescription
        };
    }

    /**
     * 提取重要信息
     */
    extractImportant(context, priorityLevel) {
        const important = {};

        // 最近历史（根据优先级调整数量）
        const historyLimit = priorityLevel === 'minimal' ? 3 :
                           priorityLevel === 'balanced' ? 6 : 10;
        important.recentHistory = context.history?.slice(-historyLimit) || [];

        // 活跃角色
        important.activeCharacters = this.compressCharacters(
            context.characters?.filter(c =>
                context.activeCharacters?.includes(c.id)
            ) || []
        );

        // 关键事件
        important.keyEvents = this.memory.semanticMemory.timeline
            .queryRelevantEvents(context.action, {
                limit: priorityLevel === 'minimal' ? 3 : 5,
                minImportance: 4
            });

        // 相关记忆
        important.relevantMemories = context.recalledMemories?.slice(0, 5) || [];

        return important;
    }

    /**
     * 提取补充信息
     */
    extractSupplementary(context, priorityLevel) {
        if (priorityLevel === 'minimal') return {};

        const supplementary = {};

        // 世界观摘要
        supplementary.worldview = this.compressWorldview(context.worldview);

        // 章节信息
        supplementary.chapter = this.compressChapter(context.chapter);

        // 物品清单
        supplementary.inventory = context.inventory?.map(item => ({
            id: item.id,
            name: item.name
        })) || [];

        // 角色关系
        if (priorityLevel === 'detailed') {
            supplementary.relationships = this.compressRelationships(context);
        }

        return supplementary;
    }

    /**
     * 压缩角色信息
     */
    compressCharacters(characters) {
        return characters.map(char => ({
            id: char.id,
            name: char.name,
            role: char.role,
            // 只保留关键性格特征（前3个词）
            personality: char.personality?.split(/[,，、]/).slice(0, 3).join('、'),
            // 只保留当前状态
            currentState: char.currentState
        }));
    }

    /**
     * 压缩世界观
     */
    compressWorldview(worldview) {
        if (!worldview) return null;

        return {
            name: worldview.name,
            // 只保留摘要的前100字
            summary: worldview.description?.slice(0, 100) + '...',
            theme: worldview.theme,
            // 只保留核心规则
            coreRules: worldview.rules?.slice(0, 3)
        };
    }

    /**
     * 压缩章节信息
     */
    compressChapter(chapter) {
        if (!chapter) return null;

        return {
            id: chapter.id,
            title: chapter.title,
            goal: chapter.goal,
            // 只保留摘要
            summary: chapter.summary || chapter.description?.slice(0, 150)
        };
    }

    /**
     * 压缩关系网络
     */
    compressRelationships(context) {
        const kg = this.memory.semanticMemory.knowledgeGraph;
        const activeChars = context.activeCharacters || [];

        const relationships = [];
        for (const charId of activeChars) {
            const relations = kg.getRelations(charId, { types: ['friend', 'enemy', 'lover', 'family'] });
            relationships.push(...relations.map(rel => ({
                from: rel.from,
                to: rel.to,
                type: rel.type
            })));
        }

        return relationships.slice(0, 10);
    }

    /**
     * 适配 token 限制
     */
    fitToTokenLimit(compressed, maxTokens) {
        // 简单估算：1 token ≈ 4 字符（中文）
        const estimateTokens = (obj) => {
            return JSON.stringify(obj).length / 4;
        };

        let currentTokens = estimateTokens(compressed);

        // 如果超出限制，逐步裁剪补充信息
        if (currentTokens > maxTokens) {
            // 第一步：移除补充信息
            delete compressed.supplementary;
            currentTokens = estimateTokens(compressed);
        }

        if (currentTokens > maxTokens) {
            // 第二步：裁剪重要信息
            if (compressed.important.recentHistory) {
                compressed.important.recentHistory = compressed.important.recentHistory.slice(-3);
            }
            if (compressed.important.keyEvents) {
                compressed.important.keyEvents = compressed.important.keyEvents.slice(0, 3);
            }
            currentTokens = estimateTokens(compressed);
        }

        if (currentTokens > maxTokens) {
            // 第三步：只保留核心信息
            return { core: compressed.core };
        }

        return compressed;
    }

    /**
     * 格式化为 prompt 文本
     */
    formatForPrompt(compressed) {
        const sections = [];

        // 核心信息
        if (compressed.core) {
            sections.push('【当前状态】');
            sections.push(`回合: ${compressed.core.currentTurn}`);
            sections.push(`地点: ${compressed.core.currentLocation}`);
            sections.push(`玩家: ${compressed.core.playerName} (Lv.${compressed.core.playerLevel})`);

            if (compressed.core.activeQuests?.length > 0) {
                sections.push(`当前任务: ${compressed.core.activeQuests.map(q => q.name).join('、')}`);
            }
        }

        // 重要信息
        if (compressed.important) {
            if (compressed.important.recentHistory?.length > 0) {
                sections.push('\n【最近历史】');
                compressed.important.recentHistory.forEach(h => {
                    sections.push(`第${h.turn}回合: ${h.action}`);
                    if (h.response) {
                        sections.push(`→ ${h.response.slice(0, 100)}...`);
                    }
                });
            }

            if (compressed.important.activeCharacters?.length > 0) {
                sections.push('\n【在场角色】');
                compressed.important.activeCharacters.forEach(char => {
                    sections.push(`- ${char.name} (${char.role}): ${char.personality}`);
                });
            }

            if (compressed.important.keyEvents?.length > 0) {
                sections.push('\n【关键事件】');
                compressed.important.keyEvents.forEach(event => {
                    sections.push(`- ${event.summary}`);
                });
            }
        }

        // 补充信息
        if (compressed.supplementary) {
            if (compressed.supplementary.worldview) {
                sections.push('\n【世界观】');
                sections.push(compressed.supplementary.worldview.summary);
            }

            if (compressed.supplementary.chapter) {
                sections.push('\n【当前章节】');
                sections.push(`${compressed.supplementary.chapter.title}: ${compressed.supplementary.chapter.goal}`);
            }
        }

        return sections.join('\n');
    }
}

module.exports = ContextCompressor;