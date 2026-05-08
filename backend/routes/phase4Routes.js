'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { createHttpError, asyncRoute } = require('./helpers');

/**
 * Check a single achievement condition against the current game state.
 * Returns true if the condition is met.
 */
function checkCondition(condition, gameState, extraContext = {}) {
    if (!condition || !condition.type) return false;

    const player = gameState.player || {};
    const stats = player.stats || {};
    const inventory = gameState.inventory || [];
    const quests = gameState.quests || [];
    const characterStates = gameState.characterStates || [];
    const turn = gameState.turn || 0;
    const history = gameState.history || [];

    switch (condition.type) {
        case 'turns':
            return turn >= (condition.min || 0);

        case 'inventory_count':
            return inventory.length >= (condition.min || 0);

        case 'allies': {
            const allyCount = characterStates.filter(c =>
                (c.relationship || 0) > 0
            ).length;
            return allyCount >= (condition.min || 0);
        }

        case 'all_hostile':
            return characterStates.length > 0 && characterStates.every(c =>
                (c.relationship || 0) < 0
            );

        case 'consecutive_dice_success': {
            const recentDice = extraContext.recentDiceResults || [];
            let consecutive = 0;
            let maxConsecutive = 0;
            for (const d of recentDice) {
                if (d.success) {
                    consecutive++;
                    maxConsecutive = Math.max(maxConsecutive, consecutive);
                } else {
                    consecutive = 0;
                }
            }
            return maxConsecutive >= (condition.min || 3);
        }

        case 'consecutive_dice_failure': {
            const recentDice2 = extraContext.recentDiceResults || [];
            let consecutive2 = 0;
            let maxConsecutive2 = 0;
            for (const d of recentDice2) {
                if (!d.success) {
                    consecutive2++;
                    maxConsecutive2 = Math.max(maxConsecutive2, consecutive2);
                } else {
                    consecutive2 = 0;
                }
            }
            return maxConsecutive2 >= (condition.min || 3);
        }

        case 'natural_20':
            return (extraContext.recentDiceResults || []).some(d => d.roll === 20);

        case 'natural_1':
            return (extraContext.recentDiceResults || []).some(d => d.roll === 1);

        case 'quests_completed': {
            const completedCount = quests.filter(q => q.completed).length;
            return completedCount >= (condition.min || 0);
        }

        case 'low_hp_survive': {
            // Check if any HP stat is below 10% of max while still alive
            for (const [, value] of Object.entries(stats)) {
                if (typeof value === 'object' && value !== null && value.current !== undefined && value.max !== undefined) {
                    const ratio = value.current / (value.max || 1);
                    if (ratio <= 0.1 && ratio > 0) {
                        return true;
                    }
                }
            }
            return false;
        }

        case 'games_completed': {
            const completedGames = extraContext.completedGamesCount || 0;
            return completedGames >= (condition.min || 0);
        }

        case 'game_types': {
            const gameTypes = extraContext.gameTypes || [];
            return gameTypes.length >= (condition.min || 0);
        }

        default:
            return false;
    }
}

/**
 * Extract dice check results from game history.
 * The game engine stores diceCheckResult in the state after each action.
 */
function extractDiceResults(gameState) {
    const results = [];
    const history = gameState.history || [];
    for (const entry of history) {
        if (entry.diceCheckResult) {
            results.push(entry.diceCheckResult);
        }
    }
    // Also check for the last dice check result stored on the state
    if (gameState.lastDiceResults && Array.isArray(gameState.lastDiceResults)) {
        return [...results, ...gameState.lastDiceResults].slice(-20);
    }
    return results.slice(-20);
}

/**
 * Generate a star rating based on game state analysis.
 */
function generateRating(gameState) {
    let score = 0;
    const turn = gameState.turn || 0;
    const inventory = gameState.inventory || [];
    const quests = gameState.quests || [];
    const characterStates = gameState.characterStates || [];
    const history = gameState.history || [];

    // Turn-based scoring
    if (turn >= 1) score += 1;
    if (turn >= 10) score += 1;
    if (turn >= 25) score += 1;
    if (turn >= 40) score += 1;

    // Quest completion
    const completedQuests = quests.filter(q => q.completed).length;
    score += Math.min(completedQuests, 3);

    // Character relationships (positive relationships)
    const allies = characterStates.filter(c => (c.relationship || 0) > 0).length;
    if (allies >= 3) score += 1;

    // Inventory richness
    if (inventory.length >= 5) score += 1;

    // Story depth (number of meaningful choices)
    if (history.length >= 5) score += 1;

    return Math.min(Math.max(score, 1), 5);
}

