/**
 * 🎯 User Intent Classification Service - Intelligent Query Analysis
 *
 * 🎯 PURPOSE: Classify user queries by type and intent to optimize AI processing:
 *            - Factual queries (definitions, facts, data)
 *            - Creative queries (brainstorming, storytelling, design)
 *            - Technical queries (programming, algorithms, systems)
 *            - Comparative queries (analysis, evaluation, comparison)
 *            - And more specialized types
 *
 * 📋 KEY FEATURES:
 * 1. Multi-dimensional intent classification
 * 2. Confidence scoring for classifications
 * 3. Processing optimization recommendations
 * 4. Context-aware analysis
 * 5. Learning from classification patterns
 * 6. Specialized domain detection
 */

const monitoringService = require('./monitoringService');

class UserIntentClassificationService {
  constructor() {
    this.config = {
      // Primary intent types with keywords and patterns
      intentTypes: {
        factual: {
          keywords: [
            'what is', 'define', 'definition', 'meaning', 'fact', 'information',
            'when did', 'where is', 'who is', 'statistics', 'data', 'number'
          ],
          patterns: [
            /^what\s+(is|are|was|were)/i,
            /^define\s+/i,
            /^tell\s+me\s+about/i,
            /\b(fact|facts|information)\s+about\b/i
          ],
          characteristics: {
            needsAccuracy: true,
            needsSpeed: true,
            needsStructure: true,
            needsCreativity: false,
            needsDepth: false
          }
        },

        creative: {
          keywords: [
            'creative', 'brainstorm', 'imagine', 'story', 'design', 'innovative',
            'artistic', 'original', 'unique', 'invent', 'dream up', 'come up with'
          ],
          patterns: [
            /^(write|create|design|imagine)\s+/i,
            /^come\s+up\s+with/i,
            /^brainstorm/i,
            /\b(creative|innovative|original)\b/i
          ],
          characteristics: {
            needsAccuracy: false,
            needsSpeed: false,
            needsStructure: false,
            needsCreativity: true,
            needsDepth: true
          }
        },

        technical: {
          keywords: [
            'algorithm', 'code', 'programming', 'implement', 'technical', 'system',
            'architecture', 'database', 'api', 'framework', 'library', 'debug'
          ],
          patterns: [
            /^(how\s+to\s+)?(code|program|implement)/i,
            /\b(algorithm|technical|programming)\b/i,
            /^debug\s+/i,
            /\b(api|database|framework)\b/i
          ],
          characteristics: {
            needsAccuracy: true,
            needsSpeed: false,
            needsStructure: true,
            needsCreativity: false,
            needsDepth: true
          }
        },

        comparative: {
          keywords: [
            'compare', 'versus', 'vs', 'difference', 'better', 'worse', 'pros and cons',
            'advantages', 'disadvantages', 'evaluate', 'assessment', 'analysis'
          ],
          patterns: [
            /^compare\s+/i,
            /\bversus\b|\bvs\b/i,
            /\b(difference|differences)\s+between\b/i,
            /\b(pros\s+and\s+cons|advantages\s+and\s+disadvantages)\b/i
          ],
          characteristics: {
            needsAccuracy: true,
            needsSpeed: false,
            needsStructure: true,
            needsCreativity: false,
            needsDepth: true
          }
        },

        explanatory: {
          keywords: [
            'explain', 'how', 'why', 'describe', 'elaborate', 'clarify',
            'breakdown', 'walk through', 'step by step', 'process'
          ],
          patterns: [
            /^(explain|describe|elaborate)/i,
            /^how\s+(does|do|can|to)/i,
            /^why\s+(is|are|does|do)/i,
            /\b(step\s+by\s+step|walk\s+through)\b/i
          ],
          characteristics: {
            needsAccuracy: true,
            needsSpeed: false,
            needsStructure: true,
            needsCreativity: false,
            needsDepth: true
          }
        },

        problem_solving: {
          keywords: [
            'solve', 'fix', 'problem', 'issue', 'troubleshoot', 'debug',
            'solution', 'resolve', 'help', 'error', 'bug', 'broken'
          ],
          patterns: [
            /^(solve|fix|resolve)\s+/i,
            /^help\s+me\s+(with|solve|fix)/i,
            /\b(problem|issue|error|bug)\b/i,
            /^troubleshoot/i
          ],
          characteristics: {
            needsAccuracy: true,
            needsSpeed: true,
            needsStructure: true,
            needsCreativity: true,
            needsDepth: true
          }
        },

        analytical: {
          keywords: [
            'analyze', 'analysis', 'examine', 'evaluate', 'assess', 'review',
            'study', 'investigate', 'research', 'insights', 'trends'
          ],
          patterns: [
            /^(analyze|examine|evaluate|assess)/i,
            /\b(analysis|insights|trends)\b/i,
            /^what\s+are\s+the\s+(implications|effects|consequences)/i
          ],
          characteristics: {
            needsAccuracy: true,
            needsSpeed: false,
            needsStructure: true,
            needsCreativity: false,
            needsDepth: true
          }
        },

        instructional: {
          keywords: [
            'how to', 'tutorial', 'guide', 'instructions', 'steps', 'teach',
            'learn', 'show me', 'walk me through', 'demonstrate'
          ],
          patterns: [
            /^how\s+to\s+/i,
            /^(teach|show)\s+me/i,
            /^(guide|tutorial|instructions)\s+/i,
            /\b(step\s+by\s+step|walk\s+through)\b/i
          ],
          characteristics: {
            needsAccuracy: true,
            needsSpeed: false,
            needsStructure: true,
            needsCreativity: false,
            needsDepth: true
          }
        }
      },

      // Domain classifications
      domains: {
        technology: ['software', 'hardware', 'computer', 'digital', 'tech', 'ai', 'ml'],
        science: ['physics', 'chemistry', 'biology', 'research', 'experiment', 'scientific'],
        business: ['marketing', 'finance', 'strategy', 'management', 'economics', 'corporate'],
        education: ['learning', 'teaching', 'academic', 'study', 'education', 'school'],
        health: ['medical', 'health', 'wellness', 'fitness', 'medicine', 'healthcare'],
        arts: ['art', 'music', 'literature', 'creative', 'design', 'aesthetic'],
        general: []
      },

      // Complexity indicators
      complexityIndicators: {
        simple: ['quick', 'brief', 'simple', 'basic', 'easy'],
        complex: ['detailed', 'comprehensive', 'thorough', 'in-depth', 'advanced', 'complex'],
        multi_part: ['and', 'also', 'additionally', 'furthermore', 'multiple', 'various']
      },

      // Urgency indicators
      urgencyIndicators: {
        high: ['urgent', 'quickly', 'asap', 'immediately', 'fast', 'rush'],
        low: ['when you have time', 'eventually', 'no rush', 'detailed', 'comprehensive']
      },

      // Classification thresholds
      thresholds: {
        highConfidence: 0.8,
        mediumConfidence: 0.6,
        lowConfidence: 0.4,
        minimumScore: 0.2
      }
    };

    this.metrics = {
      classificationsPerformed: 0,
      intentDistribution: {},
      domainDistribution: {},
      averageConfidence: 0,
      multiIntentQueries: 0
    };

    // Learning data for pattern improvement
    this.learningData = {
      successfulClassifications: {},
      misclassifications: {},
      patternStrengths: {}
    };
  }

