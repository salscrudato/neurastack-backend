/**
 * Production-Grade Monitoring and Logging Service
 * Provides structured logging, metrics collection, and health monitoring
 */

const { v4: generateUUID } = require('uuid');

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

    // Console output with formatting
    const logString = `[${timestamp}] ${level.toUpperCase()} ${correlationId ? `[${correlationId}] ` : ''}${message}`;
    
    switch (level.toLowerCase()) {
      case 'error':
        console.error(logString, data);
        this.recordError(message, data, correlationId);
        break;
      case 'warn':
        console.warn(logString, data);
        break;
      case 'info':
        console.info(logString, data);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(logString, data);
        }
        break;
      default:
        console.log(logString, data);
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
