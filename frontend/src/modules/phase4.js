/**
 * Phase 4 – Achievement System, Game Review, Share, and Templates.
 *
 * All UI logic for the fourth phase of the 叙游工坊 RPG Generator.
 */

import { requestJson, createJsonRequest } from '../services/api.js';
import { state, gameTypeNames } from './state.js';
import { escapeHtml } from './utils.js';
import { showToast } from '../services/toast.js';

// ---------------------------------------------------------------------------
// Rarity display helpers
// ---------------------------------------------------------------------------

const RARITY_MAP = {
    common: { label: '普通', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    uncommon: { label: '稀有', color: '#4ade80', bg: 'rgba(74,222,128,0.15)' },
    rare: { label: '珍贵', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    epic: { label: '史诗', color: '#c084fc', bg: 'rgba(192,132,252,0.15)' }
};

function getRarityInfo(rarity) {
    return RARITY_MAP[rarity] || RARITY_MAP.common;
}

// ---------------------------------------------------------------------------
// Achievement System
// ---------------------------------------------------------------------------

/** Throttle achievement checks to avoid hammering the API on every chunk. */
let achievementCheckTimer = null;
const ACHIEVEMENT_CHECK_DEBOUNCE_MS = 3000;

/**
 * Initialise achievement panel event listeners.
 */
export function initAchievements() {
    const showBtn = document.getElementById('show-achievements');
    if (showBtn) {
        showBtn.addEventListener('click', () => {
            document.getElementById('game-menu-modal')?.classList.remove('active');
            showAchievementPanel();
        });
    }
}

/**
 * Open the achievement panel modal and fetch achievements from the API.
 */
export async function showAchievementPanel() {
    const modal = document.getElementById('achievement-modal');
    if (!modal) return;

    modal.classList.add('active');

    const listEl = document.getElementById('achievement-list');
    const countEl = document.getElementById('achievement-count');

    if (listEl) {
        listEl.innerHTML = '<div class="achievement-loading"><div class="loading-spinner" style="width:32px;height:32px;border-width:3px;"></div><p>加载成就中...</p></div>';
    }

    try {
        const data = await requestJson(`/achievements?gameId=${state.currentGameId || ''}`);
        const achievements = data.achievements || [];
        const unlocked = achievements.filter(a => a.unlocked).length;
        const total = achievements.length;

        if (countEl) {
            countEl.textContent = `${unlocked}/${total} 已解锁`;
        }

        renderAchievementList(achievements);
    } catch (err) {
        console.warn('加载成就失败:', err);
        if (listEl) {
            listEl.innerHTML = '<p class="empty-hint">加载成就失败，请稍后再试</p>';
        }
    }
}

function renderAchievementList(achievements) {
    const listEl = document.getElementById('achievement-list');
    if (!listEl) return;

    if (!achievements.length) {
        listEl.innerHTML = '<p class="empty-hint">暂无成就</p>';
        return;
    }

    // Sort: unlocked first, then by rarity (epic → common)
    const rarityOrder = { epic: 0, rare: 1, uncommon: 2, common: 3 };
    const sorted = [...achievements].sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        return (rarityOrder[a.rarity] ?? 3) - (rarityOrder[b.rarity] ?? 3);
    });

    listEl.innerHTML = sorted.map(a => {
        const rarity = getRarityInfo(a.rarity);
        const locked = !a.unlocked;

        return `
            <div class="achievement-card ${locked ? 'locked' : 'unlocked'}">
                <div class="achievement-icon ${locked ? 'blurred' : ''}">${a.icon || '🏅'}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${escapeHtml(a.name || '未知成就')}</div>
                    <div class="achievement-desc">${locked ? '???' : escapeHtml(a.description || '')}</div>
                </div>
                <div class="achievement-rarity" style="color:${rarity.color};background:${rarity.bg}">
                    ${rarity.label}
                </div>
                ${a.unlocked && a.unlockedAt ? `<div class="achievement-time">${new Date(a.unlockedAt).toLocaleDateString()}</div>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Debounced achievement check – called after each player action.
 * @param {object} gameState – Current game state from the action response.
 */
export function checkAchievements(gameState) {
    if (!gameState || !state.currentGameId) return;

    if (achievementCheckTimer) {
        clearTimeout(achievementCheckTimer);
    }

    achievementCheckTimer = setTimeout(async () => {
        try {
            const data = await requestJson('/achievements/check', createJsonRequest('POST', {
                gameId: state.currentGameId,
                gameState
            }));

            const newlyUnlocked = data.newlyUnlocked || [];
            newlyUnlocked.forEach(achievement => {
                showAchievementUnlockNotification(achievement);
            });
        } catch (err) {
            // Silently ignore – achievements are non-critical
            console.warn('成就检查失败:', err);
        }
    }, ACHIEVEMENT_CHECK_DEBOUNCE_MS);
}

/**
 * Show an animated slide-in notification when a new achievement is unlocked.
 * @param {object} achievement – The achievement object {id, name, icon, ...}
 */
export function showAchievementUnlockNotification(achievement) {
    if (!achievement) return;

    // Also show a toast
    showToast(`🏆 成就解锁：${achievement.name || '未知成就'}`, 'success', 5000);

    // Create overlay notification
    const notification = document.createElement('div');
    notification.className = 'achievement-unlock-notification';
    notification.innerHTML = `
        <div class="achievement-unlock-icon">${achievement.icon || '🏅'}</div>
        <div class="achievement-unlock-content">
            <div class="achievement-unlock-label">成就解锁!</div>
            <div class="achievement-unlock-name">${escapeHtml(achievement.name || '未知成就')}</div>
        </div>
    `;

    document.body.appendChild(notification);

    // Trigger animation
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
        dismissNotification(notification);
    }, 4000);

    // Click to dismiss
    notification.addEventListener('click', () => {
        clearTimeout(dismissTimer);
        dismissNotification(notification);
    });
}

function dismissNotification(el) {
    el.classList.remove('show');
    el.classList.add('hide');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    // Fallback removal
    setTimeout(() => el.remove(), 600);
}

// ---------------------------------------------------------------------------
// Game Review
// ---------------------------------------------------------------------------

/**
 * Show the game review overlay after a game ends.
 * @param {string} gameId
 * @param {object} gameState
 */
export async function showGameReview(gameId, gameState) {
    const modal = document.getElementById('game-review-modal');
    if (!modal) return;

    // Show modal with loading state
    modal.classList.add('active');

    const starsEl = document.getElementById('review-stars');
    const summaryEl = document.getElementById('review-summary');
    const choicesEl = document.getElementById('review-choices');
    const endingsEl = document.getElementById('review-endings');
    const statsEl = document.getElementById('review-stats');

    // Show loading
    if (starsEl) starsEl.innerHTML = '';
    if (summaryEl) summaryEl.innerHTML = '<div class="achievement-loading"><div class="loading-spinner" style="width:32px;height:32px;border-width:3px;"></div><p>生成回顾中...</p></div>';
    if (choicesEl) choicesEl.innerHTML = '';
    if (endingsEl) endingsEl.innerHTML = '';
    if (statsEl) statsEl.innerHTML = '';

    try {
        // Try to get review from API
        let review = null;

        // First try POST to generate a new review
        try {
            const data = await requestJson(`/games/${gameId}/review`, createJsonRequest('POST', {
                gameState: gameState || state.gameState || {}
            }));
            review = data.review;
        } catch (_err) {
            // Fallback: try GET
            try {
                const data = await requestJson(`/games/${gameId}/review`);
                review = data.review;
            } catch (_err2) {
                // No review available – generate locally
            }
        }

        if (!review) {
            // Generate a local review from the game state
            review = generateLocalReview(gameState || state.gameState);
        }

        renderGameReview(review);
    } catch (err) {
        console.warn('生成回顾失败:', err);
        if (summaryEl) {
            summaryEl.innerHTML = '<p class="empty-hint">生成回顾失败，请稍后再试</p>';
        }
    }
}

function generateLocalReview(gs) {
    const gs_ = gs || {};
    return {
        rating: Math.min(5, Math.max(1, Math.floor(Math.random() * 2) + 3)),
        summary: gs_.currentScene || gs_.name || '你在这次冒险中经历了许多挑战与抉择。',
        keyChoices: Array.isArray(gs_.choiceHistory) ? gs_.choiceHistory.slice(-5) : [],
        characterEndings: Array.isArray(gs_.characterStates) ? gs_.characterStates.map(c => ({
            name: c.name || '未知',
            fate: c.state || '命运未卜',
            relationship: c.relationship || 0
        })) : [],
        playDuration: gs_.playDuration || 0,
        turnCount: gs_.turnCount || gs_.turn || 0
    };
}

function renderGameReview(review) {
    // Stars
    const starsEl = document.getElementById('review-stars');
    if (starsEl) {
        const rating = Math.max(0, Math.min(5, review.rating || 0));
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += `<span class="review-star ${i <= rating ? 'filled' : ''}">${i <= rating ? '★' : '☆'}</span>`;
        }
        starsEl.innerHTML = stars;
    }

    // Summary
    const summaryEl = document.getElementById('review-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `<p>${escapeHtml(review.summary || '无回顾内容')}</p>`;
    }

    // Key Choices
    const choicesEl = document.getElementById('review-choices');
    if (choicesEl) {
        const choices = review.keyChoices || [];
        if (choices.length) {
            choicesEl.innerHTML = choices.map((c, i) => `
                <div class="review-choice-item">
                    <div class="review-choice-number">${i + 1}</div>
                    <div class="review-choice-text">${escapeHtml(typeof c === 'string' ? c : (c.text || c.action || '未知抉择'))}</div>
                </div>
            `).join('');
        } else {
            choicesEl.innerHTML = '<p class="empty-hint">无关键抉择记录</p>';
        }
    }

    // Character Endings
    const endingsEl = document.getElementById('review-endings');
    if (endingsEl) {
        const endings = review.characterEndings || [];
        if (endings.length) {
            endingsEl.innerHTML = endings.map(ce => {
                const rel = ce.relationship || 0;
                const relClass = rel > 20 ? 'ally' : (rel < -20 ? 'hostile' : 'neutral');
                return `
                    <div class="review-ending-card ${relClass}">
                        <div class="review-ending-name">${escapeHtml(ce.name || '未知')}</div>
                        <div class="review-ending-fate">${escapeHtml(ce.fate || '命运未卜')}</div>
                        <div class="review-ending-rel ${relClass}">${rel >= 0 ? '+' : ''}${rel}</div>
                    </div>
                `;
            }).join('');
        } else {
            endingsEl.innerHTML = '<p class="empty-hint">无角色结局记录</p>';
        }
    }

    // Stats
    const statsEl = document.getElementById('review-stats');
    if (statsEl) {
        const turnCount = review.turnCount || 0;
        const duration = review.playDuration || 0;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;

        statsEl.innerHTML = `
            <div class="review-stat-item">
                <div class="review-stat-value">${turnCount}</div>
                <div class="review-stat-label">回合数</div>
            </div>
            <div class="review-stat-item">
                <div class="review-stat-value">${mins > 0 ? `${mins}分${secs}秒` : `${secs}秒`}</div>
                <div class="review-stat-label">游戏时长</div>
            </div>
            <div class="review-stat-item">
                <div class="review-stat-value">${(review.keyChoices || []).length}</div>
                <div class="review-stat-label">关键抉择</div>
            </div>
            <div class="review-stat-item">
                <div class="review-stat-value">${(review.characterEndings || []).length}</div>
                <div class="review-stat-label">角色结局</div>
            </div>
        `;
    }
}

