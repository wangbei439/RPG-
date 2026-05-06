const CausalChain = require('../../engine/CausalChain');

describe('CausalChain - 因果链', () => {
    let chain;

    beforeEach(() => {
        chain = new CausalChain();
    });

    describe('addCause - 添加因果关系', () => {
        test('应能添加因果关系并返回链条数据', () => {
            const result = chain.addCause('起火', '房屋烧毁');
            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.cause).toBe('起火');
            expect(result.effect).toBe('房屋烧毁');
            expect(result.strength).toBe(5); // 默认强度
            expect(result.type).toBe('direct'); // 默认类型
            expect(result.timestamp).toBeDefined();
        });

        test('应能设置自定义强度和类型', () => {
            const result = chain.addCause('原因', '结果', {
                strength: 8,
                type: 'indirect',
                condition: '条件满足时'
            });
            expect(result.strength).toBe(8);
            expect(result.type).toBe('indirect');
            expect(result.condition).toBe('条件满足时');
        });
    });

    describe('getReasons - 查询原因（为什么会这样）', () => {
        test('应能查询直接原因', () => {
            chain.addCause('起火', '房屋烧毁');
            const reasons = chain.getReasons('房屋烧毁');
            expect(reasons).toHaveLength(1);
            expect(reasons[0].cause).toBe('起火');
            expect(reasons[0].depth).toBe(0);
        });

        test('应能递归查询深层原因', () => {
            chain.addCause('雷击', '起火', { strength: 7 });
            chain.addCause('起火', '房屋烧毁', { strength: 8 });

            const reasons = chain.getReasons('房屋烧毁');
            expect(reasons.length).toBeGreaterThanOrEqual(2);

            // 深度为0的是直接原因
            const directReason = reasons.find(r => r.depth === 0);
            expect(directReason.cause).toBe('起火');

            // 深度为1的是间接原因
            const indirectReason = reasons.find(r => r.depth === 1);
            expect(indirectReason.cause).toBe('雷击');
        });

        test('查询不存在结果的原因应返回空数组', () => {
            expect(chain.getReasons('不存在')).toEqual([]);
        });

        test('应能通过 minStrength 过滤弱因果关系', () => {
            chain.addCause('微弱原因', '结果', { strength: 2 });
            chain.addCause('强原因', '结果', { strength: 8 });

            const reasons = chain.getReasons('结果', { minStrength: 5 });
            expect(reasons).toHaveLength(1);
            expect(reasons[0].cause).toBe('强原因');
        });
    });

    describe('getConsequences - 查询结果（这会导致什么）', () => {
        test('应能查询直接结果', () => {
            chain.addCause('起火', '房屋烧毁');
            chain.addCause('起火', '人员受伤');

            const consequences = chain.getConsequences('起火');
            expect(consequences).toHaveLength(2);
        });

        test('应能递归查询深层结果', () => {
            chain.addCause('起火', '房屋烧毁');
            chain.addCause('房屋烧毁', '流离失所');

            const consequences = chain.getConsequences('起火');
            expect(consequences.length).toBeGreaterThanOrEqual(2);

            const direct = consequences.find(c => c.depth === 0 && c.effect === '房屋烧毁');
            const indirect = consequences.find(c => c.depth === 1 && c.effect === '流离失所');
            expect(direct).toBeDefined();
            expect(indirect).toBeDefined();
        });

        test('查询不存在原因的结果应返回空数组', () => {
            expect(chain.getConsequences('不存在')).toEqual([]);
        });
    });

    describe('findCausalPath - 因果路径查找', () => {
        test('应能找到两个事件之间的因果路径', () => {
            chain.addCause('A', 'B');
            chain.addCause('B', 'C');

            const paths = chain.findCausalPath('A', 'C', 5);
            expect(paths.length).toBeGreaterThan(0);
            expect(paths[0][0].cause).toBe('A');
            expect(paths[0][0].effect).toBe('B');
        });

        test('不连通的事件应返回空路径', () => {
            chain.addCause('A', 'B');
            chain.addCause('C', 'D');

            const paths = chain.findCausalPath('A', 'D', 5);
            expect(paths).toHaveLength(0);
        });

        test('应尊重 maxDepth 限制', () => {
            chain.addCause('A', 'B');
            chain.addCause('B', 'C');
            chain.addCause('C', 'D');

            // 深度太小，找不到路径
            const shallowPaths = chain.findCausalPath('A', 'D', 2);
            // 深度足够，能找到路径
            const deepPaths = chain.findCausalPath('A', 'D', 5);
            expect(deepPaths.length).toBeGreaterThanOrEqual(shallowPaths.length);
        });
    });

    describe('validateConsistency - 循环依赖检测', () => {
        test('应能检测到循环因果', () => {
            chain.addCause('A', 'B');
            chain.addCause('B', 'A');

            const issues = chain.validateConsistency();
            expect(issues.length).toBeGreaterThan(0);
            expect(issues.some(i => i.type === 'circular')).toBe(true);
        });

        test('无循环因果时应返回空问题列表', () => {
            chain.addCause('A', 'B');
            chain.addCause('B', 'C');

            const issues = chain.validateConsistency();
            expect(issues.filter(i => i.type === 'circular')).toHaveLength(0);
        });
    });

    describe('getSummary - 因果网络摘要', () => {
        test('应能返回正确的摘要统计', () => {
            chain.addCause('A', 'B', { strength: 8 });
            chain.addCause('A', 'C', { strength: 5 });
            chain.addCause('B', 'D', { strength: 3 });

            const summary = chain.getSummary();
            expect(summary.totalChains).toBe(3);
            expect(summary.topCauses.length).toBeGreaterThan(0);
            expect(summary.topEffects.length).toBeGreaterThan(0);
        });

        test('topCauses 应按总强度排序', () => {
            chain.addCause('强原因', '结果1', { strength: 9 });
            chain.addCause('强原因', '结果2', { strength: 8 });
            chain.addCause('弱原因', '结果3', { strength: 2 });

            const summary = chain.getSummary();
            expect(summary.topCauses[0].cause).toBe('强原因');
            expect(summary.topCauses[0].totalStrength).toBe(17);
        });
    });

    describe('toJSON / fromJSON - 序列化与恢复', () => {
        test('应能正确序列化和反序列化', () => {
            chain.addCause('起火', '房屋烧毁', { strength: 7 });
            chain.addCause('雷击', '起火', { strength: 5 });

            const json = chain.toJSON();
            const newChain = new CausalChain();
            newChain.fromJSON(json);

            expect(newChain.chains).toHaveLength(2);
            const reasons = newChain.getReasons('房屋烧毁');
            expect(reasons.length).toBeGreaterThanOrEqual(1);
        });
    });
});
