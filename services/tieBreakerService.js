/**
 * ⚖️ Tie-Breaker Service - Advanced Voting Conflict Resolution
 *
 * 🎯 PURPOSE: Implement sophisticated tie-breaking logic with secondary voting
 *            rounds and fallback mechanisms when consensus is unclear
 *
 * 📋 KEY FEATURES:
 * 1. Multi-stage tie-breaking algorithms
 * 2. Secondary voting rounds with adjusted criteria
 * 3. Fallback to highest Brier-calibrated model
 * 4. Historical performance-based tie-breaking
 * 5. Diversity-weighted tie resolution
 * 6. Emergency fallback mechanisms
 *
 * 💡 ANALOGY: Like having a sophisticated court system with multiple levels
 *    of appeal and clear procedures for resolving deadlocks
 */

const monitoringService = require('./monitoringService');
const logger = require('../utils/visualLogger');

class TieBreakerService {
  constructor() {
    this.tieBreakerHistory = new Map();
    this.fallbackStrategies = new Map();
    
    // Configuration
    this.tieThresholds = {
      exact: 0.001,      // Weights within 0.1% are considered tied
      close: 0.02,       // Weights within 2% trigger tie-breaking
      moderate: 0.05,    // Weights within 5% may need tie-breaking
      significant: 0.1   // Weights within 10% for weak consensus
    };

    // Tie-breaking strategies in order of preference
    this.strategies = [
      'historical_performance',
      'diversity_weighted',
      'brier_calibrated',
      'response_time_adjusted',
      'semantic_confidence',
      'meta_voting',
      'random_selection'
    ];

    logger.success(
      'Tie-Breaker Service: Initialized',
      {
        'Strategies': this.strategies.length,
        'Thresholds': Object.keys(this.tieThresholds).join(', '),
        'Status': 'Ready for tie resolution'
      },
      'tie-breaker'
    );
  }

  /**
   * Analyze voting result for tie-breaking needs
   */
  analyzeTieBreakingNeeds(votingResult, roles) {
    const weights = Object.entries(votingResult.weights);
    if (weights.length < 2) {
      return { needsTieBreaking: false, reason: 'insufficient_candidates' };
    }

    // Sort by weight descending
    const sortedWeights = weights.sort((a, b) => b[1] - a[1]);
    const topWeight = sortedWeights[0][1];
    const secondWeight = sortedWeights[1][1];
    const weightDifference = topWeight - secondWeight;

    // Determine tie-breaking need
    let tieType = null;
    let needsTieBreaking = false;

    if (weightDifference <= this.tieThresholds.exact) {
      tieType = 'exact_tie';
      needsTieBreaking = true;
    } else if (weightDifference <= this.tieThresholds.close) {
      tieType = 'close_race';
      needsTieBreaking = true;
    } else if (weightDifference <= this.tieThresholds.moderate && votingResult.consensus === 'weak') {
      tieType = 'weak_consensus';
      needsTieBreaking = true;
    } else if (votingResult.consensus === 'very-weak') {
      tieType = 'very_weak_consensus';
      needsTieBreaking = true;
    }

    // Additional checks for tie-breaking triggers
    const multiWayTie = this.detectMultiWayTie(sortedWeights);
    if (multiWayTie.isTied) {
      tieType = 'multi_way_tie';
      needsTieBreaking = true;
    }

    return {
      needsTieBreaking,
      tieType,
      weightDifference,
      topCandidates: sortedWeights.slice(0, multiWayTie.tiedCount || 2),
      multiWayTie,
      consensusStrength: votingResult.consensus
    };
  }

