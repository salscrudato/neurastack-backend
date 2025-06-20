/**
 * Performance Monitoring Dashboard Routes
 * Provides endpoints for real-time performance monitoring and metrics visualization
 */

const express = require('express');
const authenticationService = require('../services/authenticationService');
const performanceMonitoringService = require('../services/performanceMonitoringService');
const securityMiddleware = require('../middleware/securityMiddleware');

const router = express.Router();

/**
 * Get dashboard overview data
 */
router.get('/overview',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view dashboard'
        });
      }

      const dashboardData = performanceMonitoringService.getDashboardData();

      res.status(200).json({
        status: 'success',
        data: dashboardData
      });

    } catch (error) {
      console.error('Dashboard overview error:', error);
      res.status(500).json({
        error: 'Failed to retrieve dashboard data',
        message: error.message
      });
    }
  }
);

/**
 * Get real-time metrics (WebSocket-friendly endpoint)
 */
router.get('/metrics/realtime',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view real-time metrics'
        });
      }

      const realTimeMetrics = performanceMonitoringService.getRealTimeMetrics();

      res.status(200).json({
        status: 'success',
        metrics: realTimeMetrics
      });

    } catch (error) {
      console.error('Real-time metrics error:', error);
      res.status(500).json({
        error: 'Failed to retrieve real-time metrics',
        message: error.message
      });
    }
  }
);

/**
 * Get system health status
 */
router.get('/health',
  authenticationService.optionalAuth(),
  async (req, res) => {
    try {
      const healthStatus = performanceMonitoringService.getHealthStatus();

      res.status(healthStatus.status === 'healthy' ? 200 : 503).json({
        status: 'success',
        health: healthStatus
      });

    } catch (error) {
      console.error('Health status error:', error);
      res.status(500).json({
        status: 'error',
        error: 'Failed to retrieve health status',
        message: error.message
      });
    }
  }
);

/**
 * Get performance trends
 */
router.get('/trends',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view performance trends'
        });
      }

      const { timeRange = '24h' } = req.query;
      const dashboardData = performanceMonitoringService.getDashboardData();

      // Extract trend data
      const trends = {
        responseTime: dashboardData.performance.responseTime,
        throughput: dashboardData.performance.throughput,
        errorRate: dashboardData.performance.errorRate,
        requests: dashboardData.requests.hourlyBreakdown,
        system: {
          cpu: dashboardData.system.cpu.usage,
          memory: dashboardData.system.memory.system.usagePercent
        }
      };

      res.status(200).json({
        status: 'success',
        timeRange,
        trends
      });

    } catch (error) {
      console.error('Performance trends error:', error);
      res.status(500).json({
        error: 'Failed to retrieve performance trends',
        message: error.message
      });
    }
  }
);

/**
 * Get optimization metrics
 */
router.get('/optimization',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view optimization metrics'
        });
      }

      const dashboardData = performanceMonitoringService.getDashboardData();

      res.status(200).json({
        status: 'success',
        optimization: dashboardData.optimization
      });

    } catch (error) {
      console.error('Optimization metrics error:', error);
      res.status(500).json({
        error: 'Failed to retrieve optimization metrics',
        message: error.message
      });
    }
  }
);

/**
 * Get endpoint statistics
 */
router.get('/endpoints',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view endpoint statistics'
        });
      }

      const dashboardData = performanceMonitoringService.getDashboardData();

      res.status(200).json({
        status: 'success',
        endpoints: dashboardData.endpoints,
        summary: {
          totalEndpoints: dashboardData.endpoints.length,
          totalRequests: dashboardData.endpoints.reduce((sum, ep) => sum + ep.requests, 0),
          averageResponseTime: dashboardData.endpoints.reduce((sum, ep) => sum + ep.averageResponseTime, 0) / dashboardData.endpoints.length || 0
        }
      });

    } catch (error) {
      console.error('Endpoint statistics error:', error);
      res.status(500).json({
        error: 'Failed to retrieve endpoint statistics',
        message: error.message
      });
    }
  }
);

/**
 * Get error logs and analysis
 */
