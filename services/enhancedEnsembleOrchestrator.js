/**
 * 🎼 Enhanced Ensemble Orchestrator - Advanced AI Ensemble Coordination
 *
 * 🎯 PURPOSE: Orchestrate the complete AI ensemble process with intelligent
 *            model selection, advanced synthesis, and sophisticated voting
 *
 * 📋 KEY FEATURES:
 * 1. Intelligent model selection based on request characteristics
 * 2. Parallel processing with optimized resource management
 * 3. Advanced synthesis with multi-stage processing
 * 4. Sophisticated voting with multi-factor analysis
 * 5. Real-time performance optimization and adaptation
 * 6. Comprehensive error handling and graceful degradation
 * 7. Quality assurance and validation at every stage
 *
 * 💡 INNOVATION: Combines all enhanced components into a cohesive system
 *    that delivers superior results through intelligent coordination
 */

const monitoringService = require('./monitoringService');
const intelligentModelRouter = require('./intelligentModelRouter');
const advancedSynthesisEngine = require('./advancedSynthesisEngine');
const intelligentVotingSystem = require('./intelligentVotingSystem');
const parallelEnsembleProcessor = require('./parallelEnsembleProcessor');
const memoryManager = require('./memoryManager');
const logger = require('../utils/visualLogger');
const dynamicConfig = require('../config/dynamicConfig');

class EnhancedEnsembleOrchestrator {
  constructor() {
    // Orchestration configuration
    this.config = {
      maxConcurrentRequests: dynamicConfig.ensemble.maxConcurrentRequests.free,
      timeoutMs: dynamicConfig.ensemble.timeoutMs,
      retryAttempts: dynamicConfig.ensemble.retryAttempts,
      qualityThreshold: 0.7,
      enableAdaptiveOptimization: true,
      enableQualityValidation: true
    };

    // Performance tracking
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      averageProcessingTime: 0,
      averageQualityScore: 0,
      optimizationImprovements: 0,
      errorRecoveries: 0
    };

    // Request queue for load management
    this.requestQueue = [];
    this.activeRequests = new Map();
    this.maxQueueSize = 100;

    // Quality tracking for continuous improvement
    this.qualityHistory = [];
    this.qualityWindow = 200;

