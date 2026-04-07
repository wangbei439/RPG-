import './styles/main.css';
import { createJsonRequest, requestJson } from './services/api.js';
import {
    applyGenerationConfig,
    applyLlmSettings,
    collectGenerationConfig,
    collectLlmSettings
} from './services/settings.js';

const state = {
    currentGameType: null,
    currentGameId: null,
    currentGameData: null,
    gameState: null,
    currentGenerationConfig: null,
    currentSessionId: null,
    currentStepId: null,
    allSteps: [],
    stepStates: {},
    sceneImages: [],
    selectedSceneImageIndex: 0,
    lastSuggestedImagePrompt: ''
};

const LLM_SETTINGS_KEY = 'rpg_generator_settings';
const GENERATION_SETTINGS_KEY = 'rpg_generator_generation_settings';

const gameTypeNames = {
    adventure: '冒险 RPG',
    dungeon: '地牢探索',
    romance: '恋爱模拟',
    mystery: '推理解谜',
    fantasy: '奇幻魔法',
    scifi: '科幻星际',
    survival: '生存挑战',
    kingdom: '王国建设',
    cultivation: '修仙问道',
    custom: '自定义 RPG'
};

const stepDescriptions = {
    worldview: { icon: '世', name: '世界观', desc: '先确定世界背景、主要势力、地点与规则。' },
    coreCharacters: { icon: '核', name: '核心角色', desc: '生成推动主线的关键角色。' },
    secondaryCharacters: { icon: '辅', name: '次要角色', desc: '补充世界细节与互动节点。' },
    items: { icon: '物', name: '物品道具', desc: '生成装备、任务物品和关键奖励。' },
    puzzles: { icon: '谜', name: '谜题挑战', desc: '设计挑战、机关和探索障碍。' },
    mainPlot: { icon: '主', name: '主线剧情', desc: '组织章节推进与核心冲突。' },
    sidePlots: { icon: '支', name: '支线剧情', desc: '补充可选故事和人物支线。' },
    fragments: { icon: '碎', name: '碎片内容', desc: '生成可探索的世界细节与传闻。' },
    integration: { icon: '整', name: '整合方案', desc: '把已确认内容整合成最终可玩的方案。' }
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSavedGames();
    initSettings();
    initConfigForm();
    initWorkbench();
    initGameScreen();
    loadSettings();
});

function getStepState(stepId) {
    if (!state.stepStates[stepId]) {
        state.stepStates[stepId] = {
            candidates: [],
            selectedIndex: -1,
            status: 'idle',
            history: []
        };
    }

    return state.stepStates[stepId];
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
}

function setApiStatus(status, text) {
    const dot = document.getElementById('api-status-dot');
    const label = document.getElementById('api-status-text');

    if (dot) {
        dot.className = 'status-dot';
        dot.classList.add(`status-${status}`);
    }

    if (label) {
        label.textContent = text;
    }
}

function updateProgress(progress, message, details = '') {
    const fill = document.getElementById('progress-fill');
    const status = document.getElementById('loading-status');
    const detail = document.getElementById('loading-details');

    if (fill) {
        fill.style.width = `${progress}%`;
    }

    if (status) {
        status.textContent = message;
    }

    if (detail) {
        detail.textContent = details;
    }
}

function toggleImageSettings() {
    const source = document.getElementById('image-source').value;
    document.getElementById('comfyui-settings').style.display = source === 'comfyui' ? 'block' : 'none';
    document.getElementById('api-settings').style.display = source === 'api' ? 'block' : 'none';
    toggleComfyWorkflowMode();
}

function initializeComfyUiPanel() {
    const container = document.getElementById('comfyui-settings');
    if (!container || container.dataset.enhanced === 'true') {
        return;
    }

    container.innerHTML = `
        <div class="sub-config-row">
            <input type="text" id="comfyui-url" data-generation-setting="true" placeholder="ComfyUI URL (default: http://127.0.0.1:8000)" value="http://127.0.0.1:8000" />
            <button type="button" id="refresh-comfyui-btn" class="test-btn">Refresh models</button>
            <button type="button" id="test-comfyui-btn" class="test-btn">Test connection</button>
        </div>
        <div class="sub-config-grid">
            <div>
                <label for="image-generation-mode">Image generation mode</label>
                <select id="image-generation-mode" data-generation-setting="true">
                    <option value="manual">Manual button</option>
                    <option value="auto">Auto after each action</option>
                </select>
            </div>
            <div>
                <label for="comfyui-image-count">Image count</label>
                <input type="number" id="comfyui-image-count" data-generation-setting="true" value="1" min="1" max="8" />
            </div>
            <div>
                <label for="comfyui-workflow-mode">Workflow</label>
                <select id="comfyui-workflow-mode" data-generation-setting="true">
                    <option value="custom">Custom JSON</option>
                    <option value="default">Default template</option>
                </select>
            </div>
        </div>
        <div class="helper-text">
            Recommended: keep this on <strong>Custom JSON</strong>. We only inject the prompt and image count into your existing ComfyUI workflow.
        </div>
        <div id="comfyui-default-workflow-fields" style="display:none">
            <div class="sub-config-grid">
                <div>
                    <label for="comfyui-model">Checkpoint</label>
                    <select id="comfyui-model" data-generation-setting="true">
                        <option value="">Refresh to load models</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-sampler">Sampler</label>
                    <select id="comfyui-sampler" data-generation-setting="true">
                        <option value="euler">euler</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-scheduler">Scheduler</label>
                    <select id="comfyui-scheduler" data-generation-setting="true">
                        <option value="normal">normal</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-width">Width</label>
                    <input type="number" id="comfyui-width" data-generation-setting="true" value="768" min="256" max="2048" step="64" />
                </div>
                <div>
                    <label for="comfyui-height">Height</label>
                    <input type="number" id="comfyui-height" data-generation-setting="true" value="512" min="256" max="2048" step="64" />
                </div>
                <div>
                    <label for="comfyui-steps">Steps</label>
                    <input type="number" id="comfyui-steps" data-generation-setting="true" value="20" min="1" max="150" />
                </div>
                <div>
                    <label for="comfyui-cfg">CFG</label>
                    <input type="number" id="comfyui-cfg" data-generation-setting="true" value="7.5" min="0.1" max="30" step="0.1" />
                </div>
                <div>
                    <label for="comfyui-seed">Seed</label>
                    <input type="number" id="comfyui-seed" data-generation-setting="true" value="-1" />
                </div>
            </div>
        </div>
        <div class="sub-config-grid">
            <div>
                <label for="comfyui-timeout-ms">Timeout (ms)</label>
                <input type="number" id="comfyui-timeout-ms" data-generation-setting="true" value="180000" min="5000" step="1000" />
            </div>
            <div>
                <label for="comfyui-filename-prefix">Filename prefix</label>
                <input type="text" id="comfyui-filename-prefix" data-generation-setting="true" placeholder="Filename prefix" value="rpg_scene" />
            </div>
        </div>
        <div id="comfyui-custom-workflow">
            <div class="sub-config-row">
                <select id="comfyui-workflow-file" data-generation-setting="true">
                    <option value="">Select a workflow file from G:\\comfy\\wenjian\\user\\default\\workflows</option>
                </select>
                <button type="button" id="refresh-workflow-files-btn" class="test-btn">Refresh workflows</button>
                <button type="button" id="load-workflow-file-btn" class="test-btn">Load selected</button>
            </div>
            <textarea id="comfyui-workflow-json" data-generation-setting="true" rows="10" placeholder="Paste a ComfyUI workflow JSON here. If your workflow already contains CLIPTextEncode text nodes, the backend will inject the current prompt automatically. You can also use placeholders like {{prompt}}, {{raw_prompt}}, {{negative_prompt}}, {{batch_size}}, {{ckpt_name}}."></textarea>
            <div class="sub-config-actions">
                <button type="button" id="validate-workflow-btn" class="test-btn">Validate workflow</button>
            </div>
        </div>
        <details id="comfyui-prompt-overrides">
            <summary>Optional prompt helpers</summary>
            <div class="sub-config-grid">
                <div>
                    <label for="comfyui-prompt-prefix">Prompt prefix</label>
                    <input type="text" id="comfyui-prompt-prefix" data-generation-setting="true" placeholder="Positive prefix" value="RPG game scene" />
                </div>
                <div>
                    <label for="comfyui-prompt-suffix">Prompt suffix</label>
                    <input type="text" id="comfyui-prompt-suffix" data-generation-setting="true" placeholder="Positive suffix" value="high quality, detailed, fantasy art style" />
                </div>
                <div>
                    <label for="comfyui-negative-prompt">Negative prompt</label>
                    <input type="text" id="comfyui-negative-prompt" data-generation-setting="true" placeholder="Negative prompt" value="low quality, blurry, deformed, ugly, bad anatomy, watermark, text" />
                </div>
            </div>
        </details>
        <div id="comfyui-status" class="helper-text">ComfyUI settings have not been checked yet.</div>
    `;

    container.dataset.enhanced = 'true';
}