  /**
   * Main classification method
   */
  async classifyUserIntent(prompt, context = {}) {
    try {
      const classificationStart = Date.now();
      const correlationId = context.correlationId || 'unknown';

      // Preprocess the prompt
      const processedPrompt = this.preprocessPrompt(prompt);

      // Perform multi-dimensional classification
      const intentClassification = this.classifyIntent(processedPrompt);
      const domainClassification = this.classifyDomain(processedPrompt);
      const complexityAnalysis = this.analyzeComplexity(processedPrompt);
      const urgencyAnalysis = this.analyzeUrgency(processedPrompt);
      const contextualFactors = this.analyzeContextualFactors(processedPrompt, context);

      // Determine primary and secondary intents
      const primaryIntent = this.determinePrimaryIntent(intentClassification);
      const secondaryIntents = this.determineSecondaryIntents(intentClassification, primaryIntent);

      // Generate processing recommendations
      const processingRecommendations = this.generateProcessingRecommendations({
        primaryIntent,
        secondaryIntents,
        domain: domainClassification,
        complexity: complexityAnalysis,
        urgency: urgencyAnalysis,
        contextualFactors
      });

      const result = {
        originalPrompt: prompt,
        processedPrompt,
        classification: {
          primaryIntent,
          secondaryIntents,
          confidence: primaryIntent.confidence,
          allIntentScores: intentClassification
        },
        domain: domainClassification,
        complexity: complexityAnalysis,
        urgency: urgencyAnalysis,
        contextualFactors,
        processingRecommendations,
        metadata: {
          processingTime: Date.now() - classificationStart,
          correlationId,
          timestamp: Date.now(),
          version: '2.0'
        }
      };

      // Update metrics and learning data
      this.updateMetrics(result);
      this.updateLearningData(result);

      monitoringService.log('info', 'User intent classification completed', {
        primaryIntent: primaryIntent.type,
        confidence: primaryIntent.confidence.toFixed(3),
        domain: domainClassification.primary,
        complexity: complexityAnalysis.level,
        processingTime: result.metadata.processingTime
      }, correlationId);

      return result;

    } catch (error) {
      monitoringService.log('error', 'User intent classification failed', {
        error: error.message,
        prompt: prompt?.substring(0, 100)
      }, context.correlationId);

      return this.createFallbackClassification(prompt, context);
    }
  }

