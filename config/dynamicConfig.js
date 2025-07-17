/**
 * 🔧 Dynamic Configuration System - Centralized Configuration Management
 *
 * 🎯 PURPOSE: Eliminate hardcoded configurations across the NeuraStack AI Ensemble
 *            codebase by providing a centralized, environment-driven configuration system
 *
 * 📋 KEY FEATURES:
 * 1. Environment variable-driven configuration with fallback defaults
 * 2. Schema validation using convict for type safety and validation
 * 3. Tier-specific configuration overrides (free vs premium)
 * 4. Runtime configuration reloading support
 * 5. Comprehensive logging and error handling
 * 6. Production-ready configuration management
 *
 * 💡 USAGE: Import specific configuration sections as needed:
 *    const { ensemble, cache, voting } = require('../config/dynamicConfig');
 */

const convict = require('convict');
require('dotenv').config();

// Define comprehensive configuration schema
const config = convict({
  // Environment and tier settings
  env: {
    doc: 'Application environment',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV'
  },
  
  tier: {
    doc: 'Service tier (free or premium)',
    format: ['free', 'premium'],
    default: 'free',
    env: 'TIER'
  },

  // Ensemble Runner Configuration
  ensemble: {
    maxConcurrentRequests: {
      free: {
        doc: 'Maximum concurrent requests for free tier',
        format: 'int',
        default: 30,
        env: 'ENSEMBLE_MAX_CONCURRENT_FREE'
      },
      premium: {
        doc: 'Maximum concurrent requests for premium tier',
        format: 'int',
        default: 60,
        env: 'ENSEMBLE_MAX_CONCURRENT_PREMIUM'
      }
    },
    
    timeoutMs: {
      doc: 'Request timeout in milliseconds',
      format: 'int',
      default: 45000,
      env: 'ENSEMBLE_TIMEOUT_MS'
    },
    
    retryAttempts: {
      doc: 'Number of retry attempts for failed requests',
      format: 'int',
      default: 3,
      env: 'ENSEMBLE_RETRY_ATTEMPTS'
    },
    
    retryDelayMs: {
      doc: 'Delay between retry attempts in milliseconds',
      format: 'int',
      default: 800,
      env: 'ENSEMBLE_RETRY_DELAY_MS'
    },
    
    maxPromptLength: {
      doc: 'Maximum prompt length in characters',
      format: 'int',
      default: 6000,
      env: 'ENSEMBLE_MAX_PROMPT_LENGTH'
    }
  },

  // Performance Optimizer Configuration
  performance: {
    enableParallelSynthesis: {
      doc: 'Enable parallel synthesis processing',
      format: Boolean,
      default: true,
      env: 'PERF_ENABLE_PARALLEL_SYNTHESIS'
    },
    
    enableSimilarityMatching: {
      doc: 'Enable similarity matching optimization',
      format: Boolean,
      default: true,
      env: 'PERF_ENABLE_SIMILARITY_MATCHING'
    },
    
    enableVotingCache: {
      doc: 'Enable voting result caching',
      format: Boolean,
      default: true,
      env: 'PERF_ENABLE_VOTING_CACHE'
    },
    
    enablePreWarming: {
      doc: 'Enable cache pre-warming',
      format: Boolean,
      default: true,
      env: 'PERF_ENABLE_PRE_WARMING'
    },
    
    similarityThreshold: {
      doc: 'Similarity threshold for optimization matching',
      format: Number,
      default: 0.85,
      env: 'PERF_SIMILARITY_THRESHOLD'
    },
    
    maxParallelOperations: {
      doc: 'Maximum parallel operations',
      format: 'int',
      default: 3,
      env: 'PERF_MAX_PARALLEL_OPERATIONS'
    },
    
    synthesisTimeout: {
      doc: 'Synthesis operation timeout in milliseconds',
      format: 'int',
      default: 15000,
      env: 'PERF_SYNTHESIS_TIMEOUT'
    },
    
    votingTimeout: {
      doc: 'Voting operation timeout in milliseconds',
      format: 'int',
      default: 2000,
      env: 'PERF_VOTING_TIMEOUT'
    },
    
    preWarmInterval: {
      doc: 'Pre-warming interval in milliseconds',
      format: 'int',
      default: 300000,
      env: 'PERF_PRE_WARM_INTERVAL'
    }
  },

  // Enhanced Cache Configuration
  cache: {
    maxCacheSize: {
      doc: 'Maximum cache size (number of entries)',
      format: 'int',
      default: 10000,
      env: 'CACHE_MAX_SIZE'
    },
    
    similarityThreshold: {
      doc: 'Cache similarity threshold for matching',
      format: Number,
      default: 0.8,
      env: 'CACHE_SIMILARITY_THRESHOLD'
    },
    
    qualityThreshold: {
      doc: 'Cache quality threshold for storage',
      format: Number,
      default: 0.7,
      env: 'CACHE_QUALITY_THRESHOLD'
    },
    
    compressionThreshold: {
      doc: 'Compression threshold in bytes',
      format: 'int',
      default: 1024,
      env: 'CACHE_COMPRESSION_THRESHOLD'
    },
    
    userPatternWindow: {
      doc: 'User pattern analysis window size',
      format: 'int',
      default: 100,
      env: 'CACHE_USER_PATTERN_WINDOW'
    },
    
    predictiveCacheSize: {
      doc: 'Predictive cache size',
      format: 'int',
      default: 500,
      env: 'CACHE_PREDICTIVE_SIZE'
    },
    
    ttl: {
      highQuality: {
        doc: 'TTL for high quality responses in seconds',
        format: 'int',
        default: 7200,
        env: 'CACHE_TTL_HIGH_QUALITY'
      },
      mediumQuality: {
        doc: 'TTL for medium quality responses in seconds',
        format: 'int',
        default: 3600,
        env: 'CACHE_TTL_MEDIUM_QUALITY'
      },
      lowQuality: {
        doc: 'TTL for low quality responses in seconds',
        format: 'int',
        default: 1800,
        env: 'CACHE_TTL_LOW_QUALITY'
      }
    }
  },

  // Sophisticated Voting Configuration
  voting: {
    enableDiversityWeighting: {
      doc: 'Enable diversity-based voting weights',
      format: Boolean,
      default: true,
      env: 'VOTING_ENABLE_DIVERSITY_WEIGHTING'
    },

    enableHistoricalAccuracy: {
      doc: 'Enable historical accuracy weighting',
      format: Boolean,
      default: true,
      env: 'VOTING_ENABLE_HISTORICAL_ACCURACY'
    },

    enableMetaVoting: {
      doc: 'Enable meta-voting for tie-breaking',
      format: Boolean,
      default: true,
      env: 'VOTING_ENABLE_META_VOTING'
    },

    enableTieBreaking: {
      doc: 'Enable tie-breaking mechanisms',
      format: Boolean,
      default: true,
      env: 'VOTING_ENABLE_TIE_BREAKING'
    },

    enableAbstention: {
      doc: 'Enable abstention and re-query logic',
      format: Boolean,
      default: true,
      env: 'VOTING_ENABLE_ABSTENTION'
    },

    weightFactors: {
      traditional: {
        doc: 'Traditional confidence-based weight factor',
        format: Number,
        default: 0.3,
        env: 'VOTING_WEIGHT_TRADITIONAL'
      },
      diversity: {
        doc: 'Diversity-based weight factor',
        format: Number,
        default: 0.2,
        env: 'VOTING_WEIGHT_DIVERSITY'
      },
      historical: {
        doc: 'Historical performance weight factor',
        format: Number,
        default: 0.25,
        env: 'VOTING_WEIGHT_HISTORICAL'
      },
      semantic: {
        doc: 'Semantic confidence weight factor',
        format: Number,
        default: 0.15,
        env: 'VOTING_WEIGHT_SEMANTIC'
      },
      reliability: {
        doc: 'Provider reliability weight factor',
        format: Number,
        default: 0.1,
        env: 'VOTING_WEIGHT_RELIABILITY'
      }
    }
  },

  // Post-Synthesis Validation Configuration
  validation: {
    thresholds: {
      readability: {
        minimum: {
          doc: 'Minimum readability threshold',
          format: Number,
          default: 0.6,
          env: 'VALIDATION_READABILITY_MIN'
        },
        optimal: {
          doc: 'Optimal readability threshold',
          format: Number,
          default: 0.8,
          env: 'VALIDATION_READABILITY_OPTIMAL'
        }
      },
      factualConsistency: {
        minimum: {
          doc: 'Minimum factual consistency threshold',
          format: Number,
          default: 0.7,
          env: 'VALIDATION_FACTUAL_MIN'
        },
        optimal: {
          doc: 'Optimal factual consistency threshold',
          format: Number,
          default: 0.85,
          env: 'VALIDATION_FACTUAL_OPTIMAL'
        }
      },
      novelty: {
        minimum: {
          doc: 'Minimum novelty threshold',
          format: Number,
          default: 0.5,
          env: 'VALIDATION_NOVELTY_MIN'
        },
        optimal: {
          doc: 'Optimal novelty threshold',
          format: Number,
          default: 0.75,
          env: 'VALIDATION_NOVELTY_OPTIMAL'
        }
      },
      toxicity: {
        maximum: {
          doc: 'Maximum toxicity threshold',
          format: Number,
          default: 0.3,
          env: 'VALIDATION_TOXICITY_MAX'
        },
        optimal: {
          doc: 'Optimal toxicity threshold',
          format: Number,
          default: 0.1,
          env: 'VALIDATION_TOXICITY_OPTIMAL'
        }
      },
      overall: {
        minimum: {
          doc: 'Minimum overall quality threshold',
          format: Number,
          default: 0.65,
          env: 'VALIDATION_OVERALL_MIN'
        },
        optimal: {
          doc: 'Optimal overall quality threshold',
          format: Number,
          default: 0.8,
          env: 'VALIDATION_OVERALL_OPTIMAL'
        }
      }
    },

    qualityWeights: {
      readability: {
        doc: 'Weight for readability in overall quality calculation',
        format: Number,
        default: 0.2,
        env: 'VALIDATION_WEIGHT_READABILITY'
      },
      factualConsistency: {
        doc: 'Weight for factual consistency in overall quality calculation',
        format: Number,
        default: 0.3,
        env: 'VALIDATION_WEIGHT_FACTUAL'
      },
      novelty: {
        doc: 'Weight for novelty in overall quality calculation',
        format: Number,
        default: 0.25,
        env: 'VALIDATION_WEIGHT_NOVELTY'
      },
      toxicity: {
        doc: 'Weight for toxicity in overall quality calculation',
        format: Number,
        default: 0.15,
        env: 'VALIDATION_WEIGHT_TOXICITY'
      },
      structure: {
        doc: 'Weight for structure in overall quality calculation',
        format: Number,
        default: 0.1,
        env: 'VALIDATION_WEIGHT_STRUCTURE'
      }
    }
  },

  // Vendor Client Configuration
  vendors: {
    timeout: {
      doc: 'Vendor API timeout in milliseconds',
      format: 'int',
      default: 30000,
      env: 'VENDOR_TIMEOUT_MS'
    }
  },

  // Parallel Processing Configuration
  parallel: {
    maxConcurrentModels: {
      doc: 'Maximum concurrent model calls',
      format: 'int',
      default: 3,
      env: 'PARALLEL_MAX_CONCURRENT_MODELS'
    },

    maxConcurrentSynthesis: {
      doc: 'Maximum concurrent synthesis operations',
      format: 'int',
      default: 2,
      env: 'PARALLEL_MAX_CONCURRENT_SYNTHESIS'
    },

    modelTimeout: {
      doc: 'Model call timeout in milliseconds',
      format: 'int',
      default: 15000,
      env: 'PARALLEL_MODEL_TIMEOUT'
    },

    synthesisTimeout: {
      doc: 'Synthesis timeout in milliseconds',
      format: 'int',
      default: 10000,
      env: 'PARALLEL_SYNTHESIS_TIMEOUT'
    },

    votingTimeout: {
      doc: 'Voting timeout in milliseconds',
      format: 'int',
      default: 3000,
      env: 'PARALLEL_VOTING_TIMEOUT'
    },

    retryAttempts: {
      doc: 'Retry attempts for parallel operations',
      format: 'int',
      default: 2,
      env: 'PARALLEL_RETRY_ATTEMPTS'
    },

    connectionPoolSize: {
      doc: 'Connection pool size',
      format: 'int',
      default: 5,
      env: 'PARALLEL_CONNECTION_POOL_SIZE'
    }
  },

  // Meta Voter Configuration
  metaVoter: {
    model: {
      doc: 'Meta voter model name',
      format: String,
      default: 'gpt-3.5-turbo',
      env: 'META_VOTER_MODEL'
    },

    maxTokens: {
      doc: 'Maximum tokens for meta voter',
      format: 'int',
      default: 800,
      env: 'META_VOTER_MAX_TOKENS'
    },

    temperature: {
      doc: 'Temperature for meta voter',
      format: Number,
      default: 0.3,
      env: 'META_VOTER_TEMPERATURE'
    },

    timeout: {
      doc: 'Meta voter timeout in milliseconds',
      format: 'int',
      default: 15000,
      env: 'META_VOTER_TIMEOUT'
    },

    triggerThresholds: {
      maxWeightDifference: {
        doc: 'Maximum weight difference to trigger meta voting',
        format: Number,
        default: 0.05,
        env: 'META_VOTER_MAX_WEIGHT_DIFF'
      },
      minConsensusStrength: {
        doc: 'Minimum consensus strength to trigger meta voting',
        format: Number,
        default: 0.4,
        env: 'META_VOTER_MIN_CONSENSUS'
      }
    }
  },

  // Voting History Configuration
  votingHistory: {
    maxHistorySize: {
      doc: 'Maximum voting records to keep per model',
      format: 'int',
      default: 1000,
      env: 'VOTING_HISTORY_MAX_SIZE'
    },

    adaptationWindow: {
      doc: 'Number of recent votes for adaptation',
      format: 'int',
      default: 100,
      env: 'VOTING_HISTORY_ADAPTATION_WINDOW'
    },

    performanceDecayFactor: {
      doc: 'Decay factor for historical performance',
      format: Number,
      default: 0.95,
      env: 'VOTING_HISTORY_DECAY_FACTOR'
    },

    consensusThresholds: {
      veryWeak: {
        doc: 'Very weak consensus threshold',
        format: Number,
        default: 0.3,
        env: 'VOTING_CONSENSUS_VERY_WEAK'
      },
      weak: {
        doc: 'Weak consensus threshold',
        format: Number,
        default: 0.45,
        env: 'VOTING_CONSENSUS_WEAK'
      },
      moderate: {
        doc: 'Moderate consensus threshold',
        format: Number,
        default: 0.6,
        env: 'VOTING_CONSENSUS_MODERATE'
      },
      strong: {
        doc: 'Strong consensus threshold',
        format: Number,
        default: 0.75,
        env: 'VOTING_CONSENSUS_STRONG'
      },
      veryStrong: {
        doc: 'Very strong consensus threshold',
        format: Number,
        default: 0.9,
        env: 'VOTING_CONSENSUS_VERY_STRONG'
      }
    }
  },

  // Abstention Service Configuration
  abstention: {
    thresholds: {
      lowConfidence: {
        doc: 'Low confidence threshold for abstention',
        format: Number,
        default: 0.3,
        env: 'ABSTENTION_LOW_CONFIDENCE'
      },
      highFailureRate: {
        doc: 'High failure rate threshold for abstention',
        format: Number,
        default: 0.5,
        env: 'ABSTENTION_HIGH_FAILURE_RATE'
      },
      lowQualityScore: {
        doc: 'Low quality score threshold for abstention',
        format: Number,
        default: 0.4,
        env: 'ABSTENTION_LOW_QUALITY_SCORE'
      },
      highDiversityThreshold: {
        doc: 'High diversity threshold for abstention',
        format: Number,
        default: 0.8,
        env: 'ABSTENTION_HIGH_DIVERSITY'
      },
      lowConsensusThreshold: {
        doc: 'Low consensus threshold for abstention',
        format: Number,
        default: 0.4,
        env: 'ABSTENTION_LOW_CONSENSUS'
      }
    },

    reQueryLimits: {
      maxAttempts: {
        doc: 'Maximum re-query attempts per request',
        format: 'int',
        default: 2,
        env: 'ABSTENTION_MAX_ATTEMPTS'
      },
      cooldownPeriod: {
        doc: 'Cooldown period between attempts in milliseconds',
        format: 'int',
        default: 5000,
        env: 'ABSTENTION_COOLDOWN_PERIOD'
      },
      timeoutIncrease: {
        doc: 'Timeout increase factor for re-queries',
        format: Number,
        default: 1.5,
        env: 'ABSTENTION_TIMEOUT_INCREASE'
      },
      temperatureAdjustment: {
        doc: 'Temperature adjustment for variation',
        format: Number,
        default: 0.1,
        env: 'ABSTENTION_TEMPERATURE_ADJUSTMENT'
      }
    }
  },

  // Model Configuration Service
  modelConfig: {
    cacheTTL: {
      doc: 'Model configuration cache TTL in milliseconds',
      format: 'int',
      default: 300000,
      env: 'MODEL_CONFIG_CACHE_TTL'
    }
  },

  // Enhanced Synthesis Service Configuration - Optimized for longer responses
  synthesis: {
    timeout: {
      doc: 'Synthesis service timeout in milliseconds',
      format: 'int',
      default: 45000, // Increased from 30000 for longer synthesis
      env: 'SYNTHESIS_TIMEOUT'
    },

    model: {
      doc: 'Synthesis model name',
      format: String,
      default: 'gpt-4.1-nano', // Updated to use cost-effective nano model
      env: 'SYNTHESIS_MODEL'
    },

    maxTokens: {
      doc: 'Maximum tokens for synthesis',
      format: 'int',
      default: 2000, // Increased from 500 to prevent truncation
      env: 'SYNTHESIS_MAX_TOKENS'
    }
  },

  // Tier-specific configurations - Optimized for longer responses
  tiers: {
    free: {
      sharedWordLimit: {
        doc: 'Shared word limit for free tier',
        format: 'int',
        default: 1500, // Increased from 1000 for longer responses
        env: 'TIER_FREE_SHARED_WORD_LIMIT'
      },
      maxTokensPerRole: {
        doc: 'Maximum tokens per role for free tier',
        format: 'int',
        default: 2000, // Increased from 1200 to prevent truncation
        env: 'TIER_FREE_MAX_TOKENS_PER_ROLE'
      },
      maxSynthesisTokens: {
        doc: 'Maximum synthesis tokens for free tier',
        format: 'int',
        default: 2500, // Increased from 1600 for comprehensive synthesis
        env: 'TIER_FREE_MAX_SYNTHESIS_TOKENS'
      },
      maxCharactersPerRole: {
        doc: 'Maximum characters per role for free tier',
        format: 'int',
        default: 8000, // Increased from 4800 for longer responses
        env: 'TIER_FREE_MAX_CHARACTERS_PER_ROLE'
      },
      timeoutMs: {
        doc: 'Timeout for free tier in milliseconds',
        format: 'int',
        default: 90000, // Increased from 75000 for longer processing
        env: 'TIER_FREE_TIMEOUT_MS'
      },
      requestsPerHour: {
        doc: 'Requests per hour limit for free tier',
        format: 'int',
        default: 25,
        env: 'TIER_FREE_REQUESTS_PER_HOUR'
      },
      requestsPerDay: {
        doc: 'Requests per day limit for free tier',
        format: 'int',
        default: 150,
        env: 'TIER_FREE_REQUESTS_PER_DAY'
      },
      maxPromptLength: {
        doc: 'Maximum prompt length for free tier',
        format: 'int',
        default: 1500,
        env: 'TIER_FREE_MAX_PROMPT_LENGTH'
      },
      cacheTTL: {
        doc: 'Cache TTL for free tier in seconds',
        format: 'int',
        default: 600,
        env: 'TIER_FREE_CACHE_TTL'
      },
      concurrencyLimit: {
        doc: 'Concurrency limit for free tier',
        format: 'int',
        default: 25,
        env: 'TIER_FREE_CONCURRENCY_LIMIT'
      }
    },

    premium: {
      sharedWordLimit: {
        doc: 'Shared word limit for premium tier',
        format: 'int',
        default: 2000, // Increased from 800 for premium longer responses
        env: 'TIER_PREMIUM_SHARED_WORD_LIMIT'
      },
      maxTokensPerRole: {
        doc: 'Maximum tokens per role for premium tier',
        format: 'int',
        default: 3000, // Increased from 1600 for premium longer responses
        env: 'TIER_PREMIUM_MAX_TOKENS_PER_ROLE'
      },
      maxSynthesisTokens: {
        doc: 'Maximum synthesis tokens for premium tier',
        format: 'int',
        default: 4000, // Increased from 2000 for comprehensive premium synthesis
        env: 'TIER_PREMIUM_MAX_SYNTHESIS_TOKENS'
      },
      maxCharactersPerRole: {
        doc: 'Maximum characters per role for premium tier',
        format: 'int',
        default: 12000, // Increased from 3800 for premium longer responses
        env: 'TIER_PREMIUM_MAX_CHARACTERS_PER_ROLE'
      },
      timeoutMs: {
        doc: 'Timeout for premium tier in milliseconds',
        format: 'int',
        default: 120000, // Increased from 75000 for premium longer processing
        env: 'TIER_PREMIUM_TIMEOUT_MS'
      },
      requestsPerHour: {
        doc: 'Requests per hour limit for premium tier',
        format: 'int',
        default: 150,
        env: 'TIER_PREMIUM_REQUESTS_PER_HOUR'
      },
      requestsPerDay: {
        doc: 'Requests per day limit for premium tier',
        format: 'int',
        default: 1500,
        env: 'TIER_PREMIUM_REQUESTS_PER_DAY'
      },
      maxPromptLength: {
        doc: 'Maximum prompt length for premium tier',
        format: 'int',
        default: 4000,
        env: 'TIER_PREMIUM_MAX_PROMPT_LENGTH'
      },
      cacheTTL: {
        doc: 'Cache TTL for premium tier in seconds',
        format: 'int',
        default: 300,
        env: 'TIER_PREMIUM_CACHE_TTL'
      },
      concurrencyLimit: {
        doc: 'Concurrency limit for premium tier',
        format: 'int',
        default: 50,
        env: 'TIER_PREMIUM_CONCURRENCY_LIMIT'
      }
    }
  }
});

