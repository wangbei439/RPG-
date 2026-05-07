class AssetManager {
    constructor(visualDirector) {
        this.visualDirector = visualDirector;
    }

    ensureContainers(project) {
        const nextProject = JSON.parse(JSON.stringify(project || {}));
        nextProject.visualBible = nextProject.visualBible || {};
        nextProject.visualBible.assetIndex = Array.isArray(nextProject.visualBible.assetIndex)
            ? nextProject.visualBible.assetIndex
            : [];
        nextProject.visualBible.referenceBindings = nextProject.visualBible.referenceBindings || {
            characters: [],
            locations: [],
            styleBoard: []
        };
        nextProject.visualBible.seedPolicy = nextProject.visualBible.seedPolicy || {};

        nextProject.buildArtifacts = nextProject.buildArtifacts || {};
        nextProject.buildArtifacts.visualAssets = Array.isArray(nextProject.buildArtifacts.visualAssets)
            ? nextProject.buildArtifacts.visualAssets
            : [];
        return nextProject;
    }

    listAssets(project) {
        return (project?.visualBible?.assetIndex || []).slice();
    }

    async generateBaseAssets(project, imageService, imageConfig = {}, options = {}) {
        const nextProject = this.ensureContainers(project);
        const assets = [];
        const now = Date.now();
        const dryRun = Boolean(options.dryRun);
        const characterLimit = Number.isFinite(options.characterLimit) ? options.characterLimit : 4;
        const locationLimit = Number.isFinite(options.locationLimit) ? options.locationLimit : 4;

        const seedBundle = this.visualDirector.buildSeedBundle(nextProject);
        nextProject.visualBible.seedPolicy = {
            ...(nextProject.visualBible.seedPolicy || {}),
            mode: 'reuse_base_seed',
            bundle: seedBundle
        };

        const styleBoard = await this.createAsset(
            nextProject,
            imageService,
            {
                key: 'style_board:base',
                type: 'style_board',
                targetId: 'style_board',
                targetName: '风格基准板',
                prompt: this.visualDirector.buildStyleBoardPrompt(nextProject),
                seed: seedBundle.styleSeed
            },
            imageConfig,
            { dryRun, now, refs: [] }
        );
        assets.push(styleBoard);
        this.bindStyleBoard(nextProject, styleBoard);

        let characters = (nextProject.storyBible?.characters || []).slice(0, characterLimit);
        let locations = (nextProject.storyBible?.locations || []).slice(0, locationLimit);

        if (!characters.length) {
            characters = [{
                id: 'fallback_char_1',
                name: '主角',
                role: '核心角色',
                description: nextProject.storyBible?.summary || '待补充'
            }];
        }

        if (!locations.length) {
            const chapter = (nextProject.storyBible?.chapters || [])[0];
            locations = [{
                id: 'fallback_loc_1',
                name: chapter?.title || '关键场景',
                description: chapter?.summary || nextProject.storyBible?.summary || '待补充'
            }];
        }

        for (let index = 0; index < characters.length; index += 1) {
            const character = characters[index];
            const asset = await this.createAsset(
                nextProject,
                imageService,
                {
                    key: `character_base:${character.id || character.name}`,
                    type: 'character_base',
                    targetId: character.id || character.name,
                    targetName: character.name || '未命名角色',
                    prompt: this.visualDirector.buildCharacterBasePrompt(nextProject, character),
                    seed: seedBundle.characterSeed + index
                },
                imageConfig,
                {
                    dryRun,
                    now,
                    refs: [styleBoard.id]
                }
            );
            assets.push(asset);
            this.bindCharacterRef(nextProject, character, asset);
        }

        for (let index = 0; index < locations.length; index += 1) {
            const location = locations[index];
            const asset = await this.createAsset(
                nextProject,
                imageService,
                {
                    key: `location_base:${location.id || location.name}`,
                    type: 'location_base',
                    targetId: location.id || location.name,
                    targetName: location.name || '未命名地点',
                    prompt: this.visualDirector.buildLocationBasePrompt(nextProject, location),
                    seed: seedBundle.locationSeed + index
                },
                imageConfig,
                {
                    dryRun,
                    now,
                    refs: [styleBoard.id]
                }
            );
            assets.push(asset);
            this.bindLocationRef(nextProject, location, asset);
        }

        nextProject.updatedAt = now;
        return {
            project: nextProject,
            generatedAssets: assets
        };
    }

    bindStyleBoard(project, asset) {
        project.visualBible.referenceBindings.styleBoard = [{
            assetId: asset.id,
            key: asset.key
        }];
    }

    bindCharacterRef(project, character, asset) {
        const bindings = project.visualBible.referenceBindings.characters || [];
        const existed = bindings.find((item) => item.characterId === (character.id || character.name));
        const entry = {
            characterId: character.id || character.name,
            characterName: character.name || '未命名角色',
            assetId: asset.id
        };
        if (existed) {
            Object.assign(existed, entry);
        } else {
            bindings.push(entry);
        }
        project.visualBible.referenceBindings.characters = bindings;
    }

    bindLocationRef(project, location, asset) {
        const bindings = project.visualBible.referenceBindings.locations || [];
        const existed = bindings.find((item) => item.locationId === (location.id || location.name));
        const entry = {
            locationId: location.id || location.name,
            locationName: location.name || '未命名地点',
            assetId: asset.id
        };
        if (existed) {
            Object.assign(existed, entry);
        } else {
            bindings.push(entry);
        }
        project.visualBible.referenceBindings.locations = bindings;
    }

    async createAsset(project, imageService, payload, imageConfig, options = {}) {
        const existed = (project.visualBible.assetIndex || []).find((item) => item.key === payload.key);
        if (existed) {
            return { ...existed, reused: true };
        }

        let imageUrl = '';
        let error = null;

        if (!options.dryRun) {
            try {
                imageUrl = await imageService.generateImage(payload.prompt, {
                    ...imageConfig,
                    comfyuiSeed: payload.seed
                });
            } catch (generateError) {
                error = generateError.message || '图像生成失败';
            }
        }

        const asset = {
            id: `asset_${payload.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            key: payload.key,
            type: payload.type,
            targetId: payload.targetId,
            targetName: payload.targetName,
            prompt: payload.prompt,
            seed: payload.seed || null,
            refs: Array.isArray(options.refs) ? options.refs : [],
            imageUrl: imageUrl || '',
            status: imageUrl ? 'ready' : (options.dryRun ? 'planned' : 'failed'),
            error,
            createdAt: options.now || Date.now()
        };

        project.visualBible.assetIndex.push(asset);
        project.buildArtifacts.visualAssets.push(asset);
        return asset;
    }
}

module.exports = AssetManager;