  /**
   * Preprocess prompt for better analysis
   */
  preprocessPrompt(prompt) {
    // Clean and normalize the prompt
    let processed = prompt.toLowerCase().trim();
    
    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ');
    
    // Normalize common variations
    processed = processed.replace(/\bvs\b/g, 'versus');
    processed = processed.replace(/\bu\b/g, 'you');
    processed = processed.replace(/\br\b/g, 'are');
    
    return {
      original: prompt,
      normalized: processed,
      words: processed.split(/\s+/),
      sentences: prompt.split(/[.!?]+/).filter(s => s.trim().length > 0),
      length: prompt.length,
      wordCount: processed.split(/\s+/).length
    };
  }

  /**
   * Classify intent using multiple approaches
   */
  classifyIntent(processedPrompt) {
    const scores = {};
    const normalized = processedPrompt.normalized;
    const words = processedPrompt.words;

    // Score each intent type
    Object.entries(this.config.intentTypes).forEach(([intentType, config]) => {
      let score = 0;
      const matches = [];

      // Keyword matching
      const keywordMatches = config.keywords.filter(keyword => 
        normalized.includes(keyword.toLowerCase()));
      
      if (keywordMatches.length > 0) {
        score += (keywordMatches.length / config.keywords.length) * 0.6;
        matches.push(...keywordMatches);
      }

      // Pattern matching
      const patternMatches = config.patterns.filter(pattern => 
        pattern.test(processedPrompt.original));
      
      if (patternMatches.length > 0) {
        score += (patternMatches.length / config.patterns.length) * 0.4;
        matches.push(`${patternMatches.length} pattern matches`);
      }

      // Contextual scoring adjustments
      score = this.adjustScoreForContext(score, intentType, processedPrompt);

      scores[intentType] = {
        score: Math.max(0, Math.min(1, score)),
        confidence: this.calculateConfidence(score, matches.length),
        matches,
        characteristics: config.characteristics
      };
    });

    return scores;
  }

  /**
   * Classify domain/subject area
   */
  classifyDomain(processedPrompt) {
    const scores = {};
    const normalized = processedPrompt.normalized;

    Object.entries(this.config.domains).forEach(([domain, keywords]) => {
      if (keywords.length === 0) {
        scores[domain] = 0.1; // Default score for general
        return;
      }

      const matches = keywords.filter(keyword => 
        normalized.includes(keyword.toLowerCase()));
      
      scores[domain] = matches.length / keywords.length;
    });

    // Find primary domain
    const sortedDomains = Object.entries(scores)
      .sort(([,a], [,b]) => b - a);

    const primaryDomain = sortedDomains[0];
    const secondaryDomains = sortedDomains.slice(1, 3)
      .filter(([,score]) => score > 0.1);

    return {
      primary: primaryDomain[0],
      primaryScore: primaryDomain[1],
      secondary: secondaryDomains.map(([domain, score]) => ({ domain, score })),
      allScores: scores,
      confidence: primaryDomain[1] > 0.3 ? 'high' : primaryDomain[1] > 0.1 ? 'medium' : 'low'
    };
  }

