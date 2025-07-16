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

const dynamicConfig = require('../config/dynamicConfig');
const semanticConfidenceService = require('./semanticConfidenceService');
const monitoringService = require('./monitoringService');
const {
  ValidationError,
  errorHandler,
  retryWithBackoff
} = require('../utils/errorHandler');

class PostSynthesisValidator {
  constructor() {
    this.validationMetrics = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0,
      regenerationTriggers: 0,
      regenerationSuccesses: 0,
      regenerationFailures: 0,
      fallbackValidationsUsed: 0,
      retriesPerformed: 0,
      averageQualityScore: 0,
      qualityDistribution: {
        excellent: 0,    // > 0.9
        good: 0,         // 0.7-0.9
        acceptable: 0,   // 0.5-0.7
        poor: 0          // < 0.5
      }
    };

    // Configurable quality thresholds - using dynamic config
    this.thresholds = {
      readability: {
        minimum: dynamicConfig.validation.thresholds.readability.minimum,
        optimal: dynamicConfig.validation.thresholds.readability.optimal
      },
      factualConsistency: {
        minimum: dynamicConfig.validation.thresholds.factualConsistency.minimum,
        optimal: dynamicConfig.validation.thresholds.factualConsistency.optimal
      },
      novelty: {
        minimum: dynamicConfig.validation.thresholds.novelty.minimum,
        optimal: dynamicConfig.validation.thresholds.novelty.optimal
      },
      toxicity: {
        maximum: dynamicConfig.validation.thresholds.toxicity.maximum,
        optimal: dynamicConfig.validation.thresholds.toxicity.optimal
      },
      overall: {
        minimum: dynamicConfig.validation.thresholds.overall.minimum,
        optimal: dynamicConfig.validation.thresholds.overall.optimal
      }
    };

