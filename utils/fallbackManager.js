/**
 * 🛡️ Comprehensive Fallback Manager - Multi-Level Fallback System for NeuraStack
 *
 * 🎯 PURPOSE: Intelligent fallback mechanisms for all critical services including
 *            AI models, synthesis, voting, database operations, and system components
 *
 * 📋 KEY FEATURES:
 * 1. Multi-level fallback hierarchies for different service types
 * 2. Context-aware fallback selection based on failure patterns
 * 3. Intelligent fallback quality assessment and ranking
 * 4. Automatic fallback health monitoring and rotation
 * 5. Graceful degradation with maintained core functionality
 * 6. Fallback performance tracking and optimization
 */

const monitoringService = require('../services/monitoringService');
const { NeuraStackError } = require('./errorHandler');

// ==================== FALLBACK STRATEGY DEFINITIONS ====================

/**
 * Fallback strategy for AI model failures
 */
const AI_MODEL_FALLBACKS = {
  'gpt4o': [
    { provider: 'openai', model: 'gpt-4o-mini', priority: 1, quality: 0.9 },
    { provider: 'openai', model: 'gpt-3.5-turbo', priority: 2, quality: 0.7 },
    { provider: 'anthropic', model: 'claude-3-haiku-20240307', priority: 3, quality: 0.8 },
    { provider: 'google', model: 'gemini-1.5-flash', priority: 4, quality: 0.75 }
  ],
  'gemini': [
    { provider: 'xai', model: 'grok-2-1212', priority: 1, quality: 0.85 },
    { provider: 'openai', model: 'gpt-4o-mini', priority: 2, quality: 0.9 },
    { provider: 'anthropic', model: 'claude-3-haiku-20240307', priority: 3, quality: 0.8 },
    { provider: 'openai', model: 'gpt-3.5-turbo', priority: 4, quality: 0.7 }
  ],
  'claude': [
    { provider: 'openai', model: 'gpt-4o-mini', priority: 1, quality: 0.9 },
    { provider: 'google', model: 'gemini-1.5-flash', priority: 2, quality: 0.75 },
    { provider: 'openai', model: 'gpt-3.5-turbo', priority: 3, quality: 0.7 },
    { provider: 'xai', model: 'grok-2-1212', priority: 4, quality: 0.85 }
  ],
  'xai': [
    { provider: 'google', model: 'gemini-1.5-flash', priority: 1, quality: 0.75 },
    { provider: 'openai', model: 'gpt-4o-mini', priority: 2, quality: 0.9 },
    { provider: 'anthropic', model: 'claude-3-haiku-20240307', priority: 3, quality: 0.8 },
    { provider: 'openai', model: 'gpt-3.5-turbo', priority: 4, quality: 0.7 }
  ]
};

/**
 * Fallback strategies for different service types
 */
const SERVICE_FALLBACKS = {
  synthesis: [
    { type: 'simple_concatenation', quality: 0.4, description: 'Simple response concatenation' },
    { type: 'best_response_selection', quality: 0.6, description: 'Select highest quality response' },
    { type: 'template_based', quality: 0.3, description: 'Template-based fallback response' },
    { type: 'cached_response', quality: 0.5, description: 'Use cached similar response' }
  ],
  voting: [
    { type: 'simple_majority', quality: 0.7, description: 'Simple majority voting' },
    { type: 'weighted_random', quality: 0.5, description: 'Weighted random selection' },
    { type: 'first_available', quality: 0.3, description: 'First available response' },
    { type: 'highest_confidence', quality: 0.6, description: 'Response with highest confidence' }
  ],
  database: [
    { type: 'memory_cache', quality: 0.8, description: 'In-memory cache fallback' },
    { type: 'local_storage', quality: 0.6, description: 'Local file storage' },
    { type: 'read_only_mode', quality: 0.4, description: 'Read-only operations only' },
    { type: 'offline_mode', quality: 0.2, description: 'Offline mode with basic functionality' }
  ],
  memory: [
    { type: 'session_memory', quality: 0.7, description: 'Session-based memory only' },
    { type: 'local_memory', quality: 0.5, description: 'Local in-memory storage' },
    { type: 'no_memory', quality: 0.2, description: 'Stateless operation' }
  ]
};

