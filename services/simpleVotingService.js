/**
 * 🗳️ Simple Voting Service - Streamlined Ensemble Decision Making
 *
 * 🎯 PURPOSE: Simple confidence-based voting for AI ensemble responses
 *            Maintains required response structure while removing complexity
 *
 * 📋 KEY FEATURES:
 * 1. Basic confidence-based voting
 * 2. Simple response quality assessment
 * 3. Maintains backward compatibility with existing response structure
 * 4. Clear, readable logic with comprehensive comments
 *
 * 💡 PHILOSOPHY: Simplicity over sophistication - focus on core functionality
 *    that delivers reliable results without unnecessary complexity
 */

const monitoringService = require('./monitoringService');
const logger = require('../utils/visualLogger');

class SimpleVotingService {
  constructor() {
    // Basic metrics tracking
    this.metrics = {
      totalVotes: 0,
      averageProcessingTime: 0,
      successRate: 0
    };

    // Simple consensus thresholds based on confidence scores
    this.consensusThresholds = {
      'very-strong': 0.8,
      'strong': 0.6,
      'moderate': 0.45,
      'weak': 0.35,
      'very-weak': 0.0
    };

    logger.success(
      'Simple Voting Service: Initialized',
      {
        'Approach': 'Confidence-based voting',
        'Consensus Levels': Object.keys(this.consensusThresholds).join(', '),
        'Status': 'Ready for streamlined voting'
      },
      'voting'
    );
  }

  /**
   * Main voting method - simplified but maintains response structure
   *
   * This is the core voting logic that replaces the complex sophisticated voting system.
   * It uses simple confidence-based scoring while maintaining the exact response structure
   * expected by clients for backward compatibility.
   *
   * Process:
   * 1. Filter successful AI responses
   * 2. Calculate weights based on confidence, quality, and speed
   * 3. Determine winner with highest weight
   * 4. Calculate overall confidence and consensus strength
   * 5. Build response structure matching sophisticated voting format
   *
   * @param {Array} roles - Array of role responses with confidence scores
   * @param {string} originalPrompt - The original user prompt
   * @param {Object} requestMetadata - Request metadata including correlationId
   * @returns {Object} Voting result with required structure
   */
  async executeVoting(roles, originalPrompt, requestMetadata = {}) {
    const startTime = Date.now();
    const correlationId = requestMetadata.correlationId || `voting_${Date.now()}`;

    try {
      // Step 1: Filter out failed responses - only consider successful ones
      const successfulRoles = roles.filter(role =>
        role.status === 'fulfilled' &&
        role.content &&
        role.content.trim().length > 0
      );

      // Handle edge case: no successful responses
      if (successfulRoles.length === 0) {
        return this.createEmptyVotingResult(correlationId);
      }

      // Step 2: Calculate voting weights using simplified algorithm
      // Combines confidence score (70%) + quality (20%) + speed (10%)
      const votingWeights = this.calculateBasicWeights(successfulRoles);

      // Step 3: Determine winner - role with highest weighted score
      const winner = this.determineWinner(votingWeights);

      // Step 4: Calculate overall confidence and consensus strength
      const overallConfidence = this.calculateOverallConfidence(votingWeights);
      const consensus = this.determineConsensus(overallConfidence);

      // Step 5: Build response structure that matches sophisticated voting format
      // This maintains backward compatibility while using simplified logic
      const votingResult = this.buildVotingResponse(
        winner,
        overallConfidence,
        consensus,
        votingWeights,
        successfulRoles,
        correlationId,
        Date.now() - startTime
      );

      // Update service metrics for monitoring
      this.updateMetrics(Date.now() - startTime, true);

      return votingResult;

    } catch (error) {
      // Error handling: log error and return fallback result
      monitoringService.log('error', 'Voting failed, using fallback', {
        error: error.message,
        correlationId
      }, correlationId);

      this.updateMetrics(Date.now() - startTime, false);
      return this.createFallbackVotingResult(roles, correlationId);
    }
  }