// ---------------------------------------------------------------------------
// Share Feature
// ---------------------------------------------------------------------------

/**
 * Export game story as formatted text and copy to clipboard.
 * @param {string} gameId
 */
export async function shareStory(gameId) {
    if (!gameId) {
        showToast('没有可分享的游戏', 'warning');
        return;
    }

    try {
        const data = await requestJson('/share/story', createJsonRequest('POST', { gameId }));
        const fullText = data.fullText || '';

        if (!fullText) {
            showToast('故事内容为空', 'warning');
            return;
        }

        await navigator.clipboard.writeText(fullText);
        showToast('故事已复制到剪贴板！', 'success');
    } catch (err) {
        console.warn('分享故事失败:', err);
        // Fallback: build text from local state
        const localText = buildLocalStoryText();
        if (localText) {
            try {
                await navigator.clipboard.writeText(localText);
                showToast('故事已复制到剪贴板！', 'success');
            } catch {
                showToast('复制失败，请手动复制', 'error');
            }
        } else {
            showToast('分享失败，请稍后再试', 'error');
        }
    }
}

/**
 * Generate a visual share card with game stats.
 * @param {string} gameId
 */
export async function showShareCard(gameId) {
    if (!gameId) {
        showToast('没有可分享的游戏', 'warning');
        return;
    }

    try {
        const data = await requestJson(`/share/card/${gameId}`);
        const card = data.card || {};

        // Build a simple text-based share card and copy to clipboard
        const text = buildShareCardText(card);
        await navigator.clipboard.writeText(text);
        showToast('分享卡片已复制到剪贴板！', 'success');
    } catch (err) {
        console.warn('获取分享卡片失败:', err);
        showToast('获取分享卡片失败', 'error');
    }
}