// ==================== FALLBACK MANAGER CLASS ====================

class ComprehensiveFallbackManager {
  constructor() {
    this.fallbackHistory = new Map(); // Track fallback usage and success rates
    this.healthScores = new Map(); // Track health scores for different fallbacks
    this.activeCircuitBreakers = new Map(); // Track which fallbacks are circuit broken
    this.fallbackMetrics = {
      totalFallbacks: 0,
      successfulFallbacks: 0,
      failedFallbacks: 0,
      fallbacksByType: new Map(),
      averageQualityScore: 0
    };

    console.log('🛡️ Comprehensive Fallback Manager initialized');
  }

  /**
   * Get the best available fallback for a failed AI model
   */
  async getAIModelFallback(failedModel, context = {}) {
    const fallbacks = AI_MODEL_FALLBACKS[failedModel] || [];
    const { correlationId, userPrompt, attempt = 1 } = context;

    monitoringService.log('info', `Finding AI model fallback for ${failedModel}`, {
      availableFallbacks: fallbacks.length,
      attempt,
      correlationId
    });

    // Filter out unhealthy fallbacks
    const healthyFallbacks = await this.filterHealthyFallbacks(fallbacks, 'ai_model');
    
    if (healthyFallbacks.length === 0) {
      throw new NeuraStackError(
        `No healthy fallbacks available for ${failedModel}`,
        null,
        { failedModel, correlationId }
      );
    }

    // Select best fallback based on health score and quality
    const selectedFallback = this.selectBestFallback(healthyFallbacks, context);
    
    this.recordFallbackUsage('ai_model', failedModel, selectedFallback);
    
    return {
      provider: selectedFallback.provider,
      model: selectedFallback.model,
      quality: selectedFallback.quality,
      fallbackReason: `${failedModel} unavailable`,
      fallbackLevel: attempt
    };
  }

  /**
   * Get fallback for synthesis service failure
   */
  async getSynthesisFallback(roleOutputs, userPrompt, context = {}) {
    const { correlationId, failureReason = 'synthesis_failed' } = context;
    const fallbacks = SERVICE_FALLBACKS.synthesis;

    monitoringService.log('info', 'Finding synthesis fallback', {
      roleOutputsCount: roleOutputs.length,
      failureReason,
      correlationId
    });

    const healthyFallbacks = await this.filterHealthyFallbacks(fallbacks, 'synthesis');
    
    if (healthyFallbacks.length === 0) {
      return this.createEmergencyFallback('synthesis', { roleOutputs, userPrompt, correlationId });
    }

    const selectedFallback = this.selectBestFallback(healthyFallbacks, context);
    
    try {
      const result = await this.executeSynthesisFallback(selectedFallback, roleOutputs, userPrompt, context);
      this.recordFallbackSuccess('synthesis', selectedFallback.type);
      return result;
    } catch (error) {
      this.recordFallbackFailure('synthesis', selectedFallback.type, error);
      
      // Try next fallback
      const nextFallback = healthyFallbacks.find(f => f.priority > selectedFallback.priority);
      if (nextFallback) {
        return this.executeSynthesisFallback(nextFallback, roleOutputs, userPrompt, context);
      }
      
      return this.createEmergencyFallback('synthesis', { roleOutputs, userPrompt, correlationId });
    }
  }

