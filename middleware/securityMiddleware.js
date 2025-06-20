/**
 * Advanced Security Middleware
 * Provides comprehensive security features including rate limiting, input validation, and security headers
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, query, param, validationResult } = require('express-validator');
const crypto = require('crypto');

class SecurityMiddleware {
  constructor() {
    this.rateLimitStore = new Map(); // In-memory store for rate limiting
    this.suspiciousIPs = new Set(); // Track suspicious IP addresses
    this.auditLog = []; // Simple audit log (use proper logging in production)
    
    // Security configuration
    this.config = {
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      maxRequestsPerDay: 10000,
      suspiciousThreshold: 100, // requests per minute to flag as suspicious
      blockDuration: 15 * 60 * 1000, // 15 minutes
      maxPayloadSize: '10mb',
      allowedOrigins: [
        'https://neurastack.ai',
        'https://www.neurastack.ai',
        'https://neurastack-frontend.web.app',
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/.*\.netlify\.app$/,
        /^https:\/\/.*\.firebase\.app$/,
        /^https:\/\/.*\.web\.app$/
      ]
    };
  }

  /**
   * Basic helmet security headers
   */
  securityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Allow inline scripts for monitoring dashboard
            "https://www.gstatic.com", // Firebase CDN
            "https://apis.google.com" // Firebase APIs
          ],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://api.openai.com",
            "https://api.anthropic.com",
            "https://generativelanguage.googleapis.com",
            "https://identitytoolkit.googleapis.com", // Firebase Auth
            "https://securetoken.googleapis.com", // Firebase Auth
            "https://firestore.googleapis.com", // Firestore
            "https://neurastack-backend.firebaseapp.com" // Firebase project
          ],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // Disable for API compatibility
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  /**
   * Advanced rate limiting with multiple tiers
   */
  createRateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // requests per window
      message = 'Too many requests from this IP',
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      keyGenerator = (req) => req.ip,
      tier = 'default'
    } = options;

    return rateLimit({
      windowMs,
      max,
      message: {
        error: 'Rate limit exceeded',
        message,
        retryAfter: Math.ceil(windowMs / 1000),
        tier
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests,
      skipFailedRequests,
      keyGenerator,
      handler: (req, res) => {
        this.logSuspiciousActivity(req, 'rate_limit_exceeded');
        res.status(429).json({
          error: 'Rate limit exceeded',
          message,
          retryAfter: Math.ceil(windowMs / 1000),
          tier
        });
      }
    });
  }

  /**
   * Tier-based rate limiting
   */
  tierBasedRateLimit() {
    return (req, res, next) => {
      const userTier = req.userTier || req.user?.tier || 'free';
      const userId = req.userId || req.user?.userId || req.ip;

      const limits = {
        free: { windowMs: 60 * 1000, max: 10 }, // 10 requests per minute
        premium: { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
        enterprise: { windowMs: 60 * 1000, max: 1000 } // 1000 requests per minute
      };

      const limit = limits[userTier] || limits.free;
      
      const rateLimiter = this.createRateLimit({
        ...limit,
        keyGenerator: () => `${userTier}:${userId}`,
        tier: userTier
      });

      rateLimiter(req, res, next);
    };
  }

  /**
   * Input validation and sanitization
   */
  validateInput(validationRules) {
    return [
      ...validationRules,
      (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          this.logSuspiciousActivity(req, 'validation_failed', { errors: errors.array() });
          return res.status(400).json({
            error: 'Validation failed',
            message: 'Invalid input data',
            details: errors.array()
          });
        }
        next();
      }
    ];
  }

  /**
   * Common validation rules
   */
  getValidationRules() {
    return {
      prompt: body('prompt')
        .isString()
        .isLength({ min: 1, max: 10000 })
        .trim()
        .escape()
        .withMessage('Prompt must be a string between 1 and 10000 characters'),
      
      userId: body('userId')
        .optional()
        .isString()
        .isLength({ min: 1, max: 100 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('User ID must be alphanumeric with hyphens and underscores only'),
      
      sessionId: body('sessionId')
        .optional()
        .isString()
        .isLength({ min: 1, max: 100 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Session ID must be alphanumeric with hyphens and underscores only'),
      
      tier: query('tier')
        .optional()
        .isIn(['free', 'premium', 'enterprise'])
        .withMessage('Tier must be one of: free, premium, enterprise'),
      
      apiKey: query('api_key')
        .optional()
        .isString()
        .matches(/^nsk_[a-zA-Z0-9_]+$/)
        .withMessage('Invalid API key format')
    };
  }

  /**
   * Request size limiting
   */
  requestSizeLimit() {
    return (req, res, next) => {
      const contentLength = parseInt(req.headers['content-length'] || '0');
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (contentLength > maxSize) {
        this.logSuspiciousActivity(req, 'payload_too_large', { size: contentLength });
        return res.status(413).json({
          error: 'Payload too large',
          message: `Request size ${contentLength} bytes exceeds maximum of ${maxSize} bytes`
        });
      }

      next();
    };
  }

  /**
   * CSRF protection
   */
  csrfProtection() {
    return (req, res, next) => {
      // Skip CSRF for GET requests and API key authentication
      if (req.method === 'GET' || req.authMethod === 'api_key') {
        return next();
      }

      const token = req.headers['x-csrf-token'] || req.body._csrf;
      const sessionToken = req.session?.csrfToken;

      if (!token || !sessionToken || token !== sessionToken) {
        this.logSuspiciousActivity(req, 'csrf_token_mismatch');
        return res.status(403).json({
          error: 'CSRF token mismatch',
          message: 'Invalid or missing CSRF token'
        });
      }

      next();
    };
  }

  /**
   * IP-based security checks
   */
  ipSecurityCheck() {
    return (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      
      // Check if IP is in suspicious list
      if (this.suspiciousIPs.has(clientIP)) {
        this.logSuspiciousActivity(req, 'suspicious_ip_blocked');
        return res.status(403).json({
          error: 'Access denied',
          message: 'Your IP address has been temporarily blocked due to suspicious activity'
        });
      }

      // Add IP tracking
      req.clientIP = clientIP;
      next();
    };
  }

  /**
   * Request fingerprinting for anomaly detection
   */
  requestFingerprinting() {
    return (req, res, next) => {
      const fingerprint = this.generateRequestFingerprint(req);
      req.fingerprint = fingerprint;
      
      // Simple anomaly detection (implement more sophisticated logic as needed)
      this.detectAnomalies(req, fingerprint);
      
      next();
    };
  }

  /**
   * Generate request fingerprint
   */
  generateRequestFingerprint(req) {
    const components = [
      req.ip,
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || '',
      req.method,
      req.url
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Simple anomaly detection
   */
  detectAnomalies(req, fingerprint) {
    const now = Date.now();
    const window = 60 * 1000; // 1 minute window
    
    if (!this.requestPatterns) {
      this.requestPatterns = new Map();
    }

    const pattern = this.requestPatterns.get(fingerprint) || { count: 0, firstSeen: now, lastSeen: now };
    pattern.count++;
    pattern.lastSeen = now;

    // Flag as suspicious if too many requests from same fingerprint
    if (pattern.count > 50 && (now - pattern.firstSeen) < window) {
      this.suspiciousIPs.add(req.ip);
      this.logSuspiciousActivity(req, 'anomaly_detected', { 
        fingerprint, 
        count: pattern.count,
        timeWindow: now - pattern.firstSeen 
      });
    }

    this.requestPatterns.set(fingerprint, pattern);
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(req, type, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      url: req.url,
      method: req.method,
      userId: req.userId || 'anonymous',
      details
    };

    this.auditLog.push(logEntry);
    console.warn('🚨 Suspicious activity detected:', logEntry);

    // Keep audit log size manageable
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-500);
    }
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    const recentLogs = this.auditLog.filter(log => 
      new Date(log.timestamp).getTime() > (now - oneHour)
    );

    return {
      suspiciousIPs: Array.from(this.suspiciousIPs),
      recentIncidents: recentLogs.length,
      incidentTypes: recentLogs.reduce((acc, log) => {
        acc[log.type] = (acc[log.type] || 0) + 1;
        return acc;
      }, {}),
      totalAuditEntries: this.auditLog.length
    };
  }

  /**
   * Clean up old data
   */
  cleanup() {
    const now = Date.now();
    const cleanupAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old audit logs
    this.auditLog = this.auditLog.filter(log => 
      new Date(log.timestamp).getTime() > (now - cleanupAge)
    );

    // Clean up old request patterns
    if (this.requestPatterns) {
      for (const [fingerprint, pattern] of this.requestPatterns.entries()) {
        if (now - pattern.lastSeen > cleanupAge) {
          this.requestPatterns.delete(fingerprint);
        }
      }
    }

    console.log('🧹 Security middleware cleanup completed');
  }
}

module.exports = new SecurityMiddleware();
