/**
 * 🧠 Enhanced Ensemble Runner - The Brain of NeuraStack
 *
 * 🎯 PURPOSE: Coordinate multiple AI models to work together for better responses
 *
 * 📋 EXECUTION FLOW:
 * 1. Receive user prompt and context
 * 2. Load conversation memory for context
 * 3. Send prompt to multiple AI models in parallel
 * 4. Collect and analyze all responses
 * 5. Use weighted voting to select best response
 * 6. Synthesize final answer combining insights
 * 7. Store interaction in memory for future context
 *
 * 💡 ANALOGY: Like having a panel of expert doctors discuss your case
 *    - Each AI model is a specialist with different strengths
 *    - They all examine the same question independently
 *    - We combine their expertise for the most reliable answer
 *
 * 🔧 KEY FEATURES:
 * - 🤖 Multi-AI coordination (GPT, Claude, Gemini, etc.)
 * - 🧠 Conversation memory integration
 * - ⚖️ Intelligent response voting and synthesis
 * - 📊 Performance tracking and cost monitoring
 * - 🛡️ Graceful error handling and fallbacks
 * - ⚡ Parallel processing for speed
 */

const ensembleConfig = require('../config/ensemblePrompts'); // Configuration for AI models and prompts
const { models, systemPrompts, limits, meta } = ensembleConfig; // Extract specific config parts
const clients = require('./vendorClients'); // Connects to different AI providers (OpenAI, Anthropic, etc.)
const { getMemoryManager } = require('./memoryManager'); // Manages conversation memory
const { v4: generateUUID } = require('uuid'); // Creates unique IDs for tracking requests
const cacheService = require('./cacheService'); // Stores responses for faster retrieval
const { getHierarchicalContextManager } = require('./hierarchicalContextManager'); // Organizes context for AI
const enhancedSynthesisService = require('./enhancedSynthesisService'); // Advanced synthesis with conflict resolution
const monitoringService = require('./monitoringService'); // Enhanced monitoring with synthesis quality tracking
const providerReliabilityService = require('./providerReliabilityService'); // For dynamic reliability weighting
/**
 * 🧠 Enhanced Ensemble Runner Class
 *
 * 🎯 PURPOSE: Main coordinator class for multi-AI ensemble processing
 * 📋 RESPONSIBILITIES: Request queuing, AI coordination, response synthesis
 */
class EnhancedEnsembleRunner {
  constructor() {
    // 🧠 STEP 1: Initialize memory management
    this.memoryManager = null; // 📝 Handles conversation history and context

    // 🚦 STEP 2: Request queue system (handles multiple concurrent users)
    this.requestQueue = [];           // 📋 Main request queue
    this.priorityQueues = {
      high: [],    // 🔥 Critical requests (premium users, retries)
      medium: [],  // 📊 Standard requests (regular users)
      low: []      // 🔄 Background requests (analytics, cleanup)
    };
    this.activeRequests = new Map();  // 📊 Currently processing requests
    this.connectionPools = new Map(); // 🔗 Connection pools for each AI provider
    this.loadBalancer = new Map();    // ⚖️ Load balancing state for providers

    // Enhanced performance tracking for production deployment
    this.metrics = {
      totalRequests: 0, // How many requests we've processed
      successfulRequests: 0, // How many worked correctly
      failedRequests: 0, // How many had errors
      averageProcessingTime: 0, // How long requests typically take
      concurrentRequests: 0, // How many are running right now
      maxConcurrentRequests: 0, // The most we've handled at once

      // Advanced production metrics
      requestsPerSecond: 0,
      errorRate: 0,
      timeoutRate: 0,
      retryRate: 0,
      queueLength: 0,
      averageQueueTime: 0,
      synthesisQuality: 0,
      modelPerformance: new Map(),
      responseTimePercentiles: { p50: 0, p95: 0, p99: 0 },
      memoryPressure: 0,
      circuitBreakerStatus: new Map(),

      // Time-series data for trending
      responseTimeHistory: [],
      errorHistory: [],

      // Real-time monitoring
      lastMinuteRequests: [],
      recentErrors: [],
      performanceAlerts: [],

      // Quality metrics
      confidenceScores: [],
      votingAccuracy: 0,
      consensusStrength: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      lastHealthCheck: Date.now()
    };

    // Optimized configuration for production deployment with 25+ concurrent users
    this.config = {
      maxConcurrentRequests: meta.tier === 'free' ? 30 : 60, // Increased for better throughput
      timeoutMs: limits.timeoutMs || 45000, // Optimized timeout for stability (45 seconds)
      retryAttempts: meta.tier === 'free' ? 3 : 4, // More retries for better reliability
      retryDelayMs: 800, // Reduced retry delay for faster recovery
      memoryContextTokens: Math.floor(limits.maxTokensPerRole * 0.7) || 1800, // Increased context for better responses
      synthesisMaxTokens: limits.maxSynthesisTokens || 500, // Increased for better synthesis quality
      maxPromptLength: limits.maxPromptLength || 6000, // Increased for more detailed prompts
      requestsPerHour: limits.requestsPerHour || 750, // Increased rate limits for production
      requestsPerDay: limits.requestsPerDay || 7500, // Increased daily limits

      // Enhanced production-grade settings
      connectionPoolSize: 15, // Larger connection pool for better concurrency
      queueMaxSize: 150, // Larger queue size for peak load handling
      priorityLevels: 4, // More priority levels for better request management
      batchProcessing: true, // Enable batch processing for efficiency
      adaptiveTimeout: true, // Enable adaptive timeout based on load
      adaptiveTimeout: true, // Enable adaptive timeout based on load
      loadBalancing: true, // Enable intelligent load balancing
      circuitBreakerThreshold: 5, // Failures before opening circuit breaker
      circuitBreakerTimeout: 60000, // Circuit breaker timeout (1 minute)
      healthCheckInterval: 30000, // Health check interval (30 seconds)
      metricsCollectionInterval: 5000 // Metrics collection interval (5 seconds)
    };

    // Usage tracking for rate limiting
    this.usageTracker = {
      hourlyRequests: new Map(),
      dailyRequests: new Map()
    };

    // Initialize vendor clients for AI providers
    this.vendorClients = require('./vendorClients');

    // Start metrics collection for production monitoring
    this.startMetricsCollection();

    console.log('🚀 Enhanced Ensemble Runner initialized with production-grade monitoring');
  }

  getMemoryManager() {
    return getMemoryManager();
  }

  /**
   * Start real-time metrics collection for production monitoring
   */
  startMetricsCollection() {
    // Collect metrics every 5 seconds
    setInterval(() => {
      this.collectRealTimeMetrics();
    }, this.config.metricsCollectionInterval);

    // Calculate percentiles every minute
    setInterval(() => {
      this.calculateResponseTimePercentiles();
      this.updateErrorRate();
      this.checkPerformanceAlerts();
    }, 60000);

    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
  }

  /**
   * Collect real-time metrics
   */
  collectRealTimeMetrics() {
    const now = Date.now();

    // Update requests per second
    this.metrics.lastMinuteRequests = this.metrics.lastMinuteRequests.filter(
      timestamp => now - timestamp < 60000
    );
    this.metrics.requestsPerSecond = this.metrics.lastMinuteRequests.length / 60;

    // Update queue length
    this.metrics.queueLength = this.getTotalQueueSize();

    // Update memory pressure
    this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    this.metrics.memoryPressure = this.metrics.memoryUsage / process.memoryUsage().heapTotal;

    // Update circuit breaker status
    this.updateCircuitBreakerStatus();

    // Calculate synthesis quality average
    if (this.metrics.confidenceScores.length > 0) {
      this.metrics.synthesisQuality = this.metrics.confidenceScores.reduce((a, b) => a + b, 0) /
                                     this.metrics.confidenceScores.length;
    }
  }

