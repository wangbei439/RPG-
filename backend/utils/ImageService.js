const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const OPTIONS_CACHE_TTL = 30 * 1000;
const DEFAULT_NEGATIVE_PROMPT = 'low quality, blurry, deformed, ugly, bad anatomy, watermark, text';
const PLACEHOLDER_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

class ImageService {
    constructor() {
        this.comfyOptionsCache = new Map();
        this.activeComfyJobs = 0;
        this.waitingResolvers = [];
    }

    async generateImage(prompt, config = {}) {
        switch (config.imageSource) {
            case 'comfyui':
                return this.generateWithComfyUI(prompt, config);
            case 'api':
                return this.generateWithAPI(prompt, config);
            default:
                return null;
        }
    }

    async generateImages(prompt, config = {}) {
        switch (config.imageSource) {
            case 'comfyui':
                return this.generateWithComfyUIImages(prompt, config);
            case 'api': {
                const image = await this.generateWithAPI(prompt, config);
                return image ? [image] : [];
            }
            default:
                return [];
        }
    }

    async getComfyUIOptions(config = {}) {
        const comfyConfig = this.resolveComfyUIConfig(config);
        const cached = this.comfyOptionsCache.get(comfyConfig.baseUrl);

        if (cached && Date.now() - cached.timestamp < OPTIONS_CACHE_TTL) {
            return cached.value;
        }

        const [checkpoints, samplerInfo, systemStats] = await Promise.all([
            this.fetchCheckpointModels(comfyConfig.baseUrl, comfyConfig.timeoutMs),
            this.fetchObjectInfo(comfyConfig.baseUrl, 'KSampler', comfyConfig.timeoutMs),
            this.fetchSystemStats(comfyConfig.baseUrl, comfyConfig.timeoutMs)
        ]);

        const value = {
            baseUrl: comfyConfig.baseUrl,
            checkpoints,
            samplers: this.extractEnumOptions(samplerInfo, 'sampler_name'),
            schedulers: this.extractEnumOptions(samplerInfo, 'scheduler'),
            system: systemStats
        };

        this.comfyOptionsCache.set(comfyConfig.baseUrl, {
            timestamp: Date.now(),
            value
        });

        return value;
    }

    async validateComfyUIWorkflow(config = {}) {
        const comfyConfig = this.resolveComfyUIConfig(config);
        const workflow = this.buildWorkflow(comfyConfig, 'Validation prompt');
        const validation = this.validateWorkflowStructure(workflow);

        return {
            ok: validation.errors.length === 0,
            mode: comfyConfig.workflowMode,
            placeholders: this.extractPlaceholders(comfyConfig.workflowJson),
            validation
        };
    }

    async testComfyUI(config = {}) {
        const comfyConfig = this.resolveComfyUIConfig(config);
        const options = await this.getComfyUIOptions(comfyConfig);

        return {
            success: true,
            baseUrl: options.baseUrl,
            checkpoints: options.checkpoints,
            samplers: options.samplers,
            schedulers: options.schedulers,
            system: options.system
        };
    }

    async generateWithComfyUI(prompt, config = {}) {
        const images = await this.generateWithComfyUIImages(prompt, config);
        return images[0] || null;
    }

    async generateWithComfyUIImages(prompt, config = {}) {
        const comfyConfig = this.resolveComfyUIConfig(config);
        const workflow = this.buildWorkflow(comfyConfig, prompt);
        const validation = this.validateWorkflowStructure(workflow);

        if (validation.errors.length > 0) {
            throw new Error(`ComfyUI workflow invalid: ${validation.errors.join('; ')}`);
        }

        return this.withComfySlot(comfyConfig.maxConcurrency, async () => {
            try {
                const queueData = await this.requestComfyUIJson(
                    comfyConfig.baseUrl,
                    '/prompt',
                    {
                        method: 'POST',
                        body: JSON.stringify({ prompt: workflow })
                    },
                    comfyConfig.timeoutMs
                );

                if (!queueData.prompt_id) {
                    throw new Error('ComfyUI did not return a prompt_id.');
                }

                return await this.waitForImages(comfyConfig, queueData.prompt_id);
            } catch (error) {
                console.error('ComfyUI generation error:', error);
                throw error;
            }
        });
    }

