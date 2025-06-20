/**
 * Context Quality Monitoring Service
 * Tracks context effectiveness, token efficiency, and response quality
 */

const ContentAnalyzer = require('./contentAnalysis');
const { getCacheService } = require('./cacheService');

class ContextQualityMonitoring {
  constructor() {
    this.contentAnalyzer = new ContentAnalyzer();
    this.cacheService = getCacheService();
    
    // Metrics storage
    this.metrics = {
      contextGeneration: new Map(),
      tokenEfficiency: new Map(),
      responseQuality: new Map(),
      userSatisfaction: new Map(),
      systemPerformance: new Map()
    };

    // Quality thresholds
    this.thresholds = {
      tokenEfficiency: 0.7,
      contextRelevance: 0.6,
      responseQuality: 0.7,
      processingTime: 2000, // 2 seconds
      cacheHitRate: 0.4
    };

    // Monitoring configuration
    this.config = {
      metricsRetentionDays: 30,
      alertThresholds: {
        lowEfficiency: 0.5,
        highLatency: 5000,
        lowCacheHit: 0.2
      },
      reportingInterval: 3600000 // 1 hour
    };

    // Start periodic reporting
    this.startPeriodicReporting();
  }

  /**
   * Record context generation metrics
   * @param {Object} contextData 
   */
  recordContextGeneration(contextData) {
    try {
      const {
        userId,
        sessionId,
        requestId,
        contextResult,
        processingTime,
        cacheHit = false,
        userTier = 'free'
      } = contextData;

      const timestamp = Date.now();
      const metrics = {
        timestamp,
        userId,
        sessionId,
        requestId,
        userTier,
        tokensGenerated: contextResult.totalTokens || 0,
        tokensRequested: contextResult.optimization?.targetTokens || 0,
        efficiency: contextResult.optimization?.efficiency || 0,
        sectionsIncluded: contextResult.optimization?.sectionsIncluded || 0,
        processingTime,
        cacheHit,
        strategy: contextResult.optimization?.strategy || 'unknown',
        compressionRatio: this.calculateAverageCompressionRatio(contextResult),
        qualityScore: this.calculateContextQualityScore(contextResult)
      };

      this.metrics.contextGeneration.set(requestId, metrics);
      
      // Clean old metrics
      this.cleanOldMetrics('contextGeneration');
      
      console.log(`📊 Context metrics recorded: ${metrics.tokensGenerated} tokens, ${Math.round(metrics.efficiency * 100)}% efficiency`);

    } catch (error) {
      console.error('❌ Failed to record context generation metrics:', error);
    }
  }

  /**
   * Record token efficiency metrics
   * @param {Object} efficiencyData 
   */
  recordTokenEfficiency(efficiencyData) {
    try {
      const {
        requestId,
        modelUsed,
        tokensUsed,
        tokensAvailable,
        responseLength,
        contextUtilization,
        wasteRatio = 0
      } = efficiencyData;

      const timestamp = Date.now();
      const efficiency = tokensUsed / tokensAvailable;
      const responsePerToken = responseLength / tokensUsed;

      const metrics = {
        timestamp,
        requestId,
        modelUsed,
        tokensUsed,
        tokensAvailable,
        efficiency,
        responseLength,
        responsePerToken,
        contextUtilization,
        wasteRatio,
        efficiencyRating: this.rateEfficiency(efficiency)
      };

      this.metrics.tokenEfficiency.set(requestId, metrics);
      this.cleanOldMetrics('tokenEfficiency');

      console.log(`⚡ Token efficiency: ${Math.round(efficiency * 100)}% (${metrics.efficiencyRating})`);

    } catch (error) {
      console.error('❌ Failed to record token efficiency metrics:', error);
    }
  }

  /**
   * Record response quality metrics
   * @param {Object} qualityData 
   */
  recordResponseQuality(qualityData) {
    try {
      const {
        requestId,
        userPrompt,
        contextUsed,
        aiResponse,
        userFeedback = null,
        relevanceScore = null,
        coherenceScore = null,
        completenessScore = null
      } = qualityData;

      const timestamp = Date.now();
      
      // Calculate automatic quality scores
      const autoScores = this.calculateAutomaticQualityScores(userPrompt, contextUsed, aiResponse);
      
      const metrics = {
        timestamp,
        requestId,
        promptLength: userPrompt.length,
        contextLength: contextUsed.length,
        responseLength: aiResponse.length,
        userFeedback,
        relevanceScore: relevanceScore || autoScores.relevance,
        coherenceScore: coherenceScore || autoScores.coherence,
        completenessScore: completenessScore || autoScores.completeness,
        overallQuality: this.calculateOverallQuality(autoScores, userFeedback),
        contextContribution: this.assessContextContribution(userPrompt, contextUsed, aiResponse)
      };

      this.metrics.responseQuality.set(requestId, metrics);
      this.cleanOldMetrics('responseQuality');

      console.log(`🎯 Response quality: ${Math.round(metrics.overallQuality * 100)}% (context contribution: ${Math.round(metrics.contextContribution * 100)}%)`);

    } catch (error) {
      console.error('❌ Failed to record response quality metrics:', error);
    }
  }

