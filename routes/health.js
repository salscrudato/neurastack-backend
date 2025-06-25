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
          qualityScore: calculateQualityScore(ensembleResult.synthesis.content),
          metadata: {
            basedOnResponses: enhancedRoles.length,
            averageConfidence: enhancedRoles.reduce((sum, role) => sum + role.confidence.score, 0) / enhancedRoles.length,
            consensusLevel: calculateConsensusLevel(enhancedRoles)
          }
        },
        roles: enhancedRoles,
        voting: {
          winner: votingResult.winner,
          confidence: votingResult.confidence,
          consensus: votingResult.consensus,
          weights: votingResult.weights,
          recommendation: votingResult.recommendation
        },
        metadata: {
          ...ensembleResult.metadata,
          timestamp: new Date().toISOString(),
          version: '3.1', // Updated version for enhanced voting
          correlationId,
          confidenceAnalysis: {
            overallConfidence: synthesisConfidence.score,
            modelAgreement: calculateModelAgreement(enhancedRoles),
            responseConsistency: calculateResponseConsistency(enhancedRoles),
            qualityDistribution: getQualityDistribution(enhancedRoles),
            votingAnalysis: {
              consensusStrength: votingResult.consensus,
              winnerMargin: Math.max(...Object.values(votingResult.weights)) -
                           (Object.values(votingResult.weights).sort((a, b) => b - a)[1] || 0),
              distributionEntropy: calculateWeightEntropy(votingResult.weights)
            }
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

  // Enhanced length factor with optimal ranges
  if (wordCount >= 30 && wordCount <= 150) score += 0.25; // Optimal range
  else if (wordCount >= 15 && wordCount < 30) score += 0.15; // Acceptable short
  else if (wordCount > 150 && wordCount <= 300) score += 0.20; // Acceptable long
  else if (wordCount > 300) score += 0.05; // Too verbose
  else score -= 0.1; // Too short

  // Structure and grammar quality (weighted 0.2)
  let structureScore = 0;
  if (/[.!?]/.test(content)) structureScore += 0.05; // Has punctuation
  if (/^[A-Z]/.test(content)) structureScore += 0.05; // Proper capitalization
  if (sentenceCount >= 2) structureScore += 0.05; // Multiple sentences
  if (content.includes(',') || content.includes(';')) structureScore += 0.03; // Complex punctuation
  if (/\b[A-Z][a-z]+\b/.test(content)) structureScore += 0.02; // Proper nouns
  score += structureScore;

  // Content sophistication (weighted 0.25)
  let sophisticationScore = 0;
  const reasoningWords = ['because', 'therefore', 'however', 'furthermore', 'moreover', 'consequently', 'thus', 'hence', 'although', 'whereas'];
  const foundReasoning = reasoningWords.filter(word => content.toLowerCase().includes(word)).length;
  sophisticationScore += Math.min(foundReasoning * 0.03, 0.12); // Max 0.12 for reasoning

  // Technical depth indicators
  const technicalIndicators = ['analysis', 'approach', 'strategy', 'implementation', 'consideration', 'evaluation'];
  const foundTechnical = technicalIndicators.filter(word => content.toLowerCase().includes(word)).length;
  sophisticationScore += Math.min(foundTechnical * 0.02, 0.08); // Max 0.08 for technical depth

  // Specificity indicators
  if (/\d+/.test(content)) sophisticationScore += 0.03; // Contains numbers/data
  if (content.includes('%') || content.includes('$')) sophisticationScore += 0.02; // Quantitative data
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
  const modelName = role.metadata?.model || role.model;
  if (modelName && modelAdjustments[modelName]) {
    score += modelAdjustments[modelName];
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

  // Semantic similarity approximation (40% weight)
  let semanticAgreement = 0;
  if (successful.length >= 2) {
    // Simple keyword overlap analysis
    const responses = successful.map(r => r.content.toLowerCase());
    const allWords = responses.flatMap(r => r.split(/\W+/).filter(w => w.length > 3));
    const uniqueWords = [...new Set(allWords)];

    let totalOverlap = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const words1 = new Set(responses[i].split(/\W+/).filter(w => w.length > 3));
        const words2 = new Set(responses[j].split(/\W+/).filter(w => w.length > 3));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        if (union.size > 0) {
          totalOverlap += intersection.size / union.size;
          comparisons++;
        }
      }
    }

    semanticAgreement = comparisons > 0 ? totalOverlap / comparisons : 0;
  }

  // Weighted combination
  const agreement = (confidenceAgreement * 0.4) + (lengthAgreement * 0.2) + (semanticAgreement * 0.4);
  return Math.max(0, Math.min(1, agreement));
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

    // Time penalty/bonus (faster responses get slight bonus)
    let timeMultiplier = 1.0;
    if (responseTime > 0) {
      if (responseTime < 2000) timeMultiplier = 1.1; // 10% bonus for fast response
      else if (responseTime > 8000) timeMultiplier = 0.9; // 10% penalty for slow response
    }

    // Length optimization (penalize too short or too long)
    let lengthMultiplier = 1.0;
    if (wordCount < 10) lengthMultiplier = 0.7; // Penalty for too short
    else if (wordCount > 300) lengthMultiplier = 0.8; // Penalty for too long
    else if (wordCount >= 30 && wordCount <= 150) lengthMultiplier = 1.1; // Bonus for optimal length

    // Model reliability factor (based on historical performance)
    const modelReliability = {
      'gpt-4o': 1.15,
      'gpt-4o-mini': 1.0,
      'claude-3-5-haiku-latest': 1.05,
      'gemini-2.0-flash': 1.1
    };
    const modelName = role.metadata?.model || role.model;
    const reliabilityMultiplier = modelReliability[modelName] || 1.0;

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
 * Calculate consensus strength based on weight distribution
 */
function calculateConsensusStrength(weights) {
  const values = Object.values(weights);
  const maxWeight = Math.max(...values);
  const secondMaxWeight = values.sort((a, b) => b - a)[1] || 0;

  // Strong consensus if winner has >60% weight and significant lead
  if (maxWeight > 0.6 && (maxWeight - secondMaxWeight) > 0.2) return 'strong';
  // Moderate consensus if winner has >45% weight
  if (maxWeight > 0.45) return 'moderate';
  // Weak consensus if weights are distributed
  return 'weak';
}

/**
 * Generate voting recommendation based on analysis
 */
function generateVotingRecommendation(weights, roles) {
  const maxWeight = Math.max(...Object.values(weights));
  const consensus = calculateConsensusStrength(weights);

  if (consensus === 'strong') {
    return 'High confidence in selected response - strong model agreement';
  } else if (consensus === 'moderate') {
    return 'Moderate confidence - consider reviewing alternative responses';
  } else {
    return 'Low consensus - responses vary significantly, manual review recommended';
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



module.exports = router;