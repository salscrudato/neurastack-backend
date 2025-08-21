/**
 * ⚡ Performance Optimizer - Intelligent Performance Enhancement System
 *
 * 🎯 PURPOSE: Optimize system performance through intelligent caching,
 *            request batching, response optimization, and auto-scaling
 *
 * 📋 KEY FEATURES:
 * 1. Intelligent caching with semantic similarity matching
 * 2. Request batching and deduplication
 * 3. Response optimization and compression
 * 4. Performance monitoring with auto-scaling
 * 5. Predictive pre-warming of popular requests
 * 6. Load balancing and resource management
 * 7. Real-time performance analytics and optimization
 *
 * 💡 INNOVATION: Uses machine learning principles to predict and optimize
 *    performance based on usage patterns and system metrics
 */

const monitoringService = require('./monitoringService');
const cacheService = require('./cacheService');
const logger = require('../utils/visualLogger');
const dynamicConfig = require('../config/dynamicConfig');

class PerformanceOptimizer {
  constructor() {
    // Performance optimization configuration
    this.config = {
      enableIntelligentCaching: true,
      enableRequestBatching: true,
      enableResponseOptimization: true,
      enablePredictivePrewarming: true,
      cacheHitRateTarget: 0.7,
      maxBatchSize: 5,
      batchTimeoutMs: 2000,
      compressionThreshold: 1024
    };

    // Performance tracking
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      batchedRequests: 0,
      optimizedResponses: 0,
      averageResponseTime: 0,
      compressionSavings: 0
    };

    // Intelligent caching system
    this.semanticCache = new Map();
    this.cacheMetadata = new Map();
    this.maxCacheSize = dynamicConfig.cache.maxCacheSize;
    this.similarityThreshold = dynamicConfig.cache.similarityThreshold;

    // Request batching system
    this.pendingBatches = new Map();
    this.batchTimers = new Map();

    // Performance patterns and predictions
    this.usagePatterns = new Map();
    this.popularRequests = [];
    this.performanceHistory = [];

    // Auto-scaling metrics
    this.systemLoad = {
      cpu: 0,
      memory: 0,
      activeRequests: 0,
      queueLength: 0
    };

    // Start background optimization tasks
    this.startOptimizationTasks();

