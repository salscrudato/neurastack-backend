/**
 * 🚫 Abstention Service - Intelligent Re-Query Management
 *
 * 🎯 PURPOSE: Handle abstention scenarios when consensus is very weak,
 *            triggering re-queries with different models or parameters
 *
 * 📋 KEY FEATURES:
 * 1. Abstention threshold detection and analysis
 * 2. Intelligent re-query strategy selection
 * 3. Alternative model configuration for re-queries
 * 4. Parameter adjustment for improved responses
 * 5. Re-query attempt tracking and limits
 * 6. Quality improvement validation
 *
 * 💡 ANALOGY: Like a quality control inspector who rejects poor work
 *    and requests it be redone with better specifications
 */

const monitoringService = require('./monitoringService');
const logger = require('../utils/visualLogger');

class AbstentionService {
  constructor() {
    this.abstentionHistory = new Map();
    this.reQueryAttempts = new Map();
    
    // Configuration
    this.abstentionThresholds = {
      veryWeakConsensus: true,        // Always consider abstention for very weak consensus
      lowConfidence: 0.3,             // Abstain if confidence < 30%
      highFailureRate: 0.5,           // Abstain if >50% of models failed
      lowQualityScore: 0.4,           // Abstain if overall quality < 40%
      highDiversityWithLowConsensus: { diversity: 0.8, consensus: 0.4 }
    };

    this.reQueryLimits = {
      maxAttempts: 2,                 // Maximum re-query attempts per request
      cooldownPeriod: 5000,           // 5 second cooldown between attempts
      timeoutIncrease: 1.5,           // Increase timeout by 50% for re-queries
      temperatureAdjustment: 0.1      // Adjust temperature for variation
    };

    // Alternative model configurations for re-queries
    this.alternativeConfigs = [
      {
        name: 'high_quality_focused',
        description: 'Use highest quality models with increased timeout',
        models: ['gpt-4o', 'claude-3-5-haiku-latest'],
        adjustments: {
          timeout: 45000,
          temperature: 0.4,
          maxTokens: 800
        }
      },
      {
        name: 'diversity_focused',
        description: 'Use different model combination for diverse perspectives',
        models: ['gemini-2.0-flash', 'gpt-4o-mini'],
        adjustments: {
          timeout: 30000,
          temperature: 0.7,
          maxTokens: 600
        }
      },
      {
        name: 'conservative_approach',
        description: 'Lower temperature, more focused responses',
        models: ['gpt-4o', 'claude-3-5-haiku-latest', 'gemini-2.0-flash'],
        adjustments: {
          timeout: 35000,
          temperature: 0.2,
          maxTokens: 500
        }
      }
    ];

    logger.success(
      'Abstention Service: Initialized',
      {
        'Thresholds': Object.keys(this.abstentionThresholds).length,
        'Re-query Configs': this.alternativeConfigs.length,
        'Max Attempts': this.reQueryLimits.maxAttempts,
        'Status': 'Ready for quality control'
      },
      'abstention'
    );
  }

  /**
   * Analyze if abstention should be triggered
   */
  analyzeAbstentionNeed(votingResult, roles, diversityResult = null, requestMetadata = {}) {
    try {
      const analysis = {
        shouldAbstain: false,
        reasons: [],
        severity: 'low',
        recommendedStrategy: null,
        qualityMetrics: {}
      };

      // Check if we've already exceeded re-query limits
      const correlationId = requestMetadata.correlationId;
      if (correlationId && this.hasExceededReQueryLimit(correlationId)) {
        return {
          ...analysis,
          shouldAbstain: false,
          reasons: ['max_requery_attempts_reached'],
          severity: 'blocked'
        };
      }

      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(votingResult, roles, diversityResult);
      analysis.qualityMetrics = qualityMetrics;

      // Check abstention conditions
      const conditions = this.checkAbstentionConditions(votingResult, roles, qualityMetrics, diversityResult);
      
      if (conditions.triggeredConditions.length > 0) {
        analysis.shouldAbstain = true;
        analysis.reasons = conditions.triggeredConditions;
        analysis.severity = conditions.severity;
        analysis.recommendedStrategy = this.selectReQueryStrategy(conditions, qualityMetrics);
      }

      // Log abstention analysis
      if (analysis.shouldAbstain) {
        monitoringService.log('info', 'Abstention triggered', {
          reasons: analysis.reasons,
          severity: analysis.severity,
          strategy: analysis.recommendedStrategy?.name,
          qualityScore: qualityMetrics.overallQuality
        });
      }

      return analysis;
    } catch (error) {
      monitoringService.log('error', 'Abstention analysis failed', {
        error: error.message
      });
      
      return {
        shouldAbstain: false,
        reasons: ['analysis_error'],
        severity: 'error',
        error: error.message
      };
    }
  }