  /**
   * Analyze query complexity
   */
  analyzeComplexity(processedPrompt) {
    const indicators = this.config.complexityIndicators;
    const normalized = processedPrompt.normalized;
    const wordCount = processedPrompt.wordCount;
    const sentenceCount = processedPrompt.sentences.length;

    let complexityScore = 0.5; // Base complexity

    // Word count factor
    if (wordCount > 50) complexityScore += 0.3;
    else if (wordCount > 20) complexityScore += 0.1;
    else if (wordCount < 5) complexityScore -= 0.2;

    // Sentence count factor
    if (sentenceCount > 3) complexityScore += 0.2;
    else if (sentenceCount > 1) complexityScore += 0.1;

    // Keyword indicators
    const simpleMatches = indicators.simple.filter(word => normalized.includes(word));
    const complexMatches = indicators.complex.filter(word => normalized.includes(word));
    const multiPartMatches = indicators.multi_part.filter(word => normalized.includes(word));

    if (simpleMatches.length > 0) complexityScore -= 0.2;
    if (complexMatches.length > 0) complexityScore += 0.3;
    if (multiPartMatches.length > 1) complexityScore += 0.2;

    // Determine complexity level
    let level;
    if (complexityScore >= 0.8) level = 'very_complex';
    else if (complexityScore >= 0.6) level = 'complex';
    else if (complexityScore >= 0.4) level = 'medium';
    else if (complexityScore >= 0.2) level = 'simple';
    else level = 'very_simple';

    return {
      score: Math.max(0, Math.min(1, complexityScore)),
      level,
      factors: {
        wordCount,
        sentenceCount,
        simpleIndicators: simpleMatches.length,
        complexIndicators: complexMatches.length,
        multiPartIndicators: multiPartMatches.length
      },
      processingImplications: this.getComplexityImplications(level)
    };
  }

  /**
   * Analyze urgency indicators
   */
  analyzeUrgency(processedPrompt) {
    const indicators = this.config.urgencyIndicators;
    const normalized = processedPrompt.normalized;

    const highUrgencyMatches = indicators.high.filter(word => normalized.includes(word));
    const lowUrgencyMatches = indicators.low.filter(word => normalized.includes(word));

    let urgencyScore = 0.5; // Default medium urgency

    if (highUrgencyMatches.length > 0) {
      urgencyScore += 0.4;
    }
    if (lowUrgencyMatches.length > 0) {
      urgencyScore -= 0.3;
    }

    // Determine urgency level
    let level;
    if (urgencyScore >= 0.7) level = 'high';
    else if (urgencyScore >= 0.3) level = 'medium';
    else level = 'low';

    return {
      score: Math.max(0, Math.min(1, urgencyScore)),
      level,
      indicators: {
        high: highUrgencyMatches,
        low: lowUrgencyMatches
      },
      processingImplications: this.getUrgencyImplications(level)
    };
  }

  /**
   * Analyze contextual factors
   */
  analyzeContextualFactors(processedPrompt, context) {
    const factors = {
      hasExamples: processedPrompt.normalized.includes('example') || 
                   processedPrompt.normalized.includes('for instance'),
      hasComparison: processedPrompt.normalized.includes('compare') || 
                     processedPrompt.normalized.includes('versus'),
      hasSteps: processedPrompt.normalized.includes('step') || 
                processedPrompt.normalized.includes('process'),
      isOpenEnded: processedPrompt.normalized.includes('discuss') || 
                   processedPrompt.normalized.includes('explore'),
      needsCreativity: processedPrompt.normalized.includes('creative') || 
                       processedPrompt.normalized.includes('brainstorm'),
      isPersonal: processedPrompt.normalized.includes('my') || 
                  processedPrompt.normalized.includes('i '),
      hasConstraints: processedPrompt.normalized.includes('within') || 
                      processedPrompt.normalized.includes('limit'),
      sessionContext: context.sessionId ? 'continuing_conversation' : 'new_conversation',
      userContext: context.userId ? 'known_user' : 'anonymous'
    };

    return {
      factors,
      implications: this.getContextualImplications(factors),
      processingAdjustments: this.getContextualAdjustments(factors)
    };
  }

