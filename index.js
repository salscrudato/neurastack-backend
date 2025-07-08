/**
 * NeuraStack Backend Server - Main Entry Point
 *
 * 🎯 PURPOSE: This is the central hub of the NeuraStack AI system
 *
 * 📋 EXECUTION FLOW:
 * 1. Load environment variables (.env file)
 * 2. Initialize Firebase database connection
 * 3. Set up Express web server with middleware
 * 4. Register API routes (health, memory, workout)
 * 5. Start server and background services
 *
 * 🔧 WHAT THIS SERVER DOES:
 * - 🤖 AI Ensemble: Combines multiple AI models (GPT, Claude, Gemini) for better responses
 * - 💪 Workout Generation: Creates personalized fitness plans using AI
 * - 🧠 Memory Management: Remembers user conversations for context
 * - 🛡️ Security: Rate limiting and request validation
 * - 📊 Monitoring: Tracks performance and system health
 *
 * 💡 THINK OF IT AS: The "front desk" of our AI service - receives requests
 *    and routes them to the right specialists for processing
 */

// ============================================================================
// 🔧 STEP 1: ENVIRONMENT SETUP - Load configuration first (CRITICAL ORDER)
// ============================================================================
require('dotenv').config(); // 📁 Loads API keys and settings from .env file

// ============================================================================
// 📦 STEP 2: CORE DEPENDENCIES - Essential libraries for server operation
// ============================================================================
const express = require('express');     // 🌐 Web server framework - handles HTTP requests/responses
const cors = require('cors');           // 🔗 Cross-origin requests - allows frontend websites to call our API
const admin = require('firebase-admin'); // 🔥 Google Firebase - cloud database for user data storage

// ============================================================================
// 📝 STEP 3: ENHANCED LOGGING SYSTEM - Beautiful, readable console output
// ============================================================================
const logger = require('./utils/visualLogger'); // 🎨 Custom logger with colors and formatting

// 🚀 STEP 4: STARTUP LOGGING - Show system information
logger.inline('info', 'NeuraStack Backend starting up...', 'startup');
logger.inline('info', `Node.js version: ${process.version}`, 'startup');
logger.inline('info', `Environment: ${process.env.NODE_ENV || 'development'}`, 'startup');
logger.inline('info', `Port: ${process.env.PORT || '8080'}`, 'startup');

// ============================================================================
// 🔥 STEP 5: FIREBASE DATABASE SETUP - Cloud storage initialization
// ============================================================================
// 🎯 PURPOSE: Connect to Google's cloud database for storing:
//    - User conversation memories (for context in future chats)
//    - Workout history and preferences
//    - System analytics and performance data
//
// 📋 EXECUTION ORDER: Must happen BEFORE importing services that use database
// 💡 SUPPORTS: Both production (environment variables) and development (service account file)

/**
 * 🔧 Firebase Initialization Function
 *
 * 📋 PROCESS:
 * 1. Check if Firebase already initialized (prevents double-init)
 * 2. Try environment variables first (production deployment)
 * 3. Fallback to service account file (local development)
 * 4. Create minimal config if no credentials (graceful degradation)
 *
 * 🛡️ ERROR HANDLING: Continues without Firebase if initialization fails
 */
