class StoryParser {
    parseImportedText(payload = {}) {
        const title = String(payload.title || '未命名长文本项目').trim();
        const content = this.normalizeText(payload.content || '');
        const gameType = payload.gameType || 'custom';
        const adaptationMode = payload.adaptationMode || 'balanced';
        const chapters = this.extractChapters(content);
        const summary = this.buildSummary(chapters, content);
        const characters = this.extractCharacters(content);
        const locations = this.extractLocations(content);
        const sourceDocument = {
            title,
            mode: 'novel_import',
            content,
            excerpt: content.slice(0, 1200),
            wordCount: content.length,
            paragraphCount: content ? content.split(/\n{2,}/).filter(Boolean).length : 0,
            importedAt: new Date().toISOString()
        };

        const storyBible = {
            title,
            summary,
            themes: this.inferThemes(content),
            worldview: {
                worldName: title,
                description: summary,
                era: '待确认',
                factions: [],
                locations,
                rules: [],
                atmosphere: this.inferAtmosphere(content),
                history: chapters.slice(0, 5).map((chapter) => chapter.summary).filter(Boolean).join(' ')
            },
            characters,
            locations,
            chapters,
            events: this.buildEventsFromChapters(chapters),
            relationships: [],
            rules: [],
            timeline: chapters.map((chapter, index) => ({
                id: `timeline_${index + 1}`,
                label: chapter.title,
                summary: chapter.summary
            }))
        };

        return {
            sourceDocument,
            storyBible,
            gameDesign: this.buildGameDesign(storyBible, { gameType, adaptationMode }),
            visualBible: this.buildVisualBible(storyBible),
            seedData: this.buildSeedData(storyBible, { gameType, adaptationMode })
        };
    }

