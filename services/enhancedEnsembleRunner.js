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

    // Enhanced configuration for production deployment with 25+ concurrent users
    this.config = {
      maxConcurrentRequests: meta.tier === 'free' ? 25 : 50, // Increased for production load
      timeoutMs: limits.timeoutMs || 30000, // Increased timeout for stability (30 seconds)
      retryAttempts: meta.tier === 'free' ? 2 : 3, // More retries for resilience
      retryDelayMs: 1000, // How long to wait between retries (1 second)
      memoryContextTokens: Math.floor(limits.maxTokensPerRole * 0.6) || 1500, // How much conversation history to include
      synthesisMaxTokens: limits.maxSynthesisTokens || 400, // Maximum length for the final combined answer
      maxPromptLength: limits.maxPromptLength || 5000, // Maximum length for user questions
      requestsPerHour: limits.requestsPerHour || 500, // Increased rate limits for production
      requestsPerDay: limits.requestsPerDay || 5000, // Increased daily limits

      // New production-grade settings
      connectionPoolSize: 10, // Connection pool for API clients
      queueMaxSize: 100, // Maximum queue size before rejecting requests
      priorityLevels: 3, // Number of priority levels for request queuing
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
        
        const result = await clients.executeWithCircuitBreaker(provider, async () => {
          return await this.executeRoleCall(role, userPrompt, provider, model);
        });
        
        console.log(`✅ [${correlationId}] ${role} completed successfully`);
        return result;
        
      } catch (error) {
        console.warn(`⚠️ [${correlationId}] ${role} attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
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
        break;

      case 'gemini':
        const geminiResponse = await clients.gemini.post(
          `/models/${model}:generateContent`,
          {
            contents: [{
              parts: [{
                text: `${systemPrompts[role]}\n\nUser: ${userPrompt}`
              }]
            }],
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature: 0.7
            }
          }
        );
        response = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
        actualResponseTokens = geminiResponse.data.usageMetadata?.candidatesTokenCount || Math.ceil(response.length / 4);
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

    // Log API call performance for monitoring
    console.log(`🤖 API Call: ${model} - ${responseTime}ms, Quality: ${quality.toFixed(2)}, Tokens: ${actualResponseTokens}`);

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

      const roleOutputs = await Promise.all(rolePromises);
      
      // Log results
      roleOutputs.forEach(output => {
        const status = output.status === 'fulfilled' ? '✅' : '❌';
        console.log(`${status} [${correlationId}] ${output.role}: ${output.content.substring(0, 50)}...`);
      });

      // Step 4: Synthesize response with fallback handling
      const synthesisResult = await this.synthesizeResponse(roleOutputs, userPrompt, correlationId);

      // Step 5: Calculate metrics
      const processingTime = Date.now() - startTime;
      const successfulRoles = roleOutputs.filter(r => r.status === 'fulfilled').length;
      const responseQuality = this.calculateResponseQuality(
        synthesisResult.content, 
        processingTime, 
        roleOutputs.length - successfulRoles, 
        true
      );

      // Step 6: Store memories asynchronously
      this.storeMemoriesAsync(userId, sessionId, userPrompt, synthesisResult.content, responseQuality, correlationId);

      // Update success metrics
      this.metrics.successfulRequests++;
      this.updateAverageProcessingTime(processingTime);

      console.log(`🎉 [${correlationId}] Ensemble completed in ${processingTime}ms`);

      // Prepare final response
      const finalResponse = {
        synthesis: synthesisResult,
        roles: roleOutputs,
        metadata: {
          totalRoles: roleOutputs.length,
          successfulRoles,
          failedRoles: roleOutputs.length - successfulRoles,
          synthesisStatus: synthesisResult.status,
          processingTimeMs: processingTime,
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

      return finalResponse;

    } catch (error) {
      this.metrics.failedRequests++;
      console.error(`❌ [${correlationId}] Ensemble failed:`, error.message);
      
      return this.createErrorResponse(error, correlationId, sessionId, Date.now() - startTime);
    } finally {
      this.metrics.concurrentRequests--;
    }
  }

  async synthesizeResponse(roleOutputs, userPrompt, correlationId) {
    const startTime = Date.now();

    try {
      console.log(`🔄 [${correlationId}] Starting optimized synthesis with intelligent processing...`);

      // Get optimal synthesizer model (fine-tuned if available)
      const synthesizerConfig = this.getOptimalModelConfig('ensemble_synthesis', 'free');

      // Filter and rank successful responses
      const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled');

      // Calculate response quality scores for intelligent synthesis
      const rankedOutputs = successfulOutputs.map(output => ({
        ...output,
        qualityScore: this.calculateResponseQualityScore(output.content),
        wordCount: output.content.split(' ').length,
        uniqueness: this.calculateUniqueness(output.content, successfulOutputs)
      })).sort((a, b) => b.qualityScore - a.qualityScore);

      console.log(`📊 [${correlationId}] Processing ${successfulOutputs.length} responses with quality ranking`);

      const modelNames = {
        gpt4o: meta.tier === 'premium' ? 'GPT-4o' : 'GPT-4o-mini',
        gemini: 'Gemini 2.5 Flash',
        claude: 'Claude 3.5 Haiku',
        xai: 'Grok Beta'
      };

      // Optimized synthesis strategy based on response quality and count
      let synthPayload;
      let synthesisStrategy;

      if (rankedOutputs.length >= 3) {
        // Multi-response synthesis with quality weighting
        synthesisStrategy = 'comprehensive';
        const topResponses = rankedOutputs.slice(0, 3); // Use top 3 responses

        synthPayload = `User Question: "${userPrompt}"

High-quality AI responses to synthesize (ranked by quality):

${topResponses
  .map((output, index) => `### Response ${index + 1}: ${modelNames[output.role] || output.role} (Quality: ${output.qualityScore.toFixed(2)})
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

        if (response.qualityScore > 0.7) {
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

      // Optimize token usage based on synthesis strategy
      const maxTokens = this.calculateOptimalTokens(synthesisStrategy, rankedOutputs.length);
      const temperature = this.calculateOptimalTemperature(synthesisStrategy, synthesizerConfig.isFineTuned);

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

  /**
   * Calculate response quality score for synthesis optimization
   */
  calculateResponseQualityScore(content) {
    if (!content || typeof content !== 'string') return 0;

    let score = 0.3; // Base score
    const wordCount = content.split(' ').length;
    const sentenceCount = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const paragraphCount = content.split('\n\n').filter(p => p.trim().length > 0).length;

    // Length optimization (0-0.25 points)
    if (wordCount >= 50 && wordCount <= 300) score += 0.25;
    else if (wordCount >= 30 && wordCount < 50) score += 0.15;
    else if (wordCount > 300 && wordCount <= 500) score += 0.20;
    else if (wordCount > 500) score += 0.05;

    // Structure quality (0-0.2 points)
    if (sentenceCount >= 3) score += 0.1;
    if (paragraphCount >= 2) score += 0.05;
    if (/^[A-Z]/.test(content)) score += 0.02; // Proper capitalization
    if (/[.!?]$/.test(content.trim())) score += 0.03; // Proper ending

    // Content sophistication (0-0.25 points)
    const sophisticationWords = ['because', 'therefore', 'however', 'furthermore', 'consequently', 'specifically', 'particularly', 'essentially', 'ultimately'];
    const foundSophistication = sophisticationWords.filter(word => content.toLowerCase().includes(word)).length;
    score += Math.min(foundSophistication * 0.03, 0.15);

    // Technical depth (0-0.1 points)
    const technicalWords = ['analysis', 'approach', 'method', 'process', 'system', 'implementation', 'solution'];
    const foundTechnical = technicalWords.filter(word => content.toLowerCase().includes(word)).length;
    score += Math.min(foundTechnical * 0.02, 0.1);

    // Clarity indicators (0-0.1 points)
    if (content.includes(':') || content.includes('•') || content.includes('-')) score += 0.05; // Lists/structure
    if (/\d+/.test(content)) score += 0.03; // Contains numbers/data
    if (content.includes('example') || content.includes('instance')) score += 0.02; // Examples

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate uniqueness of response compared to others
   */
  calculateUniqueness(content, allOutputs) {
    if (allOutputs.length <= 1) return 1.0;

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

  /**
   * Calculate optimal token count based on synthesis strategy
   */
  calculateOptimalTokens(strategy, responseCount) {
    const baseTokens = this.config.synthesisMaxTokens || 400;

    switch (strategy) {
      case 'comprehensive':
        return Math.min(600, baseTokens * 1.5); // More tokens for complex synthesis
      case 'comparative':
        return Math.min(500, baseTokens * 1.25); // Moderate increase for comparison
      case 'enhancement':
        return Math.min(450, baseTokens * 1.1); // Slight increase for enhancement
      case 'fallback':
        return Math.min(300, baseTokens * 0.75); // Fewer tokens for fallback
      default:
        return baseTokens;
    }
  }

  /**
   * Calculate optimal temperature based on synthesis strategy
   */
  calculateOptimalTemperature(strategy, isFineTuned) {
    const baseTemp = isFineTuned ? 0.4 : 0.6;

    switch (strategy) {
      case 'comprehensive':
        return baseTemp + 0.1; // Slightly more creative for complex synthesis
      case 'comparative':
        return baseTemp; // Standard temperature for comparison
      case 'enhancement':
        return baseTemp - 0.1; // More focused for enhancement
      case 'fallback':
        return baseTemp + 0.2; // More creative for fallback responses
      default:
        return baseTemp;
    }
  }

  /**
   * Get optimized system prompt based on synthesis strategy
   */
  getOptimizedSystemPrompt(strategy, basePrompt) {
    const strategyPrompts = {
      comprehensive: `${basePrompt}\n\nFocus on creating a comprehensive synthesis that combines the best insights from multiple high-quality responses. Prioritize accuracy, completeness, and logical flow.`,

      comparative: `${basePrompt}\n\nYou are synthesizing two responses. Compare their strengths, resolve differences intelligently, and create a balanced, well-reasoned answer.`,

      enhancement: `${basePrompt}\n\nYou are enhancing a single response. Improve clarity, add relevant details, and ensure the response fully addresses the user's question while maintaining the original insights.`,

      fallback: `${basePrompt}\n\nProvide a helpful, informative response based on your knowledge. Be thorough and accurate, and briefly mention that our AI ensemble is temporarily experiencing issues.`
    };

    return strategyPrompts[strategy] || basePrompt;
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
        processingTimeMs: processingTime,
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
