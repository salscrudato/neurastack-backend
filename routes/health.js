const express = require('express');
const router = express.Router();
const enhancedEnsemble = require('../services/enhancedEnsembleRunner');
const monitoringService = require('../services/monitoringService');
const clients = require('../services/vendorClients');
const ensembleConfig = require('../config/ensemblePrompts');
const cacheService = require('../services/cacheService');
const securityMiddleware = require('../middleware/securityMiddleware');
const simpleVotingService = require('../services/simpleVotingService');
const simpleConfidenceService = require('../services/simpleConfidenceService');
const simpleSynthesisService = require('../services/simpleSynthesisService');

// Basic health check
router.get('/health', (req, res) => res.status(200).json({ status: 'ok', message: 'Neurastack backend healthy 🚀' }));

// Voting analytics (cached for perf)
router.get('/voting-analytics', async (req, res) => {
  const cacheKey = 'voting_analytics';
  let analytics = await cacheService.get(cacheKey);
  if (!analytics) {
    try {
      const serviceAnalytics = simpleVotingService.getMetrics();
      const monitoringAnalytics = monitoringService.getVotingAnalytics();
      analytics = {
        status: 'success',
        timestamp: new Date().toISOString(),
        analytics: {
          monitoring: monitoringAnalytics,
          services: serviceAnalytics,
          insights: {
            systemHealth: monitoringAnalytics.totalVotingDecisions > 0 ? 'active' : 'inactive',
            averageConfidence: monitoringAnalytics.averageConfidence,
            mostUsedFeatures: getMostUsedFeatures(monitoringAnalytics),
            topPerformingModels: getTopPerformingModels(monitoringAnalytics),
            consensusTrends: getConsensusTrends(monitoringAnalytics)
          }
        }
      };
      await cacheService.set(cacheKey, analytics, 60); // Cache 60s
    } catch (error) {
      monitoringService.log('error', 'Failed to get voting analytics', { error: error.message });
      return res.status(500).json({ status: 'error', error: 'Failed to retrieve voting analytics', timestamp: new Date().toISOString() });
    }
  }
  res.json(analytics);
});

// Synthesis analytics
router.get('/synthesis-analytics', async (req, res) => {
  try {
    const analytics = monitoringService.getSynthesisAnalytics();
    res.status(200).json({ status: 'success', timestamp: new Date().toISOString(), analytics });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to retrieve synthesis analytics', error: error.message });
  }
});

