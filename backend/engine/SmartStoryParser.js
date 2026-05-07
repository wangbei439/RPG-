const LLMService = require('../utils/LLMService');

/**
 * 智能故事解析器 - 使用 LLM 进行文本分析
 * 相比 StoryParser 的正则匹配，这个解析器能更准确地理解文本内容
 */
class SmartStoryParser {
    constructor() {
        this.llm = new LLMService();
    }

    /**
     * 初始化 LLM 服务
     */
    initialize(settings) {
        this.llm.initialize(settings);
    }

    /**
     * 主解析入口
     */
    async parseImportedText(payload = {}, onProgress = null) {
        const title = String(payload.title || '未命名长文本项目').trim();
        const content = this.normalizeText(payload.content || '');
        const gameType = payload.gameType || 'custom';
        const adaptationMode = payload.adaptationMode || 'balanced';

        if (!content || content.length < 100) {
            throw new Error('导入的文本内容过短，至少需要 100 字');
        }

        this.reportProgress(onProgress, 5, '正在分析文本结构...');

        // 第一步：智能章节切割
        const chapters = await this.smartExtractChapters(content, onProgress);

        this.reportProgress(onProgress, 30, '正在提取角色信息...');

        // 第二步：智能角色提取
        const characters = await this.smartExtractCharacters(content, chapters, onProgress);

        this.reportProgress(onProgress, 50, '正在分析场景地点...');

        // 第三步：智能地点提取
        const locations = await this.smartExtractLocations(content, chapters, onProgress);

        this.reportProgress(onProgress, 65, '正在分析角色关系...');

        // 第四步：智能关系分析
        const relationships = await this.smartExtractRelationships(content, characters, onProgress);

        this.reportProgress(onProgress, 80, '正在生成内容摘要...');

        // 第五步：生成摘要
        const summary = await this.smartGenerateSummary(content, chapters, characters, onProgress);

        this.reportProgress(onProgress, 90, '正在构建故事圣经...');

        // 构建完整的故事数据
        const sourceDocument = {
            title,
            mode: 'novel_import',
            content,
            excerpt: content.slice(0, 1200),
            wordCount: content.length,
            paragraphCount: content.split(/\n{2,}/).filter(Boolean).length,
            importedAt: new Date().toISOString()
        };

        const storyBible = {
            title,
            summary,
            themes: await this.smartExtractThemes(content, summary),
            worldview: {
                worldName: title,
                description: summary,
                era: '待确认',
                factions: [],
                locations,
                rules: [],
                atmosphere: await this.smartInferAtmosphere(content),
                history: chapters.slice(0, 3).map(c => c.summary).join(' ')
            },
            characters,
            locations,
            chapters,
            events: this.buildEventsFromChapters(chapters),
            relationships,
            rules: [],
            timeline: chapters.map((chapter, index) => ({
                id: `timeline_${index + 1}`,
                label: chapter.title,
                summary: chapter.summary
            }))
        };

        const gameDesign = await this.smartBuildGameDesign(storyBible, { gameType, adaptationMode });

        this.reportProgress(onProgress, 100, '解析完成');

        return {
            sourceDocument,
            storyBible,
            gameDesign,
            visualBible: this.buildVisualBible(storyBible),
            seedData: this.buildSeedData(storyBible, { gameType, adaptationMode, gameDesign })
        };
    }

    /**
     * 智能章节切割 - 使用 LLM 识别自然的情节分段
     */
    async smartExtractChapters(content, onProgress = null) {
        // 先尝试识别明显的章节标记
        const explicitChapters = this.extractExplicitChapters(content);

        if (explicitChapters.length > 0) {
            // 如果有明显的章节标记，为每个章节生成摘要
            this.reportProgress(onProgress, 15, `识别到 ${explicitChapters.length} 个章节，正在生成摘要...`);
            return await this.enrichChaptersWithSummaries(explicitChapters);
        }

        // 如果没有明显章节，使用 LLM 智能切割
        this.reportProgress(onProgress, 15, '未发现章节标记，使用智能切割...');
        return await this.llmBasedChapterSplit(content);
    }

