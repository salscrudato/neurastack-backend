/**
 * 🚀 Ensemble Performance Optimizer
 * 
 * 🎯 PURPOSE: Optimize ensemble processing performance through intelligent caching,
 *            parallel processing, and response optimization strategies
 * 
 * 📋 KEY OPTIMIZATIONS:
 * 1. Parallel synthesis processing
 * 2. Intelligent response caching with similarity matching
 * 3. Voting result caching and prediction
 * 4. Model response pre-warming
 * 5. Synthesis prompt optimization
 * 6. Processing pipeline optimization
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');
const dynamicConfig = require('../config/dynamicConfig');
const {
  NeuraStackError,
  SynthesisError,
  VotingError,
  errorHandler,
  retryWithBackoff
} = require('../utils/errorHandler');

class EnsemblePerformanceOptimizer extends EventEmitter {
  constructor(cacheService, monitoringService) {
    super();
    
    this.cacheService = cacheService;
    this.monitoringService = monitoringService;
    
    // Performance metrics with error tracking
    this.metrics = {
      optimizationHits: 0,
      synthesisSpeedups: 0,
      votingSpeedups: 0,
      cacheHitRate: 0,
      averageProcessingTime: 0,
      parallelProcessingGains: 0,
      // Error handling metrics
      optimizationFailures: 0,
      parallelProcessingFailures: 0,
      fallbacksUsed: 0,
      retriesPerformed: 0,
      timeoutFailures: 0
    };
    
    // Optimization configuration - using dynamic config
    this.config = {
      enableParallelSynthesis: dynamicConfig.performance.enableParallelSynthesis,
      enableSimilarityMatching: dynamicConfig.performance.enableSimilarityMatching,
      enableVotingCache: dynamicConfig.performance.enableVotingCache,
      enablePreWarming: dynamicConfig.performance.enablePreWarming,
      similarityThreshold: dynamicConfig.performance.similarityThreshold,
      maxParallelOperations: dynamicConfig.performance.maxParallelOperations,
      synthesisTimeout: dynamicConfig.performance.synthesisTimeout,
      votingTimeout: dynamicConfig.performance.votingTimeout,
      preWarmInterval: dynamicConfig.performance.preWarmInterval
    };

    console.log('🚀 Ensemble Performance Optimizer initialized with dynamic configuration');
    console.log(`   Similarity Threshold: ${this.config.similarityThreshold}`);
    console.log(`   Synthesis Timeout: ${this.config.synthesisTimeout}ms`);
    console.log(`   Voting Timeout: ${this.config.votingTimeout}ms`);
    console.log(`   Pre-warm Interval: ${this.config.preWarmInterval}ms`);
    
    // Similarity cache for response matching
    this.similarityCache = new Map();
    this.votingCache = new Map();
    this.preWarmQueue = [];
    
    this.startPreWarming();
    console.log('🚀 Ensemble Performance Optimizer initialized');
  }

  /**
   * Optimize ensemble processing with parallel operations
   */
  async optimizeEnsembleProcessing(roleOutputs, userPrompt, correlationId, userId, sessionId) {
    const startTime = Date.now();
    
    try {
      // Check for similar cached responses first
      const cachedResult = await this.findSimilarCachedResponse(userPrompt, roleOutputs);
      if (cachedResult) {
        this.metrics.optimizationHits++;
        console.log(`⚡ [${correlationId}] Using optimized cached response`);
        return {
          ...cachedResult,
          optimized: true,
          processingTime: Date.now() - startTime
        };
      }

      // Parallel processing optimization
      const optimizedResult = await this.processInParallel(
        roleOutputs, 
        userPrompt, 
        correlationId, 
        userId, 
        sessionId
      );

      // Cache the optimized result
      await this.cacheOptimizedResult(userPrompt, roleOutputs, optimizedResult);
      
      const processingTime = Date.now() - startTime;
      this.updateMetrics('ensemble_optimization', processingTime);
      
      return {
        ...optimizedResult,
        optimized: true,
        processingTime
      };

    } catch (error) {
      console.error(`❌ [${correlationId}] Ensemble optimization failed:`, error.message);
      throw error;
    }
  }

  /**
   * Process synthesis and voting in parallel with robust error handling
   */
  async processInParallel(roleOutputs, userPrompt, correlationId, userId, sessionId) {
    const startTime = Date.now();

    try {
      this.monitoringService?.log('debug', 'Starting parallel processing', {
        operationsCount: this.calculateOperationsCount(userId, sessionId),
        correlationId
      }, correlationId);

      const operations = [];
      const operationNames = [];

      // Operation 1: Optimized synthesis (always included)
      operations.push(
        this.executeWithRetry(
          'synthesis',
          () => this.optimizedSynthesis(roleOutputs, userPrompt, correlationId, userId, sessionId),
          correlationId
        )
      );
      operationNames.push('synthesis');

      // Operation 2: Cached or optimized voting
      operations.push(
        this.executeWithRetry(
          'voting',
          () => this.optimizedVoting(roleOutputs, userPrompt, correlationId),
          correlationId
        )
      );
      operationNames.push('voting');

      // Operation 3: Context preparation (if needed)
      if (userId && sessionId) {
        operations.push(
          this.executeWithRetry(
            'context',
            () => this.prepareOptimizedContext(userId, sessionId),
            correlationId
          )
        );
        operationNames.push('context');
      }

      // Execute all operations in parallel with enhanced timeout handling
      const results = await Promise.allSettled(
        operations.map((op, index) =>
          Promise.race([
            op,
            new Promise((_, reject) =>
              setTimeout(() => {
                this.metrics.timeoutFailures++;
                reject(new Error(`${operationNames[index]} operation timeout after ${this.config.synthesisTimeout}ms`));
              }, this.config.synthesisTimeout)
            )
          ])
        )
      );

      // Process results with detailed error tracking
      const synthesisResult = this.processOperationResult(results[0], 'synthesis', correlationId);
      const votingResult = this.processOperationResult(results[1], 'voting', correlationId);
      const contextResult = this.processOperationResult(results[2], 'context', correlationId);

      // Check for critical failures
      if (!synthesisResult) {
        this.metrics.parallelProcessingFailures++;

        // Try fallback synthesis
        const fallbackSynthesis = await this.createFallbackSynthesis(roleOutputs, userPrompt, correlationId);

        this.monitoringService?.log('warn', 'Using fallback synthesis due to parallel processing failure', {
          correlationId,
          fallbackUsed: true
        }, correlationId);

        this.metrics.fallbacksUsed++;

        return {
          synthesis: fallbackSynthesis,
          voting: votingResult,
          context: contextResult,
          parallelProcessed: true,
          fallbackUsed: true,
          processingTime: Date.now() - startTime
        };
      }

      // Success metrics
      this.metrics.parallelProcessingGains++;

      const processingTime = Date.now() - startTime;
      this.monitoringService?.log('debug', 'Parallel processing completed successfully', {
        processingTime: `${processingTime}ms`,
        synthesisStatus: synthesisResult?.status || 'unknown',
        votingStatus: votingResult?.status || 'skipped',
        contextStatus: contextResult?.status || 'skipped',
        correlationId
      }, correlationId);

      return {
        synthesis: synthesisResult,
        voting: votingResult,
        context: contextResult,
        parallelProcessed: true,
        processingTime
      };

    } catch (error) {
      this.metrics.parallelProcessingFailures++;

      this.monitoringService?.log('error', 'Parallel processing failed completely', {
        error: error.message,
        processingTime: `${Date.now() - startTime}ms`,
        correlationId
      }, correlationId);

      // Return fallback result
      const fallbackSynthesis = await this.createFallbackSynthesis(roleOutputs, userPrompt, correlationId);
      this.metrics.fallbacksUsed++;

      return {
        synthesis: fallbackSynthesis,
        voting: null,
        context: null,
        parallelProcessed: false,
        fallbackUsed: true,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry(operationName, operation, correlationId) {
    return await retryWithBackoff(operation, {
      maxAttempts: 2, // Limited retries for performance optimization
      baseDelayMs: 200,
      maxDelayMs: 1000,
      onRetry: (error, attempt, delay) => {
        this.metrics.retriesPerformed++;
        this.monitoringService?.log('warn', `Performance optimization retry: ${operationName}`, {
          attempt,
          error: error.message,
          delay: `${delay}ms`,
          correlationId
        }, correlationId);
      }
    });
  }

  /**
   * Process individual operation result
   */
  processOperationResult(result, operationName, correlationId) {
    if (!result) return null;

    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      this.monitoringService?.log('warn', `Parallel operation failed: ${operationName}`, {
        error: result.reason?.message || 'Unknown error',
        correlationId
      }, correlationId);

      this.metrics.optimizationFailures++;
      return null;
    }
  }

  /**
   * Calculate number of operations for logging
   */
  calculateOperationsCount(userId, sessionId) {
    let count = 2; // synthesis and voting always included
    if (userId && sessionId) count++; // context preparation
    return count;
  }

  /**
   * Create fallback synthesis when optimization fails
   */
  async createFallbackSynthesis(roleOutputs, userPrompt, correlationId) {
    try {
      const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled' && r.content);

      if (successfulOutputs.length === 0) {
        return {
          content: 'Unable to provide optimized response due to technical difficulties.',
          model: 'fallback',
          status: 'fallback',
          optimized: false
        };
      }

      // Simple synthesis fallback
      const content = successfulOutputs.length === 1
        ? successfulOutputs[0].content
        : `Combined analysis: ${successfulOutputs.map(o => o.content).join(' ')}`;

      return {
        content,
        model: 'fallback-synthesis',
        status: 'fallback',
        optimized: false,
        sourceCount: successfulOutputs.length
      };

    } catch (error) {
      this.monitoringService?.log('error', 'Fallback synthesis creation failed', {
        error: error.message,
        correlationId
      }, correlationId);

      return {
        content: 'System temporarily unavailable. Please try again.',
        model: 'emergency-fallback',
        status: 'error',
        optimized: false
      };
    }
  }

  /**
   * Optimized synthesis with caching and prompt optimization
   */
  async optimizedSynthesis(roleOutputs, userPrompt, correlationId, userId, sessionId) {
    const synthesisKey = this.generateSynthesisKey(roleOutputs, userPrompt);
    
    // Check synthesis cache
    const cachedSynthesis = await this.cacheService.get(`synthesis:${synthesisKey}`);
    if (cachedSynthesis) {
      console.log(`⚡ [${correlationId}] Using cached synthesis`);
      this.metrics.synthesisSpeedups++;
      return cachedSynthesis;
    }

    // Optimize synthesis prompt for faster processing
    const optimizedPrompt = this.optimizeSynthesisPrompt(roleOutputs, userPrompt);
    
    // Use faster synthesis parameters
    const synthesisResult = await this.fastSynthesis(optimizedPrompt, correlationId);
    
    // Cache the result
    await this.cacheService.set(`synthesis:${synthesisKey}`, synthesisResult, 3600); // 1 hour
    
    return synthesisResult;
  }

  /**
   * Optimized voting with result caching
   */
  async optimizedVoting(roleOutputs, userPrompt, correlationId) {
    const votingKey = this.generateVotingKey(roleOutputs);
    
    // Check voting cache
    const cachedVoting = this.votingCache.get(votingKey);
    if (cachedVoting && Date.now() - cachedVoting.timestamp < 300000) { // 5 minutes
      console.log(`⚡ [${correlationId}] Using cached voting result`);
      this.metrics.votingSpeedups++;
      return cachedVoting.result;
    }

    // Fast voting calculation
    const votingResult = await this.fastVoting(roleOutputs, correlationId);
    
    // Cache voting result
    this.votingCache.set(votingKey, {
      result: votingResult,
      timestamp: Date.now()
    });
    
    return votingResult;
  }

  /**
   * Fast synthesis with optimized parameters
   */
  async fastSynthesis(optimizedPrompt, correlationId) {
    const clients = require('./vendorClients');
    
    try {
      const response = await clients.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Faster model for synthesis
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI synthesizer. Create concise, high-quality responses quickly.'
          },
          { role: 'user', content: optimizedPrompt }
        ],
        max_tokens: 800,      // Reduced tokens for speed
        temperature: 0.2,     // Lower temperature for consistency
        top_p: 0.8           // Focused sampling
      });

      return {
        content: response.choices[0].message.content,
        model: 'gpt-4o-mini',
        provider: 'openai',
        status: 'success',
        optimized: true,
        processingTime: Date.now()
      };

    } catch (error) {
      console.error(`❌ [${correlationId}] Fast synthesis failed:`, error.message);
      throw error;
    }
  }

  /**
   * Fast voting with simplified algorithm
   */
  async fastVoting(roleOutputs, correlationId) {
    const successful = roleOutputs.filter(r => r.status === 'fulfilled');
    
    if (successful.length === 0) {
      return { winner: null, confidence: 0, consensus: 'none' };
    }

    // Simplified voting based on confidence and response quality
    const weights = {};
    let totalWeight = 0;

    successful.forEach(role => {
      const confidence = role.confidence?.score || 0.5;
      const responseLength = role.content?.length || 0;
      const responseTime = role.responseTime || 5000;
      
      // Fast weight calculation
      let weight = confidence;
      if (responseLength > 100 && responseLength < 1500) weight *= 1.1;
      if (responseTime < 5000) weight *= 1.05;
      
      weights[role.role] = weight;
      totalWeight += weight;
    });

    // Normalize weights
    Object.keys(weights).forEach(role => {
      weights[role] = weights[role] / totalWeight;
    });

    // Find winner
    const winner = Object.keys(weights).reduce((a, b) => weights[a] > weights[b] ? a : b);
    const confidence = weights[winner];
    
    // Determine consensus
    let consensus = 'weak';
    if (confidence > 0.6) consensus = 'strong';
    else if (confidence > 0.45) consensus = 'moderate';

    return {
      winner,
      confidence,
      weights,
      consensus,
      optimized: true,
      processingTime: Date.now()
    };
  }

  /**
   * Optimize synthesis prompt for faster processing
   */
  optimizeSynthesisPrompt(roleOutputs, userPrompt) {
    const successful = roleOutputs.filter(r => r.status === 'fulfilled');
    
    let prompt = `Synthesize these ${successful.length} AI responses into one optimal answer for: "${userPrompt}"\n\n`;
    
    successful.forEach((role, index) => {
      const snippet = role.content.substring(0, 300); // Truncate for speed
      prompt += `Response ${index + 1} (${role.role}): ${snippet}...\n\n`;
    });
    
    prompt += 'Create a concise, comprehensive synthesis that combines the best insights.';
    
    return prompt;
  }

  /**
   * Find similar cached responses using content similarity
   */
  async findSimilarCachedResponse(userPrompt, roleOutputs) {
    if (!this.config.enableSimilarityMatching) return null;

    const promptHash = this.generatePromptHash(userPrompt);
    const responseSignature = this.generateResponseSignature(roleOutputs);
    
    // Check similarity cache
    for (const [key, cached] of this.similarityCache.entries()) {
      const similarity = this.calculateSimilarity(
        { promptHash, responseSignature },
        cached.signature
      );
      
      if (similarity > this.config.similarityThreshold) {
        console.log(`⚡ Found similar cached response (${(similarity * 100).toFixed(1)}% match)`);
        return cached.result;
      }
    }
    
    return null;
  }

  /**
   * Cache optimized result with similarity signature
   */
  async cacheOptimizedResult(userPrompt, roleOutputs, result) {
    const promptHash = this.generatePromptHash(userPrompt);
    const responseSignature = this.generateResponseSignature(roleOutputs);
    const key = `optimized:${promptHash}:${responseSignature}`;
    
    this.similarityCache.set(key, {
      signature: { promptHash, responseSignature },
      result,
      timestamp: Date.now()
    });
    
    // Cleanup old entries
    if (this.similarityCache.size > 1000) {
      const oldestKey = this.similarityCache.keys().next().value;
      this.similarityCache.delete(oldestKey);
    }
  }

  /**
   * Generate unique keys for caching
   */
  generateSynthesisKey(roleOutputs, userPrompt) {
    const content = roleOutputs.map(r => r.content?.substring(0, 100) || '').join('');
    return crypto.createHash('md5').update(userPrompt + content).digest('hex');
  }

  generateVotingKey(roleOutputs) {
    const signature = roleOutputs.map(r => 
      `${r.role}:${r.confidence?.score || 0}:${r.responseTime || 0}`
    ).join('|');
    return crypto.createHash('md5').update(signature).digest('hex');
  }

  generatePromptHash(prompt) {
    return crypto.createHash('md5').update(prompt).digest('hex').substring(0, 16);
  }

  generateResponseSignature(roleOutputs) {
    const signature = roleOutputs.map(r => ({
      role: r.role,
      length: r.content?.length || 0,
      confidence: r.confidence?.score || 0
    }));
    return crypto.createHash('md5').update(JSON.stringify(signature)).digest('hex').substring(0, 16);
  }

  /**
   * Calculate similarity between signatures
   */
  calculateSimilarity(sig1, sig2) {
    if (sig1.promptHash === sig2.promptHash) return 1.0;
    
    // Simple similarity based on response signature matching
    const match1 = sig1.responseSignature === sig2.responseSignature;
    return match1 ? 0.9 : 0.3;
  }

  /**
   * Start pre-warming process for common queries
   */
  startPreWarming() {
    if (!this.config.enablePreWarming) return;

    setInterval(() => {
      this.preWarmCommonQueries();
    }, this.config.preWarmInterval);
  }

  /**
   * Pre-warm cache with common queries
   */
  async preWarmCommonQueries() {
    const commonQueries = [
      'What are the benefits of exercise?',
      'How does artificial intelligence work?',
      'What is machine learning?',
      'Explain climate change',
      'What is healthy eating?'
    ];

    console.log('🔥 Pre-warming cache with common queries...');
    
    for (const query of commonQueries) {
      const key = `prewarmed:${this.generatePromptHash(query)}`;
      const exists = await this.cacheService.get(key);
      
      if (!exists) {
        // This would trigger actual ensemble processing in production
        console.log(`🔥 Pre-warming: ${query}`);
      }
    }
  }

  /**
   * Update performance metrics
   */
  updateMetrics(type, value) {
    switch (type) {
      case 'ensemble_optimization':
        this.metrics.averageProcessingTime = 
          (this.metrics.averageProcessingTime + value) / 2;
        break;
      case 'cache_hit':
        this.metrics.cacheHitRate = 
          (this.metrics.cacheHitRate * 0.9) + (1 * 0.1);
        break;
      case 'cache_miss':
        this.metrics.cacheHitRate = 
          (this.metrics.cacheHitRate * 0.9) + (0 * 0.1);
        break;
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    return {
      ...this.metrics,
      cacheSize: this.similarityCache.size,
      votingCacheSize: this.votingCache.size,
      config: this.config
    };
  }
}

module.exports = EnsemblePerformanceOptimizer;
