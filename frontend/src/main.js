import './styles/main.css';
import { createJsonRequest, requestJson, requestJsonWithProgress } from './services/api.js';
import {
    applyGenerationConfig,
    applyLlmSettings,
    collectGenerationConfig,
    collectLlmSettings
} from './services/settings.js';

const API_BASE = '/api';

const state = {
    currentGameType: null,
    currentProjectId: null,
    currentProjectData: null,
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
    lastSuggestedImagePrompt: '',
    activeSceneImage: '',
    transitioningSceneImage: '',
    currentVisualSignature: '',
    sceneImageTransitionToken: 0,
    runtimeSnapshotTimer: null,
    runtimeSnapshotSaving: false
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

const adaptationModeNames = {
    faithful: '忠于原著',
    balanced: '平衡改编',
    free: '高自由互动'
};

const pacingNames = {
    slow: '慢节奏',
    balanced: '平衡',
    fast: '快节奏'
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
    initImportForm();
    initImportPreviewEditor();
    initWorkbench();
    initGameScreen();
    initHeroSection();
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
            <input type="text" id="comfyui-url" data-generation-setting="true" placeholder="ComfyUI 地址（默认：http://127.0.0.1:8000）" value="http://127.0.0.1:8000" />
            <button type="button" id="refresh-comfyui-btn" class="test-btn">刷新模型</button>
            <button type="button" id="test-comfyui-btn" class="test-btn">测试连接</button>
        </div>
        <div class="sub-config-grid">
            <div>
                <label for="image-generation-mode">生图模式</label>
                <select id="image-generation-mode" data-generation-setting="true">
                    <option value="manual">手动点击生成</option>
                    <option value="auto">每次行动后自动生成</option>
                </select>
            </div>
            <div>
                <label for="comfyui-image-count">出图数量</label>
                <input type="number" id="comfyui-image-count" data-generation-setting="true" value="1" min="1" max="8" />
            </div>
            <div>
                <label for="comfyui-workflow-mode">工作流模式</label>
                <select id="comfyui-workflow-mode" data-generation-setting="true">
                    <option value="custom">自定义 JSON</option>
                    <option value="default">默认模板</option>
                </select>
            </div>
        </div>
        <div class="helper-text">
            建议优先使用 <strong>自定义 JSON</strong>。系统只会把提示词和出图数量注入到你现有的 ComfyUI 工作流里。
        </div>
        <div id="comfyui-default-workflow-fields" style="display:none">
            <div class="sub-config-grid">
                <div>
                    <label for="comfyui-model">模型检查点</label>
                    <select id="comfyui-model" data-generation-setting="true">
                        <option value="">刷新后加载模型</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-sampler">采样器</label>
                    <select id="comfyui-sampler" data-generation-setting="true">
                        <option value="euler">euler</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-scheduler">调度器</label>
                    <select id="comfyui-scheduler" data-generation-setting="true">
                        <option value="normal">标准</option>
                    </select>
                </div>
                <div>
                    <label for="comfyui-width">宽度</label>
                    <input type="number" id="comfyui-width" data-generation-setting="true" value="768" min="256" max="2048" step="64" />
                </div>
                <div>
                    <label for="comfyui-height">高度</label>
                    <input type="number" id="comfyui-height" data-generation-setting="true" value="512" min="256" max="2048" step="64" />
                </div>
                <div>
                    <label for="comfyui-steps">采样步数</label>
                    <input type="number" id="comfyui-steps" data-generation-setting="true" value="20" min="1" max="150" />
                </div>
                <div>
                    <label for="comfyui-cfg">CFG</label>
                    <input type="number" id="comfyui-cfg" data-generation-setting="true" value="7.5" min="0.1" max="30" step="0.1" />
                </div>
                <div>
                    <label for="comfyui-seed">随机种子</label>
                    <input type="number" id="comfyui-seed" data-generation-setting="true" value="-1" />
                </div>
            </div>
        </div>
        <div class="sub-config-grid">
            <div>
                <label for="comfyui-timeout-ms">超时时间（毫秒）</label>
                <input type="number" id="comfyui-timeout-ms" data-generation-setting="true" value="180000" min="5000" step="1000" />
            </div>
            <div>
                <label for="comfyui-filename-prefix">文件名前缀</label>
                <input type="text" id="comfyui-filename-prefix" data-generation-setting="true" placeholder="输出文件名前缀" value="rpg_scene" />
            </div>
        </div>
        <div id="comfyui-custom-workflow">
            <div class="sub-config-row">
                <select id="comfyui-workflow-file" data-generation-setting="true">
                    <option value="">从工作流目录中选择文件</option>
                </select>
                <button type="button" id="refresh-workflow-files-btn" class="test-btn">刷新工作流</button>
                <button type="button" id="load-workflow-file-btn" class="test-btn">载入所选文件</button>
            </div>
            <textarea id="comfyui-workflow-json" data-generation-setting="true" rows="10" placeholder="在这里粘贴 ComfyUI 工作流 JSON。如果你的工作流已经带有 CLIPTextEncode 文本节点，后端会自动注入当前提示词。你也可以使用 {{prompt}}、{{raw_prompt}}、{{negative_prompt}}、{{batch_size}}、{{ckpt_name}} 等占位符。"></textarea>
            <div class="sub-config-actions">
                <button type="button" id="validate-workflow-btn" class="test-btn">校验工作流</button>
            </div>
        </div>
        <details id="comfyui-prompt-overrides">
            <summary>提示词辅助项</summary>
            <div class="sub-config-grid">
                <div>
                    <label for="comfyui-prompt-prefix">正向前缀</label>
                    <input type="text" id="comfyui-prompt-prefix" data-generation-setting="true" placeholder="例如：国风互动叙事场景" value="中文互动叙事场景" />
                </div>
                <div>
                    <label for="comfyui-prompt-suffix">正向后缀</label>
                    <input type="text" id="comfyui-prompt-suffix" data-generation-setting="true" placeholder="例如：高质量、细节丰富、电影感插画" value="高质量，细节丰富，电影感插画" />
                </div>
                <div>
                    <label for="comfyui-negative-prompt">反向提示词</label>
                    <input type="text" id="comfyui-negative-prompt" data-generation-setting="true" placeholder="不希望出现的内容" value="低质量，模糊，畸形，崩坏人体，水印，文字" />
                </div>
            </div>
        </details>
        <div id="comfyui-status" class="helper-text">尚未检查 ComfyUI 配置。</div>
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
                    <option value="">选择模型</option>
                </select>
                <select id="live-comfyui-workflow-file">
                    <option value="">选择工作流文件</option>
                </select>
                <button type="button" id="live-load-workflow-btn" class="test-btn">载入工作流</button>
            </div>
            <div class="sub-config-row">
                <button type="button" id="live-refresh-comfyui-btn" class="test-btn">刷新模型</button>
                <button type="button" id="live-refresh-workflow-files-btn" class="test-btn">刷新工作流</button>
                <button type="button" id="live-test-comfyui-btn" class="test-btn">测试 ComfyUI</button>
            </div>
            <details id="live-comfyui-settings">
                <summary>ComfyUI 实时配置</summary>
                <div class="sub-config-grid" style="margin-top:0.75rem">
                    <div>
                        <label for="live-comfyui-url">ComfyUI 地址</label>
                        <input type="text" id="live-comfyui-url" value="http://127.0.0.1:8000" />
                    </div>
                    <div>
                        <label for="live-comfyui-workflow-mode">工作流模式</label>
                        <select id="live-comfyui-workflow-mode">
                            <option value="custom">自定义工作流</option>
                            <option value="default">默认模板</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-sampler">采样器</label>
                        <select id="live-comfyui-sampler">
                            <option value="euler">euler</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-scheduler">调度器</label>
                        <select id="live-comfyui-scheduler">
                            <option value="normal">标准</option>
                        </select>
                    </div>
                    <div>
                        <label for="live-comfyui-width">宽度</label>
                        <input type="number" id="live-comfyui-width" value="768" min="256" max="2048" step="64" />
                    </div>
                    <div>
                        <label for="live-comfyui-height">高度</label>
                        <input type="number" id="live-comfyui-height" value="512" min="256" max="2048" step="64" />
                    </div>
                    <div>
                        <label for="live-comfyui-steps">采样步数</label>
                        <input type="number" id="live-comfyui-steps" value="20" min="1" max="150" />
                    </div>
                    <div>
                        <label for="live-comfyui-cfg">CFG</label>
                        <input type="number" id="live-comfyui-cfg" value="7.5" min="0.1" max="30" step="0.1" />
                    </div>
                    <div>
                        <label for="live-comfyui-seed">随机种子</label>
                        <input type="number" id="live-comfyui-seed" value="-1" />
                    </div>
                    <div>
                        <label for="live-comfyui-timeout-ms">超时时间（毫秒）</label>
                        <input type="number" id="live-comfyui-timeout-ms" value="180000" min="5000" step="1000" />
                    </div>
                </div>
                <div class="sub-config-grid">
                    <div>
                        <label for="live-comfyui-prompt-prefix">正向前缀</label>
                        <input type="text" id="live-comfyui-prompt-prefix" value="中文互动叙事场景" />
                    </div>
                    <div>
                        <label for="live-comfyui-prompt-suffix">正向后缀</label>
                        <input type="text" id="live-comfyui-prompt-suffix" value="高质量，细节丰富，电影感插画" />
                    </div>
                    <div>
                        <label for="live-comfyui-negative-prompt">反向提示词</label>
                        <input type="text" id="live-comfyui-negative-prompt" value="低质量，模糊，畸形，崩坏人体，水印，文字" />
                    </div>
                    <div>
                        <label for="live-comfyui-filename-prefix">文件名前缀</label>
                        <input type="text" id="live-comfyui-filename-prefix" value="rpg_scene" />
                    </div>
                </div>
                <div id="live-comfyui-custom-workflow" style="margin-top:0.75rem">
                    <textarea id="live-comfyui-workflow-json" rows="8" placeholder="这里会载入自定义工作流 JSON。"></textarea>
                    <div class="sub-config-actions">
                        <button type="button" id="live-validate-workflow-btn" class="test-btn">校验工作流</button>
                    </div>
                </div>
            </details>
            <div id="live-comfyui-status" class="helper-text">当前在接口出图模式下会直接调用生成按钮。切换到 ComfyUI 后，可以在这里细调模型和工作流。</div>
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
            state.currentProjectId = null;
            state.currentProjectData = null;
            document.querySelectorAll('.type-card').forEach((item) => item.classList.remove('selected'));
            card.classList.add('selected');

            document.getElementById('config-title').textContent = `配置你的${gameTypeNames[state.currentGameType] || 'RPG'}游戏`;
            showScreen('config-screen');
        });
    });

    document.getElementById('back-to-home').addEventListener('click', () => {
        showHomeScreen();
    });

    document.getElementById('back-from-import')?.addEventListener('click', () => {
        showHomeScreen();
    });

    document.getElementById('back-to-import-edit')?.addEventListener('click', () => showScreen('import-screen'));
    document.getElementById('confirm-import-preview')?.addEventListener('click', async () => {
        await startImportedProjectSession();
    });
    document.getElementById('gen-back-to-config').addEventListener('click', () => {
        showScreen(state.currentProjectId ? 'import-screen' : 'config-screen');
    });

    document.getElementById('exit-game').addEventListener('click', () => {
        if (confirm('确定退出当前游戏吗？未保存进度将会丢失。')) {
            state.currentGameId = null;
            state.gameState = null;
            showHomeScreen();
        }
    });
}

