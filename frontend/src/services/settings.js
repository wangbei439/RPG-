const FIELD_MAP = {
    openai: {
        apiUrl: { id: 'openai-url', fallback: 'https://api.openai.com/v1' },
        apiKey: { id: 'openai-key' },
        model: { id: 'openai-model', fallback: 'gpt-4o' }
    },
    anthropic: {
        apiKey: { id: 'anthropic-key' },
        model: { id: 'anthropic-model', fallback: 'claude-3-5-sonnet-20241022' }
    },
    local: {
        apiUrl: { id: 'ollama-url', fallback: 'http://localhost:11434' },
        model: { id: 'ollama-model', fallback: 'llama3' }
    },
    custom: {
        apiUrl: { id: 'custom-url' },
        apiKey: { id: 'custom-key' },
        model: { id: 'custom-model' }
    }
};

const GENERATION_FIELDS = {
    difficulty: { id: 'game-difficulty', fallback: 'normal' },
    length: { id: 'game-length', fallback: 'medium' },
    enableImages: { id: 'enable-images', type: 'checkbox', fallback: true },
    imageSource: { id: 'image-source', fallback: 'zai' },
    imageGenerationMode: { id: 'image-generation-mode', fallback: 'auto' },
    comfyuiUrl: { id: 'comfyui-url', fallback: 'http://127.0.0.1:8000' },
    comfyuiImageCount: { id: 'comfyui-image-count', fallback: '1' },
    comfyuiModel: { id: 'comfyui-model', fallback: '' },
    comfyuiSampler: { id: 'comfyui-sampler', fallback: 'euler' },
    comfyuiScheduler: { id: 'comfyui-scheduler', fallback: 'normal' },
    comfyuiWidth: { id: 'comfyui-width', fallback: '768' },
    comfyuiHeight: { id: 'comfyui-height', fallback: '512' },
    comfyuiSteps: { id: 'comfyui-steps', fallback: '20' },
    comfyuiCfg: { id: 'comfyui-cfg', fallback: '7.5' },
    comfyuiSeed: { id: 'comfyui-seed', fallback: '-1' },
    comfyuiTimeoutMs: { id: 'comfyui-timeout-ms', fallback: '180000' },
    comfyuiPromptPrefix: { id: 'comfyui-prompt-prefix', fallback: 'RPG game scene' },
    comfyuiPromptSuffix: { id: 'comfyui-prompt-suffix', fallback: 'high quality, detailed, fantasy art style' },
    comfyuiNegativePrompt: { id: 'comfyui-negative-prompt', fallback: 'low quality, blurry, deformed, ugly, bad anatomy, watermark, text' },
    comfyuiFilenamePrefix: { id: 'comfyui-filename-prefix', fallback: 'rpg_scene' },
    comfyuiWorkflowMode: { id: 'comfyui-workflow-mode', fallback: 'custom' },
    comfyuiWorkflowFile: { id: 'comfyui-workflow-file', fallback: '' },
    comfyuiWorkflowJson: { id: 'comfyui-workflow-json', fallback: '' },
    imageApiUrl: { id: 'image-api-url', fallback: '' },
    imageApiKey: { id: 'image-api-key', fallback: '' },
    pollinationsModel: { id: 'pollinations-model', fallback: 'flux' },
    pollinationsWidth: { id: 'pollinations-width', fallback: '1440' },
    pollinationsHeight: { id: 'pollinations-height', fallback: '720' },
    pollinationsSeed: { id: 'pollinations-seed', fallback: '-1' },
    puterModel: { id: 'puter-model', fallback: 'gpt-image-1' },
    puterWidth: { id: 'puter-width', fallback: '1440' },
    puterHeight: { id: 'puter-height', fallback: '720' }
};

function readValue(id, doc) {
    return doc.getElementById(id)?.value || '';
}

function readField(field, doc) {
    const element = doc.getElementById(field.id);
    if (!element) {
        return field.fallback;
    }

    if (field.type === 'checkbox') {
        return element.checked;
    }

    return element.value || field.fallback || '';
}

function writeValue(id, value, doc) {
    const element = doc.getElementById(id);
    if (element && value !== undefined) {
        element.value = value;
    }
}

function writeField(field, value, doc) {
    const element = doc.getElementById(field.id);
    if (!element || value === undefined) {
        return;
    }

    if (field.type === 'checkbox') {
        element.checked = Boolean(value);
        return;
    }

    element.value = value;
}

export function collectLlmSettings(source = null, doc = document) {
    const llmSource = source || doc.getElementById('llm-source')?.value || '';
    const config = FIELD_MAP[llmSource] || {};
    const settings = { llmSource };

    for (const [key, field] of Object.entries(config)) {
        const value = readValue(field.id, doc) || field.fallback || '';
        // Skip masked API keys (containing ***) — backend will use DB value instead
        if (key === 'apiKey' && typeof value === 'string' && value.includes('***')) {
            continue;
        }
        settings[key] = value;
    }

    return settings;
}

export function applyLlmSettings(settings, doc = document) {
    const llmSource = settings.llmSource || 'openai';
    doc.getElementById('llm-source').value = llmSource;
    doc.getElementById('llm-source').dispatchEvent(new Event('change'));

    const config = FIELD_MAP[llmSource] || {};
    for (const [key, field] of Object.entries(config)) {
        writeValue(field.id, settings[key] || field.fallback || '', doc);
    }
}

export function collectGenerationConfig(doc = document) {
    const config = { settings: collectLlmSettings(null, doc) };

    for (const [key, field] of Object.entries(GENERATION_FIELDS)) {
        config[key] = readField(field, doc);
    }

    return config;
}

export function applyGenerationConfig(config = {}, doc = document) {
    for (const [key, field] of Object.entries(GENERATION_FIELDS)) {
        writeField(field, config[key] ?? field.fallback, doc);
    }
}

export function normalizeGenerationConfig(config = {}) {
    const normalized = {};
    for (const [key, field] of Object.entries(GENERATION_FIELDS)) {
        normalized[key] = config[key] ?? field.fallback;
    }
    if (config.settings) normalized.settings = config.settings;
    return normalized;
}
