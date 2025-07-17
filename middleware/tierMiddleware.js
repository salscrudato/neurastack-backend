/**
 * 🎯 Tier Middleware
 * 
 * 🎯 PURPOSE: Automatically determine and attach user tier information to requests
 * 
 * 📋 FEATURES:
 * - Automatically fetch user tier from database
 * - Cache tier information for performance
 * - Attach tier config to request object
 * - Handle tier validation and rate limiting
 * - Support for tier-based feature access
 */

const { getUserTierService } = require('../services/userTierService');
const monitoringService = require('../services/monitoringService');

/**
 * Middleware to determine and attach user tier information
 */
async function attachUserTier(req, res, next) {
  try {
    // Extract user ID from headers or body
    const userId = req.headers['x-user-id'] || 
                   req.body?.userId || 
                   req.query?.userId || 
                   'anonymous';
    
    // Get tier service
    const tierService = getUserTierService();
    
    // Fetch user tier
    const userTier = await tierService.getUserTier(userId);
    const tierConfig = tierService.getTierConfig(userTier);
    
    // Attach to request object
    req.userId = userId;
    req.userTier = userTier;
    req.tierConfig = tierConfig;
    
    // Add tier info to response headers for debugging
    res.setHeader('X-User-Tier', userTier);
    res.setHeader('X-Tier-Limits', JSON.stringify({
      maxRequestsPerHour: tierConfig.maxRequestsPerHour,
      maxRequestsPerDay: tierConfig.maxRequestsPerDay,
      maxPromptLength: tierConfig.maxPromptLength
    }));
    
    next();
    
  } catch (error) {
    console.warn('⚠️ Tier middleware error:', error.message);
    
    // Fallback to free tier on error
    req.userId = req.headers['x-user-id'] || 'anonymous';
    req.userTier = 'free';
    req.tierConfig = getUserTierService().getTierConfig('free');
    
    res.setHeader('X-User-Tier', 'free');
    res.setHeader('X-Tier-Error', error.message);
    
    next();
  }
}

/**
 * Middleware to validate tier-based access
 */
function validateTierAccess(requiredFeature) {
  return (req, res, next) => {
    try {
      const { userTier, tierConfig } = req;
      
      if (!tierConfig) {
        return res.status(500).json({
          status: 'error',
          message: 'Tier configuration not available',
          correlationId: req.headers['x-correlation-id']
        });
      }
      
      // Check if user's tier has the required feature
      if (!tierConfig.features.includes(requiredFeature)) {
        return res.status(403).json({
          status: 'error',
          message: `Feature '${requiredFeature}' requires premium tier`,
          currentTier: userTier,
          requiredTier: 'premium',
          upgradeInfo: {
            message: 'Upgrade to premium to access this feature',
            benefits: getUserTierService().getTierConfig('premium').features
          },
          correlationId: req.headers['x-correlation-id']
        });
      }
      
      next();
      
    } catch (error) {
      console.error('❌ Tier validation error:', error.message);
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to validate tier access',
        error: error.message,
        correlationId: req.headers['x-correlation-id']
      });
    }
  };
}

/**
 * Middleware to validate prompt length based on tier
 */
function validatePromptLength(req, res, next) {
  try {
    const { tierConfig } = req;
    const prompt = req.body?.prompt || '';
    
    if (!tierConfig) {
      return res.status(500).json({
        status: 'error',
        message: 'Tier configuration not available',
        correlationId: req.headers['x-correlation-id']
      });
    }
    
    if (prompt.length > tierConfig.maxPromptLength) {
      return res.status(400).json({
        status: 'error',
        message: `Prompt length (${prompt.length}) exceeds ${req.userTier} tier limit (${tierConfig.maxPromptLength})`,
        currentLength: prompt.length,
        maxLength: tierConfig.maxPromptLength,
        tier: req.userTier,
        upgradeInfo: req.userTier === 'free' ? {
          message: 'Upgrade to premium for longer prompts',
          premiumLimit: getUserTierService().getTierConfig('premium').maxPromptLength
        } : null,
        correlationId: req.headers['x-correlation-id']
      });
    }
    
    next();
    
  } catch (error) {
    console.error('❌ Prompt validation error:', error.message);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to validate prompt length',
      error: error.message,
      correlationId: req.headers['x-correlation-id']
    });
  }
}

/**
 * Middleware for tier-based rate limiting
 */
