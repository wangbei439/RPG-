const healthCheck = require('../middleware/healthCheck');

describe('Health Check Middleware - 健康检查', () => {
    test('应返回健康状态', () => {
        const mockDb = {
            getDb: () => ({
                prepare: () => ({
                    get: () => ({ 'SELECT 1': 1 })
                })
            }),
            getSchemaVersion: () => 1
        };
        const mockGames = new Map([['g1', {}], ['g2', {}]]);
        const mockSessions = new Map();
        const mockProjects = new Map([['p1', {}]]);

        const middleware = healthCheck({
            db: mockDb,
            games: mockGames,
            generationSessions: mockSessions,
            projects: mockProjects
        });

        const req = {};
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        middleware(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const result = res.json.mock.calls[0][0];

        expect(result.status).toBe('ok');
        expect(result.database.status).toBe('ok');
        expect(result.database.schemaVersion).toBe(1);
        expect(result.state.games).toBe(2);
        expect(result.state.projects).toBe(1);
        expect(result.state.sessions).toBe(0);
        expect(result.system).toBeDefined();
        expect(result.system.memory).toBeDefined();
        expect(result.system.cpu).toBeDefined();
        expect(result.responseTime).toBeDefined();
    });

    test('数据库断开时应返回降级状态', () => {
        const mockDb = {
            getDb: () => null,
            getSchemaVersion: () => 0
        };

        const middleware = healthCheck({
            db: mockDb,
            games: new Map(),
            generationSessions: new Map(),
            projects: new Map()
        });

        const req = {};
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        middleware(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const result = res.json.mock.calls[0][0];
        expect(result.status).toBe('degraded');
        expect(result.database.status).toBe('disconnected');
    });

    test('数据库错误时应返回unhealthy', () => {
        const mockDb = {
            getDb: () => ({
                prepare: () => { throw new Error('Connection refused'); }
            }),
            getSchemaVersion: () => 0
        };

        const middleware = healthCheck({
            db: mockDb,
            games: new Map(),
            generationSessions: new Map(),
            projects: new Map()
        });

        const req = {};
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        middleware(req, res);

        expect(res.status).toHaveBeenCalledWith(503);
        const result = res.json.mock.calls[0][0];
        expect(result.status).toBe('unhealthy');
        expect(result.database.status).toBe('error');
    });
});
