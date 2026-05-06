const jwt = require('jsonwebtoken');

// JWT secret - in production, always use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'rpg-generator-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Authentication middleware
function authMiddleware(req, res, next) {
    // Skip auth for health check
    if (req.path === '/api/health') {
        return next();
    }
    
    // In development mode, auth is optional
    if (process.env.AUTH_DISABLED === 'true') {
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
