/**
 * 🧠 Enhanced Ensemble Runner - Optimized for low-cost, scalable AI coordination
 *
 * 🎯 PURPOSE: Coordinate AI models for better responses with low-cost focus.
 * 📋 OPTIMIZATIONS: Simplified queuing/metrics, low-cost models, enhanced caching, removed high-cost providers.
 */

const ensembleConfig = require('../config/ensemblePrompts');
const { models, systemPrompts, limits, meta } = ensembleConfig;
const dynamicConfig = require('../config/dynamicConfig');
const clients = require('./vendorClients');
const { getMemoryManager } = require('./memoryManager');
const { v4: generateUUID } = require('uuid');
const cacheService = require('./cacheService');
const { getHierarchicalContextManager } = require('./hierarchicalContextManager');
const enhancedSynthesisService = require('./enhancedSynthesisService');
const monitoringService = require('./monitoringService');
const providerReliabilityService = require('./providerReliabilityService');
const {
  NeuraStackError,
  ModelFailureError,
  SynthesisError,
  VotingError,
  errorHandler,
  retryWithBackoff
} = require('../utils/errorHandler');

// Performance services (simplified)
const EnsemblePerformanceOptimizer = require('./ensemblePerformanceOptimizer');
const EnhancedEnsembleCache = require('./enhancedEnsembleCache');
const ParallelEnsembleProcessor = require('./parallelEnsembleProcessor');

class EnhancedEnsembleRunner {
  constructor() {
    this.memoryManager = getMemoryManager();
    this.requestQueue = []; // Simplified single queue
    this.activeRequests = new Map();

    // Enhanced metrics with error tracking
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      concurrentRequests: 0,
      maxConcurrentRequests: 0,
      // Error handling metrics
      modelFailures: new Map(),
      synthesisFailures: 0,
      votingFailures: 0,
      circuitBreakerTrips: 0,
      fallbacksUsed: 0,
      retriesPerformed: 0
    };

    // Use dynamic configuration instead of hardcoded values
    this.config = {
      maxConcurrentRequests: dynamicConfig.getEnsembleMaxConcurrent(meta.tier),
      timeoutMs: dynamicConfig.ensemble.timeoutMs,
      retryAttempts: dynamicConfig.ensemble.retryAttempts,
      retryDelayMs: dynamicConfig.ensemble.retryDelayMs,
      maxPromptLength: dynamicConfig.ensemble.maxPromptLength
    };

    this.usageTracker = { hourlyRequests: new Map(), dailyRequests: new Map() };
    this.performanceOptimizer = new EnsemblePerformanceOptimizer(cacheService, monitoringService);
    this.enhancedCache = new EnhancedEnsembleCache(cacheService, monitoringService);

    // Pass dynamic configuration to parallel processor
    this.parallelProcessor = new ParallelEnsembleProcessor({
      maxConcurrentModels: dynamicConfig.parallel.maxConcurrentModels,
      modelTimeout: dynamicConfig.parallel.modelTimeout
    });

    this.startMetricsCollection(); // Simplified