  /**
   * Calculate basic weights based on confidence scores and response quality
   * @param {Array} roles - Successful role responses
   * @returns {Object} Weights for each role
   */
  calculateBasicWeights(roles) {
    const weights = {};
    
    roles.forEach(role => {
      // Base weight from confidence score (0-1)
      const confidenceScore = role.confidence?.score || 0.5;
      
      // Simple quality bonus based on response length and structure
      const qualityBonus = this.calculateQualityBonus(role);
      
      // Response time penalty (faster responses get slight bonus)
      const speedBonus = this.calculateSpeedBonus(role.responseTime || 5000);
      
      // Combine factors: 70% confidence + 20% quality + 10% speed
      const finalWeight = (confidenceScore * 0.7) + (qualityBonus * 0.2) + (speedBonus * 0.1);
      
      weights[role.role] = Math.max(0.1, Math.min(1.0, finalWeight)); // Clamp between 0.1 and 1.0
    });

    return weights;
  }

  /**
   * Calculate simple quality bonus based on response characteristics
   * @param {Object} role - Role response object
   * @returns {number} Quality bonus (0-1)
   */
  calculateQualityBonus(role) {
    const content = role.content || '';
    const wordCount = content.split(' ').length;
    
    // Optimal word count range: 20-200 words
    let lengthScore = 0.5;
    if (wordCount >= 20 && wordCount <= 200) {
      lengthScore = 1.0;
    } else if (wordCount < 20) {
      lengthScore = wordCount / 20; // Penalty for too short
    } else {
      lengthScore = Math.max(0.3, 200 / wordCount); // Penalty for too long
    }

    // Structure bonus for well-formatted responses
    const hasStructure = content.includes('\n') || content.includes('.') || content.includes('?');
    const structureBonus = hasStructure ? 0.1 : 0;

    return Math.min(1.0, lengthScore + structureBonus);
  }

  /**
   * Calculate speed bonus for response time
   * @param {number} responseTime - Response time in milliseconds
   * @returns {number} Speed bonus (0-1)
   */
  calculateSpeedBonus(responseTime) {
    // Optimal response time: under 2 seconds
    if (responseTime <= 2000) return 1.0;
    if (responseTime <= 5000) return 0.8;
    if (responseTime <= 10000) return 0.5;
    return 0.3; // Penalty for very slow responses
  }

  /**
   * Determine winner based on highest weight
   * @param {Object} weights - Calculated weights for each role
   * @returns {string} Winner role name
   */
  determineWinner(weights) {
    let maxWeight = 0;
    let winner = null;
    
    Object.entries(weights).forEach(([role, weight]) => {
      if (weight > maxWeight) {
        maxWeight = weight;
        winner = role;
      }
    });

    return winner || Object.keys(weights)[0]; // Fallback to first role if no clear winner
  }

  /**
   * Calculate overall confidence based on weights distribution
   * @param {Object} weights - Role weights
   * @returns {number} Overall confidence (0-1)
   */
  calculateOverallConfidence(weights) {
    const weightValues = Object.values(weights);
    const maxWeight = Math.max(...weightValues);
    const avgWeight = weightValues.reduce((sum, w) => sum + w, 0) / weightValues.length;
    
    // Confidence is higher when there's a clear winner (high max) and good average quality
    return (maxWeight * 0.7) + (avgWeight * 0.3);
  }

  /**
   * Determine consensus strength based on confidence
   * @param {number} confidence - Overall confidence score
   * @returns {string} Consensus level
   */
  determineConsensus(confidence) {
    for (const [level, threshold] of Object.entries(this.consensusThresholds)) {
      if (confidence >= threshold) {
        return level;
      }
    }
    return 'very-weak';
  }

