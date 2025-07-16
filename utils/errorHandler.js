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

// ==================== CIRCUIT BREAKER ====================

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;

    // Optimize for test environment
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

    this.failureThreshold = options.failureThreshold || (isTestEnv ? 10 : 5); // Higher threshold in tests
    this.resetTimeout = options.resetTimeout || (isTestEnv ? 1000 : 60000); // Faster reset in tests
    this.monitorWindow = options.monitorWindow || (isTestEnv ? 5000 : 120000); // Shorter window in tests
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = [];
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  async execute(operation, context = {}) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN for ${this.name}. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`,
          this.name
        );
      } else {
        this.state = 'HALF_OPEN';
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error, context);
      throw error;
    }
  }

  onSuccess() {
    this.failures = [];
    this.state = 'CLOSED';
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  onFailure(error, context) {
    const now = Date.now();
    this.failures.push({ timestamp: now, error: error.message, context });
    this.lastFailureTime = now;

    // Clean old failures outside monitor window
    this.failures = this.failures.filter(f => now - f.timestamp < this.monitorWindow);

    if (this.failures.length >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = now + this.resetTimeout;
      
      monitoringService.log('warn', `Circuit breaker opened for ${this.name}`, {
        failureCount: this.failures.length,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
      });
    }
  }

  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failures.length,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }
}

// ==================== RETRY MECHANISMS ====================

/**
 * Exponential backoff retry with jitter
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

// ==================== ERROR CLASSIFICATION ====================

/**
 * Classify error as operational or programmer error
 */
function classifyError(error) {
  // Programmer errors (should not be retried, need code fixes)
  if (error instanceof TypeError) return { type: 'programmer', retryable: false };
  if (error instanceof ReferenceError) return { type: 'programmer', retryable: false };
  if (error instanceof SyntaxError) return { type: 'programmer', retryable: false };
  
  // Check error message for programmer error indicators
  const message = error.message || error.toString();
  if (message.includes('Cannot read property') || 
      message.includes('is not a function') ||
      message.includes('undefined is not an object')) {
    return { type: 'programmer', retryable: false };
  }

  // NeuraStack custom errors
  if (error instanceof NeuraStackError) {
    return { 
      type: error.isOperational ? 'operational' : 'programmer',
      retryable: error.isRetryable !== false
    };
  }

  // Network and API errors (operational)
  if (message.includes('timeout') ||
      message.includes('ECONNRESET') ||
      message.includes('ENOTFOUND') ||
      message.includes('503') ||
      message.includes('502') ||
      message.includes('500') ||
      message.includes('rate_limit')) {
    return { type: 'operational', retryable: true };
  }

  // Default to operational error
  return { type: 'operational', retryable: true };
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
      this.circuitBreakers.set(serviceName, new CircuitBreaker(serviceName, options));
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
  classifyError,
  CircuitBreaker,
  
  // Main handler
  errorHandler
};