    /**
     * 提取明显的章节标记
     */
    extractExplicitChapters(content) {
        const chapters = [];
        const lines = content.split('\n');

        // 匹配各种章节标题格式
        const chapterPatterns = [
            /^第[零一二三四五六七八九十百千0-9]+[章回节]/,
            /^Chapter\s+\d+/i,
            /^[0-9]+[\.、\s]/,
            /^[零一二三四五六七八九十百千]+[\.、\s]/
        ];

        let currentChapter = null;
        let chapterIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const isChapterTitle = chapterPatterns.some(pattern => pattern.test(line));

            if (isChapterTitle) {
                if (currentChapter) {
                    currentChapter.content = currentChapter.content.trim();
                    chapters.push(currentChapter);
                }

                chapterIndex++;
                currentChapter = {
                    id: `chapter_${chapterIndex}`,
                    title: line,
                    content: '',
                    order: chapterIndex
                };
            } else if (currentChapter) {
                currentChapter.content += line + '\n';
            } else {
                // 第一章之前的内容
                if (!chapters.length) {
                    currentChapter = {
                        id: 'chapter_1',
                        title: '开篇',
                        content: line + '\n',
                        order: 1
                    };
                    chapterIndex = 1;
                }
            }
        }

        if (currentChapter) {
            currentChapter.content = currentChapter.content.trim();
            chapters.push(currentChapter);
        }

