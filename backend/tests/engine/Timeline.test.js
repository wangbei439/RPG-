const Timeline = require('../../engine/Timeline');

describe('Timeline - 事件时间线', () => {
    let timeline;

    beforeEach(() => {
        timeline = new Timeline();
    });

    describe('addEvent - 添加事件', () => {
        test('应能添加事件并返回完整的事件数据', () => {
            const event = timeline.addEvent({
                turn: 1,
                chapter: '第一章',
                type: 'action',
                summary: '主角进入村庄',
                participants: ['李明'],
                location: '村庄',
                importance: 3
            });

            expect(event.id).toBeDefined();
            expect(event.turn).toBe(1);
            expect(event.chapter).toBe('第一章');
            expect(event.type).toBe('action');
            expect(event.summary).toBe('主角进入村庄');
            expect(event.participants).toContain('李明');
            expect(event.location).toBe('村庄');
            expect(event.importance).toBe(3);
            expect(event.timestamp).toBeDefined();
        });

        test('添加事件时应有默认值', () => {
            const event = timeline.addEvent({
                turn: 1,
                type: 'action',
                summary: '测试事件'
            });

            expect(event.id).toBeDefined();
            expect(event.participants).toEqual([]);
            expect(event.location).toBeNull();
            expect(event.importance).toBe(3);
            expect(event.consequences).toEqual([]);
        });

        test('应能使用自定义 id', () => {
            const event = timeline.addEvent({
                id: 'custom_id',
                turn: 1,
                type: 'action',
                summary: '自定义ID事件'
            });
            expect(event.id).toBe('custom_id');
        });
    });

    describe('getEventsByType - 按类型获取事件', () => {
        test('应能按类型过滤事件', () => {
            timeline.addEvent({ turn: 1, type: 'action', summary: '动作1' });
            timeline.addEvent({ turn: 2, type: 'dialogue', summary: '对话1' });
            timeline.addEvent({ turn: 3, type: 'action', summary: '动作2' });

            const actions = timeline.getEventsByType('action');
            expect(actions).toHaveLength(2);

            const dialogues = timeline.getEventsByType('dialogue');
            expect(dialogues).toHaveLength(1);
        });

        test('查询不存在的类型应返回空数组', () => {
            expect(timeline.getEventsByType('nonexistent')).toEqual([]);
        });

        test('应支持 limit 参数', () => {
            for (let i = 0; i < 5; i++) {
                timeline.addEvent({ turn: i, type: 'action', summary: `动作${i}` });
            }
            const limited = timeline.getEventsByType('action', 2);
            expect(limited.length).toBeLessThanOrEqual(2);
        });
    });

    describe('getEventsByParticipant - 按参与者获取事件', () => {
        test('应能按参与者过滤事件', () => {
            timeline.addEvent({ turn: 1, type: 'action', summary: '事件1', participants: ['李明', '王芳'] });
            timeline.addEvent({ turn: 2, type: 'action', summary: '事件2', participants: ['赵强'] });

            const events = timeline.getEventsByParticipant('李明');
            expect(events).toHaveLength(1);
            expect(events[0].summary).toBe('事件1');
        });

        test('查询不存在的参与者应返回空数组', () => {
            expect(timeline.getEventsByParticipant('nonexistent')).toEqual([]);
        });
    });

    describe('getEventsByLocation - 按地点获取事件', () => {
        test('应能按地点过滤事件', () => {
            timeline.addEvent({ turn: 1, type: 'action', summary: '事件1', location: '村庄' });
            timeline.addEvent({ turn: 2, type: 'action', summary: '事件2', location: '森林' });
            timeline.addEvent({ turn: 3, type: 'action', summary: '事件3', location: '村庄' });

            const events = timeline.getEventsByLocation('村庄');
            expect(events).toHaveLength(2);
        });

        test('查询不存在的地点应返回空数组', () => {
            expect(timeline.getEventsByLocation('nonexistent')).toEqual([]);
        });
    });

    describe('queryRelevantEvents - 智能检索', () => {
        beforeEach(() => {
            timeline.addEvent({
                turn: 1, type: 'action', summary: '主角进入村庄', importance: 3,
                details: '主角来到了宁静的村庄'
            });
            timeline.addEvent({
                turn: 2, type: 'conflict', summary: '村庄遭遇袭击', importance: 5,
                details: '敌人突然袭击了村庄'
            });
            timeline.addEvent({
                turn: 3, type: 'dialogue', summary: '村民诉说苦衷', importance: 2,
                details: '村民讲述了遭遇'
            });
        });

        test('应能按关键词匹配事件', () => {
            const results = timeline.queryRelevantEvents('村庄');
            expect(results.length).toBeGreaterThan(0);
            results.forEach(r => {
                const text = `${r.summary} ${r.details}`.toLowerCase();
                expect(text).toContain('村庄');
            });
        });

        test('应能按最低重要性过滤', () => {
            const results = timeline.queryRelevantEvents(null, { minImportance: 4 });
            results.forEach(r => {
                expect(r.importance).toBeGreaterThanOrEqual(4);
            });
        });

        test('应能按类型过滤', () => {
            const results = timeline.queryRelevantEvents(null, { types: ['conflict'] });
            results.forEach(r => {
                expect(r.type).toBe('conflict');
            });
        });

        test('应能按参与者过滤', () => {
            timeline.addEvent({
                turn: 4, type: 'action', summary: '王芳的行动',
                participants: ['王芳'], importance: 3
            });
            const results = timeline.queryRelevantEvents(null, { participants: ['王芳'] });
            results.forEach(r => {
                expect(r.participants).toContain('王芳');
            });
        });

        test('应能按地点过滤', () => {
            const results = timeline.queryRelevantEvents(null, { locations: ['村庄'] });
            results.forEach(r => {
                expect(r.location).toBe('村庄');
            });
        });
    });

    describe('getSummary / getChapterSummary - 摘要', () => {
        test('getChapterSummary 应返回章节摘要', () => {
            timeline.addEvent({
                turn: 1, chapter: '第一章', type: 'action',
                summary: '主角出发', importance: 3, participants: ['李明'], location: '村庄'
            });
            timeline.addEvent({
                turn: 2, chapter: '第一章', type: 'conflict',
                summary: '遭遇敌人', importance: 5, participants: ['李明', '敌人'], location: '森林'
            });

            const summary = timeline.getChapterSummary('第一章');
            expect(summary).not.toBeNull();
            expect(summary.chapter).toBe('第一章');
            expect(summary.totalEvents).toBe(2);
            expect(summary.importantEvents).toContain('遭遇敌人');
            expect(summary.participants).toContain('李明');
            expect(summary.locations).toContain('村庄');
        });

        test('查询不存在的章节应返回 null', () => {
            expect(timeline.getChapterSummary('不存在的章节')).toBeNull();
        });

        test('getSummary 应返回所有章节摘要', () => {
            timeline.addEvent({ turn: 1, chapter: '第一章', type: 'action', summary: '事件1', importance: 3 });
            timeline.addEvent({ turn: 2, chapter: '第二章', type: 'action', summary: '事件2', importance: 3 });

            const summaries = timeline.getSummary();
            expect(summaries).toHaveLength(2);
        });
    });

    describe('toJSON / fromJSON - 序列化与恢复', () => {
        test('应能正确序列化和反序列化', () => {
            timeline.addEvent({
                turn: 1, chapter: '第一章', type: 'action',
                summary: '测试', participants: ['李明'], location: '村庄', importance: 4
            });

            const json = timeline.toJSON();
            const newTimeline = new Timeline();
            newTimeline.fromJSON(json);

            // 验证事件被恢复
            const events = newTimeline.getEventsByType('action');
            expect(events).toHaveLength(1);
            expect(events[0].summary).toBe('测试');

            // 验证索引被恢复
            const byParticipant = newTimeline.getEventsByParticipant('李明');
            expect(byParticipant).toHaveLength(1);

            const byLocation = newTimeline.getEventsByLocation('村庄');
            expect(byLocation).toHaveLength(1);
        });
    });

    describe('多索引一致性', () => {
        test('类型索引、参与者索引和地点索引应保持一致', () => {
            timeline.addEvent({
                id: 'evt_1', turn: 1, chapter: '第一章', type: 'action',
                summary: '李明在村庄战斗', participants: ['李明'], location: '村庄', importance: 3
            });

            const byType = timeline.getEventsByType('action');
            const byParticipant = timeline.getEventsByParticipant('李明');
            const byLocation = timeline.getEventsByLocation('村庄');

            expect(byType).toHaveLength(1);
            expect(byParticipant).toHaveLength(1);
            expect(byLocation).toHaveLength(1);
            expect(byType[0].id).toBe('evt_1');
            expect(byParticipant[0].id).toBe('evt_1');
            expect(byLocation[0].id).toBe('evt_1');
        });
    });
});
