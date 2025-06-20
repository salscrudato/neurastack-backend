/**
 * Alerting System Tests
 * Comprehensive tests for the real-time alerting system
 */

const request = require('supertest');
const admin = require('firebase-admin');
const app = require('../index');
const alertConfigService = require('../services/alertConfigurationService');
const realTimeAlertEngine = require('../services/realTimeAlertEngine');
const emailNotificationService = require('../services/emailNotificationService');
const webhookNotificationService = require('../services/webhookNotificationService');

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  firestore: () => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(),
        get: jest.fn(() => Promise.resolve({ exists: false })),
        update: jest.fn(),
        delete: jest.fn()
      })),
      get: jest.fn(() => Promise.resolve({ empty: true, forEach: jest.fn() })),
      add: jest.fn(),
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ forEach: jest.fn() }))
      })),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ forEach: jest.fn() }))
        }))
      }))
    }))
  }),
  auth: () => ({
    verifyIdToken: jest.fn(() => Promise.resolve({ uid: 'test-admin-uid' }))
  }),
  FieldValue: {
    serverTimestamp: jest.fn(),
    increment: jest.fn()
  }
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransporter: jest.fn(() => ({
    verify: jest.fn(() => Promise.resolve(true)),
    sendMail: jest.fn(() => Promise.resolve({ messageId: 'test-message-id' }))
  }))
}));

// Mock axios for webhook tests
jest.mock('axios', () => jest.fn(() => Promise.resolve({ status: 200, data: 'OK' })));

