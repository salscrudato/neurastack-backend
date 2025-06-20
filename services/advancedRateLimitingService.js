/**
 * Advanced Rate Limiting Service
 * Provides sophisticated rate limiting with sliding windows, burst allowances, and distributed support
 */

const redis = require('redis');

class AdvancedRateLimitingService {
  constructor() {
    this.redisClient = null;
    this.isRedisAvailable = false;
    this.memoryStore = new Map(); // Fallback in-memory store
    this.slidingWindows = new Map(); // For sliding window rate limiting
    
    // Rate limiting configurations by tier and endpoint type
    this.rateLimits = {
      free: {
        ensemble: { requests: 10, window: 60, burst: 2 }, // 10 req/min, 2 burst
        memory: { requests: 20, window: 60, burst: 5 },
        workout: { requests: 5, window: 60, burst: 1 },
        general: { requests: 50, window: 60, burst: 10 }
      },
      premium: {
        ensemble: { requests: 100, window: 60, burst: 20 },
        memory: { requests: 200, window: 60, burst: 50 },
        workout: { requests: 50, window: 60, burst: 10 },
        general: { requests: 500, window: 60, burst: 100 }
      },
      enterprise: {
        ensemble: { requests: 1000, window: 60, burst: 200 },
        memory: { requests: 2000, window: 60, burst: 500 },
        workout: { requests: 500, window: 60, burst: 100 },
        general: { requests: 5000, window: 60, burst: 1000 }
      }
    };

    this.initializeRedis();
    this.startCleanupInterval();
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    if (process.env.REDIS_URL) {
      try {
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL,
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              console.warn('⚠️ Redis connection refused, using memory store');
              return undefined;
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              return new Error('Redis retry time exhausted');
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });

        await this.redisClient.connect();
        this.isRedisAvailable = true;
        console.log('✅ Advanced rate limiting connected to Redis');
      } catch (error) {
        console.warn('⚠️ Redis connection failed, using memory store:', error.message);
        this.isRedisAvailable = false;
      }
    } else {
      console.log('📝 No Redis URL provided, using memory store for rate limiting');
    }
  }

  /**
   * Check rate limit using sliding window algorithm
   */
  async checkRateLimit(userId, tier, endpointType, identifier = null) {
    const key = this.generateKey(userId, tier, endpointType, identifier);
    const config = this.rateLimits[tier]?.[endpointType] || this.rateLimits.free.general;
    
    const now = Date.now();
    const windowStart = now - (config.window * 1000);

    try {
      if (this.isRedisAvailable && this.redisClient) {
        return await this.checkRateLimitRedis(key, config, now, windowStart);
      } else {
        return await this.checkRateLimitMemory(key, config, now, windowStart);
      }
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow request if rate limiting fails
      return { allowed: true, remaining: config.requests, resetTime: now + (config.window * 1000) };
    }
  }

  /**
   * Redis-based rate limiting with sliding window
   */
  async checkRateLimitRedis(key, config, now, windowStart) {
    const pipeline = this.redisClient.multi();
    
    // Remove old entries outside the window
    pipeline.zRemRangeByScore(key, 0, windowStart);
    
    // Count current requests in window
    pipeline.zCard(key);
    
    // Add current request
    pipeline.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
    
    // Set expiration
    pipeline.expire(key, config.window * 2);
    
    const results = await pipeline.exec();
    const currentCount = results[1][1];
    
    const allowed = currentCount < config.requests;
    const remaining = Math.max(0, config.requests - currentCount - 1);
    const resetTime = now + (config.window * 1000);

    return {
      allowed,
      remaining,
      resetTime,
      currentCount: currentCount + 1,
      limit: config.requests,
      window: config.window
    };
  }

  /**
   * Memory-based rate limiting with sliding window
   */
  async checkRateLimitMemory(key, config, now, windowStart) {
    if (!this.slidingWindows.has(key)) {
      this.slidingWindows.set(key, []);
    }

    const requests = this.slidingWindows.get(key);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if we can allow this request
    const allowed = validRequests.length < config.requests;
    
    if (allowed) {
      validRequests.push(now);
    }
    
    this.slidingWindows.set(key, validRequests);
    
    const remaining = Math.max(0, config.requests - validRequests.length);
    const resetTime = now + (config.window * 1000);

    return {
      allowed,
      remaining,
      resetTime,
      currentCount: validRequests.length,
      limit: config.requests,
      window: config.window
    };
  }

  /**
   * Check burst allowance
   */
  async checkBurstLimit(userId, tier, endpointType) {
    const burstKey = `burst:${userId}:${tier}:${endpointType}`;
    const config = this.rateLimits[tier]?.[endpointType] || this.rateLimits.free.general;
    const now = Date.now();
    const burstWindow = 10 * 1000; // 10 seconds burst window
    const windowStart = now - burstWindow;

    try {
      if (this.isRedisAvailable && this.redisClient) {
        // Redis burst check
        const pipeline = this.redisClient.multi();
        pipeline.zRemRangeByScore(burstKey, 0, windowStart);
        pipeline.zCard(burstKey);
        pipeline.zAdd(burstKey, { score: now, value: `${now}-${Math.random()}` });
        pipeline.expire(burstKey, 60);
        
        const results = await pipeline.exec();
        const burstCount = results[1][1];
        
        return {
          allowed: burstCount < config.burst,
          remaining: Math.max(0, config.burst - burstCount - 1),
          burstLimit: config.burst
        };
      } else {
        // Memory burst check
        if (!this.slidingWindows.has(burstKey)) {
          this.slidingWindows.set(burstKey, []);
        }

        const burstRequests = this.slidingWindows.get(burstKey);
        const validBurstRequests = burstRequests.filter(timestamp => timestamp > windowStart);
        
        const allowed = validBurstRequests.length < config.burst;
        
        if (allowed) {
          validBurstRequests.push(now);
        }
        
        this.slidingWindows.set(burstKey, validBurstRequests);
        
        return {
          allowed,
          remaining: Math.max(0, config.burst - validBurstRequests.length),
          burstLimit: config.burst
        };
      }
    } catch (error) {
      console.error('Burst limit check failed:', error);
      return { allowed: true, remaining: config.burst, burstLimit: config.burst };
    }
  }

  /**
   * Comprehensive rate limit check (combines regular and burst limits)
   */
  async checkComprehensiveRateLimit(userId, tier, endpointType, identifier = null) {
    const [regularLimit, burstLimit] = await Promise.all([
      this.checkRateLimit(userId, tier, endpointType, identifier),
      this.checkBurstLimit(userId, tier, endpointType)
    ]);

    const allowed = regularLimit.allowed && burstLimit.allowed;
    
    return {
      allowed,
      regular: regularLimit,
      burst: burstLimit,
      reason: !allowed ? (!regularLimit.allowed ? 'rate_limit' : 'burst_limit') : null
    };
  }

  /**
   * Get rate limit status for user
   */
  async getRateLimitStatus(userId, tier) {
    const status = {};
    
    for (const endpointType of Object.keys(this.rateLimits[tier] || this.rateLimits.free)) {
      try {
        const limit = await this.checkRateLimit(userId, tier, endpointType);
        status[endpointType] = {
          remaining: limit.remaining,
          limit: limit.limit,
          resetTime: limit.resetTime,
          window: limit.window
        };
      } catch (error) {
        console.error(`Failed to get rate limit status for ${endpointType}:`, error);
        status[endpointType] = { error: 'Unable to check rate limit' };
      }
    }
    
    return status;
  }

  /**
   * Reset rate limits for user (admin function)
   */
  async resetRateLimits(userId, tier = null, endpointType = null) {
    const patterns = [];
    
    if (tier && endpointType) {
      patterns.push(this.generateKey(userId, tier, endpointType));
    } else if (tier) {
      for (const endpoint of Object.keys(this.rateLimits[tier] || {})) {
        patterns.push(this.generateKey(userId, tier, endpoint));
      }
    } else {
      // Reset all tiers and endpoints for user
      for (const tierName of Object.keys(this.rateLimits)) {
        for (const endpoint of Object.keys(this.rateLimits[tierName])) {
          patterns.push(this.generateKey(userId, tierName, endpoint));
        }
      }
    }

    try {
      if (this.isRedisAvailable && this.redisClient) {
        for (const pattern of patterns) {
          await this.redisClient.del(pattern);
        }
      } else {
        for (const pattern of patterns) {
          this.slidingWindows.delete(pattern);
        }
      }
      
      console.log(`✅ Reset rate limits for user ${userId}`);
      return true;
    } catch (error) {
      console.error('Failed to reset rate limits:', error);
      return false;
    }
  }

  /**
   * Generate rate limit key
   */
  generateKey(userId, tier, endpointType, identifier = null) {
    const base = `ratelimit:${userId}:${tier}:${endpointType}`;
    return identifier ? `${base}:${identifier}` : base;
  }

  /**
   * Start cleanup interval for memory store
   */
  startCleanupInterval() {
    setInterval(() => {
      this.cleanupMemoryStore();
    }, 5 * 60 * 1000); // Cleanup every 5 minutes
  }

  /**
   * Cleanup old entries from memory store
   */
  cleanupMemoryStore() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    for (const [key, requests] of this.slidingWindows.entries()) {
      const validRequests = requests.filter(timestamp => (now - timestamp) < maxAge);
      
      if (validRequests.length === 0) {
        this.slidingWindows.delete(key);
      } else {
        this.slidingWindows.set(key, validRequests);
      }
    }
    
    console.log(`🧹 Rate limiting cleanup: ${this.slidingWindows.size} active windows`);
  }

  /**
   * Get rate limiting metrics
   */
  getMetrics() {
    return {
      redisAvailable: this.isRedisAvailable,
      memoryWindowsCount: this.slidingWindows.size,
      rateLimitConfigs: this.rateLimits,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AdvancedRateLimitingService();