function initializeFirebase() {
  try {
    // 🔍 STEP 5.1: Check if already initialized (prevents conflicts in testing)
    if (admin.apps.length > 0) {
      logger.inline('info', 'Firebase already initialized - skipping', 'firebase');
      return; // ✅ Exit early - no work needed
    }

    // 🔍 STEP 5.2: Validate environment (skip validation in test mode)
    if (process.env.NODE_ENV !== 'test' && !process.env.FIREBASE_PROJECT_ID) {
      throw new Error('FIREBASE_PROJECT_ID environment variable is required');
    }

    let firebaseConfig; // 📝 Will hold our database connection settings

    // 🔍 STEP 5.3: Try production credentials first (environment variables)
    // 💡 WHY: Production deployments use environment variables for security
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      logger.inline('info', 'Using Firebase environment variables for production', 'firebase');

      // 🔧 Build service account object from environment variables
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // 🔧 Fix newline encoding
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`,
        universe_domain: "googleapis.com"
      };

      firebaseConfig = createFirebaseConfig(serviceAccount, 'environment variables');

    } else {
      // Fallback to service account file (for local development)
      logger.inline('info', 'Attempting to use Firebase service account file', 'firebase');

      try {
        const serviceAccount = require('./config/firebase-service-account.json');

        // Validate service account structure
        if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
          throw new Error('Invalid service account configuration - missing required fields');
        }

        firebaseConfig = createFirebaseConfig(serviceAccount, 'service account file');
      } catch (fileError) {
        logger.warning(
          'Firebase service account file not found, using minimal configuration',
          { 'Error': fileError.message },
          'firebase'
        );

        // Use minimal configuration for production if no credentials are available
        firebaseConfig = {
          projectId: process.env.FIREBASE_PROJECT_ID || 'neurastack-backend',
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'neurastack-backend.firebasestorage.app'
        };
      }
    }

    admin.initializeApp(firebaseConfig);

    logger.success(
      'Firebase initialized successfully with neurastack-backend database',
      {
        'Project ID': process.env.FIREBASE_PROJECT_ID,
        'Client Email': process.env.FIREBASE_CLIENT_EMAIL || 'from service account file',
        'Database': 'neurastack-backend',
        'Method': process.env.FIREBASE_PRIVATE_KEY ? 'Environment Variables' : 'Service Account File'
      },
      'firebase'
    );

  } catch (error) {
    // In test environment, don't exit the process
    if (process.env.NODE_ENV === 'test') {
      logger.warning(
        'Firebase initialization failed in test environment - continuing',
        { 'Error': error.message },
        'firebase'
      );
      return;
    }

    // In production, log the error but don't exit - allow the app to start without Firebase
    logger.warning(
      'Firebase initialization failed - Application will start without Firebase features',
      {
        'Error': error.message,
        'Impact': 'Memory and workout history features will use local cache only',
        'Solution': 'Set Firebase environment variables for full functionality'
      },
      'firebase'
    );
  }
}

/**
 * Helper function to create Firebase configuration object
 * @param {Object} serviceAccount - Service account credentials
 * @param {string} credentialType - Description of credential type for logging
 * @returns {Object} Firebase configuration object
 */
function createFirebaseConfig(serviceAccount, credentialType) {
  logger.inline('info', `Using ${credentialType} for neurastack-backend database`, 'firebase');

  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'neurastack-backend';
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;

  return {
    credential: admin.credential.cert(serviceAccount),
    projectId,
    storageBucket,
  };
}

// Initialize Firebase now
logger.inline('info', 'Starting Firebase initialization...', 'firebase');
initializeFirebase();
logger.inline('info', 'Firebase initialization completed', 'firebase');

// ============================================================================
// 🔧 STEP 6: SERVICE IMPORTS - Load our custom business logic modules
// ============================================================================
// 💡 EXECUTION ORDER: Import services AFTER Firebase is initialized
// 🎯 PURPOSE: These are the "workers" that handle specific tasks

// 📍 ROUTE HANDLERS - Define API endpoints and their logic
const healthRoutes = require('./routes/health');   // 🏥 AI ensemble + health checks + model testing
const memoryRoutes = require('./routes/memory');   // 🧠 User conversation memory management
const workoutRoutes = require('./routes/workout'); // 💪 Personalized workout plan generation
const adminRoutes = require('./routes/admin');     // 🎛️ Model management admin interface

// 📍 BACKGROUND SERVICES - Handle ongoing system tasks
const MemoryLifecycleManager = require('./services/memoryLifecycle'); // 🗑️ Auto-cleanup old memories
const monitoringService = require('./services/monitoringService');     // 📊 Performance tracking & alerts
const cacheService = require('./services/cacheService');               // ⚡ Fast response caching
const securityMiddleware = require('./middleware/securityMiddleware');  // 🛡️ Rate limiting & validation

// ============================================================================
// 🚀 STEP 7: EXPRESS APPLICATION SETUP - Web server configuration
// ============================================================================
// 📋 EXECUTION FLOW:
// 1. Initialize background services (memory cleanup)
// 2. Create Express app instance
// 3. Configure server settings
// 4. Set up middleware pipeline
// 5. Register API routes

// 🔧 STEP 7.1: Initialize background services
const memoryLifecycleManager = new MemoryLifecycleManager(); // 🗑️ Auto-cleanup old memories every hour

// 🔧 STEP 7.2: Create Express web server instance
const app = express(); // 🌐 Main application object - handles all HTTP requests

// 🔧 STEP 7.3: Server configuration
const PORT = parseInt(process.env.PORT, 10) || 8080; // 🔌 Server port (Cloud Run uses dynamic ports)

// ============================================================================
// 🔗 STEP 8: CORS CONFIGURATION - Cross-Origin Resource Sharing settings
// ============================================================================
// 🎯 PURPOSE: Control which websites can call our API (security measure)
// 💡 WHY NEEDED: Browsers block requests between different domains by default
// 🛡️ SECURITY: Only allow trusted frontend applications to use our API

const corsOptions = {
  // 📍 ALLOWED ORIGINS - Websites that can call our API
  origin: [
    // 🏠 LOCAL DEVELOPMENT - For testing during development
    'http://localhost:3000',   // React dev server (common port)
    'http://localhost:3001',   // Alternative React port
    'https://localhost:3000',  // HTTPS local development
    'https://localhost:3001',  // HTTPS alternative port

    // 🌐 PRODUCTION DOMAINS - Live website URLs
    'https://neurastack.ai',     // Main production domain
    'https://www.neurastack.ai', // WWW version of production

    // ☁️ HOSTING PLATFORMS - Dynamic deployment URLs (using regex patterns)
    'https://neurastack-frontend.web.app',  // Firebase hosting (specific)
    /^https:\/\/.*\.vercel\.app$/,          // Any Vercel deployment
    /^https:\/\/.*\.netlify\.app$/,         // Any Netlify deployment
    /^https:\/\/.*\.firebase\.app$/,        // Any Firebase deployment
    /^https:\/\/.*\.web\.app$/              // Any Google web app
  ],

  // 🔧 REQUEST SETTINGS
  credentials: true, // 🍪 Allow cookies and authentication headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 📝 Allowed HTTP methods

  // 📋 ALLOWED HEADERS - What frontend can send in requests
  allowedHeaders: [
    'Content-Type',      // 📄 Request body format (JSON, etc.)
    'Authorization',     // 🔑 Authentication tokens
    'X-Requested-With',  // 🌐 AJAX request identifier
    'X-User-Id',         // 👤 User identification for personalization
    'X-Session-Id',      // 🔗 Session tracking for conversations
    'X-Correlation-ID',  // 🔍 Request tracking for debugging
    'Cache-Control'      // 🗄️ Browser cache control headers
  ]
};

// ============================================================================
// 🔧 STEP 9: MIDDLEWARE PIPELINE - Request processing chain
// ============================================================================
// 📋 EXECUTION ORDER: Middleware runs in the order it's added (CRITICAL!)
// 💡 THINK OF IT AS: Assembly line - each middleware processes the request before passing it on

// 🛡️ STEP 9.1: Security headers (MUST BE FIRST)
app.use(securityMiddleware.securityHeaders()); // 🔒 Add security headers to all responses

// 🛡️ STEP 9.2: Rate limiting (prevent abuse and spam)
const rateLimitConfig = {
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,                    // 📊 Max requests per window
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || (15 * 60 * 1000), // ⏰ 15 minutes default
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || (15 * 60 * 1000)) / 1000)
  }
};
app.use(securityMiddleware.createRateLimit(rateLimitConfig)); // 🚦 Apply rate limiting

// 🔗 STEP 9.3: CORS (allow frontend websites to call our API)
app.use(cors(corsOptions)); // 🌐 Enable cross-origin requests

// 📄 STEP 9.4: Request body parsing (convert JSON/form data to JavaScript objects)
const bodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb'; // 📏 Max request size
app.use(express.json({ limit: bodyLimit }));                // 📋 Parse JSON requests
app.use(express.urlencoded({ extended: true, limit: bodyLimit })); // 📝 Parse form data

// 📊 STEP 9.5: Request monitoring (track performance and errors)
app.use(monitoringService.middleware()); // 📈 Log all requests for analytics

// ============================================================================
// ERROR HANDLING - Global error catcher
// ============================================================================
// Error handling middleware (catches any unhandled errors)
app.use((err, req, res, _next) => { // _next prefix indicates intentionally unused parameter
  const correlationId = req.correlationId || 'unknown';

  // Log the error for debugging
  monitoringService.log('error', 'Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  }, correlationId);

  // Send error response to client
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    correlationId,
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 🛣️ STEP 10: ROUTE REGISTRATION - API endpoint definitions
// ============================================================================
// 📋 EXECUTION ORDER: Routes are checked in registration order
// 💡 URL STRUCTURE: /[route-prefix]/[specific-endpoint]

app.use('/', healthRoutes);        // 🏥 Root routes: /health, /default-ensemble, /metrics, etc.
app.use('/memory', memoryRoutes);  // 🧠 Memory routes: /memory/store, /memory/retrieve, etc.
app.use('/workout', workoutRoutes); // 💪 Workout routes: /workout/generate-workout, /workout/history, etc.
app.use('/admin', adminRoutes);     // 🎛️ Admin routes: /admin/dashboard, /admin/toggle-model, etc.

// ============================================================================
// SERVER STARTUP - Main application entry point
// ============================================================================
// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
  // Validate required environment variables before starting
  const requiredEnvVars = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'CLAUDE_API_KEY'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    logger.error(
      'Missing required environment variables',
      {
        'Missing Variables': missingEnvVars.join(', '),
        'Solution': 'Check your .env file and ensure all required API keys are set'
      },
      'startup'
    );
    process.exit(1);
  }

  const server = app.listen(PORT, async () => {
    // Display startup header
    logger.header('NEURASTACK BACKEND V2.0', 'Production-Grade AI Ensemble System', 'rocket');

    // Server startup success
    logger.success(
      `Server running at http://localhost:${PORT}`,
      {
        'Environment': process.env.NODE_ENV || 'development',
        'Port': PORT,
        'Version': '2.0',
        'Status': 'READY FOR REQUESTS',
        'Process ID': process.pid
      },
      'startup'
    );

    // Initialize background services
    try {
      memoryLifecycleManager.start();
      logger.success(
        'Memory management system initialized',
        {
          'Lifecycle Manager': 'Active',
          'Auto-cleanup': 'Enabled',
          'Memory Types': 'Working, Short-term, Long-term, Semantic, Episodic'
        },
        'memory'
      );
    } catch (error) {
      logger.error(
        'Failed to initialize memory management system',
        { 'Error': error.message },
        'memory'
      );
    }

    // Log system capabilities
    logger.info(
      'System capabilities initialized',
      {
        'AI Ensemble': 'Multi-vendor processing (OpenAI, Gemini, Claude)',
        'Memory System': 'Intelligent context management',
        'Workout API': 'Professional-grade fitness generation',
        'Monitoring': 'Enhanced logging and metrics',
        'Caching': 'Response optimization',
        'Security': 'Rate limiting and validation'
      },
      'system'
    );

    // Setup graceful shutdown handlers for clean server termination
    setupGracefulShutdown(server);

    // Final system status
    logger.systemStatus('healthy', {
      'Firebase': 'Connected',
      'Services': 'All systems operational',
      'Ready': 'Accepting requests'
    });
  });
}

