/**
 * Dynamic Context Sizing Service
 * Adapts context size based on model capabilities, user tier, and conversation complexity
 */

const ContentAnalyzer = require('./contentAnalysis');

class DynamicContextSizing {
  constructor() {
    this.contentAnalyzer = new ContentAnalyzer();
    
    // Model capabilities and context limits
    this.modelCapabilities = {
      'gpt-4o': { maxContext: 128000, optimalContext: 8000, efficiency: 0.9 },
      'gpt-4o-mini': { maxContext: 128000, optimalContext: 4000, efficiency: 0.85 },
      'claude-3-opus-20240229': { maxContext: 200000, optimalContext: 10000, efficiency: 0.95 },
      'claude-3-haiku-20240307': { maxContext: 200000, optimalContext: 6000, efficiency: 0.8 },
      'gemini-2.0-flash-exp': { maxContext: 1000000, optimalContext: 12000, efficiency: 0.9 },
      'gemini-1.5-flash': { maxContext: 1000000, optimalContext: 8000, efficiency: 0.85 }
    };

    // User tier configurations
    this.tierConfigs = {
      free: {
        maxContextTokens: 2048,
        baseAllocation: 0.6, // 60% of max for context
        complexityBonus: 0.1,
        qualityThreshold: 0.7
      },
      premium: {
        maxContextTokens: 8192,
        baseAllocation: 0.7, // 70% of max for context
        complexityBonus: 0.2,
        qualityThreshold: 0.8
      }
    };

    // Conversation complexity factors
    this.complexityFactors = {
      technical: 1.3,
      creative: 1.1,
      analytical: 1.2,
      conversational: 1.0,
      educational: 1.15
    };
  }

  /**
   * Calculate optimal context size for a request
   * @param {Object} request 
   * @returns {Object}
   */
  calculateOptimalContextSize(request) {
    try {
      const {
        userTier = 'free',
        models = ['gpt-4o-mini'],
        currentPrompt = '',
        conversationHistory = [],
        sessionComplexity = 'conversational',
        userPreferences = {},
        memoryImportance = 0.5
      } = request;

      console.log(`🎯 Calculating optimal context size for ${userTier} tier`);

      // Step 1: Get base allocation from tier
      const tierConfig = this.tierConfigs[userTier] || this.tierConfigs.free;
      let baseContextTokens = Math.floor(tierConfig.maxContextTokens * tierConfig.baseAllocation);

      // Step 2: Analyze prompt complexity
      const promptComplexity = this.analyzePromptComplexity(currentPrompt);
      
      // Step 3: Analyze conversation complexity
      const conversationComplexity = this.analyzeConversationComplexity(conversationHistory, sessionComplexity);
      
      // Step 4: Consider model capabilities
      const modelOptimization = this.optimizeForModels(models, baseContextTokens);
      
      // Step 5: Apply dynamic adjustments
      const adjustments = this.calculateDynamicAdjustments({
        promptComplexity,
        conversationComplexity,
        memoryImportance,
        userPreferences,
        tierConfig
      });

      // Step 6: Calculate final context allocation
      const finalAllocation = this.calculateFinalAllocation({
        baseContextTokens,
        modelOptimization,
        adjustments,
        tierConfig
      });

      console.log(`📊 Context sizing: ${finalAllocation.totalTokens} tokens (${Math.round(finalAllocation.efficiency * 100)}% efficiency)`);

      return finalAllocation;

    } catch (error) {
      console.error('❌ Dynamic context sizing failed:', error);
      
      // Fallback to conservative sizing
      const tierConfig = this.tierConfigs[request.userTier] || this.tierConfigs.free;
      return {
        totalTokens: Math.floor(tierConfig.maxContextTokens * 0.5),
        breakdown: { fallback: Math.floor(tierConfig.maxContextTokens * 0.5) },
        efficiency: 0.5,
        strategy: 'fallback',
        reasoning: 'Error in dynamic sizing, using conservative fallback'
      };
    }
  }

