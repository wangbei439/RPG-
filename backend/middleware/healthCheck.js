'use strict';

const os = require('os');

/**
 * Enhanced health check middleware.
 *
 * Provides a comprehensive health status endpoint that checks:
 * - Database connectivity
 * - System resources (memory, uptime)
 * - Active connections count
 * - Schema version
 *
 * Usage:
 *   app.get('/api/health', healthCheck({ db, games, generationSessions, projects }));
 */
function healthCheck(deps = {}) {
    const { db, games, generationSessions, projects } = deps;

    return (req, res) => {
        const startTime = Date.now();
        const status = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0'
        };

        // Database health check
        let dbStatus = 'unknown';
        let dbResponseTime = null;
        try {
            const dbStart = Date.now();
            const database = db?.getDb?.();
            if (database) {
                // Simple query to verify DB is responsive
                database.prepare('SELECT 1').get();
                dbResponseTime = Date.now() - dbStart;
                dbStatus = 'ok';
            } else {
                dbStatus = 'disconnected';
                status.status = 'degraded';
            }
        } catch (error) {
            dbStatus = 'error';
            dbResponseTime = null;
            status.status = 'unhealthy';
            status.dbError = error.message;
        }

        status.database = {
            status: dbStatus,
            responseTime: dbResponseTime !== null ? `${dbResponseTime}ms` : null,
            schemaVersion: db?.getSchemaVersion?.() ?? 0
        };

        // In-memory state counts
        status.state = {
            games: games?.size ?? 0,
            projects: projects?.size ?? 0,
            sessions: generationSessions?.size ?? 0
        };

        // System resources
        const memUsage = process.memoryUsage();
        status.system = {
            hostname: os.hostname(),
            platform: os.platform(),
            nodeVersion: process.version,
            memory: {
                rss: formatBytes(memUsage.rss),
                heapUsed: formatBytes(memUsage.heapUsed),
                heapTotal: formatBytes(memUsage.heapTotal),
                systemFree: formatBytes(os.freemem()),
                systemTotal: formatBytes(os.totalmem())
            },
            cpu: {
                cores: os.cpus().length,
                loadAvg: os.loadavg().map((v) => v.toFixed(2))
            }
        };

        // Response time for the health check itself
        status.responseTime = `${Date.now() - startTime}ms`;

        const httpStatus = status.status === 'ok' ? 200 : (status.status === 'degraded' ? 200 : 503);
        res.status(httpStatus).json(status);
    };
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

module.exports = healthCheck;
