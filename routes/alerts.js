/**
 * Alert Management API Routes
 * Provides REST API endpoints for managing alerts, configurations, and notification channels
 */

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const monitoringService = require('../services/monitoringService');

// Helper function to get alert engine instance
function getAlertEngine() {
  return global.realTimeAlertEngine;
}

// Helper function to get services from alert engine
function getAlertServices() {
  const engine = getAlertEngine();
  if (!engine) {
    throw new Error('Alert engine not initialized');
  }
  return {
    alertConfigService: engine.alertConfigService,
    emailNotificationService: engine.emailNotificationService,
    webhookNotificationService: engine.webhookNotificationService
  };
}

// Middleware for admin authentication
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // Check if user is admin
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = { uid: userId, ...userDoc.data() };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// ===== ALERT CONFIGURATIONS =====

/**
 * GET /api/alerts/configs
 * Get all alert configurations
 */
router.get('/configs', requireAdmin, (req, res) => {
  try {
    const { alertConfigService } = getAlertServices();
    const configs = alertConfigService.getAllAlertConfigs();
    res.json({
      success: true,
      data: configs,
      count: configs.length
    });
  } catch (error) {
    console.error('Error getting alert configs:', error);
    res.status(500).json({ error: 'Failed to get alert configurations' });
  }
});

/**
 * GET /api/alerts/configs/:id
 * Get specific alert configuration
 */
router.get('/configs/:id', requireAdmin, (req, res) => {
  try {
    const config = alertConfigService.getAlertConfig(req.params.id);
    if (!config) {
      return res.status(404).json({ error: 'Alert configuration not found' });
    }
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error getting alert config:', error);
    res.status(500).json({ error: 'Failed to get alert configuration' });
  }
});

/**
 * POST /api/alerts/configs
 * Create new alert configuration
 */
router.post('/configs', requireAdmin, async (req, res) => {
  try {
    const config = await alertConfigService.createAlertConfig(req.body);
    
    monitoringService.log('info', 'Alert configuration created', {
      configId: config.id,
      name: config.name,
      createdBy: req.user.uid
    });
    
    res.status(201).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error creating alert config:', error);
    res.status(500).json({ error: 'Failed to create alert configuration' });
  }
});

/**
 * PUT /api/alerts/configs/:id
 * Update alert configuration
 */
router.put('/configs/:id', requireAdmin, async (req, res) => {
  try {
    const config = await alertConfigService.updateAlertConfig(req.params.id, req.body);
    
    monitoringService.log('info', 'Alert configuration updated', {
      configId: req.params.id,
      updatedBy: req.user.uid
    });
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error updating alert config:', error);
    res.status(500).json({ error: error.message || 'Failed to update alert configuration' });
  }
});

/**
 * DELETE /api/alerts/configs/:id
 * Delete alert configuration
 */
router.delete('/configs/:id', requireAdmin, async (req, res) => {
  try {
    await alertConfigService.deleteAlertConfig(req.params.id);
    
    monitoringService.log('info', 'Alert configuration deleted', {
      configId: req.params.id,
      deletedBy: req.user.uid
    });
    
    res.json({
      success: true,
      message: 'Alert configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting alert config:', error);
    res.status(500).json({ error: error.message || 'Failed to delete alert configuration' });
  }
});

// ===== NOTIFICATION CHANNELS =====

/**
 * GET /api/alerts/channels
 * Get all notification channels
 */
router.get('/channels', requireAdmin, (req, res) => {
  try {
    const channels = alertConfigService.getAllNotificationChannels();
    res.json({
      success: true,
      data: channels,
      count: channels.length
    });
  } catch (error) {
    console.error('Error getting notification channels:', error);
    res.status(500).json({ error: 'Failed to get notification channels' });
  }
});

/**
 * GET /api/alerts/channels/:id
 * Get specific notification channel
 */
router.get('/channels/:id', requireAdmin, (req, res) => {
  try {
    const channel = alertConfigService.getNotificationChannel(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Notification channel not found' });
    }
    
    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error getting notification channel:', error);
    res.status(500).json({ error: 'Failed to get notification channel' });
  }
});

/**
 * PUT /api/alerts/channels/:id
 * Update notification channel
 */
router.put('/channels/:id', requireAdmin, async (req, res) => {
  try {
    const channel = await alertConfigService.updateNotificationChannel(req.params.id, req.body);
    
    monitoringService.log('info', 'Notification channel updated', {
      channelId: req.params.id,
      updatedBy: req.user.uid
    });
    
    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error updating notification channel:', error);
    res.status(500).json({ error: error.message || 'Failed to update notification channel' });
  }
});

// ===== ACTIVE ALERTS =====

/**
 * GET /api/alerts/active
 * Get all active alerts
 */
router.get('/active', requireAdmin, (req, res) => {
  try {
    const alerts = realTimeAlertEngine.getActiveAlerts();
    res.json({
      success: true,
      data: alerts,
      count: alerts.length
    });
  } catch (error) {
    console.error('Error getting active alerts:', error);
    res.status(500).json({ error: 'Failed to get active alerts' });
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/:id/acknowledge', requireAdmin, async (req, res) => {
  try {
    const alert = await realTimeAlertEngine.acknowledgeAlert(req.params.id, req.user.uid);
    
    monitoringService.log('info', 'Alert acknowledged', {
      alertId: req.params.id,
      acknowledgedBy: req.user.uid
    });
    
    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: error.message || 'Failed to acknowledge alert' });
  }
});

