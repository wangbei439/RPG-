const fs = require('fs');
const path = require('path');

// The package main entry currently fails in this project because it expects
// a dev-only runtime helper. The bundled build works without that dependency.
const { ManasDB } = require(path.join(__dirname, '../node_modules/@manasdb/core/dist/manasdb.bundle.cjs'));

class ManasDBService {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.namespace = options.namespace || 'rpg-generator';
        this.embeddingModel = options.embeddingModel || 'all-MiniLM-L6-v2';
        this.debug = options.debug === true;
        this.storageDir = options.storageDir || path.join(__dirname, '../data/manasdb');
        this.vectorRecallTimeoutMs = Math.max(options.vectorRecallTimeoutMs || 180, 50);
        this.memory = null;
        this.initPromise = null;
        this.vectorAvailable = false;
        this.recordCache = new Map();
        this.graphCache = new Map();
        this.writeQueues = new Map();
        this.vectorQueue = Promise.resolve();
        this.pendingWrites = 0;

        this.ensureStorageDirs();

        if (this.enabled) {
            this.initialize();
        }
    }

    ensureStorageDirs() {
        fs.mkdirSync(this.storageDir, { recursive: true });
        fs.mkdirSync(this.getRecordsDir(), { recursive: true });
        fs.mkdirSync(this.getGraphsDir(), { recursive: true });
    }

    getRecordsDir() {
        return path.join(this.storageDir, 'records');
    }

    getGraphsDir() {
        return path.join(this.storageDir, 'graphs');
    }

    initialize() {
        if (!this.enabled) {
            return null;
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            try {
                this.memory = new ManasDB({
                    projectName: this.namespace,
                    modelConfig: { source: 'transformers' },
                    debug: this.debug
                });
                await this.memory.init();
                this.vectorAvailable = true;
                return this.memory;
            } catch (error) {
                this.vectorAvailable = false;
                this.memory = null;
                console.warn('ManasDB 向量层初始化失败，继续使用本地持久化记忆:', error.message);
                return null;
            }
        })();

        return this.initPromise;
    }

    async ensureReady() {
        if (!this.enabled) {
            return null;
        }

        return this.initialize();
    }

    async saveMemory(key, value, metadata = {}) {
        if (!this.enabled) {
            return { success: false, reason: 'ManasDB 未启用' };
        }

        const record = this.buildRecord(key, value, metadata);

        try {
            this.upsertRecord(record);
        } catch (error) {
            console.error('本地记忆持久化失败:', error);
            return { success: false, error: error.message };
        }

        try {
            const memory = await this.ensureReady();
            if (memory && this.vectorAvailable) {
                const payload = this.serializeMemory(key, value, metadata);
                const result = await memory.absorb(payload, {
                    metadata: {
                        key,
                        namespace: this.namespace,
                        ...metadata
                    }
                });

                return {
                    success: true,
                    contentId: result.contentId || null,
                    persisted: true,
                    vectorIndexed: true
                };
            }
        } catch (error) {
            console.warn('ManasDB 向量写入失败，已保留本地持久化数据:', error.message);
            this.vectorAvailable = false;
        }

        return {
            success: true,
            persisted: true,
            vectorIndexed: false
        };
    }

    async retrieveMemory(query, options = {}) {
        if (!this.enabled) {
            return { success: false, reason: 'ManasDB 未启用', results: [] };
        }

        const limit = Math.max(options.limit || 5, 1);
        const localResults = this.retrieveLocalMemory(query, options);
        let vectorResults = [];

        try {
            const memory = await this.ensureReady();
            if (memory && this.vectorAvailable) {
                const results = await memory.recall(query, { limit: Math.max(limit * 2, 8) });
                const filtered = this.applyFilter(results, options.filter);

                vectorResults = filtered.map((item) => ({
                    key: item.tags?.key || item.contentId || '',
                    value: item.text || '',
                    score: item.score || 0,
                    metadata: item.tags || {},
                    source: 'vector'
                }));
            }
        } catch (error) {
            console.warn('ManasDB 向量检索失败，改用本地检索:', error.message);
            this.vectorAvailable = false;
        }

        const merged = this.mergeResults([...localResults, ...vectorResults], limit);

        return {
            success: true,
            results: merged
        };
    }

    async saveMemories(entries) {
        if (!this.enabled) {
            return { success: false, reason: 'ManasDB 未启用' };
        }

        const results = [];
        for (const entry of entries) {
            results.push(await this.saveMemory(entry.key, entry.value, entry.metadata || {}));
        }

        return {
            success: results.every((item) => item.success),
            count: entries.length,
            results
        };
    }

    async compressGameMemories(gameId, options = {}) {
        if (!this.enabled || !gameId) {
            return { success: false, reason: '缺少 gameId' };
        }

        const keepRecentTurns = Math.max(options.keepRecentTurns || 8, 4);
        const maxTurnMemories = Math.max(options.maxTurnMemories || 12, keepRecentTurns + 2);
        const chunkSize = Math.max(options.chunkSize || 3, 2);
        const records = this.loadRecords(gameId);
        const turnRecords = records
            .filter((item) => item.metadata?.memoryType === 'turn' && item.metadata?.active !== false)
            .sort((left, right) => (left.metadata?.turn || 0) - (right.metadata?.turn || 0));

        if (turnRecords.length <= maxTurnMemories) {
            return { success: true, compressed: 0, summariesCreated: 0 };
        }

        const compressible = turnRecords.slice(0, Math.max(0, turnRecords.length - keepRecentTurns));
        if (compressible.length < chunkSize) {
            return { success: true, compressed: 0, summariesCreated: 0 };
        }

        let compressed = 0;
        let summariesCreated = 0;

        for (let index = 0; index < compressible.length; index += chunkSize) {
            const chunk = compressible.slice(index, index + chunkSize);
            if (chunk.length < chunkSize) {
                break;
            }

            const startTurn = chunk[0].metadata?.turn || 0;
            const endTurn = chunk[chunk.length - 1].metadata?.turn || startTurn;
            const summaryRecord = this.buildCompressedSummaryRecord(gameId, chunk, startTurn, endTurn);
            records.push(summaryRecord);
            summariesCreated += 1;

            for (const record of chunk) {
                const target = records.find((item) => item.key === record.key);
                if (target) {
                    target.metadata = {
                        ...(target.metadata || {}),
                        active: false,
                        compressedInto: summaryRecord.key,
                        compressedAt: new Date().toISOString()
                    };
                    compressed += 1;
                }
            }
        }

        this.saveRecords(gameId, records);

        return {
            success: true,
            compressed,
            summariesCreated
        };
    }

    async upsertFacts(gameId, facts = []) {
        if (!this.enabled || !gameId || !Array.isArray(facts) || facts.length === 0) {
            return { success: false, reason: '没有可写入的事实图谱' };
        }

        const graph = this.loadGraph(gameId);

        for (const fact of facts) {
            this.upsertFactIntoGraph(graph, fact);
        }

        this.saveGraph(gameId, graph);

        return {
            success: true,
            entities: Object.keys(graph.entities).length,
            relations: graph.relations.length
        };
    }

    async getRelevantFacts(query, options = {}) {
        const gameId = options.gameId;
        if (!this.enabled || !gameId) {
            return [];
        }

        const graph = this.loadGraph(gameId);
        const limit = Math.max(options.limit || 5, 1);
        const queryText = String(query || '').toLowerCase();
        const tokens = this.tokenize(queryText);
        const scored = [];

        for (const relation of graph.relations) {
            const source = graph.entities[relation.source];
            const target = relation.target ? graph.entities[relation.target] : null;
            const text = this.renderGraphFact(source, relation, target);
            const score = this.computeTextScore(queryText, tokens, `${text} ${JSON.stringify(relation.attributes || {})}`);
            if (score > 0) {
                scored.push({
                    text,
                    score,
                    relation,
                    source,
                    target
                });
            }
        }

        if (scored.length === 0) {
            return [];
        }

        return scored
            .sort((left, right) => right.score - left.score)
            .slice(0, limit)
            .map((item) => ({
                text: item.text,
                score: item.score,
                type: item.relation.type,
                source: item.source?.label || item.relation.source,
                target: item.target?.label || item.relation.target || ''
            }));
    }

    getGraph(gameId) {
        if (!gameId) {
            return {
                gameId: null,
                entities: {},
                relations: [],
                updatedAt: new Date().toISOString()
            };
        }

        return this.loadGraph(gameId);
    }

    async clearNamespace() {
        if (!this.enabled) {
            return { success: false, reason: 'ManasDB 未启用' };
        }

        try {
            if (this.memory && this.vectorAvailable) {
                await this.memory.clearAll();
            }
        } catch (error) {
            console.warn('清空 ManasDB 向量层失败:', error.message);
        }

        fs.rmSync(this.storageDir, { recursive: true, force: true });
        this.recordCache.clear();
        this.graphCache.clear();
        this.writeQueues.clear();
        this.pendingWrites = 0;
        this.ensureStorageDirs();
        return { success: true };
    }

    getStatus() {
        return {
            enabled: this.enabled,
            namespace: this.namespace,
            model: this.embeddingModel,
            initialized: Boolean(this.memory),
            vectorAvailable: this.vectorAvailable,
            storageDir: this.storageDir,
            pendingWrites: this.pendingWrites
        };
    }

    async getStats() {
        if (!this.enabled) {
            return { enabled: false };
        }

        let health = null;
        try {
            const memory = await this.ensureReady();
            if (memory && this.vectorAvailable) {
                health = await memory.health();
            }
        } catch (_error) {
            health = null;
        }

        const recordFiles = fs.existsSync(this.getRecordsDir())
            ? fs.readdirSync(this.getRecordsDir()).filter((name) => name.endsWith('.json'))
            : [];
        const graphFiles = fs.existsSync(this.getGraphsDir())
            ? fs.readdirSync(this.getGraphsDir()).filter((name) => name.endsWith('.json'))
            : [];

        const typeCounts = this.collectRecordTypeCounts();

        return {
            enabled: true,
            initialized: Boolean(this.memory),
            vectorAvailable: this.vectorAvailable,
            namespace: this.namespace,
            storageDir: this.storageDir,
            pendingWrites: this.pendingWrites,
            recordFiles: recordFiles.length,
            graphFiles: graphFiles.length,
            recordTypes: typeCounts,
            health
        };
    }

    buildRecord(key, value, metadata = {}) {
        const normalizedMetadata = {
            active: metadata.active !== false,
            importance: metadata.importance ?? this.inferImportance(metadata, value),
            ...metadata
        };

        return {
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
            metadata: normalizedMetadata,
            updatedAt: new Date().toISOString()
        };
    }

    upsertRecord(record) {
        const gameId = record.metadata?.gameId || '__global__';
        const records = this.loadRecords(gameId);
        const index = records.findIndex((item) => item.key === record.key);

        if (index >= 0) {
            records[index] = record;
        } else {
            records.push(record);
        }

        this.saveRecords(gameId, records);
    }

    retrieveLocalMemory(query, options = {}) {
        const limit = Math.max(options.limit || 5, 1);
        const gameId = options.filter?.gameId || '__global__';
        const fallbackRecords = gameId === '__global__'
            ? this.loadAllRecords()
            : this.loadRecords(gameId);
        const queryText = String(query || '').toLowerCase();
        const tokens = this.tokenize(queryText);

        return fallbackRecords
            .filter((record) => record.metadata?.active !== false)
            .filter((record) => this.matchesFilter(record.metadata || {}, options.filter))
            .map((record) => ({
                key: record.key,
                value: record.value,
                score: this.computeWeightedScore(queryText, tokens, record),
                metadata: record.metadata || {},
                source: 'local'
            }))
            .filter((record) => record.score > 0)
            .sort((left, right) => right.score - left.score)
            .slice(0, limit * 2);
    }

    mergeResults(results, limit) {
        const merged = new Map();

        for (const item of results) {
            const key = item.key || `${item.source}:${item.value.slice(0, 50)}`;
            const existing = merged.get(key);

            if (!existing || item.score > existing.score) {
                merged.set(key, item);
            }
        }

        return Array.from(merged.values())
            .sort((left, right) => {
                const rightImportance = Number(right.metadata?.importance || 0);
                const leftImportance = Number(left.metadata?.importance || 0);
                return (right.score + rightImportance * 0.5) - (left.score + leftImportance * 0.5);
            })
            .slice(0, limit);
    }

    serializeMemory(key, value, metadata = {}) {
        const body = typeof value === 'string'
            ? value
            : JSON.stringify(value, null, 2);

        return [
            `记忆键: ${key}`,
            metadata.gameId ? `游戏ID: ${metadata.gameId}` : '',
            metadata.memoryType ? `记忆类型: ${metadata.memoryType}` : '',
            metadata.turn !== undefined ? `回合: ${metadata.turn}` : '',
            metadata.scene ? `场景: ${metadata.scene}` : '',
            metadata.location ? `地点: ${metadata.location}` : '',
            '',
            body
        ].filter(Boolean).join('\n');
    }

    applyFilter(results = [], filter = null) {
        if (!filter || typeof filter !== 'object') {
            return results;
        }

        return results.filter((item) => this.matchesFilter(item.tags || item.metadata || {}, filter));
    }

    matchesFilter(metadata = {}, filter = null) {
        if (!filter || typeof filter !== 'object') {
            return true;
        }

        return Object.entries(filter).every(([key, value]) => metadata[key] === value);
    }

    loadRecords(gameId) {
        if (this.recordCache.has(gameId)) {
            return this.recordCache.get(gameId);
        }

        const filePath = this.getRecordFilePath(gameId);
        if (!fs.existsSync(filePath)) {
            const empty = [];
            this.recordCache.set(gameId, empty);
            return empty;
        }

        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            const records = Array.isArray(parsed) ? parsed : [];
            this.recordCache.set(gameId, records);
            return records;
        } catch (_error) {
            const empty = [];
            this.recordCache.set(gameId, empty);
            return empty;
        }
    }

    loadAllRecords() {
        const records = [];
        const files = fs.existsSync(this.getRecordsDir())
            ? fs.readdirSync(this.getRecordsDir()).filter((name) => name.endsWith('.json'))
            : [];

        for (const fileName of files) {
            records.push(...this.loadRecords(fileName.replace(/\.json$/i, '')));
        }

        return records;
    }

    collectRecordTypeCounts() {
        const counts = {};
        const allRecords = this.loadAllRecords();

        for (const record of allRecords) {
            const type = record.metadata?.memoryType || 'unknown';
            if (!counts[type]) {
                counts[type] = { total: 0, active: 0 };
            }

            counts[type].total += 1;
            if (record.metadata?.active !== false) {
                counts[type].active += 1;
            }
        }

        return counts;
    }

    saveRecords(gameId, records) {
        this.recordCache.set(gameId, records);
        this.queueFileWrite(
            this.getRecordFilePath(gameId),
            JSON.stringify(records, null, 2)
        );
    }

    getRecordFilePath(gameId) {
        return path.join(this.getRecordsDir(), `${this.safeId(gameId)}.json`);
    }

    loadGraph(gameId) {
        if (this.graphCache.has(gameId)) {
            return this.graphCache.get(gameId);
        }

        const filePath = this.getGraphFilePath(gameId);
        if (!fs.existsSync(filePath)) {
            const empty = {
                gameId,
                entities: {},
                relations: [],
                updatedAt: new Date().toISOString()
            };
            this.graphCache.set(gameId, empty);
            return empty;
        }

        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            const graph = {
                gameId,
                entities: parsed.entities || {},
                relations: Array.isArray(parsed.relations) ? parsed.relations : [],
                updatedAt: parsed.updatedAt || new Date().toISOString()
            };
            this.graphCache.set(gameId, graph);
            return graph;
        } catch (_error) {
            const empty = {
                gameId,
                entities: {},
                relations: [],
                updatedAt: new Date().toISOString()
            };
            this.graphCache.set(gameId, empty);
            return empty;
        }
    }

    saveGraph(gameId, graph) {
        graph.updatedAt = new Date().toISOString();
        this.graphCache.set(gameId, graph);
        this.queueFileWrite(
            this.getGraphFilePath(gameId),
            JSON.stringify(graph, null, 2)
        );
    }

    getGraphFilePath(gameId) {
        return path.join(this.getGraphsDir(), `${this.safeId(gameId)}.json`);
    }

    upsertFactIntoGraph(graph, fact) {
        const sourceId = this.ensureGraphEntity(graph, fact.source);
        const targetId = this.ensureGraphEntity(graph, fact.target);
        const relationType = fact.type || fact.relationType;

        if (!sourceId || !relationType) {
            return;
        }

        const relationIndex = graph.relations.findIndex((item) =>
            item.source === sourceId
            && item.target === (targetId || null)
            && item.type === relationType
        );

        const relation = {
            source: sourceId,
            target: targetId || null,
            type: relationType,
            attributes: { ...(fact.attributes || {}) },
            updatedAt: new Date().toISOString()
        };

        if (relationIndex >= 0) {
            graph.relations[relationIndex] = relation;
        } else {
            graph.relations.push(relation);
        }
    }

    ensureGraphEntity(graph, entity) {
        if (!entity || !entity.id) {
            return null;
        }

        graph.entities[entity.id] = {
            id: entity.id,
            label: entity.label || entity.id,
            type: entity.type || 'unknown',
            attributes: { ...(entity.attributes || {}) },
            updatedAt: new Date().toISOString()
        };

        return entity.id;
    }

    renderGraphFact(source, relation, target) {
        const sourceLabel = source?.label || relation.source;
        const targetLabel = target?.label || relation.target || '';
        const attrs = relation.attributes || {};
        const attrText = Object.keys(attrs).length
            ? `（${Object.entries(attrs).map(([key, value]) => `${key}: ${value}`).join('，')}）`
            : '';

        if (targetLabel) {
            return `${sourceLabel} ${relation.type} ${targetLabel}${attrText}`;
        }

        return `${sourceLabel} ${relation.type}${attrText}`;
    }

    queueFileWrite(filePath, payload) {
        this.pendingWrites += 1;
        const previous = this.writeQueues.get(filePath) || Promise.resolve();
        const next = previous
            .catch(() => {})
            .then(() => fs.promises.writeFile(filePath, payload, 'utf8'))
            .catch((error) => {
                console.error(`写入记忆文件失败: ${filePath}`, error.message);
            })
            .finally(() => {
                this.pendingWrites = Math.max(0, this.pendingWrites - 1);
                if (this.writeQueues.get(filePath) === next) {
                    this.writeQueues.delete(filePath);
                }
            });

        this.writeQueues.set(filePath, next);
        return next;
    }

    enqueueVectorWrite(key, value, metadata = {}) {
        if (!this.enabled) {
            return;
        }

        this.vectorQueue = this.vectorQueue
            .catch(() => {})
            .then(async () => {
                try {
                    const memory = await this.ensureReady();
                    if (!memory || !this.vectorAvailable) {
                        return;
                    }

                    const payload = this.serializeMemory(key, value, metadata);
                    await memory.absorb(payload, {
                        metadata: {
                            key,
                            namespace: this.namespace,
                            ...metadata
                        }
                    });
                } catch (error) {
                    console.warn('ManasDB vector indexing fell back to local-only mode:', error.message);
                    this.vectorAvailable = false;
                }
            });
    }

    withTimeout(promise, timeoutMs, fallbackValue) {
        const timeout = Math.max(Number(timeoutMs) || 0, 0);
        if (!timeout) {
            return promise;
        }

        return Promise.race([
            promise,
            new Promise((resolve) => {
                setTimeout(() => resolve(fallbackValue), timeout);
            })
        ]);
    }

    async saveMemoryFast(key, value, metadata = {}) {
        if (!this.enabled) {
            return { success: false, reason: 'ManasDB is disabled' };
        }

        const record = this.buildRecord(key, value, metadata);

        try {
            this.upsertRecord(record);
        } catch (error) {
            console.error('Failed to persist local memory record:', error);
            return { success: false, error: error.message };
        }

        this.enqueueVectorWrite(key, value, metadata);

        return {
            success: true,
            persisted: true,
            vectorQueued: true
        };
    }

    async saveMemoriesFast(entries) {
        if (!this.enabled) {
            return { success: false, reason: 'ManasDB is disabled' };
        }

        const results = [];
        for (const entry of entries) {
            results.push(await this.saveMemoryFast(entry.key, entry.value, entry.metadata || {}));
        }

        return {
            success: results.every((item) => item.success),
            count: entries.length,
            results
        };
    }

    async retrieveMemoryFast(query, options = {}) {
        if (!this.enabled) {
            return { success: false, reason: 'ManasDB is disabled', results: [] };
        }

        const limit = Math.max(options.limit || 5, 1);
        const localResults = this.retrieveLocalMemory(query, options);
        const preferFastLocal = options.preferFastLocal !== false;
        const strongLocalHit = localResults.length >= limit && (localResults[0]?.score || 0) >= 8;

        if (preferFastLocal && strongLocalHit) {
            return {
                success: true,
                results: localResults.slice(0, limit)
            };
        }

        let vectorResults = [];

        try {
            const memory = await this.ensureReady();
            if (memory && this.vectorAvailable) {
                const results = await this.withTimeout(
                    memory.recall(query, { limit: Math.max(limit * 2, 8) }),
                    options.vectorTimeoutMs || this.vectorRecallTimeoutMs,
                    []
                );
                const filtered = this.applyFilter(results, options.filter);

                vectorResults = filtered.map((item) => ({
                    key: item.tags?.key || item.contentId || '',
                    value: item.text || '',
                    score: item.score || 0,
                    metadata: item.tags || {},
                    source: 'vector'
                }));
            }
        } catch (error) {
            console.warn('ManasDB vector recall fell back to local-only mode:', error.message);
            this.vectorAvailable = false;
        }

        return {
            success: true,
            results: this.mergeResults([...localResults, ...vectorResults], limit)
        };
    }

    tokenize(text) {
        const normalized = String(text || '').toLowerCase();
        const basicTokens = normalized
            .split(/[\s,.;:!?()\[\]{}"'`，。；：！？、]+/)
            .filter(Boolean);
        const cjkText = (normalized.match(/[\u4e00-\u9fff]+/g) || []).join('');
        const cjkTokens = [];

        for (let size = 2; size <= 4; size += 1) {
            for (let index = 0; index <= cjkText.length - size; index += 1) {
                cjkTokens.push(cjkText.slice(index, index + size));
            }
        }

        return Array.from(new Set([...basicTokens, ...cjkTokens]));
    }

    computeTextScore(queryText, tokens, candidateText) {
        const candidate = String(candidateText || '').toLowerCase();
        if (!candidate) {
            return 0;
        }

        let score = 0;
        for (const token of tokens) {
            if (!token) {
                continue;
            }

            if (candidate.includes(token)) {
                score += token.length >= 4 ? 3 : token.length > 2 ? 2 : 1;
            }
        }

        if (queryText && candidate.includes(queryText)) {
            score += 5;
        }

        return score;
    }

    computeWeightedScore(queryText, tokens, record) {
        const baseScore = this.computeTextScore(
            queryText,
            tokens,
            `${record.value} ${JSON.stringify(record.metadata || {})}`
        );
        const importance = Number(record.metadata?.importance || 0);
        const freshness = this.computeFreshnessWeight(record.updatedAt);
        return baseScore + importance * 0.75 + freshness;
    }

    computeFreshnessWeight(updatedAt) {
        if (!updatedAt) {
            return 0;
        }

        const updated = new Date(updatedAt).getTime();
        if (!Number.isFinite(updated)) {
            return 0;
        }

        const ageHours = Math.max(0, (Date.now() - updated) / (1000 * 60 * 60));
        if (ageHours < 1) {
            return 2;
        }

        if (ageHours < 24) {
            return 1;
        }

        if (ageHours < 24 * 7) {
            return 0.5;
        }

        return 0;
    }

    inferImportance(metadata = {}, value = '') {
        const memoryType = metadata.memoryType || 'turn';
        const factType = metadata.factType || '';
        let importance = 1;

        if (memoryType === 'summary') {
            importance = 6;
        } else if (memoryType === 'fact') {
            importance = 5;
        } else if (memoryType === 'turn') {
            importance = 3;
        }

        if (factType === 'explicit' || factType === 'quest') {
            importance += 1;
        }

        const text = String(value || '');
        if (/游戏结束|完成|击败|获得|发现|进入|关系提升|关系下降|任务状态更新/.test(text)) {
            importance += 1;
        }

        return Math.min(10, importance);
    }

    buildCompressedSummaryRecord(gameId, chunk, startTurn, endTurn) {
        const value = [
            `压缩阶段摘要：第${startTurn}到第${endTurn}回合`,
            ...chunk.map((record) => {
                const turn = record.metadata?.turn || '?';
                const compact = String(record.value || '').replace(/\s+/g, ' ').trim();
                return `第${turn}回合：${compact}`;
            })
        ].join('\n');

        return this.buildRecord(
            `game:${gameId}:compressed-summary:${startTurn}-${endTurn}`,
            value,
            {
                gameId,
                memoryType: 'summary',
                summaryType: 'compressed',
                turn: endTurn,
                importance: 7
            }
        );
    }

    safeId(value) {
        return String(value || '__global__').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    }
}

module.exports = ManasDBService;
