const ConsistencyValidator = require('../../engine/ConsistencyValidator');
const KnowledgeGraph = require('../../engine/KnowledgeGraph');
const Timeline = require('../../engine/Timeline');
const CausalChain = require('../../engine/CausalChain');

/**
 * 创建模拟的 MemoryManager 对象
 * ConsistencyValidator 依赖 memory.semanticMemory.knowledgeGraph/timeline/causalChain
 */
function createMockMemoryManager(options = {}) {
    const kg = options.knowledgeGraph || new KnowledgeGraph();
    const timeline = options.timeline || new Timeline();
    const causalChain = options.causalChain || new CausalChain();

    return {
        semanticMemory: {
            knowledgeGraph: kg,
            timeline,
            causalChain
        }
    };
}

describe('ConsistencyValidator - 一致性验证器', () => {
    let validator;
    let mockMemory;

    beforeEach(() => {
        mockMemory = createMockMemoryManager();
        validator = new ConsistencyValidator(mockMemory);
        validator.initializeDefaultRules();
    });

    describe('规则1: 角色一致性 - character_consistency', () => {
        test('引用已知角色应通过验证', () => {
            mockMemory.semanticMemory.knowledgeGraph.addEntity('character', 'char_1', { name: '李明' });

            const result = validator.validate(
                { characters: ['char_1'] },
                {}
            );
            const charViolations = result.violations.filter(v => v.type === 'unknown_character');
            expect(charViolations).toHaveLength(0);
        });

        test('引用未知角色应产生违规', () => {
            const result = validator.validate(
                { characters: ['unknown_char'] },
                {}
            );
            const charViolations = result.violations.filter(v => v.type === 'unknown_character');
            expect(charViolations).toHaveLength(1);
            expect(charViolations[0].characterId).toBe('unknown_char');
        });

        test('多个未知角色应产生多个违规', () => {
            const result = validator.validate(
                { characters: ['unknown1', 'unknown2'] },
                {}
            );
            const charViolations = result.violations.filter(v => v.type === 'unknown_character');
            expect(charViolations).toHaveLength(2);
        });
    });

    describe('规则2: 地点一致性 - location_consistency', () => {
        test('引用已知地点应通过验证', () => {
            mockMemory.semanticMemory.knowledgeGraph.addEntity('location', 'loc_village', { name: '村庄' });

            const result = validator.validate(
                { location: 'loc_village' },
                {}
            );
            const locViolations = result.violations.filter(v => v.type === 'unknown_location');
            expect(locViolations).toHaveLength(0);
        });

        test('引用未知地点应产生违规', () => {
            const result = validator.validate(
                { location: 'unknown_loc' },
                {}
            );
            const locViolations = result.violations.filter(v => v.type === 'unknown_location');
            expect(locViolations).toHaveLength(1);
        });

        test('不可达的地点应产生违规', () => {
            const kg = mockMemory.semanticMemory.knowledgeGraph;
            kg.addEntity('location', 'loc_A', { name: '地点A' });
            kg.addEntity('location', 'loc_B', { name: '地点B' });
            // 没有路径从 loc_A 到 loc_B

            const result = validator.validate(
                { location: 'loc_B' },
                { currentLocation: 'loc_A' }
            );
            const unreachable = result.violations.filter(v => v.type === 'unreachable_location');
            expect(unreachable).toHaveLength(1);
        });

        test('可达的地点应通过验证', () => {
            const kg = mockMemory.semanticMemory.knowledgeGraph;
            kg.addEntity('location', 'loc_A', { name: '地点A' });
            kg.addEntity('location', 'loc_B', { name: '地点B' });
            kg.addRelation('loc_A', 'loc_B', 'connected');

            const result = validator.validate(
                { location: 'loc_B' },
                { currentLocation: 'loc_A' }
            );
            const unreachable = result.violations.filter(v => v.type === 'unreachable_location');
            expect(unreachable).toHaveLength(0);
        });
    });

    describe('规则3: 物品一致性 - item_consistency', () => {
        test('使用拥有的物品应通过验证', () => {
            const result = validator.validate(
                { itemsUsed: ['sword_1'] },
                { inventory: [{ id: 'sword_1', name: '长剑' }] }
            );
            const itemViolations = result.violations.filter(v => v.type === 'item_not_owned');
            expect(itemViolations).toHaveLength(0);
        });

        test('使用未拥有的物品应产生违规', () => {
            const result = validator.validate(
                { itemsUsed: ['sword_1'] },
                { inventory: [] }
            );
            const itemViolations = result.violations.filter(v => v.type === 'item_not_owned');
            expect(itemViolations).toHaveLength(1);
            expect(itemViolations[0].itemId).toBe('sword_1');
        });
    });

    describe('规则4: 时间线一致性 - timeline_consistency', () => {
        test('引用已发生的事件应通过验证', () => {
            mockMemory.semanticMemory.timeline.addEvent({
                id: 'evt_1', turn: 1, type: 'action', summary: '已发生事件'
            });

            const result = validator.validate(
                { referencedEvents: ['evt_1'] },
                { turn: 5 }
            );
            const timelineViolations = result.violations.filter(v => v.type === 'future_event_reference');
            expect(timelineViolations).toHaveLength(0);
        });

        test('引用未来事件应产生违规', () => {
            mockMemory.semanticMemory.timeline.addEvent({
                id: 'evt_future', turn: 10, type: 'action', summary: '未来事件'
            });

            const result = validator.validate(
                { referencedEvents: ['evt_future'] },
                { turn: 5 }
            );
            const timelineViolations = result.violations.filter(v => v.type === 'future_event_reference');
            expect(timelineViolations).toHaveLength(1);
        });
    });

    describe('规则5: 因果一致性 - causal_consistency', () => {
        test('有原因的结果应通过验证', () => {
            mockMemory.semanticMemory.causalChain.addCause('起火', '房屋烧毁');

            const result = validator.validate(
                { effect: '房屋烧毁' },
                {}
            );
            const causalViolations = result.violations.filter(v => v.type === 'unexplained_effect');
            expect(causalViolations).toHaveLength(0);
        });

        test('没有原因的结果应产生警告', () => {
            const result = validator.validate(
                { effect: '未知结果', cause: undefined },
                {}
            );
            const causalViolations = result.violations.filter(v => v.type === 'unexplained_effect');
            expect(causalViolations).toHaveLength(1);
        });
    });

    describe('规则6: 角色关系一致性 - relationship_consistency', () => {
        test('合理的关系变化应通过验证', () => {
            const kg = mockMemory.semanticMemory.knowledgeGraph;
            kg.addEntity('character', 'char_1', { name: '李明' });
            kg.addEntity('character', 'char_2', { name: '王芳' });
            kg.addRelation('char_1', 'char_2', 'friend');

            const result = validator.validate(
                {
                    relationshipChanges: [{
                        from: 'char_1',
                        to: 'char_2',
                        type: 'friend',
                        newType: 'lover'
                    }]
                },
                {}
            );
            const relViolations = result.violations.filter(v => v.type === 'incompatible_relationship_change');
            expect(relViolations).toHaveLength(0); // friend → lover 是兼容的
        });

        test('不兼容的关系变化应产生违规', () => {
            const kg = mockMemory.semanticMemory.knowledgeGraph;
            kg.addEntity('character', 'char_1', { name: '李明' });
            kg.addEntity('character', 'char_2', { name: '敌人' });
            kg.addRelation('char_1', 'char_2', 'enemy');

            const result = validator.validate(
                {
                    relationshipChanges: [{
                        from: 'char_1',
                        to: 'char_2',
                        type: 'enemy',
                        newType: 'lover'
                    }]
                },
                {}
            );
            const relViolations = result.violations.filter(v => v.type === 'incompatible_relationship_change');
            expect(relViolations).toHaveLength(1);
        });
    });

    describe('validate - 综合验证', () => {
        test('无违规时应返回 valid: true', () => {
            const result = validator.validate({}, {});
            expect(result.valid).toBe(true);
            expect(result.violations).toHaveLength(0);
        });

        test('有 error 级别违规时应返回 valid: false', () => {
            // unknown_character 是 error 级别
            const result = validator.validate(
                { characters: ['unknown'] },
                {}
            );
            expect(result.valid).toBe(false);
        });

        test('仅有 warning 级别违规时应返回 valid: true', () => {
            // unexplained_effect 是 warning 级别
            const result = validator.validate(
                { effect: '未知结果' },
                {}
            );
            // 只有 warning，没有 error
            expect(result.valid).toBe(true);
        });
    });

    describe('getReport - 验证报告', () => {
        test('应能返回分类统计的报告', () => {
            validator.validate(
                { characters: ['unknown'], effect: '未知结果' },
                {}
            );

            const report = validator.getReport();
            expect(report.summary.total).toBeGreaterThan(0);
            expect(typeof report.summary.errors).toBe('number');
            expect(typeof report.summary.warnings).toBe('number');
            expect(Array.isArray(report.errors)).toBe(true);
            expect(Array.isArray(report.warnings)).toBe(true);
        });
    });

    describe('getSuggestions - 修复建议', () => {
        test('应为不同违规类型提供建议', () => {
            validator.validate(
                { characters: ['unknown_char'], location: 'unknown_loc', itemsUsed: ['item_1'] },
                { inventory: [] }
            );

            const suggestions = validator.getSuggestions(validator.violations);
            expect(suggestions.length).toBeGreaterThan(0);

            const types = suggestions.map(s => s.violation.type);
            expect(types).toContain('unknown_character');
            expect(types).toContain('unknown_location');
            expect(types).toContain('item_not_owned');
        });
    });

    describe('checkIncompatibleRelations - 不兼容关系检查', () => {
        test('enemy → lover 应不兼容', () => {
            expect(validator.checkIncompatibleRelations('enemy', 'lover')).toBe(true);
        });

        test('stranger → family 应不兼容', () => {
            expect(validator.checkIncompatibleRelations('stranger', 'family')).toBe(true);
        });

        test('friend → lover 应兼容', () => {
            expect(validator.checkIncompatibleRelations('friend', 'lover')).toBe(false);
        });

        test('enemy → stranger 应兼容', () => {
            expect(validator.checkIncompatibleRelations('enemy', 'stranger')).toBe(false);
        });
    });

    describe('addRule - 自定义规则', () => {
        test('应能添加自定义验证规则', () => {
            validator.addRule({
                id: 'custom_rule',
                name: '自定义规则',
                severity: 'warning',
                message: '自定义规则违规',
                check: (content, context) => {
                    if (content.customField === 'bad') {
                        return [{ type: 'custom_violation', message: '自定义违规' }];
                    }
                    return [];
                }
            });

            const result = validator.validate({ customField: 'bad' }, {});
            const customViolations = result.violations.filter(v => v.ruleId === 'custom_rule');
            expect(customViolations).toHaveLength(1);
        });
    });
});
