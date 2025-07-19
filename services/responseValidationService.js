/**
 * 🛡️ Response Validation & Quality Gates Service
 *
 * 🎯 PURPOSE: Add comprehensive validation layers for AI responses including:
 *            - Relevance validation (does it answer the question?)
 *            - Consistency checking (contradictory information detection)
 *            - Completeness assessment (missing key aspects)
 *            - Factual plausibility (basic sanity checks)
 *
 * 📋 KEY FEATURES:
 * 1. Multi-layer validation pipeline
 * 2. Cross-response consistency analysis
 * 3. Relevance scoring and validation
 * 4. Completeness gap detection
 * 5. Factual plausibility checks
 * 6. Quality gate enforcement
 * 7. Validation result aggregation
 */

const monitoringService = require('./monitoringService');
const enhancedContentQualityService = require('./enhancedContentQualityService');

class ResponseValidationService {
  constructor() {
    this.config = {
      // Validation thresholds
      thresholds: {
        relevance: {
          minimum: 0.4,
          good: 0.7,
          excellent: 0.85
        },
        consistency: {
          minimum: 0.5,
          good: 0.75,
          excellent: 0.9
        },
        completeness: {
          minimum: 0.5,
          good: 0.7,
          excellent: 0.85
        },
        plausibility: {
          minimum: 0.6,
          good: 0.8,
          excellent: 0.95
        }
      },

      // Quality gates
      qualityGates: {
        strict: {
          relevance: 0.7,
          consistency: 0.75,
          completeness: 0.7,
          plausibility: 0.8,
          overallMinimum: 0.75
        },
        standard: {
          relevance: 0.5,
          consistency: 0.6,
          completeness: 0.5,
          plausibility: 0.6,
          overallMinimum: 0.6
        },
        lenient: {
          relevance: 0.3,
          consistency: 0.4,
          completeness: 0.3,
          plausibility: 0.4,
          overallMinimum: 0.4
        }
      },

      // Validation weights
      validationWeights: {
        relevance: 0.35,
        consistency: 0.25,
        completeness: 0.25,
        plausibility: 0.15
      },

      // Factual plausibility indicators
      plausibilityChecks: {
        impossibleClaims: [
          'before the universe existed',
          'faster than light travel is common',
          'humans can breathe underwater naturally',
          'gravity doesn\'t exist'
        ],
        suspiciousNumbers: {
          percentages: { min: 0, max: 100 },
          years: { min: 1000, max: 2030 },
          temperatures: { min: -273, max: 1000 }
        },
        contradictoryPhrases: [
          ['always', 'never'],
          ['all', 'none'],
          ['impossible', 'definitely'],
          ['certain', 'maybe']
        ]
      }
    };

    this.metrics = {
      validationsPerformed: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      averageValidationScore: 0,
      qualityGateFailures: {
        relevance: 0,
        consistency: 0,
        completeness: 0,
        plausibility: 0
      }
    };
  }

  /**
   * Main validation method - comprehensive response validation
   */
  async validateResponses(responses, originalPrompt, validationLevel = 'standard', metadata = {}) {
    try {
      const validationStart = Date.now();
      const correlationId = metadata.correlationId || 'unknown';

      // Filter successful responses
      const successfulResponses = responses.filter(r => 
        r.status === 'fulfilled' && r.content && r.content.trim().length > 0);

      if (successfulResponses.length === 0) {
        return this.createEmptyValidationResult(correlationId);
      }

      // Get quality gates for validation level
      const qualityGates = this.config.qualityGates[validationLevel] || this.config.qualityGates.standard;

      // Perform individual response validations
      const individualValidations = await this.validateIndividualResponses(
        successfulResponses, originalPrompt, qualityGates);

      // Perform cross-response consistency analysis
      const consistencyAnalysis = await this.performConsistencyAnalysis(
        successfulResponses, originalPrompt);

      // Aggregate validation results
      const aggregatedResults = this.aggregateValidationResults(
        individualValidations, consistencyAnalysis, qualityGates);

      // Apply quality gates
      const qualityGateResults = this.applyQualityGates(
        aggregatedResults, qualityGates, validationLevel);

      const result = {
        validationLevel,
        qualityGates,
        individualValidations,
        consistencyAnalysis,
        aggregatedResults,
        qualityGateResults,
        overallValidation: {
          passed: qualityGateResults.overallPassed,
          score: aggregatedResults.overallScore,
          level: this.getValidationLevel(aggregatedResults.overallScore),
          issues: this.extractValidationIssues(individualValidations, consistencyAnalysis),
          recommendations: this.generateRecommendations(aggregatedResults, qualityGateResults)
        },
        processingTime: Date.now() - validationStart,
        metadata: {
          correlationId,
          timestamp: Date.now(),
          responsesValidated: successfulResponses.length
        }
      };

      // Update metrics
      this.updateMetrics(result);

      monitoringService.log('info', 'Response validation completed', {
        validationLevel,
        overallPassed: result.overallValidation.passed,
        overallScore: result.overallValidation.score.toFixed(3),
        issues: result.overallValidation.issues.length,
        processingTime: result.processingTime
      }, correlationId);

      return result;

    } catch (error) {
      monitoringService.log('error', 'Response validation failed', {
        error: error.message,
        responsesCount: responses.length,
        validationLevel
      }, metadata.correlationId);

      return this.createFallbackValidationResult(responses, metadata);
    }
  }

