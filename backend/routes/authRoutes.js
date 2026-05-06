const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { generateToken, verifyToken } = require('../middleware/auth');

module.exports = function() {
    const router = express.Router();

    // Simple login - generates a token
    // In production, this should validate against a user database
    router.post('/api/auth/login', (req, res) => {
        const { password } = req.body || {};
        
        // Simple password check using env variable
        const adminPassword = process.env.ADMIN_PASSWORD;
        
        if (!adminPassword) {
            // If no password configured, auth is not enforced
            return res.status(200).json({ 
                message: '认证未配置，请设置 ADMIN_PASSWORD 环境变量',
                authDisabled: true
            });
        }
        
        if (password !== adminPassword) {
            return res.status(401).json({ error: '密码错误' });
        }
        
        const token = generateToken({ 
            userId: 'admin', 
            role: 'admin' 
        });
        
        res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    });

    // Verify token validity
    router.get('/api/auth/verify', (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ valid: false, error: '未提供令牌' });
        }
        
        try {
            const decoded = verifyToken(authHeader.split(' ')[1]);
            res.json({ valid: true, user: decoded });
        } catch (error) {
            res.status(401).json({ valid: false, error: '令牌无效或已过期' });
        }
    });

    return router;
};