function initializeLiveImageConfigPanel() {
    const container = document.getElementById('live-image-config');
    if (!container || container.dataset.enhanced === 'true') {
        return;
    }

    container.innerHTML = `
        <div class="live-image-config-card">
            <div class="sub-config-row">
                <select id="live-comfyui-model">
                    <option value="">Select model</option>
                </select>
                <select id="live-comfyui-workflow-file">
                    <option value="">Select workflow file</option>
                </select>
                <button type="button" id="live-load-workflow-btn" class="test-btn">Load workflow</button>
            </div>
            <div class="sub-config-row">
                <button type="button" id="live-refresh-comfyui-btn" class="test-btn">Refresh models</button>
                <button type="button" id="live-refresh-workflow-files-btn" class="test-btn">Refresh workflows</button>
                <button type="button" id="live-test-comfyui-btn" class="test-btn">Test ComfyUI</button>
            </div>
            <details id="live-comfyui-settings">
                <summary>ComfyUI live settings</summary>
                <div class="sub-config-grid" style="margin-top:0.75rem">
                    <div>
                        <label for="live-comfyui-url">ComfyUI URL</label>
                        <input type="text" id="live-comfyui-url" value="http://127.0.0.1:8000" />
                    </div>
                    <div>
                        <label for="live-comfyui-workflow-mode">Workflow mode</label>
                        <select id="live-comfyui-workflow-mode">
                            <option value="custom">Custom workflow</option>
                            <option value="default">Default template</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-sampler">Sampler</label>
                        <select id="live-comfyui-sampler">
                            <option value="euler">euler</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-scheduler">Scheduler</label>
                        <select id="live-comfyui-scheduler">
                            <option value="normal">normal</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-width">Width</label>
                        <input type="number" id="live-comfyui-width" value="768" min="256" max="2048" step="64" />
                    </div>
                    <div>
                        <label for="live-comfyui-height">Height</label>
                        <input type="number" id="live-comfyui-height" value="512" min="256" max="2048" step="64" />
                    </div>
                    <div>
                        <label for="live-comfyui-steps">Steps</label>
                        <input type="number" id="live-comfyui-steps" value="20" min="1" max="150" />
                    </div>
                    <div>
                        <label for="live-comfyui-cfg">CFG</label>
                        <input type="number" id="live-comfyui-cfg" value="7.5" min="0.1" max="30" step="0.1" />
                    </div>
                    <div>
                        <label for="live-comfyui-seed">Seed</label>
                        <input type="number" id="live-comfyui-seed" value="-1" />
                    </div>
                    <div>
                        <label for="live-comfyui-timeout-ms">Timeout (ms)</label>
                        <input type="number" id="live-comfyui-timeout-ms" value="180000" min="5000" step="1000" />
                    </div>
                </div>
                <div class="sub-config-grid">
                    <div>
                        <label for="live-comfyui-prompt-prefix">Prompt prefix</label>
                        <input type="text" id="live-comfyui-prompt-prefix" value="RPG game scene" />
                    </div>
                    <div>
                        <label for="live-comfyui-prompt-suffix">Prompt suffix</label>
                        <input type="text" id="live-comfyui-prompt-suffix" value="high quality, detailed, fantasy art style" />
                    </div>
                    <div>
                        <label for="live-comfyui-negative-prompt">Negative prompt</label>
                        <input type="text" id="live-comfyui-negative-prompt" value="low quality, blurry, deformed, ugly, bad anatomy, watermark, text" />
                    </div>
                    <div>
                        <label for="live-comfyui-filename-prefix">Filename prefix</label>
                        <input type="text" id="live-comfyui-filename-prefix" value="rpg_scene" />
                    </div>
                </div>
                <div id="live-comfyui-custom-workflow" style="margin-top:0.75rem">
                    <textarea id="live-comfyui-workflow-json" rows="8" placeholder="Custom workflow JSON will load here."></textarea>
                    <div class="sub-config-actions">
                        <button type="button" id="live-validate-workflow-btn" class="test-btn">Validate workflow</button>
                    </div>
                </div>
            </details>
            <div id="live-comfyui-status" class="helper-text">API mode uses the generate button directly. Switch to ComfyUI to adjust model and workflow here.</div>
        </div>
    `;

    container.dataset.enhanced = 'true';
}

function toggleLiveWorkflowMode() {
    const workflowMode = document.getElementById('live-comfyui-workflow-mode');
    const customFields = document.getElementById('live-comfyui-custom-workflow');

    if (!workflowMode || !customFields) {
        return;
    }

    customFields.style.display = workflowMode.value === 'custom' ? 'block' : 'none';
}

function toggleComfyWorkflowMode() {
    const workflowMode = document.getElementById('comfyui-workflow-mode');
    const customFields = document.getElementById('comfyui-custom-workflow');
    const defaultFields = document.getElementById('comfyui-default-workflow-fields');

    if (!workflowMode || !customFields || !defaultFields) {
        return;
    }

    const isCustom = workflowMode.value === 'custom';
    customFields.style.display = isCustom ? 'block' : 'none';
    defaultFields.style.display = isCustom ? 'none' : 'block';
}

function readComfyUIConfig() {
    const config = collectGenerationConfig();
    return {
        imageGenerationMode: config.imageGenerationMode,
        comfyuiUrl: config.comfyuiUrl,
        comfyuiImageCount: config.comfyuiImageCount,
        comfyuiModel: config.comfyuiModel,
        comfyuiSampler: config.comfyuiSampler,
        comfyuiScheduler: config.comfyuiScheduler,
        comfyuiWidth: config.comfyuiWidth,
        comfyuiHeight: config.comfyuiHeight,
        comfyuiSteps: config.comfyuiSteps,
        comfyuiCfg: config.comfyuiCfg,
        comfyuiSeed: config.comfyuiSeed,
        comfyuiTimeoutMs: config.comfyuiTimeoutMs,
        comfyuiPromptPrefix: config.comfyuiPromptPrefix,
        comfyuiPromptSuffix: config.comfyuiPromptSuffix,
        comfyuiNegativePrompt: config.comfyuiNegativePrompt,
        comfyuiFilenamePrefix: config.comfyuiFilenamePrefix,
        comfyuiWorkflowMode: config.comfyuiWorkflowMode,
        comfyuiWorkflowFile: config.comfyuiWorkflowFile,
        comfyuiWorkflowJson: config.comfyuiWorkflowJson
    };
}

function readLiveComfyUIConfig() {
    return {
        imageSource: getEffectiveGenerationConfig().imageSource,
        imageGenerationMode: getEffectiveGenerationConfig().imageGenerationMode,
        comfyuiUrl: document.getElementById('live-comfyui-url')?.value || 'http://127.0.0.1:8000',
        comfyuiImageCount: document.getElementById('scene-image-count')?.value || '1',
        comfyuiModel: document.getElementById('live-comfyui-model')?.value || '',
        comfyuiSampler: document.getElementById('live-comfyui-sampler')?.value || 'euler',
        comfyuiScheduler: document.getElementById('live-comfyui-scheduler')?.value || 'normal',
        comfyuiWidth: document.getElementById('live-comfyui-width')?.value || '768',
        comfyuiHeight: document.getElementById('live-comfyui-height')?.value || '512',
        comfyuiSteps: document.getElementById('live-comfyui-steps')?.value || '20',
        comfyuiCfg: document.getElementById('live-comfyui-cfg')?.value || '7.5',
        comfyuiSeed: document.getElementById('live-comfyui-seed')?.value || '-1',
        comfyuiTimeoutMs: document.getElementById('live-comfyui-timeout-ms')?.value || '180000',
        comfyuiPromptPrefix: document.getElementById('live-comfyui-prompt-prefix')?.value || '',
        comfyuiPromptSuffix: document.getElementById('live-comfyui-prompt-suffix')?.value || '',
        comfyuiNegativePrompt: document.getElementById('live-comfyui-negative-prompt')?.value || '',
        comfyuiFilenamePrefix: document.getElementById('live-comfyui-filename-prefix')?.value || '',
        comfyuiWorkflowMode: document.getElementById('live-comfyui-workflow-mode')?.value || 'custom',
        comfyuiWorkflowFile: document.getElementById('live-comfyui-workflow-file')?.value || '',
        comfyuiWorkflowJson: document.getElementById('live-comfyui-workflow-json')?.value || ''
    };
}

function setComfyUiStatus(message, status = '') {
    const element = document.getElementById('comfyui-status');
    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `helper-text ${status}`.trim();
}

function setLiveComfyUiStatus(message, status = '') {
    const element = document.getElementById('live-comfyui-status');
    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `helper-text ${status}`.trim();
}

function populateSelect(selectId, values, preferredValue) {
    const select = document.getElementById(selectId);
    if (!select || !Array.isArray(values) || values.length === 0) {
        return;
    }

    const currentValue = preferredValue || select.value;
    select.innerHTML = values
        .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
        .join('');

    if (values.includes(currentValue)) {
        select.value = currentValue;
    }
}

function normalizeGenerationConfig(config = {}) {
    const normalized = { ...config };

    if (!normalized.comfyuiUrl || normalized.comfyuiUrl === 'http://127.0.0.1:8188') {
        normalized.comfyuiUrl = 'http://127.0.0.1:8000';
    }

    if (!normalized.imageGenerationMode) {
        normalized.imageGenerationMode = 'manual';
    }

    if (!normalized.comfyuiWorkflowMode) {
        normalized.comfyuiWorkflowMode = 'custom';
    }

    if (!normalized.comfyuiImageCount) {
        normalized.comfyuiImageCount = '1';
    }

    return normalized;
}

function toggleLlmSettings() {
    const source = document.getElementById('llm-source').value;
    document.querySelectorAll('.api-config').forEach((section) => {
        section.style.display = 'none';
    });

    const target = document.getElementById(`${source}-config`);
    if (target) {
        target.style.display = 'block';
    }
}

function initNavigation() {
    document.querySelectorAll('.type-card').forEach((card) => {
        card.addEventListener('click', () => {
            state.currentGameType = card.dataset.type;
            document.querySelectorAll('.type-card').forEach((item) => item.classList.remove('selected'));
            card.classList.add('selected');

            document.getElementById('config-title').textContent = `配置你的${gameTypeNames[state.currentGameType] || 'RPG'}游戏`;
            showScreen('config-screen');
        });
    });

    document.getElementById('back-to-home').addEventListener('click', () => showScreen('home-screen'));
    document.getElementById('gen-back-to-config').addEventListener('click', () => showScreen('config-screen'));

    document.getElementById('exit-game').addEventListener('click', () => {
        if (confirm('确定退出当前游戏吗？未保存进度将会丢失。')) {
            state.currentGameId = null;
            state.gameState = null;
            showScreen('home-screen');
        }
    });
}