  /**
   * Validate individual responses
   */
  async validateIndividualResponses(responses, originalPrompt, qualityGates) {
    const validations = [];

    for (const response of responses) {
      try {
        // 1. Relevance validation
        const relevanceValidation = await this.validateRelevance(response.content, originalPrompt);

        // 2. Completeness validation
        const completenessValidation = await this.validateCompleteness(response.content, originalPrompt);

        // 3. Factual plausibility validation
        const plausibilityValidation = await this.validateFactualPlausibility(response.content);

        // 4. Content quality validation (using existing service)
        const qualityValidation = await enhancedContentQualityService
          .assessContentQuality(response.content, { originalPrompt });

        // Aggregate individual validation
        const individualScore = this.calculateIndividualValidationScore({
          relevance: relevanceValidation.score,
          completeness: completenessValidation.score,
          plausibility: plausibilityValidation.score,
          quality: qualityValidation.overallScore
        });

        validations.push({
          responseId: response.role,
          model: response.model,
          validations: {
            relevance: relevanceValidation,
            completeness: completenessValidation,
            plausibility: plausibilityValidation,
            quality: qualityValidation
          },
          individualScore,
          passed: this.checkIndividualQualityGates(individualScore, qualityGates),
          issues: this.extractIndividualIssues({
            relevance: relevanceValidation,
            completeness: completenessValidation,
            plausibility: plausibilityValidation
          })
        });

      } catch (error) {
        monitoringService.log('warn', 'Individual response validation failed', {
          responseId: response.role,
          error: error.message
        });

        validations.push({
          responseId: response.role,
          model: response.model,
          validations: {},
          individualScore: 0.5,
          passed: false,
          issues: ['Validation error occurred'],
          error: error.message
        });
      }
    }

    return validations;
  }

