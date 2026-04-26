/**
 * 因果链 - 追踪事件之间的因果关系
 * 用于回答"为什么会这样"和"这会导致什么"
 */
class CausalChain {
    constructor() {
        this.chains = [];
        this.causeIndex = new Map(); // 原因索引
        this.effectIndex = new Map(); // 结果索引
    }

    /**
     * 添加因果关系
     */
    addCause(cause, effect, options = {}) {
        const chain = {
            id: `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            cause: cause, // 原因描述或事件ID
            effect: effect, // 结果描述或事件ID
            strength: options.strength || 5, // 因果强度 1-10
            type: options.type || 'direct', // 'direct', 'indirect', 'conditional'
            condition: options.condition || null, // 条件（如果是条件因果）
            timestamp: Date.now()
        };

        this.chains.push(chain);

        // 更新索引
        this.updateIndex(this.causeIndex, cause, chain.id);
        this.updateIndex(this.effectIndex, effect, chain.id);

        return chain;
    }

    /**
     * 更新索引
     */
    updateIndex(index, key, chainId) {
        if (!index.has(key)) {
            index.set(key, new Set());
        }
        index.get(key).add(chainId);
    }

    /**
     * 查询原因（为什么会这样）
     */
    getReasons(effect, options = {}) {
        const { maxDepth = 3, minStrength = 1 } = options;
        const chainIds = this.effectIndex.get(effect);
        if (!chainIds) return [];

        const reasons = [];
        const visited = new Set();

        const explore = (currentEffect, depth) => {
            if (depth > maxDepth) return;
            if (visited.has(currentEffect)) return;
            visited.add(currentEffect);

            const ids = this.effectIndex.get(currentEffect);
            if (!ids) return;

            for (const id of ids) {
                const chain = this.chains.find(c => c.id === id);
                if (!chain || chain.strength < minStrength) continue;

                reasons.push({
                    ...chain,
                    depth
                });

                // 递归查找更深层的原因
                explore(chain.cause, depth + 1);
            }
        };

        explore(effect, 0);

        return reasons.sort((a, b) => {
            // 按深度和强度排序
            if (a.depth !== b.depth) return a.depth - b.depth;
            return b.strength - a.strength;
        });
    }

    /**
     * 查询结果（这会导致什么）
     */
    getConsequences(cause, options = {}) {
        const { maxDepth = 3, minStrength = 1 } = options;
        const chainIds = this.causeIndex.get(cause);
        if (!chainIds) return [];

        const consequences = [];
        const visited = new Set();

        const explore = (currentCause, depth) => {
            if (depth > maxDepth) return;
            if (visited.has(currentCause)) return;
            visited.add(currentCause);

            const ids = this.causeIndex.get(currentCause);
            if (!ids) return;

            for (const id of ids) {
                const chain = this.chains.find(c => c.id === id);
                if (!chain || chain.strength < minStrength) continue;

                consequences.push({
                    ...chain,
                    depth
                });

                // 递归查找更深层的结果
                explore(chain.effect, depth + 1);
            }
        };

        explore(cause, 0);

        return consequences.sort((a, b) => {
            // 按深度和强度排序
            if (a.depth !== b.depth) return a.depth - b.depth;
            return b.strength - a.strength;
        });
    }

    /**
     * 查找因果路径
     */
    findCausalPath(from, to, maxDepth = 5) {
        const paths = [];
        const visited = new Set();

        const explore = (current, path, depth) => {
            if (depth > maxDepth) return;
            if (visited.has(current)) return;
            visited.add(current);

            if (current === to) {
                paths.push([...path]);
                return;
            }

            const ids = this.causeIndex.get(current);
            if (!ids) return;

            for (const id of ids) {
                const chain = this.chains.find(c => c.id === id);
                if (!chain) continue;

                explore(chain.effect, [...path, chain], depth + 1);
            }
        };

        explore(from, [], 0);
        return paths;
    }

    /**
     * 获取因果网络摘要
     */
    getSummary() {
        const causes = new Map();
        const effects = new Map();

        for (const chain of this.chains) {
            // 统计每个原因的影响力
            if (!causes.has(chain.cause)) {
                causes.set(chain.cause, { count: 0, totalStrength: 0 });
            }
            const causeData = causes.get(chain.cause);
            causeData.count++;
            causeData.totalStrength += chain.strength;

            // 统计每个结果的被影响程度
            if (!effects.has(chain.effect)) {
                effects.set(chain.effect, { count: 0, totalStrength: 0 });
            }
            const effectData = effects.get(chain.effect);
            effectData.count++;
            effectData.totalStrength += chain.strength;
        }

        return {
            totalChains: this.chains.length,
            topCauses: Array.from(causes.entries())
                .sort((a, b) => b[1].totalStrength - a[1].totalStrength)
                .slice(0, 10)
                .map(([cause, data]) => ({ cause, ...data })),
            topEffects: Array.from(effects.entries())
                .sort((a, b) => b[1].totalStrength - a[1].totalStrength)
                .slice(0, 10)
                .map(([effect, data]) => ({ effect, ...data }))
        };
    }

    /**
     * 验证因果一致性
     */
    validateConsistency() {
        const issues = [];

        // 检查循环因果
        for (const chain of this.chains) {
            const path = this.findCausalPath(chain.effect, chain.cause, 5);
            if (path.length > 0) {
                issues.push({
                    type: 'circular',
                    chain,
                    path: path[0]
                });
            }
        }

        // 检查矛盾因果（同一原因导致相反结果）
        for (const [cause, chainIds] of this.causeIndex) {
            const chains = Array.from(chainIds)
                .map(id => this.chains.find(c => c.id === id))
                .filter(Boolean);

            // 这里可以添加更复杂的矛盾检测逻辑
            // 例如：检查是否有相反的结果描述
        }

        return issues;
    }

    /**
     * 导出为 JSON
     */
    toJSON() {
        return {
            chains: this.chains
        };
    }

    /**
     * 从 JSON 恢复
     */
    fromJSON(data) {
        this.chains = [];
        this.causeIndex.clear();
        this.effectIndex.clear();

        if (data.chains) {
            for (const chain of data.chains) {
                this.chains.push(chain);
                this.updateIndex(this.causeIndex, chain.cause, chain.id);
                this.updateIndex(this.effectIndex, chain.effect, chain.id);
            }
        }
    }
}

module.exports = CausalChain;