  /**
   * Analyze prompt complexity
   * @param {string} prompt 
   * @returns {Object}
   */
  analyzePromptComplexity(prompt) {
    if (!prompt) return { score: 0.3, factors: [] };

    const analysis = this.contentAnalyzer.analyzeContent(prompt, true);
    const factors = [];
    let score = 0.5; // Base score

    // Length factor
    const wordCount = prompt.split(/\s+/).length;
    if (wordCount > 50) {
      score += 0.2;
      factors.push('long_prompt');
    }

    // Technical complexity
    const technicalTerms = ['api', 'database', 'algorithm', 'architecture', 'framework', 'protocol'];
    const technicalCount = technicalTerms.filter(term => 
      prompt.toLowerCase().includes(term)
    ).length;
    
    if (technicalCount > 2) {
      score += 0.3;
      factors.push('technical_content');
    }

    // Question complexity
    const questionMarks = (prompt.match(/\?/g) || []).length;
    if (questionMarks > 1) {
      score += 0.1;
      factors.push('multiple_questions');
    }

    // Concept density
    if (analysis.concepts && analysis.concepts.length > 5) {
      score += 0.2;
      factors.push('concept_dense');
    }

    return {
      score: Math.min(score, 1.0),
      factors,
      wordCount,
      conceptCount: analysis.concepts?.length || 0,
      technicalTerms: technicalCount
    };
  }

  /**
   * Analyze conversation complexity
   * @param {Array} history 
   * @param {string} sessionComplexity 
   * @returns {Object}
   */
  analyzeConversationComplexity(history, sessionComplexity) {
    const factors = [];
    let score = 0.5; // Base score

    // Session complexity factor
    const complexityMultiplier = this.complexityFactors[sessionComplexity] || 1.0;
    score *= complexityMultiplier;
    factors.push(`session_${sessionComplexity}`);

    // History length factor
    if (history.length > 10) {
      score += 0.2;
      factors.push('long_conversation');
    }

    // Topic diversity
    const topics = new Set();
    history.forEach(item => {
      if (item.topic) topics.add(item.topic);
    });
    
    if (topics.size > 3) {
      score += 0.15;
      factors.push('diverse_topics');
    }

    // Recent complexity trend
    const recentItems = history.slice(-5);
    const avgRecentComplexity = recentItems.reduce((sum, item) => 
      sum + (item.complexity || 0.5), 0
    ) / Math.max(recentItems.length, 1);
    
    if (avgRecentComplexity > 0.7) {
      score += 0.1;
      factors.push('increasing_complexity');
    }

    return {
      score: Math.min(score, 1.0),
      factors,
      historyLength: history.length,
      topicDiversity: topics.size,
      recentComplexity: avgRecentComplexity
    };
  }

  /**
   * Optimize context size for specific models
   * @param {Array} models 
   * @param {number} baseTokens 
   * @returns {Object}
   */
  optimizeForModels(models, baseTokens) {
    const modelOptimizations = models.map(model => {
      const capabilities = this.modelCapabilities[model];
      if (!capabilities) {
        return { model, optimization: 1.0, reasoning: 'unknown_model' };
      }

      let optimization = 1.0;
      const reasoning = [];

      // Adjust based on model's optimal context size
      if (baseTokens > capabilities.optimalContext) {
        optimization = 0.9; // Reduce for efficiency
        reasoning.push('exceeds_optimal');
      } else if (baseTokens < capabilities.optimalContext * 0.5) {
        optimization = 1.1; // Can afford to increase
        reasoning.push('below_optimal');
      }

      // Consider model efficiency
      optimization *= capabilities.efficiency;

      return {
        model,
        optimization,
        reasoning: reasoning.join(','),
        capabilities
      };
    });

    // Use the most conservative optimization
    const minOptimization = Math.min(...modelOptimizations.map(m => m.optimization));
    
    return {
      optimizations: modelOptimizations,
      appliedOptimization: minOptimization,
      optimizedTokens: Math.floor(baseTokens * minOptimization)
    };
  }