  /**
   * Determine primary intent from classification scores
   */
  determinePrimaryIntent(intentClassification) {
    const sortedIntents = Object.entries(intentClassification)
      .sort(([,a], [,b]) => b.score - a.score);

    const topIntent = sortedIntents[0];

    return {
      type: topIntent[0],
      score: topIntent[1].score,
      confidence: topIntent[1].confidence,
      matches: topIntent[1].matches,
      characteristics: topIntent[1].characteristics,
      strength: this.getIntentStrength(topIntent[1].score)
    };
  }

  /**
   * Determine secondary intents
   */
  determineSecondaryIntents(intentClassification, primaryIntent) {
    const secondaryIntents = Object.entries(intentClassification)
      .filter(([type, data]) =>
        type !== primaryIntent.type &&
        data.score >= this.config.thresholds.minimumScore)
      .sort(([,a], [,b]) => b.score - a.score)
      .slice(0, 2) // Top 2 secondary intents
      .map(([type, data]) => ({
        type,
        score: data.score,
        confidence: data.confidence,
        strength: this.getIntentStrength(data.score)
      }));

    return secondaryIntents;
  }

  /**
   * Generate processing recommendations
   */
  generateProcessingRecommendations(analysis) {
    const recommendations = {
      modelSelection: this.getModelSelectionRecommendations(analysis),
      promptOptimization: this.getPromptOptimizationRecommendations(analysis),
      responseStrategy: this.getResponseStrategyRecommendations(analysis),
      qualityFocus: this.getQualityFocusRecommendations(analysis),
      timeoutAdjustments: this.getTimeoutRecommendations(analysis),
      synthesisStrategy: this.getSynthesisStrategyRecommendations(analysis)
    };

    return recommendations;
  }

  /**
   * Get model selection recommendations
   */
  getModelSelectionRecommendations(analysis) {
    const { primaryIntent, domain, complexity, urgency } = analysis;
    const recommendations = [];

    // Intent-based model preferences
    switch (primaryIntent.type) {
      case 'technical':
        recommendations.push({
          model: 'gpt4o',
          reason: 'Best for technical reasoning and analysis',
          priority: 'high'
        });
        recommendations.push({
          model: 'claude',
          reason: 'Excellent for structured technical explanations',
          priority: 'medium'
        });
        break;

      case 'creative':
        recommendations.push({
          model: 'gemini',
          reason: 'Strong creative capabilities',
          priority: 'high'
        });
        recommendations.push({
          model: 'gpt4o',
          reason: 'Good creative reasoning',
          priority: 'medium'
        });
        break;

      case 'analytical':
      case 'comparative':
        recommendations.push({
          model: 'claude',
          reason: 'Excellent analytical and structured thinking',
          priority: 'high'
        });
        recommendations.push({
          model: 'gpt4o',
          reason: 'Strong analytical reasoning',
          priority: 'medium'
        });
        break;

      case 'factual':
        if (urgency.level === 'high') {
          recommendations.push({
            model: 'gemini',
            reason: 'Fast factual responses',
            priority: 'high'
          });
        } else {
          recommendations.push({
            model: 'gpt4o',
            reason: 'Accurate factual information',
            priority: 'high'
          });
        }
        break;

      default:
        recommendations.push({
          model: 'gpt4o',
          reason: 'Versatile for general queries',
          priority: 'high'
        });
    }

    return recommendations;
  }