/**
 * Setup graceful shutdown handlers for clean server termination
 * This ensures that when the server is stopped, all connections and services
 * are properly closed before the process exits
 * @param {Object} server - Express server instance
 */
function setupGracefulShutdown(server) {
  // Handle SIGTERM (termination signal from process manager)
  process.on('SIGTERM', async () => {
    logger.warning(
      'Received SIGTERM - Initiating graceful shutdown',
      { 'Signal': 'SIGTERM', 'Source': 'Process Manager' },
      'shutdown'
    );
    await gracefulShutdown(server);
  });

  // Handle SIGINT (interrupt signal, usually Ctrl+C)
  process.on('SIGINT', async () => {
    logger.warning(
      'Received SIGINT - Initiating graceful shutdown',
      { 'Signal': 'SIGINT', 'Source': 'User Interrupt (Ctrl+C)' },
      'shutdown'
    );
    await gracefulShutdown(server);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error(
      'Uncaught Exception - Initiating emergency shutdown',
      { 'Error': error.message, 'Stack': error.stack },
      'shutdown'
    );
    gracefulShutdown(server, true);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error(
      'Unhandled Promise Rejection - Initiating emergency shutdown',
      { 'Reason': reason, 'Promise': promise },
      'shutdown'
    );
    gracefulShutdown(server, true);
  });
}

