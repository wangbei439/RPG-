'use strict';

const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Request ID middleware.
 *
 * Assigns a unique ID to every incoming request for distributed tracing and
 * log correlation. The ID is attached to `req.id` and included in the
 * `X-Request-Id` response header.
 *
 * If the incoming request already carries an `X-Request-Id` header (e.g.
 * from an upstream proxy or API gateway), that value is reused so that the
 * same trace ID flows through the entire request chain.
 *
 * Usage:
 *   app.use(requestId());
 *
 * Then in any route handler:
 *   logger.info('Processing', { requestId: req.id });
 */
function requestId(options = {}) {
    const headerName = options.headerName || 'X-Request-Id';
    const prefix = options.prefix || 'req';

    return (req, res, next) => {
        // Reuse existing request ID from upstream if present
        const existingId = req.headers[headerName.toLowerCase()];
        if (existingId && typeof existingId === 'string' && existingId.length <= 100) {
            req.id = existingId;
        } else {
            req.id = `${prefix}_${uuidv4().replace(/-/g, '').substring(0, 20)}`;
        }

        // Expose on the response so clients can correlate
        res.setHeader(headerName, req.id);

        // Attach a child logger that automatically includes requestId
        req.log = {
            info: (msg, meta = {}) => logger.info(msg, { ...meta, requestId: req.id }),
            warn: (msg, meta = {}) => logger.warn(msg, { ...meta, requestId: req.id }),
            error: (msg, meta = {}) => logger.error(msg, { ...meta, requestId: req.id }),
            debug: (msg, meta = {}) => logger.debug(msg, { ...meta, requestId: req.id })
        };

        next();
    };
}

module.exports = requestId;