    console.log('🚀 Enhanced Ensemble Runner initialized with dynamic configuration');
    console.log(`   Max Concurrent Requests (${meta.tier}): ${this.config.maxConcurrentRequests}`);
    console.log(`   Timeout: ${this.config.timeoutMs}ms`);
    console.log(`   Retry Attempts: ${this.config.retryAttempts}`);
    console.log(`   Max Prompt Length: ${this.config.maxPromptLength}`);
  }

  startMetricsCollection() {
    setInterval(() => this.collectRealTimeMetrics(), 5000);
  }

  collectRealTimeMetrics() {
    this.metrics.concurrentRequests = this.activeRequests.size;
    this.metrics.maxConcurrentRequests = Math.max(this.metrics.maxConcurrentRequests, this.metrics.concurrentRequests);
  }

  async enqueueRequest(requestData) {
    if (this.requestQueue.length >= 150) throw new Error('Queue full.');
    const request = { id: generateUUID(), data: requestData, timestamp: Date.now(), retryCount: 0 };
    this.requestQueue.push(request);
    this.processQueue();
    return request.id;
  }

  async processQueue() {
    if (this.metrics.concurrentRequests >= this.config.maxConcurrentRequests) return;
    while (this.requestQueue.length > 0 && this.metrics.concurrentRequests < this.config.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      this.executeRequest(request);
    }
  }

  async executeRequest(request) {
    const startTime = Date.now();
    this.metrics.concurrentRequests++;
    this.activeRequests.set(request.id, request);
    try {
      const result = await this.runEnsemble(request.data.prompt, request.data.userId, request.data.sessionId);
      this.activeRequests.delete(request.id);
      this.metrics.concurrentRequests--;
      this.metrics.successfulRequests++;
      this.updateAverageProcessingTime(Date.now() - startTime);
      this.processQueue();
      return result;
    } catch (error) {
      this.handleRequestError(request, error, Date.now() - startTime);
      throw error;
    }
  }

  handleRequestError(request, error, processingTime) {
    this.activeRequests.delete(request.id);
    this.metrics.concurrentRequests--;
    this.metrics.failedRequests++;

    // Enhanced error classification and tracking
    this.trackErrorMetrics(error, request.correlationId);

    // Log detailed error information
    monitoringService.log('error', 'Ensemble request failed', {
      requestId: request.id,
      error: error.message,
      errorType: error.constructor.name,
      processingTime: `${processingTime}ms`,
      retryCount: request.retryCount,
      correlationId: request.correlationId
    }, request.correlationId);

    // Enhanced retry logic with circuit breaker consideration
    if (request.retryCount < this.config.retryAttempts && this.shouldRetryRequest(error, request)) {
      request.retryCount++;
      this.metrics.retriesPerformed++;

      const delay = this.config.retryDelayMs * Math.pow(2, request.retryCount - 1);

      monitoringService.log('warn', `Retrying ensemble request (attempt ${request.retryCount})`, {
        requestId: request.id,
        delay: `${delay}ms`,
        correlationId: request.correlationId
      }, request.correlationId);

      setTimeout(() => {
        this.requestQueue.unshift(request);
        this.processQueue();
      }, delay);
    } else {
      // Request failed permanently
      monitoringService.log('error', 'Ensemble request failed permanently', {
        requestId: request.id,
        finalError: error.message,
        totalRetries: request.retryCount,
        correlationId: request.correlationId
      }, request.correlationId);

      this.processQueue();
    }
  }

  /**
   * Track error metrics for monitoring and circuit breaker decisions
   */
  trackErrorMetrics(error, correlationId) {
    // Track model-specific failures
    if (error instanceof ModelFailureError) {
      const key = `${error.provider}-${error.model}`;
      this.metrics.modelFailures.set(key, (this.metrics.modelFailures.get(key) || 0) + 1);
    }

    // Track synthesis failures
    if (error instanceof SynthesisError) {
      this.metrics.synthesisFailures++;
    }

    // Track voting failures
    if (error instanceof VotingError) {
      this.metrics.votingFailures++;
    }

    // Track circuit breaker trips
    if (error.message.includes('Circuit breaker')) {
      this.metrics.circuitBreakerTrips++;
    }
  }

  /**
   * Enhanced retry decision logic
   */
  shouldRetryRequest(error, request) {
    // Don't retry programmer errors
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return false;
    }

    // Don't retry if circuit breaker is open
    if (error.message.includes('Circuit breaker is OPEN')) {
      return false;
    }

    // Don't retry authentication errors
    if (error.message.includes('401') || error.message.includes('403')) {
      return false;
    }

    // Check if error is retryable based on type
    if (error instanceof ModelFailureError) {
      return error.isRetryable;
    }

    // Default retryable error patterns
    return this.isRetryableError(error);
  }

  isRetryableError(error) {
    const retryablePatterns = [
      'timeout', 'network', 'rate_limit', 'ECONNRESET', 'ENOTFOUND',
      '503', '502', '500', 'temporarily unavailable'
    ];

    return retryablePatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  updateAverageProcessingTime(processingTime) {
    const total = this.metrics.successfulRequests;
    this.metrics.averageProcessingTime = ((this.metrics.averageProcessingTime * (total - 1)) + processingTime) / total;
  }

  async callRoleWithResilience(role, userPrompt, correlationId) {
    const { provider, model } = models[role];

    // Use circuit breaker for this specific model
    const circuitBreaker = errorHandler.getCircuitBreaker(`${provider}-${model}`, {
      failureThreshold: 3,
      resetTimeout: 30000 // 30 seconds
    });

    return await circuitBreaker.execute(async () => {
      return await retryWithBackoff(
        async (attempt) => {
          monitoringService.log('debug', `Role call attempt ${attempt}`, {
            role,
            provider,
            model,
            correlationId
          }, correlationId);

          try {
            const result = await this.executeRoleCall(role, userPrompt, provider, model, correlationId);

            // Track successful call
            monitoringService.log('debug', `Role call successful`, {
              role,
              provider,
              model,
              attempt,
              correlationId
            }, correlationId);

            return result;
          } catch (error) {
            // Wrap and classify the error
            const modelError = new ModelFailureError(
              `${provider} ${model} call failed: ${error.message}`,
              provider,
              model,
              error,
              { correlationId, role, attempt }
            );

            throw modelError;
          }
        },
        {
          maxAttempts: this.config.retryAttempts,
          baseDelayMs: this.config.retryDelayMs,
          maxDelayMs: this.config.retryDelayMs * 8,
          onRetry: (error, attempt, delay) => {
            this.metrics.retriesPerformed++;
            monitoringService.log('warn', `Role call retry ${attempt}`, {
              role,
              provider,
              model,
              error: error.message,
              delay: `${delay}ms`,
              correlationId
            }, correlationId);
          },
          context: { role, provider, model, correlationId }
        }
      );
    });
  }

  async executeRoleCall(role, userPrompt, provider, model, correlationId) {
    const maxTokens = limits.maxTokensPerRole || 250;
    const startTime = Date.now();
    let response;

    try {
      switch (provider) {
        case 'openai':
          const openaiResp = await clients.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompts[role] },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: maxTokens,
            timeout: this.config.timeoutMs
          });

          if (!openaiResp.choices || !openaiResp.choices[0] || !openaiResp.choices[0].message) {
            throw new Error('Invalid OpenAI response structure');
          }

          response = openaiResp.choices[0].message.content;
          break;

        case 'gemini':
          const geminiResp = await clients.gemini.post(`/models/gemini-1.5-flash:generateContent`, {
            contents: [{
              parts: [{ text: `${systemPrompts[role]}\n\n${userPrompt}` }]
            }],
            generationConfig: { maxOutputTokens: maxTokens }
          });

          if (!geminiResp.data.candidates || !geminiResp.data.candidates[0] ||
              !geminiResp.data.candidates[0].content || !geminiResp.data.candidates[0].content.parts) {
            throw new Error('Invalid Gemini response structure');
          }

          response = geminiResp.data.candidates[0].content.parts[0].text;
          break;

        case 'claude':
          const claudeResp = await clients.claude.post('/messages', {
            model: 'claude-3-5-haiku-latest',
            max_tokens: maxTokens,
            messages: [{
              role: 'user',
              content: `${systemPrompts[role]}\n\n${userPrompt}`
            }]
          });

          if (!claudeResp.data.content || !claudeResp.data.content[0]) {
            throw new Error('Invalid Claude response structure');
          }

          response = claudeResp.data.content[0].text;
          break;

        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Validate response content
      if (!response || typeof response !== 'string' || response.trim().length === 0) {
        throw new Error(`Empty or invalid response from ${provider} ${model}`);
      }

      const responseTime = Date.now() - startTime;

      return {
        role,
        content: response.trim(),
        status: 'fulfilled',
        model,
        provider,
        responseTime,
        confidence: this.calculateResponseConfidence(response, responseTime),
        wordCount: response.trim().split(/\s+/).length
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Enhanced error information
      const enhancedError = new Error(`${provider} ${model} execution failed: ${error.message}`);
      enhancedError.originalError = error;
      enhancedError.provider = provider;
      enhancedError.model = model;
      enhancedError.role = role;
      enhancedError.responseTime = responseTime;
      enhancedError.correlationId = correlationId;

      throw enhancedError;
    }
  }

  /**
   * Calculate response confidence based on content and timing
   */
  calculateResponseConfidence(response, responseTime) {
    let confidence = 0.5; // Base confidence

    // Content quality factors
    if (response.length > 50) confidence += 0.1;
    if (response.length > 200) confidence += 0.1;
    if (response.includes('.') && response.includes(' ')) confidence += 0.1; // Basic structure

    // Response time factors (faster is generally better for confidence)
    if (responseTime < 5000) confidence += 0.1;
    if (responseTime < 2000) confidence += 0.1;

    return Math.min(1.0, Math.max(0.1, confidence));
  }

  async runEnsemble(userPrompt, userId = 'anonymous', sessionId = null) {
    const correlationId = generateUUID().substring(0, 8);
    const startTime = Date.now();

    try {
      monitoringService.log('info', 'Starting ensemble run', {
        userId,
        sessionId,
        promptLength: userPrompt.length,
        correlationId
      }, correlationId);

      // Input validation
      if (!userPrompt || typeof userPrompt !== 'string') {
        throw new NeuraStackError('Invalid user prompt provided', null, { correlationId, userId });
      }

      if (userPrompt.length > this.config.maxPromptLength) {
        throw new NeuraStackError(`Prompt too long (${userPrompt.length} > ${this.config.maxPromptLength})`, null, {
          correlationId,
          userId,
          promptLength: userPrompt.length
        });
      }

      // Check cache first
      const cached = await this.enhancedCache.getCachedEnsembleResponse(userPrompt, userId, meta.tier);
      if (cached) {
        monitoringService.log('info', 'Returning cached ensemble response', {
          correlationId,
          userId
        }, correlationId);
        return { ...cached, cached: true };
      }

      this.metrics.totalRequests++;

      // Rate limiting for free tier
      if (meta.tier === 'free') {
        this.checkRateLimit(userId);
      }

      sessionId = sessionId || `session_${userId}_${Date.now()}`;

      // Get context with error handling
      let context = '';
      try {
        const contextResult = await getHierarchicalContextManager().getHierarchicalContext(
          userId,
          sessionId,
          limits.maxTokensPerRole * 0.7,
          userPrompt
        );
        context = contextResult.context || '';
      } catch (contextError) {
        monitoringService.log('warn', 'Context retrieval failed, continuing without context', {
          error: contextError.message,
          correlationId
        }, correlationId);
      }

      const enhancedPrompt = context ? `${context}\n\n${userPrompt}` : userPrompt;

      // Execute role calls with enhanced error handling
      const rolePromises = ['gpt4o', 'gemini', 'claude'].map(role =>
        this.callRoleWithResilience(role, enhancedPrompt, correlationId)
      );

      const roleOutputs = await Promise.allSettled(rolePromises);

      // Check if we have any successful responses
      const successfulRoles = roleOutputs.filter(r => r.status === 'fulfilled');
      if (successfulRoles.length === 0) {
        throw new NeuraStackError('All AI models failed to respond', null, {
          correlationId,
          userId,
          failedRoles: roleOutputs.map(r => r.reason?.message || 'Unknown error')
        });
      }

      monitoringService.log('info', 'Role calls completed', {
        successful: successfulRoles.length,
        failed: roleOutputs.length - successfulRoles.length,
        correlationId
      }, correlationId);

      // Synthesis with error handling
      let synthesisResult;
      try {
        const roleData = roleOutputs.map(r => r.value || {
          status: 'rejected',
          error: r.reason?.message || 'Unknown error',
          role: r.reason?.role || 'unknown'
        });

        synthesisResult = await enhancedSynthesisService.synthesizeWithEnhancements(
          roleData,
          userPrompt,
          correlationId,
          {},
          userId,
          sessionId
        );
      } catch (synthesisError) {
        this.metrics.synthesisFailures++;
        monitoringService.log('error', 'Synthesis failed, using fallback', {
          error: synthesisError.message,
          correlationId
        }, correlationId);

        // Create fallback synthesis
        synthesisResult = this.createFallbackSynthesis(successfulRoles, userPrompt, correlationId);
      }

      const processingTime = Date.now() - startTime;

      // Cache the result
      try {
        await this.enhancedCache.cacheEnsembleResponse(
          userPrompt,
          userId,
          meta.tier,
          { synthesis: synthesisResult, roles: roleOutputs }
        );
      } catch (cacheError) {
        monitoringService.log('warn', 'Failed to cache ensemble response', {
          error: cacheError.message,
          correlationId
        }, correlationId);
      }

      // Update success metrics
      this.metrics.successfulRequests++;
      this.updateAverageProcessingTime(processingTime);

      monitoringService.log('info', 'Ensemble run completed successfully', {
        processingTime: `${processingTime}ms`,
        synthesisStatus: synthesisResult.status,
        correlationId
      }, correlationId);

      return {
        synthesis: synthesisResult,
        roles: roleOutputs.map(r => r.value || { status: 'rejected', error: r.reason?.message }),
        metadata: {
          processingTime,
          correlationId,
          successfulRoles: successfulRoles.length,
          totalRoles: roleOutputs.length
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.metrics.failedRequests++;

      monitoringService.log('error', 'Ensemble run failed', {
        error: error.message,
        errorType: error.constructor.name,
        processingTime: `${processingTime}ms`,
        correlationId
      }, correlationId);

      // Return error response instead of throwing
      return {
        synthesis: {
          content: 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.',
          model: 'error-fallback',
          status: 'error',
          error: error.message
        },
        roles: [],
        metadata: {
          processingTime,
          correlationId,
          error: error.message,
          errorType: error.constructor.name
        }
      };
    }
  }

  /**
   * Create fallback synthesis when main synthesis fails
   */
  createFallbackSynthesis(successfulRoles, userPrompt, correlationId) {
    this.metrics.fallbacksUsed++;

    if (successfulRoles.length === 0) {
      return {
        content: 'I apologize, but I\'m unable to provide a response at this time.',
        model: 'fallback',
        status: 'fallback',
        fallbackReason: 'no_successful_roles'
      };
    }

    // Simple concatenation fallback
    const responses = successfulRoles.map(r => r.value.content).filter(Boolean);

    if (responses.length === 1) {
      return {
        content: responses[0],
        model: 'fallback-single',
        status: 'fallback',
        fallbackReason: 'synthesis_failed'
      };
    }

    const fallbackContent = `Based on multiple AI analyses:\n\n${responses.map((response, index) =>
      `Analysis ${index + 1}: ${response}`
    ).join('\n\n')}`;

    return {
      content: fallbackContent,
      model: 'fallback-multi',
      status: 'fallback',
      fallbackReason: 'synthesis_failed',
      sourceCount: responses.length
    };
  }

  checkRateLimit(userId) {
    // Simplified rate limit check
    const now = Date.now();
    const hourKey = Math.floor(now / 3600000);
    const count = this.usageTracker.hourlyRequests.get(`${userId}-${hourKey}`) || 0;
    if (count >= 750) throw new Error('Rate limit exceeded.');
    this.usageTracker.hourlyRequests.set(`${userId}-${hourKey}`, count + 1);
  }

  getMetrics() {
    const successRate = this.metrics.totalRequests > 0
      ? (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2)
      : '0.00';

    const failureRate = this.metrics.totalRequests > 0
      ? (this.metrics.failedRequests / this.metrics.totalRequests * 100).toFixed(2)
      : '0.00';

    return {
      ...this.metrics,
      successRate: `${successRate}%`,
      failureRate: `${failureRate}%`,
      averageProcessingTime: `${this.metrics.averageProcessingTime.toFixed(0)}ms`,
      modelFailureBreakdown: Object.fromEntries(this.metrics.modelFailures),
      circuitBreakerStatus: errorHandler.getCircuitBreakerStatus()
    };
  }

  async healthCheck() {
    try {
      const metrics = this.getMetrics();
      const circuitBreakers = errorHandler.getCircuitBreakerStatus();

      // Check if any circuit breakers are open
      const openCircuitBreakers = Object.entries(circuitBreakers)
        .filter(([_, status]) => status.state === 'OPEN')
        .map(([name]) => name);

      const isHealthy = openCircuitBreakers.length === 0 &&
                       this.metrics.failedRequests < this.metrics.totalRequests * 0.5;

      return {
        ensemble: {
          isHealthy,
          status: isHealthy ? 'healthy' : 'degraded',
          metrics,
          circuitBreakers,
          openCircuitBreakers,
          warnings: openCircuitBreakers.length > 0 ?
            [`Circuit breakers open: ${openCircuitBreakers.join(', ')}`] : []
        }
      };
    } catch (error) {
      return {
        ensemble: {
          isHealthy: false,
          status: 'unhealthy',
          error: error.message
        }
      };
    }
  }
}

module.exports = new EnhancedEnsembleRunner();