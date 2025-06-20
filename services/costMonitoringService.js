/**
 * Cost Monitoring and Dynamic Model Selection Service
 * Tracks API costs, model performance, and automatically optimizes model selection
 */

const fs = require('fs').promises;
const path = require('path');

class CostMonitoringService {
  constructor() {
    this.costData = {
      daily: new Map(),
      hourly: new Map(),
      modelPerformance: new Map(),
      totalCosts: {
        today: 0,
        thisHour: 0,
        thisMonth: 0
      }
    };

    // Model performance tracking
    this.modelMetrics = new Map();
    
    // Cost thresholds and alerts
    this.thresholds = {
      dailyLimit: parseFloat(process.env.DAILY_COST_LIMIT) || 10.0,
      hourlyLimit: parseFloat(process.env.HOURLY_COST_LIMIT) || 2.0,
      monthlyLimit: parseFloat(process.env.MONTHLY_COST_LIMIT) || 200.0
    };

    // Dynamic model selection configuration
    this.modelSelection = {
      enabled: process.env.DYNAMIC_MODEL_SELECTION === 'true',
      performanceWindow: 24 * 60 * 60 * 1000, // 24 hours
      minSampleSize: 10,
      costEfficiencyThreshold: 0.8
    };

    this.dataFile = path.join(__dirname, '../data/cost-monitoring.json');
    this.loadPersistedData();
    this.startPeriodicTasks();
  }

  /**
   * Track API call cost and performance
   */
  async trackAPICall(modelConfig, promptTokens, responseTokens, responseTime, quality, userId = null) {
    const timestamp = Date.now();
    const cost = this.calculateCost(modelConfig, promptTokens, responseTokens);
    
    // Update cost tracking
    this.updateCostTracking(cost, timestamp);
    
    // Update model performance metrics
    this.updateModelMetrics(modelConfig, {
      cost,
      responseTime,
      quality,
      promptTokens,
      responseTokens,
      timestamp,
      userId
    });

    // Check for cost alerts
    await this.checkCostAlerts(cost);

    // Log the API call
    console.log(`💰 API Call Tracked: ${modelConfig.model} - $${cost.toFixed(6)} (${responseTime}ms, Q:${quality.toFixed(2)})`);

    return {
      cost,
      totalDailyCost: this.costData.totalCosts.today,
      totalHourlyCost: this.costData.totalCosts.thisHour,
      modelRecommendation: this.getModelRecommendation(modelConfig.provider)
    };
  }

  /**
   * Calculate cost for API call
   */
  calculateCost(modelConfig, promptTokens, responseTokens) {
    const costMap = {
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4o': { input: 0.005, output: 0.015 },
      'o1-preview': { input: 0.015, output: 0.06 },
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
      'gemini-2.0-flash': { input: 0.001, output: 0.004 },
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
      'claude-opus-4-20250514': { input: 0.015, output: 0.075 }
    };

    const modelCosts = costMap[modelConfig.model];
    if (!modelCosts) {
      console.warn(`⚠️ Unknown model cost: ${modelConfig.model}`);
      return 0;
    }

    const inputCost = (promptTokens / 1000) * modelCosts.input;
    const outputCost = (responseTokens / 1000) * modelCosts.output;
    
    return inputCost + outputCost;
  }

  /**
   * Update cost tracking data
   */
  updateCostTracking(cost, timestamp) {
    const now = new Date(timestamp);
    const dayKey = now.toISOString().split('T')[0];
    const hourKey = `${dayKey}-${now.getHours()}`;

    // Update daily costs
    if (!this.costData.daily.has(dayKey)) {
      this.costData.daily.set(dayKey, 0);
    }
    this.costData.daily.set(dayKey, this.costData.daily.get(dayKey) + cost);

    // Update hourly costs
    if (!this.costData.hourly.has(hourKey)) {
      this.costData.hourly.set(hourKey, 0);
    }
    this.costData.hourly.set(hourKey, this.costData.hourly.get(hourKey) + cost);

    // Update totals
    this.costData.totalCosts.today = this.costData.daily.get(dayKey) || 0;
    this.costData.totalCosts.thisHour = this.costData.hourly.get(hourKey) || 0;
  }

