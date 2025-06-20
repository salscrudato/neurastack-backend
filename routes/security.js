/**
 * Security Management Routes
 * Provides endpoints for security monitoring, audit logs, and CSRF token management
 */

const express = require('express');
const authenticationService = require('../services/authenticationService');
const securityMiddleware = require('../middleware/securityMiddleware');
const auditLoggingService = require('../services/auditLoggingService');
const csrfProtection = require('../middleware/csrfProtection');
const inputValidationMiddleware = require('../middleware/inputValidationMiddleware');

const router = express.Router();

/**
 * Get CSRF token
 */
router.get('/csrf-token', csrfProtection.getTokenEndpoint());

/**
 * Security health check
 */
router.get('/health', async (req, res) => {
  try {
    const securityMetrics = securityMiddleware.getSecurityMetrics();
    const csrfStats = csrfProtection.getStatistics();
    
    res.status(200).json({
      status: 'healthy',
      service: 'security',
      metrics: {
        security: securityMetrics,
        csrf: csrfStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

/**
 * Get audit logs (admin only)
 */
router.get('/audit-logs',
  authenticationService.requireAuth(),
  inputValidationMiddleware.validatePagination(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        await auditLoggingService.logAuthorization(
          'audit_logs_access_denied',
          req.userId,
          'audit_logs',
          false,
          { reason: 'insufficient_permissions' }
        );
        
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view audit logs'
        });
      }

      const {
        page = 1,
        limit = 50,
        category,
        riskLevel,
        userId: filterUserId,
        startDate,
        endDate
      } = req.query;

      const filters = {};
      if (category) filters.category = category;
      if (riskLevel) filters.riskLevel = riskLevel;
      if (filterUserId) filters.userId = filterUserId;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const logs = await auditLoggingService.queryLogs(filters, parseInt(limit));

      // Log the audit log access
      await auditLoggingService.logDataAccess(
        req.userId,
        'audit_logs_viewed',
        'audit_logs',
        'multiple',
        { filters, resultCount: logs.length }
      );

      res.status(200).json({
        status: 'success',
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: logs.length
        },
        filters
      });

    } catch (error) {
      console.error('Audit logs retrieval error:', error);
      res.status(500).json({
        error: 'Failed to retrieve audit logs',
        message: error.message
      });
    }
  }
);

/**
 * Get audit statistics (admin only)
 */
router.get('/audit-stats',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view audit statistics'
        });
      }

      const { timeRange = 24 } = req.query;
      const stats = await auditLoggingService.getAuditStatistics(parseInt(timeRange));

      res.status(200).json({
        status: 'success',
        statistics: stats,
        timeRange: parseInt(timeRange),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Audit statistics error:', error);
      res.status(500).json({
        error: 'Failed to retrieve audit statistics',
        message: error.message
      });
    }
  }
);

/**
 * Get security incidents (admin only)
 */
router.get('/incidents',
  authenticationService.requireAuth(),
  inputValidationMiddleware.validatePagination(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view security incidents'
        });
      }

      const { timeRange = 24 } = req.query;
      const startDate = new Date(Date.now() - (parseInt(timeRange) * 60 * 60 * 1000));

      const incidents = await auditLoggingService.queryLogs({
        category: 'security_violation',
        startDate
      }, 100);

      // Group incidents by type
      const incidentsByType = incidents.reduce((acc, incident) => {
        const action = incident.action;
        if (!acc[action]) {
          acc[action] = [];
        }
        acc[action].push(incident);
        return acc;
      }, {});

      res.status(200).json({
        status: 'success',
        incidents: {
          total: incidents.length,
          byType: incidentsByType,
          recent: incidents.slice(0, 10)
        },
        timeRange: parseInt(timeRange),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Security incidents error:', error);
      res.status(500).json({
        error: 'Failed to retrieve security incidents',
        message: error.message
      });
    }
  }
);

/**
 * Report security incident
 */
