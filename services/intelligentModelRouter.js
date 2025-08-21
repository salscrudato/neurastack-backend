/**
 * 🧠 Intelligent Model Router - Advanced AI Model Selection & Routing
 *
 * 🎯 PURPOSE: Dynamically select optimal AI models based on performance metrics,
 *            cost efficiency, request characteristics, and historical data
 *
 * 📋 KEY FEATURES:
 * 1. Performance-based model selection with real-time metrics
 * 2. Cost optimization with budget-aware routing
 * 3. Request type classification for specialized model routing
 * 4. Historical performance tracking and adaptive weighting
 * 5. Intelligent fallback strategies with circuit breaker patterns
 * 6. Load balancing across providers to prevent rate limiting
 * 7. Quality-based model ranking with continuous learning
 *
 * 💡 INNOVATION: Uses machine learning principles to continuously improve
 *    model selection based on actual performance data and user feedback
 */

const monitoringService = require('./monitoringService');
const cacheService = require('./cacheService');
const logger = require('../utils/visualLogger');
const dynamicConfig = require('../config/dynamicConfig');

class IntelligentModelRouter {
  constructor() {
    // Model performance tracking
    this.modelMetrics = new Map();
    this.requestHistory = [];
    this.performanceWindow = 1000; // Track last 1000 requests
    
    // Model configurations with enhanced metadata
    this.modelConfigs = {
      'gpt-4o-mini': {
        provider: 'openai',
        cost: 0.00015, // per 1K tokens (input)
        speed: 'fast',
        quality: 'high',
        specialties: ['general', 'reasoning', 'code', 'analysis'],
        maxTokens: 16384,
        reliability: 0.95,
        currentLoad: 0
      },
      'gpt-4.1-nano': {
        provider: 'openai', 
        cost: 0.00005, // Ultra low cost
        speed: 'very-fast',
        quality: 'medium-high',
        specialties: ['general', 'quick-responses'],
        maxTokens: 8192,
        reliability: 0.92,
        currentLoad: 0
      },
      'gemini-1.5-flash-8b': {
        provider: 'gemini',
        cost: 0.000075, // Very low cost
        speed: 'very-fast',
        quality: 'medium-high',
        specialties: ['general', 'creative', 'multilingual'],
        maxTokens: 8192,
        reliability: 0.88,
        currentLoad: 0
      },
      'claude-3-5-haiku': {
        provider: 'claude',
        cost: 0.00025, // per 1K tokens
        speed: 'fast',
        quality: 'high',
        specialties: ['analysis', 'reasoning', 'safety', 'nuanced'],
        maxTokens: 8192,
        reliability: 0.93,
        currentLoad: 0
      },
      'grok-2-1212': {
        provider: 'xai',
        cost: 0.0002, // per 1K tokens
        speed: 'medium',
        quality: 'high',
        specialties: ['creative', 'humor', 'unconventional'],
        maxTokens: 8192,
        reliability: 0.85,
        currentLoad: 0
      }
    };

    // Request type classifiers
    this.requestClassifiers = {
      creative: /\b(story|creative|poem|joke|humor|funny|imagine|invent)\b/i,
      analytical: /\b(analyze|analysis|compare|evaluate|assess|examine|study)\b/i,
      technical: /\b(code|programming|technical|algorithm|debug|function|api)\b/i,
      explanatory: /\b(explain|how|why|what|describe|definition|meaning)\b/i,
      conversational: /\b(chat|talk|discuss|opinion|think|feel|believe)\b/i,
      factual: /\b(fact|data|statistics|research|study|evidence|proof)\b/i
    };

    // Initialize metrics for all models
    this.initializeModelMetrics();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();

    logger.success(
      'Intelligent Model Router: Initialized',
      {
        'Models Available': Object.keys(this.modelConfigs).length,
        'Performance Tracking': 'Active',
        'Request Classification': 'Enabled',
        'Adaptive Learning': 'Active'
      },
      'router'
    );
  }