function showHomeScreen() {
    showScreen('home-screen');
    document.getElementById('game-types-section').style.display = 'block';
    document.getElementById('examples-section').style.display = 'none';
}

function initHeroSection() {
    // 快速开始按钮
    document.getElementById('quick-start-btn')?.addEventListener('click', () => {
        document.getElementById('game-types-section').style.display = 'block';
        document.getElementById('examples-section').style.display = 'none';
        document.getElementById('game-types-section').scrollIntoView({ behavior: 'smooth' });
    });

    // 浏览示例按钮
    document.getElementById('browse-examples-btn')?.addEventListener('click', async () => {
        await loadAndRenderExamples();
        document.getElementById('game-types-section').style.display = 'none';
        document.getElementById('examples-section').style.display = 'block';
        document.getElementById('examples-section').scrollIntoView({ behavior: 'smooth' });
    });

    // 导入小说按钮
    document.getElementById('import-novel-btn')?.addEventListener('click', () => {
        setImportStatus('导入后会自动创建项目，并预填到现有生成流程中。');
        showScreen('import-screen');
    });

    // 关闭示例按钮
    document.getElementById('close-examples')?.addEventListener('click', () => {
        document.getElementById('game-types-section').style.display = 'block';
        document.getElementById('examples-section').style.display = 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

async function loadAndRenderExamples() {
    const grid = document.getElementById('examples-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading">加载示例游戏中...</div>';

    try {
        const examples = await requestJson(`${API_BASE}/examples`);

        const typeIcons = {
            fantasy: '🧙',
            scifi: '🚀',
            mystery: '🔍',
            adventure: '⚔️',
            romance: '💕'
        };

        renderExamples(examples.map(ex => ({
            ...ex,
            icon: typeIcons[ex.type] || '🎮',
            title: ex.name
        })));
    } catch (error) {
        console.error('加载示例游戏失败:', error);
        grid.innerHTML = '<div class="error">加载失败，请稍后重试</div>';
    }
}

function renderExamples(examples) {
    const grid = document.getElementById('examples-grid');
    if (!grid) return;

    grid.innerHTML = examples.map(example => `
        <div class="example-card" data-example-id="${example.id}" data-type="${example.type}">
            <div class="example-cover">
                <span style="position: relative; z-index: 1;">${example.icon}</span>
            </div>
            <div class="example-content">
                <h3 class="example-title">${example.title}</h3>
                <span class="example-type">${gameTypeNames[example.type]}</span>
                <p class="example-description">${example.description}</p>
                <div class="example-actions">
                    <button class="btn-primary btn-play-example" data-example-id="${example.id}">
                        ▶️ 立即试玩
                    </button>
                </div>
            </div>
        </div>
    `).join('');

    // 为试玩按钮添加点击事件
    grid.querySelectorAll('.btn-play-example').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const exampleId = btn.dataset.exampleId;
            await startExampleGame(exampleId);
        });
    });
}

async function startExampleGame(exampleId) {
    try {
        const settings = collectLlmSettings();

        // 显示加载状态
        showScreen('loading-screen');
        updateProgress(10, '正在启动示例游戏...', '');

        const response = await requestJson(`${API_BASE}/examples/${exampleId}/start`, {
            method: 'POST',
            body: JSON.stringify({ settings })
        });

        updateProgress(100, '启动完成！', '');

        state.currentGameId = response.gameId;
        state.gameState = response.gameState;

        // 渲染游戏界面
        renderGameState(response.gameState);
        showScreen('game-screen');

        console.log('示例游戏已启动:', response.message);
    } catch (error) {
        console.error('启动示例游戏失败:', error);
        alert('启动失败: ' + error.message);
        showScreen('home-screen');
    }
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
            title: parsed?.name || '旧版存档',
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
        alert('这个存档已载入画面，但后端运行态未成功恢复。请重新开始后再保存一次，之后即可正常续玩。');
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

function initImportForm() {
    document.getElementById('import-project-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await initImportedProjectGenerationSession();
    });
    document.getElementById('import-package-btn')?.addEventListener('click', async () => {
        await importProjectPackageFromFile();
    });

    document.getElementById('refresh-import-projects')?.addEventListener('click', async () => {
        await loadImportedProjects();
    });

    loadImportedProjects().catch((error) => {
        console.error('Load imported projects error:', error);
    });
}

function getAdaptationModeLabel(mode) {
    return adaptationModeNames[mode] || mode || '未设置';
}

function getPacingLabel(mode) {
    return pacingNames[mode] || mode || '未设置';
}

async function importProjectPackageFromFile() {
    const input = document.getElementById('import-package-file');
    const file = input?.files?.[0];
    if (!file) {
        setImportStatus('请先选择一个项目包 JSON 文件。', 'error');
        return;
    }

    setImportStatus('正在解析并导入项目包...', 'pending');

    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const result = await requestJson(
            '/projects/import-package',
            createJsonRequest('POST', { package: parsed })
        );

        state.currentProjectId = result.project?.id || null;
        state.currentProjectData = result.project || null;
        state.currentGameType = result.project?.gameType || state.currentGameType || 'custom';

        if (state.currentProjectData) {
            document.getElementById('import-title').value = state.currentProjectData.title || '';
        }

        renderImportedProjectPreview(state.currentProjectData);
        await loadImportedProjects();
        showScreen('import-preview-screen');
        setImportStatus('项目包导入成功。', 'success');
        setImportPreviewStatus('项目包已恢复，可以继续调整后进入工作台。', 'success');
    } catch (error) {
        setImportStatus(`导入失败：${error.message}`, 'error');
    }
}

function setImportStatus(message, tone = '') {
    const status = document.getElementById('import-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.className = `helper-text ${tone}`.trim();
}

async function beginGenerationWorkbench(data) {
    state.currentSessionId = data.sessionId;
    state.allSteps = data.steps || [];
    state.currentStepId = data.firstStep || state.allSteps[0]?.id || null;
    state.stepStates = {};

    showScreen('generation-workbench');
    renderStepNavigation();
    await renderConfirmedElements();
    renderCurrentStep(state.currentStepId);
    renderHistoryPanel();
    setApiStatus('idle', '已创建生成会话，点击“生成”开始当前步骤。');
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
        state.currentProjectId = null;
        state.currentProjectData = null;
        await beginGenerationWorkbench(data);
        return;
    } catch (error) {
        console.error('Session init error:', error);
        alert(`初始化失败：${error.message}`);
        showScreen('config-screen');
    }
}