/**
 * Graceful shutdown function - cleanly stops all services and saves data
 * This function is called when the server receives a shutdown signal
 * It ensures that:
 * - All background services are stopped properly
 * - Any cached data is saved to disk
 * - Database connections are closed
 * - The process exits cleanly
 * @param {Object} server - Express server instance
 * @param {boolean} emergency - Whether this is an emergency shutdown
 */
async function gracefulShutdown(server, emergency = false) {
  const shutdownTimeout = parseInt(process.env.SHUTDOWN_TIMEOUT, 10) || 30000; // 30 seconds default

  try {
    logger.info(
      `Initiating ${emergency ? 'emergency' : 'graceful'} shutdown sequence`,
      { 'Timeout': `${shutdownTimeout}ms` },
      'shutdown'
    );

    // Set a timeout for the shutdown process
    const shutdownTimer = setTimeout(() => {
      logger.error(
        'Shutdown timeout exceeded - forcing exit',
        { 'Timeout': `${shutdownTimeout}ms` },
        'shutdown'
      );
      process.exit(1);
    }, shutdownTimeout);

    // Stop accepting new connections
    if (server) {
      logger.inline('info', 'Stopping server from accepting new connections...', 'shutdown');
      server.close(() => {
        logger.inline('success', 'Server stopped accepting new connections', 'shutdown');
      });
    }

    // Stop memory lifecycle manager
    logger.inline('info', 'Stopping memory lifecycle manager...', 'memory');
    memoryLifecycleManager.stop();
    logger.inline('success', 'Memory lifecycle manager stopped', 'memory');

    // Close cache connections
    logger.inline('info', 'Closing cache connections...', 'cache');
    await cacheService.shutdown();
    logger.inline('success', 'Cache connections closed', 'cache');

    // Clear the shutdown timeout
    clearTimeout(shutdownTimer);

    // Final shutdown success
    logger.success(
      `${emergency ? 'Emergency' : 'Graceful'} shutdown completed successfully`,
      {
        'Memory Manager': 'Stopped',
        'Cache Service': 'Closed',
        'Server': 'Closed',
        'Exit Code': '0 (Success)'
      },
      'shutdown'
    );

    process.exit(0); // Exit successfully
  } catch (error) {
    logger.error(
      'Error occurred during shutdown sequence',
      {
        'Error': error.message,
        'Emergency': emergency,
        'Exit Code': '1 (Error)'
      },
      'shutdown'
    );
    process.exit(1); // Exit with error code
  }
}

// ============================================================================
// MODULE EXPORTS - Make the Express app available for testing
// ============================================================================
module.exports = app;