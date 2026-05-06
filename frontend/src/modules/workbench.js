/**
 * Generation workbench – step navigation, candidate rendering, confirm/skip.
 */

import { requestJson, createJsonRequest } from '../services/api.js';
import { state, stepDescriptions, getStepState } from './state.js';
import { escapeHtml, getEffectiveGenerationConfig } from './utils.js';
import { setApiStatus } from './navigation.js';

// ---------------------------------------------------------------------------
// Init workbench DOM handlers
// ---------------------------------------------------------------------------

export function initWorkbench() {
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

// ---------------------------------------------------------------------------
// Step navigation
// ---------------------------------------------------------------------------

export function renderStepNavigation() {
    const container = document.getElementById('step-navigation');
    container.innerHTML = '';

    state.allSteps.forEach((step) => {
        const stepState = getStepState(step.id);
        const meta = stepDescriptions[step.id] || { icon: '?', name: step.name || step.id };
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'step';

        if (step.id === state.currentStepId) {
            button.classList.add('active');
        }

        if (stepState.status === 'confirmed') {
            button.classList.add('completed');
        }

        if (stepState.status === 'loading') {
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

// ---------------------------------------------------------------------------
// Render current step
// ---------------------------------------------------------------------------

export function renderCurrentStep(stepId) {
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

// ---------------------------------------------------------------------------
// Render candidates
// ---------------------------------------------------------------------------

function renderCandidates(stepId) {
    const container = document.getElementById('candidates-container');
    const localState = getStepState(stepId);
    container.innerHTML = '';

    if (localState.status === 'loading') {
        return;
    }

    if (!localState.candidates.length) {
        container.innerHTML = '<div class="candidate-card"><div class="candidate-empty">当前步骤还没有生成内容。点击下方"生成"开始。</div></div>';
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

// ---------------------------------------------------------------------------
// Candidate content helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Step actions: regenerate, confirm, skip
// ---------------------------------------------------------------------------

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
            setApiStatus('success', '已确认当前步骤。下一步不会自动生成，请按需点击"生成"。');
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

// ---------------------------------------------------------------------------
// Confirmed elements & history
// ---------------------------------------------------------------------------

export async function renderConfirmedElements() {
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

export function renderHistoryPanel() {
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

// ---------------------------------------------------------------------------
// Finalize game
// ---------------------------------------------------------------------------

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

        // Dynamic import to avoid circular dependency with game.js
        const gameModule = await import('./game.js');
        await gameModule.startGame(state.currentGameId);
        setApiStatus('success', '游戏已生成并启动。');
    } catch (error) {
        setApiStatus('error', error.message);
        alert(`整合失败：${error.message}`);
    }
}
