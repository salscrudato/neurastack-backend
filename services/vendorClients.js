const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

/**
 * Enhanced Vendor Client Manager with Connection Pooling, Circuit Breaker, and Resilience
 */
class EnhancedVendorClients {
  constructor() {
    this.circuitBreakers = new Map();
    this.requestQueues = new Map();
    this.metrics = new Map();
    this.connectionPools = new Map();

    this.initializeClients();
    this.initializeCircuitBreakers();
    this.startMetricsCollection();
  }

  initializeClients() {
    try {
      // OpenAI client with enhanced configuration
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 50000, // 50 second timeout for complex requests
        maxRetries: 2
      });

      // X.AI client with enhanced configuration
      this.xai = new OpenAI({
        apiKey: process.env.XAI_API_KEY,
        baseURL: 'https://api.x.ai/v1',
        timeout: 30000,
        maxRetries: 2
      });

      // Enhanced Axios clients with optimized connection pooling for 25+ concurrent users
      const axiosConfig = {
        timeout: 45000, // Increased timeout for better reliability under load
        maxRedirects: 3,
        // Optimized connection pooling for high concurrency
        httpAgent: new (require('http').Agent)({
          keepAlive: true,
          maxSockets: 25,        // Increased for 25+ concurrent users
          maxFreeSockets: 10,    // More free sockets for better performance
          timeout: 90000,        // Longer socket timeout for stability
          freeSocketTimeout: 45000, // Balanced free socket timeout
          scheduling: 'fifo'     // First-in-first-out scheduling for fairness
        }),
        httpsAgent: new (require('https').Agent)({
          keepAlive: true,
          maxSockets: 25,        // Increased for 25+ concurrent users
          maxFreeSockets: 10,    // More free sockets for better performance
          timeout: 90000,        // Longer socket timeout for stability
          freeSocketTimeout: 45000, // Balanced free socket timeout
          scheduling: 'fifo'     // First-in-first-out scheduling for fairness
        }),
        // Additional performance optimizations
        maxContentLength: 50 * 1024 * 1024, // 50MB max response size
        maxBodyLength: 10 * 1024 * 1024,    // 10MB max request size
        validateStatus: (status) => status < 500 // Retry on 5xx errors only
      };

      this.gemini = axios.create({
        ...axiosConfig,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        params: { key: process.env.GEMINI_API_KEY },
        headers: { 'Content-Type': 'application/json' }
      });

