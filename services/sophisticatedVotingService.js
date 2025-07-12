/**
 * 🗳️ Sophisticated Voting Service - Advanced Ensemble Decision Making
 *
 * 🎯 PURPOSE: Orchestrate sophisticated voting mechanisms combining diversity scores,
 *            historical accuracy, meta-voting, tie-breaking, and abstention logic
 *
 * 📋 KEY FEATURES:
 * 1. Hybrid voting system with multiple factors
 * 2. Diversity-weighted voting with semantic analysis
 * 3. Historical model accuracy integration
 * 4. Meta-voting for inconclusive results
 * 5. Sophisticated tie-breaking mechanisms
 * 6. Abstention and re-query logic
 * 7. Comprehensive voting analytics
 *
 * 💡 ANALOGY: Like a supreme electoral commission that uses multiple
 *    sophisticated methods to ensure the most accurate democratic decisions
 */

const VotingHistoryService = require('./votingHistoryService');
const DiversityScoreService = require('./diversityScoreService');
const MetaVoterService = require('./metaVoterService');
const TieBreakerService = require('./tieBreakerService');
const AbstentionService = require('./abstentionService');
const BrierCalibrationService = require('./brierCalibrationService');
const monitoringService = require('./monitoringService');
const logger = require('../utils/visualLogger');

class SophisticatedVotingService {
  constructor() {
    // Initialize all voting services
    this.votingHistoryService = new VotingHistoryService();
    this.diversityScoreService = new DiversityScoreService();
    this.metaVoterService = new MetaVoterService();
    this.tieBreakerService = new TieBreakerService();
    this.abstentionService = new AbstentionService();
    this.brierCalibrationService = new BrierCalibrationService();
    
    // Voting configuration
    this.votingConfig = {
      enableDiversityWeighting: true,
      enableHistoricalAccuracy: true,
      enableMetaVoting: true,
      enableTieBreaking: true,
      enableAbstention: true,
      
      // Weight factors for hybrid voting
      weightFactors: {
        traditional: 0.3,      // Traditional confidence-based weights
        diversity: 0.2,        // Diversity-based adjustments
        historical: 0.25,      // Historical performance
        semantic: 0.15,        // Semantic confidence
        reliability: 0.1       // Provider reliability
      }
    };

    logger.success(
      'Sophisticated Voting Service: Initialized',
      {
        'Services': 6,
        'Features': Object.keys(this.votingConfig).filter(k => k.startsWith('enable')).length,
        'Weight Factors': Object.keys(this.votingConfig.weightFactors).length,
        'Status': 'Ready for advanced voting'
      },
      'sophisticated-voting'
    );
  }