  /**
   * Detect multi-way ties (3+ candidates with similar weights)
   */
  detectMultiWayTie(sortedWeights) {
    if (sortedWeights.length < 3) {
      return { isTied: false, tiedCount: 0 };
    }

    const topWeight = sortedWeights[0][1];
    let tiedCount = 1;

    for (let i = 1; i < sortedWeights.length; i++) {
      const weightDiff = topWeight - sortedWeights[i][1];
      if (weightDiff <= this.tieThresholds.close) {
        tiedCount++;
      } else {
        break;
      }
    }

    return {
      isTied: tiedCount >= 3,
      tiedCount,
      tiedCandidates: sortedWeights.slice(0, tiedCount)
    };
  }

  /**
   * Perform comprehensive tie-breaking
   */
  async performTieBreaking(tieAnalysis, votingResult, roles, services = {}) {
    try {
      const startTime = Date.now();
      
      monitoringService.log('info', 'Tie-breaking initiated', {
        tieType: tieAnalysis.tieType,
        candidates: tieAnalysis.topCandidates.length,
        weightDifference: tieAnalysis.weightDifference
      });

      // Try each strategy in order until one succeeds
      let tieBreakerResult = null;
      let strategyUsed = null;
      let attempts = [];

      for (const strategy of this.strategies) {
        try {
          const attempt = await this.executeStrategy(
            strategy, 
            tieAnalysis, 
            votingResult, 
            roles, 
            services
          );
          
          attempts.push({
            strategy,
            success: attempt.success,
            result: attempt.result,
            confidence: attempt.confidence,
            reasoning: attempt.reasoning
          });

          if (attempt.success && attempt.confidence > 0.1) {
            tieBreakerResult = attempt.result;
            strategyUsed = strategy;
            break;
          }
        } catch (error) {
          attempts.push({
            strategy,
            success: false,
            error: error.message
          });
          console.warn(`⚠️ Tie-breaking strategy ${strategy} failed:`, error.message);
        }
      }

      // If all strategies failed, use emergency fallback
      if (!tieBreakerResult) {
        tieBreakerResult = this.emergencyFallback(tieAnalysis, votingResult);
        strategyUsed = 'emergency_fallback';
      }

      const processingTime = Date.now() - startTime;

      const result = {
        tieBreakerUsed: true,
        strategyUsed,
        originalWinner: votingResult.winner,
        tieBreakerWinner: tieBreakerResult.winner,
        tieBreakerConfidence: tieBreakerResult.confidence,
        tieBreakerReasoning: tieBreakerResult.reasoning,
        
        // Final decision
        finalWinner: tieBreakerResult.winner,
        finalConfidence: tieBreakerResult.confidence,
        finalConsensus: this.calculateFinalConsensus(tieBreakerResult.confidence),
        
        // Metadata
        processingTime,
        strategiesAttempted: attempts.length,
        allAttempts: attempts,
        tieAnalysis,
        votingOverridden: tieBreakerResult.winner !== votingResult.winner
      };

      // Record tie-breaking decision
      await this.recordTieBreakerDecision(result);

      return result;
    } catch (error) {
      monitoringService.log('error', 'Tie-breaking failed completely', {
        error: error.message,
        tieType: tieAnalysis.tieType
      });
      
      // Return original voting result as ultimate fallback
      return {
        tieBreakerUsed: false,
        tieBreakerFailed: true,
        finalWinner: votingResult.winner,
        finalConfidence: votingResult.confidence * 0.8, // Reduce confidence
        finalConsensus: 'weak',
        error: error.message
      };
    }
  }

  /**
   * Execute a specific tie-breaking strategy
   */
  async executeStrategy(strategy, tieAnalysis, votingResult, roles, services) {
    switch (strategy) {
      case 'historical_performance':
        return await this.historicalPerformanceStrategy(tieAnalysis, roles, services.votingHistoryService);
      
      case 'diversity_weighted':
        return await this.diversityWeightedStrategy(tieAnalysis, roles, services.diversityScoreService);
      
      case 'brier_calibrated':
        return await this.brierCalibratedStrategy(tieAnalysis, roles, services.brierCalibrationService);
      
      case 'response_time_adjusted':
        return this.responseTimeAdjustedStrategy(tieAnalysis, roles);
      
      case 'semantic_confidence':
        return this.semanticConfidenceStrategy(tieAnalysis, roles);
      
      case 'meta_voting':
        return await this.metaVotingStrategy(tieAnalysis, roles, services.metaVoterService);
      
      case 'random_selection':
        return this.randomSelectionStrategy(tieAnalysis);
      
      default:
        throw new Error(`Unknown tie-breaking strategy: ${strategy}`);
    }
  }

