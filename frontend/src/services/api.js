const defaultApiBase = `${window.location.origin}/api`;
const configuredApiBase = window.localStorage.getItem('rpg_generator_api_base') || '';

export const API_BASE = (configuredApiBase || defaultApiBase).replace(/\/$/, '');

async function parseErrorMessage(response) {
    try {
        const payload = await response.json();
        return payload?.error || payload?.message || `${response.status} ${response.statusText}`;
    } catch {
        return `${response.status} ${response.statusText}`;
    }
}

export async function requestJson(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);

    if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
    }

    return response.json();
}

export async function requestJsonWithProgress(path, options = {}, onProgress = null) {
    const response = await fetch(`${API_BASE}${path}`, options);

    if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
    }

    // 检查是否是 SSE 响应
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/event-stream')) {
        return await handleSSEResponse(response, onProgress);
    }

    // 普通 JSON 响应
    return response.json();
}

async function handleSSEResponse(response, onProgress) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = null;

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'progress' && onProgress) {
                    onProgress(data.percent, data.message);
                } else if (data.type === 'complete') {
                    result = data;
                } else if (data.type === 'error') {
                    throw new Error(data.message || '解析失败');
                }
            } catch (error) {
                if (error.message !== '解析失败') {
                    console.warn('Failed to parse SSE message:', line, error);
                }
                throw error;
            }
        }
    }

    if (!result) {
        throw new Error('未收到完整的响应数据');
    }

    return result;
}

export function createJsonRequest(method, body) {
    return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
}