// ===== ALERT HISTORY =====

/**
 * GET /api/alerts/history
 * Get alert history
 */
router.get('/history', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const status = req.query.status || null;
    
    const alerts = await realTimeAlertEngine.getAlertHistory(limit, status);
    
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
      filters: { limit, status }
    });
  } catch (error) {
    console.error('Error getting alert history:', error);
    res.status(500).json({ error: 'Failed to get alert history' });
  }
});

// ===== ALERT ENGINE STATUS =====

/**
 * GET /api/alerts/status
 * Get alert engine status and statistics
 */
router.get('/status', requireAdmin, (req, res) => {
  try {
    const stats = realTimeAlertEngine.getStats();
    const emailStats = emailNotificationService.getDeliveryStats();
    const webhookStats = webhookNotificationService.getDeliveryStats();
    
    res.json({
      success: true,
      data: {
        engine: stats,
        notifications: {
          email: emailStats,
          webhook: webhookStats
        }
      }
    });
  } catch (error) {
    console.error('Error getting alert status:', error);
    res.status(500).json({ error: 'Failed to get alert status' });
  }
});

/**
 * POST /api/alerts/engine/start
 * Start the alert engine
 */
router.post('/engine/start', requireAdmin, async (req, res) => {
  try {
    await realTimeAlertEngine.start();
    
    monitoringService.log('info', 'Alert engine started', {
      startedBy: req.user.uid
    });
    
    res.json({
      success: true,
      message: 'Alert engine started successfully'
    });
  } catch (error) {
    console.error('Error starting alert engine:', error);
    res.status(500).json({ error: 'Failed to start alert engine' });
  }
});

/**
 * POST /api/alerts/engine/stop
 * Stop the alert engine
 */
router.post('/engine/stop', requireAdmin, (req, res) => {
  try {
    realTimeAlertEngine.stop();

    monitoringService.log('info', 'Alert engine stopped', {
      stoppedBy: req.user.uid
    });

    res.json({
      success: true,
      message: 'Alert engine stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping alert engine:', error);
    res.status(500).json({ error: 'Failed to stop alert engine' });
  }
});

// ===== NOTIFICATION TESTING =====

/**
 * POST /api/alerts/test/email
 * Test email notification
 */
router.post('/test/email', requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }

    const result = await emailNotificationService.testConfiguration(email);

    monitoringService.log('info', 'Email test sent', {
      email,
      testedBy: req.user.uid,
      messageId: result.messageId
    });

    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: error.message || 'Failed to send test email' });
  }
});

/**
 * POST /api/alerts/test/webhook
 * Test webhook notification
 */
router.post('/test/webhook', requireAdmin, async (req, res) => {
  try {
    const { url, payload } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Webhook URL required' });
    }

    const result = await webhookNotificationService.sendTestWebhook(url, payload);

    monitoringService.log('info', 'Webhook test sent', {
      url,
      testedBy: req.user.uid,
      success: result.success
    });

    res.json({
      success: true,
      message: 'Test webhook sent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error sending test webhook:', error);
    res.status(500).json({ error: error.message || 'Failed to send test webhook' });
  }
});

/**
 * GET /api/alerts/delivery-logs
 * Get recent delivery logs
 */
router.get('/delivery-logs', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const webhookLogs = await webhookNotificationService.getRecentDeliveryLogs(limit);

    res.json({
      success: true,
      data: {
        webhook: webhookLogs,
        email: emailNotificationService.getDeliveryStats()
      }
    });
  } catch (error) {
    console.error('Error getting delivery logs:', error);
    res.status(500).json({ error: 'Failed to get delivery logs' });
  }
});

module.exports = router;
