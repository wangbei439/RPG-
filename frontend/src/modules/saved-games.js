/**
 * Save / load game management and settings persistence.
 */

import { requestJson, createJsonRequest } from '../services/api.js';
import { applyGenerationConfig, applyLlmSettings, collectGenerationConfig, collectLlmSettings } from '../services/settings.js';
import { state, LLM_SETTINGS_KEY, GENERATION_SETTINGS_KEY, gameTypeNames } from './state.js';
import { normalizeGenerationConfig, escapeHtml, getEffectiveGenerationConfig } from './utils.js';
import { showScreen, setApiStatus } from './navigation.js';
import {
    toggleLlmSettings,
    toggleImageSettings,
    syncSceneImageControls,
    setComfyUiStatus,
    refreshComfyUIOptions,
    refreshComfyWorkflowFiles,
    loadSelectedComfyWorkflowFile
} from './comfyui.js';

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

export function saveSettings() {
    const llmSettings = collectLlmSettings();
    localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(llmSettings));

    // Also persist LLM settings to the backend DB so GameEngine can load them as fallback
    persistLlmSettingsToBackend(llmSettings).catch((err) => {
        console.warn('Failed to persist LLM settings to backend:', err.message);
    });

    saveGenerationSettings();
}

/**
 * Save LLM settings to the backend settings DB for server-side fallback.
 * This ensures GameEngine can initialize even when the frontend doesn't send settings.
 */
async function persistLlmSettingsToBackend(settings) {
    if (!settings || !settings.llmSource) return;

    const mapping = {
        llm_source: settings.llmSource,
    };

    if (settings.llmSource === 'openai') {
        mapping.openai_url = settings.apiUrl || '';
        mapping.openai_api_key = settings.apiKey || '';
        mapping.openai_model = settings.model || '';
    } else if (settings.llmSource === 'anthropic') {
        mapping.anthropic_api_key = settings.apiKey || '';
        mapping.anthropic_model = settings.model || '';
    } else if (settings.llmSource === 'local') {
        mapping.ollama_url = settings.apiUrl || '';
        mapping.ollama_model = settings.model || '';
    } else if (settings.llmSource === 'custom') {
        mapping.custom_url = settings.apiUrl || '';
        mapping.custom_api_key = settings.apiKey || '';
        mapping.custom_model = settings.model || '';
    }

    await requestJson('/settings/batch', createJsonRequest('POST', mapping));
}

