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

      // Enhanced Axios clients with connection pooling
      const axiosConfig = {
        timeout: 30000,
        maxRedirects: 3,
        // Connection pooling configuration
        httpAgent: new (require('http').Agent)({
          keepAlive: true,
          maxSockets: 10,
          maxFreeSockets: 5,
          timeout: 60000,
          freeSocketTimeout: 30000
        }),
        httpsAgent: new (require('https').Agent)({
          keepAlive: true,
          maxSockets: 10,
          maxFreeSockets: 5,
          timeout: 60000,
          freeSocketTimeout: 30000
        })
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
        threshold: 5, // failures before opening
        timeout: 60000, // 1 minute before trying again
        resetSuccessCount: 3 // successes needed to close circuit
      });

      this.requestQueues.set(provider, []);
      this.metrics.set(provider, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        lastRequestTime: null
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

  recordCircuitBreakerSuccess(provider) {
    const breaker = this.circuitBreakers.get(provider);
    breaker.successCount++;

    if (breaker.state === 'HALF_OPEN' && breaker.successCount >= breaker.resetSuccessCount) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      console.log(`🔄 Circuit breaker CLOSED for ${provider}`);
    }
  }

  recordCircuitBreakerFailure(provider) {
    const breaker = this.circuitBreakers.get(provider);
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();
    breaker.successCount = 0;

    if (breaker.state === 'CLOSED' && breaker.failureCount >= breaker.threshold) {
      breaker.state = 'OPEN';
      console.warn(`⚠️ Circuit breaker OPENED for ${provider} after ${breaker.failureCount} failures`);
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
      throw new Error(`Circuit breaker is OPEN for ${provider}`);
    }

    try {
      const result = await operation();
      this.recordCircuitBreakerSuccess(provider);
      return result;
    } catch (error) {
      this.recordCircuitBreakerFailure(provider);
      throw error;
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