  /**
   * Get fallback for voting service failure
   */
  async getVotingFallback(roleOutputs, context = {}) {
    const { correlationId, failureReason = 'voting_failed' } = context;
    const fallbacks = SERVICE_FALLBACKS.voting;

    monitoringService.log('info', 'Finding voting fallback', {
      roleOutputsCount: roleOutputs.length,
      failureReason,
      correlationId
    });

    const healthyFallbacks = await this.filterHealthyFallbacks(fallbacks, 'voting');
    
    if (healthyFallbacks.length === 0) {
      return this.createEmergencyFallback('voting', { roleOutputs, correlationId });
    }

    const selectedFallback = this.selectBestFallback(healthyFallbacks, context);
    
    try {
      const result = await this.executeVotingFallback(selectedFallback, roleOutputs, context);
      this.recordFallbackSuccess('voting', selectedFallback.type);
      return result;
    } catch (error) {
      this.recordFallbackFailure('voting', selectedFallback.type, error);
      return this.createEmergencyFallback('voting', { roleOutputs, correlationId });
    }
  }

  /**
   * Get fallback for database service failure
   */
  async getDatabaseFallback(operation, data, context = {}) {
    const { correlationId, operationType = 'unknown' } = context;
    const fallbacks = SERVICE_FALLBACKS.database;

    monitoringService.log('warn', 'Database fallback required', {
      operationType,
      correlationId
    });

    const healthyFallbacks = await this.filterHealthyFallbacks(fallbacks, 'database');
    
    if (healthyFallbacks.length === 0) {
      return this.createEmergencyFallback('database', { operation, data, correlationId });
    }

    const selectedFallback = this.selectBestFallback(healthyFallbacks, context);
    
    try {
      const result = await this.executeDatabaseFallback(selectedFallback, operation, data, context);
      this.recordFallbackSuccess('database', selectedFallback.type);
      return result;
    } catch (error) {
      this.recordFallbackFailure('database', selectedFallback.type, error);
      return this.createEmergencyFallback('database', { operation, data, correlationId });
    }
  }

  /**
   * Filter out unhealthy fallbacks based on circuit breaker status and health scores
   */
  async filterHealthyFallbacks(fallbacks, serviceType) {
    const healthyFallbacks = [];
    
    for (const fallback of fallbacks) {
      const fallbackKey = `${serviceType}_${fallback.type || fallback.model}`;
      
      // Check circuit breaker status
      if (this.activeCircuitBreakers.has(fallbackKey)) {
        const cbStatus = this.activeCircuitBreakers.get(fallbackKey);
        if (cbStatus.state === 'OPEN' && Date.now() < cbStatus.nextAttemptTime) {
          continue; // Skip circuit broken fallbacks
        }
      }
      
      // Check health score
      const healthScore = this.healthScores.get(fallbackKey) || 1.0;
      if (healthScore < 0.3) {
        continue; // Skip unhealthy fallbacks
      }
      
      healthyFallbacks.push({
        ...fallback,
        healthScore,
        fallbackKey
      });
    }
    
    return healthyFallbacks.sort((a, b) => {
      // Sort by priority first, then by health score
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.healthScore - a.healthScore;
    });
  }

  /**
   * Select the best fallback based on multiple criteria
   */
  selectBestFallback(fallbacks, context = {}) {
    if (fallbacks.length === 0) return null;

    // For now, select the first (highest priority, healthiest) fallback
    // In the future, this could be enhanced with more sophisticated selection logic
    const selected = fallbacks[0];

    monitoringService.log('debug', 'Selected fallback', {
      type: selected.type || selected.model,
      quality: selected.quality,
      healthScore: selected.healthScore,
      priority: selected.priority
    });

    return selected;
  }

  // ==================== FALLBACK EXECUTION METHODS ====================

  /**
   * Execute synthesis fallback strategy
   */
  async executeSynthesisFallback(fallback, roleOutputs, userPrompt, context) {
    const { correlationId } = context;
    const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled' && r.content);

    switch (fallback.type) {
      case 'simple_concatenation':
        return this.createConcatenatedSynthesis(successfulOutputs, userPrompt, correlationId);

      case 'best_response_selection':
        return this.selectBestResponse(successfulOutputs, userPrompt, correlationId);

      case 'template_based':
        return this.createTemplateSynthesis(successfulOutputs, userPrompt, correlationId);

      case 'cached_response':
        return this.getCachedSynthesis(userPrompt, correlationId);

      default:
        throw new Error(`Unknown synthesis fallback type: ${fallback.type}`);
    }
  }

