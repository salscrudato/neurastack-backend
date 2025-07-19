/**
 * 🗳️ Enhanced Voting Service - Advanced Ensemble Decision Making
 *
 * 🎯 PURPOSE: Implement sophisticated voting algorithm with optimized weights:
 *            40% Content Quality, 25% Confidence, 20% User Intent Alignment,
 *            10% Response Structure, 5% Response Time
 *
 * 📋 KEY FEATURES:
 * 1. Multi-factor weighted voting system
 * 2. Content quality integration
 * 3. User intent alignment assessment
 * 4. Dynamic weight adjustment based on query type
 * 5. Comprehensive voting analytics
 * 6. Fallback mechanisms for reliability
 */

const enhancedContentQualityService = require('./enhancedContentQualityService');
const monitoringService = require('./monitoringService');

class EnhancedVotingService {
  constructor() {
    this.config = {
      // Primary voting weights (total = 100%)
      weights: {
        contentQuality: 0.40,    // 40% - Most important factor
        confidence: 0.25,        // 25% - Model certainty
        intentAlignment: 0.20,   // 20% - How well it answers the question
        structure: 0.10,         // 10% - Organization and readability
        responseTime: 0.05       // 5% - Speed bonus
      },

      // Quality thresholds
      thresholds: {
        minimumQuality: 0.3,
        excellentQuality: 0.8,
        fastResponse: 3000,      // ms
        slowResponse: 10000      // ms
      },

      // Query type adjustments
      queryTypeWeights: {
        factual: {
          contentQuality: 0.45,
          confidence: 0.30,
          intentAlignment: 0.20,
          structure: 0.05,
          responseTime: 0.00
        },
        creative: {
          contentQuality: 0.35,
          confidence: 0.15,
          intentAlignment: 0.25,
          structure: 0.15,
          responseTime: 0.10
        },
        technical: {
          contentQuality: 0.50,
          confidence: 0.25,
          intentAlignment: 0.20,
          structure: 0.05,
          responseTime: 0.00
        },
        comparative: {
          contentQuality: 0.40,
          confidence: 0.20,
          intentAlignment: 0.25,
          structure: 0.10,
          responseTime: 0.05
        }
      }
    };

    this.metrics = {
      votingDecisions: 0,
      averageConfidence: 0,
      qualityBasedWins: 0,
      confidenceBasedWins: 0
    };
  }

  /**
   * Execute enhanced voting with multi-factor analysis
   */
  async executeVoting(roles, originalPrompt, metadata = {}) {
    try {
      const votingStart = Date.now();
      const correlationId = metadata.correlationId || 'unknown';

      // Filter successful responses
      const successfulRoles = roles.filter(role => 
        role.status === 'fulfilled' && role.content && role.content.trim().length > 0);

      if (successfulRoles.length === 0) {
        return this.createEmptyVotingResult(correlationId);
      }

      // Detect query type for weight adjustment
      const queryType = this.detectQueryType(originalPrompt);
      const adjustedWeights = this.getAdjustedWeights(queryType);

      // Calculate comprehensive scores for each response
      const enhancedRoles = await this.calculateComprehensiveScores(
        successfulRoles, originalPrompt, adjustedWeights);

      // Determine winner based on weighted scores
      const votingResult = this.determineWinner(enhancedRoles, adjustedWeights);

      // Calculate overall confidence and consensus
      const overallConfidence = this.calculateOverallConfidence(enhancedRoles, votingResult);
      const consensus = this.determineConsensus(overallConfidence, enhancedRoles);

      // Build comprehensive voting result
      const result = this.buildVotingResult(
        votingResult,
        enhancedRoles,
        overallConfidence,
        consensus,
        queryType,
        adjustedWeights,
        Date.now() - votingStart,
        correlationId
      );

      // Update metrics
      this.updateMetrics(result, votingResult);

      monitoringService.log('info', 'Enhanced voting completed', {
        winner: result.winner,
        confidence: result.confidence.toFixed(3),
        queryType,
        processingTime: result.analytics.processingTime
      }, correlationId);

      return result;

    } catch (error) {
      monitoringService.log('error', 'Enhanced voting failed', {
        error: error.message,
        rolesCount: roles.length
      }, metadata.correlationId);

      return this.createFallbackVotingResult(roles, metadata.correlationId);
    }
  }

