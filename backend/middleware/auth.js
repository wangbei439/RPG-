const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT secret - MUST be set via environment variable in production
// Auto-generate a random secret if not provided (instead of hardcoded fallback)
function resolveJwtSecret() {
    const envSecret = process.env.JWT_SECRET;
    if (envSecret && envSecret.length >= 32) {
        return envSecret;
    }

    if (process.env.NODE_ENV === 'production') {
        console.error(
            '[SECURITY] FATAL: JWT_SECRET must be set to a value of at least 32 characters in production. ' +
            'Refusing to start with an insecure secret.'
        );
        process.exit(1);
    }

    // Development only: generate a random secret per process launch
    const devSecret = crypto.randomBytes(48).toString('hex');
    console.warn(
        '[SECURITY] WARNING: JWT_SECRET not set or too short. Using auto-generated secret for development. ' +
        'This will invalidate tokens on server restart. Set JWT_SECRET in production.'
    );
    return devSecret;
}

const JWT_SECRET = resolveJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Authentication middleware.
 *
 * Auth is active by default. Set AUTH_DISABLED=true ONLY in development.
 * In production (NODE_ENV=production), AUTH_DISABLED is ignored.
 */
function authMiddleware(req, res, next) {
    // Skip auth for health check endpoint
    if (req.path === '/api/health') {
        return next();
    }

    // In development mode, auth can be optionally disabled
    if (process.env.AUTH_DISABLED === 'true' && process.env.NODE_ENV !== 'production') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未提供认证令牌' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '认证令牌已过期' });
        }
        return res.status(401).json({ error: '无效的认证令牌' });
    }
}

// Generate a JWT token
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Verify a JWT token
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = { authMiddleware, generateToken, verifyToken, JWT_SECRET };
