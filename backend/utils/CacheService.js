/**
 * 智能缓存服务
 * 用于缓存 AI 生成结果，减少重复请求
 */
class CacheService {
    constructor(options = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 3600000; // 默认1小时
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * 生成缓存键
     */
    generateKey(prompt, options = {}) {
        const normalized = {
            prompt: prompt.trim(),
            model: options.model || 'default',
            temperature: options.temperature || 0.7
        };
        return JSON.stringify(normalized);
    }

    /**
     * 获取缓存
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.misses++;
            return null;
        }

        // 检查是否过期
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }

        this.hits++;
        entry.accessCount++;
        entry.lastAccess = Date.now();
        return entry.value;
    }

    /**
     * 设置缓存
     */
    set(key, value) {
        // 如果缓存已满，删除最少使用的条目
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            lastAccess: Date.now(),
            accessCount: 1
        });
    }

    /**
     * 删除最少使用的条目（LRU）
     */
    evictLRU() {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccess < oldestTime) {
                oldestTime = entry.lastAccess;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * 清除过期缓存
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttl) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * 获取缓存统计
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * 清空缓存
     */
    clear() {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }
}

module.exports = CacheService;
