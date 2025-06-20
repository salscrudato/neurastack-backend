/**
 * Alert Configuration Service
 * Manages alert configurations, thresholds, notification channels, and alert rules
 */

const admin = require('firebase-admin');
const { v4: generateUUID } = require('uuid');

class AlertConfigurationService {
  constructor() {
    this.db = null;
    this.alertConfigs = new Map();
    this.notificationChannels = new Map();
    this.alertRules = new Map();
    
    // Default alert configurations
    this.defaultConfigs = {
      // System performance alerts
      high_memory_usage: {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        description: 'Alert when memory usage exceeds threshold',
        metric: 'memory.heapUsed',
        threshold: 500 * 1024 * 1024, // 500MB
        operator: 'greater_than',
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 15,
        channels: ['email', 'webhook']
      },
      
      // Cost monitoring alerts
      daily_cost_limit: {
        id: 'daily_cost_limit',
        name: 'Daily Cost Limit Exceeded',
        description: 'Alert when daily costs exceed limit',
        metric: 'cost.daily',
        threshold: 10.0,
        operator: 'greater_than',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 60,
        channels: ['email', 'webhook']
      },
      
      hourly_cost_limit: {
        id: 'hourly_cost_limit',
        name: 'Hourly Cost Limit Exceeded',
        description: 'Alert when hourly costs exceed limit',
        metric: 'cost.hourly',
        threshold: 2.0,
        operator: 'greater_than',
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 30,
        channels: ['email']
      },
      
      // Performance alerts
      high_response_time: {
        id: 'high_response_time',
        name: 'High Response Time',
        description: 'Alert when P95 response time is too high',
        metric: 'performance.p95ResponseTime',
        threshold: 5000, // 5 seconds
        operator: 'greater_than',
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 10,
        channels: ['webhook']
      },
      
      low_success_rate: {
        id: 'low_success_rate',
        name: 'Low Success Rate',
        description: 'Alert when request success rate drops',
        metric: 'requests.successRate',
        threshold: 0.95, // 95%
        operator: 'less_than',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5,
        channels: ['email', 'webhook']
      },
      
      // Quality monitoring alerts
      low_token_efficiency: {
        id: 'low_token_efficiency',
        name: 'Low Token Efficiency',
        description: 'Alert when token efficiency drops below threshold',
        metric: 'quality.tokenEfficiency',
        threshold: 0.5,
        operator: 'less_than',
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 30,
        channels: ['email']
      },
      
      high_latency: {
        id: 'high_latency',
        name: 'High Processing Latency',
        description: 'Alert when processing latency is too high',
        metric: 'quality.processingTime',
        threshold: 5000, // 5 seconds
        operator: 'greater_than',
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 15,
        channels: ['webhook']
      },
      
      // Error rate alerts
      high_error_rate: {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds threshold',
        metric: 'errors.rate',
        threshold: 0.05, // 5%
        operator: 'greater_than',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5,
        channels: ['email', 'webhook']
      },
      
      // Cache performance alerts
      low_cache_hit_rate: {
        id: 'low_cache_hit_rate',
        name: 'Low Cache Hit Rate',
        description: 'Alert when cache hit rate is too low',
        metric: 'cache.hitRate',
        threshold: 0.2, // 20%
        operator: 'less_than',
        severity: 'warning',
        enabled: true,
        cooldownMinutes: 30,
        channels: ['email']
      }
    };
    
    // Default notification channels
    this.defaultChannels = {
      email: {
        id: 'email',
        type: 'email',
        name: 'Email Notifications',
        enabled: true,
        config: {
          recipients: [process.env.ALERT_EMAIL_RECIPIENTS || 'admin@neurastack.com'],
          subject_prefix: '[NeuraStack Alert]',
          smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          }
        }
      },
      
      webhook: {
        id: 'webhook',
        type: 'webhook',
        name: 'Webhook Notifications',
        enabled: true,
        config: {
          url: process.env.ALERT_WEBHOOK_URL || 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          retries: 3
        }
      }
    };
    