  /**
   * Execute sophisticated voting process
   */
  async executeSophisticatedVoting(roles, originalPrompt, requestMetadata = {}) {
    try {
      const startTime = Date.now();
      const correlationId = requestMetadata.correlationId || `voting_${Date.now()}`;

      monitoringService.log('info', 'Sophisticated voting initiated', {
        correlationId,
        responses: roles.filter(r => r.status === 'fulfilled').length,
        failed: roles.filter(r => r.status === 'rejected').length
      });

      // Step 1: Calculate diversity scores
      const diversityResult = await this.diversityScoreService.calculateDiversityScores(roles);

      // Step 2: Calculate traditional voting weights
      const traditionalVoting = this.calculateTraditionalVoting(roles);

      // Step 3: Get historical performance weights
      const historicalWeights = await this.getHistoricalWeights(roles);

      // Step 4: Calculate hybrid voting weights
      const hybridVoting = this.calculateHybridVoting(
        roles, 
        traditionalVoting, 
        diversityResult, 
        historicalWeights
      );

      // Step 5: Check for tie-breaking needs
      const tieAnalysis = this.tieBreakerService.analyzeTieBreakingNeeds(hybridVoting, roles);

      let finalVoting = hybridVoting;
      let tieBreakerResult = null;
      let metaVotingResult = null;

      // Step 6: Apply tie-breaking if needed
      if (tieAnalysis.needsTieBreaking) {
        tieBreakerResult = await this.tieBreakerService.performTieBreaking(
          tieAnalysis,
          hybridVoting,
          roles,
          {
            votingHistoryService: this.votingHistoryService,
            diversityScoreService: this.diversityScoreService,
            brierCalibrationService: this.brierCalibrationService,
            metaVoterService: this.metaVoterService
          }
        );

        if (tieBreakerResult.tieBreakerUsed) {
          finalVoting = {
            ...hybridVoting,
            winner: tieBreakerResult.finalWinner,
            confidence: tieBreakerResult.finalConfidence,
            consensus: tieBreakerResult.finalConsensus
          };
        }
      }

      // Step 7: Check for meta-voting needs
      if (this.metaVoterService.shouldTriggerMetaVoting(finalVoting, roles)) {
        metaVotingResult = await this.metaVoterService.performMetaVoting(
          roles,
          originalPrompt,
          finalVoting,
          requestMetadata
        );

        if (metaVotingResult.metaVotingUsed) {
          finalVoting = {
            ...finalVoting,
            winner: metaVotingResult.finalWinner,
            confidence: metaVotingResult.finalConfidence,
            consensus: metaVotingResult.finalConsensus
          };
        }
      }

      // Step 8: Check for abstention needs
      const abstentionAnalysis = this.abstentionService.analyzeAbstentionNeed(
        finalVoting,
        roles,
        diversityResult,
        requestMetadata
      );

      let abstentionResult = null;
      if (abstentionAnalysis.shouldAbstain) {
        // Note: Abstention would trigger a re-query, which is handled at a higher level
        abstentionResult = abstentionAnalysis;
      }

      // Step 9: Record voting decision
      const votingDecisionId = await this.votingHistoryService.recordVotingDecision(
        {
          ...finalVoting,
          diversityScore: diversityResult.overallDiversity,
          semanticSimilarity: diversityResult.pairwiseSimilarities,
          tieBreaking: tieBreakerResult?.tieBreakerUsed || false,
          metaVotingUsed: metaVotingResult?.metaVotingUsed || false,
          abstentionTriggered: abstentionResult?.shouldAbstain || false
        },
        roles,
        requestMetadata
      );

      const processingTime = Date.now() - startTime;

      // Step 10: Compile comprehensive result
      const sophisticatedVotingResult = {
        // Core voting result
        winner: finalVoting.winner,
        confidence: finalVoting.confidence,
        consensus: finalVoting.consensus,
        weights: finalVoting.weights,

        // Sophisticated voting components
        traditionalVoting: {
          winner: traditionalVoting.winner,
          confidence: traditionalVoting.confidence,
          weights: traditionalVoting.weights,
          _description: "Traditional confidence-based voting without sophisticated enhancements"
        },

        hybridVoting: {
          winner: hybridVoting.winner,
          confidence: hybridVoting.confidence,
          weights: hybridVoting.weights,
          _description: "Hybrid voting combining traditional, diversity, historical, and semantic factors"
        },

        diversityAnalysis: {
          overallDiversity: diversityResult.overallDiversity,
          diversityWeights: diversityResult.diversityWeights,
          clusterAnalysis: diversityResult.clusterAnalysis,
          _description: "Semantic diversity analysis showing how different responses are from each other"
        },

        historicalPerformance: {
          weights: historicalWeights,
          _description: "Model weights based on historical voting performance and accuracy"
        },

        // Advanced voting mechanisms
        tieBreaking: tieBreakerResult ? {
          used: true,
          strategy: tieBreakerResult.strategyUsed,
          originalWinner: tieBreakerResult.originalWinner,
          finalWinner: tieBreakerResult.tieBreakerWinner,
          confidence: tieBreakerResult.tieBreakerConfidence,
          reasoning: tieBreakerResult.tieBreakerReasoning,
          _description: "Tie-breaking mechanism used when traditional voting was inconclusive"
        } : {
          used: false,
          _description: "No tie-breaking was needed for this voting decision"
        },

        metaVoting: metaVotingResult ? {
          used: metaVotingResult.metaVotingUsed,
          winner: metaVotingResult.metaWinner,
          confidence: metaVotingResult.metaConfidence,
          reasoning: metaVotingResult.metaReasoning,
          ranking: metaVotingResult.metaRanking,
          _description: "AI-powered meta-voting analysis for quality assessment and ranking"
        } : {
          used: false,
          _description: "Meta-voting was not triggered for this decision"
        },

        abstention: abstentionResult ? {
          triggered: abstentionResult.shouldAbstain,
          reasons: abstentionResult.reasons,
          severity: abstentionResult.severity,
          recommendedStrategy: abstentionResult.recommendedStrategy?.name,
          qualityMetrics: abstentionResult.qualityMetrics,
          _description: "Abstention analysis determining if response quality requires re-querying"
        } : {
          triggered: false,
          _description: "No abstention was needed - response quality was acceptable"
        },

        // Analytics and metadata
        analytics: {
          processingTime,
          votingDecisionId,
          sophisticatedFeaturesUsed: [
            ...(diversityResult.overallDiversity > 0 ? ['diversity_analysis'] : []),
            ...(Object.keys(historicalWeights).length > 0 ? ['historical_performance'] : []),
            ...(tieBreakerResult?.tieBreakerUsed ? ['tie_breaking'] : []),
            ...(metaVotingResult?.metaVotingUsed ? ['meta_voting'] : []),
            ...(abstentionResult?.shouldAbstain ? ['abstention'] : [])
          ],
          qualityScore: this.calculateOverallQualityScore(finalVoting, diversityResult, roles),
          _description: "Comprehensive analytics showing which sophisticated voting features were utilized"
        },

        // Backward compatibility
        _sophisticatedVotingVersion: '1.0',
        _backwardCompatible: true
      };

      monitoringService.log('info', 'Sophisticated voting completed', {
        correlationId,
        winner: sophisticatedVotingResult.winner,
        confidence: sophisticatedVotingResult.confidence,
        consensus: sophisticatedVotingResult.consensus,
        featuresUsed: sophisticatedVotingResult.analytics.sophisticatedFeaturesUsed.length,
        processingTime
      });

      return sophisticatedVotingResult;
    } catch (error) {
      monitoringService.log('error', 'Sophisticated voting failed', {
        error: error.message,
        correlationId: requestMetadata.correlationId
      });
      
      // Fallback to traditional voting
      return this.getFallbackVoting(roles, error);
    }
  }

