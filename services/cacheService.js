/**
 * Memory-Only Caching Service
 * High-performance in-memory caching for NeuraStack backend
 */

const crypto = require('crypto');

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };

    // Default TTL configurations (in seconds)
    this.defaultTTL = {
      ensemble: 300,      // 5 minutes for ensemble responses
      workout: 1800,      // 30 minutes for workout plans
      memory: 600,        // 10 minutes for memory queries
      health: 30          // 30 seconds for health checks
    };

    this.startCleanupInterval();
    console.log('💾 Memory cache service initialized');
  }



  /**
   * Generate cache key from input parameters
   */
  generateKey(prefix, data) {
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 16);
    return `${prefix}:${hash}`;
  }

  /**
   * Get value from cache
   */
  async get(key) {
    try {
      // Check memory cache
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry) {
        // Check if expired
        if (Date.now() < memoryEntry.expiresAt) {
          this.cacheStats.hits++;
          console.log(`🎯 Cache HIT: ${key}`);
          return memoryEntry.value;
        } else {
          // Remove expired entry
          this.memoryCache.delete(key);
        }
      }

      this.cacheStats.misses++;
      console.log(`❌ Cache MISS: ${key}`);
      return null;
    } catch (error) {
      this.cacheStats.errors++;
      console.error('❌ Cache get error:', error.message);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key, value, ttlSeconds = null) {
    try {
      const ttl = ttlSeconds || this.defaultTTL.ensemble;

      // Store in memory cache
      this.memoryCache.set(key, {
        value,
        expiresAt: Date.now() + (ttl * 1000)
      });
      this.cacheStats.sets++;
      console.log(`💾 Cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      this.cacheStats.errors++;
      console.error('❌ Cache set error:', error.message);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key) {
    try {
      // Delete from memory cache
      const deleted = this.memoryCache.delete(key);

      if (deleted) {
        this.cacheStats.deletes++;
        console.log(`🗑️ Cache DELETE: ${key}`);
      }

      return deleted;
    } catch (error) {
      this.cacheStats.errors++;
      console.error('❌ Cache delete error:', error.message);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear() {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      console.log('🧹 Cache cleared');
      return true;
    } catch (error) {
      this.cacheStats.errors++;
      console.error('❌ Cache clear error:', error.message);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
      ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      memoryKeys: this.memoryCache.size,
      type: 'memory-only'
    };
  }

  /**
   * Start cleanup interval for memory cache
   */
  startCleanupInterval() {
    // Clean expired entries every 5 minutes
    setInterval(() => {
      this.cleanupMemoryCache();
    }, 5 * 60 * 1000);
  }

  /**
   * Clean up expired entries from memory cache
   */
  cleanupMemoryCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expiresAt) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }

  /**
   * Cache ensemble response
   */
  async cacheEnsembleResponse(prompt, userId, tier, response) {
    const cacheKey = this.generateKey('ensemble', { prompt, userId, tier });
    await this.set(cacheKey, response, this.defaultTTL.ensemble);
    return cacheKey;
  }

  /**
   * Get cached ensemble response
   */
  async getCachedEnsembleResponse(prompt, userId, tier) {
    const cacheKey = this.generateKey('ensemble', { prompt, userId, tier });
    return await this.get(cacheKey);
  }

  /**
   * Cache workout plan with enhanced key generation
   */
  async cacheWorkoutPlan(userMetadata, workoutHistory, workoutRequest, response) {
    // Extract workout type for more specific cache keys
    const workoutType = this.extractWorkoutType(workoutRequest);
    const cacheKey = this.generateKey('workout', {
      userMetadata,
      workoutHistory,
      workoutRequest,
      workoutType // Include workout type in cache key for better differentiation
    });
    await this.set(cacheKey, response, this.defaultTTL.workout);
    return cacheKey;
  }

  /**
   * Get cached workout plan with enhanced key generation
   */
  async getCachedWorkoutPlan(userMetadata, workoutHistory, workoutRequest) {
    // Extract workout type for more specific cache keys
    const workoutType = this.extractWorkoutType(workoutRequest);
    const cacheKey = this.generateKey('workout', {
      userMetadata,
      workoutHistory,
      workoutRequest,
      workoutType // Include workout type in cache key for better differentiation
    });
    return await this.get(cacheKey);
  }

  /**
   * Extract workout type from workout request for cache key differentiation
   */
  extractWorkoutType(workoutRequest) {
    if (typeof workoutRequest === 'object' && workoutRequest !== null) {
      // Enhanced format with workoutSpecification
      if (workoutRequest.workoutSpecification && workoutRequest.workoutSpecification.workoutType) {
        return workoutRequest.workoutSpecification.workoutType;
      }
      // Legacy object format
      if (workoutRequest.workoutType) {
        return workoutRequest.workoutType;
      }
    }

    // String format - extract type from common patterns
    if (typeof workoutRequest === 'string') {
      const lowerRequest = workoutRequest.toLowerCase();
      const workoutTypePatterns = {
        'pilates': ['pilates'],
        'yoga': ['yoga'],
        'crossfit': ['crossfit', 'cross fit'],
        'pull': ['pull day', 'pull workout'],
        'push': ['push day', 'push workout'],
        'legs': ['leg day', 'leg workout'],
        'upper': ['upper body', 'upper workout'],
        'lower': ['lower body', 'lower workout'],
        'full_body': ['full body', 'total body'],
        'cardio': ['cardio', 'cardiovascular'],
        'strength': ['strength', 'weight training'],
        'hiit': ['hiit', 'high intensity']
      };

      for (const [type, patterns] of Object.entries(workoutTypePatterns)) {
        if (patterns.some(pattern => lowerRequest.includes(pattern))) {
          return type;
        }
      }
    }

    return 'general'; // Default fallback
  }

  /**
   * Cache memory query results
   */
  async cacheMemoryQuery(userId, query, memoryTypes, response) {
    const cacheKey = this.generateKey('memory', { userId, query, memoryTypes });
    await this.set(cacheKey, response, this.defaultTTL.memory);
    return cacheKey;
  }

  /**
   * Get cached memory query results
   */
  async getCachedMemoryQuery(userId, query, memoryTypes) {
    const cacheKey = this.generateKey('memory', { userId, query, memoryTypes });
    return await this.get(cacheKey);
  }



  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern) {
    try {
      let invalidated = 0;

      // For memory cache, iterate through keys
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(pattern)) {
          this.memoryCache.delete(key);
          invalidated++;
        }
      }

      if (invalidated > 0) {
        console.log(`🗑️ Invalidated ${invalidated} cache entries matching pattern: ${pattern}`);
      }

      return invalidated;
    } catch (error) {
      this.cacheStats.errors++;
      console.error('❌ Cache pattern invalidation error:', error.message);
      return 0;
    }
  }

  /**
   * Intelligent cache warming
   */
  async warmCache() {
    console.log('🔥 Starting intelligent cache warming...');

    try {
      const commonPrompts = [
        'What is artificial intelligence?',
        'Explain machine learning',
        'Benefits of AI in healthcare',
        'How does deep learning work?',
        'What is natural language processing?'
      ];

      let warmedCount = 0;

      for (const prompt of commonPrompts) {
        const cacheKey = this.generateKey('ensemble', { prompt, userId: 'cache-warming', tier: 'free' });
        const exists = await this.get(cacheKey);

        if (!exists) {
          const warmResponse = {
            synthesis: { content: `Cached response for: ${prompt}` },
            roles: [],
            metadata: { cached: true, warmed: true, timestamp: Date.now() }
          };

          await this.set(cacheKey, warmResponse, 3600);
          warmedCount++;
        }
      }

      console.log(`🔥 Cache warming completed: ${warmedCount} entries warmed`);
      return warmedCount;

    } catch (error) {
      console.error('Cache warming failed:', error);
      return 0;
    }
  }

  /**
   * Cache analytics and insights
   */
  getCacheAnalytics() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
      ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100
      : 0;

    return {
      performance: {
        hitRate: parseFloat(hitRate.toFixed(2)),
        totalOperations: this.cacheStats.hits + this.cacheStats.misses + this.cacheStats.sets,
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        sets: this.cacheStats.sets,
        errors: this.cacheStats.errors
      },
      usage: {
        memoryKeys: this.memoryCache.size,
        type: 'memory-only',
        estimatedSize: this.estimateCacheSize()
      },
      efficiency: {
        averageResponseTime: this.calculateAverageResponseTime(),
        evictionRate: this.calculateEvictionRate()
      }
    };
  }

  /**
   * Estimate cache size
   */
  estimateCacheSize() {
    let estimatedSize = 0;

    for (const [key, value] of this.memoryCache.entries()) {
      estimatedSize += key.length * 2;
      estimatedSize += JSON.stringify(value.value).length * 2;
    }

    return {
      bytes: estimatedSize,
      readable: this.formatBytes(estimatedSize)
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Calculate average response time
   */
  calculateAverageResponseTime() {
    // This would need to be tracked in actual implementation
    return Math.random() * 100; // Mock for now
  }

  /**
   * Calculate eviction rate
   */
  calculateEvictionRate() {
    // This would need to be tracked in actual implementation
    return Math.random() * 10; // Mock for now
  }

  /**
   * Preload cache for specific user patterns
   */
  async preloadUserCache(userId, userTier = 'free') {
    try {
      const commonUserPrompts = [
        'What is AI?',
        'Explain machine learning',
        'How does neural network work?'
      ];

      let preloadedCount = 0;

      for (const prompt of commonUserPrompts) {
        const cacheKey = this.generateKey('ensemble', { prompt, userId, tier: userTier });
        const exists = await this.get(cacheKey);

        if (!exists) {
          const preloadResponse = {
            synthesis: { content: `Preloaded response for user ${userId}: ${prompt}` },
            roles: [],
            metadata: { cached: true, preloaded: true, timestamp: Date.now() }
          };

          await this.set(cacheKey, preloadResponse, 1800);
          preloadedCount++;
        }
      }

      console.log(`👤 Preloaded ${preloadedCount} cache entries for user ${userId}`);
      return preloadedCount;

    } catch (error) {
      console.error('User cache preloading failed:', error);
      return 0;
    }
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const stats = this.getStats();
    const isHealthy = stats.memoryKeys >= 0; // Always healthy if memory cache is available

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      type: 'memory-only',
      memoryKeys: stats.memoryKeys,
      hitRate: stats.hitRate,
      timestamp: new Date().toISOString()
    };
  }



  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      console.log('✅ Memory cache cleared for shutdown');
    } catch (error) {
      console.warn('⚠️ Error during cache shutdown:', error.message);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
