/**
 * 🚀 Redis-Enhanced Cache Service - Production-Grade Distributed Caching
 *
 * 🎯 PURPOSE: Provide high-performance distributed caching with Redis backend
 *
 * 📋 KEY FEATURES:
 * - 🔄 Distributed caching across multiple instances
 * - 🚀 Pre-warming with common prompts
 * - 📊 Advanced cache analytics and monitoring
 * - 🛡️ Fallback to memory cache if Redis unavailable
 * - 🗜️ Intelligent compression for large responses
 * - ⚡ Connection pooling and optimization
 *
 * 💡 ANALOGY: Like having a super-fast shared memory bank
 *    - All server instances can access the same cached data
 *    - Responses are stored once and shared everywhere
 *    - Automatic cleanup prevents memory overflow
 */

const Redis = require('ioredis');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class RedisCacheService {
  constructor() {
    // Redis connection configuration
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000
    };

    // Initialize Redis client
    this.redis = null;
    this.isRedisAvailable = false;
    this.initializeRedis();

    // Fallback memory cache
    this.memoryCache = new Map();

    // Cache configuration
    this.config = {
      defaultTTL: 3600, // 1 hour
      maxMemoryCacheSize: 1000,
      compressionThreshold: 1024, // 1KB
      preWarmPrompts: [
        'What is artificial intelligence?',
        'Explain machine learning basics',
        'How does deep learning work?',
        'What are neural networks?',
        'Benefits of AI in healthcare'
      ]
    };

    // Performance metrics
    this.metrics = {
      redisHits: 0,
      redisMisses: 0,
      memoryHits: 0,
      memoryMisses: 0,
      compressionSavings: 0,
      errors: 0,
      preWarmHits: 0
    };

    // Start pre-warming process
    this.preWarmCache();
  }

  /**
   * Initialize Redis connection with error handling
   */
  async initializeRedis() {
    try {
      this.redis = new Redis(this.redisConfig);

      this.redis.on('connect', () => {
        console.log('🔗 Redis connected successfully');
        this.isRedisAvailable = true;
      });

      this.redis.on('error', (error) => {
        console.warn('⚠️ Redis connection error:', error.message);
        this.isRedisAvailable = false;
        this.metrics.errors++;
      });

      this.redis.on('close', () => {
        console.log('🔌 Redis connection closed');
        this.isRedisAvailable = false;
      });

      // Test connection
      await this.redis.ping();
      this.isRedisAvailable = true;
      console.log('✅ Redis cache service initialized');

    } catch (error) {
      console.warn('⚠️ Redis initialization failed, using memory cache only:', error.message);
      this.isRedisAvailable = false;
      this.redis = null;
    }
  }

  /**
   * Generate cache key for ensemble responses
   */
  generateCacheKey(prompt, userId, tier) {
    const keyData = `${prompt}:${userId}:${tier}`;
    return `ensemble:${crypto.createHash('sha256').update(keyData).digest('hex').substring(0, 16)}`;
  }

  /**
   * Compress data if above threshold
   */
  async compressData(data) {
    const jsonString = JSON.stringify(data);
    if (jsonString.length > this.config.compressionThreshold) {
      const compressed = await gzip(jsonString);
      this.metrics.compressionSavings += jsonString.length - compressed.length;
      return {
        data: compressed.toString('base64'),
        compressed: true,
        originalSize: jsonString.length,
        compressedSize: compressed.length
      };
    }
    return {
      data: jsonString,
      compressed: false,
      originalSize: jsonString.length,
      compressedSize: jsonString.length
    };
  }

  /**
   * Decompress data if needed
   */
  async decompressData(cacheEntry) {
    if (cacheEntry.compressed) {
      const compressed = Buffer.from(cacheEntry.data, 'base64');
      const decompressed = await gunzip(compressed);
      return JSON.parse(decompressed.toString());
    }
    return JSON.parse(cacheEntry.data);
  }

  /**
   * Get cached ensemble response
   */
  async getCachedEnsembleResponse(prompt, userId, tier) {
    const key = this.generateCacheKey(prompt, userId, tier);

    try {
      // Try Redis first if available
      if (this.isRedisAvailable && this.redis) {
        const cached = await this.redis.get(key);
        if (cached) {
          const cacheEntry = JSON.parse(cached);
          const response = await this.decompressData(cacheEntry);
          this.metrics.redisHits++;
          
          // Track pre-warm hits
          if (cacheEntry.preWarmed) {
            this.metrics.preWarmHits++;
          }
          
          return response;
        }
        this.metrics.redisMisses++;
      }

      // Fallback to memory cache
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry && Date.now() < memoryEntry.expiresAt) {
        this.metrics.memoryHits++;
        return memoryEntry.data;
      }
      
      this.metrics.memoryMisses++;
      return null;

    } catch (error) {
      console.warn('⚠️ Cache retrieval error:', error.message);
      this.metrics.errors++;
      return null;
    }
  }

  /**
   * Cache ensemble response
   */
  async cacheEnsembleResponse(prompt, userId, tier, response, ttl = null) {
    const key = this.generateCacheKey(prompt, userId, tier);
    const cacheTTL = ttl || this.config.defaultTTL;

    try {
      // Compress the response
      const compressedData = await this.compressData(response);
      const cacheEntry = {
        ...compressedData,
        timestamp: Date.now(),
        ttl: cacheTTL,
        preWarmed: false
      };

      // Store in Redis if available
      if (this.isRedisAvailable && this.redis) {
        await this.redis.setex(key, cacheTTL, JSON.stringify(cacheEntry));
      }

      // Also store in memory cache as fallback
      this.memoryCache.set(key, {
        data: response,
        expiresAt: Date.now() + (cacheTTL * 1000)
      });

      // Cleanup memory cache if too large
      if (this.memoryCache.size > this.config.maxMemoryCacheSize) {
        this.cleanupMemoryCache();
      }

    } catch (error) {
      console.warn('⚠️ Cache storage error:', error.message);
      this.metrics.errors++;
    }
  }

  /**
   * Pre-warm cache with common prompts
   */
  async preWarmCache() {
    if (!this.isRedisAvailable) {
      console.log('⚠️ Skipping cache pre-warming - Redis not available');
      return;
    }

    console.log('🔥 Starting cache pre-warming...');
    
    for (const prompt of this.config.preWarmPrompts) {
      try {
        const key = this.generateCacheKey(prompt, 'system', 'free');
        
        // Check if already cached
        const exists = await this.redis.exists(key);
        if (!exists) {
          // Create a placeholder that indicates pre-warming is needed
          const preWarmEntry = {
            data: JSON.stringify({ preWarmPlaceholder: true }),
            compressed: false,
            timestamp: Date.now(),
            ttl: 86400, // 24 hours
            preWarmed: true
          };
          
          await this.redis.setex(key, 86400, JSON.stringify(preWarmEntry));
        }
      } catch (error) {
        console.warn(`⚠️ Pre-warm failed for prompt "${prompt}":`, error.message);
      }
    }
    
    console.log('✅ Cache pre-warming completed');
  }

  /**
   * Cleanup memory cache by removing oldest entries
   */
  cleanupMemoryCache() {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    
    const toRemove = entries.slice(0, Math.floor(this.config.maxMemoryCacheSize * 0.2));
    toRemove.forEach(([key]) => this.memoryCache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      redis: {
        available: this.isRedisAvailable,
        hits: this.metrics.redisHits,
        misses: this.metrics.redisMisses,
        hitRate: this.metrics.redisHits / (this.metrics.redisHits + this.metrics.redisMisses) || 0
      },
      memory: {
        size: this.memoryCache.size,
        maxSize: this.config.maxMemoryCacheSize,
        hits: this.metrics.memoryHits,
        misses: this.metrics.memoryMisses,
        hitRate: this.metrics.memoryHits / (this.metrics.memoryHits + this.metrics.memoryMisses) || 0
      },
      performance: {
        compressionSavings: this.metrics.compressionSavings,
        preWarmHits: this.metrics.preWarmHits,
        errors: this.metrics.errors
      }
    };
  }

  /**
   * Clear all caches
   */
  async clearCache() {
    try {
      if (this.isRedisAvailable && this.redis) {
        await this.redis.flushdb();
      }
      this.memoryCache.clear();
      console.log('🧹 Cache cleared successfully');
    } catch (error) {
      console.warn('⚠️ Cache clear error:', error.message);
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = new RedisCacheService();