function buildShareCardText(card) {
    const lines = [
        '🎮 叙游工坊 — RPG 冒险回顾',
        '━'.repeat(24),
        `📖 ${card.name || '未命名冒险'}`,
        `🏷️ ${card.type || 'RPG'} ${card.typeIcon || ''}`,
        '',
        ...(Array.isArray(card.keyStats) ? card.keyStats.map(s => `  • ${s}`) : []),
        '',
        `⏱️ 游戏时长: ${card.playTime || '未知'}`,
        `⭐ 评分: ${'★'.repeat(Math.max(0, Math.min(5, card.rating || 0)))}${'☆'.repeat(5 - Math.max(0, Math.min(5, card.rating || 0)))}`,
        '',
        '🔗 由 叙游工坊 生成'
    ];
    return lines.join('\n');
}

/**
 * Download the story as a .txt file.
 * @param {string} gameId
 */
export async function downloadStory(gameId) {
    if (!gameId) {
        showToast('没有可下载的游戏', 'warning');
        return;
    }

    try {
        let fullText = '';

        try {
            const data = await requestJson('/share/story', createJsonRequest('POST', { gameId }));
            fullText = data.fullText || '';
        } catch (_err) {
            fullText = buildLocalStoryText();
        }

        if (!fullText) {
            showToast('故事内容为空，无法下载', 'warning');
            return;
        }

        const gs = state.gameState || {};
        const title = gs.name || state.currentGameData?.name || '叙游工坊冒险记录';

        const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast('故事已下载', 'success');
    } catch (err) {
        console.warn('下载故事失败:', err);
        showToast('下载失败，请稍后再试', 'error');
    }
}

