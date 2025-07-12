/**
 * Production-Grade Monitoring and Logging Service
 * Provides structured logging, metrics collection, and health monitoring
 */

const { v4: generateUUID } = require('uuid');
const logger = require('../utils/visualLogger');

class MonitoringService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byEndpoint: new Map(),
        byUser: new Map()
      },
      performance: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        responseTimes: [],
        slowRequests: []
      },
      resources: {
        memoryUsage: 0,
        cpuUsage: 0,
        activeConnections: 0,
        maxConnections: 0
      },
      errors: {
        total: 0,
        byType: new Map(),
        recent: []
      },
      voting: {
        totalVotes: 0,
        consensusDistribution: {
          'very-strong': 0,
          'strong': 0,
          'moderate': 0,
          'weak': 0,
          'very-weak': 0
        },
        sophisticatedFeaturesUsage: {
          diversityAnalysis: 0,
          historicalPerformance: 0,
          tieBreaking: 0,
          metaVoting: 0,
          abstention: 0
        },
        modelPerformance: new Map(),
        averageConfidence: 0,
        votingProcessingTimes: [],
        recentVotingDecisions: []
      },
      synthesis: {
        totalSyntheses: 0,
        successfulSyntheses: 0,
        failedSyntheses: 0,
        regenerations: 0,
        averageQualityScore: 0,
        qualityDistribution: {
          excellent: 0,    // > 0.9
          good: 0,         // 0.7-0.9
          acceptable: 0,   // 0.5-0.7
          poor: 0          // < 0.5
        },
        conflictResolutions: 0,
        contextIntegrations: 0,
        validationMetrics: {
          readabilityScores: [],
          factualConsistencyScores: [],
          noveltyScores: [],
          toxicityScores: [],
          overallQualityScores: []
        },
        processingTimes: [],
        recentSyntheses: []
      }
    };
    
    this.startTime = Date.now();
    this.correlationIds = new Map();
    
    // Start resource monitoring
    this.startResourceMonitoring();
    this.startMetricsReporting();
  }

  /**
   * Generate correlation ID for request tracking
   */
  generateCorrelationId(req) {
    const correlationId = req.headers['x-correlation-id'] || generateUUID().substring(0, 8);
    req.correlationId = correlationId;
    this.correlationIds.set(correlationId, {
      startTime: Date.now(),
      endpoint: req.path,
      method: req.method,
      userId: req.headers['x-user-id'] || 'anonymous',
      userAgent: req.headers['user-agent']
    });
    return correlationId;
  }

  /**
   * Structured logging with correlation ID
   */
  log(level, message, data = {}, correlationId = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      correlationId,
      ...data
    };

    // Add request context if available
    if (correlationId && this.correlationIds.has(correlationId)) {
      const context = this.correlationIds.get(correlationId);
      logEntry.requestContext = {
        endpoint: context.endpoint,
        method: context.method,
        userId: context.userId,
        duration: Date.now() - context.startTime
      };
    }

    // Enhanced visual console output
    const details = {
      ...data,
      ...(correlationId && this.correlationIds.has(correlationId) ? {
        'Correlation ID': correlationId,
        'Endpoint': this.correlationIds.get(correlationId).endpoint,
        'Duration': `${Date.now() - this.correlationIds.get(correlationId).startTime}ms`
      } : {})
    };

    switch (level.toLowerCase()) {
      case 'error':
        logger.error(message, details, 'system');
        this.recordError(message, data, correlationId);
        break;
      case 'warn':
        logger.warning(message, details, 'system');
        break;
      case 'info':
        logger.info(message, details, 'system');
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          logger.inline('debug', message, 'system');
        }
        break;
      default:
        logger.inline('info', message, 'system');
    }

    // In production, you would send this to a logging service
    // like CloudWatch, Datadog, or ELK stack
    if (process.env.NODE_ENV === 'production') {
      this.sendToLoggingService(logEntry);
    }
  }

  /**
   * Record request metrics
   */
  recordRequest(req, res, responseTime) {
    const correlationId = req.correlationId;
    const endpoint = req.path;
    const userId = req.headers['x-user-id'] || 'anonymous';
    const isSuccess = res.statusCode < 400;

    // Update general metrics
    this.metrics.requests.total++;
    if (isSuccess) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Update endpoint metrics
    if (!this.metrics.requests.byEndpoint.has(endpoint)) {
      this.metrics.requests.byEndpoint.set(endpoint, {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0
      });
    }
    const endpointMetrics = this.metrics.requests.byEndpoint.get(endpoint);
    endpointMetrics.total++;
    if (isSuccess) {
      endpointMetrics.successful++;
    } else {
      endpointMetrics.failed++;
    }
    endpointMetrics.averageResponseTime = 
      (endpointMetrics.averageResponseTime + responseTime) / 2;

    // Update user metrics
    if (!this.metrics.requests.byUser.has(userId)) {
      this.metrics.requests.byUser.set(userId, {
        total: 0,
        successful: 0,
        failed: 0
      });
    }
    const userMetrics = this.metrics.requests.byUser.get(userId);
    userMetrics.total++;
    if (isSuccess) {
      userMetrics.successful++;
    } else {
      userMetrics.failed++;
    }

    // Update performance metrics
    this.updatePerformanceMetrics(responseTime, endpoint, correlationId);

    // Clean up correlation ID
    this.correlationIds.delete(correlationId);

    this.log('info', `Request completed`, {
      endpoint,
      method: req.method,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userId
    }, correlationId);
  }

  updatePerformanceMetrics(responseTime, endpoint, correlationId) {
    // Add to response times array (keep last 1000)
    this.metrics.performance.responseTimes.push(responseTime);
    if (this.metrics.performance.responseTimes.length > 1000) {
      this.metrics.performance.responseTimes.shift();
    }

    // Update average
    const total = this.metrics.performance.responseTimes.length;
    this.metrics.performance.averageResponseTime = 
      this.metrics.performance.responseTimes.reduce((a, b) => a + b, 0) / total;

    // Calculate P95
    const sorted = [...this.metrics.performance.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    this.metrics.performance.p95ResponseTime = sorted[p95Index] || 0;

    // Track slow requests (> 10 seconds)
    if (responseTime > 10000) {
      this.metrics.performance.slowRequests.push({
        timestamp: Date.now(),
        responseTime,
        endpoint,
        correlationId
      });
      
      // Keep only last 100 slow requests
      if (this.metrics.performance.slowRequests.length > 100) {
        this.metrics.performance.slowRequests.shift();
      }

      this.log('warn', `Slow request detected`, {
        responseTime: `${responseTime}ms`,
        endpoint
      }, correlationId);
    }
  }

  recordError(message, data, correlationId) {
    this.metrics.errors.total++;
    
    const errorType = data.error?.name || data.errorType || 'UnknownError';
    if (!this.metrics.errors.byType.has(errorType)) {
      this.metrics.errors.byType.set(errorType, 0);
    }
    this.metrics.errors.byType.set(errorType, this.metrics.errors.byType.get(errorType) + 1);

    // Keep recent errors for debugging
    this.metrics.errors.recent.push({
      timestamp: Date.now(),
      message,
      data,
      correlationId,
      errorType
    });

    // Keep only last 50 errors
    if (this.metrics.errors.recent.length > 50) {
      this.metrics.errors.recent.shift();
    }
  }

  startResourceMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.resources.memoryUsage = memUsage.heapUsed;
      
      // In a real production environment, you'd also monitor:
      // - CPU usage
      // - Database connections
      // - External API rate limits
      // - Disk usage
      
    }, 30000); // Every 30 seconds
  }

  startMetricsReporting() {
    // Log comprehensive metrics every 10 minutes
    setInterval(() => {
      this.logMetricsSummary();
    }, 10 * 60 * 1000);
  }

  logMetricsSummary() {
    const uptime = Date.now() - this.startTime;
    const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);
    
    this.log('info', 'System Metrics Summary', {
      uptime: `${uptimeHours} hours`,
      requests: {
        total: this.metrics.requests.total,
        successRate: this.getSuccessRate(),
        requestsPerHour: Math.round(this.metrics.requests.total / (uptime / (1000 * 60 * 60)))
      },
      performance: {
        averageResponseTime: `${Math.round(this.metrics.performance.averageResponseTime)}ms`,
        p95ResponseTime: `${Math.round(this.metrics.performance.p95ResponseTime)}ms`,
        slowRequests: this.metrics.performance.slowRequests.length
      },
      resources: {
        memoryUsage: `${Math.round(this.metrics.resources.memoryUsage / 1024 / 1024)}MB`
      },
      errors: {
        total: this.metrics.errors.total,
        errorRate: this.getErrorRate()
      }
    });
  }

  getSuccessRate() {
    if (this.metrics.requests.total === 0) return 100;
    return ((this.metrics.requests.successful / this.metrics.requests.total) * 100).toFixed(2);
  }

  getErrorRate() {
    if (this.metrics.requests.total === 0) return 0;
    return ((this.metrics.errors.total / this.metrics.requests.total) * 100).toFixed(2);
  }

  /**
   * Health check with detailed system status
   */
  async getHealthStatus() {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      metrics: {
        requests: {
          total: this.metrics.requests.total,
          successRate: this.getSuccessRate(),
          errorRate: this.getErrorRate()
        },
        performance: {
          averageResponseTime: Math.round(this.metrics.performance.averageResponseTime),
          p95ResponseTime: Math.round(this.metrics.performance.p95ResponseTime)
        },
        memory: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        }
      }
    };

    // Determine overall health status
    const errorRate = parseFloat(this.getErrorRate());
    const avgResponseTime = this.metrics.performance.averageResponseTime;
    const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;

    if (errorRate > 10 || avgResponseTime > 15000 || memoryUsageMB > 512) {
      health.status = 'degraded';
    }
    
    if (errorRate > 25 || avgResponseTime > 30000 || memoryUsageMB > 1024) {
      health.status = 'unhealthy';
    }

    return health;
  }

  /**
   * Get detailed metrics for monitoring dashboards
   */
  getDetailedMetrics() {
    return {
      requests: {
        ...this.metrics.requests,
        byEndpoint: Object.fromEntries(this.metrics.requests.byEndpoint),
        byUser: Object.fromEntries(this.metrics.requests.byUser)
      },
      performance: this.metrics.performance,
      resources: this.metrics.resources,
      errors: {
        ...this.metrics.errors,
        byType: Object.fromEntries(this.metrics.errors.byType)
      }
    };
  }

  /**
   * Get health data for alert engine
   */
  getHealthData() {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      metrics: {
        requests: {
          total: this.metrics.requests.total,
          successRate: parseFloat(this.getSuccessRate()) / 100,
          errorRate: parseFloat(this.getErrorRate()) / 100
        },
        performance: {
          averageResponseTime: this.metrics.performance.averageResponseTime,
          p95ResponseTime: this.metrics.performance.p95ResponseTime
        },
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        }
      }
    };
  }

  /**
   * Placeholder for sending logs to external service
   */
  sendToLoggingService(logEntry) {
    // In production, implement integration with:
    // - Google Cloud Logging
    // - AWS CloudWatch
    // - Datadog
    // - ELK Stack
    // - etc.
  }

  /**
   * Track voting decision metrics
   */
  trackVotingDecision(votingResult, processingTime = 0) {
    try {
      this.metrics.voting.totalVotes++;

      // Track consensus distribution
      if (votingResult.consensus && this.metrics.voting.consensusDistribution[votingResult.consensus] !== undefined) {
        this.metrics.voting.consensusDistribution[votingResult.consensus]++;
      }

      // Track sophisticated features usage
      if (votingResult.analytics && votingResult.analytics.sophisticatedFeaturesUsed) {
        votingResult.analytics.sophisticatedFeaturesUsed.forEach(feature => {
          if (this.metrics.voting.sophisticatedFeaturesUsage[feature] !== undefined) {
            this.metrics.voting.sophisticatedFeaturesUsage[feature]++;
          }
        });
      }

      // Track model performance
      if (votingResult.weights) {
        Object.entries(votingResult.weights).forEach(([model, weight]) => {
          if (!this.metrics.voting.modelPerformance.has(model)) {
            this.metrics.voting.modelPerformance.set(model, {
              totalVotes: 0,
              totalWeight: 0,
              wins: 0,
              averageWeight: 0
            });
          }

          const modelStats = this.metrics.voting.modelPerformance.get(model);
          modelStats.totalVotes++;
          modelStats.totalWeight += weight;
          modelStats.averageWeight = modelStats.totalWeight / modelStats.totalVotes;

          if (model === votingResult.winner) {
            modelStats.wins++;
          }
        });
      }

      // Track average confidence
      if (votingResult.confidence) {
        const totalVotes = this.metrics.voting.totalVotes;
        this.metrics.voting.averageConfidence =
          ((this.metrics.voting.averageConfidence * (totalVotes - 1)) + votingResult.confidence) / totalVotes;
      }

      // Track processing times
      if (processingTime > 0) {
        this.metrics.voting.votingProcessingTimes.push(processingTime);

        // Keep only recent processing times (last 100)
        if (this.metrics.voting.votingProcessingTimes.length > 100) {
          this.metrics.voting.votingProcessingTimes = this.metrics.voting.votingProcessingTimes.slice(-100);
        }
      }

      // Track recent voting decisions
      const recentDecision = {
        timestamp: new Date().toISOString(),
        winner: votingResult.winner,
        confidence: votingResult.confidence,
        consensus: votingResult.consensus,
        featuresUsed: votingResult.analytics?.sophisticatedFeaturesUsed || [],
        processingTime
      };

      this.metrics.voting.recentVotingDecisions.push(recentDecision);

      // Keep only recent decisions (last 50)
      if (this.metrics.voting.recentVotingDecisions.length > 50) {
        this.metrics.voting.recentVotingDecisions = this.metrics.voting.recentVotingDecisions.slice(-50);
      }

    } catch (error) {
      this.log('error', 'Failed to track voting decision', {
        error: error.message,
        votingResult: votingResult?.winner || 'unknown'
      });
    }
  }

  /**
   * Track synthesis quality metrics
   */
  trackSynthesisQuality(synthesisResult, validationResult, processingTime = 0) {
    try {
      this.metrics.synthesis.totalSyntheses++;

      // Track success/failure
      if (synthesisResult.status === 'success') {
        this.metrics.synthesis.successfulSyntheses++;
      } else {
        this.metrics.synthesis.failedSyntheses++;
      }

      // Track regenerations
      if (synthesisResult.regenerated) {
        this.metrics.synthesis.regenerations++;
      }

      // Track conflict resolution
      if (synthesisResult.conflictResolution) {
        this.metrics.synthesis.conflictResolutions++;
      }

      // Track context integration
      if (synthesisResult.contextIntegration) {
        this.metrics.synthesis.contextIntegrations++;
      }

      // Track quality metrics if validation available
      if (validationResult) {
        const qualityLevel = validationResult.qualityLevel || 'unknown';
        if (this.metrics.synthesis.qualityDistribution[qualityLevel] !== undefined) {
          this.metrics.synthesis.qualityDistribution[qualityLevel]++;
        }

        // Update average quality score
        if (validationResult.overallQuality) {
          const totalSyntheses = this.metrics.synthesis.totalSyntheses;
          this.metrics.synthesis.averageQualityScore =
            ((this.metrics.synthesis.averageQualityScore * (totalSyntheses - 1)) + validationResult.overallQuality) / totalSyntheses;
        }

        // Track individual validation metrics
        if (validationResult.readability?.score) {
          this.metrics.synthesis.validationMetrics.readabilityScores.push(validationResult.readability.score);
          this.keepRecentMetrics(this.metrics.synthesis.validationMetrics.readabilityScores, 100);
        }

        if (validationResult.factualConsistency?.score) {
          this.metrics.synthesis.validationMetrics.factualConsistencyScores.push(validationResult.factualConsistency.score);
          this.keepRecentMetrics(this.metrics.synthesis.validationMetrics.factualConsistencyScores, 100);
        }

        if (validationResult.novelty?.score) {
          this.metrics.synthesis.validationMetrics.noveltyScores.push(validationResult.novelty.score);
          this.keepRecentMetrics(this.metrics.synthesis.validationMetrics.noveltyScores, 100);
        }

        if (validationResult.toxicity?.score) {
          this.metrics.synthesis.validationMetrics.toxicityScores.push(validationResult.toxicity.score);
          this.keepRecentMetrics(this.metrics.synthesis.validationMetrics.toxicityScores, 100);
        }

        if (validationResult.overallQuality) {
          this.metrics.synthesis.validationMetrics.overallQualityScores.push(validationResult.overallQuality);
          this.keepRecentMetrics(this.metrics.synthesis.validationMetrics.overallQualityScores, 100);
        }
      }

      // Track processing times
      if (processingTime > 0) {
        this.metrics.synthesis.processingTimes.push(processingTime);
        this.keepRecentMetrics(this.metrics.synthesis.processingTimes, 100);
      }

      // Track recent synthesis decisions
      const recentSynthesis = {
        timestamp: Date.now(),
        status: synthesisResult.status,
        qualityLevel: validationResult?.qualityLevel || 'unknown',
        conflictResolution: synthesisResult.conflictResolution || false,
        contextIntegration: synthesisResult.contextIntegration || false,
        regenerated: synthesisResult.regenerated || false,
        processingTime
      };

      this.metrics.synthesis.recentSyntheses.push(recentSynthesis);
      this.keepRecentMetrics(this.metrics.synthesis.recentSyntheses, 50);

    } catch (error) {
      this.log('error', 'Failed to track synthesis quality', {
        error: error.message,
        synthesisStatus: synthesisResult?.status
      });
    }
  }

  /**
   * Helper method to keep only recent metrics
   */
  keepRecentMetrics(array, maxLength) {
    if (array.length > maxLength) {
      array.splice(0, array.length - maxLength);
    }
  }

  /**
   * Get synthesis analytics summary
   */
  getSynthesisAnalytics() {
    try {
      const synthesis = this.metrics.synthesis;

      // Calculate quality distribution percentages
      const qualityPercentages = {};
      Object.entries(synthesis.qualityDistribution).forEach(([level, count]) => {
        qualityPercentages[level] = synthesis.totalSyntheses > 0 ?
          ((count / synthesis.totalSyntheses) * 100).toFixed(1) + '%' : '0%';
      });

      // Calculate average validation scores
      const avgValidationScores = {};
      Object.entries(synthesis.validationMetrics).forEach(([metric, scores]) => {
        if (scores.length > 0) {
          avgValidationScores[metric] = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3);
        } else {
          avgValidationScores[metric] = 'N/A';
        }
      });

      // Calculate processing time statistics
      let processingTimeStats = { average: 'N/A', p95: 'N/A' };
      if (synthesis.processingTimes.length > 0) {
        const avgTime = synthesis.processingTimes.reduce((a, b) => a + b, 0) / synthesis.processingTimes.length;
        const sortedTimes = [...synthesis.processingTimes].sort((a, b) => a - b);
        const p95Index = Math.floor(sortedTimes.length * 0.95);

        processingTimeStats = {
          average: Math.round(avgTime) + 'ms',
          p95: Math.round(sortedTimes[p95Index] || 0) + 'ms'
        };
      }

      return {
        totalSyntheses: synthesis.totalSyntheses,
        successRate: synthesis.totalSyntheses > 0 ?
          ((synthesis.successfulSyntheses / synthesis.totalSyntheses) * 100).toFixed(1) + '%' : '0%',
        regenerationRate: synthesis.totalSyntheses > 0 ?
          ((synthesis.regenerations / synthesis.totalSyntheses) * 100).toFixed(1) + '%' : '0%',
        averageQualityScore: synthesis.averageQualityScore.toFixed(3),
        qualityDistribution: qualityPercentages,
        conflictResolutionRate: synthesis.totalSyntheses > 0 ?
          ((synthesis.conflictResolutions / synthesis.totalSyntheses) * 100).toFixed(1) + '%' : '0%',
        contextIntegrationRate: synthesis.totalSyntheses > 0 ?
          ((synthesis.contextIntegrations / synthesis.totalSyntheses) * 100).toFixed(1) + '%' : '0%',
        validationMetrics: avgValidationScores,
        processingTime: processingTimeStats,
        recentSyntheses: synthesis.recentSyntheses.slice(-10) // Last 10 syntheses
      };

    } catch (error) {
      this.log('error', 'Failed to generate synthesis analytics', {
        error: error.message
      });

      return {
        error: 'Failed to generate synthesis analytics',
        totalSyntheses: this.metrics.synthesis.totalSyntheses || 0
      };
    }
  }

  /**
   * Get voting analytics summary
   */
  getVotingAnalytics() {
    try {
      const voting = this.metrics.voting;

      // Calculate consensus distribution percentages
      const consensusPercentages = {};
      Object.entries(voting.consensusDistribution).forEach(([level, count]) => {
        consensusPercentages[level] = voting.totalVotes > 0 ?
          ((count / voting.totalVotes) * 100).toFixed(1) + '%' : '0%';
      });

      // Calculate feature usage percentages
      const featureUsagePercentages = {};
      Object.entries(voting.sophisticatedFeaturesUsage).forEach(([feature, count]) => {
        featureUsagePercentages[feature] = voting.totalVotes > 0 ?
          ((count / voting.totalVotes) * 100).toFixed(1) + '%' : '0%';
      });

      // Calculate model performance statistics
      const modelStats = {};
      voting.modelPerformance.forEach((stats, model) => {
        modelStats[model] = {
          totalVotes: stats.totalVotes,
          winRate: stats.totalVotes > 0 ? ((stats.wins / stats.totalVotes) * 100).toFixed(1) + '%' : '0%',
          averageWeight: stats.averageWeight.toFixed(3),
          wins: stats.wins
        };
      });

      // Calculate processing time statistics
      const processingTimes = voting.votingProcessingTimes;
      let processingStats = {
        average: 0,
        median: 0,
        p95: 0,
        min: 0,
        max: 0
      };

      if (processingTimes.length > 0) {
        const sorted = [...processingTimes].sort((a, b) => a - b);
        processingStats = {
          average: Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length),
          median: Math.round(sorted[Math.floor(sorted.length / 2)]),
          p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
          min: Math.round(sorted[0]),
          max: Math.round(sorted[sorted.length - 1])
        };
      }

      return {
        totalVotingDecisions: voting.totalVotes,
        averageConfidence: voting.averageConfidence.toFixed(3),
        consensusDistribution: {
          counts: voting.consensusDistribution,
          percentages: consensusPercentages
        },
        sophisticatedFeaturesUsage: {
          counts: voting.sophisticatedFeaturesUsage,
          percentages: featureUsagePercentages
        },
        modelPerformance: modelStats,
        processingTimeStats: processingStats,
        recentDecisions: voting.recentVotingDecisions.slice(-10), // Last 10 decisions
        _description: "Comprehensive voting system analytics tracking consensus patterns, feature usage, model performance, and processing efficiency"
      };
    } catch (error) {
      this.log('error', 'Failed to generate voting analytics', {
        error: error.message
      });

      return {
        error: 'Failed to generate voting analytics',
        totalVotingDecisions: this.metrics.voting.totalVotes || 0
      };
    }
  }

  /**
   * Express middleware for automatic request tracking
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const correlationId = this.generateCorrelationId(req);
      
      // Add correlation ID to response headers
      res.setHeader('X-Correlation-ID', correlationId);
      
      // Log request start
      this.log('info', `Request started`, {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        userId: req.headers['x-user-id'] || 'anonymous'
      }, correlationId);

      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = (...args) => {
        const responseTime = Date.now() - startTime;
        this.recordRequest(req, res, responseTime);
        originalEnd.apply(res, args);
      };

      next();
    };
  }
}

module.exports = new MonitoringService();
