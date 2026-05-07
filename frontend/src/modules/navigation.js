/**
 * Screen navigation and progress helpers.
 */

import { state, gameTypeNames } from './state.js';
import { getGameWebSocket } from '../services/websocket.js';

export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
}

export function showHomeScreen() {
    showScreen('home-screen');
    document.getElementById('game-types-section').style.display = 'block';
    document.getElementById('examples-section').style.display = 'none';
}

export function setApiStatus(status, text) {
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

export function updateProgress(progress, message, details = '') {
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

export function initNavigation() {
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
        // Dynamic import to avoid circular dependency
        const { startImportedProjectSession } = await import('./import.js');
        await startImportedProjectSession();
    });
    document.getElementById('gen-back-to-config').addEventListener('click', () => {
        showScreen(state.currentProjectId ? 'import-screen' : 'config-screen');
    });

    document.getElementById('exit-game').addEventListener('click', () => {
        if (confirm('确定退出当前游戏吗？未保存进度将会丢失。')) {
            // Stop auto-save timer via dynamic import to avoid circular dependency
            import('./game.js').then((gameModule) => {
                if (gameModule.stopAutoSaveTimer) gameModule.stopAutoSaveTimer();
            }).catch(() => {});
            // Disconnect WebSocket when exiting game
            const ws = getGameWebSocket();
            ws.clearCallbacks();
            ws.disconnect();
            state.currentGameId = null;
            state.gameState = null;
            showHomeScreen();
        }
    });
}
