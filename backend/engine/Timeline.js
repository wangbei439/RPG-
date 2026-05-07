/**
 * 事件时间线 - 追踪游戏中发生的所有事件
 * 用于回顾历史、查询相关事件
 */
class Timeline {
    constructor() {
        this.events = [];
        this.eventIndex = new Map(); // 按类型索引
        this.participantIndex = new Map(); // 按参与者索引
        this.locationIndex = new Map(); // 按地点索引
    }

    /**
     * 添加事件
     */
    addEvent(event) {
        const eventData = {
            id: event.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            turn: event.turn,
            chapter: event.chapter,
            type: event.type, // 'action', 'dialogue', 'discovery', 'conflict', 'resolution'
            summary: event.summary,
            details: event.details || '',
            participants: event.participants || [],
            location: event.location || null,
            importance: event.importance || 3, // 1-5
            consequences: event.consequences || [],
            timestamp: Date.now()
        };

        this.events.push(eventData);

        // 更新索引
        this.updateIndex(this.eventIndex, eventData.type, eventData.id);

        for (const participant of eventData.participants) {
            this.updateIndex(this.participantIndex, participant, eventData.id);
        }

        if (eventData.location) {
            this.updateIndex(this.locationIndex, eventData.location, eventData.id);
        }

        return eventData;
    }

    /**
     * 更新索引
     */
    updateIndex(index, key, eventId) {
        if (!index.has(key)) {
            index.set(key, new Set());
        }
        index.get(key).add(eventId);
    }

    /**
     * 获取最近的事件
     */
    getRecentEvents(limit = 10) {
        return this.events.slice(-limit);
    }

    /**
     * 按类型获取事件
     */
    getEventsByType(type, limit = 20) {
        const eventIds = this.eventIndex.get(type);
        if (!eventIds) return [];

        return Array.from(eventIds)
            .map(id => this.events.find(e => e.id === id))
            .filter(Boolean)
            .slice(-limit);
    }

    /**
     * 获取参与者相关的事件
     */
    getEventsByParticipant(participantId, limit = 20) {
        const eventIds = this.participantIndex.get(participantId);
        if (!eventIds) return [];

        return Array.from(eventIds)
            .map(id => this.events.find(e => e.id === id))
            .filter(Boolean)
            .slice(-limit);
    }

    /**
     * 获取地点相关的事件
     */
    getEventsByLocation(location, limit = 20) {
        const eventIds = this.locationIndex.get(location);
        if (!eventIds) return [];

        return Array.from(eventIds)
            .map(id => this.events.find(e => e.id === id))
            .filter(Boolean)
            .slice(-limit);
    }

    /**
     * 查询相关事件（智能检索）
     */
    queryRelevantEvents(query, options = {}) {
        const {
            limit = 10,
            minImportance = 1,
            types = [],
            participants = [],
            locations = []
        } = options;

        let candidates = [...this.events];

        // 按重要性过滤
        candidates = candidates.filter(e => e.importance >= minImportance);

        // 按类型过滤
        if (types.length > 0) {
            candidates = candidates.filter(e => types.includes(e.type));
        }

        // 按参与者过滤
        if (participants.length > 0) {
            candidates = candidates.filter(e =>
                e.participants.some(p => participants.includes(p))
            );
        }

        // 按地点过滤
        if (locations.length > 0) {
            candidates = candidates.filter(e =>
                locations.includes(e.location)
            );
        }

        // 按关键词匹配
        if (query) {
            const queryStr = typeof query === 'string' ? query : String(query);
            const keywords = queryStr.toLowerCase().split(/\s+/);
            candidates = candidates.map(event => {
                const text = `${event.summary} ${event.details}`.toLowerCase();
                const score = keywords.reduce((sum, keyword) => {
                    return sum + (text.includes(keyword) ? 1 : 0);
                }, 0);
                return { event, score };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => {
                // 先按匹配度，再按重要性，最后按时间
                if (b.score !== a.score) return b.score - a.score;
                if (b.event.importance !== a.event.importance) {
                    return b.event.importance - a.event.importance;
                }
                return b.event.timestamp - a.event.timestamp;
            })
            .map(item => item.event);
        } else {
            // 按重要性和时间排序
            candidates.sort((a, b) => {
                if (b.importance !== a.importance) {
                    return b.importance - a.importance;
                }
                return b.timestamp - a.timestamp;
            });
        }

        return candidates.slice(0, limit);
    }

    /**
     * 获取章节摘要
     */
    getChapterSummary(chapter) {
        const chapterEvents = this.events.filter(e => e.chapter === chapter);

        if (chapterEvents.length === 0) return null;

        const importantEvents = chapterEvents
            .filter(e => e.importance >= 4)
            .map(e => e.summary);

        return {
            chapter,
            totalEvents: chapterEvents.length,
            importantEvents,
            participants: [...new Set(chapterEvents.flatMap(e => e.participants))],
            locations: [...new Set(chapterEvents.map(e => e.location).filter(Boolean))]
        };
    }

    /**
     * 获取完整时间线摘要
     */
    getSummary() {
        const chapters = [...new Set(this.events.map(e => e.chapter))];
        return chapters.map(chapter => this.getChapterSummary(chapter));
    }

    /**
     * 导出为 JSON
     */
    toJSON() {
        return {
            events: this.events
        };
    }

    /**
     * 从 JSON 恢复
     */
    fromJSON(data) {
        this.events = [];
        this.eventIndex.clear();
        this.participantIndex.clear();
        this.locationIndex.clear();

        if (data.events) {
            for (const event of data.events) {
                // 重建索引
                this.updateIndex(this.eventIndex, event.type, event.id);

                for (const participant of event.participants || []) {
                    this.updateIndex(this.participantIndex, participant, event.id);
                }

                if (event.location) {
                    this.updateIndex(this.locationIndex, event.location, event.id);
                }

                this.events.push(event);
            }
        }
    }
}

module.exports = Timeline;
