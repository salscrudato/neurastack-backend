/**
 * 🚀 Enhanced Ensemble Cache Service
 * 
 * 🎯 PURPOSE: Provide intelligent caching for ensemble responses with
 *            similarity matching, predictive caching, and performance optimization
 * 
 * 📋 KEY FEATURES:
 * 1. Semantic similarity matching for cache hits
 * 2. Predictive caching based on user patterns
 * 3. Tiered caching with compression
 * 4. Response quality-based caching decisions
 * 5. User-specific cache optimization
 * 6. Real-time cache performance monitoring
 */

const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const compress = promisify(zlib.gzip);
const decompress = promisify(zlib.gunzip);

const dynamicConfig = require('../config/dynamicConfig');

class EnhancedEnsembleCache {
  constructor(cacheService, monitoringService) {
    this.cacheService = cacheService;
    this.monitoringService = monitoringService;
    
    // Enhanced cache layers
    this.responseCache = new Map();      // Full ensemble responses
    this.similarityIndex = new Map();    // Semantic similarity index
    this.userPatterns = new Map();       // User query patterns
    this.qualityIndex = new Map();       // Response quality index
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      similarityHits: 0,
      qualityFiltered: 0,
      compressionSavings: 0,
      averageRetrievalTime: 0,
      predictiveHits: 0
    };
    
    // Configuration - using dynamic config
    this.config = {
      maxCacheSize: dynamicConfig.cache.maxCacheSize,
      similarityThreshold: dynamicConfig.cache.similarityThreshold,
      qualityThreshold: dynamicConfig.cache.qualityThreshold,
      compressionThreshold: dynamicConfig.cache.compressionThreshold,
      userPatternWindow: dynamicConfig.cache.userPatternWindow,
      predictiveCacheSize: dynamicConfig.cache.predictiveCacheSize,
      ttl: {
        highQuality: dynamicConfig.cache.ttl.highQuality,
        mediumQuality: dynamicConfig.cache.ttl.mediumQuality,
        lowQuality: dynamicConfig.cache.ttl.lowQuality
      }
    };

    console.log('🚀 Enhanced Ensemble Cache initialized with dynamic configuration');
    console.log(`   Max Cache Size: ${this.config.maxCacheSize}`);
    console.log(`   Similarity Threshold: ${this.config.similarityThreshold}`);
    console.log(`   Quality Threshold: ${this.config.qualityThreshold}`);
    console.log(`   TTL High/Medium/Low: ${this.config.ttl.highQuality}s/${this.config.ttl.mediumQuality}s/${this.config.ttl.lowQuality}s`);
    
