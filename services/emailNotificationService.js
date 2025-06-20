/**
 * Email Notification Service
 * Handles email notifications for alerts using nodemailer
 */

const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const moment = require('moment');
const admin = require('firebase-admin');

class EmailNotificationService {
  constructor() {
    this.db = null;
    this.transporter = null;
    this.isConfigured = false;
    this.deliveryStats = {
      sent: 0,
      failed: 0,
      lastSent: null,
      lastError: null
    };
    
    // Email templates
    this.templates = {
      alert: this.createAlertTemplate(),
      alertResolved: this.createAlertResolvedTemplate(),
      summary: this.createSummaryTemplate()
    };
    
    this.initialize();
  }
  
  async initialize() {
    try {
      // Initialize Firebase connection if available
      try {
        this.db = admin.firestore();
      } catch (error) {
        console.warn('⚠️ Firebase not available for email notification service');
        this.db = null;
      }

      await this.setupTransporter();
      console.log('✅ Email notification service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize email notification service:', error);
    }
  }
  
  /**
   * Setup nodemailer transporter
   */
  async setupTransporter() {
    try {
      const smtpConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false
        }
      };
      
      if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
        console.warn('⚠️ SMTP credentials not configured - email notifications disabled');
        return;
      }
      
      this.transporter = nodemailer.createTransporter(smtpConfig);
      
      // Verify connection
      await this.transporter.verify();
      this.isConfigured = true;
      
      console.log(`✅ SMTP connection verified: ${smtpConfig.host}:${smtpConfig.port}`);
    } catch (error) {
      console.error('❌ SMTP setup failed:', error.message);
      this.isConfigured = false;
    }
  }
  
  /**
   * Send alert notification email
   */
  async sendAlert(alert, channel) {
    if (!this.isConfigured) {
      console.warn('⚠️ Email service not configured - skipping email notification');
      return { success: false, error: 'Email service not configured' };
    }
    
    try {
      const template = this.templates.alert;
      const html = template({
        alert,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss UTC'),
        dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:8080/monitor'
      });
      
      const subject = `${channel.config.subject_prefix || '[NeuraStack Alert]'} ${alert.severity.toUpperCase()}: ${alert.name}`;
      
      const mailOptions = {
        from: `"NeuraStack Alerts" <${process.env.SMTP_USER}>`,
        to: channel.config.recipients.join(', '),
        subject,
        html,
        priority: alert.severity === 'critical' ? 'high' : 'normal'
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      
      // Track delivery
      this.deliveryStats.sent++;
      this.deliveryStats.lastSent = new Date();
      
      // Log delivery
      await this.logEmailDelivery(alert.id, 'sent', result.messageId);
      
      console.log(`📧 Alert email sent: ${alert.name} (${result.messageId})`);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      this.deliveryStats.failed++;
      this.deliveryStats.lastError = error.message;
      
      // Log failure
      await this.logEmailDelivery(alert.id, 'failed', null, error.message);
      
      console.error('❌ Failed to send alert email:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send alert resolved notification
   */
  async sendAlertResolved(alert, channel) {
    if (!this.isConfigured) {
      return { success: false, error: 'Email service not configured' };
    }
    
    try {
      const template = this.templates.alertResolved;
      const html = template({
        alert,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss UTC'),
        duration: alert.resolvedAt ? moment(alert.resolvedAt).diff(moment(alert.triggeredAt), 'minutes') : 0,
        dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:8080/monitor'
      });
      
      const subject = `${channel.config.subject_prefix || '[NeuraStack Alert]'} RESOLVED: ${alert.name}`;
      
      const mailOptions = {
        from: `"NeuraStack Alerts" <${process.env.SMTP_USER}>`,
        to: channel.config.recipients.join(', '),
        subject,
        html
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      
      this.deliveryStats.sent++;
      this.deliveryStats.lastSent = new Date();
      
      await this.logEmailDelivery(alert.id, 'resolved_sent', result.messageId);
      
      console.log(`📧 Alert resolved email sent: ${alert.name} (${result.messageId})`);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      this.deliveryStats.failed++;
      this.deliveryStats.lastError = error.message;
      
      await this.logEmailDelivery(alert.id, 'resolved_failed', null, error.message);
      
      console.error('❌ Failed to send alert resolved email:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send daily summary email
   */
  async sendDailySummary(summary, recipients) {
    if (!this.isConfigured) {
      return { success: false, error: 'Email service not configured' };
    }
    
    try {
      const template = this.templates.summary;
      const html = template({
        summary,
        date: moment().format('YYYY-MM-DD'),
        dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:8080/monitor'
      });
      
      const mailOptions = {
        from: `"NeuraStack Reports" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: `[NeuraStack] Daily Alert Summary - ${moment().format('YYYY-MM-DD')}`,
        html
      };
      
      const result = await this.transporter.sendMail(mailOptions);
      
      this.deliveryStats.sent++;
      this.deliveryStats.lastSent = new Date();
      
      console.log(`📧 Daily summary email sent (${result.messageId})`);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      this.deliveryStats.failed++;
      this.deliveryStats.lastError = error.message;
      
      console.error('❌ Failed to send daily summary email:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Log email delivery to Firestore
   */
  async logEmailDelivery(alertId, status, messageId, error = null) {
    if (!this.db) {
      return; // Skip logging if Firebase not available
    }

    try {
      await this.db.collection('emailDeliveryLogs').add({
        alertId,
        status,
        messageId,
        error,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          service: 'neurastack-backend',
          version: '2.0'
        }
      });
    } catch (err) {
      console.error('❌ Failed to log email delivery:', err);
    }
  }
  
  /**
   * Get delivery statistics
   */
  getDeliveryStats() {
    return {
      ...this.deliveryStats,
      isConfigured: this.isConfigured,
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: parseInt(process.env.SMTP_PORT) || 587
    };
  }
  
  /**
   * Test email configuration
   */
  async testConfiguration(testEmail) {
    if (!this.isConfigured) {
      throw new Error('Email service not configured');
    }

    try {
      const mailOptions = {
        from: `"NeuraStack Test" <${process.env.SMTP_USER}>`,
        to: testEmail,
        subject: '[NeuraStack] Email Configuration Test',
        html: `
          <h2>NeuraStack Email Test</h2>
          <p>This is a test email to verify your email configuration.</p>
          <p><strong>Timestamp:</strong> ${moment().format('YYYY-MM-DD HH:mm:ss UTC')}</p>
          <p><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</p>
          <p><strong>SMTP Port:</strong> ${process.env.SMTP_PORT}</p>
          <p>If you received this email, your configuration is working correctly!</p>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      throw new Error(`Email test failed: ${error.message}`);
    }
  }

  /**
   * Create alert email template
   */
  createAlertTemplate() {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NeuraStack Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
          .alert-critical { border-left: 5px solid #dc3545; }
          .alert-warning { border-left: 5px solid #ffc107; }
          .alert-info { border-left: 5px solid #17a2b8; }
          .severity { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; text-transform: uppercase; }
          .severity-critical { background: #dc3545; color: white; }
          .severity-warning { background: #ffc107; color: #212529; }
          .severity-info { background: #17a2b8; color: white; }
          .metric-value { font-size: 24px; font-weight: bold; color: #dc3545; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container alert-{{alert.severity}}">
          <div class="header">
            <h1>🚨 NeuraStack Alert</h1>
            <p>{{alert.name}}</p>
          </div>

          <div style="margin: 20px 0;">
            <span class="severity severity-{{alert.severity}}">{{alert.severity}}</span>
          </div>

          <h2>Alert Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Alert Name:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{alert.name}}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Description:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{alert.description}}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Metric:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{alert.metric}}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Current Value:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;"><span class="metric-value">{{alert.currentValue}}</span></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Threshold:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{alert.threshold}}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Triggered At:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{timestamp}}</td></tr>
          </table>

          <div style="margin: 30px 0; text-align: center;">
            <a href="{{dashboardUrl}}" class="button">View Dashboard</a>
          </div>

          <div class="footer">
            <p>This alert was generated by NeuraStack monitoring system.</p>
            <p>Dashboard: <a href="{{dashboardUrl}}">{{dashboardUrl}}</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return handlebars.compile(template);
  }

  /**
   * Create alert resolved email template
   */
  createAlertResolvedTemplate() {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NeuraStack Alert Resolved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 5px solid #28a745; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Alert Resolved</h1>
            <p>{{alert.name}}</p>
          </div>

          <h2>Resolution Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Alert Name:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{alert.name}}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Duration:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{duration}} minutes</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Resolved At:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">{{timestamp}}</td></tr>
          </table>

          <div style="margin: 30px 0; text-align: center;">
            <a href="{{dashboardUrl}}" class="button">View Dashboard</a>
          </div>

          <div class="footer">
            <p>This notification was generated by NeuraStack monitoring system.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return handlebars.compile(template);
  }

  /**
   * Create daily summary email template
   */
  createSummaryTemplate() {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>NeuraStack Daily Summary</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px -20px; }
          .stat-box { display: inline-block; background: #f8f9fa; padding: 15px; margin: 10px; border-radius: 8px; text-align: center; min-width: 120px; }
          .stat-number { font-size: 24px; font-weight: bold; color: #007bff; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Daily Alert Summary</h1>
            <p>{{date}}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <div class="stat-box">
              <div class="stat-number">{{summary.totalAlerts}}</div>
              <div>Total Alerts</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{{summary.criticalAlerts}}</div>
              <div>Critical</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{{summary.warningAlerts}}</div>
              <div>Warnings</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">{{summary.resolvedAlerts}}</div>
              <div>Resolved</div>
            </div>
          </div>

          <div style="margin: 30px 0; text-align: center;">
            <a href="{{dashboardUrl}}" class="button">View Full Dashboard</a>
          </div>

          <div class="footer">
            <p>This summary was generated by NeuraStack monitoring system.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return handlebars.compile(template);
  }
}

module.exports = EmailNotificationService;