  /**
   * Update model performance metrics
   */
  updateModelMetrics(modelConfig, metrics) {
    const modelKey = `${modelConfig.provider}-${modelConfig.model}`;
    
    if (!this.modelMetrics.has(modelKey)) {
      this.modelMetrics.set(modelKey, {
        calls: 0,
        totalCost: 0,
        totalResponseTime: 0,
        totalQuality: 0,
        averageCost: 0,
        averageResponseTime: 0,
        averageQuality: 0,
        costEfficiency: 0,
        lastUpdated: Date.now(),
        samples: []
      });
    }

    const modelData = this.modelMetrics.get(modelKey);
    modelData.calls++;
    modelData.totalCost += metrics.cost;
    modelData.totalResponseTime += metrics.responseTime;
    modelData.totalQuality += metrics.quality;
    
    // Calculate averages
    modelData.averageCost = modelData.totalCost / modelData.calls;
    modelData.averageResponseTime = modelData.totalResponseTime / modelData.calls;
    modelData.averageQuality = modelData.totalQuality / modelData.calls;
    
    // Calculate cost efficiency (quality per dollar)
    modelData.costEfficiency = modelData.averageQuality / (modelData.averageCost * 1000);
    
    modelData.lastUpdated = Date.now();

    // Keep recent samples for trend analysis
    modelData.samples.push({
      timestamp: metrics.timestamp,
      cost: metrics.cost,
      responseTime: metrics.responseTime,
      quality: metrics.quality
    });

    // Keep only recent samples (last 24 hours)
    const cutoff = Date.now() - this.modelSelection.performanceWindow;
    modelData.samples = modelData.samples.filter(sample => sample.timestamp > cutoff);
  }

  /**
   * Get model recommendation based on performance and cost
   */
  getModelRecommendation(currentProvider) {
    if (!this.modelSelection.enabled) {
      return null;
    }

    const recommendations = [];
    
    for (const [modelKey, metrics] of this.modelMetrics.entries()) {
      if (metrics.calls >= this.modelSelection.minSampleSize) {
        recommendations.push({
          model: modelKey,
          costEfficiency: metrics.costEfficiency,
          averageQuality: metrics.averageQuality,
          averageCost: metrics.averageCost,
          averageResponseTime: metrics.averageResponseTime
        });
      }
    }

    // Sort by cost efficiency (quality per dollar)
    recommendations.sort((a, b) => b.costEfficiency - a.costEfficiency);

    if (recommendations.length > 0) {
      const best = recommendations[0];
      const current = recommendations.find(r => r.model.includes(currentProvider));
      
      if (current && best.costEfficiency > current.costEfficiency * 1.2) {
        return {
          recommended: best.model,
          reason: 'Higher cost efficiency',
          improvement: `${((best.costEfficiency / current.costEfficiency - 1) * 100).toFixed(1)}% better cost efficiency`
        };
      }
    }

    return null;
  }

  /**
   * Check for cost alerts and thresholds
   */
  async checkCostAlerts(newCost) {
    const alerts = [];

    // Check hourly limit
    if (this.costData.totalCosts.thisHour > this.thresholds.hourlyLimit) {
      alerts.push({
        type: 'hourly_limit_exceeded',
        current: this.costData.totalCosts.thisHour,
        limit: this.thresholds.hourlyLimit,
        severity: 'warning'
      });
    }

    // Check daily limit
    if (this.costData.totalCosts.today > this.thresholds.dailyLimit) {
      alerts.push({
        type: 'daily_limit_exceeded',
        current: this.costData.totalCosts.today,
        limit: this.thresholds.dailyLimit,
        severity: 'critical'
      });
    }

    // Log alerts
    for (const alert of alerts) {
      console.warn(`🚨 Cost Alert: ${alert.type} - $${alert.current.toFixed(4)} exceeds limit of $${alert.limit}`);
    }

    // Trigger real-time alerts if alert engine is available
    try {
      const realTimeAlertEngine = require('./realTimeAlertEngine');
      if (realTimeAlertEngine && realTimeAlertEngine.isRunning) {
        // The alert engine will pick up these metrics in its next evaluation cycle
        // No need to manually trigger here as it's handled by the monitoring loop
      }
    } catch (error) {
      // Alert engine not available, continue with legacy alerting
    }

    return alerts;
  }

