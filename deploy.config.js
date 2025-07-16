/**
 * 🚀 NeuraStack Backend Deployment Configuration
 * 
 * This file contains deployment settings and environment-specific configurations
 * for the NeuraStack backend deployment process.
 */

module.exports = {
  // Google Cloud Configuration
  gcp: {
    projectId: 'neurastack-backend',
    region: 'us-central1',
    serviceName: 'neurastack-backend',
    
    // Cloud Run Configuration
    cloudRun: {
      memory: '1Gi',
      cpu: '1',
      concurrency: 80,
      timeout: 300,
      maxInstances: 10,
      minInstances: 0,
      allowUnauthenticated: true,
      
      // Environment variables for Cloud Run
      // Note: Sensitive values should be set directly in Cloud Run console
      environmentVariables: {
        NODE_ENV: 'production',
        TIER: 'free',
        PORT: '8080',
        
        // These will be set from Cloud Run secrets or environment
        // OPENAI_API_KEY: 'set-in-cloud-run',
        // GEMINI_API_KEY: 'set-in-cloud-run',
        // CLAUDE_API_KEY: 'set-in-cloud-run',
        // XAI_API_KEY: 'set-in-cloud-run',
        // FIREBASE_CLIENT_EMAIL: 'set-in-cloud-run',
        // FIREBASE_PRIVATE_KEY: 'set-in-cloud-run',
      }
    },
    
    // Required APIs
    requiredApis: [
      'run.googleapis.com',
      'cloudbuild.googleapis.com',
      'firestore.googleapis.com',
      'firebase.googleapis.com'
    ]
  },
  
  // GitHub Configuration
  github: {
    repository: 'salscrudato/neurastack-backend',
    defaultBranch: 'main'
  },
  
  // Deployment Steps Configuration
  deployment: {
    // Pre-deployment checks
    preChecks: {
      runTests: true,
      checkGitStatus: true,
      validateEnvironment: true,
      checkDependencies: true
    },
    
    // Build configuration
    build: {
      skipTests: false,
      runLinting: false, // Set to true if you have linting setup
      buildTimeout: 600, // 10 minutes
      
      // Docker build args (if using custom Dockerfile)
      dockerArgs: {
        NODE_ENV: 'production'
      }
    },
    
    // Post-deployment verification
    verification: {
      healthCheck: true,
      runVerificationScript: true,
      verificationTimeout: 120, // 2 minutes
      
      // Endpoints to test
      testEndpoints: [
        '/health',
        '/memory/health',
        '/admin'
      ]
    }
  },
  
  // Monitoring and Alerting
  monitoring: {
    // Health check configuration
    healthCheck: {
      path: '/health',
      interval: 30,
      timeout: 10,
      unhealthyThreshold: 3,
      healthyThreshold: 2
    },
    
    // Logging configuration
    logging: {
      level: 'info',
      structured: true,
      includeSourceLocation: true
    }
  },
  
  // Development and Testing
  development: {
    localPort: 8080,
    testDatabase: 'firestore-emulator',
    
    // Local development URLs
    urls: {
      local: 'http://localhost:8080',
      staging: 'https://neurastack-backend-staging-638289111765.us-central1.run.app',
      production: 'https://neurastack-backend-638289111765.us-central1.run.app'
    }
  },
  
  // Security Configuration
  security: {
    // CORS settings
    cors: {
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://neurastack-frontend.vercel.app',
        'https://neurastack.com'
      ],
      credentials: true
    },
    
    // Rate limiting
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },
  
  // Feature Flags
  features: {
    enableMemorySystem: true,
    enableAdvancedVoting: true,
    enableSynthesisOptimization: true,
    enablePerformanceMonitoring: true,
    enableErrorHandling: true,
    enableCircuitBreakers: true,
    enableCaching: true,
    enablePreWarming: false, // Keep disabled to avoid API costs
    enableHealthMonitoring: true
  },
  
  // Performance Configuration
  performance: {
    // Ensemble configuration
    ensemble: {
      maxConcurrentRequests: 30,
      timeoutMs: 45000,
      retryAttempts: 3,
      retryDelayMs: 800
    },
    
    // Cache configuration
    cache: {
      defaultTTL: 3600, // 1 hour
      maxSize: 1000,
      enableCompression: true
    },
    
    // Memory management
    memory: {
      maxMemoryUsage: '512MB',
      gcInterval: 300000, // 5 minutes
      enableMemoryMonitoring: true
    }
  },
  
  // Backup and Recovery
  backup: {
    enableAutomaticBackup: true,
    backupInterval: '0 2 * * *', // Daily at 2 AM
    retentionDays: 30
  }
};

// Export environment-specific configurations
module.exports.getConfig = function(environment = 'production') {
  const baseConfig = module.exports;
  
  switch (environment) {
    case 'development':
      return {
        ...baseConfig,
        gcp: {
          ...baseConfig.gcp,
          cloudRun: {
            ...baseConfig.gcp.cloudRun,
            memory: '512Mi',
            maxInstances: 3
          }
        },
        features: {
          ...baseConfig.features,
          enableHealthMonitoring: false // Reduce overhead in dev
        }
      };
      
    case 'staging':
      return {
        ...baseConfig,
        gcp: {
          ...baseConfig.gcp,
          serviceName: 'neurastack-backend-staging',
          cloudRun: {
            ...baseConfig.gcp.cloudRun,
            memory: '512Mi',
            maxInstances: 5
          }
        }
      };
      
    case 'production':
    default:
      return baseConfig;
  }
};