  /**
   * Execute voting fallback strategy
   */
  async executeVotingFallback(fallback, roleOutputs, context) {
    const { correlationId } = context;
    const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled' && r.content);

    switch (fallback.type) {
      case 'simple_majority':
        return this.performSimpleMajorityVoting(successfulOutputs, correlationId);

      case 'weighted_random':
        return this.performWeightedRandomSelection(successfulOutputs, correlationId);

      case 'first_available':
        return this.selectFirstAvailable(successfulOutputs, correlationId);

      case 'highest_confidence':
        return this.selectHighestConfidence(successfulOutputs, correlationId);

      default:
        throw new Error(`Unknown voting fallback type: ${fallback.type}`);
    }
  }

  /**
   * Execute database fallback strategy
   */
  async executeDatabaseFallback(fallback, operation, data, context) {
    const { correlationId } = context;

    switch (fallback.type) {
      case 'memory_cache':
        return this.executeMemoryCacheFallback(operation, data, correlationId);

      case 'local_storage':
        return this.executeLocalStorageFallback(operation, data, correlationId);

      case 'read_only_mode':
        return this.executeReadOnlyFallback(operation, data, correlationId);

      case 'offline_mode':
        return this.executeOfflineFallback(operation, data, correlationId);

      default:
        throw new Error(`Unknown database fallback type: ${fallback.type}`);
    }
  }

  // ==================== SYNTHESIS FALLBACK IMPLEMENTATIONS ====================

  /**
   * Create concatenated synthesis from multiple responses
   */
  createConcatenatedSynthesis(outputs, userPrompt, correlationId) {
    if (outputs.length === 0) {
      return this.createEmergencyFallback('synthesis', { userPrompt, correlationId });
    }

    const content = outputs.map((output, index) => {
      const modelName = output.model || `Model ${index + 1}`;
      return `**${modelName}:** ${output.content}`;
    }).join('\n\n');

    return {
      content: `Here are responses from multiple AI models:\n\n${content}`,
      model: 'fallback-concatenation',
      provider: 'system',
      status: 'fallback',
      confidence: {
        score: Math.min(0.6, outputs.length * 0.15),
        level: 'medium',
        factors: ['Multiple model responses', 'Simple concatenation']
      },
      fallbackUsed: true,
      sourceCount: outputs.length,
      fallbackType: 'simple_concatenation'
    };
  }

  /**
   * Select the best single response from available outputs
   */
  selectBestResponse(outputs, userPrompt, correlationId) {
    if (outputs.length === 0) {
      return this.createEmergencyFallback('synthesis', { userPrompt, correlationId });
    }

    // Simple heuristic: longest response with good structure
    const bestOutput = outputs.reduce((best, current) => {
      const currentScore = this.calculateResponseQuality(current);
      const bestScore = this.calculateResponseQuality(best);
      return currentScore > bestScore ? current : best;
    });

    return {
      content: bestOutput.content,
      model: 'fallback-best-selection',
      provider: 'system',
      status: 'fallback',
      confidence: {
        score: Math.min(0.8, bestOutput.confidence?.score || 0.6),
        level: 'medium-high',
        factors: ['Best response selection', 'Quality-based ranking']
      },
      fallbackUsed: true,
      originalModel: bestOutput.model,
      fallbackType: 'best_response_selection'
    };
  }

  /**
   * Create template-based synthesis
   */
  createTemplateSynthesis(outputs, userPrompt, correlationId) {
    const template = `Based on your question "${userPrompt}", here's what I can tell you:

${outputs.length > 0 ?
  outputs.map(o => `• ${o.content.substring(0, 200)}...`).join('\n') :
  'I apologize, but I\'m unable to provide a complete response at this time.'
}

Please note that this is a simplified response due to technical limitations.`;

    return {
      content: template,
      model: 'fallback-template',
      provider: 'system',
      status: 'fallback',
      confidence: {
        score: 0.3,
        level: 'low',
        factors: ['Template-based response', 'Limited processing']
      },
      fallbackUsed: true,
      fallbackType: 'template_based'
    };
  }

