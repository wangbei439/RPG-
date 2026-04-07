export const API_BASE = 'http://localhost:3000/api';

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

export function createJsonRequest(method, body) {
    return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
}