function initSavedGames() {
    const loadSavedGamesButton = document.getElementById('load-saved-games-btn');
    const closeSavedGamesButton = document.getElementById('close-saved-games');

    loadSavedGamesButton?.addEventListener('click', () => {
        renderSavedGamesList();
        const section = document.getElementById('saved-games-section');
        if (section) {
            section.style.display = 'block';
        }
    });

    closeSavedGamesButton?.addEventListener('click', () => {
        const section = document.getElementById('saved-games-section');
        if (section) {
            section.style.display = 'none';
        }
    });
}

function initSettings() {
    const settingsModal = document.getElementById('settings-modal');
    const gameMenuModal = document.getElementById('game-menu-modal');
    initializeComfyUiPanel();

    document.getElementById('settings-btn').addEventListener('click', () => {
        settingsModal.classList.add('active');
        loadSettings();
    });

    settingsModal.querySelector('.modal-close').addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });

    gameMenuModal.querySelector('.modal-close').addEventListener('click', () => {
        gameMenuModal.classList.remove('active');
    });

    document.getElementById('save-settings').addEventListener('click', () => {
        saveSettings();
        settingsModal.classList.remove('active');
    });

    document.getElementById('llm-source').addEventListener('change', toggleLlmSettings);
    document.getElementById('image-source').addEventListener('change', async () => {
        toggleImageSettings();
        saveGenerationSettings();

        if (document.getElementById('image-source').value === 'comfyui') {
            await refreshComfyUIOptions(false);
        }
    });

    document.getElementById('comfyui-workflow-mode')?.addEventListener('change', () => {
        toggleComfyWorkflowMode();
        saveGenerationSettings();
    });

    document.getElementById('refresh-comfyui-btn')?.addEventListener('click', async () => {
        await refreshComfyUIOptions(true);
    });

    document.getElementById('refresh-workflow-files-btn')?.addEventListener('click', async () => {
        await refreshComfyWorkflowFiles(true);
    });

    document.getElementById('load-workflow-file-btn')?.addEventListener('click', async () => {
        await loadSelectedComfyWorkflowFile(true);
    });

    document.getElementById('test-comfyui-btn')?.addEventListener('click', async () => {
        await testComfyUIConnection();
    });

    document.getElementById('validate-workflow-btn')?.addEventListener('click', async () => {
        await validateComfyUIWorkflow();
    });

    document.getElementById('comfyui-workflow-file')?.addEventListener('change', (event) => {
        const workflowFile = event.target?.value || '';
        const workflowSelect = document.getElementById('comfyui-workflow-file');

        if (workflowSelect) {
            workflowSelect.dataset.selectedWorkflow = workflowFile;
        }

        saveGenerationSettings();

        if (workflowFile) {
            setComfyUiStatus(`Selected workflow: ${workflowFile}`, 'success');
        }
    });

    document.getElementById('test-openai-btn').addEventListener('click', () => testConnection('openai'));
    document.getElementById('test-anthropic-btn').addEventListener('click', () => testConnection('anthropic'));
    document.getElementById('test-local-btn').addEventListener('click', () => testConnection('local'));
    document.getElementById('test-custom-btn').addEventListener('click', () => testConnection('custom'));

    document.querySelectorAll('[data-generation-setting="true"]').forEach((element) => {
        element.addEventListener('change', () => {
            saveGenerationSettings();
            syncSceneImageControls();
        });
    });

    document.getElementById('enable-images').addEventListener('change', () => {
        saveGenerationSettings();
        syncSceneImageControls();
    });

    toggleLlmSettings();
    toggleImageSettings();
}

function saveSettings() {
    localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(collectLlmSettings()));
    saveGenerationSettings();
}

function loadSettingsLegacy() {
    const saved = localStorage.getItem('rpg_generator_settings');
    if (!saved) {
        toggleLlmSettings();
        toggleImageSettings();
        return;
    }

    try {
        applyLlmSettings(JSON.parse(saved));
        toggleLlmSettings();
        toggleImageSettings();
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

function loadSettings() {
    const savedLlm = localStorage.getItem(LLM_SETTINGS_KEY);
    const savedGeneration = localStorage.getItem(GENERATION_SETTINGS_KEY);

    try {
        if (savedLlm) {
            applyLlmSettings(JSON.parse(savedLlm));
        }

        if (savedGeneration) {
            applyGenerationConfig(normalizeGenerationConfig(JSON.parse(savedGeneration)));
        } else {
            applyGenerationConfig(normalizeGenerationConfig({}));
        }

        state.currentGenerationConfig = collectGenerationConfig();
        toggleLlmSettings();
        toggleImageSettings();
        syncSceneImageControls();

        if (state.currentGenerationConfig.imageSource === 'comfyui' && state.currentGenerationConfig.enableImages !== false) {
            refreshComfyUIOptions(false).catch((error) => {
                setComfyUiStatus(error.message, 'error');
            });
            refreshComfyWorkflowFiles(false)
                .then(() => {
                    const savedWorkflow = state.currentGenerationConfig?.comfyuiWorkflowFile;
                    const workflowJsonInput = document.getElementById('comfyui-workflow-json');

                    if (savedWorkflow && workflowJsonInput && !workflowJsonInput.value.trim()) {
                        return loadSelectedComfyWorkflowFile(false, savedWorkflow);
                    }

                    return null;
                })
                .catch((error) => {
                    setComfyUiStatus(error.message, 'error');
                });
        }
    } catch (error) {
        console.error('Load settings error:', error);
    }
}

function saveGenerationSettings() {
    const config = normalizeGenerationConfig(collectGenerationConfig());
    state.currentGenerationConfig = config;
    localStorage.setItem(GENERATION_SETTINGS_KEY, JSON.stringify(config));
}

function buildSavedGameRecord(gameId, gameState, extras = {}) {
    return {
        version: 1,
        gameId,
        title: extras.title || gameState?.name || '未命名存档',
        type: extras.type || state.currentGameType || gameState?.type || 'custom',
        savedAt: new Date().toISOString(),
        gameData: extras.gameData || state.currentGameData || null,
        generationConfig: normalizeGenerationConfig(extras.generationConfig || state.currentGenerationConfig || collectGenerationConfig()),
        gameState
    };
}

function readSavedGameRecord(storageKey) {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw);
        const gameId = storageKey.replace(/^rpg_save_/, '');

        if (parsed && parsed.version === 1 && parsed.gameState) {
            return {
                gameId: parsed.gameId || gameId,
                title: parsed.title || parsed.gameState?.name || '未命名存档',
                type: parsed.type || parsed.gameState?.type || 'custom',
                savedAt: parsed.savedAt || null,
                gameData: parsed.gameData || null,
                generationConfig: parsed.generationConfig ? normalizeGenerationConfig(parsed.generationConfig) : null,
                gameState: parsed.gameState
            };
        }

        return {
            gameId,
            title: parsed?.name || '旧存档',
            type: parsed?.type || 'custom',
            savedAt: null,
            gameData: null,
            generationConfig: null,
            gameState: parsed
        };
    } catch (error) {
        console.error('Read saved game error:', error);
        return null;
    }
}

function getSavedGames() {
    return Object.keys(localStorage)
        .filter((key) => key.startsWith('rpg_save_'))
        .map((key) => readSavedGameRecord(key))
        .filter(Boolean)
        .sort((left, right) => {
            const leftTime = left.savedAt ? new Date(left.savedAt).getTime() : 0;
            const rightTime = right.savedAt ? new Date(right.savedAt).getTime() : 0;
            return rightTime - leftTime;
        });
}

function renderSavedGamesList() {
    const container = document.getElementById('saved-games-list');
    if (!container) {
        return;
    }

    const savedGames = getSavedGames();
    if (!savedGames.length) {
        container.innerHTML = '<p class="empty-hint">暂无存档</p>';
        return;
    }

    container.innerHTML = savedGames.map((record) => `
        <button type="button" class="saved-game-card" data-saved-game-id="${escapeHtml(record.gameId)}">
            <div class="saved-game-header">
                <span class="saved-game-name">${escapeHtml(record.title || '未命名存档')}</span>
                <span class="saved-game-type">${escapeHtml(gameTypeNames[record.type] || record.type || '存档')}</span>
            </div>
            <div class="saved-game-info">ID: ${escapeHtml(record.gameId)}</div>
            <div class="saved-game-time">${escapeHtml(record.savedAt ? new Date(record.savedAt).toLocaleString() : '旧版存档')}</div>
        </button>
    `).join('');

    container.querySelectorAll('[data-saved-game-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            await loadSavedGame(button.dataset.savedGameId);
        });
    });
}

async function loadSavedGame(gameId) {
    const record = readSavedGameRecord(`rpg_save_${gameId}`);
    if (!record?.gameState) {
        alert('没有找到可读取的存档。');
        return;
    }

    let backendReady = false;

    try {
        const current = await requestJson(`/games/${record.gameId}`);
        state.currentGameData = current.game || record.gameData || null;
        backendReady = true;
    } catch (_error) {
        if (record.gameData && record.generationConfig) {
            try {
                const restored = await requestJson('/games/restore', createJsonRequest('POST', {
                    gameId: record.gameId,
                    gameData: record.gameData,
                    gameState: record.gameState,
                    config: normalizeGenerationConfig(record.generationConfig)
                }));

                record.gameId = restored.gameId || record.gameId;
                record.gameState = restored.gameState || record.gameState;
                state.currentGameData = record.gameData;
                backendReady = true;
            } catch (restoreError) {
                console.error('Restore saved game error:', restoreError);
            }
        }
    }

    state.currentGameId = record.gameId;
    state.currentGameType = record.type || state.currentGameType;
    state.gameState = record.gameState;
    state.sceneImages = [];
    state.selectedSceneImageIndex = 0;

    if (record.generationConfig) {
        state.currentGenerationConfig = normalizeGenerationConfig(record.generationConfig);
        localStorage.setItem(GENERATION_SETTINGS_KEY, JSON.stringify(state.currentGenerationConfig));
    }

    showScreen('game-screen');
    renderGameState(record.gameState);
    renderSceneImages([]);

    if (!backendReady) {
        alert('这个存档已经载入画面，但后端运行态没有恢复成功。旧存档需要重新开始后再保存一次，之后就能正常续玩。');
    }

    const savedGamesSection = document.getElementById('saved-games-section');
    if (savedGamesSection) {
        savedGamesSection.style.display = 'none';
    }
}

