const OpenAI = require('openai');
const CacheService = require('./CacheService');
const CostTracker = require('./CostTracker');

class LLMService {
    constructor() {
        this.client = null;
        this.settings = null;
        this.cache = new CacheService({ maxSize: 500, ttl: 1800000 }); // 30分钟缓存
    }

    initialize(settings) {
        this.settings = settings;

        switch (settings.llmSource) {
            case 'openai':
                this.client = new OpenAI({
                    apiKey: settings.apiKey,
                    baseURL: settings.apiUrl || 'https://api.openai.com/v1'
                });
                break;
            case 'anthropic':
                this.client = { type: 'anthropic', apiKey: settings.apiKey, model: settings.model };
                break;
            case 'local':
                this.client = new OpenAI({
                    apiKey: 'ollama',
                    baseURL: `${settings.apiUrl || 'http://localhost:11434'}/v1`
                });
                break;
            case 'custom':
                this.client = new OpenAI({
                    apiKey: settings.apiKey || 'custom',
                    baseURL: settings.apiUrl
                });
                break;
            default:
                throw new Error('不支持的 LLM 来源');
        }
    }

    async generateText(prompt, options = {}) {
        if (!this.client) {
            this.initialize(this.getDefaultSettings());
        }

        const model = this.settings?.model || 'gpt-4o';
        const maxTokens = options.maxTokens || 2000;

        try {
            if (this.client.type === 'anthropic') {
                return await this.generateAnthropicText(prompt, model, maxTokens);
            }

            const response = await this.client.chat.completions.create({
                model: this.settings?.model || model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: maxTokens,
                temperature: options.temperature || 0.8
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('LLM generate error:', error);
            throw new Error(`AI 生成失败：${error.message}`);
        }
    }

    async generateJSON(prompt, options = {}) {
        // 检查缓存
        const cacheKey = this.cache.generateKey(prompt, {
            model: this.settings?.model,
            temperature: 0.7
        });

        if (!options.skipCache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                console.log('使用缓存结果');
                return cached;
            }
        }

        const jsonPrompt = `${prompt}\n\n请只返回有效的 JSON，不要包含代码块、解释或额外文字。确保结果可以被直接解析。`;
        const response = await this.generateText(jsonPrompt, { maxTokens: 8000, temperature: 0.7 });

        try {
            const result = this.extractAndParseJSON(response);
            // 缓存结果
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error('JSON parse error:', error);
            console.error('Raw response:', response);
            return { error: `无法解析 AI 响应：${error.message}`, raw: response };
        }
    }

    /**
     * 流式生成 JSON（新增）
     */
    async generateJSONStreaming(prompt, onChunk) {
        const jsonPrompt = `${prompt}\n\n请只返回有效的 JSON，不要包含代码块、解释或额外文字。确保结果可以被直接解析。`;

        if (!this.client) {
            this.initialize(this.getDefaultSettings());
        }

        const model = this.settings?.model || 'gpt-4o';

        try {
            if (this.client.type === 'anthropic') {
                // Anthropic 暂不支持流式，回退到普通模式
                const result = await this.generateJSON(prompt);
                onChunk(JSON.stringify(result));
                return result;
            }

            const stream = await this.client.chat.completions.create({
                model: this.settings?.model || model,
                messages: [{ role: 'user', content: jsonPrompt }],
                max_tokens: 8000,
                temperature: 0.7,
                stream: true
            });

            let fullText = '';
            let lastValidJSON = null;

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                fullText += content;

                // 尝试解析部分 JSON
                try {
                    const parsed = this.extractAndParseJSON(fullText);
                    lastValidJSON = parsed;
                    onChunk(parsed);
                } catch (e) {
                    // 还没有完整的 JSON，继续
                }
            }

            // 返回最终结果
            if (lastValidJSON) {
                return lastValidJSON;
            }

            return this.extractAndParseJSON(fullText);
        } catch (error) {
            console.error('LLM streaming error:', error);
            throw new Error(`AI 流式生成失败：${error.message}`);
        }
    }

