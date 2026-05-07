/**
 * Game config form – initializes generation sessions and enters the workbench.
 */

import { requestJson, createJsonRequest } from '../services/api.js';
import { collectGenerationConfig } from '../services/settings.js';
import { state } from './state.js';
import { normalizeGenerationConfig, getEffectiveGenerationConfig } from './utils.js';
import { showScreen, setApiStatus } from './navigation.js';
import { saveGenerationSettings } from './saved-games.js';
import { showToast } from '../services/toast.js';

export function initConfigForm() {
    document.getElementById('game-config-form').addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!state.currentGameType) {
            showToast('请先选择一个游戏类型', 'warning');
            showScreen('home-screen');
            return;
        }

        const submitBtn = event.target.querySelector('.generate-btn');
        if (submitBtn) submitBtn.classList.add('btn-loading');

        try {
            await initGenerationSession();
        } finally {
            if (submitBtn) submitBtn.classList.remove('btn-loading');
        }
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
        state.currentProjectId = null;
        state.currentProjectData = null;
        await beginGenerationWorkbench(data);
        return;
    } catch (error) {
        console.error('Session init error:', error);
        showToast(`初始化失败：${error.message}`, 'error');
        showScreen('config-screen');
    }
}

export async function beginGenerationWorkbench(data) {
    state.currentSessionId = data.sessionId;
    state.allSteps = data.steps || [];
    state.currentStepId = data.firstStep || state.allSteps[0]?.id || null;
    state.stepStates = {};

    // Dynamic import to avoid circular dependency with workbench.js
    const workbench = await import('./workbench.js');

    showScreen('generation-workbench');
    workbench.renderStepNavigation();
    await workbench.renderConfirmedElements();
    workbench.renderCurrentStep(state.currentStepId);
    workbench.renderHistoryPanel();
    setApiStatus('idle', '已创建生成会话，点击"生成"开始当前步骤。');
}

export { initGenerationSession };
