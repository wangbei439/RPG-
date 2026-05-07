const createHttpError = require('http-errors');
const logger = require('./logger');

/**
 * Global error handling middleware.
 * Must be registered AFTER all routes.
 *
 * - Handles http-errors thrown in route handlers
 * - Catches unexpected errors with a generic 500 response
 * - Never leaks stack traces in production
 */
function errorHandler(err, req, res, _next) {
    // Determine status code
    const status = err.status || err.statusCode || 500;

    // Log the error
    if (status >= 500) {
        logger.error('Unhandled server error', {
            method: req.method,
            path: req.path,
            status,
            message: err.message,
            stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
        });
    } else {
        logger.warn('Client error', {
            method: req.method,
            path: req.path,
            status,
            message: err.message
        });
    }

    // Send response
    res.status(status).json({
        error: err.expose || status < 500
            ? err.message
            : '服务器内部错误',
        ...(process.env.NODE_ENV !== 'production' && status >= 500 ? { detail: err.message } : {})
    });
}

module.exports = errorHandler;