  /**
   * Calculate traditional voting weights (existing logic)
   */
  calculateTraditionalVoting(roles) {
    const successful = roles.filter(r => r.status === 'fulfilled');
    if (successful.length === 0) {
      return { winner: null, confidence: 0, weights: {}, consensus: 'none' };
    }

    const weights = {};
    let totalWeight = 0;

    successful.forEach(role => {
      // Use existing confidence calculation logic
      const confidence = role.confidence || 0.5;
      const responseTime = role.responseTime || 5000;
      const contentLength = role.content?.length || 0;

      // Traditional weight calculation
      let weight = confidence;
      
      // Response time factor
      if (responseTime < 3000) weight *= 1.1;
      else if (responseTime > 15000) weight *= 0.9;
      
      // Content length factor
      if (contentLength > 50 && contentLength < 2000) weight *= 1.05;
      else if (contentLength < 20) weight *= 0.8;

      weights[role.role] = weight;
      totalWeight += weight;
    });

    // Normalize weights
    Object.keys(weights).forEach(role => {
      weights[role] = weights[role] / totalWeight;
    });

    // Find winner
    const winner = Object.keys(weights).reduce((a, b) => weights[a] > weights[b] ? a : b);
    const confidence = weights[winner];
    const consensus = this.calculateConsensus(weights);

    return { winner, confidence, weights, consensus };
  }

  /**
   * Get historical performance weights
   */
  async getHistoricalWeights(roles) {
    try {
      const successful = roles.filter(r => r.status === 'fulfilled');
      const modelNames = successful.map(r => r.metadata?.model || r.model || 'unknown');
      
      return await this.votingHistoryService.getDynamicWeights(modelNames);
    } catch (error) {
      console.warn('⚠️ Failed to get historical weights:', error.message);
      return {};
    }
  }