function buildLocalStoryText() {
    const gs = state.gameState || {};
    const title = gs.name || '叙游工坊冒险记录';
    const lines = [
        `【${title}】`,
        `游戏类型: ${gameTypeNames[state.currentGameType] || 'RPG'}`,
        '='.repeat(40),
        ''
    ];

    // Collect story from the game log
    const logEl = document.getElementById('game-log');
    if (logEl) {
        const entries = logEl.querySelectorAll('.log-entry');
        entries.forEach(entry => {
            const speaker = entry.querySelector('.speaker')?.textContent?.trim();
            const content = entry.querySelector('.content')?.textContent?.trim();
            if (content) {
                if (speaker) {
                    lines.push(`【${speaker}】${content}`);
                } else if (entry.classList.contains('player')) {
                    lines.push(`> ${content}`);
                } else if (entry.classList.contains('system')) {
                    lines.push(`* ${content} *`);
                } else {
                    lines.push(content);
                }
                lines.push('');
            }
        });
    }

    lines.push('='.repeat(40));
    lines.push('由 叙游工坊 生成');

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Template System
// ---------------------------------------------------------------------------

/**
 * Initialise template system event listeners.
 */
export function initTemplates() {
    const templatesBtn = document.getElementById('templates-btn');
    const closeTemplates = document.getElementById('close-templates');
    const saveTemplateBtn = document.getElementById('save-template-btn');

    if (templatesBtn) {
        templatesBtn.addEventListener('click', () => {
            loadTemplates();
            const section = document.getElementById('templates-section');
            if (section) {
                section.style.display = 'block';
                document.getElementById('game-types-section').style.display = 'none';
            }
        });
    }

    if (closeTemplates) {
        closeTemplates.addEventListener('click', () => {
            const section = document.getElementById('templates-section');
            if (section) {
                section.style.display = 'none';
                document.getElementById('game-types-section').style.display = 'block';
            }
        });
    }

    if (saveTemplateBtn) {
        saveTemplateBtn.addEventListener('click', () => {
            saveAsTemplate();
        });
    }
}

/**
 * Fetch and display templates from the API.
 */
export async function loadTemplates() {
    const grid = document.getElementById('templates-grid');
    if (!grid) return;

    grid.innerHTML = '<div class="achievement-loading"><div class="loading-spinner" style="width:32px;height:32px;border-width:3px;"></div><p>加载模板中...</p></div>';

    try {
        const data = await requestJson('/templates');
        const templates = data.templates || [];

        if (!templates.length) {
            grid.innerHTML = '<p class="empty-hint">暂无模板，保存配置后将出现在这里</p>';
            return;
        }

        grid.innerHTML = templates.map(t => `
            <div class="template-card" data-template-id="${escapeHtml(String(t.id))}">
                <div class="template-icon">${t.coverIcon || '🎯'}</div>
                <div class="template-info">
                    <div class="template-name">${escapeHtml(t.name || '未命名模板')}</div>
                    <div class="template-type">${escapeHtml(gameTypeNames[t.gameType] || t.gameType || 'RPG')}</div>
                    <div class="template-desc">${escapeHtml(t.description || '')}</div>
                    <div class="template-use-count">使用 ${t.useCount || 0} 次</div>
                </div>
                <div class="template-actions-card">
                    <button class="template-use-btn" data-use-id="${escapeHtml(String(t.id))}" title="使用此模板">▶ 使用</button>
                    <button class="template-delete-btn" data-delete-id="${escapeHtml(String(t.id))}" title="删除模板">✕</button>
                </div>
            </div>
        `).join('');

        // Wire up use buttons
        grid.querySelectorAll('.template-use-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.useId;
                if (id) await useTemplate(id);
            });
        });

        // Wire up delete buttons
        grid.querySelectorAll('.template-delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.deleteId;
                if (id && confirm('确定删除此模板？')) {
                    await deleteTemplate(id);
                }
            });
        });
    } catch (err) {
        console.warn('加载模板失败:', err);
        grid.innerHTML = '<p class="empty-hint">加载模板失败，请稍后再试</p>';
    }
}

