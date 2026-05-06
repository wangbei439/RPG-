const { z } = require('zod');

/**
 * Input validation schemas using Zod.
 * Provides centralized, reusable validation for all API endpoints.
 */

// --- Common schemas ---
const nonEmptyString = z.string().min(1).max(10000);
const gameIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid game ID format');
const projectIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid project ID format');

// --- Auth schemas ---
const loginSchema = z.object({
    password: z.string().min(1).max(256)
});

// --- Game schemas ---
const startGameSchema = z.object({
    // Accepts empty body
}).passthrough().optional();

const playerActionSchema = z.object({
    action: nonEmptyString,
    imageConfig: z.record(z.unknown()).optional(),
    streaming: z.boolean().optional()
});

const generateImageSchema = z.object({
    prompt: z.string().min(1).max(5000),
    count: z.number().int().min(1).max(8).optional(),
    comfyuiImageCount: z.number().int().min(1).max(8).optional()
}).passthrough();

const restoreGameSchema = z.object({
    gameData: z.record(z.unknown()).optional(),
    gameState: z.record(z.unknown()).optional(),
    config: z.record(z.unknown()).optional()
}).passthrough();

// --- Generation schemas ---
const createGenerationSessionSchema = z.object({
    userInput: nonEmptyString,
    gameType: z.string().min(1).max(50),
    projectId: z.string().optional(),
    config: z.record(z.unknown()).optional()
}).passthrough();

// --- Project schemas ---
const createProjectSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    type: z.string().max(50).optional()
}).passthrough();

const updateProjectSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    projectData: z.record(z.unknown()).optional()
}).passthrough();

/**
 * Middleware factory: validates req.body against a Zod schema.
 * On success, replaces req.body with the parsed/validated data.
 * On failure, returns 400 with a descriptive error.
 */
function validateBody(schema) {
    return (req, res, next) => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
                return res.status(400).json({ error: `输入验证失败: ${errors}` });
            }
            req.body = result.data;
            next();
        } catch (err) {
            return res.status(400).json({ error: `输入验证异常: ${err.message}` });
        }
    };
}

module.exports = {
    z,
    schemas: {
        login: loginSchema,
        startGame: startGameSchema,
        playerAction: playerActionSchema,
        generateImage: generateImageSchema,
        restoreGame: restoreGameSchema,
        createGenerationSession: createGenerationSessionSchema,
        createProject: createProjectSchema,
        updateProject: updateProjectSchema,
        gameId: gameIdSchema,
        projectId: projectIdSchema
    },
    validateBody
};