  /**
   * Calculate hybrid voting weights combining all factors
   */
  calculateHybridVoting(roles, traditionalVoting, diversityResult, historicalWeights) {
    const successful = roles.filter(r => r.status === 'fulfilled');
    const hybridWeights = {};
    let totalWeight = 0;

    successful.forEach(role => {
      const roleName = role.role;
      const modelName = role.metadata?.model || role.model || 'unknown';

      // Get component weights
      const traditionalWeight = traditionalVoting.weights[roleName] || 0;
      const diversityWeight = diversityResult.diversityWeights[roleName] || 1.0;
      const historicalWeight = historicalWeights[modelName] || 1.0;
      const semanticWeight = role.semanticConfidence?.score || 0.5;
      const reliabilityWeight = this.getReliabilityWeight(role);

      // Calculate hybrid weight using configured factors
      const factors = this.votingConfig.weightFactors;
      const hybridWeight = (
        traditionalWeight * factors.traditional +
        (diversityWeight - 1.0) * factors.diversity + factors.traditional + // Adjust diversity around baseline
        (historicalWeight - 1.0) * factors.historical + factors.traditional + // Adjust historical around baseline
        semanticWeight * factors.semantic +
        reliabilityWeight * factors.reliability
      );

      hybridWeights[roleName] = Math.max(0.01, hybridWeight); // Ensure positive weights
      totalWeight += hybridWeights[roleName];
    });

    // Normalize weights
    Object.keys(hybridWeights).forEach(role => {
      hybridWeights[role] = hybridWeights[role] / totalWeight;
    });

    // Find winner and calculate consensus
    const winner = Object.keys(hybridWeights).reduce((a, b) => 
      hybridWeights[a] > hybridWeights[b] ? a : b
    );
    const confidence = hybridWeights[winner];
    const consensus = this.calculateConsensus(hybridWeights);

    return { winner, confidence, weights: hybridWeights, consensus };
  }

  /**
   * Get reliability weight for a role
   */
  getReliabilityWeight(role) {
    // Simple reliability calculation based on response characteristics
    let reliability = 0.5;
    
    if (role.responseTime && role.responseTime < 10000) reliability += 0.2;
    if (role.content && role.content.length > 100) reliability += 0.1;
    if (role.confidence && role.confidence > 0.7) reliability += 0.2;
    
    return Math.min(1.0, reliability);
  }

  /**
   * Calculate consensus strength from weights
   */
  calculateConsensus(weights) {
    const values = Object.values(weights).sort((a, b) => b - a);
    if (values.length === 0) return 'none';
    
    const maxWeight = values[0];
    const secondWeight = values[1] || 0;
    const margin = maxWeight - secondWeight;
    
    if (maxWeight > 0.7 && margin > 0.3) return 'very-strong';
    if (maxWeight > 0.6 && margin > 0.2) return 'strong';
    if (maxWeight > 0.45) return 'moderate';
    if (maxWeight > 0.35) return 'weak';
    return 'very-weak';
  }

  /**
   * Calculate overall quality score
   */
  calculateOverallQualityScore(voting, diversityResult, roles) {
    const successRate = roles.filter(r => r.status === 'fulfilled').length / roles.length;
    const consensusScore = this.mapConsensusToScore(voting.consensus);
    const diversityScore = diversityResult.overallDiversity;
    const confidence = voting.confidence;

    return (successRate * 0.3 + consensusScore * 0.3 + confidence * 0.25 + diversityScore * 0.15);
  }

  /**
   * Map consensus to numeric score
   */
  mapConsensusToScore(consensus) {
    const mapping = {
      'very-strong': 1.0,
      'strong': 0.8,
      'moderate': 0.6,
      'weak': 0.4,
      'very-weak': 0.2,
      'none': 0
    };
    return mapping[consensus] || 0.3;
  }

  /**
   * Get fallback voting result on error
   */
  getFallbackVoting(roles, error) {
    const traditionalVoting = this.calculateTraditionalVoting(roles);
    
    return {
      ...traditionalVoting,
      sophisticatedVotingFailed: true,
      fallbackUsed: true,
      error: error.message,
      _description: "Sophisticated voting failed, using traditional voting as fallback"
    };
  }

  /**
   * Get voting service statistics
   */
  getVotingStats() {
    return {
      votingHistory: this.votingHistoryService ? 'available' : 'unavailable',
      diversityScoring: this.diversityScoreService ? 'available' : 'unavailable',
      metaVoting: this.metaVoterService ? 'available' : 'unavailable',
      tieBreaking: this.tieBreakerService ? 'available' : 'unavailable',
      abstention: this.abstentionService ? 'available' : 'unavailable',
      
      // Get individual service stats
      metaVotingStats: this.metaVoterService?.getMetaVotingStats(),
      tieBreakerStats: this.tieBreakerService?.getTieBreakerStats(),
      abstentionStats: this.abstentionService?.getAbstentionStats()
    };
  }
}

module.exports = SophisticatedVotingService;