router.post('/report-incident',
  authenticationService.requireAuthFlexible(),
  securityMiddleware.createRateLimit({ max: 10, windowMs: 60 * 60 * 1000 }),
  securityMiddleware.validateInput([
    securityMiddleware.getValidationRules().prompt.isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters')
  ]),
  async (req, res) => {
    try {
      const { type, description, severity = 'medium' } = req.body;
      const userId = req.userId || 'anonymous';

      if (!type || !description) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Type and description are required'
        });
      }

      const validSeverities = ['low', 'medium', 'high', 'critical'];
      if (!validSeverities.includes(severity)) {
        return res.status(400).json({
          error: 'Invalid severity',
          message: `Severity must be one of: ${validSeverities.join(', ')}`
        });
      }

      // Log the reported incident
      const eventId = await auditLoggingService.logSecurityViolation(
        'user_reported_incident',
        userId,
        {
          reportedType: type,
          description,
          severity,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      );

      res.status(201).json({
        status: 'success',
        message: 'Security incident reported successfully',
        incidentId: eventId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Security incident reporting error:', error);
      res.status(500).json({
        error: 'Failed to report security incident',
        message: error.message
      });
    }
  }
);

/**
 * Clean up old audit logs (admin only)
 */
router.post('/cleanup-logs',
  authenticationService.requireAuth(),
  securityMiddleware.createRateLimit({ max: 1, windowMs: 60 * 60 * 1000 }), // Once per hour
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to clean up audit logs'
        });
      }

      const { retentionDays = 90 } = req.body;

      if (retentionDays < 30 || retentionDays > 365) {
        return res.status(400).json({
          error: 'Invalid retention period',
          message: 'Retention period must be between 30 and 365 days'
        });
      }

      const cleanedCount = await auditLoggingService.cleanupOldLogs(retentionDays);

      // Log the cleanup action
      await auditLoggingService.logEvent(
        'system_event',
        'audit_logs_cleanup',
        {
          retentionDays,
          cleanedCount,
          performedBy: req.userId
        },
        req.userId,
        'medium'
      );

      res.status(200).json({
        status: 'success',
        message: 'Audit logs cleanup completed',
        cleanedCount,
        retentionDays,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Audit logs cleanup error:', error);
      res.status(500).json({
        error: 'Failed to clean up audit logs',
        message: error.message
      });
    }
  }
);

/**
 * Get security configuration (admin only)
 */
router.get('/config',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      // Check admin permissions
      if (!req.user.permissions || !req.user.permissions.includes('admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: 'Admin permissions required to view security configuration'
        });
      }

      const config = {
        rateLimiting: {
          enabled: true,
          tiers: ['free', 'premium', 'enterprise']
        },
        authentication: {
          jwtEnabled: true,
          apiKeyEnabled: true,
          firebaseEnabled: true
        },
        csrf: {
          enabled: true,
          tokenExpiry: csrfProtection.tokenExpiry / 1000 // seconds
        },
        audit: {
          enabled: true,
          categories: Object.values(auditLoggingService.eventCategories),
          riskLevels: Object.values(auditLoggingService.riskLevels)
        },
        inputValidation: {
          enabled: true,
          sanitization: true,
          dangerousPatternDetection: true
        }
      };

      res.status(200).json({
        status: 'success',
        configuration: config,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Security configuration error:', error);
      res.status(500).json({
        error: 'Failed to retrieve security configuration',
        message: error.message
      });
    }
  }
);

/**
 * Test security features (development only)
 */
router.post('/test',
  authenticationService.requireAuth(),
  async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          error: 'Not available in production',
          message: 'Security testing endpoints are not available in production'
        });
      }

      const { testType } = req.body;
      const userId = req.userId;

      switch (testType) {
        case 'audit_log':
          await auditLoggingService.logEvent(
            'system_event',
            'security_test',
            { testType: 'audit_log' },
            userId,
            'low'
          );
          break;

        case 'security_violation':
          await auditLoggingService.logSecurityViolation(
            'test_violation',
            userId,
            { testType: 'security_violation' }
          );
          break;

        case 'csrf_token':
          const token = csrfProtection.generateToken();
          return res.status(200).json({
            status: 'success',
            testType,
            csrfToken: token
          });

        default:
          return res.status(400).json({
            error: 'Invalid test type',
            message: 'Valid test types: audit_log, security_violation, csrf_token'
          });
      }

      res.status(200).json({
        status: 'success',
        testType,
        message: 'Security test completed'
      });

    } catch (error) {
      console.error('Security test error:', error);
      res.status(500).json({
        error: 'Security test failed',
        message: error.message
      });
    }
  }
);

module.exports = router;
