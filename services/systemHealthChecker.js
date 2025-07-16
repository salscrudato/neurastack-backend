/**
 * 🏥 System Health Checker - Comprehensive health monitoring for NeuraStack AI Ensemble
 *
 * 🎯 PURPOSE: Centralized health checking system that monitors all services,
 *            error handlers, circuit breakers, and system performance
 *
 * 📋 KEY FEATURES:
 * 1. Service-specific health checks
 * 2. Circuit breaker status monitoring
 * 3. Error rate analysis
 * 4. Performance metrics evaluation
 * 5. Vendor API availability checks
 * 6. System recovery recommendations
 */

const { errorHandler } = require('../utils/errorHandler');
const monitoringService = require('./monitoringService');
const enhancedSynthesisService = require('./enhancedSynthesisService');
const sophisticatedVotingService = require('./sophisticatedVotingService');
const postSynthesisValidator = require('./postSynthesisValidator');
const vendorClients = require('./vendorClients');
const enhancedEnsembleRunner = require('./enhancedEnsembleRunner');

class SystemHealthChecker {
  constructor() {
    this.healthCheckInterval = null;
    this.lastHealthCheck = null;
    this.healthHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Perform comprehensive system health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    const healthReport = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      services: {},
      circuitBreakers: {},
      errorRates: {},
      performance: {},
      recommendations: [],
      processingTime: 0
    };

