const KnowledgeGraph = require('../../engine/KnowledgeGraph');

describe('KnowledgeGraph - 知识图谱', () => {
    let kg;

    beforeEach(() => {
        kg = new KnowledgeGraph();
    });

    describe('addEntity / getEntity - 添加与获取实体', () => {
        test('应能添加实体并通过 id 获取', () => {
            const entity = kg.addEntity('character', 'char_1', { name: '李明', role: '主角' });
            expect(entity).toBeDefined();
            expect(entity.id).toBe('char_1');
            expect(entity.type).toBe('character');
            expect(entity.name).toBe('李明');

            const fetched = kg.getEntity('char_1');
            expect(fetched).toBe(entity);
        });

        test('获取不存在的实体应返回 undefined', () => {
            expect(kg.getEntity('nonexistent')).toBeUndefined();
        });

        test('添加实体时应自动设置 createdAt 和 updatedAt', () => {
            const entity = kg.addEntity('location', 'loc_1', { name: '村庄' });
            expect(entity.createdAt).toBeDefined();
            expect(entity.updatedAt).toBeDefined();
            expect(typeof entity.createdAt).toBe('number');
        });
    });

    describe('updateEntity - 更新实体', () => {
        test('应能更新实体属性', () => {
            kg.addEntity('character', 'char_1', { name: '李明', level: 1 });
            const updated = kg.updateEntity('char_1', { level: 5 });
            expect(updated.level).toBe(5);
            expect(updated.name).toBe('李明');
            expect(updated.updatedAt).toBeGreaterThanOrEqual(updated.createdAt);
        });

        test('更新不存在的实体应返回 null', () => {
            expect(kg.updateEntity('nonexistent', { level: 5 })).toBeNull();
        });
    });

    describe('addRelation / getRelations - 添加与获取关系', () => {
        test('应能添加关系并通过 getRelations 获取', () => {
            kg.addEntity('character', 'char_1', { name: '李明' });
            kg.addEntity('character', 'char_2', { name: '王芳' });
            kg.addRelation('char_1', 'char_2', 'friend', { description: '好朋友' });

            const relations = kg.getRelations('char_1', { direction: 'out' });
            expect(relations).toHaveLength(1);
            expect(relations[0].type).toBe('friend');
            expect(relations[0].to).toBe('char_2');
            expect(relations[0].direction).toBe('out');
        });

        test('应能获取入向关系', () => {
            kg.addEntity('character', 'char_1', { name: '李明' });
            kg.addEntity('character', 'char_2', { name: '王芳' });
            kg.addRelation('char_1', 'char_2', 'friend');

            const inRelations = kg.getRelations('char_2', { direction: 'in' });
            expect(inRelations).toHaveLength(1);
            expect(inRelations[0].from).toBe('char_1');
        });

        test('应能获取双向关系', () => {
            kg.addEntity('character', 'char_1', { name: '李明' });
            kg.addEntity('character', 'char_2', { name: '王芳' });
            kg.addRelation('char_1', 'char_2', 'friend');
            kg.addRelation('char_2', 'char_1', 'mentor');

            const bothRelations = kg.getRelations('char_1', { direction: 'both' });
            expect(bothRelations).toHaveLength(2);
        });

        test('应能按类型过滤关系', () => {
            kg.addEntity('character', 'char_1', { name: '李明' });
            kg.addEntity('character', 'char_2', { name: '王芳' });
            kg.addEntity('character', 'char_3', { name: '赵强' });
            kg.addRelation('char_1', 'char_2', 'friend');
            kg.addRelation('char_1', 'char_3', 'enemy');

            const friendRelations = kg.getRelations('char_1', { types: ['friend'] });
            expect(friendRelations).toHaveLength(1);
            expect(friendRelations[0].type).toBe('friend');
        });
    });

    describe('getEntitiesByType - 按类型获取实体', () => {
        test('应能按类型获取所有实体', () => {
            kg.addEntity('character', 'char_1', { name: '李明' });
            kg.addEntity('character', 'char_2', { name: '王芳' });
            kg.addEntity('location', 'loc_1', { name: '村庄' });

            const characters = kg.getEntitiesByType('character');
            expect(characters).toHaveLength(2);

            const locations = kg.getEntitiesByType('location');
            expect(locations).toHaveLength(1);
        });

        test('查询不存在的类型应返回空数组', () => {
            expect(kg.getEntitiesByType('nonexistent')).toEqual([]);
        });
    });

    describe('findPath - BFS路径查找', () => {
        test('应能找到两个实体之间的路径', () => {
            kg.addEntity('character', 'A', { name: 'A' });
            kg.addEntity('character', 'B', { name: 'B' });
            kg.addEntity('character', 'C', { name: 'C' });
            kg.addRelation('A', 'B', 'knows');
            kg.addRelation('B', 'C', 'knows');

            const paths = kg.findPath('A', 'C', 3);
            expect(paths.length).toBeGreaterThan(0);
            expect(paths[0][0]).toBe('A');
            expect(paths[0][paths[0].length - 1]).toBe('C');
        });

        test('同一实体到自身应返回自身路径', () => {
            kg.addEntity('character', 'A', { name: 'A' });
            const paths = kg.findPath('A', 'A');
            expect(paths).toHaveLength(1);
            expect(paths[0]).toEqual(['A']);
        });

        test('不连通的实体应返回空路径', () => {
            kg.addEntity('character', 'A', { name: 'A' });
            kg.addEntity('character', 'D', { name: 'D' });
            const paths = kg.findPath('A', 'D', 3);
            expect(paths).toHaveLength(0);
        });
    });

    describe('queryRelevant - 查询相关实体', () => {
        test('应能查询深度内的相关实体', () => {
            kg.addEntity('character', 'A', { name: 'A' });
            kg.addEntity('character', 'B', { name: 'B' });
            kg.addEntity('character', 'C', { name: 'C' });
            kg.addRelation('A', 'B', 'knows');
            kg.addRelation('B', 'C', 'knows');

            const relevant = kg.queryRelevant(['A'], { maxDepth: 1 });
            expect(relevant.length).toBeGreaterThanOrEqual(2); // A and B
        });

        test('应能通过 maxDepth 限制查询深度', () => {
            kg.addEntity('character', 'A', { name: 'A' });
            kg.addEntity('character', 'B', { name: 'B' });
            kg.addEntity('character', 'C', { name: 'C' });
            kg.addRelation('A', 'B', 'knows');
            kg.addRelation('B', 'C', 'knows');

            const depth1 = kg.queryRelevant(['A'], { maxDepth: 1 });
            const depth2 = kg.queryRelevant(['A'], { maxDepth: 2 });
            expect(depth2.length).toBeGreaterThanOrEqual(depth1.length);
        });

        test('应能通过 limit 限制结果数量', () => {
            kg.addEntity('character', 'A', { name: 'A' });
            kg.addEntity('character', 'B', { name: 'B' });
            kg.addEntity('character', 'C', { name: 'C' });
            kg.addRelation('A', 'B', 'knows');
            kg.addRelation('A', 'C', 'knows');

            const limited = kg.queryRelevant(['A'], { maxDepth: 1, limit: 2 });
            expect(limited.length).toBeLessThanOrEqual(2);
        });
    });

    describe('getStats - 统计信息', () => {
        test('应能返回正确的统计信息', () => {
            kg.addEntity('character', 'char_1', { name: '李明' });
            kg.addEntity('character', 'char_2', { name: '王芳' });
            kg.addEntity('location', 'loc_1', { name: '村庄' });
            kg.addRelation('char_1', 'char_2', 'friend');

            const stats = kg.getStats();
            expect(stats.totalNodes).toBe(3);
            expect(stats.totalEdges).toBe(1);
            expect(stats.nodesByType.character).toBe(2);
            expect(stats.nodesByType.location).toBe(1);
        });
    });

    describe('toJSON / fromJSON - 序列化与恢复', () => {
        test('应能正确序列化和反序列化', () => {
            kg.addEntity('character', 'char_1', { name: '李明' });
            kg.addEntity('location', 'loc_1', { name: '村庄' });
            kg.addRelation('char_1', 'loc_1', 'located_at');

            const json = kg.toJSON();
            const newKg = new KnowledgeGraph();
            newKg.fromJSON(json);

            expect(newKg.getEntity('char_1')).toBeDefined();
            expect(newKg.getEntity('loc_1')).toBeDefined();
            expect(newKg.getEntitiesByType('character')).toHaveLength(1);
            expect(newKg.getStats().totalEdges).toBe(1);
        });
    });

    describe('循环关系 - 边界情况', () => {
        test('应能处理循环关系（A→B→A）', () => {
            kg.addEntity('character', 'A', { name: 'A' });
            kg.addEntity('character', 'B', { name: 'B' });
            kg.addRelation('A', 'B', 'friend');
            kg.addRelation('B', 'A', 'friend');

            const relationsA = kg.getRelations('A', { direction: 'both' });
            expect(relationsA.length).toBe(2);
        });

        test('findPath 在循环关系中不应无限循环', () => {
            kg.addEntity('character', 'A', { name: 'A' });
            kg.addEntity('character', 'B', { name: 'B' });
            kg.addEntity('character', 'C', { name: 'C' });
            kg.addRelation('A', 'B', 'knows');
            kg.addRelation('B', 'A', 'knows');
            kg.addRelation('B', 'C', 'knows');

            // Should terminate and find path
            const paths = kg.findPath('A', 'C', 3);
            expect(paths.length).toBeGreaterThan(0);
        });
    });
});
