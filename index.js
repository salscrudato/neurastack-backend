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

const express = require('express'); // Web server framework - handles HTTP requests
const cors = require('cors'); // Allows websites from different domains to use our API
const admin = require('firebase-admin'); // Google's database service for storing user data
require('dotenv').config(); // Loads environment variables from .env file

// Initialize Firebase database connection FIRST before importing any services that use it
// Firebase is Google's cloud database where we store user memories and workout history
try {
  let firebaseConfig;

  // Try to use Firebase Admin SDK service account first (recommended for Firestore)
  try {
    const serviceAccount = require('./firebase-admin-key.json');
    firebaseConfig = {
      credential: admin.credential.cert(serviceAccount),
      projectId: 'neurastack-backend', // Our project name in Google Cloud
      storageBucket: 'neurastack-backend.firebasestorage.app', // Where we store files
    };
    console.log('🔑 Using Firebase Admin SDK credentials');
  } catch (adminKeyError) {
    // Fallback to original service account file (for local development on your computer)
    try {
      const serviceAccount = require('./serviceAccountKey.json');
      firebaseConfig = {
        credential: admin.credential.cert(serviceAccount),
        projectId: 'neurastack-backend', // Our project name in Google Cloud
        storageBucket: 'neurastack-backend.firebasestorage.app', // Where we store files
      };
      console.log('🔑 Using storage service account credentials');
    } catch (serviceAccountError) {
      // Fallback to environment variables (for production deployment on servers)
      if (process.env.FIREBASE_PROJECT_ID) {
        firebaseConfig = {
          projectId: process.env.FIREBASE_PROJECT_ID || 'neurastack-backend',
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'neurastack-backend.firebasestorage.app',
        };

        // Use service account from environment if available
        if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
          firebaseConfig.credential = admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          });
          console.log('🔑 Using environment variable credentials');
        } else {
          console.log('🔑 Using default application credentials');
        }
      } else {
        throw new Error('No Firebase configuration found');
      }
    }
  }

  admin.initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.warn('⚠️ Firebase initialization failed:', error.message);
  console.warn('⚠️ Workout history will use local cache only');

  // Initialize with minimal config for development
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        projectId: 'neurastack-backend',
      });
      console.log('⚠️ Firebase initialized with minimal config (local cache only)');
    } catch (initError) {
      console.warn('⚠️ Could not initialize Firebase at all:', initError.message);
    }
  }
}

// Now import our custom services and routes (these are the "workers" that do the actual work)
const healthRoutes = require('./routes/health'); // Handles AI ensemble and health check requests
const memoryRoutes = require('./routes/memory'); // Manages user conversation memories
const workoutRoutes = require('./routes/workout'); // Generates personalized workout plans
const MemoryLifecycleManager = require('./services/memoryLifecycle'); // Automatically cleans up old memories
const monitoringService = require('./services/monitoringService'); // Tracks system performance and errors
const cacheService = require('./services/cacheService'); // Stores frequently used data for faster responses
const securityMiddleware = require('./middleware/securityMiddleware'); // Protects against spam and abuse

// Initialize memory lifecycle manager (this automatically cleans up old user memories)
const memoryLifecycleManager = new MemoryLifecycleManager();

// Create the web server application
const app = express();
const PORT = process.env.PORT || 8080; // Use port from environment or default to 8080

// CORS configuration - this controls which websites can use our API
// CORS = Cross-Origin Resource Sharing (allows websites from different domains to call our API)
const corsOptions = {
  origin: [ // List of allowed websites that can use our API
    'http://localhost:3000', // Local development
    'http://localhost:3001', // Local development (alternative port)
    'https://localhost:3000', // Local development with HTTPS
    'https://localhost:3001', // Local development with HTTPS (alternative port)
    'https://neurastack.ai', // Production website
    'https://www.neurastack.ai', // Production website with www
    'https://neurastack-frontend.web.app', // Firebase hosting
    /^https:\/\/.*\.vercel\.app$/, // Any Vercel deployment
    /^https:\/\/.*\.netlify\.app$/, // Any Netlify deployment
    /^https:\/\/.*\.firebase\.app$/, // Any Firebase deployment
    /^https:\/\/.*\.web\.app$/ // Any Google web app
  ],
  credentials: true, // Allow cookies and authentication headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-User-Id', 'X-Session-Id', 'X-Correlation-ID'] // Allowed headers
};

// Security middleware (basic rate limiting only)
app.use(securityMiddleware.createRateLimit({ max: 100, windowMs: 15 * 60 * 1000 }));

// CORS and basic middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add monitoring middleware for request tracking
app.use(monitoringService.middleware());

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
app.use('/workout', workoutRoutes);

// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 Neurastack backend v2.0 running at http://localhost:${PORT}`);
    console.log(`📊 Enhanced monitoring and logging enabled`);
    console.log(`🔄 Circuit breakers and resilience patterns active`);

    // Start memory lifecycle management
    memoryLifecycleManager.start();
    console.log('🧠 Memory management system initialized');



    // Log startup metrics
    monitoringService.log('info', 'Neurastack backend started successfully', {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      version: '2.0',
      features: [
        'Enhanced ensemble processing',
        'Intelligent memory management',
        'Professional workout generation',
        'Structured logging',
        'Response caching'
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