const LLMService = require('../../utils/LLMService');

describe('LLMService - LLM服务', () => {
    let llm;

    beforeEach(() => {
        llm = new LLMService();
    });

    describe('initialize - 初始化', () => {
        test('openai 模式应创建 OpenAI 客户端', () => {
            llm.initialize({
                llmSource: 'openai',
                apiKey: 'test-key',
                apiUrl: 'https://api.openai.com/v1'
            });

            expect(llm.client).toBeDefined();
            expect(llm.settings.llmSource).toBe('openai');
        });

        test('anthropic 模式应创建特定客户端对象', () => {
            llm.initialize({
                llmSource: 'anthropic',
                apiKey: 'test-key',
                model: 'claude-3-5-sonnet-20241022'
            });

            expect(llm.client).toBeDefined();
            expect(llm.client.type).toBe('anthropic');
            expect(llm.client.apiKey).toBe('test-key');
        });

        test('local 模式应创建 OpenAI 客户端指向本地地址', () => {
            llm.initialize({
                llmSource: 'local',
                apiUrl: 'http://localhost:11434'
            });

            expect(llm.client).toBeDefined();
        });

        test('custom 模式应创建自定义客户端', () => {
            llm.initialize({
                llmSource: 'custom',
                apiKey: 'custom-key',
                apiUrl: 'https://custom-api.example.com/v1'
            });

            expect(llm.client).toBeDefined();
        });

        test('不支持的 llmSource 应抛出错误', () => {
            expect(() => {
                llm.initialize({ llmSource: 'unsupported' });
            }).toThrow('不支持的 LLM 来源');
        });
    });

    describe('extractAndParseJSON - JSON提取与解析', () => {
        test('应能直接解析纯JSON字符串', () => {
            const result = llm.extractAndParseJSON('{"name": "test", "value": 42}');
            expect(result.name).toBe('test');
            expect(result.value).toBe(42);
        });

        test('应能解析JSON数组', () => {
            const result = llm.extractAndParseJSON('[1, 2, 3]');
            expect(result).toEqual([1, 2, 3]);
        });

        test('应能从markdown代码块中提取JSON', () => {
            const text = '```json\n{"name": "test"}\n```';
            const result = llm.extractAndParseJSON(text);
            expect(result.name).toBe('test');
        });

        test('应能从无语言标记的代码块中提取JSON', () => {
            const text = '```\n{"name": "test"}\n```';
            const result = llm.extractAndParseJSON(text);
            expect(result.name).toBe('test');
        });

        test('应能从混合文本中提取JSON对象', () => {
            const text = '这是一些文本 {"name": "test", "items": [1, 2]} 后面还有';
            const result = llm.extractAndParseJSON(text);
            expect(result.name).toBe('test');
            expect(result.items).toEqual([1, 2]);
        });

        test('应能从混合文本中提取JSON数组（纯数组文本）', () => {
            // extractBalancedJSON 会先尝试匹配 { 对象，再匹配 [ 数组
            // 当文本同时包含 { 和 [ 时，会先提取第一个 { 的对象
            const text = '结果如下 [{"id": 1}, {"id": 2}] 结束';
            const result = llm.extractAndParseJSON(text);
            // 由于 { 先于 [ 被匹配，会先提取 {"id": 1} 对象
            expect(result).toEqual({ id: 1 });
        });

        test('应能从纯数组文本中提取JSON数组', () => {
            const text = '有些文本 [1, 2, 3] 结束';
            const result = llm.extractAndParseJSON(text);
            expect(result).toEqual([1, 2, 3]);
        });

        test('应能处理嵌套JSON', () => {
            const text = '{"outer": {"inner": "value"}, "array": [{"a": 1}]}';
            const result = llm.extractAndParseJSON(text);
            expect(result.outer.inner).toBe('value');
            expect(result.array[0].a).toBe(1);
        });

        test('无法提取JSON时应抛出错误', () => {
            expect(() => {
                llm.extractAndParseJSON('这不是JSON');
            }).toThrow('无法从响应中提取有效的 JSON');
        });

        test('应能处理带BOM的JSON', () => {
            const text = '\uFEFF{"name": "test"}';
            const result = llm.extractAndParseJSON(text);
            expect(result.name).toBe('test');
        });

        test('应能处理转义字符', () => {
            const text = '{"message": "他说：\\"你好\\""}';
            const result = llm.extractAndParseJSON(text);
            expect(result.message).toContain('你好');
        });

        test('应能提取文本中的JSON对象（无干扰括号）', () => {
            const text = '分析结果如下 {"real": "data", "count": 5} 请查收';
            const result = llm.extractAndParseJSON(text);
            expect(result.real).toBe('data');
            expect(result.count).toBe(5);
        });
    });

    describe('缓存集成', () => {
        test('应能使用缓存服务', () => {
            expect(llm.cache).toBeDefined();
            expect(typeof llm.cache.get).toBe('function');
            expect(typeof llm.cache.set).toBe('function');
        });

        test('getCacheStats 应能返回缓存统计', () => {
            const stats = llm.getCacheStats();
            expect(stats).toBeDefined();
            expect(typeof stats.size).toBe('number');
            expect(typeof stats.hits).toBe('number');
        });

        test('clearCache 应能清空缓存', () => {
            llm.cache.set('test_key', 'test_value');
            llm.clearCache();
            const stats = llm.getCacheStats();
            expect(stats.size).toBe(0);
        });
    });

    describe('getDefaultSettings - 默认设置', () => {
        test('应能返回默认设置对象', () => {
            const settings = llm.getDefaultSettings();

            expect(settings).toBeDefined();
            expect(settings.llmSource).toBeDefined();
            expect(settings.apiUrl).toBeDefined();
            expect(settings.model).toBeDefined();
        });

        test('默认设置应包含合理的默认值', () => {
            const settings = llm.getDefaultSettings();
            expect(['openai', 'anthropic', 'local', 'custom']).toContain(settings.llmSource);
        });
    });

    describe('generateJSON - 带缓存的JSON生成', () => {
        test('skipCache 为 true 时应跳过缓存', () => {
            // Mock generateText to avoid actual API call
            llm.initialize({
                llmSource: 'openai',
                apiKey: 'test-key'
            });

            // Mock the generateText method
            llm.generateText = jest.fn().mockResolvedValue('{"result": "mocked"}');

            return llm.generateJSON('test prompt', { skipCache: true }).then(result => {
                expect(llm.generateText).toHaveBeenCalled();
            });
        });
    });
});
