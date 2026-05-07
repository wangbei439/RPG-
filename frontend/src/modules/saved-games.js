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
    localStorage.setItem(LLM_SETTINGS_KEY, JSON.stringify(collectLlmSettings()));
    saveGenerationSettings();
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