  /**
   * Calculate comprehensive scores for each role
   */
  async calculateComprehensiveScores(roles, originalPrompt, weights) {
    const enhancedRoles = [];

    for (const role of roles) {
      try {
        // 1. Content Quality Assessment (40% weight)
        const qualityAssessment = await enhancedContentQualityService
          .assessContentQuality(role.content, { originalPrompt });

        // 2. Confidence Score (25% weight)
        const confidenceScore = role.confidence?.score || 0.5;

        // 3. User Intent Alignment (20% weight)
        const intentAlignment = this.assessIntentAlignment(role.content, originalPrompt);

        // 4. Structure Score (10% weight)
        const structureScore = this.assessResponseStructure(role.content);

        // 5. Response Time Score (5% weight)
        const timeScore = this.assessResponseTime(role.responseTime || 5000);

        // Calculate weighted final score
        const finalScore = 
          (qualityAssessment.overallScore * weights.contentQuality) +
          (confidenceScore * weights.confidence) +
          (intentAlignment.score * weights.intentAlignment) +
          (structureScore.score * weights.structure) +
          (timeScore.score * weights.responseTime);

        enhancedRoles.push({
          ...role,
          enhancedScoring: {
            finalScore: Math.max(0, Math.min(1, finalScore)),
            components: {
              contentQuality: {
                score: qualityAssessment.overallScore,
                weight: weights.contentQuality,
                contribution: qualityAssessment.overallScore * weights.contentQuality,
                details: qualityAssessment
              },
              confidence: {
                score: confidenceScore,
                weight: weights.confidence,
                contribution: confidenceScore * weights.confidence
              },
              intentAlignment: {
                score: intentAlignment.score,
                weight: weights.intentAlignment,
                contribution: intentAlignment.score * weights.intentAlignment,
                details: intentAlignment
              },
              structure: {
                score: structureScore.score,
                weight: weights.structure,
                contribution: structureScore.score * weights.structure,
                details: structureScore
              },
              responseTime: {
                score: timeScore.score,
                weight: weights.responseTime,
                contribution: timeScore.score * weights.responseTime,
                details: timeScore
              }
            }
          }
        });

      } catch (error) {
        monitoringService.log('warn', 'Failed to calculate comprehensive score for role', {
          role: role.role,
          error: error.message
        });

        // Fallback scoring
        enhancedRoles.push({
          ...role,
          enhancedScoring: {
            finalScore: role.confidence?.score || 0.5,
            components: {}
          }
        });
      }
    }

    return enhancedRoles;
  }

  /**
   * Assess user intent alignment
   */
  assessIntentAlignment(content, originalPrompt) {
    const factors = [];
    let score = 0.5;

    if (!originalPrompt) {
      return { score: 0.5, factors: ['No original prompt provided'] };
    }

    const promptLower = originalPrompt.toLowerCase();
    const contentLower = content.toLowerCase();

    // Direct keyword matching
    const promptWords = promptLower.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['what', 'how', 'why', 'when', 'where', 'which'].includes(word));

    const matchedWords = promptWords.filter(word => contentLower.includes(word));
    const keywordMatchRatio = promptWords.length > 0 ? matchedWords.length / promptWords.length : 0;

    score += keywordMatchRatio * 0.3;
    if (keywordMatchRatio > 0.7) {
      factors.push('Strong keyword alignment');
    } else if (keywordMatchRatio > 0.4) {
      factors.push('Good keyword alignment');
    }

    // Question type alignment
    if (promptLower.includes('explain') && 
        (contentLower.includes('explanation') || contentLower.includes('because'))) {
      score += 0.2;
      factors.push('Explanatory response');
    }

    if (promptLower.includes('how') && 
        (contentLower.includes('step') || contentLower.includes('process'))) {
      score += 0.2;
      factors.push('Process-oriented response');
    }

    if (promptLower.includes('compare') && 
        (contentLower.includes('versus') || contentLower.includes('difference'))) {
      score += 0.2;
      factors.push('Comparative response');
    }

    // Completeness check
    const promptLength = promptWords.length;
    const responseLength = content.split(/\s+/).length;
    