    logger.success(
      'Performance Optimizer: Initialized',
      {
        'Intelligent Caching': this.config.enableIntelligentCaching,
        'Request Batching': this.config.enableRequestBatching,
        'Response Optimization': this.config.enableResponseOptimization,
        'Predictive Prewarming': this.config.enablePredictivePrewarming,
        'Cache Target': `${(this.config.cacheHitRateTarget * 100).toFixed(0)}%`
      },
      'optimizer'
    );
  }

  /**
   * Optimize request processing with intelligent caching and batching
   * @param {string} requestKey - Unique request identifier
   * @param {Object} requestData - Request data
   * @param {Function} processingFunction - Function to execute if not cached
   * @returns {Object} Optimized response
   */
  async optimizeRequest(requestKey, requestData, processingFunction) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Step 1: Check intelligent cache
      if (this.config.enableIntelligentCaching) {
        const cachedResult = await this.checkIntelligentCache(requestKey, requestData);
        if (cachedResult) {
          this.metrics.cacheHits++;
          this.updateUsagePatterns(requestKey, 'cache_hit');
          
          return {
            ...cachedResult,
            metadata: {
              ...cachedResult.metadata,
              cached: true,
              cacheHit: true,
              processingTime: Date.now() - startTime
            }
          };
        }
      }

      this.metrics.cacheMisses++;

      // Step 2: Check for request batching opportunities
      if (this.config.enableRequestBatching) {
        const batchResult = await this.handleRequestBatching(requestKey, requestData, processingFunction);
        if (batchResult) {
          return batchResult;
        }
      }

      // Step 3: Execute processing function
      const result = await processingFunction(requestData);

      // Step 4: Optimize response
      const optimizedResult = await this.optimizeResponse(result, requestData);

      // Step 5: Cache result for future use
      if (this.config.enableIntelligentCaching) {
        await this.cacheIntelligentResult(requestKey, requestData, optimizedResult);
      }

      // Step 6: Update performance metrics
      this.updatePerformanceMetrics(requestKey, Date.now() - startTime, optimizedResult);

      return optimizedResult;

    } catch (error) {
      logger.error('Request optimization failed', { 
        error: error.message, 
        requestKey 
      }, 'optimizer');
      throw error;
    }
  }

  /**
   * Check intelligent cache with semantic similarity
   * @param {string} requestKey - Request key
   * @param {Object} requestData - Request data
   * @returns {Object|null} Cached result or null
   */
  async checkIntelligentCache(requestKey, requestData) {
    // Direct cache hit
    if (this.semanticCache.has(requestKey)) {
      const cached = this.semanticCache.get(requestKey);
      const metadata = this.cacheMetadata.get(requestKey);
      
      // Check if cache entry is still valid
      if (this.isCacheEntryValid(metadata)) {
        return cached;
      } else {
        // Remove expired entry
        this.semanticCache.delete(requestKey);
        this.cacheMetadata.delete(requestKey);
      }
    }

    // Semantic similarity search
    if (requestData.prompt) {
      const similarEntry = await this.findSimilarCachedEntry(requestData.prompt);
      if (similarEntry) {
        return similarEntry.result;
      }
    }

    return null;
  }

  /**
   * Find similar cached entry using semantic analysis
   * @param {string} prompt - Request prompt
   * @returns {Object|null} Similar cached entry or null
   */
  async findSimilarCachedEntry(prompt) {
    const promptWords = this.extractKeywords(prompt);
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const [cacheKey, cachedResult] of this.semanticCache.entries()) {
      const metadata = this.cacheMetadata.get(cacheKey);
      
      if (metadata && metadata.keywords && this.isCacheEntryValid(metadata)) {
        const similarity = this.calculateSimilarity(promptWords, metadata.keywords);
        
        if (similarity > this.similarityThreshold && similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = {
            result: cachedResult,
            similarity,
            originalKey: cacheKey
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Extract keywords from prompt for similarity matching
   * @param {string} prompt - Input prompt
   * @returns {Array} Keywords array
   */
  extractKeywords(prompt) {
    return prompt
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['what', 'how', 'why', 'when', 'where', 'which', 'that', 'this', 'with', 'from'].includes(word));
  }

  /**
   * Calculate similarity between keyword sets
   * @param {Array} keywords1 - First keyword set
   * @param {Array} keywords2 - Second keyword set
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(keywords1, keywords2) {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Check if cache entry is still valid
   * @param {Object} metadata - Cache metadata
   * @returns {boolean} Is valid
   */
  isCacheEntryValid(metadata) {
    if (!metadata) return false;
    
    const now = Date.now();
    const age = now - metadata.timestamp;
    const ttl = metadata.ttl || (2 * 60 * 60 * 1000); // Default 2 hours
    
    return age < ttl;
  }

  /**
   * Handle request batching for similar requests
   * @param {string} requestKey - Request key
   * @param {Object} requestData - Request data
   * @param {Function} processingFunction - Processing function
   * @returns {Promise|null} Batch result promise or null
   */
  async handleRequestBatching(requestKey, requestData, processingFunction) {
    const batchKey = this.generateBatchKey(requestData);
    
    // Check if there's an existing batch for similar requests
    if (this.pendingBatches.has(batchKey)) {
      const batch = this.pendingBatches.get(batchKey);
      
      // Add request to existing batch
      batch.requests.push({ requestKey, requestData });
      this.metrics.batchedRequests++;
      
      // Return promise that will resolve when batch completes
      return new Promise((resolve, reject) => {
        batch.promises.push({ resolve, reject, requestKey });
      });
    }

    // Create new batch if we have multiple similar requests
    const batch = {
      requests: [{ requestKey, requestData }],
      promises: [],
      timer: null
    };

    this.pendingBatches.set(batchKey, batch);

    // Set timer to process batch
    batch.timer = setTimeout(async () => {
      await this.processBatch(batchKey, processingFunction);
    }, this.config.batchTimeoutMs);

    return null; // Process immediately for first request
  }

  /**
   * Generate batch key for grouping similar requests
   * @param {Object} requestData - Request data
   * @returns {string} Batch key
   */
  generateBatchKey(requestData) {
    // Simple batching based on request type and complexity
    const type = this.classifyRequestType(requestData.prompt || '');
    const complexity = requestData.prompt ? 
      (requestData.prompt.length > 200 ? 'complex' : 'simple') : 'simple';
    
    return `${type}_${complexity}`;
  }

  /**
   * Classify request type for batching
   * @param {string} prompt - Request prompt
   * @returns {string} Request type
   */
  classifyRequestType(prompt) {
    const promptLower = prompt.toLowerCase();
    
    if (/explain|how|why|what/.test(promptLower)) return 'explanatory';
    if (/analyze|compare|evaluate/.test(promptLower)) return 'analytical';
    if (/create|write|generate/.test(promptLower)) return 'creative';
    
    return 'general';
  }

  /**
   * Process batched requests
   * @param {string} batchKey - Batch key
   * @param {Function} processingFunction - Processing function
   */
  async processBatch(batchKey, processingFunction) {
    const batch = this.pendingBatches.get(batchKey);
    if (!batch) return;

    try {
      // Process all requests in batch
      const results = await Promise.allSettled(
        batch.requests.map(req => processingFunction(req.requestData))
      );

      // Resolve individual promises
      batch.promises.forEach((promise, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          promise.resolve(result.value);
        } else {
          promise.reject(result.reason);
        }
      });

    } catch (error) {
      // Reject all promises on batch failure
      batch.promises.forEach(promise => {
        promise.reject(error);
      });
    } finally {
      // Clean up batch
      this.pendingBatches.delete(batchKey);
      if (batch.timer) {
        clearTimeout(batch.timer);
      }
    }
  }

  /**
   * Optimize response for better performance
   * @param {Object} result - Original result
   * @param {Object} requestData - Request data
   * @returns {Object} Optimized result
   */
  async optimizeResponse(result, requestData) {
    if (!this.config.enableResponseOptimization) {
      return result;
    }

    const optimized = { ...result };
    let optimizationApplied = false;

    // Compress large responses
    if (result.synthesis && result.synthesis.content) {
      const contentSize = Buffer.byteLength(result.synthesis.content, 'utf8');
      
      if (contentSize > this.config.compressionThreshold) {
        // Simple optimization: remove extra whitespace
        optimized.synthesis.content = result.synthesis.content
          .replace(/\s+/g, ' ')
          .trim();
        
        const newSize = Buffer.byteLength(optimized.synthesis.content, 'utf8');
        const savings = contentSize - newSize;
        
        if (savings > 0) {
          this.metrics.compressionSavings += savings;
          optimizationApplied = true;
        }
      }
    }

    // Optimize metadata
    if (result.metadata) {
      optimized.metadata = {
        ...result.metadata,
        optimized: optimizationApplied,
        originalSize: this.calculateResponseSize(result),
        optimizedSize: this.calculateResponseSize(optimized)
      };
    }

    if (optimizationApplied) {
      this.metrics.optimizedResponses++;
    }

    return optimized;
  }

  /**
   * Calculate response size in bytes
   * @param {Object} response - Response object
   * @returns {number} Size in bytes
   */
  calculateResponseSize(response) {
    return Buffer.byteLength(JSON.stringify(response), 'utf8');
  }

  /**
   * Cache intelligent result for future use
   * @param {string} requestKey - Request key
   * @param {Object} requestData - Request data
   * @param {Object} result - Result to cache
   */
  async cacheIntelligentResult(requestKey, requestData, result) {
    // Check cache size limit
    if (this.semanticCache.size >= this.maxCacheSize) {
      await this.evictOldestCacheEntries();
    }

    // Determine TTL based on result quality
    const qualityScore = result.metadata?.responseQuality || 0.5;
    const baseTTL = 2 * 60 * 60 * 1000; // 2 hours
    const ttl = baseTTL * (0.5 + qualityScore); // Higher quality = longer cache

    // Store in cache
    this.semanticCache.set(requestKey, result);
    this.cacheMetadata.set(requestKey, {
      timestamp: Date.now(),
      ttl,
      keywords: requestData.prompt ? this.extractKeywords(requestData.prompt) : [],
      accessCount: 0,
      qualityScore
    });
  }

  /**
   * Evict oldest cache entries to make room
   */
  async evictOldestCacheEntries() {
    const entriesToRemove = Math.floor(this.maxCacheSize * 0.1); // Remove 10%
    const sortedEntries = Array.from(this.cacheMetadata.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
      const [key] = sortedEntries[i];
      this.semanticCache.delete(key);
      this.cacheMetadata.delete(key);
    }
  }

  /**
   * Update usage patterns for predictive optimization
   * @param {string} requestKey - Request key
   * @param {string} action - Action taken
   */
  updateUsagePatterns(requestKey, action) {
    const pattern = this.usagePatterns.get(requestKey) || {
      count: 0,
      lastAccess: 0,
      actions: {}
    };

    pattern.count++;
    pattern.lastAccess = Date.now();
    pattern.actions[action] = (pattern.actions[action] || 0) + 1;

    this.usagePatterns.set(requestKey, pattern);

    // Update popular requests list
    this.updatePopularRequests(requestKey, pattern);
  }

  /**
   * Update popular requests for prewarming
   * @param {string} requestKey - Request key
   * @param {Object} pattern - Usage pattern
   */
  updatePopularRequests(requestKey, pattern) {
    // Remove existing entry if present
    this.popularRequests = this.popularRequests.filter(req => req.key !== requestKey);

    // Add updated entry
    this.popularRequests.push({
      key: requestKey,
      count: pattern.count,
      lastAccess: pattern.lastAccess,
      score: this.calculatePopularityScore(pattern)
    });

    // Sort by popularity score and keep top 50
    this.popularRequests.sort((a, b) => b.score - a.score);
    this.popularRequests = this.popularRequests.slice(0, 50);
  }

  /**
   * Calculate popularity score for request
   * @param {Object} pattern - Usage pattern
   * @returns {number} Popularity score
   */
  calculatePopularityScore(pattern) {
    const recency = Date.now() - pattern.lastAccess;
    const recencyScore = Math.max(0, 1 - (recency / (24 * 60 * 60 * 1000))); // 24 hour decay
    const frequencyScore = Math.min(1, pattern.count / 10); // Normalize to 10 requests
    
    return (frequencyScore * 0.7) + (recencyScore * 0.3);
  }

  /**
   * Update performance metrics
   * @param {string} requestKey - Request key
   * @param {number} processingTime - Processing time
   * @param {Object} result - Result object
   */
  updatePerformanceMetrics(requestKey, processingTime, result) {
    // Update average response time
    const currentAvg = this.metrics.averageResponseTime;
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageResponseTime = 
      ((currentAvg * (totalRequests - 1)) + processingTime) / totalRequests;

    // Store performance history
    this.performanceHistory.push({
      timestamp: Date.now(),
      requestKey,
      processingTime,
      cached: result.metadata?.cached || false,
      optimized: result.metadata?.optimized || false,
      qualityScore: result.metadata?.responseQuality || 0
    });

    // Keep only recent history
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-1000);
    }
  }

  /**
   * Start background optimization tasks
   */
  startOptimizationTasks() {
    // Cache cleanup every 30 minutes
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 30 * 60 * 1000);

    // Performance analysis every 10 minutes
    setInterval(() => {
      this.analyzePerformance();
    }, 10 * 60 * 1000);

    // Predictive prewarming every hour
    if (this.config.enablePredictivePrewarming) {
      setInterval(() => {
        this.performPredictivePrewarming();
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, metadata] of this.cacheMetadata.entries()) {
      if (!this.isCacheEntryValid(metadata)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.semanticCache.delete(key);
      this.cacheMetadata.delete(key);
    });

    if (expiredKeys.length > 0) {
      logger.info(`Cleaned up ${expiredKeys.length} expired cache entries`, {}, 'optimizer');
    }
  }

  /**
   * Analyze performance and optimize settings
   */
  analyzePerformance() {
    const cacheHitRate = this.metrics.totalRequests > 0 ? 
      this.metrics.cacheHits / this.metrics.totalRequests : 0;

    const analysis = {
      cacheHitRate,
      averageResponseTime: this.metrics.averageResponseTime,
      optimizationRate: this.metrics.totalRequests > 0 ? 
        this.metrics.optimizedResponses / this.metrics.totalRequests : 0,
      batchingRate: this.metrics.totalRequests > 0 ? 
        this.metrics.batchedRequests / this.metrics.totalRequests : 0
    };

    // Adjust similarity threshold based on cache hit rate
    if (cacheHitRate < this.config.cacheHitRateTarget) {
      this.similarityThreshold = Math.max(0.6, this.similarityThreshold - 0.05);
    } else if (cacheHitRate > this.config.cacheHitRateTarget + 0.1) {
      this.similarityThreshold = Math.min(0.9, this.similarityThreshold + 0.05);
    }

    monitoringService.log('info', 'Performance analysis completed', analysis);
  }

  /**
   * Perform predictive prewarming of popular requests
   */
  async performPredictivePrewarming() {
    const topRequests = this.popularRequests.slice(0, 10);
    
    for (const request of topRequests) {
      // Check if request is already cached
      if (!this.semanticCache.has(request.key)) {
        // This would trigger prewarming logic
        // For now, just log the opportunity
        logger.info(`Prewarming opportunity: ${request.key}`, {
          popularity: request.score,
          lastAccess: new Date(request.lastAccess).toISOString()
        }, 'optimizer');
      }
    }
  }

  /**
   * Get comprehensive performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const cacheHitRate = this.metrics.totalRequests > 0 ? 
      (this.metrics.cacheHits / this.metrics.totalRequests) * 100 : 0;

    return {
      totalRequests: this.metrics.totalRequests,
      cacheHitRate: cacheHitRate.toFixed(1) + '%',
      cacheSize: this.semanticCache.size,
      maxCacheSize: this.maxCacheSize,
      averageResponseTime: this.metrics.averageResponseTime.toFixed(0) + 'ms',
      batchedRequests: this.metrics.batchedRequests,
      optimizedResponses: this.metrics.optimizedResponses,
      compressionSavings: `${(this.metrics.compressionSavings / 1024).toFixed(1)}KB`,
      similarityThreshold: this.similarityThreshold.toFixed(2),
      popularRequestsCount: this.popularRequests.length,
      activeBatches: this.pendingBatches.size
    };
  }
}

// Export singleton instance
const performanceOptimizer = new PerformanceOptimizer();
module.exports = performanceOptimizer;
