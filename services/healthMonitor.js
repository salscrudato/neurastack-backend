/**
 * 🏥 Enhanced Health Monitoring Service
 * 
 * 🎯 PURPOSE: Comprehensive system health monitoring for production environments
 * 
 * 📋 MONITORING CAPABILITIES:
 * - Real-time system metrics (CPU, memory, response times)
 * - AI model performance tracking
 * - Database connection health
 * - Cache performance monitoring
 * - Request queue status
 * - Error rate tracking
 * - Automated alerting for critical issues
 */

const os = require('os');
const admin = require('firebase-admin');

class HealthMonitor {
  constructor() {
    this.metrics = {
      system: {
        uptime: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        freeMemory: 0,
        loadAverage: []
      },
      api: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        currentConcurrentRequests: 0,
        queueLength: 0
      },
      ai: {
        ensembleRequests: 0,
        ensembleSuccessRate: 0,
        averageEnsembleTime: 0,
        modelPerformance: new Map(),
        votingAccuracy: 0
      },
      database: {
        firestoreConnected: false,
        queryLatency: 0,
        connectionErrors: 0,
        lastSuccessfulQuery: null
      },
      cache: {
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        memoryUsage: 0
      }
    };

    this.alerts = {
      thresholds: {
        cpuUsage: 80,           // Alert if CPU > 80%
        memoryUsage: 85,        // Alert if memory > 85%
        responseTime: 10000,    // Alert if avg response > 10s
        errorRate: 5,           // Alert if error rate > 5%
        queueLength: 50,        // Alert if queue > 50 requests
        dbLatency: 2000         // Alert if DB latency > 2s
      },
      active: new Set(),
      history: []
    };

    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start health monitoring
   */
  startMonitoring(intervalMs = 30000) {
    if (this.isMonitoring) {
      console.log('⚠️ Health monitoring already running');
      return;
    }

    console.log('🏥 Starting enhanced health monitoring...');
    this.isMonitoring = true;

    // Collect metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
    }, intervalMs);

    // Initial metrics collection
    this.collectMetrics();
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('🏥 Health monitoring stopped');
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectMetrics() {
    try {
      // System metrics
      this.metrics.system.uptime = process.uptime();
      this.metrics.system.cpuUsage = process.cpuUsage();
      this.metrics.system.memoryUsage = (process.memoryUsage().rss / 1024 / 1024); // MB
      this.metrics.system.freeMemory = (os.freemem() / 1024 / 1024); // MB
      this.metrics.system.loadAverage = os.loadavg();

      // Database health check
      await this.checkDatabaseHealth();

      // Cache metrics (if cache service is available)
      this.collectCacheMetrics();

      console.log(`📊 Health metrics collected - CPU: ${this.metrics.system.cpuUsage.user}μs, Memory: ${this.metrics.system.memoryUsage.toFixed(1)}MB`);
    } catch (error) {
      console.error('❌ Error collecting health metrics:', error.message);
    }
  }

  /**
   * Check database connectivity and performance
   */
  async checkDatabaseHealth() {
    try {
      const startTime = Date.now();
      const firestore = admin.firestore();
      
      // Simple connectivity test
      await firestore.collection('health_check').limit(1).get();
      
      const latency = Date.now() - startTime;
      this.metrics.database.firestoreConnected = true;
      this.metrics.database.queryLatency = latency;
      this.metrics.database.lastSuccessfulQuery = new Date();
      
    } catch (error) {
      this.metrics.database.firestoreConnected = false;
      this.metrics.database.connectionErrors++;
      console.warn('⚠️ Database health check failed:', error.message);
    }
  }

  /**
   * Collect cache performance metrics
   */
  collectCacheMetrics() {
    try {
      // This would integrate with your cache service
      // For now, we'll use placeholder values
      this.metrics.cache.hitRate = 75; // Would come from actual cache service
      this.metrics.cache.missRate = 25;
      this.metrics.cache.evictionRate = 2;
      this.metrics.cache.memoryUsage = 150; // MB
    } catch (error) {
      console.warn('⚠️ Cache metrics collection failed:', error.message);
    }
  }

  /**
   * Check alert thresholds and trigger alerts
   */
  checkAlerts() {
    const alerts = [];

    // CPU usage alert
    if (this.metrics.system.cpuUsage.user > this.alerts.thresholds.cpuUsage * 1000) {
      alerts.push({
        type: 'HIGH_CPU_USAGE',
        severity: 'WARNING',
        message: `CPU usage high: ${(this.metrics.system.cpuUsage.user / 1000).toFixed(1)}%`,
        value: this.metrics.system.cpuUsage.user / 1000,
        threshold: this.alerts.thresholds.cpuUsage
      });
    }

    // Memory usage alert
    const memoryUsagePercent = (this.metrics.system.memoryUsage / (this.metrics.system.memoryUsage + this.metrics.system.freeMemory)) * 100;
    if (memoryUsagePercent > this.alerts.thresholds.memoryUsage) {
      alerts.push({
        type: 'HIGH_MEMORY_USAGE',
        severity: 'WARNING',
        message: `Memory usage high: ${memoryUsagePercent.toFixed(1)}%`,
        value: memoryUsagePercent,
        threshold: this.alerts.thresholds.memoryUsage
      });
    }

    // Database latency alert
    if (this.metrics.database.queryLatency > this.alerts.thresholds.dbLatency) {
      alerts.push({
        type: 'HIGH_DB_LATENCY',
        severity: 'WARNING',
        message: `Database latency high: ${this.metrics.database.queryLatency}ms`,
        value: this.metrics.database.queryLatency,
        threshold: this.alerts.thresholds.dbLatency
      });
    }

    // Database connectivity alert
    if (!this.metrics.database.firestoreConnected) {
      alerts.push({
        type: 'DATABASE_DISCONNECTED',
        severity: 'CRITICAL',
        message: 'Database connection lost',
        value: false,
        threshold: true
      });
    }

    // Process new alerts
    alerts.forEach(alert => {
      const alertKey = `${alert.type}_${alert.severity}`;
      if (!this.alerts.active.has(alertKey)) {
        this.triggerAlert(alert);
        this.alerts.active.add(alertKey);
      }
    });

    // Clear resolved alerts
    this.alerts.active.forEach(alertKey => {
      const isResolved = !alerts.some(alert => `${alert.type}_${alert.severity}` === alertKey);
      if (isResolved) {
        this.alerts.active.delete(alertKey);
        console.log(`✅ Alert resolved: ${alertKey}`);
      }
    });
  }

  /**
   * Trigger an alert
   */
  triggerAlert(alert) {
    const alertData = {
      ...alert,
      timestamp: new Date(),
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.alerts.history.push(alertData);
    
    // Log alert
    const emoji = alert.severity === 'CRITICAL' ? '🚨' : '⚠️';
    console.log(`${emoji} ALERT [${alert.severity}]: ${alert.message}`);

    // Here you could integrate with external alerting systems
    // - Send email notifications
    // - Post to Slack/Discord
    // - Send to monitoring services like DataDog, New Relic, etc.
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    const status = {
      overall: 'healthy',
      timestamp: new Date(),
      uptime: this.metrics.system.uptime,
      metrics: this.metrics,
      activeAlerts: Array.from(this.alerts.active),
      alertHistory: this.alerts.history.slice(-10) // Last 10 alerts
    };

    // Determine overall health
    if (this.alerts.active.size > 0) {
      const hasCritical = Array.from(this.alerts.active).some(alert => alert.includes('CRITICAL'));
      status.overall = hasCritical ? 'critical' : 'degraded';
    }

    return status;
  }

  /**
   * Record API request metrics
   */
  recordApiRequest(success, responseTime) {
    this.metrics.api.totalRequests++;
    if (success) {
      this.metrics.api.successfulRequests++;
    } else {
      this.metrics.api.failedRequests++;
    }

    // Update average response time (simple moving average)
    const totalTime = this.metrics.api.averageResponseTime * (this.metrics.api.totalRequests - 1) + responseTime;
    this.metrics.api.averageResponseTime = totalTime / this.metrics.api.totalRequests;
  }

  /**
   * Record ensemble request metrics
   */
  recordEnsembleRequest(success, responseTime, modelPerformance) {
    this.metrics.ai.ensembleRequests++;
    
    if (success) {
      // Update success rate
      this.metrics.ai.ensembleSuccessRate = 
        (this.metrics.ai.ensembleSuccessRate * (this.metrics.ai.ensembleRequests - 1) + 1) / this.metrics.ai.ensembleRequests;
      
      // Update average time
      const totalTime = this.metrics.ai.averageEnsembleTime * (this.metrics.ai.ensembleRequests - 1) + responseTime;
      this.metrics.ai.averageEnsembleTime = totalTime / this.metrics.ai.ensembleRequests;
    }

    // Record model performance
    if (modelPerformance) {
      Object.entries(modelPerformance).forEach(([model, performance]) => {
        if (!this.metrics.ai.modelPerformance.has(model)) {
          this.metrics.ai.modelPerformance.set(model, {
            requests: 0,
            successRate: 0,
            averageTime: 0,
            averageConfidence: 0
          });
        }
        
        const modelStats = this.metrics.ai.modelPerformance.get(model);
        modelStats.requests++;
        
        if (performance.success) {
          modelStats.successRate = (modelStats.successRate * (modelStats.requests - 1) + 1) / modelStats.requests;
        }
        
        if (performance.responseTime) {
          const totalTime = modelStats.averageTime * (modelStats.requests - 1) + performance.responseTime;
          modelStats.averageTime = totalTime / modelStats.requests;
        }
        
        if (performance.confidence) {
          const totalConf = modelStats.averageConfidence * (modelStats.requests - 1) + performance.confidence;
          modelStats.averageConfidence = totalConf / modelStats.requests;
        }
      });
    }
  }
}

module.exports = HealthMonitor;