    console.log('🚀 Post-Synthesis Validator initialized with dynamic configuration');
    console.log(`   Readability Min/Optimal: ${this.thresholds.readability.minimum}/${this.thresholds.readability.optimal}`);
    console.log(`   Factual Consistency Min/Optimal: ${this.thresholds.factualConsistency.minimum}/${this.thresholds.factualConsistency.optimal}`);
    console.log(`   Overall Quality Min/Optimal: ${this.thresholds.overall.minimum}/${this.thresholds.overall.optimal}`);
  }

  /**
   * Comprehensive validation with regeneration capabilities
   * @param {Object} synthesisResult - The synthesis to validate
   * @param {Array} originalOutputs - Original AI responses
   * @param {string} userPrompt - Original user prompt
   * @param {string} correlationId - Request correlation ID
   * @param {Object} options - Validation options including regeneration callback
   * @returns {Promise<Object>} Detailed validation results
   */
  async validateWithRegeneration(synthesisResult, originalOutputs, userPrompt, correlationId, options = {}) {
    const {
      regenerationCallback = null,
      maxRegenerationAttempts = 2,
      enableFallbackValidation = true
    } = options;

    let currentSynthesis = synthesisResult;
    let regenerationAttempt = 0;
    let regenerationHistory = [];

    while (regenerationAttempt <= maxRegenerationAttempts) {
      try {
        // Perform validation
        const validationResult = await this.validateComprehensively(
          currentSynthesis,
          originalOutputs,
          userPrompt,
          correlationId
        );

        // If validation passes or no regeneration callback, return result
        if (validationResult.passesThreshold || !regenerationCallback || regenerationAttempt >= maxRegenerationAttempts) {
          if (regenerationAttempt > 0) {
            validationResult.regenerationUsed = true;
            validationResult.regenerationAttempts = regenerationAttempt;
            validationResult.regenerationHistory = regenerationHistory;
          }
          return validationResult;
        }

        // Validation failed, attempt regeneration
        regenerationAttempt++;
        this.validationMetrics.regenerationTriggers++;

        monitoringService.log('warn', `Validation failed, attempting regeneration ${regenerationAttempt}`, {
          correlationId,
          qualityScore: validationResult.overallQuality,
          failedMetrics: this.getFailedMetrics(validationResult),
          attempt: regenerationAttempt
        }, correlationId);

        // Store regeneration attempt info
        regenerationHistory.push({
          attempt: regenerationAttempt,
          previousQuality: validationResult.overallQuality,
          failedMetrics: this.getFailedMetrics(validationResult),
          timestamp: new Date().toISOString()
        });

        // Attempt regeneration
        const regeneratedSynthesis = await this.attemptRegeneration(
          currentSynthesis,
          validationResult,
          originalOutputs,
          userPrompt,
          correlationId,
          regenerationCallback
        );

        if (regeneratedSynthesis) {
          currentSynthesis = regeneratedSynthesis;
          this.validationMetrics.regenerationSuccesses++;
        } else {
          this.validationMetrics.regenerationFailures++;
          break;
        }

      } catch (error) {
        monitoringService.log('error', 'Validation with regeneration failed', {
          error: error.message,
          regenerationAttempt,
          correlationId
        }, correlationId);

        // Use fallback validation if enabled
        if (enableFallbackValidation) {
          return this.performFallbackValidation(currentSynthesis, correlationId, error);
        }

        throw error;
      }
    }

    // If we get here, regeneration failed
    const finalValidation = await this.validateComprehensively(
      currentSynthesis,
      originalOutputs,
      userPrompt,
      correlationId
    );

    finalValidation.regenerationUsed = true;
    finalValidation.regenerationAttempts = regenerationAttempt;
    finalValidation.regenerationHistory = regenerationHistory;
    finalValidation.regenerationExhausted = true;

    return finalValidation;
  }

  /**
   * Original comprehensive validation method (enhanced with error handling)
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

      // Run all validation checks in parallel with error handling
      const validationPromises = [
        this.executeValidationWithRetry('readability', () => this.validateReadability(content), correlationId),
        this.executeValidationWithRetry('factualConsistency', () => this.validateFactualConsistency(content, originalOutputs), correlationId),
        this.executeValidationWithRetry('novelty', () => this.validateNovelty(content, originalOutputs), correlationId),
        this.executeValidationWithRetry('toxicity', () => this.validateToxicity(content), correlationId),
        this.executeValidationWithRetry('structure', () => this.validateStructure(content, userPrompt), correlationId)
      ];

      const results = await Promise.allSettled(validationPromises);

      // Process results with fallbacks for failed validations
      const readabilityResult = this.processValidationResult(results[0], 'readability', correlationId);
      const factualConsistencyResult = this.processValidationResult(results[1], 'factualConsistency', correlationId);
      const noveltyResult = this.processValidationResult(results[2], 'novelty', correlationId);
      const toxicityResult = this.processValidationResult(results[3], 'toxicity', correlationId);
      const structuralResult = this.processValidationResult(results[4], 'structure', correlationId);

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

  /**
   * Calculate overall quality score from individual metrics - using dynamic config weights
   */
  calculateOverallQuality(metrics) {
    const weights = {
      readability: dynamicConfig.validation.qualityWeights.readability,
      factualConsistency: dynamicConfig.validation.qualityWeights.factualConsistency,
      novelty: dynamicConfig.validation.qualityWeights.novelty,
      toxicity: dynamicConfig.validation.qualityWeights.toxicity,
      structure: dynamicConfig.validation.qualityWeights.structure
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
   * Execute validation with retry logic
   */
  async executeValidationWithRetry(validationType, validationFunction, correlationId) {
    return await retryWithBackoff(validationFunction, {
      maxAttempts: 2,
      baseDelayMs: 500,
      maxDelayMs: 2000,
      onRetry: (error, attempt, delay) => {
        this.validationMetrics.retriesPerformed++;
        monitoringService.log('warn', `Validation retry: ${validationType}`, {
          attempt,
          error: error.message,
          delay: `${delay}ms`,
          correlationId
        }, correlationId);
      }
    });
  }

  /**
   * Process validation result with fallback
   */
  processValidationResult(result, validationType, correlationId) {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      monitoringService.log('warn', `Validation failed, using fallback: ${validationType}`, {
        error: result.reason?.message || 'Unknown error',
        correlationId
      }, correlationId);

      this.validationMetrics.fallbackValidationsUsed++;
      return this.createFallbackValidationResult(validationType);
    }
  }

  /**
   * Create fallback validation result
   */
  createFallbackValidationResult(validationType) {
    const fallbackResults = {
      readability: { score: 0.6, gradeLevel: 10, fallbackUsed: true },
      factualConsistency: { score: 0.5, fallbackUsed: true },
      novelty: { score: 0.5, fallbackUsed: true },
      toxicity: { score: 0.1, level: 'very-low', fallbackUsed: true },
      structure: { score: 0.5, fallbackUsed: true }
    };

    return fallbackResults[validationType] || { score: 0.5, fallbackUsed: true };
  }

  /**
   * Attempt regeneration of synthesis
   */
  async attemptRegeneration(currentSynthesis, validationResult, originalOutputs, userPrompt, correlationId, regenerationCallback) {
    try {
      if (!regenerationCallback) {
        return null;
      }

      const regenerationContext = {
        currentSynthesis,
        validationResult,
        originalOutputs,
        userPrompt,
        correlationId,
        improvementSuggestions: validationResult.improvementSuggestions || []
      };

      monitoringService.log('info', 'Attempting synthesis regeneration', {
        qualityScore: validationResult.overallQuality,
        failedMetrics: this.getFailedMetrics(validationResult),
        correlationId
      }, correlationId);

      const regeneratedSynthesis = await regenerationCallback(regenerationContext);

      if (regeneratedSynthesis && regeneratedSynthesis.content) {
        monitoringService.log('info', 'Synthesis regeneration successful', {
          originalLength: currentSynthesis.content?.length || 0,
          regeneratedLength: regeneratedSynthesis.content.length,
          correlationId
        }, correlationId);

        return regeneratedSynthesis;
      }

      return null;

    } catch (error) {
      monitoringService.log('error', 'Synthesis regeneration failed', {
        error: error.message,
        correlationId
      }, correlationId);

      return null;
    }
  }

  /**
   * Get failed validation metrics
   */
  getFailedMetrics(validationResult) {
    const failed = [];

    if (validationResult.readability?.score < this.thresholds.readability.minimum) {
      failed.push('readability');
    }
    if (validationResult.factualConsistency?.score < this.thresholds.factualConsistency.minimum) {
      failed.push('factualConsistency');
    }
    if (validationResult.novelty?.score < this.thresholds.novelty.minimum) {
      failed.push('novelty');
    }
    if (validationResult.toxicity?.score > this.thresholds.toxicity.maximum) {
      failed.push('toxicity');
    }
    if (validationResult.overallQuality < this.thresholds.overall.minimum) {
      failed.push('overallQuality');
    }

    return failed;
  }

  /**
   * Perform fallback validation when main validation fails
   */
  performFallbackValidation(synthesisResult, correlationId, error) {
    this.validationMetrics.fallbackValidationsUsed++;

    monitoringService.log('warn', 'Using fallback validation', {
      error: error.message,
      correlationId
    }, correlationId);

    // Basic content validation
    const content = synthesisResult.content || '';
    const hasContent = content.length > 10;
    const hasStructure = content.includes('.') && content.includes(' ');

    const fallbackQuality = hasContent && hasStructure ? 0.6 : 0.3;

    return {
      passesThreshold: fallbackQuality >= 0.5,
      overallQuality: fallbackQuality,
      qualityLevel: fallbackQuality >= 0.7 ? 'good' : fallbackQuality >= 0.5 ? 'acceptable' : 'poor',
      fallbackValidation: true,
      error: error.message,
      correlationId,
      readability: { score: fallbackQuality, fallbackUsed: true },
      factualConsistency: { score: fallbackQuality, fallbackUsed: true },
      novelty: { score: fallbackQuality, fallbackUsed: true },
      toxicity: { score: 0.1, level: 'very-low', fallbackUsed: true },
      structure: { score: fallbackQuality, fallbackUsed: true },
      improvementSuggestions: ['Validation system temporarily unavailable - basic content check performed']
    };
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