router.get('/errors',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view error logs'
        });
      }

      const { limit = 50 } = req.query;
      const dashboardData = performanceMonitoringService.getDashboardData();

      // Group errors by type
      const errorsByType = dashboardData.errors.recent.reduce((acc, error) => {
        const type = error.type || 'Unknown';
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(error);
        return acc;
      }, {});

      res.status(200).json({
        status: 'success',
        errors: {
          recent: dashboardData.errors.recent.slice(0, parseInt(limit)),
          byType: errorsByType,
          summary: {
            total: dashboardData.errors.count,
            rate: dashboardData.errors.rate,
            types: Object.keys(errorsByType).length
          }
        }
      });

    } catch (error) {
      console.error('Error logs error:', error);
      res.status(500).json({
        error: 'Failed to retrieve error logs',
        message: error.message
      });
    }
  }
);

/**
 * Generate performance report
 */
router.post('/reports/generate',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 5, windowMs: 60 * 60 * 1000 }), // 5 reports per hour
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to generate reports'
        });
      }

      const { timeRange = '24h', includeDetails = false } = req.body;
      const dashboardData = performanceMonitoringService.getDashboardData();

      const report = {
        generatedAt: new Date().toISOString(),
        generatedBy: req.userId,
        timeRange,
        summary: dashboardData.overview,
        system: includeDetails ? dashboardData.system : {
          cpu: dashboardData.system.cpu.usage,
          memory: dashboardData.system.memory.system.usagePercent,
          uptime: dashboardData.system.uptime.application
        },
        optimization: dashboardData.optimization,
        topEndpoints: dashboardData.endpoints.slice(0, 10),
        recommendations: generateRecommendations(dashboardData)
      };

      res.status(200).json({
        status: 'success',
        report
      });

    } catch (error) {
      console.error('Report generation error:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        message: error.message
      });
    }
  }
);

/**
 * Dashboard configuration
 */
router.get('/config',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view dashboard configuration'
        });
      }

      const config = {
        refreshInterval: 30000, // 30 seconds
        dataRetention: {
          requests: '24 hours',
          performance: '24 hours',
          errors: '24 hours'
        },
        thresholds: {
          cpu: 80,
          memory: 85,
          errorRate: 5,
          responseTime: 5000
        },
        features: {
          realTimeMetrics: true,
          performanceTrends: true,
          optimizationTracking: true,
          errorAnalysis: true,
          reportGeneration: true
        }
      };

      res.status(200).json({
        status: 'success',
        configuration: config
      });

    } catch (error) {
      console.error('Dashboard configuration error:', error);
      res.status(500).json({
        error: 'Failed to retrieve dashboard configuration',
        message: error.message
      });
    }
  }
);

/**
 * Generate performance recommendations
 */
function generateRecommendations(dashboardData) {
  const recommendations = [];

  // CPU recommendations
  if (dashboardData.system.cpu.usage > 80) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      title: 'High CPU Usage',
      description: 'CPU usage is above 80%. Consider optimizing algorithms or scaling resources.',
      action: 'Monitor CPU-intensive operations and consider horizontal scaling.'
    });
  }

  // Memory recommendations
  if (dashboardData.system.memory.system.usagePercent > 85) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      title: 'High Memory Usage',
      description: 'Memory usage is above 85%. Check for memory leaks or increase available memory.',
      action: 'Review memory usage patterns and consider garbage collection optimization.'
    });
  }

  // Cache recommendations
  if (dashboardData.optimization.cache.hitRate < 70) {
    recommendations.push({
      type: 'optimization',
      priority: 'medium',
      title: 'Low Cache Hit Rate',
      description: `Cache hit rate is ${dashboardData.optimization.cache.hitRate}%. Consider cache warming or TTL adjustments.`,
      action: 'Review caching strategy and implement cache warming for frequently accessed data.'
    });
  }

  // Error rate recommendations
  if (dashboardData.errors.rate > 5) {
    recommendations.push({
      type: 'reliability',
      priority: 'high',
      title: 'High Error Rate',
      description: `Error rate is ${dashboardData.errors.rate.toFixed(2)}%. Investigate and fix recurring errors.`,
      action: 'Review error logs and implement better error handling and monitoring.'
    });
  }

  // Response time recommendations
  if (dashboardData.overview.averageResponseTime > 3000) {
    recommendations.push({
      type: 'performance',
      priority: 'medium',
      title: 'Slow Response Times',
      description: `Average response time is ${dashboardData.overview.averageResponseTime}ms. Consider optimization.`,
      action: 'Profile slow endpoints and implement performance optimizations.'
    });
  }

  return recommendations;
}

module.exports = router;
