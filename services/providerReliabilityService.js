/**
 * 🔄 Provider Reliability Service - Dynamic Uptime and Cost Tracking
 *
 * 🎯 PURPOSE: Track provider uptime, cost efficiency, and reliability metrics
 *            for dynamic weight calculation in ensemble voting
 *
 * 📋 KEY FEATURES:
 * 1. 24-hour rolling uptime tracking per provider
 * 2. Real-time cost per 1K output token calculation
 * 3. Dynamic reliability weight computation
 * 4. Provider health scoring and monitoring
 * 5. Historical performance analytics
 *
 * 💡 ANALOGY: Like having a financial analyst and reliability engineer
 *    continuously monitoring each AI provider's performance and cost-effectiveness
 */

const monitoringService = require('./monitoringService');

class ProviderReliabilityService {
  constructor() {
    this.uptimeTracking = new Map(); // Provider -> uptime data
    this.costTracking = new Map(); // Provider -> cost data
    this.reliabilityMetrics = new Map(); // Provider -> reliability scores
    this.uptimeWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.maxHistorySize = 1000; // Maximum history entries per provider
    
    this.initializeService();
  }

  /**
   * Initialize the reliability service
   */
  initializeService() {
    // Initialize default provider configurations
    this.initializeProviderConfigs();
    
    // Start periodic cleanup of old data
    this.startPeriodicCleanup();
    
    console.log('✅ Provider Reliability Service: Initialized with uptime and cost tracking');
  }

  /**
   * Initialize provider configurations with default cost data
   */
  initializeProviderConfigs() {
    const providers = [
      {
        name: 'openai',
        models: {
          'gpt-4o': { inputCost: 0.005, outputCost: 0.015 },
          'gpt-4o-mini': { inputCost: 0.00015, outputCost: 0.0006 },
          'gpt-4.1-mini': { inputCost: 0.0004, outputCost: 0.0016 }
        }
      },
      {
        name: 'claude',
        models: {
          'claude-3-5-haiku-latest': { inputCost: 0.00025, outputCost: 0.00125 },
          'claude-3-5-sonnet-latest': { inputCost: 0.003, outputCost: 0.015 }
        }
      },
      {
        name: 'gemini',
        models: {
          'gemini-1.5-flash': { inputCost: 0.000075, outputCost: 0.0003 },
          'gemini-2.0-flash': { inputCost: 0.000075, outputCost: 0.0003 },
          'gemini-2.5-flash': { inputCost: 0.0001, outputCost: 0.0004 }
        }
      },
      {
        name: 'xai',
        models: {
          'grok-beta': { inputCost: 0.005, outputCost: 0.015 }
        }
      }
    ];

    providers.forEach(provider => {
      this.uptimeTracking.set(provider.name, {
        events: [], // Array of {timestamp, status, responseTime}
        currentUptime: 1.0, // Current 24h uptime percentage
        totalRequests: 0,
        successfulRequests: 0,
        lastUpdated: Date.now()
      });

      this.costTracking.set(provider.name, {
        models: provider.models,
        recentCosts: [], // Array of {timestamp, model, inputTokens, outputTokens, cost}
        averageCostPer1K: 0.001, // Default cost per 1K output tokens
        lastUpdated: Date.now()
      });

      this.reliabilityMetrics.set(provider.name, {
        reliabilityScore: 1.0,
        costEfficiency: 1.0,
        dynamicWeight: 1.0,
        lastCalculated: Date.now()
      });
    });
  }

  /**
   * Record a provider request event
   */
  recordProviderEvent(provider, success, responseTime, model = null, inputTokens = 0, outputTokens = 0) {
    const timestamp = Date.now();
    
    // Record uptime event
    const uptimeData = this.uptimeTracking.get(provider);
    if (uptimeData) {
      uptimeData.events.push({
        timestamp,
        status: success ? 'success' : 'failure',
        responseTime: responseTime || 0
      });
      
      uptimeData.totalRequests++;
      if (success) {
        uptimeData.successfulRequests++;
      }
      
      // Keep only events within the 24-hour window
      this.cleanupOldEvents(provider);
      
      // Update uptime percentage
      this.calculateUptime(provider);
      
      uptimeData.lastUpdated = timestamp;
    }

    // Record cost event if tokens provided
    if (model && (inputTokens > 0 || outputTokens > 0)) {
      this.recordCostEvent(provider, model, inputTokens, outputTokens, timestamp);
    }

    // Recalculate reliability metrics
    this.calculateReliabilityMetrics(provider);
  }

