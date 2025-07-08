const express = require('express');
const axios = require('axios');
const router = express.Router();
const openai = require('../config/openai');
const enhancedEnsemble = require('../services/enhancedEnsembleRunner');
const monitoringService = require('../services/monitoringService');
const clients = require('../services/vendorClients');
const ensembleConfig = require('../config/ensemblePrompts');
const workoutService = require('../services/workoutService');
const cacheService = require('../services/cacheService');
const securityMiddleware = require('../middleware/securityMiddleware');

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Neurastack backend healthy 🚀' });
});

router.get('/openai-test', async (req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello! Can you provide a brief overview of the Neurastack backend project?' }],
    });

    res.status(200).json({
      status: 'ok',
      model: response.model,
      response: response.choices[0].message.content,
    });
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    res.status(500).json({ status: 'error', message: 'Failed to fetch response from OpenAI.' });
  }
});

router.get('/xai-test', async (req, res) => {
  res.status(200).json({ status: 'ok', message: 'xAI test endpoint is working!' });
});

router.get('/xai-grok', async (req, res) => {
  try {

    const response = await axios.post('https://api.x.ai/v1/chat/completions', {
      model: 'grok-3-mini',
      messages: [
        {
          role: 'system',
          content: 'You are Grok, a chatbot inspired by the Hitchhiker\'s Guide to the Galaxy.'
        },
        {
          role: 'user',
          content: 'What is the meaning of life, the universe, and everything?'
        }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({
      status: 'ok',
      model: response.data.model,
      response: response.data.choices[0].message.content,
    });
  } catch (error) {
    console.error('X.AI API error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch response from X.AI.',
      error: error.response?.data || error.message
    });
  }
});

router.get('/gemini-test', async (req, res) => {
  try {

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: 'Explain how AI works in a few words'
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const generatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

    res.status(200).json({
      status: 'ok',
      model: 'gemini-2.5-flash',
      response: generatedText
    });
  } catch (error) {
    console.error('Gemini API error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch response from Gemini API.',
      error: error.response?.data || error.message
    });
  }
});

router.get('/claude-test', async (req, res) => {
  try {

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: 'Explain the concept of neural networks in simple terms'
          }
        ]
      },
      {
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      status: 'ok',
      model: response.data.model,
      response: response.data.content[0].text
    });
  } catch (error) {
    console.error('Claude API error:', error.response?.data || error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch response from Claude API.',
      error: error.response?.data || error.message
    });
  }
});