function initConfigForm() {
    document.getElementById('game-config-form').addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!state.currentGameType) {
            alert('请先选择一个游戏类型。');
            showScreen('home-screen');
            return;
        }

        await initGenerationSession();
    });
}

async function initGenerationSession() {
    const generationConfig = normalizeGenerationConfig(collectGenerationConfig());
    state.currentGenerationConfig = generationConfig;
    saveGenerationSettings();

    const payload = {
        userInput: document.getElementById('game-description').value.trim() || '暂无额外描述',
        gameType: state.currentGameType,
        config: generationConfig
    };

    try {
        const data = await requestJson('/generate/init', createJsonRequest('POST', payload));
        state.currentSessionId = data.sessionId;
        state.allSteps = data.steps || [];
        state.currentStepId = state.allSteps[0]?.id || null;
        state.stepStates = {};

        showScreen('generation-workbench');
        renderStepNavigation();
        await renderConfirmedElements();

        renderCurrentStep(state.currentStepId);
        renderHistoryPanel();
        setApiStatus('idle', '已创建生成会话，点击“生成”开始当前步骤。');
    } catch (error) {
        console.error('Session init error:', error);
        alert(`初始化失败：${error.message}`);
        showScreen('config-screen');
    }
}

function initWorkbench() {
    document.getElementById('generate-only-btn').addEventListener('click', async () => {
        if (state.currentStepId) {
            await loadStep(state.currentStepId);
        }
    });

    document.getElementById('regenerate-btn').addEventListener('click', async () => {
        await regenerateStep(prompt('请输入重生成补充要求（可留空）：') || '');
    });

    document.getElementById('modify-btn').addEventListener('click', () => {
        document.getElementById('custom-input-area').style.display = 'block';
        document.getElementById('custom-feedback').focus();
    });

    document.getElementById('apply-custom-btn').addEventListener('click', async () => {
        const feedback = document.getElementById('custom-feedback').value.trim();
        if (!feedback) {
            return;
        }

        await regenerateStep(feedback);
        document.getElementById('custom-feedback').value = '';
        document.getElementById('custom-input-area').style.display = 'none';
    });

    document.getElementById('confirm-btn').addEventListener('click', async () => {
        await confirmCurrentStep();
    });

    document.getElementById('skip-btn').addEventListener('click', async () => {
        await skipCurrentStep();
    });

    document.getElementById('gen-finalize-btn').addEventListener('click', async () => {
        await finalizeGame();
    });
}

function renderStepNavigation() {
    const container = document.getElementById('step-navigation');
    container.innerHTML = '';

    state.allSteps.forEach((step) => {
        const status = getStepState(step.id);
        const meta = stepDescriptions[step.id] || { icon: '?', name: step.name || step.id };
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'step';

        if (step.id === state.currentStepId) {
            button.classList.add('active');
        }

        if (status.status === 'confirmed') {
            button.classList.add('completed');
        }

        if (status.status === 'loading') {
            button.classList.add('generating');
        }

        button.innerHTML = `<span class="step-icon">${meta.icon}</span><span class="step-label">${step.name || meta.name}</span>`;
        button.addEventListener('click', async () => {
            await openStep(step.id, false);
        });
        container.appendChild(button);
    });
}

async function openStep(stepId, forceReload) {
    state.currentStepId = stepId;
    renderStepNavigation();

    const localState = getStepState(stepId);
    if (!forceReload || localState.candidates.length > 0) {
        renderCurrentStep(stepId);
        return;
    }

    await loadStep(stepId);
}

function renderCurrentStep(stepId) {
    const meta = stepDescriptions[stepId] || { name: stepId, desc: '' };
    const localState = getStepState(stepId);

    document.getElementById('current-step-name').textContent = meta.name;
    document.getElementById('current-step-desc').textContent = meta.desc;
    document.getElementById('step-loading').style.display = localState.status === 'loading' ? 'flex' : 'none';
    document.getElementById('action-buttons').style.display = 'flex';

    renderCandidates(stepId);
    renderHistoryPanel();
    updateActionButtons(stepId);
}

async function loadStep(stepId) {
    const localState = getStepState(stepId);
    localState.status = 'loading';
    renderCurrentStep(stepId);
    setApiStatus('calling', `正在生成「${stepDescriptions[stepId]?.name || stepId}」...`);

    try {
        const data = await requestJson('/generate/step', createJsonRequest('POST', {
            sessionId: state.currentSessionId,
            stepId,
            options: { candidateCount: 2 }
        }));

        localState.candidates = data.candidates || [];
        localState.selectedIndex = -1;
        localState.status = 'generated';
        localState.history.push({
            id: Date.now(),
            timestamp: new Date(),
            candidates: localState.candidates.map((item) => structuredClone(item))
        });

        setApiStatus('success', `已生成 ${localState.candidates.length} 个候选方案。`);
    } catch (error) {
        console.error('Load step error:', error);
        localState.status = 'error';
        setApiStatus('error', error.message);
    }

    renderCurrentStep(stepId);
}

function renderCandidates(stepId) {
    const container = document.getElementById('candidates-container');
    const localState = getStepState(stepId);
    container.innerHTML = '';

    if (localState.status === 'loading') {
        return;
    }

    if (!localState.candidates.length) {
        container.innerHTML = '<div class="candidate-card"><div class="candidate-empty">当前步骤还没有生成内容。点击下方“生成”开始。</div></div>';
        return;
    }

    localState.candidates.forEach((candidate, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'candidate-card';
        if (localState.selectedIndex === index) {
            card.classList.add('selected');
        }

        card.innerHTML = `
            <div class="candidate-card-header">
                <strong>${escapeHtml(getCandidateTitle(stepId, candidate, index))}</strong>
                <span>方案 ${index + 1}</span>
            </div>
            <div class="candidate-card-content">${renderCandidateContent(stepId, candidate)}</div>
        `;
        card.addEventListener('click', () => {
            localState.selectedIndex = index;
            renderCandidates(stepId);
            updateActionButtons(stepId);
        });

        container.appendChild(card);
    });
}

function updateActionButtons(stepId) {
    const localState = getStepState(stepId);
    const hasCandidates = localState.candidates.length > 0;
    document.getElementById('confirm-btn').disabled = localState.selectedIndex < 0;
    document.getElementById('regenerate-btn').disabled = !hasCandidates;
    document.getElementById('modify-btn').disabled = !hasCandidates;
    document.getElementById('gen-finalize-btn').style.display =
        state.allSteps.every((step) => getStepState(step.id).status === 'confirmed') ? 'inline-block' : 'none';
}

function getCandidateTitle(stepId, candidate, index) {
    if (stepId === 'worldview') {
        return candidate.worldName || `世界观方案 ${index + 1}`;
    }

    if (stepId === 'mainPlot') {
        return candidate.title || `主线方案 ${index + 1}`;
    }

    if (stepId === 'integration') {
        return candidate.gameName || `整合方案 ${index + 1}`;
    }

    if (Array.isArray(candidate)) {
        return `${stepDescriptions[stepId]?.name || stepId} · ${candidate.length} 项`;
    }

    return candidate.name || candidate.title || `${stepDescriptions[stepId]?.name || stepId} 方案 ${index + 1}`;
}

function renderCandidateContent(stepId, candidate) {
    if (candidate?.error) {
        return renderParagraph('解析提示', candidate.error || 'AI 响应暂时无法解析，请尝试重生成。');
    }

    if (typeof candidate === 'string') {
        return renderParagraph('方案内容', candidate);
    }

    switch (stepId) {
        case 'worldview':
            return [
                renderField('世界名称', candidate.worldName),
                renderField('时代背景', candidate.era),
                renderParagraph('世界描述', candidate.description),
                renderTags('世界规则', candidate.rules),
                renderObjectList('主要势力', candidate.factions, ['name', 'description']),
                renderObjectList('重要地点', candidate.locations, ['name', 'description'])
            ].join('');
        case 'mainPlot':
            return [
                renderField('主线标题', candidate.title),
                renderField('核心主题', candidate.theme),
                renderParagraph('剧情概览', candidate.summary),
                renderParagraph('引发事件', candidate.incitingIncident),
                renderSimpleList(
                    '章节结构',
                    (candidate.chapters || []).map((chapter) => ({
                        title: chapter.name || chapter.title,
                        body: `${chapter.goal || ''}${chapter.description ? `：${chapter.description}` : ''}`
                    }))
                ),
                renderParagraph('高潮', candidate.climax),
                renderParagraph('结局说明', candidate.resolution)
            ].join('');
        case 'integration':
            return [
                renderField('游戏名称', candidate.gameName),
                renderParagraph('玩法设计', candidate.gameplayDesign),
                renderField('战斗类型', candidate.gameSystems?.combatSystem?.type),
                renderTags('战斗机制', candidate.gameSystems?.combatSystem?.mechanics),
                renderParagraph('开场场景', candidate.openingScene?.description),
                renderParagraph('开场旁白', candidate.openingScene?.narration),
                renderParagraph('平衡性说明', candidate.balancingNotes)
            ].join('');
        default:
            return renderListCandidate(candidate, stepId);
    }
}