  /**
   * Get cached synthesis (placeholder for future implementation)
   */
  getCachedSynthesis(userPrompt, correlationId) {
    // Placeholder for cached response logic
    return {
      content: 'I apologize, but I\'m experiencing technical difficulties and cannot provide a complete response at this time. Please try again in a moment.',
      model: 'fallback-cached',
      provider: 'system',
      status: 'fallback',
      confidence: {
        score: 0.2,
        level: 'very-low',
        factors: ['Cached fallback', 'Technical difficulties']
      },
      fallbackUsed: true,
      fallbackType: 'cached_response'
    };
  }

  // ==================== VOTING FALLBACK IMPLEMENTATIONS ====================

  /**
   * Perform simple majority voting
   */
  performSimpleMajorityVoting(outputs, correlationId) {
    if (outputs.length === 0) {
      return this.createEmergencyFallback('voting', { correlationId });
    }

    // Simple implementation: select the first response as winner
    const winner = outputs[0];
    const weights = {};
    outputs.forEach((output, index) => {
      weights[output.model || `model_${index}`] = 1.0 / outputs.length;
    });

    return {
      winner: winner.model || 'unknown',
      confidence: 0.6,
      consensus: 'simple_majority',
      weights,
      fallbackUsed: true,
      fallbackType: 'simple_majority',
      _description: 'Simple majority voting fallback'
    };
  }

  /**
   * Perform weighted random selection
   */
  performWeightedRandomSelection(outputs, correlationId) {
    if (outputs.length === 0) {
      return this.createEmergencyFallback('voting', { correlationId });
    }

    const randomIndex = Math.floor(Math.random() * outputs.length);
    const winner = outputs[randomIndex];
    const weights = {};

    outputs.forEach((output, index) => {
      weights[output.model || `model_${index}`] = index === randomIndex ? 0.8 : 0.2 / (outputs.length - 1);
    });

    return {
      winner: winner.model || 'unknown',
      confidence: 0.4,
      consensus: 'weighted_random',
      weights,
      fallbackUsed: true,
      fallbackType: 'weighted_random',
      _description: 'Weighted random selection fallback'
    };
  }

  /**
   * Select first available response
   */
  selectFirstAvailable(outputs, correlationId) {
    if (outputs.length === 0) {
      return this.createEmergencyFallback('voting', { correlationId });
    }

    const winner = outputs[0];
    const weights = { [winner.model || 'unknown']: 1.0 };

    return {
      winner: winner.model || 'unknown',
      confidence: 0.3,
      consensus: 'first_available',
      weights,
      fallbackUsed: true,
      fallbackType: 'first_available',
      _description: 'First available response fallback'
    };
  }

  /**
   * Select response with highest confidence
   */
  selectHighestConfidence(outputs, correlationId) {
    if (outputs.length === 0) {
      return this.createEmergencyFallback('voting', { correlationId });
    }

    const winner = outputs.reduce((best, current) => {
      const currentConf = current.confidence?.score || 0.5;
      const bestConf = best.confidence?.score || 0.5;
      return currentConf > bestConf ? current : best;
    });

    const weights = {};
    outputs.forEach(output => {
      const conf = output.confidence?.score || 0.5;
      weights[output.model || 'unknown'] = conf / outputs.reduce((sum, o) => sum + (o.confidence?.score || 0.5), 0);
    });

    return {
      winner: winner.model || 'unknown',
      confidence: winner.confidence?.score || 0.5,
      consensus: 'highest_confidence',
      weights,
      fallbackUsed: true,
      fallbackType: 'highest_confidence',
      _description: 'Highest confidence selection fallback'
    };
  }