  /**
   * Record cost event for a specific model
   */
  recordCostEvent(provider, model, inputTokens, outputTokens, timestamp) {
    const costData = this.costTracking.get(provider);
    if (!costData) return;

    const modelConfig = costData.models[model];
    if (!modelConfig) {
      console.warn(`Unknown model ${model} for provider ${provider}`);
      return;
    }

    const inputCost = (inputTokens / 1000) * modelConfig.inputCost;
    const outputCost = (outputTokens / 1000) * modelConfig.outputCost;
    const totalCost = inputCost + outputCost;

    costData.recentCosts.push({
      timestamp,
      model,
      inputTokens,
      outputTokens,
      cost: totalCost
    });

    // Keep only recent cost data (last 24 hours)
    costData.recentCosts = costData.recentCosts.filter(
      event => timestamp - event.timestamp <= this.uptimeWindow
    );

    // Update average cost per 1K output tokens
    this.calculateAverageCost(provider);
    
    costData.lastUpdated = timestamp;
  }

  /**
   * Calculate 24-hour uptime percentage
   */
  calculateUptime(provider) {
    const uptimeData = this.uptimeTracking.get(provider);
    if (!uptimeData || uptimeData.events.length === 0) {
      uptimeData.currentUptime = 1.0; // Assume perfect uptime if no data
      return;
    }

    const now = Date.now();
    const recentEvents = uptimeData.events.filter(
      event => now - event.timestamp <= this.uptimeWindow
    );

    if (recentEvents.length === 0) {
      uptimeData.currentUptime = 1.0;
      return;
    }

    const successfulEvents = recentEvents.filter(event => event.status === 'success').length;
    uptimeData.currentUptime = successfulEvents / recentEvents.length;
  }

  /**
   * Calculate average cost per 1K output tokens
   */
  calculateAverageCost(provider) {
    const costData = this.costTracking.get(provider);
    if (!costData || costData.recentCosts.length === 0) {
      return;
    }

    let totalOutputTokens = 0;
    let totalCost = 0;

    costData.recentCosts.forEach(event => {
      totalOutputTokens += event.outputTokens;
      totalCost += event.cost;
    });

    if (totalOutputTokens > 0) {
      costData.averageCostPer1K = (totalCost / totalOutputTokens) * 1000;
    }
  }

  /**
   * Calculate dynamic reliability weight for a provider
   */
  calculateReliabilityMetrics(provider) {
    const uptimeData = this.uptimeTracking.get(provider);
    const costData = this.costTracking.get(provider);
    const reliabilityData = this.reliabilityMetrics.get(provider);

    if (!uptimeData || !costData || !reliabilityData) return;

    // Get calibrated confidence (this will be passed from the voting system)
    const calibratedConfidence = 0.8; // Default, will be overridden in actual calculation

    // Calculate cost efficiency factor (inverse of cost)
    const costEfficiencyFactor = costData.averageCostPer1K > 0 ? 
      (1 / costData.averageCostPer1K) : 1000; // High efficiency if cost is very low

    // Calculate uptime factor
    const uptimeFactor = uptimeData.currentUptime;

    // Calculate dynamic weight using the specified formula
    // weight = calibrated_confidence × (1 / cost_per_1k_output) × provider_uptime_24h
    const dynamicWeight = calibratedConfidence * costEfficiencyFactor * uptimeFactor;

    reliabilityData.reliabilityScore = uptimeFactor;
    reliabilityData.costEfficiency = costEfficiencyFactor;
    reliabilityData.dynamicWeight = dynamicWeight;
    reliabilityData.lastCalculated = Date.now();
  }