/**
 * Apply a template's config to the config form.
 * @param {string} templateId
 */
export async function useTemplate(templateId) {
    try {
        // Increment use count
        await requestJson(`/templates/${templateId}/use`, createJsonRequest('POST', {}));

        // Fetch template config
        const data = await requestJson(`/templates/${templateId}`);
        const template = data.template || {};
        const config = template.config || {};

        // Apply config to the form
        if (config.name) {
            const nameInput = document.getElementById('game-name');
            if (nameInput) nameInput.value = config.name;
        }
        if (config.description) {
            const descInput = document.getElementById('game-description');
            if (descInput) descInput.value = config.description;
        }
        if (config.difficulty) {
            const diffSelect = document.getElementById('game-difficulty');
            if (diffSelect) diffSelect.value = config.difficulty;
        }
        if (config.length) {
            const lengthSelect = document.getElementById('game-length');
            if (lengthSelect) lengthSelect.value = config.length;
        }
        if (config.gameType && state.currentGameType !== config.gameType) {
            state.currentGameType = config.gameType;
        }

        // Close templates section
        const section = document.getElementById('templates-section');
        if (section) {
            section.style.display = 'none';
            document.getElementById('game-types-section').style.display = 'block';
        }

        // Navigate to config screen
        const { showScreen } = await import('./navigation.js');
        showScreen('config-screen');

        showToast(`已应用模板：${template.name || '模板'}`, 'success');
    } catch (err) {
        console.warn('使用模板失败:', err);
        showToast('使用模板失败', 'error');
    }
}

