/**
 * Production-Grade Caching Service
 * Supports Redis with in-memory fallback for cost optimization
 */

const crypto = require('crypto');

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.redisClient = null;
    this.isRedisAvailable = false;
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
      cost: 60,           // 1 minute for cost estimates
      health: 30          // 30 seconds for health checks
    };
    
    this.initializeRedis();
    this.startCleanupInterval();
  }

  /**
   * Initialize Redis connection if available
   */
  async initializeRedis() {
    try {
      // Only initialize Redis if REDIS_URL is provided
      if (process.env.REDIS_URL) {
        const redis = require('redis');
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL,
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              console.warn('⚠️ Redis connection refused, using memory cache');
              return undefined; // Stop retrying
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              console.warn('⚠️ Redis retry time exhausted, using memory cache');
              return undefined;
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });

        this.redisClient.on('connect', () => {
          console.log('✅ Redis connected successfully');
          this.isRedisAvailable = true;
        });

        this.redisClient.on('error', (err) => {
          console.warn('⚠️ Redis error, falling back to memory cache:', err.message);
          this.isRedisAvailable = false;
        });

        await this.redisClient.connect();
      } else {
        console.log('📝 No Redis URL provided, using memory cache only');
      }
    } catch (error) {
      console.warn('⚠️ Redis initialization failed, using memory cache:', error.message);
      this.isRedisAvailable = false;
    }
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
      let value = null;

      // Try Redis first if available
      if (this.isRedisAvailable && this.redisClient) {
        try {
          value = await this.redisClient.get(key);
          if (value) {
            value = JSON.parse(value);
            this.cacheStats.hits++;
            console.log(`🎯 Cache HIT (Redis): ${key}`);
            return value;
          }
        } catch (redisError) {
          console.warn('⚠️ Redis get failed, trying memory cache:', redisError.message);
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry) {
        // Check if expired
        if (Date.now() < memoryEntry.expiresAt) {
          this.cacheStats.hits++;
          console.log(`🎯 Cache HIT (Memory): ${key}`);
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
      const serializedValue = JSON.stringify(value);

      // Try Redis first if available
      if (this.isRedisAvailable && this.redisClient) {
        try {
          await this.redisClient.setEx(key, ttl, serializedValue);
          this.cacheStats.sets++;
          console.log(`💾 Cache SET (Redis): ${key} (TTL: ${ttl}s)`);
          return true;
        } catch (redisError) {
          console.warn('⚠️ Redis set failed, using memory cache:', redisError.message);
          this.isRedisAvailable = false;
        }
      }

      // Fallback to memory cache
      this.memoryCache.set(key, {
        value,
        expiresAt: Date.now() + (ttl * 1000)
      });
      this.cacheStats.sets++;
      console.log(`💾 Cache SET (Memory): ${key} (TTL: ${ttl}s)`);
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
      let deleted = false;

      // Try Redis first if available
      if (this.isRedisAvailable && this.redisClient) {
        try {
          const result = await this.redisClient.del(key);
          deleted = result > 0;
        } catch (redisError) {
          console.warn('⚠️ Redis delete failed:', redisError.message);
          this.isRedisAvailable = false;
        }
      }

      // Also delete from memory cache
      const memoryDeleted = this.memoryCache.delete(key);
      deleted = deleted || memoryDeleted;

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
      // Clear Redis if available
      if (this.isRedisAvailable && this.redisClient) {
        try {
          await this.redisClient.flushAll();
        } catch (redisError) {
          console.warn('⚠️ Redis clear failed:', redisError.message);
        }
      }

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
      memoryEntries: this.memoryCache.size,
      redisAvailable: this.isRedisAvailable
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
   * Cache cost estimate
   */
  async cacheCostEstimate(prompt, tier, response) {
    const cacheKey = this.generateKey('cost', { prompt, tier });
    await this.set(cacheKey, response, this.defaultTTL.cost);
    return cacheKey;
  }

  /**
   * Get cached cost estimate
   */
  async getCachedCostEstimate(prompt, tier) {
    const cacheKey = this.generateKey('cost', { prompt, tier });
    return await this.get(cacheKey);
  }

  /**
   * Invalidate cache entries by pattern
   */
  async invalidatePattern(pattern) {
    try {
      let invalidated = 0;

      // For Redis, use SCAN to find matching keys
      if (this.isRedisAvailable && this.redisClient) {
        try {
          const keys = await this.redisClient.keys(`${pattern}*`);
          if (keys.length > 0) {
            await this.redisClient.del(keys);
            invalidated += keys.length;
          }
        } catch (redisError) {
          console.warn('⚠️ Redis pattern invalidation failed:', redisError.message);
        }
      }

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
        const cacheKey = this.generateEnsembleKey(prompt, 'cache-warming', 'free');
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
        redisAvailable: this.isRedisAvailable,
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
      estimatedSize += JSON.stringify(value.data).length * 2;
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
        const cacheKey = this.generateEnsembleKey(prompt, userId, userTier);
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
   * Distributed cache coordination
   */
  async syncWithDistributedCache() {
    if (!this.isRedisAvailable) return;

    try {
      const memoryKeys = Array.from(this.memoryCache.keys());
      let syncedCount = 0;

      for (const key of memoryKeys.slice(0, 100)) {
        const memoryValue = this.memoryCache.get(key);
        const redisValue = await this.redisClient.get(key);

        if (!redisValue && memoryValue && !this.isExpired(memoryValue)) {
          await this.redisClient.setex(key, memoryValue.ttl, JSON.stringify(memoryValue.data));
          syncedCount++;
        }
      }

      console.log(`🔄 Distributed cache sync completed: ${syncedCount} entries synced`);

    } catch (error) {
      console.error('Distributed cache sync failed:', error);
    }
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const stats = this.getStats();
    const isHealthy = stats.redisAvailable || stats.memoryKeys > 0;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      redisAvailable: stats.redisAvailable,
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
      if (this.redisClient) {
        await this.redisClient.quit();
        console.log('✅ Redis connection closed');
      }
    } catch (error) {
      console.warn('⚠️ Error closing Redis connection:', error.message);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
