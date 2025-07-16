/**
 * 🛡️ Centralized Error Handler - Robust Error Management for NeuraStack AI Ensemble
 *
 * 🎯 PURPOSE: Centralized error handling with custom error classes, retry mechanisms,
 *            circuit breakers, and operational vs programmer error classification
 *
 * 📋 KEY FEATURES:
 * 1. Custom error classes for different failure types
 * 2. Exponential backoff retry mechanisms
 * 3. Circuit breaker patterns for repeated failures
 * 4. Operational vs programmer error classification
 * 5. Centralized logging integration
 * 6. Graceful degradation strategies
 */

const monitoringService = require('../services/monitoringService');

// ==================== CUSTOM ERROR CLASSES ====================

/**
 * Base class for all NeuraStack errors
 */
class NeuraStackError extends Error {
  constructor(message, cause = null, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.isOperational = true; // Default to operational error
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      cause: this.cause?.message || this.cause,
      context: this.context,
      timestamp: this.timestamp,
      isOperational: this.isOperational,
      stack: this.stack
    };
  }
}

/**
 * AI Model failure errors (network, API limits, timeouts)
 */
class ModelFailureError extends NeuraStackError {
  constructor(message, provider, model, cause = null, context = {}) {
    super(message, cause, { ...context, provider, model });
    this.provider = provider;
    this.model = model;
    this.isRetryable = this.determineRetryability(cause);
  }

  determineRetryability(cause) {
    if (!cause) return true;
    
    const message = cause.message || cause.toString();
    
    // Non-retryable errors
    if (message.includes('401') || message.includes('403')) return false; // Auth errors
    if (message.includes('invalid_api_key')) return false;
    if (message.includes('quota_exceeded')) return false;
    
    // Retryable errors
    if (message.includes('timeout')) return true;
    if (message.includes('503') || message.includes('502') || message.includes('500')) return true;
    if (message.includes('rate_limit')) return true;
    if (message.includes('ECONNRESET') || message.includes('ENOTFOUND')) return true;
    
    return true; // Default to retryable
  }
}

/**
 * Synthesis process errors
 */
class SynthesisError extends NeuraStackError {
  constructor(message, synthesisType = 'enhanced', cause = null, context = {}) {
    super(message, cause, { ...context, synthesisType });
    this.synthesisType = synthesisType;
    this.isRetryable = true;
  }
}

/**
 * Voting process errors
 */
class VotingError extends NeuraStackError {
  constructor(message, votingType = 'sophisticated', cause = null, context = {}) {
    super(message, cause, { ...context, votingType });
    this.votingType = votingType;
    this.isRetryable = true;
  }
}

/**
 * Validation process errors
 */
class ValidationError extends NeuraStackError {
  constructor(message, validationType = 'comprehensive', cause = null, context = {}) {
    super(message, cause, { ...context, validationType });
    this.validationType = validationType;
    this.isRetryable = true;
  }
}

/**
 * Circuit breaker errors
 */
class CircuitBreakerError extends NeuraStackError {
  constructor(message, serviceName, cause = null) {
    super(message, cause, { serviceName });
    this.serviceName = serviceName;
    this.isRetryable = false; // Circuit breaker should not be retried immediately
  }
}

// ==================== ENHANCED CIRCUIT BREAKER ====================

class IntelligentCircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;

    // Optimize for test environment
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

    // Adaptive thresholds based on service criticality
    this.baseFailureThreshold = options.failureThreshold || (isTestEnv ? 10 : 5);
    this.currentFailureThreshold = this.baseFailureThreshold;
    this.resetTimeout = options.resetTimeout || (isTestEnv ? 1000 : 60000);
    this.monitorWindow = options.monitorWindow || (isTestEnv ? 5000 : 120000);

    // Enhanced configuration
    this.serviceCriticality = options.criticality || 'medium'; // low, medium, high, critical
    this.adaptiveThresholds = options.adaptiveThresholds !== false;
    this.healthCheckInterval = options.healthCheckInterval || 30000;
    this.maxResetTimeout = options.maxResetTimeout || 300000; // 5 minutes max
    this.minResetTimeout = options.minResetTimeout || 5000; // 5 seconds min

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = [];
    this.successes = [];
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = null;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.healthScore = 1.0; // 0.0 to 1.0
    this.lastHealthCheck = null;

    // Performance metrics for adaptive behavior
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      averageResponseTime: 0,
      errorRate: 0,
      recoveryTime: 0
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  async execute(operation, context = {}) {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.name}. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`,
          this.name
        );
      } else {
        this.state = 'HALF_OPEN';
        monitoringService.log('info', `Circuit breaker transitioning to HALF_OPEN for ${this.name}`, {
          healthScore: this.healthScore,
          consecutiveFailures: this.consecutiveFailures
        });
      }
    }

    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;
      this.onSuccess(responseTime);
      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.onFailure(error, { ...context, responseTime });
      throw error;
    }
  }

  onSuccess(responseTime = 0) {
    const now = Date.now();
    this.lastSuccessTime = now;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.metrics.totalSuccesses++;

    // Update average response time
    this.updateAverageResponseTime(responseTime);

    // Add to success history
    this.successes.push({ timestamp: now, responseTime });

    // Clean old successes outside monitor window
    this.successes = this.successes.filter(s => now - s.timestamp < this.monitorWindow);

    // Update health score based on recent performance
    this.updateHealthScore();

    // Adaptive threshold adjustment on success
    if (this.adaptiveThresholds && this.consecutiveSuccesses >= 10) {
      this.adjustThresholds('success');
    }

    if (this.state === 'HALF_OPEN') {
      // Successful call in HALF_OPEN state - close the circuit
      this.state = 'CLOSED';
      this.failures = [];
      this.nextAttemptTime = null;

      monitoringService.log('info', `Circuit breaker CLOSED for ${this.name} after successful recovery`, {
        healthScore: this.healthScore,
        consecutiveSuccesses: this.consecutiveSuccesses
      });
    }
  }

  onFailure(error, context = {}) {
    const now = Date.now();
    this.lastFailureTime = now;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.metrics.totalFailures++;

    // Enhanced failure tracking with error classification
    const failureData = {
      timestamp: now,
      error: error.message,
      errorType: error.constructor.name,
      context,
      responseTime: context.responseTime || 0,
      isRetryable: this.classifyErrorRetryability(error)
    };

    this.failures.push(failureData);

    // Clean old failures outside monitor window
    this.failures = this.failures.filter(f => now - f.timestamp < this.monitorWindow);

    // Update health score
    this.updateHealthScore();

    // Adaptive threshold adjustment on failure
    if (this.adaptiveThresholds) {
      this.adjustThresholds('failure');
    }

    // Check if we should open the circuit
    const shouldOpen = this.shouldOpenCircuit();

    if (shouldOpen && this.state !== 'OPEN') {
      this.state = 'OPEN';
      this.nextAttemptTime = now + this.calculateResetTimeout();

      monitoringService.log('warn', `Circuit breaker opened for ${this.name}`, {
        failureCount: this.failures.length,
        consecutiveFailures: this.consecutiveFailures,
        healthScore: this.healthScore,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
        errorPattern: this.analyzeErrorPattern()
      });
    }
  }

  // ==================== INTELLIGENT CIRCUIT BREAKER METHODS ====================

  /**
   * Determine if circuit should open based on intelligent criteria
   */
  shouldOpenCircuit() {
    // Don't open if already open
    if (this.state === 'OPEN') return false;

    // Basic threshold check
    if (this.failures.length >= this.currentFailureThreshold) return true;

    // Health-based opening for critical services
    if (this.serviceCriticality === 'critical' && this.healthScore < 0.3) return true;

    // Pattern-based opening (rapid consecutive failures)
    if (this.consecutiveFailures >= Math.ceil(this.currentFailureThreshold * 0.7)) return true;

    // Error rate based opening
    const errorRate = this.calculateErrorRate();
    if (errorRate > 0.8 && this.metrics.totalRequests > 10) return true;

    return false;
  }

  /**
   * Calculate dynamic reset timeout based on failure patterns
   */
  calculateResetTimeout() {
    let timeout = this.resetTimeout;

    // Increase timeout for repeated failures
    const failureMultiplier = Math.min(this.consecutiveFailures / 5, 3);
    timeout *= (1 + failureMultiplier);

    // Adjust based on health score
    const healthMultiplier = 2 - this.healthScore; // 1.0 to 2.0
    timeout *= healthMultiplier;

    // Adjust based on service criticality
    const criticalityMultipliers = {
      'low': 0.5,
      'medium': 1.0,
      'high': 1.5,
      'critical': 2.0
    };
    timeout *= criticalityMultipliers[this.serviceCriticality] || 1.0;

    return Math.min(Math.max(timeout, this.minResetTimeout), this.maxResetTimeout);
  }

  /**
   * Update health score based on recent performance
   */
  updateHealthScore() {
    const now = Date.now();
    const recentWindow = 60000; // 1 minute

    const recentFailures = this.failures.filter(f => now - f.timestamp < recentWindow);
    const recentSuccesses = this.successes.filter(s => now - s.timestamp < recentWindow);

    const totalRecent = recentFailures.length + recentSuccesses.length;

    if (totalRecent === 0) {
      // No recent activity, maintain current score with slight decay
      this.healthScore = Math.max(this.healthScore * 0.99, 0.5);
      return;
    }

    const successRate = recentSuccesses.length / totalRecent;
    const avgResponseTime = this.calculateAverageResponseTime(recentSuccesses);

    // Base score from success rate
    let score = successRate;

    // Adjust for response time (penalize slow responses)
    if (avgResponseTime > 5000) { // 5 seconds
      score *= 0.8;
    } else if (avgResponseTime > 2000) { // 2 seconds
      score *= 0.9;
    }

    // Smooth the score change
    this.healthScore = (this.healthScore * 0.7) + (score * 0.3);
    this.healthScore = Math.max(0, Math.min(1, this.healthScore));
  }
  /**
   * Adjust thresholds based on performance patterns
   */
  adjustThresholds(event) {
    if (!this.adaptiveThresholds) return;

    const baseThreshold = this.baseFailureThreshold;

    if (event === 'success' && this.consecutiveSuccesses >= 20) {
      // Service is performing well, can be more tolerant
      this.currentFailureThreshold = Math.min(baseThreshold * 1.5, baseThreshold + 3);
    } else if (event === 'failure' && this.consecutiveFailures >= 3) {
      // Service is struggling, be more strict
      this.currentFailureThreshold = Math.max(baseThreshold * 0.7, Math.min(baseThreshold, 3));
    }
  }

  /**
   * Classify error for retry decisions
   */
  classifyErrorRetryability(error) {
    const message = error.message || error.toString();

    // Non-retryable errors
    if (message.includes('401') || message.includes('403')) return false;
    if (message.includes('invalid_api_key')) return false;
    if (message.includes('quota_exceeded')) return false;
    if (message.includes('400') && !message.includes('rate_limit')) return false;

    return true;
  }

  /**
   * Calculate current error rate
   */
  calculateErrorRate() {
    if (this.metrics.totalRequests === 0) return 0;
    return this.metrics.totalFailures / this.metrics.totalRequests;
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(responseTime) {
    if (this.metrics.totalRequests === 1) {
      this.metrics.averageResponseTime = responseTime;
    } else {
      // Exponential moving average
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * 0.9) + (responseTime * 0.1);
    }
  }

  /**
   * Calculate average response time for a set of operations
   */
  calculateAverageResponseTime(operations) {
    if (operations.length === 0) return 0;
    const total = operations.reduce((sum, op) => sum + (op.responseTime || 0), 0);
    return total / operations.length;
  }

  /**
   * Analyze error patterns for intelligent decision making
   */
  analyzeErrorPattern() {
    const recentFailures = this.failures.slice(-10); // Last 10 failures

    if (recentFailures.length === 0) return { pattern: 'none' };

    // Check for timeout patterns
    const timeouts = recentFailures.filter(f =>
      f.error.includes('timeout') || f.error.includes('ETIMEDOUT')
    ).length;

    // Check for rate limit patterns
    const rateLimits = recentFailures.filter(f =>
      f.error.includes('rate_limit') || f.error.includes('429')
    ).length;

    // Check for server error patterns
    const serverErrors = recentFailures.filter(f =>
      f.error.includes('500') || f.error.includes('502') || f.error.includes('503')
    ).length;

    return {
      pattern: 'mixed',
      timeoutRate: timeouts / recentFailures.length,
      rateLimitRate: rateLimits / recentFailures.length,
      serverErrorRate: serverErrors / recentFailures.length,
      dominantError: this.getDominantErrorType(recentFailures)
    };
  }

  /**
   * Get the most common error type
   */
  getDominantErrorType(failures) {
    const errorCounts = {};
    failures.forEach(f => {
      errorCounts[f.errorType] = (errorCounts[f.errorType] || 0) + 1;
    });

    return Object.keys(errorCounts).reduce((a, b) =>
      errorCounts[a] > errorCounts[b] ? a : b
    );
  }

  /**
   * Start health monitoring background process
   */
  startHealthMonitoring() {
    if (this.healthMonitorInterval) return; // Already started

    this.healthMonitorInterval = setInterval(() => {
      this.updateHealthScore();
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  /**
   * Perform periodic health check
   */
  async performHealthCheck() {
    this.lastHealthCheck = Date.now();

    // Auto-recovery for HALF_OPEN state that's been stuck
    if (this.state === 'HALF_OPEN' &&
        this.lastHealthCheck - this.lastFailureTime > this.resetTimeout * 2) {

      monitoringService.log('info', `Auto-recovering stuck HALF_OPEN circuit breaker: ${this.name}`, {
        healthScore: this.healthScore,
        timeSinceLastFailure: this.lastHealthCheck - this.lastFailureTime
      });

      this.state = 'CLOSED';
      this.failures = [];
      this.nextAttemptTime = null;
    }
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
      this.healthMonitorInterval = null;
    }
  }

  /**
   * Get comprehensive status including intelligent metrics
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successes.length,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      healthScore: this.healthScore,
      currentFailureThreshold: this.currentFailureThreshold,
      baseFailureThreshold: this.baseFailureThreshold,
      serviceCriticality: this.serviceCriticality,
      metrics: { ...this.metrics },
      errorPattern: this.analyzeErrorPattern(),
      errorRate: this.calculateErrorRate()
    };
  }
}

// ==================== RETRY MECHANISMS ====================

/**
 * Intelligent retry strategy selector
 */
class IntelligentRetryStrategy {
  constructor() {
    this.retryHistory = new Map(); // Track retry patterns per service
    this.adaptiveSettings = new Map(); // Dynamic retry settings per service
  }

  /**
   * Get optimal retry strategy based on error type and history
   */
  getRetryStrategy(error, serviceName, options = {}) {
    const errorType = this.classifyErrorForRetry(error);
    const history = this.retryHistory.get(serviceName) || { attempts: [], successes: [], failures: [] };

    // Base strategy
    let strategy = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterMs: 1000,
      strategy: 'exponential'
    };

    // Adjust based on error type
    switch (errorType) {
      case 'rate_limit':
        strategy = {
          ...strategy,
          maxAttempts: 5,
          baseDelayMs: 2000,
          maxDelayMs: 60000,
          backoffMultiplier: 1.5,
          strategy: 'linear_with_jitter'
        };
        break;

      case 'timeout':
        strategy = {
          ...strategy,
          maxAttempts: 4,
          baseDelayMs: 500,
          maxDelayMs: 15000,
          backoffMultiplier: 1.8,
          strategy: 'exponential'
        };
        break;

      case 'server_error':
        strategy = {
          ...strategy,
          maxAttempts: 6,
          baseDelayMs: 1500,
          maxDelayMs: 45000,
          backoffMultiplier: 2.2,
          strategy: 'exponential_with_plateau'
        };
        break;

      case 'network_error':
        strategy = {
          ...strategy,
          maxAttempts: 5,
          baseDelayMs: 800,
          maxDelayMs: 20000,
          backoffMultiplier: 2.5,
          strategy: 'exponential'
        };
        break;

      case 'auth_error':
        strategy = {
          ...strategy,
          maxAttempts: 1, // Don't retry auth errors
          strategy: 'none'
        };
        break;
    }

    // Apply adaptive adjustments based on history
    strategy = this.applyAdaptiveAdjustments(strategy, history, serviceName);

    // Override with user options
    return { ...strategy, ...options };
  }

  /**
   * Classify error for retry strategy selection
   */
  classifyErrorForRetry(error) {
    const message = error.message || error.toString();

    if (message.includes('rate_limit') || message.includes('429')) return 'rate_limit';
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) return 'timeout';
    if (message.includes('500') || message.includes('502') || message.includes('503')) return 'server_error';
    if (message.includes('ECONNRESET') || message.includes('ENOTFOUND')) return 'network_error';
    if (message.includes('401') || message.includes('403')) return 'auth_error';
    if (message.includes('400')) return 'client_error';

    return 'unknown';
  }

  /**
   * Apply adaptive adjustments based on historical performance
   */
  applyAdaptiveAdjustments(strategy, history, serviceName) {
    if (history.attempts.length < 5) return strategy; // Need more data

    const recentAttempts = history.attempts.slice(-20); // Last 20 attempts
    const successRate = recentAttempts.filter(a => a.success).length / recentAttempts.length;

    // If success rate is low, be more aggressive with retries
    if (successRate < 0.3) {
      strategy.maxAttempts = Math.min(strategy.maxAttempts + 2, 8);
      strategy.baseDelayMs *= 1.5;
    }

    // If success rate is high, be more conservative
    if (successRate > 0.8) {
      strategy.maxAttempts = Math.max(strategy.maxAttempts - 1, 2);
      strategy.baseDelayMs *= 0.8;
    }

    return strategy;
  }

  /**
   * Record retry attempt for learning
   */
  recordAttempt(serviceName, attempt, success, error = null, responseTime = 0) {
    if (!this.retryHistory.has(serviceName)) {
      this.retryHistory.set(serviceName, { attempts: [], successes: [], failures: [] });
    }

    const history = this.retryHistory.get(serviceName);
    const record = {
      timestamp: Date.now(),
      attempt,
      success,
      error: error?.message,
      errorType: error ? this.classifyErrorForRetry(error) : null,
      responseTime
    };

    history.attempts.push(record);

    if (success) {
      history.successes.push(record);
    } else {
      history.failures.push(record);
    }

    // Keep only recent history (last 100 attempts)
    if (history.attempts.length > 100) {
      history.attempts = history.attempts.slice(-100);
      history.successes = history.successes.slice(-50);
      history.failures = history.failures.slice(-50);
    }
  }
}

// Global retry strategy instance
const intelligentRetryStrategy = new IntelligentRetryStrategy();

/**
 * Enhanced retry mechanism with intelligent strategy selection
 */
async function retryWithIntelligentBackoff(operation, options = {}) {
  const {
    serviceName = 'unknown',
    correlationId = null,
    retryCondition = (error) => {
      const classification = classifyError(error);
      return classification.retryable;
    },
    onRetry = null,
    context = {},
    ...userOptions
  } = options;

  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
  let lastError;
  let strategy;

  for (let attempt = 1; attempt <= (userOptions.maxAttempts || 3); attempt++) {
    const startTime = Date.now();

    try {
      const result = await operation(attempt);

      // Record successful attempt
      if (attempt > 1) {
        const responseTime = Date.now() - startTime;
        intelligentRetryStrategy.recordAttempt(serviceName, attempt, true, null, responseTime);

        if (!isTestEnv) {
          monitoringService.log('info', `Retry succeeded for ${serviceName}`, {
            attempt,
            responseTime: `${responseTime}ms`,
            correlationId,
            ...context
          });
        }
      }

      return result;
    } catch (error) {
      lastError = error;

      // Get intelligent retry strategy on first failure
      if (attempt === 1) {
        strategy = intelligentRetryStrategy.getRetryStrategy(error, serviceName, userOptions);
      }

      // Don't retry on last attempt or if not retryable
      if (attempt === strategy.maxAttempts || !retryCondition(error)) {
        // Record final failure
        intelligentRetryStrategy.recordAttempt(serviceName, attempt, false, error, Date.now() - startTime);
        break;
      }

      // Calculate delay based on strategy
      const delay = calculateRetryDelay(attempt, strategy);

      // Log retry attempt (skip in test environment for performance)
      if (!isTestEnv) {
        monitoringService.log('warn', `Intelligent retry for ${serviceName}`, {
          attempt,
          maxAttempts: strategy.maxAttempts,
          delay: `${delay}ms`,
          error: error.message,
          strategy: strategy.strategy,
          serviceName,
          correlationId,
          ...context
        });
      }

      // Record failed attempt
      intelligentRetryStrategy.recordAttempt(serviceName, attempt, false, error, Date.now() - startTime);

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt, delay);
      }

      // Wait before retry (skip in test environment for performance)
      if (!isTestEnv) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Calculate retry delay based on strategy
 */
function calculateRetryDelay(attempt, strategy) {
  const { baseDelayMs, maxDelayMs, backoffMultiplier, jitterMs, strategy: strategyType } = strategy;

  let delay;

  switch (strategyType) {
    case 'linear':
      delay = baseDelayMs * attempt;
      break;

    case 'linear_with_jitter':
      delay = (baseDelayMs * attempt) + (Math.random() * jitterMs);
      break;

    case 'exponential':
      delay = Math.min(baseDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs);
      break;

    case 'exponential_with_plateau':
      const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      delay = attempt > 3 ? Math.min(exponentialDelay, maxDelayMs * 0.7) : exponentialDelay;
      break;

    case 'fibonacci':
      delay = baseDelayMs * fibonacci(attempt);
      break;

    default: // exponential with jitter
      const baseDelay = Math.min(baseDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs);
      delay = baseDelay + (Math.random() * jitterMs);
  }

  return Math.min(delay, maxDelayMs);
}

/**
 * Fibonacci sequence for retry delays
 */
function fibonacci(n) {
  if (n <= 1) return 1;
  if (n === 2) return 1;

  let a = 1, b = 1;
  for (let i = 3; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

/**
 * Legacy exponential backoff retry with jitter (maintained for compatibility)
 */
async function retryWithBackoff(operation, options = {}) {
  // Optimize for test environment
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

  const {
    maxAttempts = isTestEnv ? 1 : 3, // Reduce retries in test environment
    baseDelayMs = isTestEnv ? 10 : 1000, // Faster retries in test environment
    maxDelayMs = isTestEnv ? 100 : 30000,
    backoffMultiplier = 2,
    jitterMs = isTestEnv ? 5 : 100,
    retryCondition = (error) => error.isRetryable !== false,
    onRetry = null,
    context = {}
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      
      // Don't retry on last attempt or if not retryable
      if (attempt === maxAttempts || !retryCondition(error)) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(baseDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs);
      const jitter = Math.random() * jitterMs;
      const delay = baseDelay + jitter;

      // Log retry attempt (skip in test environment for performance)
      if (!isTestEnv) {
        monitoringService.log('warn', `Retrying operation after failure`, {
          attempt,
          maxAttempts,
          delay: `${delay}ms`,
          error: error.message,
          ...context
        });
      }

      // Call retry callback if provided
      if (onRetry) {
        await onRetry(error, attempt, delay);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ==================== ENHANCED ERROR CLASSIFICATION ====================

/**
 * Enhanced error classification with detailed categorization
 */
class EnhancedErrorClassifier {
  constructor() {
    this.classificationRules = new Map();
    this.errorPatterns = new Map();
    this.initializeClassificationRules();
  }

  /**
   * Initialize classification rules
   */
  initializeClassificationRules() {
    // Programmer error patterns
    this.addClassificationRule('programmer', {
      errorTypes: [TypeError, ReferenceError, SyntaxError],
      messagePatterns: [
        'Cannot read property',
        'is not a function',
        'undefined is not an object',
        'Cannot access before initialization',
        'Unexpected token',
        'Invalid regular expression'
      ],
      retryable: false,
      severity: 'high',
      category: 'code_error'
    });

    // Authentication/Authorization errors
    this.addClassificationRule('auth', {
      messagePatterns: [
        '401', '403', 'unauthorized', 'forbidden',
        'invalid_api_key', 'authentication failed',
        'access denied', 'token expired'
      ],
      retryable: false,
      severity: 'high',
      category: 'security'
    });

    // Rate limiting errors
    this.addClassificationRule('rate_limit', {
      messagePatterns: [
        '429', 'rate_limit', 'too many requests',
        'quota exceeded', 'rate exceeded'
      ],
      retryable: true,
      severity: 'medium',
      category: 'throttling',
      recoveryStrategy: 'exponential_backoff'
    });

    // Timeout errors
    this.addClassificationRule('timeout', {
      messagePatterns: [
        'timeout', 'ETIMEDOUT', 'request timeout',
        'connection timeout', 'read timeout'
      ],
      retryable: true,
      severity: 'medium',
      category: 'performance',
      recoveryStrategy: 'retry_with_increased_timeout'
    });

    // Server errors
    this.addClassificationRule('server_error', {
      messagePatterns: [
        '500', '502', '503', '504',
        'internal server error', 'bad gateway',
        'service unavailable', 'gateway timeout'
      ],
      retryable: true,
      severity: 'high',
      category: 'infrastructure',
      recoveryStrategy: 'retry_with_fallback'
    });

    // Network errors
    this.addClassificationRule('network', {
      messagePatterns: [
        'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED',
        'network error', 'connection refused',
        'host not found', 'connection reset'
      ],
      retryable: true,
      severity: 'high',
      category: 'connectivity',
      recoveryStrategy: 'retry_with_alternative_endpoint'
    });

    // Client errors (4xx except auth and rate limit)
    this.addClassificationRule('client_error', {
      messagePatterns: [
        '400', '404', '405', '406', '408', '409', '410',
        'bad request', 'not found', 'method not allowed',
        'conflict', 'gone'
      ],
      retryable: false,
      severity: 'medium',
      category: 'client_request'
    });

    // Validation errors
    this.addClassificationRule('validation', {
      messagePatterns: [
        'validation failed', 'invalid input',
        'schema validation', 'required field',
        'invalid format', 'constraint violation'
      ],
      retryable: false,
      severity: 'low',
      category: 'data_validation'
    });

    // Resource exhaustion
    this.addClassificationRule('resource_exhaustion', {
      messagePatterns: [
        'out of memory', 'disk full', 'no space left',
        'resource exhausted', 'memory limit',
        'cpu limit', 'connection pool exhausted'
      ],
      retryable: true,
      severity: 'critical',
      category: 'resources',
      recoveryStrategy: 'resource_cleanup_and_retry'
    });

    // Circuit breaker errors
    this.addClassificationRule('circuit_breaker', {
      messagePatterns: [
        'circuit breaker', 'breaker is open',
        'service unavailable due to circuit breaker'
      ],
      retryable: true,
      severity: 'medium',
      category: 'resilience',
      recoveryStrategy: 'wait_for_circuit_breaker_reset'
    });
  }

  /**
   * Add classification rule
   */
  addClassificationRule(type, rule) {
    this.classificationRules.set(type, {
      ...rule,
      type,
      timestamp: Date.now()
    });
  }

  /**
   * Classify error with enhanced details
   */
  classifyError(error, context = {}) {
    const message = error.message || error.toString();
    const errorName = error.constructor.name;

    // Check NeuraStack custom errors first
    if (error instanceof NeuraStackError) {
      return {
        type: error.isOperational ? 'operational' : 'programmer',
        subtype: errorName,
        retryable: error.isRetryable !== false,
        severity: this.determineSeverity(error),
        category: 'custom',
        context: error.context,
        recoveryStrategy: this.getRecoveryStrategy(error),
        classification: 'custom_neurastack_error'
      };
    }

    // Check against classification rules
    for (const [type, rule] of this.classificationRules.entries()) {
      if (this.matchesRule(error, rule)) {
        return {
          type: rule.category === 'code_error' ? 'programmer' : 'operational',
          subtype: type,
          retryable: rule.retryable,
          severity: rule.severity,
          category: rule.category,
          recoveryStrategy: rule.recoveryStrategy || 'default_retry',
          classification: 'rule_based',
          matchedPattern: this.getMatchedPattern(message, rule.messagePatterns),
          context
        };
      }
    }

    // Fallback classification
    return this.getFallbackClassification(error, context);
  }

  /**
   * Check if error matches a classification rule
   */
  matchesRule(error, rule) {
    // Check error type
    if (rule.errorTypes && rule.errorTypes.some(type => error instanceof type)) {
      return true;
    }

    // Check message patterns
    if (rule.messagePatterns) {
      const message = (error.message || error.toString()).toLowerCase();
      return rule.messagePatterns.some(pattern =>
        message.includes(pattern.toLowerCase())
      );
    }

    return false;
  }

  /**
   * Get matched pattern for debugging
   */
  getMatchedPattern(message, patterns) {
    if (!patterns) return null;

    const lowerMessage = message.toLowerCase();
    return patterns.find(pattern =>
      lowerMessage.includes(pattern.toLowerCase())
    );
  }

  /**
   * Determine error severity
   */
  determineSeverity(error) {
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return 'critical';
    }

    const message = error.message || error.toString();

    if (message.includes('500') || message.includes('503')) return 'high';
    if (message.includes('timeout') || message.includes('429')) return 'medium';
    if (message.includes('400') || message.includes('404')) return 'low';

    return 'medium';
  }

  /**
   * Get recovery strategy for error
   */
  getRecoveryStrategy(error) {
    const message = error.message || error.toString();

    if (message.includes('rate_limit')) return 'exponential_backoff';
    if (message.includes('timeout')) return 'retry_with_increased_timeout';
    if (message.includes('500')) return 'retry_with_fallback';
    if (message.includes('network')) return 'retry_with_alternative_endpoint';

    return 'default_retry';
  }

  /**
   * Get fallback classification for unmatched errors
   */
  getFallbackClassification(error, context) {
    const message = error.message || error.toString();

    // Try to infer from HTTP status codes
    const statusMatch = message.match(/\b([4-5]\d{2})\b/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);

      if (status >= 500) {
        return {
          type: 'operational',
          subtype: 'server_error',
          retryable: true,
          severity: 'high',
          category: 'infrastructure',
          recoveryStrategy: 'retry_with_fallback',
          classification: 'http_status_inferred',
          httpStatus: status,
          context
        };
      } else if (status >= 400) {
        return {
          type: 'operational',
          subtype: 'client_error',
          retryable: status === 408 || status === 429, // Timeout or rate limit
          severity: 'medium',
          category: 'client_request',
          recoveryStrategy: 'default_retry',
          classification: 'http_status_inferred',
          httpStatus: status,
          context
        };
      }
    }

    // Default operational error
    return {
      type: 'operational',
      subtype: 'unknown',
      retryable: true,
      severity: 'medium',
      category: 'unknown',
      recoveryStrategy: 'default_retry',
      classification: 'fallback',
      context
    };
  }

  /**
   * Get classification statistics
   */
  getClassificationStats() {
    return {
      totalRules: this.classificationRules.size,
      ruleTypes: Array.from(this.classificationRules.keys()),
      lastUpdated: Math.max(...Array.from(this.classificationRules.values()).map(r => r.timestamp))
    };
  }
}

// Global classifier instance
const errorClassifier = new EnhancedErrorClassifier();

/**
 * Legacy classification function (maintained for compatibility)
 */
function classifyError(error, context = {}) {
  return errorClassifier.classifyError(error, context);
}

// ==================== CENTRALIZED ERROR HANDLER ====================

class ErrorHandler {
  constructor() {
    this.circuitBreakers = new Map();
  }

  /**
   * Get or create circuit breaker for a service
   */
  getCircuitBreaker(serviceName, options = {}) {
    if (!this.circuitBreakers.has(serviceName)) {
      this.circuitBreakers.set(serviceName, new IntelligentCircuitBreaker(serviceName, options));
    }
    return this.circuitBreakers.get(serviceName);
  }

  /**
   * Handle operational errors with retries and fallbacks
   */
  async handleOperationalError(error, operation, options = {}) {
    const {
      serviceName = 'unknown',
      correlationId = null,
      fallback = null,
      circuitBreakerOptions = {},
      retryOptions = {}
    } = options;

    const classification = classifyError(error);
    
    // Log the error
    monitoringService.log('error', `Operational error in ${serviceName}`, {
      error: error.message,
      classification,
      correlationId,
      stack: error.stack
    }, correlationId);

    // Don't retry programmer errors
    if (classification.type === 'programmer') {
      if (fallback) {
        monitoringService.log('info', `Using fallback for programmer error in ${serviceName}`, {
          correlationId
        }, correlationId);
        return await fallback();
      }
      throw error;
    }

    // Try with circuit breaker and retries for operational errors
    if (classification.retryable) {
      try {
        const circuitBreaker = this.getCircuitBreaker(serviceName, circuitBreakerOptions);
        
        return await circuitBreaker.execute(async () => {
          return await retryWithBackoff(operation, {
            ...retryOptions,
            context: { serviceName, correlationId }
          });
        });
      } catch (retryError) {
        // If retries failed and we have a fallback, use it
        if (fallback) {
          monitoringService.log('info', `Using fallback after retry failure in ${serviceName}`, {
            correlationId,
            originalError: error.message,
            retryError: retryError.message
          }, correlationId);
          return await fallback();
        }
        throw retryError;
      }
    }

    // Use fallback if available
    if (fallback) {
      return await fallback();
    }

    throw error;
  }

  /**
   * Create fallback response for different service types
   */
  createFallbackResponse(serviceType, context = {}) {
    switch (serviceType) {
      case 'synthesis':
        return {
          content: context.fallbackContent || 'Multiple AI responses were provided but synthesis is temporarily unavailable.',
          model: 'fallback',
          provider: 'system',
          status: 'fallback',
          confidence: { score: 0.3, level: 'low' }
        };
      
      case 'voting':
        return {
          winner: context.fallbackWinner || 'gpt4o',
          confidence: 0.5,
          consensus: 'fallback',
          weights: context.fallbackWeights || { gpt4o: 0.5, gemini: 0.3, claude: 0.2 },
          fallbackUsed: true,
          _description: 'Voting system unavailable, using fallback selection'
        };
      
      case 'validation':
        return {
          passesThreshold: true,
          overallQuality: 0.6,
          qualityLevel: 'acceptable',
          fallbackUsed: true,
          _description: 'Validation system unavailable, assuming acceptable quality'
        };
      
      default:
        return {
          status: 'fallback',
          message: 'Service temporarily unavailable',
          fallbackUsed: true
        };
    }
  }

  /**
   * Get circuit breaker status for all services
   */
  getCircuitBreakerStatus() {
    const status = {};
    for (const [name, breaker] of this.circuitBreakers) {
      status[name] = breaker.getStatus();
    }
    return status;
  }
}

// ==================== EXPORTS ====================

const errorHandler = new ErrorHandler();

module.exports = {
  // Error classes
  NeuraStackError,
  ModelFailureError,
  SynthesisError,
  VotingError,
  ValidationError,
  CircuitBreakerError,
  
  // Utilities
  retryWithBackoff,
  retryWithIntelligentBackoff,
  IntelligentRetryStrategy,
  intelligentRetryStrategy,
  calculateRetryDelay,
  classifyError,
  EnhancedErrorClassifier,
  errorClassifier,
  CircuitBreaker: IntelligentCircuitBreaker, // Export new class with old name for compatibility
  IntelligentCircuitBreaker,
  
  // Main handler
  errorHandler
};
