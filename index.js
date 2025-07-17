/**
 * NeuraStack Backend Server - Main Entry Point
 *
 * 🎯 PURPOSE: Central hub for NeuraStack AI system. Optimized for low-cost, scalable operation (~500 req/day, $200/model budget using low-priced models like GPT-4o-mini, Gemini Flash, Claude Haiku).
 *
 * 📋 EXECUTION FLOW (Simplified):
 * 1. Load env vars
 * 2. Init Firebase (streamlined with env priority)
 * 3. Set up Express with optimized middleware (added compression for UX)
 * 4. Register routes
 * 5. Start server and essential background services
 *
 * 🔧 OPTIMIZATIONS:
 * - Simplified Firebase init for faster startup.
 * - Added response compression for better performance.
 * - Consolidated logging to reduce noise.
 * - Ensured low-cost by making Firebase optional (local cache fallback).
 * - Prepared for production scalability.
 */

// ============================================================================
// 🔧 STEP 1: ENVIRONMENT SETUP
// ============================================================================
require('dotenv').config();

// ============================================================================
// 📦 STEP 2: CORE DEPENDENCIES
// ============================================================================
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const compression = require('compression'); // Added for response optimization (free, improves UX)

// ============================================================================
// 📝 STEP 3: ENHANCED LOGGING (Consolidated)
// ============================================================================
const logger = require('./utils/visualLogger');
logger.header('NEURASTACK BACKEND V2.1', 'Optimized AI Ensemble System', 'rocket'); // Consolidated startup logs here
logger.info(`Node.js: ${process.version} | Env: ${process.env.NODE_ENV || 'development'} | Port: ${process.env.PORT || 8080}`, {}, 'startup');

// ============================================================================
// 🔥 STEP 4: FIREBASE SETUP (Simplified: Prioritize env vars, inline fallback)
// ============================================================================
/**
 * Simplified Firebase init: Uses env vars first (prod), service account file second (dev). Falls back to local cache if fails.
 */
function initializeFirebase() {
  if (admin.apps.length > 0) {
    logger.info('Firebase already initialized - skipping', {}, 'firebase');
    return;
  }

  let credential;
  try {
    // Prod: Env vars
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      });
      logger.info('Using Firebase env vars (prod)', {}, 'firebase');
    } else {
      // Dev: Service account file
      const serviceAccount = require('./config/firebase-service-account.json');
      credential = admin.credential.cert(serviceAccount);
      logger.info('Using Firebase service account file (dev)', {}, 'firebase');
    }

    admin.initializeApp({
      credential,
      projectId: process.env.FIREBASE_PROJECT_ID || 'neurastack-backend',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'neurastack-backend.firebasestorage.app',
    });

    logger.success('Firebase initialized', { Project: process.env.FIREBASE_PROJECT_ID }, 'firebase');
  } catch (error) {
    logger.warning('Firebase init failed - Using local cache only (low-cost fallback)', { Error: error.message }, 'firebase');
    // No exit; continue with local cache for memory/workouts to keep costs low
  }
}

logger.info('Initializing Firebase...', {}, 'firebase');
initializeFirebase();

// ============================================================================
// 🔧 STEP 5: SERVICE IMPORTS (After Firebase)
// ============================================================================
const healthRoutes = require('./routes/health');
const memoryRoutes = require('./routes/memory');
const adminRoutes = require('./routes/admin');
const tierRoutes = require('./routes/tiers');

const MemoryLifecycleManager = require('./services/memoryLifecycle');
const monitoringService = require('./services/monitoringService');
const { attachUserTier, logTierUsage } = require('./middleware/tierMiddleware');
const cacheService = require('./services/cacheService');
const securityMiddleware = require('./middleware/securityMiddleware');
const HealthMonitor = require('./services/healthMonitor');

// ============================================================================
// 🚀 STEP 6: EXPRESS SETUP (Optimized with compression)
// ============================================================================
const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8080;

// Background services (essential only; health monitor optional in dev)
const memoryLifecycleManager = new MemoryLifecycleManager();

