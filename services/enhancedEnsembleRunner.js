const ensembleConfig = require('../config/ensemblePrompts');
const { models, systemPrompts, limits, meta } = ensembleConfig;
const clients = require('./vendorClients');
const { getMemoryManager } = require('./memoryManager');
const { v4: generateUUID } = require('uuid');
const cacheService = require('./cacheService');
const costMonitoringService = require('./costMonitoringService');
const advancedEnsembleStrategy = require('./advancedEnsembleStrategy');
const fineTunedModelService = require('./fineTunedModelService');
const { getHierarchicalContextManager } = require('./hierarchicalContextManager');

/**
 * Enhanced Ensemble Runner with improved concurrency, error handling, and monitoring
 */
class EnhancedEnsembleRunner {
  constructor() {
    this.memoryManager = null;
    this.requestQueue = [];
    this.activeRequests = new Map();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageProcessingTime: 0,
      concurrentRequests: 0,
      maxConcurrentRequests: 0
    };
    
    // Configuration based on tier
    this.config = {
      maxConcurrentRequests: meta.tier === 'free' ? 5 : 10,
      timeoutMs: limits.timeoutMs || 15000,
      retryAttempts: meta.tier === 'free' ? 1 : 2,
      retryDelayMs: 1000,
      memoryContextTokens: Math.floor(limits.maxTokensPerRole * 0.6) || 1500,
      synthesisMaxTokens: limits.maxSynthesisTokens || 400,
      maxPromptLength: limits.maxPromptLength || 5000,
      requestsPerHour: limits.requestsPerHour || 100,
      requestsPerDay: limits.requestsPerDay || 1000
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

    // Track cost and performance metrics
    const responseTime = Date.now() - startTime;
    const quality = this.calculateResponseQuality(response, responseTime, 0, false);

    try {
      await costMonitoringService.trackAPICall(
        { provider, model },
        promptTokens,
        actualResponseTokens,
        responseTime,
        quality
      );
    } catch (costError) {
      console.warn(`⚠️ Failed to track API call cost:`, costError.message);
    }

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

          // Calculate confidence score for this response
          const confidence = advancedEnsembleStrategy.calculateConfidenceScore(
            content,
            models[role].model,
            responseTime,
            { userPrompt: enhancedPrompt }
          );

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
              confidenceLevel: advancedEnsembleStrategy.getConfidenceLevel(confidence),
              modelReliability: advancedEnsembleStrategy.modelWeights.get(models[role].model)?.reliability || 0.5
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

      // Perform weighted voting on responses
      const votingResults = advancedEnsembleStrategy.performWeightedVoting(roleOutputs, { userPrompt });

      // Generate synthesis strategy
      const synthesisStrategy = advancedEnsembleStrategy.generateSynthesisStrategy(votingResults, userPrompt);

      console.log(`📊 [${correlationId}] Synthesis strategy: ${synthesisStrategy.strategy} (confidence: ${synthesisStrategy.confidence.toFixed(2)})`);

      const modelNames = {
        gpt4o: 'GPT-4o',
        gemini: 'Gemini 2.0 Flash',
        claude: 'Claude Opus'
      };

      // Build synthesis payload based on strategy
      let synthPayload;

      if (synthesisStrategy.strategy === 'consensus') {
        synthPayload = `User Question: "${userPrompt}"

High-confidence AI responses (ranked by weighted voting):

${votingResults
  .filter(r => r.confidence >= advancedEnsembleStrategy.confidenceThresholds.high)
  .map((output, index) => `### ${modelNames[output.role] || output.role} (Confidence: ${output.confidence.toFixed(2)}, Weight: ${output.weightedScore.toFixed(2)})\n${output.content}`)
  .join('\n\n')}

Please synthesize these responses, giving more weight to higher-confidence responses.`;
      } else if (synthesisStrategy.strategy === 'primary_with_support') {
        const primary = synthesisStrategy.primarySource;
        const supporting = synthesisStrategy.secondarySources;

        synthPayload = `User Question: "${userPrompt}"

Primary Response (Highest confidence: ${primary.confidence.toFixed(2)}):
### ${modelNames[primary.role] || primary.role}
${primary.content}

Supporting Responses:
${supporting
  .map(output => `### ${modelNames[output.role] || output.role} (Confidence: ${output.confidence.toFixed(2)})\n${output.content}`)
  .join('\n\n')}

Please synthesize with primary response as the foundation, incorporating relevant insights from supporting responses.`;
      } else {
        // Default synthesis for balanced or cautious strategies
        synthPayload = `User Question: "${userPrompt}"

AI Responses (ranked by confidence and model performance):

${votingResults
  .map(output => `### ${modelNames[output.role] || output.role} (Confidence: ${output.confidence.toFixed(2)}, Weight: ${output.weightedScore.toFixed(2)})\n${output.content}`)
  .join('\n\n')}

Strategy: ${synthesisStrategy.strategy}
Overall Confidence: ${synthesisStrategy.confidence.toFixed(2)}
Reasoning: ${synthesisStrategy.reasoning}

Please synthesize these responses carefully, considering the confidence levels and strategy.`;
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

      // Track synthesis cost and fine-tuned model performance
      try {
        await costMonitoringService.trackAPICall(
          { provider: synthesizerConfig.provider, model: synthesizerConfig.model },
          Math.ceil(synthPayload.length / 4),
          synthResponse.usage?.completion_tokens || Math.ceil(responseContent.length / 4),
          responseTime,
          quality
        );

        // Track fine-tuned model performance if applicable
        if (synthesizerConfig.isFineTuned) {
          await fineTunedModelService.trackModelUsage(
            synthesizerConfig.model,
            responseTime,
            quality,
            synthResponse.usage?.total_tokens * 0.000002 || 0.001, // Estimate cost
            true
          );
        }
      } catch (costError) {
        console.warn(`⚠️ Failed to track synthesis cost:`, costError.message);
      }

      return {
        content: responseContent,
        model: synthesizerConfig.model,
        provider: synthesizerConfig.provider,
        status: 'success',
        isFineTuned: synthesizerConfig.isFineTuned,
        fineTunedModelName: synthesizerConfig.fineTunedConfig?.name,
        synthesisStrategy: synthesisStrategy.strategy,
        overallConfidence: synthesisStrategy.confidence,
        votingResults: votingResults.map(r => ({
          role: r.role,
          model: r.model,
          confidence: r.confidence,
          weightedScore: r.weightedScore,
          confidenceLevel: r.metadata.confidenceLevel
        }))
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
}

module.exports = new EnhancedEnsembleRunner();
