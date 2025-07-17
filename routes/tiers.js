/**
 * 🎯 User Tier Management Routes
 * 
 * 🎯 PURPOSE: API endpoints for managing user tier upgrades and information
 * 
 * 📋 ENDPOINTS:
 * - GET /tiers/info/:userId - Get user tier information
 * - POST /tiers/upgrade - Upgrade user to premium
 * - POST /tiers/downgrade - Downgrade user to free
 * - GET /tiers/config - Get tier configurations
 * - POST /tiers/validate - Validate tier access for request
 */

const express = require('express');
const router = express.Router();
const { getUserTierService } = require('../services/userTierService');
const monitoringService = require('../services/monitoringService');

/**
 * Get user tier information
 * GET /tiers/info/:userId
 */
router.get('/info/:userId', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || `tier-info-${Date.now()}`;
  
  try {
    const { userId } = req.params;
    
    if (!userId || userId === 'undefined') {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required',
        correlationId
      });
    }

    const tierService = getUserTierService();
    const tierInfo = await tierService.getUserTierInfo(userId);
    
    res.status(200).json({
      status: 'success',
      data: tierInfo,
      correlationId
    });
    
  } catch (error) {
    monitoringService.log('error', 'Failed to get tier info', {
      error: error.message,
      userId: req.params.userId,
      correlationId
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve tier information',
      error: error.message,
      correlationId
    });
  }
});

/**
 * Upgrade user to premium tier
 * POST /tiers/upgrade
 * Body: { userId, durationDays?, customerId?, subscriptionId?, reason? }
 */
router.post('/upgrade', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || `tier-upgrade-${Date.now()}`;
  
  try {
    const { userId, durationDays = 30, customerId, subscriptionId, reason } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required',
        correlationId
      });
    }

    // Validate duration
    if (durationDays < 1 || durationDays > 365) {
      return res.status(400).json({
        status: 'error',
        message: 'Duration must be between 1 and 365 days',
        correlationId
      });
    }

    const tierService = getUserTierService();
    const result = await tierService.upgradeToPremium(userId, {
      durationDays,
      customerId,
      subscriptionId,
      reason: reason || 'API upgrade request'
    });
    
    if (result.success) {
      res.status(200).json({
        status: 'success',
        data: result,
        message: result.message,
        correlationId
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to upgrade user tier',
        error: result.error,
        correlationId
      });
    }
    
  } catch (error) {
    monitoringService.log('error', 'Failed to upgrade user tier', {
      error: error.message,
      userId: req.body.userId,
      correlationId
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to upgrade user tier',
      error: error.message,
      correlationId
    });
  }
});

/**
 * Downgrade user to free tier
 * POST /tiers/downgrade
 * Body: { userId, reason? }
 */
router.post('/downgrade', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || `tier-downgrade-${Date.now()}`;
  
  try {
    const { userId, reason } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required',
        correlationId
      });
    }

    const tierService = getUserTierService();
    const result = await tierService.downgradeTier(userId, reason || 'API downgrade request');
    
    if (result.success) {
      res.status(200).json({
        status: 'success',
        data: result,
        message: result.message,
        correlationId
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to downgrade user tier',
        error: result.error,
        correlationId
      });
    }
    
  } catch (error) {
    monitoringService.log('error', 'Failed to downgrade user tier', {
      error: error.message,
      userId: req.body.userId,
      correlationId
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to downgrade user tier',
      error: error.message,
      correlationId
    });
  }
});

/**
 * Get tier configurations
 * GET /tiers/config
 */