  /**
   * Calculate comprehensive quality metrics
   */
  calculateQualityMetrics(votingResult, roles, diversityResult) {
    const successful = roles.filter(r => r.status === 'fulfilled');
    const failed = roles.filter(r => r.status === 'rejected');
    
    // Basic metrics
    const successRate = roles.length > 0 ? successful.length / roles.length : 0;
    const failureRate = roles.length > 0 ? failed.length / roles.length : 0;
    
    // Confidence metrics
    const avgConfidence = successful.length > 0 ? 
      successful.reduce((sum, r) => sum + (r.confidence || 0), 0) / successful.length : 0;
    
    // Response quality metrics
    const avgResponseLength = successful.length > 0 ?
      successful.reduce((sum, r) => sum + (r.content?.length || 0), 0) / successful.length : 0;
    
    const avgResponseTime = successful.length > 0 ?
      successful.reduce((sum, r) => sum + (r.responseTime || 0), 0) / successful.length : 0;

    // Semantic quality metrics
    const avgSemanticConfidence = successful.length > 0 ?
      successful.reduce((sum, r) => sum + (r.semanticConfidence?.score || 0), 0) / successful.length : 0;

    // Voting quality metrics
    const consensusStrength = this.mapConsensusToScore(votingResult.consensus);
    const votingConfidence = votingResult.confidence || 0;
    const weightDistribution = this.calculateWeightDistribution(votingResult.weights);

    // Diversity metrics
    const diversityScore = diversityResult?.overallDiversity || 0.5;
    const clusterCount = diversityResult?.clusterAnalysis?.totalClusters || 1;

    // Calculate overall quality score
    const overallQuality = (
      successRate * 0.2 +
      avgConfidence * 0.15 +
      consensusStrength * 0.2 +
      votingConfidence * 0.15 +
      avgSemanticConfidence * 0.15 +
      (diversityScore * 0.1) +
      (Math.min(1, avgResponseLength / 200) * 0.05) // Normalize response length
    );

    return {
      overallQuality,
      successRate,
      failureRate,
      avgConfidence,
      avgResponseLength,
      avgResponseTime,
      avgSemanticConfidence,
      consensusStrength,
      votingConfidence,
      weightDistribution,
      diversityScore,
      clusterCount,
      responseCount: successful.length,
      failedCount: failed.length
    };
  }

  /**
   * Check all abstention conditions
   */
  checkAbstentionConditions(votingResult, roles, qualityMetrics, diversityResult) {
    const triggeredConditions = [];
    let severity = 'low';

    // Very weak consensus check
    if (votingResult.consensus === 'very-weak' && this.abstentionThresholds.veryWeakConsensus) {
      triggeredConditions.push('very_weak_consensus');
      severity = 'high';
    }

    // Low confidence check
    if (qualityMetrics.votingConfidence < this.abstentionThresholds.lowConfidence) {
      triggeredConditions.push('low_confidence');
      severity = Math.max(severity, 'medium');
    }

    // High failure rate check
    if (qualityMetrics.failureRate > this.abstentionThresholds.highFailureRate) {
      triggeredConditions.push('high_failure_rate');
      severity = 'high';
    }

    // Low quality score check
    if (qualityMetrics.overallQuality < this.abstentionThresholds.lowQualityScore) {
      triggeredConditions.push('low_quality_score');
      severity = Math.max(severity, 'medium');
    }

    // High diversity with low consensus check
    const diversityThreshold = this.abstentionThresholds.highDiversityWithLowConsensus;
    if (qualityMetrics.diversityScore > diversityThreshold.diversity && 
        qualityMetrics.consensusStrength < diversityThreshold.consensus) {
      triggeredConditions.push('high_diversity_low_consensus');
      severity = Math.max(severity, 'medium');
    }

    // Additional quality checks
    if (qualityMetrics.avgSemanticConfidence < 0.3) {
      triggeredConditions.push('low_semantic_confidence');
    }

    if (qualityMetrics.responseCount < 2) {
      triggeredConditions.push('insufficient_responses');
      severity = 'high';
    }

    return {
      triggeredConditions,
      severity: this.normalizeSeverity(severity)
    };
  }