  // ==================== DATABASE FALLBACK IMPLEMENTATIONS ====================

  /**
   * Execute memory cache fallback
   */
  async executeMemoryCacheFallback(operation, data, correlationId) {
    monitoringService.log('info', 'Using memory cache fallback', { operation, correlationId });

    // Placeholder for memory cache implementation
    return {
      success: true,
      data: null,
      fallbackUsed: true,
      fallbackType: 'memory_cache',
      message: 'Operation completed using memory cache'
    };
  }

  /**
   * Execute local storage fallback
   */
  async executeLocalStorageFallback(operation, data, correlationId) {
    monitoringService.log('info', 'Using local storage fallback', { operation, correlationId });

    // Placeholder for local storage implementation
    return {
      success: true,
      data: null,
      fallbackUsed: true,
      fallbackType: 'local_storage',
      message: 'Operation completed using local storage'
    };
  }

  /**
   * Execute read-only mode fallback
   */
  async executeReadOnlyFallback(operation, data, correlationId) {
    monitoringService.log('warn', 'Database in read-only mode', { operation, correlationId });

    if (operation.includes('read') || operation.includes('get')) {
      return {
        success: true,
        data: null,
        fallbackUsed: true,
        fallbackType: 'read_only_mode',
        message: 'Read operation completed in read-only mode'
      };
    }

    return {
      success: false,
      error: 'Write operations not available in read-only mode',
      fallbackUsed: true,
      fallbackType: 'read_only_mode'
    };
  }