  /**
   * Historical performance-based tie-breaking
   */
  async historicalPerformanceStrategy(tieAnalysis, roles, votingHistoryService) {
    if (!votingHistoryService) {
      return { success: false, reasoning: 'Voting history service not available' };
    }

    try {
      const candidates = tieAnalysis.topCandidates.map(([role, weight]) => role);
      const modelNames = candidates.map(role => {
        const roleData = roles.find(r => r.role === role);
        return roleData?.metadata?.model || roleData?.model || 'unknown';
      });

      // Get dynamic weights based on historical performance
      const dynamicWeights = await votingHistoryService.getDynamicWeights(modelNames);
      
      // Find the candidate with the highest historical performance weight
      let bestCandidate = null;
      let bestScore = 0;
      let reasoning = 'Selected based on historical performance: ';

      for (const candidate of candidates) {
        const roleData = roles.find(r => r.role === candidate);
        const modelName = roleData?.metadata?.model || roleData?.model || 'unknown';
        const historicalWeight = dynamicWeights[modelName] || 1.0;
        
        if (historicalWeight > bestScore) {
          bestScore = historicalWeight;
          bestCandidate = candidate;
        }
        
        reasoning += `${candidate}(${modelName}): ${historicalWeight.toFixed(3)}, `;
      }

      if (bestCandidate && bestScore > 1.0) {
        return {
          success: true,
          result: {
            winner: bestCandidate,
            confidence: Math.min(0.9, bestScore - 0.5), // Convert to confidence
            reasoning: reasoning.slice(0, -2) // Remove trailing comma
          },
          confidence: Math.min(0.9, bestScore - 0.5)
        };
      }

      return { success: false, reasoning: 'No clear historical performance advantage' };
    } catch (error) {
      return { success: false, reasoning: `Historical performance strategy failed: ${error.message}` };
    }
  }

  /**
   * Diversity-weighted tie-breaking
   */
  async diversityWeightedStrategy(tieAnalysis, roles, diversityScoreService) {
    if (!diversityScoreService) {
      return { success: false, reasoning: 'Diversity score service not available' };
    }

    try {
      const diversityResult = await diversityScoreService.calculateDiversityScores(roles);
      const candidates = tieAnalysis.topCandidates.map(([role, weight]) => role);
      
      let bestCandidate = null;
      let bestDiversityScore = 0;
      let reasoning = 'Selected based on response diversity: ';

      for (const candidate of candidates) {
        const diversityWeight = diversityResult.diversityWeights[candidate] || 1.0;
        const diversityScore = diversityWeight > 1.0 ? diversityWeight - 1.0 : 0;
        
        if (diversityScore > bestDiversityScore) {
          bestDiversityScore = diversityScore;
          bestCandidate = candidate;
        }
        
        reasoning += `${candidate}: ${diversityWeight.toFixed(3)}, `;
      }

      if (bestCandidate && bestDiversityScore > 0.05) {
        return {
          success: true,
          result: {
            winner: bestCandidate,
            confidence: Math.min(0.8, 0.5 + bestDiversityScore * 2),
            reasoning: reasoning.slice(0, -2)
          },
          confidence: Math.min(0.8, 0.5 + bestDiversityScore * 2)
        };
      }

      return { success: false, reasoning: 'No significant diversity advantage found' };
    } catch (error) {
      return { success: false, reasoning: `Diversity strategy failed: ${error.message}` };
    }
  }

