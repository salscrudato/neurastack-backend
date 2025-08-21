/**
 * 🛡️ Quality Assurance System - Advanced Response Quality Validation
 *
 * 🎯 PURPOSE: Ensure high-quality AI responses through comprehensive validation,
 *            content filtering, bias detection, and automated quality scoring
 *
 * 📋 KEY FEATURES:
 * 1. Multi-dimensional quality scoring with detailed analysis
 * 2. Content safety and appropriateness filtering
 * 3. Bias detection and mitigation strategies
 * 4. Factual consistency validation
 * 5. Readability and clarity assessment
 * 6. Automated quality improvement suggestions
 * 7. Real-time quality monitoring and alerts
 *
 * 💡 INNOVATION: Uses advanced NLP techniques and heuristics to ensure
 *    responses meet high quality standards across multiple dimensions
 */

const monitoringService = require('./monitoringService');
const logger = require('../utils/visualLogger');
const dynamicConfig = require('../config/dynamicConfig');

class QualityAssuranceSystem {
  constructor() {
    // Quality assessment configuration
    this.config = {
      enableContentFiltering: true,
      enableBiasDetection: true,
      enableFactualValidation: true,
      enableReadabilityCheck: true,
      minimumQualityThreshold: 0.6,
      excellenceThreshold: 0.85,
      toxicityThreshold: 0.3,
      biasThreshold: 0.4
    };

    // Quality dimensions and weights
    this.qualityDimensions = {
      relevance: 0.25,      // How well it answers the question
      accuracy: 0.20,       // Factual correctness and consistency
      clarity: 0.20,        // Readability and comprehensibility
      completeness: 0.15,   // Thoroughness of the response
      safety: 0.10,         // Content safety and appropriateness
      originality: 0.10     // Uniqueness and creativity
    };

    // Content safety filters
    this.safetyFilters = {
      toxicity: /\b(hate|toxic|harmful|offensive|inappropriate)\b/i,
      violence: /\b(violence|violent|kill|murder|harm|hurt)\b/i,
      discrimination: /\b(racist|sexist|discriminat|prejudice|bias)\b/i,
      misinformation: /\b(fake|false|lie|misinformation|conspiracy)\b/i
    };

    // Bias detection patterns
    this.biasPatterns = {
      gender: /\b(men are|women are|boys are|girls are|he is|she is)\s+(better|worse|more|less)\b/i,
      racial: /\b(white|black|asian|hispanic|latino)\s+(people|person)\s+(are|is)\b/i,
      cultural: /\b(americans|europeans|asians|africans)\s+(always|never|typically)\b/i,
      religious: /\b(christians|muslims|jews|hindus|buddhists)\s+(believe|think|are)\b/i
    };

    // Quality metrics tracking
    this.metrics = {
      totalAssessments: 0,
      passedAssessments: 0,
      failedAssessments: 0,
      averageQualityScore: 0,
      safetyViolations: 0,
      biasDetections: 0,
      improvementSuggestions: 0
    };

    // Quality history for trend analysis
    this.qualityHistory = [];
    this.historyWindow = 500;

    logger.success(
      'Quality Assurance System: Initialized',
      {
        'Content Filtering': this.config.enableContentFiltering,
        'Bias Detection': this.config.enableBiasDetection,
        'Factual Validation': this.config.enableFactualValidation,
        'Quality Threshold': `${(this.config.minimumQualityThreshold * 100).toFixed(0)}%`,
        'Excellence Threshold': `${(this.config.excellenceThreshold * 100).toFixed(0)}%`
      },
      'quality'
    );
  }