    async waitForImages(config, promptId) {
        const startTime = Date.now();
        let intervalMs = 700;

        while (Date.now() - startTime < config.timeoutMs) {
            const history = await this.requestComfyUIJson(
                config.baseUrl,
                `/history/${encodeURIComponent(promptId)}`,
                { method: 'GET' },
                config.timeoutMs
            );

            const promptHistory = history[promptId];
            const status = promptHistory?.status?.status_str;

            if (status === 'success') {
                const images = this.findAllOutputImages(promptHistory.outputs || {});
                if (!images.length) {
                    throw new Error('ComfyUI finished successfully, but no output image was returned.');
                }

                return this.fetchImagesAsDataUrls(config, images);
            }

            if (status === 'error') {
                throw new Error(this.extractHistoryError(promptHistory));
            }

            await this.sleep(intervalMs);
            intervalMs = Math.min(intervalMs + 200, 1800);
        }

        throw new Error(`ComfyUI generation timeout after ${Math.round(config.timeoutMs / 1000)} seconds.`);
    }

    async fetchImagesAsDataUrls(config, images) {
        return Promise.all(images.map((image) => this.fetchImageAsDataUrl(config, image)));
    }

    async fetchImageAsDataUrl(config, image) {
        const params = new URLSearchParams({
            filename: image.filename,
            subfolder: image.subfolder || '',
            type: image.type || 'output'
        });

        const response = await this.requestComfyUIResponse(
            config.baseUrl,
            `/view?${params.toString()}`,
            { method: 'GET' },
            config.timeoutMs
        );

        const contentType = response.headers.get('content-type') || 'image/png';
        const buffer = Buffer.from(await response.arrayBuffer());
        return `data:${contentType};base64,${buffer.toString('base64')}`;
    }

    buildWorkflow(config, prompt) {
        if (config.workflowMode === 'custom' && config.workflowJson) {
            const parsed = this.parseWorkflowJson(config.workflowJson);
            const workflow = this.applyTemplateVariables(parsed, this.buildTemplateValues(config, prompt));
            this.applyCommonNodeOverrides(workflow, config, prompt);
            return workflow;
        }

        return this.buildDefaultWorkflow(config, prompt);
    }

    buildDefaultWorkflow(config, prompt) {
        if (!config.ckptName) {
            throw new Error('Please select a ComfyUI checkpoint model before generating images.');
        }

        const seed = this.resolveSeed(config.seed);

        return {
            '4': {
                class_type: 'CheckpointLoaderSimple',
                inputs: {
                    ckpt_name: config.ckptName
                }
            },
            '6': {
                class_type: 'CLIPTextEncode',
                inputs: {
                    text: this.buildPositivePrompt(prompt, config),
                    clip: ['4', 1]
                }
            },
            '7': {
                class_type: 'CLIPTextEncode',
                inputs: {
                    text: config.negativePrompt,
                    clip: ['4', 1]
                }
            },
            '3': {
                class_type: 'EmptyLatentImage',
                inputs: {
                    width: config.width,
                    height: config.height,
                    batch_size: config.imageCount
                }
            },
            '5': {
                class_type: 'KSampler',
                inputs: {
                    model: ['4', 0],
                    positive: ['6', 0],
                    negative: ['7', 0],
                    latent_image: ['3', 0],
                    seed,
                    steps: config.steps,
                    cfg: config.cfg,
                    sampler_name: config.samplerName,
                    scheduler: config.scheduler,
                    denoise: 1
                }
            },
            '8': {
                class_type: 'VAEDecode',
                inputs: {
                    samples: ['5', 0],
                    vae: ['4', 2]
                }
            },
            '9': {
                class_type: 'SaveImage',
                inputs: {
                    images: ['8', 0],
                    filename_prefix: config.filenamePrefix
                }
            }
        };
    }

    validateWorkflowStructure(workflow) {
        const errors = [];
        const warnings = [];

        if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
            return {
                errors: ['Workflow must be a JSON object keyed by node id.'],
                warnings
            };
        }

