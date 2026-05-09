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
    toggleLiveImageSourcePanel,
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

    document.getElementById('send-btn').addEventListener('click', () => sendPlayerAction());
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

    // Live image source selector
    document.getElementById('live-image-source')?.addEventListener('change', async () => {
        const sourceSelect = document.getElementById('live-image-source');
        const newSource = sourceSelect?.value;
        if (newSource) {
            // Update the main image-source selector too
            const mainSourceSelect = document.getElementById('image-source');
            if (mainSourceSelect) {
                mainSourceSelect.value = newSource;
            }
            // Update state
            state.currentGenerationConfig.imageSource = newSource;
            toggleLiveImageSourcePanel(newSource);
            saveGenerationSettings();
            syncSceneImageControls();

            if (newSource === 'comfyui') {
                await refreshLiveComfyUIOptions(false);
            }
        }
    });

    // Live Pollinations config fields
    document.querySelectorAll('#live-pollinations-config input, #live-pollinations-config select').forEach((element) => {
        element.addEventListener('change', () => {
            // Sync to main config page fields
            const fieldMap = {
                'live-pollinations-model': 'pollinations-model',
                'live-pollinations-width': 'pollinations-width',
                'live-pollinations-height': 'pollinations-height',
                'live-pollinations-seed': 'pollinations-seed'
            };
            const targetId = fieldMap[element.id];
            if (targetId) {
                const targetEl = document.getElementById(targetId);
                if (targetEl) targetEl.value = element.value;
            }
            saveGenerationSettings();
            syncSceneImageControls();
        });
    });

    // Live Puter config fields
    document.querySelectorAll('#live-puter-config input, #live-puter-config select').forEach((element) => {
        element.addEventListener('change', () => {
            const fieldMap = {
                'live-puter-model': 'puter-model',
                'live-puter-width': 'puter-width',
                'live-puter-height': 'puter-height'
            };
            const targetId = fieldMap[element.id];
            if (targetId) {
                const targetEl = document.getElementById(targetId);
                if (targetEl) targetEl.value = element.value;
            }
            saveGenerationSettings();
            syncSceneImageControls();
        });
    });

    // Live ZAI config fields
    document.querySelectorAll('#live-zai-config input, #live-zai-config select').forEach((element) => {
        element.addEventListener('change', () => {
            saveGenerationSettings();
            syncSceneImageControls();
        });
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

    // Scene image controls expand/collapse
    document.getElementById('scene-expand-controls-btn')?.addEventListener('click', () => {
        const panel = document.getElementById('scene-panel');
        const btn = document.getElementById('scene-expand-controls-btn');
        if (!panel || !btn) return;
        const isExpanded = panel.classList.toggle('controls-expanded');
        btn.textContent = isExpanded ? '✕ 收起设置' : '⚙️ 生图设置';
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
    // Defensive: ignore Event objects that may be passed by addEventListener
    const effectiveOverride = (typeof actionOverride === 'string') ? actionOverride : '';
    const action = effectiveOverride || input?.value.trim() || '';
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
        // Always merge live panel config so in-game source/model changes take effect
        const liveConfig = readLiveComfyUIConfig();
        const imageConfig = { ...baseConfig, ...liveConfig };

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
        // Try to extract a meaningful error message from the response body
        let errorMessage = `HTTP ${response.status}`;
        try {
            const errorBody = await response.json();
            errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch {
            // Response might not be JSON (e.g., SSE stream that errored after headers)
            try {
                const text = await response.text();
                const match = text.match(/"error"\s*:\s*"([^"]+)"/);
                if (match) errorMessage = match[1];
            } catch { /* ignore */ }
        }
        throw new Error(errorMessage);
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
                    // 流式显示旁白 - 逐步累积文本
                    if (!narratorLogElement) {
                        narratorLogElement = appendLog('narrator', '');
                    }
                    currentNarration = chunk.text;
                    narratorLogElement.textContent = currentNarration;
                    // 自动滚动到最新内容
                    const log = document.getElementById('game-log');
                    if (log) log.scrollTop = log.scrollHeight;
                } else if (chunk.type === 'error') {
                    // Server-sent error during streaming
                    appendLog('system', `AI 生成失败：${chunk.message || '未知错误'}`);
                } else if (chunk.type === 'complete') {
                    // 完成后，如果有旁白，用打字机效果重新渲染
                    if (currentNarration && narratorLogElement) {
                        // 找到旁白条目，用打字机效果重放
                        const logEntry = narratorLogElement.closest('.log-entry');
                        if (logEntry) {
                            narratorLogElement.textContent = '';
                            typewriterEffect(narratorLogElement, currentNarration);
                        }
                    }

                    // 渲染角色对话（独立气泡）
                    if (Array.isArray(chunk.gameState?.lastDialogues)) {
                        const dialogues = chunk.gameState.lastDialogues.filter(d => d?.content);
                        if (dialogues.length > 0 && currentNarration) {
                            // 有旁白+对话模式：延迟渲染对话
                            const narrationLen = currentNarration.length;
                            const baseDelay = Math.min(narrationLen * 28, 2000);
                            dialogues.forEach((dialogue, index) => {
                                setTimeout(() => {
                                    appendLog('narrator', dialogue.content, dialogue.speaker || '角色');
                                    const log = document.getElementById('game-log');
                                    if (log) log.scrollTop = log.scrollHeight;
                                }, baseDelay + index * 500);
                            });
                        } else {
                            // 没有旁白，直接渲染对话
                            dialogues.forEach((dialogue) => {
                                appendLog('narrator', dialogue.content, dialogue.speaker || '角色');
                            });
                        }
                    }

                    if (chunk.gameOver && chunk.gameOverMessage) {
                        appendLog('system', chunk.gameOverMessage);
                    }

                    showChoices(chunk.choices || []);
                    renderGameState(chunk.gameState || state.gameState);

                    // 显示骰子检定结果
                    if (chunk.diceCheck) {
                        showDiceCheckResult(chunk.diceCheck);
                    }

                    // Check achievements after action
                    if (chunk.gameState) {
                        import('./phase4.js').then(m => m.checkAchievements(chunk.gameState)).catch(() => {});
                    }

                    // Show game review on game over
                    if (chunk.gameOver) {
                        const gs = chunk.gameState || state.gameState;
                        import('./phase4.js').then(m => m.showGameReview(state.currentGameId, gs)).catch(() => {});
                    }
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

    // 用打字机效果渲染旁白
    const dialogues = Array.isArray(result.gameState?.lastDialogues)
        ? result.gameState.lastDialogues.filter(d => d?.content)
        : [];

    if (result.response) {
        renderNarrationWithDialogues(result.response, dialogues);
    } else if (dialogues.length > 0) {
        dialogues.forEach((dialogue) => {
            appendLog('narrator', dialogue.content, dialogue.speaker || '角色');
        });
    }

    if (result.gameOver && result.gameOverMessage) {
        appendLog('system', result.gameOverMessage);
    }

    // 显示骰子检定结果
    if (result.diceCheck) {
        showDiceCheckResult(result.diceCheck);
    }

    // Check achievements after action
    if (result.gameState) {
        import('./phase4.js').then(m => m.checkAchievements(result.gameState)).catch(() => {});
    }

    // Show game review on game over
    if (result.gameOver) {
        const gs = result.gameState || state.gameState;
        import('./phase4.js').then(m => m.showGameReview(state.currentGameId, gs)).catch(() => {});
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

    // 区分旁白、对话、玩家、系统等不同类型
    if (type === 'narrator' && speaker && speaker !== '旁白' && speaker !== '系统') {
        entry.className = 'log-entry dialogue';
    } else {
        entry.className = `log-entry ${type}`;
    }

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
// Dice check animation & display
// ---------------------------------------------------------------------------

/**
 * 显示骰子检定动画和结果
 */
function showDiceCheckResult(diceCheck) {
    if (!diceCheck) return;

    const log = document.getElementById('game-log');
    if (!log) return;

    const entry = document.createElement('div');
    entry.className = `log-entry dice-check ${diceCheck.success ? 'dice-success' : 'dice-failure'}`;

    // 骰子图标和结果
    const header = document.createElement('div');
    header.className = 'dice-header';

    const icon = document.createElement('span');
    icon.className = 'dice-icon';
    icon.textContent = '🎲';

    const label = document.createElement('span');
    label.className = 'dice-label';
    if (diceCheck.criticalType === 'success') {
        label.textContent = '大成功！';
        label.className += ' critical-success';
    } else if (diceCheck.criticalType === 'failure') {
        label.textContent = '大失败！';
        label.className += ' critical-failure';
    } else {
        label.textContent = diceCheck.success ? '检定成功' : '检定失败';
    }

    header.appendChild(icon);
    header.appendChild(label);
    entry.appendChild(header);

    // 检定详情
    const details = document.createElement('div');
    details.className = 'dice-details';

    const reasonEl = document.createElement('div');
    reasonEl.className = 'dice-reason';
    reasonEl.textContent = diceCheck.reason || `${diceCheck.stat}检定`;
    details.appendChild(reasonEl);

    const rollInfo = document.createElement('div');
    rollInfo.className = 'dice-roll-info';
    rollInfo.innerHTML = `
        <span class="dice-stat">${escapeHtml(diceCheck.stat)}</span>
        <span class="dice-formula">1d20(${diceCheck.roll}) ${diceCheck.modifier >= 0 ? '+' : ''}${diceCheck.modifier}</span>
        <span class="dice-total">${diceCheck.total}</span>
        <span class="dice-vs">vs</span>
        <span class="dice-difficulty">${diceCheck.difficulty}</span>
    `;
    details.appendChild(rollInfo);

    // 结果条
    const bar = document.createElement('div');
    bar.className = 'dice-bar';

    const barFill = document.createElement('div');
    barFill.className = `dice-bar-fill ${diceCheck.success ? 'success' : 'failure'}`;
    const percentage = Math.min(100, Math.max(0, (diceCheck.total / Math.max(diceCheck.difficulty, 1)) * 100));
    barFill.style.width = '0%';

    bar.appendChild(barFill);
    details.appendChild(bar);
    entry.appendChild(details);

    // 插入到日志最前面（最新消息的上面），使骰子结果紧挨着对应行动
    log.appendChild(entry);

    // 动画：延迟填充进度条
    requestAnimationFrame(() => {
        setTimeout(() => {
            barFill.style.width = `${percentage}%`;
        }, 100);
    });

    // 骰子滚动动画
    animateDiceRoll(icon, diceCheck.roll);

    log.scrollTop = log.scrollHeight;
}

/**
 * 骰子滚动动画
 */
function animateDiceRoll(iconEl, finalValue) {
    const frames = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    let count = 0;
    const maxCount = 10;
    const interval = setInterval(() => {
        iconEl.textContent = frames[count % frames.length];
        count++;
        if (count >= maxCount) {
            clearInterval(interval);
            iconEl.textContent = `🎲${finalValue}`;
        }
    }, 80);
}

// ---------------------------------------------------------------------------
// Typewriter effect for narration
// ---------------------------------------------------------------------------

/**
 * 打字机效果：逐字显示文字，营造沉浸感
 * @param {HTMLElement} element - 目标 DOM 元素
 * @param {string} text - 要显示的完整文本
 * @param {number} speed - 每个字符的显示间隔（毫秒）
 * @returns {Object} 包含 cancel() 方法，可中途取消动画
 */
function typewriterEffect(element, text, speed = 28) {
    let index = 0;
    let cancelled = false;

    // 如果文本太短或用户偏好减少动效，直接显示
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || text.length < 8) {
        element.textContent = text;
        return { cancel: () => {} };
    }

    element.textContent = '';
    element.classList.add('typing');

    function tick() {
        if (cancelled) {
            element.classList.remove('typing');
            return;
        }

        if (index < text.length) {
            // 每次添加1-3个字符，速度更自然
            const chunkSize = Math.random() < 0.3 ? 2 : 1;
            index += chunkSize;
            element.textContent = text.slice(0, index);

            // 标点处稍作停顿
            const lastChar = text[index - 1];
            const pauseChars = '。！？…—';
            const shortPauseChars = '，、；：';
            let delay = speed;
            if (pauseChars.includes(lastChar)) {
                delay = speed * 6;
            } else if (shortPauseChars.includes(lastChar)) {
                delay = speed * 3;
            }

            setTimeout(tick, delay);
        } else {
            // 打字完成，移除光标
            element.textContent = text;
            element.classList.remove('typing');
        }
    }

    // 启动动画
    requestAnimationFrame(tick);

    return {
        cancel: () => {
            cancelled = true;
            element.textContent = text;
            element.classList.remove('typing');
        }
    };
}

// ---------------------------------------------------------------------------
// Render dialogues with distinct bubble style
// ---------------------------------------------------------------------------

/**
 * 渲染对话：旁白用叙事风格，角色对话用气泡风格
 */
function renderNarrationWithDialogues(narration, dialogues = []) {
    const log = document.getElementById('game-log');
    if (!log) return;

    // 先渲染旁白（带打字机效果）
    if (narration) {
        const narrationEntry = document.createElement('div');
        narrationEntry.className = 'log-entry narrator';

        const contentEl = document.createElement('div');
        contentEl.className = 'content';
        narrationEntry.appendChild(contentEl);

        log.appendChild(narrationEntry);
        typewriterEffect(contentEl, narration);
    }

    // 延迟渲染对话，等旁白打完一部分
    if (Array.isArray(dialogues) && dialogues.length > 0) {
        const narrationLength = narration ? narration.length : 0;
        const baseDelay = Math.min(narrationLength * 28, 2000); // 最多等2秒

        dialogues.forEach((dialogue, index) => {
            if (!dialogue?.content) return;

            setTimeout(() => {
                const entry = document.createElement('div');
                entry.className = 'log-entry dialogue';

                const speakerEl = document.createElement('div');
                speakerEl.className = 'speaker';
                speakerEl.textContent = dialogue.speaker || '角色';
                entry.appendChild(speakerEl);

                const contentEl = document.createElement('div');
                contentEl.className = 'content';
                entry.appendChild(contentEl);

                log.appendChild(entry);

                // 对话用稍快的打字效果
                typewriterEffect(contentEl, dialogue.content, 22);

                log.scrollTop = log.scrollHeight;
            }, baseDelay + index * 600);
        });
    }

    log.scrollTop = log.scrollHeight;
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
            await sendPlayerAction(selected.text || selected.action || '');
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

function renderCharacterRelations(characterStates = []) {
    const list = document.getElementById('character-list');
    if (!list) return;

    if (!Array.isArray(characterStates) || !characterStates.length) {
        list.innerHTML = '<li>暂无角色</li>';
        return;
    }

    list.innerHTML = characterStates.map((char) => {
        const rel = char.relationship || 0;
        const relClass = rel > 20 ? 'ally' : (rel < -20 ? 'hostile' : 'neutral');
        const relLabel = rel > 50 ? '挚友' : (rel > 20 ? '友好' : (rel > -20 ? '中立' : (rel > -50 ? '冷淡' : '敌对')));
        const moodIcon = char.mood === '愤怒' ? '😠' : (char.mood === '悲伤' ? '😢' : (char.mood === '开心' ? '😊' : (char.mood === '恐惧' ? '😰' : '🙂')));

        return `
            <li class="character-item ${relClass}">
                <div class="character-header">
                    <span class="character-name">${moodIcon} ${escapeHtml(char.name || '未知')}</span>
                    <span class="character-rel ${relClass}">${rel >= 0 ? '+' : ''}${rel} ${relLabel}</span>
                </div>
                ${char.state ? `<span class="character-state">${escapeHtml(char.state)}</span>` : ''}
                <div class="relationship-bar">
                    <div class="relationship-bar-fill ${relClass}" style="width: ${Math.min(100, Math.max(0, 50 + rel))}%"></div>
                </div>
            </li>
        `;
    }).join('');
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

    // Puter.js 前端直接调用
    if (liveConfig.imageSource === 'puter') {
        setSceneImageStatus('正在通过 Puter.js 生成图片...', 'pending');
        try {
            const imageUrl = await generateWithPuter(prompt, liveConfig);
            if (imageUrl) {
                state.selectedSceneImageIndex = 0;
                renderSceneImages([imageUrl], prompt);
                setSceneImageStatus('Puter.js 图片生成成功！', 'success');
            } else {
                setSceneImageStatus('Puter.js 生成失败，尝试降级到 Pollinations...', 'pending');
                // 降级到后端 Pollinations
                const data = await requestJson(
                    `/games/${state.currentGameId}/generate-image`,
                    createJsonRequest('POST', { prompt, count, comfyuiImageCount: count, ...liveConfig })
                );
                state.selectedSceneImageIndex = 0;
                renderSceneImages(data.images || [], data.prompt || prompt);
                setSceneImageStatus(`降级使用 Pollinations 生成了 ${data.count || (data.images || []).length} 张图片。`, 'success');
            }
        } catch (error) {
            console.error('Puter.js generation error:', error);
            setSceneImageStatus(`Puter.js 生成失败: ${error.message}，降级到 Pollinations...`, 'pending');
            try {
                const data = await requestJson(
                    `/games/${state.currentGameId}/generate-image`,
                    createJsonRequest('POST', { prompt, count, comfyuiImageCount: count, ...liveConfig })
                );
                state.selectedSceneImageIndex = 0;
                renderSceneImages(data.images || [], data.prompt || prompt);
                setSceneImageStatus(`降级生成了 ${data.count || (data.images || []).length} 张图片。`, 'success');
            } catch (fallbackError) {
                setSceneImageStatus(fallbackError.message, 'error');
            }
        } finally {
            setSceneImageLoadingState(false);
        }
        return;
    }

    setSceneImageStatus('Generating images...', 'pending');

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

/**
 * 使用 Puter.js 前端 SDK 生成图片
 * 完全免费，无需 API Key，在浏览器端直接调用
 */
async function generateWithPuter(prompt, config = {}) {
    // 动态加载 Puter.js SDK
    if (!window.puter) {
        try {
            await loadPuterSDK();
        } catch (e) {
            console.warn('[Puter] SDK 加载失败:', e);
            return null;
        }
    }

    if (!window.puter || !window.puter.ai) {
        console.warn('[Puter] SDK 不可用');
        return null;
    }

    const model = config.puterModel || 'gpt-image-1';
    const enhancedPrompt = buildEnhancedPrompt(prompt, config);

    try {
        console.log('[Puter] Generating with model:', model, 'prompt:', enhancedPrompt.slice(0, 100));

        const result = await window.puter.ai.txt2img(enhancedPrompt, { model });

        if (!result) {
            console.warn('[Puter] 返回结果为空');
            return null;
        }

        // Puter 返回的可能是一个 URL 或者 base64 数据
        let imageData;
        if (typeof result === 'string') {
            imageData = result;
        } else if (result.url) {
            imageData = result.url;
        } else if (result.src) {
            imageData = result.src;
        } else if (result.data) {
            imageData = result.data;
        } else if (result.image) {
            imageData = result.image;
        }

        if (!imageData) {
            console.warn('[Puter] 无法解析返回结果:', result);
            return null;
        }

        // 如果是 URL，需要下载并上传到后端
        if (imageData.startsWith('http')) {
            const uploadedUrl = await uploadImageToBackend(imageData);
            return uploadedUrl;
        }

        // 如果是 base64，直接上传
        if (imageData.startsWith('data:')) {
            const uploadedUrl = await uploadBase64ToBackend(imageData);
            return uploadedUrl;
        }

        // 尝试作为 base64 上传
        const uploadedUrl = await uploadBase64ToBackend(imageData);
        return uploadedUrl;
    } catch (error) {
        console.error('[Puter] Generation error:', error);
        return null;
    }
}

/**
 * 动态加载 Puter.js SDK
 */
function loadPuterSDK() {
    return new Promise((resolve, reject) => {
        if (window.puter) {
            resolve();
            return;
        }

        const existingScript = document.querySelector('script[src*="puter.com"]');
        if (existingScript) {
            existingScript.addEventListener('load', resolve);
            existingScript.addEventListener('error', reject);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://js.puter.com/v2/';
        script.async = true;
        script.addEventListener('load', () => {
            console.log('[Puter] SDK loaded successfully');
            resolve();
        });
        script.addEventListener('error', () => {
            reject(new Error('Puter.js SDK 加载失败'));
        });
        document.head.appendChild(script);
    });
}

/**
 * 构建增强的生图提示词
 */
function buildEnhancedPrompt(rawPrompt, config = {}) {
    const parts = [];
    const style = config.artStyle || 'fantasy';
    const styleMap = {
        fantasy: 'fantasy RPG game art, magical atmosphere, rich colors, detailed illustration',
        scifi: 'sci-fi RPG game art, futuristic atmosphere, neon lights, cinematic',
        mystery: 'dark noir RPG game art, moody lighting, mysterious atmosphere, shadows',
        cultivation: 'Chinese ink wash painting style, xianxia RPG, ethereal mountains, flowing robes',
        romance: 'soft romantic RPG art, warm lighting, beautiful characters, pastel colors',
        survival: 'harsh survival RPG art, desolate landscape, dramatic lighting, gritty',
        kingdom: 'medieval RPG art, castle architecture, heraldic banners, epic scale',
        dungeon: 'dark dungeon RPG art, torchlight, stone corridors, ominous shadows',
        adventure: 'adventure RPG art, lush landscapes, heroic composition, vibrant',
        custom: 'RPG game scene illustration, detailed, atmospheric, dramatic lighting'
    };
    parts.push(styleMap[style] || styleMap.custom);
    if (rawPrompt) parts.push(rawPrompt);
    parts.push('high quality, detailed, 4K');
    return parts.filter(Boolean).join(', ');
}

/**
 * 上传 URL 图片到后端
 */
async function uploadImageToBackend(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append('image', blob, `puter_${Date.now()}.png`);

    const uploadResponse = await requestJson(
        '/upload-scene-image',
        { method: 'POST', body: formData }
    );
    return uploadResponse.url;
}

/**
 * 上传 base64 图片到后端
 */
async function uploadBase64ToBackend(base64Data) {
    const response = await requestJson(
        '/upload-scene-image',
        createJsonRequest('POST', { base64: base64Data })
    );
    return response.url;
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
// Atmosphere overlay system
// ---------------------------------------------------------------------------

/**
 * 根据游戏状态更新氛围滤镜
 * 天气、时间、情绪 → CSS 叠加层
 */
function updateAtmosphere(gameState) {
    const overlay = document.getElementById('atmosphere-overlay');
    if (!overlay) return;

    const visualState = gameState.visualState || {};
    const timeOfDay = visualState.timeOfDay || '';
    const weather = visualState.weather || '';
    const mood = visualState.mood || gameState.player?.emotion || '';

    // 清除所有氛围 class
    overlay.className = 'atmosphere-overlay';

    // 根据时间添加氛围
    const timeClassMap = {
        '夜晚': 'night',
        '深夜': 'night',
        '黄昏': 'dusk',
        '傍晚': 'dusk',
        '黎明': 'dusk'
    };
    if (timeClassMap[timeOfDay]) {
        overlay.classList.add(timeClassMap[timeOfDay]);
    }

    // 根据天气添加氛围
    const weatherClassMap = {
        '雨天': 'rain',
        '小雨': 'rain',
        '大雨': 'rain',
        '暴风雨': 'storm',
        '雷暴': 'storm',
        '雪天': 'snow',
        '大雪': 'snow',
        '小雪': 'snow',
        '雾天': 'fog',
        '大雾': 'fog',
        '浓雾': 'fog'
    };
    if (weatherClassMap[weather]) {
        overlay.classList.add(weatherClassMap[weather]);
    }

    // 根据情绪添加氛围
    const moodClassMap = {
        '紧张': 'tense',
        '恐惧': 'horror',
        '害怕': 'horror',
        '惊恐': 'horror',
        '愤怒': 'tense'
    };
    if (moodClassMap[mood]) {
        overlay.classList.add(moodClassMap[mood]);
    }

    // 如果有任何氛围 class，激活叠加层
    if (overlay.classList.length > 1) {
        overlay.classList.add('active');
    }
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

    // 同步场景描述到左侧场景描述面板
    const storyCopy = document.getElementById('scene-story-copy');
    if (storyCopy) {
        storyCopy.textContent = gameState.sceneDescription || '';
    }

    const log = document.getElementById('game-log');
    if (gameState.initialLog && !log.children.length) {
        // 开场旁白用打字机效果
        const narrationEntry = document.createElement('div');
        narrationEntry.className = 'log-entry narrator';
        const contentEl = document.createElement('div');
        contentEl.className = 'content';
        narrationEntry.appendChild(contentEl);
        log.appendChild(narrationEntry);
        typewriterEffect(contentEl, gameState.initialLog);
    }

    renderStats(gameState.player?.stats || {});
    renderInventory(gameState.inventory || []);
    renderQuests(gameState.quests || []);
    renderCharacterRelations(gameState.characterStates || []);
    syncSceneImageControls();
    scheduleRuntimeSnapshotPersist();

    // 更新氛围滤镜
    updateAtmosphere(gameState);

    // Start auto-save timer when in game
    startAutoSaveTimer();
}
