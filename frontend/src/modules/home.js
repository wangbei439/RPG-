/**
 * Home screen logic – hero section, examples, and quick-start.
 */

import { requestJson } from '../services/api.js';
import { collectLlmSettings } from '../services/settings.js';
import { state, gameTypeNames } from './state.js';
import { showScreen, updateProgress } from './navigation.js';
import { escapeHtml } from './utils.js';

export function initHeroSection() {
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
    document.getElementById('import-novel-btn')?.addEventListener('click', async () => {
        const { setImportStatus } = await import('./import.js');
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

export async function loadAndRenderExamples() {
    const grid = document.getElementById('examples-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="loading">加载示例游戏中...</div>';

    try {
        const examples = await requestJson(`/api/examples`);

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

export function renderExamples(examples) {
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

export async function startExampleGame(exampleId) {
    try {
        const settings = collectLlmSettings();

        // 显示加载状态
        showScreen('loading-screen');
        updateProgress(10, '正在启动示例游戏...', '');

        const response = await requestJson(`/api/examples/${exampleId}/start`, {
            method: 'POST',
            body: JSON.stringify({ settings })
        });

        updateProgress(100, '启动完成！', '');

        state.currentGameId = response.gameId;
        state.gameState = response.gameState;

        // Dynamic import to avoid circular dependency with game.js
        const { renderGameState } = await import('./game.js');

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
