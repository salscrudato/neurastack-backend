/**
 * Fine-Tuned Model Service
 * Manages fine-tuned models, deployment tracking, and performance comparison
 */

const openai = require('../config/openai');
const admin = require('firebase-admin');

class FineTunedModelService {
  constructor() {
    this.fineTunedModels = new Map(); // Store fine-tuned model configurations
    this.modelPerformance = new Map(); // Track performance metrics
    this.deploymentHistory = []; // Track model deployments
    
    // Initialize with some example fine-tuned models
    this.initializeDefaultModels();
    
    // Performance tracking configuration
    this.performanceMetrics = {
      responseTime: [],
      quality: [],
      cost: [],
      errorRate: [],
      userSatisfaction: []
    };
  }

  /**
   * Initialize default fine-tuned models for testing
   */
  initializeDefaultModels() {
    const defaultModels = [
      {
        id: 'ft-neurastack-ensemble-v1',
        name: 'NeuraStack Ensemble Optimizer',
        baseModel: 'gpt-4o-mini',
        provider: 'openai',
        purpose: 'ensemble_synthesis',
        status: 'active',
        trainingData: 'ensemble_responses_v1',
        createdAt: new Date('2024-01-15'),
        metrics: {
          accuracy: 0.92,
          responseTime: 850,
          cost: 0.0015,
          userRating: 4.6
        }
      },
      {
        id: 'ft-neurastack-workout-v2',
        name: 'NeuraStack Workout Specialist',
        baseModel: 'gpt-4o-mini',
        provider: 'openai',
        purpose: 'workout_generation',
        status: 'active',
        trainingData: 'workout_plans_v2',
        createdAt: new Date('2024-02-01'),
        metrics: {
          accuracy: 0.89,
          responseTime: 920,
          cost: 0.0018,
          userRating: 4.4
        }
      },
      {
        id: 'ft-neurastack-memory-v1',
        name: 'NeuraStack Memory Synthesizer',
        baseModel: 'gpt-4o-mini',
        provider: 'openai',
        purpose: 'memory_synthesis',
        status: 'testing',
        trainingData: 'memory_contexts_v1',
        createdAt: new Date('2024-02-10'),
        metrics: {
          accuracy: 0.87,
          responseTime: 780,
          cost: 0.0012,
          userRating: 4.2
        }
      }
    ];

    for (const model of defaultModels) {
      this.fineTunedModels.set(model.id, model);
      this.modelPerformance.set(model.id, {
        totalRequests: Math.floor(Math.random() * 1000) + 100,
        successfulRequests: Math.floor(Math.random() * 950) + 90,
        averageResponseTime: model.metrics.responseTime,
        averageCost: model.metrics.cost,
        qualityScore: model.metrics.accuracy,
        lastUsed: new Date(),
        performanceHistory: this.generateMockPerformanceHistory()
      });
    }

    console.log('🤖 Initialized fine-tuned models for testing');
  }

  /**
   * Generate mock performance history for testing
   */
  generateMockPerformanceHistory() {
    const history = [];
    const now = Date.now();
    
    for (let i = 0; i < 30; i++) {
      const timestamp = now - (i * 24 * 60 * 60 * 1000); // Last 30 days
      history.push({
        date: new Date(timestamp).toISOString().split('T')[0],
        requests: Math.floor(Math.random() * 50) + 10,
        averageResponseTime: Math.floor(Math.random() * 200) + 700,
        successRate: 0.85 + Math.random() * 0.15,
        qualityScore: 0.8 + Math.random() * 0.2,
        cost: (Math.random() * 0.001) + 0.001
      });
    }
    
    return history.reverse();
  }

  /**
   * Get available fine-tuned models
   */
  getAvailableModels(purpose = null, status = 'active') {
    const models = Array.from(this.fineTunedModels.values());
    
    return models.filter(model => {
      const purposeMatch = !purpose || model.purpose === purpose;
      const statusMatch = !status || model.status === status;
      return purposeMatch && statusMatch;
    });
  }

