/**
 * 知识图谱 - 追踪实体和关系
 * 用于维护角色、地点、物品之间的关系网络
 */
class KnowledgeGraph {
    constructor() {
        this.nodes = new Map(); // 实体节点
        this.edges = new Map(); // 关系边
        this.entityIndex = new Map(); // 类型索引
    }

    /**
     * 添加实体节点
     */
    addEntity(type, id, properties = {}) {
        this.nodes.set(id, {
            type,
            id,
            ...properties,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        // 更新类型索引
        if (!this.entityIndex.has(type)) {
            this.entityIndex.set(type, new Set());
        }
        this.entityIndex.get(type).add(id);

        return this.nodes.get(id);
    }

    /**
     * 更新实体属性
     */
    updateEntity(id, properties) {
        const entity = this.nodes.get(id);
        if (!entity) return null;

        Object.assign(entity, properties, { updatedAt: Date.now() });
        return entity;
    }

    /**
     * 获取实体
     */
    getEntity(id) {
        return this.nodes.get(id);
    }

    /**
     * 按类型获取所有实体
     */
    getEntitiesByType(type) {
        const ids = this.entityIndex.get(type);
        if (!ids) return [];
        return Array.from(ids).map(id => this.nodes.get(id));
    }

    /**
     * 添加关系
     */
    addRelation(from, to, type, properties = {}) {
        const key = `${from}:${type}:${to}`;

        this.edges.set(key, {
            from,
            to,
            type,
            ...properties,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        return this.edges.get(key);
    }

    /**
     * 更新关系
     */
    updateRelation(from, to, type, properties) {
        const key = `${from}:${type}:${to}`;
        const relation = this.edges.get(key);
        if (!relation) return null;

        Object.assign(relation, properties, { updatedAt: Date.now() });
        return relation;
    }

    /**
     * 获取实体的所有关系
     */
    getRelations(entityId, options = {}) {
        const { direction = 'both', types = [] } = options;
        const relations = [];

        for (const [key, edge] of this.edges) {
            const matchType = types.length === 0 || types.includes(edge.type);

            if (direction === 'out' || direction === 'both') {
                if (edge.from === entityId && matchType) {
                    relations.push({
                        ...edge,
                        direction: 'out',
                        target: this.nodes.get(edge.to)
                    });
                }
            }

            if (direction === 'in' || direction === 'both') {
                if (edge.to === entityId && matchType) {
                    relations.push({
                        ...edge,
                        direction: 'in',
                        target: this.nodes.get(edge.from)
                    });
                }
            }
        }

        return relations;
    }

    /**
     * 查找两个实体之间的路径（用于推理）
     */
    findPath(fromId, toId, maxDepth = 3) {
        if (fromId === toId) return [[fromId]];

        const visited = new Set();
        const queue = [[fromId]];
        const paths = [];

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];

            if (path.length > maxDepth) continue;
            if (visited.has(current)) continue;
            visited.add(current);

            const relations = this.getRelations(current, { direction: 'out' });

            for (const rel of relations) {
                const next = rel.to;
                const newPath = [...path, next];

                if (next === toId) {
                    paths.push(newPath);
                } else if (newPath.length < maxDepth) {
                    queue.push(newPath);
                }
            }
        }

        return paths;
    }

    /**
     * 获取实体的邻居（一度关系）
     */
    getNeighbors(entityId, relationTypes = []) {
        const relations = this.getRelations(entityId, { types: relationTypes });
        return relations.map(rel => rel.target).filter(Boolean);
    }

    /**
     * 查询相关实体（用于上下文构建）
     */
    queryRelevant(entityIds, options = {}) {
        const { maxDepth = 2, limit = 20 } = options;
        const relevant = new Map();
        const queue = entityIds.map(id => ({ id, depth: 0 }));
        const visited = new Set();

        while (queue.length > 0) {
            const { id, depth } = queue.shift();

            if (visited.has(id)) continue;
            if (depth > maxDepth) continue;
            visited.add(id);

            const entity = this.nodes.get(id);
            if (entity) {
                relevant.set(id, { entity, depth });
            }

            if (depth < maxDepth) {
                const neighbors = this.getNeighbors(id);
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor.id)) {
                        queue.push({ id: neighbor.id, depth: depth + 1 });
                    }
                }
            }

            if (relevant.size >= limit) break;
        }

        return Array.from(relevant.values())
            .sort((a, b) => a.depth - b.depth)
            .map(item => item.entity);
    }

    /**
     * 导出为 JSON
     */
    toJSON() {
        return {
            nodes: Array.from(this.nodes.entries()),
            edges: Array.from(this.edges.entries())
        };
    }

    /**
     * 从 JSON 恢复
     */
    fromJSON(data) {
        this.nodes.clear();
        this.edges.clear();
        this.entityIndex.clear();

        if (data.nodes) {
            for (const [id, node] of data.nodes) {
                this.nodes.set(id, node);
                if (!this.entityIndex.has(node.type)) {
                    this.entityIndex.set(node.type, new Set());
                }
                this.entityIndex.get(node.type).add(id);
            }
        }

        if (data.edges) {
            for (const [key, edge] of data.edges) {
                this.edges.set(key, edge);
            }
        }
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const typeStats = {};
        for (const [type, ids] of this.entityIndex) {
            typeStats[type] = ids.size;
        }

        return {
            totalNodes: this.nodes.size,
            totalEdges: this.edges.size,
            nodesByType: typeStats
        };
    }
}

module.exports = KnowledgeGraph;