  /**
   * Record user satisfaction metrics
   * @param {Object} satisfactionData 
   */
  recordUserSatisfaction(satisfactionData) {
    try {
      const {
        userId,
        sessionId,
        requestId,
        satisfactionRating, // 1-5 scale
        feedbackText = '',
        contextHelpfulness = null,
        responseAccuracy = null,
        followUpQuestions = 0
      } = satisfactionData;

      const timestamp = Date.now();
      const metrics = {
        timestamp,
        userId,
        sessionId,
        requestId,
        satisfactionRating,
        feedbackText,
        contextHelpfulness,
        responseAccuracy,
        followUpQuestions,
        satisfactionLevel: this.categorizeSatisfaction(satisfactionRating)
      };

      this.metrics.userSatisfaction.set(requestId, metrics);
      this.cleanOldMetrics('userSatisfaction');

      console.log(`😊 User satisfaction: ${satisfactionRating}/5 (${metrics.satisfactionLevel})`);

    } catch (error) {
      console.error('❌ Failed to record user satisfaction metrics:', error);
    }
  }

  /**
   * Record system performance metrics
   * @param {Object} performanceData 
   */
  recordSystemPerformance(performanceData) {
    try {
      const {
        requestId,
        totalProcessingTime,
        contextGenerationTime,
        aiProcessingTime,
        cacheHitRate,
        memoryUsage,
        errorRate = 0
      } = performanceData;

      const timestamp = Date.now();
      const metrics = {
        timestamp,
        requestId,
        totalProcessingTime,
        contextGenerationTime,
        aiProcessingTime,
        cacheHitRate,
        memoryUsage,
        errorRate,
        performanceRating: this.ratePerformance(totalProcessingTime)
      };

      this.metrics.systemPerformance.set(requestId, metrics);
      this.cleanOldMetrics('systemPerformance');

      console.log(`⚡ System performance: ${totalProcessingTime}ms (${metrics.performanceRating})`);

    } catch (error) {
      console.error('❌ Failed to record system performance metrics:', error);
    }
  }

  /**
   * Generate comprehensive quality report
   * @param {Object} options 
   * @returns {Object}
   */
  generateQualityReport(options = {}) {
    try {
      const {
        timeRange = 24 * 60 * 60 * 1000, // 24 hours
        userId = null,
        userTier = null
      } = options;

      const cutoffTime = Date.now() - timeRange;
      
      // Filter metrics by time range and criteria
      const filteredMetrics = this.filterMetrics(cutoffTime, userId, userTier);
      
      const report = {
        generatedAt: new Date(),
        timeRange: timeRange / (60 * 60 * 1000), // Convert to hours
        totalRequests: filteredMetrics.contextGeneration.length,
        
        // Context generation metrics
        contextGeneration: this.analyzeContextGeneration(filteredMetrics.contextGeneration),
        
        // Token efficiency metrics
        tokenEfficiency: this.analyzeTokenEfficiency(filteredMetrics.tokenEfficiency),
        
        // Response quality metrics
        responseQuality: this.analyzeResponseQuality(filteredMetrics.responseQuality),
        
        // User satisfaction metrics
        userSatisfaction: this.analyzeUserSatisfaction(filteredMetrics.userSatisfaction),
        
        // System performance metrics
        systemPerformance: this.analyzeSystemPerformance(filteredMetrics.systemPerformance),
        
        // Overall health score
        overallHealth: this.calculateOverallHealth(filteredMetrics),
        
        // Recommendations
        recommendations: this.generateRecommendations(filteredMetrics)
      };

      console.log(`📋 Quality report generated: ${report.totalRequests} requests, ${Math.round(report.overallHealth * 100)}% health`);
      
      return report;

    } catch (error) {
      console.error('❌ Failed to generate quality report:', error);
      return { error: error.message };
    }
  }

  /**
   * Get real-time quality metrics
   * @returns {Object}
   */
  getRealTimeMetrics() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentMetrics = this.filterMetrics(oneHourAgo);
    
