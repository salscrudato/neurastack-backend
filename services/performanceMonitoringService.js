/**
 * Performance Monitoring Service
 * Provides real-time performance monitoring, metrics collection, and dashboard data
 */

const os = require('os');
const process = require('process');
const costMonitoringService = require('./costMonitoringService');
const cacheService = require('./cacheService');
const vectorDatabaseService = require('./vectorDatabaseService');
const fineTunedModelService = require('./fineTunedModelService');
const advancedRateLimitingService = require('./advancedRateLimitingService');

class PerformanceMonitoringService {
  constructor() {
    this.metrics = {
      system: {
        uptime: 0,
        memory: {},
        cpu: {},
        network: {},
        disk: {}
      },
      application: {
        requests: {
          total: 0,
          successful: 0,
          failed: 0,
          averageResponseTime: 0,
          requestsPerSecond: 0
        },
        endpoints: new Map(),
        errors: [],
        performance: []
      },
      optimization: {
        cache: {},
        vectorDb: {},
        fineTunedModels: {},
        rateLimiting: {},
        costs: {}
      }
    };

    this.startTime = Date.now();
    this.requestHistory = [];
    this.performanceHistory = [];
    this.maxHistorySize = 1000;
    
    // Start periodic collection
    this.startPeriodicCollection();
  }

  /**
   * Start periodic metrics collection
   */
  startPeriodicCollection() {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Collect optimization metrics every 60 seconds
    setInterval(() => {
      this.collectOptimizationMetrics();
    }, 60000);

    // Clean up old data every 5 minutes
    setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    try {
      // Memory metrics
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      
      this.metrics.system.memory = {
        used: memUsage.rss,
        heap: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal
        },
        external: memUsage.external,
        system: {
          total: totalMem,
          free: freeMem,
          used: totalMem - freeMem,
          usagePercent: ((totalMem - freeMem) / totalMem) * 100
        }
      };

      // CPU metrics
      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      
      this.metrics.system.cpu = {
        count: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        loadAverage: {
          '1min': loadAvg[0],
          '5min': loadAvg[1],
          '15min': loadAvg[2]
        },
        usage: this.calculateCPUUsage()
      };

      // Uptime
      this.metrics.system.uptime = {
        system: os.uptime(),
        process: process.uptime(),
        application: (Date.now() - this.startTime) / 1000
      };

      // Network interfaces
      const networkInterfaces = os.networkInterfaces();
      this.metrics.system.network = {
        interfaces: Object.keys(networkInterfaces).length,
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch()
      };

    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }

  /**
   * Calculate CPU usage percentage
   */
  calculateCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * Collect optimization metrics
   */
  async collectOptimizationMetrics() {
    try {
      // Cache metrics
      this.metrics.optimization.cache = {
        ...cacheService.getStats(),
        health: cacheService.getHealthStatus()
      };

      // Vector database metrics
      this.metrics.optimization.vectorDb = {
        ...vectorDatabaseService.getMetrics(),
        health: await vectorDatabaseService.healthCheck()
      };

      // Fine-tuned models metrics
      this.metrics.optimization.fineTunedModels = fineTunedModelService.getServiceMetrics();

      // Rate limiting metrics
      this.metrics.optimization.rateLimiting = advancedRateLimitingService.getMetrics();

      // Cost monitoring metrics
      this.metrics.optimization.costs = costMonitoringService.getCostAnalytics();

    } catch (error) {
      console.error('Failed to collect optimization metrics:', error);
    }
  }

