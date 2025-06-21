const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase FIRST before importing any services that use it
try {
  let firebaseConfig;

  // Try to use service account file first (for local development)
  try {
    const serviceAccount = require('./serviceAccountKey.json');
    firebaseConfig = {
      credential: admin.credential.cert(serviceAccount),
      projectId: 'neurastack-backend',
      storageBucket: 'neurastack-backend.firebasestorage.app',
    };
    console.log('🔑 Using service account credentials');
  } catch (serviceAccountError) {
    // Fallback to environment variables (for production)
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

// Now import routes and services that depend on Firebase
const healthRoutes = require('./routes/health');
const memoryRoutes = require('./routes/memory');
const workoutRoutes = require('./routes/workout');
const MemoryLifecycleManager = require('./services/memoryLifecycle');
const monitoringService = require('./services/monitoringService');
const cacheService = require('./services/cacheService');
const securityMiddleware = require('./middleware/securityMiddleware');

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