  /**
   * Get model by ID
   */
  getModel(modelId) {
    return this.fineTunedModels.get(modelId);
  }

  /**
   * Get model performance metrics
   */
  getModelPerformance(modelId) {
    const model = this.fineTunedModels.get(modelId);
    const performance = this.modelPerformance.get(modelId);
    
    if (!model || !performance) {
      return null;
    }

    return {
      model: {
        id: model.id,
        name: model.name,
        purpose: model.purpose,
        status: model.status
      },
      performance: {
        ...performance,
        errorRate: 1 - (performance.successfulRequests / performance.totalRequests),
        costEfficiency: performance.qualityScore / performance.averageCost,
        reliability: performance.successfulRequests / performance.totalRequests
      }
    };
  }

  /**
   * Compare model performance
   */
  compareModels(modelIds) {
    const comparisons = [];
    
    for (const modelId of modelIds) {
      const performance = this.getModelPerformance(modelId);
      if (performance) {
        comparisons.push(performance);
      }
    }

    // Sort by overall score (weighted combination of metrics)
    comparisons.sort((a, b) => {
      const scoreA = this.calculateOverallScore(a.performance);
      const scoreB = this.calculateOverallScore(b.performance);
      return scoreB - scoreA;
    });

    return {
      models: comparisons,
      recommendation: comparisons[0]?.model.id || null,
      comparisonMetrics: {
        bestQuality: this.findBestMetric(comparisons, 'qualityScore'),
        fastestResponse: this.findBestMetric(comparisons, 'averageResponseTime', 'min'),
        mostCostEffective: this.findBestMetric(comparisons, 'costEfficiency'),
        mostReliable: this.findBestMetric(comparisons, 'reliability')
      }
    };
  }

  /**
   * Calculate overall performance score
   */
  calculateOverallScore(performance) {
    const weights = {
      quality: 0.3,
      speed: 0.2,
      cost: 0.2,
      reliability: 0.3
    };

    const normalizedSpeed = 1 - Math.min(performance.averageResponseTime / 2000, 1); // Normalize to 0-1
    
    return (
      (performance.qualityScore * weights.quality) +
      (normalizedSpeed * weights.speed) +
      (performance.costEfficiency * weights.cost) +
      (performance.reliability * weights.reliability)
    );
  }

  /**
   * Find best metric among models
   */
  findBestMetric(comparisons, metric, type = 'max') {
    if (comparisons.length === 0) return null;
    
    const best = comparisons.reduce((prev, current) => {
      const prevValue = prev.performance[metric];
      const currentValue = current.performance[metric];
      
      if (type === 'min') {
        return currentValue < prevValue ? current : prev;
      } else {
        return currentValue > prevValue ? current : prev;
      }
    });

    return {
      modelId: best.model.id,
      modelName: best.model.name,
      value: best.performance[metric]
    };
  }

  /**
   * Get recommended model for specific purpose
   */
  getRecommendedModel(purpose, userTier = 'free') {
    const availableModels = this.getAvailableModels(purpose);
    
    if (availableModels.length === 0) {
      return null;
    }

    // Filter by tier if needed
    const tierFilteredModels = availableModels.filter(model => {
      // For now, all fine-tuned models are available to all tiers
      // In production, you might want tier-specific models
      return true;
    });

    if (tierFilteredModels.length === 0) {
      return null;
    }

    // Get performance data and find best model
    const modelIds = tierFilteredModels.map(m => m.id);
    const comparison = this.compareModels(modelIds);
    
    return comparison.recommendation ? this.getModel(comparison.recommendation) : tierFilteredModels[0];
  }