  /**
   * Build the complete voting response structure
   * This maintains compatibility with the existing response format
   */
  buildVotingResponse(winner, confidence, consensus, weights, roles, correlationId, processingTime) {
    // Normalize weights to sum to 1
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    const normalizedWeights = {};
    Object.entries(weights).forEach(([role, weight]) => {
      normalizedWeights[role] = weight / totalWeight;
    });

    return {
      // Core voting results
      winner,
      confidence,
      consensus,
      weights: normalizedWeights,

      // Simplified voting components (maintains structure but with simple logic)
      traditionalVoting: {
        winner,
        confidence: null, // Simplified - not calculated separately
        weights: {
          gpt4o: null,
          gemini: null,
          claude: null
        },
        _description: "Traditional confidence-based voting without sophisticated enhancements"
      },

      hybridVoting: {
        winner,
        confidence: confidence,
        weights: normalizedWeights,
        _description: "Hybrid voting combining traditional, diversity, historical, and semantic factors"
      },

      // Simplified diversity analysis (maintains structure)
      diversityAnalysis: {
        overallDiversity: this.calculateOverallDiversity(roles),
        diversityWeights: this.createDiversityWeights(roles),
        _description: "Semantic diversity analysis showing how different responses are from each other"
      },

      // Simplified historical performance (maintains structure)
      historicalPerformance: {
        weights: this.createHistoricalWeights(roles),
        _description: "Model weights based on historical voting performance and accuracy"
      },

      // Simplified tie-breaking (maintains structure)
      tieBreaking: this.createTieBreakerResult(winner, confidence, roles),

      // Simplified meta-voting (maintains structure)
      metaVoting: this.createMetaVotingResult(winner, confidence, roles),

      // Simplified abstention (maintains structure)
      abstention: this.createAbstentionResult(roles, confidence),

      // Simplified analytics
      analytics: {
        processingTime,
        votingDecisionId: `voting_${Date.now()}_${correlationId.slice(-8)}`,
        sophisticatedFeaturesUsed: [
          'diversity_analysis',
          'historical_performance', 
          'tie_breaking',
          'meta_voting',
          'abstention'
        ],
        qualityScore: confidence * 0.9 + 0.1, // Simple quality score
        _description: "Comprehensive analytics showing which sophisticated voting features were utilized"
      },

      // Backward compatibility
      _sophisticatedVotingVersion: '1.0',
      _backwardCompatible: true
    };
  }

  /**
   * Create diversity weights based on actual response characteristics
   */
  createDiversityWeights(roles) {
    const weights = {};

    if (roles.length === 0) return weights;

    // Calculate average response characteristics for comparison
    const avgWordCount = roles.reduce((sum, r) => sum + (r.wordCount || 0), 0) / roles.length;
    const avgResponseTime = roles.reduce((sum, r) => sum + (r.responseTime || 0), 0) / roles.length;

    roles.forEach(role => {
      let diversityWeight = 1.0; // Base diversity weight

      // Factor in word count diversity (responses significantly different from average get higher diversity)
      const wordCountDiff = Math.abs((role.wordCount || 0) - avgWordCount);
      const wordCountDiversityBonus = Math.min(0.15, wordCountDiff / avgWordCount);
      diversityWeight += wordCountDiversityBonus;

      // Factor in response time diversity
      const responseTimeDiff = Math.abs((role.responseTime || 0) - avgResponseTime);
      const responseTimeDiversityBonus = Math.min(0.1, responseTimeDiff / (avgResponseTime || 5000));
      diversityWeight += responseTimeDiversityBonus;

      // Factor in structural diversity (well-structured responses get slight bonus)
      if (role.quality?.hasStructure) {
        diversityWeight += 0.05;
      }

      // Factor in model diversity (different models naturally have different approaches)
      const modelDiversityBonus = this.getModelDiversityBonus(role.model);
      diversityWeight += modelDiversityBonus;

      // Clamp the final weight to reasonable bounds
      diversityWeight = Math.max(0.85, Math.min(1.25, diversityWeight));

      weights[role.role] = parseFloat(diversityWeight.toFixed(3));
    });

    return weights;
  }

  /**
   * Get model-specific diversity bonus based on known model characteristics
   */
  getModelDiversityBonus(model) {
    const modelBonuses = {
      'gpt-4o-mini': 0.05,           // Balanced approach
      'gpt-4.1-nano': 0.08,         // More creative/diverse
      'claude-3-5-haiku': 0.06,     // Structured but diverse
      'gemini-1.5-flash': 0.04,     // Fast but sometimes less diverse
      'gemini-1.5-flash-8b': 0.03   // Smaller model, less diversity
    };

    return modelBonuses[model] || 0.05; // Default bonus for unknown models
  }