  /**
   * Calculate dynamic adjustments
   * @param {Object} factors 
   * @returns {Object}
   */
  calculateDynamicAdjustments(factors) {
    const {
      promptComplexity,
      conversationComplexity,
      memoryImportance,
      userPreferences,
      tierConfig
    } = factors;

    let adjustment = 1.0;
    const reasons = [];

    // Prompt complexity adjustment
    if (promptComplexity.score > 0.7) {
      adjustment += tierConfig.complexityBonus;
      reasons.push('high_prompt_complexity');
    }

    // Conversation complexity adjustment
    if (conversationComplexity.score > 0.8) {
      adjustment += tierConfig.complexityBonus * 0.5;
      reasons.push('high_conversation_complexity');
    }

    // Memory importance adjustment
    if (memoryImportance > 0.8) {
      adjustment += 0.1;
      reasons.push('high_memory_importance');
    }

    // User preference adjustments
    if (userPreferences.detailedContext) {
      adjustment += 0.15;
      reasons.push('user_prefers_detailed');
    }

    if (userPreferences.conciseContext) {
      adjustment -= 0.1;
      reasons.push('user_prefers_concise');
    }

    return {
      multiplier: Math.min(adjustment, 2.0), // Cap at 2x
      reasons,
      promptComplexityScore: promptComplexity.score,
      conversationComplexityScore: conversationComplexity.score
    };
  }

  /**
   * Calculate final context allocation
   * @param {Object} components 
   * @returns {Object}
   */
  calculateFinalAllocation(components) {
    const {
      baseContextTokens,
      modelOptimization,
      adjustments,
      tierConfig
    } = components;

    // Apply all adjustments
    let totalTokens = Math.floor(
      baseContextTokens * 
      modelOptimization.appliedOptimization * 
      adjustments.multiplier
    );

    // Ensure within tier limits
    totalTokens = Math.min(totalTokens, tierConfig.maxContextTokens);
    totalTokens = Math.max(totalTokens, Math.floor(tierConfig.maxContextTokens * 0.2)); // Minimum 20%

    // Calculate breakdown
    const breakdown = {
      userProfile: Math.floor(totalTokens * 0.15),
      sessionSummary: Math.floor(totalTokens * 0.20),
      conversationThemes: Math.floor(totalTokens * 0.10),
      relevantMemories: Math.floor(totalTokens * 0.45),
      recentContext: Math.floor(totalTokens * 0.10)
    };

    // Calculate efficiency score
    const efficiency = Math.min(
      (totalTokens / tierConfig.maxContextTokens) * 
      modelOptimization.appliedOptimization * 
      (adjustments.multiplier > 1 ? 1 / adjustments.multiplier : adjustments.multiplier),
      1.0
    );

    return {
      totalTokens,
      breakdown,
      efficiency,
      strategy: 'dynamic_optimization',
      reasoning: [
        `Base: ${baseContextTokens} tokens`,
        `Model optimization: ${Math.round(modelOptimization.appliedOptimization * 100)}%`,
        `Dynamic adjustment: ${Math.round(adjustments.multiplier * 100)}%`,
        ...adjustments.reasons
      ].join(', '),
      metadata: {
        baseTokens: baseContextTokens,
        modelOptimization: modelOptimization.appliedOptimization,
        dynamicAdjustment: adjustments.multiplier,
        tierLimit: tierConfig.maxContextTokens
      }
    };
  }

  /**
   * Get sizing recommendations for different scenarios
   * @param {string} userTier 
   * @returns {Object}
   */
  getSizingRecommendations(userTier = 'free') {
    const tierConfig = this.tierConfigs[userTier] || this.tierConfigs.free;
    
    return {
      conservative: Math.floor(tierConfig.maxContextTokens * 0.4),
      balanced: Math.floor(tierConfig.maxContextTokens * 0.6),
      aggressive: Math.floor(tierConfig.maxContextTokens * 0.8),
      maximum: tierConfig.maxContextTokens,
      recommendations: {
        simple_queries: Math.floor(tierConfig.maxContextTokens * 0.3),
        technical_discussions: Math.floor(tierConfig.maxContextTokens * 0.7),
        complex_analysis: Math.floor(tierConfig.maxContextTokens * 0.9),
        creative_tasks: Math.floor(tierConfig.maxContextTokens * 0.5)
      }
    };
  }
}

// Singleton instance
let dynamicContextSizingInstance = null;

/**
 * Get the singleton instance of DynamicContextSizing
 * @returns {DynamicContextSizing}
 */
function getDynamicContextSizing() {
  if (!dynamicContextSizingInstance) {
    dynamicContextSizingInstance = new DynamicContextSizing();
  }
  return dynamicContextSizingInstance;
}

module.exports = { DynamicContextSizing, getDynamicContextSizing };