  /**
   * Get dynamic weight for a provider with calibrated confidence
   */
  getDynamicWeight(provider, calibratedConfidence = 0.8) {
    const uptimeData = this.uptimeTracking.get(provider);
    const costData = this.costTracking.get(provider);

    if (!uptimeData || !costData) {
      return 1.0; // Default weight
    }

    // Calculate cost efficiency factor (inverse of cost per 1K output tokens)
    const costEfficiencyFactor = costData.averageCostPer1K > 0 ? 
      (1 / costData.averageCostPer1K) : 1000;

    // Get 24-hour uptime
    const uptime24h = uptimeData.currentUptime;

    // Calculate dynamic weight: calibrated_confidence × (1 / cost_per_1k_output) × provider_uptime_24h
    const dynamicWeight = calibratedConfidence * costEfficiencyFactor * uptime24h;

    return dynamicWeight;
  }

  /**
   * Get all provider weights for normalization
   */
  getAllDynamicWeights(providerConfidences) {
    const weights = {};
    
    for (const [provider, calibratedConfidence] of Object.entries(providerConfidences)) {
      weights[provider] = this.getDynamicWeight(provider, calibratedConfidence);
    }

    return weights;
  }

  /**
   * Clean up old events outside the 24-hour window
   */
  cleanupOldEvents(provider) {
    const uptimeData = this.uptimeTracking.get(provider);
    if (!uptimeData) return;

    const now = Date.now();
    uptimeData.events = uptimeData.events.filter(
      event => now - event.timestamp <= this.uptimeWindow
    );

    // Limit history size
    if (uptimeData.events.length > this.maxHistorySize) {
      uptimeData.events = uptimeData.events.slice(-this.maxHistorySize);
    }
  }

  /**
   * Start periodic cleanup of old data
   */
  startPeriodicCleanup() {
    setInterval(() => {
      for (const provider of this.uptimeTracking.keys()) {
        this.cleanupOldEvents(provider);
        this.calculateUptime(provider);
        this.calculateAverageCost(provider);
      }
    }, 60 * 60 * 1000); // Clean up every hour
  }

  /**
   * Get provider statistics
   */
  getProviderStats(provider) {
    const uptimeData = this.uptimeTracking.get(provider);
    const costData = this.costTracking.get(provider);
    const reliabilityData = this.reliabilityMetrics.get(provider);

    if (!uptimeData || !costData || !reliabilityData) {
      return null;
    }

    return {
      provider,
      uptime: {
        current24h: uptimeData.currentUptime,
        totalRequests: uptimeData.totalRequests,
        successfulRequests: uptimeData.successfulRequests,
        recentEvents: uptimeData.events.length
      },
      cost: {
        averageCostPer1K: costData.averageCostPer1K,
        recentCostEvents: costData.recentCosts.length,
        supportedModels: Object.keys(costData.models)
      },
      reliability: {
        reliabilityScore: reliabilityData.reliabilityScore,
        costEfficiency: reliabilityData.costEfficiency,
        dynamicWeight: reliabilityData.dynamicWeight,
        lastCalculated: new Date(reliabilityData.lastCalculated).toISOString()
      }
    };
  }

  /**
   * Get all provider statistics
   */
  getAllProviderStats() {
    const stats = {};
    for (const provider of this.uptimeTracking.keys()) {
      stats[provider] = this.getProviderStats(provider);
    }
    return stats;
  }

  /**
   * Get service health status
   */
  getServiceHealth() {
    const totalProviders = this.uptimeTracking.size;
    let healthyProviders = 0;

    for (const [provider, uptimeData] of this.uptimeTracking.entries()) {
      if (uptimeData.currentUptime >= 0.95) { // 95% uptime threshold
        healthyProviders++;
      }
    }

    return {
      status: healthyProviders >= totalProviders * 0.8 ? 'healthy' : 'degraded',
      totalProviders,
      healthyProviders,
      uptimeThreshold: 0.95,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new ProviderReliabilityService();
