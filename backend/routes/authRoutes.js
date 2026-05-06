const express = require('express');
const crypto = require('crypto');
const { generateToken, verifyToken } = require('../middleware/auth');
const { asyncRoute } = require('./helpers');

module.exports = function() {
    const router = express.Router();

    /**
     * POST /api/auth/login
     * Authenticates admin user and returns a JWT token.
     * Uses timing-safe comparison to prevent timing attacks.
     */
    router.post('/api/auth/login', asyncRoute('Login error', (req, res) => {
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

        if (!password) {
            return res.status(400).json({ error: '请提供密码' });
        }

        // Timing-safe comparison to prevent timing attacks
        const passwordBuffer = Buffer.from(String(password), 'utf8');
        const adminBuffer = Buffer.from(String(adminPassword), 'utf8');

        if (passwordBuffer.length !== adminBuffer.length) {
            // Still do a comparison to maintain constant time
            crypto.timingSafeEqual(passwordBuffer, passwordBuffer);
            return res.status(401).json({ error: '密码错误' });
        }

        const isValid = crypto.timingSafeEqual(passwordBuffer, adminBuffer);
        if (!isValid) {
            return res.status(401).json({ error: '密码错误' });
        }

        const token = generateToken({
            userId: 'admin',
            role: 'admin'
        });

        res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    }));

    /**
     * GET /api/auth/verify
     * Verifies a JWT token and returns the decoded payload.
     */
    router.get('/api/auth/verify', asyncRoute('Token verify error', (req, res) => {
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
    }));

    return router;
};