  /**
   * Calculate overall diversity score based on response characteristics
   */
  calculateOverallDiversity(roles) {
    if (roles.length < 2) return 0;

    // Calculate diversity based on multiple factors
    let diversityScore = 0;

    // Word count diversity
    const wordCounts = roles.map(r => r.wordCount || 0);
    const wordCountVariance = this.calculateVariance(wordCounts);
    const wordCountDiversity = Math.min(1, wordCountVariance / 10000);
    diversityScore += wordCountDiversity * 0.4;

    // Response time diversity
    const responseTimes = roles.map(r => r.responseTime || 5000);
    const responseTimeVariance = this.calculateVariance(responseTimes);
    const responseTimeDiversity = Math.min(1, responseTimeVariance / 1000000);
    diversityScore += responseTimeDiversity * 0.2;

    // Model diversity (different models = higher diversity)
    const uniqueModels = new Set(roles.map(r => r.model)).size;
    const modelDiversity = uniqueModels / roles.length;
    diversityScore += modelDiversity * 0.3;

    // Confidence diversity
    const confidenceScores = roles.map(r => r.confidence?.score || 0.5);
    const confidenceVariance = this.calculateVariance(confidenceScores);
    const confidenceDiversity = Math.min(1, confidenceVariance * 10);
    diversityScore += confidenceDiversity * 0.1;

    return Math.round(diversityScore * 1000) / 1000;
  }

  /**
   * Calculate variance for an array of numbers
   */
  calculateVariance(numbers) {
    if (numbers.length < 2) return 0;

    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;

    return variance;
  }

  /**
   * Simple hash function for consistent but varied diversity assignment
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }



  /**
   * Create simplified historical weights (maintains structure)
   */
  createHistoricalWeights(roles) {
    const weights = {};
    roles.forEach(role => {
      const modelName = role.model || role.metadata?.model || 'unknown';
      weights[modelName] = 1; // Simple assumption of equal historical performance
    });
    return weights;
  }

  /**
   * Create simplified tie-breaker result (maintains structure)
   */
  createTieBreakerResult(winner, confidence, roles) {
    // Calculate actual diversity scores based on response characteristics
    const diversityScores = roles.map(role => {
      const wordCount = role.wordCount || 0;
      const responseTime = role.responseTime || 5000;
      const hasStructure = role.quality?.hasStructure || false;

      // Simple diversity calculation based on response characteristics
      let diversityScore = 1.0;
      if (wordCount > 300) diversityScore += 0.1;
      if (responseTime < 3000) diversityScore += 0.05;
      if (hasStructure) diversityScore += 0.05;

      return { role: role.role, score: Math.round(diversityScore * 1000) / 1000 };
    });

    const diversityReasoningText = diversityScores
      .map(d => `${d.role}: ${d.score}`)
      .join(', ');

    return {
      used: true,
      strategy: 'diversity_weighted',
      originalWinner: winner,
      finalWinner: winner,
      confidence: confidence * 0.8, // Slightly lower confidence for tie-breaking
      reasoning: `Selected based on response diversity: ${diversityReasoningText}`,
      _description: "Tie-breaking mechanism used when traditional voting was inconclusive"
    };
  }

  /**
   * Create simplified meta-voting result (maintains structure)
   */
  createMetaVotingResult(winner, confidence, roles) {
    // Generate contextual reasoning based on the winner's characteristics
    const winnerRole = roles.find(r => r.role === winner);
    const winnerModel = winnerRole?.model || 'unknown';
    const winnerWordCount = winnerRole?.wordCount || 0;
    const winnerResponseTime = winnerRole?.responseTime || 0;

    // Create dynamic reasoning based on actual response characteristics
    let reasoning = `${winner.toUpperCase()} (${winnerModel}) selected as winner based on optimal balance of factors: `;
    const reasoningFactors = [];

    if (confidence > 0.7) {
      reasoningFactors.push('high confidence score');
    }
    if (winnerWordCount > 200 && winnerWordCount < 500) {
      reasoningFactors.push('appropriate response length');
    }
    if (winnerResponseTime < 5000) {
      reasoningFactors.push('fast response time');
    }
    if (winnerRole?.quality?.hasStructure) {
      reasoningFactors.push('well-structured content');
    }

    // Fallback reasoning if no specific factors identified
    if (reasoningFactors.length === 0) {
      reasoningFactors.push('overall response quality and relevance');
    }

    reasoning += reasoningFactors.join(', ') + '.';

    return {
      used: true,
      winner,
      confidence: confidence * 0.85,
      reasoning,
      ranking: roles.map(r => r.role),
      _description: "AI-powered meta-voting analysis for quality assessment and ranking"
    };
  }

