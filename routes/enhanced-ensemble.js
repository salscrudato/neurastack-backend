/**
 * Enhanced Ensemble Routes with Confidence Indicators
 * Provides ensemble responses with confidence scores, model comparison, and enhanced metadata
 */

const express = require('express');
const { getEnsembleRunner } = require('../services/ensembleRunner');
const monitoringService = require('../services/monitoringService');
const costMonitoringService = require('../services/costMonitoringService');
const securityMiddleware = require('../middleware/securityMiddleware');

const router = express.Router();

/**
 * Enhanced ensemble endpoint with confidence indicators
 */
router.post('/enhanced-ensemble',
  securityMiddleware.createRateLimit({ max: 50, windowMs: 60 * 1000 }), // 50 requests per minute
  async (req, res) => {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] || `enhanced-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.headers['x-user-id'] || 'anonymous';

    try {
      const { prompt = "Quick sanity check: explain AI in 1-2 lines.", sessionId } = req.body;

      monitoringService.log('info', 'Enhanced ensemble request received', {
        userId,
        promptLength: prompt.length,
        sessionId
      }, correlationId);

      // Get ensemble runner and execute
      const ensembleRunner = getEnsembleRunner();
      const result = await ensembleRunner.runEnsemble(prompt, userId, sessionId, correlationId);

      // Calculate confidence scores for each response
      const enhancedRoles = result.roles.map(role => {
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
            processingTime: role.processingTime || 0,
            tokenCount: estimateTokenCount(role.content),
            complexity: assessComplexity(role.content)
          }
        };
      });

      // Calculate synthesis confidence
      const synthesisConfidence = calculateSynthesisConfidence(result.synthesis, enhancedRoles);

      // Enhanced response with confidence indicators
      const enhancedResponse = {
        status: 'success',
        data: {
          prompt,
          userId,
          synthesis: {
            ...result.synthesis,
            confidence: synthesisConfidence,
            qualityScore: calculateQualityScore(result.synthesis.content),
            metadata: {
              basedOnResponses: enhancedRoles.length,
              averageConfidence: enhancedRoles.reduce((sum, role) => sum + role.confidence.score, 0) / enhancedRoles.length,
              consensusLevel: calculateConsensusLevel(enhancedRoles)
            }
          },
          roles: enhancedRoles,
          metadata: {
            ...result.metadata,
            processingTimeMs: Date.now() - startTime,
            confidenceAnalysis: {
              overallConfidence: synthesisConfidence.score,
              modelAgreement: calculateModelAgreement(enhancedRoles),
              responseConsistency: calculateResponseConsistency(enhancedRoles),
              qualityDistribution: getQualityDistribution(enhancedRoles)
            },
            costEstimate: await estimateRequestCost(prompt, enhancedRoles)
          }
        },
        timestamp: new Date().toISOString(),
        correlationId
      };

      // Track metrics
      monitoringService.log('info', 'Enhanced ensemble completed successfully', {
        userId,
        processingTime: Date.now() - startTime,
        overallConfidence: synthesisConfidence.score,
        successfulRoles: enhancedRoles.filter(r => r.status === 'fulfilled').length
      }, correlationId);

      res.json(enhancedResponse);

    } catch (error) {
      console.error('Enhanced ensemble error:', error);
      
      monitoringService.log('error', 'Enhanced ensemble failed', {
        userId,
        error: error.message,
        processingTime: Date.now() - startTime
      }, correlationId);

      res.status(500).json({
        status: 'error',
        message: 'Enhanced ensemble processing failed',
        error: error.message,
        timestamp: new Date().toISOString(),
        correlationId
      });
    }
  }
);

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