        return chapters;
    }

    /**
     * 为章节生成摘要
     */
    async enrichChaptersWithSummaries(chapters) {
        const enriched = [];

        for (const chapter of chapters) {
            const prompt = `你是一个专业的故事分析师。请为以下章节生成一个精炼的摘要。

章节标题：${chapter.title}
章节内容：
${chapter.content.slice(0, 2000)}${chapter.content.length > 2000 ? '...' : ''}

摘要要求：
1. 长度：100-200字
2. 内容：核心情节 + 关键转折 + 重要角色行动
3. 风格：客观陈述，不要主观评价
4. 重点：剧情推进，而非细节描写

只返回摘要文本，不要标题、序号或其他内容。`;

            try {
                const summary = await this.llm.generateText(prompt, { maxTokens: 300 });

                enriched.push({
                    ...chapter,
                    summary: summary.trim(),
                    excerpt: chapter.content.slice(0, 500)
                });
            } catch (error) {
                console.error(`生成章节摘要失败: ${chapter.title}`, error);
                enriched.push({
                    ...chapter,
                    summary: chapter.content.slice(0, 200) + '...',
                    excerpt: chapter.content.slice(0, 500)
                });
            }
        }

        return enriched;
    }

    /**
     * 基于 LLM 的智能章节切割
     */
    async llmBasedChapterSplit(content) {
        // 如果文本太长，先分段
        const maxChunkSize = 8000;
        const chunks = this.splitIntoChunks(content, maxChunkSize);

        const prompt = `请分析以下文本，将其切割成合理的章节。每个章节应该是一个相对完整的情节单元。

文本内容：
${chunks[0]}${chunks.length > 1 ? '\n\n[文本较长，已截取前半部分]' : ''}

请返回 JSON 格式：
[
  {
    "title": "章节标题",
    "summary": "章节摘要（100-200字）",
    "startMarker": "章节开始的前20个字",
    "endMarker": "章节结束的前20个字"
  }
]

要求：
1. 章节数量建议 3-8 个
2. 每个章节应该包含完整的情节
3. 标题要简洁有吸引力
4. 摘要要概括主要情节`;

        try {
            const result = await this.llm.generateJSON(prompt);
            const chapters = Array.isArray(result) ? result : [];

            // 根据标记点切割实际内容
            return this.applyChapterMarkers(content, chapters);
        } catch (error) {
            console.error('LLM 章节切割失败，使用简单分段', error);
            return this.fallbackChapterSplit(content);
        }
    }

    /**
     * 根据标记点切割内容
     */
    applyChapterMarkers(content, chapters) {
        const result = [];

        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];
            const startIdx = content.indexOf(chapter.startMarker);
            const nextChapter = chapters[i + 1];
            const endIdx = nextChapter
                ? content.indexOf(nextChapter.startMarker)
                : content.length;

            if (startIdx >= 0) {
                result.push({
                    id: `chapter_${i + 1}`,
                    title: chapter.title,
                    summary: chapter.summary,
                    content: content.slice(startIdx, endIdx).trim(),
                    excerpt: content.slice(startIdx, Math.min(startIdx + 500, endIdx)),
                    order: i + 1
                });
            }
        }

        return result.length > 0 ? result : this.fallbackChapterSplit(content);
    }

    /**
     * 后备方案：简单按长度分段
     */
    fallbackChapterSplit(content) {
        const targetChapters = 5;
        const chapterLength = Math.ceil(content.length / targetChapters);
        const chapters = [];

        for (let i = 0; i < targetChapters; i++) {
            const start = i * chapterLength;
            const end = Math.min((i + 1) * chapterLength, content.length);
            const chapterContent = content.slice(start, end).trim();

            if (chapterContent) {
                chapters.push({
                    id: `chapter_${i + 1}`,
                    title: `第 ${i + 1} 部分`,
                    summary: chapterContent.slice(0, 200) + '...',
                    content: chapterContent,
                    excerpt: chapterContent.slice(0, 500),
                    order: i + 1
                });
            }
        }

        return chapters;
    }

    /**
     * 智能角色提取
     */
    async smartExtractCharacters(content, chapters, onProgress = null) {
        const sampleText = this.buildSampleText(content, chapters, 6000);

        const prompt = `你是一个专业的文学分析助手。请仔细分析以下文本，提取所有重要角色。

文本内容：
${sampleText}

请返回 JSON 格式：
[
  {
    "name": "角色名",
    "role": "主角/重要配角/次要角色",
    "description": "角色的外貌、性格、背景描述（100-200字）",
    "personality": "性格特点（简短）",
    "goals": ["角色的目标或动机"],
    "relationships": ["与其他角色的关系"]
  }
]

判断标准（严格遵守）：
1. **主角**：故事的核心人物，有完整的成长线或主要视角，戏份占比超过30%
2. **重要配角**：对主线剧情有重大影响，多次出场，有独立的人物弧光
3. **次要角色**：有名字且出场3次以上，对剧情有一定推动作用
4. **不要提取**：只出现1-2次的路人、没有名字的群众、一笔带过的背景人物

提取要求：
- 主角：1-3个
- 重要配角：3-8个
- 次要角色：2-5个
- 总数控制在5-15个之间
- 描述要基于文本事实，不要脑补
- 如果角色信息不足，description 可以简短，但必须准确`;

        try {
            const result = await this.llm.generateJSON(prompt);
            const characters = Array.isArray(result) ? result : [];

            return characters.map((char, index) => ({
                id: `char_${index + 1}`,
                name: char.name || `角色${index + 1}`,
                role: char.role || '角色',
                description: char.description || '',
                personality: char.personality || '',
                goals: Array.isArray(char.goals) ? char.goals : [],
                relationships: Array.isArray(char.relationships) ? char.relationships : [],
                relationship: 0,
                secrets: [],
                items: []
            }));
        } catch (error) {
            console.error('智能角色提取失败', error);
            return this.fallbackExtractCharacters(content);
        }
    }

    /**
     * 智能地点提取
     */
    async smartExtractLocations(content, chapters, onProgress = null) {
        const sampleText = this.buildSampleText(content, chapters, 5000);

        const prompt = `你是一个专业的场景分析师。请分析以下文本，提取所有重要场景地点。

文本内容：
${sampleText}

请返回 JSON 格式：
[
  {
    "name": "地点名称",
    "description": "地点的详细描述（环境、氛围、特点）",
    "type": "城市/村庄/建筑/自然景观/其他"
  }
]

判断标准（严格遵守）：
1. **重要地点**：故事主要发生地，多次出现，对剧情有重要意义
2. **次要地点**：出现2次以上，有具体描写的场景
3. **不要提取**：只是路过、一笔带过、没有具体描写的地点

提取要求：
- 控制在5-15个之间
- 优先提取有冲突、转折发生的地点
- 描述要基于文本事实，包含：位置、环境特征、氛围感受
- 如果文本中没有详细描写，description 可以简短但必须准确`;

        try {
            const result = await this.llm.generateJSON(prompt);
            const locations = Array.isArray(result) ? result : [];

            return locations.map((loc, index) => ({
                id: `location_${index + 1}`,
                name: loc.name || `地点${index + 1}`,
                description: loc.description || '',
                type: loc.type || '场景',
                dangerLevel: 1
            }));
        } catch (error) {
            console.error('智能地点提取失败', error);
            return [];
        }
    }

    /**
     * 智能关系分析
     */
    async smartExtractRelationships(content, characters, onProgress = null) {
        if (!characters || characters.length < 2) {
            return [];
        }

        const characterNames = characters.map(c => c.name).join('、');
        const sampleText = content.slice(0, 6000);

        const prompt = `你是一个专业的人物关系分析师。请分析以下文本中角色之间的关系。

角色列表：${characterNames}

文本内容：
${sampleText}

请返回 JSON 格式：
[
  {
    "from": "角色A",
    "to": "角色B",
    "type": "朋友/敌人/恋人/亲人/师徒/同事/竞争对手/其他",
    "description": "关系描述（简短，基于文本事实）"
  }
]

判断标准（严格遵守）：
1. **只提取明确的关系**：文本中有明确互动、对话或描述的
2. **关系类型要准确**：
   - 朋友：互相信任、帮助
   - 敌人：明确的对立、冲突
   - 恋人：爱情关系或暧昧
   - 亲人：血缘或家庭关系
   - 师徒：明确的教导关系
   - 同事：工作伙伴
   - 竞争对手：有竞争但非敌对
3. **不要脑补**：如果文本中没有明确关系，不要添加
4. **双向关系只记录一次**：A→B 和 B→A 选一个方向

只返回有明确文本依据的关系，宁缺毋滥。`;

        try {
            const result = await this.llm.generateJSON(prompt);
            return Array.isArray(result) ? result : [];
        } catch (error) {
            console.error('智能关系分析失败', error);
            return [];
        }
    }

    /**
     * 智能生成摘要
     */
    async smartGenerateSummary(content, chapters, characters, onProgress = null) {
        const sampleText = content.slice(0, 4000);
        const characterNames = characters.slice(0, 5).map(c => c.name).join('、');
        const chapterTitles = chapters.slice(0, 5).map(c => c.title).join('、');

        const prompt = `你是一个专业的故事分析师。请为以下故事生成一个精炼的摘要。

主要角色：${characterNames}
章节结构：${chapterTitles}

故事内容：
${sampleText}

摘要要求：
1. 长度：200-300字
2. 结构：背景设定 → 核心冲突 → 主要情节线 → 故事主题
3. 重点：
   - 故事发生的世界/背景（1-2句）
   - 主角的目标和面临的核心冲突（2-3句）
   - 主要情节发展（3-4句）
   - 故事的主题或调性（1句）
4. 风格：客观陈述，像是给读者的导读
5. 避免：剧透结局、过多细节、主观评价

只返回摘要文本，不要标题或其他内容。`;

        try {
            const summary = await this.llm.generateText(prompt, { maxTokens: 500 });
            return summary.trim();
        } catch (error) {
            console.error('智能摘要生成失败', error);
            return content.slice(0, 300) + '...';
        }
    }

    /**
     * 智能提取主题
     */
    async smartExtractThemes(content, summary) {
        const prompt = `请分析以下故事的主题（3-5个关键词）。

故事摘要：
${summary}

只返回主题关键词，用顿号分隔，例如：成长、友情、冒险`;

        try {
            const themes = await this.llm.generateText(prompt, { maxTokens: 100 });
            return themes.trim();
        } catch (error) {
            return '待分析';
        }
    }

    /**
     * 智能推断氛围
     */
    async smartInferAtmosphere(content) {
        const sampleText = content.slice(0, 2000);

        const prompt = `请用一个词或短语描述以下文本的整体氛围/基调。

文本：
${sampleText}

只返回氛围描述，例如：轻松幽默、紧张刺激、温馨治愈、黑暗压抑等`;

        try {
            const atmosphere = await this.llm.generateText(prompt, { maxTokens: 50 });
            return atmosphere.trim();
        } catch (error) {
            return '待确认';
        }
    }

    /**
     * 智能构建游戏设计
     */
    async smartBuildGameDesign(storyBible, options) {
        const { gameType, adaptationMode } = options;

        const prompt = `请基于以下故事信息，设计一个 ${gameType} 类型的 RPG 游戏改编方案。

故事摘要：${storyBible.summary}
主要角色：${storyBible.characters.map(c => c.name).join('、')}
改编模式：${adaptationMode}

请返回 JSON 格式：
{
  "playerRole": "玩家扮演的角色或视角",
  "coreGameplay": "核心玩法描述",
  "branchingPolicy": "分支策略（如何处理原著情节的分支）",
  "interactiveNodes": ["关键互动点1", "关键互动点2"]
}`;

        try {
            const design = await this.llm.generateJSON(prompt);
            return design;
        } catch (error) {
            console.error('智能游戏设计失败', error);
            return {
                playerRole: '玩家',
                coreGameplay: '互动叙事',
                branchingPolicy: adaptationMode,
                interactiveNodes: []
            };
        }
    }

    // ========== 辅助方法 ==========

    normalizeText(content) {
        return String(content || '')
            .replace(/\r\n/g, '\n')
            .replace(/\u3000/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    splitIntoChunks(text, maxSize) {
        const chunks = [];
        for (let i = 0; i < text.length; i += maxSize) {
            chunks.push(text.slice(i, i + maxSize));
        }
        return chunks;
    }

    buildSampleText(content, chapters, maxLength) {
        if (content.length <= maxLength) {
            return content;
        }

        // 从每个章节取样
        if (chapters && chapters.length > 0) {
            const samplePerChapter = Math.floor(maxLength / chapters.length);
            return chapters.map(c => c.content.slice(0, samplePerChapter)).join('\n\n');
        }

        // 取开头、中间、结尾
        const third = Math.floor(maxLength / 3);
        return content.slice(0, third) + '\n\n...\n\n' +
               content.slice(Math.floor(content.length / 2), Math.floor(content.length / 2) + third) + '\n\n...\n\n' +
               content.slice(-third);
    }

    fallbackExtractCharacters(content) {
        // 简单的后备方案
        const names = new Set();
        const namePattern = /([A-Z][a-z]+|[\u4e00-\u9fa5]{2,4})/g;
        const matches = content.match(namePattern) || [];

        matches.forEach(name => {
            if (name.length >= 2 && name.length <= 4) {
                names.add(name);
            }
        });

        return Array.from(names).slice(0, 10).map((name, index) => ({
            id: `char_${index + 1}`,
            name,
            role: '角色',
            description: '',
            personality: '',
            goals: [],
            relationships: [],
            relationship: 0,
            secrets: [],
            items: []
        }));
    }

    buildEventsFromChapters(chapters) {
        return chapters.map((chapter, index) => ({
            id: `event_${index + 1}`,
            name: chapter.title,
            description: chapter.summary,
            chapter: chapter.id
        }));
    }

    buildVisualBible(storyBible) {
        return {
            locations: storyBible.locations || [],
            characters: storyBible.characters || [],
            stylePreset: '待确认'
        };
    }

    buildSeedData(storyBible, options) {
        return {
            worldview: storyBible.worldview,
            coreCharacters: storyBible.characters.slice(0, 5),
            secondaryCharacters: storyBible.characters.slice(5),
            items: [],
            puzzles: [],
            mainPlot: {
                chapters: storyBible.chapters,
                anchors: [],
                relationshipHooks: [],
                conflictMap: []
            },
            sidePlots: [],
            fragments: storyBible.chapters.map((chapter, index) => ({
                id: `fragment_${index + 1}`,
                name: chapter.title,
                type: '章节摘录',
                content: chapter.excerpt
            })),
            integration: {
                gameName: storyBible.title,
                gameplayDesign: `${options.adaptationMode} 模式改编`,
                openingScene: {
                    description: storyBible.chapters[0]?.summary || storyBible.summary,
                    narration: storyBible.chapters[0]?.excerpt || storyBible.summary,
                    startingLocation: storyBible.locations[0]?.name || '起始地点',
                    mood: storyBible.worldview?.atmosphere || '待确认'
                },
                gameSystems: options.gameDesign || {}
            }
        };
    }

    reportProgress(callback, percent, message) {
        if (typeof callback === 'function') {
            callback(percent, message);
        }
    }
}

module.exports = SmartStoryParser;
