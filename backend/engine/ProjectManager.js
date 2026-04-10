const { v4: uuidv4 } = require('uuid');
const StoryParser = require('./StoryParser');

class ProjectManager {
    constructor() {
        this.parser = new StoryParser();
    }

    createImportedProject(payload = {}) {
        const parsed = this.parser.parseImportedText(payload);
        const now = Date.now();

        return {
            id: uuidv4(),
            createdAt: now,
            updatedAt: now,
            status: 'imported',
            mode: 'novel_import',
            title: parsed.sourceDocument.title,
            gameType: payload.gameType || 'custom',
            adaptationMode: payload.adaptationMode || 'balanced',
            source: parsed.sourceDocument,
            storyBible: parsed.storyBible,
            gameDesign: parsed.gameDesign,
            visualBible: parsed.visualBible,
            seedData: parsed.seedData
        };
    }

    buildGenerationSeed(project, overrides = {}) {
        return {
            userInput: overrides.userInput || project.storyBible?.summary || project.source?.excerpt || '',
            gameType: overrides.gameType || project.gameType || 'custom',
            seedData: project.seedData || {},
            sourceProject: {
                projectId: project.id,
                title: project.title,
                mode: project.mode,
                adaptationMode: project.adaptationMode
            }
        };
    }

    applyProjectEdits(project, edits = {}) {
        const nextProject = JSON.parse(JSON.stringify(project));
        const storyBible = nextProject.storyBible || {};
        const worldview = storyBible.worldview || {};

        if (typeof edits.title === 'string' && edits.title.trim()) {
            const title = edits.title.trim();
            nextProject.title = title;
            nextProject.source.title = title;
            storyBible.title = title;
            worldview.worldName = title;
        }

        if (typeof edits.summary === 'string' && edits.summary.trim()) {
            storyBible.summary = edits.summary.trim();
            worldview.description = edits.summary.trim();
        }

        if (Array.isArray(edits.characters)) {
            storyBible.characters = edits.characters
                .map((character, index) => ({
                    id: character.id || `import_char_${index + 1}`,
                    name: String(character.name || '').trim(),
                    role: String(character.role || '待定角色').trim(),
                    description: String(character.description || '').trim(),
                    personality: String(character.personality || '待补充').trim(),
                    tone: String(character.tone || '待补充').trim(),
                    motivation: String(character.motivation || '待补充').trim(),
                    worldConnection: String(character.worldConnection || '来源于导入长文本').trim()
                }))
                .filter((character) => character.name);
        }

        if (Array.isArray(edits.chapters)) {
            storyBible.chapters = edits.chapters
                .map((chapter, index) => ({
                    id: chapter.id || `chapter_${index + 1}`,
                    title: String(chapter.title || `导入章节 ${index + 1}`).trim(),
                    summary: String(chapter.summary || '').trim(),
                    excerpt: String(chapter.excerpt || chapter.summary || '').trim().slice(0, 1000),
                    order: index + 1
                }))
                .filter((chapter) => chapter.title || chapter.summary);
        }

        if (Array.isArray(edits.locations)) {
            storyBible.locations = edits.locations
                .map((location, index) => ({
                    id: location.id || `import_loc_${index + 1}`,
                    name: String(location.name || '').trim(),
                    description: String(location.description || '').trim(),
                    dangerLevel: Number(location.dangerLevel) || 2
                }))
                .filter((location) => location.name);
        }

        worldview.locations = storyBible.locations || worldview.locations || [];
        worldview.history = (storyBible.chapters || []).slice(0, 5).map((chapter) => chapter.summary).filter(Boolean).join(' ');
        nextProject.storyBible.events = this.parser.buildEventsFromChapters(storyBible.chapters || []);
        nextProject.storyBible.timeline = (storyBible.chapters || []).map((chapter, index) => ({
            id: `timeline_${index + 1}`,
            label: chapter.title,
            summary: chapter.summary
        }));

        nextProject.gameDesign = this.parser.buildGameDesign(nextProject.storyBible, {
            gameType: nextProject.gameType,
            adaptationMode: nextProject.adaptationMode
        });
        nextProject.visualBible = this.parser.buildVisualBible(nextProject.storyBible);
        nextProject.seedData = this.parser.buildSeedData(nextProject.storyBible, {
            gameType: nextProject.gameType,
            adaptationMode: nextProject.adaptationMode
        });
        nextProject.updatedAt = Date.now();

        return nextProject;
    }
}

module.exports = ProjectManager;