    return {
      timestamp: now,
      activeRequests: recentMetrics.contextGeneration.length,
      averageProcessingTime: this.calculateAverage(recentMetrics.systemPerformance, 'totalProcessingTime'),
      averageTokenEfficiency: this.calculateAverage(recentMetrics.tokenEfficiency, 'efficiency'),
      averageQualityScore: this.calculateAverage(recentMetrics.responseQuality, 'overallQuality'),
      cacheHitRate: this.calculateAverage(recentMetrics.systemPerformance, 'cacheHitRate'),
      errorRate: this.calculateAverage(recentMetrics.systemPerformance, 'errorRate'),
      alerts: this.checkAlerts(recentMetrics)
    };
  }

  /**
   * Calculate context quality score
   * @param {Object} contextResult 
   * @returns {number}
   */
  calculateContextQualityScore(contextResult) {
    let score = 0.5; // Base score

    // Efficiency factor
    if (contextResult.optimization?.efficiency) {
      score += contextResult.optimization.efficiency * 0.3;
    }

    // Section completeness
    if (contextResult.optimization?.sectionsIncluded) {
      score += Math.min(contextResult.optimization.sectionsIncluded / 5, 1) * 0.2;
    }

    // Token utilization
    if (contextResult.totalTokens && contextResult.optimization?.targetTokens) {
      const utilization = contextResult.totalTokens / contextResult.optimization.targetTokens;
      score += Math.min(utilization, 1) * 0.3;
    }

    // Strategy bonus
    if (contextResult.optimization?.strategy === 'dynamic_optimization') {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate average compression ratio
   * @param {Object} contextResult 
   * @returns {number}
   */
  calculateAverageCompressionRatio(contextResult) {
    if (!contextResult.optimization?.compressionStrategies) return 1.0;

    const strategies = contextResult.optimization.compressionStrategies;
    const ratios = Object.values(strategies)
      .filter(strategy => strategy !== 'no_compression')
      .length;

    return ratios > 0 ? 0.7 : 1.0; // Simplified calculation
  }

  /**
   * Calculate automatic quality scores
   * @param {string} prompt 
   * @param {string} context 
   * @param {string} response 
   * @returns {Object}
   */
  calculateAutomaticQualityScores(prompt, context, response) {
    // Simplified quality scoring
    const promptAnalysis = this.contentAnalyzer.analyzeContent(prompt, true);
    const responseAnalysis = this.contentAnalyzer.analyzeContent(response, true);

    // Relevance: concept overlap between prompt and response
    const promptConcepts = new Set(promptAnalysis.concepts || []);
    const responseConcepts = new Set(responseAnalysis.concepts || []);
    const conceptOverlap = [...promptConcepts].filter(x => responseConcepts.has(x)).length;
    const relevance = Math.min(conceptOverlap / Math.max(promptConcepts.size, 1), 1);

    // Coherence: response structure and flow
    const coherence = Math.min(response.length / 100, 1) * 0.8; // Simplified

    // Completeness: response addresses prompt comprehensively
    const completeness = Math.min(responseConcepts.size / Math.max(promptConcepts.size, 1), 1);

    return { relevance, coherence, completeness };
  }

  /**
   * Calculate overall quality from scores and feedback
   * @param {Object} autoScores 
   * @param {number} userFeedback 
   * @returns {number}
   */
  calculateOverallQuality(autoScores, userFeedback) {
    const autoQuality = (autoScores.relevance + autoScores.coherence + autoScores.completeness) / 3;
    
    if (userFeedback !== null) {
      // Weight user feedback more heavily
      return (autoQuality * 0.4) + ((userFeedback / 5) * 0.6);
    }
    
    return autoQuality;
  }

  /**
   * Assess context contribution to response quality
   * @param {string} prompt 
   * @param {string} context 
   * @param {string} response 
   * @returns {number}
   */
  assessContextContribution(prompt, context, response) {
    if (!context || context.length === 0) return 0;

    // Simplified: check if context concepts appear in response
    const contextAnalysis = this.contentAnalyzer.analyzeContent(context, true);
    const responseAnalysis = this.contentAnalyzer.analyzeContent(response, true);

    const contextConcepts = new Set(contextAnalysis.concepts || []);
    const responseConcepts = new Set(responseAnalysis.concepts || []);
    
    const contextUsage = [...contextConcepts].filter(x => responseConcepts.has(x)).length;
    
    return Math.min(contextUsage / Math.max(contextConcepts.size, 1), 1);
  }

  /**
   * Rate efficiency level
   * @param {number} efficiency 
   * @returns {string}
   */
  rateEfficiency(efficiency) {
    if (efficiency >= 0.8) return 'excellent';
    if (efficiency >= 0.6) return 'good';
    if (efficiency >= 0.4) return 'fair';
    return 'poor';
  }

  /**
   * Rate performance level
   * @param {number} processingTime 
   * @returns {string}
   */
  ratePerformance(processingTime) {
    if (processingTime <= 1000) return 'excellent';
    if (processingTime <= 2000) return 'good';
    if (processingTime <= 5000) return 'fair';
    return 'poor';
  }

  /**
   * Categorize satisfaction level
   * @param {number} rating 
   * @returns {string}
   */
  categorizeSatisfaction(rating) {
    if (rating >= 4.5) return 'very_satisfied';
    if (rating >= 3.5) return 'satisfied';
    if (rating >= 2.5) return 'neutral';
    if (rating >= 1.5) return 'dissatisfied';
    return 'very_dissatisfied';
  }

  /**
   * Clean old metrics beyond retention period
   * @param {string} metricType 
   */
  cleanOldMetrics(metricType) {
    const cutoffTime = Date.now() - (this.config.metricsRetentionDays * 24 * 60 * 60 * 1000);
    const metrics = this.metrics[metricType];
    
    for (const [key, value] of metrics.entries()) {
      if (value.timestamp < cutoffTime) {
        metrics.delete(key);
      }
    }
  }

  /**
   * Start periodic reporting
   */
  startPeriodicReporting() {
    setInterval(() => {
      const realTimeMetrics = this.getRealTimeMetrics();
      console.log(`📊 Hourly metrics: ${realTimeMetrics.activeRequests} requests, ${Math.round(realTimeMetrics.averageTokenEfficiency * 100)}% efficiency`);
      
      // Check for alerts
      if (realTimeMetrics.alerts.length > 0) {
        console.warn(`🚨 Quality alerts: ${realTimeMetrics.alerts.join(', ')}`);
      }
    }, this.config.reportingInterval);
  }

  // Additional helper methods would be implemented here...
  filterMetrics(cutoffTime, userId = null, userTier = null) {
    // Simplified implementation
    return {
      contextGeneration: Array.from(this.metrics.contextGeneration.values()).filter(m => m.timestamp >= cutoffTime),
      tokenEfficiency: Array.from(this.metrics.tokenEfficiency.values()).filter(m => m.timestamp >= cutoffTime),
      responseQuality: Array.from(this.metrics.responseQuality.values()).filter(m => m.timestamp >= cutoffTime),
      userSatisfaction: Array.from(this.metrics.userSatisfaction.values()).filter(m => m.timestamp >= cutoffTime),
      systemPerformance: Array.from(this.metrics.systemPerformance.values()).filter(m => m.timestamp >= cutoffTime)
    };
  }

  calculateAverage(metrics, field) {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + (m[field] || 0), 0) / metrics.length;
  }

  checkAlerts(metrics) {
    const alerts = [];
    
    const avgEfficiency = this.calculateAverage(metrics.tokenEfficiency, 'efficiency');
    if (avgEfficiency < this.config.alertThresholds.lowEfficiency) {
      alerts.push('low_token_efficiency');
    }
    
    const avgLatency = this.calculateAverage(metrics.systemPerformance, 'totalProcessingTime');
    if (avgLatency > this.config.alertThresholds.highLatency) {
      alerts.push('high_latency');
    }
    
    return alerts;
  }

  // Placeholder methods for analysis functions
  analyzeContextGeneration(metrics) { return { average: this.calculateAverage(metrics, 'efficiency') }; }
  analyzeTokenEfficiency(metrics) { return { average: this.calculateAverage(metrics, 'efficiency') }; }
  analyzeResponseQuality(metrics) { return { average: this.calculateAverage(metrics, 'overallQuality') }; }
  analyzeUserSatisfaction(metrics) { return { average: this.calculateAverage(metrics, 'satisfactionRating') }; }
  analyzeSystemPerformance(metrics) { return { average: this.calculateAverage(metrics, 'totalProcessingTime') }; }
  calculateOverallHealth(metrics) { return 0.8; } // Simplified
  generateRecommendations(metrics) { return ['Optimize token usage', 'Improve cache hit rate']; }
}

// Singleton instance
let contextQualityMonitoringInstance = null;

/**
 * Get the singleton instance of ContextQualityMonitoring
 * @returns {ContextQualityMonitoring}
 */
function getContextQualityMonitoring() {
  if (!contextQualityMonitoringInstance) {
    contextQualityMonitoringInstance = new ContextQualityMonitoring();
  }
  return contextQualityMonitoringInstance;
}

module.exports = { ContextQualityMonitoring, getContextQualityMonitoring };