      this.claude = axios.create({
        ...axiosConfig,
        baseURL: 'https://api.anthropic.com/v1',
        headers: {
          'x-api-key': process.env.CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });

      // Add response interceptors for metrics and error handling
      this.setupInterceptors();
    } catch (error) {
      console.error('Failed to initialize enhanced clients:', error.message);
      // Fallback to basic clients for backward compatibility
      this.initializeBasicClients();
    }
  }

  initializeBasicClients() {
    // Fallback to basic client initialization
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.xai = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1'
    });

    this.gemini = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      params: { key: process.env.GEMINI_API_KEY },
      headers: { 'Content-Type': 'application/json' }
    });

    this.claude = axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });
  }

  initializeCircuitBreakers() {
    const providers = ['openai', 'xai', 'gemini', 'claude'];

    providers.forEach(provider => {
      this.circuitBreakers.set(provider, {
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        threshold: 5, // Optimized threshold for 25+ concurrent users
        timeout: 20000, // Faster recovery for high-load scenarios (20 seconds)
        resetSuccessCount: 3, // More successes needed for stability under load

        // Enhanced circuit breaker features for production load
        failureRate: 0, // Track failure rate over time window
        timeWindow: 90000, // Extended time window for better failure rate calculation (90 seconds)
        consecutiveFailures: 0, // Track consecutive failures for faster detection
        lastSuccessTime: Date.now(), // Track last successful request
        adaptiveThreshold: true, // Enable adaptive threshold based on load
        recentRequests: [], // Track recent requests for failure rate
        adaptiveThreshold: true, // Enable adaptive threshold based on load
        gracefulDegradation: true, // Enable graceful degradation
        fallbackStrategy: 'best_effort' // Fallback strategy when circuit is open
      });

      this.requestQueues.set(provider, []);
      this.metrics.set(provider, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: null,

        // Enhanced metrics
        responseTimeHistory: [], // Track response time history
        errorTypes: new Map(), // Track different error types
        loadFactor: 0, // Current load factor (0-1)
        healthScore: 1.0, // Overall health score (0-1)
        lastHealthCheck: Date.now(),
        consecutiveFailures: 0,
        consecutiveSuccesses: 0
      });
    });
  }

  setupInterceptors() {
    try {
      // Only setup interceptors if clients have them (axios clients)
      if (this.gemini && this.gemini.interceptors) {
        this.gemini.interceptors.request.use(
          (config) => this.onRequestStart('gemini', config),
          (error) => this.onRequestError('gemini', error)
        );

        this.gemini.interceptors.response.use(
          (response) => this.onRequestSuccess('gemini', response),
          (error) => this.onRequestError('gemini', error)
        );
      }

      if (this.claude && this.claude.interceptors) {
        this.claude.interceptors.request.use(
          (config) => this.onRequestStart('claude', config),
          (error) => this.onRequestError('claude', error)
        );

        this.claude.interceptors.response.use(
          (response) => this.onRequestSuccess('claude', response),
          (error) => this.onRequestError('claude', error)
        );
      }
    } catch (error) {
      console.warn('Failed to setup interceptors:', error.message);
    }
  }

  onRequestStart(provider, config) {
    config.metadata = { startTime: Date.now() };
    const metrics = this.metrics.get(provider);
    metrics.totalRequests++;
    metrics.lastRequestTime = Date.now();
    return config;
  }

  onRequestSuccess(provider, response) {
    const endTime = Date.now();
    const startTime = response.config.metadata?.startTime || endTime;
    const responseTime = endTime - startTime;

    const metrics = this.metrics.get(provider);
    metrics.successfulRequests++;
    metrics.averageResponseTime = (metrics.averageResponseTime + responseTime) / 2;

    this.recordCircuitBreakerSuccess(provider);
    return response;
  }

  onRequestError(provider, error) {
    const metrics = this.metrics.get(provider);
    metrics.failedRequests++;

    this.recordCircuitBreakerFailure(provider);
    return Promise.reject(error);
  }

  recordCircuitBreakerSuccess(provider, responseTime = 0) {
    const breaker = this.circuitBreakers.get(provider);
    const metrics = this.metrics.get(provider);
    const now = Date.now();

    breaker.successCount++;
    metrics.consecutiveSuccesses++;
    metrics.consecutiveFailures = 0;

    // Add to recent requests
    breaker.recentRequests.push({ timestamp: now, success: true, responseTime });

    // Clean old requests outside time window
    breaker.recentRequests = breaker.recentRequests.filter(
      req => now - req.timestamp <= breaker.timeWindow
    );

    // Update failure rate
    const totalRecent = breaker.recentRequests.length;
    const failedRecent = breaker.recentRequests.filter(req => !req.success).length;
    breaker.failureRate = totalRecent > 0 ? failedRecent / totalRecent : 0;

    // Improve health score
    metrics.healthScore = Math.min(1.0, metrics.healthScore + 0.05);

    // Update response time history
    if (responseTime > 0) {
      metrics.responseTimeHistory.push(responseTime);
      if (metrics.responseTimeHistory.length > 100) {
        metrics.responseTimeHistory.shift(); // Keep only last 100 measurements
      }

      // Update average response time
      metrics.averageResponseTime = metrics.responseTimeHistory.reduce((a, b) => a + b, 0) /
                                   metrics.responseTimeHistory.length;
    }

    // Close circuit breaker if conditions are met
    if (breaker.state === 'HALF_OPEN' && breaker.successCount >= breaker.resetSuccessCount) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      console.log(`🔄 Circuit breaker CLOSED for ${provider}`, {
        healthScore: metrics.healthScore,
        failureRate: breaker.failureRate,
        avgResponseTime: metrics.averageResponseTime
      });
    }
  }

  recordCircuitBreakerFailure(provider, error) {
    const breaker = this.circuitBreakers.get(provider);
    const metrics = this.metrics.get(provider);
    const now = Date.now();

    breaker.failureCount++;
    breaker.lastFailureTime = now;
    breaker.successCount = 0;
    metrics.consecutiveFailures++;
    metrics.consecutiveSuccesses = 0;

    // Track error types for analysis
    const errorType = this.categorizeError(error);
    const errorCount = metrics.errorTypes.get(errorType) || 0;
    metrics.errorTypes.set(errorType, errorCount + 1);

    // Add to recent requests for failure rate calculation
    breaker.recentRequests.push({ timestamp: now, success: false, error: errorType });

    // Clean old requests outside time window
    breaker.recentRequests = breaker.recentRequests.filter(
      req => now - req.timestamp <= breaker.timeWindow
    );

    // Calculate failure rate
    const totalRecent = breaker.recentRequests.length;
    const failedRecent = breaker.recentRequests.filter(req => !req.success).length;
    breaker.failureRate = totalRecent > 0 ? failedRecent / totalRecent : 0;

    // Update health score
    metrics.healthScore = Math.max(0, metrics.healthScore - 0.1);

    // Adaptive threshold based on load and error patterns
    let effectiveThreshold = breaker.threshold;
    if (breaker.adaptiveThreshold) {
      // Lower threshold during high load or for critical errors
      if (metrics.loadFactor > 0.8 || errorType === 'critical') {
        effectiveThreshold = Math.max(1, breaker.threshold - 1);
      }
    }

    // Open circuit breaker if threshold exceeded or failure rate too high
    if (breaker.state === 'CLOSED' &&
        (breaker.failureCount >= effectiveThreshold || breaker.failureRate > 0.5)) {
      breaker.state = 'OPEN';
      console.warn(`⚠️ Circuit breaker OPENED for ${provider}`, {
        failures: breaker.failureCount,
        threshold: effectiveThreshold,
        failureRate: breaker.failureRate,
        errorType,
        healthScore: metrics.healthScore
      });

      // Trigger graceful degradation if enabled
      if (breaker.gracefulDegradation) {
        this.enableGracefulDegradation(provider);
      }
    }
  }

  isCircuitBreakerOpen(provider) {
    const breaker = this.circuitBreakers.get(provider);

    if (breaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - breaker.lastFailureTime;
      if (timeSinceLastFailure > breaker.timeout) {
        breaker.state = 'HALF_OPEN';
        console.log(`🔄 Circuit breaker HALF_OPEN for ${provider}`);
        return false;
      }
      return true;
    }

    return false;
  }

  async executeWithCircuitBreaker(provider, operation) {
    if (this.isCircuitBreakerOpen(provider)) {
      // Try graceful degradation if available
      const fallbackResult = await this.tryGracefulDegradation(provider, operation);
      if (fallbackResult) {
        return fallbackResult;
      }
      throw new Error(`Circuit breaker is OPEN for ${provider} and no fallback available`);
    }

    const startTime = Date.now();
    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;
      this.recordCircuitBreakerSuccess(provider, responseTime);
      return result;
    } catch (error) {
      this.recordCircuitBreakerFailure(provider, error);
      throw error;
    }
  }

  /**
   * Categorize errors for better handling and analysis
   */
  categorizeError(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('timeout') || message.includes('etimedout')) {
      return 'timeout';
    } else if (message.includes('rate limit') || message.includes('429')) {
      return 'rate_limit';
    } else if (message.includes('network') || message.includes('econnreset')) {
      return 'network';
    } else if (message.includes('500') || message.includes('internal server')) {
      return 'server_error';
    } else if (message.includes('401') || message.includes('unauthorized')) {
      return 'auth_error';
    } else if (message.includes('400') || message.includes('bad request')) {
      return 'client_error';
    } else if (message.includes('503') || message.includes('unavailable')) {
      return 'critical';
    } else {
      return 'unknown';
    }
  }

  /**
   * Enable graceful degradation for a provider
   */
  enableGracefulDegradation(provider) {
    const breaker = this.circuitBreakers.get(provider);
    console.log(`🔄 Enabling graceful degradation for ${provider}`);

    // Set fallback strategy based on provider capabilities
    switch (provider) {
      case 'openai':
        breaker.fallbackStrategy = 'use_cache_or_simple_response';
        break;
      case 'claude':
        breaker.fallbackStrategy = 'use_alternative_model';
        break;
      case 'gemini':
        breaker.fallbackStrategy = 'reduce_complexity';
        break;
      default:
        breaker.fallbackStrategy = 'best_effort';
    }
  }

  /**
   * Try graceful degradation when circuit breaker is open
   */
  async tryGracefulDegradation(provider, operation) {
    const breaker = this.circuitBreakers.get(provider);

    switch (breaker.fallbackStrategy) {
      case 'use_cache_or_simple_response':
        // Return a simple cached response or basic acknowledgment
        return {
          content: 'Service temporarily unavailable. Please try again in a moment.',
          fallback: true,
          provider: 'fallback'
        };

      case 'use_alternative_model':
        // Try to use a different model from the same provider
        console.log(`🔄 Attempting fallback for ${provider}`);
        return null; // Let the ensemble handle with remaining providers

      case 'reduce_complexity':
        // Simplify the request and try again
        return null; // Let the ensemble handle with remaining providers

      default:
        return null;
    }
  }

  startMetricsCollection() {
    // Log metrics every 5 minutes
    setInterval(() => {
      this.logMetrics();
    }, 5 * 60 * 1000);
  }

  logMetrics() {
    console.log('📊 Vendor Client Metrics:');
    this.metrics.forEach((metrics, provider) => {
      const breaker = this.circuitBreakers.get(provider);
      console.log(`  ${provider}: ${metrics.successfulRequests}/${metrics.totalRequests} success, ` +
                  `avg: ${Math.round(metrics.averageResponseTime)}ms, circuit: ${breaker.state}`);
    });
  }

  getMetrics() {
    const result = {};
    this.metrics.forEach((metrics, provider) => {
      const breaker = this.circuitBreakers.get(provider);
      result[provider] = {
        ...metrics,
        circuitBreakerState: breaker.state,
        circuitBreakerFailures: breaker.failureCount
      };
    });
    return result;
  }

  // Get client by provider name
  getClient(provider) {
    switch (provider.toLowerCase()) {
      case 'openai':
        return this.openai;
      case 'xai':
        return this.xai;
      case 'gemini':
        return this.gemini;
      case 'claude':
        return this.claude;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // Health check method
  async healthCheck() {
    const health = {};

    for (const [provider, breaker] of this.circuitBreakers) {
      health[provider] = {
        circuitBreakerState: breaker.state,
        isHealthy: breaker.state !== 'OPEN',
        lastFailureTime: breaker.lastFailureTime,
        failureCount: breaker.failureCount
      };
    }

    return health;
  }
}

// Create singleton instance
const enhancedClients = new EnhancedVendorClients();

// Export both enhanced clients and legacy interface for backward compatibility
module.exports = {
  // Legacy interface
  openai: enhancedClients.openai,
  xai: enhancedClients.xai,
  gemini: enhancedClients.gemini,
  claude: enhancedClients.claude,

  // Enhanced interface
  enhanced: enhancedClients,

  // Utility methods
  getClient: (provider) => enhancedClients.getClient(provider),
  getMetrics: () => enhancedClients.getMetrics(),
  healthCheck: () => enhancedClients.healthCheck(),
  executeWithCircuitBreaker: (provider, operation) =>
    enhancedClients.executeWithCircuitBreaker(provider, operation)
};
