/**
 * Game screen logic – rendering, player actions, scene images, save/load.
 */

import { requestJson, createJsonRequest } from '../services/api.js';
import { collectGenerationConfig, collectLlmSettings } from '../services/settings.js';
import { getGameWebSocket } from '../services/websocket.js';
import { state, API_BASE, GENERATION_SETTINGS_KEY } from './state.js';
import { escapeHtml, escapeAttribute, normalizeGenerationConfig, getEffectiveGenerationConfig } from './utils.js';
import { showScreen } from './navigation.js';
import { saveGenerationSettings, buildSavedGameRecord, readSavedGameRecord, loadSavedGame } from './saved-games.js';
import { showToast } from '../services/toast.js';
import {
    initializeLiveImageConfigPanel,
    toggleLiveWorkflowMode,
    syncSceneImageControls,
    syncLiveImageConfigState,
    readLiveComfyUIConfig,
    setSceneImageStatus,
    setSceneImageLoadingState,
    refreshLiveComfyUIOptions,
    refreshLiveComfyWorkflowFiles,
    loadSelectedLiveWorkflowFile,
    testLiveComfyUIConnection,
    validateLiveComfyUIWorkflow
} from './comfyui.js';

// ---------------------------------------------------------------------------
// Auto-save constants & helpers
// ---------------------------------------------------------------------------

const AUTOSAVE_KEY = 'rpg_autosave_enabled';
const AUTOSAVE_INTERVAL_MS = 60_000; // 60 seconds
let autoSaveTimerId = null;

function isAutoSaveEnabled() {
    const stored = localStorage.getItem(AUTOSAVE_KEY);
    return stored !== 'false'; // enabled by default
}

function setAutoSaveEnabled(enabled) {
    localStorage.setItem(AUTOSAVE_KEY, String(enabled));
    if (enabled) {
        startAutoSaveTimer();
    } else {
        stopAutoSaveTimer();
    }
}

function startAutoSaveTimer() {
    stopAutoSaveTimer();
    if (!isAutoSaveEnabled() || !state.currentGameId || !state.gameState) {
        return;
    }
    autoSaveTimerId = window.setInterval(async () => {
        if (!state.currentGameId || !state.gameState) {
            stopAutoSaveTimer();
            return;
        }
        await performAutoSave();
    }, AUTOSAVE_INTERVAL_MS);
}

function stopAutoSaveTimer() {
    if (autoSaveTimerId !== null) {
        window.clearInterval(autoSaveTimerId);
        autoSaveTimerId = null;
    }
}

export { stopAutoSaveTimer };