router.get('/config', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || `tier-config-${Date.now()}`;
  
  try {
    const tierService = getUserTierService();
    const freeConfig = tierService.getTierConfig('free');
    const premiumConfig = tierService.getTierConfig('premium');
    
    res.status(200).json({
      status: 'success',
      data: {
        free: freeConfig,
        premium: premiumConfig,
        comparison: {
          requestsPerHour: {
            free: freeConfig.maxRequestsPerHour,
            premium: premiumConfig.maxRequestsPerHour,
            improvement: `${Math.round((premiumConfig.maxRequestsPerHour / freeConfig.maxRequestsPerHour) * 100)}% more`
          },
          requestsPerDay: {
            free: freeConfig.maxRequestsPerDay,
            premium: premiumConfig.maxRequestsPerDay,
            improvement: `${Math.round((premiumConfig.maxRequestsPerDay / freeConfig.maxRequestsPerDay) * 100)}% more`
          },
          promptLength: {
            free: freeConfig.maxPromptLength,
            premium: premiumConfig.maxPromptLength,
            improvement: `${Math.round((premiumConfig.maxPromptLength / freeConfig.maxPromptLength) * 100)}% longer`
          },
          models: {
            free: freeConfig.models,
            premium: premiumConfig.models,
            premiumExclusive: premiumConfig.models.filter(m => !freeConfig.models.includes(m))
          }
        }
      },
      correlationId
    });
    
  } catch (error) {
    monitoringService.log('error', 'Failed to get tier config', {
      error: error.message,
      correlationId
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve tier configuration',
      error: error.message,
      correlationId
    });
  }
});

/**
 * Validate tier access for a request
 * POST /tiers/validate
 * Body: { userId, requestType, promptLength? }
 */
router.post('/validate', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || `tier-validate-${Date.now()}`;
  
  try {
    const { userId, requestType, promptLength = 0 } = req.body;
    
    if (!userId || !requestType) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID and request type are required',
        correlationId
      });
    }

    const tierService = getUserTierService();
    const tier = await tierService.getUserTier(userId);
    const config = tierService.getTierConfig(tier);
    
    // Validate prompt length
    const promptValid = promptLength <= config.maxPromptLength;
    
    // Check if request type is allowed for tier
    const requestTypeValid = config.features.includes(requestType) || 
                           (requestType === 'ensemble' && config.features.includes('basic_ensemble')) ||
                           (requestType === 'ensemble' && config.features.includes('advanced_ensemble'));
    
    const validation = {
      userId,
      tier,
      requestType,
      valid: promptValid && requestTypeValid,
      reasons: [],
      limits: {
        maxPromptLength: config.maxPromptLength,
        maxRequestsPerHour: config.maxRequestsPerHour,
        maxRequestsPerDay: config.maxRequestsPerDay,
        availableModels: config.models,
        features: config.features
      }
    };
    
    if (!promptValid) {
      validation.reasons.push(`Prompt length (${promptLength}) exceeds limit (${config.maxPromptLength})`);
    }
    
    if (!requestTypeValid) {
      validation.reasons.push(`Request type '${requestType}' not available for ${tier} tier`);
    }
    
    res.status(200).json({
      status: 'success',
      data: validation,
      correlationId
    });
    
  } catch (error) {
    monitoringService.log('error', 'Failed to validate tier access', {
      error: error.message,
      userId: req.body.userId,
      correlationId
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to validate tier access',
      error: error.message,
      correlationId
    });
  }
});

/**
 * Bulk upgrade multiple users (admin only)
 * POST /tiers/bulk-upgrade
 * Body: { userIds: [], durationDays?, reason? }
 */
router.post('/bulk-upgrade', async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || `tier-bulk-upgrade-${Date.now()}`;
  
  try {
    const { userIds, durationDays = 30, reason } = req.body;
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'User IDs array is required',
        correlationId
      });
    }

    if (userIds.length > 100) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot upgrade more than 100 users at once',
        correlationId
      });
    }

    const tierService = getUserTierService();
    const results = [];
    
    for (const userId of userIds) {
      try {
        const result = await tierService.upgradeToPremium(userId, {
          durationDays,
          reason: reason || 'Bulk upgrade'
        });
        results.push({ userId, ...result });
      } catch (error) {
        results.push({ 
          userId, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    res.status(200).json({
      status: 'success',
      data: {
        total: userIds.length,
        successful,
        failed,
        results
      },
      message: `Bulk upgrade completed: ${successful} successful, ${failed} failed`,
      correlationId
    });
    
  } catch (error) {
    monitoringService.log('error', 'Failed bulk tier upgrade', {
      error: error.message,
      userCount: req.body.userIds?.length,
      correlationId
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to perform bulk tier upgrade',
      error: error.message,
      correlationId
    });
  }
});

module.exports = router;
