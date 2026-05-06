const { v4: uuidv4 } = require('uuid');

/**
 * Tests for the settings API and encrypted database storage.
 * Uses the real database module but with a test database path.
 */
describe('Settings API & Encrypted Storage - 设置加密存储', () => {
    // We test the database module's settings functions directly,
    // since the API routes are thin wrappers around them.

    let db;

    beforeAll(() => {
        // Use the real database module (it will use its default path)
        db = require('../database');
        db.initDatabase();
        db.runMigrations();
    });

    afterAll(() => {
        // Clean up test settings
        try {
            db.deleteSetting('test_api_key');
            db.deleteSetting('test_llm_config');
            db.deleteSetting('test_regular_setting');
            db.deleteSetting('test_batch_1');
            db.deleteSetting('test_batch_2');
            db.deleteSetting('test_password');
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('saveSetting / loadSetting - 单项设置存取', () => {
        test('应能保存和加载普通设置', () => {
            db.saveSetting('test_regular_setting', 'hello world');
            const value = db.loadSetting('test_regular_setting');
            expect(value).toBe('hello world');
        });

        test('应能保存和加载对象值', () => {
            const config = { model: 'gpt-4', temperature: 0.7 };
            db.saveSetting('test_llm_config', config);
            const value = db.loadSetting('test_llm_config');
            expect(value).toEqual(config);
        });

        test('API密钥应自动加密存储', () => {
            const secretKey = 'sk-proj-1234567890abcdefghij';
            db.saveSetting('test_api_key', secretKey);

            // loadSetting should decrypt automatically and return the original value
            const loaded = db.loadSetting('test_api_key');
            expect(loaded).toBe(secretKey);

            // Verify it's actually encrypted in the database by checking the raw stored value
            const database = db.getDb();
            const row = database.prepare('SELECT * FROM settings WHERE key = ?').get('test_api_key');
            expect(row.encrypted).toBe(1);
            expect(row.value).not.toBe(secretKey);
            expect(row.value.length).toBeGreaterThan(secretKey.length);
        });

        test('密码字段应自动加密', () => {
            db.saveSetting('test_password', 'super-secret-password');
            const loaded = db.loadSetting('test_password');
            expect(loaded).toBe('super-secret-password');

            const database = db.getDb();
            const row = database.prepare('SELECT * FROM settings WHERE key = ?').get('test_password');
            expect(row.encrypted).toBe(1);
        });

        test('更新设置应覆盖旧值', () => {
            db.saveSetting('test_regular_setting', 'value_v1');
            expect(db.loadSetting('test_regular_setting')).toBe('value_v1');

            db.saveSetting('test_regular_setting', 'value_v2');
            expect(db.loadSetting('test_regular_setting')).toBe('value_v2');
        });

        test('加载不存在的设置应返回null', () => {
            expect(db.loadSetting('nonexistent_setting_xyz')).toBeNull();
        });

        test('删除设置应生效', () => {
            db.saveSetting('test_regular_setting', 'to-be-deleted');
            db.deleteSetting('test_regular_setting');
            expect(db.loadSetting('test_regular_setting')).toBeNull();
        });
    });

    describe('saveSettingsBatch - 批量保存', () => {
        test('应能在事务中批量保存多个设置', () => {
            const result = db.saveSettingsBatch({
                'test_batch_1': 'value1',
                'test_batch_2': { nested: true }
            });
            expect(result).toBe(true);

            expect(db.loadSetting('test_batch_1')).toBe('value1');
            expect(db.loadSetting('test_batch_2')).toEqual({ nested: true });
        });
    });

    describe('loadAllSettings - 加载所有设置', () => {
        test('应返回所有设置（敏感值遮蔽）', () => {
            db.saveSetting('test_api_key', 'sk-secret-key-12345678');
            db.saveSetting('test_regular_setting', 'visible-value');

            const settings = db.loadAllSettings();
            expect(settings['test_regular_setting']).toBe('visible-value');
            // Encrypted values should be masked
            expect(settings['test_api_key']).not.toBe('sk-secret-key-12345678');
            expect(settings['test_api_key']).toContain('****');
        });

        test('revealSecrets=true应返回解密值', () => {
            const settings = db.loadAllSettings({ revealSecrets: true });
            expect(settings['test_api_key']).toBe('sk-secret-key-12345678');
        });
    });

    describe('Schema Migrations - 数据库迁移', () => {
        test('应能获取当前schema版本', () => {
            const version = db.getSchemaVersion();
            expect(typeof version).toBe('number');
            expect(version).toBeGreaterThanOrEqual(0);
        });

        test('重复运行迁移应安全无副作用', () => {
            const versionBefore = db.getSchemaVersion();
            db.runMigrations();
            const versionAfter = db.getSchemaVersion();
            expect(versionAfter).toBe(versionBefore);
        });
    });
});
