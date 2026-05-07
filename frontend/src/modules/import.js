/**
 * Import functionality – text import, project packages, preview editing.
 */

import { requestJson, requestJsonWithProgress, createJsonRequest } from '../services/api.js';
import { collectGenerationConfig, collectLlmSettings } from '../services/settings.js';
import { state, adaptationModeNames, gameTypeNames } from './state.js';
import { normalizeGenerationConfig, escapeHtml, escapeAttribute, cloneJson, getEffectiveGenerationConfig, createEmptyPreviewCharacter, createEmptyPreviewChapter, createEmptyPreviewLocation } from './utils.js';
import { showScreen } from './navigation.js';
import { saveGenerationSettings } from './saved-games.js';
import { readLiveComfyUIConfig } from './comfyui.js';

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function getAdaptationModeLabel(mode) {
    return adaptationModeNames[mode] || mode || '未设置';
}

export function getPacingLabel(mode) {
    const pacingNames = { slow: '慢节奏', balanced: '平衡', fast: '快节奏' };
    return pacingNames[mode] || mode || '未设置';
}

// ---------------------------------------------------------------------------
// Status setters
// ---------------------------------------------------------------------------

export function setImportStatus(message, tone = '') {
    const status = document.getElementById('import-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.className = `helper-text ${tone}`.trim();
}

export function setImportPreviewStatus(message, tone = '') {
    const status = document.getElementById('import-preview-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.className = `helper-text ${tone}`.trim();
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export function initImportForm() {
    document.getElementById('import-project-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await initImportedProjectGenerationSession();
    });
    document.getElementById('import-package-btn')?.addEventListener('click', async () => {
        await importProjectPackageFromFile();
    });

    document.getElementById('refresh-import-projects')?.addEventListener('click', async () => {
        await loadImportedProjects();
    });

    loadImportedProjects().catch((error) => {
        console.error('Load imported projects error:', error);
    });
}

export function initImportPreviewEditor() {
    document.getElementById('save-import-preview')?.addEventListener('click', async () => {
        await saveImportedProjectEdits();
    });
    document.getElementById('optimize-project-btn')?.addEventListener('click', async () => {
        await optimizeProject();
    });
    document.getElementById('resume-project-play')?.addEventListener('click', async () => {
        await resumeProjectPlay();
    });
    document.getElementById('generate-base-assets')?.addEventListener('click', async () => {
        await generateBaseAssetsForProject();
    });
    document.getElementById('rebuild-adaptation-btn')?.addEventListener('click', async () => {
        await rebuildProjectAdaptation();
    });
    document.getElementById('rebuild-visual-bible-btn')?.addEventListener('click', async () => {
        await rebuildProjectVisualBible();
    });
    document.getElementById('apply-project-refinement-btn')?.addEventListener('click', async () => {
        await applyProjectRefinement();
    });
    document.getElementById('export-project-package-btn')?.addEventListener('click', async () => {
        await exportProjectPackage();
    });

    document.getElementById('import-preview-screen')?.addEventListener('click', (event) => {
        const actionButton = event.target.closest('[data-preview-action]');
        if (!actionButton) {
            return;
        }

        handleImportPreviewAction(actionButton.dataset.previewAction, actionButton);
    });
}

// ---------------------------------------------------------------------------
// Project package import
// ---------------------------------------------------------------------------

async function importProjectPackageFromFile() {
    const input = document.getElementById('import-package-file');
    const file = input?.files?.[0];
    if (!file) {
        setImportStatus('请先选择一个项目包 JSON 文件。', 'error');
        return;
    }

    setImportStatus('正在解析并导入项目包...', 'pending');

    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const result = await requestJson(
            '/projects/import-package',
            createJsonRequest('POST', { package: parsed })
        );

        state.currentProjectId = result.project?.id || null;
        state.currentProjectData = result.project || null;
        state.currentGameType = result.project?.gameType || state.currentGameType || 'custom';

        if (state.currentProjectData) {
            document.getElementById('import-title').value = state.currentProjectData.title || '';
        }

        renderImportedProjectPreview(state.currentProjectData);
        await loadImportedProjects();
        showScreen('import-preview-screen');
        setImportStatus('项目包导入成功。', 'success');
        setImportPreviewStatus('项目包已恢复，可以继续调整后进入工作台。', 'success');
    } catch (error) {
        setImportStatus(`导入失败：${error.message}`, 'error');
    }
}

// ---------------------------------------------------------------------------
// Import text → project
// ---------------------------------------------------------------------------

async function initImportedProjectGenerationSession() {
    const content = document.getElementById('import-content')?.value.trim() || '';
    if (!content) {
        setImportStatus('请先粘贴要导入的长文本内容。', 'error');
        return;
    }

    if (content.length < 100) {
        setImportStatus('文本内容过短，至少需要 100 字。', 'error');
        return;
    }

    const generationConfig = normalizeGenerationConfig(collectGenerationConfig());
    state.currentGenerationConfig = generationConfig;
    saveGenerationSettings();

    const useSmart = document.getElementById('use-smart-parse')?.checked !== false;
    const submitBtn = document.getElementById('import-submit-btn');
    const progressContainer = document.getElementById('import-progress');
    const progressFill = document.getElementById('import-progress-fill');
    const progressText = document.getElementById('import-progress-text');

    if (submitBtn) submitBtn.disabled = true;

    try {
        const importPayload = {
            title: document.getElementById('import-title')?.value.trim() || '',
            content,
            gameType: document.getElementById('import-game-type')?.value || 'custom',
            adaptationMode: document.getElementById('adaptation-mode')?.value || 'balanced',
            useSmart,
            settings: useSmart ? collectLlmSettings() : undefined
        };

        if (useSmart) {
            // 使用智能解析，显示进度
            if (progressContainer) progressContainer.style.display = 'block';
            setImportStatus('正在使用 AI 智能解析文本...', 'pending');

            const imported = await requestJsonWithProgress(
                '/projects/import-text',
                createJsonRequest('POST', importPayload),
                (percent, message) => {
                    if (progressFill) progressFill.style.width = `${percent}%`;
                    if (progressText) progressText.textContent = message || `解析中... ${percent}%`;
                }
            );

            state.currentProjectId = imported.project?.id || null;
            state.currentProjectData = imported.project || null;
            state.currentGameType = importPayload.gameType;
            renderImportedProjectPreview(imported.project);
            setImportStatus('AI 智能解析完成！请检查提取结果。', 'success');
            setImportPreviewStatus('AI 已智能识别章节、角色和关系，可以轻量修改后进入工作台。', 'success');
        } else {
            // 使用快速解析
            setImportStatus('正在快速解析文本...', 'pending');
            const imported = await requestJson('/projects/import-text', createJsonRequest('POST', importPayload));
            state.currentProjectId = imported.project?.id || null;
            state.currentProjectData = imported.project || null;
            state.currentGameType = importPayload.gameType;
            renderImportedProjectPreview(imported.project);
            setImportStatus('快速解析完成，请检查提取结果。', 'success');
            setImportPreviewStatus('可以先轻量修改角色、章节和地点，再确认进入工作台。');
        }

        await loadImportedProjects();
        showScreen('import-preview-screen');
    } catch (error) {
        console.error('Imported project init error:', error);
        setImportStatus(`导入失败：${error.message}`, 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (progressContainer) progressContainer.style.display = 'none';
    }
}

// ---------------------------------------------------------------------------
// Start imported project session → workbench
// ---------------------------------------------------------------------------

export async function startImportedProjectSession() {
    if (!state.currentProjectId) {
        setImportStatus('当前没有可用的导入项目，请重新导入。', 'error');
        showScreen('import-screen');
        return;
    }

    const generationConfig = normalizeGenerationConfig(collectGenerationConfig());
    state.currentGenerationConfig = generationConfig;
    saveGenerationSettings();

    try {
        const savedProject = await saveImportedProjectEdits({
            successMessage: '修改已保存，正在进入生成工作台...'
        });

        if (!savedProject) {
            return;
        }

        const sessionData = await requestJson(
            `/projects/${state.currentProjectId}/init-session`,
            createJsonRequest('POST', {
                config: generationConfig,
                gameType: savedProject.gameType || state.currentGameType || 'custom',
                userInput: savedProject.storyBible?.summary || savedProject.source?.excerpt || ''
            })
        );

        // Dynamic import to avoid circular dependency with config.js → workbench.js
        const { beginGenerationWorkbench } = await import('./config.js');
        await beginGenerationWorkbench(sessionData);
        setImportStatus('导入项目已进入生成工作台。', 'success');
    } catch (error) {
        console.error('Start imported project session error:', error);
        setImportStatus(error.message, 'error');
        setImportPreviewStatus(error.message, 'error');
        showScreen('import-screen');
    }
}

// ---------------------------------------------------------------------------
// Import preview editing
// ---------------------------------------------------------------------------

function buildImportPreviewDraftFromForm() {
    const base = cloneJson(state.currentProjectData);
    const edits = collectImportedProjectEdits();

    base.storyBible = base.storyBible || {};
    base.source = base.source || {};
    base.title = edits.title || base.title || '';
    base.storyBible.summary = edits.summary || base.storyBible.summary || '';
    base.storyBible.characters = edits.characters;
    base.storyBible.chapters = edits.chapters;
    base.storyBible.locations = edits.locations;
    base.source.title = base.title || base.source.title || '';

    return base;
}

function handleImportPreviewAction(action, actionButton) {
    if (!action || !state.currentProjectData) {
        return;
    }

    const draft = buildImportPreviewDraftFromForm();
    draft.storyBible = draft.storyBible || {};

    if (action === 'add-character') {
        const characters = Array.isArray(draft.storyBible.characters) ? draft.storyBible.characters : [];
        characters.push(createEmptyPreviewCharacter(characters.length));
        draft.storyBible.characters = characters;
    }

    if (action === 'remove-character') {
        const item = actionButton.closest('[data-preview-item="character"]');
        const index = Number(item?.dataset.index ?? -1);
        draft.storyBible.characters = (draft.storyBible.characters || []).filter((_entry, currentIndex) => currentIndex !== index);
    }

    if (action === 'add-chapter') {
        const chapters = Array.isArray(draft.storyBible.chapters) ? draft.storyBible.chapters : [];
        chapters.push(createEmptyPreviewChapter(chapters.length));
        draft.storyBible.chapters = chapters;
    }

    if (action === 'remove-chapter') {
        const item = actionButton.closest('[data-preview-item="chapter"]');
        const index = Number(item?.dataset.index ?? -1);
        draft.storyBible.chapters = (draft.storyBible.chapters || []).filter((_entry, currentIndex) => currentIndex !== index);
    }

    if (action === 'add-location') {
        const locations = Array.isArray(draft.storyBible.locations) ? draft.storyBible.locations : [];
        locations.push(createEmptyPreviewLocation(locations.length));
        draft.storyBible.locations = locations;
    }

    if (action === 'remove-location') {
        const item = actionButton.closest('[data-preview-item="location"]');
        const index = Number(item?.dataset.index ?? -1);
        draft.storyBible.locations = (draft.storyBible.locations || []).filter((_entry, currentIndex) => currentIndex !== index);
    }

    state.currentProjectData = draft;
    renderImportedProjectPreview(draft);
    setImportPreviewStatus('本地预览已更新，记得保存后再进入工作台。', 'pending');
}

function collectImportPreviewCollection(type, mapper) {
    return Array.from(document.querySelectorAll(`[data-preview-collection="${type}"] [data-preview-item="${type}"]`))
        .map((element, index) => mapper(element, index));
}

function collectImportedProjectEdits() {
    return {
        title: document.getElementById('import-preview-title')?.value.trim() || state.currentProjectData?.title || '',
        summary: document.getElementById('import-preview-summary-input')?.value.trim() || state.currentProjectData?.storyBible?.summary || '',
        adaptationMode: document.getElementById('import-preview-adaptation-mode')?.value || state.currentProjectData?.adaptationMode || 'balanced',
        gameType: document.getElementById('import-preview-game-type')?.value || state.currentProjectData?.gameType || state.currentGameType || 'custom',
        characters: collectImportPreviewCollection('character', (element, index) => ({
            id: element.dataset.itemId || `import_char_${index + 1}`,
            name: element.querySelector('[data-field="name"]')?.value.trim() || '',
            role: element.querySelector('[data-field="role"]')?.value.trim() || '',
            description: element.querySelector('[data-field="description"]')?.value.trim() || ''
        })).filter((character) => character.name || character.role || character.description),
        chapters: collectImportPreviewCollection('chapter', (element, index) => ({
            id: element.dataset.itemId || `chapter_${index + 1}`,
            title: element.querySelector('[data-field="title"]')?.value.trim() || `章节 ${index + 1}`,
            summary: element.querySelector('[data-field="summary"]')?.value.trim() || ''
        })).filter((chapter) => chapter.title || chapter.summary),
        locations: collectImportPreviewCollection('location', (element, index) => ({
            id: element.dataset.itemId || `import_loc_${index + 1}`,
            name: element.querySelector('[data-field="name"]')?.value.trim() || '',
            description: element.querySelector('[data-field="description"]')?.value.trim() || ''
        })).filter((location) => location.name || location.description)
    };
}

// ---------------------------------------------------------------------------
// Render imported project preview
// ---------------------------------------------------------------------------

export function renderImportedProjectPreview(project = state.currentProjectData) {
    if (!project) {
        return;
    }

    const summaryEl = document.getElementById('import-preview-summary');
    const charactersEl = document.getElementById('import-preview-characters');
    const chaptersEl = document.getElementById('import-preview-chapters');
    const visualsEl = document.getElementById('import-preview-visuals');
    const summary = project.storyBible?.summary || project.source?.excerpt || '';
    const themes = Array.isArray(project.storyBible?.themes) && project.storyBible.themes.length
        ? project.storyBible.themes.join('、')
        : '待补充';
    const characters = Array.isArray(project.storyBible?.characters) ? project.storyBible.characters : [];
    const chapters = Array.isArray(project.storyBible?.chapters) ? project.storyBible.chapters : [];
    const locations = Array.isArray(project.storyBible?.locations) ? project.storyBible.locations : [];
    const locationNames = locations.slice(0, 5).map((item) => item.name).filter(Boolean).join('、');
    const characterHints = characters.slice(0, 4).map((item) => item.name).filter(Boolean).join('、');
    const locationHints = locations.slice(0, 4).map((item) => item.name).filter(Boolean).join('、');
    const atmosphere = project.visualBible?.styleProfile?.atmosphere || '待确认';
    const playable = project.buildArtifacts?.latestPlayable || null;
    const hasRuntimeSnapshot = Boolean(project.runtimeSnapshot?.history?.length || project.runtimeSnapshot?.plotBeatId != null);
    const playableStatus = playable?.updatedAt
        ? `最近可玩版本：${new Date(playable.updatedAt).toLocaleString()}`
        : '当前还没有可试玩版本';
    const optimizationReport = project.optimizationReport || null;

    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="preview-summary-block">
                <div class="preview-field">
                    <label for="import-preview-title">项目标题</label>
                    <input id="import-preview-title" type="text" value="${escapeAttribute(project.title || '')}" placeholder="输入项目标题" />
                </div>
                <div class="preview-field">
                    <label for="import-preview-summary-input">剧情摘要</label>
                    <textarea id="import-preview-summary-input" rows="6" placeholder="补充导入项目的剧情摘要">${escapeHtml(summary)}</textarea>
                </div>
                <div class="preview-meta-row">
                    <div class="preview-field">
                        <label for="import-preview-adaptation-mode">改编模式</label>
                        <select id="import-preview-adaptation-mode">
                            <option value="faithful" ${project.adaptationMode === 'faithful' ? 'selected' : ''}>忠于原著</option>
                            <option value="balanced" ${project.adaptationMode === 'balanced' ? 'selected' : ''}>平衡改编</option>
                            <option value="free" ${project.adaptationMode === 'free' ? 'selected' : ''}>高自由互动</option>
                        </select>
                    </div>
                    <div class="preview-field">
                        <label for="import-preview-game-type">游戏类型</label>
                        <select id="import-preview-game-type">
                            <option value="custom" ${project.gameType === 'custom' ? 'selected' : ''}>自定义</option>
                            <option value="adventure" ${project.gameType === 'adventure' ? 'selected' : ''}>冒险</option>
                            <option value="mystery" ${project.gameType === 'mystery' ? 'selected' : ''}>推理</option>
                            <option value="romance" ${project.gameType === 'romance' ? 'selected' : ''}>恋爱</option>
                            <option value="fantasy" ${project.gameType === 'fantasy' ? 'selected' : ''}>奇幻</option>
                            <option value="scifi" ${project.gameType === 'scifi' ? 'selected' : ''}>科幻</option>
                            <option value="kingdom" ${project.gameType === 'kingdom' ? 'selected' : ''}>王国</option>
                            <option value="cultivation" ${project.gameType === 'cultivation' ? 'selected' : ''}>修仙</option>
                        </select>
                    </div>
                </div>
                <div class="preview-content">
                    <p>主题：${escapeHtml(themes)}</p>
                    <p>主要地点：${escapeHtml(locationNames || '待补充')}</p>
                    <p>${escapeHtml(playableStatus)}</p>
                    <p>${escapeHtml(hasRuntimeSnapshot ? '检测到运行快照，可继续试玩。' : '当前没有运行快照，将从开场开始试玩。')}</p>
                </div>
                <div class="preview-item-actions">
                    <button id="optimize-project-btn" type="button" class="preview-inline-btn">一键优化项目</button>
                    <button id="resume-project-play" type="button" class="preview-inline-btn" ${playable ? '' : 'disabled'}>${hasRuntimeSnapshot ? '继续试玩' : '试玩当前版本'}</button>
                </div>
            </div>
        `;
        document.getElementById('optimize-project-btn')?.addEventListener('click', async () => {
            await optimizeProject();
        });
        document.getElementById('resume-project-play')?.addEventListener('click', async () => {
            await resumeProjectPlay();
        });
    }

    if (charactersEl) {
        const characterItems = characters.length
            ? characters.map((character, index) => `
                <article class="preview-edit-item" data-preview-item="character" data-index="${index}" data-item-id="${escapeAttribute(character.id || '')}">
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label>角色名</label>
                            <input type="text" data-field="name" value="${escapeAttribute(character.name || '')}" placeholder="角色名称" />
                        </div>
                        <div class="preview-field">
                            <label>角色定位</label>
                            <input type="text" data-field="role" value="${escapeAttribute(character.role || '')}" placeholder="主角 / 配角 / 阵营人物" />
                        </div>
                    </div>
                    <div class="preview-field">
                        <label>角色描述</label>
                        <textarea data-field="description" rows="4" placeholder="补充角色外观、气质、动机">${escapeHtml(character.description || '')}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-character">删除角色</button>
                    </div>
                </article>
            `).join('')
            : '<p class="empty-hint">暂未提取到明显角色，可以手动补一个再继续。</p>';

        charactersEl.innerHTML = `
            <div class="preview-card-header">
                <p class="helper-text">这里只做轻量纠偏，确认后会直接带入后续生成。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-character">新增角色</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="character">
                ${characterItems}
            </div>
        `;
    }

    if (chaptersEl) {
        const chapterItems = chapters.length
            ? chapters.map((chapter, index) => `
                <article class="preview-edit-item" data-preview-item="chapter" data-index="${index}" data-item-id="${escapeAttribute(chapter.id || '')}">
                    <div class="preview-field">
                        <label>章节标题</label>
                        <input type="text" data-field="title" value="${escapeAttribute(chapter.title || chapter.name || '')}" placeholder="章节标题" />
                    </div>
                    <div class="preview-field">
                        <label>章节摘要</label>
                        <textarea data-field="summary" rows="5" placeholder="这一章的主要事件与冲突">${escapeHtml(chapter.summary || '')}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-chapter">删除章节</button>
                    </div>
                </article>
            `).join('')
            : '<p class="empty-hint">还没识别到章节结构，可以先加几个关键情节节点。</p>';

        chaptersEl.innerHTML = `
            <div class="preview-card-header">
                <p class="helper-text">保留关键章节就够，后续工作台还会继续细化。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-chapter">新增章节</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="chapter">
                ${chapterItems}
            </div>
        `;
    }

    if (visualsEl) {
        const locationItems = locations.length
            ? locations.map((location, index) => `
                <article class="preview-edit-item" data-preview-item="location" data-index="${index}" data-item-id="${escapeAttribute(location.id || '')}">
                    <div class="preview-field">
                        <label>地点名称</label>
                        <input type="text" data-field="name" value="${escapeAttribute(location.name || '')}" placeholder="地点名称" />
                    </div>
                    <div class="preview-field">
                        <label>地点描述</label>
                        <textarea data-field="description" rows="4" placeholder="地点外观、氛围、功能">${escapeHtml(location.description || '')}</textarea>
                    </div>
                    <div class="preview-item-actions">
                        <button type="button" class="preview-inline-btn danger" data-preview-action="remove-location">删除地点</button>
                    </div>
                </article>
            `).join('')
            : '<p class="empty-hint">地点越准，后面的场景基准图就越稳。</p>';

        const stylePreset = project.visualBible?.styleProfile?.stylePreset || '国风电影叙事';
        const refinement = project.config?.refinement || {};
        const branchPolicy = project.gameDesign?.branchingPolicy || {};
        const branchSummary = `每章分支上限 ${branchPolicy.maxBranchPerChapter || '-'}，锚点保留率 ${branchPolicy.mustKeepAnchorRate || '-'}`;
        const relationshipGraphHtml = renderRelationshipGraph(optimizationReport?.relationshipGraph);
        const playableTreeHtml = renderPlayableChapterTree(optimizationReport?.playableChapters);
        const optimizationHtml = optimizationReport
            ? `
                <article class="preview-edit-item">
                    <strong>项目优化诊断</strong>
                    <div class="preview-content">
                        <p>总评分：${escapeHtml(String(optimizationReport.overallScore || 0))}</p>
                        <p>故事完整度：${escapeHtml(String(optimizationReport.readiness?.story || 0))}</p>
                        <p>改编完整度：${escapeHtml(String(optimizationReport.readiness?.adaptation || 0))}</p>
                        <p>视觉完整度：${escapeHtml(String(optimizationReport.readiness?.visual || 0))}</p>
                        <p>试玩完整度：${escapeHtml(String(optimizationReport.readiness?.playable || 0))}</p>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">优化建议</div>
                        <div class="candidate-paragraph">${escapeHtml((optimizationReport.recommendations || []).join('；') || '当前没有明显阻塞项。')}</div>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">当前优势</div>
                        <div class="candidate-paragraph">${escapeHtml((optimizationReport.strengths || []).join('；') || '继续丰富内容即可。')}</div>
                    </div>
                    <div class="candidate-block">
                        <div class="candidate-label">建议下一步</div>
                        <div class="candidate-paragraph">${escapeHtml((optimizationReport.nextActions || []).map((item) => item.label).join('；') || '当前没有明显阻塞项。')}</div>
                    </div>
                    ${relationshipGraphHtml}
                    ${playableTreeHtml}
                </article>
            `
            : '';

        visualsEl.innerHTML = `
            <div class="preview-card-header">
                <p class="helper-text">先确认后续要做视觉建档的主要地点。</p>
                <button type="button" class="preview-inline-btn" data-preview-action="add-location">新增地点</button>
            </div>
            <div class="preview-edit-stack" data-preview-collection="location">
                ${locationItems}
            </div>

            <div class="preview-card-header">
                <h3>改编导演与视觉重建</h3>
            </div>
            <div class="preview-edit-stack">
                <article class="preview-edit-item">
                    <div class="preview-field">
                        <label for="preview-style-preset">风格预设</label>
                        <input id="preview-style-preset" type="text" value="${escapeAttribute(stylePreset)}" placeholder="例如：国风电影叙事 / 水墨奇幻" />
                    </div>
                    <div class="preview-meta-row">
                        <div class="preview-field">
                            <label for="preview-pacing">节奏倾向</label>
                            <select id="preview-pacing">
                                <option value="slow" ${project.config?.pacing === 'slow' ? 'selected' : ''}>慢节奏</option>
                                <option value="balanced" ${(!project.config?.pacing || project.config?.pacing === 'balanced') ? 'selected' : ''}>平衡</option>
                                <option value="fast" ${project.config?.pacing === 'fast' ? 'selected' : ''}>快节奏</option>
                            </select>
                        </div>
                        <div class="preview-field">
                            <label for="preview-adaptation-strength">改编强度 (0-1)</label>
                            <input id="preview-adaptation-strength" type="number" min="0" max="1" step="0.1" value="${Number(refinement.adaptationStrength ?? 0.5)}" />
                        </div>
                    </div>
                    <div class="preview-item-actions preview-actions-grid">
                        <button id="rebuild-adaptation-btn" type="button" class="preview-inline-btn">重算改编结构</button>
                        <button id="rebuild-visual-bible-btn" type="button" class="preview-inline-btn">重建视觉圣经</button>
                        <button id="apply-project-refinement-btn" type="button" class="preview-inline-btn">应用校正参数</button>
                        <button id="export-project-package-btn" type="button" class="preview-inline-btn">导出项目包</button>
                    </div>
                </article>
            </div>

            <div class="preview-item-actions preview-actions-grid">
                <button id="optimize-project-inline-btn" type="button" class="preview-inline-btn">一键优化项目</button>
                <button id="generate-base-assets" type="button" class="preview-inline-btn">生成角色/地点基准图</button>
            </div>
            <div id="project-asset-list" class="preview-edit-stack"></div>
            <div id="project-optimization-report" class="preview-edit-stack">${optimizationHtml}</div>
            <div class="preview-content">
                <p>角色基准图建议：${escapeHtml(characterHints || '先确认角色后再生成')}</p>
                <p>场景基准图建议：${escapeHtml(locationHints || '先确认地点后再生成')}</p>
                <p>视觉氛围：${escapeHtml(atmosphere)}</p>
                <p>改编策略：${escapeHtml(project.gameDesign?.adaptationProfile || getAdaptationModeLabel(project.adaptationMode || 'balanced'))} · ${escapeHtml(branchSummary)}</p>
            </div>
        `;
        renderProjectAssetList(project.visualBible?.assetIndex || []);
        document.getElementById('optimize-project-inline-btn')?.addEventListener('click', async () => {
            await optimizeProject();
        });
        document.getElementById('generate-base-assets')?.addEventListener('click', async () => {
            await generateBaseAssetsForProject();
        });
        document.getElementById('rebuild-adaptation-btn')?.addEventListener('click', async () => {
            await rebuildProjectAdaptation();
        });
        document.getElementById('rebuild-visual-bible-btn')?.addEventListener('click', async () => {
            await rebuildProjectVisualBible();
        });
        document.getElementById('apply-project-refinement-btn')?.addEventListener('click', async () => {
            await applyProjectRefinement();
        });
        document.getElementById('export-project-package-btn')?.addEventListener('click', async () => {
            await exportProjectPackage();
        });
    }
}

// ---------------------------------------------------------------------------
// Optimization / refinement actions
// ---------------------------------------------------------------------------

async function optimizeProject() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在分析并优化项目结构...', 'pending');
    try {
        const savedProject = await saveImportedProjectEdits({ showStatus: false });
        if (!savedProject) {
            return;
        }

        const result = await requestJson(
            `/projects/${state.currentProjectId}/optimize`,
            createJsonRequest('POST', {
                preserveAssets: true
            })
        );
        state.currentProjectData = result.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);
        const score = result.optimizationReport?.overallScore ?? state.currentProjectData?.optimizationReport?.overallScore ?? 0;
        setImportPreviewStatus(`项目优化完成，当前综合评分 ${score}。`, 'success');
    } catch (error) {
        setImportPreviewStatus(`项目优化失败：${error.message}`, 'error');
    }
}

async function resumeProjectPlay(restart = false) {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus(restart ? '正在重启试玩版本...' : '正在恢复试玩版本...', 'pending');

    try {
        const config = getEffectiveGenerationConfig();
        const result = await requestJson(
            `/projects/${state.currentProjectId}/play`,
            createJsonRequest('POST', {
                restart,
                config: config.imageSource === 'comfyui'
                    ? { ...config, ...readLiveComfyUIConfig() }
                    : config
            })
        );

        state.currentGameId = result.gameId;
        state.sceneImages = [];
        state.selectedSceneImageIndex = 0;
        state.activeSceneImage = '';
        state.transitioningSceneImage = '';
        state.currentVisualSignature = '';
        document.getElementById('game-log').innerHTML = '';

        // Dynamic import to avoid circular dependency with game.js
        const gameModule = await import('./game.js');
        gameModule.showChoices([]);
        gameModule.renderSceneImages([]);

        showScreen('game-screen');
        gameModule.renderGameState(result.gameState);
        setImportPreviewStatus(result.resumed ? '已恢复到上次试玩进度。' : '已载入试玩版本。', 'success');
    } catch (error) {
        setImportPreviewStatus(`试玩恢复失败：${error.message}`, 'error');
    }
}

async function generateBaseAssetsForProject() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    const config = getEffectiveGenerationConfig();
    if (!config.enableImages || config.imageSource === 'none') {
        setImportPreviewStatus('当前图像生成未启用，将先以规划模式创建资产索引。', 'pending');
    } else {
        setImportPreviewStatus('正在生成角色/地点基准图，请稍候...', 'pending');
    }

    try {
        const payload = {
            dryRun: !config.enableImages || config.imageSource === 'none',
            characterLimit: 4,
            locationLimit: 4,
            imageConfig: config.imageSource === 'comfyui'
                ? { ...config, ...readLiveComfyUIConfig() }
                : config
        };

        const result = await requestJson(
            `/projects/${state.currentProjectId}/assets/generate-base`,
            createJsonRequest('POST', payload)
        );

        const projectData = await requestJson(`/projects/${state.currentProjectId}`);
        state.currentProjectData = projectData.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);

        setImportPreviewStatus(
            payload.dryRun
                ? `已创建 ${result.generatedAssets?.length || 0} 条资产规划。`
                : `已生成 ${result.generatedAssets?.length || 0} 个基准资产。`,
            'success'
        );
    } catch (error) {
        setImportPreviewStatus(`基准图生成失败：${error.message}`, 'error');
    }
}

function collectProjectRefinementPayload() {
    const stylePreset = document.getElementById('preview-style-preset')?.value.trim() || '';
    const pacing = document.getElementById('preview-pacing')?.value || 'balanced';
    const adaptationStrength = Number(document.getElementById('preview-adaptation-strength')?.value ?? 0.5);

    return {
        pacing,
        refinement: {
            adaptationStrength: Number.isFinite(adaptationStrength) ? Math.max(0, Math.min(1, adaptationStrength)) : 0.5
        },
        styleProfile: stylePreset ? { stylePreset } : {}
    };
}

async function rebuildProjectAdaptation() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在重算改编结构...', 'pending');
    try {
        const edits = collectImportedProjectEdits();
        const result = await requestJson(
            `/projects/${state.currentProjectId}/adaptation/rebuild`,
            createJsonRequest('POST', {
                gameType: edits.gameType,
                adaptationMode: edits.adaptationMode
            })
        );
        state.currentProjectData = result.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);
        setImportPreviewStatus('改编结构已重算。', 'success');
    } catch (error) {
        setImportPreviewStatus(`重算失败：${error.message}`, 'error');
    }
}

async function rebuildProjectVisualBible() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在重建视觉圣经...', 'pending');
    try {
        const payload = collectProjectRefinementPayload();
        const result = await requestJson(
            `/projects/${state.currentProjectId}/visual-bible/rebuild`,
            createJsonRequest('POST', {
                styleProfile: payload.styleProfile
            })
        );
        state.currentProjectData = result.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);
        setImportPreviewStatus('视觉圣经已重建。', 'success');
    } catch (error) {
        setImportPreviewStatus(`重建失败：${error.message}`, 'error');
    }
}

async function applyProjectRefinement() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在应用校正参数...', 'pending');
    try {
        const edits = collectImportedProjectEdits();
        const payload = collectProjectRefinementPayload();
        const result = await requestJson(
            `/projects/${state.currentProjectId}/refine`,
            createJsonRequest('POST', {
                ...payload,
                adaptationMode: edits.adaptationMode
            })
        );
        state.currentProjectData = result.project || state.currentProjectData;
        renderImportedProjectPreview(state.currentProjectData);
        setImportPreviewStatus('校正参数已应用。', 'success');
    } catch (error) {
        setImportPreviewStatus(`应用失败：${error.message}`, 'error');
    }
}

async function exportProjectPackage() {
    if (!state.currentProjectId) {
        setImportPreviewStatus('请先导入并保存项目。', 'error');
        return;
    }

    setImportPreviewStatus('正在导出项目包...', 'pending');
    try {
        const result = await requestJson(`/projects/${state.currentProjectId}/export-package`);
        const pkg = result.package || {};
        const { downloadJsonFile } = await import('./utils.js');
        const fileName = `${(state.currentProjectData?.title || 'project').replace(/[\\/:*?"<>|]/g, '_')}_package.json`;
        downloadJsonFile(fileName, pkg);
        setImportPreviewStatus('项目包导出成功。', 'success');
    } catch (error) {
        setImportPreviewStatus(`导出失败：${error.message}`, 'error');
    }
}

async function saveImportedProjectEdits(options = {}) {
    if (!state.currentProjectId) {
        setImportPreviewStatus('当前没有可保存的导入项目，请重新导入。', 'error');
        return null;
    }

    const showStatus = options.showStatus !== false;
    if (showStatus) {
        setImportPreviewStatus('正在保存导入项目修改...', 'pending');
    }

    try {
        const result = await requestJson(
            `/projects/${state.currentProjectId}/update`,
            createJsonRequest('POST', { edits: collectImportedProjectEdits() })
        );

        state.currentProjectData = result.project || state.currentProjectData;
        if (state.currentProjectData) {
            document.getElementById('import-title').value = state.currentProjectData.title || '';
        }

        renderImportedProjectPreview(state.currentProjectData);

        if (showStatus) {
            setImportPreviewStatus(options.successMessage || '导入项目修改已保存。', 'success');
        }

        return state.currentProjectData;
    } catch (error) {
        console.error('Save imported project edits error:', error);
        if (showStatus) {
            setImportPreviewStatus(error.message, 'error');
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
// Project list
// ---------------------------------------------------------------------------

async function loadImportedProjects() {
    const container = document.getElementById('import-project-list');
    if (!container) {
        return;
    }

    container.innerHTML = '<p class="empty-hint">正在加载项目列表...</p>';

    try {
        const data = await requestJson('/projects');
        const projects = Array.isArray(data.projects) ? data.projects : [];

        if (!projects.length) {
            container.innerHTML = '<p class="empty-hint">还没有导入项目。</p>';
            return;
        }

        container.innerHTML = projects.map((project) => `
            <article class="import-project-card" data-project-id="${escapeAttribute(project.id)}">
                <div class="import-project-main">
                    <strong>${escapeHtml(project.title || '未命名项目')}</strong>
                    <p>${escapeHtml(project.summary || '暂无摘要')}</p>
                    <div class="import-project-meta">
                        <span>${escapeHtml(gameTypeNames[project.gameType] || '自定义 RPG')}</span>
                        <span>${escapeHtml(getAdaptationModeLabel(project.adaptationMode || 'balanced'))}</span>
                        <span>${escapeHtml(new Date(project.updatedAt || project.createdAt || Date.now()).toLocaleString())}</span>
                    </div>
                </div>
                <div class="import-project-actions">
                    <button type="button" class="preview-inline-btn" data-action="open">继续编辑</button>
                    <button type="button" class="preview-inline-btn danger" data-action="delete">删除</button>
                </div>
            </article>
        `).join('');

        container.querySelectorAll('[data-action="open"]').forEach((button) => {
            button.addEventListener('click', async () => {
                const card = button.closest('[data-project-id]');
                const projectId = card?.getAttribute('data-project-id');
                if (!projectId) {
                    return;
                }

                await openImportedProject(projectId);
            });
        });

        container.querySelectorAll('[data-action="delete"]').forEach((button) => {
            button.addEventListener('click', async () => {
                const card = button.closest('[data-project-id]');
                const projectId = card?.getAttribute('data-project-id');
                if (!projectId) {
                    return;
                }

                await deleteImportedProject(projectId);
            });
        });
    } catch (error) {
        container.innerHTML = `<p class="empty-hint">项目列表加载失败：${escapeHtml(error.message)}</p>`;
    }
}

async function openImportedProject(projectId) {
    try {
        const data = await requestJson(`/projects/${projectId}`);
        state.currentProjectId = data.project?.id || projectId;
        state.currentProjectData = data.project || null;
        state.currentGameType = data.project?.gameType || state.currentGameType;

        if (state.currentProjectData) {
            document.getElementById('import-title').value = state.currentProjectData.title || '';
            state.currentGameType = state.currentProjectData.gameType || state.currentGameType;
        }

        renderImportedProjectPreview(state.currentProjectData);
        setImportStatus('已加载导入项目，你可以继续修改。', 'success');
        setImportPreviewStatus('项目已加载，可直接修改并继续进入工作台。');
        showScreen('import-preview-screen');
    } catch (error) {
        setImportStatus(`加载项目失败：${error.message}`, 'error');
    }
}

async function deleteImportedProject(projectId) {
    if (!confirm('确定删除这个导入项目吗？删除后不可恢复。')) {
        return;
    }

    try {
        await requestJson(`/projects/${projectId}`, createJsonRequest('DELETE', {}));
        if (state.currentProjectId === projectId) {
            state.currentProjectId = null;
            state.currentProjectData = null;
        }
        await loadImportedProjects();
        setImportStatus('项目已删除。', 'success');
    } catch (error) {
        setImportStatus(`删除项目失败：${error.message}`, 'error');
    }
}

// ---------------------------------------------------------------------------
// Render helpers for optimization report visuals
// ---------------------------------------------------------------------------

function renderProjectAssetList(assets = []) {
    const container = document.getElementById('project-asset-list');
    if (!container) {
        return;
    }

    if (!Array.isArray(assets) || !assets.length) {
        container.innerHTML = '<p class="empty-hint">暂无视觉资产，可先生成基准图。</p>';
        return;
    }

    container.innerHTML = assets.slice(0, 8).map((asset) => `
        <article class="preview-edit-item">
            <strong>${escapeHtml(asset.targetName || asset.type || '未命名资产')}</strong>
            <span class="helper-text">${escapeHtml(asset.type || 'asset')} · ${escapeHtml(asset.status || 'planned')}</span>
            ${asset.imageUrl ? `<img src="${asset.imageUrl}" alt="${escapeAttribute(asset.targetName || '资产图')}" style="width:100%;border-radius:8px;" />` : ''}
        </article>
    `).join('');
}

function renderRelationshipGraph(graph = {}) {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const edges = Array.isArray(graph?.edges) ? graph.edges : [];
    const hubs = Array.isArray(graph?.hubs) ? graph.hubs : [];

    return `
        <div class="candidate-block">
            <div class="candidate-label">关系图</div>
            <div class="relation-graph">
                <div class="relation-graph-nodes">
                    ${nodes.length
                        ? nodes.map((node) => `
                            <div class="relation-node">
                                <strong>${escapeHtml(node.name || '未命名角色')}</strong>
                                <span>${escapeHtml(node.role || '角色')}</span>
                            </div>
                        `).join('')
                        : '<div class="relation-empty">当前还没有足够清晰的人物节点。</div>'}
                </div>
                <div class="relation-graph-edges">
                    ${edges.length
                        ? edges.map((edge) => `
                            <div class="relation-edge">
                                <div class="relation-edge-main">${escapeHtml(edge.source || '未知')} → ${escapeHtml(edge.target || '未知')}</div>
                                <div class="relation-edge-meta">${escapeHtml(edge.relation || '待确认')} · 张力 ${escapeHtml(edge.tension || '中')}</div>
                            </div>
                        `).join('')
                        : '<div class="relation-empty">当前还没有识别到稳定关系。</div>'}
                </div>
                <div class="relation-graph-hubs">
                    <div class="relation-subtitle">关系中心</div>
                    ${hubs.length
                        ? hubs.map((hub, index) => `
                            <div class="relation-hub">
                                <span>#${index + 1}</span>
                                <strong>${escapeHtml(hub.name || '未命名角色')}</strong>
                                <em>连接数 ${escapeHtml(String(hub.degree || 0))}</em>
                            </div>
                        `).join('')
                        : '<div class="relation-empty">暂无明显中心人物。</div>'}
                </div>
            </div>
        </div>
    `;
}

function renderPlayableChapterTree(chapters = []) {
    const items = Array.isArray(chapters) ? chapters : [];

    return `
        <div class="candidate-block">
            <div class="candidate-label">章节可玩点树</div>
            <div class="chapter-play-tree">
                ${items.length
                    ? items.map((chapter, index) => `
                        <article class="chapter-play-card">
                            <div class="chapter-play-header">
                                <span class="chapter-play-index">CH ${index + 1}</span>
                                <strong>${escapeHtml(chapter.title || `章节 ${index + 1}`)}</strong>
                            </div>
                            <div class="chapter-play-body">
                                <p><span>冲突</span>${escapeHtml(chapter.conflict || '待补充')}</p>
                                <p><span>风险</span>${escapeHtml(chapter.stakes || '待补充')}</p>
                                <p><span>互动类型</span>${escapeHtml((chapter.interactiveTypes || []).join('、') || '待补充')}</p>
                                <p><span>关键节点</span>${escapeHtml((chapter.keyNodes || []).join('、') || '待补充')}</p>
                                <p><span>分支槽位</span>${escapeHtml(String(chapter.branchSlotCount || 0))}</p>
                            </div>
                        </article>
                    `).join('')
                    : '<div class="relation-empty">当前还没有足够的章节可玩点。</div>'}
            </div>
        </div>
    `;
}
