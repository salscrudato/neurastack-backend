/**
 * 🎯 Enhanced Content Quality Service - Advanced Response Quality Assessment
 *
 * 🎯 PURPOSE: Sophisticated content quality analysis including semantic coherence,
 *            factual accuracy indicators, completeness assessment, and educational value
 *
 * 📋 KEY FEATURES:
 * 1. Semantic coherence analysis
 * 2. Factual accuracy indicators
 * 3. Completeness assessment
 * 4. Educational value scoring
 * 5. Topic coverage analysis
 * 6. Response structure evaluation
 * 7. Clarity and readability metrics
 */

const monitoringService = require('./monitoringService');

class EnhancedContentQualityService {
  constructor() {
    this.config = {
      // Quality thresholds
      minWordCount: 20,
      optimalWordRange: { min: 50, max: 500 },
      maxWordCount: 1000,
      
      // Scoring weights
      weights: {
        semanticCoherence: 0.25,
        factualIndicators: 0.20,
        completeness: 0.20,
        educationalValue: 0.15,
        structure: 0.10,
        clarity: 0.10
      },

      // Educational indicators
      educationalKeywords: [
        'example', 'for instance', 'such as', 'specifically', 'namely',
        'because', 'therefore', 'thus', 'consequently', 'as a result',
        'first', 'second', 'third', 'finally', 'in conclusion',
        'however', 'moreover', 'furthermore', 'additionally'
      ],

      // Technical depth indicators
      technicalIndicators: [
        'algorithm', 'implementation', 'architecture', 'framework',
        'methodology', 'analysis', 'process', 'system', 'approach',
        'principle', 'concept', 'theory', 'mechanism', 'function'
      ],

      // Factual accuracy indicators
      factualIndicators: {
        specific: ['%', 'approximately', 'exactly', 'precisely', 'around'],
        quantitative: ['number', 'amount', 'quantity', 'measure', 'rate'],
        temporal: ['year', 'decade', 'century', 'recently', 'historically'],
        comparative: ['more than', 'less than', 'compared to', 'versus', 'relative to']
      }
    };

    this.metrics = {
      assessmentsPerformed: 0,
      averageQualityScore: 0,
      highQualityResponses: 0
    };
  }

  /**
   * Comprehensive content quality assessment
   */
  async assessContentQuality(content, context = {}) {
    try {
      if (!content || typeof content !== 'string') {
        return this.createEmptyQualityResult();
      }

      const assessmentStart = Date.now();
      
      // Core quality assessments
      const semanticScore = this.assessSemanticCoherence(content);
      const factualScore = this.assessFactualIndicators(content);
      const completenessScore = this.assessCompleteness(content, context);
      const educationalScore = this.assessEducationalValue(content);
      const structureScore = this.assessStructure(content);
      const clarityScore = this.assessClarity(content);

      // Calculate weighted overall score
      const overallScore = this.calculateWeightedScore({
        semanticCoherence: semanticScore.score,
        factualIndicators: factualScore.score,
        completeness: completenessScore.score,
        educationalValue: educationalScore.score,
        structure: structureScore.score,
        clarity: clarityScore.score
      });

      // Compile detailed results
      const result = {
        overallScore: Math.max(0, Math.min(1, overallScore)),
        qualityLevel: this.getQualityLevel(overallScore),
        components: {
          semanticCoherence: semanticScore,
          factualIndicators: factualScore,
          completeness: completenessScore,
          educationalValue: educationalScore,
          structure: structureScore,
          clarity: clarityScore
        },
        metrics: this.calculateContentMetrics(content),
        processingTime: Date.now() - assessmentStart
      };

      // Update service metrics
      this.updateMetrics(result);

      return result;

    } catch (error) {
      monitoringService.log('error', 'Content quality assessment failed', {
        error: error.message,
        contentLength: content?.length || 0
      });
      return this.createFallbackQualityResult();
    }
  }

