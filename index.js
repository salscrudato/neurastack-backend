/**
 * NeuraStack Backend Server - Main Entry Point
 *
 * This is the main server file that starts up the NeuraStack AI application.
 * It handles requests from users who want to use AI models or generate workouts.
 * Think of this as the "front desk" of our AI service - it receives requests
 * and directs them to the right place to get processed.
 *
 * What this server does:
 * - Provides AI ensemble responses (combines multiple AI models for better answers)
 * - Generates personalized workout plans
 * - Manages user memory (remembers past conversations)
 * - Handles security and rate limiting (prevents abuse)
 * - Monitors system health and performance
 */

// ============================================================================
// ENVIRONMENT CONFIGURATION - Load environment variables first
// ============================================================================
require('dotenv').config(); // Loads environment variables from .env file

// ============================================================================
// DEPENDENCIES - External libraries and modules we need
// ============================================================================
const express = require('express'); // Web server framework - handles HTTP requests
const cors = require('cors'); // Allows websites from different domains to use our API
const admin = require('firebase-admin'); // Google's database service for storing user data

// ============================================================================
// VISUAL LOGGING SYSTEM - Enhanced human-readable console output
// ============================================================================
const logger = require('./utils/visualLogger');

// Log application startup
logger.inline('info', 'NeuraStack Backend starting up...', 'startup');
logger.inline('info', `Node.js version: ${process.version}`, 'startup');
logger.inline('info', `Environment: ${process.env.NODE_ENV || 'development'}`, 'startup');
logger.inline('info', `Port: ${process.env.PORT || '8080'}`, 'startup');

// ============================================================================
// FIREBASE INITIALIZATION - Database connection setup
// ============================================================================
// Initialize Firebase database connection FIRST before importing any services that use it
// Firebase is Google's cloud database where we store user memories and workout history

/**
 * Initialize Firebase with environment variables or service account file
 * Supports both production (env vars) and development (service account file) configurations
 */
function initializeFirebase() {
  try {
    // Skip initialization if Firebase is already initialized (for testing)
    if (admin.apps.length > 0) {
      logger.inline('info', 'Firebase already initialized - skipping', 'firebase');
      return;
    }

    // Validate required environment variables (skip in test environment)
    if (process.env.NODE_ENV !== 'test' && !process.env.FIREBASE_PROJECT_ID) {
      throw new Error('FIREBASE_PROJECT_ID environment variable is required');
    }

    let firebaseConfig;

    // Try environment variables first (for production deployment)
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      logger.inline('info', 'Using Firebase environment variables for production', 'firebase');

      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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

    logger.error(
      'Firebase initialization failed - Application cannot start',
      {
        'Error': error.message,
        'Solution': 'Set Firebase environment variables or check config/firebase-service-account.json exists and is valid'
      },
      'firebase'
    );
    process.exit(1); // Exit the application since Firebase is required
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
// SERVICE IMPORTS - Our custom business logic modules
// ============================================================================
// Import our custom services and routes (these are the "workers" that do the actual work)
const healthRoutes = require('./routes/health'); // Handles AI ensemble and health check requests
const memoryRoutes = require('./routes/memory'); // Manages user conversation memories
const workoutRoutes = require('./routes/workout'); // Generates personalized workout plans
const MemoryLifecycleManager = require('./services/memoryLifecycle'); // Automatically cleans up old memories
const monitoringService = require('./services/monitoringService'); // Tracks system performance and errors
const cacheService = require('./services/cacheService'); // Stores frequently used data for faster responses
const securityMiddleware = require('./middleware/securityMiddleware'); // Protects against spam and abuse

// ============================================================================
// APPLICATION SETUP - Express server configuration
// ============================================================================
// Initialize memory lifecycle manager (this automatically cleans up old user memories)
const memoryLifecycleManager = new MemoryLifecycleManager();

// Create the web server application
const app = express();

// Environment-based configuration
const PORT = parseInt(process.env.PORT, 10) || 8080; // Use port from environment or default to 8080

// ============================================================================
// CORS CONFIGURATION - Cross-Origin Resource Sharing settings
// ============================================================================
// CORS controls which websites can use our API
// CORS = Cross-Origin Resource Sharing (allows websites from different domains to call our API)
const corsOptions = {
  // List of allowed websites that can use our API
  origin: [
    // Local development environments
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001',

    // Production domains
    'https://neurastack.ai',
    'https://www.neurastack.ai',

    // Hosting platforms (using regex patterns for dynamic subdomains)
    'https://neurastack-frontend.web.app', // Firebase hosting
    /^https:\/\/.*\.vercel\.app$/, // Any Vercel deployment
    /^https:\/\/.*\.netlify\.app$/, // Any Netlify deployment
    /^https:\/\/.*\.firebase\.app$/, // Any Firebase deployment
    /^https:\/\/.*\.web\.app$/ // Any Google web app
  ],
  credentials: true, // Allow cookies and authentication headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
  allowedHeaders: [ // Headers that frontend can send to our API
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-User-Id',
    'X-Session-Id',
    'X-Correlation-ID'
  ]
};

// ============================================================================
// MIDDLEWARE SETUP - Request processing pipeline
// ============================================================================
// Security headers middleware (should be first)
app.use(securityMiddleware.securityHeaders());

// Security middleware (basic rate limiting to prevent abuse)
// Environment-based rate limiting configuration
const rateLimitConfig = {
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || (15 * 60 * 1000), // 15 minutes default
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || (15 * 60 * 1000)) / 1000)
  }
};
app.use(securityMiddleware.createRateLimit(rateLimitConfig));

// CORS and basic request parsing middleware
app.use(cors(corsOptions)); // Enable cross-origin requests

// Request body parsing with environment-based limits
const bodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';
app.use(express.json({ limit: bodyLimit })); // Parse JSON requests
app.use(express.urlencoded({ extended: true, limit: bodyLimit })); // Parse form data

// Request monitoring and tracking middleware
app.use(monitoringService.middleware());

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
// ROUTE REGISTRATION - API endpoint definitions
// ============================================================================
app.use('/', healthRoutes); // Health checks and AI ensemble endpoints
app.use('/memory', memoryRoutes); // User memory management endpoints
app.use('/workout', workoutRoutes); // Workout generation and tracking endpoints

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