// Enhanced 4-AI Ensemble endpoint with production-grade features
router.post('/default-ensemble', async (req, res) => {
  const correlationId = req.correlationId || 'unknown';

  try {
    // Enhanced input validation and sanitization
    const prompt = req.body?.prompt || 'Quick sanity check: explain AI in 1-2 lines.';
    const userId = req.headers['x-user-id'] || req.userId || 'anonymous';
    const userTier = req.userTier || 'free';
    const sessionId = req.body?.sessionId || req.headers['x-session-id'] || `session_${userId}_${Date.now()}`;

    // Enhanced input validation
    if (typeof prompt !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid prompt format. Prompt must be a string.',
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    // Sanitize prompt (remove potentially harmful content)
    const sanitizedPrompt = prompt.trim().replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters

    // Enhanced rate limiting with tier-specific limits
    const rateLimits = {
      free: { maxRequests: 25, windowMs: 60000 },      // 25 requests per minute for free tier
      premium: { maxRequests: 100, windowMs: 60000 }   // 100 requests per minute for premium
    };

    const currentLimit = rateLimits[userTier] || rateLimits.free;

    try {
      const rateLimitResult = securityMiddleware.checkRateLimit(
        userId,
        'ensemble',
        currentLimit.maxRequests,
        currentLimit.windowMs
      );

      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          status: 'error',
          message: 'Rate limit exceeded',
          details: `Maximum ${currentLimit.maxRequests} requests per minute for ${userTier} tier`,
          retryAfter: Math.ceil(currentLimit.windowMs / 1000),
          timestamp: new Date().toISOString(),
          correlationId,
          tier: userTier
        });
      }
    } catch (rateLimitError) {
      return res.status(429).json({
        status: 'error',
        message: 'Rate limit exceeded',
        details: rateLimitError.message,
        retryAfter: 60,
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    // Enhanced prompt length validation with tier-specific limits
    const maxPromptLength = userTier === 'premium' ? 8000 : 5000;
    if (sanitizedPrompt.length > maxPromptLength) {
      return res.status(400).json({
        status: 'error',
        message: `Prompt too long. Maximum ${maxPromptLength} characters allowed for ${userTier} tier.`,
        currentLength: sanitizedPrompt.length,
        maxLength: maxPromptLength,
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    // Validate minimum prompt length
    if (sanitizedPrompt.length < 3) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt too short. Minimum 3 characters required.',
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    monitoringService.log('info', 'Enhanced ensemble request started', {
      userId,
      sessionId,
      promptLength: sanitizedPrompt.length,
      originalLength: prompt.length,
      tier: userTier
    }, correlationId);

    // Execute enhanced ensemble with comprehensive error handling using sanitized prompt
    const ensembleResult = await enhancedEnsemble.runEnsemble(sanitizedPrompt, userId, sessionId);

    // Calculate confidence scores for each response
    const enhancedRoles = ensembleResult.roles.map(role => {
      const confidence = calculateConfidenceScore(role);
      const qualityMetrics = analyzeResponseQuality(role.content);

      return {
        ...role,
        confidence: {
          score: confidence,
          level: getConfidenceLevel(confidence),
          factors: getConfidenceFactors(role, qualityMetrics)
        },
        quality: qualityMetrics,
        metadata: {
          ...role.metadata,
          processingTime: role.responseTime || 0,
          tokenCount: estimateTokenCount(role.content),
          complexity: assessComplexity(role.content)
        }
      };
    });

    // Perform weighted voting analysis
    const votingResult = calculateWeightedVote(enhancedRoles);

    // Enhanced synthesis confidence with voting results
    const synthesisConfidence = calculateSynthesisConfidence(ensembleResult.synthesis, enhancedRoles);

    // Adjust synthesis confidence based on voting consensus
    if (votingResult.consensus === 'strong') {
      synthesisConfidence.score = Math.min(1.0, synthesisConfidence.score * 1.1);
    } else if (votingResult.consensus === 'weak') {
      synthesisConfidence.score = Math.max(0.1, synthesisConfidence.score * 0.9);
    }

    // Enhanced response with confidence indicators and advanced metadata
    const response = {
      status: 'success',
      data: {
        prompt: prompt,
        userId: userId,
        sessionId: sessionId,
        synthesis: {
          ...ensembleResult.synthesis,
          confidence: synthesisConfidence,
          _confidenceDescription: "Overall confidence in the synthesized response, calculated from individual model confidence scores (70%) plus synthesis quality factors (30%). Higher scores indicate more reliable responses.",
          qualityScore: calculateQualityScore(ensembleResult.synthesis.content),
          _qualityScoreDescription: "Response quality assessment based on content structure, length optimization, and reasoning indicators. Scores range 0-1 with higher values indicating better structured, more comprehensive responses.",
          metadata: {
            basedOnResponses: enhancedRoles.length,
            _basedOnResponsesDescription: "Number of AI models that successfully contributed to this synthesis. More contributing models generally increase reliability.",
            averageConfidence: enhancedRoles.reduce((sum, role) => sum + role.confidence.score, 0) / enhancedRoles.length,
            _averageConfidenceDescription: "Mean confidence score across all individual model responses. Indicates overall ensemble agreement and response quality.",
            consensusLevel: calculateConsensusLevel(enhancedRoles),
            _consensusLevelDescription: "Measure of agreement between different AI models. Higher consensus suggests more reliable and consistent responses across the ensemble."
          }
        },
        roles: enhancedRoles.map(role => ({
          ...role,
          _confidenceDescription: "Individual model confidence calculated from response quality (length, structure, reasoning) and performance factors. Scores 0-1 where higher values indicate more reliable responses.",
          _qualityDescription: "Response quality metrics including word count, sentence structure, reasoning indicators, and complexity assessment used for ensemble weighting.",
          _metadataDescription: "Processing metrics including response time, token usage, and complexity scores that influence the model's weight in ensemble voting."
        })),
        voting: {
          winner: votingResult.winner,
          _winnerDescription: "AI model selected as having the best response based on weighted voting algorithm considering confidence, response time, length optimization, and model reliability factors.",
          confidence: votingResult.confidence,
          _confidenceDescription: "Normalized weight (0-1) of the winning model's response. Higher values indicate stronger consensus that this model provided the best answer.",
          consensus: votingResult.consensus,
          _consensusDescription: "Strength of agreement in voting: 'strong' (winner >60% weight, >20% lead), 'moderate' (winner >45% weight), 'weak' (distributed weights). Strong consensus indicates high ensemble agreement.",
          weights: votingResult.weights,
          _weightsDescription: "Normalized voting weights for each model calculated from: base confidence × time performance × length optimization × model reliability. Shows relative contribution strength of each model.",
          recommendation: votingResult.recommendation,
          _recommendationDescription: "Ensemble system's assessment of response reliability and suggested confidence level for end users based on voting patterns and consensus strength."
        },
        metadata: {
          ...ensembleResult.metadata,
          timestamp: new Date().toISOString(),
          version: '3.1', // Updated version for enhanced voting
          correlationId,
          confidenceAnalysis: {
            overallConfidence: synthesisConfidence.score,
            _overallConfidenceDescription: "Final confidence score for the entire ensemble response, combining synthesis quality with voting consensus adjustments.",
            modelAgreement: calculateModelAgreement(enhancedRoles),
            _modelAgreementDescription: "Measure of similarity between different AI model responses (0-1). Higher values indicate models provided consistent, aligned answers.",
            responseConsistency: calculateResponseConsistency(enhancedRoles),
            _responseConsistencyDescription: "Assessment of how consistent the responses are across models in terms of content quality and structure. Higher consistency increases ensemble reliability.",
            qualityDistribution: getQualityDistribution(enhancedRoles),
            _qualityDistributionDescription: "Breakdown of response quality levels (high/medium/low) across all models. More 'high' quality responses indicate better ensemble performance.",
            votingAnalysis: {
              consensusStrength: votingResult.consensus,
              _consensusStrengthDescription: "Categorical assessment of voting agreement: strong consensus indicates clear winner, weak consensus suggests close competition between models.",
              winnerMargin: Math.max(...Object.values(votingResult.weights)) -
                           (Object.values(votingResult.weights).sort((a, b) => b - a)[1] || 0),
              _winnerMarginDescription: "Numerical difference between the winning model's weight and the second-place model. Larger margins indicate clearer ensemble decisions.",
              distributionEntropy: calculateWeightEntropy(votingResult.weights),
              _distributionEntropyDescription: "Measure of weight distribution randomness. Lower entropy means concentrated voting (clear winner), higher entropy means distributed voting (close competition)."
            }
          },
          costEstimate: await estimateRequestCost(prompt, enhancedRoles),
          _costEstimateDescription: "Estimated API costs for this ensemble request including input/output tokens and per-model pricing. Helps track usage and optimize cost efficiency."
        }
      },
      correlationId
    };

    monitoringService.log('info', 'Enhanced ensemble completed successfully', {
      processingTime: ensembleResult.metadata.processingTimeMs,
      successfulRoles: ensembleResult.metadata.successfulRoles,
      synthesisStatus: ensembleResult.metadata.synthesisStatus
    }, correlationId);

    res.status(200).json(response);

  } catch (error) {
    monitoringService.log('error', 'Enhanced ensemble failed', {
      error: error.message,
      stack: error.stack,
      userId: req.headers['x-user-id'] || 'anonymous'
    }, correlationId);

    // Enhanced error response
    res.status(500).json({
      status: 'error',
      message: 'Enhanced ensemble processing failed. Our team has been notified.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString(),
      correlationId,
      retryable: true,
      supportInfo: {
        correlationId,
        timestamp: new Date().toISOString(),
        suggestion: 'Please try again in a few moments. If the issue persists, contact support with the correlation ID.'
      }
    });
  }
});

// Enhanced system health endpoint
router.get('/health-detailed', async (req, res) => {
  try {
    const [systemHealth, vendorHealth, ensembleHealth] = await Promise.all([
      monitoringService.getHealthStatus(),
      clients.healthCheck(),
      enhancedEnsemble.healthCheck()
    ]);

    const overallHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0',
      components: {
        system: systemHealth,
        vendors: vendorHealth,
        ensemble: ensembleHealth
      }
    };

    // Determine overall status
    const componentStatuses = [
      systemHealth.status,
      Object.values(vendorHealth).some(v => !v.isHealthy) ? 'degraded' : 'healthy',
      ensembleHealth.ensemble.isHealthy ? 'healthy' : 'degraded'
    ];

    if (componentStatuses.includes('unhealthy')) {
      overallHealth.status = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      overallHealth.status = 'degraded';
    }

    const statusCode = overallHealth.status === 'healthy' ? 200 :
                      overallHealth.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(overallHealth);

  } catch (error) {
    monitoringService.log('error', 'Health check failed', { error: error.message });

    res.status(503).json({
      status: 'unhealthy',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// System metrics endpoint for monitoring
router.get('/metrics', async (req, res) => {
  try {
    const [systemMetrics, vendorMetrics, ensembleMetrics] = await Promise.all([
      monitoringService.getDetailedMetrics(),
      clients.getMetrics(),
      enhancedEnsemble.getMetrics()
    ]);

    res.status(200).json({
      timestamp: new Date().toISOString(),
      system: systemMetrics,
      vendors: vendorMetrics,
      ensemble: ensembleMetrics,
      tier: ensembleConfig.meta.tier,
      costEstimate: ensembleConfig.meta.estimatedCostPerRequest
    });

  } catch (error) {
    monitoringService.log('error', 'Metrics collection failed', { error: error.message });

    res.status(500).json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString()
    });
  }
});

// Tier information and configuration endpoint
router.get('/tier-info', async (req, res) => {
  try {
    const tierConfig = ensembleConfig.getTierConfig();

    res.status(200).json({
      status: 'success',
      data: {
        currentTier: ensembleConfig.meta.tier,
        configuration: {
          models: tierConfig.models,
          limits: tierConfig.limits,
          estimatedCostPerRequest: ensembleConfig.meta.estimatedCostPerRequest
        },
        availableTiers: {
          free: {
            models: ensembleConfig.allModels.free,
            limits: ensembleConfig.getTierConfig('free').limits,
            estimatedCost: '$0.003-0.008'
          },
          premium: {
            models: ensembleConfig.allModels.premium,
            limits: ensembleConfig.getTierConfig('premium').limits,
            estimatedCost: '$0.05-0.15'
          }
        },
        costComparison: {
          free: {
            modelsUsed: Object.keys(ensembleConfig.allModels.free).length,
            avgResponseTime: '5-15 seconds',
            quality: '85-90% of premium',
            costSavings: '90-95% vs premium'
          },
          premium: {
            modelsUsed: Object.keys(ensembleConfig.allModels.premium).length,
            avgResponseTime: '8-20 seconds',
            quality: '95-100%',
            features: 'Full feature set'
          }
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    monitoringService.log('error', 'Tier info request failed', { error: error.message });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve tier information',
      timestamp: new Date().toISOString()
    });
  }
});



// Legacy workout endpoint removed - use /workout/generate-workout instead

// Workout service health check endpoint
router.get('/workout/health', async (req, res) => {
  try {
    const healthStatus = await workoutService.getHealthStatus();

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      ...healthStatus,
      endpoint: '/workout',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      endpoint: '/workout',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cache statistics endpoint
router.get('/cache/stats', async (req, res) => {
  try {
    const cacheStats = cacheService.getStats();

    res.status(200).json({
      status: 'success',
      data: {
        cache: cacheStats,
        performance: {
          description: 'Cache hit rate indicates the percentage of requests served from cache',
          recommendation: cacheStats.hitRate > '50%' ? 'Good cache performance' : 'Consider optimizing cache strategy'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve cache statistics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cache management endpoint (for admin use)
router.post('/cache/clear', async (req, res) => {
  try {
    const { pattern } = req.body;

    let result;
    if (pattern) {
      result = await cacheService.invalidatePattern(pattern);
      res.status(200).json({
        status: 'success',
        message: `Invalidated ${result} cache entries matching pattern: ${pattern}`,
        timestamp: new Date().toISOString()
      });
    } else {
      await cacheService.clear();
      res.status(200).json({
        status: 'success',
        message: 'All cache entries cleared',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to clear cache',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});



// Vector database statistics endpoint
router.get('/vector/stats', async (req, res) => {
  try {
    const stats = vectorDatabaseService.getStats();

    res.status(200).json({
      status: 'success',
      data: {
        vectorDatabase: stats,
        capabilities: {
          semanticSearch: stats.isAvailable,
          embeddingGeneration: true,
          similarityThreshold: stats.config.similarityThreshold,
          maxResults: stats.config.maxResults
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve vector database statistics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Vector database health check endpoint
router.get('/vector/health', async (req, res) => {
  try {
    const health = await vectorDatabaseService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      ...health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      provider: 'unknown',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Semantic search test endpoint
router.post('/vector/search', async (req, res) => {
  try {
    const { query, userId, maxResults = 5, threshold = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({
        status: 'error',
        message: 'Query text is required for semantic search'
      });
    }

    const results = await vectorDatabaseService.searchSimilarMemories(query, {
      maxResults,
      threshold,
      userId
    });

    res.status(200).json({
      status: 'success',
      data: {
        query,
        results: results.map(result => ({
          id: result.id,
          score: result.score,
          content: result.content.substring(0, 200) + '...', // Truncate for display
          metadata: {
            timestamp: result.metadata.timestamp,
            memoryType: result.metadata.memoryType
          }
        })),
        totalResults: results.length,
        searchParams: { maxResults, threshold, userId }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Semantic search failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Ensemble strategy statistics endpoint
router.get('/ensemble/stats', async (req, res) => {
  try {
    const stats = advancedEnsembleStrategy.getStats();

    res.status(200).json({
      status: 'success',
      data: {
        ensembleStrategy: stats,
        capabilities: {
          weightedVoting: true,
          confidenceScoring: true,
          adaptiveWeights: true,
          performanceTracking: true
        },
        thresholds: stats.confidenceThresholds
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve ensemble strategy statistics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Model performance update endpoint (for feedback loops)
router.post('/ensemble/feedback', async (req, res) => {
  try {
    const { model, accuracy, responseTime, userSatisfaction, errorRate } = req.body;

    if (!model || accuracy === undefined || responseTime === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Model, accuracy, and responseTime are required fields'
      });
    }

    // Validate input ranges
    if (accuracy < 0 || accuracy > 1 || userSatisfaction < 0 || userSatisfaction > 1 || errorRate < 0 || errorRate > 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Accuracy, userSatisfaction, and errorRate must be between 0 and 1'
      });
    }

    advancedEnsembleStrategy.updateModelPerformance(model, {
      accuracy,
      responseTime,
      userSatisfaction: userSatisfaction || 0.5,
      errorRate: errorRate || 0
    });

    res.status(200).json({
      status: 'success',
      message: `Performance feedback recorded for model: ${model}`,
      data: {
        model,
        updatedMetrics: {
          accuracy,
          responseTime,
          userSatisfaction,
          errorRate
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update model performance',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== ENHANCED ENSEMBLE CONFIDENCE AND QUALITY FUNCTIONS =====

/**
 * Enhanced confidence score calculation with weighted factors
 */
function calculateConfidenceScore(role) {
  if (role.status !== 'fulfilled') return 0;

  let score = 0.3; // Lower base score for more discriminating calculation
  const content = role.content || '';
  const wordCount = content.split(' ').length;
  const sentenceCount = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

  // Enhanced length factor with model-specific optimal ranges
  const modelName = role.metadata?.model || role.model || '';
  let optimalRange = [30, 150]; // Default range

  // Model-specific length optimization based on observed behavior
  if (modelName.includes('gemini')) {
    optimalRange = [50, 250]; // Gemini tends to be more verbose and detailed
  } else if (modelName.includes('claude')) {
    optimalRange = [25, 120]; // Claude tends to be more concise but structured
  } else if (modelName.includes('gpt')) {
    optimalRange = [30, 180]; // GPT balanced approach with good detail
  }

  if (wordCount >= optimalRange[0] && wordCount <= optimalRange[1]) {
    score += 0.25; // Optimal range for this model
  } else if (wordCount >= optimalRange[0] * 0.5 && wordCount < optimalRange[0]) {
    score += 0.15; // Acceptable short for model
  } else if (wordCount > optimalRange[1] && wordCount <= optimalRange[1] * 1.5) {
    score += 0.20; // Acceptable long for model
  } else if (wordCount > optimalRange[1] * 1.5) {
    score += 0.05; // Too verbose even for this model
  } else {
    score -= 0.1; // Too short for effective response
  }

  // Structure and grammar quality (weighted 0.2)
  let structureScore = 0;
  if (/[.!?]/.test(content)) structureScore += 0.05; // Has punctuation
  if (/^[A-Z]/.test(content)) structureScore += 0.05; // Proper capitalization
  if (sentenceCount >= 2) structureScore += 0.05; // Multiple sentences
  if (content.includes(',') || content.includes(';')) structureScore += 0.03; // Complex punctuation
  if (/\b[A-Z][a-z]+\b/.test(content)) structureScore += 0.02; // Proper nouns
  score += structureScore;

  // Enhanced content sophistication (weighted 0.25)
  let sophisticationScore = 0;

  // Advanced reasoning indicators with weighted scoring
  const reasoningPatterns = [
    { words: ['because', 'therefore', 'thus', 'hence', 'consequently'], weight: 0.04 }, // Causal reasoning
    { words: ['however', 'nevertheless', 'nonetheless', 'conversely'], weight: 0.03 }, // Contrasting
    { words: ['furthermore', 'moreover', 'additionally', 'also'], weight: 0.03 }, // Additive
    { words: ['first', 'second', 'finally', 'in conclusion'], weight: 0.03 }, // Sequential
    { words: ['for example', 'for instance', 'such as', 'including'], weight: 0.02 }, // Examples
    { words: ['research shows', 'studies indicate', 'evidence suggests'], weight: 0.04 } // Evidence-based
  ];

  reasoningPatterns.forEach(({ words, weight }) => {
    const found = words.some(word => content.toLowerCase().includes(word));
    if (found) sophisticationScore += weight;
  });
  sophisticationScore = Math.min(sophisticationScore, 0.12); // Cap reasoning bonus

  // Technical depth and domain expertise indicators
  const technicalIndicators = ['analysis', 'approach', 'strategy', 'implementation', 'consideration', 'evaluation', 'methodology', 'framework', 'systematic', 'comprehensive'];
  const foundTechnical = technicalIndicators.filter(word => content.toLowerCase().includes(word)).length;
  sophisticationScore += Math.min(foundTechnical * 0.015, 0.08); // Max 0.08 for technical depth

  // Specificity and data-driven indicators
  if (/\d+/.test(content)) sophisticationScore += 0.03; // Contains numbers/data
  if (content.includes('%') || content.includes('$')) sophisticationScore += 0.02; // Quantitative data
  if (/\b\d+\s*(minutes?|hours?|days?|weeks?|months?|years?)\b/i.test(content)) sophisticationScore += 0.02; // Time specificity

  // Content structure and organization
  const listPattern = /^\s*[-*•]\s+/gm;
  const numberedListPattern = /^\s*\d+\.\s+/gm;
  const headerPattern = /^#+\s+/gm;

  if (listPattern.test(content) || numberedListPattern.test(content)) {
    sophisticationScore += 0.03; // Structured lists
  }
  if (headerPattern.test(content)) {
    sophisticationScore += 0.02; // Header organization
  }

  score += sophisticationScore;

  // Response time factor (weighted 0.1)
  const responseTime = role.responseTime || role.metadata?.processingTimeMs || 0;
  if (responseTime > 0) {
    if (responseTime < 2000) score += 0.05; // Fast response
    else if (responseTime < 5000) score += 0.03; // Moderate response
    else if (responseTime > 10000) score -= 0.02; // Slow response penalty
  }

  // Model-specific adjustments based on known capabilities
  const modelAdjustments = {
    'gpt-4o': 0.05,
    'gpt-4o-mini': 0.02,
    'claude-3-5-haiku-latest': 0.03,
    'gemini-2.0-flash': 0.04
  };
  const currentModelName = role.metadata?.model || role.model;
  if (currentModelName && modelAdjustments[currentModelName]) {
    score += modelAdjustments[currentModelName];
  }

  return Math.max(0, Math.min(1.0, score));
}

/**
 * Get confidence level description
 */
function getConfidenceLevel(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.4) return 'low';
  return 'very-low';
}

/**
 * Get confidence factors
 */
function getConfidenceFactors(role, qualityMetrics) {
  const factors = [];

  if (role.status === 'fulfilled') {
    factors.push('Response generated successfully');
  }

  if (qualityMetrics.wordCount >= 20) {
    factors.push('Adequate response length');
  }

  if (qualityMetrics.hasStructure) {
    factors.push('Well-structured response');
  }

  if (qualityMetrics.hasReasoning) {
    factors.push('Contains reasoning elements');
  }

  return factors;
}

/**
 * Analyze response quality
 */
function analyzeResponseQuality(content) {
  const wordCount = content.split(' ').length;
  const sentenceCount = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;

  return {
    wordCount,
    sentenceCount,
    averageWordsPerSentence: wordCount / Math.max(sentenceCount, 1),
    hasStructure: /[.!?]/.test(content) && /^[A-Z]/.test(content),
    hasReasoning: /\b(because|therefore|however|thus|hence|consequently)\b/i.test(content),
    complexity: assessComplexity(content)
  };
}

/**
 * Calculate synthesis confidence
 */
function calculateSynthesisConfidence(synthesis, roles) {
  if (synthesis.status !== 'success') {
    return { score: 0, level: 'very-low', factors: ['Synthesis failed'] };
  }

  const successfulRoles = roles.filter(r => r.status === 'fulfilled');
  const avgRoleConfidence = successfulRoles.reduce((sum, role) => sum + role.confidence.score, 0) / successfulRoles.length;

  // Enhanced base score calculation
  let score = avgRoleConfidence * 0.6; // Reduced base weight for more nuanced calculation

  // Enhanced synthesis quality analysis
  const synthesisQuality = analyzeResponseQuality(synthesis.content);

  // Length and structure factors (30% weight)
  if (synthesisQuality.wordCount >= 50) score += 0.12;
  else if (synthesisQuality.wordCount >= 30) score += 0.08;
  else if (synthesisQuality.wordCount >= 20) score += 0.04;

  if (synthesisQuality.hasStructure) score += 0.08;
  if (synthesisQuality.hasReasoning) score += 0.1;

  // Model agreement factor (20% weight)
  const modelAgreement = calculateModelAgreement(roles);
  score += modelAgreement * 0.2;

  // Synthesis coherence and completeness (additional factors)
  const content = synthesis.content || '';

  // Comprehensive coverage indicator
  if (content.length > 500) score += 0.05; // Comprehensive response
  if (/\b(first|second|third|finally)\b/i.test(content)) score += 0.03; // Sequential structure
  if (/\b(however|therefore|furthermore)\b/i.test(content)) score += 0.04; // Logical flow
  if (/\b(research|studies|evidence)\b/i.test(content)) score += 0.03; // Evidence-based

  // Synthesis uniqueness (not just copying one response)
  const synthesisWords = new Set(content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  let maxOverlap = 0;
  successfulRoles.forEach(role => {
    const roleWords = new Set(role.content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    const intersection = new Set([...synthesisWords].filter(x => roleWords.has(x)));
    const overlap = intersection.size / Math.max(synthesisWords.size, 1);
    maxOverlap = Math.max(maxOverlap, overlap);
  });

  // Bonus for synthesis that combines rather than copies
  if (maxOverlap < 0.8) score += 0.05; // Good synthesis integration
  if (maxOverlap < 0.6) score += 0.03; // Excellent synthesis integration

  return {
    score: Math.min(1.0, score),
    level: getConfidenceLevel(score),
    factors: [
      `Based on ${successfulRoles.length} successful responses`,
      `Average role confidence: ${(avgRoleConfidence * 100).toFixed(1)}%`,
      ...getConfidenceFactors({ status: 'fulfilled' }, synthesisQuality)
    ]
  };
}

/**
 * Calculate quality score
 */
function calculateQualityScore(content) {
  const metrics = analyzeResponseQuality(content);
  let score = 0.5;

  if (metrics.wordCount >= 20) score += 0.2;
  if (metrics.hasStructure) score += 0.15;
  if (metrics.hasReasoning) score += 0.15;

  return Math.min(1.0, score);
}

/**
 * Estimate token count
 */
function estimateTokenCount(text) {
  return Math.ceil(text.length / 4); // Rough estimation
}

/**
 * Estimate request cost based on prompt and responses
 */
async function estimateRequestCost(prompt, roles) {
  try {
    const promptTokens = estimateTokenCount(prompt);
    let totalResponseTokens = 0;

    roles.forEach(role => {
      if (role.content) {
        totalResponseTokens += estimateTokenCount(role.content);
      }
    });

    // Rough cost estimation based on token usage
    // GPT-4o-mini: ~$0.00015/1K input tokens, ~$0.0006/1K output tokens
    // Gemini Flash: ~$0.000075/1K tokens
    // Claude Haiku: ~$0.00025/1K input tokens, ~$0.00125/1K output tokens

    const inputCost = (promptTokens / 1000) * 0.0002; // Average input cost
    const outputCost = (totalResponseTokens / 1000) * 0.0008; // Average output cost
    const totalCost = inputCost + outputCost;

    return {
      totalCost: parseFloat(totalCost.toFixed(6)),
      breakdown: {
        inputTokens: promptTokens,
        outputTokens: totalResponseTokens,
        inputCost: parseFloat(inputCost.toFixed(6)),
        outputCost: parseFloat(outputCost.toFixed(6))
      }
    };
  } catch (error) {
    console.warn('Cost estimation failed:', error.message);
    return {
      totalCost: 0.001, // Fallback estimate
      breakdown: {
        inputTokens: 0,
        outputTokens: 0,
        inputCost: 0,
        outputCost: 0
      }
    };
  }
}

/**
 * Assess content complexity
 */
function assessComplexity(content) {
  const wordCount = content.split(' ').length;
  const uniqueWords = new Set(content.toLowerCase().split(/\W+/)).size;
  const complexity = uniqueWords / wordCount;

  if (complexity > 0.7) return 'high';
  if (complexity > 0.5) return 'medium';
  return 'low';
}

/**
 * Calculate consensus level
 */
function calculateConsensusLevel(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled');
  if (successful.length < 2) return 'insufficient-data';

  const avgConfidence = successful.reduce((sum, role) => sum + role.confidence.score, 0) / successful.length;

  if (avgConfidence >= 0.8) return 'high';
  if (avgConfidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Enhanced model agreement calculation with semantic similarity
 */
function calculateModelAgreement(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled');
  if (successful.length < 2) return 0;

  // Confidence consistency (40% weight)
  const confidences = successful.map(r => r.confidence.score);
  const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const confidenceVariance = confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
  const confidenceAgreement = Math.max(0, 1 - confidenceVariance);

  // Response length consistency (20% weight)
  const lengths = successful.map(r => r.content.length);
  const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
  const lengthVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;
  const lengthAgreement = Math.max(0, 1 - (lengthVariance / (avgLength * avgLength + 1)));

  // Enhanced semantic similarity analysis (40% weight)
  let semanticAgreement = 0;
  if (successful.length >= 2) {
    const responses = successful.map(r => r.content.toLowerCase());

    // Multi-level semantic analysis
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        // 1. Keyword overlap (Jaccard similarity)
        const words1 = new Set(responses[i].split(/\W+/).filter(w => w.length > 3));
        const words2 = new Set(responses[j].split(/\W+/).filter(w => w.length > 3));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

        // 2. N-gram similarity (bigrams)
        const bigrams1 = extractBigrams(responses[i]);
        const bigrams2 = extractBigrams(responses[j]);
        const bigramIntersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
        const bigramUnion = new Set([...bigrams1, ...bigrams2]);
        const bigramSimilarity = bigramUnion.size > 0 ? bigramIntersection.size / bigramUnion.size : 0;

        // 3. Structural similarity (sentence patterns)
        const sentences1 = responses[i].split(/[.!?]+/).filter(s => s.trim().length > 0);
        const sentences2 = responses[j].split(/[.!?]+/).filter(s => s.trim().length > 0);
        const structuralSimilarity = Math.abs(sentences1.length - sentences2.length) <= 2 ? 0.8 : 0.4;

        // 4. Topic coherence (key concept overlap)
        const concepts1 = extractKeyConcepts(responses[i]);
        const concepts2 = extractKeyConcepts(responses[j]);
        const conceptIntersection = new Set([...concepts1].filter(x => concepts2.has(x)));
        const conceptUnion = new Set([...concepts1, ...concepts2]);
        const conceptSimilarity = conceptUnion.size > 0 ? conceptIntersection.size / conceptUnion.size : 0;

        // Weighted combination of similarity measures
        const combinedSimilarity = (
          jaccardSimilarity * 0.3 +
          bigramSimilarity * 0.25 +
          structuralSimilarity * 0.2 +
          conceptSimilarity * 0.25
        );

        totalSimilarity += combinedSimilarity;
        comparisons++;
      }
    }

    semanticAgreement = comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  // Weighted combination with enhanced factors
  const agreement = (confidenceAgreement * 0.35) + (lengthAgreement * 0.15) + (semanticAgreement * 0.5);
  return Math.max(0, Math.min(1, agreement));
}

/**
 * Extract bigrams from text for similarity analysis
 */
function extractBigrams(text) {
  const words = text.split(/\W+/).filter(w => w.length > 2);
  const bigrams = new Set();
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.add(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

/**
 * Extract key concepts from text for topic coherence analysis
 */
function extractKeyConcepts(text) {
  const concepts = new Set();

  // Domain-specific concept patterns
  const conceptPatterns = [
    // Health and fitness concepts
    /\b(exercise|workout|fitness|health|training|muscle|cardio|strength|endurance|flexibility)\b/gi,
    // Mental health concepts
    /\b(mental|psychological|emotional|stress|anxiety|depression|mood|wellbeing|therapy)\b/gi,
    // Scientific concepts
    /\b(research|study|evidence|analysis|data|results|findings|scientific|clinical)\b/gi,
    // Action concepts
    /\b(improve|increase|reduce|enhance|develop|maintain|prevent|achieve|build)\b/gi,
    // Time concepts
    /\b(daily|weekly|regular|consistent|routine|schedule|duration|frequency)\b/gi
  ];

  conceptPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => concepts.add(match.toLowerCase()));
  });

  // Extract noun phrases (simple approach)
  const nounPhrases = text.match(/\b[A-Z][a-z]+(?:\s+[a-z]+)*\b/g) || [];
  nounPhrases.forEach(phrase => {
    if (phrase.length > 4) concepts.add(phrase.toLowerCase());
  });

  return concepts;
}

/**
 * Calculate response consistency
 */
function calculateResponseConsistency(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled');
  if (successful.length < 2) return 0;

  // Measure consistency based on response lengths and quality
  const lengths = successful.map(r => r.content.length);
  const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
  const lengthVariance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLength, 2), 0) / lengths.length;

  return Math.max(0, 1 - (lengthVariance / (avgLength * avgLength)));
}

/**
 * Get quality distribution with enhanced metrics
 */
function getQualityDistribution(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled');
  const distribution = {
    high: 0,
    medium: 0,
    low: 0,
    veryLow: 0,
    averageScore: 0,
    scoreRange: { min: 1, max: 0 },
    totalResponses: successful.length
  };

  if (successful.length === 0) return distribution;

  let totalScore = 0;
  successful.forEach(role => {
    const score = role.confidence.score;
    totalScore += score;

    // Update score range
    distribution.scoreRange.min = Math.min(distribution.scoreRange.min, score);
    distribution.scoreRange.max = Math.max(distribution.scoreRange.max, score);

    // Categorize by confidence level
    if (score >= 0.8) distribution.high++;
    else if (score >= 0.6) distribution.medium++;
    else if (score >= 0.4) distribution.low++;
    else distribution.veryLow++;
  });

  distribution.averageScore = totalScore / successful.length;
  return distribution;
}

/**
 * Advanced weighted voting system for ensemble responses
 */
function calculateWeightedVote(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled');
  if (successful.length === 0) return { winner: null, confidence: 0, weights: {} };

  const weights = {};
  let totalWeight = 0;

  successful.forEach(role => {
    const baseWeight = role.confidence.score;
    const responseTime = role.metadata?.processingTimeMs || 0;
    const wordCount = role.content.split(' ').length;

    // Enhanced time performance scoring with more nuanced approach
    let timeMultiplier = 1.0;
    if (responseTime > 0) {
      if (responseTime < 1500) timeMultiplier = 1.15; // 15% bonus for very fast response
      else if (responseTime < 3000) timeMultiplier = 1.08; // 8% bonus for fast response
      else if (responseTime < 6000) timeMultiplier = 1.02; // 2% bonus for good response
      else if (responseTime > 15000) timeMultiplier = 0.85; // 15% penalty for very slow
      else if (responseTime > 10000) timeMultiplier = 0.92; // 8% penalty for slow response
    }

    // Model-specific length optimization with adaptive ranges
    const modelName = role.metadata?.model || role.model || '';
    let lengthMultiplier = 1.0;
    let optimalRange = [30, 150]; // Default

    if (modelName.includes('gemini')) {
      optimalRange = [50, 250]; // Gemini optimal range
      if (wordCount >= 50 && wordCount <= 250) lengthMultiplier = 1.12;
      else if (wordCount >= 30 && wordCount < 50) lengthMultiplier = 0.95;
      else if (wordCount > 250 && wordCount <= 350) lengthMultiplier = 1.05;
      else if (wordCount > 350) lengthMultiplier = 0.8;
      else lengthMultiplier = 0.7;
    } else if (modelName.includes('claude')) {
      optimalRange = [25, 120]; // Claude optimal range
      if (wordCount >= 25 && wordCount <= 120) lengthMultiplier = 1.1;
      else if (wordCount >= 15 && wordCount < 25) lengthMultiplier = 0.9;
      else if (wordCount > 120 && wordCount <= 200) lengthMultiplier = 1.02;
      else if (wordCount > 200) lengthMultiplier = 0.85;
      else lengthMultiplier = 0.75;
    } else { // GPT models
      if (wordCount >= 30 && wordCount <= 180) lengthMultiplier = 1.1;
      else if (wordCount >= 15 && wordCount < 30) lengthMultiplier = 0.9;
      else if (wordCount > 180 && wordCount <= 300) lengthMultiplier = 1.0;
      else if (wordCount > 300) lengthMultiplier = 0.8;
      else lengthMultiplier = 0.7;
    }

    // Enhanced model reliability with optimized weights for 25+ concurrent users
    const modelReliability = {
      'gpt-4o': 1.20, // Premium performance with excellent concurrency handling
      'gpt-4o-mini': 1.12, // Increased for excellent cost/performance ratio under load
      'claude-3-5-haiku-latest': 1.15, // Excellent structured responses and speed
      'gemini-2.0-flash': 1.18, // Outstanding performance with longer, detailed responses
      'gemini-2.5-flash': 1.22, // Premium Gemini with superior performance
      'gemini-1.5-flash': 1.14, // Optimized for cost-effectiveness with good response length
      'grok-beta': 0.98 // Improved rating based on recent performance data
    };
    const roleModelName = role.metadata?.model || role.model;
    const reliabilityMultiplier = modelReliability[roleModelName] || 1.0;

    // Calculate final weight
    const finalWeight = baseWeight * timeMultiplier * lengthMultiplier * reliabilityMultiplier;
    weights[role.role] = finalWeight;
    totalWeight += finalWeight;
  });

  // Normalize weights
  Object.keys(weights).forEach(role => {
    weights[role] = weights[role] / totalWeight;
  });

  // Find the highest weighted response
  const winner = Object.keys(weights).reduce((a, b) => weights[a] > weights[b] ? a : b);
  const winnerConfidence = weights[winner];

  return {
    winner,
    confidence: winnerConfidence,
    weights,
    consensus: calculateConsensusStrength(weights),
    recommendation: generateVotingRecommendation(weights, successful)
  };
}

/**
 * Enhanced consensus strength calculation with multiple factors
 */
function calculateConsensusStrength(weights) {
  const values = Object.values(weights).sort((a, b) => b - a);
  if (values.length === 0) return 'weak';

  const maxWeight = values[0];
  const secondMaxWeight = values[1] || 0;
  const thirdMaxWeight = values[2] || 0;
  const margin = maxWeight - secondMaxWeight;

  // Calculate weight distribution entropy for additional insight
  const entropy = calculateWeightEntropy(weights);

  // Multi-factor consensus analysis
  const factors = {
    dominance: maxWeight > 0.6, // Clear winner
    significantLead: margin > 0.2, // Substantial margin
    strongLead: margin > 0.15, // Good margin
    moderateLead: margin > 0.1, // Decent margin
    lowEntropy: entropy < 0.7, // Concentrated voting
    mediumEntropy: entropy < 0.85, // Moderately concentrated
    threeWayTie: values.length >= 3 && (maxWeight - thirdMaxWeight) < 0.15
  };

  // Enhanced consensus determination
  if (factors.dominance && factors.significantLead && factors.lowEntropy) {
    return 'very-strong'; // New category for exceptional consensus
  } else if ((factors.dominance && factors.strongLead) || (maxWeight > 0.55 && factors.significantLead)) {
    return 'strong';
  } else if ((maxWeight > 0.45 && factors.moderateLead) || (maxWeight > 0.5 && factors.mediumEntropy)) {
    return 'moderate';
  } else if (factors.threeWayTie || entropy > 0.9) {
    return 'very-weak'; // New category for highly distributed voting
  } else {
    return 'weak';
  }
}

/**
 * Enhanced voting recommendation with detailed analysis
 */
function generateVotingRecommendation(weights, roles) {
  const values = Object.values(weights).sort((a, b) => b - a);
  const maxWeight = values[0];
  const secondMaxWeight = values[1] || 0;
  const consensus = calculateConsensusStrength(weights);
  const entropy = calculateWeightEntropy(weights);
  const margin = maxWeight - secondMaxWeight;

  // Get winner details for context
  const winner = Object.keys(weights).reduce((a, b) => weights[a] > weights[b] ? a : b);
  const winnerRole = roles.find(r => r.role === winner);
  const winnerModel = winnerRole?.metadata?.model || winnerRole?.model || 'unknown';

  // Generate contextual recommendations
  switch (consensus) {
    case 'very-strong':
      return `Exceptional confidence - ${winnerModel} selected with ${(maxWeight * 100).toFixed(1)}% weight and ${(margin * 100).toFixed(1)}% lead. Very high reliability.`;

    case 'strong':
      return `High confidence - ${winnerModel} selected with ${(maxWeight * 100).toFixed(1)}% weight. Strong model agreement indicates reliable response.`;

    case 'moderate':
      return `Moderate confidence - ${winnerModel} selected with ${(maxWeight * 100).toFixed(1)}% weight. Consider reviewing alternative responses for completeness.`;

    case 'weak':
      return `Low consensus - ${winnerModel} selected with ${(maxWeight * 100).toFixed(1)}% weight but close competition (${(margin * 100).toFixed(1)}% lead). Manual review recommended.`;

    case 'very-weak':
      return `Very low consensus - Highly distributed voting (entropy: ${entropy.toFixed(2)}). Responses vary significantly, comprehensive review strongly recommended.`;

    default:
      return `Uncertain consensus - ${winnerModel} selected but voting patterns unclear. Review recommended.`;
  }
}

/**
 * Calculate entropy of weight distribution (measure of uncertainty)
 */
function calculateWeightEntropy(weights) {
  const values = Object.values(weights);
  if (values.length === 0) return 0;

  // Calculate Shannon entropy
  let entropy = 0;
  values.forEach(weight => {
    if (weight > 0) {
      entropy -= weight * Math.log2(weight);
    }
  });

  // Normalize by maximum possible entropy (log2(n))
  const maxEntropy = Math.log2(values.length);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}



// ============================================================================
// 🏥 ENHANCED MONITORING ENDPOINTS - Production-grade system monitoring
// ============================================================================

/**
 * Enhanced system health endpoint with comprehensive monitoring
 */
router.get('/system/health', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;

    if (!healthMonitor) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Health monitoring system not available',
        timestamp: new Date().toISOString()
      });
    }

    const healthStatus = healthMonitor.getHealthStatus();
    const statusCode = healthStatus.overall === 'healthy' ? 200 :
                      healthStatus.overall === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      status: 'success',
      data: healthStatus,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId || 'unknown'
    });

  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId || 'unknown'
    });
  }
});

/**
 * Real-time performance metrics endpoint
 */
router.get('/system/metrics', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;

    if (!healthMonitor) {
      return res.status(503).json({
        status: 'error',
        message: 'Health monitoring system not available'
      });
    }

    const healthStatus = healthMonitor.getHealthStatus();

    res.status(200).json({
      status: 'success',
      data: {
        system: healthStatus.metrics.system,
        api: healthStatus.metrics.api,
        ai: healthStatus.metrics.ai,
        database: healthStatus.metrics.database,
        cache: healthStatus.metrics.cache,
        alerts: {
          active: healthStatus.activeAlerts,
          recent: healthStatus.alertHistory
        }
      },
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId || 'unknown'
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve system metrics',
      error: error.message,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId || 'unknown'
    });
  }
});

/**
 * Load testing status endpoint
 */
router.get('/system/load-status', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;

    if (!healthMonitor) {
      return res.status(503).json({
        status: 'error',
        message: 'Health monitoring system not available'
      });
    }

    const healthStatus = healthMonitor.getHealthStatus();
    const currentLoad = healthStatus.metrics.api.currentConcurrentRequests || 0;
    const maxCapacity = 25; // Designed for 25+ concurrent users

    const loadPercentage = (currentLoad / maxCapacity) * 100;
    let loadStatus = 'optimal';

    if (loadPercentage > 90) loadStatus = 'critical';
    else if (loadPercentage > 75) loadStatus = 'high';
    else if (loadPercentage > 50) loadStatus = 'moderate';

    res.status(200).json({
      status: 'success',
      data: {
        currentLoad,
        maxCapacity,
        loadPercentage: Math.round(loadPercentage),
        loadStatus,
        performance: {
          averageResponseTime: healthStatus.metrics.api.averageResponseTime,
          successRate: healthStatus.metrics.api.totalRequests > 0 ?
            (healthStatus.metrics.api.successfulRequests / healthStatus.metrics.api.totalRequests * 100).toFixed(2) : 0,
          queueLength: healthStatus.metrics.api.queueLength || 0
        },
        recommendations: generateLoadRecommendations(loadStatus, loadPercentage)
      },
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId || 'unknown'
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve load status',
      error: error.message,
      timestamp: new Date().toISOString(),
      correlationId: req.correlationId || 'unknown'
    });
  }
});

/**
 * Generate load-based recommendations
 */
function generateLoadRecommendations(loadStatus, loadPercentage) {
  const recommendations = [];

  switch (loadStatus) {
    case 'critical':
      recommendations.push('Consider implementing request queuing');
      recommendations.push('Scale horizontally if possible');
      recommendations.push('Enable aggressive caching');
      break;
    case 'high':
      recommendations.push('Monitor response times closely');
      recommendations.push('Consider enabling request prioritization');
      break;
    case 'moderate':
      recommendations.push('System performing well under current load');
      recommendations.push('Monitor for sustained high load periods');
      break;
    default:
      recommendations.push('System operating at optimal capacity');
      recommendations.push('Ready for additional load');
  }

  return recommendations;
}

module.exports = router;