function tierBasedRateLimit(req, res, next) {
  try {
    const { userId, userTier, tierConfig } = req;
    
    if (!tierConfig) {
      return res.status(500).json({
        status: 'error',
        message: 'Tier configuration not available',
        correlationId: req.headers['x-correlation-id']
      });
    }
    
    // Simple in-memory rate limiting (in production, use Redis or similar)
    if (!global.rateLimitStore) {
      global.rateLimitStore = new Map();
    }
    
    const now = Date.now();
    const hourWindow = 60 * 60 * 1000; // 1 hour
    const dayWindow = 24 * 60 * 60 * 1000; // 24 hours
    
    const userKey = `rate_${userId}`;
    let userRateData = global.rateLimitStore.get(userKey) || {
      hourlyRequests: [],
      dailyRequests: []
    };
    
    // Clean old requests
    userRateData.hourlyRequests = userRateData.hourlyRequests.filter(time => now - time < hourWindow);
    userRateData.dailyRequests = userRateData.dailyRequests.filter(time => now - time < dayWindow);
    
    // Check hourly limit
    if (userRateData.hourlyRequests.length >= tierConfig.maxRequestsPerHour) {
      const oldestRequest = Math.min(...userRateData.hourlyRequests);
      const retryAfter = Math.ceil((oldestRequest + hourWindow - now) / 1000);
      
      return res.status(429).json({
        status: 'error',
        message: `Hourly rate limit exceeded for ${userTier} tier`,
        limit: tierConfig.maxRequestsPerHour,
        used: userRateData.hourlyRequests.length,
        retryAfter,
        tier: userTier,
        upgradeInfo: userTier === 'free' ? {
          message: 'Upgrade to premium for higher limits',
          premiumLimit: getUserTierService().getTierConfig('premium').maxRequestsPerHour
        } : null,
        correlationId: req.headers['x-correlation-id']
      });
    }
    
    // Check daily limit
    if (userRateData.dailyRequests.length >= tierConfig.maxRequestsPerDay) {
      const oldestRequest = Math.min(...userRateData.dailyRequests);
      const retryAfter = Math.ceil((oldestRequest + dayWindow - now) / 1000);
      
      return res.status(429).json({
        status: 'error',
        message: `Daily rate limit exceeded for ${userTier} tier`,
        limit: tierConfig.maxRequestsPerDay,
        used: userRateData.dailyRequests.length,
        retryAfter,
        tier: userTier,
        upgradeInfo: userTier === 'free' ? {
          message: 'Upgrade to premium for higher limits',
          premiumLimit: getUserTierService().getTierConfig('premium').maxRequestsPerDay
        } : null,
        correlationId: req.headers['x-correlation-id']
      });
    }
    
    // Add current request
    userRateData.hourlyRequests.push(now);
    userRateData.dailyRequests.push(now);
    global.rateLimitStore.set(userKey, userRateData);
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Hourly-Limit', tierConfig.maxRequestsPerHour);
    res.setHeader('X-RateLimit-Hourly-Remaining', tierConfig.maxRequestsPerHour - userRateData.hourlyRequests.length);
    res.setHeader('X-RateLimit-Daily-Limit', tierConfig.maxRequestsPerDay);
    res.setHeader('X-RateLimit-Daily-Remaining', tierConfig.maxRequestsPerDay - userRateData.dailyRequests.length);
    
    next();
    
  } catch (error) {
    console.error('❌ Rate limit error:', error.message);
    
    // Continue on error to avoid blocking requests
    next();
  }
}

/**
 * Middleware to log tier usage for analytics
 */
function logTierUsage(req, res, next) {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log tier usage after response is sent
    try {
      const { userId, userTier } = req;
      const statusCode = res.statusCode;
      
      monitoringService.log('info', 'Tier usage', {
        userId,
        tier: userTier,
        endpoint: req.path,
        method: req.method,
        statusCode,
        responseTime: Date.now() - req.startTime,
        correlationId: req.headers['x-correlation-id']
      });
    } catch (error) {
      console.warn('⚠️ Failed to log tier usage:', error.message);
    }
    
    originalSend.call(this, data);
  };
  
  req.startTime = Date.now();
  next();
}

module.exports = {
  attachUserTier,
  validateTierAccess,
  validatePromptLength,
  tierBasedRateLimit,
  logTierUsage
};