    this.startCleanupInterval();
    console.log('🚀 Enhanced Ensemble Cache initialized');
  }

  /**
   * Get cached ensemble response with similarity matching
   */
  async getCachedEnsembleResponse(prompt, userId, tier = 'free') {
    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    try {
      // Generate cache key
      const exactKey = this.generateCacheKey(prompt, userId, tier);
      
      // Check exact match first
      let cached = await this.getExactMatch(exactKey);
      if (cached) {
        this.metrics.cacheHits++;
        this.recordRetrievalTime(Date.now() - startTime);
        console.log(`🎯 Exact cache hit: ${exactKey.substring(0, 20)}...`);
        return cached;
      }
      
      // Check similarity matches
      cached = await this.getSimilarResponse(prompt, userId, tier);
      if (cached) {
        this.metrics.similarityHits++;
        this.recordRetrievalTime(Date.now() - startTime);
        console.log(`🎯 Similarity cache hit for prompt: ${prompt.substring(0, 50)}...`);
        return cached;
      }
      
      // Check predictive cache
      cached = await this.getPredictiveResponse(prompt, userId);
      if (cached) {
        this.metrics.predictiveHits++;
        this.recordRetrievalTime(Date.now() - startTime);
        console.log(`🎯 Predictive cache hit for user: ${userId}`);
        return cached;
      }
      
      console.log(`❌ Cache miss for: ${prompt.substring(0, 50)}...`);
      return null;
      
    } catch (error) {
      console.error('❌ Enhanced cache retrieval error:', error.message);
      return null;
    }
  }

  /**
   * Cache ensemble response with quality-based TTL
   */
  async cacheEnsembleResponse(prompt, userId, tier, response) {
    try {
      const cacheKey = this.generateCacheKey(prompt, userId, tier);
      const quality = this.assessResponseQuality(response);
      
      // Only cache high-quality responses
      if (quality.score < this.config.qualityThreshold) {
        this.metrics.qualityFiltered++;
        console.log(`⚠️ Response quality too low to cache: ${quality.score}`);
        return;
      }
      
      // Prepare cache entry
      const cacheEntry = {
        response,
        quality: quality.score,
        timestamp: Date.now(),
        userId,
        tier,
        accessCount: 0,
        promptHash: this.generatePromptHash(prompt)
      };
      
      // Compress if needed
      if (JSON.stringify(cacheEntry).length > this.config.compressionThreshold) {
        cacheEntry.compressed = true;
        cacheEntry.data = await compress(JSON.stringify(response));
        this.metrics.compressionSavings++;
      } else {
        cacheEntry.data = response;
      }
      
      // Determine TTL based on quality
      const ttl = this.getTTLByQuality(quality.score);
      
      // Store in multiple cache layers
      await this.storeInMultipleLayers(cacheKey, cacheEntry, ttl, prompt, userId);
      
      // Update user patterns
      this.updateUserPatterns(userId, prompt, response);
      
      console.log(`💾 Cached ensemble response: ${cacheKey.substring(0, 20)}... (TTL: ${ttl}s, Quality: ${quality.score.toFixed(2)})`);
      
    } catch (error) {
      console.error('❌ Enhanced cache storage error:', error.message);
    }
  }

  /**
   * Get exact cache match
   */
  async getExactMatch(key) {
    // Check memory cache first
    const memoryEntry = this.responseCache.get(key);
    if (memoryEntry && this.isValidEntry(memoryEntry)) {
      memoryEntry.accessCount++;
      return await this.deserializeResponse(memoryEntry);
    }
    
    // Check persistent cache
    const persistentEntry = await this.cacheService.get(key);
    if (persistentEntry && this.isValidEntry(persistentEntry)) {
      // Promote to memory cache
      this.responseCache.set(key, persistentEntry);
      return await this.deserializeResponse(persistentEntry);
    }
    
    return null;
  }

  /**
   * Get similar response using semantic matching
   */
  async getSimilarResponse(prompt, userId, tier) {
    const promptHash = this.generatePromptHash(prompt);
    const promptVector = this.generatePromptVector(prompt);
    
    // Search similarity index
    for (const [key, entry] of this.similarityIndex.entries()) {
      if (entry.userId === userId && entry.tier === tier) {
        const similarity = this.calculateSimilarity(promptVector, entry.vector);
        
        if (similarity > this.config.similarityThreshold) {
          // Get the actual cached response
          const cached = await this.getExactMatch(entry.cacheKey);
          if (cached) {
            console.log(`🎯 Similarity match: ${(similarity * 100).toFixed(1)}%`);
            return cached;
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Get predictive response based on user patterns
   */
  async getPredictiveResponse(prompt, userId) {
    const userPattern = this.userPatterns.get(userId);
    if (!userPattern) return null;
    
    // Analyze user's query patterns
    const promptType = this.classifyPrompt(prompt);
    const similarQueries = userPattern.queries.filter(q => 
      this.classifyPrompt(q.prompt) === promptType
    );
    
    if (similarQueries.length > 0) {
      // Find most similar previous query
      const mostSimilar = similarQueries.reduce((best, current) => {
        const similarity = this.calculateTextSimilarity(prompt, current.prompt);
        return similarity > best.similarity ? { ...current, similarity } : best;
      }, { similarity: 0 });
      
      if (mostSimilar.similarity > 0.7) {
        const cached = await this.getExactMatch(mostSimilar.cacheKey);
        if (cached) {
          return cached;
        }
      }
    }
    
    return null;
  }

  /**
   * Store in multiple cache layers
   */
  async storeInMultipleLayers(cacheKey, cacheEntry, ttl, prompt, userId) {
    // Store in memory cache
    this.responseCache.set(cacheKey, cacheEntry);
    
    // Store in persistent cache
    await this.cacheService.set(cacheKey, cacheEntry, ttl);
    
    // Update similarity index
    const promptVector = this.generatePromptVector(prompt);
    this.similarityIndex.set(cacheKey, {
      vector: promptVector,
      userId,
      tier: cacheEntry.tier,
      cacheKey,
      timestamp: Date.now()
    });
    
    // Update quality index
    this.qualityIndex.set(cacheKey, {
      quality: cacheEntry.quality,
      timestamp: Date.now(),
      accessCount: 0
    });
    
    // Cleanup if needed
    this.cleanupCaches();
  }

  /**
   * Assess response quality for caching decisions
   */
  assessResponseQuality(response) {
    let score = 0.5; // Base score
    
    // Check synthesis quality
    if (response.synthesis) {
      const synthesis = response.synthesis;
      
      // Content length factor
      const contentLength = synthesis.content?.length || 0;
      if (contentLength > 500 && contentLength < 3000) score += 0.1;
      
      // Confidence factor
      if (synthesis.confidence?.score) {
        score += synthesis.confidence.score * 0.2;
      }
      
      // Validation factor
      if (synthesis.validation?.overallQuality) {
        score += synthesis.validation.overallQuality * 0.2;
      }
    }
    
    // Check voting consensus
    if (response.voting?.consensus) {
      const consensus = response.voting.consensus;
      if (consensus === 'strong') score += 0.1;
      else if (consensus === 'moderate') score += 0.05;
    }
    
    // Check successful roles
    if (response.metadata?.successfulRoles && response.metadata?.totalRoles) {
      const successRate = response.metadata.successfulRoles / response.metadata.totalRoles;
      score += successRate * 0.1;
    }
    
    return {
      score: Math.min(1.0, Math.max(0.0, score)),
      factors: ['content_length', 'confidence', 'validation', 'consensus', 'success_rate']
    };
  }

  /**
   * Generate cache key
   */
  generateCacheKey(prompt, userId, tier) {
    const hash = crypto.createHash('sha256')
      .update(`${prompt}:${userId}:${tier}`)
      .digest('hex');
    return `ensemble:${hash.substring(0, 32)}`;
  }

  /**
   * Generate prompt hash for similarity matching
   */
  generatePromptHash(prompt) {
    return crypto.createHash('md5').update(prompt.toLowerCase().trim()).digest('hex');
  }

  /**
   * Generate prompt vector for similarity calculations
   */
  generatePromptVector(prompt) {
    // Simple word frequency vector (in production, use embeddings)
    const words = prompt.toLowerCase().split(/\s+/);
    const vector = {};
    
    words.forEach(word => {
      if (word.length > 2) {
        vector[word] = (vector[word] || 0) + 1;
      }
    });
    
    return vector;
  }

  /**
   * Calculate similarity between prompt vectors
   */
  calculateSimilarity(vector1, vector2) {
    const keys1 = Object.keys(vector1);
    const keys2 = Object.keys(vector2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (const key of allKeys) {
      const val1 = vector1[key] || 0;
      const val2 = vector2[key] || 0;
      
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Calculate text similarity
   */
  calculateTextSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Classify prompt type for pattern matching
   */
  classifyPrompt(prompt) {
    const lower = prompt.toLowerCase();
    
    if (lower.includes('what') || lower.includes('define')) return 'definition';
    if (lower.includes('how') || lower.includes('explain')) return 'explanation';
    if (lower.includes('why') || lower.includes('reason')) return 'reasoning';
    if (lower.includes('benefit') || lower.includes('advantage')) return 'benefits';
    if (lower.includes('compare') || lower.includes('difference')) return 'comparison';
    
    return 'general';
  }

  /**
   * Update user patterns for predictive caching
   */
  updateUserPatterns(userId, prompt, response) {
    if (!this.userPatterns.has(userId)) {
      this.userPatterns.set(userId, {
        queries: [],
        preferences: {},
        lastActivity: Date.now()
      });
    }
    
    const pattern = this.userPatterns.get(userId);
    const cacheKey = this.generateCacheKey(prompt, userId, 'free');
    
    pattern.queries.push({
      prompt,
      cacheKey,
      timestamp: Date.now(),
      quality: this.assessResponseQuality(response).score
    });
    
    // Keep only recent queries
    if (pattern.queries.length > this.config.userPatternWindow) {
      pattern.queries = pattern.queries.slice(-this.config.userPatternWindow);
    }
    
    pattern.lastActivity = Date.now();
  }

  /**
   * Get TTL based on response quality
   */
  getTTLByQuality(quality) {
    if (quality >= 0.8) return this.config.ttl.highQuality;
    if (quality >= 0.6) return this.config.ttl.mediumQuality;
    return this.config.ttl.lowQuality;
  }

  /**
   * Check if cache entry is valid
   */
  isValidEntry(entry) {
    if (!entry || !entry.timestamp) return false;
    
    const ttl = this.getTTLByQuality(entry.quality || 0.5);
    const age = Date.now() - entry.timestamp;
    
    return age < (ttl * 1000);
  }

  /**
   * Deserialize cached response
   */
  async deserializeResponse(entry) {
    if (entry.compressed) {
      const decompressed = await decompress(entry.data);
      return JSON.parse(decompressed.toString());
    }
    
    return entry.data;
  }

  /**
   * Record retrieval time for metrics
   */
  recordRetrievalTime(time) {
    this.metrics.averageRetrievalTime = 
      (this.metrics.averageRetrievalTime + time) / 2;
  }

  /**
   * Cleanup caches when they get too large
   */
  cleanupCaches() {
    // Cleanup memory cache
    if (this.responseCache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.responseCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, Math.floor(this.config.maxCacheSize * 0.2));
      toDelete.forEach(([key]) => this.responseCache.delete(key));
    }
    
    // Cleanup similarity index
    if (this.similarityIndex.size > this.config.maxCacheSize) {
      const entries = Array.from(this.similarityIndex.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, Math.floor(this.config.maxCacheSize * 0.2));
      toDelete.forEach(([key]) => this.similarityIndex.delete(key));
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupCaches();
      
      // Cleanup old user patterns
      for (const [userId, pattern] of this.userPatterns.entries()) {
        if (Date.now() - pattern.lastActivity > 86400000) { // 24 hours
          this.userPatterns.delete(userId);
        }
      }
    }, 300000); // 5 minutes
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.metrics.totalRequests > 0 ? 
      (this.metrics.cacheHits + this.metrics.similarityHits + this.metrics.predictiveHits) / this.metrics.totalRequests : 0;
    
    return {
      ...this.metrics,
      hitRate: hitRate * 100,
      cacheSize: this.responseCache.size,
      similarityIndexSize: this.similarityIndex.size,
      userPatternsSize: this.userPatterns.size,
      qualityIndexSize: this.qualityIndex.size
    };
  }
}

module.exports = EnhancedEnsembleCache;