  /**
   * Brier-calibrated tie-breaking
   */
  async brierCalibratedStrategy(tieAnalysis, roles, brierCalibrationService) {
    if (!brierCalibrationService) {
      return { success: false, reasoning: 'Brier calibration service not available' };
    }

    try {
      const candidates = tieAnalysis.topCandidates.map(([role, weight]) => role);
      
      let bestCandidate = null;
      let bestReliability = 0;
      let reasoning = 'Selected based on Brier score calibration: ';

      for (const candidate of candidates) {
        const roleData = roles.find(r => r.role === candidate);
        const modelName = roleData?.metadata?.model || roleData?.model || 'unknown';
        
        const accuracyMetrics = brierCalibrationService.getHistoricalAccuracyMetrics(modelName);
        
        if (accuracyMetrics.hasData && accuracyMetrics.reliability > bestReliability) {
          bestReliability = accuracyMetrics.reliability;
          bestCandidate = candidate;
        }
        
        reasoning += `${candidate}(${modelName}): ${accuracyMetrics.reliability?.toFixed(3) || 'N/A'}, `;
      }

      if (bestCandidate && bestReliability > 0.6) {
        return {
          success: true,
          result: {
            winner: bestCandidate,
            confidence: bestReliability,
            reasoning: reasoning.slice(0, -2)
          },
          confidence: bestReliability
        };
      }

      return { success: false, reasoning: 'No clear Brier calibration advantage' };
    } catch (error) {
      return { success: false, reasoning: `Brier calibration strategy failed: ${error.message}` };
    }
  }

  /**
   * Response time adjusted tie-breaking
   */
  responseTimeAdjustedStrategy(tieAnalysis, roles) {
    try {
      const candidates = tieAnalysis.topCandidates.map(([role, weight]) => role);
      
      let bestCandidate = null;
      let bestScore = Infinity;
      let reasoning = 'Selected based on response time efficiency: ';

      for (const candidate of candidates) {
        const roleData = roles.find(r => r.role === candidate);
        const responseTime = roleData?.responseTime || roleData?.metadata?.processingTime || Infinity;
        
        if (responseTime < bestScore) {
          bestScore = responseTime;
          bestCandidate = candidate;
        }
        
        reasoning += `${candidate}: ${responseTime}ms, `;
      }

      if (bestCandidate && bestScore < 30000) { // Less than 30 seconds
        const timeAdvantage = Math.max(0, 1 - (bestScore / 30000));
        return {
          success: true,
          result: {
            winner: bestCandidate,
            confidence: 0.4 + (timeAdvantage * 0.3), // 0.4-0.7 confidence range
            reasoning: reasoning.slice(0, -2)
          },
          confidence: 0.4 + (timeAdvantage * 0.3)
        };
      }

      return { success: false, reasoning: 'No significant response time advantage' };
    } catch (error) {
      return { success: false, reasoning: `Response time strategy failed: ${error.message}` };
    }
  }

  /**
   * Semantic confidence tie-breaking
   */
  semanticConfidenceStrategy(tieAnalysis, roles) {
    try {
      const candidates = tieAnalysis.topCandidates.map(([role, weight]) => role);
      
      let bestCandidate = null;
      let bestConfidence = 0;
      let reasoning = 'Selected based on semantic confidence: ';

      for (const candidate of candidates) {
        const roleData = roles.find(r => r.role === candidate);
        const semanticConfidence = roleData?.semanticConfidence?.score || 0;
        
        if (semanticConfidence > bestConfidence) {
          bestConfidence = semanticConfidence;
          bestCandidate = candidate;
        }
        
        reasoning += `${candidate}: ${semanticConfidence.toFixed(3)}, `;
      }

      if (bestCandidate && bestConfidence > 0.6) {
        return {
          success: true,
          result: {
            winner: bestCandidate,
            confidence: bestConfidence,
            reasoning: reasoning.slice(0, -2)
          },
          confidence: bestConfidence
        };
      }

      return { success: false, reasoning: 'No significant semantic confidence advantage' };
    } catch (error) {
      return { success: false, reasoning: `Semantic confidence strategy failed: ${error.message}` };
    }
  }