async function performAutoSave() {
    if (!state.currentGameId || !state.gameState) return;

    const indicator = document.getElementById('autosave-indicator');
    const textEl = document.getElementById('autosave-text');

    // Show saving state
    if (indicator) {
        indicator.classList.add('visible', 'saving');
        indicator.classList.remove('saved');
    }
    if (textEl) {
        textEl.textContent = '正在自动保存...';
    }

    try {
        let snapshot = null;
        try {
            snapshot = await requestJson(`/games/${state.currentGameId}`);
        } catch (_e) {
            // Fallback to local state
        }

        const record = buildSavedGameRecord(
            state.currentGameId,
            snapshot?.state || state.gameState,
            {
                gameData: snapshot?.game || state.currentGameData,
                generationConfig: getEffectiveGenerationConfig(),
                type: state.currentGameType || snapshot?.game?.type || state.gameState?.type || 'custom'
            }
        );

        if (snapshot?.game) {
            state.currentGameData = snapshot.game;
        }

        localStorage.setItem(`rpg_save_${state.currentGameId}`, JSON.stringify(record));

        // Show saved state
        if (indicator) {
            indicator.classList.remove('saving');
            indicator.classList.add('saved');
        }
        if (textEl) {
            const now = new Date();
            textEl.textContent = `已自动保存 ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        }

        // Fade out after 3s
        setTimeout(() => {
            if (indicator) {
                indicator.classList.remove('visible');
            }
        }, 3000);
    } catch (error) {
        console.warn('Auto-save failed:', error);
        if (indicator) {
            indicator.classList.remove('saving', 'visible');
        }
    }
}

// ---------------------------------------------------------------------------
// Init game screen
// ---------------------------------------------------------------------------

export function initGameScreen() {
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
        const saveBtn = document.getElementById('save-game');
        if (state.gameState && state.currentGameId) {
            if (saveBtn) saveBtn.classList.add('btn-loading');
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
                showToast('游戏进度已保存', 'success');
            } catch (error) {
                console.error('Save game error:', error);
                const fallbackRecord = buildSavedGameRecord(state.currentGameId, state.gameState, {
                    generationConfig: getEffectiveGenerationConfig()
                });
                localStorage.setItem(`rpg_save_${state.currentGameId}`, JSON.stringify(fallbackRecord));
                showToast('游戏进度已保存（未获取完整快照）', 'warning');
            } finally {
                if (saveBtn) saveBtn.classList.remove('btn-loading');
            }
        } else {
            showToast('没有可保存的游戏状态', 'warning');
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
            showToast('存档已加载', 'success');
        } else {
            showToast('没有找到存档', 'error');
        }
        document.getElementById('game-menu-modal').classList.remove('active');
    });

    document.getElementById('restart-game').addEventListener('click', async () => {
        if (state.currentGameId) {
            await startGame(state.currentGameId);
        }
        document.getElementById('game-menu-modal').classList.remove('active');
    });

    // Auto-save toggle
    const autosaveToggle = document.getElementById('autosave-toggle');
    const autosaveSwitch = document.getElementById('autosave-toggle-switch');
    if (autosaveToggle && autosaveSwitch) {
        // Initialize switch state
        if (isAutoSaveEnabled()) {
            autosaveSwitch.classList.add('active');
        } else {
            autosaveSwitch.classList.remove('active');
        }

        autosaveToggle.addEventListener('click', () => {
            const newState = !isAutoSaveEnabled();
            setAutoSaveEnabled(newState);
            autosaveSwitch.classList.toggle('active', newState);
            showToast(newState ? '自动保存已开启' : '自动保存已关闭', 'info');
        });
    }

    // Mobile status FAB
    document.getElementById('mobile-status-fab')?.addEventListener('click', () => {
        const overlay = document.getElementById('mobile-status-overlay');
        if (overlay) {
            // Sync stats to mobile overlay
            syncMobileStatusPanel();
            overlay.classList.add('active');
        }
    });

    document.getElementById('mobile-status-close')?.addEventListener('click', () => {
        document.getElementById('mobile-status-overlay')?.classList.remove('active');
    });

    document.getElementById('mobile-status-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'mobile-status-overlay') {
            e.target.classList.remove('active');
        }
    });

    // Mobile bottom nav
    document.getElementById('mobile-nav-home')?.addEventListener('click', async () => {
        document.getElementById('game-menu-modal')?.classList.remove('active');
        document.getElementById('mobile-status-overlay')?.classList.remove('active');
        if (state.currentGameId && state.gameState) {
            if (confirm('确定退出当前游戏吗？未保存进度将会丢失。')) {
                stopAutoSaveTimer();
                disconnectGameWebSocket();
                state.currentGameId = null;
                state.gameState = null;
                // Dynamic import for ES module compatibility
                const navModule = await import('./navigation.js');
                if (navModule.showHomeScreen) navModule.showHomeScreen();
            }
        }
    });

    document.getElementById('mobile-nav-settings')?.addEventListener('click', () => {
        document.getElementById('game-menu-modal')?.classList.add('active');
    });

    document.getElementById('mobile-nav-save')?.addEventListener('click', async () => {
        if (state.gameState && state.currentGameId) {
            await performAutoSave();
            showToast('游戏已保存', 'success');
        }
    });

    // Scene panel toggle (mobile collapsible)
    document.getElementById('scene-toggle-btn')?.addEventListener('click', () => {
        const panel = document.getElementById('scene-panel');
        const btn = document.getElementById('scene-toggle-btn');
        if (!panel || !btn) return;
        const isCollapsed = panel.classList.toggle('collapsed');
        btn.textContent = isCollapsed ? '▶ 展开场景图' : '▼ 收起场景图';
    });

    // Swipe back gesture support
    initSwipeBack();

    syncSceneImageControls();
}

// ---------------------------------------------------------------------------
// Mobile status panel sync
// ---------------------------------------------------------------------------

function syncMobileStatusPanel() {
    const gs = state.gameState;
    if (!gs) return;

    // Stats
    const mobileStats = document.getElementById('mobile-player-stats');
    const desktopStats = document.getElementById('player-stats');
    if (mobileStats && desktopStats) {
        mobileStats.innerHTML = desktopStats.innerHTML;
    }

    // Inventory
    const mobileInventoryList = document.getElementById('mobile-inventory-list');
    const desktopInventoryList = document.getElementById('inventory-list');
    if (mobileInventoryList && desktopInventoryList) {
        mobileInventoryList.innerHTML = desktopInventoryList.innerHTML;
    }

    // Quests
    const mobileQuestList = document.getElementById('mobile-quest-list');
    const desktopQuestList = document.getElementById('quest-list');
    if (mobileQuestList && desktopQuestList) {
        mobileQuestList.innerHTML = desktopQuestList.innerHTML;
    }
}

// ---------------------------------------------------------------------------
// Swipe back gesture
// ---------------------------------------------------------------------------

function initSwipeBack() {
    const zone = document.getElementById('swipe-back-zone');
    if (!zone) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    zone.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
    }, { passive: true });

    zone.addEventListener('touchmove', (e) => {
        if (!tracking) return;
        const touch = e.touches[0];
        const dx = touch.clientX - startX;
        const dy = Math.abs(touch.clientY - startY);
        // If horizontal movement is dominant and moving right
        if (dx > 80 && dy < 40) {
            tracking = false;
            // Navigate back
            const exitBtn = document.getElementById('exit-game');
            if (exitBtn) exitBtn.click();
        }
    }, { passive: true });

    zone.addEventListener('touchend', () => {
        tracking = false;
    }, { passive: true });
}

// ---------------------------------------------------------------------------
// WebSocket integration
// ---------------------------------------------------------------------------

function connectGameWebSocket(gameId) {
    const ws = getGameWebSocket();
    ws.clearCallbacks();
    ws.onImageReady((imageData) => {
        if (imageData?.imageUrl) {
            renderSceneImages([imageData.imageUrl], imageData.prompt || state.lastSuggestedImagePrompt);
            setSceneImageStatus('场景图已自动更新。', 'success');
        }
    });
    ws.onGameUpdate((updateData) => {
        // Future: handle real-time game state updates
        console.log('[Game] Received game update:', updateData);
    });
    ws.connect();
    ws.subscribe(gameId);
}

function disconnectGameWebSocket() {
    const ws = getGameWebSocket();
    ws.clearCallbacks();
    ws.disconnect();
}

// ---------------------------------------------------------------------------
// Start / restart game
// ---------------------------------------------------------------------------

export async function startGame(gameId = state.currentGameId) {
    if (!gameId) {
        return;
    }

    try {
        const data = await requestJson(`/games/${gameId}/start`, createJsonRequest('POST', {
            settings: collectLlmSettings()
        }));
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
        connectGameWebSocket(gameId);
    } catch (error) {
        alert(`启动游戏失败：${error.message}`);
    }
}

// ---------------------------------------------------------------------------
// Player action
// ---------------------------------------------------------------------------

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
        sendButton.classList.add('btn-loading');
    }
    appendLog('player', action, '你');
    appendToMobileLog('player', action, '你');

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
            sendButton.classList.remove('btn-loading');
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
            streaming: true,
            settings: collectLlmSettings()
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
            imageConfig,
            settings: collectLlmSettings()
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

// ---------------------------------------------------------------------------
// Game log & choices
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mobile game log
// ---------------------------------------------------------------------------

function appendToMobileLog(type, content, speaker = '') {
    const mobileLog = document.getElementById('mobile-game-log');
    if (!mobileLog) return;

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

    mobileLog.appendChild(entry);
    mobileLog.scrollTop = mobileLog.scrollHeight;

    // Keep only last 4 entries on mobile
    while (mobileLog.children.length > 4) {
        mobileLog.removeChild(mobileLog.firstChild);
    }
}

export function showChoices(choices = []) {
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

// ---------------------------------------------------------------------------
// Stats, inventory, quests rendering
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scene image generation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Scene image rendering
// ---------------------------------------------------------------------------

export function renderSceneImages(images = [], prompt = '') {
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
                        <img src="${escapeAttribute(image)}" alt="场景候选图 ${index + 1}" />
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
                <img src="${escapeAttribute(nextImage)}" alt="场景图" />
            </div>
        `;
        return;
    }

    if (state.activeSceneImage === nextImage) {
        imageContainer.innerHTML = `
            <div class="scene-image-layer is-active">
                <img src="${escapeAttribute(nextImage)}" alt="场景图" />
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
                <img src="${escapeAttribute(state.activeSceneImage)}" alt="当前场景图" />
            </div>
            <div class="scene-image-layer scene-image-layer-front">
                <img src="${escapeAttribute(nextImage)}" alt="下一场景图" />
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
                    <img src="${escapeAttribute(nextImage)}" alt="场景图" />
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
                <img src="${escapeAttribute(nextImage)}" alt="场景图" />
            </div>
        `;
    };

    preloadImage.src = nextImage;
}

// ---------------------------------------------------------------------------
// Runtime snapshot
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Render game state
// ---------------------------------------------------------------------------

export function renderGameState(gameState = state.gameState) {
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

    // Start auto-save timer when in game
    startAutoSaveTimer();
}
