/**
 * Simple Security Middleware
 * Provides basic security features including rate limiting
 */

const rateLimit = require('express-rate-limit');

class SecurityMiddleware {
  constructor() {
    this.rateLimitStore = new Map();
  }

  /**
   * Basic rate limiting
   */
  createRateLimit(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 150, // Increased limit for 25+ concurrent users (150 requests per 15 minutes)
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((options.windowMs || 900000) / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Enhanced options for better performance under load
      skipSuccessfulRequests: false, // Count all requests for accurate limiting
      skipFailedRequests: false,     // Count failed requests too
      keyGenerator: (req) => {
        // Use X-User-Id if available, otherwise fall back to IP
        return req.headers['x-user-id'] || req.ip;
      },
      // Custom handler for rate limit exceeded
      handler: (req, res) => {
        const retryAfter = Math.ceil((options.windowMs || 900000) / 1000);
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter,
          timestamp: new Date().toISOString(),
          correlationId: req.correlationId || 'unknown'
        });
      },
      ...options
    };

    return rateLimit(defaultOptions);
  }

  /**
   * Simple rate limit check for custom logic
   */
  checkRateLimit(userId, endpoint, maxRequests = 100, windowMs = 60000) {
    const key = `${userId}:${endpoint}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create rate limit data
    let rateLimitData = this.rateLimitStore.get(key) || { requests: [], firstRequest: now };

    // Remove old requests outside the window (optimized for performance)
    rateLimitData.requests = rateLimitData.requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded (increased default for 25+ concurrent users)
    if (rateLimitData.requests.length >= maxRequests) {
      return {
        allowed: false,
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil((rateLimitData.requests[0] + windowMs - now) / 1000)
      };
    }

    // Add current request
    rateLimitData.requests.push(now);
    this.rateLimitStore.set(key, rateLimitData);

    return {
      allowed: true,
      remaining: maxRequests - rateLimitData.requests.length
    };
  }

  /**
   * Basic security headers
   */
  securityHeaders() {
    return (req, res, next) => {
      // Basic security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      next();
    };
  }

  /**
   * CORS configuration
   */
  corsOptions() {
    return {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://neurastack.ai',
        'https://www.neurastack.ai',
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.netlify\.app$/,
        /^https:\/\/.*\.firebase\.app$/,
        /^https:\/\/.*\.web\.app$/
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-User-Id',
        'X-Correlation-ID',
        'X-API-Key',
        'Cache-Control'
      ]
    };
  }

  /**
   * Clean up old rate limit data
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, data] of this.rateLimitStore.entries()) {
      if (now - data.firstRequest > maxAge) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}

module.exports = new SecurityMiddleware();