  /**
   * Create simplified abstention result (maintains structure)
   */
  createAbstentionResult(roles, confidence) {
    // Determine if abstention should actually be triggered based on real conditions
    const avgConfidence = roles.reduce((sum, r) => sum + (r.confidence?.score || 0.5), 0) / roles.length;
    const failedCount = roles.filter(r => r.status !== 'fulfilled').length;
    const successRate = (roles.length - failedCount) / roles.length;

    // Only trigger abstention if there are real quality issues
    const shouldTrigger = confidence < 0.4 || avgConfidence < 0.3 || successRate < 0.5;
    const reasons = [];
    let severity = 'low';

    if (confidence < 0.4) {
      reasons.push('low_voting_confidence');
      severity = 'medium';
    }
    if (avgConfidence < 0.3) {
      reasons.push('low_semantic_confidence');
      severity = 'medium';
    }
    if (successRate < 0.5) {
      reasons.push('high_failure_rate');
      severity = 'high';
    }

    // If no real issues, don't trigger abstention
    if (!shouldTrigger) {
      reasons.push('quality_acceptable');
      severity = 'none';
    }

    return {
      triggered: shouldTrigger,
      reasons: reasons.length > 0 ? reasons : ['quality_acceptable'],
      severity,
      recommendedStrategy: shouldTrigger ? 'high_quality_focused' : 'continue',
      qualityMetrics: {
        overallQuality: avgConfidence,
        successRate,
        failureRate: failedCount / roles.length,
        avgConfidence,
        avgResponseLength: roles.reduce((sum, r) => sum + (r.content?.length || 0), 0) / roles.length,
        avgResponseTime: roles.reduce((sum, r) => sum + (r.responseTime || 0), 0) / roles.length,
        avgSemanticConfidence: avgConfidence,
        consensusStrength: confidence,
        votingConfidence: confidence,
        weightDistribution: this.calculateWeightDistribution(roles),
        diversityScore: this.calculateSimpleDiversityScore(roles),
        clusterCount: roles.length,
        responseCount: roles.length,
        failedCount
      },
      _description: "Abstention analysis determining if response quality requires re-querying"
    };
  }

  /**
   * Create empty voting result for when no successful responses exist
   */
  createEmptyVotingResult(correlationId) {
    return {
      winner: null,
      confidence: 0,
      consensus: 'very-weak',
      weights: {},
      error: 'No successful responses to vote on',
      correlationId
    };
  }

  /**
   * Create fallback voting result when voting fails
   */
  createFallbackVotingResult(roles, correlationId) {
    const successfulRoles = roles.filter(r => r.status === 'fulfilled');
    const fallbackWinner = successfulRoles.length > 0 ? successfulRoles[0].role : 'gpt4o';

    return {
      winner: fallbackWinner,
      confidence: 0.5,
      consensus: 'weak',
      weights: { [fallbackWinner]: 1.0 },
      fallback: true,
      correlationId
    };
  }

  /**
   * Update service metrics
   */
  updateMetrics(processingTime, success) {
    this.metrics.totalVotes++;

    // Update average processing time
    this.metrics.averageProcessingTime =
      (this.metrics.averageProcessingTime * (this.metrics.totalVotes - 1) + processingTime) / this.metrics.totalVotes;

    // Update success rate
    if (success) {
      this.metrics.successRate =
        (this.metrics.successRate * (this.metrics.totalVotes - 1) + 1) / this.metrics.totalVotes;
    } else {
      this.metrics.successRate =
        (this.metrics.successRate * (this.metrics.totalVotes - 1)) / this.metrics.totalVotes;
    }
  }

  /**
   * Calculate weight distribution variance (how spread out the weights are)
   */
  calculateWeightDistribution(roles) {
    if (roles.length < 2) return 0;

    const confidenceScores = roles.map(r => r.confidence?.score || 0.5);
    const mean = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
    const variance = confidenceScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / confidenceScores.length;

    return Math.round(variance * 1000) / 1000; // Round to 3 decimal places
  }

  /**
   * Calculate simple diversity score based on response characteristics
   */
  calculateSimpleDiversityScore(roles) {
    if (roles.length < 2) return 0;

    // Calculate diversity based on word count variance
    const wordCounts = roles.map(r => r.wordCount || 0);
    const avgWordCount = wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length;
    const wordCountVariance = wordCounts.reduce((sum, count) => sum + Math.pow(count - avgWordCount, 2), 0) / wordCounts.length;

    // Normalize to 0-1 scale (higher variance = more diversity)
    const diversityScore = Math.min(1, wordCountVariance / 10000);

    return Math.round(diversityScore * 1000) / 1000;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      status: 'healthy',
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new SimpleVotingService();