// Validate configuration
try {
  config.validate({ allowed: 'strict' });
  console.log('✅ Dynamic configuration loaded and validated successfully');

  // Log key configuration values for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔧 Configuration Summary:');
    console.log(`   Environment: ${config.get('env')}`);
    console.log(`   Tier: ${config.get('tier')}`);
    console.log(`   Ensemble Timeout: ${config.get('ensemble.timeoutMs')}ms`);
    console.log(`   Ensemble Retries: ${config.get('ensemble.retryAttempts')}`);
    console.log(`   Cache Max Size: ${config.get('cache.maxCacheSize')}`);
    console.log(`   Vendor Timeout: ${config.get('vendors.timeout')}ms`);
    console.log(`   Performance Similarity Threshold: ${config.get('performance.similarityThreshold')}`);
  }
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}

// Runtime configuration reloading support
let reloadInProgress = false;

function reloadConfiguration() {
  if (reloadInProgress) {
    console.log('⚠️ Configuration reload already in progress, skipping...');
    return false;
  }

  reloadInProgress = true;
  console.log('🔄 Reloading configuration...');

  try {
    // Clear require cache for dotenv to reload environment variables
    delete require.cache[require.resolve('dotenv')];
    require('dotenv').config();

    // Reload and validate configuration
    config.load({});
    config.validate({ allowed: 'strict' });

    console.log('✅ Configuration reloaded successfully');
    reloadInProgress = false;
    return true;
  } catch (error) {
    console.error('❌ Configuration reload failed:', error.message);
    reloadInProgress = false;
    return false;
  }
}

// Set up signal handlers for runtime configuration reloading
process.on('SIGUSR1', () => {
  console.log('📡 Received SIGUSR1 signal, reloading configuration...');
  reloadConfiguration();
});

process.on('SIGUSR2', () => {
  console.log('📊 Received SIGUSR2 signal, logging current configuration...');
  console.log('Current Configuration:', JSON.stringify(config.getProperties(), null, 2));
});

// Helper function to get tier-specific configuration
function getTierConfig(tier = null) {
  const currentTier = tier || config.get('tier');
  return config.get(`tiers.${currentTier}`);
}

// Helper function to get ensemble max concurrent requests based on tier
function getEnsembleMaxConcurrent(tier = null) {
  const currentTier = tier || config.get('tier');
  return config.get(`ensemble.maxConcurrentRequests.${currentTier}`);
}

// Helper function to validate configuration at runtime
function validateConfig() {
  try {
    config.validate({ allowed: 'strict' });
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Export configuration with helper functions
const configExport = config.getProperties();
configExport.getTierConfig = getTierConfig;
configExport.getEnsembleMaxConcurrent = getEnsembleMaxConcurrent;
configExport.reloadConfiguration = reloadConfiguration;
configExport.validateConfig = validateConfig;

module.exports = configExport;
