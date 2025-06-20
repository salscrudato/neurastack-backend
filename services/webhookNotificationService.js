/**
 * Webhook Notification Service
 * Handles webhook notifications for alerts with retry logic and delivery tracking
 */

const axios = require('axios');
const admin = require('firebase-admin');
const moment = require('moment');

class WebhookNotificationService {
  constructor() {
    this.db = null;
    this.deliveryStats = {
      sent: 0,
      failed: 0,
      retries: 0,
      lastSent: null,
      lastError: null
    };
    
    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2
    };
    
    // Initialize Firebase connection if available
    try {
      this.db = admin.firestore();
    } catch (error) {
      console.warn('⚠️ Firebase not available for webhook notification service');
      this.db = null;
    }

    console.log('✅ Webhook notification service initialized');
  }
  
  /**
   * Send alert notification via webhook
   */
  async sendAlert(alert, channel) {
    const payload = this.createAlertPayload(alert);
    return await this.sendWebhook(payload, channel, alert.id);
  }
  
  /**
   * Send alert resolved notification via webhook
   */
  async sendAlertResolved(alert, channel) {
    const payload = this.createAlertResolvedPayload(alert);
    return await this.sendWebhook(payload, channel, alert.id);
  }
  
  /**
   * Send webhook with retry logic
   */
  async sendWebhook(payload, channel, alertId, attempt = 1) {
    try {
      const config = {
        method: channel.config.method || 'POST',
        url: channel.config.url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NeuraStack-Webhook/2.0',
          ...channel.config.headers
        },
        data: payload,
        timeout: channel.config.timeout || 10000,
        validateStatus: (status) => status >= 200 && status < 300
      };
      
      const startTime = Date.now();
      const response = await axios(config);
      const responseTime = Date.now() - startTime;
      
      // Track successful delivery
      this.deliveryStats.sent++;
      this.deliveryStats.lastSent = new Date();
      
      // Log delivery
      await this.logWebhookDelivery(alertId, 'sent', {
        attempt,
        responseTime,
        statusCode: response.status,
        url: channel.config.url
      });
      
      console.log(`🔗 Webhook sent successfully: ${channel.config.url} (${response.status}, ${responseTime}ms)`);
      
      return {
        success: true,
        statusCode: response.status,
        responseTime,
        attempt
      };
      
    } catch (error) {
      const isLastAttempt = attempt >= this.retryConfig.maxRetries;
      
      if (!isLastAttempt) {
        // Calculate delay for next retry
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelay
        );
        
        console.warn(`⚠️ Webhook attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        this.deliveryStats.retries++;
        return await this.sendWebhook(payload, channel, alertId, attempt + 1);
      }
      
      // All retries exhausted
      this.deliveryStats.failed++;
      this.deliveryStats.lastError = error.message;
      
      // Log failure
      await this.logWebhookDelivery(alertId, 'failed', {
        attempt,
        error: error.message,
        statusCode: error.response?.status,
        url: channel.config.url
      });
      
      console.error(`❌ Webhook failed after ${attempt} attempts: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        statusCode: error.response?.status,
        attempt
      };
    }
  }
  
  /**
   * Create alert payload for webhook
   */
  createAlertPayload(alert) {
    return {
      type: 'alert_triggered',
      timestamp: moment().toISOString(),
      alert: {
        id: alert.id,
        name: alert.name,
        description: alert.description,
        severity: alert.severity,
        metric: alert.metric,
        currentValue: alert.currentValue,
        threshold: alert.threshold,
        operator: alert.operator,
        triggeredAt: alert.triggeredAt,
        status: alert.status
      },
      system: {
        service: 'neurastack-backend',
        version: '2.0',
        environment: process.env.NODE_ENV || 'development'
      },
      links: {
        dashboard: process.env.DASHBOARD_URL || 'http://localhost:8080/monitor',
        api: `${process.env.API_BASE_URL || 'http://localhost:8080'}/api/alerts/${alert.id}`
      }
    };
  }
  
  /**
   * Create alert resolved payload for webhook
   */
  createAlertResolvedPayload(alert) {
    const duration = alert.resolvedAt ? 
      moment(alert.resolvedAt).diff(moment(alert.triggeredAt), 'minutes') : 0;
    
    return {
      type: 'alert_resolved',
      timestamp: moment().toISOString(),
      alert: {
        id: alert.id,
        name: alert.name,
        description: alert.description,
        severity: alert.severity,
        triggeredAt: alert.triggeredAt,
        resolvedAt: alert.resolvedAt,
        duration: `${duration} minutes`,
        status: alert.status
      },
      system: {
        service: 'neurastack-backend',
        version: '2.0',
        environment: process.env.NODE_ENV || 'development'
      },
      links: {
        dashboard: process.env.DASHBOARD_URL || 'http://localhost:8080/monitor'
      }
    };
  }
  
  /**
   * Send test webhook
   */
  async sendTestWebhook(webhookUrl, customPayload = null) {
    const payload = customPayload || {
      type: 'test',
      timestamp: moment().toISOString(),
      message: 'This is a test webhook from NeuraStack',
      system: {
        service: 'neurastack-backend',
        version: '2.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };
    
    const channel = {
      config: {
        url: webhookUrl,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    };
    
    return await this.sendWebhook(payload, channel, 'test-webhook');
  }
  
  /**
   * Send daily summary via webhook
   */
  async sendDailySummary(summary, channel) {
    const payload = {
      type: 'daily_summary',
      timestamp: moment().toISOString(),
      date: moment().format('YYYY-MM-DD'),
      summary: {
        totalAlerts: summary.totalAlerts || 0,
        criticalAlerts: summary.criticalAlerts || 0,
        warningAlerts: summary.warningAlerts || 0,
        resolvedAlerts: summary.resolvedAlerts || 0,
        activeAlerts: summary.activeAlerts || 0,
        topAlerts: summary.topAlerts || []
      },
      system: {
        service: 'neurastack-backend',
        version: '2.0',
        environment: process.env.NODE_ENV || 'development'
      },
      links: {
        dashboard: process.env.DASHBOARD_URL || 'http://localhost:8080/monitor'
      }
    };
    
    return await this.sendWebhook(payload, channel, 'daily-summary');
  }
  
  /**
   * Log webhook delivery to Firestore
   */
  async logWebhookDelivery(alertId, status, details = {}) {
    if (!this.db) {
      return; // Skip logging if Firebase not available
    }

    try {
      await this.db.collection('webhookDeliveryLogs').add({
        alertId,
        status,
        details,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          service: 'neurastack-backend',
          version: '2.0'
        }
      });
    } catch (error) {
      console.error('❌ Failed to log webhook delivery:', error);
    }
  }
  
  /**
   * Get delivery statistics
   */
  getDeliveryStats() {
    return {
      ...this.deliveryStats,
      retryConfig: this.retryConfig
    };
  }
  
  /**
   * Get recent delivery logs
   */
  async getRecentDeliveryLogs(limit = 50) {
    if (!this.db) {
      return []; // Return empty array if Firebase not available
    }

    try {
      const snapshot = await this.db
        .collection('webhookDeliveryLogs')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const logs = [];
      snapshot.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() });
      });

      return logs;
    } catch (error) {
      console.error('❌ Failed to get delivery logs:', error);
      return [];
    }
  }
  
  /**
   * Validate webhook URL
   */
  validateWebhookUrl(url) {
    try {
      const parsedUrl = new URL(url);
      return {
        valid: true,
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = WebhookNotificationService;
