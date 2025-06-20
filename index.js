const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const serviceAccount = require('./serviceAccountKey.json');
const healthRoutes = require('./routes/health');
const memoryRoutes = require('./routes/memory');
const authRoutes = require('./routes/auth');
const modelsRoutes = require('./routes/models');
const securityRoutes = require('./routes/security');
const dashboardRoutes = require('./routes/dashboard');
const cacheRoutes = require('./routes/cache');
const monitorRoutes = require('./routes/monitor');
const enhancedEnsembleRoutes = require('./routes/enhanced-ensemble');
const statusRoutes = require('./routes/status');
const alertsRoutes = require('./routes/alerts');
const MemoryLifecycleManager = require('./services/memoryLifecycle');
const monitoringService = require('./services/monitoringService');
const cacheService = require('./services/cacheService');
const RealTimeAlertEngine = require('./services/realTimeAlertEngine');
const authenticationService = require('./services/authenticationService');
const securityMiddleware = require('./middleware/securityMiddleware');
const advancedRateLimitingService = require('./services/advancedRateLimitingService');
const auditLoggingService = require('./services/auditLoggingService');
const inputValidationMiddleware = require('./middleware/inputValidationMiddleware');
const csrfProtection = require('./middleware/csrfProtection');
const performanceMonitoringService = require('./services/performanceMonitoringService');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'neurastack-backend-bucket1.appspot.com',
});

// Initialize memory lifecycle manager
const memoryLifecycleManager = new MemoryLifecycleManager();

const app = express();
const PORT = process.env.PORT || 8080;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001',
    'https://neurastack.ai',
    'https://www.neurastack.ai',
    'https://neurastack-frontend.web.app',
    /^https:\/\/.*\.vercel\.app$/,
    /^https:\/\/.*\.netlify\.app$/,
    /^https:\/\/.*\.firebase\.app$/,
    /^https:\/\/.*\.web\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id', 'X-Session-Id', 'X-Correlation-ID']
};

// Security middleware (must be first)
app.use(securityMiddleware.securityHeaders());
app.use(securityMiddleware.requestSizeLimit());
app.use(securityMiddleware.ipSecurityCheck());
app.use(securityMiddleware.requestFingerprinting());
app.use(inputValidationMiddleware.validateCSP());

// CSRF protection (provide tokens for all requests)
app.use(csrfProtection.provideToken());

// CORS and basic middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Authentication middleware (optional for most endpoints)
app.use(authenticationService.optionalAuth());

// Add monitoring middleware for request tracking
app.use(monitoringService.middleware());
app.use(performanceMonitoringService.middleware());

// Error handling middleware
app.use((err, req, res, next) => {
  const correlationId = req.correlationId || 'unknown';

  monitoringService.log('error', 'Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  }, correlationId);

  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    correlationId,
    timestamp: new Date().toISOString()
  });
});

app.use('/', healthRoutes);
app.use('/memory', memoryRoutes);
app.use('/auth', authRoutes);
app.use('/models', modelsRoutes);
app.use('/security', securityRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/cache', cacheRoutes);
app.use('/monitor', monitorRoutes);
app.use('/api', enhancedEnsembleRoutes);
app.use('/status', statusRoutes);
app.use('/api/alerts', alertsRoutes);

// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 Neurastack backend v2.0 running at http://localhost:${PORT}`);
    console.log(`📊 Enhanced monitoring and logging enabled`);
    console.log(`🔄 Circuit breakers and resilience patterns active`);

    // Start memory lifecycle management
    memoryLifecycleManager.start();
    console.log('🧠 Memory management system initialized');

    // Start real-time alert engine
    try {
      const realTimeAlertEngine = new RealTimeAlertEngine();
      await realTimeAlertEngine.start();
      console.log('🚨 Real-time alert engine initialized');

      // Store reference for graceful shutdown
      global.realTimeAlertEngine = realTimeAlertEngine;
    } catch (error) {
      console.error('❌ Failed to start alert engine:', error.message);
    }

    // Log startup metrics
    monitoringService.log('info', 'Neurastack backend started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      version: '2.0',
      features: [
        'Enhanced ensemble processing',
        'Circuit breaker patterns',
        'Structured logging',
        'Performance monitoring',
        'Memory management',
        'Connection pooling',
        'Response caching',
        'Real-time alerting system'
      ]
    });

    // Graceful shutdown handling
    process.on('SIGTERM', async () => {
      console.log('🔄 Received SIGTERM, shutting down gracefully...');
      await gracefulShutdown();
    });

    process.on('SIGINT', async () => {
      console.log('🔄 Received SIGINT, shutting down gracefully...');
      await gracefulShutdown();
    });
  });
}

// Graceful shutdown function
async function gracefulShutdown() {
  try {
    if (global.realTimeAlertEngine) {
      console.log('🔄 Stopping real-time alert engine...');
      global.realTimeAlertEngine.stop();
    }

    console.log('🔄 Stopping memory lifecycle manager...');
    memoryLifecycleManager.stop();

    console.log('🔄 Closing cache connections...');
    await cacheService.shutdown();

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
}

module.exports = app;