  /**
   * Select appropriate re-query strategy based on conditions
   */
  selectReQueryStrategy(conditions, qualityMetrics) {
    const { triggeredConditions, severity } = conditions;

    // High severity or multiple failures -> use high quality focused approach
    if (severity === 'high' || qualityMetrics.failureRate > 0.3) {
      return this.alternativeConfigs.find(c => c.name === 'high_quality_focused');
    }

    // Low diversity issues -> use diversity focused approach
    if (triggeredConditions.includes('high_diversity_low_consensus') || 
        qualityMetrics.diversityScore < 0.3) {
      return this.alternativeConfigs.find(c => c.name === 'diversity_focused');
    }

    // Consensus issues -> use conservative approach
    if (triggeredConditions.includes('very_weak_consensus') || 
        triggeredConditions.includes('low_confidence')) {
      return this.alternativeConfigs.find(c => c.name === 'conservative_approach');
    }

    // Default to high quality focused
    return this.alternativeConfigs.find(c => c.name === 'high_quality_focused');
  }

  /**
   * Execute re-query with alternative configuration
   */
  async executeReQuery(originalRequest, strategy, ensembleRunner, requestMetadata = {}) {
    try {
      const correlationId = requestMetadata.correlationId || `requery_${Date.now()}`;
      
      // Record re-query attempt
      this.recordReQueryAttempt(correlationId, strategy);

      // Apply strategy adjustments
      const adjustedConfig = this.applyStrategyAdjustments(originalRequest, strategy);

      monitoringService.log('info', 'Re-query initiated', {
        strategy: strategy.name,
        correlationId,
        adjustments: strategy.adjustments,
        attempt: this.getReQueryAttemptCount(correlationId)
      });

      // Execute re-query with adjusted configuration
      const reQueryResult = await ensembleRunner.runEnsemble(
        adjustedConfig.prompt,
        adjustedConfig.config,
        { ...requestMetadata, isReQuery: true, originalCorrelationId: correlationId }
      );

      // Validate improvement
      const improvement = this.validateImprovement(originalRequest.result, reQueryResult);

      const result = {
        reQueryUsed: true,
        strategy: strategy.name,
        attempt: this.getReQueryAttemptCount(correlationId),
        improvement,
        originalResult: originalRequest.result,
        reQueryResult,
        finalResult: improvement.isImproved ? reQueryResult : originalRequest.result
      };

      // Record re-query outcome
      await this.recordReQueryOutcome(correlationId, result);

      return result;
    } catch (error) {
      monitoringService.log('error', 'Re-query execution failed', {
        error: error.message,
        strategy: strategy.name
      });
      
      return {
        reQueryUsed: false,
        reQueryFailed: true,
        error: error.message,
        finalResult: originalRequest.result
      };
    }
  }

  /**
   * Apply strategy adjustments to request configuration
   */
  applyStrategyAdjustments(originalRequest, strategy) {
    const adjustments = strategy.adjustments;
    
    return {
      prompt: originalRequest.prompt,
      config: {
        ...originalRequest.config,
        models: strategy.models,
        timeout: adjustments.timeout,
        temperature: adjustments.temperature,
        maxTokens: adjustments.maxTokens,
        // Add re-query specific parameters
        isReQuery: true,
        reQueryStrategy: strategy.name
      }
    };
  }

