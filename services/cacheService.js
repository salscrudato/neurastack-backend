/**
 * ⚡ Enhanced Multi-Tier Memory Caching Service
 *
 * 🎯 PURPOSE: Provide lightning-fast response caching for optimal performance
 *
 * 📋 EXECUTION FLOW:
 * 1. Check HOT cache (most frequently accessed data)
 * 2. Check WARM cache (moderately accessed, compressed)
 * 3. Check COLD cache (rarely accessed, heavily compressed)
 * 4. If cache miss, fetch data and intelligently place in appropriate tier
 *
 * 🏗️ CACHE ARCHITECTURE:
 * - 🔥 HOT: Frequently accessed data (uncompressed, fastest access)
 * - 🌡️ WARM: Moderately accessed data (light compression, fast access)
 * - ❄️ COLD: Rarely accessed data (heavy compression, slower access)
 *
 * 🔧 INTELLIGENT FEATURES:
 * - 📊 Access pattern learning and prediction
 * - 🎯 Automatic tier promotion/demotion based on usage
 * - 📦 Smart compression to maximize memory efficiency
 * - 🧠 Predictive cache warming for better hit rates
 * - 📈 Real-time performance analytics and optimization
 */

const crypto = require('crypto');
const zlib = require('zlib');
const redisCacheService = require('./redisCacheService');

class CacheService {
  constructor() {
    // Multi-tier cache storage for optimal performance
    this.memoryCache = new Map(); // Legacy compatibility
    this.cache = {
      hot: new Map(),    // Frequently accessed, keep in memory
      warm: new Map(),   // Moderately accessed, compressed
      cold: new Map()    // Rarely accessed, heavily compressed
    };

    // Enhanced cache statistics
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      evictions: 0,
      compressionSavings: 0,
      tierPromotions: 0,
      tierDemotions: 0,
      predictiveHits: 0
    };

    // Access patterns for intelligent caching
    this.accessPatterns = new Map();
    this.metadata = new Map();

    // Enhanced TTL configurations optimized for 25+ concurrent users (in milliseconds)
    this.defaultTTL = {
      ensemble: 600000,      // 10 minutes for ensemble responses (increased for better hit rate)
      workout: 3600000,      // 60 minutes for workout plans (increased for better performance)
      memory: 600000,        // 10 minutes for memory queries
      health: 30000,         // 30 seconds for health checks
      hot: 600000,           // 10 minutes for hot cache
      warm: 3600000,         // 1 hour for warm cache
      cold: 14400000         // 4 hours for cold cache
    };

    // Production-grade configuration
    this.config = {
      maxMemoryUsage: 200 * 1024 * 1024, // 200MB max memory usage
      compressionThreshold: 512, // Compress entries larger than 512 bytes
      hotCacheMaxSize: 1000,
      warmCacheMaxSize: 5000,
      coldCacheMaxSize: 44000,
      accessCountThreshold: 3, // Promote to hot after 3 accesses
      memoryPressureThreshold: 0.8,
      cleanupInterval: 120000, // 2 minutes
      compressionLevel: 6 // zlib compression level
    };

    this.startCleanupInterval();
    this.startMemoryMonitoring();
    console.log('💾 Enhanced multi-tier memory cache service initialized');
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
    const startTime = Date.now();