  /**
   * Assess semantic coherence and logical flow
   */
  assessSemanticCoherence(content) {
    const factors = [];
    let score = 0.5; // Base score

    // Sentence connectivity analysis
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 1) {
      const connectivityScore = this.analyzeConnectivity(sentences);
      score += connectivityScore * 0.3;
      if (connectivityScore > 0.5) {
        factors.push('Good logical flow');
      }
    }

    // Topic consistency
    const topicScore = this.analyzeTopicConsistency(content);
    score += topicScore * 0.4;
    if (topicScore > 0.6) {
      factors.push('Consistent topic focus');
    }

    // Coherence indicators
    const coherenceWords = ['therefore', 'however', 'moreover', 'furthermore', 'consequently'];
    const coherenceCount = coherenceWords.filter(word => 
      content.toLowerCase().includes(word)).length;
    
    if (coherenceCount >= 2) {
      score += 0.2;
      factors.push('Strong logical connections');
    } else if (coherenceCount >= 1) {
      score += 0.1;
      factors.push('Some logical connections');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        sentenceCount: sentences.length,
        coherenceWords: coherenceCount,
        topicConsistency: topicScore
      }
    };
  }

  /**
   * Assess factual accuracy indicators
   */
  assessFactualIndicators(content) {
    const factors = [];
    let score = 0.5;

    const contentLower = content.toLowerCase();

    // Specific claims and evidence
    const specificCount = this.config.factualIndicators.specific
      .filter(indicator => contentLower.includes(indicator)).length;
    
    if (specificCount >= 3) {
      score += 0.3;
      factors.push('Multiple specific claims');
    } else if (specificCount >= 1) {
      score += 0.15;
      factors.push('Some specific details');
    }

    // Quantitative information
    const quantCount = this.config.factualIndicators.quantitative
      .filter(indicator => contentLower.includes(indicator)).length;
    
    if (quantCount >= 2) {
      score += 0.2;
      factors.push('Quantitative information');
    }

    // Temporal context
    const temporalCount = this.config.factualIndicators.temporal
      .filter(indicator => contentLower.includes(indicator)).length;
    
    if (temporalCount >= 1) {
      score += 0.1;
      factors.push('Temporal context provided');
    }

    // Comparative analysis
    const comparativeCount = this.config.factualIndicators.comparative
      .filter(indicator => contentLower.includes(indicator)).length;
    
    if (comparativeCount >= 1) {
      score += 0.1;
      factors.push('Comparative analysis');
    }

    // Avoid vague language penalty
    const vagueWords = ['might', 'could', 'possibly', 'perhaps', 'maybe'];
    const vagueCount = vagueWords.filter(word => contentLower.includes(word)).length;
    
    if (vagueCount > 3) {
      score -= 0.2;
      factors.push('Excessive vague language');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        specificClaims: specificCount,
        quantitativeInfo: quantCount,
        temporalContext: temporalCount,
        comparativeAnalysis: comparativeCount,
        vagueLanguage: vagueCount
      }
    };
  }

  /**
   * Assess response completeness
   */
  assessCompleteness(content, context = {}) {
    const factors = [];
    let score = 0.5;

    const wordCount = content.trim().split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Length-based completeness
    if (wordCount >= this.config.optimalWordRange.min && 
        wordCount <= this.config.optimalWordRange.max) {
      score += 0.3;
      factors.push('Appropriate response length');
    } else if (wordCount < this.config.optimalWordRange.min) {
      score -= 0.2;
      factors.push('Response may be incomplete');
    }

    // Structural completeness
    if (content.includes('conclusion') || content.includes('summary') || 
        content.includes('in summary') || content.includes('finally')) {
      score += 0.2;
      factors.push('Includes conclusion');
    }

    // Multi-aspect coverage
    const aspectIndicators = ['first', 'second', 'also', 'additionally', 'furthermore'];
    const aspectCount = aspectIndicators.filter(indicator => 
      content.toLowerCase().includes(indicator)).length;
    
    if (aspectCount >= 3) {
      score += 0.2;
      factors.push('Multi-aspect coverage');
    } else if (aspectCount >= 1) {
      score += 0.1;
      factors.push('Some aspect coverage');
    }

    // Question addressing (if context provided)
    if (context.originalPrompt) {
      const addressingScore = this.assessQuestionAddressing(content, context.originalPrompt);
      score += addressingScore * 0.3;
      if (addressingScore > 0.7) {
        factors.push('Directly addresses question');
      }
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        wordCount,
        sentenceCount: sentences.length,
        aspectCoverage: aspectCount,
        hasConclusion: content.toLowerCase().includes('conclusion')
      }
    };
  }

  /**
   * Calculate weighted overall score
   */
  calculateWeightedScore(scores) {
    return Object.entries(this.config.weights).reduce((total, [component, weight]) => {
      return total + (scores[component] || 0) * weight;
    }, 0);
  }

  /**
   * Helper methods for analysis
   */
  analyzeConnectivity(sentences) {
    // Simple connectivity analysis based on transition words
    const transitions = ['however', 'therefore', 'moreover', 'furthermore', 'additionally'];
    let connectivityScore = 0;
    
    sentences.forEach(sentence => {
      const hasTransition = transitions.some(trans => 
        sentence.toLowerCase().includes(trans));
      if (hasTransition) connectivityScore += 0.2;
    });

    return Math.min(1, connectivityScore);
  }

  analyzeTopicConsistency(content) {
    // Basic topic consistency - could be enhanced with NLP
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = (words.length - uniqueWords.size) / words.length;
    
    // Higher repetition of key terms suggests topic consistency
    return Math.min(1, repetitionRatio * 2);
  }

  assessQuestionAddressing(content, prompt) {
    // Simple keyword matching - could be enhanced with semantic similarity
    const promptWords = prompt.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3);
    const contentLower = content.toLowerCase();
    
    const matchedWords = promptWords.filter(word => 
      contentLower.includes(word)).length;
    
    return promptWords.length > 0 ? matchedWords / promptWords.length : 0.5;
  }

  createEmptyQualityResult() {
    return {
      overallScore: 0,
      qualityLevel: 'very-low',
      components: {},
      metrics: { wordCount: 0, sentenceCount: 0 },
      processingTime: 0
    };
  }

  createFallbackQualityResult() {
    return {
      overallScore: 0.5,
      qualityLevel: 'medium',
      components: {},
      metrics: { wordCount: 0, sentenceCount: 0 },
      processingTime: 0
    };
  }

  getQualityLevel(score) {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.7) return 'very-high';
    if (score >= 0.6) return 'high';
    if (score >= 0.5) return 'medium';
    if (score >= 0.3) return 'low';
    return 'very-low';
  }

  /**
   * Assess educational value of content
   */
  assessEducationalValue(content) {
    const factors = [];
    let score = 0.5;

    const contentLower = content.toLowerCase();

    // Educational structure indicators
    const educationalCount = this.config.educationalKeywords
      .filter(keyword => contentLower.includes(keyword)).length;

    if (educationalCount >= 5) {
      score += 0.3;
      factors.push('Strong educational structure');
    } else if (educationalCount >= 3) {
      score += 0.2;
      factors.push('Good educational elements');
    } else if (educationalCount >= 1) {
      score += 0.1;
      factors.push('Some educational structure');
    }

    // Examples and illustrations
    if (contentLower.includes('example') || contentLower.includes('for instance')) {
      score += 0.2;
      factors.push('Includes examples');
    }

    // Progressive complexity
    if (contentLower.includes('basic') && contentLower.includes('advanced')) {
      score += 0.15;
      factors.push('Progressive complexity');
    }

    // Technical depth
    const technicalCount = this.config.technicalIndicators
      .filter(indicator => contentLower.includes(indicator)).length;

    if (technicalCount >= 3) {
      score += 0.15;
      factors.push('Technical depth');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        educationalKeywords: educationalCount,
        hasExamples: contentLower.includes('example'),
        technicalDepth: technicalCount
      }
    };
  }

  /**
   * Assess response structure and organization
   */
  assessStructure(content) {
    const factors = [];
    let score = 0.5;

    // Paragraph structure
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length >= 3) {
      score += 0.2;
      factors.push('Well-organized paragraphs');
    }

    // Lists and bullet points
    if (content.includes('1.') || content.includes('•') || content.includes('-')) {
      score += 0.2;
      factors.push('Organized formatting');
    }

    // Headers and sections
    if (content.includes('###') || content.includes('**') || content.includes('##')) {
      score += 0.15;
      factors.push('Clear section headers');
    }

    // Logical flow indicators
    const flowWords = ['first', 'second', 'third', 'finally', 'next', 'then'];
    const flowCount = flowWords.filter(word => content.toLowerCase().includes(word)).length;

    if (flowCount >= 3) {
      score += 0.15;
      factors.push('Strong logical flow');
    } else if (flowCount >= 1) {
      score += 0.1;
      factors.push('Some logical flow');
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
   * Assess clarity and readability
   */
  assessClarity(content) {
    const factors = [];
    let score = 0.5;

    const words = content.trim().split(/\s+/);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Sentence length analysis
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;

    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) {
      score += 0.2;
      factors.push('Optimal sentence length');
    } else if (avgWordsPerSentence > 25) {
      score -= 0.1;
      factors.push('Sentences may be too long');
    }

    // Readability indicators
    const simpleWords = words.filter(word => word.length <= 6).length;
    const readabilityRatio = simpleWords / words.length;

    if (readabilityRatio >= 0.6) {
      score += 0.15;
      factors.push('Good readability');
    }

    // Active voice indicators (simple heuristic)
    const passiveIndicators = ['was', 'were', 'been', 'being'];
    const passiveCount = passiveIndicators.filter(indicator =>
      content.toLowerCase().includes(indicator)).length;

    if (passiveCount < sentences.length * 0.3) {
      score += 0.1;
      factors.push('Mostly active voice');
    }

    // Clarity enhancers
    if (content.includes('clearly') || content.includes('specifically') ||
        content.includes('precisely')) {
      score += 0.05;
      factors.push('Clarity enhancers');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        avgWordsPerSentence,
        readabilityRatio,
        passiveVoiceCount: passiveCount,
        totalSentences: sentences.length
      }
    };
  }

  /**
   * Calculate comprehensive content metrics
   */
  calculateContentMetrics(content) {
    const words = content.trim().split(/\s+/);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      averageWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
      averageWordsPerParagraph: paragraphs.length > 0 ? words.length / paragraphs.length : 0,
      hasStructure: content.includes('\n') || content.includes('.'),
      hasFormatting: content.includes('**') || content.includes('###') || content.includes('1.'),
      complexity: this.assessComplexity(words.length)
    };
  }

  /**
   * Assess content complexity level
   */
  assessComplexity(wordCount) {
    if (wordCount < 50) return 'simple';
    if (wordCount < 150) return 'moderate';
    if (wordCount < 300) return 'high';
    if (wordCount < 500) return 'very-high';
    return 'complex';
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      highQualityRate: this.metrics.assessmentsPerformed > 0 ?
        this.metrics.highQualityResponses / this.metrics.assessmentsPerformed : 0
    };
  }

  updateMetrics(result) {
    this.metrics.assessmentsPerformed++;
    this.metrics.averageQualityScore =
      (this.metrics.averageQualityScore + result.overallScore) / 2;

    if (result.overallScore >= 0.7) {
      this.metrics.highQualityResponses++;
    }
  }
}

module.exports = new EnhancedContentQualityService();