    /**
     * 流式生成文本（新增）
     */
    async generateTextStreaming(prompt, onChunk, options = {}) {
        if (!this.client) {
            this.initialize(this.getDefaultSettings());
        }

        const model = this.settings?.model || 'gpt-4o';
        const maxTokens = options.maxTokens || 2000;

        try {
            if (this.client.type === 'anthropic') {
                // Anthropic 暂不支持流式，回退到普通模式
                const result = await this.generateText(prompt, options);
                onChunk(result);
                return result;
            }

            const stream = await this.client.chat.completions.create({
                model: this.settings?.model || model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: maxTokens,
                temperature: options.temperature || 0.8,
                stream: true
            });

            let fullText = '';

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullText += content;
                    onChunk(content);
                }
            }

            return fullText;
        } catch (error) {
            console.error('LLM streaming error:', error);
            throw new Error(`AI 流式生成失败：${error.message}`);
        }
    }

    extractAndParseJSON(text) {
        // Step 1: Try to parse the entire text as-is
        try {
            return JSON.parse(text.trim());
        } catch {
            // Continue to next step
        }

        // Step 2: Extract content from markdown code blocks
        // Handle ```json ... ``` or ``` ... ```
        const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
        let codeBlockMatch = codeBlockRegex.exec(text);
        while (codeBlockMatch) {
            try {
                return JSON.parse(codeBlockMatch[1].trim());
            } catch {
                codeBlockMatch = codeBlockRegex.exec(text);
            }
        }

        // Step 3: Find JSON object pattern { ... } with balanced braces
        const objectResult = this.extractBalancedJSON(text, '{');
        if (objectResult !== null) {
            return objectResult;
        }

        // Step 4: Find JSON array pattern [ ... ] with balanced brackets
        const arrayResult = this.extractBalancedJSON(text, '[');
        if (arrayResult !== null) {
            return arrayResult;
        }

        // Step 5: Last resort - try regex match for outermost braces/brackets
        const braceMatch = text.match(/\{[\s\S]*\}/);
        if (braceMatch) {
            try {
                return JSON.parse(braceMatch[0]);
            } catch {
                // Continue
            }
        }

        const bracketMatch = text.match(/\[[\s\S]*\]/);
        if (bracketMatch) {
            try {
                return JSON.parse(bracketMatch[0]);
            } catch {
                // Continue
            }
        }

        throw new Error('无法从响应中提取有效的 JSON');
    }

    extractBalancedJSON(text, startChar) {
        const endChar = startChar === '{' ? '}' : ']';
        const startIndex = text.indexOf(startChar);

        if (startIndex === -1) {
            return null;
        }

        let depth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = startIndex; i < text.length; i++) {
            const char = text[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === startChar) {
                    depth++;
                } else if (char === endChar) {
                    depth--;
                    if (depth === 0) {
                        const jsonStr = text.substring(startIndex, i + 1);
                        try {
                            return JSON.parse(jsonStr);
                        } catch {
                            return null;
                        }
                    }
                }
            }
        }

        return null;
    }

    async generateAnthropicText(prompt, model, maxTokens) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.client.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model || 'claude-3-5-sonnet-20241022',
                max_tokens: maxTokens,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            throw new Error(`Anthropic API 错误：${response.statusText}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    async testConnection() {
        if (!this.client) {
            this.initialize(this.getDefaultSettings());
        }

        try {
            if (this.client.type === 'anthropic') {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': this.client.apiKey,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: this.client.model || 'claude-3-5-sonnet-20241022',
                        max_tokens: 10,
                        messages: [{ role: 'user', content: '请回复 OK' }]
                    })
                });

                if (!response.ok) {
                    throw new Error(`API 返回 ${response.statusText}`);
                }

                return { success: true, model: this.client.model };
            }

            const response = await this.client.chat.completions.create({
                model: this.settings?.model || 'gpt-4o',
                messages: [{ role: 'user', content: '请回复 OK' }],
                max_tokens: 10
            });

            return { success: true, model: response.model || this.settings?.model };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async generateMultiple(prompt, count = 3) {
        const results = [];

        for (let index = 0; index < count; index += 1) {
            const variantPrompt = count > 1
                ? `${prompt}\n\n请生成一个与之前不同的新方案。这是第 ${index + 1} 个方案。`
                : prompt;
            const result = await this.generateJSON(variantPrompt);
            results.push(result);
        }

        return results;
    }

    getDefaultSettings() {
        return {
            llmSource: process.env.LLM_SOURCE || 'openai',
            apiUrl: process.env.OPENAI_URL || 'https://api.openai.com/v1',
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-4o'
        };
    }

    /**
     * 获取缓存统计
     */
    getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache.clear();
    }
}

module.exports = LLMService;
