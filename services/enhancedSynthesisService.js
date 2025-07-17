/**
 * Enhanced Synthesis Service - Robust response synthesis with error handling
 */

const { OpenAI } = require('openai');
const dynamicConfig = require('../config/dynamicConfig');
const monitoringService = require('./monitoringService');
const {
  SynthesisError,
  ModelFailureError,
  errorHandler,
  retryWithBackoff
} = require('../utils/errorHandler');

class EnhancedSynthesisService {
  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
      // Note: timeout should be passed in individual requests, not in constructor
    });

    // Store timeout for use in requests
    this.requestTimeout = dynamicConfig.synthesis.timeout;

    // Synthesis metrics
    this.metrics = {
      totalSyntheses: 0,
      successfulSyntheses: 0,
      fallbacksUsed: 0,
      retriesPerformed: 0,
      averageProcessingTime: 0
    };

    console.log('🚀 Enhanced Synthesis Service initialized with robust error handling');
    console.log(`   Timeout: ${dynamicConfig.synthesis.timeout}ms`);
    console.log(`   Model: ${dynamicConfig.synthesis.model}`);
    console.log(`   Max Tokens: ${dynamicConfig.synthesis.maxTokens}`);
  }

  async synthesizeWithEnhancements(roleOutputs, userPrompt, correlationId, votingResult = {}, userId = null, sessionId = null) {
    const startTime = Date.now();
    this.metrics.totalSyntheses++;

    try {
      monitoringService.log('info', 'Starting enhanced synthesis', {
        roleOutputsCount: roleOutputs.length,
        userId,
        sessionId
      }, correlationId);

      // Validate inputs
      if (!roleOutputs || roleOutputs.length === 0) {
        throw new SynthesisError('No role outputs provided for synthesis', 'enhanced', null, {
          correlationId,
          userId,
          sessionId
        });
      }

      const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled' && r.content);
      if (successfulOutputs.length === 0) {
        // Use fallback for no successful outputs
        return this.createFallbackSynthesis(roleOutputs, userPrompt, correlationId, 'no_successful_outputs');
      }

      // Create synthesis operation with retry logic
      const synthesisOperation = async (attempt) => {
        monitoringService.log('debug', `Synthesis attempt ${attempt}`, {
          successfulOutputsCount: successfulOutputs.length
        }, correlationId);

        const prompt = this.createSynthesisPrompt(successfulOutputs, userPrompt, votingResult);

        try {
          const response = await this.openaiClient.chat.completions.create({
            model: dynamicConfig.synthesis.model,
            messages: [
              {
                role: 'system',
                content: this.getSynthesisSystemPrompt(userPrompt, successfulOutputs.length)
              },
              { role: 'user', content: prompt }
            ],
            max_tokens: dynamicConfig.synthesis.maxTokens,
            temperature: dynamicConfig.synthesis.temperature || 0.3,
            top_p: 0.9
          });

          if (!response.choices || !response.choices[0] || !response.choices[0].message) {
            throw new SynthesisError('Invalid OpenAI response structure', 'enhanced', null, {
              correlationId,
              response: JSON.stringify(response)
            });
          }

          const content = response.choices[0].message.content;
          if (!content || content.trim().length < 10) {
            throw new SynthesisError('Synthesis response too short or empty', 'enhanced', null, {
              correlationId,
              contentLength: content?.length || 0
            });
          }

          return {
            content,
            model: dynamicConfig.synthesis.model,
            provider: 'openai',
            status: 'success',
            processingTime: Date.now() - startTime,
            attempt,
            confidence: this.calculateSynthesisConfidence(content, successfulOutputs, dynamicConfig.synthesis.model)
          };

        } catch (apiError) {
          // Classify and wrap API errors
          if (apiError.code === 'insufficient_quota' || apiError.message?.includes('quota')) {
            throw new ModelFailureError('OpenAI quota exceeded', 'openai', dynamicConfig.synthesis.model, apiError, {
              correlationId,
              isRetryable: false
            });
          }

          if (apiError.code === 'rate_limit_exceeded' || apiError.message?.includes('rate_limit')) {
            throw new ModelFailureError('OpenAI rate limit exceeded', 'openai', dynamicConfig.synthesis.model, apiError, {
              correlationId,
              isRetryable: true
            });
          }

          throw new ModelFailureError('OpenAI API call failed', 'openai', dynamicConfig.synthesis.model, apiError, {
            correlationId,
            attempt
          });
        }
      };

      // Execute synthesis with error handling and retries
      const result = await errorHandler.handleOperationalError(
        new SynthesisError('Synthesis operation failed', 'enhanced'),
        synthesisOperation,
        {
          serviceName: 'synthesis',
          correlationId,
          fallback: () => this.createFallbackSynthesis(successfulOutputs, userPrompt, correlationId, 'synthesis_failed'),
          retryOptions: {
            maxAttempts: 3,
            baseDelayMs: 1000,
            maxDelayMs: 10000,
            onRetry: (error, attempt, delay) => {
              this.metrics.retriesPerformed++;
              monitoringService.log('warn', `Synthesis retry ${attempt}`, {
                error: error.message,
                delay: `${delay}ms`
              }, correlationId);
            }
          },
          circuitBreakerOptions: {
            failureThreshold: 5,
            resetTimeout: 60000
          }
        }
      );

      // Update metrics on success
      this.metrics.successfulSyntheses++;
      this.updateAverageProcessingTime(Date.now() - startTime);

      monitoringService.log('info', 'Enhanced synthesis completed successfully', {
        processingTime: `${Date.now() - startTime}ms`,
        contentLength: result.content.length,
        attempt: result.attempt || 1
      }, correlationId);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      monitoringService.log('error', 'Enhanced synthesis failed completely', {
        error: error.message,
        processingTime: `${processingTime}ms`,
        errorType: error.constructor.name
      }, correlationId);

      // Return fallback response
      this.metrics.fallbacksUsed++;
      return this.createFallbackSynthesis(roleOutputs, userPrompt, correlationId, 'complete_failure', error);
    }
  }

  /**
   * Create optimized synthesis prompt with enhanced instructions
   */
  createSynthesisPrompt(successfulOutputs, userPrompt, votingResult = {}) {
    // Analyze response types and content quality
    const responseAnalysis = this.analyzeResponseTypes(successfulOutputs);

    const responses = successfulOutputs.map((output, index) => {
      const model = output.model || output.metadata?.model || `Model ${index + 1}`;
      const confidence = output.confidence?.score || 'unknown';
      const wordCount = output.wordCount || 0;
      const quality = output.quality?.complexity || 'unknown';

      return `[${model} - Confidence: ${confidence}, Words: ${wordCount}, Quality: ${quality}]\n${output.content}`;
    }).join('\n\n---\n\n');

    let prompt = `User Query: "${userPrompt}"\n\nAI Responses to Synthesize:\n${responses}`;

    // Add enhanced voting context
    if (votingResult.winner) {
      prompt += `\n\nVoting Analysis:\n- Winning Response: ${votingResult.winner}\n- Consensus Level: ${votingResult.consensus || 'unknown'}\n- Confidence: ${votingResult.confidence || 'unknown'}`;
    }

    // Add response type analysis
    if (responseAnalysis.hasExplanations || responseAnalysis.hasMultipleJokes) {
      prompt += `\n\nResponse Analysis:\n- Contains explanations: ${responseAnalysis.hasExplanations}\n- Multiple responses: ${responseAnalysis.hasMultipleJokes}\n- Dominant style: ${responseAnalysis.dominantStyle}`;
    }

    // Enhanced synthesis instructions based on content type
    const instructions = this.generateSynthesisInstructions(userPrompt, responseAnalysis);
    prompt += `\n\n${instructions}`;

    return prompt;
  }

  /**
   * Analyze response types and characteristics
   */
  analyzeResponseTypes(outputs) {
    const analysis = {
      hasExplanations: false,
      hasMultipleJokes: false,
      dominantStyle: 'informative',
      avgWordCount: 0,
      responseTypes: []
    };

    let totalWords = 0;
    const styles = { informative: 0, conversational: 0, technical: 0, humorous: 0 };

    outputs.forEach(output => {
      const content = output.content || '';
      const wordCount = content.split(/\s+/).length;
      totalWords += wordCount;

      // Detect explanations
      if (content.includes('because') || content.includes('explanation') || content.includes('meaning')) {
        analysis.hasExplanations = true;
      }

      // Detect multiple jokes/responses
      if (content.includes('Why don\'t') || content.includes('Here\'s a joke')) {
        analysis.hasMultipleJokes = true;
        styles.humorous++;
      }

      // Detect style patterns
      if (content.includes('?') && content.includes('!')) styles.conversational++;
      if (content.includes('analysis') || content.includes('technical')) styles.technical++;
      if (wordCount > 100) styles.informative++;
    });

    analysis.avgWordCount = Math.round(totalWords / outputs.length);
    analysis.dominantStyle = Object.keys(styles).reduce((a, b) => styles[a] > styles[b] ? a : b);

    return analysis;
  }

  /**
   * Generate context-aware synthesis instructions
   */
  generateSynthesisInstructions(userPrompt, analysis) {
    const promptLower = userPrompt.toLowerCase();

    // Detect request type
    if (promptLower.includes('joke') || promptLower.includes('funny')) {
      return `Instructions: Create a synthesized response that:
1. Presents the best joke(s) from the responses clearly
2. If multiple jokes are provided, choose the most appropriate one or combine them creatively
3. Add brief, engaging explanation if explanations are present
4. Maintain the humor while being concise and well-structured
5. Ensure the response directly addresses the user's request for humor`;
    }

    if (promptLower.includes('explain') || promptLower.includes('how') || promptLower.includes('why')) {
      return `Instructions: Create a comprehensive explanation that:
1. Synthesizes the best explanatory elements from all responses
2. Maintains logical flow and clarity
3. Combines different perspectives where valuable
4. Provides complete, accurate information
5. Uses clear, accessible language appropriate for the question`;
    }

    // Default instructions for general queries
    return `Instructions: Create a comprehensive, well-structured response that:
1. Synthesizes the best insights from all AI responses
2. Maintains factual accuracy and logical coherence
3. Provides added value through intelligent combination
4. Uses clear, engaging language appropriate for the query
5. Ensures the response directly and completely addresses the user's request`;
  }

  /**
   * Create intelligent fallback synthesis when main synthesis fails
   */
  createFallbackSynthesis(roleOutputs, userPrompt, correlationId, reason = 'unknown', error = null) {
    monitoringService.log('warn', `Creating intelligent fallback synthesis: ${reason}`, {
      roleOutputsCount: roleOutputs.length,
      error: error?.message
    }, correlationId);

    this.metrics.fallbacksUsed++;

    // Try to extract content from successful outputs
    const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled' && r.content);

    if (successfulOutputs.length === 0) {
      return {
        content: 'I apologize, but I\'m unable to provide a response at this time due to technical difficulties. Please try again in a moment.',
        model: 'fallback-empty',
        provider: 'system',
        status: 'fallback',
        reason,
        confidence: { score: 0.1, level: 'very-low', factors: ['No successful responses'] },
        fallbackUsed: true
      };
    }

    // Intelligent fallback synthesis
    let fallbackContent;
    const confidence = this.calculateFallbackConfidence(successfulOutputs, userPrompt);

    if (successfulOutputs.length === 1) {
      // Single response - use as-is but add context
      const output = successfulOutputs[0];
      fallbackContent = output.content;

      return {
        content: fallbackContent,
        model: 'fallback-single',
        provider: 'system',
        status: 'fallback',
        reason,
        confidence: {
          score: Math.min(0.8, confidence.score + 0.2),
          level: confidence.level,
          factors: ['Single high-quality response', ...confidence.factors]
        },
        fallbackUsed: true,
        sourceCount: 1,
        originalModel: output.model
      };
    }

    // Multiple responses - intelligent combination
    fallbackContent = this.createIntelligentCombination(successfulOutputs, userPrompt);

    return {
      content: fallbackContent,
      model: 'fallback-synthesis',
      provider: 'system',
      status: 'fallback',
      reason,
      confidence: {
        score: confidence.score,
        level: confidence.level,
        factors: confidence.factors
      },
      fallbackUsed: true,
      sourceCount: successfulOutputs.length
    };
  }

  /**
   * Calculate confidence for fallback synthesis
   */
  calculateFallbackConfidence(outputs, userPrompt) {
    let score = 0.3; // Base fallback score
    const factors = [];

    // Quality factors
    const avgWordCount = outputs.reduce((sum, o) => sum + (o.wordCount || 0), 0) / outputs.length;
    if (avgWordCount > 50) {
      score += 0.1;
      factors.push('Adequate response length');
    }
    if (avgWordCount > 100) {
      score += 0.1;
      factors.push('Comprehensive responses');
    }

    // Confidence factors
    const avgConfidence = outputs.reduce((sum, o) => sum + (o.confidence?.score || 0.5), 0) / outputs.length;
    if (avgConfidence > 0.7) {
      score += 0.15;
      factors.push('High individual confidence');
    }

    // Response time factors
    const avgResponseTime = outputs.reduce((sum, o) => sum + (o.responseTime || 5000), 0) / outputs.length;
    if (avgResponseTime < 3000) {
      score += 0.05;
      factors.push('Fast response times');
    }

    // Content relevance
    const promptWords = userPrompt.toLowerCase().split(/\s+/);
    const hasRelevantContent = outputs.some(o =>
      promptWords.some(word => o.content.toLowerCase().includes(word))
    );
    if (hasRelevantContent) {
      score += 0.1;
      factors.push('Content relevance detected');
    }

    const finalScore = Math.min(0.85, Math.max(0.1, score)); // Cap fallback confidence
    const level = finalScore > 0.7 ? 'high' : finalScore > 0.5 ? 'medium' : finalScore > 0.3 ? 'low' : 'very-low';

    return { score: finalScore, level, factors };
  }

  /**
   * Create intelligent combination of multiple responses
   */
  createIntelligentCombination(outputs, userPrompt) {
    const promptLower = userPrompt.toLowerCase();

    // Sort outputs by confidence and quality
    const sortedOutputs = outputs.sort((a, b) => {
      const scoreA = (a.confidence?.score || 0.5) * (a.wordCount > 20 ? 1.1 : 1.0);
      const scoreB = (b.confidence?.score || 0.5) * (b.wordCount > 20 ? 1.1 : 1.0);
      return scoreB - scoreA;
    });

    // Handle specific request types
    if (promptLower.includes('joke') || promptLower.includes('funny')) {
      return this.combineHumorousResponses(sortedOutputs);
    }

    if (promptLower.includes('explain') || promptLower.includes('how') || promptLower.includes('why')) {
      return this.combineExplanatoryResponses(sortedOutputs);
    }

    // Default intelligent combination
    return this.combineGeneralResponses(sortedOutputs);
  }

  /**
   * Combine humorous responses intelligently
   */
  combineHumorousResponses(outputs) {
    const jokes = outputs.filter(o =>
      o.content.includes('Why') || o.content.includes('joke') || o.content.includes('?')
    );

    if (jokes.length === 0) {
      return outputs[0].content; // Fallback to best response
    }

    // Find the best joke and any explanations
    const bestJoke = jokes[0];
    const explanations = outputs.filter(o =>
      o.content.includes('meaning') || o.content.includes('because') || o.content.length > 100
    );

    let combined = bestJoke.content;

    // Add explanation if available and valuable
    if (explanations.length > 0 && !bestJoke.content.includes('meaning')) {
      const explanation = explanations[0];
      if (explanation.content.length > bestJoke.content.length) {
        // Use the explanation as it likely contains the joke plus more
        combined = explanation.content;
      }
    }

    return combined;
  }

  /**
   * Combine explanatory responses
   */
  combineExplanatoryResponses(outputs) {
    // Find the most comprehensive explanation
    const comprehensive = outputs.find(o => o.wordCount > 80) || outputs[0];
    return comprehensive.content;
  }

  /**
   * Combine general responses
   */
  combineGeneralResponses(outputs) {
    if (outputs.length === 1) return outputs[0].content;

    // Use the highest quality response as base
    const primary = outputs[0];

    // Check if other responses add significant value
    const additionalValue = outputs.slice(1).find(o =>
      o.wordCount > primary.wordCount * 1.5 ||
      (o.confidence?.score || 0) > (primary.confidence?.score || 0) + 0.2
    );

    if (additionalValue) {
      return `${primary.content}\n\nAdditional perspective: ${additionalValue.content}`;
    }

    return primary.content;
  }

  /**
   * Update average processing time metric
   */
  updateAverageProcessingTime(processingTime) {
    const total = this.metrics.successfulSyntheses;
    if (total === 1) {
      this.metrics.averageProcessingTime = processingTime;
    } else {
      this.metrics.averageProcessingTime = ((this.metrics.averageProcessingTime * (total - 1)) + processingTime) / total;
    }
  }

  /**
   * Get synthesis service metrics
   */
  getMetrics() {
    const successRate = this.metrics.totalSyntheses > 0
      ? (this.metrics.successfulSyntheses / this.metrics.totalSyntheses * 100).toFixed(2)
      : '0.00';

    const fallbackRate = this.metrics.totalSyntheses > 0
      ? (this.metrics.fallbacksUsed / this.metrics.totalSyntheses * 100).toFixed(2)
      : '0.00';

    return {
      totalSyntheses: this.metrics.totalSyntheses,
      successfulSyntheses: this.metrics.successfulSyntheses,
      fallbacksUsed: this.metrics.fallbacksUsed,
      retriesPerformed: this.metrics.retriesPerformed,
      successRate: `${successRate}%`,
      fallbackRate: `${fallbackRate}%`,
      averageProcessingTime: `${this.metrics.averageProcessingTime.toFixed(0)}ms`,
      circuitBreakerStatus: errorHandler.getCircuitBreakerStatus().synthesis || { state: 'CLOSED' }
    };
  }

  /**
   * Health check with error handling validation
   */
  async healthCheck() {
    try {
      // Test basic OpenAI connectivity with synthesis model
      const testResponse = await this.openaiClient.chat.completions.create({
        model: dynamicConfig.synthesis.model, // Use same model as synthesis for consistency
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 10
      });

      const circuitBreakerStatus = errorHandler.getCircuitBreakerStatus().synthesis;

      return {
        status: 'healthy',
        openaiConnectivity: true,
        model: dynamicConfig.synthesis.model,
        timeout: dynamicConfig.synthesis.timeout,
        metrics: this.getMetrics(),
        circuitBreaker: circuitBreakerStatus || { state: 'CLOSED' }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        openaiConnectivity: false,
        metrics: this.getMetrics()
      };
    }
  }

  /**
   * Get context-aware system prompt for synthesis
   */
  getSynthesisSystemPrompt(userPrompt, responseCount) {
    const promptLower = userPrompt.toLowerCase();

    if (promptLower.includes('joke') || promptLower.includes('funny')) {
      return `You are an expert AI synthesizer specializing in humor. Your task is to create the best possible humorous response by intelligently combining insights from ${responseCount} AI responses. Focus on clarity, wit, and engagement while maintaining the humor's effectiveness.`;
    }

    if (promptLower.includes('explain') || promptLower.includes('how') || promptLower.includes('why')) {
      return `You are an expert AI synthesizer specializing in explanations. Your task is to create comprehensive, clear explanations by combining insights from ${responseCount} AI responses. Focus on accuracy, clarity, and completeness while maintaining logical flow.`;
    }

    return `You are an expert AI synthesizer. Your task is to create comprehensive, well-structured responses by intelligently combining the best insights from ${responseCount} AI models. Focus on accuracy, clarity, and added value through synthesis.`;
  }

  /**
   * Calculate synthesis confidence based on content quality and model used
   */
  calculateSynthesisConfidence(content, originalOutputs, model) {
    let score = 0.5; // Base synthesis score
    const factors = [];

    // Content quality factors
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 50) {
      score += 0.1;
      factors.push('Adequate length');
    }
    if (wordCount > 100) {
      score += 0.1;
      factors.push('Comprehensive response');
    }

    // Structure factors
    if (content.includes('.') && content.includes(' ')) {
      score += 0.05;
      factors.push('Well-structured');
    }
    if (content.includes('\n') || content.includes(':')) {
      score += 0.05;
      factors.push('Good formatting');
    }

    // Model quality factor
    if (model === 'gpt-4o-mini' || model.includes('gpt-4')) {
      score += 0.1;
      factors.push('High-quality model');
    }

    // Original response quality factor
    const avgOriginalConfidence = originalOutputs.reduce((sum, o) =>
      sum + (o.confidence?.score || 0.5), 0) / originalOutputs.length;
    if (avgOriginalConfidence > 0.7) {
      score += 0.1;
      factors.push('High source quality');
    }

    // Synthesis value factor (check if it's more than just concatenation)
    const isSimpleConcatenation = originalOutputs.some(o =>
      content.includes(o.content?.substring(0, 50) || '')
    );
    if (!isSimpleConcatenation) {
      score += 0.1;
      factors.push('Added synthesis value');
    }

    const finalScore = Math.min(0.95, Math.max(0.3, score));
    const level = finalScore > 0.8 ? 'very-high' :
                  finalScore > 0.6 ? 'high' :
                  finalScore > 0.4 ? 'medium' : 'low';

    return { score: finalScore, level, factors };
  }
}

module.exports = new EnhancedSynthesisService();