    try {
      // Check individual services
      healthReport.services = await this.checkAllServices();
      
      // Check circuit breaker status
      healthReport.circuitBreakers = this.checkCircuitBreakers();
      
      // Analyze error rates
      healthReport.errorRates = this.analyzeErrorRates();
      
      // Check performance metrics
      healthReport.performance = this.checkPerformanceMetrics();
      
      // Generate recommendations
      healthReport.recommendations = this.generateRecommendations(healthReport);
      
      // Determine overall health
      healthReport.overall = this.determineOverallHealth(healthReport);
      
      healthReport.processingTime = Date.now() - startTime;
      
      // Store in history
      this.updateHealthHistory(healthReport);
      this.lastHealthCheck = healthReport;
      
      return healthReport;
      
    } catch (error) {
      healthReport.overall = 'critical';
      healthReport.error = error.message;
      healthReport.processingTime = Date.now() - startTime;
      
      monitoringService.log('error', 'System health check failed', {
        error: error.message,
        processingTime: healthReport.processingTime
      });
      
      return healthReport;
    }
  }

  /**
   * Check health of all services
   */
  async checkAllServices() {
    const services = {};
    
    // Enhanced Synthesis Service
    try {
      const synthesisHealth = await enhancedSynthesisService.healthCheck();
      services.synthesis = {
        status: synthesisHealth.status || 'healthy',
        metrics: synthesisHealth.metrics || {},
        circuitBreaker: synthesisHealth.circuitBreaker || { state: 'CLOSED' }
      };
    } catch (error) {
      services.synthesis = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Sophisticated Voting Service
    try {
      const votingStats = sophisticatedVotingService.getVotingStats();
      services.voting = {
        status: 'healthy',
        stats: votingStats,
        performanceMetrics: votingStats.performanceMetrics || {}
      };
    } catch (error) {
      services.voting = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Post-Synthesis Validator
    try {
      const validatorHealth = await postSynthesisValidator.healthCheck();
      services.validator = {
        status: validatorHealth.status || 'healthy',
        metrics: validatorHealth.metrics || {},
        thresholds: validatorHealth.thresholds || {}
      };
    } catch (error) {
      services.validator = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Vendor Clients
    try {
      const vendorHealth = await vendorClients.healthCheck();
      const vendorMetrics = vendorClients.getMetrics();
      services.vendors = {
        status: 'healthy',
        health: vendorHealth,
        metrics: vendorMetrics
      };
    } catch (error) {
      services.vendors = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // Enhanced Ensemble Runner
    try {
      const ensembleHealth = await enhancedEnsembleRunner.healthCheck();
      services.ensemble = {
        status: ensembleHealth.ensemble.status || 'healthy',
        isHealthy: ensembleHealth.ensemble.isHealthy,
        metrics: ensembleHealth.ensemble.metrics || {},
        warnings: ensembleHealth.ensemble.warnings || []
      };
    } catch (error) {
      services.ensemble = {
        status: 'unhealthy',
        error: error.message
      };
    }

    return services;
  }

  /**
   * Check circuit breaker status across all services
   */
  checkCircuitBreakers() {
    const circuitBreakers = errorHandler.getCircuitBreakerStatus();
    const summary = {
      total: Object.keys(circuitBreakers).length,
      open: 0,
      halfOpen: 0,
      closed: 0,
      details: circuitBreakers
    };

    Object.values(circuitBreakers).forEach(breaker => {
      switch (breaker.state) {
        case 'OPEN':
          summary.open++;
          break;
        case 'HALF_OPEN':
          summary.halfOpen++;
          break;
        case 'CLOSED':
          summary.closed++;
          break;
      }
    });

    return summary;
  }

  /**
   * Analyze error rates across services
   */
  analyzeErrorRates() {
    const monitoringMetrics = monitoringService.getMetrics();
    const errorRates = {
      overall: {
        total: monitoringMetrics.errors.total,
        rate: monitoringMetrics.requests.total > 0 
          ? (monitoringMetrics.errors.total / monitoringMetrics.requests.total * 100).toFixed(2)
          : '0.00',
        recent: monitoringMetrics.errors.recent.slice(-10) // Last 10 errors
      },
      byType: Object.fromEntries(monitoringMetrics.errors.byType),
      trends: this.calculateErrorTrends()
    };

    return errorRates;
  }

  /**
   * Check performance metrics
   */
  checkPerformanceMetrics() {
    const monitoringMetrics = monitoringService.getMetrics();
    
    return {
      averageResponseTime: monitoringMetrics.performance.averageResponseTime,
      p95ResponseTime: monitoringMetrics.performance.p95ResponseTime,
      slowRequests: monitoringMetrics.performance.slowRequests.length,
      memoryUsage: `${(monitoringMetrics.resources.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      activeConnections: monitoringMetrics.resources.activeConnections,
      uptime: Date.now() - monitoringService.startTime
    };
  }

  /**
   * Generate health recommendations
   */
  generateRecommendations(healthReport) {
    const recommendations = [];

    // Circuit breaker recommendations
    if (healthReport.circuitBreakers.open > 0) {
      recommendations.push({
        type: 'critical',
        message: `${healthReport.circuitBreakers.open} circuit breaker(s) are OPEN`,
        action: 'Investigate failing services and consider manual intervention'
      });
    }

    // Error rate recommendations
    const errorRate = parseFloat(healthReport.errorRates.overall.rate);
    if (errorRate > 10) {
      recommendations.push({
        type: 'warning',
        message: `High error rate: ${errorRate}%`,
        action: 'Review recent errors and check service health'
      });
    }

    // Performance recommendations
    if (healthReport.performance.averageResponseTime > 10000) {
      recommendations.push({
        type: 'warning',
        message: 'High average response time',
        action: 'Check for performance bottlenecks and optimize slow operations'
      });
    }

    // Service-specific recommendations
    Object.entries(healthReport.services).forEach(([serviceName, service]) => {
      if (service.status === 'unhealthy') {
        recommendations.push({
          type: 'critical',
          message: `${serviceName} service is unhealthy`,
          action: `Investigate ${serviceName} service: ${service.error || 'Unknown error'}`
        });
      }
    });

    return recommendations;
  }

  /**
   * Determine overall system health
   */
  determineOverallHealth(healthReport) {
    // Critical if any circuit breakers are open
    if (healthReport.circuitBreakers.open > 0) {
      return 'critical';
    }

    // Critical if any core services are unhealthy
    const coreServices = ['synthesis', 'voting', 'ensemble'];
    const unhealthyCore = coreServices.some(service => 
      healthReport.services[service]?.status === 'unhealthy'
    );
    
    if (unhealthyCore) {
      return 'critical';
    }

    // Degraded if error rate is high or performance is poor
    const errorRate = parseFloat(healthReport.errorRates.overall.rate);
    if (errorRate > 5 || healthReport.performance.averageResponseTime > 8000) {
      return 'degraded';
    }

    // Warning if any non-core services are unhealthy
    const anyUnhealthy = Object.values(healthReport.services).some(service => 
      service.status === 'unhealthy'
    );
    
    if (anyUnhealthy) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Calculate error trends from history
   */
  calculateErrorTrends() {
    if (this.healthHistory.length < 2) {
      return { trend: 'stable', change: 0 };
    }

    const recent = this.healthHistory.slice(-5);
    const errorRates = recent.map(h => parseFloat(h.errorRates?.overall?.rate || 0));
    
    const firstRate = errorRates[0];
    const lastRate = errorRates[errorRates.length - 1];
    const change = lastRate - firstRate;

    let trend = 'stable';
    if (change > 1) trend = 'increasing';
    else if (change < -1) trend = 'decreasing';

    return { trend, change: change.toFixed(2) };
  }

  /**
   * Update health history
   */
  updateHealthHistory(healthReport) {
    this.healthHistory.push({
      timestamp: healthReport.timestamp,
      overall: healthReport.overall,
      errorRates: healthReport.errorRates,
      performance: healthReport.performance
    });

    // Keep only recent history
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck() {
    return this.lastHealthCheck;
  }

  /**
   * Get health history
   */
  getHealthHistory(limit = 10) {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Start periodic health checks
   */
  startPeriodicHealthChecks(intervalMs = 60000) {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        monitoringService.log('error', 'Periodic health check failed', {
          error: error.message
        });
      }
    }, intervalMs);

    console.log(`🏥 Started periodic health checks every ${intervalMs}ms`);
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('🏥 Stopped periodic health checks');
    }
  }
}

module.exports = new SystemHealthChecker();