  /**
   * Initialize performance metrics for all models
   */
  initializeModelMetrics() {
    Object.keys(this.modelConfigs).forEach(model => {
      this.modelMetrics.set(model, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        averageQualityScore: 0,
        costEfficiency: 0,
        recentPerformance: [],
        lastUsed: null,
        circuitBreakerState: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        circuitBreakerFailures: 0,
        circuitBreakerLastFailure: null
      });
    });
  }

  /**
   * Intelligently select optimal models for ensemble based on request characteristics
   * @param {string} prompt - User prompt to analyze
   * @param {Object} context - Request context (user tier, session info, etc.)
   * @param {number} modelCount - Number of models to select (default: 3)
   * @returns {Array} Array of selected model configurations
   */
  async selectOptimalModels(prompt, context = {}, modelCount = 3) {
    const startTime = Date.now();
    
    try {
      // Step 1: Classify request type
      const requestType = this.classifyRequest(prompt);
      
      // Step 2: Get available models (excluding circuit breaker OPEN models)
      const availableModels = this.getAvailableModels();
      
      // Step 3: Score models based on multiple factors
      const modelScores = await this.scoreModels(availableModels, requestType, prompt, context);
      
      // Step 4: Select top models with diversity consideration
      const selectedModels = this.selectDiverseModels(modelScores, modelCount);
      
      // Step 5: Update load balancing
      this.updateModelLoads(selectedModels);
      
      // Log selection decision
      monitoringService.log('info', 'Model selection completed', {
        requestType,
        selectedModels: selectedModels.map(m => m.model),
        selectionTime: Date.now() - startTime,
        totalAvailable: availableModels.length
      });

      return selectedModels;
      
    } catch (error) {
      logger.error('Model selection failed, using fallback', { error: error.message }, 'router');
      return this.getFallbackModels(modelCount);
    }
  }

  /**
   * Classify request type based on prompt content
   * @param {string} prompt - User prompt
   * @returns {string} Request type classification
   */
  classifyRequest(prompt) {
    const promptLower = prompt.toLowerCase();
    
    // Check each classifier
    for (const [type, regex] of Object.entries(this.requestClassifiers)) {
      if (regex.test(promptLower)) {
        return type;
      }
    }
    
    // Default to general if no specific type detected
    return 'general';
  }

  /**
   * Get available models (excluding those with open circuit breakers)
   * @returns {Array} Available model names
   */
  getAvailableModels() {
    return Object.keys(this.modelConfigs).filter(model => {
      const metrics = this.modelMetrics.get(model);
      return metrics.circuitBreakerState !== 'OPEN';
    });
  }

  /**
   * Score models based on multiple factors
   * @param {Array} availableModels - Available model names
   * @param {string} requestType - Classified request type
   * @param {string} prompt - Original prompt
   * @param {Object} context - Request context
   * @returns {Array} Scored models with selection scores
   */
  async scoreModels(availableModels, requestType, prompt, context) {
    const scores = [];
    
    for (const model of availableModels) {
      const config = this.modelConfigs[model];
      const metrics = this.modelMetrics.get(model);
      
      // Calculate composite score
      const score = this.calculateModelScore(model, config, metrics, requestType, context);
      
      scores.push({
        model,
        config,
        metrics,
        score,
        reasoning: this.getScoreReasoning(model, score, requestType)
      });
    }
    
    // Sort by score (highest first)
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate comprehensive model score
   * @param {string} model - Model name
   * @param {Object} config - Model configuration
   * @param {Object} metrics - Model performance metrics
   * @param {string} requestType - Request type
   * @param {Object} context - Request context
   * @returns {number} Composite score (0-1)
   */
  calculateModelScore(model, config, metrics, requestType, context) {
    // Base scores (0-1)
    const performanceScore = this.calculatePerformanceScore(metrics);
    const costScore = this.calculateCostScore(config, context);
    const specialtyScore = this.calculateSpecialtyScore(config, requestType);
    const reliabilityScore = config.reliability;
    const loadScore = this.calculateLoadScore(config);
    
    // Weighted combination
    const weights = {
      performance: 0.25,
      cost: 0.20,
      specialty: 0.25,
      reliability: 0.20,
      load: 0.10
    };
    
    const compositeScore = 
      (performanceScore * weights.performance) +
      (costScore * weights.cost) +
      (specialtyScore * weights.specialty) +
      (reliabilityScore * weights.reliability) +
      (loadScore * weights.load);
    
    return Math.max(0, Math.min(1, compositeScore));
  }

  /**
   * Calculate performance score based on historical metrics
   * @param {Object} metrics - Model metrics
   * @returns {number} Performance score (0-1)
   */
  calculatePerformanceScore(metrics) {
    if (metrics.totalRequests === 0) {
      return 0.7; // Default score for new models
    }
    
    const successRate = metrics.successfulRequests / metrics.totalRequests;
    const speedScore = Math.max(0, 1 - (metrics.averageResponseTime / 30000)); // 30s max
    const qualityScore = metrics.averageQualityScore || 0.7;
    
    return (successRate * 0.4) + (speedScore * 0.3) + (qualityScore * 0.3);
  }

  /**
   * Calculate cost efficiency score
   * @param {Object} config - Model configuration
   * @param {Object} context - Request context
   * @returns {number} Cost score (0-1, higher is better/cheaper)
   */
  calculateCostScore(config, context) {
    const userTier = context.userTier || 'free';
    const maxCost = userTier === 'premium' ? 0.001 : 0.0003; // Max acceptable cost per 1K tokens
    
    // Invert cost (lower cost = higher score)
    return Math.max(0, 1 - (config.cost / maxCost));
  }

  /**
   * Calculate specialty match score
   * @param {Object} config - Model configuration
   * @param {string} requestType - Request type
   * @returns {number} Specialty score (0-1)
   */
  calculateSpecialtyScore(config, requestType) {
    if (config.specialties.includes(requestType)) {
      return 1.0; // Perfect match
    }
    if (config.specialties.includes('general')) {
      return 0.7; // Good general capability
    }
    return 0.5; // Basic capability
  }

  /**
   * Calculate load balancing score
   * @param {Object} config - Model configuration
   * @returns {number} Load score (0-1, higher is better/less loaded)
   */
  calculateLoadScore(config) {
    const maxLoad = 10; // Maximum concurrent requests per model
    return Math.max(0, 1 - (config.currentLoad / maxLoad));
  }

  /**
   * Select diverse models to avoid provider concentration
   * @param {Array} scoredModels - Models with scores
   * @param {number} count - Number of models to select
   * @returns {Array} Selected diverse models
   */
  selectDiverseModels(scoredModels, count) {
    const selected = [];
    const usedProviders = new Set();

    // First pass: select best model from each provider
    for (const modelData of scoredModels) {
      if (selected.length >= count) break;

      const provider = modelData.config.provider;
      if (!usedProviders.has(provider)) {
        selected.push(modelData);
        usedProviders.add(provider);
      }
    }

    // Second pass: fill remaining slots with highest scoring models
    for (const modelData of scoredModels) {
      if (selected.length >= count) break;

      if (!selected.find(s => s.model === modelData.model)) {
        selected.push(modelData);
      }
    }

    return selected.slice(0, count);
  }

  /**
   * Update model load tracking
   * @param {Array} selectedModels - Selected models
   */
  updateModelLoads(selectedModels) {
    selectedModels.forEach(modelData => {
      this.modelConfigs[modelData.model].currentLoad++;
    });
  }

  /**
   * Get fallback models when selection fails
   * @param {number} count - Number of models needed
   * @returns {Array} Fallback model configurations
   */
  getFallbackModels(count) {
    const fallbackOrder = ['gpt-4.1-nano', 'gemini-1.5-flash-8b', 'claude-3-5-haiku'];
    const fallbacks = [];

    for (let i = 0; i < Math.min(count, fallbackOrder.length); i++) {
      const model = fallbackOrder[i];
      if (this.modelConfigs[model]) {
        fallbacks.push({
          model,
          config: this.modelConfigs[model],
          score: 0.5,
          reasoning: 'Fallback selection'
        });
      }
    }

    return fallbacks;
  }

  /**
   * Get score reasoning for transparency
   * @param {string} model - Model name
   * @param {number} score - Calculated score
   * @param {string} requestType - Request type
   * @returns {string} Human-readable reasoning
   */
  getScoreReasoning(model, score, requestType) {
    const config = this.modelConfigs[model];
    const reasons = [];

    if (config.specialties.includes(requestType)) {
      reasons.push(`Specialized for ${requestType}`);
    }
    if (config.cost < 0.0001) {
      reasons.push('Very cost-efficient');
    }
    if (config.reliability > 0.9) {
      reasons.push('High reliability');
    }
    if (config.speed === 'very-fast') {
      reasons.push('Very fast response');
    }

    return reasons.join(', ') || 'General capability';
  }

  /**
   * Record model performance for learning
   * @param {string} model - Model name
   * @param {Object} performance - Performance data
   */
  recordPerformance(model, performance) {
    const metrics = this.modelMetrics.get(model);
    if (!metrics) return;

    // Update basic metrics
    metrics.totalRequests++;
    metrics.lastUsed = Date.now();

    if (performance.success) {
      metrics.successfulRequests++;

      // Update average response time
      const newTime = performance.responseTime;
      if (metrics.averageResponseTime === 0) {
        metrics.averageResponseTime = newTime;
      } else {
        metrics.averageResponseTime =
          (metrics.averageResponseTime * 0.9) + (newTime * 0.1);
      }

      // Update quality score if provided
      if (performance.qualityScore) {
        if (metrics.averageQualityScore === 0) {
          metrics.averageQualityScore = performance.qualityScore;
        } else {
          metrics.averageQualityScore =
            (metrics.averageQualityScore * 0.9) + (performance.qualityScore * 0.1);
        }
      }

      // Reset circuit breaker on success
      if (metrics.circuitBreakerState === 'HALF_OPEN') {
        metrics.circuitBreakerState = 'CLOSED';
        metrics.circuitBreakerFailures = 0;
      }

    } else {
      metrics.failedRequests++;
      this.handleModelFailure(model, performance.error);
    }

    // Update recent performance window
    metrics.recentPerformance.push({
      timestamp: Date.now(),
      success: performance.success,
      responseTime: performance.responseTime,
      qualityScore: performance.qualityScore
    });

    // Keep only recent performance data
    if (metrics.recentPerformance.length > 100) {
      metrics.recentPerformance = metrics.recentPerformance.slice(-100);
    }

    // Update request history
    this.requestHistory.push({
      model,
      timestamp: Date.now(),
      performance
    });

    if (this.requestHistory.length > this.performanceWindow) {
      this.requestHistory = this.requestHistory.slice(-this.performanceWindow);
    }
  }

  /**
   * Handle model failure and circuit breaker logic
   * @param {string} model - Model name
   * @param {Error} error - Error that occurred
   */
  handleModelFailure(model, error) {
    const metrics = this.modelMetrics.get(model);
    if (!metrics) return;

    metrics.circuitBreakerFailures++;
    metrics.circuitBreakerLastFailure = Date.now();

    // Circuit breaker thresholds
    const failureThreshold = 5;
    const timeWindow = 60000; // 1 minute

    // Open circuit breaker if too many failures
    if (metrics.circuitBreakerFailures >= failureThreshold) {
      metrics.circuitBreakerState = 'OPEN';

      logger.warning(
        `Circuit breaker OPEN for model: ${model}`,
        { failures: metrics.circuitBreakerFailures, error: error?.message },
        'router'
      );

      // Schedule circuit breaker reset
      setTimeout(() => {
        if (metrics.circuitBreakerState === 'OPEN') {
          metrics.circuitBreakerState = 'HALF_OPEN';
          logger.info(`Circuit breaker HALF_OPEN for model: ${model}`, {}, 'router');
        }
      }, timeWindow);
    }
  }

  /**
   * Start performance monitoring background task
   */
  startPerformanceMonitoring() {
    // Monitor every 5 minutes
    setInterval(() => {
      this.performanceAnalysis();
    }, 5 * 60 * 1000);

    // Cleanup old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
  }

  /**
   * Perform periodic performance analysis
   */
  performanceAnalysis() {
    const analysis = {
      timestamp: Date.now(),
      modelPerformance: {},
      recommendations: []
    };

    // Analyze each model
    for (const [model, metrics] of this.modelMetrics.entries()) {
      if (metrics.totalRequests > 0) {
        const successRate = metrics.successfulRequests / metrics.totalRequests;
        const avgResponseTime = metrics.averageResponseTime;
        const avgQuality = metrics.averageQualityScore;

        analysis.modelPerformance[model] = {
          successRate,
          avgResponseTime,
          avgQuality,
          totalRequests: metrics.totalRequests,
          circuitBreakerState: metrics.circuitBreakerState
        };

        // Generate recommendations
        if (successRate < 0.8) {
          analysis.recommendations.push(`Consider reducing usage of ${model} (low success rate: ${(successRate * 100).toFixed(1)}%)`);
        }
        if (avgResponseTime > 15000) {
          analysis.recommendations.push(`${model} showing slow response times (avg: ${avgResponseTime}ms)`);
        }
      }
    }

    // Log analysis
    monitoringService.log('info', 'Model performance analysis', analysis);
  }

  /**
   * Cleanup old performance data
   */
  cleanupOldData() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    // Clean request history
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoffTime);

    // Clean model recent performance
    for (const metrics of this.modelMetrics.values()) {
      metrics.recentPerformance = metrics.recentPerformance.filter(
        perf => perf.timestamp > cutoffTime
      );
    }
  }

  /**
   * Get comprehensive router metrics
   * @returns {Object} Router performance metrics
   */
  getMetrics() {
    const metrics = {
      totalRequests: this.requestHistory.length,
      modelMetrics: {},
      circuitBreakerStatus: {},
      recentPerformance: {}
    };

    // Compile model metrics
    for (const [model, data] of this.modelMetrics.entries()) {
      metrics.modelMetrics[model] = {
        totalRequests: data.totalRequests,
        successRate: data.totalRequests > 0 ?
          ((data.successfulRequests / data.totalRequests) * 100).toFixed(1) + '%' : 'N/A',
        avgResponseTime: data.averageResponseTime.toFixed(0) + 'ms',
        avgQualityScore: data.averageQualityScore.toFixed(2),
        lastUsed: data.lastUsed,
        currentLoad: this.modelConfigs[model].currentLoad
      };

      metrics.circuitBreakerStatus[model] = data.circuitBreakerState;
    }

    return metrics;
  }

  /**
   * Reduce model load when request completes
   * @param {string} model - Model name
   */
  releaseModelLoad(model) {
    if (this.modelConfigs[model] && this.modelConfigs[model].currentLoad > 0) {
      this.modelConfigs[model].currentLoad--;
    }
  }
}

// Export singleton instance
const intelligentModelRouter = new IntelligentModelRouter();
module.exports = intelligentModelRouter;
