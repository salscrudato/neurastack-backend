/**
 * Enhanced Ensemble Runner - The Brain of NeuraStack
 *
 * This service is like having multiple AI experts work together on your question.
 * Instead of asking just one AI model, we ask several different ones and then
 * combine their answers to give you the best possible response.
 *
 * Think of it like getting a second opinion from multiple doctors - each AI model
 * has different strengths, and by combining them, we get better, more reliable answers.
 *
 * What this does:
 * - Sends your question to multiple AI models (GPT, Claude, Gemini, etc.)
 * - Remembers your past conversations to give better context
 * - Combines all the AI responses into one comprehensive answer
 * - Tracks costs and performance to keep the service running efficiently
 * - Handles errors gracefully when individual AI models fail
 */

const ensembleConfig = require('../config/ensemblePrompts'); // Configuration for AI models and prompts
const { models, systemPrompts, limits, meta } = ensembleConfig; // Extract specific config parts
const clients = require('./vendorClients'); // Connects to different AI providers (OpenAI, Anthropic, etc.)
const { getMemoryManager } = require('./memoryManager'); // Manages conversation memory
const { v4: generateUUID } = require('uuid'); // Creates unique IDs for tracking requests
const cacheService = require('./cacheService'); // Stores responses for faster retrieval
const { getHierarchicalContextManager } = require('./hierarchicalContextManager'); // Organizes context for AI
/**
 * Enhanced Ensemble Runner Class
 * This is the main class that coordinates multiple AI models to work together
 */
class EnhancedEnsembleRunner {
  constructor() {
    // Initialize the memory manager (handles conversation history)
    this.memoryManager = null;

    // Queue system for managing multiple requests
    this.requestQueue = [];
    this.activeRequests = new Map();

    // Performance tracking - keeps track of how well the system is performing
    this.metrics = {
      totalRequests: 0, // How many requests we've processed
      successfulRequests: 0, // How many worked correctly
      failedRequests: 0, // How many had errors
      averageProcessingTime: 0, // How long requests typically take
      concurrentRequests: 0, // How many are running right now
      maxConcurrentRequests: 0 // The most we've handled at once
    };

    // Configuration settings - these control how the system behaves
    this.config = {
      maxConcurrentRequests: meta.tier === 'free' ? 5 : 10, // Free users get fewer simultaneous requests
      timeoutMs: limits.timeoutMs || 15000, // How long to wait before giving up (15 seconds)
      retryAttempts: meta.tier === 'free' ? 1 : 2, // How many times to retry failed requests
      retryDelayMs: 1000, // How long to wait between retries (1 second)
      memoryContextTokens: Math.floor(limits.maxTokensPerRole * 0.6) || 1500, // How much conversation history to include
      synthesisMaxTokens: limits.maxSynthesisTokens || 400, // Maximum length for the final combined answer
      maxPromptLength: limits.maxPromptLength || 5000, // Maximum length for user questions
      requestsPerHour: limits.requestsPerHour || 100, // Rate limiting - requests per hour
      requestsPerDay: limits.requestsPerDay || 1000 // Rate limiting - requests per day
    };

    // Usage tracking for rate limiting
    this.usageTracker = {
      hourlyRequests: new Map(),
      dailyRequests: new Map()
    };
    
    this.startMetricsCollection();
  }

  getMemoryManager() {
    return getMemoryManager();
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
      console.log(`🔄 [${correlationId}] Starting advanced synthesis with weighted voting...`);

      // Get optimal synthesizer model (fine-tuned if available)
      const synthesizerConfig = this.getOptimalModelConfig('ensemble_synthesis', 'free');

      // Simple synthesis approach - use successful responses
      const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled');

      console.log(`📊 [${correlationId}] Using simple synthesis with ${successfulOutputs.length} successful responses`);

      const modelNames = {
        gpt4o: 'GPT-4o',
        gemini: 'Gemini 2.0 Flash',
        claude: 'Claude Opus'
      };

      // Build synthesis payload based on strategy
      let synthPayload;

      if (successfulOutputs.length >= 2) {
        synthPayload = `User Question: "${userPrompt}"

AI responses to synthesize:

${successfulOutputs
  .map((output, index) => `### ${modelNames[output.role] || output.role}\n${output.content}`)
  .join('\n\n')}

Please synthesize these responses into a comprehensive, well-structured answer.`;
      } else if (successfulOutputs.length === 1) {
        // Single response - just clean it up
        synthPayload = `User Question: "${userPrompt}"

AI Response:
### ${modelNames[successfulOutputs[0].role] || successfulOutputs[0].role}
${successfulOutputs[0].content}

Please clean up and improve this response while maintaining its core message.`;
      } else {
        // No successful responses
        synthPayload = `User Question: "${userPrompt}"

No AI responses were available. Please provide a helpful response indicating that the service is temporarily unavailable and suggest the user try again.`;
      }

      const synthResponse = await Promise.race([
        clients.openai.chat.completions.create({
          model: synthesizerConfig.model,
          messages: [
            { role: 'system', content: systemPrompts.synthesizer },
            { role: 'user', content: synthPayload }
          ],
          max_tokens: this.config.synthesisMaxTokens,
          temperature: synthesizerConfig.isFineTuned ? 0.4 : 0.6 // Lower temperature for fine-tuned models
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