  /**
   * Get prompt optimization recommendations
   */
  getPromptOptimizationRecommendations(analysis) {
    const { primaryIntent, complexity, contextualFactors } = analysis;
    const optimizations = [];

    // Intent-specific optimizations
    if (primaryIntent.type === 'explanatory') {
      optimizations.push({
        type: 'structure_request',
        suggestion: 'Add "Please provide a clear, step-by-step explanation" to prompt',
        reason: 'Improves explanatory response structure'
      });
    }

    if (primaryIntent.type === 'comparative') {
      optimizations.push({
        type: 'comparison_framework',
        suggestion: 'Request specific comparison criteria and structured analysis',
        reason: 'Ensures comprehensive comparative analysis'
      });
    }

    if (complexity.level === 'very_complex') {
      optimizations.push({
        type: 'complexity_handling',
        suggestion: 'Break down into sub-questions or request structured approach',
        reason: 'Helps manage complex multi-part queries'
      });
    }

    if (contextualFactors.factors.hasExamples) {
      optimizations.push({
        type: 'example_emphasis',
        suggestion: 'Explicitly request concrete examples and use cases',
        reason: 'User specifically wants examples'
      });
    }

    return optimizations;
  }

  /**
   * Get response strategy recommendations
   */
  getResponseStrategyRecommendations(analysis) {
    const { primaryIntent, complexity, urgency } = analysis;
    const strategies = [];

    // Strategy based on intent and complexity
    if (primaryIntent.type === 'instructional' || primaryIntent.type === 'explanatory') {
      strategies.push({
        strategy: 'structured_explanation',
        description: 'Use clear headings, numbered steps, and logical progression',
        priority: 'high'
      });
    }

    if (primaryIntent.type === 'creative') {
      strategies.push({
        strategy: 'creative_exploration',
        description: 'Encourage multiple perspectives and innovative approaches',
        priority: 'high'
      });
    }

    if (complexity.level === 'very_complex') {
      strategies.push({
        strategy: 'layered_approach',
        description: 'Start with overview, then dive into details',
        priority: 'medium'
      });
    }

    if (urgency.level === 'high') {
      strategies.push({
        strategy: 'concise_direct',
        description: 'Prioritize direct answers and key points',
        priority: 'high'
      });
    }

    return strategies;
  }

  /**
   * Get quality focus recommendations
   */
  getQualityFocusRecommendations(analysis) {
    const { primaryIntent, domain } = analysis;
    const focuses = [];

    switch (primaryIntent.type) {
      case 'factual':
        focuses.push('accuracy', 'completeness', 'source_reliability');
        break;
      case 'technical':
        focuses.push('technical_accuracy', 'implementation_details', 'best_practices');
        break;
      case 'creative':
        focuses.push('originality', 'diversity', 'engagement');
        break;
      case 'analytical':
        focuses.push('logical_reasoning', 'evidence_support', 'balanced_perspective');
        break;
      case 'comparative':
        focuses.push('balanced_analysis', 'clear_criteria', 'objective_evaluation');
        break;
      default:
        focuses.push('clarity', 'relevance', 'completeness');
    }

    return focuses.map(focus => ({
      focus,
      importance: 'high',
      description: this.getQualityFocusDescription(focus)
    }));
  }

  /**
   * Get timeout recommendations
   */
  getTimeoutRecommendations(analysis) {
    const { complexity, urgency, primaryIntent } = analysis;

    let baseTimeout = 8000; // Default 8 seconds

    // Adjust for complexity
    if (complexity.level === 'very_complex') baseTimeout *= 1.5;
    else if (complexity.level === 'complex') baseTimeout *= 1.2;
    else if (complexity.level === 'simple') baseTimeout *= 0.8;

    // Adjust for urgency
    if (urgency.level === 'high') baseTimeout *= 0.8;
    else if (urgency.level === 'low') baseTimeout *= 1.3;

    // Adjust for intent type
    if (primaryIntent.type === 'creative') baseTimeout *= 1.2;
    else if (primaryIntent.type === 'factual' && urgency.level === 'high') baseTimeout *= 0.7;

    return {
      recommended: Math.round(baseTimeout),
      reasoning: `Adjusted for ${complexity.level} complexity, ${urgency.level} urgency, and ${primaryIntent.type} intent`,
      factors: {
        complexity: complexity.level,
        urgency: urgency.level,
        intent: primaryIntent.type
      }
    };
  }

