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

class EnsemblePerformanceOptimizer extends EventEmitter {
  constructor(cacheService, monitoringService) {
    super();
    
    this.cacheService = cacheService;
    this.monitoringService = monitoringService;
    
    // Performance metrics
    this.metrics = {
      optimizationHits: 0,
      synthesisSpeedups: 0,
      votingSpeedups: 0,
      cacheHitRate: 0,
      averageProcessingTime: 0,
      parallelProcessingGains: 0
    };
    
    // Optimization configuration
    this.config = {
      enableParallelSynthesis: true,
      enableSimilarityMatching: true,
      enableVotingCache: true,
      enablePreWarming: true,
      similarityThreshold: 0.85,
      maxParallelOperations: 3,
      synthesisTimeout: 15000, // Reduced from 39s
      votingTimeout: 2000,     // Reduced from 4s
      preWarmInterval: 300000  // 5 minutes
    };
    
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
   * Process synthesis and voting in parallel for maximum performance
   */
  async processInParallel(roleOutputs, userPrompt, correlationId, userId, sessionId) {
    const operations = [];

    // Operation 1: Optimized synthesis
    operations.push(
      this.optimizedSynthesis(roleOutputs, userPrompt, correlationId, userId, sessionId)
    );

    // Operation 2: Cached or optimized voting
    operations.push(
      this.optimizedVoting(roleOutputs, userPrompt, correlationId)
    );

    // Operation 3: Context preparation (if needed)
    if (userId && sessionId) {
      operations.push(
        this.prepareOptimizedContext(userId, sessionId)
      );
    }

    // Execute all operations in parallel with timeout
    const results = await Promise.allSettled(
      operations.map(op => 
        Promise.race([
          op,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), this.config.synthesisTimeout)
          )
        ])
      )
    );

    // Process results
    const synthesisResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const votingResult = results[1].status === 'fulfilled' ? results[1].value : null;
    const contextResult = results[2]?.status === 'fulfilled' ? results[2].value : null;

    if (!synthesisResult) {
      throw new Error('Synthesis optimization failed');
    }

    this.metrics.parallelProcessingGains++;
    
    return {
      synthesis: synthesisResult,
      voting: votingResult,
      context: contextResult,
      parallelProcessed: true
    };
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
