/**
 * 🎯 Dynamic Model Selection Service - Intelligent Query Routing
 *
 * 🎯 PURPOSE: Route queries to leverage each model's strengths:
 *            - GPT-4o for reasoning and complex analysis
 *            - Claude for structured, analytical responses
 *            - Gemini for creative and broad knowledge queries
 *
 * 📋 KEY FEATURES:
 * 1. Query analysis and classification
 * 2. Model strength mapping
 * 3. Dynamic prompt optimization per model
 * 4. Adaptive model selection based on context
 * 5. Performance tracking and learning
 * 6. Fallback mechanisms for reliability
 */

const monitoringService = require('./monitoringService');

class DynamicModelSelectionService {
  constructor() {
    this.config = {
      // Model strengths and capabilities
      modelStrengths: {
        'gpt4o': {
          reasoning: 0.95,
          analysis: 0.90,
          technical: 0.85,
          creative: 0.75,
          factual: 0.80,
          structured: 0.80,
          speed: 0.70
        },
        'claude': {
          reasoning: 0.85,
          analysis: 0.95,
          technical: 0.90,
          creative: 0.70,
          factual: 0.85,
          structured: 0.95,
          speed: 0.75
        },
        'gemini': {
          reasoning: 0.75,
          analysis: 0.80,
          technical: 0.75,
          creative: 0.90,
          factual: 0.90,
          structured: 0.70,
          speed: 0.85
        }
      },

      // Query type to capability mapping
      queryCapabilityMap: {
        factual: ['factual', 'speed', 'structured'],
        creative: ['creative', 'reasoning', 'analysis'],
        technical: ['technical', 'reasoning', 'structured'],
        analytical: ['analysis', 'reasoning', 'structured'],
        comparative: ['analysis', 'structured', 'reasoning'],
        explanatory: ['structured', 'reasoning', 'factual'],
        problem_solving: ['reasoning', 'analysis', 'technical']
      },

      // Prompt optimization templates by model
      promptTemplates: {
        'gpt4o': {
          reasoning: "Think through this step-by-step and provide detailed reasoning: {prompt}",
          analysis: "Analyze this comprehensively, considering multiple perspectives: {prompt}",
          technical: "Provide a technical, detailed explanation with examples: {prompt}",
          default: "{prompt}"
        },
        'claude': {
          structured: "Provide a well-structured, organized response to: {prompt}",
          analysis: "Give a systematic analysis with clear sections: {prompt}",
          technical: "Break this down systematically with clear explanations: {prompt}",
          default: "{prompt}"
        },
        'gemini': {
          creative: "Approach this creatively and explore different angles: {prompt}",
          factual: "Provide comprehensive factual information about: {prompt}",
          speed: "Give a clear, concise response to: {prompt}",
          default: "{prompt}"
        }
      },

      // Selection thresholds
      thresholds: {
        minCapabilityScore: 0.7,
        strongPreference: 0.85,
        significantDifference: 0.15
      }
    };

    this.metrics = {
      selectionsPerformed: 0,
      modelSelections: { gpt4o: 0, claude: 0, gemini: 0 },
      queryTypes: {},
      averageCapabilityMatch: 0,
      adaptiveAdjustments: 0
    };

    // Historical performance tracking
    this.performanceHistory = {
      gpt4o: { successes: 0, failures: 0, avgQuality: 0.5 },
      claude: { successes: 0, failures: 0, avgQuality: 0.5 },
      gemini: { successes: 0, failures: 0, avgQuality: 0.5 }
    };
  }