  /**
   * Track request metrics
   */
  trackRequest(req, res, responseTime) {
    const timestamp = Date.now();
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const success = res.statusCode < 400;

    // Update application metrics
    this.metrics.application.requests.total++;
    if (success) {
      this.metrics.application.requests.successful++;
    } else {
      this.metrics.application.requests.failed++;
    }

    // Update average response time
    const totalRequests = this.metrics.application.requests.total;
    this.metrics.application.requests.averageResponseTime = 
      ((this.metrics.application.requests.averageResponseTime * (totalRequests - 1)) + responseTime) / totalRequests;

    // Track endpoint-specific metrics
    if (!this.metrics.application.endpoints.has(endpoint)) {
      this.metrics.application.endpoints.set(endpoint, {
        requests: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0
      });
    }

    const endpointMetrics = this.metrics.application.endpoints.get(endpoint);
    endpointMetrics.requests++;
    if (success) {
      endpointMetrics.successful++;
    } else {
      endpointMetrics.failed++;
    }

    // Update endpoint response times
    endpointMetrics.averageResponseTime = 
      ((endpointMetrics.averageResponseTime * (endpointMetrics.requests - 1)) + responseTime) / endpointMetrics.requests;
    endpointMetrics.minResponseTime = Math.min(endpointMetrics.minResponseTime, responseTime);
    endpointMetrics.maxResponseTime = Math.max(endpointMetrics.maxResponseTime, responseTime);

    // Add to request history
    this.requestHistory.push({
      timestamp,
      endpoint,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      userId: req.userId || 'anonymous',
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    // Limit history size
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(-this.maxHistorySize / 2);
    }

    // Calculate requests per second
    this.calculateRequestsPerSecond();
  }

  /**
   * Calculate requests per second
   */
  calculateRequestsPerSecond() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentRequests = this.requestHistory.filter(req => req.timestamp > oneMinuteAgo);
    this.metrics.application.requests.requestsPerSecond = recentRequests.length / 60;
  }

  /**
   * Track error
   */
  trackError(error, context = {}) {
    const errorEntry = {
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      context
    };

    this.metrics.application.errors.push(errorEntry);

    // Limit error history
    if (this.metrics.application.errors.length > 100) {
      this.metrics.application.errors = this.metrics.application.errors.slice(-50);
    }
  }