    this.initialize();
  }
  
  async initialize() {
    try {
      // Initialize Firebase connection if available
      try {
        this.db = admin.firestore();
      } catch (error) {
        console.warn('⚠️ Firebase not available for alert configuration service, using memory only');
        this.db = null;
      }

      await this.loadConfigurations();
      console.log('✅ Alert configuration service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize alert configuration service:', error);
    }
  }
  
  /**
   * Load configurations from Firestore
   */
  async loadConfigurations() {
    if (!this.db) {
      // Fallback to default configurations if Firebase not available
      this.loadDefaultConfigurations();
      return;
    }

    try {
      // Load alert configurations
      const alertConfigsSnapshot = await this.db.collection('alertConfigurations').get();
      if (alertConfigsSnapshot.empty) {
        // Initialize with default configurations
        await this.initializeDefaultConfigurations();
      } else {
        alertConfigsSnapshot.forEach(doc => {
          this.alertConfigs.set(doc.id, { id: doc.id, ...doc.data() });
        });
      }

      // Load notification channels
      const channelsSnapshot = await this.db.collection('notificationChannels').get();
      if (channelsSnapshot.empty) {
        // Initialize with default channels
        await this.initializeDefaultChannels();
      } else {
        channelsSnapshot.forEach(doc => {
          this.notificationChannels.set(doc.id, { id: doc.id, ...doc.data() });
        });
      }

      console.log(`📋 Loaded ${this.alertConfigs.size} alert configurations and ${this.notificationChannels.size} notification channels`);
    } catch (error) {
      console.error('❌ Error loading configurations:', error);
      // Fallback to default configurations
      this.loadDefaultConfigurations();
    }
  }
  
  /**
   * Initialize default configurations in Firestore
   */
  async initializeDefaultConfigurations() {
    if (!this.db) {
      this.loadDefaultConfigurations();
      return;
    }

    const batch = this.db.batch();

    for (const [id, config] of Object.entries(this.defaultConfigs)) {
      const docRef = this.db.collection('alertConfigurations').doc(id);

      // Clean the config data to remove undefined values for Firestore
      const cleanedConfig = this.removeUndefinedValues({
        ...config,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.set(docRef, cleanedConfig);
      this.alertConfigs.set(id, config);
    }

    await batch.commit();
    console.log('✅ Initialized default alert configurations');
  }
  
  /**
   * Initialize default notification channels in Firestore
   */
  async initializeDefaultChannels() {
    if (!this.db) {
      for (const [id, channel] of Object.entries(this.defaultChannels)) {
        this.notificationChannels.set(id, channel);
      }
      return;
    }

    const batch = this.db.batch();

    for (const [id, channel] of Object.entries(this.defaultChannels)) {
      const docRef = this.db.collection('notificationChannels').doc(id);

      // Clean the channel data to remove undefined values for Firestore
      const cleanedChannel = this.removeUndefinedValues({
        ...channel,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.set(docRef, cleanedChannel);
      this.notificationChannels.set(id, channel);
    }

    await batch.commit();
    console.log('✅ Initialized default notification channels');
  }
  
  /**
   * Load default configurations (fallback)
   */
  loadDefaultConfigurations() {
    for (const [id, config] of Object.entries(this.defaultConfigs)) {
      this.alertConfigs.set(id, config);
    }

    for (const [id, channel] of Object.entries(this.defaultChannels)) {
      this.notificationChannels.set(id, channel);
    }

    console.log('⚠️ Using default configurations (Firestore unavailable)');
  }

  /**
   * Remove undefined values from an object recursively (for Firestore compatibility)
   */
  removeUndefinedValues(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = this.removeUndefinedValues(value);
      }
    }
    return cleaned;
  }

  /**
   * Get all alert configurations
   */
  getAllAlertConfigs() {
    return Array.from(this.alertConfigs.values());
  }

  /**
   * Get alert configuration by ID
   */
  getAlertConfig(id) {
    return this.alertConfigs.get(id);
  }

  /**
   * Get enabled alert configurations
   */
  getEnabledAlertConfigs() {
    return Array.from(this.alertConfigs.values()).filter(config => config.enabled);
  }

  /**
   * Update alert configuration
   */
  async updateAlertConfig(id, updates) {
    try {
      const existing = this.alertConfigs.get(id);
      if (!existing) {
        throw new Error(`Alert configuration ${id} not found`);
      }

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      // Update in Firestore
      await this.db.collection('alertConfigurations').doc(id).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update in memory
      this.alertConfigs.set(id, updated);

      console.log(`✅ Updated alert configuration: ${id}`);
      return updated;
    } catch (error) {
      console.error(`❌ Error updating alert configuration ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create new alert configuration
   */
  async createAlertConfig(config) {
    try {
      const id = config.id || generateUUID();
      const newConfig = {
        id,
        ...config,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to Firestore with cleaned data
      const cleanedConfig = this.removeUndefinedValues({
        ...newConfig,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await this.db.collection('alertConfigurations').doc(id).set(cleanedConfig);

      // Update in memory
      this.alertConfigs.set(id, newConfig);

      console.log(`✅ Created alert configuration: ${id}`);
      return newConfig;
    } catch (error) {
      console.error('❌ Error creating alert configuration:', error);
      throw error;
    }
  }

  /**
   * Delete alert configuration
   */
  async deleteAlertConfig(id) {
    try {
      // Delete from Firestore
      await this.db.collection('alertConfigurations').doc(id).delete();

      // Remove from memory
      this.alertConfigs.delete(id);

      console.log(`✅ Deleted alert configuration: ${id}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting alert configuration ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all notification channels
   */
  getAllNotificationChannels() {
    return Array.from(this.notificationChannels.values());
  }

  /**
   * Get notification channel by ID
   */
  getNotificationChannel(id) {
    return this.notificationChannels.get(id);
  }

  /**
   * Get enabled notification channels
   */
  getEnabledNotificationChannels() {
    return Array.from(this.notificationChannels.values()).filter(channel => channel.enabled);
  }

  /**
   * Update notification channel
   */
  async updateNotificationChannel(id, updates) {
    try {
      const existing = this.notificationChannels.get(id);
      if (!existing) {
        throw new Error(`Notification channel ${id} not found`);
      }

      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };

      // Update in Firestore
      await this.db.collection('notificationChannels').doc(id).update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update in memory
      this.notificationChannels.set(id, updated);

      console.log(`✅ Updated notification channel: ${id}`);
      return updated;
    } catch (error) {
      console.error(`❌ Error updating notification channel ${id}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate if a metric value triggers an alert
   */
  evaluateThreshold(config, value) {
    const { threshold, operator } = config;

    switch (operator) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      case 'greater_than_or_equal':
        return value >= threshold;
      case 'less_than_or_equal':
        return value <= threshold;
      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  /**
   * Get metric value from nested object path
   */
  getMetricValue(metrics, metricPath) {
    const parts = metricPath.split('.');
    let value = metrics;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }
}

module.exports = AlertConfigurationService;
