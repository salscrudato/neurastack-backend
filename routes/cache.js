/**
 * Cache Management Routes
 * Provides endpoints for cache analytics, warming, invalidation, and optimization
 */

const express = require('express');
const authenticationService = require('../services/authenticationService');
const cacheService = require('../services/cacheService');
const securityMiddleware = require('../middleware/securityMiddleware');

const router = express.Router();

/**
 * Get cache statistics and analytics
 */
router.get('/analytics',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view cache analytics'
        });
      }

      const analytics = cacheService.getCacheAnalytics();
      const stats = cacheService.getStats();

      res.status(200).json({
        status: 'success',
        analytics,
        stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Cache analytics error:', error);
      res.status(500).json({
        error: 'Failed to retrieve cache analytics',
        message: error.message
      });
    }
  }
);

/**
 * Get cache health status
 */
router.get('/health',
  authenticationService.optionalAuth(),
  async (req, res) => {
    try {
      const health = cacheService.getHealthStatus();
      const stats = cacheService.getStats();

      res.status(health.status === 'healthy' ? 200 : 503).json({
        status: 'success',
        health: {
          ...health,
          hitRate: stats.hitRate,
          redisAvailable: stats.redisAvailable
        }
      });

    } catch (error) {
      console.error('Cache health error:', error);
      res.status(500).json({
        status: 'error',
        error: 'Failed to retrieve cache health',
        message: error.message
      });
    }
  }
);

/**
 * Warm cache with common queries
 */
router.post('/warm',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 3, windowMs: 60 * 60 * 1000 }), // 3 times per hour
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to warm cache'
        });
      }

      const warmedCount = await cacheService.warmCache();

      res.status(200).json({
        status: 'success',
        message: 'Cache warming completed',
        warmedEntries: warmedCount,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Cache warming error:', error);
      res.status(500).json({
        error: 'Failed to warm cache',
        message: error.message
      });
    }
  }
);

/**
 * Invalidate cache by pattern
 */
router.post('/invalidate',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 10, windowMs: 60 * 60 * 1000 }), // 10 times per hour
  securityMiddleware.validateInput([
    securityMiddleware.getValidationRules().prompt.isLength({ min: 1, max: 100 }).withMessage('Pattern must be 1-100 characters')
  ]),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to invalidate cache'
        });
      }

      const { pattern } = req.body;

      if (!pattern) {
        return res.status(400).json({
          error: 'Pattern required',
          message: 'Please provide a cache key pattern to invalidate'
        });
      }

      const invalidatedCount = await cacheService.invalidatePattern(pattern);

      res.status(200).json({
        status: 'success',
        message: 'Cache invalidation completed',
        pattern,
        invalidatedEntries: invalidatedCount,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Cache invalidation error:', error);
      res.status(500).json({
        error: 'Failed to invalidate cache',
        message: error.message
      });
    }
  }
);

/**
 * Preload cache for specific user
 */
router.post('/preload/:userId',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 5, windowMs: 60 * 60 * 1000 }), // 5 times per hour
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { userTier = 'free' } = req.body;

      // Users can preload their own cache, admins can preload any user's cache
      if (req.userId !== userId && (!req.user.permissions || !req.user.permissions.includes('admin'))) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'You can only preload your own cache or need admin permissions'
        });
      }

      const preloadedCount = await cacheService.preloadUserCache(userId, userTier);

      res.status(200).json({
        status: 'success',
        message: 'User cache preloading completed',
        userId,
        userTier,
        preloadedEntries: preloadedCount,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Cache preloading error:', error);
      res.status(500).json({
        error: 'Failed to preload user cache',
        message: error.message
      });
    }
  }
);

/**
 * Sync distributed cache
 */
router.post('/sync',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 2, windowMs: 60 * 60 * 1000 }), // 2 times per hour
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to sync distributed cache'
        });
      }

      await cacheService.syncWithDistributedCache();

      res.status(200).json({
        status: 'success',
        message: 'Distributed cache sync completed',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Cache sync error:', error);
      res.status(500).json({
        error: 'Failed to sync distributed cache',
        message: error.message
      });
    }
  }
);

/**
 * Get cache configuration
 */
router.get('/config',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view cache configuration'
        });
      }

      const config = {
        redis: {
          enabled: cacheService.isRedisAvailable,
          url: process.env.REDIS_URL ? '[CONFIGURED]' : '[NOT CONFIGURED]'
        },
        memory: {
          enabled: true,
          maxSize: '100MB' // This would be configurable
        },
        ttl: {
          ensemble: 3600, // 1 hour
          workout: 1800,  // 30 minutes
          memory: 7200,   // 2 hours
          default: 3600
        },
        features: {
          warming: true,
          invalidation: true,
          preloading: true,
          analytics: true,
          distributedSync: cacheService.isRedisAvailable
        }
      };

      res.status(200).json({
        status: 'success',
        configuration: config,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Cache configuration error:', error);
      res.status(500).json({
        error: 'Failed to retrieve cache configuration',
        message: error.message
      });
    }
  }
);

/**
 * Clear all cache (emergency use)
 */
router.delete('/clear',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 1, windowMs: 60 * 60 * 1000 }), // Once per hour
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to clear all cache'
        });
      }

      const { confirm } = req.body;

      if (confirm !== 'CLEAR_ALL_CACHE') {
        return res.status(400).json({
          error: 'Confirmation required',
          message: 'Please provide confirmation with "confirm": "CLEAR_ALL_CACHE"'
        });
      }

      // Clear memory cache
      const memoryClearedCount = cacheService.memoryCache.size;
      cacheService.memoryCache.clear();

      // Clear Redis cache if available
      let redisClearedCount = 0;
      if (cacheService.isRedisAvailable && cacheService.redisClient) {
        await cacheService.redisClient.flushdb();
        redisClearedCount = 1; // We don't know exact count, just indicate it was cleared
      }

      res.status(200).json({
        status: 'success',
        message: 'All cache cleared',
        cleared: {
          memory: memoryClearedCount,
          redis: redisClearedCount > 0
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Cache clear error:', error);
      res.status(500).json({
        error: 'Failed to clear cache',
        message: error.message
      });
    }
  }
);

module.exports = router;
