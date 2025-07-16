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
      apiKey: process.env.OPENAI_API_KEY,
      timeout: dynamicConfig.synthesis.timeout
    });

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
                content: 'You are an expert AI synthesizer. Create comprehensive, well-structured responses that combine the best insights from multiple AI models.'
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
            confidence: { score: 0.8, level: 'high' }
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
   * Create optimized synthesis prompt
   */
  createSynthesisPrompt(successfulOutputs, userPrompt, votingResult = {}) {
    const responses = successfulOutputs.map((output, index) => {
      const model = output.model || output.metadata?.model || `Model ${index + 1}`;
      const confidence = output.confidence?.score || 'unknown';
      return `[${model} - Confidence: ${confidence}]\n${output.content}`;
    }).join('\n\n');

    let prompt = `User Query: ${userPrompt}\n\nAI Responses to Synthesize:\n${responses}`;

    // Add voting context if available
    if (votingResult.winner) {
      prompt += `\n\nVoting Analysis:\n- Winning Response: ${votingResult.winner}\n- Consensus Level: ${votingResult.consensus || 'unknown'}`;
    }

    prompt += `\n\nInstructions: Create a comprehensive, well-structured response that synthesizes the best insights from all AI responses. Maintain factual accuracy while providing added value through synthesis.`;

    return prompt;
  }

  /**
   * Create fallback synthesis when main synthesis fails
   */
  createFallbackSynthesis(roleOutputs, userPrompt, correlationId, reason = 'unknown', error = null) {
    monitoringService.log('warn', `Creating fallback synthesis: ${reason}`, {
      roleOutputsCount: roleOutputs.length,
      error: error?.message
    }, correlationId);

    this.metrics.fallbacksUsed++;

    // Try to extract content from successful outputs
    const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled' && r.content);

    if (successfulOutputs.length === 0) {
      return {
        content: 'I apologize, but I\'m unable to provide a response at this time due to technical difficulties. Please try again in a moment.',
        model: 'fallback',
        provider: 'system',
        status: 'fallback',
        reason,
        confidence: { score: 0.1, level: 'very-low' },
        fallbackUsed: true
      };
    }

    // Simple concatenation fallback
    let fallbackContent;
    if (successfulOutputs.length === 1) {
      fallbackContent = successfulOutputs[0].content;
    } else {
      // Create simple synthesis by combining responses
      fallbackContent = `Based on multiple AI analyses:\n\n${successfulOutputs.map((output, index) => {
        const model = output.model || `AI ${index + 1}`;
        return `${model}: ${output.content}`;
      }).join('\n\n')}`;
    }

    return {
      content: fallbackContent,
      model: 'fallback-synthesis',
      provider: 'system',
      status: 'fallback',
      reason,
      confidence: { score: 0.4, level: 'low' },
      fallbackUsed: true,
      sourceCount: successfulOutputs.length
    };
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
      // Test basic OpenAI connectivity
      const testResponse = await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
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
}

module.exports = new EnhancedSynthesisService();