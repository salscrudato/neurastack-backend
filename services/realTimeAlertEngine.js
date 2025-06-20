/**
 * Real-time Alert Engine
 * Core alerting engine that monitors metrics, evaluates thresholds, and manages alert lifecycle
 */

const admin = require('firebase-admin');
const { v4: generateUUID } = require('uuid');
const moment = require('moment');
const AlertConfigurationService = require('./alertConfigurationService');
const EmailNotificationService = require('./emailNotificationService');
const WebhookNotificationService = require('./webhookNotificationService');

class RealTimeAlertEngine {
  constructor() {
    this.db = null;
    this.activeAlerts = new Map();
    this.alertHistory = new Map();
    this.cooldownTracker = new Map();
    this.isRunning = false;

    // Initialize services
    this.alertConfigService = null;
    this.emailNotificationService = null;
    this.webhookNotificationService = null;
    
    // Alert states
    this.alertStates = {
      ACTIVE: 'active',
      RESOLVED: 'resolved',
      ACKNOWLEDGED: 'acknowledged',
      SUPPRESSED: 'suppressed'
    };
    
    // Monitoring interval (30 seconds)
    this.monitoringInterval = 30000;
    this.monitoringTimer = null;
    
    // Statistics
    this.stats = {
      totalAlertsTriggered: 0,
      totalAlertsResolved: 0,
      totalNotificationsSent: 0,
      lastEvaluationTime: null,
      evaluationCount: 0
    };
    
    console.log('✅ Real-time alert engine initialized');
  }
  