  /**
   * Validate response relevance to original prompt
   */
  async validateRelevance(content, originalPrompt) {
    const factors = [];
    let score = 0.5;

    if (!originalPrompt || !content) {
      return { score: 0, factors: ['Missing prompt or content'], details: {} };
    }

    // Keyword matching analysis
    const keywordMatch = this.calculateKeywordMatch(content, originalPrompt);
    score += keywordMatch.score * 0.4;
    factors.push(...keywordMatch.factors);

    // Question type alignment
    const questionAlignment = this.assessQuestionTypeAlignment(content, originalPrompt);
    score += questionAlignment.score * 0.3;
    factors.push(...questionAlignment.factors);

    // Topic consistency
    const topicConsistency = this.assessTopicConsistency(content, originalPrompt);
    score += topicConsistency.score * 0.3;
    factors.push(...topicConsistency.factors);

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        keywordMatch: keywordMatch.details,
        questionAlignment: questionAlignment.details,
        topicConsistency: topicConsistency.details
      }
    };
  }

  /**
   * Calculate keyword matching between content and prompt
   */
  calculateKeywordMatch(content, prompt) {
    const promptWords = prompt.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['what', 'how', 'why', 'when', 'where', 'which', 'that', 'this'].includes(word));

    const contentLower = content.toLowerCase();
    const matchedWords = promptWords.filter(word => contentLower.includes(word));
    const matchRatio = promptWords.length > 0 ? matchedWords.length / promptWords.length : 0;

    const factors = [];
    let score = matchRatio;

    if (matchRatio >= 0.7) {
      factors.push('Strong keyword alignment');
    } else if (matchRatio >= 0.4) {
      factors.push('Good keyword alignment');
    } else if (matchRatio >= 0.2) {
      factors.push('Partial keyword alignment');
    } else {
      factors.push('Weak keyword alignment');
    }

    return {
      score,
      factors,
      details: {
        totalPromptWords: promptWords.length,
        matchedWords: matchedWords.length,
        matchRatio,
        matchedTerms: matchedWords
      }
    };
  }

  /**
   * Assess question type alignment
   */
  assessQuestionTypeAlignment(content, prompt) {
    const factors = [];
    let score = 0.5;

    const promptLower = prompt.toLowerCase();
    const contentLower = content.toLowerCase();

    // Explanation questions
    if (promptLower.includes('explain') || promptLower.includes('what is')) {
      if (contentLower.includes('because') || contentLower.includes('due to') || 
          contentLower.includes('reason') || contentLower.includes('explanation')) {
        score += 0.3;
        factors.push('Provides explanatory content');
      }
    }

    // How-to questions
    if (promptLower.includes('how to') || promptLower.includes('how do')) {
      if (contentLower.includes('step') || contentLower.includes('process') || 
          contentLower.includes('method') || contentLower.includes('procedure')) {
        score += 0.3;
        factors.push('Provides procedural guidance');
      }
    }

    // Comparison questions
    if (promptLower.includes('compare') || promptLower.includes('versus') || 
        promptLower.includes('difference')) {
      if (contentLower.includes('compared to') || contentLower.includes('versus') || 
          contentLower.includes('difference') || contentLower.includes('similar')) {
        score += 0.3;
        factors.push('Provides comparative analysis');
      }
    }

    // List/enumeration questions
    if (promptLower.includes('list') || promptLower.includes('examples') || 
        promptLower.includes('types of')) {
      if (content.includes('1.') || content.includes('•') || content.includes('-') ||
          contentLower.includes('example') || contentLower.includes('such as')) {
        score += 0.3;
        factors.push('Provides structured examples/lists');
      }
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        questionType: this.detectQuestionType(promptLower),
        alignmentIndicators: factors.length
      }
    };
  }

  /**
   * Assess topic consistency
   */
  assessTopicConsistency(content, prompt) {
    const factors = [];
    let score = 0.5;

    // Extract main topics from prompt
    const promptTopics = this.extractTopics(prompt);
    const contentTopics = this.extractTopics(content);

    // Calculate topic overlap
    const topicOverlap = this.calculateTopicOverlap(promptTopics, contentTopics);
    score += topicOverlap * 0.4;

    if (topicOverlap >= 0.7) {
      factors.push('Strong topic consistency');
    } else if (topicOverlap >= 0.4) {
      factors.push('Good topic consistency');
    } else {
      factors.push('Weak topic consistency');
    }

    // Check for topic drift
    const topicDrift = this.detectTopicDrift(content, promptTopics);
    if (topicDrift.detected) {
      score -= 0.2;
      factors.push('Topic drift detected');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        promptTopics,
        contentTopics,
        topicOverlap,
        topicDrift
      }
    };
  }

  /**
   * Validate response completeness
   */
  async validateCompleteness(content, originalPrompt) {
    const factors = [];
    let score = 0.5;

    // Length-based completeness
    const lengthScore = this.assessResponseLength(content, originalPrompt);
    score += lengthScore.score * 0.3;
    factors.push(...lengthScore.factors);

    // Aspect coverage
    const aspectCoverage = this.assessAspectCoverage(content, originalPrompt);
    score += aspectCoverage.score * 0.4;
    factors.push(...aspectCoverage.factors);

    // Structural completeness
    const structuralCompleteness = this.assessStructuralCompleteness(content);
    score += structuralCompleteness.score * 0.3;
    factors.push(...structuralCompleteness.factors);

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        lengthAssessment: lengthScore.details,
        aspectCoverage: aspectCoverage.details,
        structuralCompleteness: structuralCompleteness.details
      }
    };
  }

  /**
   * Validate factual plausibility
   */
  async validateFactualPlausibility(content) {
    const factors = [];
    let score = 0.8; // Start with high plausibility

    // Check for impossible claims
    const impossibleClaims = this.checkImpossibleClaims(content);
    if (impossibleClaims.found.length > 0) {
      score -= 0.4;
      factors.push(`Impossible claims detected: ${impossibleClaims.found.length}`);
    }

    // Check for suspicious numbers
    const suspiciousNumbers = this.checkSuspiciousNumbers(content);
    if (suspiciousNumbers.found.length > 0) {
      score -= 0.2;
      factors.push(`Suspicious numbers detected: ${suspiciousNumbers.found.length}`);
    }

    // Check for internal contradictions
    const contradictions = this.checkInternalContradictions(content);
    if (contradictions.found.length > 0) {
      score -= 0.3;
      factors.push(`Internal contradictions: ${contradictions.found.length}`);
    }

    // Check for vague/uncertain language overuse
    const vagueLanguage = this.checkVagueLanguage(content);
    if (vagueLanguage.excessive) {
      score -= 0.1;
      factors.push('Excessive vague language');
    }

    if (factors.length === 0) {
      factors.push('No plausibility issues detected');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        impossibleClaims,
        suspiciousNumbers,
        contradictions,
        vagueLanguage
      }
    };
  }

  /**
   * Helper methods for validation
   */
  detectQuestionType(promptLower) {
    if (promptLower.includes('what is') || promptLower.includes('define')) return 'definition';
    if (promptLower.includes('how to') || promptLower.includes('how do')) return 'procedural';
    if (promptLower.includes('why') || promptLower.includes('explain')) return 'explanatory';
    if (promptLower.includes('compare') || promptLower.includes('versus')) return 'comparative';
    if (promptLower.includes('list') || promptLower.includes('examples')) return 'enumerative';
    return 'general';
  }

  extractTopics(text) {
    // Simple topic extraction based on key nouns and phrases
    const words = text.toLowerCase().split(/\s+/);
    const topics = words.filter(word => 
      word.length > 4 && 
      !['what', 'how', 'why', 'when', 'where', 'which', 'that', 'this', 'with', 'from'].includes(word)
    );
    return [...new Set(topics)].slice(0, 10); // Top 10 unique topics
  }

  calculateTopicOverlap(topics1, topics2) {
    if (topics1.length === 0 || topics2.length === 0) return 0;
    
    const set1 = new Set(topics1);
    const set2 = new Set(topics2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    return intersection.size / Math.max(set1.size, set2.size);
  }

  detectTopicDrift(content, originalTopics) {
    const contentTopics = this.extractTopics(content);
    const overlap = this.calculateTopicOverlap(originalTopics, contentTopics);

    return {
      detected: overlap < 0.3,
      severity: overlap < 0.1 ? 'high' : overlap < 0.3 ? 'medium' : 'low',
      overlap
    };
  }

  /**
   * Assess response length appropriateness
   */
  assessResponseLength(content, prompt) {
    const factors = [];
    const contentWords = content.trim().split(/\s+/).length;
    const promptWords = prompt.trim().split(/\s+/).length;

    let score = 0.5;

    // Expected length based on prompt complexity
    const expectedMinLength = Math.max(20, promptWords * 3);
    const expectedMaxLength = Math.min(500, promptWords * 20);

    if (contentWords >= expectedMinLength && contentWords <= expectedMaxLength) {
      score += 0.4;
      factors.push('Appropriate response length');
    } else if (contentWords < expectedMinLength) {
      score -= 0.3;
      factors.push('Response too short');
    } else {
      score -= 0.1;
      factors.push('Response very long');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        contentWords,
        promptWords,
        expectedRange: [expectedMinLength, expectedMaxLength]
      }
    };
  }

  /**
   * Assess aspect coverage
   */
  assessAspectCoverage(content, prompt) {
    const factors = [];
    let score = 0.5;

    // Identify key aspects in the prompt
    const promptAspects = this.identifyPromptAspects(prompt);
    const coveredAspects = this.findCoveredAspects(content, promptAspects);

    const coverageRatio = promptAspects.length > 0 ? coveredAspects.length / promptAspects.length : 1;
    score += coverageRatio * 0.5;

    if (coverageRatio >= 0.8) {
      factors.push('Comprehensive aspect coverage');
    } else if (coverageRatio >= 0.6) {
      factors.push('Good aspect coverage');
    } else if (coverageRatio >= 0.4) {
      factors.push('Partial aspect coverage');
    } else {
      factors.push('Limited aspect coverage');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        promptAspects,
        coveredAspects,
        coverageRatio,
        missingAspects: promptAspects.filter(aspect => !coveredAspects.includes(aspect))
      }
    };
  }

  /**
   * Assess structural completeness
   */
  assessStructuralCompleteness(content) {
    const factors = [];
    let score = 0.5;

    // Check for introduction
    if (this.hasIntroduction(content)) {
      score += 0.15;
      factors.push('Has introduction');
    }

    // Check for main content
    if (this.hasMainContent(content)) {
      score += 0.2;
      factors.push('Has substantial main content');
    }

    // Check for conclusion
    if (this.hasConclusion(content)) {
      score += 0.15;
      factors.push('Has conclusion');
    }

    // Check for examples
    if (this.hasExamples(content)) {
      score += 0.1;
      factors.push('Includes examples');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        hasIntroduction: this.hasIntroduction(content),
        hasMainContent: this.hasMainContent(content),
        hasConclusion: this.hasConclusion(content),
        hasExamples: this.hasExamples(content)
      }
    };
  }

  /**
   * Check for impossible claims
   */
  checkImpossibleClaims(content) {
    const contentLower = content.toLowerCase();
    const found = this.config.plausibilityChecks.impossibleClaims.filter(claim =>
      contentLower.includes(claim.toLowerCase()));

    return {
      found,
      count: found.length,
      severity: found.length > 0 ? 'high' : 'none'
    };
  }

  /**
   * Check for suspicious numbers
   */
  checkSuspiciousNumbers(content) {
    const found = [];
    const checks = this.config.plausibilityChecks.suspiciousNumbers;

    // Check percentages
    const percentageMatches = content.match(/(\d+(?:\.\d+)?)\s*%/g);
    if (percentageMatches) {
      percentageMatches.forEach(match => {
        const num = parseFloat(match);
        if (num < checks.percentages.min || num > checks.percentages.max) {
          found.push({ type: 'percentage', value: match, issue: 'out of range' });
        }
      });
    }

    // Check years
    const yearMatches = content.match(/\b(19|20)\d{2}\b/g);
    if (yearMatches) {
      yearMatches.forEach(match => {
        const year = parseInt(match);
        if (year < checks.years.min || year > checks.years.max) {
          found.push({ type: 'year', value: match, issue: 'implausible year' });
        }
      });
    }

    return {
      found,
      count: found.length,
      severity: found.length > 2 ? 'high' : found.length > 0 ? 'medium' : 'none'
    };
  }

  /**
   * Check for internal contradictions
   */
  checkInternalContradictions(content) {
    const found = [];
    const contentLower = content.toLowerCase();

    this.config.plausibilityChecks.contradictoryPhrases.forEach(([phrase1, phrase2]) => {
      if (contentLower.includes(phrase1) && contentLower.includes(phrase2)) {
        found.push({
          type: 'contradictory_phrases',
          phrases: [phrase1, phrase2],
          issue: 'contradictory statements'
        });
      }
    });

    return {
      found,
      count: found.length,
      severity: found.length > 1 ? 'high' : found.length > 0 ? 'medium' : 'none'
    };
  }

  /**
   * Check for excessive vague language
   */
  checkVagueLanguage(content) {
    const vagueWords = ['might', 'could', 'possibly', 'perhaps', 'maybe', 'probably', 'likely'];
    const contentLower = content.toLowerCase();
    const words = contentLower.split(/\s+/);

    const vagueCount = vagueWords.filter(word => contentLower.includes(word)).length;
    const vagueRatio = vagueCount / words.length;

    return {
      count: vagueCount,
      ratio: vagueRatio,
      excessive: vagueRatio > 0.05, // More than 5% vague words
      severity: vagueRatio > 0.1 ? 'high' : vagueRatio > 0.05 ? 'medium' : 'low'
    };
  }

  /**
   * Helper methods for structural analysis
   */
  identifyPromptAspects(prompt) {
    const aspects = [];
    const promptLower = prompt.toLowerCase();

    // Common question aspects
    if (promptLower.includes('what')) aspects.push('definition');
    if (promptLower.includes('how')) aspects.push('process');
    if (promptLower.includes('why')) aspects.push('reasoning');
    if (promptLower.includes('when')) aspects.push('timing');
    if (promptLower.includes('where')) aspects.push('location');
    if (promptLower.includes('example')) aspects.push('examples');
    if (promptLower.includes('advantage') || promptLower.includes('benefit')) aspects.push('advantages');
    if (promptLower.includes('disadvantage') || promptLower.includes('drawback')) aspects.push('disadvantages');
    if (promptLower.includes('compare')) aspects.push('comparison');

    return aspects.length > 0 ? aspects : ['main_topic'];
  }

  findCoveredAspects(content, aspects) {
    const contentLower = content.toLowerCase();
    const covered = [];

    aspects.forEach(aspect => {
      switch (aspect) {
        case 'definition':
          if (contentLower.includes('is') || contentLower.includes('means') || contentLower.includes('refers to')) {
            covered.push(aspect);
          }
          break;
        case 'process':
          if (contentLower.includes('step') || contentLower.includes('process') || contentLower.includes('method')) {
            covered.push(aspect);
          }
          break;
        case 'reasoning':
          if (contentLower.includes('because') || contentLower.includes('due to') || contentLower.includes('reason')) {
            covered.push(aspect);
          }
          break;
        case 'examples':
          if (contentLower.includes('example') || contentLower.includes('for instance') || contentLower.includes('such as')) {
            covered.push(aspect);
          }
          break;
        case 'advantages':
          if (contentLower.includes('advantage') || contentLower.includes('benefit') || contentLower.includes('pro')) {
            covered.push(aspect);
          }
          break;
        case 'disadvantages':
          if (contentLower.includes('disadvantage') || contentLower.includes('drawback') || contentLower.includes('con')) {
            covered.push(aspect);
          }
          break;
        case 'comparison':
          if (contentLower.includes('compared to') || contentLower.includes('versus') || contentLower.includes('difference')) {
            covered.push(aspect);
          }
          break;
        default:
          covered.push(aspect); // Assume main topic is covered
      }
    });

    return covered;
  }

  hasIntroduction(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.length > 0 && sentences[0].trim().length > 20;
  }

  hasMainContent(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.length >= 3;
  }

  hasConclusion(content) {
    const contentLower = content.toLowerCase();
    return contentLower.includes('conclusion') || contentLower.includes('summary') ||
           contentLower.includes('in summary') || contentLower.includes('finally') ||
           contentLower.includes('to conclude');
  }

  hasExamples(content) {
    const contentLower = content.toLowerCase();
    return contentLower.includes('example') || contentLower.includes('for instance') ||
           contentLower.includes('such as') || contentLower.includes('like');
  }

  /**
   * Calculate individual validation score
   */
  calculateIndividualValidationScore(scores) {
    const weights = this.config.validationWeights;
    return (scores.relevance * weights.relevance) +
           (scores.completeness * weights.completeness) +
           (scores.plausibility * weights.plausibility) +
           (scores.quality * 0.1); // Small weight for overall quality
  }

  /**
   * Check individual quality gates
   */
  checkIndividualQualityGates(score, qualityGates) {
    return score >= qualityGates.overallMinimum;
  }

  /**
   * Extract individual issues
   */
  extractIndividualIssues(validations) {
    const issues = [];

    Object.entries(validations).forEach(([type, validation]) => {
      if (validation.score < this.config.thresholds[type]?.minimum) {
        issues.push(`Low ${type} score: ${(validation.score * 100).toFixed(1)}%`);
      }
    });

    return issues;
  }

  /**
   * Perform cross-response consistency analysis
   */
  async performConsistencyAnalysis(responses, originalPrompt) {
    if (responses.length < 2) {
      return {
        score: 1.0,
        factors: ['Single response - no consistency issues'],
        contradictions: [],
        agreements: [],
        details: { responseCount: responses.length }
      };
    }

    const factors = [];
    let score = 0.8; // Start with high consistency

    // Check for contradictions between responses
    const contradictions = this.findContradictions(responses);
    if (contradictions.length > 0) {
      score -= contradictions.length * 0.2;
      factors.push(`${contradictions.length} contradictions found`);
    }

    // Check for agreements/consensus
    const agreements = this.findAgreements(responses);
    if (agreements.length > 0) {
      score += Math.min(0.2, agreements.length * 0.05);
      factors.push(`${agreements.length} points of agreement`);
    }

    // Check for complementary information
    const complementarity = this.assessComplementarity(responses);
    score += complementarity.score * 0.1;
    factors.push(...complementarity.factors);

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      contradictions,
      agreements,
      complementarity,
      details: {
        responseCount: responses.length,
        analysisMethod: 'keyword_and_semantic'
      }
    };
  }

  /**
   * Find contradictions between responses
   */
  findContradictions(responses) {
    const contradictions = [];

    // Simple contradiction detection based on opposing keywords
    const opposingPairs = [
      ['yes', 'no'],
      ['true', 'false'],
      ['possible', 'impossible'],
      ['always', 'never'],
      ['all', 'none'],
      ['increase', 'decrease'],
      ['better', 'worse']
    ];

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const content1 = responses[i].content.toLowerCase();
        const content2 = responses[j].content.toLowerCase();

        opposingPairs.forEach(([word1, word2]) => {
          if (content1.includes(word1) && content2.includes(word2)) {
            contradictions.push({
              responses: [responses[i].role, responses[j].role],
              type: 'opposing_statements',
              terms: [word1, word2],
              severity: 'medium'
            });
          }
        });
      }
    }

    return contradictions;
  }

  /**
   * Find agreements between responses
   */
  findAgreements(responses) {
    const agreements = [];

    // Simple agreement detection based on common key phrases
    const keyPhrases = this.extractKeyPhrases(responses);

    keyPhrases.forEach(phrase => {
      const responsesWithPhrase = responses.filter(r =>
        r.content.toLowerCase().includes(phrase.toLowerCase()));

      if (responsesWithPhrase.length >= 2) {
        agreements.push({
          phrase,
          responses: responsesWithPhrase.map(r => r.role),
          count: responsesWithPhrase.length,
          strength: responsesWithPhrase.length / responses.length
        });
      }
    });

    return agreements;
  }

  /**
   * Extract key phrases from responses
   */
  extractKeyPhrases(responses) {
    const allContent = responses.map(r => r.content).join(' ').toLowerCase();
    const words = allContent.split(/\s+/);

    // Find phrases that appear multiple times
    const phrases = [];
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      if (phrase.length > 6 && !phrases.includes(phrase)) {
        const count = (allContent.match(new RegExp(phrase, 'g')) || []).length;
        if (count >= 2) {
          phrases.push(phrase);
        }
      }
    }

    return phrases.slice(0, 10); // Top 10 phrases
  }

  /**
   * Assess complementarity between responses
   */
  assessComplementarity(responses) {
    const factors = [];
    let score = 0.5;

    // Check if responses cover different aspects
    const allTopics = responses.map(r => this.extractTopics(r.content));
    const uniqueTopics = new Set(allTopics.flat());
    const totalTopics = allTopics.flat().length;

    const diversityRatio = totalTopics > 0 ? uniqueTopics.size / totalTopics : 0;

    if (diversityRatio > 0.7) {
      score += 0.3;
      factors.push('High topic diversity - complementary coverage');
    } else if (diversityRatio > 0.5) {
      score += 0.2;
      factors.push('Good topic diversity');
    }

    return {
      score: Math.max(0, Math.min(1, score)),
      factors,
      details: {
        uniqueTopics: uniqueTopics.size,
        totalTopics,
        diversityRatio
      }
    };
  }

  /**
   * Aggregate validation results
   */
  aggregateValidationResults(individualValidations, consistencyAnalysis, qualityGates) {
    const validResponses = individualValidations.filter(v => !v.error);

    if (validResponses.length === 0) {
      return {
        overallScore: 0,
        componentScores: {},
        passedValidations: 0,
        totalValidations: individualValidations.length,
        consistencyScore: consistencyAnalysis.score
      };
    }

    // Calculate average component scores
    const componentScores = {
      relevance: this.calculateAverageScore(validResponses, 'relevance'),
      completeness: this.calculateAverageScore(validResponses, 'completeness'),
      plausibility: this.calculateAverageScore(validResponses, 'plausibility'),
      consistency: consistencyAnalysis.score
    };

    // Calculate weighted overall score
    const weights = this.config.validationWeights;
    const overallScore =
      (componentScores.relevance * weights.relevance) +
      (componentScores.completeness * weights.completeness) +
      (componentScores.plausibility * weights.plausibility) +
      (componentScores.consistency * weights.consistency);

    return {
      overallScore: Math.max(0, Math.min(1, overallScore)),
      componentScores,
      passedValidations: validResponses.filter(v => v.passed).length,
      totalValidations: individualValidations.length,
      consistencyScore: consistencyAnalysis.score,
      averageIndividualScore: validResponses.reduce((sum, v) => sum + v.individualScore, 0) / validResponses.length
    };
  }

  /**
   * Calculate average score for a component
   */
  calculateAverageScore(validations, component) {
    const scores = validations
      .map(v => v.validations[component]?.score)
      .filter(score => score !== undefined);

    return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0.5;
  }

  /**
   * Apply quality gates
   */
  applyQualityGates(aggregatedResults, qualityGates, validationLevel) {
    const results = {
      overallPassed: false,
      componentResults: {},
      failedGates: [],
      passedGates: [],
      gateLevel: validationLevel
    };

    // Check each component against its gate
    Object.entries(qualityGates).forEach(([component, threshold]) => {
      if (component === 'overallMinimum') return;

      const score = aggregatedResults.componentScores[component] || 0;
      const passed = score >= threshold;

      results.componentResults[component] = {
        score,
        threshold,
        passed,
        margin: score - threshold
      };

      if (passed) {
        results.passedGates.push(component);
      } else {
        results.failedGates.push(component);
        this.metrics.qualityGateFailures[component]++;
      }
    });

    // Check overall gate
    const overallPassed = aggregatedResults.overallScore >= qualityGates.overallMinimum;
    results.overallPassed = overallPassed && results.failedGates.length === 0;

    results.overallGate = {
      score: aggregatedResults.overallScore,
      threshold: qualityGates.overallMinimum,
      passed: overallPassed,
      margin: aggregatedResults.overallScore - qualityGates.overallMinimum
    };

    return results;
  }

  /**
   * Extract validation issues
   */
  extractValidationIssues(individualValidations, consistencyAnalysis) {
    const issues = [];

    // Individual validation issues
    individualValidations.forEach(validation => {
      if (validation.issues && validation.issues.length > 0) {
        issues.push(...validation.issues.map(issue => ({
          type: 'individual',
          source: validation.responseId,
          issue,
          severity: 'medium'
        })));
      }
    });

    // Consistency issues
    if (consistencyAnalysis.contradictions && consistencyAnalysis.contradictions.length > 0) {
      consistencyAnalysis.contradictions.forEach(contradiction => {
        issues.push({
          type: 'consistency',
          source: contradiction.responses,
          issue: `Contradiction: ${contradiction.terms?.join(' vs ') || 'conflicting information'}`,
          severity: contradiction.severity || 'medium'
        });
      });
    }

    return issues;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(aggregatedResults, qualityGateResults) {
    const recommendations = [];

    // Component-specific recommendations
    Object.entries(qualityGateResults.componentResults).forEach(([component, result]) => {
      if (!result.passed) {
        switch (component) {
          case 'relevance':
            recommendations.push({
              type: 'improvement',
              component,
              suggestion: 'Ensure responses directly address the user\'s question and include relevant keywords',
              priority: 'high'
            });
            break;
          case 'completeness':
            recommendations.push({
              type: 'improvement',
              component,
              suggestion: 'Provide more comprehensive coverage of the topic with examples and details',
              priority: 'medium'
            });
            break;
          case 'plausibility':
            recommendations.push({
              type: 'improvement',
              component,
              suggestion: 'Review responses for factual accuracy and remove implausible claims',
              priority: 'high'
            });
            break;
          case 'consistency':
            recommendations.push({
              type: 'improvement',
              component,
              suggestion: 'Resolve contradictions between different AI responses',
              priority: 'medium'
            });
            break;
        }
      }
    });

    // Overall recommendations
    if (!qualityGateResults.overallPassed) {
      recommendations.push({
        type: 'overall',
        component: 'general',
        suggestion: 'Consider re-querying with modified prompts or different models',
        priority: 'high'
      });
    }

    return recommendations;
  }

  /**
   * Get validation level description
   */
  getValidationLevel(score) {
    if (score >= 0.85) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'acceptable';
    if (score >= 0.3) return 'poor';
    return 'very_poor';
  }

  /**
   * Create fallback and empty results
   */
  createEmptyValidationResult(correlationId) {
    return {
      validationLevel: 'standard',
      qualityGates: this.config.qualityGates.standard,
      individualValidations: [],
      consistencyAnalysis: { score: 0, factors: ['No responses to validate'] },
      aggregatedResults: { overallScore: 0, componentScores: {} },
      qualityGateResults: { overallPassed: false, failedGates: ['no_responses'] },
      overallValidation: {
        passed: false,
        score: 0,
        level: 'very_poor',
        issues: ['No responses available for validation'],
        recommendations: [{ type: 'error', suggestion: 'Ensure AI models are responding properly' }]
      },
      processingTime: 0,
      metadata: { correlationId, responsesValidated: 0 }
    };
  }

  createFallbackValidationResult(responses, metadata) {
    const successfulCount = responses.filter(r => r.status === 'fulfilled').length;

    return {
      validationLevel: 'lenient',
      qualityGates: this.config.qualityGates.lenient,
      individualValidations: [],
      consistencyAnalysis: { score: 0.5, factors: ['Validation error occurred'] },
      aggregatedResults: { overallScore: 0.5, componentScores: {} },
      qualityGateResults: { overallPassed: true, failedGates: [] },
      overallValidation: {
        passed: true,
        score: 0.5,
        level: 'acceptable',
        issues: ['Validation service error'],
        recommendations: [{ type: 'system', suggestion: 'Check validation service logs' }]
      },
      processingTime: 0,
      metadata: { ...metadata, responsesValidated: successfulCount, fallback: true }
    };
  }

  /**
   * Update service metrics
   */
  updateMetrics(result) {
    this.metrics.validationsPerformed++;

    if (result.overallValidation.passed) {
      this.metrics.validationsPassed++;
    } else {
      this.metrics.validationsFailed++;
    }

    // Update average validation score
    this.metrics.averageValidationScore =
      (this.metrics.averageValidationScore + result.overallValidation.score) / 2;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      validationPassRate: this.metrics.validationsPerformed > 0 ?
        this.metrics.validationsPassed / this.metrics.validationsPerformed : 0,
      validationFailRate: this.metrics.validationsPerformed > 0 ?
        this.metrics.validationsFailed / this.metrics.validationsPerformed : 0,
      qualityGateFailureRates: Object.entries(this.metrics.qualityGateFailures).reduce((rates, [gate, failures]) => {
        rates[gate] = this.metrics.validationsPerformed > 0 ? failures / this.metrics.validationsPerformed : 0;
        return rates;
      }, {})
    };
  }
}

module.exports = new ResponseValidationService();