        const nodeIds = new Set(Object.keys(workflow));
        let hasSaveNode = false;

        for (const [nodeId, node] of Object.entries(workflow)) {
            if (!node || typeof node !== 'object') {
                errors.push(`Node ${nodeId} is not an object.`);
                continue;
            }

            if (typeof node.class_type !== 'string' || !node.class_type) {
                errors.push(`Node ${nodeId} is missing class_type.`);
            }

            if (!node.inputs || typeof node.inputs !== 'object' || Array.isArray(node.inputs)) {
                errors.push(`Node ${nodeId} is missing an inputs object.`);
                continue;
            }

            if (node.class_type === 'SaveImage' || node.class_type === 'PreviewImage') {
                hasSaveNode = true;
            }

            for (const [inputName, value] of Object.entries(node.inputs)) {
                this.collectWorkflowReferenceErrors(nodeIds, nodeId, inputName, value, errors);
            }
        }

        if (!hasSaveNode) {
            warnings.push('Workflow does not contain a SaveImage or PreviewImage node.');
        }

        return { errors, warnings };
    }

    collectWorkflowReferenceErrors(nodeIds, nodeId, inputName, value, errors) {
        if (Array.isArray(value)) {
            if (value.length >= 2 && this.looksLikeNodeReference(value)) {
                const refId = String(value[0]);
                if (!nodeIds.has(refId)) {
                    errors.push(`Node ${nodeId} input ${inputName} references missing node ${refId}.`);
                }
                return;
            }

            value.forEach((entry, index) => {
                this.collectWorkflowReferenceErrors(nodeIds, nodeId, `${inputName}[${index}]`, entry, errors);
            });
            return;
        }

        if (value && typeof value === 'object') {
            for (const [key, nested] of Object.entries(value)) {
                this.collectWorkflowReferenceErrors(nodeIds, nodeId, `${inputName}.${key}`, nested, errors);
            }
        }
    }

    looksLikeNodeReference(value) {
        return (typeof value[0] === 'string' || typeof value[0] === 'number')
            && typeof value[1] === 'number';
    }

    applyCommonNodeOverrides(workflow, config, prompt) {
        const textNodes = [];

        for (const node of Object.values(workflow)) {
            if (!node?.inputs) {
                continue;
            }

            if (node.class_type === 'CheckpointLoaderSimple' && typeof node.inputs.ckpt_name === 'string' && config.ckptName) {
                node.inputs.ckpt_name = this.replaceIfUnset(node.inputs.ckpt_name, config.ckptName);
            }

            if (node.class_type === 'EmptyLatentImage') {
                if (node.inputs.width !== undefined) {
                    node.inputs.width = Number(node.inputs.width) || config.width;
                }
                if (node.inputs.height !== undefined) {
                    node.inputs.height = Number(node.inputs.height) || config.height;
                }
                if (node.inputs.batch_size !== undefined) {
                    node.inputs.batch_size = Number(node.inputs.batch_size) || config.imageCount;
                }
            }

            if (node.class_type === 'KSampler') {
                if (node.inputs.steps !== undefined) {
                    node.inputs.steps = Number(node.inputs.steps) || config.steps;
                }
                if (node.inputs.cfg !== undefined) {
                    node.inputs.cfg = Number(node.inputs.cfg) || config.cfg;
                }
                if (node.inputs.sampler_name !== undefined) {
                    node.inputs.sampler_name = this.replaceIfUnset(node.inputs.sampler_name, config.samplerName);
                }
                if (node.inputs.scheduler !== undefined) {
                    node.inputs.scheduler = this.replaceIfUnset(node.inputs.scheduler, config.scheduler);
                }
                if (node.inputs.seed !== undefined) {
                    node.inputs.seed = this.resolveSeed(node.inputs.seed);
                }
            }

            if (node.class_type === 'SaveImage' && node.inputs.filename_prefix !== undefined) {
                node.inputs.filename_prefix = this.replaceIfUnset(node.inputs.filename_prefix, config.filenamePrefix);
            }

            if (node.class_type === 'CLIPTextEncode' && typeof node.inputs.text === 'string') {
                textNodes.push(node);
            }
        }

        if (textNodes.length > 0) {
            const positiveNode = textNodes[0];
            if (!this.containsPlaceholder(positiveNode.inputs.text)) {
                positiveNode.inputs.text = this.buildPositivePrompt(prompt, config);
            }
        }

        if (textNodes.length > 1) {
            const negativeNode = this.findNegativeNode(textNodes) || textNodes[1];
            if (!this.containsPlaceholder(negativeNode.inputs.text)) {
                negativeNode.inputs.text = config.negativePrompt;
            }
        }
    }

    replaceIfUnset(currentValue, nextValue) {
        if (typeof currentValue !== 'string') {
            return nextValue;
        }

        return currentValue.trim() ? currentValue : nextValue;
    }

    containsPlaceholder(value) {
        return typeof value === 'string' && PLACEHOLDER_PATTERN.test(value);
    }

    findNegativeNode(nodes) {
        return nodes.find((node) => {
            const title = String(node._meta?.title || '').toLowerCase();
            const text = String(node.inputs?.text || '').toLowerCase();
            return title.includes('negative') || text.includes('low quality');
        });
    }

    parseWorkflowJson(rawWorkflow) {
        if (typeof rawWorkflow === 'object' && rawWorkflow !== null) {
            return this.normalizeWorkflowJson(rawWorkflow);
        }

        if (typeof rawWorkflow !== 'string' || !rawWorkflow.trim()) {
            throw new Error('Custom workflow JSON is empty.');
        }

        try {
            return this.normalizeWorkflowJson(JSON.parse(rawWorkflow));
        } catch (error) {
            throw new Error(`Custom workflow JSON parse failed: ${error.message}`);
        }
    }

    normalizeWorkflowJson(workflow) {
        if (this.isApiWorkflowFormat(workflow)) {
            return this.deepClone(workflow);
        }

        if (this.isEditorWorkflowFormat(workflow)) {
            return this.convertEditorWorkflowToApi(workflow);
        }

        if (workflow?.prompt && this.isApiWorkflowFormat(workflow.prompt)) {
            return this.deepClone(workflow.prompt);
        }

        return this.deepClone(workflow);
    }

    isApiWorkflowFormat(workflow) {
        if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
            return false;
        }

        return Object.values(workflow).some((node) => (
            node
            && typeof node === 'object'
            && !Array.isArray(node)
            && typeof node.class_type === 'string'
            && node.inputs
            && typeof node.inputs === 'object'
            && !Array.isArray(node.inputs)
        ));
    }

    isEditorWorkflowFormat(workflow) {
        return Boolean(
            workflow
            && typeof workflow === 'object'
            && !Array.isArray(workflow)
            && Array.isArray(workflow.nodes)
            && Array.isArray(workflow.links)
        );
    }

    convertEditorWorkflowToApi(workflow) {
        const linkMap = new Map();
        for (const link of workflow.links || []) {
            if (!Array.isArray(link) || link.length < 5) {
                continue;
            }

            linkMap.set(Number(link[0]), {
                originNodeId: String(link[1]),
                originSlot: Number(link[2])
            });
        }

        const converted = {};

        for (const node of workflow.nodes || []) {
            if (!node || typeof node !== 'object') {
                continue;
            }

            if (node.id === undefined || node.id === null || !node.type) {
                continue;
            }

            const inputs = {};
            const widgetValues = this.extractEditorWidgetValues(node);

            for (const input of node.inputs || []) {
                if (!input || typeof input !== 'object' || !input.name) {
                    continue;
                }

                if (input.link !== null && input.link !== undefined) {
                    const link = linkMap.get(Number(input.link));
                    if (link) {
                        inputs[input.name] = [link.originNodeId, link.originSlot];
                    }
                    continue;
                }

                if (Object.hasOwn(widgetValues, input.name)) {
                    inputs[input.name] = widgetValues[input.name];
                }
            }

            for (const [name, value] of Object.entries(widgetValues)) {
                if (inputs[name] === undefined) {
                    inputs[name] = value;
                }
            }

            converted[String(node.id)] = {
                class_type: node.type,
                inputs,
                _meta: {
                    title: node.title || node.properties?.['Node name for S&R'] || node.type
                }
            };
        }

        if (!Object.keys(converted).length) {
            throw new Error('Custom workflow JSON did not contain any convertible ComfyUI nodes.');
        }

        return converted;
    }

    extractEditorWidgetValues(node) {
        if (node.widgets_values && typeof node.widgets_values === 'object' && !Array.isArray(node.widgets_values)) {
            return this.deepClone(node.widgets_values);
        }

        const values = Array.isArray(node.widgets_values) ? node.widgets_values : [];
        const widgetInputs = (node.inputs || []).filter((input) => (
            input
            && typeof input === 'object'
            && input.name
            && input.widget?.name
            && (input.link === null || input.link === undefined)
        ));

        const mapped = {};
        widgetInputs.forEach((input, index) => {
            if (index < values.length) {
                mapped[input.name] = this.deepClone(values[index]);
            }
        });

        return mapped;
    }

    applyTemplateVariables(value, replacements) {
        if (Array.isArray(value)) {
            return value.map((entry) => this.applyTemplateVariables(entry, replacements));
        }

        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value).map(([key, entry]) => [key, this.applyTemplateVariables(entry, replacements)])
            );
        }

        if (typeof value === 'string') {
            return value.replace(PLACEHOLDER_PATTERN, (_, key) => {
                const replacement = replacements[key];
                return replacement === undefined || replacement === null ? '' : String(replacement);
            });
        }

        return value;
    }

    buildTemplateValues(config, prompt) {
        return {
            prompt: this.buildPositivePrompt(prompt, config),
            raw_prompt: prompt,
            negative_prompt: config.negativePrompt,
            ckpt_name: config.ckptName || '',
            width: config.width,
            height: config.height,
            steps: config.steps,
            cfg: config.cfg,
            sampler_name: config.samplerName,
            scheduler: config.scheduler,
            seed: this.resolveSeed(config.seed),
            filename_prefix: config.filenamePrefix
            ,
            batch_size: config.imageCount
        };
    }

    extractPlaceholders(rawWorkflow) {
        if (typeof rawWorkflow !== 'string') {
            return [];
        }

        const matches = rawWorkflow.matchAll(PLACEHOLDER_PATTERN);
        return [...new Set(Array.from(matches, (match) => match[1]))];
    }

    buildPositivePrompt(prompt, config) {
        return [config.promptPrefix, prompt, config.promptSuffix]
            .filter((value) => typeof value === 'string' && value.trim())
            .join(', ');
    }

    resolveComfyUIConfig(config = {}) {
        const baseUrl = this.normalizeComfyUIUrl(config.comfyuiUrl || 'http://127.0.0.1:8000');
        const timeoutMs = this.parseInteger(config.comfyuiTimeoutMs, 180000, { min: 5000, max: 15 * 60 * 1000 });
        const width = this.parseInteger(config.comfyuiWidth, 768, { min: 256, max: 2048 });
        const height = this.parseInteger(config.comfyuiHeight, 512, { min: 256, max: 2048 });

        return {
            baseUrl,
            ckptName: typeof config.comfyuiModel === 'string' ? config.comfyuiModel.trim() : '',
            width,
            height,
            imageCount: this.parseInteger(config.comfyuiImageCount, 1, { min: 1, max: 8 }),
            steps: this.parseInteger(config.comfyuiSteps, 20, { min: 1, max: 150 }),
            cfg: this.parseFloat(config.comfyuiCfg, 7.5, { min: 0.1, max: 30 }),
            samplerName: typeof config.comfyuiSampler === 'string' && config.comfyuiSampler.trim() ? config.comfyuiSampler.trim() : 'euler',
            scheduler: typeof config.comfyuiScheduler === 'string' && config.comfyuiScheduler.trim() ? config.comfyuiScheduler.trim() : 'normal',
            seed: config.comfyuiSeed,
            timeoutMs,
            negativePrompt: typeof config.comfyuiNegativePrompt === 'string' && config.comfyuiNegativePrompt.trim()
                ? config.comfyuiNegativePrompt.trim()
                : DEFAULT_NEGATIVE_PROMPT,
            promptPrefix: typeof config.comfyuiPromptPrefix === 'string' && config.comfyuiPromptPrefix.trim()
                ? config.comfyuiPromptPrefix.trim()
                : 'RPG game scene',
            promptSuffix: typeof config.comfyuiPromptSuffix === 'string' && config.comfyuiPromptSuffix.trim()
                ? config.comfyuiPromptSuffix.trim()
                : 'high quality, detailed, fantasy art style',
            filenamePrefix: typeof config.comfyuiFilenamePrefix === 'string' && config.comfyuiFilenamePrefix.trim()
                ? config.comfyuiFilenamePrefix.trim()
                : 'rpg_scene',
            workflowMode: config.comfyuiWorkflowMode === 'custom' ? 'custom' : 'default',
            workflowJson: config.comfyuiWorkflowJson,
            maxConcurrency: this.parseInteger(config.comfyuiMaxConcurrency, 1, { min: 1, max: 4 })
        };
    }

    normalizeComfyUIUrl(rawUrl) {
        let parsed;

        try {
            parsed = new URL(rawUrl);
        } catch (error) {
            throw new Error('ComfyUI URL is invalid.');
        }

        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('ComfyUI URL must use http or https.');
        }

        if (!this.isLocalOrPrivateHost(parsed.hostname)) {
            throw new Error('ComfyUI URL must point to localhost or a private network address.');
        }

        parsed.pathname = '';
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString().replace(/\/$/, '');
    }

    isLocalOrPrivateHost(hostname) {
        if (!hostname) {
            return false;
        }

        if (LOCAL_HOSTS.has(hostname)) {
            return true;
        }

        if (/^127\.\d+\.\d+\.\d+$/.test(hostname)) {
            return true;
        }

        if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) {
            return true;
        }

        if (/^192\.168\.\d+\.\d+$/.test(hostname)) {
            return true;
        }

        const private172 = hostname.match(/^172\.(\d+)\.\d+\.\d+$/);
        if (private172) {
            const secondOctet = Number(private172[1]);
            return secondOctet >= 16 && secondOctet <= 31;
        }

        return false;
    }

    async fetchCheckpointModels(baseUrl, timeoutMs) {
        try {
            const result = await this.requestComfyUIJson(baseUrl, '/models/checkpoints', { method: 'GET' }, timeoutMs);
            if (Array.isArray(result)) {
                return result;
            }
        } catch (error) {
            if (!String(error.message || '').includes('/models/checkpoints')) {
                throw error;
            }
        }

        const objectInfo = await this.fetchObjectInfo(baseUrl, 'CheckpointLoaderSimple', timeoutMs);
        return this.extractEnumOptions(objectInfo, 'ckpt_name');
    }

    async fetchObjectInfo(baseUrl, nodeClass, timeoutMs) {
        return this.requestComfyUIJson(
            baseUrl,
            `/object_info/${encodeURIComponent(nodeClass)}`,
            { method: 'GET' },
            timeoutMs
        );
    }

    async fetchSystemStats(baseUrl, timeoutMs) {
        try {
            return await this.requestComfyUIJson(baseUrl, '/system_stats', { method: 'GET' }, timeoutMs);
        } catch (error) {
            return null;
        }
    }

    extractEnumOptions(payload, inputName) {
        if (Array.isArray(payload)) {
            return payload;
        }

        const inputs = payload?.input?.required
            || payload?.input?.optional
            || payload?.[inputName]
            || payload?.CheckpointLoaderSimple?.input?.required
            || payload?.KSampler?.input?.required;

        if (!inputs) {
            return [];
        }

        const target = inputs[inputName] || payload?.[inputName];
        if (Array.isArray(target) && Array.isArray(target[0])) {
            return target[0];
        }

        if (Array.isArray(target)) {
            return target;
        }

        return [];
    }

    async requestComfyUIJson(baseUrl, path, options, timeoutMs) {
        const response = await this.requestComfyUIResponse(baseUrl, path, options, timeoutMs);
        return response.json();
    }

    async requestComfyUIResponse(baseUrl, path, options = {}, timeoutMs = 60000) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        try {
            const response = await this.fetchWithTimeout(`${baseUrl}${path}`, {
                ...options,
                headers
            }, timeoutMs);

            if (!response.ok) {
                const detail = await this.readResponseError(response);
                throw new Error(`ComfyUI ${path} failed: ${detail}`);
            }

            return response;
        } catch (error) {
            throw this.toFriendlyComfyUIError(error, baseUrl);
        }
    }

    async readResponseError(response) {
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            try {
                const body = await response.json();
                return body?.error || body?.message || `${response.status} ${response.statusText}`;
            } catch (error) {
                return `${response.status} ${response.statusText}`;
            }
        }

        try {
            const text = await response.text();
            return text || `${response.status} ${response.statusText}`;
        } catch (error) {
            return `${response.status} ${response.statusText}`;
        }
    }

    toFriendlyComfyUIError(error, baseUrl) {
        const message = String(error?.message || '');

        if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
            return new Error(`Cannot connect to ComfyUI at ${baseUrl}. Make sure ComfyUI is running and the URL is correct.`);
        }

        if (message.includes('aborted')) {
            return new Error(`ComfyUI request timed out while waiting for ${baseUrl}.`);
        }

        return error instanceof Error ? error : new Error(message || 'Unknown ComfyUI error.');
    }

    async fetchWithTimeout(url, options, timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } finally {
            clearTimeout(timer);
        }
    }

    findAllOutputImages(outputs) {
        const images = [];

        for (const nodeOutput of Object.values(outputs || {})) {
            if (Array.isArray(nodeOutput?.images) && nodeOutput.images.length > 0) {
                images.push(...nodeOutput.images);
            }
        }

        return images;
    }

    findFirstOutputImage(outputs) {
        const images = this.findAllOutputImages(outputs);
        return images[0] || null;
    }

    extractHistoryError(promptHistory) {
        const errors = [];
        const messages = promptHistory?.status?.messages || [];

        for (const entry of messages) {
            if (!Array.isArray(entry) || entry.length < 2) {
                continue;
            }

            const payload = entry[1];
            if (payload?.exception_message) {
                errors.push(payload.exception_message);
            } else if (payload?.node_errors) {
                for (const [nodeId, nodeError] of Object.entries(payload.node_errors)) {
                    errors.push(`Node ${nodeId}: ${JSON.stringify(nodeError)}`);
                }
            }
        }

        return errors[0] || 'ComfyUI generation failed.';
    }

    async withComfySlot(limit, task) {
        while (this.activeComfyJobs >= limit) {
            await new Promise((resolve) => this.waitingResolvers.push(resolve));
        }

        this.activeComfyJobs += 1;

        try {
            return await task();
        } finally {
            this.activeComfyJobs = Math.max(0, this.activeComfyJobs - 1);
            const next = this.waitingResolvers.shift();
            if (next) {
                next();
            }
        }
    }

    resolveSeed(seed) {
        if (seed === undefined || seed === null || seed === '' || Number(seed) < 0) {
            return Math.floor(Math.random() * 1_000_000_000);
        }

        const parsed = Number(seed);
        return Number.isFinite(parsed) ? Math.floor(parsed) : Math.floor(Math.random() * 1_000_000_000);
    }

    parseInteger(value, fallback, { min, max } = {}) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }

        return this.clamp(parsed, min, max);
    }

    parseFloat(value, fallback, { min, max } = {}) {
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }

        return this.clamp(parsed, min, max);
    }

    clamp(value, min, max) {
        let next = value;
        if (Number.isFinite(min)) {
            next = Math.max(min, next);
        }
        if (Number.isFinite(max)) {
            next = Math.min(max, next);
        }
        return next;
    }

    deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async generateWithAPI(prompt, config) {
        const apiUrl = config.imageApiUrl || 'https://api.openai.com/v1/images/generations';
        const apiKey = config.imageApiKey;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    prompt: `RPG game scene: ${prompt}`,
                    n: 1,
                    size: '512x512'
                })
            });

            if (!response.ok) {
                throw new Error(`Image API error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.data[0].url;
        } catch (error) {
            console.error('Image API error:', error);
            throw error;
        }
    }
}

module.exports = ImageService;