// CORS config (unchanged, but simplified array)
const corsOptions = {
  origin: [
    'http://localhost:3000', 'http://localhost:3001', 'https://localhost:3000', 'https://localhost:3001',
    'https://neurastack.ai', 'https://www.neurastack.ai',
    'https://neurastack-frontend.web.app', /^https:\/\/.*\.vercel\.app$/, /^https:\/\/.*\.netlify\.app$/,
    /^https:\/\/.*\.firebase\.app$/, /^https:\/\/.*\.web\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id', 'X-Session-Id', 'X-Correlation-ID', 'Cache-Control']
};

// Middleware pipeline (order critical; added compression for perf)
app.use(securityMiddleware.securityHeaders()); // First: Security
app.use(compression()); // Added: Compress responses for faster UX (free)
app.use(securityMiddleware.createRateLimit({ // Rate limit (tier-aware downstream)
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  message: { error: 'Rate limit exceeded', retryAfter: 900 }
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.REQUEST_BODY_LIMIT || '10mb' }));

// Tier middleware (after body parsing, before routes)
app.use(attachUserTier); // Automatically determine user tier for all requests
app.use(logTierUsage);   // Log tier usage for analytics
app.use(monitoringService.middleware());

// Global error handler (simplified: removed unused _next)
app.use((err, req, res, next) => {
  const correlationId = req.correlationId || 'unknown';
  monitoringService.log('error', 'Unhandled error', { error: err.message, url: req.url, method: req.method }, correlationId);
  res.status(500).json({ status: 'error', message: 'Internal server error', correlationId, timestamp: new Date().toISOString() });
});

// ============================================================================
// 🛣️ STEP 7: ROUTES
// ============================================================================
app.use('/', healthRoutes);
app.use('/memory', memoryRoutes);
app.use('/admin', adminRoutes);
app.use('/tiers', tierRoutes);

// ============================================================================
// SERVER STARTUP (If run directly)
// ============================================================================
if (require.main === module) {
  // Validate API keys (essential for low-cost models)
  const requiredEnvVars = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'CLAUDE_API_KEY'];
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    logger.error('Missing API keys', { Missing: missing.join(', ') }, 'startup');
    process.exit(1);
  }

  const server = app.listen(PORT, async () => {
    logger.success(`Server running on port ${PORT}`, { Env: process.env.NODE_ENV || 'development', PID: process.pid }, 'startup');

    // Init background services (simplified)
    memoryLifecycleManager.start();
    logger.success('Memory manager active', {}, 'memory');

    const healthMonitor = new HealthMonitor();
    if (process.env.NODE_ENV !== 'development') { // Optional in dev to reduce overhead
      healthMonitor.startMonitoring(30000);
      app.locals.healthMonitor = healthMonitor;
      logger.success('Health monitoring active (every 30s)', {}, 'health');
    }

    // Intelligent forgetting (from original)
    const { getMemoryManager } = require('./services/memoryManager');
    getMemoryManager().scheduleIntelligentForgetting(24);
    logger.success('Intelligent forgetting active (24h)', {}, 'memory');

    // System capabilities log (simplified)
    logger.info('System ready: AI Ensemble (low-cost models), Memory, Monitoring, Caching, Security', {}, 'system');

    // Graceful shutdown (unchanged but simplified function calls)
    setupGracefulShutdown(server);
  });
}

/**
 * Graceful shutdown (simplified: combined handlers)
 */
function setupGracefulShutdown(server) {
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.warning(`Received ${signal} - Shutting down`, {}, 'shutdown');
      await gracefulShutdown(server);
    });
  });

  process.on('uncaughtException', error => {
    logger.error('Uncaught Exception - Emergency shutdown', { Error: error.message }, 'shutdown');
    gracefulShutdown(server, true);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection - Emergency shutdown', { Reason: reason }, 'shutdown');
    gracefulShutdown(server, true);
  });
}

/**
 * Perform shutdown (simplified: timeout inline)
 */
async function gracefulShutdown(server, emergency = false) {
  const timeout = parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 30000;
  logger.info(`${emergency ? 'Emergency' : 'Graceful'} shutdown started`, { Timeout: `${timeout}ms` }, 'shutdown');

  const shutdownTimer = setTimeout(() => {
    logger.error('Shutdown timeout - Forcing exit', {}, 'shutdown');
    process.exit(1);
  }, timeout);

  try {
    // Stop server
    server?.close(() => logger.success('Server closed', {}, 'shutdown'));

    // Stop services
    memoryLifecycleManager.stop();
    await cacheService.shutdown();
    logger.success('Services stopped', {}, 'shutdown');

    clearTimeout(shutdownTimer);
    process.exit(0);
  } catch (error) {
    logger.error('Shutdown error', { Error: error.message }, 'shutdown');
    process.exit(1);
  }
}

module.exports = app;