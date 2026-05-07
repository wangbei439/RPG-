/**
 * Structured logger with severity levels.
 * Replaces raw console.* calls with categorized, filterable logging.
 *
 * Usage:
 *   const logger = require('../middleware/logger');
 *   logger.info('Server started', { port: 3000 });
 *   logger.warn('Slow query', { duration: 5000 });
 *   logger.error('Database error', { error: err.message });
 *   logger.debug('Cache hit', { key });  // Only shown when LOG_LEVEL=debug
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.info;

function formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

function debug(message, meta) {
    if (currentLevel <= LOG_LEVELS.debug) {
        console.log(formatMessage('debug', message, meta));
    }
}

function info(message, meta) {
    if (currentLevel <= LOG_LEVELS.info) {
        console.log(formatMessage('info', message, meta));
    }
}

function warn(message, meta) {
    if (currentLevel <= LOG_LEVELS.warn) {
        console.warn(formatMessage('warn', message, meta));
    }
}

function error(message, meta) {
    if (currentLevel <= LOG_LEVELS.error) {
        console.error(formatMessage('error', message, meta));
    }
}

module.exports = { debug, info, warn, error };