  /**
   * Track performance event
   */
  trackPerformance(event, duration, metadata = {}) {
    const performanceEntry = {
      timestamp: Date.now(),
      event,
      duration,
      metadata
    };

    this.performanceHistory.push(performanceEntry);

    // Limit performance history
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize / 2);
    }
  }

  /**
   * Get dashboard data
   */
  getDashboardData() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    // Recent requests
    const recentRequests = this.requestHistory.filter(req => req.timestamp > oneHourAgo);
    const dailyRequests = this.requestHistory.filter(req => req.timestamp > oneDayAgo);

    // Error rate
    const recentErrors = this.metrics.application.errors.filter(err => err.timestamp > oneHourAgo);
    const errorRate = recentRequests.length > 0 ? (recentErrors.length / recentRequests.length) * 100 : 0;

    // Top endpoints
    const endpointStats = Array.from(this.metrics.application.endpoints.entries())
      .map(([endpoint, stats]) => ({ endpoint, ...stats }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    // Performance trends
    const performanceTrends = this.calculatePerformanceTrends();

    return {
      timestamp: now,
      overview: {
        uptime: this.metrics.system.uptime.application,
        totalRequests: this.metrics.application.requests.total,
        requestsPerSecond: this.metrics.application.requests.requestsPerSecond,
        averageResponseTime: this.metrics.application.requests.averageResponseTime,
        errorRate,
        successRate: ((this.metrics.application.requests.successful / this.metrics.application.requests.total) * 100) || 0
      },
      system: this.metrics.system,
      requests: {
        recent: recentRequests.length,
        daily: dailyRequests.length,
        hourlyBreakdown: this.getHourlyRequestBreakdown(recentRequests)
      },
      endpoints: endpointStats,
      errors: {
        recent: recentErrors.slice(-10),
        count: recentErrors.length,
        rate: errorRate
      },
      optimization: this.metrics.optimization,
      performance: performanceTrends
    };
  }

  /**
   * Get hourly request breakdown
   */
  getHourlyRequestBreakdown(requests) {
    const breakdown = {};
    const now = Date.now();
    
    // Initialize last 24 hours
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now - (i * 3600000)).getHours();
      breakdown[hour] = 0;
    }

    // Count requests by hour
    requests.forEach(req => {
      const hour = new Date(req.timestamp).getHours();
      breakdown[hour]++;
    });

    return breakdown;
  }

  /**
   * Calculate performance trends
   */
  calculatePerformanceTrends() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const recentPerformance = this.performanceHistory.filter(p => p.timestamp > oneHourAgo);
    
    const trends = {
      responseTime: {
        current: this.metrics.application.requests.averageResponseTime,
        trend: 'stable'
      },
      throughput: {
        current: this.metrics.application.requests.requestsPerSecond,
        trend: 'stable'
      },
      errorRate: {
        current: (this.metrics.application.requests.failed / this.metrics.application.requests.total) * 100 || 0,
        trend: 'stable'
      }
    };

    // Calculate trends (simplified)
    if (recentPerformance.length > 10) {
      const recent = recentPerformance.slice(-5);
      const previous = recentPerformance.slice(-10, -5);
      
      const recentAvg = recent.reduce((sum, p) => sum + p.duration, 0) / recent.length;
      const previousAvg = previous.reduce((sum, p) => sum + p.duration, 0) / previous.length;
      
      if (recentAvg > previousAvg * 1.1) {
        trends.responseTime.trend = 'increasing';
      } else if (recentAvg < previousAvg * 0.9) {
        trends.responseTime.trend = 'decreasing';
      }
    }

    return trends;
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics() {
    return {
      timestamp: Date.now(),
      system: {
        cpu: this.metrics.system.cpu.usage,
        memory: this.metrics.system.memory.system.usagePercent,
        uptime: this.metrics.system.uptime.application
      },
      application: {
        requestsPerSecond: this.metrics.application.requests.requestsPerSecond,
        averageResponseTime: this.metrics.application.requests.averageResponseTime,
        activeConnections: this.requestHistory.filter(r => Date.now() - r.timestamp < 5000).length
      },
      optimization: {
        cacheHitRate: this.metrics.optimization.cache.hitRate || 0,
        vectorDbHealth: this.metrics.optimization.vectorDb.health?.isHealthy || false,
        totalCost: this.metrics.optimization.costs.totalCosts?.today || 0
      }
    };
  }

  /**
   * Clean up old data
   */
  cleanupOldData() {
    const now = Date.now();
    const oneDayAgo = now - 86400000;

    // Clean up request history
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > oneDayAgo);

    // Clean up performance history
    this.performanceHistory = this.performanceHistory.filter(perf => perf.timestamp > oneDayAgo);

    // Clean up errors
    this.metrics.application.errors = this.metrics.application.errors.filter(err => err.timestamp > oneDayAgo);

    console.log('🧹 Performance monitoring data cleanup completed');
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const cpuUsage = this.metrics.system.cpu.usage || 0;
    const memoryUsage = this.metrics.system.memory.system?.usagePercent || 0;
    const errorRate = (this.metrics.application.requests.failed / this.metrics.application.requests.total) * 100 || 0;

    const isHealthy = cpuUsage < 80 && memoryUsage < 85 && errorRate < 5;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      checks: {
        cpu: { status: cpuUsage < 80 ? 'healthy' : 'warning', value: cpuUsage },
        memory: { status: memoryUsage < 85 ? 'healthy' : 'warning', value: memoryUsage },
        errors: { status: errorRate < 5 ? 'healthy' : 'warning', value: errorRate }
      },
      uptime: this.metrics.system.uptime.application,
      timestamp: Date.now()
    };
  }

  /**
   * Express middleware for request tracking
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Override res.end to capture response
      const originalEnd = res.end;
      res.end = (...args) => {
        const responseTime = Date.now() - startTime;
        this.trackRequest(req, res, responseTime);
        originalEnd.apply(res, args);
      };

      next();
    };
  }
}

module.exports = new PerformanceMonitoringService();
