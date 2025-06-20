/**
 * Fine-Tuned Model Management Routes
 * Provides endpoints for managing fine-tuned models, performance tracking, and model comparison
 */

const express = require('express');
const fineTunedModelService = require('../services/fineTunedModelService');
const authenticationService = require('../services/authenticationService');
const securityMiddleware = require('../middleware/securityMiddleware');

const router = express.Router();

/**
 * Get available fine-tuned models
 */
router.get('/fine-tuned',
  authenticationService.optionalAuth(),
  async (req, res) => {
    try {
      const { purpose, status } = req.query;
      const userTier = req.userTier || 'free';

      const models = fineTunedModelService.getAvailableModels(purpose, status);
      
      // Filter models based on user tier if needed
      const accessibleModels = models.map(model => ({
        id: model.id,
        name: model.name,
        purpose: model.purpose,
        status: model.status,
        baseModel: model.baseModel,
        createdAt: model.createdAt,
        metrics: {
          accuracy: model.metrics.accuracy,
          responseTime: model.metrics.responseTime,
          userRating: model.metrics.userRating
        }
      }));

      res.status(200).json({
        status: 'success',
        models: accessibleModels,
        count: accessibleModels.length,
        userTier,
        filters: { purpose, status }
      });

    } catch (error) {
      console.error('Fine-tuned models listing error:', error);
      res.status(500).json({
        error: 'Failed to list fine-tuned models',
        message: error.message
      });
    }
  }
);

/**
 * Get specific fine-tuned model details
 */
router.get('/fine-tuned/:modelId',
  authenticationService.optionalAuth(),
  async (req, res) => {
    try {
      const { modelId } = req.params;
      const model = fineTunedModelService.getModel(modelId);

      if (!model) {
        return res.status(404).json({
          error: 'Model not found',
          message: 'The specified fine-tuned model does not exist'
        });
      }

      const performance = fineTunedModelService.getModelPerformance(modelId);

      res.status(200).json({
        status: 'success',
        model: {
          id: model.id,
          name: model.name,
          purpose: model.purpose,
          status: model.status,
          baseModel: model.baseModel,
          provider: model.provider,
          createdAt: model.createdAt,
          metrics: model.metrics
        },
        performance: performance?.performance || null
      });

    } catch (error) {
      console.error('Fine-tuned model details error:', error);
      res.status(500).json({
        error: 'Failed to get model details',
        message: error.message
      });
    }
  }
);

/**
 * Compare multiple fine-tuned models
 */
router.post('/fine-tuned/compare',
  authenticationService.optionalAuth(),
  securityMiddleware.validateInput([
    securityMiddleware.getValidationRules().prompt.isArray().withMessage('Model IDs must be an array')
  ]),
  async (req, res) => {
    try {
      const { modelIds } = req.body;

      if (!Array.isArray(modelIds) || modelIds.length < 2) {
        return res.status(400).json({
          error: 'Invalid model IDs',
          message: 'Please provide at least 2 model IDs to compare'
        });
      }

      if (modelIds.length > 5) {
        return res.status(400).json({
          error: 'Too many models',
          message: 'Maximum 5 models can be compared at once'
        });
      }

      const comparison = fineTunedModelService.compareModels(modelIds);

      res.status(200).json({
        status: 'success',
        comparison,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Model comparison error:', error);
      res.status(500).json({
        error: 'Failed to compare models',
        message: error.message
      });
    }
  }
);

/**
 * Get recommended model for specific purpose
 */
router.get('/recommendations/:purpose',
  authenticationService.optionalAuth(),
  async (req, res) => {
    try {
      const { purpose } = req.params;
      const userTier = req.userTier || 'free';

      const validPurposes = ['ensemble_synthesis', 'workout_generation', 'memory_synthesis'];
      if (!validPurposes.includes(purpose)) {
        return res.status(400).json({
          error: 'Invalid purpose',
          message: `Purpose must be one of: ${validPurposes.join(', ')}`
        });
      }

      const recommendedModel = fineTunedModelService.getRecommendedModel(purpose, userTier);

      if (!recommendedModel) {
        return res.status(404).json({
          status: 'success',
          message: 'No fine-tuned models available for this purpose',
          recommendation: null,
          fallbackToStandard: true
        });
      }

      const performance = fineTunedModelService.getModelPerformance(recommendedModel.id);

      res.status(200).json({
        status: 'success',
        recommendation: {
          model: {
            id: recommendedModel.id,
            name: recommendedModel.name,
            purpose: recommendedModel.purpose,
            status: recommendedModel.status
          },
          performance: performance?.performance || null,
          reason: 'Best overall performance for this purpose and tier'
        },
        purpose,
        userTier
      });

    } catch (error) {
      console.error('Model recommendation error:', error);
      res.status(500).json({
        error: 'Failed to get model recommendation',
        message: error.message
      });
    }
  }
);

/**
 * Create new fine-tuned model (admin only)
 */
router.post('/fine-tuned',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 2, windowMs: 60 * 60 * 1000 }), // 2 models per hour
  securityMiddleware.validateInput([
    securityMiddleware.getValidationRules().prompt.isLength({ min: 1, max: 100 }).withMessage('Model name required')
  ]),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to create fine-tuned models'
        });
      }

      const { name, baseModel, purpose, trainingDataPath, hyperparameters } = req.body;

      const validPurposes = ['ensemble_synthesis', 'workout_generation', 'memory_synthesis'];
      if (!validPurposes.includes(purpose)) {
        return res.status(400).json({
          error: 'Invalid purpose',
          message: `Purpose must be one of: ${validPurposes.join(', ')}`
        });
      }

      const result = await fineTunedModelService.createFineTunedModel({
        name,
        baseModel: baseModel || 'gpt-4o-mini',
        purpose,
        trainingDataPath,
        hyperparameters
      });

      res.status(201).json({
        status: 'success',
        message: 'Fine-tuning job started',
        job: result
      });

    } catch (error) {
      console.error('Fine-tuned model creation error:', error);
      res.status(500).json({
        error: 'Failed to create fine-tuned model',
        message: error.message
      });
    }
  }
);

/**
 * Get fine-tuning job status
 */
router.get('/fine-tuning/:jobId',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      const { jobId } = req.params;
      const status = fineTunedModelService.getFineTuningStatus(jobId);

      if (!status) {
        return res.status(404).json({
          error: 'Job not found',
          message: 'The specified fine-tuning job does not exist'
        });
      }

      res.status(200).json({
        status: 'success',
        job: status
      });

    } catch (error) {
      console.error('Fine-tuning status error:', error);
      res.status(500).json({
        error: 'Failed to get fine-tuning status',
        message: error.message
      });
    }
  }
);

/**
 * Get fine-tuned model service metrics (admin only)
 */
router.get('/metrics',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view model metrics'
        });
      }

      const metrics = fineTunedModelService.getServiceMetrics();

      res.status(200).json({
        status: 'success',
        metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Model metrics error:', error);
      res.status(500).json({
        error: 'Failed to get model metrics',
        message: error.message
      });
    }
  }
);

/**
 * Health check for model service
 */
router.get('/health',
  async (req, res) => {
    try {
      const metrics = fineTunedModelService.getServiceMetrics();

      res.status(200).json({
        status: 'healthy',
        service: 'fine-tuned-models',
        metrics: {
          totalModels: metrics.totalModels,
          activeModels: metrics.activeModels
        },
        timestamp: new Date().toISOString()
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