    logger.success(
      'Enhanced Ensemble Orchestrator: Initialized',
      {
        'Intelligent Routing': 'Enabled',
        'Advanced Synthesis': 'Enabled',
        'Sophisticated Voting': 'Enabled',
        'Quality Validation': 'Enabled',
        'Adaptive Optimization': 'Enabled'
      },
      'orchestrator'
    );
  }

  /**
   * Main ensemble execution method with full orchestration
   * @param {string} userPrompt - User prompt
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {Object} options - Additional options
   * @returns {Object} Complete ensemble result
   */
  async runEnhancedEnsemble(userPrompt, userId, sessionId, options = {}) {
    const startTime = Date.now();
    const correlationId = options.correlationId || `ensemble_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.metrics.totalRequests++;

    try {
      // Stage 1: Request Analysis and Preparation
      const requestContext = await this.analyzeRequest(userPrompt, userId, sessionId, options, correlationId);
      
      // Stage 2: Intelligent Model Selection
      const selectedModels = await this.selectOptimalModels(requestContext, correlationId);
      
      // Stage 3: Memory Context Retrieval
      const memoryContext = await this.retrieveMemoryContext(userPrompt, userId, sessionId, correlationId);
      
      // Stage 4: Parallel Model Execution
      const modelResponses = await this.executeModelsInParallel(
        userPrompt,
        selectedModels,
        memoryContext,
        requestContext,
        correlationId
      );
      
      // Stage 5: Response Quality Assessment
      const qualityAssessment = await this.assessResponseQuality(modelResponses, requestContext, correlationId);
      
      // Stage 6: Intelligent Voting
      const votingResult = await this.performIntelligentVoting(
        qualityAssessment.responses,
        userPrompt,
        requestContext,
        correlationId
      );
      
      // Stage 7: Advanced Synthesis
      const synthesisResult = await this.performAdvancedSynthesis(
        qualityAssessment.responses,
        userPrompt,
        votingResult,
        requestContext,
        correlationId
      );
      
      // Stage 8: Final Quality Validation
      const validatedResult = await this.validateFinalResult(
        synthesisResult,
        votingResult,
        qualityAssessment,
        requestContext,
        correlationId
      );
      
      // Stage 9: Memory Storage and Learning
      await this.storeMemoryAndLearn(
        userPrompt,
        validatedResult,
        userId,
        sessionId,
        correlationId
      );
      
      // Stage 10: Performance Tracking and Optimization
      const finalResult = await this.finalizeResult(
        validatedResult,
        votingResult,
        qualityAssessment,
        selectedModels,
        startTime,
        correlationId
      );
      
      // Update metrics and performance tracking
      this.updateMetrics(finalResult, startTime);
      
      return finalResult;

    } catch (error) {
      logger.error('Enhanced ensemble execution failed', { 
        error: error.message, 
        correlationId,
        userId,
        sessionId 
      }, 'orchestrator');
      
      return await this.handleEnsembleFailure(userPrompt, userId, sessionId, error, correlationId, startTime);
    }
  }

  /**
   * Analyze request and create context
   * @param {string} userPrompt - User prompt
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {Object} options - Options
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Request context
   */
  async analyzeRequest(userPrompt, userId, sessionId, options, correlationId) {
    const context = {
      userPrompt,
      userId,
      sessionId,
      correlationId,
      timestamp: new Date().toISOString(),
      
      // Request characteristics
      promptLength: userPrompt.length,
      promptComplexity: this.analyzePromptComplexity(userPrompt),
      requestType: this.classifyRequestType(userPrompt),
      
      // User context
      userTier: options.userTier || 'free',
      explainMode: options.explainMode || false,
      
      // System context
      systemLoad: this.getCurrentSystemLoad(),
      availableModels: await this.getAvailableModels(),
      
      // Quality requirements
      qualityTarget: options.qualityTarget || this.config.qualityThreshold,
      timeoutMs: options.timeoutMs || this.config.timeoutMs
    };

    // Log request analysis
    monitoringService.log('info', 'Request analyzed', {
      requestType: context.requestType,
      promptComplexity: context.promptComplexity,
      userTier: context.userTier,
      availableModels: context.availableModels.length
    }, correlationId);

    return context;
  }

  /**
   * Analyze prompt complexity for optimization
   * @param {string} prompt - User prompt
   * @returns {string} Complexity level
   */
  analyzePromptComplexity(prompt) {
    const length = prompt.length;
    const hasMultipleQuestions = (prompt.match(/\?/g) || []).length > 1;
    const hasComplexTerms = /analyze|compare|evaluate|synthesize|comprehensive/i.test(prompt);
    const hasCodeRequest = /code|function|algorithm|programming/i.test(prompt);
    
    if (length > 500 || hasMultipleQuestions || hasComplexTerms || hasCodeRequest) {
      return 'high';
    } else if (length > 200 || /explain|describe|how|why/i.test(prompt)) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Classify request type for model selection
   * @param {string} prompt - User prompt
   * @returns {string} Request type
   */
  classifyRequestType(prompt) {
    const promptLower = prompt.toLowerCase();
    
    if (/analyze|analysis|compare|evaluate|assess|examine|study/.test(promptLower)) {
      return 'analytical';
    }
    if (/story|creative|poem|joke|humor|funny|imagine|invent/.test(promptLower)) {
      return 'creative';
    }
    if (/code|programming|technical|algorithm|debug|function|api/.test(promptLower)) {
      return 'technical';
    }
    if (/explain|how|why|what|describe|definition|meaning/.test(promptLower)) {
      return 'explanatory';
    }
    if (/fact|data|statistics|research|study|evidence|proof/.test(promptLower)) {
      return 'factual';
    }
    
    return 'conversational';
  }

  /**
   * Get current system load for optimization
   * @returns {number} System load (0-1)
   */
  getCurrentSystemLoad() {
    const activeRequestCount = this.activeRequests.size;
    const maxConcurrent = this.config.maxConcurrentRequests;
    return Math.min(1, activeRequestCount / maxConcurrent);
  }

  /**
   * Get available models from router
   * @returns {Array} Available model names
   */
  async getAvailableModels() {
    const routerMetrics = intelligentModelRouter.getMetrics();
    return Object.keys(routerMetrics.circuitBreakerStatus).filter(
      model => routerMetrics.circuitBreakerStatus[model] !== 'OPEN'
    );
  }

  /**
   * Select optimal models using intelligent router
   * @param {Object} requestContext - Request context
   * @param {string} correlationId - Correlation ID
   * @returns {Array} Selected model configurations
   */
  async selectOptimalModels(requestContext, correlationId) {
    try {
      const modelCount = requestContext.userTier === 'premium' ? 4 : 3;
      
      const selectedModels = await intelligentModelRouter.selectOptimalModels(
        requestContext.userPrompt,
        {
          userTier: requestContext.userTier,
          requestType: requestContext.requestType,
          complexity: requestContext.promptComplexity,
          systemLoad: requestContext.systemLoad
        },
        modelCount
      );

      logger.info('Models selected', {
        models: selectedModels.map(m => m.model),
        selectionReasoning: selectedModels.map(m => m.reasoning)
      }, 'orchestrator');

      return selectedModels;

    } catch (error) {
      logger.warning('Model selection failed, using fallback', { error: error.message }, 'orchestrator');
      
      // Fallback to default models
      return [
        { model: 'gpt-4.1-nano', config: { provider: 'openai' }, reasoning: 'Fallback selection' },
        { model: 'gemini-1.5-flash-8b', config: { provider: 'gemini' }, reasoning: 'Fallback selection' },
        { model: 'claude-3-5-haiku', config: { provider: 'claude' }, reasoning: 'Fallback selection' }
      ];
    }
  }

  /**
   * Retrieve memory context for enhanced responses
   * @param {string} userPrompt - User prompt
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Memory context
   */
  async retrieveMemoryContext(userPrompt, userId, sessionId, correlationId) {
    try {
      const memoryService = memoryManager.getMemoryManager();
      
      const context = await memoryService.getRelevantContext(
        userPrompt,
        userId,
        sessionId,
        { maxTokens: 500, includePersonalization: true }
      );

      return {
        hasContext: context && context.length > 0,
        context: context || '',
        contextLength: context ? context.length : 0,
        contextEnabled: true
      };

    } catch (error) {
      logger.warning('Memory context retrieval failed', { error: error.message }, 'orchestrator');
      return {
        hasContext: false,
        context: '',
        contextLength: 0,
        contextEnabled: false
      };
    }
  }

  /**
   * Execute models in parallel with enhanced processing
   * @param {string} userPrompt - User prompt
   * @param {Array} selectedModels - Selected models
   * @param {Object} memoryContext - Memory context
   * @param {Object} requestContext - Request context
   * @param {string} correlationId - Correlation ID
   * @returns {Array} Model responses
   */
  async executeModelsInParallel(userPrompt, selectedModels, memoryContext, requestContext, correlationId) {
    try {
      // Prepare enhanced prompt with context
      const enhancedPrompt = memoryContext.hasContext ? 
        `Context: ${memoryContext.context}\n\nQuestion: ${userPrompt}` : userPrompt;

      // Execute models using parallel processor
      const responses = await parallelEnsembleProcessor.executeModelsInParallel(
        enhancedPrompt,
        memoryContext.context,
        this.createModelConfigs(selectedModels, requestContext),
        correlationId
      );

      // Record performance for each model
      responses.forEach(response => {
        if (response.status === 'fulfilled') {
          intelligentModelRouter.recordPerformance(response.role, {
            success: true,
            responseTime: response.responseTime,
            qualityScore: response.quality?.score || 0.7
          });
        } else {
          intelligentModelRouter.recordPerformance(response.role, {
            success: false,
            error: response.error
          });
        }
      });

      return responses;

    } catch (error) {
      logger.error('Parallel model execution failed', { error: error.message }, 'orchestrator');
      throw error;
    }
  }

  /**
   * Create model configurations for parallel execution
   * @param {Array} selectedModels - Selected models
   * @param {Object} requestContext - Request context
   * @returns {Object} Model configurations
   */
  createModelConfigs(selectedModels, requestContext) {
    const configs = {};
    
    selectedModels.forEach(modelData => {
      const baseConfig = {
        maxTokens: requestContext.userTier === 'premium' ? 3000 : 2000,
        temperature: 0.3,
        timeout: requestContext.timeoutMs
      };

      // Adjust config based on request type
      if (requestContext.requestType === 'creative') {
        baseConfig.temperature = 0.7;
      } else if (requestContext.requestType === 'technical') {
        baseConfig.temperature = 0.1;
        baseConfig.maxTokens = Math.min(baseConfig.maxTokens * 1.5, 4000);
      }

      configs[modelData.model] = baseConfig;
    });

    return configs;
  }

  /**
   * Assess response quality for optimization
   * @param {Array} modelResponses - Model responses
   * @param {Object} requestContext - Request context
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Quality assessment
   */
  async assessResponseQuality(modelResponses, requestContext, correlationId) {
    const assessment = {
      responses: [],
      overallQuality: 0,
      qualityDistribution: {},
      recommendations: []
    };

    let totalQuality = 0;
    let validResponseCount = 0;

    for (const response of modelResponses) {
      if (response.status === 'fulfilled' && response.content) {
        const qualityScore = await this.calculateResponseQuality(response, requestContext);

        const enhancedResponse = {
          ...response,
          qualityScore,
          qualityLevel: this.getQualityLevel(qualityScore),
          qualityFactors: this.getQualityFactors(response, requestContext)
        };

        assessment.responses.push(enhancedResponse);
        totalQuality += qualityScore;
        validResponseCount++;

        // Track quality distribution
        const level = enhancedResponse.qualityLevel;
        assessment.qualityDistribution[level] = (assessment.qualityDistribution[level] || 0) + 1;

      } else {
        // Include failed responses for completeness
        assessment.responses.push({
          ...response,
          qualityScore: 0,
          qualityLevel: 'failed',
          qualityFactors: ['Response generation failed']
        });
      }
    }

    assessment.overallQuality = validResponseCount > 0 ? totalQuality / validResponseCount : 0;

    // Generate quality recommendations
    if (assessment.overallQuality < 0.6) {
      assessment.recommendations.push('Consider adjusting model selection for better quality');
    }
    if (validResponseCount < modelResponses.length * 0.7) {
      assessment.recommendations.push('High failure rate detected, check model availability');
    }

    monitoringService.log('info', 'Quality assessment completed', {
      overallQuality: assessment.overallQuality,
      validResponses: validResponseCount,
      totalResponses: modelResponses.length,
      qualityDistribution: assessment.qualityDistribution
    }, correlationId);

    return assessment;
  }

  /**
   * Calculate response quality score
   * @param {Object} response - Response object
   * @param {Object} requestContext - Request context
   * @returns {number} Quality score (0-1)
   */
  async calculateResponseQuality(response, requestContext) {
    let score = 0.5; // Base score

    // Content length appropriateness
    const length = response.content.length;
    if (length > 100 && length < 2000) {
      score += 0.15;
    } else if (length >= 2000 && length < 4000) {
      score += 0.1;
    }

    // Structure and formatting
    if (/#{1,3}\s|^\d+\.\s|\*\*.*\*\*|^-\s/m.test(response.content)) {
      score += 0.15;
    }

    // Relevance to prompt
    const promptWords = requestContext.userPrompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const contentWords = response.content.toLowerCase().split(/\s+/);
    const relevantWords = promptWords.filter(word => contentWords.includes(word));
    const relevanceRatio = relevantWords.length / promptWords.length;
    score += relevanceRatio * 0.2;

    // Completeness indicators
    if (/conclusion|summary|in summary|to conclude/i.test(response.content)) {
      score += 0.1;
    }

    // Examples and specificity
    if (/for example|such as|specifically|instance/i.test(response.content)) {
      score += 0.1;
    }

    // Response time penalty (slower responses get slight penalty)
    if (response.responseTime && response.responseTime > 15000) {
      score -= 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get quality level from score
   * @param {number} score - Quality score
   * @returns {string} Quality level
   */
  getQualityLevel(score) {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.8) return 'high';
    if (score >= 0.6) return 'medium';
    if (score >= 0.4) return 'low';
    return 'poor';
  }

  /**
   * Get quality factors for transparency
   * @param {Object} response - Response object
   * @param {Object} requestContext - Request context
   * @returns {Array} Quality factors
   */
  getQualityFactors(response, requestContext) {
    const factors = [];

    if (response.content.length > 200) factors.push('Adequate length');
    if (/#{1,3}\s|^\d+\.\s|\*\*.*\*\*/m.test(response.content)) factors.push('Well structured');
    if (/for example|such as/i.test(response.content)) factors.push('Includes examples');
    if (response.responseTime && response.responseTime < 10000) factors.push('Fast response');
    if (/conclusion|summary/i.test(response.content)) factors.push('Has conclusion');

    return factors.length > 0 ? factors : ['Basic response'];
  }

  /**
   * Perform intelligent voting
   * @param {Array} responses - Quality-assessed responses
   * @param {string} userPrompt - User prompt
   * @param {Object} requestContext - Request context
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Voting result
   */
  async performIntelligentVoting(responses, userPrompt, requestContext, correlationId) {
    try {
      const votingResult = await intelligentVotingSystem.executeIntelligentVoting(
        responses,
        userPrompt,
        {
          correlationId,
          userId: requestContext.userId,
          requestType: requestContext.requestType,
          userTier: requestContext.userTier
        }
      );

      logger.info('Intelligent voting completed', {
        winner: votingResult.winner,
        confidence: votingResult.confidence,
        consensus: votingResult.consensus,
        responseCount: responses.length
      }, 'orchestrator');

      return votingResult;

    } catch (error) {
      logger.error('Intelligent voting failed, using fallback', { error: error.message }, 'orchestrator');

      // Simple fallback voting
      const validResponses = responses.filter(r => r.status === 'fulfilled' && r.content);
      if (validResponses.length > 0) {
        const winner = validResponses.reduce((best, current) =>
          (current.qualityScore || 0) > (best.qualityScore || 0) ? current : best
        );

        return {
          winner: winner.role,
          confidence: 0.5,
          consensus: 'fallback',
          weights: { [winner.role]: 1.0 },
          metadata: { fallback: true, reason: 'voting_system_failure' }
        };
      }

      return { winner: null, confidence: 0, consensus: 'none', weights: {} };
    }
  }

  /**
   * Perform advanced synthesis
   * @param {Array} responses - Quality-assessed responses
   * @param {string} userPrompt - User prompt
   * @param {Object} votingResult - Voting result
   * @param {Object} requestContext - Request context
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Synthesis result
   */
  async performAdvancedSynthesis(responses, userPrompt, votingResult, requestContext, correlationId) {
    try {
      const synthesisResult = await advancedSynthesisEngine.synthesizeWithAdvancedProcessing(
        responses,
        userPrompt,
        correlationId,
        votingResult,
        requestContext.userId,
        requestContext.sessionId
      );

      logger.info('Advanced synthesis completed', {
        strategy: synthesisResult.strategy?.name,
        qualityScore: synthesisResult.qualityScore,
        processingTime: synthesisResult.processingTime,
        sourceCount: synthesisResult.sourceCount
      }, 'orchestrator');

      return synthesisResult;

    } catch (error) {
      logger.error('Advanced synthesis failed, using fallback', { error: error.message }, 'orchestrator');

      // Fallback to best individual response
      const validResponses = responses.filter(r => r.status === 'fulfilled' && r.content);
      if (validResponses.length > 0) {
        const bestResponse = validResponses.reduce((best, current) =>
          (current.qualityScore || 0) > (best.qualityScore || 0) ? current : best
        );

        return {
          content: bestResponse.content,
          model: 'fallback',
          provider: 'system',
          status: 'fallback',
          processingTime: 0,
          sourceCount: validResponses.length,
          qualityScore: bestResponse.qualityScore || 0.5,
          metadata: { fallback: true, reason: 'synthesis_failure', originalModel: bestResponse.role }
        };
      }

      return {
        content: "I apologize, but I'm unable to provide a comprehensive response at this time.",
        model: 'fallback',
        provider: 'system',
        status: 'error',
        processingTime: 0,
        sourceCount: 0,
        qualityScore: 0.1
      };
    }
  }

  /**
   * Validate final result quality
   * @param {Object} synthesisResult - Synthesis result
   * @param {Object} votingResult - Voting result
   * @param {Object} qualityAssessment - Quality assessment
   * @param {Object} requestContext - Request context
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Validated result
   */
  async validateFinalResult(synthesisResult, votingResult, qualityAssessment, requestContext, correlationId) {
    const validation = {
      passed: true,
      issues: [],
      recommendations: [],
      finalQualityScore: synthesisResult.qualityScore || 0
    };

    // Quality threshold validation
    if (validation.finalQualityScore < requestContext.qualityTarget) {
      validation.passed = false;
      validation.issues.push(`Quality below target (${validation.finalQualityScore.toFixed(2)} < ${requestContext.qualityTarget})`);
    }

    // Content length validation
    if (synthesisResult.content && synthesisResult.content.length < 50) {
      validation.passed = false;
      validation.issues.push('Response too short');
    }

    // Relevance validation (basic check)
    const promptWords = requestContext.userPrompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const responseWords = synthesisResult.content ? synthesisResult.content.toLowerCase().split(/\s+/) : [];
    const relevantWords = promptWords.filter(word => responseWords.includes(word));
    const relevanceRatio = relevantWords.length / promptWords.length;

    if (relevanceRatio < 0.2) {
      validation.issues.push('Low relevance to original prompt');
      validation.recommendations.push('Consider improving prompt analysis');
    }

    // Log validation results
    if (!validation.passed) {
      logger.warning('Final result validation failed', {
        issues: validation.issues,
        qualityScore: validation.finalQualityScore,
        relevanceRatio
      }, 'orchestrator');
    }

    return {
      ...synthesisResult,
      validation,
      finalQualityScore: validation.finalQualityScore
    };
  }

  /**
   * Store memory and learn from interaction
   * @param {string} userPrompt - User prompt
   * @param {Object} result - Final result
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} correlationId - Correlation ID
   */
  async storeMemoryAndLearn(userPrompt, result, userId, sessionId, correlationId) {
    try {
      const memoryService = memoryManager.getMemoryManager();

      // Store interaction in memory
      await memoryService.storeInteraction(
        userPrompt,
        result.content,
        userId,
        sessionId,
        {
          qualityScore: result.finalQualityScore,
          synthesisStrategy: result.strategy?.name,
          processingTime: result.processingTime,
          correlationId
        }
      );

      // Store quality metrics for learning
      this.qualityHistory.push({
        timestamp: Date.now(),
        qualityScore: result.finalQualityScore,
        requestType: result.strategy?.name || 'unknown',
        processingTime: result.processingTime
      });

      // Maintain quality history window
      if (this.qualityHistory.length > this.qualityWindow) {
        this.qualityHistory = this.qualityHistory.slice(-this.qualityWindow);
      }

    } catch (error) {
      logger.warning('Memory storage failed', { error: error.message }, 'orchestrator');
    }
  }

  /**
   * Finalize result with comprehensive metadata
   * @param {Object} validatedResult - Validated result
   * @param {Object} votingResult - Voting result
   * @param {Object} qualityAssessment - Quality assessment
   * @param {Array} selectedModels - Selected models
   * @param {number} startTime - Start time
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Final result
   */
  async finalizeResult(validatedResult, votingResult, qualityAssessment, selectedModels, startTime, correlationId) {
    const totalProcessingTime = Date.now() - startTime;

    return {
      // Core response
      synthesis: {
        content: validatedResult.content,
        confidence: {
          score: validatedResult.finalQualityScore,
          level: this.getQualityLevel(validatedResult.finalQualityScore),
          factors: validatedResult.validation?.issues?.length > 0 ?
            [`Quality: ${(validatedResult.finalQualityScore * 100).toFixed(0)}%`, ...validatedResult.validation.issues] :
            [`Quality: ${(validatedResult.finalQualityScore * 100).toFixed(0)}%`, 'Validation passed']
        },
        status: validatedResult.status || 'success',
        optimized: true
      },

      // Individual role responses
      roles: qualityAssessment.responses.map(response => ({
        role: response.role,
        content: response.content || '',
        confidence: {
          score: response.qualityScore || 0,
          level: response.qualityLevel || 'unknown',
          factors: response.qualityFactors || []
        },
        responseTime: response.responseTime,
        quality: {
          wordCount: response.content ? response.content.split(/\s+/).length : 0,
          sentenceCount: response.content ? response.content.split(/[.!?]+/).length : 0,
          hasStructure: response.metadata?.hasStructure || false,
          complexity: response.qualityLevel || 'unknown'
        }
      })),

      // Voting results
      voting: {
        winner: votingResult.winner,
        confidence: votingResult.confidence,
        consensus: votingResult.consensus,
        weights: votingResult.weights,
        analysis: votingResult.analysis
      },

      // Comprehensive metadata
      metadata: {
        totalProcessingTimeMs: totalProcessingTime,
        optimized: true,
        parallelProcessed: true,
        responseQuality: validatedResult.finalQualityScore,
        selectedModels: selectedModels.map(m => m.model),
        modelSelectionReasoning: selectedModels.map(m => m.reasoning),
        synthesisStrategy: validatedResult.strategy?.name,
        qualityValidation: validatedResult.validation?.passed,
        orchestrationVersion: '2.0',
        correlationId,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Handle ensemble failure with graceful degradation
   * @param {string} userPrompt - User prompt
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {Error} error - Error object
   * @param {string} correlationId - Correlation ID
   * @param {number} startTime - Start time
   * @returns {Object} Fallback result
   */
  async handleEnsembleFailure(userPrompt, userId, sessionId, error, correlationId, startTime) {
    this.metrics.errorRecoveries++;

    const processingTime = Date.now() - startTime;

    // Try simple fallback with single model
    try {
      const fallbackResponse = await this.executeFallbackResponse(userPrompt, correlationId);

      return {
        synthesis: {
          content: fallbackResponse.content,
          confidence: {
            score: 0.3,
            level: 'low',
            factors: ['Fallback response due to system error', 'Single model response']
          },
          status: 'fallback',
          optimized: false
        },
        roles: [fallbackResponse],
        voting: {
          winner: fallbackResponse.role,
          confidence: 0.3,
          consensus: 'fallback',
          weights: { [fallbackResponse.role]: 1.0 }
        },
        metadata: {
          totalProcessingTimeMs: processingTime,
          optimized: false,
          parallelProcessed: false,
          responseQuality: 0.3,
          error: error.message,
          fallbackUsed: true,
          correlationId,
          timestamp: new Date().toISOString()
        }
      };

    } catch (fallbackError) {
      // Ultimate fallback
      return {
        synthesis: {
          content: "I apologize, but I'm experiencing technical difficulties and cannot provide a response at this time. Please try again later.",
          confidence: {
            score: 0.1,
            level: 'very-low',
            factors: ['System error', 'Unable to process request']
          },
          status: 'error',
          optimized: false
        },
        roles: [],
        voting: { winner: null, confidence: 0, consensus: 'none', weights: {} },
        metadata: {
          totalProcessingTimeMs: processingTime,
          optimized: false,
          parallelProcessed: false,
          responseQuality: 0.1,
          error: error.message,
          fallbackError: fallbackError.message,
          correlationId,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Execute fallback response with single model
   * @param {string} userPrompt - User prompt
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Fallback response
   */
  async executeFallbackResponse(userPrompt, correlationId) {
    const clients = require('./vendorClients');

    try {
      // Try GPT-4.1-nano as most reliable fallback
      const response = await clients.openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant. Provide a clear, concise response.' },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      return {
        role: 'gpt-4.1-nano',
        content: response.choices[0].message.content,
        confidence: { score: 0.5, level: 'medium', factors: ['Fallback single model response'] },
        responseTime: 0,
        quality: { wordCount: response.choices[0].message.content.split(/\s+/).length }
      };

    } catch (error) {
      throw new Error(`Fallback response failed: ${error.message}`);
    }
  }

  /**
   * Update performance metrics
   * @param {Object} result - Final result
   * @param {number} startTime - Start time
   */
  updateMetrics(result, startTime) {
    const processingTime = Date.now() - startTime;

    if (result.synthesis.status === 'success' || result.synthesis.status === 'fallback') {
      this.metrics.successfulRequests++;
    }

    // Update average processing time
    const currentAvg = this.metrics.averageProcessingTime;
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageProcessingTime =
      ((currentAvg * (totalRequests - 1)) + processingTime) / totalRequests;

    // Update average quality score
    const qualityScore = result.metadata.responseQuality || 0;
    const currentQualityAvg = this.metrics.averageQualityScore;
    const successfulRequests = this.metrics.successfulRequests;
    this.metrics.averageQualityScore =
      ((currentQualityAvg * (successfulRequests - 1)) + qualityScore) / successfulRequests;

    // Track optimization improvements
    if (result.metadata.optimized) {
      this.metrics.optimizationImprovements++;
    }
  }

  /**
   * Get comprehensive orchestrator metrics
   * @returns {Object} Orchestrator metrics
   */
  getMetrics() {
    const successRate = this.metrics.totalRequests > 0 ?
      (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0;

    return {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      successRate: successRate.toFixed(1) + '%',
      averageProcessingTime: this.metrics.averageProcessingTime.toFixed(0) + 'ms',
      averageQualityScore: this.metrics.averageQualityScore.toFixed(2),
      optimizationImprovements: this.metrics.optimizationImprovements,
      errorRecoveries: this.metrics.errorRecoveries,
      currentQueueSize: this.requestQueue.length,
      activeRequests: this.activeRequests.size,
      qualityTrend: this.getQualityTrend()
    };
  }

  /**
   * Get quality trend analysis
   * @returns {Object} Quality trend
   */
  getQualityTrend() {
    if (this.qualityHistory.length < 10) {
      return { trend: 'insufficient_data', direction: 'unknown' };
    }

    const recent = this.qualityHistory.slice(-20);
    const older = this.qualityHistory.slice(-40, -20);

    const recentAvg = recent.reduce((sum, q) => sum + q.qualityScore, 0) / recent.length;
    const olderAvg = older.length > 0 ?
      older.reduce((sum, q) => sum + q.qualityScore, 0) / older.length : recentAvg;

    const difference = recentAvg - olderAvg;

    if (Math.abs(difference) < 0.05) {
      return { trend: 'stable', direction: 'neutral', change: difference.toFixed(3) };
    } else if (difference > 0) {
      return { trend: 'improving', direction: 'up', change: `+${difference.toFixed(3)}` };
    } else {
      return { trend: 'declining', direction: 'down', change: difference.toFixed(3) };
    }
  }
}

// Export singleton instance
const enhancedEnsembleOrchestrator = new EnhancedEnsembleOrchestrator();
module.exports = enhancedEnsembleOrchestrator;