function initImportPreviewEditor() {
    document.getElementById('save-import-preview')?.addEventListener('click', async () => {
        await saveImportedProjectEdits();
    });
    document.getElementById('optimize-project-btn')?.addEventListener('click', async () => {
        await optimizeProject();
    });
    document.getElementById('resume-project-play')?.addEventListener('click', async () => {
        await resumeProjectPlay();
    });
    document.getElementById('generate-base-assets')?.addEventListener('click', async () => {
        await generateBaseAssetsForProject();
    });
    document.getElementById('rebuild-adaptation-btn')?.addEventListener('click', async () => {
        await rebuildProjectAdaptation();
    });
    document.getElementById('rebuild-visual-bible-btn')?.addEventListener('click', async () => {
        await rebuildProjectVisualBible();
    });
    document.getElementById('apply-project-refinement-btn')?.addEventListener('click', async () => {
        await applyProjectRefinement();
    });
    document.getElementById('export-project-package-btn')?.addEventListener('click', async () => {
        await exportProjectPackage();
    });

    document.getElementById('import-preview-screen')?.addEventListener('click', (event) => {
        const actionButton = event.target.closest('[data-preview-action]');
        if (!actionButton) {
            return;
        }

        handleImportPreviewAction(actionButton.dataset.previewAction, actionButton);
    });
}

