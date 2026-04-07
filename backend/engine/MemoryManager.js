class MemoryManager {
    constructor(userInput, gameType) {
        this.globalContext = {
            userInput,
            gameType,
            confirmedElements: [],
            constraints: []
        };
        this.workingMemory = {};
        this.elementStore = {
            worldview: null,
            coreCharacters: [],
            secondaryCharacters: [],
            items: [],
            puzzles: [],
            mainPlot: null,
            sidePlots: [],
            fragments: [],
            integration: null,
            summary: ''
        };
    }

    getCategoryForStep(stepId) {
        const categoryMap = {
            worldview: 'worldview',
            coreCharacters: 'coreCharacters',
            secondaryCharacters: 'secondaryCharacters',
            items: 'items',
            puzzles: 'puzzles',
            mainPlot: 'mainPlot',
            sidePlots: 'sidePlots',
            fragments: 'fragments',
            integration: 'integration'
        };

        return categoryMap[stepId] || stepId;
    }

    confirmStep(stepId, data) {
        this.addElement(this.getCategoryForStep(stepId), data);
    }

    addElement(category, data) {
        if (Array.isArray(data)) {
            this.elementStore[category] = [...(this.elementStore[category] || []), ...data];
        } else {
            this.elementStore[category] = data;
        }

        if (!this.globalContext.confirmedElements.includes(category)) {
            this.globalContext.confirmedElements.push(category);
        }

        this.updateSummary();
    }

    updateElement(category, idOrIndex, newData) {
        const resolvedCategory = this.getCategoryForStep(category);
        const currentValue = this.elementStore[resolvedCategory];

        if (Array.isArray(currentValue)) {
            const index = typeof idOrIndex === 'number'
                ? idOrIndex
                : currentValue.findIndex((item) => item.id === idOrIndex || item.name === idOrIndex);

            if (index !== -1) {
                currentValue[index] = newData && typeof newData === 'object'
                    ? { ...currentValue[index], ...newData }
                    : newData;
            }
        } else if (currentValue) {
            this.elementStore[resolvedCategory] = newData && typeof newData === 'object'
                ? { ...currentValue, ...newData }
                : newData;
        }

        this.updateSummary();
    }

    getElement(category) {
        return this.elementStore[this.getCategoryForStep(category)];
    }

    removeElement(category, idOrIndex) {
        const resolvedCategory = this.getCategoryForStep(category);
        const currentValue = this.elementStore[resolvedCategory];

        if (Array.isArray(currentValue)) {
            const index = typeof idOrIndex === 'number'
                ? idOrIndex
                : currentValue.findIndex((item) => item.id === idOrIndex || item.name === idOrIndex);

            if (index !== -1) {
                currentValue.splice(index, 1);
            }
        }

        this.updateSummary();
    }

    buildContextForStep(stepId) {
        const store = this.elementStore;
        const ctx = this.globalContext;

        const baseContext = {
            userInput: ctx.userInput,
            gameType: ctx.gameType,
            confirmedSteps: ctx.confirmedElements,
            summary: store.summary
        };

        switch (stepId) {
            case 'worldview':
                return { ...baseContext };
            case 'coreCharacters':
                return { ...baseContext, worldview: store.worldview };
            case 'secondaryCharacters':
                return { ...baseContext, worldview: store.worldview, coreCharacters: store.coreCharacters };
            case 'items':
                return {
                    ...baseContext,
                    worldview: store.worldview,
                    coreCharacters: store.coreCharacters,
                    secondaryCharacters: store.secondaryCharacters
                };
            case 'puzzles':
                return {
                    ...baseContext,
                    worldview: store.worldview,
                    locations: store.worldview?.locations || [],
                    characters: [...store.coreCharacters, ...store.secondaryCharacters]
                };
            case 'mainPlot':
                return {
                    ...baseContext,
                    worldview: store.worldview,
                    coreCharacters: store.coreCharacters,
                    secondaryCharacters: store.secondaryCharacters,
                    items: store.items,
                    puzzles: store.puzzles
                };
            case 'sidePlots':
                return {
                    ...baseContext,
                    worldview: store.worldview,
                    characters: [...store.coreCharacters, ...store.secondaryCharacters],
                    mainPlot: store.mainPlot,
                    items: store.items
                };
            case 'fragments':
                return {
                    ...baseContext,
                    worldview: store.worldview,
                    characters: [...store.coreCharacters, ...store.secondaryCharacters],
                    mainPlot: store.mainPlot,
                    sidePlots: store.sidePlots,
                    items: store.items,
                    puzzles: store.puzzles
                };
            case 'integration':
                return {
                    ...baseContext,
                    worldview: store.worldview,
                    coreCharacters: store.coreCharacters,
                    secondaryCharacters: store.secondaryCharacters,
                    items: store.items,
                    puzzles: store.puzzles,
                    mainPlot: store.mainPlot,
                    sidePlots: store.sidePlots,
                    fragments: store.fragments,
                    integration: store.integration
                };
            default:
                return baseContext;
        }
    }

    updateSummary() {
        const store = this.elementStore;
        const parts = [];

        if (store.worldview) {
            parts.push(`世界：${store.worldview.worldName || '未命名'}（${store.worldview.era || '未知时代'}）`);
        }

        if (store.coreCharacters.length > 0) {
            parts.push(`核心角色：${store.coreCharacters.map((item) => item.name).join('、')}`);
        }

        if (store.secondaryCharacters.length > 0) {
            parts.push(`次要角色：${store.secondaryCharacters.map((item) => item.name).join('、')}`);
        }

        if (store.items.length > 0) {
            parts.push(`物品道具：${store.items.slice(0, 5).map((item) => item.name).join('、')}`);
        }

        if (store.puzzles.length > 0) {
            parts.push(`谜题挑战：${store.puzzles.slice(0, 3).map((item) => item.name || '未命名').join('、')}`);
        }

        if (store.mainPlot) {
            parts.push(`主线剧情：${(store.mainPlot.summary || store.mainPlot.title || '').substring(0, 200)}`);
        }

        if (store.sidePlots.length > 0) {
            parts.push(`支线剧情：${store.sidePlots.map((item) => item.name).join('、')}`);
        }

        if (store.fragments.length > 0) {
            parts.push(`碎片内容：${store.fragments.map((item) => item.name || item.type).join('、')}`);
        }

        if (store.integration?.gameName) {
            parts.push(`整合方案：${store.integration.gameName}`);
        }

        this.elementStore.summary = parts.join('\n');
    }

    exportGameData() {
        const store = this.elementStore;
        const integration = store.integration || {};

        return {
            id: Date.now().toString(),
            type: this.globalContext.gameType,
            name: integration.gameName || integration.name,
            worldview: store.worldview || {},
            characters: [...store.coreCharacters, ...store.secondaryCharacters],
            coreCharacters: store.coreCharacters,
            secondaryCharacters: store.secondaryCharacters,
            items: store.items,
            puzzles: store.puzzles,
            mainPlot: store.mainPlot,
            sidePlots: store.sidePlots,
            fragments: store.fragments,
            summary: store.summary,
            integration,
            gameplayDesign: integration.gameplayDesign || '',
            balancingNotes: integration.balancingNotes || '',
            gameSystems: integration.gameSystems || {},
            openingScene: integration.openingScene || {}
        };
    }

    buildConsistencyPrompt() {
        const store = this.elementStore;
        const checks = [];

        if (store.worldview && store.mainPlot) {
            checks.push('检查主线剧情是否与世界观设定一致。');
        }

        if (store.coreCharacters.length > 0 && store.mainPlot) {
            checks.push('检查主线剧情是否正确使用核心角色。');
        }

        if (store.sidePlots.length > 0 && store.mainPlot) {
            checks.push('检查支线剧情是否与主线有关联且不冲突。');
        }

        return checks;
    }
}

module.exports = MemoryManager;