// Synthesis health check
router.get('/synthesis-health', async (req, res) => {
  try {
    const [synthesisHealth, validatorHealth] = await Promise.all([enhancedSynthesisService.healthCheck(), postSynthesisValidator.healthCheck()]);
    res.status(200).json({ status: 'success', timestamp: new Date().toISOString(), services: { enhancedSynthesis: synthesisHealth, postSynthesisValidator: validatorHealth } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to retrieve synthesis health status', error: error.message });
  }
});

// Low-cost test endpoints (switched to cheap models)
router.get('/openai-test', async (req, res) => {
  try {
    const response = await clients.openai.chat.completions.create({
      model: 'gpt-4.1-nano', // Updated to most cost-effective model
      messages: [{ role: 'user', content: 'Hello! Brief overview of Neurastack backend?' }],
      max_tokens: 500 // Limit tokens for test endpoint
    });
    res.status(200).json({ status: 'ok', model: response.model, response: response.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch from OpenAI.' });
  }
});

router.get('/xai-test', async (req, res) => {
  try {
    const response = await clients.xai.post('/chat/completions', {
      model: 'grok-2-1212',
      messages: [
        { role: 'system', content: 'You are Grok, a helpful AI assistant.' },
        { role: 'user', content: 'Explain AI in few words' }
      ],
      max_tokens: 100,
      temperature: 0.3
    });
    res.status(200).json({
      status: 'ok',
      model: 'grok-2-1212',
      response: response.data.choices?.[0]?.message?.content || 'No response'
    });
  } catch (error) {
    console.error('xAI test error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch from xAI.',
      error: error.response?.data || error.message
    });
  }
});

router.get('/gemini-test', async (req, res) => {
  try {
    const response = await clients.gemini.post('/models/gemini-1.5-flash:generateContent', { // Low-cost flash
      contents: [{ parts: [{ text: 'Explain AI in few words' }] }]
    });
    res.status(200).json({ status: 'ok', model: 'gemini-1.5-flash', response: response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response' });
  } catch (error) {
    console.error('Gemini test error:', error.response?.data || error.message);
    res.status(500).json({ status: 'error', message: 'Failed to fetch from Gemini.', error: error.response?.data || error.message });
  }
});

router.get('/claude-test', async (req, res) => {
  try {
    const response = await clients.claude.post('/messages', {
      model: 'claude-3-5-haiku-latest', // Low-cost haiku
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Explain neural networks simply' }]
    });
    res.status(200).json({ status: 'ok', model: response.data.model, response: response.data.content[0].text });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch from Claude.' });
  }
});

/**
 * Main AI Ensemble Endpoint - Enhanced Implementation
 *
 * This is the core endpoint that orchestrates the enhanced AI ensemble process:
 * 1. Validates and sanitizes user input
 * 2. Uses intelligent model selection based on request characteristics
 * 3. Executes models in parallel with optimized resource management
 * 4. Performs advanced synthesis with multi-stage processing
 * 5. Uses sophisticated voting with multi-factor analysis
 * 6. Validates quality and provides comprehensive response
 *
 * The implementation now uses the Enhanced Ensemble Orchestrator for
 * superior results while maintaining backward compatibility.
 */
router.post('/default-ensemble', async (req, res) => {
  // Generate or extract correlation ID for request tracking
  const correlationId = req.correlationId || `ensemble_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Step 1: Validate and sanitize input (with rate limiting)
    const { prompt, userId, userTier, sessionId, explainMode } = validateAndSanitizeInput(req);

    // Step 2: Run the enhanced AI ensemble with intelligent orchestration
    const enhancedOrchestrator = require('../services/enhancedEnsembleOrchestrator');
    const ensembleResult = await enhancedOrchestrator.runEnhancedEnsemble(prompt, userId, sessionId, {
      correlationId,
      userTier,
      explainMode,
      qualityTarget: userTier === 'premium' ? 0.8 : 0.7
    });

    // Step 3: Build response maintaining exact structure for backward compatibility
    // The enhanced orchestrator already provides the complete response structure
    const response = {
      synthesis: ensembleResult.synthesis,
      roles: ensembleResult.roles,
      voting: ensembleResult.voting,
      metadata: {
        ...ensembleResult.metadata,
        // Add legacy fields for compatibility
        memoryContextUsed: ensembleResult.metadata.memoryContextUsed || false,
        memoryTokensUsed: ensembleResult.metadata.memoryTokensUsed || 0,
        confidenceAnalysis: {
          averageConfidence: ensembleResult.roles.length > 0 ?
            ensembleResult.roles.reduce((sum, role) => sum + (role.confidence?.score || 0), 0) / ensembleResult.roles.length : 0,
          confidenceRange: ensembleResult.voting.analysis?.scoreGap || 0,
          highConfidenceResponses: ensembleResult.roles.filter(role => (role.confidence?.score || 0) > 0.7).length
        },
        costEstimate: {
          totalCost: 0.008, // Estimated cost for enhanced processing
          breakdown: ensembleResult.metadata.selectedModels?.reduce((acc, model) => {
            acc[model] = 0.002; // Estimated per model
            return acc;
          }, {}) || {},
          synthesis: 0.002
        },
        tier: userTier,
        enhanced: true,
        orchestrationVersion: ensembleResult.metadata.orchestrationVersion
      }
    };

    // Add explain mode details if requested
    if (explainMode) {
      response.explanation = {
        modelSelection: ensembleResult.metadata.modelSelectionReasoning || [],
        synthesisStrategy: ensembleResult.metadata.synthesisStrategy,
        votingAnalysis: ensembleResult.voting.analysis,
        qualityValidation: ensembleResult.metadata.qualityValidation,
        processingStages: [
          'Request Analysis',
          'Intelligent Model Selection',
          'Parallel Execution',
          'Quality Assessment',
          'Advanced Synthesis',
          'Intelligent Voting',
          'Quality Validation'
        ]
      };
    }

    // Return successful response
    res.status(200).json(response);

  } catch (error) {
    // Log error for monitoring and debugging
    monitoringService.log('error', 'Ensemble failed', {
      error: error.message,
      userId: req.headers['x-user-id'] || 'anonymous'
    }, correlationId);

    // Return error response (hide details in production)
    res.status(500).json({
      status: 'error',
      message: 'Ensemble processing failed.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
      correlationId
    });
  }
});

/**
 * Validate and sanitize input from API request
 *
 * Performs validation, sanitization, and rate limiting for ensemble requests.
 * Simplified from complex validation while maintaining security.
 *
 * @param {Object} req - Express request object
 * @returns {Object} Validated input parameters
 * @throws {Error} If validation or rate limiting fails
 */
function validateAndSanitizeInput(req) {
  // Extract and sanitize prompt (remove control characters for security)
  const prompt = (req.body?.prompt || 'Explain AI in 1-2 lines.')
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

  // Extract user information (now provided by tier middleware)
  const userId = req.userId || 'anonymous';
  const userTier = req.userTier || 'free';
  const tierConfig = req.tierConfig;

  // Generate session ID if not provided
  const sessionId = req.body?.sessionId ||
                   req.headers['x-session-id'] ||
                   `session_${userId}_${Date.now()}`;

  // Check for explain mode (from query or body)
  const explainMode = req.query?.explain === 'true' || req.body?.explain === true;

  // Validate prompt length based on tier (using tier config from middleware)
  const maxLength = tierConfig?.maxPromptLength || 5000;
  if (typeof prompt !== 'string' || prompt.length < 3 || prompt.length > maxLength) {
    throw new Error(`Invalid prompt length/format. Maximum length for ${userTier} tier: ${maxLength}`);
  }

  // Simple rate limiting using tier config
  const limit = {
    max: tierConfig?.maxRequestsPerHour || 25,
    windowMs: 60 * 60 * 1000 // 1 hour window
  };
  const rateResult = securityMiddleware.checkRateLimit(userId, 'ensemble', limit.max, limit.windowMs);

  if (!rateResult.allowed) {
    throw new Error('Rate limit exceeded.');
  }

  return { prompt, userId, userTier, sessionId, explainMode };
}

/**
 * Get voting result using simplified voting service
 *
 * Uses the simplified voting service to determine the best response
 * from the AI ensemble. Includes fallback handling for reliability.
 *
 * @param {Array} roles - Array of role responses with confidence scores
 * @param {string} prompt - Original user prompt
 * @param {Object} metadata - Request metadata including correlationId
 * @returns {Object} Voting result with winner, confidence, and weights
 */
async function getVotingResult(roles, prompt, metadata) {
  try {
    // Use simplified voting service (replaces complex sophisticated voting)
    return await simpleVotingService.executeVoting(roles, prompt, metadata);
  } catch (error) {
    // Fallback to basic voting if service fails
    monitoringService.log('warn', 'Voting service failed, using fallback', {
      error: error.message,
      correlationId: metadata.correlationId
    });
    return createFallbackVotingResult(roles);
  }
}

/**
 * Build final response structure for AI ensemble
 *
 * This function creates the standardized response format that maintains
 * compatibility with existing clients while using simplified internal logic.
 *
 * @param {Object} ensembleResult - Result from ensemble processing
 * @param {Array} enhancedRoles - Role responses with confidence scores
 * @param {Object} votingResult - Voting results from simple voting service
 * @param {Object} synthesisConfidence - Synthesis confidence from simple service
 * @param {string} prompt - Original user prompt
 * @param {string} userId - User identifier
 * @param {string} sessionId - Session identifier
 * @param {boolean} explainMode - Whether to include explanations
 * @param {string} correlationId - Request correlation ID
 * @returns {Object} Standardized API response
 */
function buildFinalResponse(ensembleResult, enhancedRoles, votingResult, synthesisConfidence, prompt, userId, sessionId, explainMode, correlationId) {
  // Create the core response structure that matches expected format
  const response = {
    status: 'success',
    data: {
      // User request information
      prompt,
      userId,
      sessionId,

      // Synthesis result with confidence scoring
      synthesis: {
        ...ensembleResult.synthesis,
        confidence: synthesisConfidence
      },

      // Individual AI model responses with confidence and quality metrics
      roles: enhancedRoles,

      // Voting results (simplified but maintains structure)
      voting: votingResult,

      // Request metadata
      metadata: {
        processingTime: ensembleResult.processingTime || 0,
        correlationId,
        explainMode: !!explainMode
      }
    },
    correlationId
  };

  // Add explanation if requested (simplified - just acknowledge the mode)
  if (explainMode) {
    response.data.metadata.explainMode = true;
    // Note: Complex explanation logic removed for simplicity
    // The response structure itself provides transparency
  }

  return response;
}

// Detailed health endpoint
router.get('/health-detailed', async (req, res) => {
  try {
    const [systemHealth, vendorHealth, ensembleHealth] = await Promise.all([monitoringService.getHealthStatus(), clients.healthCheck(), enhancedEnsemble.healthCheck()]);
    const overallHealth = { status: 'healthy', timestamp: new Date().toISOString(), version: '2.0', components: { system: systemHealth, vendors: vendorHealth, ensemble: ensembleHealth } };
    const statuses = [systemHealth.status, Object.values(vendorHealth).some(v => !v.isHealthy) ? 'degraded' : 'healthy', ensembleHealth.ensemble.isHealthy ? 'healthy' : 'degraded'];
    if (statuses.includes('unhealthy')) overallHealth.status = 'unhealthy';
    else if (statuses.includes('degraded')) overallHealth.status = 'degraded';
    res.status(overallHealth.status === 'healthy' ? 200 : 503).json(overallHealth);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', message: 'Health check failed', timestamp: new Date().toISOString(), error: error.message });
  }
});

// Metrics (cached for perf)
router.get('/metrics', async (req, res) => {
  const cacheKey = 'system_metrics';
  let metrics = await cacheService.get(cacheKey);
  if (!metrics) {
    try {
      const [systemMetrics, vendorMetrics, ensembleMetrics] = await Promise.all([monitoringService.getDetailedMetrics(), clients.getMetrics(), enhancedEnsemble.getMetrics()]);
      metrics = { timestamp: new Date().toISOString(), system: systemMetrics, vendors: vendorMetrics, ensemble: ensembleMetrics, tier: ensembleConfig.meta.tier };
      await cacheService.set(cacheKey, metrics, 60); // Cache 60s
    } catch (error) {
      return res.status(500).json({ error: 'Failed to collect metrics', timestamp: new Date().toISOString() });
    }
  }
  res.status(200).json(metrics);
});

// Tier info
router.get('/tier-info', async (req, res) => {
  try {
    const tierConfig = ensembleConfig.getTierConfig();
    res.status(200).json({ status: 'success', data: { currentTier: ensembleConfig.meta.tier, configuration: tierConfig, availableTiers: ensembleConfig.allModels, costComparison: {} } });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to retrieve tier info' });
  }
});

// Removed: Workout health endpoint - workout functionality removed from codebase

// Cache stats/clear (keep as is, but add auth if admin)

// Removed: Vector endpoints (unused in core flow; re-add if needed)

// Ensemble stats/performance/feedback (keep simplified)

// Confidence/quality functions (keep as is; they're referenced)

// Complex confidence calculation functions removed - now using simpleConfidenceService

// Helper functions removed - functionality moved to simpleConfidenceService

// Synthesis confidence calculation moved to simpleConfidenceService

// Complex quality analysis functions removed - functionality moved to simpleConfidenceService

// Complex readability and coherence scoring functions removed

// Legacy quality analysis functions removed - functionality moved to simpleConfidenceService

// All complex semantic analysis functions removed - functionality moved to simpleConfidenceService

// Duplicate function removed - using simplified version above

function createFallbackVotingResult(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled' || r.content);

  if (successful.length > 0) {
    return {
      winner: successful[0].role,
      confidence: 0.5,
      consensus: 'fallback',
      weights: successful.reduce((acc, role) => {
        acc[role.role] = 1 / successful.length;
        return acc;
      }, {})
    };
  }

  return {
    winner: null,
    confidence: 0,
    consensus: 'none',
    weights: {}
  };
}

// Helper functions for analytics
function getMostUsedFeatures(analytics) {
  return Object.entries(analytics.sophisticatedFeaturesUsage || {})
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([feature, count]) => ({ feature, count }));
}

function getTopPerformingModels(analytics) {
  return Object.entries(analytics.modelPerformance || {})
    .sort(([,a], [,b]) => b.averageConfidence - a.averageConfidence)
    .slice(0, 3)
    .map(([model, stats]) => ({ model, averageConfidence: stats.averageConfidence }));
}

function getConsensusTrends(analytics) {
  const trends = analytics.consensusTrends || {};
  return {
    strongConsensus: trends.strong || 0,
    moderateConsensus: trends.moderate || 0,
    weakConsensus: trends.weak || 0
  };
}

// Export
module.exports = router;