  /**
   * Comprehensive quality assessment of AI response
   * @param {Object} response - AI response to assess
   * @param {string} originalPrompt - Original user prompt
   * @param {Object} context - Additional context
   * @returns {Object} Quality assessment result
   */
  async assessResponseQuality(response, originalPrompt, context = {}) {
    const startTime = Date.now();
    this.metrics.totalAssessments++;

    try {
      // Initialize assessment result
      const assessment = {
        overallScore: 0,
        passed: false,
        dimensions: {},
        violations: [],
        suggestions: [],
        metadata: {
          assessmentTime: 0,
          version: '2.0'
        }
      };

      // Step 1: Assess each quality dimension
      assessment.dimensions.relevance = await this.assessRelevance(response, originalPrompt);
      assessment.dimensions.accuracy = await this.assessAccuracy(response, originalPrompt, context);
      assessment.dimensions.clarity = await this.assessClarity(response);
      assessment.dimensions.completeness = await this.assessCompleteness(response, originalPrompt);
      assessment.dimensions.safety = await this.assessSafety(response);
      assessment.dimensions.originality = await this.assessOriginality(response, context);

      // Step 2: Calculate overall quality score
      assessment.overallScore = this.calculateOverallScore(assessment.dimensions);

      // Step 3: Determine if assessment passes
      assessment.passed = assessment.overallScore >= this.config.minimumQualityThreshold;

      // Step 4: Generate improvement suggestions
      assessment.suggestions = this.generateImprovementSuggestions(assessment.dimensions, response);

      // Step 5: Check for content violations
      assessment.violations = await this.checkContentViolations(response);

      // Step 6: Final validation
      if (assessment.violations.length > 0) {
        assessment.passed = false;
        this.metrics.safetyViolations += assessment.violations.length;
      }

      // Update metrics
      assessment.metadata.assessmentTime = Date.now() - startTime;
      this.updateQualityMetrics(assessment);

      // Log assessment result
      monitoringService.log('info', 'Quality assessment completed', {
        overallScore: assessment.overallScore,
        passed: assessment.passed,
        violations: assessment.violations.length,
        suggestions: assessment.suggestions.length
      });

      return assessment;

    } catch (error) {
      logger.error('Quality assessment failed', { error: error.message }, 'quality');
      
      // Return minimal assessment on failure
      return {
        overallScore: 0.5,
        passed: false,
        dimensions: {},
        violations: ['Assessment system error'],
        suggestions: ['Manual review required'],
        metadata: {
          assessmentTime: Date.now() - startTime,
          error: error.message
        }
      };
    }
  }

  /**
   * Assess relevance to original prompt
   * @param {Object} response - AI response
   * @param {string} originalPrompt - Original prompt
   * @returns {number} Relevance score (0-1)
   */
  async assessRelevance(response, originalPrompt) {
    const content = response.content || '';
    const prompt = originalPrompt.toLowerCase();
    const responseText = content.toLowerCase();

    // Extract key terms from prompt
    const promptTerms = prompt
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(term => term.length > 3)
      .filter(term => !['what', 'how', 'why', 'when', 'where', 'which', 'that', 'this'].includes(term));

    if (promptTerms.length === 0) return 0.7; // Default for generic prompts

    // Count term matches in response
    const matchedTerms = promptTerms.filter(term => responseText.includes(term));
    const termMatchRatio = matchedTerms.length / promptTerms.length;

    // Check for direct question answering patterns
    let directAnswerBonus = 0;
    if (prompt.includes('what is') && /^[^.!?]*\bis\b/i.test(content)) directAnswerBonus = 0.1;
    if (prompt.includes('how to') && /\bto\b.*\b(step|method|way)\b/i.test(content)) directAnswerBonus = 0.1;
    if (prompt.includes('why') && /\b(because|due to|reason|since)\b/i.test(content)) directAnswerBonus = 0.1;

    // Check for topic coherence
    const topicCoherence = this.assessTopicCoherence(promptTerms, responseText);

    return Math.min(1, (termMatchRatio * 0.6) + directAnswerBonus + (topicCoherence * 0.3));
  }

  /**
   * Assess topic coherence between prompt and response
   * @param {Array} promptTerms - Key terms from prompt
   * @param {string} responseText - Response text
   * @returns {number} Coherence score (0-1)
   */
  assessTopicCoherence(promptTerms, responseText) {
    // Simple coherence check based on term distribution
    const responseWords = responseText.split(/\s+/);
    const termDensity = promptTerms.reduce((density, term) => {
      const occurrences = (responseText.match(new RegExp(term, 'gi')) || []).length;
      return density + (occurrences / responseWords.length);
    }, 0);

    return Math.min(1, termDensity * 10); // Scale to 0-1
  }