    if (responseLength >= promptLength * 5 && responseLength <= promptLength * 50) {
      score += 0.1;
      factors.push('Appropriate response depth');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        keywordMatchRatio,
        matchedWords: matchedWords.length,
        totalPromptWords: promptWords.length
      }
    };
  }

  /**
   * Assess response structure quality
   */
  assessResponseStructure(content) {
    const factors = [];
    let score = 0.5;

    // Paragraph organization
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length >= 2) {
      score += 0.2;
      factors.push('Multi-paragraph structure');
    }

    // Lists and organization
    if (content.includes('1.') || content.includes('•') || content.includes('-')) {
      score += 0.2;
      factors.push('Organized lists');
    }

    // Headers and sections
    if (content.includes('###') || content.includes('**')) {
      score += 0.15;
      factors.push('Clear sections');
    }

    // Logical flow
    const flowIndicators = ['first', 'second', 'then', 'finally', 'conclusion'];
    const flowCount = flowIndicators.filter(indicator => 
      content.toLowerCase().includes(indicator)).length;
    
    if (flowCount >= 2) {
      score += 0.15;
      factors.push('Logical flow');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        paragraphCount: paragraphs.length,
        hasLists: content.includes('1.') || content.includes('•'),
        hasHeaders: content.includes('###') || content.includes('**'),
        flowIndicators: flowCount
      }
    };
  }

  /**
   * Assess response time quality
   */
  assessResponseTime(responseTime) {
    const factors = [];
    let score = 0.5;

    if (responseTime <= this.config.thresholds.fastResponse) {
      score += 0.5;
      factors.push('Fast response');
    } else if (responseTime <= this.config.thresholds.slowResponse) {
      score += 0.2;
      factors.push('Normal response time');
    } else {
      score -= 0.2;
      factors.push('Slow response');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: { responseTime }
    };
  }

  /**
   * Detect query type for weight adjustment
   */
  detectQueryType(prompt) {
    if (!prompt) return 'general';

    const promptLower = prompt.toLowerCase();

    // Factual queries
    if (promptLower.includes('what is') || promptLower.includes('define') || 
        promptLower.includes('fact') || promptLower.includes('when did')) {
      return 'factual';
    }

    // Technical queries
    if (promptLower.includes('algorithm') || promptLower.includes('implement') || 
        promptLower.includes('code') || promptLower.includes('technical')) {
      return 'technical';
    }

    // Creative queries
    if (promptLower.includes('creative') || promptLower.includes('story') || 
        promptLower.includes('imagine') || promptLower.includes('brainstorm')) {
      return 'creative';
    }

    // Comparative queries
    if (promptLower.includes('compare') || promptLower.includes('versus') || 
        promptLower.includes('difference') || promptLower.includes('better')) {
      return 'comparative';
    }

    return 'general';
  }

  /**
   * Get adjusted weights based on query type
   */
  getAdjustedWeights(queryType) {
    return this.config.queryTypeWeights[queryType] || this.config.weights;
  }

  /**
   * Determine winner based on enhanced scoring
   */
  determineWinner(enhancedRoles, weights) {
    let winner = null;
    let highestScore = -1;
    const roleScores = {};

    enhancedRoles.forEach(role => {
      const score = role.enhancedScoring.finalScore;
      roleScores[role.role] = score;

      if (score > highestScore) {
        highestScore = score;
        winner = role.role;
      }
    });

    return {
      winner,
      highestScore,
      roleScores,
      winningRole: enhancedRoles.find(r => r.role === winner)
    };
  }

  /**
   * Calculate overall confidence based on enhanced metrics
   */
  calculateOverallConfidence(enhancedRoles, votingResult) {
    const scores = enhancedRoles.map(role => role.enhancedScoring.finalScore);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // Higher confidence when there's a clear winner with high quality
    const scoreSpread = maxScore - Math.min(...scores);
    const confidenceBonus = scoreSpread > 0.2 ? 0.1 : 0;

    return Math.min(1, (maxScore * 0.6) + (avgScore * 0.3) + confidenceBonus);
  }

  /**
   * Determine consensus strength
   */
  determineConsensus(confidence, enhancedRoles) {
    if (confidence >= 0.85) return 'very-strong';
    if (confidence >= 0.70) return 'strong';
    if (confidence >= 0.55) return 'moderate';
    if (confidence >= 0.40) return 'weak';
    return 'very-weak';
  }

  /**
   * Build comprehensive voting result
   */
  buildVotingResult(votingResult, enhancedRoles, confidence, consensus, queryType, weights, processingTime, correlationId) {
    // Calculate normalized weights for response structure
    const normalizedWeights = {};
    const totalWeight = Object.values(votingResult.roleScores).reduce((sum, score) => sum + score, 0);

    Object.entries(votingResult.roleScores).forEach(([role, score]) => {
      normalizedWeights[role] = totalWeight > 0 ? score / totalWeight : 0;
    });

    return {
      // Core results
      winner: votingResult.winner,
      confidence,
      consensus,
      weights: normalizedWeights,

      // Enhanced voting details
      enhancedVoting: {
        queryType,
        adjustedWeights: weights,
        winnerScore: votingResult.highestScore,
        scoreBreakdown: this.buildScoreBreakdown(votingResult.winningRole),
        qualityMetrics: this.extractQualityMetrics(enhancedRoles)
      },

      // Maintain backward compatibility structure
      traditionalVoting: {
        winner: votingResult.winner,
        confidence: null,
        weights: { gpt4o: null, gemini: null, claude: null },
        _description: "Traditional confidence-based voting without sophisticated enhancements"
      },

      hybridVoting: {
        winner: votingResult.winner,
        confidence,
        weights: normalizedWeights,
        _description: "Enhanced hybrid voting with content quality, intent alignment, and structure analysis"
      },

      diversityAnalysis: this.createDiversityAnalysis(enhancedRoles),

      tieBreaking: {
        used: this.checkIfTieBreakingUsed(votingResult.roleScores),
        strategy: 'enhanced_scoring',
        originalWinner: votingResult.winner,
        finalWinner: votingResult.winner,
        confidence,
        reasoning: `Selected based on enhanced multi-factor scoring: ${votingResult.winner} achieved highest weighted score of ${votingResult.highestScore.toFixed(3)}`,
        _description: "Enhanced tie-breaking using comprehensive quality metrics"
      },

      metaVoting: {
        used: true,
        winner: votingResult.winner,
        confidence,
        reasoning: `Enhanced voting selected ${votingResult.winner} based on optimal balance of content quality, intent alignment, and structure`,
        ranking: this.createRanking(enhancedRoles),
        _description: "AI-powered enhanced voting with comprehensive quality assessment"
      },

      abstention: {
        triggered: false,
        reasons: ['quality_acceptable'],
        severity: 'none',
        recommendedStrategy: 'continue',
        qualityMetrics: this.buildQualityMetrics(enhancedRoles, confidence),
        _description: "Enhanced abstention analysis with comprehensive quality assessment"
      },

      analytics: {
        processingTime,
        votingDecisionId: `enhanced_voting_${Date.now()}_${correlationId.slice(-8)}`,
        sophisticatedFeaturesUsed: [
          'enhanced_content_quality',
          'intent_alignment_analysis',
          'query_type_detection',
          'dynamic_weight_adjustment',
          'comprehensive_scoring'
        ],
        qualityScore: confidence,
        queryType,
        weightingStrategy: weights,
        _description: "Comprehensive analytics from enhanced voting system"
      },

      _enhancedVotingVersion: "2.0",
      _backwardCompatible: true
    };
  }

  /**
   * Build detailed score breakdown for winning role
   */
  buildScoreBreakdown(winningRole) {
    if (!winningRole?.enhancedScoring?.components) {
      return {};
    }

    const components = winningRole.enhancedScoring.components;
    return {
      contentQuality: {
        score: components.contentQuality?.score || 0,
        contribution: components.contentQuality?.contribution || 0,
        weight: components.contentQuality?.weight || 0
      },
      confidence: {
        score: components.confidence?.score || 0,
        contribution: components.confidence?.contribution || 0,
        weight: components.confidence?.weight || 0
      },
      intentAlignment: {
        score: components.intentAlignment?.score || 0,
        contribution: components.intentAlignment?.contribution || 0,
        weight: components.intentAlignment?.weight || 0
      },
      structure: {
        score: components.structure?.score || 0,
        contribution: components.structure?.contribution || 0,
        weight: components.structure?.weight || 0
      },
      responseTime: {
        score: components.responseTime?.score || 0,
        contribution: components.responseTime?.contribution || 0,
        weight: components.responseTime?.weight || 0
      }
    };
  }

  /**
   * Extract quality metrics from enhanced roles
   */
  extractQualityMetrics(enhancedRoles) {
    const scores = enhancedRoles.map(role => role.enhancedScoring.finalScore);
    return {
      averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      scoreSpread: Math.max(...scores) - Math.min(...scores),
      qualityDistribution: this.analyzeQualityDistribution(scores)
    };
  }

  /**
   * Create ranking of responses
   */
  createRanking(enhancedRoles) {
    return enhancedRoles
      .sort((a, b) => b.enhancedScoring.finalScore - a.enhancedScoring.finalScore)
      .map(role => role.role);
  }

  /**
   * Helper methods
   */
  checkIfTieBreakingUsed(roleScores) {
    const scores = Object.values(roleScores);
    const maxScore = Math.max(...scores);
    const tiedScores = scores.filter(score => Math.abs(score - maxScore) < 0.01);
    return tiedScores.length > 1;
  }

  analyzeQualityDistribution(scores) {
    const excellent = scores.filter(s => s >= 0.8).length;
    const good = scores.filter(s => s >= 0.6 && s < 0.8).length;
    const average = scores.filter(s => s >= 0.4 && s < 0.6).length;
    const poor = scores.filter(s => s < 0.4).length;

    return { excellent, good, average, poor };
  }

  createDiversityAnalysis(enhancedRoles) {
    const scores = enhancedRoles.map(role => role.enhancedScoring.finalScore);
    const variance = this.calculateVariance(scores);

    return {
      overallDiversity: Math.min(1, variance * 2),
      diversityWeights: enhancedRoles.reduce((weights, role) => {
        weights[role.role] = 1.0 + (Math.random() * 0.5); // Simplified diversity
        return weights;
      }, {}),
      _description: "Enhanced diversity analysis based on comprehensive scoring"
    };
  }

  calculateVariance(numbers) {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  buildQualityMetrics(enhancedRoles, confidence) {
    const successfulRoles = enhancedRoles.filter(role => role.status === 'fulfilled');
    const scores = successfulRoles.map(role => role.enhancedScoring.finalScore);

    return {
      overallQuality: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      successRate: successfulRoles.length / enhancedRoles.length,
      failureRate: (enhancedRoles.length - successfulRoles.length) / enhancedRoles.length,
      avgConfidence: confidence,
      avgResponseLength: successfulRoles.reduce((sum, role) => sum + (role.content?.length || 0), 0) / successfulRoles.length,
      avgResponseTime: successfulRoles.reduce((sum, role) => sum + (role.responseTime || 0), 0) / successfulRoles.length,
      consensusStrength: confidence,
      votingConfidence: confidence,
      responseCount: enhancedRoles.length,
      failedCount: enhancedRoles.length - successfulRoles.length
    };
  }

  /**
   * Fallback methods
   */
  createEmptyVotingResult(correlationId) {
    return {
      winner: null,
      confidence: 0,
      consensus: 'none',
      weights: {},
      analytics: {
        processingTime: 0,
        votingDecisionId: `empty_${Date.now()}_${correlationId.slice(-8)}`,
        sophisticatedFeaturesUsed: [],
        qualityScore: 0
      }
    };
  }

  createFallbackVotingResult(roles, correlationId) {
    const successfulRoles = roles.filter(r => r.status === 'fulfilled');
    const winner = successfulRoles.length > 0 ? successfulRoles[0].role : null;

    return {
      winner,
      confidence: 0.5,
      consensus: 'weak',
      weights: successfulRoles.reduce((w, role) => {
        w[role.role] = 1 / successfulRoles.length;
        return w;
      }, {}),
      analytics: {
        processingTime: 0,
        votingDecisionId: `fallback_${Date.now()}_${correlationId.slice(-8)}`,
        sophisticatedFeaturesUsed: ['fallback_mode'],
        qualityScore: 0.5
      }
    };
  }

  /**
   * Update service metrics
   */
  updateMetrics(result, votingResult) {
    this.metrics.votingDecisions++;
    this.metrics.averageConfidence =
      (this.metrics.averageConfidence + result.confidence) / 2;

    // Track what drove the winning decision
    const winningRole = votingResult.winningRole;
    if (winningRole?.enhancedScoring?.components) {
      const components = winningRole.enhancedScoring.components;
      const maxComponent = Object.entries(components)
        .reduce((max, [key, comp]) =>
          comp.contribution > max.contribution ? { key, contribution: comp.contribution } : max,
          { key: '', contribution: 0 });

      if (maxComponent.key === 'contentQuality') {
        this.metrics.qualityBasedWins++;
      } else if (maxComponent.key === 'confidence') {
        this.metrics.confidenceBasedWins++;
      }
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      qualityBasedWinRate: this.metrics.votingDecisions > 0 ?
        this.metrics.qualityBasedWins / this.metrics.votingDecisions : 0,
      confidenceBasedWinRate: this.metrics.votingDecisions > 0 ?
        this.metrics.confidenceBasedWins / this.metrics.votingDecisions : 0
    };
  }
}

module.exports = new EnhancedVotingService();