describe('Alerting System', () => {
  let mockAdminToken;

  beforeAll(async () => {
    // Setup mock admin token
    mockAdminToken = 'mock-admin-token';
    
    // Mock Firestore user document for admin
    const mockUserDoc = {
      exists: true,
      data: () => ({ role: 'admin', email: 'admin@test.com' })
    };
    
    admin.firestore().collection().doc().get.mockResolvedValue(mockUserDoc);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Alert Configuration Service', () => {
    test('should load default alert configurations', () => {
      const configs = alertConfigService.getAllAlertConfigs();
      expect(configs).toBeDefined();
      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(0);
    });

    test('should get enabled alert configurations', () => {
      const enabledConfigs = alertConfigService.getEnabledAlertConfigs();
      expect(enabledConfigs).toBeDefined();
      expect(Array.isArray(enabledConfigs)).toBe(true);
      enabledConfigs.forEach(config => {
        expect(config.enabled).toBe(true);
      });
    });

    test('should evaluate thresholds correctly', () => {
      const config = {
        threshold: 100,
        operator: 'greater_than'
      };

      expect(alertConfigService.evaluateThreshold(config, 150)).toBe(true);
      expect(alertConfigService.evaluateThreshold(config, 50)).toBe(false);
      expect(alertConfigService.evaluateThreshold(config, 100)).toBe(false);
    });

    test('should get metric values from nested paths', () => {
      const metrics = {
        memory: {
          heapUsed: 500000000
        },
        performance: {
          p95ResponseTime: 2500
        }
      };

      expect(alertConfigService.getMetricValue(metrics, 'memory.heapUsed')).toBe(500000000);
      expect(alertConfigService.getMetricValue(metrics, 'performance.p95ResponseTime')).toBe(2500);
      expect(alertConfigService.getMetricValue(metrics, 'nonexistent.path')).toBe(null);
    });
  });

  describe('Email Notification Service', () => {
    test('should get delivery statistics', () => {
      const stats = emailNotificationService.getDeliveryStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('sent');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('isConfigured');
    });

    test('should handle unconfigured SMTP gracefully', async () => {
      const mockAlert = {
        id: 'test-alert',
        name: 'Test Alert',
        severity: 'warning',
        currentValue: 150,
        threshold: 100
      };

      const mockChannel = {
        config: {
          recipients: ['test@example.com']
        }
      };

      const result = await emailNotificationService.sendAlert(mockAlert, mockChannel);
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe('Webhook Notification Service', () => {
    test('should get delivery statistics', () => {
      const stats = webhookNotificationService.getDeliveryStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('sent');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('retries');
    });

    test('should validate webhook URLs', () => {
      const validUrl = 'https://hooks.slack.com/services/test';
      const invalidUrl = 'not-a-url';

      const validResult = webhookNotificationService.validateWebhookUrl(validUrl);
      expect(validResult.valid).toBe(true);
      expect(validResult.protocol).toBe('https:');

      const invalidResult = webhookNotificationService.validateWebhookUrl(invalidUrl);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });

    test('should create proper alert payloads', () => {
      const mockAlert = {
        id: 'test-alert',
        name: 'Test Alert',
        description: 'Test alert description',
        severity: 'critical',
        metric: 'memory.heapUsed',
        currentValue: 600000000,
        threshold: 500000000,
        operator: 'greater_than',
        triggeredAt: new Date(),
        status: 'active'
      };

      const payload = webhookNotificationService.createAlertPayload(mockAlert);
      
      expect(payload).toBeDefined();
      expect(payload.type).toBe('alert_triggered');
      expect(payload.alert).toBeDefined();
      expect(payload.alert.id).toBe(mockAlert.id);
      expect(payload.alert.severity).toBe(mockAlert.severity);
      expect(payload.system).toBeDefined();
      expect(payload.links).toBeDefined();
    });
  });

  describe('Real-time Alert Engine', () => {
    test('should get alert statistics', () => {
      const stats = realTimeAlertEngine.getStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalAlertsTriggered');
      expect(stats).toHaveProperty('totalAlertsResolved');
      expect(stats).toHaveProperty('activeAlertsCount');
      expect(stats).toHaveProperty('isRunning');
    });

    test('should get active alerts', () => {
      const activeAlerts = realTimeAlertEngine.getActiveAlerts();
      expect(Array.isArray(activeAlerts)).toBe(true);
    });

    test('should handle cooldown tracking', () => {
      const configId = 'test-config';
      
      // Initially not in cooldown
      expect(realTimeAlertEngine.isInCooldown(configId)).toBe(false);
      
      // Set cooldown
      realTimeAlertEngine.setCooldown(configId, 1); // 1 minute
      expect(realTimeAlertEngine.isInCooldown(configId)).toBe(true);
    });
  });

  describe('Alert API Endpoints', () => {
    test('GET /api/alerts/configs should return alert configurations', async () => {
      const response = await request(app)
        .get('/api/alerts/configs')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('GET /api/alerts/channels should return notification channels', async () => {
      const response = await request(app)
        .get('/api/alerts/channels')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('GET /api/alerts/active should return active alerts', async () => {
      const response = await request(app)
        .get('/api/alerts/active')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('GET /api/alerts/status should return alert engine status', async () => {
      const response = await request(app)
        .get('/api/alerts/status')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.engine).toBeDefined();
      expect(response.body.data.notifications).toBeDefined();
    });

    test('POST /api/alerts/test/webhook should test webhook', async () => {
      const testPayload = {
        url: 'https://hooks.slack.com/services/test',
        payload: { test: true }
      };

      const response = await request(app)
        .post('/api/alerts/test/webhook')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send(testPayload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('should require admin authentication', async () => {
      await request(app)
        .get('/api/alerts/configs')
        .expect(401);

      await request(app)
        .get('/api/alerts/configs')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete alert lifecycle', async () => {
      // This would be a more complex integration test
      // that tests the full alert lifecycle from trigger to resolution
      const mockMetrics = {
        memory: { heapUsed: 600000000 }, // Above threshold
        cost: { daily: 15.0 }, // Above threshold
        performance: { p95ResponseTime: 3000 }
      };

      // Mock the metrics collection
      jest.spyOn(realTimeAlertEngine, 'collectMetrics').mockResolvedValue(mockMetrics);

      // Evaluate alerts
      await realTimeAlertEngine.evaluateAllAlerts();

      // Check that alerts were processed
      const stats = realTimeAlertEngine.getStats();
      expect(stats.evaluationCount).toBeGreaterThan(0);
    });
  });
});