/**
 * Extract key choices from game history.
 */
function extractKeyChoices(history) {
    if (!Array.isArray(history)) return [];
    return history
        .filter(h => h.action)
        .map(h => ({
            turn: h.turn,
            action: h.action,
            response: h.response ? (h.response.length > 200 ? h.response.slice(0, 200) + '...' : h.response) : null
        }));
}

/**
 * Extract character endings from game state.
 */
function extractCharacterEndings(characterStates) {
    if (!Array.isArray(characterStates)) return [];
    return characterStates.map(c => ({
        name: c.name || c.id || '未知角色',
        relationship: c.relationship || 0,
        mood: c.mood || '未知',
        state: c.state || '未知',
        location: c.location || '未知'
    }));
}

module.exports = function(dependencies) {
    const router = express.Router();
    const { db, games } = dependencies;

    // ===================================================================
    // ACHIEVEMENT ENDPOINTS
    // ===================================================================

    // GET /api/achievements - List all achievements with unlock status for current game
    router.get('/achievements', asyncRoute('Get achievements error', async (req, res) => {
        const { gameId } = req.query;

        try {
            const database = db.getDb();
            if (!database) {
                throw createHttpError(500, '数据库未初始化');
            }

            const achievements = database.prepare('SELECT * FROM achievements').all();

            let unlockedMap = {};
            if (gameId) {
                const unlocked = database.prepare(
                    'SELECT achievement_id, unlocked_at FROM player_achievements WHERE game_id = ?'
                ).all(gameId);
                for (const row of unlocked) {
                    unlockedMap[row.achievement_id] = row.unlocked_at;
                }
            }

            const result = achievements.map(a => ({
                id: a.id,
                name: a.name,
                description: a.description,
                icon: a.icon,
                category: a.category,
                rarity: a.rarity,
                condition: JSON.parse(a.condition_json),
                unlocked: !!unlockedMap[a.id],
                unlockedAt: unlockedMap[a.id] || null
            }));

            res.json({ achievements: result, total: result.length, unlockedCount: Object.keys(unlockedMap).length });
        } catch (error) {
            console.error('[Phase4] Get achievements error:', error.message);
            throw error;
        }
    }));

    // POST /api/achievements/check - Check and unlock achievements based on game state
    router.post('/achievements/check', asyncRoute('Check achievements error', async (req, res) => {
        const { gameId } = req.body;

        if (!gameId) {
            throw createHttpError(400, '缺少 gameId 参数');
        }

        try {
            const database = db.getDb();
            if (!database) {
                throw createHttpError(500, '数据库未初始化');
            }

            // Get game state
            let gameState = null;
            const game = games.get(gameId);
            if (game && game.state) {
                gameState = game.state;
            } else {
                const persisted = db.loadGame(gameId);
                if (persisted && persisted.state) {
                    gameState = persisted.state;
                }
            }

            if (!gameState) {
                throw createHttpError(404, '游戏不存在或无游戏状态');
            }

            // Build extra context
            const recentDiceResults = extractDiceResults(gameState);

            // Count completed games across all stored games
            const allGames = db.loadAllGames();
            const completedGamesCount = allGames.filter(g =>
                g.state && g.state.gameOver === true
            ).length;

            // Collect unique game types
            const gameTypes = [...new Set(
                allGames
                    .map(g => g.config?.gameType || g.data?.type || 'custom')
                    .filter(Boolean)
            )];

            const extraContext = {
                recentDiceResults,
                completedGamesCount,
                gameTypes
            };

            // Get all achievements
            const achievements = database.prepare('SELECT * FROM achievements').all();

            // Get already unlocked achievements for this game
            const alreadyUnlocked = database.prepare(
                'SELECT achievement_id FROM player_achievements WHERE game_id = ?'
            ).all(gameId);
            const unlockedSet = new Set(alreadyUnlocked.map(r => r.achievement_id));

            const newlyUnlocked = [];
            const now = Date.now();

            for (const achievement of achievements) {
                if (unlockedSet.has(achievement.id)) continue;

                const condition = JSON.parse(achievement.condition_json);
                if (checkCondition(condition, gameState, extraContext)) {
                    database.prepare(
                        'INSERT INTO player_achievements (achievement_id, game_id, unlocked_at) VALUES (?, ?, ?)'
                    ).run(achievement.id, gameId, now);

                    newlyUnlocked.push({
                        id: achievement.id,
                        name: achievement.name,
                        description: achievement.description,
                        icon: achievement.icon,
                        category: achievement.category,
                        rarity: achievement.rarity,
                        unlockedAt: now
                    });

                    console.log(`[Phase4] Achievement unlocked: ${achievement.name} (${achievement.id}) in game ${gameId}`);
                }
            }

            res.json({
                newlyUnlocked,
                totalChecked: achievements.length,
                previouslyUnlocked: unlockedSet.size
            });
        } catch (error) {
            console.error('[Phase4] Check achievements error:', error.message);
            throw error;
        }
    }));

    // ===================================================================
    // GAME REVIEW ENDPOINTS
    // ===================================================================

    // POST /api/games/:gameId/review - Generate a game review/summary
    router.post('/games/:gameId/review', asyncRoute('Generate review error', async (req, res) => {
        const { gameId } = req.params;

        try {
            const database = db.getDb();
            if (!database) {
                throw createHttpError(500, '数据库未初始化');
            }

            // Get game state
            let gameState = null;
            let gameConfig = null;
            let gameData = null;
            let createdAt = null;

            const game = games.get(gameId);
            if (game) {
                gameState = game.state;
                gameConfig = game.config;
                gameData = game.data;
                createdAt = game.createdAt;
            } else {
                const persisted = db.loadGame(gameId);
                if (persisted) {
                    gameState = persisted.state;
                    gameConfig = persisted.config;
                    gameData = persisted.data;
                    createdAt = persisted.createdAt;
                }
            }

            if (!gameState) {
                throw createHttpError(404, '游戏不存在或无游戏状态');
            }

            const history = gameState.history || [];
            const characterStates = gameState.characterStates || [];
            const quests = gameState.quests || [];
            const inventory = gameState.inventory || [];
            const turn = gameState.turn || 0;

            // Generate rating
            const rating = generateRating(gameState);

            // Build summary
            const gameName = gameState.name || gameData?.name || '未命名冒险';
            const gameType = gameConfig?.gameType || gameData?.type || 'custom';
            const playerLocation = gameState.player?.location || '未知';
            const isGameOver = gameState.gameOver || false;

            let summary = '';
            if (isGameOver) {
                summary = `「${gameName}」已经结束。`;
            } else {
                summary = `「${gameName}」的冒险仍在继续。`;
            }
            summary += ` 共经历 ${turn} 个回合，`;
            summary += `最终抵达${playerLocation}。`;

            const completedQuests = quests.filter(q => q.completed);
            if (completedQuests.length > 0) {
                summary += ` 完成了 ${completedQuests.length} 个任务。`;
            }
            if (inventory.length > 0) {
                summary += ` 收集了 ${inventory.length} 件物品。`;
            }

            // Extract key choices
            const keyChoices = extractKeyChoices(history);

            // Extract character endings
            const characterEndings = extractCharacterEndings(characterStates);

            // Calculate play duration (rough estimate: from createdAt to now, or from history)
            const playDuration = createdAt ? (Date.now() - createdAt) : 0;

            // Check if review already exists
            const existing = database.prepare('SELECT * FROM game_reviews WHERE game_id = ?').get(gameId);

            const reviewData = {
                rating,
                summary,
                keyChoices: JSON.stringify(keyChoices),
                characterEndings: JSON.stringify(characterEndings),
                playDuration,
                turnCount: turn
            };

            if (existing) {
                database.prepare(`
                    UPDATE game_reviews SET
                        rating = ?, summary = ?, key_choices = ?, character_endings = ?,
                        play_duration = ?, turn_count = ?
                    WHERE game_id = ?
                `).run(
                    reviewData.rating, reviewData.summary, reviewData.keyChoices,
                    reviewData.characterEndings, reviewData.playDuration, reviewData.turnCount,
                    gameId
                );
            } else {
                database.prepare(`
                    INSERT INTO game_reviews (game_id, rating, summary, key_choices, character_endings, play_duration, turn_count, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    gameId, reviewData.rating, reviewData.summary, reviewData.keyChoices,
                    reviewData.characterEndings, reviewData.playDuration, reviewData.turnCount,
                    Date.now()
                );
            }

            console.log(`[Phase4] Review generated for game ${gameId}, rating: ${rating}`);

            res.json({
                gameId,
                gameName,
                gameType,
                rating,
                summary,
                keyChoices,
                characterEndings,
                playDuration,
                turnCount: turn,
                isGameOver,
                completedQuests: completedQuests.map(q => ({ id: q.id, name: q.name })),
                inventoryCount: inventory.length
            });
        } catch (error) {
            console.error('[Phase4] Generate review error:', error.message);
            throw error;
        }
    }));

    // GET /api/games/:gameId/review - Get existing review for a game
    router.get('/games/:gameId/review', asyncRoute('Get review error', async (req, res) => {
        const { gameId } = req.params;

        try {
            const database = db.getDb();
            if (!database) {
                throw createHttpError(500, '数据库未初始化');
            }

            const row = database.prepare('SELECT * FROM game_reviews WHERE game_id = ?').get(gameId);
            if (!row) {
                throw createHttpError(404, '该游戏暂无评价');
            }

            let keyChoices = [];
            try { keyChoices = JSON.parse(row.key_choices || '[]'); } catch { keyChoices = []; }

            let characterEndings = [];
            try { characterEndings = JSON.parse(row.character_endings || '[]'); } catch { characterEndings = []; }

            res.json({
                gameId: row.game_id,
                rating: row.rating,
                summary: row.summary,
                keyChoices,
                characterEndings,
                playDuration: row.play_duration,
                turnCount: row.turn_count,
                createdAt: row.created_at
            });
        } catch (error) {
            console.error('[Phase4] Get review error:', error.message);
            throw error;
        }
    }));

    // ===================================================================
    // SHARE ENDPOINTS
    // ===================================================================

    // POST /api/share/story - Export game story as structured text
    router.post('/share/story', asyncRoute('Share story error', async (req, res) => {
        const { gameId } = req.body;

        if (!gameId) {
            throw createHttpError(400, '缺少 gameId 参数');
        }

        try {
            // Get game state
            let gameState = null;
            let gameData = null;

            const game = games.get(gameId);
            if (game) {
                gameState = game.state;
                gameData = game.data;
            } else {
                const persisted = db.loadGame(gameId);
                if (persisted) {
                    gameState = persisted.state;
                    gameData = persisted.data;
                }
            }

            if (!gameState) {
                throw createHttpError(404, '游戏不存在或无游戏状态');
            }

            const history = gameState.history || [];
            const gameName = gameState.name || gameData?.name || '未命名冒险';
            const gameType = gameData?.type || 'custom';

            // Build the story timeline
            const timeline = [];
            const openingLog = gameState.initialLog || '';
            if (openingLog) {
                timeline.push({
                    type: 'opening',
                    turn: 0,
                    narration: openingLog,
                    isHighlight: false
                });
            }

            for (const entry of history) {
                timeline.push({
                    type: 'action',
                    turn: entry.turn,
                    action: entry.action || '',
                    narration: entry.response || '',
                    location: entry.location || null,
                    isHighlight: true // Player choices are always highlighted
                });
            }

            // Build formatted text output
            const lines = [];
            lines.push(`【${gameName}】冒险记录`);
            lines.push(`游戏类型：${gameType}`);
            lines.push(`总回合数：${gameState.turn || 0}`);
            lines.push('─'.repeat(30));

            for (const item of timeline) {
                if (item.type === 'opening') {
                    lines.push(`\n📖 开场`);
                    lines.push(item.narration);
                } else {
                    lines.push(`\n--- 第 ${item.turn} 回合 ---`);
                    lines.push(`▸ 你选择了：${item.action}`);
                    if (item.location) {
                        lines.push(`📍 地点：${item.location}`);
                    }
                    lines.push(item.narration);
                }
            }

            if (gameState.gameOver) {
                lines.push('\n' + '═'.repeat(30));
                lines.push(`🏁 游戏结束：${gameState.gameOverMessage || '冒险落幕'}`);
            }

            const fullText = lines.join('\n');

            console.log(`[Phase4] Story exported for game ${gameId}, ${timeline.length} entries`);

            res.json({
                gameId,
                gameName,
                gameType,
                timeline,
                fullText,
                turnCount: gameState.turn || 0,
                exportedAt: Date.now()
            });
        } catch (error) {
            console.error('[Phase4] Share story error:', error.message);
            throw error;
        }
    }));

    // GET /api/share/card/:gameId - Get share card data
    router.get('/share/card/:gameId', asyncRoute('Share card error', async (req, res) => {
        const { gameId } = req.params;

        try {
            // Get game state
            let gameState = null;
            let gameConfig = null;
            let gameData = null;
            let createdAt = null;

            const game = games.get(gameId);
            if (game) {
                gameState = game.state;
                gameConfig = game.config;
                gameData = game.data;
                createdAt = game.createdAt;
            } else {
                const persisted = db.loadGame(gameId);
                if (persisted) {
                    gameState = persisted.state;
                    gameConfig = persisted.config;
                    gameData = persisted.data;
                    createdAt = persisted.createdAt;
                }
            }

            if (!gameState) {
                throw createHttpError(404, '游戏不存在');
            }

            const gameName = gameState.name || gameData?.name || '未命名冒险';
            const gameType = gameConfig?.gameType || gameData?.type || 'custom';

            // Key stats for the card
            const turnCount = gameState.turn || 0;
            const inventoryCount = (gameState.inventory || []).length;
            const completedQuests = (gameState.quests || []).filter(q => q.completed).length;
            const totalQuests = (gameState.quests || []).length;
            const characterCount = (gameState.characterStates || []).length;
            const isGameOver = gameState.gameOver || false;
            const playerLocation = gameState.player?.location || '未知';

            // Calculate play time
            const playDuration = createdAt ? (Date.now() - createdAt) : 0;
            const playMinutes = Math.round(playDuration / 60000);

            // Emoji map for game type
            const typeIcons = {
                adventure: '⚔️',
                dungeon: '🏰',
                romance: '💕',
                mystery: '🔍',
                fantasy: '🧙',
                scifi: '🚀',
                survival: '🏕️',
                kingdom: '👑',
                cultivation: '🧘',
                custom: '🎮'
            };

            res.json({
                gameId,
                gameName,
                gameType,
                typeIcon: typeIcons[gameType] || '🎮',
                turnCount,
                inventoryCount,
                completedQuests,
                totalQuests,
                characterCount,
                playerLocation,
                isGameOver,
                gameOverMessage: gameState.gameOverMessage || null,
                playDuration,
                playMinutes,
                rating: generateRating(gameState),
                createdAt
            });
        } catch (error) {
            console.error('[Phase4] Share card error:', error.message);
            throw error;
        }
    }));

    // ===================================================================
    // TEMPLATE ENDPOINTS
    // ===================================================================

    // GET /api/templates - List all templates
    router.get('/templates', asyncRoute('List templates error', async (req, res) => {
        try {
            const database = db.getDb();
            if (!database) {
                throw createHttpError(500, '数据库未初始化');
            }

            const { public: publicOnly } = req.query;

            let rows;
            if (publicOnly === 'true' || publicOnly === '1') {
                rows = database.prepare('SELECT * FROM game_templates WHERE is_public = 1 ORDER BY updated_at DESC').all();
            } else {
                rows = database.prepare('SELECT * FROM game_templates ORDER BY updated_at DESC').all();
            }

            const templates = rows.map(r => ({
                id: r.id,
                name: r.name,
                description: r.description,
                gameType: r.game_type,
                coverIcon: r.cover_icon,
                isPublic: !!r.is_public,
                useCount: r.use_count,
                createdAt: r.created_at,
                updatedAt: r.updated_at
            }));

            res.json({ templates, total: templates.length });
        } catch (error) {
            console.error('[Phase4] List templates error:', error.message);
            throw error;
        }
    }));

    // POST /api/templates - Create a new template from current config
    router.post('/templates', asyncRoute('Create template error', async (req, res) => {
        const { name, description, gameType, config, coverIcon, isPublic } = req.body;

        if (!name) {
            throw createHttpError(400, '模板名称不能为空');
        }
        if (!config) {
            throw createHttpError(400, '模板配置不能为空');
        }

        try {
            const database = db.getDb();
            if (!database) {
                throw createHttpError(500, '数据库未初始化');
            }

            const id = uuidv4();
            const now = Date.now();
            const configJson = typeof config === 'string' ? config : JSON.stringify(config);

            database.prepare(`
                INSERT INTO game_templates (id, name, description, game_type, config_json, cover_icon, is_public, use_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                id, name, description || null, gameType || 'custom',
                configJson, coverIcon || '🎮', isPublic ? 1 : 0, 0, now, now
            );

            console.log(`[Phase4] Template created: ${name} (${id})`);

            res.json({
                id,
                name,
                description: description || null,
                gameType: gameType || 'custom',
                coverIcon: coverIcon || '🎮',
                isPublic: !!isPublic,
                useCount: 0,
                createdAt: now,
                updatedAt: now
            });
        } catch (error) {
            console.error('[Phase4] Create template error:', error.message);
            throw error;
        }
    }));

    // GET /api/templates/:id - Get a template
    router.get('/templates/:id', asyncRoute('Get template error', async (req, res) => {
        const { id } = req.params;

        try {
            const database = db.getDb();
            if (!database) {
                throw createHttpError(500, '数据库未初始化');
            }

            const row = database.prepare('SELECT * FROM game_templates WHERE id = ?').get(id);
            if (!row) {
                throw createHttpError(404, '模板不存在');
            }

            let config = null;
            try { config = JSON.parse(row.config_json); } catch { config = row.config_json; }

            res.json({
                id: row.id,
                name: row.name,
                description: row.description,
                gameType: row.game_type,
                config,
                coverIcon: row.cover_icon,
                isPublic: !!row.is_public,
                useCount: row.use_count,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            });
        } catch (error) {
            console.error('[Phase4] Get template error:', error.message);
            throw error;
        }
    }));

    // DELETE /api/templates/:id - Delete a template
    router.delete('/templates/:id', asyncRoute('Delete template error', async (req, res) => {
        const { id } = req.params;

        try {
            const database = db.getDb();
            if (!database) {
                throw createHttpError(500, '数据库未初始化');
            }

            const existing = database.prepare('SELECT id FROM game_templates WHERE id = ?').get(id);
            if (!existing) {
                throw createHttpError(404, '模板不存在');
            }

            database.prepare('DELETE FROM game_templates WHERE id = ?').run(id);

            console.log(`[Phase4] Template deleted: ${id}`);

            res.json({ success: true, id });
        } catch (error) {
            console.error('[Phase4] Delete template error:', error.message);
            throw error;
        }
    }));

    // POST /api/templates/:id/use - Increment use count for a template
    router.post('/templates/:id/use', asyncRoute('Use template error', async (req, res) => {
        const { id } = req.params;

        try {
            const database = db.getDb();
            if (!database) {
                throw createHttpError(500, '数据库未初始化');
            }

            const existing = database.prepare('SELECT * FROM game_templates WHERE id = ?').get(id);
            if (!existing) {
                throw createHttpError(404, '模板不存在');
            }

            const newCount = (existing.use_count || 0) + 1;
            database.prepare(`
                UPDATE game_templates SET use_count = ?, updated_at = ? WHERE id = ?
            `).run(newCount, Date.now(), id);

            console.log(`[Phase4] Template used: ${existing.name} (${id}), count: ${newCount}`);

            res.json({ success: true, id, useCount: newCount });
        } catch (error) {
            console.error('[Phase4] Use template error:', error.message);
            throw error;
        }
    }));

    return router;
};