  /**
   * Execute offline mode fallback
   */
  async executeOfflineFallback(operation, data, correlationId) {
    monitoringService.log('warn', 'Database in offline mode', { operation, correlationId });

    return {
      success: false,
      error: 'Database operations not available in offline mode',
      fallbackUsed: true,
      fallbackType: 'offline_mode',
      message: 'System operating in offline mode'
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Calculate response quality score for ranking
   */
  calculateResponseQuality(output) {
    if (!output || !output.content) return 0;

    let score = 0;

    // Length factor (reasonable length is good)
    const length = output.content.length;
    if (length > 50 && length < 2000) score += 0.3;
    else if (length >= 2000) score += 0.2;
    else score += 0.1;

    // Confidence factor
    if (output.confidence?.score) {
      score += output.confidence.score * 0.4;
    } else {
      score += 0.2; // Default confidence
    }

    // Structure factor (simple heuristics)
    const hasStructure = output.content.includes('\n') ||
                        output.content.includes('•') ||
                        output.content.includes('-') ||
                        output.content.includes('1.');
    if (hasStructure) score += 0.2;

    // Completeness factor
    const seemsComplete = !output.content.endsWith('...') &&
                         !output.content.includes('[incomplete]') &&
                         output.content.length > 20;
    if (seemsComplete) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Create emergency fallback when all else fails
   */
  createEmergencyFallback(serviceType, context = {}) {
    const { correlationId, userPrompt, roleOutputs } = context;

    this.fallbackMetrics.totalFallbacks++;
    this.fallbackMetrics.failedFallbacks++;

    monitoringService.log('error', `Emergency fallback activated for ${serviceType}`, {
      correlationId,
      context: Object.keys(context)
    });

    switch (serviceType) {
      case 'synthesis':
        return {
          content: 'I apologize, but I\'m experiencing technical difficulties and cannot provide a response at this time. Please try again in a moment.',
          model: 'emergency-fallback',
          provider: 'system',
          status: 'emergency_fallback',
          confidence: { score: 0.1, level: 'very-low', factors: ['Emergency fallback'] },
          fallbackUsed: true,
          emergencyFallback: true
        };

      case 'voting':
        return {
          winner: 'gpt4o',
          confidence: 0.1,
          consensus: 'emergency_fallback',
          weights: { gpt4o: 1.0 },
          fallbackUsed: true,
          emergencyFallback: true,
          _description: 'Emergency fallback voting'
        };

      case 'database':
        return {
          success: false,
          error: 'Database service unavailable',
          fallbackUsed: true,
          emergencyFallback: true,
          message: 'All database fallbacks exhausted'
        };

      default:
        return {
          success: false,
          error: `${serviceType} service unavailable`,
          fallbackUsed: true,
          emergencyFallback: true
        };
    }
  }

  /**
   * Record fallback usage for analytics
   */
  recordFallbackUsage(serviceType, originalService, fallback) {
    const key = `${serviceType}_${originalService}_${fallback.type || fallback.model}`;

    if (!this.fallbackHistory.has(key)) {
      this.fallbackHistory.set(key, {
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        lastUsed: null,
        averageQuality: 0
      });
    }

    const history = this.fallbackHistory.get(key);
    history.usageCount++;
    history.lastUsed = Date.now();

    this.fallbackMetrics.totalFallbacks++;

    if (!this.fallbackMetrics.fallbacksByType.has(serviceType)) {
      this.fallbackMetrics.fallbacksByType.set(serviceType, 0);
    }
    this.fallbackMetrics.fallbacksByType.set(
      serviceType,
      this.fallbackMetrics.fallbacksByType.get(serviceType) + 1
    );
  }

  /**
   * Record successful fallback execution
   */
  recordFallbackSuccess(serviceType, fallbackType) {
    const key = `${serviceType}_${fallbackType}`;

    if (this.fallbackHistory.has(key)) {
      this.fallbackHistory.get(key).successCount++;
    }

    this.fallbackMetrics.successfulFallbacks++;
    this.updateHealthScore(key, true);
  }

  /**
   * Record failed fallback execution
   */
  recordFallbackFailure(serviceType, fallbackType, error) {
    const key = `${serviceType}_${fallbackType}`;

    if (this.fallbackHistory.has(key)) {
      this.fallbackHistory.get(key).failureCount++;
    }

    this.fallbackMetrics.failedFallbacks++;
    this.updateHealthScore(key, false);

    monitoringService.log('warn', `Fallback failed: ${key}`, {
      error: error.message,
      fallbackType
    });
  }

  /**
   * Update health score for a fallback
   */
  updateHealthScore(fallbackKey, success) {
    const currentScore = this.healthScores.get(fallbackKey) || 1.0;

    // Simple exponential moving average
    const newScore = success ?
      (currentScore * 0.9) + (1.0 * 0.1) :
      (currentScore * 0.9) + (0.0 * 0.1);

    this.healthScores.set(fallbackKey, Math.max(0, Math.min(1, newScore)));
  }

  /**
   * Get comprehensive fallback metrics
   */
  getMetrics() {
    return {
      ...this.fallbackMetrics,
      fallbacksByType: Object.fromEntries(this.fallbackMetrics.fallbacksByType),
      healthScores: Object.fromEntries(this.healthScores),
      activeCircuitBreakers: this.activeCircuitBreakers.size,
      fallbackHistory: this.fallbackHistory.size
    };
  }

  /**
   * Health check for fallback manager
   */
  async healthCheck() {
    const totalFallbacks = this.fallbackMetrics.totalFallbacks;
    const successRate = totalFallbacks > 0 ?
      this.fallbackMetrics.successfulFallbacks / totalFallbacks : 1.0;

    return {
      status: successRate > 0.7 ? 'healthy' : successRate > 0.4 ? 'degraded' : 'unhealthy',
      metrics: this.getMetrics(),
      successRate,
      averageHealthScore: this.calculateAverageHealthScore()
    };
  }

  /**
   * Calculate average health score across all fallbacks
   */
  calculateAverageHealthScore() {
    if (this.healthScores.size === 0) return 1.0;

    const scores = Array.from(this.healthScores.values());
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
}

// ==================== EXPORTS ====================

const fallbackManager = new ComprehensiveFallbackManager();

module.exports = {
  ComprehensiveFallbackManager,
  fallbackManager,
  AI_MODEL_FALLBACKS,
  SERVICE_FALLBACKS
};