  /**
   * Track model usage and performance
   */
  async trackModelUsage(modelId, responseTime, quality, cost, success = true) {
    const performance = this.modelPerformance.get(modelId);
    
    if (!performance) {
      console.warn(`Model ${modelId} not found for performance tracking`);
      return;
    }

    // Update performance metrics
    performance.totalRequests++;
    if (success) {
      performance.successfulRequests++;
    }

    // Update running averages
    performance.averageResponseTime = this.updateRunningAverage(
      performance.averageResponseTime,
      responseTime,
      performance.totalRequests
    );

    performance.averageCost = this.updateRunningAverage(
      performance.averageCost,
      cost,
      performance.totalRequests
    );

    performance.qualityScore = this.updateRunningAverage(
      performance.qualityScore,
      quality,
      performance.totalRequests
    );

    performance.lastUsed = new Date();

    // Add to daily performance history
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = performance.performanceHistory.find(entry => entry.date === today);
    
    if (todayEntry) {
      todayEntry.requests++;
      todayEntry.averageResponseTime = this.updateRunningAverage(
        todayEntry.averageResponseTime,
        responseTime,
        todayEntry.requests
      );
      todayEntry.successRate = success ? 
        this.updateRunningAverage(todayEntry.successRate, 1, todayEntry.requests) :
        this.updateRunningAverage(todayEntry.successRate, 0, todayEntry.requests);
    } else {
      performance.performanceHistory.push({
        date: today,
        requests: 1,
        averageResponseTime: responseTime,
        successRate: success ? 1 : 0,
        qualityScore: quality,
        cost: cost
      });

      // Keep only last 30 days
      if (performance.performanceHistory.length > 30) {
        performance.performanceHistory = performance.performanceHistory.slice(-30);
      }
    }

    console.log(`📊 Tracked usage for model ${modelId}: ${responseTime}ms, quality: ${quality.toFixed(2)}`);
  }

  /**
   * Update running average
   */
  updateRunningAverage(currentAverage, newValue, count) {
    return ((currentAverage * (count - 1)) + newValue) / count;
  }

  /**
   * Create new fine-tuned model (placeholder for actual fine-tuning)
   */
  async createFineTunedModel(config) {
    const {
      name,
      baseModel,
      purpose,
      trainingDataPath,
      hyperparameters = {}
    } = config;

    // In a real implementation, this would trigger actual fine-tuning
    const modelId = `ft-neurastack-${purpose}-${Date.now()}`;
    
    const newModel = {
      id: modelId,
      name,
      baseModel,
      provider: 'openai',
      purpose,
      status: 'training',
      trainingData: trainingDataPath,
      hyperparameters,
      createdAt: new Date(),
      metrics: {
        accuracy: 0,
        responseTime: 0,
        cost: 0,
        userRating: 0
      }
    };

    this.fineTunedModels.set(modelId, newModel);
    
    // Initialize performance tracking
    this.modelPerformance.set(modelId, {
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0,
      averageCost: 0,
      qualityScore: 0,
      lastUsed: null,
      performanceHistory: []
    });

    console.log(`🚀 Started fine-tuning model: ${modelId}`);
    
    return {
      modelId,
      status: 'training',
      estimatedCompletionTime: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    };
  }

  /**
   * Get fine-tuning status
   */
  getFineTuningStatus(modelId) {
    const model = this.fineTunedModels.get(modelId);
    
    if (!model) {
      return null;
    }

    return {
      modelId: model.id,
      name: model.name,
      status: model.status,
      createdAt: model.createdAt,
      purpose: model.purpose,
      baseModel: model.baseModel
    };
  }

  /**
   * Get service metrics
   */
  getServiceMetrics() {
    const models = Array.from(this.fineTunedModels.values());
    const activeModels = models.filter(m => m.status === 'active');
    const totalRequests = Array.from(this.modelPerformance.values())
      .reduce((sum, perf) => sum + perf.totalRequests, 0);

    return {
      totalModels: models.length,
      activeModels: activeModels.length,
      totalRequests,
      modelsByPurpose: models.reduce((acc, model) => {
        acc[model.purpose] = (acc[model.purpose] || 0) + 1;
        return acc;
      }, {}),
      averageQuality: activeModels.reduce((sum, model) => {
        const perf = this.modelPerformance.get(model.id);
        return sum + (perf?.qualityScore || 0);
      }, 0) / activeModels.length || 0
    };
  }
}

module.exports = new FineTunedModelService();
