/**
 * 🎯 Simple Confidence Service - Streamlined Response Quality Assessment
 *
 * 🎯 PURPOSE: Calculate basic confidence scores for AI responses
 *            Replaces complex semantic analysis with simple, effective metrics
 *
 * 📋 KEY FEATURES:
 * 1. Basic confidence scoring based on response characteristics
 * 2. Simple quality assessment without complex NLP
 * 3. Fast, reliable calculations
 * 4. Maintains required response structure
 *
 * 💡 PHILOSOPHY: Simple metrics that correlate well with response quality
 *    without the overhead of complex semantic analysis
 */

const monitoringService = require('./monitoringService');

class SimpleConfidenceService {
  constructor() {
    // Basic configuration for confidence calculation
    this.config = {
      // Optimal response length range (words)
      optimalWordRange: { min: 10, max: 300 },
      
      // Response time thresholds (milliseconds)
      responseTimeThresholds: {
        fast: 2000,
        normal: 5000,
        slow: 10000
      },
      
      // Quality indicators
      qualityIndicators: {
        hasStructure: 0.1,      // Bonus for structured responses
        hasExamples: 0.05,      // Bonus for examples
        hasExplanation: 0.05,   // Bonus for explanations
        properLength: 0.2       // Bonus for appropriate length
      }
    };
  }

  /**
   * Calculate confidence scores for an array of role responses
   *
   * This is the main method that replaces complex semantic confidence analysis
   * with simple, effective metrics that correlate well with response quality.
   *
   * For each AI response, it calculates:
   * - Basic confidence score (0-1) based on content quality, response time, model reliability
   * - Quality metrics (word count, structure, reasoning indicators)
   *
   * The simplified approach removes complex NLP analysis while maintaining
   * the response structure expected by the voting and synthesis systems.
   *
   * @param {Array} roles - Array of role response objects from AI models
   * @returns {Array} Enhanced roles with confidence scores and quality metrics
   */
  async calculateRoleConfidences(roles) {
    const enhancedRoles = [];

    // Process each AI model response
    for (const role of roles) {
      try {
        // Process successful responses with content
        if (role.status === 'fulfilled' && role.content) {
          // Calculate simplified confidence score (replaces complex semantic analysis)
          const confidence = this.calculateBasicConfidence(role);

          // Calculate basic quality metrics (replaces complex quality analysis)
          const quality = this.calculateQualityMetrics(role);

          // Add confidence and quality to role response
          enhancedRoles.push({
            ...role,
            confidence,
            quality
          });
        } else {
          // Handle failed responses with default low confidence
          enhancedRoles.push({
            ...role,
            confidence: {
              score: 0,
              level: 'very-low',
              factors: ['Response failed or empty']
            },
            quality: {
              wordCount: 0,
              sentenceCount: 0,
              averageWordsPerSentence: 0,
              hasStructure: false,
              hasReasoning: false,
              complexity: 'none'
            }
          });
        }
      } catch (error) {
        // Fallback for any calculation errors - use safe defaults
        monitoringService.log('warn', 'Confidence calculation failed', {
          role: role.role,
          error: error.message
        });

        enhancedRoles.push({
          ...role,
          confidence: {
            score: 0.5,
            level: 'medium',
            factors: ['Calculation error, using default']
          },
          quality: this.getDefaultQuality()
        });
      }
    }

    return enhancedRoles;
  }

  /**
   * Calculate basic confidence score for a single response
   * @param {Object} role - Role response object
   * @returns {Object} Confidence object with score, level, and factors
   */
  calculateBasicConfidence(role) {
    const factors = [];
    let score = 0.5; // Base score

    // Content quality assessment
    const contentScore = this.assessContentQuality(role.content);
    score += contentScore.score * 0.4; // 40% weight
    factors.push(...contentScore.factors);

    // Response time assessment
    const timeScore = this.assessResponseTime(role.responseTime);
    score += timeScore.score * 0.2; // 20% weight
    factors.push(...timeScore.factors);

    // Model reliability (simple heuristic)
    const modelScore = this.assessModelReliability(role.model);
    score += modelScore.score * 0.2; // 20% weight
    factors.push(...modelScore.factors);

    // Structure and formatting
    const structureScore = this.assessStructure(role.content);
    score += structureScore.score * 0.2; // 20% weight
    factors.push(...structureScore.factors);

    // Clamp score between 0 and 1
    score = Math.max(0, Math.min(1, score));

    return {
      score,
      level: this.getConfidenceLevel(score),
      factors
    };
  }

  /**
   * Assess content quality based on length and characteristics
   */
  assessContentQuality(content) {
    const words = content.trim().split(/\s+/);
    const wordCount = words.length;
    const factors = [];
    let score = 0;

    // Length assessment
    if (wordCount >= this.config.optimalWordRange.min && 
        wordCount <= this.config.optimalWordRange.max) {
      score += 0.3;
      factors.push('Appropriate response length');
    } else if (wordCount < this.config.optimalWordRange.min) {
      score -= 0.1;
      factors.push('Response too short');
    } else {
      score -= 0.05;
      factors.push('Response quite long');
    }

    // Content richness
    if (content.includes('?') || content.includes('!')) {
      score += 0.1;
      factors.push('Engaging punctuation');
    }

    if (content.includes('\n') || content.includes('.')) {
      score += 0.1;
      factors.push('Well-structured response');
    }

    return { score, factors };
  }

