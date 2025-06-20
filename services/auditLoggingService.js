/**
 * Audit Logging Service
 * Provides comprehensive audit logging for security events, user actions, and system activities
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

class AuditLoggingService {
  constructor() {
    try {
      this.db = admin.firestore();
      this.isFirebaseAvailable = true;
    } catch (error) {
      console.warn('⚠️ Firebase not initialized, using memory-only audit logging');
      this.db = null;
      this.isFirebaseAvailable = false;
    }
    this.auditCollection = 'audit_logs';
    this.securityCollection = 'security_events';
    this.memoryBuffer = []; // In-memory buffer for high-frequency events
    this.bufferSize = 100;
    this.flushInterval = 30000; // 30 seconds
    
    // Event categories
    this.eventCategories = {
      AUTHENTICATION: 'authentication',
      AUTHORIZATION: 'authorization',
      DATA_ACCESS: 'data_access',
      SECURITY_VIOLATION: 'security_violation',
      RATE_LIMIT: 'rate_limit',
      API_USAGE: 'api_usage',
      SYSTEM_EVENT: 'system_event',
      ERROR: 'error'
    };

    // Risk levels
    this.riskLevels = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical'
    };

    this.startPeriodicFlush();
  }

  /**
   * Log audit event
   */
  async logEvent(category, action, details = {}, userId = 'system', riskLevel = 'low') {
    const event = {
      id: this.generateEventId(),
      timestamp: new Date(),
      category,
      action,
      userId,
      riskLevel,
      details: this.sanitizeDetails(details),
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      sessionId: details.sessionId || null,
      correlationId: details.correlationId || null,
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        service: 'neurastack-backend',
        version: '2.0'
      }
    };

    // Add to memory buffer for immediate processing
    this.memoryBuffer.push(event);

    // Immediate flush for high-risk events
    if (riskLevel === this.riskLevels.HIGH || riskLevel === this.riskLevels.CRITICAL) {
      await this.flushToDatabase([event]);
      console.warn(`🚨 High-risk audit event: ${category}/${action} - ${userId}`);
    }

    // Flush buffer if it's full
    if (this.memoryBuffer.length >= this.bufferSize) {
      await this.flushBuffer();
    }

    return event.id;
  }

  /**
   * Log authentication events
   */
  async logAuthentication(action, userId, success, details = {}) {
    const riskLevel = success ? this.riskLevels.LOW : this.riskLevels.MEDIUM;
    
    return await this.logEvent(
      this.eventCategories.AUTHENTICATION,
      action,
      {
        ...details,
        success,
        authMethod: details.authMethod || 'unknown'
      },
      userId,
      riskLevel
    );
  }

  /**
   * Log authorization events
   */
  async logAuthorization(action, userId, resource, granted, details = {}) {
    const riskLevel = granted ? this.riskLevels.LOW : this.riskLevels.MEDIUM;
    
    return await this.logEvent(
      this.eventCategories.AUTHORIZATION,
      action,
      {
        ...details,
        resource,
        granted,
        requiredPermissions: details.requiredPermissions || []
      },
      userId,
      riskLevel
    );
  }

  /**
   * Log security violations
   */
  async logSecurityViolation(violationType, userId, details = {}) {
    return await this.logEvent(
      this.eventCategories.SECURITY_VIOLATION,
      violationType,
      {
        ...details,
        severity: details.severity || 'medium',
        blocked: details.blocked || false
      },
      userId,
      this.riskLevels.HIGH
    );
  }

  /**
   * Log rate limiting events
   */
  async logRateLimit(userId, endpoint, tier, exceeded, details = {}) {
    const riskLevel = exceeded ? this.riskLevels.MEDIUM : this.riskLevels.LOW;
    
    return await this.logEvent(
      this.eventCategories.RATE_LIMIT,
      exceeded ? 'limit_exceeded' : 'limit_checked',
      {
        ...details,
        endpoint,
        tier,
        exceeded,
        currentCount: details.currentCount || 0,
        limit: details.limit || 0
      },
      userId,
      riskLevel
    );
  }

  /**
   * Log API usage
   */
  async logApiUsage(userId, endpoint, method, statusCode, responseTime, details = {}) {
    const riskLevel = statusCode >= 400 ? this.riskLevels.MEDIUM : this.riskLevels.LOW;
    
    return await this.logEvent(
      this.eventCategories.API_USAGE,
      'api_call',
      {
        ...details,
        endpoint,
        method,
        statusCode,
        responseTime,
        tier: details.tier || 'free',
        cached: details.cached || false
      },
      userId,
      riskLevel
    );
  }

  /**
   * Log data access events
   */
  async logDataAccess(userId, action, dataType, recordId, details = {}) {
    return await this.logEvent(
      this.eventCategories.DATA_ACCESS,
      action,
      {
        ...details,
        dataType,
        recordId,
        sensitive: details.sensitive || false
      },
      userId,
      details.sensitive ? this.riskLevels.MEDIUM : this.riskLevels.LOW
    );
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Sanitize details to remove sensitive information
   */
  sanitizeDetails(details) {
    const sanitized = { ...details };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'key'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = this.maskSensitiveData(sanitized[field]);
      }
    }

    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
        sanitized[key] = sanitized[key].substring(0, 1000) + '...[truncated]';
      }
    });

    return sanitized;
  }

  /**
   * Mask sensitive data
   */
  maskSensitiveData(data) {
    if (typeof data !== 'string') return '[REDACTED]';
    
    if (data.length <= 8) {
      return '*'.repeat(data.length);
    }
    
    return data.substring(0, 4) + '*'.repeat(data.length - 8) + data.substring(data.length - 4);
  }

  /**
   * Flush memory buffer to database
   */
  async flushBuffer() {
    if (this.memoryBuffer.length === 0) return;

    const events = [...this.memoryBuffer];
    this.memoryBuffer = [];

    await this.flushToDatabase(events);
  }

  /**
   * Flush events to database
   */
  async flushToDatabase(events) {
    if (!this.isFirebaseAvailable || !this.db) {
      console.log(`📝 Stored ${events.length} audit events in memory (Firebase not available)`);
      return;
    }

    try {
      const batch = this.db.batch();

      for (const event of events) {
        const docRef = this.db.collection(this.auditCollection).doc(event.id);
        batch.set(docRef, {
          ...event,
          timestamp: admin.firestore.Timestamp.fromDate(event.timestamp)
        });
      }

      await batch.commit();
      console.log(`📝 Flushed ${events.length} audit events to database`);
    } catch (error) {
      console.error('Failed to flush audit events to database:', error);

      // Re-add events to buffer for retry
      this.memoryBuffer.unshift(...events);
    }
  }

  /**
   * Start periodic flush
   */
  startPeriodicFlush() {
    setInterval(async () => {
      await this.flushBuffer();
    }, this.flushInterval);
  }

  /**
   * Query audit logs
   */
  async queryLogs(filters = {}, limit = 100) {
    if (!this.isFirebaseAvailable || !this.db) {
      // Return recent memory buffer entries
      return this.memoryBuffer
        .filter(log => {
          if (filters.userId && log.userId !== filters.userId) return false;
          if (filters.category && log.category !== filters.category) return false;
          if (filters.riskLevel && log.riskLevel !== filters.riskLevel) return false;
          return true;
        })
        .slice(0, limit);
    }

    try {
      let query = this.db.collection(this.auditCollection);

      // Apply filters
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }
      
      if (filters.riskLevel) {
        query = query.where('riskLevel', '==', filters.riskLevel);
      }
      
      if (filters.startDate) {
        query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(filters.startDate));
      }
      
      if (filters.endDate) {
        query = query.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(filters.endDate));
      }

      // Order and limit
      query = query.orderBy('timestamp', 'desc').limit(limit);

      const snapshot = await query.get();
      const logs = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        logs.push({
          ...data,
          timestamp: data.timestamp.toDate()
        });
      });

      return logs;
    } catch (error) {
      console.error('Failed to query audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(timeRange = 24) {
    if (!this.isFirebaseAvailable || !this.db) {
      // Calculate stats from memory buffer
      const startTime = new Date(Date.now() - (timeRange * 60 * 60 * 1000));
      const recentLogs = this.memoryBuffer.filter(log =>
        new Date(log.timestamp) > startTime
      );

      const stats = {
        totalEvents: recentLogs.length,
        byCategory: {},
        byRiskLevel: {},
        byUser: {},
        securityViolations: 0,
        failedAuthentications: 0
      };

      recentLogs.forEach(log => {
        stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
        stats.byRiskLevel[log.riskLevel] = (stats.byRiskLevel[log.riskLevel] || 0) + 1;
        stats.byUser[log.userId] = (stats.byUser[log.userId] || 0) + 1;

        if (log.category === this.eventCategories.SECURITY_VIOLATION) {
          stats.securityViolations++;
        }
        if (log.category === this.eventCategories.AUTHENTICATION && !log.details.success) {
          stats.failedAuthentications++;
        }
      });

      return stats;
    }

    try {
      const startTime = new Date(Date.now() - (timeRange * 60 * 60 * 1000));

      const snapshot = await this.db.collection(this.auditCollection)
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startTime))
        .get();

      const stats = {
        totalEvents: 0,
        byCategory: {},
        byRiskLevel: {},
        byUser: {},
        securityViolations: 0,
        failedAuthentications: 0
      };

      snapshot.forEach(doc => {
        const data = doc.data();
        stats.totalEvents++;

        // Count by category
        stats.byCategory[data.category] = (stats.byCategory[data.category] || 0) + 1;

        // Count by risk level
        stats.byRiskLevel[data.riskLevel] = (stats.byRiskLevel[data.riskLevel] || 0) + 1;

        // Count by user (top 10)
        if (Object.keys(stats.byUser).length < 10) {
          stats.byUser[data.userId] = (stats.byUser[data.userId] || 0) + 1;
        }

        // Count security violations
        if (data.category === this.eventCategories.SECURITY_VIOLATION) {
          stats.securityViolations++;
        }

        // Count failed authentications
        if (data.category === this.eventCategories.AUTHENTICATION && !data.details.success) {
          stats.failedAuthentications++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays = 90) {
    try {
      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
      
      const snapshot = await this.db.collection(this.auditCollection)
        .where('timestamp', '<', admin.firestore.Timestamp.fromDate(cutoffDate))
        .limit(500) // Process in batches
        .get();

      if (snapshot.empty) {
        console.log('No old audit logs to clean up');
        return 0;
      }

      const batch = this.db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`🧹 Cleaned up ${snapshot.size} old audit logs`);
      
      return snapshot.size;
    } catch (error) {
      console.error('Failed to clean up old audit logs:', error);
      throw error;
    }
  }
}

module.exports = new AuditLoggingService();