function setImportPreviewStatus(message, tone = '') {
    const status = document.getElementById('import-preview-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.className = `helper-text ${tone}`.trim();
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

function createEmptyPreviewCharacter(index = 0) {
    return {
        id: `draft_char_${Date.now()}_${index}`,
        name: '',
        role: '',
        description: ''
    };
}

function createEmptyPreviewChapter(index = 0) {
    return {
        id: `draft_chapter_${Date.now()}_${index}`,
        title: `新章节 ${index + 1}`,
        summary: ''
    };
}

function createEmptyPreviewLocation(index = 0) {
    return {
        id: `draft_location_${Date.now()}_${index}`,
        name: '',
        description: ''
    };
}

function buildImportPreviewDraftFromForm() {
    const base = cloneJson(state.currentProjectData);
    const edits = collectImportedProjectEdits();

    base.storyBible = base.storyBible || {};
    base.source = base.source || {};
    base.title = edits.title || base.title || '';
    base.storyBible.summary = edits.summary || base.storyBible.summary || '';
    base.storyBible.characters = edits.characters;
    base.storyBible.chapters = edits.chapters;
    base.storyBible.locations = edits.locations;
    base.source.title = base.title || base.source.title || '';

    return base;
}

function handleImportPreviewAction(action, actionButton) {
    if (!action || !state.currentProjectData) {
        return;
    }

    const draft = buildImportPreviewDraftFromForm();
    draft.storyBible = draft.storyBible || {};

    if (action === 'add-character') {
        const characters = Array.isArray(draft.storyBible.characters) ? draft.storyBible.characters : [];
        characters.push(createEmptyPreviewCharacter(characters.length));
        draft.storyBible.characters = characters;
    }

    if (action === 'remove-character') {
        const item = actionButton.closest('[data-preview-item="character"]');
        const index = Number(item?.dataset.index ?? -1);
        draft.storyBible.characters = (draft.storyBible.characters || []).filter((_entry, currentIndex) => currentIndex !== index);
    }

    if (action === 'add-chapter') {
        const chapters = Array.isArray(draft.storyBible.chapters) ? draft.storyBible.chapters : [];
        chapters.push(createEmptyPreviewChapter(chapters.length));
        draft.storyBible.chapters = chapters;
    }

    if (action === 'remove-chapter') {
        const item = actionButton.closest('[data-preview-item="chapter"]');
        const index = Number(item?.dataset.index ?? -1);
        draft.storyBible.chapters = (draft.storyBible.chapters || []).filter((_entry, currentIndex) => currentIndex !== index);
    }

    if (action === 'add-location') {
        const locations = Array.isArray(draft.storyBible.locations) ? draft.storyBible.locations : [];
        locations.push(createEmptyPreviewLocation(locations.length));
        draft.storyBible.locations = locations;
    }

    if (action === 'remove-location') {
        const item = actionButton.closest('[data-preview-item="location"]');
        const index = Number(item?.dataset.index ?? -1);
        draft.storyBible.locations = (draft.storyBible.locations || []).filter((_entry, currentIndex) => currentIndex !== index);
    }

    state.currentProjectData = draft;
    renderImportedProjectPreview(draft);
    setImportPreviewStatus('本地预览已更新，记得保存后再进入工作台。', 'pending');
}

function collectImportPreviewCollection(type, mapper) {
    return Array.from(document.querySelectorAll(`[data-preview-collection="${type}"] [data-preview-item="${type}"]`))
        .map((element, index) => mapper(element, index));
}

function collectImportedProjectEdits() {
    return {
        title: document.getElementById('import-preview-title')?.value.trim() || state.currentProjectData?.title || '',
        summary: document.getElementById('import-preview-summary-input')?.value.trim() || state.currentProjectData?.storyBible?.summary || '',
        adaptationMode: document.getElementById('import-preview-adaptation-mode')?.value || state.currentProjectData?.adaptationMode || 'balanced',
        gameType: document.getElementById('import-preview-game-type')?.value || state.currentProjectData?.gameType || state.currentGameType || 'custom',
        characters: collectImportPreviewCollection('character', (element, index) => ({
            id: element.dataset.itemId || `import_char_${index + 1}`,
            name: element.querySelector('[data-field="name"]')?.value.trim() || '',
            role: element.querySelector('[data-field="role"]')?.value.trim() || '',
            description: element.querySelector('[data-field="description"]')?.value.trim() || ''
        })).filter((character) => character.name || character.role || character.description),
        chapters: collectImportPreviewCollection('chapter', (element, index) => ({
            id: element.dataset.itemId || `chapter_${index + 1}`,
            title: element.querySelector('[data-field="title"]')?.value.trim() || `章节 ${index + 1}`,
            summary: element.querySelector('[data-field="summary"]')?.value.trim() || ''
        })).filter((chapter) => chapter.title || chapter.summary),
        locations: collectImportPreviewCollection('location', (element, index) => ({
            id: element.dataset.itemId || `import_loc_${index + 1}`,
            name: element.querySelector('[data-field="name"]')?.value.trim() || '',
            description: element.querySelector('[data-field="description"]')?.value.trim() || ''
        })).filter((location) => location.name || location.description)
    };
}

function renderImportedProjectPreview(project = state.currentProjectData) {
    if (!project) {
        return;
    }

    const summaryEl = document.getElementById('import-preview-summary');
    const charactersEl = document.getElementById('import-preview-characters');
    const chaptersEl = document.getElementById('import-preview-chapters');
    const visualsEl = document.getElementById('import-preview-visuals');
    const summary = project.storyBible?.summary || project.source?.excerpt || '';
    const themes = Array.isArray(project.storyBible?.themes) && project.storyBible.themes.length
        ? project.storyBible.themes.join('、')
        : '待补充';
    const characters = Array.isArray(project.storyBible?.characters) ? project.storyBible.characters : [];
    const chapters = Array.isArray(project.storyBible?.chapters) ? project.storyBible.chapters : [];
    const locations = Array.isArray(project.storyBible?.locations) ? project.storyBible.locations : [];
    const locationNames = locations.slice(0, 5).map((item) => item.name).filter(Boolean).join('、');
    const characterHints = characters.slice(0, 4).map((item) => item.name).filter(Boolean).join('、');
    const locationHints = locations.slice(0, 4).map((item) => item.name).filter(Boolean).join('、');
    const atmosphere = project.visualBible?.styleProfile?.atmosphere || '待确认';
    const playable = project.buildArtifacts?.latestPlayable || null;
    const hasRuntimeSnapshot = Boolean(project.runtimeSnapshot?.history?.length || project.runtimeSnapshot?.plotBeatId != null);
    const playableStatus = playable?.updatedAt
        ? `最近可玩版本：${new Date(playable.updatedAt).toLocaleString()}`
        : '当前还没有可试玩版本';
    const optimizationReport = project.optimizationReport || null;

    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="preview-summary-block">
                <div class="preview-field">
                    <label for="import-preview-title">项目标题</label>
                    <input id="import-preview-title" type="text" value="${escapeAttribute(project.title || '')}" placeholder="输入项目标题" />
                </div>
                <div class="preview-field">
                    <label for="import-preview-summary-input">剧情摘要</label>
                    <textarea id="import-preview-summary-input" rows="6" placeholder="补充导入项目的剧情摘要">${escapeHtml(summary)}</textarea>
                </div>
                <div class="preview-meta-row">
                    <div class="preview-field">
                        <label for="import-preview-adaptation-mode">改编模式</label>
                        <select id="import-preview-adaptation-mode">
                            <option value="faithful" ${project.adaptationMode === 'faithful' ? 'selected' : ''}>忠于原著</option>
                            <option value="balanced" ${project.adaptationMode === 'balanced' ? 'selected' : ''}>平衡改编</option>
                            <option value="free" ${project.adaptationMode === 'free' ? 'selected' : ''}>高自由互动</option>
                        </select>
                    </div>
                    <div class="preview-field">
                        <label for="import-preview-game-type">游戏类型</label>
                        <select id="import-preview-game-type">
                            <option value="custom" ${project.gameType === 'custom' ? 'selected' : ''}>自定义</option>
                            <option value="adventure" ${project.gameType === 'adventure' ? 'selected' : ''}>冒险</option>
                            <option value="mystery" ${project.gameType === 'mystery' ? 'selected' : ''}>推理</option>
                            <option value="romance" ${project.gameType === 'romance' ? 'selected' : ''}>恋爱</option>
                            <option value="fantasy" ${project.gameType === 'fantasy' ? 'selected' : ''}>奇幻</option>
                            <option value="scifi" ${project.gameType === 'scifi' ? 'selected' : ''}>科幻</option>
                            <option value="kingdom" ${project.gameType === 'kingdom' ? 'selected' : ''}>王国</option>
                            <option value="cultivation" ${project.gameType === 'cultivation' ? 'selected' : ''}>修仙</option>
                        </select>
                    </div>
                </div>
                <div class="preview-content">
                    <p>主题：${escapeHtml(themes)}</p>
                    <p>主要地点：${escapeHtml(locationNames || '待补充')}</p>
                    <p>${escapeHtml(playableStatus)}</p>
                    <p>${escapeHtml(hasRuntimeSnapshot ? '检测到运行快照，可继续试玩。' : '当前没有运行快照，将从开场开始试玩。')}</p>
                </div>
                <div class="preview-item-actions">
                    <button id="optimize-project-btn" type="button" class="preview-inline-btn">一键优化项目</button>
                    <button id="resume-project-play" type="button" class="preview-inline-btn" ${playable ? '' : 'disabled'}>${hasRuntimeSnapshot ? '继续试玩' : '试玩当前版本'}</button>
                </div>
            </div>
        `;
        document.getElementById('optimize-project-btn')?.addEventListener('click', async () => {
            await optimizeProject();
        });
        document.getElementById('resume-project-play')?.addEventListener('click', async () => {
            await resumeProjectPlay();
        });
    }

    if (charactersEl) {
        const characterItems = characters.length
            ? characters.map((character, index) => `
                <article class="preview-edit-item" data-preview-item="character" data-index="${index}" data-item-id="${escapeAttribute(character.id || '')}">
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label>角色名</label>
                            <input type="text" data-field="name" value="${escapeAttribute(character.name || '')}" placeholder="角色名称" />
                        </div>
                        <div class="preview-field">
                            <label>角色定位</label>
                            <input type="text" data-field="role" value="${escapeAttribute(character.role || '')}" placeholder="主角 / 配角 / 阵营人物" />
                        </div>
                    </div>
                    <div class="preview-field">
                        <label>角色描述</label>
                        <textarea data-field="description" rows="4" placeholder="补充角色外观、气质、动机">${escapeHtml(character.description || '')}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-character">删除角色</button>
                    </div>
                </article>
            `).join('')
            : '<p class="empty-hint">暂未提取到明显角色，可以手动补一个再继续。</p>';

        charactersEl.innerHTML = `
            <div class="preview-card-header">
                <p class="helper-text">这里只做轻量纠偏，确认后会直接带入后续生成。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-character">新增角色</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="character">
                ${characterItems}
            </div>
        `;
    }

    if (chaptersEl) {
        const chapterItems = chapters.length
            ? chapters.map((chapter, index) => `
                <article class="preview-edit-item" data-preview-item="chapter" data-index="${index}" data-item-id="${escapeAttribute(chapter.id || '')}">
                    <div class="preview-field">
                        <label>章节标题</label>
                        <input type="text" data-field="title" value="${escapeAttribute(chapter.title || chapter.name || '')}" placeholder="章节标题" />
                    </div>
                    <div class="preview-field">
                        <label>章节摘要</label>
                        <textarea data-field="summary" rows="5" placeholder="这一章的主要事件与冲突">${escapeHtml(chapter.summary || '')}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-chapter">删除章节</button>
                    </div>
                </article>
            `).join('')
            : '<p class="empty-hint">还没识别到章节结构，可以先加几个关键情节节点。</p>';

        chaptersEl.innerHTML = `
            <div class="preview-card-header">
                <p class="helper-text">保留关键章节就够，后续工作台还会继续细化。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-chapter">新增章节</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="chapter">
                ${chapterItems}
            </div>
        `;
    }

    if (visualsEl) {
        const locationItems = locations.length
            ? locations.map((location, index) => `
                <article class="preview-edit-item" data-preview-item="location" data-index="${index}" data-item-id="${escapeAttribute(location.id || '')}">
                    <div class="preview-field">
                        <label>地点名称</label>
                        <input type="text" data-field="name" value="${escapeAttribute(location.name || '')}" placeholder="地点名称" />
                    </div>
                    <div class="preview-field">
                        <label>地点描述</label>
                        <textarea data-field="description" rows="4" placeholder="地点外观、氛围、功能">${escapeHtml(location.description || '')}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-location">删除地点</button>
                    </div>
                </article>
            `).join('')
            : '<p class="empty-hint">地点越准，后面的场景基准图就越稳。</p>';

        const stylePreset = project.visualBible?.styleProfile?.stylePreset || '国风电影叙事';
        const refinement = project.config?.refinement || {};
        const branchPolicy = project.gameDesign?.branchingPolicy || {};
        const branchSummary = `每章分支上限 ${branchPolicy.maxBranchPerChapter || '-'}，锚点保留率 ${branchPolicy.mustKeepAnchorRate || '-'}`;
        const relationshipGraphHtml = renderRelationshipGraph(optimizationReport?.relationshipGraph);
        const playableTreeHtml = renderPlayableChapterTree(optimizationReport?.playableChapters);
        const optimizationHtml = optimizationReport
            ? `
                <article class="preview-edit-item">
                    <strong>项目优化诊断</strong>
                    <div class="preview-content">
                        <p>总评分：${escapeHtml(String(optimizationReport.overallScore || 0))}</p>
                        <p>故事完整度：${escapeHtml(String(optimizationReport.readiness?.story || 0))}</p>
                        <p>改编完整度：${escapeHtml(String(optimizationReport.readiness?.adaptation || 0))}</p>
                        <p>视觉完整度：${escapeHtml(String(optimizationReport.readiness?.visual || 0))}</p>
                        <p>试玩完整度：${escapeHtml(String(optimizationReport.readiness?.playable || 0))}</p>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">优化建议</div>
                        <div class="candidate-paragraph">${escapeHtml((optimizationReport.recommendations || []).join('；') || '当前没有明显阻塞项。')}</div>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">当前优势</div>
                        <div class="candidate-paragraph">${escapeHtml((optimizationReport.strengths || []).join('；') || '继续丰富内容即可。')}</div>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">建议下一步</div>
                        <div class="candidate-paragraph">${escapeHtml((optimizationReport.nextActions || []).map((item) => item.label).join('；') || '当前没有明显阻塞项。')}</div>
                    </div>
                    ${relationshipGraphHtml}
                    ${playableTreeHtml}
                </article>
            `
            : '';

        visualsEl.innerHTML = `
            <div class="preview-card-header">
                <p class="helper-text">先确认后续要做视觉建档的主要地点。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-location">新增地点</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="location">
                ${locationItems}
            </div>

            <div class="preview-card-header">
                <h3>改编导演与视觉重建</h3>
            </div>
            <div class="preview-edit-stack">
                <article class="preview-edit-item">
                    <div class="preview-field">
                        <label for="preview-style-preset">风格预设</label>
                        <input id="preview-style-preset" type="text" value="${escapeAttribute(stylePreset)}" placeholder="例如：国风电影叙事 / 水墨奇幻" />
                    </div>
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label for="preview-pacing">节奏倾向</label>
                            <select id="preview-pacing">
                                <option value="slow" ${project.config?.pacing === 'slow' ? 'selected' : ''}>慢节奏</option>
                                <option value="balanced" ${(!project.config?.pacing || project.config?.pacing === 'balanced') ? 'selected' : ''}>平衡</option>
                                <option value="fast" ${project.config?.pacing === 'fast' ? 'selected' : ''}>快节奏</option>
                            </select>
                        </div>
                        <div class="preview-field">
                            <label for="preview-adaptation-strength">改编强度 (0-1)</label>
                            <input id="preview-adaptation-strength" type="number" min="0" max="1" step="0.1" value="${Number(refinement.adaptationStrength ?? 0.5)}" />
                        </div>
                    </div>
                    <div class="preview-item-actions preview-actions-grid">
                        <button id="rebuild-adaptation-btn" type="button" class="preview-inline-btn">重算改编结构</button>
                        <button id="rebuild-visual-bible-btn" type="button" class="preview-inline-btn">重建视觉圣经</button>
                        <button id="apply-project-refinement-btn" type="button" class="preview-inline-btn">应用校正参数</button>
                        <button id="export-project-package-btn" type="button" class="preview-inline-btn">导出项目包</button>
                    </div>
                </article>
            </div>

            <div class="preview-item-actions preview-actions-grid">
                <button id="optimize-project-inline-btn" type="button" class="preview-inline-btn">一键优化项目</button>
                <button id="generate-base-assets" type="button" class="preview-inline-btn">生成角色/地点基准图</button>
            </div>
            <div id="project-asset-list" class="preview-edit-stack"></div>
            <div id="project-optimization-report" class="preview-edit-stack">${optimizationHtml}</div>
            <div class="preview-content">
                <p>角色基准图建议：${escapeHtml(characterHints || '先确认角色后再生成')}</p>
                <p>场景基准图建议：${escapeHtml(locationHints || '先确认地点后再生成')}</p>
                <p>视觉氛围：${escapeHtml(atmosphere)}</p>
                <p>改编策略：${escapeHtml(project.gameDesign?.adaptationProfile || getAdaptationModeLabel(project.adaptationMode || 'balanced'))} · ${escapeHtml(branchSummary)}</p>
            </div>
        `;
        renderProjectAssetList(project.visualBible?.assetIndex || []);
        document.getElementById('optimize-project-inline-btn')?.addEventListener('click', async () => {
            await optimizeProject();
        });
        document.getElementById('generate-base-assets')?.addEventListener('click', async () => {
            await generateBaseAssetsForProject();
        });
        document.getElementById('rebuild-adaptation-btn')?.addEventListener('click', async () => {
            await rebuildProjectAdaptation();
        });
        document.getElementById('rebuild-visual-bible-btn')?.addEventListener('click', async () => {
            await rebuildProjectVisualBible();
        });
        document.getElementById('apply-project-refinement-btn')?.addEventListener('click', async () => {
            await applyProjectRefinement();
        });
        document.getElementById('export-project-package-btn')?.addEventListener('click', async () => {
            await exportProjectPackage();
        });
    }
}

async function optimizeProject() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在分析并优化项目结构...', 'pending');
    try {
        const savedProject = await saveImportedProjectEdits({ showStatus: false });
        if (!savedProject) {
            return;
        }

        const result = await requestJson(
            `/projects/${state.currentProjectId}/optimize`,
            createJsonRequest('POST', {
                preserveAssets: true
            })
        );
        state.currentProjectData = result.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);
        const score = result.optimizationReport?.overallScore ?? state.currentProjectData?.optimizationReport?.overallScore ?? 0;
        setImportPreviewStatus(`项目优化完成，当前综合评分 ${score}。`, 'success');
    } catch (error) {
        setImportPreviewStatus(`项目优化失败：${error.message}`, 'error');
    }
}

async function resumeProjectPlay(restart = false) {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus(restart ? '正在重启试玩版本...' : '正在恢复试玩版本...', 'pending');

    try {
        const config = getEffectiveGenerationConfig();
        const result = await requestJson(
            `/projects/${state.currentProjectId}/play`,
            createJsonRequest('POST', {
                restart,
                config: config.imageSource === 'comfyui'
                    ? { ...config, ...readLiveComfyUIConfig() }
                    : config
            })
        );

        state.currentGameId = result.gameId;
        state.sceneImages = [];
        state.selectedSceneImageIndex = 0;
        state.activeSceneImage = '';
        state.transitioningSceneImage = '';
        state.currentVisualSignature = '';
        document.getElementById('game-log').innerHTML = '';
        showChoices([]);
        renderSceneImages([]);
        showScreen('game-screen');
        renderGameState(result.gameState);
        setImportPreviewStatus(result.resumed ? '已恢复到上次试玩进度。' : '已载入试玩版本。', 'success');
    } catch (error) {
        setImportPreviewStatus(`试玩恢复失败：${error.message}`, 'error');
    }
}

function renderProjectAssetList(assets = []) {
    const container = document.getElementById('project-asset-list');
    if (!container) {
        return;
    }

    if (!Array.isArray(assets) || !assets.length) {
        container.innerHTML = '<p class="empty-hint">暂无视觉资产，可先生成基准图。</p>';
        return;
    }

    container.innerHTML = assets.slice(0, 8).map((asset) => `
        <article class="preview-edit-item">
            <strong>${escapeHtml(asset.targetName || asset.type || '未命名资产')}</strong>
            <span class="helper-text">${escapeHtml(asset.type || 'asset')} · ${escapeHtml(asset.status || 'planned')}</span>
            ${asset.imageUrl ? `<img src="${asset.imageUrl}" alt="${escapeAttribute(asset.targetName || '资产图')}" style="width:100%;border-radius:8px;" />` : ''}
        </article>
    `).join('');
}

function renderRelationshipGraph(graph = {}) {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph?.edges) ? graph.edges : [];
    const hubs = Array.isArray(graph?.hubs) ? graph.hubs : [];

    return `
        <div class="candidate-block">
            <div class="candidate-label">关系图</div>
            <div class="relation-graph">
                <div class="relation-graph-nodes">
                    ${nodes.length
                        ? nodes.map((node) => `
                            <div class="relation-node">
                                <strong>${escapeHtml(node.name || '未命名角色')}</strong>
                                <span>${escapeHtml(node.role || '角色')}</span>
                            </div>
                        `).join('')
                        : '<div class="relation-empty">当前还没有足够清晰的人物节点。</div>'}
                </div>
                <div class="relation-graph-edges">
                    ${edges.length
                        ? edges.map((edge) => `
                            <div class="relation-edge">
                                <div class="relation-edge-main">${escapeHtml(edge.source || '未知')} → ${escapeHtml(edge.target || '未知')}</div>
                                <div class="relation-edge-meta">${escapeHtml(edge.relation || '待确认')} · 张力 ${escapeHtml(edge.tension || '中')}</div>
                            </div>
                        `).join('')
                        : '<div class="relation-empty">当前还没有识别到稳定关系。</div>'}
                </div>
                <div class="relation-graph-hubs">
                    <div class="relation-subtitle">关系中心</div>
                    ${hubs.length
                        ? hubs.map((hub, index) => `
                            <div class="relation-hub">
                                <span>#${index + 1}</span>
                                <strong>${escapeHtml(hub.name || '未命名角色')}</strong>
                                <em>连接数 ${escapeHtml(String(hub.degree || 0))}</em>
                            </div>
                        `).join('')
                        : '<div class="relation-empty">暂无明显中心人物。</div>'}
                </div>
            </div>
        </div>
    `;
}

function renderPlayableChapterTree(chapters = []) {
    const items = Array.isArray(chapters) ? chapters : [];

    return `
        <div class="candidate-block">
            <div class="candidate-label">章节可玩点树</div>
            <div class="chapter-play-tree">
                ${items.length
                    ? items.map((chapter, index) => `
                        <article class="chapter-play-card">
                            <div class="chapter-play-header">
                                <span class="chapter-play-index">CH ${index + 1}</span>
                                <strong>${escapeHtml(chapter.title || `章节 ${index + 1}`)}</strong>
                            </div>
                            <div class="chapter-play-body">
                                <p><span>冲突</span>${escapeHtml(chapter.conflict || '待补充')}</p>
                                <p><span>风险</span>${escapeHtml(chapter.stakes || '待补充')}</p>
                                <p><span>互动类型</span>${escapeHtml((chapter.interactiveTypes || []).join('、') || '待补充')}</p>
                                <p><span>关键节点</span>${escapeHtml((chapter.keyNodes || []).join('、') || '待补充')}</p>
                                <p><span>分支槽位</span>${escapeHtml(String(chapter.branchSlotCount || 0))}</p>
                            </div>
                        </article>
                    `).join('')
                    : '<div class="relation-empty">当前还没有足够的章节可玩点。</div>'}
            </div>
        </div>
    `;
}

async function generateBaseAssetsForProject() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    const config = getEffectiveGenerationConfig();
    if (!config.enableImages || config.imageSource === 'none') {
        setImportPreviewStatus('当前图像生成未启用，将先以规划模式创建资产索引。', 'pending');
    } else {
        setImportPreviewStatus('正在生成角色/地点基准图，请稍候...', 'pending');
    }

    try {
        const payload = {
            dryRun: !config.enableImages || config.imageSource === 'none',
            characterLimit: 4,
            locationLimit: 4,
            imageConfig: config.imageSource === 'comfyui'
                ? { ...config, ...readLiveComfyUIConfig() }
                : config
        };

        const result = await requestJson(
            `/projects/${state.currentProjectId}/assets/generate-base`,
            createJsonRequest('POST', payload)
        );

        const projectData = await requestJson(`/projects/${state.currentProjectId}`);
        state.currentProjectData = projectData.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);

        setImportPreviewStatus(
            payload.dryRun
                ? `已创建 ${result.generatedAssets?.length || 0} 条资产规划。`
                : `已生成 ${result.generatedAssets?.length || 0} 个基准资产。`,
            'success'
        );
    } catch (error) {
        setImportPreviewStatus(`基准图生成失败：${error.message}`, 'error');
    }
}

function collectProjectRefinementPayload() {
    const stylePreset = document.getElementById('preview-style-preset')?.value.trim() || '';
    const pacing = document.getElementById('preview-pacing')?.value || 'balanced';
    const adaptationStrength = Number(document.getElementById('preview-adaptation-strength')?.value ?? 0.5);

    return {
        pacing,
        refinement: {
            adaptationStrength: Number.isFinite(adaptationStrength) ? Math.max(0, Math.min(1, adaptationStrength)) : 0.5
        },
        styleProfile: stylePreset ? { stylePreset } : {}
    };
}

async function rebuildProjectAdaptation() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在重算改编结构...', 'pending');
    try {
        const edits = collectImportedProjectEdits();
        const result = await requestJson(
            `/projects/${state.currentProjectId}/adaptation/rebuild`,
            createJsonRequest('POST', {
                gameType: edits.gameType,
                adaptationMode: edits.adaptationMode
            })
        );
        state.currentProjectData = result.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);
        setImportPreviewStatus('改编结构已重算。', 'success');
    } catch (error) {
        setImportPreviewStatus(`重算失败：${error.message}`, 'error');
    }
}

async function rebuildProjectVisualBible() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在重建视觉圣经...', 'pending');
    try {
        const payload = collectProjectRefinementPayload();
        const result = await requestJson(
            `/projects/${state.currentProjectId}/visual-bible/rebuild`,
            createJsonRequest('POST', {
                styleProfile: payload.styleProfile
            })
        );
        state.currentProjectData = result.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);
        setImportPreviewStatus('视觉圣经已重建。', 'success');
    } catch (error) {
        setImportPreviewStatus(`重建失败：${error.message}`, 'error');
    }
}

async function applyProjectRefinement() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在应用校正参数...', 'pending');
    try {
        const edits = collectImportedProjectEdits();
        const payload = collectProjectRefinementPayload();
        const result = await requestJson(
            `/projects/${state.currentProjectId}/refine`,
            createJsonRequest('POST', {
                ...payload,
                adaptationMode: edits.adaptationMode
            })
        );
        state.currentProjectData = result.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);
        setImportPreviewStatus('校正参数已应用。', 'success');
    } catch (error) {
        setImportPreviewStatus(`应用失败：${error.message}`, 'error');
    }
}

function downloadJsonFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function exportProjectPackage() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在导出项目包...', 'pending');
    try {
        const result = await requestJson(`/projects/${state.currentProjectId}/export-package`);
        const pkg = result.package || {};
        const fileName = `${(state.currentProjectData?.title || 'project').replace(/[\\/:*?"<>|]/g, '_')}_package.json`;
        downloadJsonFile(fileName, pkg);
        setImportPreviewStatus('项目包导出成功。', 'success');
    } catch (error) {
        setImportPreviewStatus(`导出失败：${error.message}`, 'error');
    }
}

async function saveImportedProjectEdits(options = {}) {
    if (!state.currentProjectId) {
        setImportPreviewStatus('当前没有可保存的导入项目，请重新导入。', 'error');
        return null;
    }

    const showStatus = options.showStatus !== false;
    if (showStatus) {
        setImportPreviewStatus('正在保存导入项目修改...', 'pending');
    }

    try {
        const result = await requestJson(
            `/projects/${state.currentProjectId}/update`,
            createJsonRequest('POST', { edits: collectImportedProjectEdits() })
        );

        state.currentProjectData = result.project || state.currentProjectData;
        if (state.currentProjectData) {
            document.getElementById('import-title').value = state.currentProjectData.title || '';
        }

        renderImportedProjectPreview(state.currentProjectData);

        if (showStatus) {
            setImportPreviewStatus(options.successMessage || '导入项目修改已保存。', 'success');
        }

        return state.currentProjectData;
    } catch (error) {
        console.error('Save imported project edits error:', error);
        if (showStatus) {
            setImportPreviewStatus(error.message, 'error');
        }
        return null;
    }
}

async function initImportedProjectGenerationSession() {
    const content = document.getElementById('import-content')?.value.trim() || '';
    if (!content) {
        setImportStatus('请先粘贴要导入的长文本内容。', 'error');
        return;
    }

    if (content.length < 100) {
        setImportStatus('文本内容过短，至少需要 100 字。', 'error');
        return;
    }

    const generationConfig = normalizeGenerationConfig(collectGenerationConfig());
    state.currentGenerationConfig = generationConfig;
    saveGenerationSettings();

    const useSmart = document.getElementById('use-smart-parse')?.checked !== false;
    const submitBtn = document.getElementById('import-submit-btn');
    const progressContainer = document.getElementById('import-progress');
    const progressFill = document.getElementById('import-progress-fill');
    const progressText = document.getElementById('import-progress-text');

    if (submitBtn) submitBtn.disabled = true;

    try {
        const importPayload = {
            title: document.getElementById('import-title')?.value.trim() || '',
            content,
            gameType: document.getElementById('import-game-type')?.value || 'custom',
            adaptationMode: document.getElementById('adaptation-mode')?.value || 'balanced',
            useSmart,
            settings: useSmart ? collectLlmSettings() : undefined
        };

        if (useSmart) {
            // 使用智能解析，显示进度
            if (progressContainer) progressContainer.style.display = 'block';
            setImportStatus('正在使用 AI 智能解析文本...', 'pending');

            const imported = await requestJsonWithProgress(
                '/projects/import-text',
                createJsonRequest('POST', importPayload),
                (percent, message) => {
                    if (progressFill) progressFill.style.width = `${percent}%`;
                    if (progressText) progressText.textContent = message || `解析中... ${percent}%`;
                }
            );

            state.currentProjectId = imported.project?.id || null;
            state.currentProjectData = imported.project || null;
            state.currentGameType = importPayload.gameType;
            renderImportedProjectPreview(imported.project);
            setImportStatus('AI 智能解析完成！请检查提取结果。', 'success');
            setImportPreviewStatus('AI 已智能识别章节、角色和关系，可以轻量修改后进入工作台。', 'success');
        } else {
            // 使用快速解析
            setImportStatus('正在快速解析文本...', 'pending');
            const imported = await requestJson('/projects/import-text', createJsonRequest('POST', importPayload));
            state.currentProjectId = imported.project?.id || null;
            state.currentProjectData = imported.project || null;
            state.currentGameType = importPayload.gameType;
            renderImportedProjectPreview(imported.project);
            setImportStatus('快速解析完成，请检查提取结果。', 'success');
            setImportPreviewStatus('可以先轻量修改角色、章节和地点，再确认进入工作台。');
        }

        await loadImportedProjects();
        showScreen('import-preview-screen');
    } catch (error) {
        console.error('Imported project init error:', error);
        setImportStatus(`导入失败：${error.message}`, 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
    }
}

async function startImportedProjectSession() {
    if (!state.currentProjectId) {
        setImportStatus('当前没有可用的导入项目，请重新导入。', 'error');
        showScreen('import-screen');
        return;
    }

    const generationConfig = normalizeGenerationConfig(collectGenerationConfig());
    state.currentGenerationConfig = generationConfig;
    saveGenerationSettings();

    try {
        const savedProject = await saveImportedProjectEdits({
            successMessage: '修改已保存，正在进入生成工作台...'
        });

        if (!savedProject) {
            return;
        }

        const sessionData = await requestJson(
            `/projects/${state.currentProjectId}/init-session`,
            createJsonRequest('POST', {
                config: generationConfig,
                gameType: savedProject.gameType || state.currentGameType || 'custom',
                userInput: savedProject.storyBible?.summary || savedProject.source?.excerpt || ''
            })
        );

        await beginGenerationWorkbench(sessionData);
        setImportStatus('导入项目已进入生成工作台。', 'success');
    } catch (error) {
        console.error('Start imported project session error:', error);
        setImportStatus(error.message, 'error');
        setImportPreviewStatus(error.message, 'error');
        showScreen('import-screen');
    }
}

async function loadImportedProjects() {
    const container = document.getElementById('import-project-list');
    if (!container) {
        return;
    }

    container.innerHTML = '<p class="empty-hint">正在加载项目列表...</p>';

    try {
        const data = await requestJson('/projects');
        const projects = Array.isArray(data.projects) ? data.projects : [];

        if (!projects.length) {
            container.innerHTML = '<p class="empty-hint">还没有导入项目。</p>';
            return;
        }

        container.innerHTML = projects.map((project) => `
            <article class="import-project-card" data-project-id="${escapeAttribute(project.id)}">
                <div class="import-project-main">
                    <strong>${escapeHtml(project.title || '未命名项目')}</strong>
                    <p>${escapeHtml(project.summary || '暂无摘要')}</p>
                    <div class="import-project-meta">
                        <span>${escapeHtml(gameTypeNames[project.gameType] || '自定义 RPG')}</span>
                        <span>${escapeHtml(getAdaptationModeLabel(project.adaptationMode || 'balanced'))}</span>
                        <span>${escapeHtml(new Date(project.updatedAt || project.createdAt || Date.now()).toLocaleString())}</span>
                    </div>
                </div>
                <div class="import-project-actions">
                    <button type="button" class="preview-inline-btn" data-action="open">继续编辑</button>
                    <button type="button" class="preview-inline-btn danger" data-action="delete">删除</button>
                </div>
            </article>
        `).join('');

        container.querySelectorAll('[data-action="open"]').forEach((button) => {
            button.addEventListener('click', async () => {
                const card = button.closest('[data-project-id]');
                const projectId = card?.getAttribute('data-project-id');
                if (!projectId) {
                    return;
                }

                await openImportedProject(projectId);
            });
        });

        container.querySelectorAll('[data-action="delete"]').forEach((button) => {
            button.addEventListener('click', async () => {
                const card = button.closest('[data-project-id]');
                const projectId = card?.getAttribute('data-project-id');
                if (!projectId) {
                    return;
                }

                await deleteImportedProject(projectId);
            });
        });
    } catch (error) {
        container.innerHTML = `<p class="empty-hint">项目列表加载失败：${escapeHtml(error.message)}</p>`;
    }
}

async function openImportedProject(projectId) {
    try {
        const data = await requestJson(`/projects/${projectId}`);
        state.currentProjectId = data.project?.id || projectId;
        state.currentProjectData = data.project || null;
        state.currentGameType = data.project?.gameType || state.currentGameType;

        if (state.currentProjectData) {
            document.getElementById('import-title').value = state.currentProjectData.title || '';
            state.currentGameType = state.currentProjectData.gameType || state.currentGameType;
        }

        renderImportedProjectPreview(state.currentProjectData);
        setImportStatus('已加载导入项目，你可以继续修改。', 'success');
        setImportPreviewStatus('项目已加载，可直接修改并继续进入工作台。');
        showScreen('import-preview-screen');
    } catch (error) {
        setImportStatus(`加载项目失败：${error.message}`, 'error');
    }
}

async function deleteImportedProject(projectId) {
    if (!confirm('确定删除这个导入项目吗？删除后不可恢复。')) {
        return;
    }

    try {
        await requestJson(`/projects/${projectId}`, createJsonRequest('DELETE', {}));
        if (state.currentProjectId === projectId) {
            state.currentProjectId = null;
            state.currentProjectData = null;
        }
        await loadImportedProjects();
        setImportStatus('项目已删除。', 'success');
    } catch (error) {
        setImportStatus(`删除项目失败：${error.message}`, 'error');
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
    setApiStatus('calling', `正在生成 ${stepDescriptions[stepId]?.name || stepId}...`);

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
        return renderParagraph('解析提示', candidate.error || 'AI 响应暂时无法解析，请尝试重新生成。');
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
    setApiStatus('calling', `正在重新生成 ${stepDescriptions[state.currentStepId]?.name || state.currentStepId}...`);

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

        setApiStatus('success', '已完成重新生成。');
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

function getEffectiveGenerationConfig() {
    if (state.currentGenerationConfig) {
        return normalizeGenerationConfig(state.currentGenerationConfig);
    }

    const collected = normalizeGenerationConfig(collectGenerationConfig());
    state.currentGenerationConfig = collected;
    return collected;
}

function appendLog(type, content, speaker = '') {
    const log = document.getElementById('game-log');
    if (!log) {
        return null;
    }

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    if (speaker) {
        const speakerEl = document.createElement('div');
        speakerEl.className = 'speaker';
        speakerEl.textContent = speaker;
        entry.appendChild(speakerEl);
    }

    const contentEl = document.createElement('div');
    contentEl.className = 'content';
    contentEl.textContent = content;
    entry.appendChild(contentEl);

    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    // 返回 contentEl 以便流式更新
    return contentEl;
}

function showChoices(choices = []) {
    const container = document.getElementById('choices-container');
    if (!container) {
        return;
    }

    if (!Array.isArray(choices) || !choices.length) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = choices.map((choice, index) => `
        <button type="button" class="choice-btn" data-choice-index="${index}">
            ${escapeHtml(choice.text || choice.action || `选项 ${index + 1}`)}
        </button>
    `).join('');

    container.querySelectorAll('[data-choice-index]').forEach((button) => {
        button.addEventListener('click', async () => {
            const index = Number(button.getAttribute('data-choice-index'));
            const selected = choices[index];
            if (!selected) {
                return;
            }
            await sendPlayerAction(selected.action || selected.text || '');
        });
    });
}

function renderStats(stats = {}) {
    const container = document.getElementById('player-stats');
    if (!container) {
        return;
    }

    const items = Object.entries(stats || {});
    if (!items.length) {
        container.innerHTML = '<p class="empty-hint">暂无属性信息</p>';
        return;
    }

    container.innerHTML = items.map(([name, value]) => {
        if (value && typeof value === 'object' && Number.isFinite(value.current) && Number.isFinite(value.max)) {
            const ratio = value.max > 0 ? Math.max(0, Math.min(100, (value.current / value.max) * 100)) : 0;
            return `
                <div class="stat-item">
                    <div style="width:100%">
                        <span class="stat-name">${escapeHtml(name)}</span>
                        <span class="stat-value" style="float:right">${value.current}/${value.max}</span>
                        <div class="stat-bar"><div class="stat-bar-fill hp" style="width:${ratio}%"></div></div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="stat-item">
                <span class="stat-name">${escapeHtml(name)}</span>
                <span class="stat-value">${escapeHtml(String(value))}</span>
            </div>
        `;
    }).join('');
}

function renderInventory(inventory = []) {
    const list = document.getElementById('inventory-list');
    if (!list) {
        return;
    }

    if (!Array.isArray(inventory) || !inventory.length) {
        list.innerHTML = '<li>暂无物品</li>';
        return;
    }

    list.innerHTML = inventory.map((item) => `<li>${escapeHtml(item.name || String(item))}</li>`).join('');
}

function renderQuests(quests = []) {
    const list = document.getElementById('quest-list');
    if (!list) {
        return;
    }

    if (!Array.isArray(quests) || !quests.length) {
        list.innerHTML = '<li>暂无任务</li>';
        return;
    }

    list.innerHTML = quests.map((quest) => `
        <li class="${quest.completed ? 'completed' : ''}">
            ${escapeHtml(quest.name || quest.description || '未命名任务')}
            ${quest.progress ? ` · ${escapeHtml(quest.progress)}` : ''}
        </li>
    `).join('');
}

async function startGame(gameId = state.currentGameId) {
    if (!gameId) {
        return;
    }

    try {
        const data = await requestJson(`/games/${gameId}/start`, createJsonRequest('POST', {}));
        state.currentGameId = gameId;
        state.gameState = data.gameState || null;
        state.sceneImages = [];
        state.selectedSceneImageIndex = 0;
        state.activeSceneImage = '';
        state.transitioningSceneImage = '';
        state.currentVisualSignature = '';
        document.getElementById('game-log').innerHTML = '';
        showChoices([]);
        renderSceneImages([]);
        showScreen('game-screen');
        renderGameState(state.gameState);
    } catch (error) {
        alert(`启动游戏失败：${error.message}`);
    }
}

async function finalizeGame() {
    if (!state.currentSessionId) {
        alert('当前没有生成会话。');
        return;
    }

    setApiStatus('calling', '正在整合并生成最终游戏...');
    try {
        const result = await requestJson(
            `/generate/${state.currentSessionId}/finalize`,
            createJsonRequest('POST', { config: getEffectiveGenerationConfig() })
        );

        state.currentGameId = result.gameId;
        state.currentGameData = result.gameData || null;
        state.currentGameType = result.gameData?.type || state.currentGameType;
        await startGame(state.currentGameId);
        setApiStatus('success', '游戏已生成并启动。');
    } catch (error) {
        setApiStatus('error', error.message);
        alert(`整合失败：${error.message}`);
    }
}

async function sendPlayerAction(actionOverride = '') {
    if (!state.currentGameId) {
        return;
    }

    const input = document.getElementById('player-input');
    const sendButton = document.getElementById('send-btn');
    const action = actionOverride || input?.value.trim() || '';
    if (!action) {
        return;
    }

    if (input) {
        input.value = '';
    }
    if (sendButton) {
        sendButton.disabled = true;
    }
    appendLog('player', action, '你');

    try {
        const baseConfig = getEffectiveGenerationConfig();
        const imageConfig = baseConfig.imageSource === 'comfyui'
            ? { ...baseConfig, ...readLiveComfyUIConfig() }
            : baseConfig;

        // 检查是否启用流式输出
        const useStreaming = state.settings?.enableStreaming !== false; // 默认启用

        if (useStreaming) {
            await sendPlayerActionStreaming(action, imageConfig);
        } else {
            await sendPlayerActionNormal(action, imageConfig);
        }
    } catch (error) {
        appendLog('system', `行动处理失败：${error.message}`);
    } finally {
        if (sendButton) {
            sendButton.disabled = false;
        }
    }
}

/**
 * 流式发送玩家动作
 */
async function sendPlayerActionStreaming(action, imageConfig) {
    const response = await fetch(`${API_BASE}/games/${state.currentGameId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action,
            imageConfig,
            streaming: true
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentNarration = '';
    let narratorLogElement = null;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim() || line === 'data: [DONE]') continue;
            if (!line.startsWith('data: ')) continue;

            try {
                const chunk = JSON.parse(line.slice(6));

                if (chunk.type === 'narration') {
                    // 流式显示旁白
                    if (!narratorLogElement) {
                        narratorLogElement = appendLog('narrator', '');
                    }
                    currentNarration = chunk.text;
                    narratorLogElement.textContent = currentNarration;
                } else if (chunk.type === 'complete') {
                    // 完成
                    if (Array.isArray(chunk.gameState?.lastDialogues)) {
                        chunk.gameState.lastDialogues.forEach((dialogue) => {
                            if (!dialogue?.content) return;
                            appendLog('narrator', dialogue.content, dialogue.speaker || '角色');
                        });
                    }

                    if (chunk.gameOver && chunk.gameOverMessage) {
                        appendLog('system', chunk.gameOverMessage);
                    }

                    showChoices(chunk.choices || []);
                    renderGameState(chunk.gameState || state.gameState);
                }
            } catch (e) {
                console.error('解析流式数据失败:', e);
            }
        }
    }
}

/**
 * 普通模式发送玩家动作
 */
async function sendPlayerActionNormal(action, imageConfig) {
    const result = await requestJson(
        `/games/${state.currentGameId}/action`,
        createJsonRequest('POST', {
            action,
            imageConfig
        })
    );

    if (Array.isArray(result.gameState?.lastDialogues)) {
        result.gameState.lastDialogues.forEach((dialogue) => {
            if (!dialogue?.content) {
                return;
            }
            appendLog('narrator', dialogue.content, dialogue.speaker || '角色');
        });
    }

    if (result.response) {
        appendLog('narrator', result.response);
    }

    if (result.gameOver && result.gameOverMessage) {
        appendLog('system', result.gameOverMessage);
    }

    showChoices(result.choices || []);
    renderGameState(result.gameState || state.gameState);

    if (result.sceneImage) {
        renderSceneImages([result.sceneImage], result.visualState?.prompt || result.sceneDescription || result.response);
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

function setSceneImageStatus(message, tone = '') {
    const status = document.getElementById('scene-image-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.className = `helper-text ${tone}`.trim();
}

function setSceneImageLoadingState(loading) {
    const button = document.getElementById('generate-scene-image-btn');
    if (!button) {
        return;
    }

    button.disabled = Boolean(loading);
    button.textContent = loading ? '生成中...' : '生成场景图';
}

function syncSceneImageControls() {
    const controls = document.getElementById('scene-image-controls');
    const promptInput = document.getElementById('scene-image-prompt');
    const countInput = document.getElementById('scene-image-count');
    const livePanel = document.getElementById('live-image-config');
    const config = getEffectiveGenerationConfig();
    const imagesEnabled = config.enableImages && config.imageSource !== 'none';

    if (controls) {
        controls.style.display = imagesEnabled ? 'block' : 'none';
    }

    if (!imagesEnabled) {
        setSceneImageStatus('当前未启用图像生成。', 'pending');
        return;
    }

    if (promptInput) {
        const suggestedPrompt = state.lastSuggestedImagePrompt
            || state.gameState?.sceneDescription
            || state.gameState?.initialLog
            || '';
        if (!promptInput.value.trim() || promptInput.value === state.lastSuggestedImagePrompt) {
            promptInput.value = suggestedPrompt;
        }
        state.lastSuggestedImagePrompt = suggestedPrompt;
    }

    if (countInput) {
        countInput.value = String(Math.max(1, Math.min(8, Number(config.comfyuiImageCount) || 1)));
    }

    if (livePanel) {
        livePanel.style.display = config.imageSource === 'comfyui' ? 'block' : 'none';
    }

    if (config.imageGenerationMode === 'auto') {
        setSceneImageStatus('当前为自动生图模式：视觉场景变化时会自动更新。', 'pending');
    } else {
        setSceneImageStatus('当前为手动生图模式：点击按钮后才会生成。', 'pending');
    }
}

function renderSceneImages(images = [], prompt = '') {
    state.sceneImages = Array.isArray(images) ? images : [];
    state.selectedSceneImageIndex = 0;

    if (prompt) {
        state.lastSuggestedImagePrompt = prompt;
    }

    const gallery = document.getElementById('scene-image-gallery');
    if (gallery) {
        if (!state.sceneImages.length) {
            gallery.innerHTML = '';
        } else {
            gallery.innerHTML = state.sceneImages
                .map((image, index) => `
                    <button
                        type="button"
                        class="scene-thumb ${index === state.selectedSceneImageIndex ? 'active' : ''}"
                        data-scene-thumb="${index}"
                    >
                        <img src="${image}" alt="场景候选图 ${index + 1}" />
                    </button>
                `)
                .join('');

            gallery.querySelectorAll('[data-scene-thumb]').forEach((button) => {
                button.addEventListener('click', () => {
                    const nextIndex = Number(button.getAttribute('data-scene-thumb'));
                    if (Number.isNaN(nextIndex)) {
                        return;
                    }
                    state.selectedSceneImageIndex = nextIndex;
                    renderSceneImageStage(state.sceneImages[nextIndex] || '');
                    gallery.querySelectorAll('[data-scene-thumb]').forEach((item) => {
                        item.classList.toggle('active', Number(item.getAttribute('data-scene-thumb')) === nextIndex);
                    });
                });
            });
        }
    }

    renderSceneImageStage(state.sceneImages[state.selectedSceneImageIndex] || '');
    const promptInput = document.getElementById('scene-image-prompt');
    if (promptInput && state.lastSuggestedImagePrompt && !promptInput.value.trim()) {
        promptInput.value = state.lastSuggestedImagePrompt;
    }
}

function renderSceneImageStage(nextImage = '') {
    const imageContainer = document.getElementById('scene-image');
    if (!imageContainer) {
        return;
    }

    if (!nextImage) {
        state.activeSceneImage = '';
        state.transitioningSceneImage = '';
        imageContainer.innerHTML = '<div class="placeholder">场景图像将在这里显示</div>';
        return;
    }

    if (!state.activeSceneImage) {
        state.activeSceneImage = nextImage;
        state.transitioningSceneImage = '';
        imageContainer.innerHTML = `
            <div class="scene-image-layer is-active">
                <img src="${nextImage}" alt="场景图" />
            </div>
        `;
        return;
    }

    if (state.activeSceneImage === nextImage) {
        imageContainer.innerHTML = `
            <div class="scene-image-layer is-active">
                <img src="${nextImage}" alt="场景图" />
            </div>
        `;
        return;
    }

    state.transitioningSceneImage = nextImage;
    state.sceneImageTransitionToken += 1;
    const transitionToken = state.sceneImageTransitionToken;
    const preloadImage = new Image();

    preloadImage.onload = () => {
        if (state.sceneImageTransitionToken !== transitionToken) {
            return;
        }

        imageContainer.innerHTML = `
            <div class="scene-image-layer scene-image-layer-back is-active">
                <img src="${state.activeSceneImage}" alt="当前场景图" />
            </div>
            <div class="scene-image-layer scene-image-layer-front">
                <img src="${nextImage}" alt="下一场景图" />
            </div>
        `;

        const frontLayer = imageContainer.querySelector('.scene-image-layer-front');
        requestAnimationFrame(() => {
            frontLayer?.classList.add('is-active');
        });

        window.setTimeout(() => {
            if (state.sceneImageTransitionToken !== transitionToken) {
                return;
            }

            state.activeSceneImage = nextImage;
            state.transitioningSceneImage = '';
            imageContainer.innerHTML = `
                <div class="scene-image-layer is-active">
                    <img src="${nextImage}" alt="场景图" />
                </div>
            `;
        }, 420);
    };

    preloadImage.onerror = () => {
        if (state.sceneImageTransitionToken !== transitionToken) {
            return;
        }

        state.activeSceneImage = nextImage;
        state.transitioningSceneImage = '';
        imageContainer.innerHTML = `
            <div class="scene-image-layer is-active">
                <img src="${nextImage}" alt="场景图" />
            </div>
        `;
    };

    preloadImage.src = nextImage;
}

function buildRuntimeSnapshot(gameState = state.gameState) {
    if (!gameState) {
        return null;
    }

    return {
        chapterId: gameState.currentChapter ?? null,
        sceneNodeId: gameState.currentScene || null,
        plotBeatId: gameState.turn ?? null,
        playerState: gameState.player || {},
        worldState: gameState.worldState || {},
        relationshipState: gameState.characterStates || [],
        inventory: gameState.inventory || [],
        activeQuests: (gameState.quests || []).filter((item) => item && item.completed !== true),
        visualState: gameState.visualState || null,
        history: (gameState.history || []).slice(-20)
    };
}

function scheduleRuntimeSnapshotPersist() {
    if (!state.currentProjectId || !state.gameState) {
        return;
    }

    if (state.runtimeSnapshotSaving) {
        return;
    }

    if (state.runtimeSnapshotTimer) {
        window.clearTimeout(state.runtimeSnapshotTimer);
    }

    state.runtimeSnapshotTimer = window.setTimeout(async () => {
        state.runtimeSnapshotSaving = true;
        try {
            await requestJson(
                `/projects/${state.currentProjectId}/runtime-snapshot`,
                createJsonRequest('POST', {
                    runtimeSnapshot: buildRuntimeSnapshot(state.gameState)
                })
            );
        } catch (error) {
            console.warn('Runtime snapshot save failed:', error.message);
        } finally {
            state.runtimeSnapshotSaving = false;
        }
    }, 800);
}

function renderGameState(gameState = state.gameState) {
    if (!gameState) {
        return;
    }

    state.gameState = gameState;
    state.currentVisualSignature = gameState.visualState?.signature || state.currentVisualSignature;
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
    scheduleRuntimeSnapshotPersist();
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

function escapeAttribute(value) {
    return escapeHtml(value)
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