  /**
   * Get comprehensive cost and performance report
   */
  getReport() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Calculate model rankings
    const modelRankings = Array.from(this.modelMetrics.entries())
      .filter(([_, metrics]) => metrics.calls >= this.modelSelection.minSampleSize)
      .map(([model, metrics]) => ({
        model,
        ...metrics,
        rank: 0
      }))
      .sort((a, b) => b.costEfficiency - a.costEfficiency)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      timestamp: now.toISOString(),
      costs: {
        today: this.costData.totalCosts.today,
        thisHour: this.costData.totalCosts.thisHour,
        dailyLimit: this.thresholds.dailyLimit,
        hourlyLimit: this.thresholds.hourlyLimit,
        utilizationPercent: {
          daily: (this.costData.totalCosts.today / this.thresholds.dailyLimit * 100).toFixed(1),
          hourly: (this.costData.totalCosts.thisHour / this.thresholds.hourlyLimit * 100).toFixed(1)
        }
      },
      modelPerformance: modelRankings,
      recommendations: this.getTopRecommendations(),
      settings: {
        dynamicSelectionEnabled: this.modelSelection.enabled,
        thresholds: this.thresholds
      }
    };
  }

  /**
   * Get cost data for alert engine
   */
  getCostData() {
    return {
      totalCosts: this.costData.totalCosts,
      thresholds: this.thresholds,
      utilizationPercent: {
        daily: (this.costData.totalCosts.today / this.thresholds.dailyLimit * 100),
        hourly: (this.costData.totalCosts.thisHour / this.thresholds.hourlyLimit * 100)
      }
    };
  }

  /**
   * Get top model recommendations
   */
  getTopRecommendations() {
    const recommendations = [];
    
    for (const [modelKey, metrics] of this.modelMetrics.entries()) {
      if (metrics.calls >= this.modelSelection.minSampleSize) {
        recommendations.push({
          model: modelKey,
          costEfficiency: metrics.costEfficiency,
          recommendation: this.generateRecommendation(metrics)
        });
      }
    }

    return recommendations
      .sort((a, b) => b.costEfficiency - a.costEfficiency)
      .slice(0, 3);
  }

  /**
   * Generate recommendation text for a model
   */
  generateRecommendation(metrics) {
    if (metrics.costEfficiency > 100) {
      return 'Excellent cost efficiency - highly recommended';
    } else if (metrics.costEfficiency > 50) {
      return 'Good cost efficiency - recommended for most use cases';
    } else if (metrics.costEfficiency > 20) {
      return 'Moderate cost efficiency - consider for quality-critical tasks';
    } else {
      return 'Low cost efficiency - use sparingly';
    }
  }

  /**
   * Load persisted cost data
   */
  async loadPersistedData() {
    try {
      const data = await fs.readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(data);
      
      // Restore Maps from serialized data
      if (parsed.daily) {
        this.costData.daily = new Map(Object.entries(parsed.daily));
      }
      if (parsed.hourly) {
        this.costData.hourly = new Map(Object.entries(parsed.hourly));
      }
      if (parsed.modelMetrics) {
        this.modelMetrics = new Map(Object.entries(parsed.modelMetrics));
      }
      if (parsed.totalCosts) {
        this.costData.totalCosts = parsed.totalCosts;
      }

      console.log('✅ Cost monitoring data loaded from disk');
    } catch (error) {
      console.log('📝 No existing cost data found, starting fresh');
    }
  }

  /**
   * Persist cost data to disk
   */
  async persistData() {
    try {
      const dataToSave = {
        daily: Object.fromEntries(this.costData.daily),
        hourly: Object.fromEntries(this.costData.hourly),
        modelMetrics: Object.fromEntries(this.modelMetrics),
        totalCosts: this.costData.totalCosts,
        lastSaved: new Date().toISOString()
      };

      // Ensure data directory exists
      await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
      await fs.writeFile(this.dataFile, JSON.stringify(dataToSave, null, 2));
      
      console.log('💾 Cost monitoring data persisted to disk');
    } catch (error) {
      console.error('❌ Failed to persist cost data:', error.message);
    }
  }

  /**
   * Start periodic tasks
   */
  startPeriodicTasks() {
    // Save data every 5 minutes
    setInterval(() => {
      this.persistData();
    }, 5 * 60 * 1000);

    // Clean old data every hour
    setInterval(() => {
      this.cleanOldData();
    }, 60 * 60 * 1000);

    // Generate daily reports
    setInterval(() => {
      this.generateDailyReport();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Clean old data to prevent memory leaks
   */
  cleanOldData() {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    const cutoffDate = new Date(cutoff).toISOString().split('T')[0];

    // Clean old daily data
    for (const [key] of this.costData.daily.entries()) {
      if (key < cutoffDate) {
        this.costData.daily.delete(key);
      }
    }

    // Clean old hourly data
    for (const [key] of this.costData.hourly.entries()) {
      if (key < cutoffDate) {
        this.costData.hourly.delete(key);
      }
    }

    console.log('🧹 Cleaned old cost monitoring data');
  }

  /**
   * Generate daily cost report
   */
  generateDailyReport() {
    const report = this.getReport();
    console.log('📊 Daily Cost Report:', {
      totalCost: `$${report.costs.today.toFixed(4)}`,
      dailyUtilization: `${report.costs.utilizationPercent.daily}%`,
      topModel: report.modelPerformance[0]?.model || 'N/A',
      recommendations: report.recommendations.length
    });
  }
}

// Create singleton instance
const costMonitoringService = new CostMonitoringService();

module.exports = costMonitoringService;
