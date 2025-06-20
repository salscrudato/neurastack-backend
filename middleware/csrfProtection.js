/**
 * CSRF Protection Middleware
 * Provides Cross-Site Request Forgery protection with token-based validation
 */

const crypto = require('crypto');
const auditLoggingService = require('../services/auditLoggingService');

class CSRFProtection {
  constructor() {
    this.tokenStore = new Map(); // In-memory token store (use Redis in production)
    this.tokenExpiry = 60 * 60 * 1000; // 1 hour
    this.cleanupInterval = 15 * 60 * 1000; // 15 minutes
    
    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Generate CSRF token
   */
  generateToken(sessionId = null) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + this.tokenExpiry;
    
    this.tokenStore.set(token, {
      sessionId,
      expiry,
      used: false,
      createdAt: new Date()
    });

    return token;
  }

  /**
   * Validate CSRF token
   */
  validateToken(token, sessionId = null) {
    const tokenData = this.tokenStore.get(token);
    
    if (!tokenData) {
      return { valid: false, reason: 'token_not_found' };
    }

    if (tokenData.used) {
      return { valid: false, reason: 'token_already_used' };
    }

    if (Date.now() > tokenData.expiry) {
      this.tokenStore.delete(token);
      return { valid: false, reason: 'token_expired' };
    }

    if (sessionId && tokenData.sessionId && tokenData.sessionId !== sessionId) {
      return { valid: false, reason: 'session_mismatch' };
    }

    // Mark token as used (one-time use)
    tokenData.used = true;

    return { valid: true, reason: 'valid' };
  }

  /**
   * CSRF protection middleware
   */
  protect(options = {}) {
    const {
      skipMethods = ['GET', 'HEAD', 'OPTIONS'],
      skipPaths = [],
      skipApiKeys = true,
      headerName = 'x-csrf-token',
      bodyField = '_csrf'
    } = options;

    return (req, res, next) => {
      // Skip for certain methods
      if (skipMethods.includes(req.method)) {
        return next();
      }

      // Skip for certain paths
      if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Skip for API key authentication if configured
      if (skipApiKeys && req.authMethod === 'api_key') {
        return next();
      }

      // Get token from header or body
      const token = req.headers[headerName] || req.body[bodyField];
      
      if (!token) {
        this.logCSRFViolation(req, 'missing_token');
        return res.status(403).json({
          error: 'CSRF token required',
          message: `Please provide a CSRF token in ${headerName} header or ${bodyField} field`
        });
      }

      // Validate token
      const validation = this.validateToken(token, req.sessionId);
      
      if (!validation.valid) {
        this.logCSRFViolation(req, validation.reason, { token: this.maskToken(token) });
        return res.status(403).json({
          error: 'Invalid CSRF token',
          message: `CSRF token validation failed: ${validation.reason}`,
          code: validation.reason
        });
      }

      next();
    };
  }

  /**
   * Middleware to provide CSRF token
   */
  provideToken() {
    return (req, res, next) => {
      const sessionId = req.sessionId || req.headers['x-session-id'];
      const token = this.generateToken(sessionId);
      
      // Add token to response headers
      res.setHeader('X-CSRF-Token', token);
      
      // Add token to locals for template rendering
      res.locals.csrfToken = token;
      
      next();
    };
  }

  /**
   * Get CSRF token endpoint
   */
  getTokenEndpoint() {
    return (req, res) => {
      const sessionId = req.sessionId || req.headers['x-session-id'];
      const token = this.generateToken(sessionId);
      
      res.status(200).json({
        csrfToken: token,
        expiresIn: this.tokenExpiry / 1000, // seconds
        timestamp: new Date().toISOString()
      });
    };
  }