  /**
   * Get synthesis strategy recommendations
   */
  getSynthesisStrategyRecommendations(analysis) {
    const { primaryIntent, complexity, contextualFactors } = analysis;

    let strategy = 'balanced_synthesis'; // Default

    if (primaryIntent.type === 'comparative') {
      strategy = 'comparative_synthesis';
    } else if (primaryIntent.type === 'creative') {
      strategy = 'creative_synthesis';
    } else if (primaryIntent.type === 'technical') {
      strategy = 'technical_synthesis';
    } else if (complexity.level === 'very_complex') {
      strategy = 'structured_synthesis';
    }

    return {
      strategy,
      description: this.getSynthesisStrategyDescription(strategy),
      parameters: this.getSynthesisParameters(strategy, analysis)
    };
  }

  /**
   * Helper methods
   */
  adjustScoreForContext(score, intentType, processedPrompt) {
    // Boost score for strong contextual indicators
    const normalized = processedPrompt.normalized;

    if (intentType === 'creative' && normalized.includes('innovative')) {
      score += 0.1;
    }

    if (intentType === 'technical' && normalized.includes('implementation')) {
      score += 0.1;
    }

    if (intentType === 'factual' && normalized.includes('accurate')) {
      score += 0.1;
    }

    return score;
  }

  calculateConfidence(score, matchCount) {
    let confidence = score;

    // Boost confidence for multiple matches
    if (matchCount > 2) confidence += 0.1;
    else if (matchCount > 1) confidence += 0.05;

    return Math.max(0, Math.min(1, confidence));
  }

  getIntentStrength(score) {
    if (score >= this.config.thresholds.highConfidence) return 'strong';
    if (score >= this.config.thresholds.mediumConfidence) return 'moderate';
    if (score >= this.config.thresholds.lowConfidence) return 'weak';
    return 'very_weak';
  }

  getComplexityImplications(level) {
    const implications = {
      very_simple: ['Fast processing', 'Simple models sufficient', 'Brief responses expected'],
      simple: ['Standard processing', 'Basic analysis needed', 'Concise responses'],
      medium: ['Moderate processing time', 'Balanced analysis', 'Comprehensive responses'],
      complex: ['Extended processing time', 'Deep analysis required', 'Detailed responses'],
      very_complex: ['Maximum processing time', 'Multi-faceted analysis', 'Comprehensive detailed responses']
    };

    return implications[level] || implications.medium;
  }

  getUrgencyImplications(level) {
    const implications = {
      high: ['Prioritize speed', 'Reduce processing time', 'Focus on key points'],
      medium: ['Standard processing', 'Balanced approach', 'Normal detail level'],
      low: ['Allow extended processing', 'Maximize quality', 'Comprehensive detail']
    };

    return implications[level] || implications.medium;
  }

  getContextualImplications(factors) {
    const implications = [];

    if (factors.hasExamples) implications.push('Include concrete examples');
    if (factors.hasComparison) implications.push('Structure as comparison');
    if (factors.hasSteps) implications.push('Provide step-by-step guidance');
    if (factors.isOpenEnded) implications.push('Encourage exploration');
    if (factors.needsCreativity) implications.push('Emphasize creative approaches');
    if (factors.isPersonal) implications.push('Personalize response');
    if (factors.hasConstraints) implications.push('Respect specified constraints');

    return implications;
  }

  getContextualAdjustments(factors) {
    const adjustments = {};

    if (factors.hasExamples) adjustments.includeExamples = true;
    if (factors.hasSteps) adjustments.structureAsSteps = true;
    if (factors.needsCreativity) adjustments.enhanceCreativity = true;
    if (factors.isPersonal) adjustments.personalizeResponse = true;

    return adjustments;
  }

  getQualityFocusDescription(focus) {
    const descriptions = {
      accuracy: 'Ensure factual correctness and reliability',
      completeness: 'Cover all relevant aspects thoroughly',
      technical_accuracy: 'Verify technical details and implementation correctness',
      originality: 'Provide unique and innovative perspectives',
      logical_reasoning: 'Ensure sound logical flow and argumentation',
      balanced_analysis: 'Present multiple viewpoints objectively',
      clarity: 'Maintain clear and understandable explanations'
    };

    return descriptions[focus] || 'Focus on overall quality';
  }