  /**
   * Assess response time quality
   */
  assessResponseTime(responseTime) {
    const factors = [];
    let score = 0;

    if (!responseTime) {
      return { score: 0, factors: ['No response time data'] };
    }

    if (responseTime <= this.config.responseTimeThresholds.fast) {
      score = 0.2;
      factors.push('Fast response time');
    } else if (responseTime <= this.config.responseTimeThresholds.normal) {
      score = 0.1;
      factors.push('Normal response time');
    } else if (responseTime <= this.config.responseTimeThresholds.slow) {
      score = 0;
      factors.push('Slow response time');
    } else {
      score = -0.1;
      factors.push('Very slow response time');
    }

    return { score, factors };
  }

  /**
   * Simple model reliability assessment
   */
  assessModelReliability(model) {
    const factors = [];
    let score = 0.1; // Base reliability

    // Simple heuristics based on model names
    if (model && model.includes('gpt-4')) {
      score = 0.15;
      factors.push('High-quality model');
    } else if (model && model.includes('claude')) {
      score = 0.12;
      factors.push('Reliable model');
    } else if (model && model.includes('gemini')) {
      score = 0.1;
      factors.push('Standard model');
    } else {
      factors.push('Unknown model reliability');
    }

    return { score, factors };
  }

  /**
   * Assess response structure and formatting
   */
  assessStructure(content) {
    const factors = [];
    let score = 0;

    // Check for structure indicators
    const hasNewlines = content.includes('\n');
    const hasBullets = content.includes('•') || content.includes('-') || content.includes('*');
    const hasNumbers = /\d+\./.test(content);
    const hasSentences = content.split('.').length > 1;

    if (hasNewlines) {
      score += 0.05;
      factors.push('Multi-line structure');
    }

    if (hasBullets || hasNumbers) {
      score += 0.05;
      factors.push('Organized formatting');
    }

    if (hasSentences) {
      score += 0.1;
      factors.push('Complete sentences');
    }

    return { score, factors };
  }

  /**
   * Calculate simple quality metrics
   */
  calculateQualityMetrics(role) {
    const content = role.content || '';
    const words = content.trim().split(/\s+/);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
      hasStructure: content.includes('\n') || content.includes('.'),
      hasReasoning: content.toLowerCase().includes('because') || 
                   content.toLowerCase().includes('therefore') ||
                   content.toLowerCase().includes('since'),
      complexity: this.assessComplexity(words.length)
    };
  }

  /**
   * Assess response complexity based on length
   */
  assessComplexity(wordCount) {
    if (wordCount < 20) return 'very-low';
    if (wordCount < 50) return 'low';
    if (wordCount < 100) return 'medium';
    if (wordCount < 200) return 'high';
    return 'very-high';
  }

  /**
   * Convert confidence score to level
   */
  getConfidenceLevel(score) {
    if (score >= 0.8) return 'very-high';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    if (score >= 0.2) return 'low';
    return 'very-low';
  }

  /**
   * Get default quality metrics for failed responses
   */
  getDefaultQuality() {
    return {
      wordCount: 0,
      sentenceCount: 0,
      averageWordsPerSentence: 0,
      hasStructure: false,
      hasReasoning: false,
      complexity: 'none'
    };
  }

  /**
   * Calculate synthesis confidence based on successful roles
   */
  calculateSynthesisConfidence(synthesis, roles) {
    const successfulRoles = roles.filter(r => r.status === 'fulfilled');
    
    if (successfulRoles.length === 0) {
      return {
        score: 0.1,
        level: 'very-low',
        factors: ['No successful responses to synthesize']
      };
    }

    // Base confidence from number of successful responses
    const baseScore = Math.min(1.0, successfulRoles.length / 3); // Optimal with 3 responses
    
    // Average confidence of input responses
    const avgInputConfidence = successfulRoles.reduce((sum, role) => 
      sum + (role.confidence?.score || 0.5), 0) / successfulRoles.length;
    
    // Synthesis quality (simple length and structure check)
    const synthesisQuality = synthesis.content ? 
      Math.min(1.0, synthesis.content.length / 500) : 0; // Optimal around 500 chars
    
    // Combined score: 40% base + 40% input quality + 20% synthesis quality
    const finalScore = (baseScore * 0.4) + (avgInputConfidence * 0.4) + (synthesisQuality * 0.2);
    
    return {
      score: Math.max(0.1, Math.min(1.0, finalScore)),
      level: this.getConfidenceLevel(finalScore),
      factors: [
        `Based on ${successfulRoles.length} successful responses`,
        `Average role confidence: ${(avgInputConfidence * 100).toFixed(1)}%`,
        synthesis.status === 'fallback' ? 'Response generation issues' : 'Normal synthesis',
        synthesisQuality > 0.5 ? 'Adequate response length' : 'Short response',
        'Well-structured response'
      ]
    };
  }
}

module.exports = new SimpleConfidenceService();
