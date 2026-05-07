const NovelAdapter = require('./NovelAdapter');

class StoryParser {
    constructor() {
        this.adapter = new NovelAdapter();
    }

    parseImportedText(payload = {}) {
        const title = String(payload.title || '未命名长文本项目').trim();
        const content = this.normalizeText(payload.content || '');
        const gameType = payload.gameType || 'custom';
        const adaptationMode = payload.adaptationMode || 'balanced';

        const chapters = this.extractChapters(content);
        const summary = this.buildSummary(chapters, content);
        let characters = this.extractCharacters(content);
        const locations = this.extractLocations(content);
        const relationships = this.extractRelationships(content, characters);
        const enrichedChapters = this.enrichChapters(chapters, content, characters, locations);
        characters = this.enrichCharacterDetails(characters, enrichedChapters, summary);

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
                history: enrichedChapters.slice(0, 5).map((chapter) => chapter.summary).filter(Boolean).join(' ')
            },
            characters,
            locations,
            chapters: enrichedChapters,
            events: this.buildEventsFromChapters(enrichedChapters),
            relationships,
            rules: [],
            timeline: enrichedChapters.map((chapter, index) => ({
                id: `timeline_${index + 1}`,
                label: chapter.title,
                summary: chapter.summary
            }))
        };

        const gameDesign = this.buildGameDesign(storyBible, { gameType, adaptationMode });

        return {
            sourceDocument,
            storyBible,
            gameDesign,
            visualBible: this.buildVisualBible(storyBible),
            seedData: this.buildSeedData(storyBible, {
                gameType,
                adaptationMode,
                gameDesign
            })
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
            /(?:主角|少年|少女|男人|女人|老师|师父|皇帝|王子|公主|将军|侍女)[:：]?\s*([\u4e00-\u9fa5]{2,4})/g
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
        const pattern = /(?:在|来到|前往|进入|抵达)([\u4e00-\u9fa5]{2,8}(?:城|镇|村|山|谷|林|宫|殿|楼|阁|院|馆|寺|庙|桥|海|岛|河))/g;
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
            ['爱情', ['爱情', '喜欢', '心动']],
            ['权谋', ['朝堂', '权力', '帝国', '王国']],
            ['冒险', ['旅行', '冒险', '遗迹']],
            ['生存', ['末日', '求生', '饥荒']],
            ['奇幻', ['魔法', '精灵', '巨龙', '神话']],
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
            chapterId: chapter.id,
            conflict: chapter.conflict || '',
            stakes: chapter.stakes || '',
            interactiveHooks: chapter.interactiveHooks || []
        }));
    }

    extractRelationships(content, characters = []) {
        const names = characters.map((item) => item.name).filter(Boolean);
        const relationships = [];

        for (let i = 0; i < names.length; i += 1) {
            for (let j = i + 1; j < names.length; j += 1) {
                const source = names[i];
                const target = names[j];
                const pairPattern = new RegExp(`${source}.{0,24}${target}|${target}.{0,24}${source}`, 'g');
                const matches = content.match(pairPattern) || [];
                if (!matches.length) {
                    continue;
                }

                const samples = matches.slice(0, 3).join(' ');
                relationships.push({
                    id: `rel_${i + 1}_${j + 1}`,
                    source,
                    target,
                    relation: this.inferRelationshipType(samples),
                    summary: samples.slice(0, 120),
                    tension: this.inferRelationshipTension(samples)
                });
            }
        }

        return relationships.slice(0, 12);
    }

    inferRelationshipType(text = '') {
        if (/(师父|徒弟|老师|学生)/.test(text)) {
            return '师徒/指导';
        }
        if (/(喜欢|爱|心动|牵挂)/.test(text)) {
            return '情感关系';
        }
        if (/(敌人|仇人|追杀|背叛|对立)/.test(text)) {
            return '敌对关系';
        }
        if (/(朋友|同伴|搭档|盟友|合作)/.test(text)) {
            return '同伴关系';
        }
        if (/(父亲|母亲|哥哥|姐姐|弟弟|妹妹|家族)/.test(text)) {
            return '亲属关系';
        }
        return '待确认';
    }

    inferRelationshipTension(text = '') {
        if (/(背叛|仇恨|争执|怀疑|威胁)/.test(text)) {
            return '高';
        }
        if (/(合作|保护|陪伴|支持)/.test(text)) {
            return '低';
        }
        return '中';
    }

    enrichChapters(chapters, content, characters = [], locations = []) {
        const blocks = this.splitContentIntoChapterBlocks(content, chapters);

        return chapters.map((chapter, index) => {
            const block = blocks[index] || chapter.excerpt || chapter.summary || '';
            return {
                ...chapter,
                keyCharacters: this.extractRelatedNames(block, characters),
                keyLocations: this.extractRelatedNames(block, locations),
                conflict: this.inferConflict(block, chapter.summary),
                stakes: this.inferStakes(block, chapter.summary),
                interactiveHooks: this.extractInteractiveHooks(block, chapter)
            };
        });
    }

    splitContentIntoChapterBlocks(content, chapters) {
        if (!content || !chapters.length) {
            return [];
        }

        const blocks = [];
        const titles = chapters.map((item) => item.title).filter(Boolean);
        for (let index = 0; index < titles.length; index += 1) {
            const title = titles[index];
            const start = content.indexOf(title);
            const nextTitle = titles[index + 1];
            const end = nextTitle ? content.indexOf(nextTitle, start + title.length) : content.length;
            if (start === -1) {
                blocks.push(chapters[index].excerpt || chapters[index].summary || '');
                continue;
            }
            blocks.push(content.slice(start, end === -1 ? content.length : end));
        }
        return blocks;
    }

    extractRelatedNames(block, entities = []) {
        const names = entities.map((item) => item.name).filter(Boolean);
        return names.filter((name) => block.includes(name)).slice(0, 4);
    }

    inferConflict(block = '', fallback = '') {
        const text = `${block} ${fallback}`;
        const hints = [
            '误会升级',
            '势力对抗',
            '身份暴露',
            '资源争夺',
            '真相追查',
            '生存压力',
            '情感抉择'
        ];
        const matched = hints.find((hint) => text.includes(hint.slice(0, 2)));
        if (matched) {
            return matched;
        }
        return this.summarizeBlock(text).slice(0, 80);
    }

    inferStakes(block = '', fallback = '') {
        const text = `${block} ${fallback}`;
        if (/(死亡|覆灭|毁灭|沦陷|失控)/.test(text)) {
            return '高风险，可能改变主线走向';
        }
        if (/(秘密|真相|身份|线索)/.test(text)) {
            return '关系到真相揭示与后续分支';
        }
        if (/(喜欢|背叛|信任|合作)/.test(text)) {
            return '关系到角色关系与阵营站位';
        }
        return '影响下一阶段推进';
    }

    extractInteractiveHooks(block = '', chapter = {}) {
        const hooks = [];
        const text = `${chapter.summary || ''} ${block}`;
        const pushHook = (type, label, description) => {
            hooks.push({
                type,
                label,
                description
            });
        };

        if (/(调查|搜寻|寻找|线索|真相)/.test(text)) {
            pushHook('investigation', `${chapter.title}的调查点`, '适合转化为调查、搜证或追踪玩法');
        }
        if (/(战斗|追逐|决斗|对抗|危机)/.test(text)) {
            pushHook('combat', `${chapter.title}的冲突点`, '适合转化为战斗、潜行或高压抉择');
        }
        if (/(谜题|机关|破解|试炼)/.test(text)) {
            pushHook('puzzle', `${chapter.title}的解谜点`, '适合转化为机关、密码或规则挑战');
        }
        if (/(喜欢|背叛|说服|谈判|选择|立场)/.test(text)) {
            pushHook('relationship', `${chapter.title}的关系抉择`, '适合转化为对话树、站队与好感度变化');
        }

        if (!hooks.length) {
            pushHook('decision', `${chapter.title}的关键选择`, '适合转化为节奏控制与主支线分流节点');
        }

        return hooks.slice(0, 3);
    }

    enrichCharacterDetails(characters = [], chapters = [], summary = '') {
        const chapterText = chapters.map((chapter) => `${chapter.title || ''} ${chapter.summary || ''} ${chapter.conflict || ''}`).join(' ');
        return characters.map((character, index) => {
            const text = `${chapterText} ${summary}`;
            const role = character.role || (index === 0 ? '核心角色' : '次要角色');
            return {
                ...character,
                role,
                personality: character.personality && !String(character.personality).includes('待')
                    ? character.personality
                    : this.inferCharacterPersonality(text, role),
                tone: character.tone && !String(character.tone).includes('待')
                    ? character.tone
                    : this.inferCharacterTone(text, role),
                motivation: character.motivation && !String(character.motivation).includes('待')
                    ? character.motivation
                    : this.inferCharacterMotivation(text, role),
                worldConnection: character.worldConnection && !String(character.worldConnection).includes('来源')
                    ? character.worldConnection
                    : `与${role}对应的主线冲突相关`
            };
        });
    }

    inferCharacterPersonality(text = '', role = '') {
        if (/(冷静|谨慎|理智|调查)/.test(text)) {
            return '冷静谨慎';
        }
        if (/(冲动|热血|战斗|追逐)/.test(text)) {
            return '果断直接';
        }
        if (/(秘密|阴谋|试探|隐藏)/.test(text)) {
            return '克制神秘';
        }
        return /主角|核心/.test(role) ? '主动、愿意推动情节' : '带有自身立场';
    }

    inferCharacterTone(text = '', role = '') {
        if (/(宫廷|权力|王国|朝堂)/.test(text)) {
            return '克制正式';
        }
        if (/(校园|日常|温暖)/.test(text)) {
            return '自然亲近';
        }
        return /主角|核心/.test(role) ? '直接清晰' : '符合其立场的语气';
    }

    inferCharacterMotivation(text = '', role = '') {
        if (/(真相|线索|调查)/.test(text)) {
            return '查明真相';
        }
        if (/(生存|逃离|危机)/.test(text)) {
            return '摆脱危机并活下去';
        }
        if (/(力量|修行|成长)/.test(text)) {
            return '追求成长与突破';
        }
        return /主角|核心/.test(role) ? '推动主线并完成关键目标' : '维护自身利益或关系';
    }

    buildGameDesign(storyBible, options = {}) {
        return this.adapter.buildGameDesign(storyBible, options);
    }

    buildVisualBible(storyBible) {
        return {
            styleProfile: {
                title: storyBible.title,
                atmosphere: storyBible.worldview?.atmosphere || '待确认',
                themes: storyBible.themes || [],
                stylePreset: 'cinematic_cn_rpg'
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
            sceneTemplates: this.buildSceneTemplates(storyBible),
            promptTemplates: {
                characterBase: '统一风格角色设定图，突出服装、年龄与气质',
                locationBase: '统一风格场景设定图，突出空间结构与氛围',
                runtimeScene: '基于角色与地点基准图进行场景衍生，保持风格一致'
            },
            seedPolicy: {
                mode: 'reuse_base_seed',
                strategy: 'character_and_location_lock'
            },
            referenceBindings: {
                characters: [],
                locations: [],
                styleBoard: []
            },
            assetIndex: []
        };
    }

    buildSceneTemplates(storyBible = {}) {
        const chapters = Array.isArray(storyBible.chapters) ? storyBible.chapters : [];
        return chapters.slice(0, 12).map((chapter, index) => ({
            id: `scene_template_${index + 1}`,
            chapterId: chapter.id || `chapter_${index + 1}`,
            title: chapter.title || `场景模板 ${index + 1}`,
            locationHint: (chapter.keyLocations || [])[0] || (storyBible.locations || [])[0]?.name || '',
            mood: chapter.stakes || storyBible.worldview?.atmosphere || '待确认',
            focus: (chapter.keyCharacters || []).join('、') || '',
            promptHint: [
                chapter.title || '',
                (chapter.keyLocations || []).join('、'),
                (chapter.keyCharacters || []).join('、'),
                chapter.conflict || chapter.summary || ''
            ].filter(Boolean).join('，')
        }));
    }

    buildSeedData(storyBible, options = {}) {
        const chapters = storyBible.chapters || [];
        const characters = storyBible.characters || [];
        const design = options.gameDesign || this.buildGameDesign(storyBible, options);

        return {
            worldview: storyBible.worldview || {},
            coreCharacters: characters.slice(0, 4),
            secondaryCharacters: characters.slice(4),
            items: [],
            puzzles: design.puzzles || [],
            mainPlot: {
                title: storyBible.title,
                summary: storyBible.summary,
                theme: (storyBible.themes || []).join('、'),
                chapters: chapters.map((chapter, index) => ({
                    id: chapter.id,
                    name: chapter.title,
                    title: chapter.title,
                    description: chapter.summary,
                    goal: `推进到 ${chapter.title}`,
                    conflict: chapter.conflict || chapter.summary,
                    stakes: chapter.stakes || '',
                    interactiveHooks: chapter.interactiveHooks || [],
                    keyCharacters: chapter.keyCharacters || [],
                    keyLocations: chapter.keyLocations || [],
                    order: index + 1
                })),
                anchors: design.mainAnchors || [],
                relationshipHooks: design.relationshipHooks || [],
                conflictMap: design.conflictMap || []
            },
            sidePlots: design.branches || [],
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
                gameSystems: {
                    playerRole: design.playerRole,
                    branchingPolicy: design.branchingPolicy,
                    interactiveNodes: design.interactiveNodes || []
                }
            }
        };
    }

    isLikelyNoise(value) {
        return /^(自己|他们|我们|那里|这里|如果|但是|于是|然后)$/.test(value);
    }
}

module.exports = StoryParser;
