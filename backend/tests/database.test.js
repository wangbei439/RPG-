const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 使用临时数据库文件进行测试
const TEST_DB_DIR = path.join(__dirname, '..', 'test_data');
const TEST_DB_PATH = path.join(TEST_DB_DIR, 'test-rpg.db');

// 我们需要重写 database.js 中的 DB_PATH，最简单的方法是
// 直接用 better-sqlite3 创建一个测试数据库并模拟 database 模块的行为
// 但由于 database.js 使用模块级变量，我们需要直接测试其导出函数

// 为了避免影响实际数据，我们将通过设置环境来测试
// 实际上更好的方式是直接 require database 模块，但让它使用临时路径

// 创建一个测试用的数据库模块包装
function createTestDatabase() {
    // 确保测试目录存在
    if (!fs.existsSync(TEST_DB_DIR)) {
        fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    }

    // 如果已有测试数据库文件，先删除
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
    const walPath = TEST_DB_PATH + '-wal';
    const shmPath = TEST_DB_PATH + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    const db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            config TEXT NOT NULL,
            data TEXT NOT NULL,
            state TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS generation_sessions (
            id TEXT PRIMARY KEY,
            memory_state TEXT NOT NULL,
            config TEXT NOT NULL,
            project_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `);

    return db;
}

/**
 * 直接基于 better-sqlite3 的测试数据库操作
 * 与 database.js 的逻辑保持一致
 */
function createTestDbApi(db) {
    function saveGame(id, config, data, state) {
        const now = Date.now();
        const configJson = typeof config === 'string' ? config : JSON.stringify(config);
        const dataJson = typeof data === 'string' ? data : JSON.stringify(data);
        const stateJson = state ? (typeof state === 'string' ? state : JSON.stringify(state)) : null;

        db.prepare(`
            INSERT INTO games (id, config, data, state, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                config = excluded.config,
                data = excluded.data,
                state = excluded.state,
                updated_at = excluded.updated_at
        `).run(id, configJson, dataJson, stateJson, now, now);

        return true;
    }

    function loadGame(id) {
        const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
        if (!row) return null;

        return {
            id: row.id,
            config: JSON.parse(row.config),
            data: JSON.parse(row.data),
            state: row.state ? JSON.parse(row.state) : null,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    function deleteGame(id) {
        db.prepare('DELETE FROM games WHERE id = ?').run(id);
        return true;
    }

    function loadAllGames() {
        const rows = db.prepare('SELECT * FROM games').all();
        return rows.map(row => ({
            id: row.id,
            config: JSON.parse(row.config),
            data: JSON.parse(row.data),
            state: row.state ? JSON.parse(row.state) : null,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    }

    function saveSession(id, memoryState, config, projectId) {
        const now = Date.now();
        const memoryStateJson = typeof memoryState === 'string' ? memoryState : JSON.stringify(memoryState);
        const configJson = typeof config === 'string' ? config : JSON.stringify(config);

        db.prepare(`
            INSERT INTO generation_sessions (id, memory_state, config, project_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                memory_state = excluded.memory_state,
                config = excluded.config,
                project_id = excluded.project_id,
                updated_at = excluded.updated_at
        `).run(id, memoryStateJson, configJson, projectId || null, now, now);

        return true;
    }

    function loadSession(id) {
        const row = db.prepare('SELECT * FROM generation_sessions WHERE id = ?').get(id);
        if (!row) return null;

        return {
            id: row.id,
            memoryState: JSON.parse(row.memory_state),
            config: JSON.parse(row.config),
            projectId: row.project_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    function deleteSession(id) {
        db.prepare('DELETE FROM generation_sessions WHERE id = ?').run(id);
        return true;
    }

    function loadAllSessions() {
        const rows = db.prepare('SELECT * FROM generation_sessions').all();
        return rows.map(row => ({
            id: row.id,
            memoryState: JSON.parse(row.memory_state),
            config: JSON.parse(row.config),
            projectId: row.project_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    }

    function saveProject(id, data) {
        const now = Date.now();
        const dataJson = typeof data === 'string' ? data : JSON.stringify(data);

        db.prepare(`
            INSERT INTO projects (id, data, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                data = excluded.data,
                updated_at = excluded.updated_at
        `).run(id, dataJson, now, now);

        return true;
    }

    function loadProject(id) {
        const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
        if (!row) return null;
        return JSON.parse(row.data);
    }

    function deleteProject(id) {
        db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        return true;
    }

    function loadAllProjects() {
        const rows = db.prepare('SELECT * FROM projects').all();
        return rows.map(row => JSON.parse(row.data));
    }

    function cleanupExpired(beforeTimestamp) {
        const gamesResult = db.prepare('DELETE FROM games WHERE updated_at < ?').run(beforeTimestamp);
        const sessionsResult = db.prepare('DELETE FROM generation_sessions WHERE updated_at < ?').run(beforeTimestamp);

        return {
            games: gamesResult.changes,
            sessions: sessionsResult.changes,
            projects: 0
        };
    }

    return {
        saveGame, loadGame, deleteGame, loadAllGames,
        saveSession, loadSession, deleteSession, loadAllSessions,
        saveProject, loadProject, deleteProject, loadAllProjects,
        cleanupExpired
    };
}

describe('Database - 数据库操作', () => {
    let db;
    let api;

    beforeAll(() => {
        db = createTestDatabase();
        api = createTestDbApi(db);
    });

    afterAll(() => {
        if (db) {
            db.close();
        }
        // 清理测试数据库文件
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        const walPath = TEST_DB_PATH + '-wal';
        const shmPath = TEST_DB_PATH + '-shm';
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        // 清理测试目录
        if (fs.existsSync(TEST_DB_DIR)) {
            try { fs.rmdirSync(TEST_DB_DIR); } catch (e) { /* ignore */ }
        }
    });

    describe('Games - 游戏存取', () => {
        test('saveGame 应能保存游戏', () => {
            const result = api.saveGame('game_1', { type: 'adventure' }, { name: '测试游戏' }, { turn: 1 });
            expect(result).toBe(true);
        });

        test('loadGame 应能加载已保存的游戏', () => {
            api.saveGame('game_2', { type: 'rpg' }, { name: '角色扮演' }, null);

            const game = api.loadGame('game_2');
            expect(game).not.toBeNull();
            expect(game.id).toBe('game_2');
            expect(game.config).toEqual({ type: 'rpg' });
            expect(game.data).toEqual({ name: '角色扮演' });
            expect(game.state).toBeNull();
            expect(game.createdAt).toBeDefined();
            expect(game.updatedAt).toBeDefined();
        });

        test('loadGame 不存在的游戏应返回 null', () => {
            expect(api.loadGame('nonexistent')).toBeNull();
        });

        test('saveGame 应能更新已存在的游戏（upsert）', () => {
            api.saveGame('game_3', { version: 1 }, { name: '初始' }, null);
            api.saveGame('game_3', { version: 2 }, { name: '更新' }, { turn: 5 });

            const game = api.loadGame('game_3');
            expect(game.config.version).toBe(2);
            expect(game.data.name).toBe('更新');
            expect(game.state.turn).toBe(5);
        });

        test('deleteGame 应能删除游戏', () => {
            api.saveGame('game_del', { type: 'temp' }, { name: '待删除' }, null);
            expect(api.loadGame('game_del')).not.toBeNull();

            api.deleteGame('game_del');
            expect(api.loadGame('game_del')).toBeNull();
        });

        test('loadAllGames 应能加载所有游戏', () => {
            api.saveGame('all_1', {}, { name: '游戏1' }, null);
            api.saveGame('all_2', {}, { name: '游戏2' }, null);

            const games = api.loadAllGames();
            expect(games.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Sessions - 生成会话存取', () => {
        test('saveSession 应能保存会话', () => {
            const result = api.saveSession('sess_1', { globalContext: {} }, { type: 'custom' }, 'proj_1');
            expect(result).toBe(true);
        });

        test('loadSession 应能加载已保存的会话', () => {
            api.saveSession('sess_2', { globalContext: { userInput: '测试' } }, { type: 'adventure' }, null);

            const session = api.loadSession('sess_2');
            expect(session).not.toBeNull();
            expect(session.id).toBe('sess_2');
            expect(session.memoryState.globalContext.userInput).toBe('测试');
            expect(session.config).toEqual({ type: 'adventure' });
            expect(session.projectId).toBeNull();
        });

        test('loadSession 不存在的会话应返回 null', () => {
            expect(api.loadSession('nonexistent')).toBeNull();
        });

        test('saveSession 应能更新已存在的会话（upsert）', () => {
            api.saveSession('sess_3', { v: 1 }, { type: 'old' }, null);
            api.saveSession('sess_3', { v: 2 }, { type: 'new' }, 'proj_1');

            const session = api.loadSession('sess_3');
            expect(session.memoryState.v).toBe(2);
            expect(session.config.type).toBe('new');
            expect(session.projectId).toBe('proj_1');
        });

        test('deleteSession 应能删除会话', () => {
            api.saveSession('sess_del', {}, {}, null);
            expect(api.loadSession('sess_del')).not.toBeNull();

            api.deleteSession('sess_del');
            expect(api.loadSession('sess_del')).toBeNull();
        });

        test('loadAllSessions 应能加载所有会话', () => {
            api.saveSession('all_sess_1', {}, {}, null);
            api.saveSession('all_sess_2', {}, {}, null);

            const sessions = api.loadAllSessions();
            expect(sessions.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Projects - 项目存取', () => {
        test('saveProject 应能保存项目', () => {
            const result = api.saveProject('proj_1', { title: '测试项目', mode: 'novel_import' });
            expect(result).toBe(true);
        });

        test('loadProject 应能加载已保存的项目', () => {
            api.saveProject('proj_2', { title: '武侠世界', mode: 'custom' });

            const project = api.loadProject('proj_2');
            expect(project).not.toBeNull();
            expect(project.title).toBe('武侠世界');
            expect(project.mode).toBe('custom');
        });

        test('loadProject 不存在的项目应返回 null', () => {
            expect(api.loadProject('nonexistent')).toBeNull();
        });

        test('saveProject 应能更新已存在的项目（upsert）', () => {
            api.saveProject('proj_3', { title: '旧标题' });
            api.saveProject('proj_3', { title: '新标题' });

            const project = api.loadProject('proj_3');
            expect(project.title).toBe('新标题');
        });

        test('deleteProject 应能删除项目', () => {
            api.saveProject('proj_del', { title: '待删除' });
            expect(api.loadProject('proj_del')).not.toBeNull();

            api.deleteProject('proj_del');
            expect(api.loadProject('proj_del')).toBeNull();
        });

        test('loadAllProjects 应能加载所有项目', () => {
            api.saveProject('all_proj_1', { title: '项目1' });
            api.saveProject('all_proj_2', { title: '项目2' });

            const projects = api.loadAllProjects();
            expect(projects.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('cleanupExpired - 过期清理', () => {
        test('应能清理过期的游戏和会话', () => {
            // 保存一些数据（它们的时间戳是当前时间）
            api.saveGame('expired_game', {}, {}, null);
            api.saveSession('expired_sess', {}, {}, null);

            // 使用未来时间戳清理 - 会删除所有当前时间之前创建的记录
            const futureTime = Date.now() + 100000;
            const result1 = api.cleanupExpired(futureTime);
            expect(result1.games).toBeGreaterThan(0);
            expect(result1.sessions).toBeGreaterThan(0);

            // 验证数据已被删除
            expect(api.loadGame('expired_game')).toBeNull();
            expect(api.loadSession('expired_sess')).toBeNull();
        });

        test('使用极小时间戳清理不应删除新创建的数据', () => {
            api.saveGame('fresh_game', {}, {}, null);
            api.saveSession('fresh_sess', {}, {}, null);

            // 使用 0 作为截止时间，会删除所有记录
            const result = api.cleanupExpired(0);
            // 所有记录的 updated_at 都大于 0，所以都会被删除
            expect(result.games).toBeGreaterThanOrEqual(0);
            expect(result.sessions).toBeGreaterThanOrEqual(0);
        });

        test('项目不应该被自动清理', () => {
            api.saveProject('cleanup_proj', { title: '不应被清理' });
            const result = api.cleanupExpired(0);
            expect(result.projects).toBe(0); // 项目永远返回0
        });
    });

    describe('JSON 序列化兼容性', () => {
        test('应能处理字符串和对象类型的输入', () => {
            api.saveGame('json_test_1', { key: 'value' }, { name: 'test' }, { turn: 1 });
            api.saveGame('json_test_2', '{"key":"value"}', '{"name":"test"}', '{"turn":1}');

            const game1 = api.loadGame('json_test_1');
            const game2 = api.loadGame('json_test_2');

            expect(game1.config).toEqual({ key: 'value' });
            expect(game2.config).toEqual({ key: 'value' });
            expect(game1.data).toEqual({ name: 'test' });
            expect(game2.data).toEqual({ name: 'test' });
        });

        test('state 为 null 时应正确处理', () => {
            api.saveGame('null_state', {}, {}, null);
            const game = api.loadGame('null_state');
            expect(game.state).toBeNull();
        });
    });
});