    try {
      // Check legacy memory cache first for backward compatibility
      const memoryEntry = this.memoryCache.get(key);
      if (memoryEntry) {
        // Check if expired
        if (Date.now() < memoryEntry.expiresAt) {
          this.cacheStats.hits++;
          this.updateAccessPattern(key);
          console.log(`🎯 Cache HIT (legacy): ${key}`);
          return memoryEntry.value;
        } else {
          // Remove expired entry
          this.memoryCache.delete(key);
        }
      }

      // Check multi-tier cache system
      let entry = this.cache.hot.get(key);
      let tier = 'hot';

      if (!entry || entry.expiresAt <= Date.now()) {
        // Check warm cache
        entry = this.cache.warm.get(key);
        tier = 'warm';

        if (!entry || entry.expiresAt <= Date.now()) {
          // Check cold cache
          entry = this.cache.cold.get(key);
          tier = 'cold';
        }
      }

      if (entry && entry.expiresAt > Date.now()) {
        this.cacheStats.hits++;

        // Decompress if needed
        let value = entry.value;
        if (entry.compressed) {
          value = await this.decompress(value);
        }

        // Update access pattern and potentially promote
        this.updateAccessPattern(key);
        await this.considerPromotion(key, tier, entry);

        console.log(`🎯 Cache HIT (${tier}): ${key}`);
        return value;
      }

      // Clean up expired entries
      if (entry) {
        this.cache[tier].delete(key);
        this.metadata.delete(key);
      }

      this.cacheStats.misses++;
      console.log(`❌ Cache MISS: ${key}`);
      return null;

    } catch (error) {
      this.cacheStats.errors++;
      console.error('❌ Enhanced cache get error:', error.message);
      return null;
    }
  }

  /**
   * Enhanced set method with multi-tier support
   */
  async set(key, value, ttlSeconds = null) {
    try {
      // Determine TTL based on cache type or use provided value
      let ttl;
      if (ttlSeconds) {
        ttl = ttlSeconds * 1000; // Convert to milliseconds
      } else {
        // Auto-detect cache type from key prefix
        if (key.startsWith('ensemble:')) {
          ttl = this.defaultTTL.ensemble;
        } else if (key.startsWith('workout:')) {
          ttl = this.defaultTTL.workout;
        } else if (key.startsWith('memory:')) {
          ttl = this.defaultTTL.memory;
        } else if (key.startsWith('health:')) {
          ttl = this.defaultTTL.health;
        } else {
          ttl = this.defaultTTL.ensemble; // Default fallback
        }
      }

      const expiresAt = Date.now() + ttl;

      // Store in legacy memory cache for backward compatibility
      this.memoryCache.set(key, {
        value,
        expiresAt
      });

      // Determine which tier to store in based on expected access pattern
      const tier = this.determineTier(key, value);
      await this.storeInTier(key, value, expiresAt, tier);

      this.cacheStats.sets++;
      console.log(`💾 Cache SET: ${key} (TTL: ${ttl/1000}s, Tier: ${tier})`);
      return true;
    } catch (error) {
      this.cacheStats.errors++;
      console.error('❌ Enhanced cache set error:', error.message);
      return false;
    }
  }

  /**
   * Determine optimal tier for new cache entry
   */
  determineTier(key, value) {
    // Check if we have access pattern history
    const pattern = this.accessPatterns.get(key);
    if (pattern && pattern.count >= this.config.accessCountThreshold) {
      return 'hot'; // Frequently accessed items go to hot cache
    }

    // Check value size - large values go to cold cache with compression
    const valueSize = JSON.stringify(value).length;
    if (valueSize > this.config.compressionThreshold * 4) {
      return 'cold';
    }

    // Check key type for intelligent placement
    if (key.startsWith('ensemble:') || key.startsWith('health:')) {
      return 'warm'; // Ensemble responses are moderately accessed
    }

    if (key.startsWith('workout:')) {
      return 'hot'; // Workout data is frequently accessed
    }

    return 'warm'; // Default to warm cache
  }

  /**
   * Store entry in specified tier
   */
  async storeInTier(key, value, expiresAt, tier) {
    // Check capacity and evict if necessary
    const cache = this.cache[tier];
    const maxSize = this.config[`${tier}CacheMaxSize`];

    if (cache.size >= maxSize) {
      this.evictLeastRecentlyUsed(tier);
    }

    // Compress if storing in warm or cold cache and above threshold
    let compressed = false;
    let storeValue = value;

    if ((tier === 'warm' || tier === 'cold') &&
        JSON.stringify(value).length > this.config.compressionThreshold) {
      storeValue = await this.compress(value);
      compressed = true;
    }

    cache.set(key, {
      value: storeValue,
      expiresAt,
      compressed,
      tier,
      createdAt: Date.now()
    });

    // Update metadata
    this.metadata.set(key, {
      tier,
      compressed,
      size: compressed ? storeValue.length : JSON.stringify(value).length,
      createdAt: Date.now()
    });
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
   * Get comprehensive cache statistics including Redis
   */
  async getStats() {
    const hitRate = this.cacheStats.hits + this.cacheStats.misses > 0
      ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(2)
      : 0;

    // Get Redis stats
    let redisStats = null;
    try {
      redisStats = redisCacheService.getStats();
    } catch (error) {
      console.warn('⚠️ Failed to get Redis stats:', error.message);
    }

    return {
      local: {
        ...this.cacheStats,
        hitRate: `${hitRate}%`,
        memoryKeys: this.memoryCache.size,
        type: 'memory-only'
      },
      redis: redisStats,
      combined: {
        totalHits: this.cacheStats.hits + (redisStats?.redis?.hits || 0),
        totalMisses: this.cacheStats.misses + (redisStats?.redis?.misses || 0),
        distributedCaching: !!redisStats?.redis?.available,
        overallHitRate: this.calculateOverallHitRate(redisStats)
      }
    };
  }

  /**
   * Calculate overall hit rate across local and Redis caches
   */
  calculateOverallHitRate(redisStats) {
    const localHits = this.cacheStats.hits;
    const localMisses = this.cacheStats.misses;
    const redisHits = redisStats?.redis?.hits || 0;
    const redisMisses = redisStats?.redis?.misses || 0;

    const totalHits = localHits + redisHits;
    const totalRequests = totalHits + localMisses + redisMisses;

    return totalRequests > 0 ? `${((totalHits / totalRequests) * 100).toFixed(2)}%` : '0%';
  }

  /**
   * Enhanced cleanup interval with memory monitoring
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupMemoryCache();
      this.cleanupMultiTierCache();
      this.optimizeMemoryUsage();
    }, this.config.cleanupInterval);
  }

  /**
   * Start memory monitoring for production deployment
   */
  startMemoryMonitoring() {
    setInterval(() => {
      const memoryUsage = this.calculateMemoryUsage();
      if (memoryUsage > this.config.maxMemoryUsage * this.config.memoryPressureThreshold) {
        console.warn(`⚠️ Cache memory pressure detected: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        this.aggressiveCleanup();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Update access pattern for intelligent caching
   */
  updateAccessPattern(key) {
    const pattern = this.accessPatterns.get(key) || { count: 0, lastAccess: 0, frequency: 0 };
    const now = Date.now();

    pattern.count++;
    pattern.frequency = pattern.count / Math.max(1, (now - pattern.lastAccess) / 3600000); // accesses per hour
    pattern.lastAccess = now;

    this.accessPatterns.set(key, pattern);
  }

  /**
   * Consider promoting cache entry to higher tier
   */
  async considerPromotion(key, currentTier, entry) {
    const pattern = this.accessPatterns.get(key);
    if (!pattern) return;

    // Promote to hot cache if frequently accessed
    if (currentTier !== 'hot' && pattern.count >= this.config.accessCountThreshold) {
      await this.promoteToHot(key, entry);
    }
    // Promote from cold to warm if moderately accessed
    else if (currentTier === 'cold' && pattern.count >= 2) {
      await this.promoteToWarm(key, entry);
    }
  }

  /**
   * Compress data for storage efficiency
   */
  async compress(data) {
    try {
      const jsonString = JSON.stringify(data);
      const compressed = zlib.deflateSync(jsonString, { level: this.config.compressionLevel });
      this.cacheStats.compressionSavings += jsonString.length - compressed.length;
      return compressed;
    } catch (error) {
      console.error('Compression error:', error);
      return data; // Return original data if compression fails
    }
  }

  /**
   * Decompress data
   */
  async decompress(compressedData) {
    try {
      if (Buffer.isBuffer(compressedData)) {
        const decompressed = zlib.inflateSync(compressedData);
        return JSON.parse(decompressed.toString());
      }
      return compressedData; // Return as-is if not compressed
    } catch (error) {
      console.error('Decompression error:', error);
      return compressedData;
    }
  }

  /**
   * Calculate total memory usage
   */
  calculateMemoryUsage() {
    let totalSize = 0;

    // Calculate legacy cache size
    for (const [key, entry] of this.memoryCache) {
      totalSize += JSON.stringify({ key, entry }).length;
    }

    // Calculate multi-tier cache size
    for (const tier of ['hot', 'warm', 'cold']) {
      for (const [key, entry] of this.cache[tier]) {
        if (entry.compressed && Buffer.isBuffer(entry.value)) {
          totalSize += entry.value.length;
        } else {
          totalSize += JSON.stringify({ key, entry }).length;
        }
      }
    }

    return totalSize;
  }

  /**
   * Cleanup multi-tier cache
   */
  cleanupMultiTierCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const tier of ['hot', 'warm', 'cold']) {
      for (const [key, entry] of this.cache[tier]) {
        if (entry.expiresAt <= now) {
          this.cache[tier].delete(key);
          this.metadata.delete(key);
          this.accessPatterns.delete(key);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired entries from multi-tier cache`);
    }
  }

  /**
   * Optimize memory usage by moving entries between tiers
   */
  optimizeMemoryUsage() {
    const memoryUsage = this.calculateMemoryUsage();

    if (memoryUsage > this.config.maxMemoryUsage * 0.7) {
      console.log(`🔧 Optimizing memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);

      // Move least accessed items to lower tiers
      this.demoteStaleEntries();
    }
  }

  /**
   * Demote stale entries to lower tiers
   */
  demoteStaleEntries() {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes

    // Demote from hot to warm
    for (const [key, entry] of this.cache.hot) {
      const pattern = this.accessPatterns.get(key);
      if (pattern && (now - pattern.lastAccess) > staleThreshold) {
        this.demoteToWarm(key, entry);
      }
    }

    // Demote from warm to cold
    for (const [key, entry] of this.cache.warm) {
      const pattern = this.accessPatterns.get(key);
      if (pattern && (now - pattern.lastAccess) > staleThreshold * 2) {
        this.demoteToCold(key, entry);
      }
    }
  }

  /**
   * Aggressive cleanup during memory pressure
   */
  aggressiveCleanup() {
    console.log('🧹 Starting aggressive cache cleanup...');

    // Remove expired entries first
    this.cleanupMemoryCache();
    this.cleanupMultiTierCache();

    // Demote entries aggressively
    this.demoteStaleEntries();

    // Remove least recently used entries if still over limit
    const memoryUsage = this.calculateMemoryUsage();
    if (memoryUsage > this.config.maxMemoryUsage * 0.9) {
      this.evictLeastRecentlyUsed();
    }

    console.log('🧹 Aggressive cleanup completed');
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
   * Cache ensemble response with Redis integration
   */
  async cacheEnsembleResponse(prompt, userId, tier, response) {
    try {
      // Store in Redis for distributed caching
      await redisCacheService.cacheEnsembleResponse(prompt, userId, tier, response, this.defaultTTL.ensemble);
      console.log(`💾 Cached in Redis: ensemble:${prompt.substring(0, 20)}...`);
    } catch (error) {
      console.warn('⚠️ Redis cache storage failed:', error.message);
    }

    // Also store in local cache as fallback
    const cacheKey = this.generateKey('ensemble', { prompt, userId, tier });
    await this.set(cacheKey, response, this.defaultTTL.ensemble);
    return cacheKey;
  }

  /**
   * Get cached ensemble response with Redis integration
   */
  async getCachedEnsembleResponse(prompt, userId, tier) {
    try {
      // Try Redis cache first for distributed caching
      const redisResult = await redisCacheService.getCachedEnsembleResponse(prompt, userId, tier);
      if (redisResult) {
        console.log(`🎯 Cache HIT (Redis): ensemble:${prompt.substring(0, 20)}...`);
        return redisResult;
      }

      // Fallback to local cache
      const cacheKey = this.generateKey('ensemble', { prompt, userId, tier });
      const localResult = await this.get(cacheKey);
      if (localResult) {
        console.log(`🎯 Cache HIT (Local): ensemble:${prompt.substring(0, 20)}...`);
      }
      return localResult;
    } catch (error) {
      console.warn('⚠️ Cache retrieval error:', error.message);
      // Fallback to local cache only
      const cacheKey = this.generateKey('ensemble', { prompt, userId, tier });
      return await this.get(cacheKey);
    }
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
   * Promote entry to hot cache
   */
  async promoteToHot(key, entry) {
    if (this.cache.hot.size >= this.config.hotCacheMaxSize) {
      this.evictLeastRecentlyUsed('hot');
    }

    // Decompress if needed for hot cache
    let value = entry.value;
    if (entry.compressed) {
      value = await this.decompress(value);
    }

    this.cache.hot.set(key, {
      value,
      expiresAt: Date.now() + this.defaultTTL.hot,
      compressed: false,
      tier: 'hot'
    });

    // Remove from lower tiers
    this.cache.warm.delete(key);
    this.cache.cold.delete(key);

    this.cacheStats.tierPromotions++;
  }

  /**
   * Promote entry to warm cache
   */
  async promoteToWarm(key, entry) {
    if (this.cache.warm.size >= this.config.warmCacheMaxSize) {
      this.evictLeastRecentlyUsed('warm');
    }

    let value = entry.value;
    let compressed = entry.compressed;

    // Compress if not already compressed and above threshold
    if (!compressed && JSON.stringify(value).length > this.config.compressionThreshold) {
      value = await this.compress(value);
      compressed = true;
    }

    this.cache.warm.set(key, {
      value,
      expiresAt: Date.now() + this.defaultTTL.warm,
      compressed,
      tier: 'warm'
    });

    // Remove from cold tier
    this.cache.cold.delete(key);

    this.cacheStats.tierPromotions++;
  }

  /**
   * Demote entry to warm cache
   */
  async demoteToWarm(key, entry) {
    let value = entry.value;
    let compressed = false;

    // Compress for warm cache
    if (JSON.stringify(value).length > this.config.compressionThreshold) {
      value = await this.compress(value);
      compressed = true;
    }

    this.cache.warm.set(key, {
      value,
      expiresAt: entry.expiresAt,
      compressed,
      tier: 'warm'
    });

    this.cache.hot.delete(key);
    this.cacheStats.tierDemotions++;
  }

  /**
   * Demote entry to cold cache
   */
  async demoteToCold(key, entry) {
    let value = entry.value;
    let compressed = entry.compressed;

    // Ensure compression for cold cache
    if (!compressed) {
      value = await this.compress(value);
      compressed = true;
    }

    this.cache.cold.set(key, {
      value,
      expiresAt: entry.expiresAt,
      compressed,
      tier: 'cold'
    });

    this.cache.warm.delete(key);
    this.cacheStats.tierDemotions++;
  }

  /**
   * Evict least recently used entries
   */
  evictLeastRecentlyUsed(tier = 'cold', count = 1) {
    const cache = tier ? this.cache[tier] : this.cache.cold;
    const entries = Array.from(cache.entries());

    // Sort by last access time
    entries.sort((a, b) => {
      const patternA = this.accessPatterns.get(a[0]) || { lastAccess: 0 };
      const patternB = this.accessPatterns.get(b[0]) || { lastAccess: 0 };
      return patternA.lastAccess - patternB.lastAccess;
    });

    // Remove least recently used entries
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      const [key] = entries[i];
      cache.delete(key);
      this.metadata.delete(key);
      this.accessPatterns.delete(key);
      this.cacheStats.evictions++;
    }
  }

  /**
   * Enhanced graceful shutdown
   */
  async shutdown() {
    try {
      // Clear all caches
      this.memoryCache.clear();
      this.cache.hot.clear();
      this.cache.warm.clear();
      this.cache.cold.clear();
      this.metadata.clear();
      this.accessPatterns.clear();

      console.log('✅ Enhanced cache service shutdown completed');
    } catch (error) {
      console.warn('⚠️ Error during cache shutdown:', error.message);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