  getSynthesisStrategyDescription(strategy) {
    const descriptions = {
      balanced_synthesis: 'Combine best elements from all responses',
      comparative_synthesis: 'Structure synthesis around comparison framework',
      creative_synthesis: 'Merge creative elements and innovative ideas',
      technical_synthesis: 'Focus on technical accuracy and implementation details',
      structured_synthesis: 'Organize complex information hierarchically'
    };

    return descriptions[strategy] || descriptions.balanced_synthesis;
  }

  getSynthesisParameters(strategy, analysis) {
    const baseParams = {
      maxSections: 6,
      prioritizeQuality: true,
      includeSourceAttribution: false
    };

    switch (strategy) {
      case 'comparative_synthesis':
        return { ...baseParams, maxSections: 8, structureAsComparison: true };
      case 'creative_synthesis':
        return { ...baseParams, maxSections: 7, emphasizeCreativity: true };
      case 'technical_synthesis':
        return { ...baseParams, maxSections: 5, prioritizeTechnicalAccuracy: true };
      case 'structured_synthesis':
        return { ...baseParams, maxSections: 10, useHierarchicalStructure: true };
      default:
        return baseParams;
    }
  }

  /**
   * Create fallback classification
   */
  createFallbackClassification(prompt, context) {
    return {
      originalPrompt: prompt,
      processedPrompt: { original: prompt, normalized: prompt.toLowerCase() },
      classification: {
        primaryIntent: {
          type: 'general',
          score: 0.5,
          confidence: 0.5,
          strength: 'moderate'
        },
        secondaryIntents: [],
        confidence: 0.5
      },
      domain: { primary: 'general', primaryScore: 0.5, confidence: 'low' },
      complexity: { level: 'medium', score: 0.5 },
      urgency: { level: 'medium', score: 0.5 },
      contextualFactors: { factors: {}, implications: [], processingAdjustments: {} },
      processingRecommendations: {
        modelSelection: [{ model: 'gpt4o', reason: 'Fallback selection', priority: 'high' }],
        responseStrategy: [{ strategy: 'general_response', priority: 'medium' }]
      },
      metadata: {
        processingTime: 0,
        correlationId: context.correlationId,
        fallback: true
      }
    };
  }

  /**
   * Update metrics and learning data
   */
  updateMetrics(result) {
    this.metrics.classificationsPerformed++;

    // Update intent distribution
    const primaryIntent = result.classification.primaryIntent.type;
    this.metrics.intentDistribution[primaryIntent] =
      (this.metrics.intentDistribution[primaryIntent] || 0) + 1;

    // Update domain distribution
    const primaryDomain = result.domain.primary;
    this.metrics.domainDistribution[primaryDomain] =
      (this.metrics.domainDistribution[primaryDomain] || 0) + 1;

    // Update average confidence
    this.metrics.averageConfidence =
      (this.metrics.averageConfidence + result.classification.confidence) / 2;

    // Track multi-intent queries
    if (result.classification.secondaryIntents.length > 0) {
      this.metrics.multiIntentQueries++;
    }
  }

  updateLearningData(result) {
    const primaryIntent = result.classification.primaryIntent.type;

    // Track successful classifications (high confidence)
    if (result.classification.confidence >= this.config.thresholds.highConfidence) {
      this.learningData.successfulClassifications[primaryIntent] =
        (this.learningData.successfulClassifications[primaryIntent] || 0) + 1;
    }

    // Update pattern strengths
    const matches = result.classification.primaryIntent.matches || [];
    matches.forEach(match => {
      this.learningData.patternStrengths[match] =
        (this.learningData.patternStrengths[match] || 0) + 1;
    });
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      multiIntentRate: this.metrics.classificationsPerformed > 0 ?
        this.metrics.multiIntentQueries / this.metrics.classificationsPerformed : 0,
      intentDistributionPercentages: Object.entries(this.metrics.intentDistribution).reduce((percentages, [intent, count]) => {
        percentages[intent] = this.metrics.classificationsPerformed > 0 ?
          (count / this.metrics.classificationsPerformed * 100).toFixed(1) + '%' : '0%';
        return percentages;
      }, {}),
      learningData: this.learningData
    };
  }
}

module.exports = new UserIntentClassificationService();
