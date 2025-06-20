/**
 * Authentication Routes
 * Provides endpoints for user authentication, API key management, and security features
 */

const express = require('express');
const authenticationService = require('../services/authenticationService');
const securityMiddleware = require('../middleware/securityMiddleware');
const advancedRateLimitingService = require('../services/advancedRateLimitingService');

const router = express.Router();

/**
 * Login with Firebase token
 */
router.post('/login', 
  securityMiddleware.createRateLimit({ max: 10, windowMs: 15 * 60 * 1000 }), // 10 attempts per 15 minutes
  securityMiddleware.validateInput([
    securityMiddleware.getValidationRules().prompt.isLength({ min: 10, max: 2000 }).withMessage('Firebase token required')
  ]),
  async (req, res) => {
    try {
      const { firebaseToken } = req.body;

      if (!firebaseToken) {
        return res.status(400).json({
          error: 'Firebase token required',
          message: 'Please provide a valid Firebase ID token'
        });
      }

      // Authenticate with Firebase
      const user = await authenticationService.authenticateFirebaseToken(firebaseToken);
      
      // Generate JWT token
      const jwtToken = authenticationService.generateToken(user);

      res.status(200).json({
        status: 'success',
        message: 'Authentication successful',
        token: jwtToken,
        user: {
          userId: user.userId,
          email: user.email,
          emailVerified: user.emailVerified,
          tier: user.tier
        },
        expiresIn: '24h'
      });

    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({
        error: 'Authentication failed',
        message: error.message
      });
    }
  }
);

/**
 * Create API key
 */
router.post('/api-keys',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 5, windowMs: 60 * 60 * 1000 }), // 5 keys per hour
  securityMiddleware.validateInput([
    securityMiddleware.getValidationRules().prompt.isLength({ min: 1, max: 100 }).withMessage('Key name must be 1-100 characters')
  ]),
  async (req, res) => {
    try {
      const { name, permissions } = req.body;
      const userId = req.userId;
      const userTier = req.user.tier || 'free';

      // Validate permissions
      const validPermissions = ['read', 'write', 'admin'];
      const requestedPermissions = permissions || ['read'];
      
      if (!Array.isArray(requestedPermissions) || 
          !requestedPermissions.every(p => validPermissions.includes(p))) {
        return res.status(400).json({
          error: 'Invalid permissions',
          message: 'Permissions must be an array containing: read, write, admin'
        });
      }

      // Create API key
      const apiKeyData = authenticationService.createApiKey(
        userId, 
        userTier, 
        name || 'Unnamed Key',
        requestedPermissions
      );

      res.status(201).json({
        status: 'success',
        message: 'API key created successfully',
        apiKey: apiKeyData.apiKey,
        keyInfo: {
          name: apiKeyData.name,
          tier: apiKeyData.tier,
          permissions: apiKeyData.permissions,
          createdAt: apiKeyData.createdAt
        }
      });

    } catch (error) {
      console.error('API key creation error:', error);
      res.status(500).json({
        error: 'Failed to create API key',
        message: error.message
      });
    }
  }
);

/**
 * List user's API keys
 */
router.get('/api-keys',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      const userId = req.userId;
      const apiKeys = authenticationService.getUserApiKeys(userId);

      res.status(200).json({
        status: 'success',
        apiKeys,
        count: apiKeys.length
      });

    } catch (error) {
      console.error('API key listing error:', error);
      res.status(500).json({
        error: 'Failed to list API keys',
        message: error.message
      });
    }
  }
);

/**
 * Revoke API key
 */
router.delete('/api-keys/:keyId',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 10, windowMs: 60 * 60 * 1000 }), // 10 revocations per hour
  async (req, res) => {
    try {
      const { keyId } = req.params;
      const userId = req.userId;

      // Validate that the key belongs to the user
      const userKeys = authenticationService.getUserApiKeys(userId);
      const keyExists = userKeys.some(key => key.key.startsWith(keyId.substring(0, 12)));

      if (!keyExists) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The specified API key does not exist or does not belong to you'
        });
      }

      const revoked = authenticationService.revokeApiKey(keyId);

      if (revoked) {
        res.status(200).json({
          status: 'success',
          message: 'API key revoked successfully'
        });
      } else {
        res.status(404).json({
          error: 'API key not found',
          message: 'The specified API key could not be found'
        });
      }

    } catch (error) {
      console.error('API key revocation error:', error);
      res.status(500).json({
        error: 'Failed to revoke API key',
        message: error.message
      });
    }
  }
);

/**
 * Get rate limit status
 */
router.get('/rate-limits',
  authenticationService.requireAuthFlexible(),
  async (req, res) => {
    try {
      const userId = req.userId;
      const userTier = req.userTier || 'free';

      const rateLimitStatus = await advancedRateLimitingService.getRateLimitStatus(userId, userTier);

      res.status(200).json({
        status: 'success',
        userId,
        tier: userTier,
        rateLimits: rateLimitStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Rate limit status error:', error);
      res.status(500).json({
        error: 'Failed to get rate limit status',
        message: error.message
      });
    }
  }
);

/**
 * Get security metrics (admin only)
 */
router.get('/security-metrics',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check if user has admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view security metrics'
        });
      }

      const securityMetrics = securityMiddleware.getSecurityMetrics();
      const rateLimitingMetrics = advancedRateLimitingService.getMetrics();

      res.status(200).json({
        status: 'success',
        security: securityMetrics,
        rateLimiting: rateLimitingMetrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Security metrics error:', error);
      res.status(500).json({
        error: 'Failed to get security metrics',
        message: error.message
      });
    }
  }
);

/**
 * Validate token endpoint
 */
router.post('/validate-token',
  securityMiddleware.createRateLimit({ max: 100, windowMs: 60 * 1000 }), // 100 validations per minute
  async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          error: 'Token required',
          message: 'Please provide a token to validate'
        });
      }

      const decoded = authenticationService.verifyToken(token);

      res.status(200).json({
        status: 'success',
        valid: true,
        user: {
          userId: decoded.userId,
          email: decoded.email,
          tier: decoded.tier,
          permissions: decoded.permissions
        },
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      });

    } catch (error) {
      res.status(200).json({
        status: 'success',
        valid: false,
        error: error.message
      });
    }
  }
);

/**
 * Health check for auth service
 */
router.get('/health',
  async (req, res) => {
    try {
      res.status(200).json({
        status: 'healthy',
        service: 'authentication',
        timestamp: new Date().toISOString(),
        features: [
          'JWT authentication',
          'API key management',
          'Firebase integration',
          'Rate limiting',
          'Security middleware'
        ]
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }
);

module.exports = router;
