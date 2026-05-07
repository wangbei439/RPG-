// Simple in-memory rate limiter (no external dependency needed)
// For production, consider using redis-based rate limiting

class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60 * 1000; // 1 minute
        this.maxRequests = options.maxRequests || 60; // 60 requests per minute
        this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
        this.clients = new Map();
        
        // Cleanup expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
    
    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.clients.entries()) {
            if (now - record.resetTime > this.windowMs * 2) {
                this.clients.delete(key);
            }
        }
    }
    
    middleware() {
        return (req, res, next) => {
            // Skip rate limiting if disabled
            if (process.env.RATE_LIMIT_DISABLED === 'true') {
                return next();
            }
            
            const key = req.ip || req.connection.remoteAddress;
            const now = Date.now();
            
            if (!this.clients.has(key)) {
                this.clients.set(key, {
                    count: 0,
                    resetTime: now
                });
            }
            
            const record = this.clients.get(key);
            
            // Reset window if expired
            if (now - record.resetTime > this.windowMs) {
                record.count = 0;
                record.resetTime = now;
            }
            
            record.count++;
            
            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', this.maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - record.count));
            res.setHeader('X-RateLimit-Reset', new Date(record.resetTime + this.windowMs).toISOString());
            
            if (record.count > this.maxRequests) {
                return res.status(429).json({ 
                    error: '请求过于频繁，请稍后再试',
                    retryAfter: Math.ceil((record.resetTime + this.windowMs - now) / 1000)
                });
            }
            
            next();
        };
    }
}

// Default rate limiter: 60 requests per minute
const defaultLimiter = new RateLimiter({ windowMs: 60 * 1000, maxRequests: 60 });

// Strict rate limiter for LLM endpoints: 20 requests per minute
const llmLimiter = new RateLimiter({ windowMs: 60 * 1000, maxRequests: 20 });

// Auth rate limiter: 5 attempts per minute
const authLimiter = new RateLimiter({ windowMs: 60 * 1000, maxRequests: 5 });

module.exports = { RateLimiter, defaultLimiter, llmLimiter, authLimiter };