  /**
   * Main method: Select optimal models and optimize prompts
   */
  async selectOptimalModels(originalPrompt, metadata = {}) {
    try {
      const selectionStart = Date.now();
      const correlationId = metadata.correlationId || 'unknown';

      // Analyze query characteristics
      const queryAnalysis = this.analyzeQuery(originalPrompt);

      // Calculate model suitability scores
      const modelScores = this.calculateModelSuitability(queryAnalysis);

      // Select models based on scores and strategy
      const selectedModels = this.selectModels(modelScores, queryAnalysis);

      // Optimize prompts for each selected model
      const optimizedPrompts = this.optimizePromptsForModels(
        originalPrompt, selectedModels, queryAnalysis);

      // Create model configuration
      const modelConfig = this.createModelConfiguration(
        selectedModels, optimizedPrompts, queryAnalysis);

      const result = {
        originalPrompt,
        queryAnalysis,
        modelScores,
        selectedModels,
        optimizedPrompts,
        modelConfig,
        processingTime: Date.now() - selectionStart,
        selectionStrategy: this.getSelectionStrategy(queryAnalysis),
        metadata: {
          correlationId,
          timestamp: Date.now(),
          version: '2.0'
        }
      };

      // Update metrics
      this.updateMetrics(result);

      monitoringService.log('info', 'Dynamic model selection completed', {
        queryType: queryAnalysis.primaryType,
        selectedModels: selectedModels.map(m => m.model),
        topCapabilities: queryAnalysis.requiredCapabilities.slice(0, 3),
        processingTime: result.processingTime
      }, correlationId);

      return result;

    } catch (error) {
      monitoringService.log('error', 'Dynamic model selection failed', {
        error: error.message,
        prompt: originalPrompt?.substring(0, 100)
      }, metadata.correlationId);

      return this.createFallbackSelection(originalPrompt, metadata);
    }
  }

  /**
   * Analyze query to determine characteristics and requirements
   */
  analyzeQuery(prompt) {
    const promptLower = prompt.toLowerCase();
    const words = promptLower.split(/\s+/);
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Detect primary query type
    const primaryType = this.detectPrimaryQueryType(promptLower);

    // Identify required capabilities
    const requiredCapabilities = this.identifyRequiredCapabilities(promptLower, primaryType);

    // Analyze complexity
    const complexity = this.analyzeComplexity(prompt, words, sentences);

    // Detect domain/subject area
    const domain = this.detectDomain(promptLower);

    // Analyze urgency/speed requirements
    const speedRequirement = this.analyzeSpeedRequirement(promptLower);

    return {
      primaryType,
      secondaryTypes: this.detectSecondaryTypes(promptLower),
      requiredCapabilities,
      complexity,
      domain,
      speedRequirement,
      wordCount: words.length,
      sentenceCount: sentences.length,
      hasExamples: promptLower.includes('example') || promptLower.includes('for instance'),
      hasComparison: promptLower.includes('compare') || promptLower.includes('versus'),
      hasSteps: promptLower.includes('step') || promptLower.includes('how to'),
      isOpenEnded: promptLower.includes('discuss') || promptLower.includes('explore'),
      needsCreativity: promptLower.includes('creative') || promptLower.includes('brainstorm')
    };
  }

  /**
   * Detect primary query type
   */
  detectPrimaryQueryType(promptLower) {
    // Factual queries
    if (promptLower.includes('what is') || promptLower.includes('define') || 
        promptLower.includes('when did') || promptLower.includes('where is')) {
      return 'factual';
    }

    // Technical queries
    if (promptLower.includes('algorithm') || promptLower.includes('implement') || 
        promptLower.includes('code') || promptLower.includes('technical') ||
        promptLower.includes('programming')) {
      return 'technical';
    }

    // Creative queries
    if (promptLower.includes('creative') || promptLower.includes('story') || 
        promptLower.includes('imagine') || promptLower.includes('brainstorm') ||
        promptLower.includes('design')) {
      return 'creative';
    }

    // Analytical queries
    if (promptLower.includes('analyze') || promptLower.includes('evaluate') || 
        promptLower.includes('assess') || promptLower.includes('examine')) {
      return 'analytical';
    }

    // Comparative queries
    if (promptLower.includes('compare') || promptLower.includes('versus') || 
        promptLower.includes('difference') || promptLower.includes('better')) {
      return 'comparative';
    }

    // Explanatory queries
    if (promptLower.includes('explain') || promptLower.includes('how') || 
        promptLower.includes('why') || promptLower.includes('describe')) {
      return 'explanatory';
    }

    // Problem-solving queries
    if (promptLower.includes('solve') || promptLower.includes('problem') || 
        promptLower.includes('solution') || promptLower.includes('fix')) {
      return 'problem_solving';
    }

    return 'general';
  }

