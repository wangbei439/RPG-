const OpenAI = require('openai');
const CacheService = require('./CacheService');

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
                if (!settings.apiUrl) {
                    throw new Error('自定义接口必须提供接口地址');
                }
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
                return await this.generateAnthropicText(prompt, model, maxTokens, options);
            }

            const messages = [];
            if (options.systemPrompt) {
                messages.push({ role: 'system', content: options.systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });

            const response = await this.client.chat.completions.create({
                model: this.settings?.model || model,
                messages,
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
                // Anthropic 使用原生流式 API
                let fullText = '';
                let lastValidJSON = null;

                await this.generateAnthropicTextStreaming(jsonPrompt, (textDelta) => {
                    fullText += textDelta;

                    // 尝试解析部分 JSON
                    try {
                        const parsed = this.extractAndParseJSON(fullText);
                        lastValidJSON = parsed;
                        onChunk(parsed);
                    } catch (e) {
                        // 还没有完整的 JSON，继续
                    }
                }, model, 8000, { temperature: 0.7 });

                // 返回最终结果
                if (lastValidJSON) {
                    return lastValidJSON;
                }

                return this.extractAndParseJSON(fullText);
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
                // Anthropic 使用原生流式 API
                return await this.generateAnthropicTextStreaming(prompt, onChunk, model, maxTokens, options);
            }

            const messages = [];
            if (options.systemPrompt) {
                messages.push({ role: 'system', content: options.systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });

            const stream = await this.client.chat.completions.create({
                model: this.settings?.model || model,
                messages,
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

    async generateAnthropicText(prompt, model, maxTokens, options = {}) {
        const requestBody = {
            model: model || 'claude-3-5-sonnet-20241022',
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }]
        };

        // 支持 system prompt
        if (options.systemPrompt) {
            requestBody.system = options.systemPrompt;
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.client.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Anthropic API 错误：${response.statusText} ${errorBody}`);
        }

        const data = await response.json();
        return data.content[0].text;
    }

    /**
     * Anthropic 流式文本生成
     * 使用 Anthropic SSE streaming API 实时返回文本片段
     */
    async generateAnthropicTextStreaming(prompt, onChunk, model, maxTokens, options = {}) {
        const requestBody = {
            model: model || 'claude-3-5-sonnet-20241022',
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
            stream: true
        };

        // 支持 system prompt
        if (options.systemPrompt) {
            requestBody.system = options.systemPrompt;
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.client.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Anthropic API 错误：${response.statusText} ${errorBody}`);
        }

        let fullText = '';
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();

                    if (!trimmed || !trimmed.startsWith('data: ')) continue;

                    const jsonStr = trimmed.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const event = JSON.parse(jsonStr);

                        if (event.type === 'content_block_delta'
                            && event.delta
                            && event.delta.type === 'text_delta'
                            && event.delta.text) {
                            fullText += event.delta.text;
                            onChunk(event.delta.text);
                        }
                    } catch (parseError) {
                        // 忽略非 JSON 行或不完整的数据
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return fullText;
    }

    async testConnection() {
        if (!this.client) {
            this.initialize(this.getDefaultSettings());
        }

        try {
            if (this.client.type === 'anthropic') {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);

                try {
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
                        }),
                        signal: controller.signal
                    });

                    if (!response.ok) {
                        const errorBody = await response.text().catch(() => '');
                        throw new Error(`API 返回 ${response.status} ${response.statusText}: ${errorBody.slice(0, 200)}`);
                    }

                    return { success: true, model: this.client.model };
                } finally {
                    clearTimeout(timeout);
                }
            }

            // OpenAI-compatible (openai / local / custom)
            const response = await this.client.chat.completions.create({
                model: this.settings?.model || 'gpt-4o',
                messages: [{ role: 'user', content: '请回复 OK' }],
                max_tokens: 10
            }, {
                timeout: 15000 // 15-second timeout
            });

            return { success: true, model: response.model || this.settings?.model };
        } catch (error) {
            // Provide more specific error messages
            let message = error.message || '';

            // OpenAI SDK wraps some errors; dig into the cause
            const cause = error.cause || error.error;
            const causeCode = cause?.code || error.code;
            const causeMessage = cause?.message || '';

            if (causeCode === 'ECONNREFUSED' || message.includes('ECONNREFUSED') || causeMessage.includes('ECONNREFUSED')) {
                message = '无法连接到服务器，请检查接口地址是否正确，以及目标服务是否已启动';
            } else if (causeCode === 'ENOTFOUND' || message.includes('ENOTFOUND') || causeMessage.includes('ENOTFOUND')) {
                message = '域名解析失败，请检查接口地址是否拼写正确';
            } else if (error.name === 'AbortError' || causeCode === 'ETIMEDOUT' || causeCode === 'UND_ERR_CONNECT_TIMEOUT') {
                message = '连接超时，请检查网络或接口地址是否可达';
            } else if (error.status === 401 || cause?.status === 401) {
                message = '认证失败 (401)，请检查 API 密钥是否正确';
            } else if (error.status === 404 || cause?.status === 404) {
                message = '接口地址无效 (404)，请检查 URL 路径是否正确（如 /v1/chat/completions）';
            } else if (error.status === 429 || cause?.status === 429) {
                message = '请求频率过高 (429)，请稍后重试';
            } else if (message.includes('Invalid URL') || causeMessage.includes('Invalid URL')) {
                message = '接口地址格式无效，请输入完整的 URL（如 https://api.example.com/v1）';
            } else if (message.includes('Connection error')) {
                message = '网络连接失败，请检查接口地址是否正确、目标服务是否已启动';
            }
            return { success: false, error: message };
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
