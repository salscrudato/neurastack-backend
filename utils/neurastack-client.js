/**
 * NeuraStack API Client
 * Comprehensive API integration helper with built-in error handling, retry logic, and TypeScript support
 */

class NeurastackClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://neurastack-backend-638289111765.us-central1.run.app';
    this.userId = config.userId || 'anonymous';
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
    this.enableLogging = config.enableLogging !== false;
    this.apiKey = config.apiKey || null;
    
    // Request interceptors
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    
    // Metrics tracking
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: null
    };
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor) {
    this.responseInterceptors.push(interceptor);
  }

  /**
   * Generate correlation ID for request tracking
   */
  generateCorrelationId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log request/response for debugging
   */
  log(level, message, data = {}) {
    if (!this.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  async makeRequest(endpoint, options = {}) {
    const startTime = Date.now();
    const correlationId = options.correlationId || this.generateCorrelationId();
    
    // Apply request interceptors
    let requestConfig = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId,
        'X-Correlation-ID': correlationId,
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        ...options.headers
      },
      ...options
    };

    for (const interceptor of this.requestInterceptors) {
      requestConfig = await interceptor(requestConfig);
    }

    this.log('info', `Making request to ${endpoint}`, {
      method: requestConfig.method,
      correlationId,
      userId: this.userId
    });

    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        this.metrics.totalRequests++;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...requestConfig,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime, response.ok);
        
        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        // Apply response interceptors
        let processedResponse = {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          responseTime,
          correlationId,
          attempt
        };

        for (const interceptor of this.responseInterceptors) {
          processedResponse = await interceptor(processedResponse);
        }

        if (!response.ok) {
          throw new NeurastackError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            responseData,
            correlationId
          );
        }

        this.log('info', `Request successful`, {
          endpoint,
          status: response.status,
          responseTime,
          correlationId,
          attempt
        });

        return processedResponse;

      } catch (error) {
        lastError = error;
        const responseTime = Date.now() - startTime;
        this.updateMetrics(responseTime, false);
        
        this.log('error', `Request failed (attempt ${attempt}/${this.retryAttempts})`, {
          endpoint,
          error: error.message,
          correlationId,
          attempt
        });

        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
          break;
        }

        // Don't retry on last attempt
        if (attempt === this.retryAttempts) {
          break;
        }

        // Exponential backoff with jitter
        const delay = this.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Update metrics
   */
  updateMetrics(responseTime, success) {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Update average response time
    const totalRequests = this.metrics.successfulRequests + this.metrics.failedRequests;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    
    this.metrics.lastRequestTime = Date.now();
  }

  /**
   * Get client metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 
        ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    return this.makeRequest('/health');
  }

  /**
   * Enhanced ensemble request with confidence indicators
   */
  async enhancedEnsemble(prompt, options = {}) {
    return this.makeRequest('/api/enhanced-ensemble', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        sessionId: options.sessionId
      }),
      ...options
    });
  }

  /**
   * Standard ensemble request
   */
  async ensemble(prompt, options = {}) {
    return this.makeRequest('/default-ensemble', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        sessionId: options.sessionId
      }),
      ...options
    });
  }

  /**
   * Generate workout
   */
  async generateWorkout(userMetadata, workoutHistory = [], workoutRequest = '', options = {}) {
    return this.makeRequest('/workout', {
      method: 'POST',
      body: JSON.stringify({
        userMetadata,
        workoutHistory,
        workoutRequest
      }),
      ...options
    });
  }

  /**
   * Get cost estimation
   */
  async estimateCost(prompt, tier = null, options = {}) {
    return this.makeRequest('/estimate-cost', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        tier
      }),
      ...options
    });
  }

  /**
   * Get tier information
   */
  async getTierInfo(options = {}) {
    return this.makeRequest('/tier-info', options);
  }

  /**
   * Get system metrics (admin only)
   */
  async getMetrics(options = {}) {
    return this.makeRequest('/monitor/metrics', options);
  }

  /**
   * Get cost analytics (admin only)
   */
  async getCostAnalytics(options = {}) {
    return this.makeRequest('/monitor/cost-analytics', options);
  }

  /**
   * Clear cache (admin only)
   */
  async clearCache(options = {}) {
    return this.makeRequest('/cache/clear', {
      method: 'POST',
      ...options
    });
  }
}

/**
 * Custom error class for NeuraStack API errors
 */
class NeurastackError extends Error {
  constructor(message, status = null, data = null, correlationId = null) {
    super(message);
    this.name = 'NeurastackError';
    this.status = status;
    this.data = data;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      data: this.data,
      correlationId: this.correlationId,
      timestamp: this.timestamp
    };
  }
}

/**
 * Factory function to create client instance
 */
function createNeurastackClient(config = {}) {
  return new NeurastackClient(config);
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NeurastackClient, NeurastackError, createNeurastackClient };
} else if (typeof window !== 'undefined') {
  window.NeurastackClient = NeurastackClient;
  window.NeurastackError = NeurastackError;
  window.createNeurastackClient = createNeurastackClient;
}