  /**
   * Identify required capabilities based on query
   */
  identifyRequiredCapabilities(promptLower, primaryType) {
    const capabilities = new Set();

    // Add capabilities based on primary type
    const primaryCapabilities = this.config.queryCapabilityMap[primaryType] || ['reasoning'];
    primaryCapabilities.forEach(cap => capabilities.add(cap));

    // Add capabilities based on specific indicators
    if (promptLower.includes('step') || promptLower.includes('process')) {
      capabilities.add('structured');
    }

    if (promptLower.includes('quick') || promptLower.includes('brief')) {
      capabilities.add('speed');
    }

    if (promptLower.includes('detail') || promptLower.includes('comprehensive')) {
      capabilities.add('analysis');
      capabilities.add('reasoning');
    }

    if (promptLower.includes('creative') || promptLower.includes('innovative')) {
      capabilities.add('creative');
    }

    if (promptLower.includes('technical') || promptLower.includes('algorithm')) {
      capabilities.add('technical');
    }

    if (promptLower.includes('fact') || promptLower.includes('accurate')) {
      capabilities.add('factual');
    }

    return Array.from(capabilities);
  }

  /**
   * Analyze query complexity
   */
  analyzeComplexity(prompt, words, sentences) {
    let complexity = 'medium';

    // Simple indicators
    if (words.length < 10 && sentences.length <= 1) {
      complexity = 'simple';
    }
    // Complex indicators
    else if (words.length > 50 || sentences.length > 5 || 
             prompt.includes('multiple') || prompt.includes('various') ||
             prompt.includes('comprehensive')) {
      complexity = 'complex';
    }
    // Very complex indicators
    else if (words.length > 100 || sentences.length > 10 ||
             prompt.includes('analyze') && prompt.includes('compare') ||
             prompt.includes('multi-step') || prompt.includes('interdisciplinary')) {
      complexity = 'very_complex';
    }

    return complexity;
  }