  /**
   * Calculate response time percentiles
   */
  calculateResponseTimePercentiles() {
    if (this.metrics.responseTimeHistory.length === 0) return;

    const sorted = [...this.metrics.responseTimeHistory].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.responseTimePercentiles = {
      p50: sorted[Math.floor(len * 0.5)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)]
    };
  }

  /**
   * Update error rate
   */
  updateErrorRate() {
    const totalRequests = this.metrics.totalRequests;
    if (totalRequests > 0) {
      this.metrics.errorRate = this.metrics.failedRequests / totalRequests;
      this.metrics.timeoutRate = this.metrics.errorHistory.filter(
        error => error.type === 'timeout'
      ).length / totalRequests;
      this.metrics.retryRate = this.metrics.errorHistory.filter(
        error => error.retry
      ).length / totalRequests;
    }
  }

  /**
   * Check for performance alerts
   */
  checkPerformanceAlerts() {
    const alerts = [];

    // High error rate alert
    if (this.metrics.errorRate > 0.1) {
      alerts.push({
        type: 'high_error_rate',
        severity: 'warning',
        message: `Error rate is ${(this.metrics.errorRate * 100).toFixed(2)}%`,
        timestamp: Date.now()
      });
    }

    // High response time alert
    if (this.metrics.responseTimePercentiles.p95 > 10000) {
      alerts.push({
        type: 'high_response_time',
        severity: 'warning',
        message: `95th percentile response time is ${this.metrics.responseTimePercentiles.p95}ms`,
        timestamp: Date.now()
      });
    }

    // Memory pressure alert
    if (this.metrics.memoryPressure > 0.8) {
      alerts.push({
        type: 'memory_pressure',
        severity: 'critical',
        message: `Memory usage is ${(this.metrics.memoryPressure * 100).toFixed(2)}%`,
        timestamp: Date.now()
      });
    }

    // Queue length alert
    if (this.metrics.queueLength > this.config.queueMaxSize * 0.8) {
      alerts.push({
        type: 'queue_pressure',
        severity: 'warning',
        message: `Queue length is ${this.metrics.queueLength}`,
        timestamp: Date.now()
      });
    }

    // Add new alerts
    this.metrics.performanceAlerts.push(...alerts);

    // Keep only recent alerts (last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.metrics.performanceAlerts = this.metrics.performanceAlerts.filter(
      alert => alert.timestamp > oneHourAgo
    );

    // Log critical alerts
    alerts.filter(alert => alert.severity === 'critical').forEach(alert => {
      console.error(`🚨 CRITICAL ALERT: ${alert.message}`);
    });
  }

  /**
   * Update circuit breaker status
   */
  updateCircuitBreakerStatus() {
    const vendorClients = require('./vendorClients');
    const providers = ['openai', 'xai', 'gemini', 'claude'];

    providers.forEach(provider => {
      const breaker = vendorClients.circuitBreakers?.get(provider);
      if (breaker) {
        this.metrics.circuitBreakerStatus.set(provider, {
          state: breaker.state,
          failureCount: breaker.failureCount,
          successCount: breaker.successCount,
          failureRate: breaker.failureRate || 0
        });
      }
    });
  }

  /**
   * Clean up old metrics data
   */
  cleanupOldMetrics() {
    const oneHourAgo = Date.now() - 3600000;

    // Keep only last hour of response times
    this.metrics.responseTimeHistory = this.metrics.responseTimeHistory.slice(-1000);

    // Keep only recent errors
    this.metrics.errorHistory = this.metrics.errorHistory.filter(
      error => error.timestamp > oneHourAgo
    );

    // Keep only recent confidence scores
    this.metrics.confidenceScores = this.metrics.confidenceScores.slice(-100);

    console.log('🧹 Cleaned up old metrics data');
  }

  /**
   * Advanced request queuing with priority levels
   */
  async enqueueRequest(requestData, priority = 'medium') {
    const queueSize = this.getTotalQueueSize();

    // Reject if queue is full
    if (queueSize >= this.config.queueMaxSize) {
      throw new Error('Request queue is full. Please try again later.');
    }

    // Create request object with metadata
    const request = {
      id: generateUUID(),
      data: requestData,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      estimatedProcessingTime: this.estimateProcessingTime(requestData)
    };

    // Add to appropriate priority queue
    this.priorityQueues[priority].push(request);

    // Process queue if we have capacity
    this.processQueue();

    return request.id;
  }

  /**
   * Process requests from priority queues
   */
  async processQueue() {
    if (this.metrics.concurrentRequests >= this.config.maxConcurrentRequests) {
      return; // At capacity
    }

    // Process high priority first, then medium, then low
    const priorities = ['high', 'medium', 'low'];

    for (const priority of priorities) {
      const queue = this.priorityQueues[priority];

      while (queue.length > 0 && this.metrics.concurrentRequests < this.config.maxConcurrentRequests) {
        const request = queue.shift();
        this.executeRequest(request);
      }
    }
  }

  /**
   * Execute individual request with enhanced error handling and metrics
   */
  async executeRequest(request) {
    const startTime = Date.now();
    this.metrics.concurrentRequests++;
    this.metrics.maxConcurrentRequests = Math.max(
      this.metrics.maxConcurrentRequests,
      this.metrics.concurrentRequests
    );
    this.activeRequests.set(request.id, request);

    // Track queue time
    const queueTime = startTime - request.timestamp;
    this.updateAverageQueueTime(queueTime);

    try {
      const result = await this.runEnsemble(
        request.data.prompt,
        request.data.userId,
        request.data.sessionId
      );

      // Request completed successfully
      const processingTime = Date.now() - startTime;
      this.activeRequests.delete(request.id);
      this.metrics.concurrentRequests--;
      this.metrics.successfulRequests++;

      // Update metrics
      this.metrics.responseTimeHistory.push(processingTime);
      this.metrics.lastMinuteRequests.push(Date.now());

      // Track confidence score if available
      if (result.data?.synthesis?.confidence?.score) {
        this.metrics.confidenceScores.push(result.data.synthesis.confidence.score);
      }

      // Track voting accuracy if available
      if (result.data?.voting?.confidence) {
        this.updateVotingAccuracy(result.data.voting);
      }

      // Process next request in queue
      this.processQueue();

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.handleRequestError(request, error, processingTime);
      throw error;
    }
  }

  /**
   * Handle request errors with retry logic and enhanced metrics
   */
  async handleRequestError(request, error, processingTime = 0) {
    this.activeRequests.delete(request.id);
    this.metrics.concurrentRequests--;
    this.metrics.failedRequests++;

    // Track error details
    const errorDetails = {
      type: this.categorizeError(error),
      message: error.message,
      timestamp: Date.now(),
      processingTime,
      retry: false,
      requestId: request.id
    };

    this.metrics.errorHistory.push(errorDetails);

    // Retry logic for transient errors
    if (request.retryCount < this.config.retryAttempts && this.isRetryableError(error)) {
      request.retryCount++;
      request.priority = 'high'; // Bump priority for retries
      errorDetails.retry = true;

      // Exponential backoff
      const delay = this.config.retryDelayMs * Math.pow(2, request.retryCount - 1);

      setTimeout(() => {
        this.priorityQueues.high.unshift(request); // Add to front of high priority queue
        this.processQueue();
      }, delay);

      console.warn(`🔄 Retrying request ${request.id} (attempt ${request.retryCount}/${this.config.retryAttempts})`);

    } else {
      // Max retries exceeded or non-retryable error
      console.error(`❌ Request ${request.id} failed permanently:`, {
        error: error.message,
        retryCount: request.retryCount,
        processingTime
      });
    }

    // Process next request
    this.processQueue();
  }

  /**
   * Categorize errors for better analysis
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
      return 'service_unavailable';
    } else {
      return 'unknown';
    }
  }

  /**
   * Update average queue time
   */
  updateAverageQueueTime(queueTime) {
    if (!this.metrics.averageQueueTime) {
      this.metrics.averageQueueTime = queueTime;
    } else {
      // Exponential moving average
      this.metrics.averageQueueTime = (this.metrics.averageQueueTime * 0.9) + (queueTime * 0.1);
    }
  }

  /**
   * Update voting accuracy metrics
   */
  updateVotingAccuracy(votingResult) {
    if (votingResult.consensus === 'strong') {
      this.metrics.votingAccuracy = Math.min(1.0, this.metrics.votingAccuracy + 0.1);
    } else if (votingResult.consensus === 'weak') {
      this.metrics.votingAccuracy = Math.max(0.0, this.metrics.votingAccuracy - 0.05);
    }

    // Track consensus strength
    const consensusValues = { strong: 1.0, moderate: 0.6, weak: 0.2 };
    this.metrics.consensusStrength = (this.metrics.consensusStrength * 0.9) +
                                    (consensusValues[votingResult.consensus] * 0.1);
  }

  /**
   * Determine if error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'timeout',
      'network',
      'rate_limit',
      'service_unavailable',
      'internal_server_error'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryable => errorMessage.includes(retryable));
  }

  /**
   * Get total queue size across all priorities
   */
  getTotalQueueSize() {
    return Object.values(this.priorityQueues).reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Estimate processing time based on request complexity
   */
  estimateProcessingTime(requestData) {
    const baseTime = 3000; // 3 seconds base
    const promptLength = requestData.prompt?.length || 0;
    const complexityMultiplier = Math.min(promptLength / 1000, 3); // Max 3x for very long prompts

    return Math.round(baseTime * (1 + complexityMultiplier));
  }

  /**
   * Enhanced role calling with circuit breaker and retry logic
   */
  async callRoleWithResilience(role, userPrompt, correlationId) {
    const { provider, model } = models[role];
    const maxRetries = this.config.retryAttempts;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [${correlationId}] Calling ${role} (${provider}) - Attempt ${attempt}/${maxRetries}`);
        
        const result = await this.executeRoleCallWithCircuitBreaker(role, userPrompt, provider, model, correlationId);
        
        console.log(`✅ [${correlationId}] ${role} completed successfully`);
        return result;
        
      } catch (error) {
        console.warn(`⚠️ [${correlationId}] ${role} attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          // Try fallback provider if original provider failed completely
          try {
            console.log(`🔄 [${correlationId}] Trying fallback provider for ${role}...`);
            const fallbackResult = await this.tryFallbackProvider(role, userPrompt, correlationId);
            console.log(`✅ [${correlationId}] ${role} completed with fallback provider`);
            return fallbackResult;
          } catch (fallbackError) {
            console.error(`❌ [${correlationId}] ${role} fallback also failed:`, fallbackError.message);
            throw error; // Throw original error
          }
        }
        
        // Exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Try fallback provider (reliable OpenAI model) when primary provider fails
   */
  async tryFallbackProvider(role, userPrompt, correlationId) {
    const fallbackConfig = models.fallback;

    if (!fallbackConfig || fallbackConfig.provider !== 'openai') {
      throw new Error('No reliable fallback provider configured');
    }

    console.log(`🔄 [${correlationId}] Using fallback: ${fallbackConfig.model} for ${role} (bypassing circuit breaker)`);

    // Bypass circuit breaker for fallback calls since we know OpenAI is reliable
    const result = await this.executeRoleCallWithFallbackPrompt(role, userPrompt, fallbackConfig.provider, fallbackConfig.model, correlationId);

    // Mark as fallback in the result
    return {
      ...result,
      isFallback: true,
      originalProvider: models[role].provider,
      fallbackProvider: fallbackConfig.provider,
      fallbackModel: fallbackConfig.model
    };
  }

  /**
   * Execute role call with circuit breaker, but allow fallback on circuit breaker failure
   */
  async executeRoleCallWithCircuitBreaker(role, userPrompt, provider, model, correlationId) {
    try {
      // Try with circuit breaker first
      return await clients.executeWithCircuitBreaker(provider, async () => {
        return await this.executeRoleCall(role, userPrompt, provider, model);
      });
    } catch (error) {
      // If circuit breaker is open or provider fails, this will throw
      console.warn(`⚠️ [${correlationId}] Circuit breaker blocked ${provider} or provider failed: ${error.message}`);
      throw error; // Let the retry logic in callRoleWithResilience handle fallback
    }
  }

  /**
   * Execute role call with fallback-specific system prompt
   */
  async executeRoleCallWithFallbackPrompt(role, userPrompt, provider, model, correlationId) {
    const maxTokens = limits.maxTokensPerRole || 250;
    const startTime = Date.now();

    console.log(`🔄 [${correlationId}] Executing fallback call for ${role} using ${model}`);

    // Use fallback system prompt instead of role-specific prompt
    const fallbackSystemPrompt = systemPrompts.fallback || systemPrompts[role];

    let response;
    let actualResponseTokens = 0;

    try {
      // Only OpenAI is supported as fallback provider for reliability
      if (provider === 'openai') {
        const openaiResponse = await clients.openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: fallbackSystemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxTokens,
          temperature: 0.7
        });
        response = openaiResponse.choices[0].message.content;
        actualResponseTokens = openaiResponse.usage?.completion_tokens || Math.ceil(response.length / 4);
      } else {
        throw new Error(`Unsupported fallback provider: ${provider}`);
      }

      // Truncate if needed
      const maxCharacters = limits.maxCharactersPerRole || 2000;
      if (response.length > maxCharacters) {
        response = response.substring(0, maxCharacters) + '...';
      }

      const responseTime = Date.now() - startTime;
      console.log(`✅ [${correlationId}] Fallback ${role} completed in ${responseTime}ms`);

      return response;

    } catch (error) {
      console.error(`❌ [${correlationId}] Fallback execution failed for ${role}:`, error.message);
      throw error;
    }
  }

  async executeRoleCall(role, userPrompt, provider, model) {
    const maxTokens = limits.maxTokensPerRole || 250;
    const maxCharacters = limits.maxCharactersPerRole || 2000;
    const startTime = Date.now();

    // Estimate prompt tokens for cost tracking
    const promptTokens = Math.ceil(userPrompt.length / 4);

    let response;
    let actualResponseTokens = 0;
    let success = false;

    switch (provider) {
      case 'openai':
        const openaiResponse = await clients.openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompts[role] },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: maxTokens,
          temperature: 0.7
        });
        response = openaiResponse.choices[0].message.content;
        actualResponseTokens = openaiResponse.usage?.completion_tokens || Math.ceil(response.length / 4);
        success = true;
        break;

      case 'xai':
        const xaiResponse = await clients.xai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompts[role] },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: Math.floor(maxTokens * 1.4), // XAI models may need more tokens
          temperature: 0.7
        });
        response = xaiResponse.choices[0].message.content ||
                   xaiResponse.choices[0].message.reasoning_content ||
                   'No response generated';
        actualResponseTokens = xaiResponse.usage?.completion_tokens || Math.ceil(response.length / 4);
        success = true;
        break;

      case 'gemini':
        // Increase token limit specifically for Gemini to encourage longer responses
        const geminiMaxTokens = Math.floor(maxTokens * 1.5); // 50% more tokens for Gemini
        const geminiResponse = await clients.gemini.post(
          `/models/${model}:generateContent`,
          {
            contents: [{
              parts: [{
                text: `${systemPrompts[role]}\n\nUser: ${userPrompt}`
              }]
            }],
            generationConfig: {
              maxOutputTokens: geminiMaxTokens,
              temperature: 0.8, // Slightly higher temperature for more creative/longer responses
              topP: 0.95, // Encourage more diverse vocabulary
              topK: 40 // Allow more token choices for longer responses
            }
          }
        );
        response = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
        actualResponseTokens = geminiResponse.data.usageMetadata?.candidatesTokenCount || Math.ceil(response.length / 4);
        success = true;
        break;

      case 'claude':
        const claudeResponse = await clients.claude.post('/messages', {
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'user', content: `${systemPrompts[role]}\n\nUser: ${userPrompt}` }
          ]
        });
        response = claudeResponse.data.content[0].text;
        actualResponseTokens = claudeResponse.data.usage?.output_tokens || Math.ceil(response.length / 4);
        success = true;
        break;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // Apply character limit to individual AI responses (but not synthesizer)
    if (response && response.length > maxCharacters) {
      // Truncate at the last complete sentence within the character limit
      const truncated = response.substring(0, maxCharacters);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?')
      );

      if (lastSentenceEnd > maxCharacters * 0.7) {
        // If we can find a sentence ending in the last 30% of the limit, use it
        response = truncated.substring(0, lastSentenceEnd + 1);
      } else {
        // Otherwise, truncate at the last word boundary
        const lastSpace = truncated.lastIndexOf(' ');
        response = lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
      }
    }

    // Track performance metrics
    const responseTime = Date.now() - startTime;
    const quality = this.calculateResponseQuality(response, responseTime, 0, false);

    // Record provider event for dynamic reliability weighting
    try {
      providerReliabilityService.recordProviderEvent(
        provider,
        success,
        responseTime,
        model,
        promptTokens,
        actualResponseTokens
      );
    } catch (error) {
      console.warn(`Failed to record provider event for ${provider}:`, error.message);
    }

    // Log API call performance for monitoring
    console.log(`🤖 API Call: ${model} - ${responseTime}ms, Quality: ${quality.toFixed(2)}, Tokens: ${actualResponseTokens}, Success: ${success}`);

    return response;
  }

  /**
   * Check rate limits for user
   */
  checkRateLimit(userId) {
    const now = Date.now();
    const hourKey = Math.floor(now / (1000 * 60 * 60));
    const dayKey = Math.floor(now / (1000 * 60 * 60 * 24));

    // Clean old entries
    this.cleanupUsageTracking(now);

    // Check hourly limit
    const hourlyKey = `${userId}-${hourKey}`;
    const hourlyCount = this.usageTracker.hourlyRequests.get(hourlyKey) || 0;
    if (hourlyCount >= this.config.requestsPerHour) {
      throw new Error(`Rate limit exceeded: ${this.config.requestsPerHour} requests per hour`);
    }

    // Check daily limit
    const dailyKey = `${userId}-${dayKey}`;
    const dailyCount = this.usageTracker.dailyRequests.get(dailyKey) || 0;
    if (dailyCount >= this.config.requestsPerDay) {
      throw new Error(`Rate limit exceeded: ${this.config.requestsPerDay} requests per day`);
    }

    // Update counters
    this.usageTracker.hourlyRequests.set(hourlyKey, hourlyCount + 1);
    this.usageTracker.dailyRequests.set(dailyKey, dailyCount + 1);
  }

  cleanupUsageTracking(now) {
    const currentHour = Math.floor(now / (1000 * 60 * 60));
    const currentDay = Math.floor(now / (1000 * 60 * 60 * 24));

    // Remove old hourly entries (keep last 2 hours)
    for (const [key] of this.usageTracker.hourlyRequests) {
      const hour = parseInt(key.split('-').pop());
      if (hour < currentHour - 1) {
        this.usageTracker.hourlyRequests.delete(key);
      }
    }

    // Remove old daily entries (keep last 2 days)
    for (const [key] of this.usageTracker.dailyRequests) {
      const day = parseInt(key.split('-').pop());
      if (day < currentDay - 1) {
        this.usageTracker.dailyRequests.delete(key);
      }
    }
  }

  /**
   * Get optimal model configuration including fine-tuned models
   */
  getOptimalModelConfig(purpose, userTier) {
    // For now, disable fine-tuned models and use standard models
    // TODO: Re-enable when actual fine-tuned models are available

    // Fallback to standard models
    const standardModels = models;
    return {
      ...standardModels.synthesizer,
      isFineTuned: false
    };
  }

  /**
   * Enhanced ensemble execution with comprehensive error handling and rate limiting
   */
  async runEnsemble(userPrompt, userId = 'anonymous', sessionId = null) {
    const correlationId = generateUUID().substring(0, 8);
    const startTime = Date.now();

    // Validate prompt length
    if (userPrompt.length > this.config.maxPromptLength) {
      throw new Error(`Prompt too long. Maximum ${this.config.maxPromptLength} characters allowed.`);
    }

    // Check cache first for ensemble responses
    try {
      const cachedResponse = await cacheService.getCachedEnsembleResponse(
        userPrompt,
        userId,
        meta.tier
      );

      if (cachedResponse) {
        console.log(`🎯 Returning cached ensemble response for user ${userId}`);
        this.updateMetrics('cache_hit', Date.now() - startTime);
        return {
          ...cachedResponse,
          cached: true,
          cacheTimestamp: new Date().toISOString()
        };
      }
    } catch (cacheError) {
      console.warn('⚠️ Cache lookup failed, proceeding with fresh request:', cacheError.message);
    }

    // Check rate limits for free tier
    if (meta.tier === 'free') {
      try {
        this.checkRateLimit(userId);
      } catch (error) {
        console.warn(`⚠️ [${correlationId}] Rate limit exceeded for user ${userId}: ${error.message}`);
        throw error;
      }
    }
    
    // Update metrics
    this.metrics.totalRequests++;
    this.metrics.concurrentRequests++;
    this.metrics.maxConcurrentRequests = Math.max(
      this.metrics.maxConcurrentRequests, 
      this.metrics.concurrentRequests
    );

    console.log(`🚀 [${correlationId}] Starting enhanced ensemble for user ${userId}`);
    console.log(`📝 [${correlationId}] Prompt: "${userPrompt.substring(0, 100)}..."`);

    try {
      // Generate session ID if not provided
      if (!sessionId) {
        sessionId = `session_${userId}_${Date.now()}`;
      }

      // Step 1: Get hierarchical memory context with error handling
      let contextResult = { context: '', totalTokens: 0 };
      let memoryContextUsed = false;

      try {
        contextResult = await Promise.race([
          getHierarchicalContextManager().getHierarchicalContext(userId, sessionId, this.config.memoryContextTokens, userPrompt),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Hierarchical context timeout')), 5000)
          )
        ]);

        if (contextResult.context) {
          memoryContextUsed = true;
          console.log(`🏗️ [${correlationId}] Retrieved hierarchical context: ${contextResult.totalTokens} tokens (${contextResult.optimization?.sectionsIncluded || 0} sections)`);
          console.log(`📊 [${correlationId}] Context efficiency: ${Math.round((contextResult.optimization?.efficiency || 0) * 100)}%`);
        }
      } catch (error) {
        console.warn(`⚠️ [${correlationId}] Hierarchical context failed, falling back to basic context:`, error.message);

        // Fallback to basic memory context
        try {
          const basicContext = await this.getMemoryManager().getMemoryContext(userId, sessionId, this.config.memoryContextTokens, userPrompt);
          if (basicContext) {
            contextResult = { context: basicContext, totalTokens: Math.ceil(basicContext.length / 4) };
            memoryContextUsed = true;
            console.log(`📚 [${correlationId}] Retrieved fallback context: ${contextResult.totalTokens} tokens`);
          }
        } catch (fallbackError) {
          console.warn(`⚠️ [${correlationId}] Fallback context also failed:`, fallbackError.message);
        }
      }

      // Step 2: Enhance prompt with hierarchical context
      const enhancedPrompt = contextResult.context ?
        `${contextResult.context}\n\n--- CURRENT REQUEST ---\n${userPrompt}` :
        userPrompt;

      // Step 3: Execute all roles in parallel with timeout and error handling
      const rolePromises = ['gpt4o', 'gemini', 'claude'].map(role => {
        const startTime = Date.now();

        return Promise.race([
          this.callRoleWithResilience(role, enhancedPrompt, correlationId),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${this.config.timeoutMs}ms`)), this.config.timeoutMs)
          )
        ])
        .then(content => {
          const responseTime = Date.now() - startTime;

          // Calculate simple confidence score for this response
          const confidence = this.calculateSimpleConfidence(content, responseTime);

          return {
            role,
            content,
            status: 'fulfilled',
            model: models[role].model,
            provider: models[role].provider,
            wordCount: content.split(' ').length,
            characterCount: content.length,
            responseTime,
            confidence,
            metadata: {
              confidenceLevel: this.getSimpleConfidenceLevel(confidence),
              modelReliability: 0.8 // Simple default reliability
            }
          };
        })
        .catch(error => ({
          role,
          content: `**Error**: ${error.message}`,
          status: 'rejected',
          model: models[role].model,
          provider: models[role].provider,
          wordCount: 0,
          responseTime: Date.now() - startTime,
          confidence: 0,
          error: error.message,
          metadata: {
            confidenceLevel: 'error',
            modelReliability: 0
          }
        }));
      });

      // Use Promise.allSettled for better parallel processing and error resilience
      const roleSettledResults = await Promise.allSettled(rolePromises);
      const roleOutputs = roleSettledResults.map(result =>
        result.status === 'fulfilled' ? result.value : {
          role: 'unknown',
          content: `**Error**: ${result.reason?.message || 'Unknown error'}`,
          status: 'rejected',
          model: 'unknown',
          provider: 'unknown',
          wordCount: 0,
          responseTime: 0,
          confidence: 0,
          error: result.reason?.message || 'Unknown error',
          metadata: {
            confidenceLevel: 'error',
            modelReliability: 0
          }
        }
      );
      
      // Log results with fallback indicators
      roleOutputs.forEach(output => {
        const status = output.status === 'fulfilled' ? '✅' : '❌';
        const fallbackIndicator = output.isFallback ? ' (FALLBACK)' : '';
        const providerInfo = output.isFallback ?
          `${output.originalProvider}→${output.fallbackProvider}` :
          output.provider;
        console.log(`${status} [${correlationId}] ${output.role} (${providerInfo})${fallbackIndicator}: ${output.content.substring(0, 50)}...`);
      });

      // Step 4: Enhanced synthesis with conflict resolution and validation
      const synthesisResult = await enhancedSynthesisService.synthesizeWithEnhancements(
        roleOutputs,
        userPrompt,
        correlationId,
        {}, // Empty voting result - voting happens after ensemble in health route
        userId,
        sessionId
      );

      // Step 5: Calculate metrics using enhanced synthesis validation
      const processingTime = Date.now() - startTime;
      const successfulRoles = roleOutputs.filter(r => r.status === 'fulfilled').length;

      // Use enhanced synthesis validation quality score if available, otherwise fallback to legacy calculation
      const responseQuality = synthesisResult.validation?.overallQuality ||
        this.calculateResponseQuality(
          synthesisResult.content,
          processingTime,
          roleOutputs.length - successfulRoles,
          true
        );

      // Step 6: Track synthesis quality metrics
      monitoringService.trackSynthesisQuality(
        synthesisResult,
        synthesisResult.validation,
        synthesisResult.processingTime || 0
      );

      // Step 7: Store memories asynchronously
      this.storeMemoriesAsync(userId, sessionId, userPrompt, synthesisResult.content, responseQuality, correlationId);

      // Update success metrics
      this.metrics.successfulRequests++;
      this.updateAverageProcessingTime(processingTime);

      console.log(`🎉 [${correlationId}] Ensemble completed in ${processingTime}ms`);

      // Build decision trace for explainability
      const decisionTrace = this.buildDecisionTrace(roleOutputs, synthesisResult, contextResult, correlationId);

      // Prepare final response with enhanced synthesis metadata
      const finalResponse = {
        synthesis: synthesisResult,
        roles: roleOutputs,
        metadata: {
          totalRoles: roleOutputs.length,
          successfulRoles,
          failedRoles: roleOutputs.length - successfulRoles,
          synthesisStatus: synthesisResult.status,
          sessionId,
          memoryContextUsed,
          responseQuality,
          correlationId,
          contextOptimization: {
            tokensUsed: contextResult.totalTokens,
            tokensAvailable: this.config.memoryContextTokens,
            efficiency: contextResult.optimization?.efficiency || 0,
            sectionsIncluded: contextResult.optimization?.sectionsIncluded || 0,
            hierarchicalContext: !!contextResult.structure
          },
          decisionTrace,
          // Enhanced synthesis metadata
          enhancedSynthesis: {
            conflictResolution: synthesisResult.conflictResolution || false,
            contextIntegration: synthesisResult.contextIntegration || false,
            validationPassed: synthesisResult.validation?.passesThreshold || false,
            qualityLevel: synthesisResult.validation?.qualityLevel || 'unknown',
            regenerated: synthesisResult.regenerated || false,
            processingTime: synthesisResult.processingTime || 0
          }
        }
      };

      // Cache successful responses for future use
      if (synthesisResult.status === 'success' && responseQuality > 0.6) {
        try {
          await cacheService.cacheEnsembleResponse(userPrompt, userId, meta.tier, finalResponse);
          console.log(`💾 [${correlationId}] Response cached successfully`);
        } catch (cacheError) {
          console.warn(`⚠️ [${correlationId}] Failed to cache response:`, cacheError.message);
        }
      }

      // Store ensemble result in hierarchical memory for future context
      if (synthesisResult.status === 'success' && responseQuality > 0.5) {
        try {
          await getHierarchicalContextManager().storeEnsembleResult(
            userId,
            sessionId,
            userPrompt,
            synthesisResult,
            roleOutputs
          );
          console.log(`🧠 [${correlationId}] Ensemble result stored in hierarchical memory`);
        } catch (memoryError) {
          console.warn(`⚠️ [${correlationId}] Failed to store in hierarchical memory:`, memoryError.message);
        }
      }

      return finalResponse;

    } catch (error) {
      this.metrics.failedRequests++;
      console.error(`❌ [${correlationId}] Ensemble failed:`, error.message);
      
      return this.createErrorResponse(error, correlationId, sessionId, Date.now() - startTime);
    } finally {
      this.metrics.concurrentRequests--;
    }
  }

  async synthesizeResponse(roleOutputs, userPrompt, correlationId, votingResult = {}) {
    const startTime = Date.now();

    try {
      console.log(`🔄 [${correlationId}] Starting optimized synthesis with intelligent processing...`);

      // Get optimal synthesizer model (fine-tuned if available)
      const synthesizerConfig = this.getOptimalModelConfig('ensemble_synthesis', 'free');

      // Filter and rank successful responses
      const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled');

      // Calculate enhanced metrics for intelligent synthesis (using calibrated_confidence instead of deprecated qualityScore)
      const rankedOutputs = await Promise.all(
        successfulOutputs.map(async output => ({
          ...output,
          calibrated_confidence: output.semanticConfidence?.calibratedConfidence || output.confidence?.score || 0.5,
          wordCount: output.content.split(' ').length,
          uniqueness: await this.calculateUniqueness(output.content, successfulOutputs)
        }))
      );
      rankedOutputs.sort((a, b) => b.calibrated_confidence - a.calibrated_confidence);

      console.log(`📊 [${correlationId}] Processing ${successfulOutputs.length} responses with quality ranking`);

      const modelNames = {
        gpt4o: meta.tier === 'premium' ? 'GPT-4o' : 'GPT-4o-mini',
        gemini: 'Gemini 2.5 Flash',
        claude: 'Claude 3.5 Haiku',
        xai: 'Grok Beta'
      };

      // Enhanced synthesis strategy with tie-breaking detection
      let synthPayload;
      let synthesisStrategy;

      // Check if tie-breaking is needed (passed from voting system)
      const tieBreaking = votingResult?.tieBreaking || false;
      const weightDifference = votingResult?.weightDifference || 1.0;

      if (tieBreaking && rankedOutputs.length >= 2) {
        // Force comparative synthesis for tie-breaking regardless of count
        synthesisStrategy = 'comparative-tiebreaker';
        const topTwoResponses = rankedOutputs.slice(0, 2);

        synthPayload = `User Question: "${userPrompt}"

🔄 TIE-BREAKING SYNTHESIS REQUIRED 🔄
Weight difference: ${(weightDifference * 100).toFixed(1)}% (< 5% threshold)

Two closely-matched AI responses requiring careful comparative analysis:

### Response A: ${modelNames[topTwoResponses[0].role] || topTwoResponses[0].role} (Weight: ${(votingResult.weights[topTwoResponses[0].role] * 100).toFixed(1)}%)
${topTwoResponses[0].content}

### Response B: ${modelNames[topTwoResponses[1].role] || topTwoResponses[1].role} (Weight: ${(votingResult.weights[topTwoResponses[1].role] * 100).toFixed(1)}%)
${topTwoResponses[1].content}

CRITICAL: These responses have nearly equal reliability weights. Perform detailed comparative analysis to identify the most accurate, complete, and helpful elements from each. Synthesize a superior response that leverages the best aspects of both while resolving any contradictions or gaps.`;

      } else if (rankedOutputs.length >= 3) {
        // Multi-response synthesis with quality weighting
        synthesisStrategy = 'comprehensive';
        const topResponses = rankedOutputs.slice(0, 3); // Use top 3 responses

        synthPayload = `User Question: "${userPrompt}"

High-quality AI responses to synthesize (ranked by quality):

${topResponses
  .map((output, index) => `### Response ${index + 1}: ${modelNames[output.role] || output.role} (Confidence: ${output.calibrated_confidence.toFixed(2)})
${output.content}`)
  .join('\n\n')}

Synthesize these responses into a comprehensive, well-structured answer that combines the best insights from each response. Focus on accuracy, completeness, and clarity.`;

      } else if (rankedOutputs.length === 2) {
        // Dual response synthesis
        synthesisStrategy = 'comparative';
        synthPayload = `User Question: "${userPrompt}"

Two AI responses to synthesize:

### Primary Response: ${modelNames[rankedOutputs[0].role] || rankedOutputs[0].role}
${rankedOutputs[0].content}

### Secondary Response: ${modelNames[rankedOutputs[1].role] || rankedOutputs[1].role}
${rankedOutputs[1].content}

Synthesize these responses by combining their strengths and resolving any differences. Prioritize the higher-quality insights.`;

      } else if (rankedOutputs.length === 1) {
        // Single response enhancement
        synthesisStrategy = 'enhancement';
        const response = rankedOutputs[0];

        if (response.calibrated_confidence > 0.7) {
          // High quality - minimal processing
          synthPayload = `User Question: "${userPrompt}"

High-quality AI Response:
${response.content}

Please review and lightly enhance this response for clarity and completeness while preserving its quality.`;
        } else {
          // Lower quality - more substantial improvement
          synthPayload = `User Question: "${userPrompt}"

AI Response to improve:
${response.content}

Please significantly improve this response by enhancing clarity, accuracy, and completeness while addressing the user's question thoroughly.`;
        }
      } else {
        // No successful responses - fallback
        synthesisStrategy = 'fallback';
        synthPayload = `User Question: "${userPrompt}"

No AI responses were available. Please provide a helpful, informative response to this question based on your knowledge, and include a note that our AI ensemble is temporarily experiencing issues.`;
      }

      // Optimize token usage and temperature based on synthesis strategy using new formulas
      const maxTokens = this.calculateOptimalTokens(synthesisStrategy, rankedOutputs.length, votingResult);
      const temperature = this.calculateOptimalTemperature(synthesisStrategy, synthesizerConfig.isFineTuned, {
        ...votingResult,
        responseCount: rankedOutputs.length,
        fallbackUsed: rankedOutputs.some(r => r.isFallback)
      });

      // Enhanced synthesis with optimized parameters
      const synthResponse = await Promise.race([
        clients.openai.chat.completions.create({
          model: synthesizerConfig.model,
          messages: [
            {
              role: 'system',
              content: this.getOptimizedSystemPrompt(synthesisStrategy, systemPrompts.synthesizer)
            },
            { role: 'user', content: synthPayload }
          ],
          max_tokens: maxTokens,
          temperature: temperature,
          presence_penalty: 0.1, // Encourage diverse vocabulary
          frequency_penalty: 0.1, // Reduce repetition
          top_p: 0.9 // Nucleus sampling for better quality
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Synthesis timeout')), this.config.timeoutMs)
        )
      ]);

      console.log(`✅ [${correlationId}] Synthesis completed successfully`);

      const responseTime = Date.now() - startTime;
      const responseContent = synthResponse.choices[0].message.content;
      const quality = this.calculateResponseQuality(responseContent, responseTime, 0, true);

      // Log synthesis performance for monitoring
      console.log(`🎭 Synthesis: ${synthesizerConfig.model} - ${responseTime}ms, Quality: ${quality.toFixed(2)}`);

      return {
        content: responseContent,
        model: synthesizerConfig.model,
        provider: synthesizerConfig.provider,
        status: 'success',
        isFineTuned: synthesizerConfig.isFineTuned,
        synthesisStrategy: 'simple',
        overallConfidence: 0.8
      };

    } catch (error) {
      console.error(`❌ [${correlationId}] Synthesis failed:`, error.message);
      
      // Fallback: return best available response
      const successfulRoles = roleOutputs.filter(r => r.status === 'fulfilled');
      const fallbackContent = successfulRoles.length > 0 ?
        `Based on available responses:\n\n${successfulRoles.map(r => r.content).join('\n\n')}` :
        'Unable to generate response due to service issues. Please try again.';
      
      return {
        content: fallbackContent,
        model: models.synthesizer.model,
        provider: models.synthesizer.provider,
        status: 'failed',
        error: error.message
      };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  calculateResponseQuality(result, executionTime, errorCount, ensembleMode) {
    let quality = 0.5;
    
    if (executionTime < 5000) quality += 0.2;
    else if (executionTime < 10000) quality += 0.1;
    else if (executionTime > 20000) quality -= 0.1;
    
    if (errorCount === 0) quality += 0.2;
    else quality -= (errorCount * 0.1);
    
    if (ensembleMode) quality += 0.1;
    
    if (result && result.length > 50 && result.length < 2000) {
      quality += 0.1;
    }
    
    return Math.max(0, Math.min(1, quality));
  }

  updateAverageProcessingTime(processingTime) {
    const totalSuccessful = this.metrics.successfulRequests;
    this.metrics.averageProcessingTime =
      ((this.metrics.averageProcessingTime * (totalSuccessful - 1)) + processingTime) / totalSuccessful;
  }

  // Note: calculateResponseQualityScore function removed as deprecated
  // Now using calibrated_confidence from semantic confidence service instead

  /**
   * Calculate uniqueness of response compared to others using embedding-based similarity
   */
  async calculateUniqueness(content, allOutputs) {
    if (allOutputs.length <= 1) return 1.0;

    try {
      // Use semantic confidence service for embedding-based uniqueness
      const semanticConfidenceService = require('./semanticConfidenceService');
      return await semanticConfidenceService.calculateEmbeddingUniqueness(content, allOutputs);
    } catch (error) {
      console.warn('Embedding-based uniqueness calculation failed, falling back to Jaccard:', error.message);

      // Fallback to original Jaccard similarity method
      const words = new Set(content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
      let totalOverlap = 0;
      let comparisons = 0;

      allOutputs.forEach(other => {
        if (other.content !== content) {
          const otherWords = new Set(other.content.toLowerCase().split(/\W+/).filter(w => w.length > 3));
          const intersection = new Set([...words].filter(x => otherWords.has(x)));
          const union = new Set([...words, ...otherWords]);

          if (union.size > 0) {
            totalOverlap += intersection.size / union.size;
            comparisons++;
          }
        }
      });

      const averageOverlap = comparisons > 0 ? totalOverlap / comparisons : 0;
      return Math.max(0, 1 - averageOverlap); // Higher uniqueness = lower overlap
    }
  }

  /**
   * Calculate optimal token count based on synthesis strategy using new allocation formula
   * Formula: alloc = min(700, 200 + 200 × successful_roles + 50 × comparative_pairs)
   */
  calculateOptimalTokens(strategy, responseCount, votingResult = {}) {
    const successful_roles = responseCount || 0;
    const comparative_pairs = this.getComparativePairs(strategy, successful_roles);

    // Apply the new token allocation formula
    const calculatedAlloc = Math.min(700, 200 + 200 * successful_roles + 50 * comparative_pairs);

    // Cap to user tier max (from config)
    const tierMaxTokens = this.config.synthesisMaxTokens || 500;
    const finalAllocation = Math.min(calculatedAlloc, tierMaxTokens);

    console.log(`🎯 Token allocation: ${finalAllocation} (formula: ${calculatedAlloc}, tier cap: ${tierMaxTokens}, roles: ${successful_roles}, pairs: ${comparative_pairs})`);

    return finalAllocation;
  }

  /**
   * Calculate comparative pairs based on synthesis strategy
   */
  getComparativePairs(strategy, responseCount) {
    switch (strategy) {
      case 'comparative':
      case 'comparative-tiebreaker':
        return Math.floor(responseCount / 2); // Pairs for comparison
      case 'comprehensive':
        return Math.max(1, responseCount - 1); // All responses compared to primary
      default:
        return 0; // No comparative analysis
    }
  }

  /**
   * Calculate optimal temperature using new temperature curve formula
   * Formula: temp = base_temp + 0.15 × (comparative_pairs > 0) − 0.1 × (fallback_mode)
   */
  calculateOptimalTemperature(strategy, isFineTuned, votingResult = {}) {
    const base_temp = isFineTuned ? 0.4 : 0.6;

    // Determine if we have comparative pairs
    const comparative_pairs = this.getComparativePairs(strategy, votingResult.responseCount || 0);
    const has_comparative_pairs = comparative_pairs > 0 ? 1 : 0;

    // Determine if we're in fallback mode
    const fallback_mode = (strategy === 'fallback' || votingResult.fallbackUsed) ? 1 : 0;

    // Apply the new temperature curve formula
    const calculatedTemp = base_temp + 0.15 * has_comparative_pairs - 0.1 * fallback_mode;

    // Ensure temperature stays within reasonable bounds [0.1, 1.0]
    const finalTemp = Math.min(1.0, Math.max(0.1, calculatedTemp));

    console.log(`🌡️ Temperature: ${finalTemp.toFixed(3)} (base: ${base_temp}, comparative: ${has_comparative_pairs}, fallback: ${fallback_mode})`);

    return finalTemp;
  }

  /**
   * Get optimized system prompt based on synthesis strategy
   */
  getOptimizedSystemPrompt(strategy, basePrompt) {
    const strategyPrompts = {
      comprehensive: `${basePrompt}\n\nFocus on creating a comprehensive synthesis that combines the best insights from multiple high-quality responses. Prioritize accuracy, completeness, and logical flow.`,

      comparative: `${basePrompt}\n\nYou are synthesizing two responses. Compare their strengths, resolve differences intelligently, and create a balanced, well-reasoned answer.`,

      'comparative-tiebreaker': `${basePrompt}\n\nCRITICAL TIE-BREAKING SYNTHESIS: You are analyzing two responses with nearly identical reliability weights (< 5% difference). Perform meticulous comparative analysis to identify the most accurate, complete, and helpful elements. Your synthesis must leverage the superior aspects of both responses while resolving contradictions. This is a high-stakes decision requiring exceptional analytical precision.`,

      enhancement: `${basePrompt}\n\nYou are enhancing a single response. Improve clarity, add relevant details, and ensure the response fully addresses the user's question while maintaining the original insights.`,

      fallback: `${basePrompt}\n\nProvide a helpful, informative response based on your knowledge. Be thorough and accurate, and briefly mention that our AI ensemble is temporarily experiencing issues.`
    };

    return strategyPrompts[strategy] || basePrompt;
  }

  /**
   * Build comprehensive decision trace for explainability
   */
  buildDecisionTrace(roleOutputs, synthesisResult, contextResult, correlationId) {
    const trace = {
      timestamp: new Date().toISOString(),
      correlationId,
      steps: []
    };

    // Step 1: Context Building
    trace.steps.push({
      step: 'context_building',
      description: 'Retrieved and optimized conversation context',
      details: {
        contextTokens: contextResult.totalTokens || 0,
        contextSections: contextResult.optimization?.sectionsIncluded || 0,
        hierarchicalContext: !!contextResult.structure,
        efficiency: contextResult.optimization?.efficiency || 0
      },
      outcome: contextResult.context ? 'success' : 'no_context'
    });

    // Step 2: Model Selection and Execution
    trace.steps.push({
      step: 'model_execution',
      description: 'Executed parallel queries to AI models',
      details: {
        modelsAttempted: ['gpt4o', 'gemini', 'claude'],
        modelsSuccessful: roleOutputs.filter(r => r.status === 'fulfilled').map(r => r.role),
        modelsFailed: roleOutputs.filter(r => r.status === 'rejected').map(r => r.role),
        averageResponseTime: Math.round(roleOutputs.reduce((sum, r) => sum + (r.responseTime || 0), 0) / roleOutputs.length),
        rawResponseSnippets: roleOutputs.map(r => ({
          role: r.role,
          snippet: r.content ? r.content.substring(0, 100) + '...' : 'Error',
          wordCount: r.wordCount || 0,
          confidence: r.confidence || 0
        }))
      },
      outcome: roleOutputs.filter(r => r.status === 'fulfilled').length > 0 ? 'success' : 'failure'
    });

    // Step 3: Confidence Calculation
    const confidenceDetails = this.buildConfidenceTrace(roleOutputs);
    trace.steps.push({
      step: 'confidence_calculation',
      description: 'Calculated confidence scores for each response',
      details: confidenceDetails,
      outcome: 'completed'
    });

    // Step 4: Voting and Weight Assignment
    const votingDetails = this.buildVotingTrace(roleOutputs);
    trace.steps.push({
      step: 'voting_weights',
      description: 'Applied weighted voting algorithm',
      details: votingDetails,
      outcome: 'completed'
    });

    // Step 5: Synthesis Strategy Selection
    trace.steps.push({
      step: 'synthesis_strategy',
      description: 'Selected synthesis approach based on response analysis',
      details: {
        strategy: synthesisResult.strategy || 'unknown',
        rationale: this.getSynthesisRationale(synthesisResult.strategy, roleOutputs),
        inputTokens: synthesisResult.metadata?.inputTokens || 0,
        outputTokens: synthesisResult.metadata?.outputTokens || 0
      },
      outcome: synthesisResult.status || 'unknown'
    });

    return trace;
  }

  /**
   * Build confidence calculation trace
   */
  buildConfidenceTrace(roleOutputs) {
    return {
      method: 'multi_factor_analysis',
      factors: ['response_length', 'processing_time', 'model_reliability'],
      scores: roleOutputs.map(output => ({
        role: output.role,
        confidence: output.confidence || 0,
        factors: {
          lengthScore: this.calculateLengthScore(output.wordCount || 0),
          timeScore: this.calculateTimeScore(output.responseTime || 0),
          reliabilityScore: output.metadata?.modelReliability || 0.8
        }
      }))
    };
  }

  /**
   * Build voting trace
   */
  buildVotingTrace(roleOutputs) {
    const totalConfidence = roleOutputs.reduce((sum, r) => sum + (r.confidence || 0), 0);

    return {
      algorithm: 'confidence_weighted',
      weights: roleOutputs.map(output => ({
        role: output.role,
        confidence: output.confidence || 0,
        weight: totalConfidence > 0 ? ((output.confidence || 0) / totalConfidence) : 0,
        normalizedWeight: totalConfidence > 0 ? `${(((output.confidence || 0) / totalConfidence) * 100).toFixed(1)}%` : '0%'
      })),
      winner: roleOutputs.reduce((best, current) =>
        (current.confidence || 0) > (best.confidence || 0) ? current : best,
        roleOutputs[0] || {}
      ).role
    };
  }

  /**
   * Get synthesis rationale based on strategy
   */
  getSynthesisRationale(strategy, roleOutputs) {
    const successfulRoles = roleOutputs.filter(r => r.status === 'fulfilled').length;

    switch (strategy) {
      case 'best_response':
        return `Selected highest confidence response (${successfulRoles} successful responses)`;
      case 'consensus':
        return `Combined insights from ${successfulRoles} models for comprehensive answer`;
      case 'comparative':
        return `Analyzed differences between ${successfulRoles} responses for balanced synthesis`;
      case 'fallback':
        return `Used fallback strategy due to insufficient successful responses`;
      default:
        return `Applied ${strategy || 'default'} synthesis strategy`;
    }
  }

  /**
   * Calculate length-based confidence score
   */
  calculateLengthScore(wordCount) {
    if (wordCount < 10) return 0.2;
    if (wordCount < 50) return 0.6;
    if (wordCount < 200) return 1.0;
    if (wordCount < 500) return 0.9;
    return 0.7; // Very long responses might be less focused
  }

  /**
   * Calculate time-based confidence score
   */
  calculateTimeScore(responseTime) {
    if (responseTime < 1000) return 0.7; // Too fast might be cached/simple
    if (responseTime < 5000) return 1.0; // Optimal range
    if (responseTime < 10000) return 0.8; // Acceptable
    return 0.5; // Too slow might indicate issues
  }

  createErrorResponse(error, correlationId, sessionId, processingTime) {
    return {
      synthesis: {
        content: 'Ensemble processing failed due to system issues. Please try again.',
        model: models.synthesizer.model,
        provider: models.synthesizer.provider,
        status: 'failed',
        error: error.message
      },
      roles: [],
      metadata: {
        totalRoles: 0,
        successfulRoles: 0,
        failedRoles: 3,
        synthesisStatus: 'failed',
        sessionId,
        memoryContextUsed: false,
        responseQuality: 0,
        correlationId,
        error: error.message
      }
    };
  }

  storeMemoriesAsync(userId, sessionId, userPrompt, synthesisContent, responseQuality, correlationId) {
    setImmediate(async () => {
      try {
        await Promise.all([
          this.getMemoryManager().storeMemory(
            userId, sessionId, userPrompt, true, responseQuality, 'ensemble', true
          ),
          this.getMemoryManager().storeMemory(
            userId, sessionId, synthesisContent, false, responseQuality, models.synthesizer.model, true
          )
        ]);
        console.log(`💾 [${correlationId}] Memories stored successfully`);
      } catch (error) {
        console.error(`❌ [${correlationId}] Memory storage failed:`, error.message);
      }
    });
  }

  startMetricsCollection() {
    setInterval(() => {
      console.log('📊 Enhanced Ensemble Metrics:', {
        totalRequests: this.metrics.totalRequests,
        successRate: `${((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(1)}%`,
        avgProcessingTime: `${Math.round(this.metrics.averageProcessingTime)}ms`,
        concurrentRequests: this.metrics.concurrentRequests,
        maxConcurrentRequests: this.metrics.maxConcurrentRequests
      });
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Update metrics for tracking performance
   */
  updateMetrics(type, value) {
    try {
      if (!this.metrics) {
        this.metrics = {
          cacheHits: 0,
          cacheMisses: 0,
          totalRequests: 0,
          successfulRequests: 0,
          averageProcessingTime: 0,
          concurrentRequests: 0,
          maxConcurrentRequests: 0,
          responseTimes: []
        };
      }

      switch (type) {
        case 'cache_hit':
          this.metrics.cacheHits++;
          break;
        case 'cache_miss':
          this.metrics.cacheMisses++;
          break;
        case 'response_time':
          this.metrics.responseTimes.push(value);
          if (this.metrics.responseTimes.length > 100) {
            this.metrics.responseTimes.shift();
          }
          this.metrics.averageProcessingTime =
            this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
          break;
        case 'request':
          this.metrics.totalRequests++;
          break;
        case 'success':
          this.metrics.successfulRequests++;
          break;
      }
    } catch (error) {
      console.warn('⚠️ Failed to update metrics:', error.message);
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 ? 
        (this.metrics.successfulRequests / this.metrics.totalRequests) : 0
    };
  }

  async healthCheck() {
    const vendorHealth = await clients.healthCheck();
    const memoryHealth = await this.getMemoryManager().testFirestoreConnection();
    
    return {
      ensemble: {
        isHealthy: true,
        metrics: this.getMetrics()
      },
      vendors: vendorHealth,
      memory: {
        isHealthy: this.getMemoryManager().isFirestoreAvailable
      }
    };
  }

  /**
   * Calculate simple confidence score based on response content and timing
   */
  calculateSimpleConfidence(content, responseTime) {
    let confidence = 0.5; // Base confidence

    // Length factor
    const wordCount = content.split(' ').length;
    if (wordCount >= 20 && wordCount <= 200) confidence += 0.2;
    else if (wordCount > 200) confidence += 0.1;

    // Structure factor
    if (/[.!?]/.test(content)) confidence += 0.1;
    if (/^[A-Z]/.test(content)) confidence += 0.1;

    // Response time factor
    if (responseTime < 5000) confidence += 0.1;
    else if (responseTime > 15000) confidence -= 0.1;

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Get simple confidence level description
   */
  getSimpleConfidenceLevel(score) {
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    if (score >= 0.4) return 'low';
    return 'very-low';
  }
}

module.exports = new EnhancedEnsembleRunner();
