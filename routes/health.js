const express = require('express');
const axios = require('axios');
const router = express.Router();
const openai = require('../config/openai');
const { testPrompt } = require('../config/prompts');
const enhancedEnsemble = require('../services/enhancedEnsembleRunner');
const monitoringService = require('../services/monitoringService');
const clients = require('../services/vendorClients');
const ensembleConfig = require('../config/ensemblePrompts');
const workoutService = require('../services/workoutService');
const cacheService = require('../services/cacheService');
const costMonitoringService = require('../services/costMonitoringService');
const securityMiddleware = require('../middleware/securityMiddleware');

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Neurastack backend healthy 🚀' });
});

router.get('/openai-test', async (req, res) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: testPrompt }],
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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
      model: 'gemini-2.0-flash',
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
        model: 'claude-opus-4-20250514',
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
    // Input validation
    const prompt = req.body?.prompt || 'Quick sanity check: explain AI in 1-2 lines.';
    const userId = req.headers['x-user-id'] || req.userId || 'anonymous';
    const userTier = req.userTier || 'free';
    const sessionId = req.body?.sessionId || req.headers['x-session-id'] || `session_${userId}_${Date.now()}`;

    // Check rate limits for free tier
    if (userTier === 'free') {
      try {
        // Simple rate limiting check
        const rateLimitResult = securityMiddleware.checkRateLimit(userId, 'ensemble');
        if (!rateLimitResult.allowed) {
          return res.status(429).json({
            status: 'error',
            message: 'Rate limit exceeded',
            details: rateLimitResult.message,
            retryAfter: rateLimitResult.retryAfter || 60,
            timestamp: new Date().toISOString(),
            correlationId
          });
        }
      } catch (rateLimitError) {
        return res.status(429).json({
          status: 'error',
          message: 'Rate limit exceeded',
          details: rateLimitError.message,
          retryAfter: rateLimitError.retryAfter || 60,
          timestamp: new Date().toISOString(),
          correlationId
        });
      }
    }

    // Validate prompt length
    if (prompt.length > 5000) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt too long. Maximum 5000 characters allowed.',
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    monitoringService.log('info', 'Enhanced ensemble request started', {
      userId,
      sessionId,
      promptLength: prompt.length
    }, correlationId);

    // Execute enhanced ensemble with comprehensive error handling
    const ensembleResult = await enhancedEnsemble.runEnsemble(prompt, userId, sessionId);

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

    // Calculate synthesis confidence
    const synthesisConfidence = calculateSynthesisConfidence(ensembleResult.synthesis, enhancedRoles);

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
          qualityScore: calculateQualityScore(ensembleResult.synthesis.content),
          metadata: {
            basedOnResponses: enhancedRoles.length,
            averageConfidence: enhancedRoles.reduce((sum, role) => sum + role.confidence.score, 0) / enhancedRoles.length,
            consensusLevel: calculateConsensusLevel(enhancedRoles)
          }
        },
        roles: enhancedRoles,
        metadata: {
          ...ensembleResult.metadata,
          timestamp: new Date().toISOString(),
          version: '3.0',
          correlationId,
          confidenceAnalysis: {
            overallConfidence: synthesisConfidence.score,
            modelAgreement: calculateModelAgreement(enhancedRoles),
            responseConsistency: calculateResponseConsistency(enhancedRoles),
            qualityDistribution: getQualityDistribution(enhancedRoles)
          },
          costEstimate: await estimateRequestCost(prompt, enhancedRoles)
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

// Cost estimation endpoint
router.post('/estimate-cost', async (req, res) => {
  try {
    const { prompt, tier } = req.body;

    if (!prompt) {
      return res.status(400).json({
        status: 'error',
        message: 'Prompt is required for cost estimation'
      });
    }

    // Check cache first for cost estimates
    try {
      const cachedEstimate = await cacheService.getCachedCostEstimate(prompt, tier || ensembleConfig.meta.tier);
      if (cachedEstimate) {
        return res.status(200).json({
          ...cachedEstimate,
          cached: true,
          cacheTimestamp: new Date().toISOString()
        });
      }
    } catch (cacheError) {
      console.warn('⚠️ Cost estimate cache lookup failed:', cacheError.message);
    }

    // Rough token estimation (1 token ≈ 4 characters for English)
    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = tier === 'free' ? 150 : 250; // Estimated response tokens

    const estimatedCost = ensembleConfig.estimateCost(promptTokens, responseTokens, tier || ensembleConfig.meta.tier);

    // Prepare response
    const costResponse = {
      status: 'success',
      data: {
        prompt: {
          length: prompt.length,
          estimatedTokens: promptTokens
        },
        tier: tier || ensembleConfig.meta.tier,
        estimatedCost: {
          total: `$${estimatedCost.toFixed(6)}`,
          breakdown: {
            promptTokens,
            responseTokens,
            modelsUsed: Object.keys(ensembleConfig.models).length
          }
        },
        comparison: {
          free: `$${ensembleConfig.estimateCost(promptTokens, 150, 'free').toFixed(6)}`,
          premium: `$${ensembleConfig.estimateCost(promptTokens, 250, 'premium').toFixed(6)}`
        }
      },
      timestamp: new Date().toISOString()
    };

    // Cache the cost estimate for future use
    try {
      await cacheService.cacheCostEstimate(prompt, tier || ensembleConfig.meta.tier, costResponse);
    } catch (cacheError) {
      console.warn('⚠️ Failed to cache cost estimate:', cacheError.message);
    }

    res.status(200).json(costResponse);

  } catch (error) {
    monitoringService.log('error', 'Cost estimation failed', { error: error.message });

    res.status(500).json({
      status: 'error',
      message: 'Failed to estimate cost',
      timestamp: new Date().toISOString()
    });
  }
});

// Workout generation endpoint
router.post('/workout', async (req, res) => {
  const correlationId = req.correlationId || `workout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Extract request data including enhanced frontend format
    const { userMetadata, workoutHistory, workoutRequest, workoutSpecification } = req.body;
    const userId = req.headers['x-user-id'] || req.userId || 'anonymous';
    const userTier = req.userTier || 'free';

    // Check advanced rate limiting for workout generation
    const rateLimitCheck = await advancedRateLimitingService.checkComprehensiveRateLimit(
      userId, userTier, 'workout'
    );

    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        status: 'error',
        error: 'Rate limit exceeded',
        message: `${rateLimitCheck.reason === 'rate_limit' ? 'Regular rate limit' : 'Burst limit'} exceeded for workout generation`,
        rateLimitInfo: {
          regular: rateLimitCheck.regular,
          burst: rateLimitCheck.burst
        },
        retryAfter: Math.ceil((rateLimitCheck.regular.resetTime - Date.now()) / 1000),
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Log request start with enhanced format detection
    monitoringService.log('info', 'Workout generation request received', {
      userId,
      hasMetadata: !!userMetadata,
      hasHistory: !!(workoutHistory && workoutHistory.length > 0),
      requestLength: workoutRequest ? workoutRequest.length : 0,
      hasWorkoutSpecification: !!workoutSpecification,
      enhancedFormat: !!workoutSpecification
    }, correlationId);

    // Validate required fields
    if (!userMetadata) {
      return res.status(400).json({
        status: 'error',
        message: 'userMetadata is required',
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    if (!workoutRequest) {
      return res.status(400).json({
        status: 'error',
        message: 'workoutRequest is required',
        timestamp: new Date().toISOString(),
        correlationId
      });
    }

    // Generate workout using the workout service with enhanced format support
    const result = await workoutService.generateWorkout(
      userMetadata,
      workoutHistory || [],
      workoutRequest,
      userId,
      workoutSpecification
    );

    // Add correlation ID to response
    result.data.metadata.correlationId = correlationId;

    // Log success
    monitoringService.log('info', 'Workout generation completed successfully', {
      userId,
      workoutType: result.data.workout.type,
      exerciseCount: result.data.workout.exercises ? result.data.workout.exercises.length : 0,
      duration: result.data.workout.duration
    }, correlationId);

    res.status(200).json({
      ...result,
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Log error
    monitoringService.log('error', 'Workout generation failed', {
      userId: req.headers['x-user-id'] || 'anonymous',
      error: error.message,
      stack: error.stack
    }, correlationId);

    // Determine error type and status code
    let statusCode = 500;
    let errorMessage = 'Internal server error occurred during workout generation';

    if (error.message.includes('required') ||
        error.message.includes('must be') ||
        error.message.includes('invalid')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('timeout') ||
               error.message.includes('AI model')) {
      statusCode = 503;
      errorMessage = 'Workout generation service temporarily unavailable';
    }

    res.status(statusCode).json({
      status: 'error',
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString(),
      correlationId,
      retryable: statusCode === 503,
      supportInfo: {
        correlationId,
        timestamp: new Date().toISOString(),
        suggestion: statusCode === 400
          ? 'Please check your request parameters and try again'
          : 'Please try again in a few moments. If the issue persists, contact support with the correlation ID.'
      }
    });
  }
});

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

// Cost monitoring report endpoint
router.get('/cost/report', async (req, res) => {
  try {
    const report = costMonitoringService.getReport();

    res.status(200).json({
      status: 'success',
      data: report,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate cost report',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Cost optimization recommendations endpoint
router.get('/cost/recommendations', async (req, res) => {
  try {
    const report = costMonitoringService.getReport();
    const recommendations = [];

    // Generate actionable recommendations based on cost data
    if (report.costs.utilizationPercent.daily > 80) {
      recommendations.push({
        type: 'cost_alert',
        priority: 'high',
        message: 'Daily cost limit approaching. Consider optimizing model usage.',
        action: 'Review high-cost operations and enable caching'
      });
    }

    if (report.modelPerformance.length > 0) {
      const topModel = report.modelPerformance[0];
      recommendations.push({
        type: 'model_optimization',
        priority: 'medium',
        message: `${topModel.model} shows best cost efficiency`,
        action: `Consider using ${topModel.model} for similar workloads`
      });
    }

    if (report.costs.today > 0) {
      const projectedMonthly = report.costs.today * 30;
      recommendations.push({
        type: 'budget_projection',
        priority: 'info',
        message: `Projected monthly cost: $${projectedMonthly.toFixed(2)}`,
        action: 'Monitor usage patterns and adjust limits if needed'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        recommendations,
        summary: {
          totalRecommendations: recommendations.length,
          highPriority: recommendations.filter(r => r.priority === 'high').length,
          costOptimizationOpportunities: recommendations.filter(r => r.type === 'model_optimization').length
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate cost recommendations',
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
 * Calculate confidence score for a role response
 */
function calculateConfidenceScore(role) {
  if (role.status !== 'fulfilled') return 0;

  let score = 0.5; // Base score

  // Length factor (reasonable length indicates thoughtful response)
  const wordCount = role.content.split(' ').length;
  if (wordCount >= 20 && wordCount <= 200) score += 0.2;
  else if (wordCount > 200) score += 0.1;

  // Structure factor (presence of punctuation, capitalization)
  if (/[.!?]/.test(role.content)) score += 0.1;
  if (/^[A-Z]/.test(role.content)) score += 0.1;

  // Content quality indicators
  if (role.content.includes('because') || role.content.includes('therefore') || role.content.includes('however')) {
    score += 0.1; // Reasoning indicators
  }

  return Math.min(1.0, score);
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

  let score = avgRoleConfidence * 0.7; // Base on role confidence

  // Synthesis quality factors
  const synthesisQuality = analyzeResponseQuality(synthesis.content);
  if (synthesisQuality.wordCount >= 30) score += 0.1;
  if (synthesisQuality.hasStructure) score += 0.1;
  if (synthesisQuality.hasReasoning) score += 0.1;

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
 * Calculate model agreement
 */
function calculateModelAgreement(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled');
  if (successful.length < 2) return 0;

  // Simple agreement based on confidence consistency
  const confidences = successful.map(r => r.confidence.score);
  const avg = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
  const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / confidences.length;

  return Math.max(0, 1 - variance);
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
 * Get quality distribution
 */
function getQualityDistribution(roles) {
  const successful = roles.filter(r => r.status === 'fulfilled');
  const distribution = { high: 0, medium: 0, low: 0 };

  successful.forEach(role => {
    const level = role.confidence.level;
    if (level === 'high') distribution.high++;
    else if (level === 'medium') distribution.medium++;
    else distribution.low++;
  });

  return distribution;
}

/**
 * Estimate request cost
 */
async function estimateRequestCost(prompt, roles) {
  const promptTokens = estimateTokenCount(prompt);
  const responseTokens = roles.reduce((sum, role) => sum + estimateTokenCount(role.content || ''), 0);

  // Rough cost estimation based on token usage
  const estimatedCost = (promptTokens * 0.0001 + responseTokens * 0.0002) * roles.length;

  return {
    promptTokens,
    responseTokens,
    totalTokens: promptTokens + responseTokens,
    estimatedCost: `$${estimatedCost.toFixed(6)}`,
    modelsUsed: roles.length
  };
}

module.exports = router;