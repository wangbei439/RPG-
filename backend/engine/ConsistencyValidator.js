/**
 * 一致性验证器 - 确保生成内容与已有设定不冲突
 */
class ConsistencyValidator {
    constructor(memoryManager) {
        this.memory = memoryManager;
        this.rules = [];
        this.violations = [];
    }

    /**
     * 添加一致性规则
     */
    addRule(rule) {
        this.rules.push({
            id: rule.id || `rule_${Date.now()}`,
            name: rule.name,
            check: rule.check, // 验证函数
            severity: rule.severity || 'error', // 'error', 'warning', 'info'
            message: rule.message
        });
    }

    /**
     * 初始化默认规则
     */
    initializeDefaultRules() {
        // 规则1: 角色一致性
        this.addRule({
            id: 'character_consistency',
            name: '角色一致性',
            severity: 'error',
            message: '角色行为与已知性格不符',
            check: (content, context) => {
                const kg = this.memory.semanticMemory.knowledgeGraph;
                const violations = [];

                // 检查角色是否存在
                if (content.characters) {
                    for (const charId of content.characters) {
                        const entity = kg.getEntity(charId);
                        if (!entity) {
                            violations.push({
                                type: 'unknown_character',
                                characterId: charId,
                                message: `未知角色: ${charId}`
                            });
                        }
                    }
                }

                return violations;
            }
        });

        // 规则2: 地点一致性
        this.addRule({
            id: 'location_consistency',
            name: '地点一致性',
            severity: 'error',
            message: '地点不存在或无法到达',
            check: (content, context) => {
                const kg = this.memory.semanticMemory.knowledgeGraph;
                const violations = [];

                if (content.location) {
                    const entity = kg.getEntity(content.location);
                    if (!entity) {
                        violations.push({
                            type: 'unknown_location',
                            location: content.location,
                            message: `未知地点: ${content.location}`
                        });
                    } else if (context.currentLocation) {
                        // 检查是否可达
                        const paths = kg.findPath(context.currentLocation, content.location, 2);
                        if (paths.length === 0) {
                            violations.push({
                                type: 'unreachable_location',
                                from: context.currentLocation,
                                to: content.location,
                                message: `无法从 ${context.currentLocation} 到达 ${content.location}`
                            });
                        }
                    }
                }

                return violations;
            }
        });

        // 规则3: 物品一致性
        this.addRule({
            id: 'item_consistency',
            name: '物品一致性',
            severity: 'error',
            message: '物品使用不合理',
            check: (content, context) => {
                const violations = [];

                if (content.itemsUsed) {
                    for (const itemId of content.itemsUsed) {
                        // 检查玩家是否拥有该物品
                        const hasItem = context.inventory?.some(i => i.id === itemId);
                        if (!hasItem) {
                            violations.push({
                                type: 'item_not_owned',
                                itemId,
                                message: `玩家没有物品: ${itemId}`
                            });
                        }
                    }
                }

                return violations;
            }
        });

        // 规则4: 时间线一致性
        this.addRule({
            id: 'timeline_consistency',
            name: '时间线一致性',
            severity: 'warning',
            message: '事件顺序不合理',
            check: (content, context) => {
                const violations = [];
                const timeline = this.memory.semanticMemory.timeline;

                // 检查是否引用了未来事件
                if (content.referencedEvents) {
                    for (const eventId of content.referencedEvents) {
                        const event = timeline.events.find(e => e.id === eventId);
                        if (event && event.turn > context.turn) {
                            violations.push({
                                type: 'future_event_reference',
                                eventId,
                                message: `引用了未来事件: ${eventId}`
                            });
                        }
                    }
                }

                return violations;
            }
        });

        // 规则5: 因果一致性
        this.addRule({
            id: 'causal_consistency',
            name: '因果一致性',
            severity: 'warning',
            message: '因果关系不合理',
            check: (content, context) => {
                const violations = [];
                const causalChain = this.memory.semanticMemory.causalChain;

                // 检查结果是否有合理的原因
                if (content.effect && !content.cause) {
                    const reasons = causalChain.getReasons(content.effect);
                    if (reasons.length === 0) {
                        violations.push({
                            type: 'unexplained_effect',
                            effect: content.effect,
                            message: `结果缺少原因: ${content.effect}`
                        });
                    }
                }

                return violations;
            }
        });

        // 规则6: 角色关系一致性
        this.addRule({
            id: 'relationship_consistency',
            name: '角色关系一致性',
            severity: 'warning',
            message: '角色关系变化不合理',
            check: (content, context) => {
                const kg = this.memory.semanticMemory.knowledgeGraph;
                const violations = [];

                if (content.relationshipChanges) {
                    for (const change of content.relationshipChanges) {
                        const existing = kg.getRelations(change.from, {
                            direction: 'out',
                            types: [change.type]
                        }).find(r => r.to === change.to);

                        if (existing && change.newType) {
                            // 检查关系变化是否合理
                            const incompatible = this.checkIncompatibleRelations(
                                existing.type,
                                change.newType
                            );
                            if (incompatible) {
                                violations.push({
                                    type: 'incompatible_relationship_change',
                                    from: change.from,
                                    to: change.to,
                                    oldType: existing.type,
                                    newType: change.newType,
                                    message: `关系变化不合理: ${existing.type} -> ${change.newType}`
                                });
                            }
                        }
                    }
                }

                return violations;
            }
        });
    }