export function loadSettings() {
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

export function saveGenerationSettings() {
    const config = normalizeGenerationConfig(collectGenerationConfig());
    state.currentGenerationConfig = config;
    localStorage.setItem(GENERATION_SETTINGS_KEY, JSON.stringify(config));
}

// ---------------------------------------------------------------------------
// Saved games
// ---------------------------------------------------------------------------

export function buildSavedGameRecord(gameId, gameState, extras = {}) {
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

export function readSavedGameRecord(storageKey) {
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

export function getSavedGames() {
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

// ---------------------------------------------------------------------------
// Batch-select mode state
// ---------------------------------------------------------------------------

let selectMode = false;
const selectedSaves = new Set();

function exitSelectMode() {
    selectMode = false;
    selectedSaves.clear();
    updateSelectModeUI();
    renderSavedGamesList();
}

function updateSelectModeUI() {
    const toggleBtn = document.getElementById('toggle-select-mode-btn');
    const selectAllBtn = document.getElementById('select-all-saves-btn');
    const batchDeleteBtn = document.getElementById('batch-delete-saves-btn');

    if (toggleBtn) toggleBtn.textContent = selectMode ? '退出管理' : '批量管理';
    if (selectAllBtn) selectAllBtn.style.display = selectMode ? '' : 'none';
    if (batchDeleteBtn) batchDeleteBtn.style.display = selectMode ? '' : 'none';

    // Update select-all button text based on current state
    if (selectAllBtn) {
        const savedGames = getSavedGames();
        const allSelected = savedGames.length > 0 && savedGames.every(r => selectedSaves.has(r.gameId));
        selectAllBtn.textContent = allSelected ? '取消全选' : '全选';
    }

    // Update batch delete button with count
    if (batchDeleteBtn) {
        batchDeleteBtn.textContent = selectedSaves.size > 0
            ? `🗑️ 删除选中 (${selectedSaves.size})`
            : '🗑️ 删除选中';
        batchDeleteBtn.disabled = selectedSaves.size === 0;
    }
}

export function renderSavedGamesList() {
    const container = document.getElementById('saved-games-list');
    if (!container) {
        return;
    }

    const savedGames = getSavedGames();
    if (!savedGames.length) {
        container.innerHTML = '<p class="empty-hint">暂无存档</p>';
        return;
    }

    container.innerHTML = savedGames.map((record) => {
        const isSelected = selectedSaves.has(record.gameId);
        return `
        <div class="saved-game-card${selectMode ? ' select-mode' : ''}${isSelected ? ' selected' : ''}" data-saved-game-id="${escapeHtml(record.gameId)}">
            ${selectMode ? `<input type="checkbox" class="saved-game-checkbox" ${isSelected ? 'checked' : ''} />` : ''}
            <div class="saved-game-body">
                <div class="saved-game-header">
                    <span class="saved-game-name">${escapeHtml(record.title || '未命名存档')}</span>
                    <span class="saved-game-type">${escapeHtml(gameTypeNames[record.type] || record.type || '存档')}</span>
                </div>
                <div class="saved-game-info">ID: ${escapeHtml(record.gameId)}</div>
                <div class="saved-game-time">${escapeHtml(record.savedAt ? new Date(record.savedAt).toLocaleString() : '旧版存档')}</div>
            </div>
            ${!selectMode ? `<button type="button" class="saved-game-delete-btn" data-delete-id="${escapeHtml(record.gameId)}" title="删除此存档">✕</button>` : ''}
        </div>
    `}).join('');

    // Bind click events
    container.querySelectorAll('[data-saved-game-id]').forEach((card) => {
        card.addEventListener('click', async (e) => {
            const gameId = card.dataset.savedGameId;

            // If in select mode, toggle selection
            if (selectMode) {
                if (selectedSaves.has(gameId)) {
                    selectedSaves.delete(gameId);
                } else {
                    selectedSaves.add(gameId);
                }
                updateSelectModeUI();
                renderSavedGamesList();
                return;
            }

            // Normal mode: load game
            await loadSavedGame(gameId);
        });
    });

    // Bind single delete buttons (only in normal mode)
    container.querySelectorAll('[data-delete-id]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const gameId = btn.dataset.deleteId;
            if (confirm(`确定要删除存档「${gameId}」吗？`)) {
                deleteSavedGame(gameId);
                renderSavedGamesList();
            }
        });
    });
}

function deleteSavedGame(gameId) {
    localStorage.removeItem(`rpg_save_${gameId}`);
    selectedSaves.delete(gameId);
}

async function batchDeleteSelected() {
    if (selectedSaves.size === 0) return;
    const count = selectedSaves.size;
    if (!confirm(`确定要删除选中的 ${count} 个存档吗？此操作不可撤销。`)) return;

    for (const gameId of selectedSaves) {
        deleteSavedGame(gameId);
    }
    selectedSaves.clear();
    updateSelectModeUI();
    renderSavedGamesList();
}

export async function loadSavedGame(gameId) {
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

    // Dynamic import to avoid circular dependency with game.js
    const gameModule = await import('./game.js');

    showScreen('game-screen');
    gameModule.renderGameState(record.gameState);
    gameModule.renderSceneImages([]);

    if (!backendReady) {
        alert('这个存档已载入画面，但后端运行态未成功恢复。请重新开始后再保存一次，之后即可正常续玩。');
    }

    const savedGamesSection = document.getElementById('saved-games-section');
    if (savedGamesSection) {
        savedGamesSection.style.display = 'none';
    }
}

export function initSavedGames() {
    const loadSavedGamesButton = document.getElementById('load-saved-games-btn');
    const closeSavedGamesButton = document.getElementById('close-saved-games');
    const toggleSelectModeBtn = document.getElementById('toggle-select-mode-btn');
    const selectAllBtn = document.getElementById('select-all-saves-btn');
    const batchDeleteBtn = document.getElementById('batch-delete-saves-btn');

    loadSavedGamesButton?.addEventListener('click', () => {
        selectMode = false;
        selectedSaves.clear();
        updateSelectModeUI();
        renderSavedGamesList();
        const section = document.getElementById('saved-games-section');
        if (section) {
            section.style.display = 'block';
        }
    });

    closeSavedGamesButton?.addEventListener('click', () => {
        exitSelectMode();
        const section = document.getElementById('saved-games-section');
        if (section) {
            section.style.display = 'none';
        }
    });

    toggleSelectModeBtn?.addEventListener('click', () => {
        if (selectMode) {
            exitSelectMode();
        } else {
            selectMode = true;
            selectedSaves.clear();
            updateSelectModeUI();
            renderSavedGamesList();
        }
    });

    selectAllBtn?.addEventListener('click', () => {
        const savedGames = getSavedGames();
        const allSelected = savedGames.length > 0 && savedGames.every(r => selectedSaves.has(r.gameId));
        if (allSelected) {
            selectedSaves.clear();
        } else {
            for (const record of savedGames) {
                selectedSaves.add(record.gameId);
            }
        }
        updateSelectModeUI();
        renderSavedGamesList();
    });

    batchDeleteBtn?.addEventListener('click', () => {
        batchDeleteSelected();
    });
}