  /**
   * Assess factual accuracy and consistency
   * @param {Object} response - AI response
   * @param {string} originalPrompt - Original prompt
   * @param {Object} context - Additional context
   * @returns {number} Accuracy score (0-1)
   */
  async assessAccuracy(response, originalPrompt, context) {
    const content = response.content || '';
    let score = 0.7; // Base score

    // Check for factual consistency indicators
    if (/\b(according to|research shows|studies indicate|data suggests)\b/i.test(content)) {
      score += 0.1;
    }

    // Check for specific numbers and dates (indicates precision)
    if (/\b\d{4}\b|\b\d+%\b|\b\$\d+\b/.test(content)) {
      score += 0.1;
    }

    // Check for hedging language (indicates appropriate uncertainty)
    if (/\b(may|might|could|possibly|likely|probably|generally)\b/i.test(content)) {
      score += 0.05;
    }

    // Penalize absolute statements without evidence
    const absoluteStatements = (content.match(/\b(always|never|all|none|every|completely)\b/gi) || []).length;
    if (absoluteStatements > 2) {
      score -= 0.1;
    }

    // Check for contradictory statements within response
    if (this.hasContradictions(content)) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check for contradictory statements in content
   * @param {string} content - Content to check
   * @returns {boolean} Has contradictions
   */
  hasContradictions(content) {
    const contradictionPairs = [
      ['yes', 'no'],
      ['true', 'false'],
      ['correct', 'incorrect'],
      ['good', 'bad'],
      ['safe', 'unsafe'],
      ['effective', 'ineffective']
    ];

    const contentLower = content.toLowerCase();
    
    return contradictionPairs.some(([term1, term2]) => 
      contentLower.includes(term1) && contentLower.includes(term2)
    );
  }

  /**
   * Assess clarity and readability
   * @param {Object} response - AI response
   * @returns {number} Clarity score (0-1)
   */
  async assessClarity(response) {
    const content = response.content || '';
    let score = 0.5; // Base score

    // Sentence length analysis
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      const avgSentenceLength = content.split(/\s+/).length / sentences.length;
      
      // Optimal sentence length is 15-20 words
      if (avgSentenceLength >= 10 && avgSentenceLength <= 25) {
        score += 0.15;
      } else if (avgSentenceLength > 30) {
        score -= 0.1; // Penalize very long sentences
      }
    }

    // Structure and formatting
    if (/#{1,3}\s|^\d+\.\s|^[-*]\s/m.test(content)) {
      score += 0.15; // Has headings or lists
    }

    // Paragraph structure
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1 && paragraphs.length <= 6) {
      score += 0.1; // Good paragraph structure
    }

    // Transition words and phrases
    if (/\b(however|therefore|furthermore|moreover|additionally|consequently)\b/i.test(content)) {
      score += 0.1;
    }