function renderListCandidate(candidate, stepId) {
    const items = Array.isArray(candidate) ? candidate : (candidate ? [candidate] : []);
    if (!items.length) {
        return '<div class="candidate-empty">当前方案没有可展示的条目。</div>';
    }

    return items.map((item, index) => {
        const title = item.name || item.title || `${stepDescriptions[stepId]?.name || '条目'} ${index + 1}`;
        const body = item.description || item.summary || item.role || item.type || '';
        const extras = [
            item.role ? `<span class="candidate-chip">${escapeHtml(item.role)}</span>` : '',
            item.location ? `<span class="candidate-chip">${escapeHtml(item.location)}</span>` : '',
            item.type ? `<span class="candidate-chip">${escapeHtml(item.type)}</span>` : '',
            item.rarity ? `<span class="candidate-chip">${escapeHtml(item.rarity)}</span>` : ''
        ].join('');

        return `
            <div class="candidate-item">
                <div class="candidate-item-title">${escapeHtml(title)}</div>
                ${extras ? `<div class="candidate-chip-row">${extras}</div>` : ''}
                ${body ? `<div class="candidate-item-body">${escapeHtml(body)}</div>` : ''}
            </div>
        `;
    }).join('');
}

function renderField(label, value) {
    if (!value) {
        return '';
    }

    return `<div class="candidate-field"><span class="candidate-label">${escapeHtml(label)}</span><span class="candidate-value">${escapeHtml(value)}</span></div>`;
}

function renderParagraph(label, value) {
    if (!value) {
        return '';
    }

    return `
        <div class="candidate-block">
            <div class="candidate-label">${escapeHtml(label)}</div>
            <div class="candidate-paragraph">${escapeHtml(value).replaceAll('\n', '<br>')}</div>
        </div>
    `;
}

function renderTags(label, values) {
    if (!Array.isArray(values) || !values.length) {
        return '';
    }

    return `
        <div class="candidate-block">
            <div class="candidate-label">${escapeHtml(label)}</div>
            <div class="candidate-chip-row">${values.map((value) => `<span class="candidate-chip">${escapeHtml(value)}</span>`).join('')}</div>
        </div>
    `;
}