/**
 * Save the current config as a template.
 */
export async function saveAsTemplate() {
    const name = prompt('请输入模板名称：');
    if (!name) return;

    const description = prompt('模板描述（可选）：') || '';

    // Collect current config
    const config = {
        name: document.getElementById('game-name')?.value || '',
        description: document.getElementById('game-description')?.value || '',
        difficulty: document.getElementById('game-difficulty')?.value || 'normal',
        length: document.getElementById('game-length')?.value || 'medium',
        gameType: state.currentGameType || 'custom'
    };

    try {
        await requestJson('/templates', createJsonRequest('POST', {
            name,
            description,
            gameType: state.currentGameType || 'custom',
            config,
            coverIcon: '🎯'
        }));
        showToast('模板已保存！', 'success');
        loadTemplates(); // Refresh the list
    } catch (err) {
        console.warn('保存模板失败:', err);
        showToast('保存模板失败', 'error');
    }
}

async function deleteTemplate(templateId) {
    try {
        await requestJson(`/templates/${templateId}`, createJsonRequest('DELETE', {}));
        showToast('模板已删除', 'success');
        loadTemplates(); // Refresh the list
    } catch (err) {
        console.warn('删除模板失败:', err);
        showToast('删除模板失败', 'error');
    }
}

// ---------------------------------------------------------------------------
// Review modal button listeners (initialised once)
// ---------------------------------------------------------------------------

let reviewListenersInitialised = false;

export function initReviewListeners() {
    if (reviewListenersInitialised) return;
    reviewListenersInitialised = true;

    // Share button in review modal
    const shareBtn = document.getElementById('review-share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            shareStory(state.currentGameId);
        });
    }

    // New game button in review modal
    const newGameBtn = document.getElementById('review-new-game-btn');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', async () => {
            const modal = document.getElementById('game-review-modal');
            if (modal) modal.classList.remove('active');

            // Navigate to home
            const { showHomeScreen } = await import('./navigation.js');
            showHomeScreen();
        });
    }

    // Download button in review modal
    const downloadBtn = document.getElementById('review-download-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            downloadStory(state.currentGameId);
        });
    }
}

// ---------------------------------------------------------------------------
// Combined init (called from main.js)
// ---------------------------------------------------------------------------

export function initPhase4() {
    initAchievements();
    initTemplates();
    initReviewListeners();

    // Close achievement modal
    const achievementModal = document.getElementById('achievement-modal');
    if (achievementModal) {
        achievementModal.querySelector('.modal-close')?.addEventListener('click', () => {
            achievementModal.classList.remove('active');
        });
        achievementModal.addEventListener('click', (e) => {
            if (e.target === achievementModal) {
                achievementModal.classList.remove('active');
            }
        });
    }

    // Close review modal
    const reviewModal = document.getElementById('game-review-modal');
    if (reviewModal) {
        reviewModal.querySelector('.modal-close')?.addEventListener('click', () => {
            reviewModal.classList.remove('active');
        });
        reviewModal.addEventListener('click', (e) => {
            if (e.target === reviewModal) {
                reviewModal.classList.remove('active');
            }
        });
    }
}