    normalizeText(content) {
        return String(content || '')
            .replace(/\r\n/g, '\n')
            .replace(/\u3000/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    extractChapters(content) {
        if (!content) {
            return [];
        }

        const headingRegex = /^(第.{1,12}[章节回幕卷]|chapter\s+\d+|chap\.\s*\d+).*$|^#+\s*.+$/gim;
        const matches = Array.from(content.matchAll(headingRegex));

        if (!matches.length) {
            return this.extractParagraphChapters(content);
        }

        const chapters = [];
        for (let index = 0; index < matches.length; index += 1) {
            const match = matches[index];
            const start = match.index ?? 0;
            const end = index + 1 < matches.length ? (matches[index + 1].index ?? content.length) : content.length;
            const block = content.slice(start, end).trim();
            const [rawTitle, ...bodyLines] = block.split('\n');
            const body = bodyLines.join('\n').trim();

            chapters.push({
                id: `chapter_${index + 1}`,
                title: rawTitle.trim(),
                summary: this.summarizeBlock(body || rawTitle),
                excerpt: body.slice(0, 1000),
                order: index + 1
            });
        }

        return chapters;
    }

    extractParagraphChapters(content) {
        const blocks = content.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
        const size = Math.max(1, Math.ceil(blocks.length / 6));
        const chapters = [];

        for (let index = 0; index < blocks.length; index += size) {
            const slice = blocks.slice(index, index + size);
            const order = chapters.length + 1;
            const body = slice.join('\n\n');
            chapters.push({
                id: `chapter_${order}`,
                title: `导入章节 ${order}`,
                summary: this.summarizeBlock(body),
                excerpt: body.slice(0, 1000),
                order
            });
        }

        return chapters;
    }

    summarizeBlock(block) {
        return String(block || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 220);
    }

    buildSummary(chapters, content) {
        if (chapters.length > 0) {
            return chapters.slice(0, 3).map((chapter) => chapter.summary).join(' ');
        }

        return this.summarizeBlock(content);
    }

    extractCharacters(content) {
        const patterns = [
            /([\u4e00-\u9fa5]{2,4})(?:说道|说|问道|答道|看着|转身|点头|笑了)/g,
            /(?:主角|少年|少女|男人|女人|老师|师父|皇帝|王子|公主|将军|侍女)[:： ]?([\u4e00-\u9fa5]{2,4})/g
        ];
        const counts = new Map();

        patterns.forEach((pattern) => {
            for (const match of content.matchAll(pattern)) {
                const name = String(match[1] || '').trim();
                if (!name || this.isLikelyNoise(name)) {
                    continue;
                }

                counts.set(name, (counts.get(name) || 0) + 1);
            }
        });

        return [...counts.entries()]
            .sort((left, right) => right[1] - left[1])
            .slice(0, 8)
            .map(([name], index) => ({
                id: `import_char_${index + 1}`,
                name,
                role: index < 3 ? '核心角色' : '次要角色',
                description: `从导入文本中提取的角色：${name}`,
                personality: '待补充',
                tone: '待补充',
                motivation: '待补充',
                worldConnection: '来源于导入长文本'
            }));
    }

    extractLocations(content) {
        const pattern = /(?:在|来到|前往|进入|抵达)([\u4e00-\u9fa5]{2,8}(?:城|镇|村|山|谷|宫|殿|楼|阁|馆|寺|林|海|岛|河|湖))/g;
        const counts = new Map();

        for (const match of content.matchAll(pattern)) {
            const name = String(match[1] || '').trim();
            if (!name || this.isLikelyNoise(name)) {
                continue;
            }

            counts.set(name, (counts.get(name) || 0) + 1);
        }

        return [...counts.entries()]
            .sort((left, right) => right[1] - left[1])
            .slice(0, 8)
            .map(([name], index) => ({
                id: `import_loc_${index + 1}`,
                name,
                description: `从导入文本中识别的地点：${name}`,
                dangerLevel: 2
            }));
    }

    inferThemes(content) {
        const themeKeywords = [
            ['复仇', ['复仇', '报仇']],
            ['成长', ['成长', '修行', '觉醒']],
            ['悬疑', ['真相', '谜团', '线索']],
            ['爱情', ['爱', '喜欢', '心动']],
            ['权谋', ['朝堂', '权力', '帝国', '王国']],
            ['冒险', ['旅途', '冒险', '遗迹']],
            ['生存', ['末日', '求生', '饥饿']],
            ['奇幻', ['魔法', '精灵', '巨龙', '仙']],
            ['科幻', ['星舰', '机甲', '实验室', 'AI']]
        ];

        return themeKeywords
            .filter(([, keywords]) => keywords.some((keyword) => content.includes(keyword)))
            .map(([theme]) => theme)
            .slice(0, 5);
    }

    inferAtmosphere(content) {
        if (/(悬疑|阴影|诡异|血|恐惧)/.test(content)) {
            return '紧张神秘';
        }

        if (/(温暖|日常|微风|笑容|治愈)/.test(content)) {
            return '温暖细腻';
        }

        if (/(战争|王城|权力|军队|征伐)/.test(content)) {
            return '宏大压迫';
        }

        return '待确认';
    }

    buildEventsFromChapters(chapters) {
        return chapters.map((chapter, index) => ({
            id: `event_${index + 1}`,
            title: chapter.title,
            summary: chapter.summary,
            chapterId: chapter.id
        }));
    }

    buildGameDesign(storyBible, options = {}) {
        const chapters = storyBible.chapters || [];
        return {
            adaptationMode: options.adaptationMode || 'balanced',
            gameType: options.gameType || 'custom',
            playerRole: '原著主角视角',
            mainAnchors: chapters.slice(0, 5).map((chapter) => ({
                id: chapter.id,
                title: chapter.title,
                summary: chapter.summary
            })),
            branches: [],
            quests: chapters.slice(0, 5).map((chapter, index) => ({
                id: `import_quest_${index + 1}`,
                name: chapter.title,
                description: chapter.summary
            })),
            puzzles: [],
            endings: [],
            chapterFlow: chapters.map((chapter) => ({
                chapterId: chapter.id,
                title: chapter.title,
                playableGoal: chapter.summary
            }))
        };
    }

    buildVisualBible(storyBible) {
        return {
            styleProfile: {
                title: storyBible.title,
                atmosphere: storyBible.worldview?.atmosphere || '待确认',
                themes: storyBible.themes || []
            },
            characterSheets: (storyBible.characters || []).map((character) => ({
                id: character.id,
                name: character.name,
                promptHint: `${character.name}，${character.role}，统一画风角色参考图`
            })),
            locationSheets: (storyBible.locations || []).map((location) => ({
                id: location.id,
                name: location.name,
                promptHint: `${location.name}，统一画风场景参考图`
            })),
            sceneTemplates: [],
            promptTemplates: {
                characterBase: '统一风格角色设定图，突出服装、年龄、气质',
                locationBase: '统一风格场景设定图，突出空间结构与氛围'
            },
            seedPolicy: {
                mode: 'reuse_base_seed'
            },
            assetIndex: []
        };
    }

    buildSeedData(storyBible, options = {}) {
        const chapters = storyBible.chapters || [];
        const characters = storyBible.characters || [];

        return {
            worldview: storyBible.worldview || {},
            coreCharacters: characters.slice(0, 4),
            secondaryCharacters: characters.slice(4),
            items: [],
            puzzles: [],
            mainPlot: {
                title: storyBible.title,
                summary: storyBible.summary,
                theme: (storyBible.themes || []).join('、'),
                chapters: chapters.map((chapter, index) => ({
                    id: chapter.id,
                    name: chapter.title,
                    title: chapter.title,
                    description: chapter.summary,
                    goal: `推进到${chapter.title}`,
                    conflict: chapter.summary,
                    order: index + 1
                }))
            },
            sidePlots: [],
            fragments: chapters.map((chapter) => ({
                id: `fragment_${chapter.id}`,
                name: chapter.title,
                type: '章节摘录',
                content: chapter.excerpt
            })),
            integration: {
                gameName: storyBible.title,
                gameplayDesign: `${options.adaptationMode || 'balanced'} 模式改编自导入长文本`,
                openingScene: {
                    description: chapters[0]?.summary || storyBible.summary,
                    narration: chapters[0]?.excerpt?.slice(0, 220) || storyBible.summary,
                    startingLocation: storyBible.locations?.[0]?.name || '起始地点',
                    mood: storyBible.worldview?.atmosphere || '待确认'
                },
                gameSystems: {}
            }
        };
    }

    isLikelyNoise(value) {
        return /^(自己|他们|我们|那里|这里|如果|但是|于是|然后)$/.test(value);
    }
}

module.exports = StoryParser;
