/**
 * Global application state and state helpers.
 */

export const API_BASE = '/api';

export const LLM_SETTINGS_KEY = 'rpg_generator_settings';
export const GENERATION_SETTINGS_KEY = 'rpg_generator_generation_settings';

export const state = {
    currentGameType: null,
    currentProjectId: null,
    currentProjectData: null,
    currentGameId: null,
    currentGameData: null,
    gameState: null,
    currentGenerationConfig: null,
    currentSessionId: null,
    currentStepId: null,
    allSteps: [],
    stepStates: {},
    sceneImages: [],
    selectedSceneImageIndex: 0,
    lastSuggestedImagePrompt: '',
    activeSceneImage: '',
    transitioningSceneImage: '',
    currentVisualSignature: '',
    sceneImageTransitionToken: 0,
    runtimeSnapshotTimer: null,
    runtimeSnapshotSaving: false
};

export const gameTypeNames = {
    adventure: '冒险 RPG',
    dungeon: '地牢探索',
    romance: '恋爱模拟',
    mystery: '推理解谜',
    fantasy: '奇幻魔法',
    scifi: '科幻星际',
    survival: '生存挑战',
    kingdom: '王国建设',
    cultivation: '修仙问道',
    custom: '自定义 RPG'
};

export const adaptationModeNames = {
    faithful: '忠于原著',
    balanced: '平衡改编',
    free: '高自由互动'
};

export const pacingNames = {
    slow: '慢节奏',
    balanced: '平衡',
    fast: '快节奏'
};

export const stepDescriptions = {
    worldview: { icon: '世', name: '世界观', desc: '先确定世界背景、主要势力、地点与规则。' },
    coreCharacters: { icon: '核', name: '核心角色', desc: '生成推动主线的关键角色。' },
    secondaryCharacters: { icon: '辅', name: '次要角色', desc: '补充世界细节与互动节点。' },
    items: { icon: '物', name: '物品道具', desc: '生成装备、任务物品和关键奖励。' },
    puzzles: { icon: '谜', name: '谜题挑战', desc: '设计挑战、机关和探索障碍。' },
    mainPlot: { icon: '主', name: '主线剧情', desc: '组织章节推进与核心冲突。' },
    sidePlots: { icon: '支', name: '支线剧情', desc: '补充可选故事和人物支线。' },
    fragments: { icon: '碎', name: '碎片内容', desc: '生成可探索的世界细节与传闻。' },
    integration: { icon: '整', name: '整合方案', desc: '把已确认内容整合成最终可玩的方案。' }
};

export function getStepState(stepId) {
    if (!state.stepStates[stepId]) {
        state.stepStates[stepId] = {
            candidates: [],
            selectedIndex: -1,
            status: 'idle',
            history: []
        };
    }

    return state.stepStates[stepId];
}