    /**
     * 检查不兼容的关系变化
     */
    checkIncompatibleRelations(oldType, newType) {
        const incompatiblePairs = [
            ['enemy', 'lover'], // 敌人不能直接变成恋人
            ['stranger', 'family'] // 陌生人不能直接变成家人
        ];

        return incompatiblePairs.some(([a, b]) =>
            (oldType === a && newType === b) || (oldType === b && newType === a)
        );
    }

    /**
     * 验证内容
     */
    validate(content, context) {
        this.violations = [];

        for (const rule of this.rules) {
            try {
                const ruleViolations = rule.check(content, context);
                if (ruleViolations && ruleViolations.length > 0) {
                    for (const violation of ruleViolations) {
                        this.violations.push({
                            ruleId: rule.id,
                            ruleName: rule.name,
                            severity: rule.severity,
                            ...violation
                        });
                    }
                }
            } catch (error) {
                console.error(`Rule ${rule.id} failed:`, error);
            }
        }

        return {
            valid: this.violations.filter(v => v.severity === 'error').length === 0,
            violations: this.violations
        };
    }

    /**
     * 获取验证报告
     */
    getReport() {
        const errors = this.violations.filter(v => v.severity === 'error');
        const warnings = this.violations.filter(v => v.severity === 'warning');
        const info = this.violations.filter(v => v.severity === 'info');

        return {
            summary: {
                total: this.violations.length,
                errors: errors.length,
                warnings: warnings.length,
                info: info.length
            },
            errors,
            warnings,
            info
        };
    }

    /**
     * 修复建议
     */
    getSuggestions(violations) {
        const suggestions = [];

        for (const violation of violations) {
            switch (violation.type) {
                case 'unknown_character':
                    suggestions.push({
                        violation,
                        suggestion: `创建角色 ${violation.characterId} 或使用已知角色`
                    });
                    break;

                case 'unknown_location':
                    suggestions.push({
                        violation,
                        suggestion: `创建地点 ${violation.location} 或使用已知地点`
                    });
                    break;

                case 'unreachable_location':
                    suggestions.push({
                        violation,
                        suggestion: `添加从 ${violation.from} 到 ${violation.to} 的路径，或改变目标地点`
                    });
                    break;

                case 'item_not_owned':
                    suggestions.push({
                        violation,
                        suggestion: `让玩家先获得物品 ${violation.itemId}，或使用其他物品`
                    });
                    break;

                default:
                    suggestions.push({
                        violation,
                        suggestion: '请检查并修正此问题'
                    });
            }
        }

        return suggestions;
    }
}

module.exports = ConsistencyValidator;