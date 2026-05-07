const CacheService = require('../../utils/CacheService');

describe('CacheService - 智能缓存服务', () => {
    let cache;

    beforeEach(() => {
        cache = new CacheService({ maxSize: 5, ttl: 1000 }); // 小容量，1秒TTL便于测试
    });

    describe('set / get - 基本存取', () => {
        test('应能存入和获取缓存', () => {
            cache.set('key1', { data: 'value1' });
            const result = cache.get('key1');
            expect(result).toEqual({ data: 'value1' });
        });

        test('获取不存在的键应返回 null', () => {
            expect(cache.get('nonexistent')).toBeNull();
        });

        test('应能覆盖已存在的键', () => {
            cache.set('key1', 'value1');
            cache.set('key1', 'value2');
            expect(cache.get('key1')).toBe('value2');
        });

        test('应能存入各种类型的值', () => {
            cache.set('string', 'hello');
            cache.set('number', 42);
            cache.set('object', { a: 1 });
            cache.set('array', [1, 2, 3]);
            cache.set('boolean', true);

            expect(cache.get('string')).toBe('hello');
            expect(cache.get('number')).toBe(42);
            expect(cache.get('object')).toEqual({ a: 1 });
            expect(cache.get('array')).toEqual([1, 2, 3]);
            expect(cache.get('boolean')).toBe(true);
        });
    });

    describe('TTL 过期', () => {
        test('过期的缓存应返回 null', async () => {
            cache.set('key1', 'value1');

            // 等待超过 TTL
            await new Promise(resolve => setTimeout(resolve, 1100));

            expect(cache.get('key1')).toBeNull();
        });

        test('未过期的缓存应正常返回', () => {
            cache.set('key1', 'value1');
            expect(cache.get('key1')).toBe('value1');
        });

        test('访问过期缓存应从缓存中删除', async () => {
            cache.set('key1', 'value1');
            await new Promise(resolve => setTimeout(resolve, 1100));

            cache.get('key1');
            expect(cache.cache.has('key1')).toBe(false);
        });
    });

    describe('LRU 淘汰', () => {
        test('缓存满时应淘汰最久未访问的条目', async () => {
            // maxSize = 5
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            cache.set('key4', 'value4');
            cache.set('key5', 'value5');

            // 确保时间戳不同，等待一毫秒
            await new Promise(resolve => setTimeout(resolve, 2));

            // 现在缓存已满，访问 key1 使其变为最近使用
            cache.get('key1');

            // 添加新条目，应淘汰最久未使用的
            cache.set('key6', 'value6');

            // key1 被访问过，不应该被淘汰
            expect(cache.get('key1')).toBe('value1');
            // key2 最久没被访问，应该被淘汰
            expect(cache.get('key2')).toBeNull();
        });

        test('新添加的条目应能正常获取', () => {
            for (let i = 0; i < 10; i++) {
                cache.set(`key${i}`, `value${i}`);
            }

            // 只有最后 5 个应该存在
            expect(cache.get('key0')).toBeNull();
            expect(cache.get('key9')).toBe('value9');
        });
    });

    describe('generateKey - 缓存键生成', () => {
        test('相同输入应生成相同的键', () => {
            const key1 = cache.generateKey('hello world', { model: 'gpt-4', temperature: 0.7 });
            const key2 = cache.generateKey('hello world', { model: 'gpt-4', temperature: 0.7 });
            expect(key1).toBe(key2);
        });

        test('不同输入应生成不同的键', () => {
            const key1 = cache.generateKey('hello', { model: 'gpt-4' });
            const key2 = cache.generateKey('world', { model: 'gpt-4' });
            expect(key1).not.toBe(key2);
        });

        test('应去除 prompt 前后空格', () => {
            const key1 = cache.generateKey('  hello  ', {});
            const key2 = cache.generateKey('hello', {});
            expect(key1).toBe(key2);
        });

        test('应使用默认选项值', () => {
            const key1 = cache.generateKey('test');
            const key2 = cache.generateKey('test', { model: 'default', temperature: 0.7 });
            expect(key1).toBe(key2);
        });
    });

    describe('getStats - 统计信息', () => {
        test('初始状态应有正确的统计', () => {
            const stats = cache.getStats();
            expect(stats.size).toBe(0);
            expect(stats.maxSize).toBe(5);
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.hitRate).toBe('0%');
        });

        test('应能正确统计命中和未命中', () => {
            cache.set('key1', 'value1');

            cache.get('key1');  // hit
            cache.get('key1');  // hit
            cache.get('nonexistent');  // miss

            const stats = cache.getStats();
            expect(stats.hits).toBe(2);
            expect(stats.misses).toBe(1);
            expect(stats.hitRate).toBe('66.67%');
        });

        test('应能反映当前缓存大小', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');

            const stats = cache.getStats();
            expect(stats.size).toBe(2);
        });
    });

    describe('cleanup - 清除过期缓存', () => {
        test('应能清除过期的缓存条目', async () => {
            cache.set('key1', 'value1');
            await new Promise(resolve => setTimeout(resolve, 1100));
            cache.set('key2', 'value2'); // 新的未过期

            cache.cleanup();

            expect(cache.get('key1')).toBeNull();
            expect(cache.get('key2')).toBe('value2');
        });
    });

    describe('clear - 清空缓存', () => {
        test('应能清空所有缓存和统计', () => {
            cache.set('key1', 'value1');
            cache.get('key1');
            cache.clear();

            const stats = cache.getStats();
            expect(stats.size).toBe(0);
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(cache.get('key1')).toBeNull();
        });
    });
});
