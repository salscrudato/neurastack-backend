/**
 * Vendor Clients - Simplified for low-cost AI providers with basic resilience
 */

const OpenAI = require('openai');
const axios = require('axios');
const dynamicConfig = require('../config/dynamicConfig');
const {
  ModelFailureError,
  errorHandler,
  retryWithBackoff,
  classifyError
} = require('../utils/errorHandler');
require('dotenv').config();

class VendorClients {
  constructor() {
    this.initializeClients();

    // Vendor metrics for monitoring
    this.metrics = {
      totalRequests: new Map(),
      successfulRequests: new Map(),
      failedRequests: new Map(),
      averageResponseTime: new Map(),
      lastRequestTime: new Map()
    };

    // Initialize metrics for each vendor
    ['openai', 'gemini', 'claude', 'xai'].forEach(vendor => {
      this.metrics.totalRequests.set(vendor, 0);
      this.metrics.successfulRequests.set(vendor, 0);
      this.metrics.failedRequests.set(vendor, 0);
      this.metrics.averageResponseTime.set(vendor, 0);
      this.metrics.lastRequestTime.set(vendor, null);
    });
  }

  initializeClients() {
    const vendorTimeout = dynamicConfig.vendors.timeout;

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: vendorTimeout
    });

    this.gemini = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      params: { key: process.env.GEMINI_API_KEY },
      headers: { 'Content-Type': 'application/json' },
      timeout: vendorTimeout
    });

    this.claude = axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: vendorTimeout
    });

    this.xai = axios.create({
      baseURL: 'https://api.x.ai/v1',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: vendorTimeout
    });

    console.log('🚀 Vendor Clients initialized with dynamic configuration');
    console.log(`   Vendor Timeout: ${vendorTimeout}ms`);
  }

  /**
   * Enhanced OpenAI wrapper with error handling
   */
  async callOpenAI(operation, options = {}) {
    return await this.executeWithErrorHandling('openai', async () => {
      return await operation(this.openai);
    }, options);
  }

  /**
   * Enhanced Gemini wrapper with error handling
   */
  async callGemini(operation, options = {}) {
    return await this.executeWithErrorHandling('gemini', async () => {
      return await operation(this.gemini);
    }, options);
  }

  /**
   * Enhanced Claude wrapper with error handling
   */
  async callClaude(operation, options = {}) {
    return await this.executeWithErrorHandling('claude', async () => {
      return await operation(this.claude);
    }, options);
  }

  /**
   * Enhanced xAI wrapper with error handling
   */
  async callXAI(operation, options = {}) {
    return await this.executeWithErrorHandling('xai', async () => {
      return await operation(this.xai);
    }, options);
  }

  /**
   * Execute vendor operation with comprehensive error handling
   */
  async executeWithErrorHandling(vendorName, operation, options = {}) {
    const {
      correlationId = null,
      retryOptions = {},
      circuitBreakerOptions = {}
    } = options;

    const startTime = Date.now();
    this.metrics.totalRequests.set(vendorName, this.metrics.totalRequests.get(vendorName) + 1);

    // Get circuit breaker for this vendor
    const circuitBreaker = errorHandler.getCircuitBreaker(`vendor-${vendorName}`, {
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      ...circuitBreakerOptions
    });

    try {
      const result = await circuitBreaker.execute(async () => {
        return await retryWithBackoff(operation, {
          maxAttempts: 3,
          baseDelayMs: 1000,
          maxDelayMs: 10000,
          retryCondition: (error) => {
            const classification = classifyError(error);
            return classification.retryable;
          },
          onRetry: (error, attempt, delay) => {
            console.log(`🔄 Retrying ${vendorName} request (attempt ${attempt}): ${error.message}`);
          },
          ...retryOptions
        });
      });

      // Update success metrics
      const responseTime = Date.now() - startTime;
      this.updateSuccessMetrics(vendorName, responseTime);

      return result;

    } catch (error) {
      // Update failure metrics
      this.updateFailureMetrics(vendorName, Date.now() - startTime);

      // Classify and wrap the error
      const classification = classifyError(error);

      const vendorError = new ModelFailureError(
        `${vendorName} API call failed: ${error.message}`,
        vendorName,
        'unknown', // model will be set by caller
        error,
        {
          correlationId,
          classification,
          responseTime: Date.now() - startTime,
          isRetryable: classification.retryable
        }
      );

      throw vendorError;
    }
  }

  /**
   * Update success metrics
   */
  updateSuccessMetrics(vendorName, responseTime) {
    this.metrics.successfulRequests.set(vendorName, this.metrics.successfulRequests.get(vendorName) + 1);
    this.metrics.lastRequestTime.set(vendorName, Date.now());

    // Update average response time
    const currentAvg = this.metrics.averageResponseTime.get(vendorName);
    const successCount = this.metrics.successfulRequests.get(vendorName);

    if (successCount === 1) {
      this.metrics.averageResponseTime.set(vendorName, responseTime);
    } else {
      const newAvg = ((currentAvg * (successCount - 1)) + responseTime) / successCount;
      this.metrics.averageResponseTime.set(vendorName, newAvg);
    }
  }

  /**
   * Update failure metrics
   */
  updateFailureMetrics(vendorName, responseTime) {
    this.metrics.failedRequests.set(vendorName, this.metrics.failedRequests.get(vendorName) + 1);
    this.metrics.lastRequestTime.set(vendorName, Date.now());
  }

  /**
   * Enhanced health check with circuit breaker status
   */
  async healthCheck() {
    const health = {};
    const circuitBreakers = errorHandler.getCircuitBreakerStatus();

    for (const vendor of ['openai', 'gemini', 'claude', 'xai']) {
      const circuitBreakerKey = `vendor-${vendor}`;
      const circuitBreakerStatus = circuitBreakers[circuitBreakerKey];

      health[vendor] = {
        available: !circuitBreakerStatus || circuitBreakerStatus.state !== 'OPEN',
        circuitBreakerState: circuitBreakerStatus?.state || 'CLOSED',
        lastRequestTime: this.metrics.lastRequestTime.get(vendor),
        successRate: this.calculateSuccessRate(vendor)
      };
    }

    return health;
  }

  /**
   * Calculate success rate for a vendor
   */
  calculateSuccessRate(vendorName) {
    const total = this.metrics.totalRequests.get(vendorName);
    const successful = this.metrics.successfulRequests.get(vendorName);

    if (total === 0) return 100;
    return ((successful / total) * 100).toFixed(2);
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics() {
    const metrics = {};

    for (const vendor of ['openai', 'gemini', 'claude', 'xai']) {
      metrics[vendor] = {
        totalRequests: this.metrics.totalRequests.get(vendor),
        successfulRequests: this.metrics.successfulRequests.get(vendor),
        failedRequests: this.metrics.failedRequests.get(vendor),
        successRate: `${this.calculateSuccessRate(vendor)}%`,
        averageResponseTime: `${this.metrics.averageResponseTime.get(vendor).toFixed(0)}ms`,
        lastRequestTime: this.metrics.lastRequestTime.get(vendor)
      };
    }

    return {
      vendors: metrics,
      circuitBreakers: errorHandler.getCircuitBreakerStatus(),
      totalRequests: Array.from(this.metrics.totalRequests.values()).reduce((a, b) => a + b, 0),
      totalSuccessful: Array.from(this.metrics.successfulRequests.values()).reduce((a, b) => a + b, 0),
      totalFailed: Array.from(this.metrics.failedRequests.values()).reduce((a, b) => a + b, 0)
    };
  }
}

const clients = new VendorClients();

module.exports = {
  // Direct client access (for backward compatibility)
  openai: clients.openai,
  gemini: clients.gemini,
  claude: clients.claude,
  xai: clients.xai,

  // Enhanced wrapper methods with error handling
  callOpenAI: (operation, options) => clients.callOpenAI(operation, options),
  callGemini: (operation, options) => clients.callGemini(operation, options),
  callClaude: (operation, options) => clients.callClaude(operation, options),
  callXAI: (operation, options) => clients.callXAI(operation, options),

  // Utility methods
  healthCheck: () => clients.healthCheck(),
  getMetrics: () => clients.getMetrics(),

  // Access to the clients instance for advanced usage
  clients
};