'use strict';

const express = require('express');
const { createHttpError, asyncRoute } = require('./helpers');
const { validateBody, schemas } = require('../middleware/validate');
const { z } = require('zod');
const logger = require('../middleware/logger');

/**
 * Settings routes — encrypted storage for LLM keys, image generation config, etc.
 *
 * Sensitive values (API keys, secrets, tokens) are automatically encrypted
 * at rest in the SQLite database. The GET endpoint returns masked values
 * by default; the `reveal` query parameter can decrypt them (admin only).
 */
module.exports = function({ db }) {
    const router = express.Router();

    // --- Validation schemas ---

    const saveSettingSchema = z.object({
        key: z.string().min(1).max(200).regex(/^[a-zA-Z0-9_.\-/:]+$/, 'Invalid setting key format'),
        value: z.union([z.string().max(50000), z.number(), z.boolean(), z.record(z.unknown()), z.array(z.unknown())])
    });

    const saveSettingsBatchSchema = z.record(
        z.string().min(1).max(200),
        z.union([z.string().max(50000), z.number(), z.boolean(), z.record(z.unknown()), z.array(z.unknown())])
    );

    // -----------------------------------------------------------------------
    // GET /api/settings
    // List all settings (sensitive values are masked by default)
    // -----------------------------------------------------------------------
    router.get('/', asyncRoute('Get settings error', async (req, res) => {
        const reveal = req.query.reveal === 'true';

        // Only allow revealing secrets over authenticated connections
        if (reveal && process.env.NODE_ENV === 'production') {
            // In production, require admin role to reveal secrets
            if (!req.user || req.user.role !== 'admin') {
                throw createHttpError(403, '只有管理员可以查看加密设置的明文');
            }
        }

        const settings = db.loadAllSettings({ revealSecrets: reveal });

        res.json({
            success: true,
            settings,
            schemaVersion: db.getSchemaVersion()
        });
    }));

    // -----------------------------------------------------------------------
    // GET /api/settings/:key
    // Get a single setting value
    // -----------------------------------------------------------------------
    router.get('/:key', asyncRoute('Get setting error', async (req, res) => {
        const key = req.params.key;
        const reveal = req.query.reveal === 'true';

        if (reveal && process.env.NODE_ENV === 'production') {
            if (!req.user || req.user.role !== 'admin') {
                throw createHttpError(403, '只有管理员可以查看加密设置的明文');
            }
        }

        const value = db.loadSetting(key);
        if (value === null) {
            throw createHttpError(404, `设置项 "${key}" 不存在`);
        }

        res.json({
            success: true,
            key,
            value
        });
    }));

    // -----------------------------------------------------------------------
    // POST /api/settings
    // Save a single setting (auto-encrypts sensitive keys)
    // -----------------------------------------------------------------------
    router.post('/', validateBody(saveSettingSchema), asyncRoute('Save setting error', async (req, res) => {
        const { key, value } = req.body;

        logger.info('Setting saved', { key, sensitive: /api[_-]?key|secret|password|token|credential/i.test(key) });
        const success = db.saveSetting(key, value);

        if (!success) {
            throw createHttpError(500, `保存设置 "${key}" 失败`);
        }

        res.json({ success: true, key });
    }));

    // -----------------------------------------------------------------------
    // POST /api/settings/batch
    // Save multiple settings at once (auto-encrypts sensitive keys)
    // -----------------------------------------------------------------------
    router.post('/batch', validateBody(saveSettingsBatchSchema), asyncRoute('Batch save settings error', async (req, res) => {
        const settingsMap = req.body;
        const keyCount = Object.keys(settingsMap).length;

        logger.info('Batch settings save', { count: keyCount });
        const success = db.saveSettingsBatch(settingsMap);

        if (!success) {
            throw createHttpError(500, '批量保存设置失败');
        }

        res.json({ success: true, count: keyCount });
    }));

    // -----------------------------------------------------------------------
    // DELETE /api/settings/:key
    // Delete a setting
    // -----------------------------------------------------------------------
    router.delete('/:key', asyncRoute('Delete setting error', async (req, res) => {
        const key = req.params.key;

        logger.info('Setting deleted', { key });
        const success = db.deleteSetting(key);

        if (!success) {
            throw createHttpError(500, `删除设置 "${key}" 失败`);
        }

        res.json({ success: true, key });
    }));

    // -----------------------------------------------------------------------
    // POST /api/settings/migrate-env
    // One-time migration: import settings from .env file to encrypted DB storage
    // -----------------------------------------------------------------------
    router.post('/migrate-env', asyncRoute('Migrate env error', async (req, res) => {
        const ENV_KEY_MAP = {
            'OPENAI_API_KEY': 'openai_api_key',
            'ANTHROPIC_API_KEY': 'anthropic_api_key',
            'IMAGE_API_KEY': 'image_api_key',
            'OPENAI_URL': 'openai_url',
            'OPENAI_MODEL': 'openai_model',
            'LLM_SOURCE': 'llm_source',
            'OLLAMA_URL': 'ollama_url',
            'OLLAMA_MODEL': 'ollama_model',
            'COMFYUI_URL': 'comfyui_url',
            'IMAGE_SOURCE': 'image_source'
        };

        const migrated = [];
        const skipped = [];

        for (const [envKey, settingKey] of Object.entries(ENV_KEY_MAP)) {
            const envValue = process.env[envKey];
            if (envValue && envValue.length > 0) {
                // Don't overwrite existing DB settings
                const existing = db.loadSetting(settingKey);
                if (existing === null) {
                    db.saveSetting(settingKey, envValue);
                    migrated.push({ envKey, settingKey });
                } else {
                    skipped.push({ envKey, settingKey, reason: 'already_exists' });
                }
            } else {
                skipped.push({ envKey, settingKey, reason: 'not_set' });
            }
        }

        logger.info('Env migration completed', { migrated: migrated.length, skipped: skipped.length });

        res.json({
            success: true,
            migrated,
            skipped,
            message: `已迁移 ${migrated.length} 项设置，跳过 ${skipped.length} 项`
        });
    }));

    return router;
};