  /**
   * Double submit cookie pattern
   */
  doubleSubmitCookie(options = {}) {
    const {
      cookieName = 'csrf-token',
      cookieOptions = {
        httpOnly: false, // Must be false for client-side access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: this.tokenExpiry
      }
    } = options;

    return (req, res, next) => {
      // Generate token if not present in cookie
      let cookieToken = req.cookies?.[cookieName];
      
      if (!cookieToken) {
        cookieToken = this.generateToken();
        res.cookie(cookieName, cookieToken, cookieOptions);
      }

      // For state-changing requests, validate token
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const headerToken = req.headers['x-csrf-token'] || req.body._csrf;
        
        if (!headerToken) {
          this.logCSRFViolation(req, 'missing_header_token');
          return res.status(403).json({
            error: 'CSRF token required',
            message: 'CSRF token must be provided in header or body'
          });
        }

        if (cookieToken !== headerToken) {
          this.logCSRFViolation(req, 'token_mismatch', {
            cookieToken: this.maskToken(cookieToken),
            headerToken: this.maskToken(headerToken)
          });
          return res.status(403).json({
            error: 'CSRF token mismatch',
            message: 'Cookie and header tokens do not match'
          });
        }
      }

      req.csrfToken = cookieToken;
      next();
    };
  }

  /**
   * Origin validation
   */
  validateOrigin(allowedOrigins = []) {
    return (req, res, next) => {
      const origin = req.headers.origin || req.headers.referer;
      
      if (!origin) {
        // Allow requests without origin (e.g., mobile apps, Postman)
        return next();
      }

      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });

      if (!isAllowed) {
        this.logCSRFViolation(req, 'invalid_origin', { origin });
        return res.status(403).json({
          error: 'Invalid origin',
          message: 'Request origin is not allowed'
        });
      }

      next();
    };
  }

  /**
   * Referrer validation
   */
  validateReferrer(allowedReferrers = []) {
    return (req, res, next) => {
      const referrer = req.headers.referer;
      
      if (!referrer) {
        // Allow requests without referrer
        return next();
      }

      const isAllowed = allowedReferrers.some(allowed => {
        if (typeof allowed === 'string') {
          return referrer.startsWith(allowed);
        }
        if (allowed instanceof RegExp) {
          return allowed.test(referrer);
        }
        return false;
      });

      if (!isAllowed) {
        this.logCSRFViolation(req, 'invalid_referrer', { referrer });
        return res.status(403).json({
          error: 'Invalid referrer',
          message: 'Request referrer is not allowed'
        });
      }

      next();
    };
  }

  /**
   * Log CSRF violations
   */
  logCSRFViolation(req, reason, details = {}) {
    auditLoggingService.logSecurityViolation(
      'csrf_violation',
      req.userId || 'anonymous',
      {
        reason,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        referrer: req.headers.referer,
        ...details
      }
    );
  }

  /**
   * Mask token for logging
   */
  maskToken(token) {
    if (!token || token.length < 8) return '[MASKED]';
    return token.substring(0, 4) + '*'.repeat(token.length - 8) + token.substring(token.length - 4);
  }

  /**
   * Start cleanup interval
   */
  startCleanup() {
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, this.cleanupInterval);
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [token, data] of this.tokenStore.entries()) {
      if (now > data.expiry || data.used) {
        this.tokenStore.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired CSRF tokens`);
    }
  }

  /**
   * Get CSRF statistics
   */
  getStatistics() {
    const now = Date.now();
    let activeTokens = 0;
    let expiredTokens = 0;
    let usedTokens = 0;

    for (const [token, data] of this.tokenStore.entries()) {
      if (data.used) {
        usedTokens++;
      } else if (now > data.expiry) {
        expiredTokens++;
      } else {
        activeTokens++;
      }
    }

    return {
      totalTokens: this.tokenStore.size,
      activeTokens,
      expiredTokens,
      usedTokens,
      tokenExpiry: this.tokenExpiry,
      cleanupInterval: this.cleanupInterval
    };
  }

  /**
   * Clear all tokens (for testing)
   */
  clearAllTokens() {
    this.tokenStore.clear();
  }
}

module.exports = new CSRFProtection();