function renderObjectList(label, items, fields) {
    if (!Array.isArray(items) || !items.length) {
        return '';
    }

    return `
        <div class="candidate-block">
            <div class="candidate-label">${escapeHtml(label)}</div>
            ${items.map((item) => `
                <div class="candidate-item">
                    <div class="candidate-item-title">${escapeHtml(item[fields[0]] || '未命名')}</div>
                    ${item[fields[1]] ? `<div class="candidate-item-body">${escapeHtml(item[fields[1]])}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function renderSimpleList(label, items) {
    if (!Array.isArray(items) || !items.length) {
        return '';
    }

    return `
        <div class="candidate-block">
            <div class="candidate-label">${escapeHtml(label)}</div>
            ${items.map((item) => `
                <div class="candidate-item">
                    <div class="candidate-item-title">${escapeHtml(item.title || '未命名')}</div>
                    ${item.body ? `<div class="candidate-item-body">${escapeHtml(item.body)}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

async function regenerateStep(feedback) {
    if (!state.currentStepId) {
        return;
    }

    const localState = getStepState(state.currentStepId);
    localState.status = 'loading';
    renderCurrentStep(state.currentStepId);
    setApiStatus('calling', `正在重生成「${stepDescriptions[state.currentStepId]?.name || state.currentStepId}」...`);

    try {
        const data = await requestJson('/generate/regenerate', createJsonRequest('POST', {
            sessionId: state.currentSessionId,
            stepId: state.currentStepId,
            feedback
        }));

        localState.candidates = data.candidates || [];
        localState.selectedIndex = -1;
        localState.status = 'generated';
        localState.history.push({
            id: Date.now(),
            timestamp: new Date(),
            candidates: localState.candidates.map((item) => structuredClone(item))
        });

        setApiStatus('success', '已完成重生成。');
    } catch (error) {
        console.error('Regenerate error:', error);
        localState.status = 'error';
        setApiStatus('error', error.message);
    }

    renderCurrentStep(state.currentStepId);
}

async function confirmCurrentStep() {
    const localState = getStepState(state.currentStepId);
    const candidate = localState.candidates[localState.selectedIndex];

    if (!candidate) {
        return;
    }

    try {
        const data = await requestJson('/generate/confirm', createJsonRequest('POST', {
            sessionId: state.currentSessionId,
            stepId: state.currentStepId,
            candidate
        }));

        localState.status = 'confirmed';
        await renderConfirmedElements();
        renderStepNavigation();

        if (data.nextStep) {
            state.currentStepId = data.nextStep;
            renderStepNavigation();
            renderCurrentStep(data.nextStep);
            setApiStatus('success', '已确认当前步骤。下一步不会自动生成，请按需点击“生成”。');
        } else {
            setApiStatus('success', '所有步骤都已确认，可以整合生成游戏了。');
            updateActionButtons(state.currentStepId);
        }
    } catch (error) {
        console.error('Confirm step error:', error);
        alert(`确认失败：${error.message}`);
    }
}

async function skipCurrentStep() {
    try {
        const data = await requestJson('/generate/confirm', createJsonRequest('POST', {
            sessionId: state.currentSessionId,
            stepId: state.currentStepId,
            candidate: { skipped: true }
        }));

        getStepState(state.currentStepId).status = 'confirmed';
        await renderConfirmedElements();
        renderStepNavigation();

        if (data.nextStep) {
            state.currentStepId = data.nextStep;
            renderStepNavigation();
            renderCurrentStep(data.nextStep);
        } else {
            updateActionButtons(state.currentStepId);
        }
    } catch (error) {
        console.error('Skip step error:', error);
        alert(`跳过失败：${error.message}`);
    }
}

async function renderConfirmedElements() {
    const container = document.getElementById('confirmed-elements');

    try {
        const data = await requestJson(`/generate/${state.currentSessionId}/status`);
        const memory = data.memory || {};
        const rows = [];

        if (memory.worldview) {
            rows.push(renderConfirmedRow('世界观', memory.worldview.worldName || '已确认'));
        }

        if (memory.coreCharacters?.length) {
            rows.push(renderConfirmedRow('核心角色', `${memory.coreCharacters.length} 名`));
        }

        if (memory.secondaryCharacters?.length) {
            rows.push(renderConfirmedRow('次要角色', `${memory.secondaryCharacters.length} 名`));
        }

        if (memory.items?.length) {
            rows.push(renderConfirmedRow('物品道具', `${memory.items.length} 项`));
        }

        if (memory.puzzles?.length) {
            rows.push(renderConfirmedRow('谜题挑战', `${memory.puzzles.length} 项`));
        }

        if (memory.mainPlot) {
            rows.push(renderConfirmedRow('主线剧情', memory.mainPlot.title || '已确认'));
        }

        if (memory.sidePlots?.length) {
            rows.push(renderConfirmedRow('支线剧情', `${memory.sidePlots.length} 条`));
        }

        if (memory.fragments?.length) {
            rows.push(renderConfirmedRow('碎片内容', `${memory.fragments.length} 条`));
        }

        if (memory.integration?.gameName) {
            rows.push(renderConfirmedRow('整合方案', memory.integration.gameName));
        }

        container.innerHTML = rows.join('') || '<p class="empty-hint">尚未确认任何内容。</p>';
    } catch (error) {
        console.error('Render confirmed elements error:', error);
        container.innerHTML = '<p class="empty-hint">获取已确认内容失败。</p>';
    }
}

function renderConfirmedRow(label, value) {
    return `<div class="confirmed-item"><span class="confirmed-label">${label}</span><span class="confirmed-value">${value}</span></div>`;
}

function renderHistoryPanel() {
    const panel = document.getElementById('history-panel');
    if (!panel) {
        return;
    }

    const sections = [];
    for (const step of state.allSteps) {
        const localState = getStepState(step.id);
        if (!localState.history.length) {
            continue;
        }

        const entries = localState.history
            .slice()
            .reverse()
            .map((entry) => `<div class="history-entry">${step.name || step.id} · ${entry.timestamp.toLocaleTimeString()}</div>`)
            .join('');

        sections.push(`<div class="history-step">${entries}</div>`);
    }

    panel.innerHTML = sections.join('') || '<p class="empty-hint">暂无生成记录。</p>';
}

async function finalizeGameLegacy() {
    try {
        const data = await requestJson(
            `/generate/${state.currentSessionId}/finalize`,
            createJsonRequest('POST', { config: collectGenerationConfig() })
        );

        state.currentGameId = data.gameId;
        showScreen('loading-screen');
        updateProgress(100, '游戏已整合完成', '正在启动游戏...');
        setTimeout(() => startGame(data.gameId), 500);
    } catch (error) {
        console.error('Finalize game error:', error);
        alert(`整合失败：${error.message}`);
    }
}

function initGameScreen() {
    initializeLiveImageConfigPanel();

    document.getElementById('send-btn').addEventListener('click', sendPlayerAction);
    document.getElementById('player-input').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            sendPlayerAction();
        }
    });

    document.getElementById('generate-scene-image-btn')?.addEventListener('click', async () => {
        await generateSceneImages();
    });

    document.getElementById('scene-image-count')?.addEventListener('change', () => {
        const countInput = document.getElementById('scene-image-count');
        const settingsCountInput = document.getElementById('comfyui-image-count');
        const nextValue = String(Math.max(1, Math.min(8, Number(countInput.value) || 1)));
        countInput.value = nextValue;

        if (settingsCountInput) {
            settingsCountInput.value = nextValue;
        }

        saveGenerationSettings();
    });

    document.getElementById('live-comfyui-workflow-mode')?.addEventListener('change', () => {
        toggleLiveWorkflowMode();
        syncLiveImageConfigState();
    });

    document.getElementById('live-refresh-comfyui-btn')?.addEventListener('click', async () => {
        await refreshLiveComfyUIOptions(true);
    });

    document.getElementById('live-refresh-workflow-files-btn')?.addEventListener('click', async () => {
        await refreshLiveComfyWorkflowFiles(true);
    });

    document.getElementById('live-load-workflow-btn')?.addEventListener('click', async () => {
        await loadSelectedLiveWorkflowFile(true);
    });

    document.getElementById('live-test-comfyui-btn')?.addEventListener('click', async () => {
        await testLiveComfyUIConnection();
    });

    document.getElementById('live-validate-workflow-btn')?.addEventListener('click', async () => {
        await validateLiveComfyUIWorkflow();
    });

    document.getElementById('live-comfyui-workflow-file')?.addEventListener('change', () => {
        syncLiveImageConfigState();
    });

    document.querySelectorAll('#live-image-config input, #live-image-config select, #live-image-config textarea').forEach((element) => {
        element.addEventListener('change', () => {
            syncLiveImageConfigState();
        });
    });

    document.getElementById('game-menu-btn').addEventListener('click', () => {
        document.getElementById('game-menu-modal').classList.add('active');
    });

    document.getElementById('save-game').addEventListener('click', async () => {
        if (state.gameState && state.currentGameId) {
            try {
                const snapshot = await requestJson(`/games/${state.currentGameId}`);
                const record = buildSavedGameRecord(
                    state.currentGameId,
                    snapshot.state || state.gameState,
                    {
                        gameData: snapshot.game || state.currentGameData,
                        generationConfig: getEffectiveGenerationConfig(),
                        type: state.currentGameType || snapshot.game?.type || state.gameState?.type || 'custom'
                    }
                );

                state.currentGameData = snapshot.game || state.currentGameData;
                localStorage.setItem(`rpg_save_${state.currentGameId}`, JSON.stringify(record));
                alert('游戏进度已保存。');
            } catch (error) {
                console.error('Save game error:', error);
                const fallbackRecord = buildSavedGameRecord(state.currentGameId, state.gameState, {
                    generationConfig: getEffectiveGenerationConfig()
                });
                localStorage.setItem(`rpg_save_${state.currentGameId}`, JSON.stringify(fallbackRecord));
                alert('游戏进度已保存，但这次没有拿到完整后端快照。若服务重启后要续玩，建议重新保存一次。');
            }
        }
        document.getElementById('game-menu-modal').classList.remove('active');
    });

    document.getElementById('load-game').addEventListener('click', async () => {
        if (!state.currentGameId) {
            document.getElementById('game-menu-modal').classList.remove('active');
            return;
        }

        const record = readSavedGameRecord(`rpg_save_${state.currentGameId}`);
        if (record) {
            await loadSavedGame(state.currentGameId);
        } else {
            alert('没有找到存档。');
        }
        document.getElementById('game-menu-modal').classList.remove('active');
    });

    document.getElementById('restart-game').addEventListener('click', async () => {
        if (state.currentGameId) {
            await startGame(state.currentGameId);
        }
        document.getElementById('game-menu-modal').classList.remove('active');
    });

    syncSceneImageControls();
    syncLiveImageConfigPanel();
}

async function startGameLegacy(gameId) {
    try {
        const data = await requestJson(`/games/${gameId}/start`, createJsonRequest('POST', {}));
        state.currentGameId = gameId;
        state.gameState = data.gameState;
        state.sceneImages = [];
        state.selectedSceneImageIndex = 0;
        showScreen('game-screen');
        renderGameState(data.gameState);
        renderSceneImages([]);
        refreshLiveComfyUIOptions(false).catch(() => {});
        refreshLiveComfyWorkflowFiles(false)
            .then(() => {
                const savedWorkflow = state.currentGenerationConfig?.comfyuiWorkflowFile;
                if (savedWorkflow) {
                    return loadSelectedLiveWorkflowFile(false, savedWorkflow);
                }
                return null;
            })
            .catch(() => {});
    } catch (error) {
        console.error('Start game error:', error);
        alert(`启动游戏失败：${error.message}`);
    }
}

async function sendPlayerActionLegacy() {
    const input = document.getElementById('player-input');
    const action = input.value.trim();

    if (!action || !state.currentGameId) {
        return;
    }

    input.value = '';
    appendLog('player', action);

    try {
        const imageConfig = getEffectiveGenerationConfig().imageSource === 'comfyui'
            ? { ...getEffectiveGenerationConfig(), ...readLiveComfyUIConfig() }
            : getEffectiveGenerationConfig();
        const data = await requestJson(
            `/games/${state.currentGameId}/action`,
            createJsonRequest('POST', { action, imageConfig })
        );

        appendLog('narrator', data.response || '');
        renderChoices(data.choices || []);
        renderGameState(data.gameState);

        if (data.sceneImage) {
            const imageContainer = document.getElementById('scene-image');
            imageContainer.innerHTML = `<img src="${data.sceneImage}" alt="场景图" />`;
        }
    } catch (error) {
        console.error('Send player action error:', error);
        appendLog('system', `系统提示：${error.message}`);
    }
}

function renderChoices(choices) {
    const container = document.getElementById('choices-container');
    container.innerHTML = '';

    choices.forEach((choice) => {
        const button = document.createElement('button');
        button.className = 'choice-btn';
        button.textContent = choice.text;
        button.addEventListener('click', () => {
            document.getElementById('player-input').value = choice.action || choice.text;
            sendPlayerAction();
        });
        container.appendChild(button);
    });
}

function renderGameStateLegacy(gameState = state.gameState) {
    if (!gameState) {
        return;
    }

    state.gameState = gameState;
    document.getElementById('game-title').textContent = gameState.name || 'AI 生成 RPG';
    document.getElementById('scene-description').textContent = gameState.sceneDescription || '';
    const storyCopy = document.getElementById('scene-story-copy');
    if (storyCopy) {
        storyCopy.textContent = gameState.sceneDescription || '';
    }

    const log = document.getElementById('game-log');
    if (gameState.initialLog && !log.children.length) {
        appendLog('narrator', gameState.initialLog);
    }

    renderStats(gameState.player?.stats || {});
    renderInventory(gameState.inventory || []);
    renderQuests(gameState.quests || []);
}

function appendLog(type, content) {
    const log = document.getElementById('game-log');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = type === 'narrator'
        ? `<div class="speaker">旁白</div><div class="content">${escapeHtml(content)}</div>`
        : `<div class="content">${escapeHtml(content)}</div>`;

    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function renderStats(stats) {
    const container = document.getElementById('player-stats');
    container.innerHTML = '';

    for (const [key, value] of Object.entries(stats)) {
        const item = document.createElement('div');
        item.className = 'stat-item';

        if (value && typeof value === 'object' && value.current !== undefined) {
            const current = value.current ?? 0;
            const max = value.max || 1;
            const width = Math.max(0, Math.min(100, Math.round((current / max) * 100)));
            item.innerHTML = `
                <div>
                    <div class="stat-name">${escapeHtml(key)}</div>
                    <div class="stat-bar"><div class="stat-bar-fill" style="width:${width}%"></div></div>
                </div>
                <div class="stat-value">${current}/${max}</div>
            `;
        } else {
            item.innerHTML = `
                <span class="stat-name">${escapeHtml(key)}</span>
                <span class="stat-value">${escapeHtml(String(value))}</span>
            `;
        }

        container.appendChild(item);
    }
}

function renderInventory(items) {
    const list = document.getElementById('inventory-list');
    list.innerHTML = items.map((item) => `<li>${escapeHtml(item.name || String(item))}</li>`).join('');
}

function renderQuests(quests) {
    const list = document.getElementById('quest-list');
    list.innerHTML = quests
        .map((quest) => `<li class="${quest.completed ? 'completed' : ''}">${escapeHtml(quest.name || quest.description || '任务')}</li>`)
        .join('');
}

function getEffectiveGenerationConfig() {
    return normalizeGenerationConfig(state.currentGenerationConfig || collectGenerationConfig());
}

function syncSceneImageControls() {
    const controls = document.getElementById('scene-image-controls');
    const promptInput = document.getElementById('scene-image-prompt');
    const countInput = document.getElementById('scene-image-count');
    const button = document.getElementById('generate-scene-image-btn');
    const config = getEffectiveGenerationConfig();
    const imageEnabled = config.enableImages !== false && config.imageSource !== 'none';
    const suggestedPrompt = state.gameState?.sceneDescription || state.gameState?.initialLog || '';

    if (countInput) {
        countInput.value = String(Math.max(1, Math.min(8, Number(config.comfyuiImageCount) || 1)));
    }

    if (promptInput && (!promptInput.value.trim() || promptInput.value === state.lastSuggestedImagePrompt)) {
        promptInput.value = suggestedPrompt;
    }

    state.lastSuggestedImagePrompt = suggestedPrompt;
    syncLiveImageConfigPanel();

    if (controls) {
        controls.style.display = imageEnabled ? 'block' : 'none';
    }

    if (button) {
        button.disabled = !imageEnabled || !state.currentGameId;
    }

    if (!imageEnabled) {
        setSceneImageStatus('Image generation is disabled in settings.');
        setLiveComfyUiStatus('Image generation is disabled in settings.');
        return;
    }

    if (config.imageSource === 'comfyui') {
        setSceneImageStatus(
            config.imageGenerationMode === 'auto'
                ? 'Auto mode is enabled. You can still click the button to regenerate the current scene.'
                : 'Manual mode is enabled. Edit the prompt below and click the button to call ComfyUI.'
        );
        setLiveComfyUiStatus('ComfyUI live settings are available here. Changes take effect immediately for the next generation.');
        return;
    }

    setSceneImageStatus('Image generation is enabled.');
    setLiveComfyUiStatus('Image API mode uses the generate button directly. No ComfyUI parameters are needed.', 'success');
}

function setSceneImageStatus(message, status = '') {
    const statusEl = document.getElementById('scene-image-status');
    if (!statusEl) {
        return;
    }

    statusEl.textContent = message;
    statusEl.className = `helper-text ${status}`.trim();
}

function setSceneImageLoadingState(isLoading) {
    const promptInput = document.getElementById('scene-image-prompt');
    const countInput = document.getElementById('scene-image-count');
    const button = document.getElementById('generate-scene-image-btn');

    if (promptInput) {
        promptInput.disabled = isLoading;
    }

    if (countInput) {
        countInput.disabled = isLoading;
    }

    if (button) {
        button.disabled = isLoading || !state.currentGameId;
        button.textContent = isLoading ? 'Generating...' : 'Generate scene image';
    }
}

function syncLiveImageConfigState() {
    const baseConfig = getEffectiveGenerationConfig();
    state.currentGenerationConfig = {
        ...baseConfig,
        ...readLiveComfyUIConfig(),
        comfyuiImageCount: document.getElementById('scene-image-count')?.value || baseConfig.comfyuiImageCount || '1'
    };
    localStorage.setItem(GENERATION_SETTINGS_KEY, JSON.stringify(state.currentGenerationConfig));
}

function syncLiveImageConfigPanel() {
    const panel = document.getElementById('live-image-config');
    const imageSource = getEffectiveGenerationConfig().imageSource;
    const config = getEffectiveGenerationConfig();

    if (!panel) {
        return;
    }

    panel.style.display = imageSource === 'comfyui' ? 'block' : 'none';

    const fieldValues = {
        'live-comfyui-url': config.comfyuiUrl || 'http://127.0.0.1:8000',
        'live-comfyui-model': config.comfyuiModel || '',
        'live-comfyui-sampler': config.comfyuiSampler || 'euler',
        'live-comfyui-scheduler': config.comfyuiScheduler || 'normal',
        'live-comfyui-width': config.comfyuiWidth || '768',
        'live-comfyui-height': config.comfyuiHeight || '512',
        'live-comfyui-steps': config.comfyuiSteps || '20',
        'live-comfyui-cfg': config.comfyuiCfg || '7.5',
        'live-comfyui-seed': config.comfyuiSeed || '-1',
        'live-comfyui-timeout-ms': config.comfyuiTimeoutMs || '180000',
        'live-comfyui-prompt-prefix': config.comfyuiPromptPrefix || 'RPG game scene',
        'live-comfyui-prompt-suffix': config.comfyuiPromptSuffix || 'high quality, detailed, fantasy art style',
        'live-comfyui-negative-prompt': config.comfyuiNegativePrompt || 'low quality, blurry, deformed, ugly, bad anatomy, watermark, text',
        'live-comfyui-filename-prefix': config.comfyuiFilenamePrefix || 'rpg_scene',
        'live-comfyui-workflow-mode': config.comfyuiWorkflowMode || 'custom',
        'live-comfyui-workflow-file': config.comfyuiWorkflowFile || '',
        'live-comfyui-workflow-json': config.comfyuiWorkflowJson || ''
    };

    for (const [id, value] of Object.entries(fieldValues)) {
        const element = document.getElementById(id);
        if (element && value !== undefined && value !== null && (!element.value || document.activeElement !== element)) {
            element.value = String(value);
        }
    }

    toggleLiveWorkflowMode();
}

function renderSceneImages(images = [], prompt = '') {
    const imageContainer = document.getElementById('scene-image');
    const gallery = document.getElementById('scene-image-gallery');
    const promptInput = document.getElementById('scene-image-prompt');

    state.sceneImages = Array.isArray(images) ? images.filter(Boolean) : [];
    state.selectedSceneImageIndex = Math.max(
        0,
        Math.min(state.selectedSceneImageIndex, Math.max(0, state.sceneImages.length - 1))
    );

    if (prompt && promptInput && (!promptInput.value.trim() || promptInput.value === state.lastSuggestedImagePrompt)) {
        promptInput.value = prompt;
    }

    if (!imageContainer || !gallery) {
        return;
    }

    if (!state.sceneImages.length) {
        imageContainer.innerHTML = '<div class="placeholder">场景图像将在这里显示</div>';
        gallery.innerHTML = '';
        syncSceneImageControls();
        return;
    }

    const activeImage = state.sceneImages[state.selectedSceneImageIndex] || state.sceneImages[0];
    imageContainer.innerHTML = `<img src="${activeImage}" alt="Scene image" />`;

    gallery.innerHTML = state.sceneImages
        .map((src, index) => `
            <button type="button" class="scene-thumb ${index === state.selectedSceneImageIndex ? 'active' : ''}" data-scene-image-index="${index}">
                <img src="${src}" alt="Scene image ${index + 1}" />
            </button>
        `)
        .join('');

    gallery.querySelectorAll('[data-scene-image-index]').forEach((button) => {
        button.addEventListener('click', () => {
            state.selectedSceneImageIndex = Number(button.dataset.sceneImageIndex) || 0;
            renderSceneImages(state.sceneImages);
        });
    });

    syncSceneImageControls();
}

async function refreshComfyUIOptions(showStatus = true) {
    const imageSource = document.getElementById('image-source')?.value;
    if (imageSource !== 'comfyui') {
        return null;
    }

    const config = readComfyUIConfig();
    if (showStatus) {
        setComfyUiStatus('Refreshing ComfyUI options...', 'pending');
    }

    try {
        const params = new URLSearchParams({ comfyuiUrl: config.comfyuiUrl || 'http://127.0.0.1:8000' });
        const result = await requestJson(`/comfyui/options?${params.toString()}`);

        populateSelect('comfyui-model', result.checkpoints || [], config.comfyuiModel);
        populateSelect('comfyui-sampler', result.samplers || [], config.comfyuiSampler);
        populateSelect('comfyui-scheduler', result.schedulers || [], config.comfyuiScheduler);

        const summary = [
            Array.isArray(result.checkpoints) ? `${result.checkpoints.length} checkpoints` : null,
            Array.isArray(result.samplers) ? `${result.samplers.length} samplers` : null,
            Array.isArray(result.schedulers) ? `${result.schedulers.length} schedulers` : null
        ].filter(Boolean).join(', ');

        setComfyUiStatus(summary ? `ComfyUI ready: ${summary}.` : 'ComfyUI connection succeeded.', 'success');
        saveGenerationSettings();
        return result;
    } catch (error) {
        setComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function refreshComfyWorkflowFiles(showStatus = true) {
    const imageSource = document.getElementById('image-source')?.value;
    if (imageSource !== 'comfyui') {
        return null;
    }

    if (showStatus) {
        setComfyUiStatus('Refreshing workflow files...', 'pending');
    }

    try {
        const result = await requestJson('/comfyui/workflows');
        const select = document.getElementById('comfyui-workflow-file');
        const preferredValue = (
            state.currentGenerationConfig?.comfyuiWorkflowFile
            || select?.dataset.selectedWorkflow
            || select?.value
            || ''
        );

        if (select) {
            select.innerHTML = '';

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select a workflow file from G:\\comfy\\wenjian\\user\\default\\workflows';
            select.appendChild(placeholder);

            (result.workflows || []).forEach((workflow) => {
                const option = document.createElement('option');
                option.value = workflow.name;
                option.textContent = workflow.name;
                select.appendChild(option);
            });

            const selectedValue = (result.workflows || []).some((workflow) => workflow.name === preferredValue)
                ? preferredValue
                : '';

            select.value = selectedValue;
            select.dataset.selectedWorkflow = selectedValue;
        }

        if (showStatus) {
            setComfyUiStatus(`Loaded ${(result.workflows || []).length} workflow file(s).`, 'success');
        }

        saveGenerationSettings();
        return result;
    } catch (error) {
        setComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function loadSelectedComfyWorkflowFile(showStatus = true, fileName = '') {
    const workflowSelect = document.getElementById('comfyui-workflow-file');
    const workflowFile = fileName || workflowSelect?.value || '';

    if (!workflowFile) {
        if (showStatus) {
            setComfyUiStatus('Please select a workflow file first.', 'error');
        }
        return null;
    }

    if (showStatus) {
        setComfyUiStatus(`Loading workflow file: ${workflowFile}`, 'pending');
    }

    try {
        const result = await requestJson(`/comfyui/workflows/${encodeURIComponent(workflowFile)}`);
        const workflowJsonInput = document.getElementById('comfyui-workflow-json');
        const workflowModeInput = document.getElementById('comfyui-workflow-mode');

        if (workflowJsonInput) {
            workflowJsonInput.value = result.content || '';
        }

        if (workflowSelect) {
            workflowSelect.value = workflowFile;
            workflowSelect.dataset.selectedWorkflow = workflowFile;
        }

        if (workflowModeInput) {
            workflowModeInput.value = 'custom';
            toggleComfyWorkflowMode();
        }

        saveGenerationSettings();
        setComfyUiStatus(`Loaded workflow: ${workflowFile}`, 'success');
        return result;
    } catch (error) {
        setComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function refreshLiveComfyUIOptions(showStatus = true) {
    const config = readLiveComfyUIConfig();
    if (config.imageSource !== 'comfyui') {
        return null;
    }

    if (showStatus) {
        setLiveComfyUiStatus('Refreshing ComfyUI models...', 'pending');
    }

    try {
        const params = new URLSearchParams({ comfyuiUrl: config.comfyuiUrl || 'http://127.0.0.1:8000' });
        const result = await requestJson(`/comfyui/options?${params.toString()}`);

        populateSelect('live-comfyui-model', result.checkpoints || [], config.comfyuiModel);
        populateSelect('live-comfyui-sampler', result.samplers || [], config.comfyuiSampler);
        populateSelect('live-comfyui-scheduler', result.schedulers || [], config.comfyuiScheduler);

        if (showStatus) {
            setLiveComfyUiStatus(`Loaded ${(result.checkpoints || []).length} model(s).`, 'success');
        }

        syncLiveImageConfigState();
        return result;
    } catch (error) {
        setLiveComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function refreshLiveComfyWorkflowFiles(showStatus = true) {
    const config = readLiveComfyUIConfig();
    if (config.imageSource !== 'comfyui') {
        return null;
    }

    if (showStatus) {
        setLiveComfyUiStatus('Refreshing workflow files...', 'pending');
    }

    try {
        const result = await requestJson('/comfyui/workflows');
        const select = document.getElementById('live-comfyui-workflow-file');
        const preferredValue = select?.value || config.comfyuiWorkflowFile || '';

        if (select) {
            select.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select workflow';
            select.appendChild(placeholder);

            (result.workflows || []).forEach((workflow) => {
                const option = document.createElement('option');
                option.value = workflow.name;
                option.textContent = workflow.name;
                select.appendChild(option);
            });

            if ((result.workflows || []).some((workflow) => workflow.name === preferredValue)) {
                select.value = preferredValue;
            }
        }

        if (showStatus) {
            setLiveComfyUiStatus(`Loaded ${(result.workflows || []).length} workflow file(s).`, 'success');
        }

        syncLiveImageConfigState();
        return result;
    } catch (error) {
        setLiveComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function loadSelectedLiveWorkflowFile(showStatus = true, fileName = '') {
    const workflowSelect = document.getElementById('live-comfyui-workflow-file');
    const workflowFile = fileName || workflowSelect?.value || '';

    if (!workflowFile) {
        if (showStatus) {
            setLiveComfyUiStatus('Please select a workflow file first.', 'error');
        }
        return null;
    }

    if (showStatus) {
        setLiveComfyUiStatus(`Loading workflow: ${workflowFile}`, 'pending');
    }

    try {
        const result = await requestJson(`/comfyui/workflows/${encodeURIComponent(workflowFile)}`);
        const workflowJsonInput = document.getElementById('live-comfyui-workflow-json');
        const workflowModeInput = document.getElementById('live-comfyui-workflow-mode');

        if (workflowJsonInput) {
            workflowJsonInput.value = result.content || '';
        }

        if (workflowSelect) {
            workflowSelect.value = workflowFile;
        }

        if (workflowModeInput) {
            workflowModeInput.value = 'custom';
            toggleLiveWorkflowMode();
        }

        syncLiveImageConfigState();
        setLiveComfyUiStatus(`Loaded workflow: ${workflowFile}`, 'success');
        return result;
    } catch (error) {
        setLiveComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function testLiveComfyUIConnection() {
    setLiveComfyUiStatus('Testing ComfyUI connection...', 'pending');

    try {
        const result = await requestJson('/comfyui/test', createJsonRequest('POST', readLiveComfyUIConfig()));
        setLiveComfyUiStatus(`Connection successful. ${(result.checkpoints || []).length} model(s) detected.`, 'success');
        return result;
    } catch (error) {
        setLiveComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function validateLiveComfyUIWorkflow() {
    setLiveComfyUiStatus('Validating workflow...', 'pending');

    try {
        const result = await requestJson('/comfyui/validate-workflow', createJsonRequest('POST', readLiveComfyUIConfig()));
        const warnings = result.validation?.warnings || [];
        const message = result.ok
            ? `Workflow is valid${warnings.length ? `, warnings: ${warnings.join('; ')}` : ''}.`
            : `Workflow invalid: ${(result.validation?.errors || []).join('; ')}`;

        setLiveComfyUiStatus(message, result.ok ? 'success' : 'error');
        return result;
    } catch (error) {
        setLiveComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function testComfyUIConnection() {
    setComfyUiStatus('Testing ComfyUI connection...', 'pending');

    try {
        const result = await requestJson('/comfyui/test', createJsonRequest('POST', readComfyUIConfig()));
        const checkpointCount = Array.isArray(result.checkpoints) ? result.checkpoints.length : 0;
        setComfyUiStatus(`Connection successful. ${checkpointCount} checkpoints detected.`, 'success');
        return result;
    } catch (error) {
        setComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function validateComfyUIWorkflow() {
    setComfyUiStatus('Validating workflow...', 'pending');

    try {
        const result = await requestJson('/comfyui/validate-workflow', createJsonRequest('POST', readComfyUIConfig()));
        const warnings = result.validation?.warnings || [];
        const message = result.ok
            ? `Workflow is valid${warnings.length ? `, warnings: ${warnings.join('; ')}` : ''}.`
            : `Workflow invalid: ${(result.validation?.errors || []).join('; ')}`;

        setComfyUiStatus(message, result.ok ? 'success' : 'error');
        return result;
    } catch (error) {
        setComfyUiStatus(error.message, 'error');
        throw error;
    }
}

async function finalizeGame() {
    try {
        const config = normalizeGenerationConfig(collectGenerationConfig());
        state.currentGenerationConfig = config;
        saveGenerationSettings();

        const data = await requestJson(
            `/generate/${state.currentSessionId}/finalize`,
            createJsonRequest('POST', { config })
        );

        state.currentGameId = data.gameId;
        showScreen('loading-screen');
        updateProgress(100, '游戏已整合完成', '正在启动游戏...');
        setTimeout(() => startGame(data.gameId), 500);
    } catch (error) {
        console.error('Finalize game error:', error);
        alert(`整合失败：${error.message}`);
    }
}

async function startGame(gameId) {
    try {
        const data = await requestJson(`/games/${gameId}/start`, createJsonRequest('POST', {}));
        state.currentGameId = gameId;
        state.currentGameData = null;
        state.gameState = data.gameState;
        state.sceneImages = [];
        state.selectedSceneImageIndex = 0;
        showScreen('game-screen');
        renderGameState(data.gameState);
        renderSceneImages([]);

        requestJson(`/games/${gameId}`)
            .then((result) => {
                state.currentGameData = result.game || null;
            })
            .catch(() => {});
    } catch (error) {
        console.error('Start game error:', error);
        alert(`启动游戏失败：${error.message}`);
    }
}

async function sendPlayerAction() {
    const input = document.getElementById('player-input');
    const action = input.value.trim();

    if (!action || !state.currentGameId) {
        return;
    }

    input.value = '';
    appendLog('player', action);

    try {
        const data = await requestJson(
            `/games/${state.currentGameId}/action`,
            createJsonRequest('POST', { action })
        );

        appendLog('narrator', data.response || '');
        renderChoices(data.choices || []);
        renderGameState(data.gameState);

        if (data.sceneImage) {
            renderSceneImages([data.sceneImage], data.sceneDescription || data.response || '');
            setSceneImageStatus('Image generated automatically for the latest scene.', 'success');
        }
    } catch (error) {
        console.error('Send player action error:', error);
        appendLog('system', `系统提示：${error.message}`);
    }
}

async function generateSceneImages() {
    if (!state.currentGameId) {
        setSceneImageStatus('Start the game before generating images.', 'error');
        return;
    }

    const promptInput = document.getElementById('scene-image-prompt');
    const countInput = document.getElementById('scene-image-count');
    const settingsCountInput = document.getElementById('comfyui-image-count');
    const prompt = promptInput?.value.trim() || state.gameState?.sceneDescription || state.gameState?.initialLog || '';
    const count = Math.max(1, Math.min(8, Number(countInput?.value) || 1));

    if (!prompt) {
        setSceneImageStatus('No scene prompt available yet.', 'error');
        return;
    }

    if (countInput) {
        countInput.value = String(count);
    }

    if (settingsCountInput) {
        settingsCountInput.value = String(count);
    }

    const liveConfig = getEffectiveGenerationConfig().imageSource === 'comfyui'
        ? { ...getEffectiveGenerationConfig(), ...readLiveComfyUIConfig(), comfyuiImageCount: count }
        : { ...getEffectiveGenerationConfig(), comfyuiImageCount: count };
    state.currentGenerationConfig = liveConfig;
    localStorage.setItem(GENERATION_SETTINGS_KEY, JSON.stringify(liveConfig));
    setSceneImageLoadingState(true);
    setSceneImageStatus('Generating images with ComfyUI...', 'pending');

    try {
        const data = await requestJson(
            `/games/${state.currentGameId}/generate-image`,
            createJsonRequest('POST', { prompt, count, comfyuiImageCount: count, ...liveConfig })
        );

        state.selectedSceneImageIndex = 0;
        renderSceneImages(data.images || [], data.prompt || prompt);
        setSceneImageStatus(`Generated ${data.count || (data.images || []).length} image(s).`, 'success');
    } catch (error) {
        console.error('Generate scene image error:', error);
        setSceneImageStatus(error.message, 'error');
    } finally {
        setSceneImageLoadingState(false);
    }
}

function renderGameState(gameState = state.gameState) {
    if (!gameState) {
        return;
    }

    state.gameState = gameState;
    document.getElementById('game-title').textContent = gameState.name || 'AI 生成 RPG';
    document.getElementById('scene-description').textContent = gameState.sceneDescription || '';

    const log = document.getElementById('game-log');
    if (gameState.initialLog && !log.children.length) {
        appendLog('narrator', gameState.initialLog);
    }

    renderStats(gameState.player?.stats || {});
    renderInventory(gameState.inventory || []);
    renderQuests(gameState.quests || []);
    syncSceneImageControls();
}

async function testConnection(source) {
    const resultEl = document.getElementById(`test-${source}-result`);
    const button = document.getElementById(`test-${source}-btn`);

    button.disabled = true;
    resultEl.textContent = '测试中...';
    resultEl.className = 'test-result';

    try {
        const result = await requestJson('/test-connection', createJsonRequest('POST', collectLlmSettings(source)));
        resultEl.textContent = result.success ? '连接成功' : (result.error || '连接失败');
        resultEl.className = `test-result ${result.success ? 'success' : 'error'}`;
    } catch (error) {
        resultEl.textContent = error.message;
        resultEl.className = 'test-result error';
    } finally {
        button.disabled = false;
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}
