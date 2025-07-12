/**
 * 🔍 Post-Synthesis Validator - Advanced Quality Assessment
 *
 * 🎯 PURPOSE: Comprehensive validation system for synthesis quality using
 *            readability metrics, factual consistency, and novelty assessment
 *
 * 📋 KEY FEATURES:
 * 1. Flesch-Kincaid readability scoring with grade-level analysis
 * 2. Embedding-based factual consistency verification
 * 3. Novelty assessment comparing synthesis to original responses
 * 4. Threshold-based quality gates for regeneration triggers
 * 5. Comprehensive quality reporting and analytics
 * 6. Toxicity and bias detection integration
 *
 * 💡 ANALOGY: Like having a team of expert editors, fact-checkers, and
 *    quality assessors review every synthesized response before publication
 */

const semanticConfidenceService = require('./semanticConfidenceService');
const monitoringService = require('./monitoringService');

class PostSynthesisValidator {
  constructor() {
    this.validationMetrics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      regenerationTriggers: 0,
      averageQualityScore: 0,
      qualityDistribution: {
        excellent: 0,    // > 0.9
        good: 0,         // 0.7-0.9
        acceptable: 0,   // 0.5-0.7
        poor: 0          // < 0.5
      }
    };

    // Configurable quality thresholds
    this.thresholds = {
      readability: {
        minimum: 0.6,
        optimal: 0.8
      },
      factualConsistency: {
        minimum: 0.7,
        optimal: 0.85
      },
      novelty: {
        minimum: 0.5,
        optimal: 0.75
      },
      toxicity: {
        maximum: 0.3,
        optimal: 0.1
      },
      overall: {
        minimum: 0.65,
        optimal: 0.8
      }
    };
  }

  /**
   * Comprehensive validation of synthesis quality
   * @param {Object} synthesisResult - The synthesis to validate
   * @param {Array} originalOutputs - Original AI responses
   * @param {string} userPrompt - Original user prompt
   * @param {string} correlationId - Request correlation ID
   * @returns {Promise<Object>} Detailed validation results
   */
  async validateComprehensively(synthesisResult, originalOutputs, userPrompt, correlationId) {
    const startTime = Date.now();
    this.validationMetrics.totalValidations++;

    try {
      console.log(`🔍 [${correlationId}] Starting comprehensive synthesis validation...`);

      const content = synthesisResult.content;
      if (!content || content.length < 10) {
        return this.createFailedValidation('Content too short or empty', correlationId);
      }

      // Run all validation checks in parallel for efficiency
      const [
        readabilityResult,
        factualConsistencyResult,
        noveltyResult,
        toxicityResult,
        structuralResult
      ] = await Promise.all([
        this.validateReadability(content),
        this.validateFactualConsistency(content, originalOutputs),
        this.validateNovelty(content, originalOutputs),
        this.validateToxicity(content),
        this.validateStructure(content, userPrompt)
      ]);

      // Calculate overall quality score
      const overallQuality = this.calculateOverallQuality({
        readability: readabilityResult.score,
        factualConsistency: factualConsistencyResult.score,
        novelty: noveltyResult.score,
        toxicity: 1.0 - toxicityResult.score, // Invert toxicity (lower is better)
        structure: structuralResult.score
      });

      // Determine if validation passes thresholds
      const passesThreshold = this.checkThresholds({
        readability: readabilityResult.score,
        factualConsistency: factualConsistencyResult.score,
        novelty: noveltyResult.score,
        toxicity: toxicityResult.score,
        overall: overallQuality
      });

      // Create comprehensive validation result
      const validationResult = {
        passesThreshold,
        overallQuality,
        processingTime: Date.now() - startTime,
        
        // Individual metric results
        readability: readabilityResult,
        factualConsistency: factualConsistencyResult,
        novelty: noveltyResult,
        toxicity: toxicityResult,
        structure: structuralResult,
        
        // Quality assessment
        qualityLevel: this.determineQualityLevel(overallQuality),
        improvementSuggestions: this.generateImprovementSuggestions({
          readability: readabilityResult,
          factualConsistency: factualConsistencyResult,
          novelty: noveltyResult,
          toxicity: toxicityResult,
          structure: structuralResult
        }),
        
        // Metadata
        thresholds: this.thresholds,
        correlationId
      };

      // Update metrics
      this.updateValidationMetrics(validationResult);

      // Log validation results
      console.log(`📊 [${correlationId}] Validation completed - Quality: ${overallQuality.toFixed(2)}, Passes: ${passesThreshold}`);

      return validationResult;

    } catch (error) {
      console.error(`❌ [${correlationId}] Validation failed:`, error.message);
      return this.createFailedValidation(error.message, correlationId);
    }
  }

  /**
   * Validate readability using Flesch-Kincaid and other metrics
   */
  async validateReadability(content) {
    try {
      const readabilityMetrics = semanticConfidenceService.calculateReadability(content);
      
      // Calculate readability score (0-1, where 1 is optimal)
      const gradeLevel = readabilityMetrics.gradeLevel || 12;
      let score;
      
      // Optimal grade level is 8-12 for general audience
      if (gradeLevel >= 8 && gradeLevel <= 12) {
        score = 1.0;
      } else if (gradeLevel >= 6 && gradeLevel < 8) {
        score = 0.8; // Slightly too simple
      } else if (gradeLevel > 12 && gradeLevel <= 16) {
        score = 0.7; // Slightly too complex
      } else if (gradeLevel < 6) {
        score = 0.6; // Too simple
      } else {
        score = Math.max(0.3, 1.0 - ((gradeLevel - 16) * 0.1)); // Too complex
      }

      // Additional readability factors
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const words = content.split(/\s+/).filter(w => w.length > 0);
      const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
      
      // Adjust score based on sentence length
      if (avgWordsPerSentence > 25) {
        score *= 0.9; // Penalize very long sentences
      } else if (avgWordsPerSentence < 8) {
        score *= 0.95; // Slightly penalize very short sentences
      }

      return {
        score,
        gradeLevel,
        complexity: readabilityMetrics.complexity,
        avgWordsPerSentence,
        totalWords: words.length,
        totalSentences: sentences.length,
        details: readabilityMetrics
      };

    } catch (error) {
      console.warn('Readability validation failed:', error.message);
      return { score: 0.5, error: error.message };
    }
  }

  /**
   * Validate factual consistency using embedding similarity
   */
  async validateFactualConsistency(synthesisContent, originalOutputs) {
    try {
      if (!originalOutputs || originalOutputs.length === 0) {
        return { score: 0.5, reason: 'No original outputs to compare' };
      }

      const synthesisEmbedding = await semanticConfidenceService.generateEmbedding(
        synthesisContent, 
        `validation_synthesis_${Date.now()}`
      );

      let totalSimilarity = 0;
      let validComparisons = 0;
      const similarities = [];

      for (const output of originalOutputs) {
        try {
          const outputEmbedding = await semanticConfidenceService.generateEmbedding(
            output.content, 
            `validation_original_${Date.now()}_${validComparisons}`
          );
          
          const similarity = semanticConfidenceService.cosineSimilarity(synthesisEmbedding, outputEmbedding);
          similarities.push(similarity);
          totalSimilarity += similarity;
          validComparisons++;
        } catch (embeddingError) {
          console.warn('Failed to generate embedding for comparison:', embeddingError.message);
        }
      }

      if (validComparisons === 0) {
        return { score: 0.5, reason: 'No valid embeddings generated' };
      }

      const averageSimilarity = totalSimilarity / validComparisons;
      const maxSimilarity = Math.max(...similarities);
      const minSimilarity = Math.min(...similarities);

      // Score based on average similarity with bonus for consistency
      let score = averageSimilarity;
      const consistencyBonus = 1.0 - (maxSimilarity - minSimilarity); // Reward consistent similarity
      score = (score * 0.8) + (consistencyBonus * 0.2);

      return {
        score: Math.min(1.0, Math.max(0.0, score)),
        averageSimilarity,
        maxSimilarity,
        minSimilarity,
        consistencyScore: consistencyBonus,
        comparisons: validComparisons,
        similarities
      };

    } catch (error) {
      console.warn('Factual consistency validation failed:', error.message);
      return { score: 0.5, error: error.message };
    }
  }

  /**
   * Validate novelty and added value of synthesis
   */
  async validateNovelty(synthesisContent, originalOutputs) {
    try {
      if (!originalOutputs || originalOutputs.length === 0) {
        return { score: 0.5, reason: 'No original outputs to compare' };
      }

      // Tokenize synthesis and original content
      const synthesisTokens = new Set(
        synthesisContent.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(token => token.length > 2)
      );

      let allOriginalTokens = new Set();
      originalOutputs.forEach(output => {
        const tokens = output.content.toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(token => token.length > 2);
        tokens.forEach(token => allOriginalTokens.add(token));
      });

      // Calculate token-level novelty
      const uniqueTokens = [...synthesisTokens].filter(token => !allOriginalTokens.has(token));
      const tokenNovelty = uniqueTokens.length / Math.max(synthesisTokens.size, 1);

      // Calculate structural novelty (sentence patterns and organization)
      const synthesisSentences = synthesisContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const originalSentenceCount = originalOutputs.reduce((total, output) => {
        return total + output.content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      }, 0);

      const structuralNovelty = Math.min(1.0, synthesisSentences.length / Math.max(originalSentenceCount * 0.7, 1));

      // Calculate synthesis indicators (connecting words, transitions)
      const synthesisIndicators = [
        'however', 'therefore', 'furthermore', 'moreover', 'additionally',
        'in contrast', 'on the other hand', 'similarly', 'likewise',
        'combining', 'synthesizing', 'integrating', 'overall'
      ];
      
      const indicatorCount = synthesisIndicators.reduce((count, indicator) => {
        return count + (synthesisContent.toLowerCase().includes(indicator) ? 1 : 0);
      }, 0);
      
      const synthesisIndicatorScore = Math.min(1.0, indicatorCount / 3);

      // Combine novelty metrics
      const overallNovelty = (tokenNovelty * 0.4) + (structuralNovelty * 0.3) + (synthesisIndicatorScore * 0.3);

      return {
        score: Math.min(1.0, Math.max(0.0, overallNovelty)),
        tokenNovelty,
        structuralNovelty,
        synthesisIndicatorScore,
        uniqueTokenCount: uniqueTokens.length,
        totalTokens: synthesisTokens.size,
        synthesisIndicators: indicatorCount
      };

    } catch (error) {
      console.warn('Novelty validation failed:', error.message);
      return { score: 0.5, error: error.message };
    }
  }

  /**
   * Validate toxicity and bias
   */
  async validateToxicity(content) {
    try {
      const toxicityScore = semanticConfidenceService.calculateToxicityScore(content);
      
      return {
        score: toxicityScore,
        level: toxicityScore < 0.1 ? 'very-low' : 
               toxicityScore < 0.3 ? 'low' : 
               toxicityScore < 0.6 ? 'moderate' : 'high',
        passesThreshold: toxicityScore <= this.thresholds.toxicity.maximum
      };

    } catch (error) {
      console.warn('Toxicity validation failed:', error.message);
      return { score: 0.1, error: error.message };
    }
  }

  /**
   * Validate structural quality and organization
   */
  async validateStructure(content, userPrompt) {
    try {
      let score = 0.5; // Base score

      // Check for proper structure indicators
      const hasIntroduction = /^[A-Z]/.test(content.trim());
      const hasConclusion = /[.!]$/.test(content.trim());
      const hasParagraphs = content.includes('\n\n') || content.split(/[.!?]+/).length > 3;
      const hasLogicalFlow = /\b(first|second|third|finally|in conclusion|therefore|however)\b/i.test(content);

      if (hasIntroduction) score += 0.1;
      if (hasConclusion) score += 0.1;
      if (hasParagraphs) score += 0.15;
      if (hasLogicalFlow) score += 0.15;

      // Check relevance to user prompt
      const promptWords = userPrompt.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const contentWords = content.toLowerCase().split(/\s+/);
      const relevantWords = promptWords.filter(word => contentWords.includes(word));
      const relevanceScore = relevantWords.length / Math.max(promptWords.length, 1);
      
      score += relevanceScore * 0.2;

      return {
        score: Math.min(1.0, Math.max(0.0, score)),
        hasIntroduction,
        hasConclusion,
        hasParagraphs,
        hasLogicalFlow,
        relevanceScore,
        relevantWords: relevantWords.length,
        totalPromptWords: promptWords.length
      };

    } catch (error) {
      console.warn('Structure validation failed:', error.message);
      return { score: 0.5, error: error.message };
    }
  }
}

  /**
   * Calculate overall quality score from individual metrics
   */
  calculateOverallQuality(metrics) {
    const weights = {
      readability: 0.2,
      factualConsistency: 0.3,
      novelty: 0.25,
      toxicity: 0.15,
      structure: 0.1
    };

    return Object.keys(weights).reduce((total, metric) => {
      return total + (metrics[metric] * weights[metric]);
    }, 0);
  }

  /**
   * Check if all thresholds are met
   */
  checkThresholds(scores) {
    return (
      scores.readability >= this.thresholds.readability.minimum &&
      scores.factualConsistency >= this.thresholds.factualConsistency.minimum &&
      scores.novelty >= this.thresholds.novelty.minimum &&
      scores.toxicity <= this.thresholds.toxicity.maximum &&
      scores.overall >= this.thresholds.overall.minimum
    );
  }

  /**
   * Determine quality level based on overall score
   */
  determineQualityLevel(overallQuality) {
    if (overallQuality >= 0.9) return 'excellent';
    if (overallQuality >= 0.7) return 'good';
    if (overallQuality >= 0.5) return 'acceptable';
    return 'poor';
  }

  /**
   * Generate improvement suggestions based on validation results
   */
  generateImprovementSuggestions(validationResults) {
    const suggestions = [];

    if (validationResults.readability.score < this.thresholds.readability.minimum) {
      if (validationResults.readability.gradeLevel > 16) {
        suggestions.push('Simplify language and use shorter sentences for better readability');
      } else if (validationResults.readability.avgWordsPerSentence > 25) {
        suggestions.push('Break down long sentences into shorter, clearer statements');
      } else {
        suggestions.push('Improve sentence structure and word choice for better readability');
      }
    }

    if (validationResults.factualConsistency.score < this.thresholds.factualConsistency.minimum) {
      suggestions.push('Maintain closer alignment with the original AI responses to improve factual consistency');
    }

    if (validationResults.novelty.score < this.thresholds.novelty.minimum) {
      suggestions.push('Add more synthesis value by providing new insights and connections between ideas');
    }

    if (validationResults.toxicity.score > this.thresholds.toxicity.maximum) {
      suggestions.push('Review content for potentially harmful or biased language');
    }

    if (validationResults.structure.score < 0.6) {
      suggestions.push('Improve organization with clearer introduction, body, and conclusion structure');
    }

    return suggestions;
  }

  /**
   * Update validation metrics
   */
  updateValidationMetrics(validationResult) {
    if (validationResult.passesThreshold) {
      this.validationMetrics.passedValidations++;
    } else {
      this.validationMetrics.failedValidations++;
      this.validationMetrics.regenerationTriggers++;
    }

    // Update quality distribution
    const qualityLevel = validationResult.qualityLevel;
    this.validationMetrics.qualityDistribution[qualityLevel]++;

    // Update average quality score
    const totalValidations = this.validationMetrics.totalValidations;
    this.validationMetrics.averageQualityScore =
      ((this.validationMetrics.averageQualityScore * (totalValidations - 1)) + validationResult.overallQuality) / totalValidations;
  }

  /**
   * Create failed validation result
   */
  createFailedValidation(reason, correlationId) {
    console.warn(`⚠️ [${correlationId}] Validation failed: ${reason}`);

    this.validationMetrics.failedValidations++;

    return {
      passesThreshold: false,
      overallQuality: 0.0,
      qualityLevel: 'poor',
      error: reason,
      correlationId,
      improvementSuggestions: ['Address technical validation errors and retry']
    };
  }

  /**
   * Get validation service metrics
   */
  getMetrics() {
    const totalValidations = this.validationMetrics.totalValidations;

    return {
      ...this.validationMetrics,
      successRate: totalValidations > 0 ?
        (this.validationMetrics.passedValidations / totalValidations) : 0,
      regenerationRate: totalValidations > 0 ?
        (this.validationMetrics.regenerationTriggers / totalValidations) : 0,
      qualityDistributionPercentages: {
        excellent: totalValidations > 0 ?
          (this.validationMetrics.qualityDistribution.excellent / totalValidations * 100) : 0,
        good: totalValidations > 0 ?
          (this.validationMetrics.qualityDistribution.good / totalValidations * 100) : 0,
        acceptable: totalValidations > 0 ?
          (this.validationMetrics.qualityDistribution.acceptable / totalValidations * 100) : 0,
        poor: totalValidations > 0 ?
          (this.validationMetrics.qualityDistribution.poor / totalValidations * 100) : 0
      }
    };
  }

  /**
   * Update quality thresholds (for dynamic adjustment)
   */
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    console.log('📊 Validation thresholds updated:', this.thresholds);
  }

  /**
   * Health check for the validation service
   */
  async healthCheck() {
    try {
      // Test basic validation functionality
      const testContent = 'This is a test sentence for validation health check.';
      const testValidation = await this.validateReadability(testContent);

      return {
        status: 'healthy',
        readabilityTest: testValidation.score > 0,
        semanticService: await semanticConfidenceService.healthCheck(),
        metrics: this.getMetrics(),
        thresholds: this.thresholds
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        metrics: this.getMetrics()
      };
    }
  }
}

module.exports = new PostSynthesisValidator();