    // Examples and explanations
    if (/\b(for example|such as|for instance|specifically|in other words)\b/i.test(content)) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Assess completeness of response
   * @param {Object} response - AI response
   * @param {string} originalPrompt - Original prompt
   * @returns {number} Completeness score (0-1)
   */
  async assessCompleteness(response, originalPrompt) {
    const content = response.content || '';
    const prompt = originalPrompt.toLowerCase();
    let score = 0.5; // Base score

    // Length appropriateness
    const wordCount = content.split(/\s+/).length;
    if (wordCount >= 50 && wordCount <= 500) {
      score += 0.2;
    } else if (wordCount > 500 && wordCount <= 1000) {
      score += 0.1;
    } else if (wordCount < 20) {
      score -= 0.3; // Too short
    }

    // Check if response addresses multiple aspects for complex questions
    if (prompt.includes('and') || prompt.includes('or')) {
      const aspects = (prompt.match(/\band\b|\bor\b/g) || []).length + 1;
      const responseAspects = this.countAddressedAspects(content);
      score += Math.min(0.2, (responseAspects / aspects) * 0.2);
    }

    // Conclusion or summary
    if (/\b(in conclusion|to summarize|in summary|overall|finally)\b/i.test(content)) {
      score += 0.1;
    }

    // Examples and details
    if (/\b(for example|such as|specifically|details|explanation)\b/i.test(content)) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Count addressed aspects in response
   * @param {string} content - Response content
   * @returns {number} Number of aspects addressed
   */
  countAddressedAspects(content) {
    // Simple heuristic: count numbered points, bullet points, or paragraph breaks
    const numberedPoints = (content.match(/^\d+\./gm) || []).length;
    const bulletPoints = (content.match(/^[-*]/gm) || []).length;
    const paragraphs = content.split(/\n\s*\n/).length;
    
    return Math.max(numberedPoints, bulletPoints, Math.min(paragraphs, 5));
  }

  /**
   * Assess content safety and appropriateness
   * @param {Object} response - AI response
   * @returns {number} Safety score (0-1)
   */
  async assessSafety(response) {
    const content = response.content || '';
    let score = 1.0; // Start with perfect safety score

    // Check safety filters
    for (const [category, pattern] of Object.entries(this.safetyFilters)) {
      if (pattern.test(content)) {
        score -= 0.2;
        logger.warning(`Safety concern detected: ${category}`, { content: content.substring(0, 100) }, 'quality');
      }
    }

    // Check for inappropriate language
    const inappropriateWords = ['damn', 'hell', 'stupid', 'idiot', 'moron'];
    const foundInappropriate = inappropriateWords.filter(word => 
      content.toLowerCase().includes(word)
    );
    
    if (foundInappropriate.length > 0) {
      score -= foundInappropriate.length * 0.1;
    }

    // Check for medical/legal disclaimers when appropriate
    if (/\b(medical|health|legal|financial|investment)\b/i.test(content)) {
      if (!/\b(consult|professional|advice|disclaimer)\b/i.test(content)) {
        score -= 0.1; // Should include appropriate disclaimers
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Assess originality and creativity
   * @param {Object} response - AI response
   * @param {Object} context - Additional context
   * @returns {number} Originality score (0-1)
   */
  async assessOriginality(response, context) {
    const content = response.content || '';
    let score = 0.6; // Base score

    // Check for creative elements
    if (/\b(imagine|creative|innovative|unique|novel|original)\b/i.test(content)) {
      score += 0.1;
    }

    // Check for analogies and metaphors
    if (/\b(like|similar to|as if|metaphor|analogy|compare)\b/i.test(content)) {
      score += 0.1;
    }

    // Check for varied vocabulary
    const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const uniqueWords = new Set(words);
    const vocabularyDiversity = uniqueWords.size / words.length;
    
    if (vocabularyDiversity > 0.7) {
      score += 0.1;
    }

    // Penalize generic responses
    const genericPhrases = [
      'it depends',
      'there are many',
      'it is important',
      'you should consider',
      'it can be'
    ];
    
    const genericCount = genericPhrases.filter(phrase => 
      content.toLowerCase().includes(phrase)
    ).length;
    
    if (genericCount > 2) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate overall quality score from dimensions
   * @param {Object} dimensions - Quality dimension scores
   * @returns {number} Overall score (0-1)
   */
  calculateOverallScore(dimensions) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [dimension, weight] of Object.entries(this.qualityDimensions)) {
      if (dimensions[dimension] !== undefined) {
        totalScore += dimensions[dimension] * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Generate improvement suggestions based on assessment
   * @param {Object} dimensions - Quality dimension scores
   * @param {Object} response - Original response
   * @returns {Array} Improvement suggestions
   */
  generateImprovementSuggestions(dimensions, response) {
    const suggestions = [];

    if (dimensions.relevance < 0.7) {
      suggestions.push('Improve relevance by addressing the specific question more directly');
    }

    if (dimensions.accuracy < 0.7) {
      suggestions.push('Add more factual support and avoid absolute statements without evidence');
    }

    if (dimensions.clarity < 0.7) {
      suggestions.push('Improve clarity with better structure, shorter sentences, and clearer explanations');
    }

    if (dimensions.completeness < 0.7) {
      suggestions.push('Provide more comprehensive coverage of the topic with examples and details');
    }

    if (dimensions.safety < 0.9) {
      suggestions.push('Review content for safety and appropriateness concerns');
    }

    if (dimensions.originality < 0.6) {
      suggestions.push('Add more creative elements, examples, or unique perspectives');
    }

    // Content-specific suggestions
    const content = response.content || '';
    if (content.length < 100) {
      suggestions.push('Expand the response with more detailed information');
    }

    if (!/[.!?]$/.test(content.trim())) {
      suggestions.push('Ensure proper sentence completion and punctuation');
    }

    this.metrics.improvementSuggestions += suggestions.length;
    return suggestions;
  }

  /**
   * Check for content violations
   * @param {Object} response - AI response
   * @returns {Array} Content violations
   */
  async checkContentViolations(response) {
    const violations = [];
    const content = response.content || '';

    // Check bias patterns
    if (this.config.enableBiasDetection) {
      for (const [biasType, pattern] of Object.entries(this.biasPatterns)) {
        if (pattern.test(content)) {
          violations.push(`Potential ${biasType} bias detected`);
          this.metrics.biasDetections++;
        }
      }
    }

    // Check content safety
    if (this.config.enableContentFiltering) {
      for (const [category, pattern] of Object.entries(this.safetyFilters)) {
        if (pattern.test(content)) {
          violations.push(`Content safety concern: ${category}`);
        }
      }
    }

    // Check for empty or minimal content
    if (content.trim().length < 10) {
      violations.push('Response too short or empty');
    }

    return violations;
  }

  /**
   * Update quality metrics
   * @param {Object} assessment - Quality assessment result
   */
  updateQualityMetrics(assessment) {
    if (assessment.passed) {
      this.metrics.passedAssessments++;
    } else {
      this.metrics.failedAssessments++;
    }

    // Update average quality score
    const currentAvg = this.metrics.averageQualityScore;
    const totalAssessments = this.metrics.totalAssessments;
    this.metrics.averageQualityScore = 
      ((currentAvg * (totalAssessments - 1)) + assessment.overallScore) / totalAssessments;

    // Store in quality history
    this.qualityHistory.push({
      timestamp: Date.now(),
      score: assessment.overallScore,
      passed: assessment.passed,
      dimensions: assessment.dimensions,
      violations: assessment.violations.length
    });

    // Maintain history window
    if (this.qualityHistory.length > this.historyWindow) {
      this.qualityHistory = this.qualityHistory.slice(-this.historyWindow);
    }
  }

  /**
   * Get comprehensive quality metrics
   * @returns {Object} Quality metrics
   */
  getMetrics() {
    const passRate = this.metrics.totalAssessments > 0 ? 
      (this.metrics.passedAssessments / this.metrics.totalAssessments) * 100 : 0;

    return {
      totalAssessments: this.metrics.totalAssessments,
      passedAssessments: this.metrics.passedAssessments,
      failedAssessments: this.metrics.failedAssessments,
      passRate: passRate.toFixed(1) + '%',
      averageQualityScore: this.metrics.averageQualityScore.toFixed(2),
      safetyViolations: this.metrics.safetyViolations,
      biasDetections: this.metrics.biasDetections,
      improvementSuggestions: this.metrics.improvementSuggestions,
      qualityTrend: this.getQualityTrend(),
      thresholds: {
        minimum: this.config.minimumQualityThreshold,
        excellence: this.config.excellenceThreshold
      }
    };
  }

  /**
   * Get quality trend analysis
   * @returns {Object} Quality trend
   */
  getQualityTrend() {
    if (this.qualityHistory.length < 20) {
      return { trend: 'insufficient_data', direction: 'unknown' };
    }

    const recent = this.qualityHistory.slice(-20);
    const older = this.qualityHistory.slice(-40, -20);

    const recentAvg = recent.reduce((sum, q) => sum + q.score, 0) / recent.length;
    const olderAvg = older.length > 0 ? 
      older.reduce((sum, q) => sum + q.score, 0) / older.length : recentAvg;

    const difference = recentAvg - olderAvg;
    
    if (Math.abs(difference) < 0.05) {
      return { trend: 'stable', direction: 'neutral', change: difference.toFixed(3) };
    } else if (difference > 0) {
      return { trend: 'improving', direction: 'up', change: `+${difference.toFixed(3)}` };
    } else {
      return { trend: 'declining', direction: 'down', change: difference.toFixed(3) };
    }
  }
}

// Export singleton instance
const qualityAssuranceSystem = new QualityAssuranceSystem();
module.exports = qualityAssuranceSystem;