  /**
   * Meta-voting tie-breaking
   */
  async metaVotingStrategy(tieAnalysis, roles, metaVoterService) {
    if (!metaVoterService) {
      return { success: false, reasoning: 'Meta-voter service not available' };
    }

    try {
      // This would integrate with the meta-voter service
      // For now, return a placeholder
      return { success: false, reasoning: 'Meta-voting integration pending' };
    } catch (error) {
      return { success: false, reasoning: `Meta-voting strategy failed: ${error.message}` };
    }
  }

  /**
   * Random selection as last resort
   */
  randomSelectionStrategy(tieAnalysis) {
    const candidates = tieAnalysis.topCandidates.map(([role, weight]) => role);
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const winner = candidates[randomIndex];

    return {
      success: true,
      result: {
        winner,
        confidence: 0.3, // Low confidence for random selection
        reasoning: `Random selection from ${candidates.length} tied candidates: ${candidates.join(', ')}`
      },
      confidence: 0.3
    };
  }

  /**
   * Emergency fallback when all strategies fail
   */
  emergencyFallback(tieAnalysis, votingResult) {
    // Use the original winner with reduced confidence
    return {
      winner: votingResult.winner,
      confidence: Math.max(0.1, votingResult.confidence * 0.5),
      reasoning: 'Emergency fallback: all tie-breaking strategies failed, using original voting result with reduced confidence'
    };
  }

  /**
   * Calculate final consensus based on tie-breaker confidence
   */
  calculateFinalConsensus(confidence) {
    if (confidence >= 0.8) return 'strong';
    if (confidence >= 0.6) return 'moderate';
    if (confidence >= 0.4) return 'weak';
    return 'very-weak';
  }

  /**
   * Record tie-breaker decision for analysis
   */
  async recordTieBreakerDecision(tieBreakerResult) {
    try {
      const record = {
        tieBreakerDecisionId: `tiebreaker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...tieBreakerResult
      };

      this.tieBreakerHistory.set(record.tieBreakerDecisionId, record);

      // Keep only recent history
      if (this.tieBreakerHistory.size > 200) {
        const oldestKeys = Array.from(this.tieBreakerHistory.keys()).slice(0, 50);
        oldestKeys.forEach(key => this.tieBreakerHistory.delete(key));
      }

      monitoringService.log('info', 'Tie-breaker decision recorded', {
        tieBreakerDecisionId: record.tieBreakerDecisionId,
        strategy: record.strategyUsed,
        winner: record.tieBreakerWinner,
        confidence: record.tieBreakerConfidence
      });
    } catch (error) {
      monitoringService.log('error', 'Failed to record tie-breaker decision', {
        error: error.message
      });
    }
  }

  /**
   * Get tie-breaker statistics
   */
  getTieBreakerStats() {
    const recentDecisions = Array.from(this.tieBreakerHistory.values()).slice(-50);
    
    if (recentDecisions.length === 0) {
      return { hasData: false };
    }

    const strategyUsage = {};
    let totalOverrides = 0;
    let totalProcessingTime = 0;

    recentDecisions.forEach(decision => {
      const strategy = decision.strategyUsed;
      strategyUsage[strategy] = (strategyUsage[strategy] || 0) + 1;
      
      if (decision.votingOverridden) totalOverrides++;
      totalProcessingTime += decision.processingTime || 0;
    });

    return {
      hasData: true,
      totalDecisions: recentDecisions.length,
      overrideRate: (totalOverrides / recentDecisions.length).toFixed(3),
      averageProcessingTime: Math.round(totalProcessingTime / recentDecisions.length),
      strategyUsage,
      mostUsedStrategy: Object.keys(strategyUsage).reduce((a, b) => strategyUsage[a] > strategyUsage[b] ? a : b)
    };
  }
}

module.exports = TieBreakerService;
