/**
 * ComfyUI panel initialization, helpers, and image settings.
 */

import { requestJson, createJsonRequest } from '../services/api.js';
import { collectGenerationConfig, collectLlmSettings } from '../services/settings.js';
import { state } from './state.js';
import { getEffectiveGenerationConfig, normalizeGenerationConfig, populateSelect } from './utils.js';
import { setApiStatus } from './navigation.js';

// ---------------------------------------------------------------------------
// Panel initialization
// ---------------------------------------------------------------------------

export function initializeComfyUiPanel() {
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

export function initializeLiveImageConfigPanel() {
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

// ---------------------------------------------------------------------------
// Workflow mode toggles
// ---------------------------------------------------------------------------

export function toggleComfyWorkflowMode() {
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

export function toggleLiveWorkflowMode() {
    const workflowMode = document.getElementById('live-comfyui-workflow-mode');
    const customFields = document.getElementById('live-comfyui-custom-workflow');

    if (!workflowMode || !customFields) {
        return;
    }

    customFields.style.display = workflowMode.value === 'custom' ? 'block' : 'none';
}

// ---------------------------------------------------------------------------
// Read configs
// ---------------------------------------------------------------------------

export function readComfyUIConfig() {
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

export function readLiveComfyUIConfig() {
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

// ---------------------------------------------------------------------------
// Status setters
// ---------------------------------------------------------------------------

export function setComfyUiStatus(message, status = '') {
    const element = document.getElementById('comfyui-status');
    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `helper-text ${status}`.trim();
}

export function setLiveComfyUiStatus(message, status = '') {
    const element = document.getElementById('live-comfyui-status');
    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = `helper-text ${status}`.trim();
}

// ---------------------------------------------------------------------------
// ComfyUI API calls
// ---------------------------------------------------------------------------

export async function refreshComfyUIOptions(showStatus = true) {
    const url = document.getElementById('comfyui-url')?.value;
    if (!url) {
        setComfyUiStatus('请先填写 ComfyUI 地址。', 'error');
        return;
    }

    if (showStatus) {
        setComfyUiStatus('正在刷新模型列表...', 'pending');
    }

    try {
        const data = await requestJson('/comfyui/models', createJsonRequest('POST', { url }));
        const models = data.models || [];
        populateSelect('comfyui-model', models, state.currentGenerationConfig?.comfyuiModel);
        populateSelect('comfyui-sampler', data.samplers || ['euler']);
        populateSelect('comfyui-scheduler', data.schedulers || ['normal']);

        setComfyUiStatus(`已刷新模型列表，共 ${models.length} 个模型。`, 'success');
    } catch (error) {
        setComfyUiStatus(`刷新失败：${error.message}`, 'error');
    }
}

export async function refreshComfyWorkflowFiles(showStatus = true) {
    const url = document.getElementById('comfyui-url')?.value;
    if (!url) {
        setComfyUiStatus('请先填写 ComfyUI 地址。', 'error');
        return;
    }

    if (showStatus) {
        setComfyUiStatus('正在刷新工作流文件...', 'pending');
    }

    try {
        const data = await requestJson('/comfyui/workflows', createJsonRequest('POST', { url }));
        const files = data.files || data.workflows || [];
        populateSelect('comfyui-workflow-file', files, state.currentGenerationConfig?.comfyuiWorkflowFile);

        setComfyUiStatus(`已刷新工作流列表，共 ${files.length} 个文件。`, 'success');
    } catch (error) {
        setComfyUiStatus(`刷新工作流失败：${error.message}`, 'error');
    }
}

export async function loadSelectedComfyWorkflowFile(showStatus = true, preferredFile = '') {
    const url = document.getElementById('comfyui-url')?.value;
    const fileSelect = document.getElementById('comfyui-workflow-file');
    const workflowFile = preferredFile || fileSelect?.value;

    if (!url || !workflowFile) {
        if (showStatus) {
            setComfyUiStatus('请先选择一个工作流文件。', 'error');
        }
        return;
    }

    if (showStatus) {
        setComfyUiStatus('正在载入工作流...', 'pending');
    }

    try {
        const data = await requestJson('/comfyui/workflow/load', createJsonRequest('POST', { url, file: workflowFile }));
        const workflowJson = document.getElementById('comfyui-workflow-json');
        if (workflowJson && data.workflow) {
            workflowJson.value = typeof data.workflow === 'string' ? data.workflow : JSON.stringify(data.workflow, null, 2);
        }

        setComfyUiStatus(`已载入工作流：${workflowFile}`, 'success');
    } catch (error) {
        setComfyUiStatus(`载入工作流失败：${error.message}`, 'error');
    }
}

export async function testComfyUIConnection() {
    const url = document.getElementById('comfyui-url')?.value;
    if (!url) {
        setComfyUiStatus('请先填写 ComfyUI 地址。', 'error');
        return;
    }

    setComfyUiStatus('正在测试 ComfyUI 连接...', 'pending');

    try {
        const result = await requestJson('/comfyui/test', createJsonRequest('POST', { url }));
        setComfyUiStatus(result.success ? 'ComfyUI 连接成功！' : (result.error || '连接失败'), result.success ? 'success' : 'error');
    } catch (error) {
        setComfyUiStatus(`连接失败：${error.message}`, 'error');
    }
}

export async function validateComfyUIWorkflow() {
    const url = document.getElementById('comfyui-url')?.value;
    const workflowJson = document.getElementById('comfyui-workflow-json')?.value;

    if (!workflowJson) {
        setComfyUiStatus('请先输入工作流 JSON。', 'error');
        return;
    }

    setComfyUiStatus('正在校验工作流...', 'pending');

    try {
        let workflow;
        try {
            workflow = JSON.parse(workflowJson);
        } catch {
            throw new Error('工作流 JSON 格式无效。');
        }

        const result = await requestJson('/comfyui/validate', createJsonRequest('POST', { url, workflow }));
        setComfyUiStatus(result.valid ? '工作流校验通过！' : (result.error || '工作流校验失败'), result.valid ? 'success' : 'error');
    } catch (error) {
        setComfyUiStatus(`校验失败：${error.message}`, 'error');
    }
}

// ---------------------------------------------------------------------------
// Live ComfyUI API calls (in-game panel)
// ---------------------------------------------------------------------------

export async function refreshLiveComfyUIOptions(showStatus = true) {
    const url = document.getElementById('live-comfyui-url')?.value;
    if (!url) {
        setLiveComfyUiStatus('请先填写 ComfyUI 地址。', 'error');
        return;
    }

    if (showStatus) {
        setLiveComfyUiStatus('正在刷新实时模型列表...', 'pending');
    }

    try {
        const data = await requestJson('/comfyui/models', createJsonRequest('POST', { url }));
        const models = data.models || [];
        populateSelect('live-comfyui-model', models);
        populateSelect('live-comfyui-sampler', data.samplers || ['euler']);
        populateSelect('live-comfyui-scheduler', data.schedulers || ['normal']);

        setLiveComfyUiStatus(`已刷新模型列表，共 ${models.length} 个模型。`, 'success');
    } catch (error) {
        setLiveComfyUiStatus(`刷新失败：${error.message}`, 'error');
    }
}

export async function refreshLiveComfyWorkflowFiles(showStatus = true) {
    const url = document.getElementById('live-comfyui-url')?.value;
    if (!url) {
        setLiveComfyUiStatus('请先填写 ComfyUI 地址。', 'error');
        return;
    }

    if (showStatus) {
        setLiveComfyUiStatus('正在刷新实时工作流文件...', 'pending');
    }

    try {
        const data = await requestJson('/comfyui/workflows', createJsonRequest('POST', { url }));
        const files = data.files || data.workflows || [];
        populateSelect('live-comfyui-workflow-file', files);

        setLiveComfyUiStatus(`已刷新工作流列表，共 ${files.length} 个文件。`, 'success');
    } catch (error) {
        setLiveComfyUiStatus(`刷新工作流失败：${error.message}`, 'error');
    }
}

export async function loadSelectedLiveWorkflowFile(showStatus = true) {
    const url = document.getElementById('live-comfyui-url')?.value;
    const workflowFile = document.getElementById('live-comfyui-workflow-file')?.value;

    if (!url || !workflowFile) {
        if (showStatus) {
            setLiveComfyUiStatus('请先选择一个工作流文件。', 'error');
        }
        return;
    }

    if (showStatus) {
        setLiveComfyUiStatus('正在载入实时工作流...', 'pending');
    }

    try {
        const data = await requestJson('/comfyui/workflow/load', createJsonRequest('POST', { url, file: workflowFile }));
        const workflowJson = document.getElementById('live-comfyui-workflow-json');
        if (workflowJson && data.workflow) {
            workflowJson.value = typeof data.workflow === 'string' ? data.workflow : JSON.stringify(data.workflow, null, 2);
        }

        setLiveComfyUiStatus(`已载入实时工作流：${workflowFile}`, 'success');
    } catch (error) {
        setLiveComfyUiStatus(`载入工作流失败：${error.message}`, 'error');
    }
}

export async function testLiveComfyUIConnection() {
    const url = document.getElementById('live-comfyui-url')?.value;
    if (!url) {
        setLiveComfyUiStatus('请先填写 ComfyUI 地址。', 'error');
        return;
    }

    setLiveComfyUiStatus('正在测试 ComfyUI 连接...', 'pending');

    try {
        const result = await requestJson('/comfyui/test', createJsonRequest('POST', { url }));
        setLiveComfyUiStatus(result.success ? 'ComfyUI 连接成功！' : (result.error || '连接失败'), result.success ? 'success' : 'error');
    } catch (error) {
        setLiveComfyUiStatus(`连接失败：${error.message}`, 'error');
    }
}

export async function validateLiveComfyUIWorkflow() {
    const url = document.getElementById('live-comfyui-url')?.value;
    const workflowJson = document.getElementById('live-comfyui-workflow-json')?.value;

    if (!workflowJson) {
        setLiveComfyUiStatus('请先输入工作流 JSON。', 'error');
        return;
    }

    setLiveComfyUiStatus('正在校验实时工作流...', 'pending');

    try {
        let workflow;
        try {
            workflow = JSON.parse(workflowJson);
        } catch {
            throw new Error('工作流 JSON 格式无效。');
        }

        const result = await requestJson('/comfyui/validate', createJsonRequest('POST', { url, workflow }));
        setLiveComfyUiStatus(result.valid ? '工作流校验通过！' : (result.error || '工作流校验失败'), result.valid ? 'success' : 'error');
    } catch (error) {
        setLiveComfyUiStatus(`校验失败：${error.message}`, 'error');
    }
}

// ---------------------------------------------------------------------------
// Image settings toggle & sync
// ---------------------------------------------------------------------------

export function toggleImageSettings() {
    const source = document.getElementById('image-source').value;
    document.getElementById('comfyui-settings').style.display = source === 'comfyui' ? 'block' : 'none';
    document.getElementById('api-settings').style.display = source === 'api' ? 'block' : 'none';
    toggleComfyWorkflowMode();
}

export function syncSceneImageControls() {
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

export function syncLiveImageConfigState() {
    // Intentionally lightweight – just persist the current live config state.
    // The real sync happens via syncSceneImageControls.
}

export function setSceneImageStatus(message, tone = '') {
    const status = document.getElementById('scene-image-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.className = `helper-text ${tone}`.trim();
}

export function setSceneImageLoadingState(loading) {
    const button = document.getElementById('generate-scene-image-btn');
    if (!button) {
        return;
    }

    button.disabled = Boolean(loading);
    button.textContent = loading ? '生成中...' : '生成场景图';
}

// ---------------------------------------------------------------------------
// LLM settings toggle
// ---------------------------------------------------------------------------

export function toggleLlmSettings() {
    const source = document.getElementById('llm-source').value;
    document.querySelectorAll('.api-config').forEach((section) => {
        section.style.display = 'none';
    });

    const target = document.getElementById(`${source}-config`);
    if (target) {
        target.style.display = 'block';
    }
}

// ---------------------------------------------------------------------------
// Test LLM connection
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Init settings (wires DOM event handlers for the settings modal)
// ---------------------------------------------------------------------------

export function initSettings() {
    const settingsModal = document.getElementById('settings-modal');
    const gameMenuModal = document.getElementById('game-menu-modal');
    initializeComfyUiPanel();

    document.getElementById('settings-btn').addEventListener('click', () => {
        settingsModal.classList.add('active');
        // Dynamic import to avoid circular dependency with saved-games.js
        import('./saved-games.js').then(({ loadSettings }) => loadSettings());
    });

    settingsModal.querySelector('.modal-close').addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });

    gameMenuModal.querySelector('.modal-close').addEventListener('click', () => {
        gameMenuModal.classList.remove('active');
    });

    document.getElementById('save-settings').addEventListener('click', () => {
        // Dynamic import to avoid circular dependency with saved-games.js
        import('./saved-games.js').then(({ saveSettings }) => {
            saveSettings();
            settingsModal.classList.remove('active');
        });
    });

    document.getElementById('llm-source').addEventListener('change', toggleLlmSettings);
    document.getElementById('image-source').addEventListener('change', async () => {
        toggleImageSettings();
        // Dynamic import to avoid circular dependency with saved-games.js
        const { saveGenerationSettings } = await import('./saved-games.js');
        saveGenerationSettings();

        if (document.getElementById('image-source').value === 'comfyui') {
            await refreshComfyUIOptions(false);
        }
    });

    document.getElementById('comfyui-workflow-mode')?.addEventListener('change', () => {
        toggleComfyWorkflowMode();
        // Dynamic import to avoid circular dependency with saved-games.js
        import('./saved-games.js').then(({ saveGenerationSettings }) => saveGenerationSettings());
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

        // Dynamic import to avoid circular dependency with saved-games.js
        import('./saved-games.js').then(({ saveGenerationSettings }) => saveGenerationSettings());

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
            // Dynamic import to avoid circular dependency with saved-games.js
            import('./saved-games.js').then(({ saveGenerationSettings }) => {
                saveGenerationSettings();
                syncSceneImageControls();
            });
        });
    });

    document.getElementById('enable-images').addEventListener('change', () => {
        // Dynamic import to avoid circular dependency with saved-games.js
        import('./saved-games.js').then(({ saveGenerationSettings }) => {
            saveGenerationSettings();
            syncSceneImageControls();
        });
    });

    toggleLlmSettings();
    toggleImageSettings();
}