  /**
   * Start the alert engine
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Alert engine already running');
      return;
    }

    console.log('🚀 Starting real-time alert engine...');

    // Initialize Firebase connection if available
    try {
      this.db = admin.firestore();
    } catch (error) {
      console.warn('⚠️ Firebase not available for alert engine, using memory only');
      this.db = null;
    }

    // Initialize services
    this.alertConfigService = new AlertConfigurationService();
    this.emailNotificationService = new EmailNotificationService();
    this.webhookNotificationService = new WebhookNotificationService();

    // Initialize services
    await this.alertConfigService.initialize();
    await this.emailNotificationService.initialize();

    this.isRunning = true;

    // Load existing active alerts
    await this.loadActiveAlerts();

    // Start monitoring loop
    this.startMonitoring();

    console.log(`✅ Alert engine started (monitoring every ${this.monitoringInterval/1000}s)`);
  }
  
  /**
   * Stop the alert engine
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Alert engine not running');
      return;
    }
    
    console.log('🛑 Stopping real-time alert engine...');
    this.isRunning = false;
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    console.log('✅ Alert engine stopped');
  }
  
  /**
   * Start monitoring loop
   */
  startMonitoring() {
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.evaluateAllAlerts();
      } catch (error) {
        console.error('❌ Error in monitoring loop:', error);
      }
    }, this.monitoringInterval);
  }
  
  /**
   * Evaluate all enabled alert configurations
   */
  async evaluateAllAlerts() {
    const startTime = Date.now();
    
    try {
      // Get current metrics from all monitoring services
      const metrics = await this.collectMetrics();
      
      // Get enabled alert configurations
      const alertConfigs = this.alertConfigService.getEnabledAlertConfigs();
      
      let evaluatedCount = 0;
      let triggeredCount = 0;
      let resolvedCount = 0;
      
      for (const config of alertConfigs) {
        try {
          const result = await this.evaluateAlert(config, metrics);
          evaluatedCount++;
          
          if (result.triggered) triggeredCount++;
          if (result.resolved) resolvedCount++;
          
        } catch (error) {
          console.error(`❌ Error evaluating alert ${config.id}:`, error);
        }
      }
      
      // Update statistics
      this.stats.lastEvaluationTime = new Date();
      this.stats.evaluationCount++;
      
      const evaluationTime = Date.now() - startTime;
      
      if (triggeredCount > 0 || resolvedCount > 0) {
        console.log(`📊 Alert evaluation completed: ${evaluatedCount} evaluated, ${triggeredCount} triggered, ${resolvedCount} resolved (${evaluationTime}ms)`);
      }
      
    } catch (error) {
      console.error('❌ Error in alert evaluation:', error);
    }
  }
  
  /**
   * Evaluate a single alert configuration
   */
  async evaluateAlert(config, metrics) {
    const result = { triggered: false, resolved: false };
    
    // Check if alert is in cooldown
    if (this.isInCooldown(config.id)) {
      return result;
    }
    
    // Get metric value
    const currentValue = this.alertConfigService.getMetricValue(metrics, config.metric);
    if (currentValue === null || currentValue === undefined) {
      return result;
    }

    // Evaluate threshold
    const thresholdExceeded = this.alertConfigService.evaluateThreshold(config, currentValue);
    const existingAlert = this.activeAlerts.get(config.id);
    
    if (thresholdExceeded && !existingAlert) {
      // Trigger new alert
      const alert = await this.triggerAlert(config, currentValue);
      result.triggered = true;
      
    } else if (!thresholdExceeded && existingAlert) {
      // Resolve existing alert
      await this.resolveAlert(config.id);
      result.resolved = true;
    }
    
    return result;
  }
  
  /**
   * Trigger a new alert
   */
  async triggerAlert(config, currentValue) {
    const alertId = generateUUID();
    const now = new Date();
    
    const alert = {
      id: alertId,
      configId: config.id,
      name: config.name,
      description: config.description,
      severity: config.severity,
      metric: config.metric,
      threshold: config.threshold,
      operator: config.operator,
      currentValue,
      status: this.alertStates.ACTIVE,
      triggeredAt: now,
      resolvedAt: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      notificationsSent: 0,
      channels: config.channels || []
    };
    
    try {
      // Save to Firestore if available
      if (this.db) {
        await this.db.collection('alerts').doc(alertId).set({
          ...alert,
          triggeredAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Add to active alerts
      this.activeAlerts.set(config.id, alert);

      // Set cooldown
      this.setCooldown(config.id, config.cooldownMinutes || 15);

      // Send notifications
      await this.sendNotifications(alert);

      // Update statistics
      this.stats.totalAlertsTriggered++;

      console.log(`🚨 Alert triggered: ${alert.name} (${alert.severity}) - Value: ${currentValue}, Threshold: ${config.threshold}`);

      return alert;

    } catch (error) {
      console.error(`❌ Error triggering alert ${config.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Resolve an active alert
   */
  async resolveAlert(configId) {
    const alert = this.activeAlerts.get(configId);
    if (!alert) {
      return;
    }
    
    const now = new Date();
    const updatedAlert = {
      ...alert,
      status: this.alertStates.RESOLVED,
      resolvedAt: now
    };
    
    try {
      // Update in Firestore if available
      if (this.db) {
        await this.db.collection('alerts').doc(alert.id).update({
          status: this.alertStates.RESOLVED,
          resolvedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // Remove from active alerts
      this.activeAlerts.delete(configId);

      // Send resolution notifications
      await this.sendResolutionNotifications(updatedAlert);

      // Update statistics
      this.stats.totalAlertsResolved++;

      const duration = moment(now).diff(moment(alert.triggeredAt), 'minutes');
      console.log(`✅ Alert resolved: ${alert.name} (duration: ${duration} minutes)`);

      return updatedAlert;

    } catch (error) {
      console.error(`❌ Error resolving alert ${alert.id}:`, error);
      throw error;
    }
  }
  
  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId, acknowledgedBy) {
    try {
      const alertDoc = await this.db.collection('alerts').doc(alertId).get();
      if (!alertDoc.exists) {
        throw new Error('Alert not found');
      }

      const alert = { id: alertDoc.id, ...alertDoc.data() };

      if (alert.status !== this.alertStates.ACTIVE) {
        throw new Error('Only active alerts can be acknowledged');
      }

      const now = new Date();
      const updatedAlert = {
        ...alert,
        status: this.alertStates.ACKNOWLEDGED,
        acknowledgedAt: now,
        acknowledgedBy
      };

      // Update in Firestore
      await this.db.collection('alerts').doc(alertId).update({
        status: this.alertStates.ACKNOWLEDGED,
        acknowledgedAt: admin.firestore.FieldValue.serverTimestamp(),
        acknowledgedBy
      });

      // Update active alerts if it exists
      const configAlert = this.activeAlerts.get(alert.configId);
      if (configAlert) {
        this.activeAlerts.set(alert.configId, updatedAlert);
      }

      console.log(`👤 Alert acknowledged: ${alert.name} by ${acknowledgedBy}`);

      return updatedAlert;

    } catch (error) {
      console.error(`❌ Error acknowledging alert ${alertId}:`, error);
      throw error;
    }
  }

  /**
   * Send notifications for a triggered alert
   */
  async sendNotifications(alert) {
    const enabledChannels = this.alertConfigService.getEnabledNotificationChannels();
    let notificationsSent = 0;

    for (const channelId of alert.channels) {
      const channel = enabledChannels.find(c => c.id === channelId);
      if (!channel) {
        console.warn(`⚠️ Notification channel not found: ${channelId}`);
        continue;
      }

      try {
        let result;

        switch (channel.type) {
          case 'email':
            result = await this.emailNotificationService.sendAlert(alert, channel);
            break;
          case 'webhook':
            result = await this.webhookNotificationService.sendAlert(alert, channel);
            break;
          default:
            console.warn(`⚠️ Unknown notification channel type: ${channel.type}`);
            continue;
        }

        if (result.success) {
          notificationsSent++;
        }

      } catch (error) {
        console.error(`❌ Error sending notification via ${channel.type}:`, error);
      }
    }

    // Update notification count
    if (notificationsSent > 0) {
      await this.db.collection('alerts').doc(alert.id).update({
        notificationsSent: admin.firestore.FieldValue.increment(notificationsSent)
      });

      this.stats.totalNotificationsSent += notificationsSent;
    }

    console.log(`📤 Sent ${notificationsSent} notifications for alert: ${alert.name}`);
  }

  /**
   * Send resolution notifications
   */
  async sendResolutionNotifications(alert) {
    const enabledChannels = this.alertConfigService.getEnabledNotificationChannels();
    let notificationsSent = 0;

    for (const channelId of alert.channels) {
      const channel = enabledChannels.find(c => c.id === channelId);
      if (!channel) continue;

      try {
        let result;

        switch (channel.type) {
          case 'email':
            result = await this.emailNotificationService.sendAlertResolved(alert, channel);
            break;
          case 'webhook':
            result = await this.webhookNotificationService.sendAlertResolved(alert, channel);
            break;
          default:
            continue;
        }

        if (result.success) {
          notificationsSent++;
        }

      } catch (error) {
        console.error(`❌ Error sending resolution notification via ${channel.type}:`, error);
      }
    }

    this.stats.totalNotificationsSent += notificationsSent;
    console.log(`📤 Sent ${notificationsSent} resolution notifications for alert: ${alert.name}`);
  }

  /**
   * Collect metrics from all monitoring services
   */
  async collectMetrics() {
    const metrics = {};

    try {
      // Get monitoring service (assuming it's available globally)
      const monitoringService = require('./monitoringService');
      const costMonitoringService = require('./costMonitoringService');
      const contextQualityMonitoring = require('./contextQualityMonitoring');

      // System metrics
      const healthData = monitoringService.getHealthData();
      metrics.memory = healthData.metrics.memory;
      metrics.performance = healthData.metrics.performance;
      metrics.requests = healthData.metrics.requests;
      metrics.errors = {
        rate: monitoringService.getErrorRate(),
        total: monitoringService.metrics.errors.total
      };

      // Cost metrics
      const costData = costMonitoringService.getCostData();
      metrics.cost = {
        daily: costData.totalCosts.today,
        hourly: costData.totalCosts.thisHour,
        monthly: costData.totalCosts.thisMonth
      };

      // Quality metrics
      const qualityMetrics = contextQualityMonitoring.getRealTimeMetrics();
      metrics.quality = {
        tokenEfficiency: qualityMetrics.averageTokenEfficiency,
        processingTime: qualityMetrics.averageProcessingTime
      };

      // Cache metrics (if available)
      try {
        const cacheService = require('./cacheService');
        const cacheStats = cacheService.getStats();
        metrics.cache = {
          hitRate: cacheStats.hitRate || 0
        };
      } catch (error) {
        metrics.cache = { hitRate: 0 };
      }

    } catch (error) {
      console.error('❌ Error collecting metrics:', error);
    }

    return metrics;
  }

  /**
   * Load active alerts from Firestore
   */
  async loadActiveAlerts() {
    try {
      const snapshot = await this.db
        .collection('alerts')
        .where('status', 'in', [this.alertStates.ACTIVE, this.alertStates.ACKNOWLEDGED])
        .get();

      snapshot.forEach(doc => {
        const alert = { id: doc.id, ...doc.data() };
        this.activeAlerts.set(alert.configId, alert);
      });

      console.log(`📋 Loaded ${this.activeAlerts.size} active alerts`);

    } catch (error) {
      console.error('❌ Error loading active alerts:', error);
    }
  }

  /**
   * Check if alert is in cooldown
   */
  isInCooldown(configId) {
    const cooldownEnd = this.cooldownTracker.get(configId);
    if (!cooldownEnd) return false;

    const now = Date.now();
    if (now >= cooldownEnd) {
      this.cooldownTracker.delete(configId);
      return false;
    }

    return true;
  }

  /**
   * Set cooldown for alert
   */
  setCooldown(configId, minutes) {
    const cooldownEnd = Date.now() + (minutes * 60 * 1000);
    this.cooldownTracker.set(configId, cooldownEnd);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeAlertsCount: this.activeAlerts.size,
      cooldownCount: this.cooldownTracker.size,
      isRunning: this.isRunning
    };
  }

  /**
   * Get alert history
   */
  async getAlertHistory(limit = 100, status = null) {
    try {
      let query = this.db.collection('alerts').orderBy('triggeredAt', 'desc').limit(limit);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.get();
      const alerts = [];

      snapshot.forEach(doc => {
        alerts.push({ id: doc.id, ...doc.data() });
      });

      return alerts;

    } catch (error) {
      console.error('❌ Error getting alert history:', error);
      return [];
    }
  }
}

module.exports = RealTimeAlertEngine;