  /**
   * Validate if re-query result is an improvement
   */
  validateImprovement(originalResult, reQueryResult) {
    try {
      const originalQuality = this.calculateResultQuality(originalResult);
      const reQueryQuality = this.calculateResultQuality(reQueryResult);
      
      const improvement = reQueryQuality - originalQuality;
      const isImproved = improvement > 0.1; // Require at least 10% improvement
      
      return {
        isImproved,
        improvement,
        originalQuality,
        reQueryQuality,
        improvementPercentage: (improvement * 100).toFixed(1)
      };
    } catch (error) {
      return {
        isImproved: false,
        improvement: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate overall quality score for a result
   */
  calculateResultQuality(result) {
    if (!result || !result.voting) return 0;
    
    const consensusScore = this.mapConsensusToScore(result.voting.consensus);
    const confidence = result.voting.confidence || 0;
    const responseCount = result.roles?.filter(r => r.status === 'fulfilled').length || 0;
    const maxResponses = result.roles?.length || 1;
    
    return (consensusScore * 0.4) + (confidence * 0.4) + ((responseCount / maxResponses) * 0.2);
  }

  /**
   * Helper methods
   */
  mapConsensusToScore(consensus) {
    const mapping = {
      'very-strong': 1.0,
      'strong': 0.8,
      'moderate': 0.6,
      'weak': 0.4,
      'very-weak': 0.2
    };
    return mapping[consensus] || 0.3;
  }

  calculateWeightDistribution(weights) {
    const values = Object.values(weights);
    if (values.length === 0) return 0;
    
    const max = Math.max(...values);
    const min = Math.min(...values);
    return max - min; // Higher values indicate more concentrated weights
  }

  normalizeSeverity(severity) {
    if (typeof severity === 'string') return severity;
    return 'medium'; // Default fallback
  }

  hasExceededReQueryLimit(correlationId) {
    const attempts = this.reQueryAttempts.get(correlationId);
    return attempts && attempts.count >= this.reQueryLimits.maxAttempts;
  }

  getReQueryAttemptCount(correlationId) {
    const attempts = this.reQueryAttempts.get(correlationId);
    return attempts ? attempts.count : 0;
  }

  recordReQueryAttempt(correlationId, strategy) {
    const existing = this.reQueryAttempts.get(correlationId) || { count: 0, attempts: [] };
    existing.count++;
    existing.attempts.push({
      timestamp: new Date().toISOString(),
      strategy: strategy.name
    });
    this.reQueryAttempts.set(correlationId, existing);
  }

  async recordReQueryOutcome(correlationId, result) {
    try {
      const record = {
        abstentionId: `abstention_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        correlationId,
        timestamp: new Date().toISOString(),
        ...result
      };

      this.abstentionHistory.set(record.abstentionId, record);

      // Keep only recent history
      if (this.abstentionHistory.size > 100) {
        const oldestKeys = Array.from(this.abstentionHistory.keys()).slice(0, 20);
        oldestKeys.forEach(key => this.abstentionHistory.delete(key));
      }

      monitoringService.log('info', 'Re-query outcome recorded', {
        abstentionId: record.abstentionId,
        strategy: result.strategy,
        improved: result.improvement?.isImproved,
        improvementPercentage: result.improvement?.improvementPercentage
      });
    } catch (error) {
      monitoringService.log('error', 'Failed to record re-query outcome', {
        error: error.message
      });
    }
  }

  /**
   * Get abstention statistics
   */
  getAbstentionStats() {
    const recentDecisions = Array.from(this.abstentionHistory.values()).slice(-50);
    
    if (recentDecisions.length === 0) {
      return { hasData: false };
    }

    const successfulImprovements = recentDecisions.filter(d => d.improvement?.isImproved).length;
    const avgImprovement = recentDecisions
      .filter(d => d.improvement?.improvement)
      .reduce((sum, d) => sum + d.improvement.improvement, 0) / recentDecisions.length;

    const strategyUsage = {};
    recentDecisions.forEach(d => {
      const strategy = d.strategy;
      strategyUsage[strategy] = (strategyUsage[strategy] || 0) + 1;
    });

    return {
      hasData: true,
      totalAbstentions: recentDecisions.length,
      successfulImprovements,
      improvementRate: (successfulImprovements / recentDecisions.length).toFixed(3),
      averageImprovement: avgImprovement.toFixed(3),
      strategyUsage,
      mostEffectiveStrategy: Object.keys(strategyUsage).reduce((a, b) => strategyUsage[a] > strategyUsage[b] ? a : b)
    };
  }
}

module.exports = AbstentionService;
