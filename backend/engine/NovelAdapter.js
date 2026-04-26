class NovelAdapter {
    buildGameDesign(storyBible, options = {}) {
        const chapters = Array.isArray(storyBible?.chapters) ? storyBible.chapters : [];
        const characters = Array.isArray(storyBible?.characters) ? storyBible.characters : [];
        const relationships = Array.isArray(storyBible?.relationships) ? storyBible.relationships : [];
        const adaptationMode = options.adaptationMode || 'balanced';
        const profile = this.getModeProfile(adaptationMode);
        const anchors = this.buildMainAnchors(chapters, profile);
        const branchSlots = this.buildBranchSlots(chapters, profile);
        const interactiveNodes = this.buildInteractiveNodes(chapters, characters, profile);

        return {
            adaptationMode,
            adaptationProfile: profile.name,
            playerRole: this.resolvePlayerRole(storyBible, profile, options),
            mainAnchors: anchors,
            branches: this.buildBranches(chapters, branchSlots, interactiveNodes, profile),
            branchSlots,
            quests: this.buildQuests(chapters, anchors, interactiveNodes),
            puzzles: this.buildPuzzles(chapters, profile, interactiveNodes),
            endings: this.buildEndings(profile),
            chapterFlow: this.buildChapterFlow(chapters, branchSlots, interactiveNodes, profile),
            relationshipHooks: this.buildRelationshipHooks(relationships),
            conflictMap: this.buildConflictMap(chapters),
            interactiveNodes,
            branchingPolicy: {
                maxBranchPerChapter: profile.maxBranchPerChapter,
                mustKeepAnchorRate: profile.mustKeepAnchorRate,
                allowsMajorDeviation: profile.allowsMajorDeviation,
                rewriteFreedom: profile.rewriteFreedom
            }
        };
    }

    getModeProfile(mode) {
        const profiles = {
            faithful: {
                key: 'faithful',
                name: '忠于原著',
                playerRoleHint: '原著主角视角',
                interactionLevel: '低',
                anchorCount: 6,
                requiredAnchorCount: 5,
                maxBranchPerChapter: 1,
                mustKeepAnchorRate: 0.85,
                allowsMajorDeviation: false,
                rewriteFreedom: 'low',
                endingCount: 2,
                puzzleRatio: 0.15
            },
            balanced: {
                key: 'balanced',
                name: '平衡改编',
                playerRoleHint: '核心同行者视角',
                interactionLevel: '中',
                anchorCount: 6,
                requiredAnchorCount: 4,
                maxBranchPerChapter: 2,
                mustKeepAnchorRate: 0.65,
                allowsMajorDeviation: true,
                rewriteFreedom: 'medium',
                endingCount: 3,
                puzzleRatio: 0.25
            },
            free: {
                key: 'free',
                name: '高自由互动',
                playerRoleHint: '穿越者或旁观者视角',
                interactionLevel: '高',
                anchorCount: 5,
                requiredAnchorCount: 2,
                maxBranchPerChapter: 3,
                mustKeepAnchorRate: 0.35,
                allowsMajorDeviation: true,
                rewriteFreedom: 'high',
                endingCount: 5,
                puzzleRatio: 0.35
            }
        };

        return profiles[mode] || profiles.balanced;
    }

    resolvePlayerRole(storyBible, profile, options = {}) {
        if (typeof options.playerRole === 'string' && options.playerRole.trim()) {
            return options.playerRole.trim();
        }

        const protagonist = (storyBible?.characters || []).find((item, index) => {
            if (index === 0) {
                return true;
            }
            return /主角|核心|主人公/.test(String(item.role || ''));
        });

        if (profile.key === 'faithful' && protagonist?.name) {
            return `${protagonist.name}（原著主角）`;
        }
        if (profile.key === 'balanced' && protagonist?.name) {
            return `${protagonist.name}的同行者`;
        }
        return profile.playerRoleHint;
    }

    buildMainAnchors(chapters, profile) {
        return chapters
            .slice(0, profile.anchorCount)
            .map((chapter, index) => ({
                id: `anchor_${index + 1}`,
                chapterId: chapter.id,
                title: chapter.title,
                summary: chapter.summary,
                conflict: chapter.conflict || chapter.summary,
                required: index < profile.requiredAnchorCount
            }));
    }

    buildBranchSlots(chapters, profile) {
        return chapters.map((chapter, index) => ({
            id: `slot_${index + 1}`,
            chapterId: chapter.id,
            title: chapter.title,
            slotCount: Math.min(profile.maxBranchPerChapter, Math.max(1, (index % 3) + 1)),
            interactionLevel: profile.interactionLevel,
            rewriteFreedom: profile.rewriteFreedom
        }));
    }

    buildInteractiveNodes(chapters, characters, profile) {
        const nodes = [];
        const characterNames = new Set(characters.map((item) => item.name).filter(Boolean));

        chapters.forEach((chapter, index) => {
            const hooks = Array.isArray(chapter.interactiveHooks) ? chapter.interactiveHooks : [];
            hooks.forEach((hook, hookIndex) => {
                nodes.push({
                    id: `node_${chapter.id}_${hookIndex + 1}`,
                    chapterId: chapter.id,
                    chapterTitle: chapter.title,
                    type: hook.type || this.inferInteractiveType(hook.label || chapter.summary),
                    label: hook.label || `${chapter.title}互动点 ${hookIndex + 1}`,
                    description: hook.description || chapter.summary,
                    stakes: hook.stakes || chapter.conflict || chapter.summary,
                    relatedCharacters: (hook.relatedCharacters || []).filter((name) => characterNames.has(name)),
                    required: index < profile.requiredAnchorCount
                });
            });
        });

        return nodes;
    }

    inferInteractiveType(text = '') {
        if (/(调查|线索|真相|搜寻|寻找)/.test(text)) {
            return 'investigation';
        }
        if (/(战斗|冲突|追逐|对抗|决战)/.test(text)) {
            return 'combat';
        }
        if (/(好感|关系|对话|说服|立场)/.test(text)) {
            return 'relationship';
        }
        if (/(机关|谜题|破解|试炼)/.test(text)) {
            return 'puzzle';
        }
        return 'decision';
    }

    buildBranches(chapters, branchSlots, interactiveNodes, profile) {
        const branches = [];
        for (const slot of branchSlots) {
            const chapter = chapters.find((item) => item.id === slot.chapterId);
            if (!chapter) {
                continue;
            }

            const chapterNodes = interactiveNodes.filter((item) => item.chapterId === chapter.id);
            for (let i = 0; i < slot.slotCount; i += 1) {
                const relatedNode = chapterNodes[i] || chapterNodes[0];
                branches.push({
                    id: `branch_${chapter.id}_${i + 1}`,
                    chapterId: chapter.id,
                    slotId: slot.id,
                    title: `${chapter.title} - 分支 ${i + 1}`,
                    trigger: relatedNode?.label || `在 ${chapter.title} 做出关键选择`,
                    impact: profile.allowsMajorDeviation ? '可显著影响后续章节' : '主要影响局部事件',
                    nodeType: relatedNode?.type || 'decision'
                });
            }
        }
        return branches;
    }

    buildQuests(chapters, anchors, interactiveNodes) {
        const requiredAnchorIds = new Set(anchors.filter((item) => item.required).map((item) => item.chapterId));
        return chapters.slice(0, 10).map((chapter, index) => ({
            id: `quest_${index + 1}`,
            chapterId: chapter.id,
            name: chapter.title,
            description: chapter.conflict || chapter.summary,
            main: requiredAnchorIds.has(chapter.id),
            relatedNodeIds: interactiveNodes
                .filter((item) => item.chapterId === chapter.id)
                .map((item) => item.id)
        }));
    }

    buildPuzzles(chapters, profile, interactiveNodes) {
        const preferredNodes = interactiveNodes.filter((item) => ['puzzle', 'investigation'].includes(item.type));
        const count = Math.max(1, Math.round(chapters.length * profile.puzzleRatio));
        const source = preferredNodes.length ? preferredNodes : chapters.slice(0, count);

        return source.slice(0, count).map((item, index) => ({
            id: `puzzle_${index + 1}`,
            chapterId: item.chapterId || item.id,
            title: item.label || `${item.title} - 线索谜题`,
            difficulty: profile.interactionLevel === '高' ? '中高' : '中',
            type: item.type || 'puzzle',
            description: item.description || item.summary || ''
        }));
    }

    buildEndings(profile) {
        const endings = [];
        for (let index = 0; index < profile.endingCount; index += 1) {
            endings.push({
                id: `ending_${index + 1}`,
                title: `结局 ${index + 1}`,
                tone: index === 0 ? '正向' : index === profile.endingCount - 1 ? '黑暗' : '中性'
            });
        }
        return endings;
    }

    buildChapterFlow(chapters, branchSlots, interactiveNodes, profile) {
        return chapters.map((chapter) => {
            const slot = branchSlots.find((item) => item.chapterId === chapter.id);
            const nodes = interactiveNodes.filter((item) => item.chapterId === chapter.id);
            return {
                chapterId: chapter.id,
                title: chapter.title,
                playableGoal: chapter.conflict || chapter.summary,
                interactionLevel: profile.interactionLevel,
                branchSlotCount: slot?.slotCount || 1,
                interactionTypes: [...new Set(nodes.map((item) => item.type))],
                keyNodeLabels: nodes.slice(0, 3).map((item) => item.label)
            };
        });
    }

    buildRelationshipHooks(relationships) {
        return relationships.slice(0, 12).map((item, index) => ({
            id: item.id || `rel_hook_${index + 1}`,
            pair: [item.source, item.target].filter(Boolean).join(' / '),
            relation: item.relation || '待确认',
            tension: item.tension || item.summary || ''
        }));
    }

    buildConflictMap(chapters) {
        return chapters.slice(0, 12).map((chapter, index) => ({
            id: `conflict_${index + 1}`,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            conflict: chapter.conflict || chapter.summary,
            stakes: chapter.stakes || chapter.summary
        }));
    }
}

module.exports = NovelAdapter;