  /**
   * Detect domain/subject area
   */
  detectDomain(promptLower) {
    const domains = {
      technology: ['technology', 'software', 'programming', 'computer', 'algorithm', 'ai', 'machine learning'],
      science: ['science', 'physics', 'chemistry', 'biology', 'research', 'experiment'],
      business: ['business', 'marketing', 'finance', 'strategy', 'management', 'economics'],
      creative: ['art', 'design', 'creative', 'story', 'writing', 'music'],
      education: ['education', 'learning', 'teaching', 'academic', 'study'],
      health: ['health', 'medical', 'medicine', 'wellness', 'fitness'],
      general: []
    };

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        return domain;
      }
    }

    return 'general';
  }

  /**
   * Analyze speed requirement
   */
  analyzeSpeedRequirement(promptLower) {
    if (promptLower.includes('quick') || promptLower.includes('brief') || 
        promptLower.includes('fast') || promptLower.includes('urgent')) {
      return 'high';
    }

    if (promptLower.includes('detailed') || promptLower.includes('comprehensive') || 
        promptLower.includes('thorough')) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Detect secondary query types
   */
  detectSecondaryTypes(promptLower) {
    const types = [];
    
    if (promptLower.includes('example')) types.push('example_seeking');
    if (promptLower.includes('step')) types.push('procedural');
    if (promptLower.includes('pros') && promptLower.includes('cons')) types.push('evaluative');
    if (promptLower.includes('history') || promptLower.includes('background')) types.push('historical');
    
    return types;
  }

  /**
   * Calculate model suitability scores
   */
  calculateModelSuitability(queryAnalysis) {
    const modelScores = {};

    for (const [model, strengths] of Object.entries(this.config.modelStrengths)) {
      let score = 0;
      let totalWeight = 0;

      // Calculate weighted score based on required capabilities
      for (const capability of queryAnalysis.requiredCapabilities) {
        const capabilityStrength = strengths[capability] || 0.5;
        const weight = this.getCapabilityWeight(capability, queryAnalysis);
        
        score += capabilityStrength * weight;
        totalWeight += weight;
      }

      // Normalize score
      const normalizedScore = totalWeight > 0 ? score / totalWeight : 0.5;

      // Apply adjustments based on historical performance
      const historicalAdjustment = this.getHistoricalAdjustment(model);
      const finalScore = Math.min(1, normalizedScore * historicalAdjustment);

      modelScores[model] = {
        baseScore: normalizedScore,
        historicalAdjustment,
        finalScore,
        capabilityMatch: this.calculateCapabilityMatch(strengths, queryAnalysis.requiredCapabilities),
        recommendationStrength: this.getRecommendationStrength(finalScore)
      };
    }

    return modelScores;
  }

  /**
   * Get capability weight based on query analysis
   */
  getCapabilityWeight(capability, queryAnalysis) {
    // Primary type capabilities get higher weight
    const primaryCapabilities = this.config.queryCapabilityMap[queryAnalysis.primaryType] || [];
    if (primaryCapabilities.includes(capability)) {
      return 1.0;
    }

    // Speed gets higher weight for urgent queries
    if (capability === 'speed' && queryAnalysis.speedRequirement === 'high') {
      return 1.2;
    }

    // Creative gets higher weight for creative queries
    if (capability === 'creative' && queryAnalysis.needsCreativity) {
      return 1.1;
    }

    return 0.8; // Default weight for secondary capabilities
  }

  /**
   * Get historical performance adjustment
   */
  getHistoricalAdjustment(model) {
    const history = this.performanceHistory[model];
    if (!history || (history.successes + history.failures) < 10) {
      return 1.0; // No adjustment for insufficient data
    }

    const successRate = history.successes / (history.successes + history.failures);
    const qualityBonus = (history.avgQuality - 0.5) * 0.2; // Max ±0.1 adjustment

    return Math.max(0.8, Math.min(1.2, 0.9 + (successRate * 0.2) + qualityBonus));
  }

  /**
   * Calculate capability match percentage
   */
  calculateCapabilityMatch(modelStrengths, requiredCapabilities) {
    if (requiredCapabilities.length === 0) return 0.5;

    const matchScores = requiredCapabilities.map(cap => modelStrengths[cap] || 0.5);
    return matchScores.reduce((sum, score) => sum + score, 0) / matchScores.length;
  }

  /**
   * Get recommendation strength
   */
  getRecommendationStrength(score) {
    if (score >= this.config.thresholds.strongPreference) return 'strong';
    if (score >= this.config.thresholds.minCapabilityScore) return 'moderate';
    return 'weak';
  }

  /**
   * Select models based on suitability scores
   */
  selectModels(modelScores, queryAnalysis) {
    const sortedModels = Object.entries(modelScores)
      .sort(([,a], [,b]) => b.finalScore - a.finalScore)
      .map(([model, scores]) => ({ model, ...scores }));

    const selectedModels = [];

    // Always include the top model if it meets minimum threshold
    const topModel = sortedModels[0];
    if (topModel.finalScore >= this.config.thresholds.minCapabilityScore) {
      selectedModels.push({
        ...topModel,
        role: this.getModelRole(topModel.model),
        priority: 'primary',
        reason: `Highest capability match (${(topModel.finalScore * 100).toFixed(1)}%)`
      });
    }

    // Consider additional models for complex queries or when top model isn't strongly preferred
    if (queryAnalysis.complexity === 'complex' || queryAnalysis.complexity === 'very_complex' ||
        topModel.recommendationStrength !== 'strong') {

      for (let i = 1; i < sortedModels.length && selectedModels.length < 3; i++) {
        const model = sortedModels[i];

        // Include if it's close to the top model or brings complementary strengths
        const scoreDifference = topModel.finalScore - model.finalScore;
        if (scoreDifference <= this.config.thresholds.significantDifference ||
            this.hasComplementaryStrengths(model.model, selectedModels[0].model, queryAnalysis)) {

          selectedModels.push({
            ...model,
            role: this.getModelRole(model.model),
            priority: i === 1 ? 'secondary' : 'tertiary',
            reason: scoreDifference <= this.config.thresholds.significantDifference ?
              'Close capability match' : 'Complementary strengths'
          });
        }
      }
    }

    // Ensure we have at least one model (fallback)
    if (selectedModels.length === 0) {
      selectedModels.push({
        model: 'gpt4o',
        role: 'gpt4o',
        priority: 'fallback',
        finalScore: 0.5,
        reason: 'Fallback selection'
      });
    }

    return selectedModels;
  }

  /**
   * Get model role mapping
   */
  getModelRole(model) {
    const roleMap = {
      'gpt4o': 'gpt4o',
      'claude': 'claude',
      'gemini': 'gemini'
    };
    return roleMap[model] || model;
  }

  /**
   * Check if models have complementary strengths
   */
  hasComplementaryStrengths(model1, model2, queryAnalysis) {
    const strengths1 = this.config.modelStrengths[model1];
    const strengths2 = this.config.modelStrengths[model2];

    if (!strengths1 || !strengths2) return false;

    // Check if model1 is significantly better in any required capability
    for (const capability of queryAnalysis.requiredCapabilities) {
      const diff = (strengths1[capability] || 0.5) - (strengths2[capability] || 0.5);
      if (Math.abs(diff) >= 0.15) {
        return true;
      }
    }

    return false;
  }

  /**
   * Optimize prompts for selected models
   */
  optimizePromptsForModels(originalPrompt, selectedModels, queryAnalysis) {
    const optimizedPrompts = {};

    for (const modelInfo of selectedModels) {
      const model = modelInfo.model;
      const templates = this.config.promptTemplates[model];

      if (!templates) {
        optimizedPrompts[model] = originalPrompt;
        continue;
      }

      // Select best template based on query analysis
      let selectedTemplate = templates.default;
      let templateType = 'default';

      // Find the best matching template
      for (const capability of queryAnalysis.requiredCapabilities) {
        if (templates[capability]) {
          const modelStrength = this.config.modelStrengths[model][capability] || 0.5;
          if (modelStrength >= this.config.thresholds.minCapabilityScore) {
            selectedTemplate = templates[capability];
            templateType = capability;
            break;
          }
        }
      }

      // Apply template
      const optimizedPrompt = selectedTemplate.replace('{prompt}', originalPrompt);

      optimizedPrompts[model] = {
        prompt: optimizedPrompt,
        templateType,
        optimization: templateType !== 'default' ? `Optimized for ${templateType}` : 'No optimization',
        originalLength: originalPrompt.length,
        optimizedLength: optimizedPrompt.length
      };
    }

    return optimizedPrompts;
  }

  /**
   * Create model configuration for ensemble execution
   */
  createModelConfiguration(selectedModels, optimizedPrompts, queryAnalysis) {
    const config = {
      models: {},
      executionStrategy: this.determineExecutionStrategy(selectedModels, queryAnalysis),
      expectedResponseTime: this.estimateResponseTime(selectedModels),
      qualityExpectation: this.calculateQualityExpectation(selectedModels),
      fallbackStrategy: this.createFallbackStrategy(selectedModels)
    };

    // Configure each selected model
    for (const modelInfo of selectedModels) {
      const model = modelInfo.model;
      const promptInfo = optimizedPrompts[model];

      config.models[modelInfo.role] = {
        model: model,
        prompt: promptInfo?.prompt || originalPrompt,
        priority: modelInfo.priority,
        expectedStrength: modelInfo.finalScore,
        optimizations: {
          templateUsed: promptInfo?.templateType || 'default',
          promptOptimized: promptInfo?.optimization || 'No optimization'
        },
        timeout: this.getModelTimeout(model, queryAnalysis),
        retryConfig: this.getRetryConfig(model, modelInfo.priority)
      };
    }

    return config;
  }

  /**
   * Determine execution strategy
   */
  determineExecutionStrategy(selectedModels, queryAnalysis) {
    if (selectedModels.length === 1) {
      return 'single_model';
    }

    if (queryAnalysis.speedRequirement === 'high') {
      return 'parallel_fast';
    }

    if (queryAnalysis.complexity === 'very_complex') {
      return 'sequential_analysis';
    }

    return 'parallel_standard';
  }

  /**
   * Estimate response time based on selected models
   */
  estimateResponseTime(selectedModels) {
    const modelTimes = {
      'gpt4o': 5000,
      'claude': 4000,
      'gemini': 3000
    };

    const times = selectedModels.map(m => modelTimes[m.model] || 5000);
    return Math.max(...times); // Parallel execution, so max time
  }

  /**
   * Calculate quality expectation
   */
  calculateQualityExpectation(selectedModels) {
    const avgScore = selectedModels.reduce((sum, m) => sum + m.finalScore, 0) / selectedModels.length;
    return Math.min(1, avgScore * 1.1); // Slight boost for ensemble effect
  }

  /**
   * Create fallback strategy
   */
  createFallbackStrategy(selectedModels) {
    return {
      primaryFallback: selectedModels[0]?.model || 'gpt4o',
      secondaryFallback: selectedModels[1]?.model || 'claude',
      ultimateFallback: 'gpt4o'
    };
  }

  /**
   * Get model-specific timeout
   */
  getModelTimeout(model, queryAnalysis) {
    const baseTimes = {
      'gpt4o': 8000,
      'claude': 7000,
      'gemini': 6000
    };

    let timeout = baseTimes[model] || 8000;

    // Adjust based on complexity
    if (queryAnalysis.complexity === 'very_complex') {
      timeout *= 1.5;
    } else if (queryAnalysis.complexity === 'simple') {
      timeout *= 0.7;
    }

    // Adjust based on speed requirement
    if (queryAnalysis.speedRequirement === 'high') {
      timeout *= 0.8;
    }

    return Math.round(timeout);
  }

  /**
   * Get retry configuration
   */
  getRetryConfig(model, priority) {
    const baseRetries = priority === 'primary' ? 2 : 1;

    return {
      maxRetries: baseRetries,
      backoffMs: 1000,
      timeoutMultiplier: 1.2
    };
  }

  /**
   * Get selection strategy description
   */
  getSelectionStrategy(queryAnalysis) {
    return {
      type: queryAnalysis.primaryType,
      complexity: queryAnalysis.complexity,
      capabilities: queryAnalysis.requiredCapabilities,
      reasoning: `Selected models based on ${queryAnalysis.primaryType} query requiring ${queryAnalysis.requiredCapabilities.join(', ')} capabilities`
    };
  }

  /**
   * Create fallback selection
   */
  createFallbackSelection(originalPrompt, metadata) {
    return {
      originalPrompt,
      queryAnalysis: { primaryType: 'general', complexity: 'medium', requiredCapabilities: ['reasoning'] },
      modelScores: { gpt4o: { finalScore: 0.5 } },
      selectedModels: [{ model: 'gpt4o', role: 'gpt4o', priority: 'fallback', finalScore: 0.5 }],
      optimizedPrompts: { gpt4o: { prompt: originalPrompt, templateType: 'default' } },
      modelConfig: {
        models: {
          gpt4o: {
            model: 'gpt4o',
            prompt: originalPrompt,
            priority: 'fallback',
            timeout: 8000
          }
        },
        executionStrategy: 'fallback'
      },
      processingTime: 0,
      selectionStrategy: { type: 'fallback', reasoning: 'Fallback due to selection error' },
      metadata
    };
  }

  /**
   * Update performance history based on results
   */
  updatePerformanceHistory(model, success, qualityScore = 0.5) {
    if (!this.performanceHistory[model]) {
      this.performanceHistory[model] = { successes: 0, failures: 0, avgQuality: 0.5 };
    }

    const history = this.performanceHistory[model];

    if (success) {
      history.successes++;
    } else {
      history.failures++;
    }

    // Update average quality with exponential moving average
    history.avgQuality = (history.avgQuality * 0.9) + (qualityScore * 0.1);

    this.metrics.adaptiveAdjustments++;
  }

  /**
   * Update service metrics
   */
  updateMetrics(result) {
    this.metrics.selectionsPerformed++;

    // Track model selections
    result.selectedModels.forEach(modelInfo => {
      this.metrics.modelSelections[modelInfo.model] =
        (this.metrics.modelSelections[modelInfo.model] || 0) + 1;
    });

    // Track query types
    const queryType = result.queryAnalysis.primaryType;
    this.metrics.queryTypes[queryType] = (this.metrics.queryTypes[queryType] || 0) + 1;

    // Update average capability match
    const avgCapabilityMatch = result.selectedModels.reduce((sum, m) =>
      sum + (m.capabilityMatch || 0.5), 0) / result.selectedModels.length;

    this.metrics.averageCapabilityMatch =
      (this.metrics.averageCapabilityMatch + avgCapabilityMatch) / 2;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      modelSelectionRates: Object.entries(this.metrics.modelSelections).reduce((rates, [model, count]) => {
        rates[model] = this.metrics.selectionsPerformed > 0 ? count / this.metrics.selectionsPerformed : 0;
        return rates;
      }, {}),
      performanceHistory: this.performanceHistory
    };
  }
}

module.exports = new DynamicModelSelectionService();
