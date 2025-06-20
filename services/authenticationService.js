/**
 * Enhanced Authentication Service
 * Provides JWT authentication, API key validation, and user management
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const admin = require('firebase-admin');

class AuthenticationService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'neurastack-default-secret-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.apiKeys = new Map(); // In-memory API key store (use database in production)
    this.userSessions = new Map(); // Track active user sessions
    
    // Initialize with some default API keys for testing
    this.initializeDefaultApiKeys();
  }

  /**
   * Initialize default API keys for testing
   */
  initializeDefaultApiKeys() {
    const defaultKeys = [
      { key: 'nsk_test_key_12345', userId: 'test-user', tier: 'premium', name: 'Test Key' },
      { key: 'nsk_free_key_67890', userId: 'free-user', tier: 'free', name: 'Free Test Key' }
    ];

    for (const keyData of defaultKeys) {
      this.apiKeys.set(keyData.key, {
        ...keyData,
        createdAt: new Date(),
        lastUsed: null,
        usageCount: 0,
        isActive: true
      });
    }

    console.log('🔑 Initialized default API keys for testing');
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user) {
    const payload = {
      userId: user.userId || user.uid,
      email: user.email,
      tier: user.tier || 'free',
      permissions: user.permissions || ['read'],
      iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, this.jwtSecret, { 
      expiresIn: this.jwtExpiresIn,
      issuer: 'neurastack-backend',
      audience: 'neurastack-api'
    });
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'neurastack-backend',
        audience: 'neurastack-api'
      });
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  /**
   * Validate API key
   */
  validateApiKey(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    
    if (!keyData || !keyData.isActive) {
      return null;
    }

    // Update usage statistics
    keyData.lastUsed = new Date();
    keyData.usageCount++;

    return {
      userId: keyData.userId,
      tier: keyData.tier,
      permissions: keyData.permissions || ['read'],
      keyName: keyData.name
    };
  }

  /**
   * Create new API key
   */
  createApiKey(userId, tier = 'free', name = 'Unnamed Key', permissions = ['read']) {
    const apiKey = `nsk_${tier}_${this.generateRandomString(16)}`;
    
    const keyData = {
      key: apiKey,
      userId,
      tier,
      name,
      permissions,
      createdAt: new Date(),
      lastUsed: null,
      usageCount: 0,
      isActive: true
    };

    this.apiKeys.set(apiKey, keyData);
    
    return {
      apiKey,
      ...keyData
    };
  }

  /**
   * Revoke API key
   */
  revokeApiKey(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (keyData) {
      keyData.isActive = false;
      return true;
    }
    return false;
  }

  /**
   * Get user's API keys
   */
  getUserApiKeys(userId) {
    const userKeys = [];
    for (const [key, data] of this.apiKeys.entries()) {
      if (data.userId === userId) {
        userKeys.push({
          key: key.substring(0, 12) + '...',  // Mask the key
          name: data.name,
          tier: data.tier,
          createdAt: data.createdAt,
          lastUsed: data.lastUsed,
          usageCount: data.usageCount,
          isActive: data.isActive
        });
      }
    }
    return userKeys;
  }

  /**
   * Authenticate with Firebase token
   */
  async authenticateFirebaseToken(idToken) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      return {
        userId: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        tier: decodedToken.tier || 'free',
        permissions: decodedToken.permissions || ['read']
      };
    } catch (error) {
      throw new Error(`Firebase authentication failed: ${error.message}`);
    }
  }

  /**
   * Generate random string for API keys
   */
  generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Middleware for JWT authentication
   */
  requireAuth() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please provide a valid Bearer token'
        });
      }

      const token = authHeader.substring(7);
      
      try {
        const decoded = this.verifyToken(token);
        req.user = decoded;
        req.userId = decoded.userId;
        next();
      } catch (error) {
        return res.status(401).json({
          error: 'Invalid token',
          message: error.message
        });
      }
    };
  }

  /**
   * Middleware for API key authentication
   */
  requireApiKey() {
    return (req, res, next) => {
      const apiKey = req.headers['x-api-key'] || req.query.api_key;
      
      if (!apiKey) {
        return res.status(401).json({
          error: 'API key required',
          message: 'Please provide a valid API key in X-API-Key header or api_key query parameter'
        });
      }

      const keyData = this.validateApiKey(apiKey);
      
      if (!keyData) {
        return res.status(401).json({
          error: 'Invalid API key',
          message: 'The provided API key is invalid or has been revoked'
        });
      }

      req.user = keyData;
      req.userId = keyData.userId;
      req.userTier = keyData.tier;
      next();
    };
  }

  /**
   * Flexible authentication middleware (JWT or API key)
   */
  requireAuthFlexible() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'] || req.query.api_key;

      // Try JWT first
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = this.verifyToken(token);
          req.user = decoded;
          req.userId = decoded.userId;
          req.userTier = decoded.tier;
          req.authMethod = 'jwt';
          return next();
        } catch (error) {
          // JWT failed, try API key if available
        }
      }

      // Try API key
      if (apiKey) {
        const keyData = this.validateApiKey(apiKey);
        if (keyData) {
          req.user = keyData;
          req.userId = keyData.userId;
          req.userTier = keyData.tier;
          req.authMethod = 'api_key';
          return next();
        }
      }

      // Both methods failed
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token or API key'
      });
    };
  }

  /**
   * Optional authentication middleware
   */
  optionalAuth() {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'] || req.query.api_key;
      const userId = req.headers['x-user-id'];

      // Try JWT first
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const decoded = this.verifyToken(token);
          req.user = decoded;
          req.userId = decoded.userId;
          req.userTier = decoded.tier;
          req.authMethod = 'jwt';
          return next();
        } catch (error) {
          // JWT failed, continue with other methods
        }
      }

      // Try API key
      if (apiKey) {
        const keyData = this.validateApiKey(apiKey);
        if (keyData) {
          req.user = keyData;
          req.userId = keyData.userId;
          req.userTier = keyData.tier;
          req.authMethod = 'api_key';
          return next();
        }
      }

      // Fallback to anonymous with user ID header
      req.userId = userId || 'anonymous';
      req.userTier = 'free';
      req.authMethod = 'anonymous';
      next();
    };
  }
}

module.exports = new AuthenticationService();
