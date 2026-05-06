const requestId = require('../middleware/requestId');

describe('Request ID Middleware - 请求追踪', () => {
    test('应给每个请求分配唯一ID', () => {
        const middleware = requestId();
        const ids = [];

        for (let i = 0; i < 10; i++) {
            const req = { headers: {} };
            const res = { setHeader: jest.fn() };
            middleware(req, res, () => {});

            expect(req.id).toBeDefined();
            expect(typeof req.id).toBe('string');
            expect(req.id).toMatch(/^req_[a-f0-9]{20}$/);
            expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
            ids.push(req.id);
        }

        // All IDs should be unique
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    test('应复用上游的请求ID', () => {
        const middleware = requestId();
        const req = { headers: { 'x-request-id': 'upstream-trace-123' } };
        const res = { setHeader: jest.fn() };

        middleware(req, res, () => {});

        expect(req.id).toBe('upstream-trace-123');
        expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'upstream-trace-123');
    });

    test('应注入req.log日志方法', () => {
        const middleware = requestId();
        const req = { headers: {} };
        const res = { setHeader: jest.fn() };

        middleware(req, res, () => {});

        expect(req.log).toBeDefined();
        expect(typeof req.log.info).toBe('function');
        expect(typeof req.log.warn).toBe('function');
        expect(typeof req.log.error).toBe('function');
        expect(typeof req.log.debug).toBe('function');
    });

    test('应支持自定义前缀', () => {
        const middleware = requestId({ prefix: 'rpg' });
        const req = { headers: {} };
        const res = { setHeader: jest.fn() };

        middleware(req, res, () => {});

        expect(req.id).toMatch(/^rpg_[a-f0-9]{20}$/);
    });

    test('应忽略过长的上游请求ID', () => {
        const middleware = requestId();
        const longId = 'x'.repeat(101);
        const req = { headers: { 'x-request-id': longId } };
        const res = { setHeader: jest.fn() };

        middleware(req, res, () => {});

        // Should generate a new ID instead of using the too-long one
        expect(req.id).not.toBe(longId);
        expect(req.id).toMatch(/^req_[a-f0-9]{20}$/);
    });
});
