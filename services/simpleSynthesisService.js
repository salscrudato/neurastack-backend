/**
 * 🔄 Simple Synthesis Service - Streamlined AI Response Synthesis
 *
 * 🎯 PURPOSE: Create synthesized responses from multiple AI outputs
 *            Simplified approach focusing on core functionality
 *
 * 📋 KEY FEATURES:
 * 1. Basic synthesis using OpenAI GPT model
 * 2. Simple prompt engineering for different request types
 * 3. Fallback handling for failed synthesis
 * 4. Maintains required response structure
 * 5. Clear, readable logic with comprehensive comments
 *
 * 💡 PHILOSOPHY: Simple, reliable synthesis without complex validation
 *    Focus on creating coherent, useful responses efficiently
 */

const monitoringService = require('./monitoringService');
const dynamicConfig = require('../config/dynamicConfig');

class SimpleSynthesisService {
  constructor() {
    // Initialize OpenAI client
    this.openaiClient = require('./vendorClients').openai;
    
    // Basic metrics tracking
    this.metrics = {
      totalSyntheses: 0,
      successfulSyntheses: 0,
      fallbacksUsed: 0,
      averageProcessingTime: 0
    };

    // Simple synthesis configuration
    this.config = {
      model: 'gpt-4o-mini',           // Fast, cost-effective model
      maxTokens: 800,                // Reasonable response length
      temperature: 0.3,              // Balanced creativity/consistency
      timeout: 10000                 // 10 second timeout
    };

    console.log('🔄 Simple Synthesis Service initialized');
    console.log(`   Model: ${this.config.model}, Max Tokens: ${this.config.maxTokens}, Temperature: ${this.config.temperature}`);
  }

  /**
   * Main synthesis method - simplified but maintains functionality
   *
   * This method replaces the complex enhanced synthesis service with a streamlined
   * approach that focuses on core functionality. It combines multiple AI responses
   * into a single, coherent response using simple prompt engineering.
   *
   * Process:
   * 1. Filter successful AI responses
   * 2. Create synthesis prompt based on request type
   * 3. Call OpenAI to synthesize responses
   * 4. Handle errors with intelligent fallbacks
   * 5. Return result in expected format
   *
   * Removed complexity:
   * - Complex validation and post-processing
   * - Advanced prompt analysis
   * - Multi-layer error handling with circuit breakers
   * - Detailed quality metrics
   *
   * @param {Array} roleOutputs - Array of AI role responses
   * @param {string} userPrompt - Original user prompt
   * @param {string} correlationId - Request correlation ID
   * @param {Object} votingResult - Voting results (optional, unused in simplified version)
   * @param {string} userId - User ID (optional, for logging)
   * @param {string} sessionId - Session ID (optional, for logging)
   * @returns {Object} Synthesis result with content, model, status, etc.
   */
  async synthesizeWithEnhancements(roleOutputs, userPrompt, correlationId, votingResult = {}, userId = null, sessionId = null) {
    const startTime = Date.now();
    this.metrics.totalSyntheses++;

    try {
      // Step 1: Filter successful responses - only use responses with actual content
      const successfulOutputs = roleOutputs.filter(r =>
        r.status === 'fulfilled' &&
        r.content &&
        r.content.trim().length > 0
      );

      // Handle edge case: no successful responses to synthesize
      if (successfulOutputs.length === 0) {
        return this.createFallbackSynthesis(roleOutputs, userPrompt, correlationId, 'no_successful_outputs');
      }

      // Step 2: Create synthesis prompt using simple prompt engineering
      // Replaces complex prompt analysis with straightforward formatting
      const synthesisPrompt = this.createSimpleSynthesisPrompt(successfulOutputs, userPrompt);
      const systemPrompt = this.getSystemPrompt(userPrompt, successfulOutputs.length);

      // Step 3: Call OpenAI API for synthesis
      // Uses fast, cost-effective model with reasonable parameters
      const response = await this.callSynthesisAPI(systemPrompt, synthesisPrompt, correlationId);

      // Validate response quality (basic check)
      if (!response || !response.content || response.content.trim().length < 10) {
        return this.createFallbackSynthesis(successfulOutputs, userPrompt, correlationId, 'synthesis_too_short');
      }

      // Step 4: Create successful synthesis result
      const result = {
        content: response.content,
        model: this.config.model,
        provider: 'openai',
        status: 'success',
        processingTime: Date.now() - startTime,
        sourceCount: successfulOutputs.length
      };

      // Update metrics and log success
      this.updateMetrics(Date.now() - startTime, true);

      monitoringService.log('info', 'Synthesis completed successfully', {
        processingTime: result.processingTime,
        sourceCount: result.sourceCount,
        contentLength: result.content.length
      }, correlationId);

      return result;

    } catch (error) {
      // Step 5: Handle synthesis failure with fallback
      monitoringService.log('error', 'Synthesis failed, using fallback', {
        error: error.message,
        userId,
        sessionId
      }, correlationId);

      this.updateMetrics(Date.now() - startTime, false);
      return this.createFallbackSynthesis(roleOutputs, userPrompt, correlationId, 'synthesis_error', error);
    }
  }

  /**
   * Create simple synthesis prompt based on successful outputs
   * @param {Array} successfulOutputs - Filtered successful responses
   * @param {string} userPrompt - Original user prompt
   * @returns {string} Synthesis prompt
   */
  createSimpleSynthesisPrompt(successfulOutputs, userPrompt) {
    // Format responses with simple labels
    const formattedResponses = successfulOutputs.map((output, index) => {
      const model = output.model || output.metadata?.model || `AI Model ${index + 1}`;
      return `${model}: ${output.content}`;
    }).join('\n\n---\n\n');

    // Create synthesis request
    const prompt = `User's original question: "${userPrompt}"

Here are responses from ${successfulOutputs.length} different AI models:

${formattedResponses}

Please create a synthesized response that combines the best insights from these responses. ${this.getSynthesisInstructions(userPrompt)}`;

    return prompt;
  }

  /**
   * Get synthesis instructions based on request type
   * @param {string} userPrompt - Original user prompt
   * @returns {string} Specific instructions for synthesis
   */
  getSynthesisInstructions(userPrompt) {
    const promptLower = userPrompt.toLowerCase();

    // Joke/humor requests
    if (promptLower.includes('joke') || promptLower.includes('funny') || promptLower.includes('humor')) {
      return 'Focus on presenting the best joke(s) clearly and add brief explanation if helpful. Keep it engaging and fun.';
    }

    // Explanation requests
    if (promptLower.includes('explain') || promptLower.includes('how') || promptLower.includes('why')) {
      return 'Create a clear, comprehensive explanation that combines the best insights. Focus on accuracy and clarity.';
    }

    // Comparison requests
    if (promptLower.includes('compare') || promptLower.includes('difference') || promptLower.includes('versus')) {
      return 'Provide a balanced comparison that incorporates insights from all responses. Be objective and thorough.';
    }

    // List/recommendation requests
    if (promptLower.includes('list') || promptLower.includes('recommend') || promptLower.includes('suggest')) {
      return 'Combine the suggestions into a well-organized, helpful response. Remove duplicates and add value.';
    }

    // Default instructions
    return 'Create a comprehensive, well-structured response that synthesizes the best insights. Be accurate, clear, and helpful.';
  }

  /**
   * Get system prompt for synthesis
   * @param {string} userPrompt - Original user prompt
   * @param {number} responseCount - Number of responses to synthesize
   * @returns {string} System prompt
   */
  getSystemPrompt(userPrompt, responseCount) {
    return `You are an expert AI synthesizer. Your task is to create a high-quality response by intelligently combining insights from ${responseCount} different AI models.

Guidelines:
1. Synthesize the best information from all responses
2. Maintain factual accuracy and logical coherence
3. Create added value through intelligent combination
4. Use clear, engaging language
5. Directly address the user's request
6. Be concise but comprehensive
7. Avoid simply concatenating responses

Create a response that is better than any individual input by leveraging the strengths of each.`;
  }

  /**
   * Call OpenAI API for synthesis with error handling
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @param {string} correlationId - Correlation ID
   * @returns {Object} API response
   */
  async callSynthesisAPI(systemPrompt, userPrompt, correlationId) {
    try {
      const response = await this.openaiClient.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        top_p: 0.9
      });

      if (!response.choices || !response.choices[0] || !response.choices[0].message) {
        throw new Error('Invalid OpenAI response structure');
      }

      return {
        content: response.choices[0].message.content,
        usage: response.usage
      };

    } catch (error) {
      monitoringService.log('error', 'OpenAI synthesis API call failed', {
        error: error.message,
        model: this.config.model
      }, correlationId);
      throw error;
    }
  }

  /**
   * Create fallback synthesis when main synthesis fails
   * @param {Array} roleOutputs - Original role outputs
   * @param {string} userPrompt - Original user prompt
   * @param {string} correlationId - Correlation ID
   * @param {string} reason - Reason for fallback
   * @param {Error} error - Original error (optional)
   * @returns {Object} Fallback synthesis result
   */
  createFallbackSynthesis(roleOutputs, userPrompt, correlationId, reason = 'unknown', error = null) {
    this.metrics.fallbacksUsed++;
    
    monitoringService.log('warn', `Creating fallback synthesis: ${reason}`, {
      roleOutputsCount: roleOutputs.length,
      error: error?.message
    }, correlationId);

    // Find the best available response
    const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled' && r.content);
    
    if (successfulOutputs.length === 0) {
      return {
        content: "I apologize, but I'm unable to provide a response at this time. Please try again.",
        model: 'fallback-synthesis',
        provider: 'system',
        status: 'fallback',
        reason: 'no_successful_responses',
        fallbackUsed: true
      };
    }

    // Use the response with highest confidence or longest content as fallback
    const bestResponse = successfulOutputs.reduce((best, current) => {
      const bestScore = (best.confidence?.score || 0.5) + (best.content?.length || 0) * 0.001;
      const currentScore = (current.confidence?.score || 0.5) + (current.content?.length || 0) * 0.001;
      return currentScore > bestScore ? current : best;
    });

    // Create simple synthesis from best response
    let synthesizedContent = bestResponse.content;
    
    // Add context from other responses if available and different
    const otherResponses = successfulOutputs.filter(r => r !== bestResponse);
    if (otherResponses.length > 0) {
      const additionalInsights = otherResponses
        .filter(r => r.content.length > 50 && !this.isContentSimilar(r.content, bestResponse.content))
        .slice(0, 2); // Limit to 2 additional insights

      if (additionalInsights.length > 0) {
        synthesizedContent += '\n\nAdditional insights:\n' + 
          additionalInsights.map(r => `• ${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}`).join('\n');
      }
    }

    return {
      content: synthesizedContent,
      model: 'fallback-synthesis',
      provider: 'system',
      status: 'fallback',
      reason,
      fallbackUsed: true,
      sourceCount: successfulOutputs.length
    };
  }

  /**
   * Check if two content strings are similar (simple heuristic)
   * @param {string} content1 - First content
   * @param {string} content2 - Second content
   * @returns {boolean} True if similar
   */
  isContentSimilar(content1, content2) {
    // Simple similarity check based on common words
    const words1 = new Set(content1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(content2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size > 0.6; // 60% similarity threshold
  }

  /**
   * Update service metrics
   * @param {number} processingTime - Processing time in milliseconds
   * @param {boolean} success - Whether synthesis was successful
   */
  updateMetrics(processingTime, success) {
    // Update average processing time
    this.metrics.averageProcessingTime = 
      (this.metrics.averageProcessingTime * (this.metrics.totalSyntheses - 1) + processingTime) / this.metrics.totalSyntheses;
    
    // Update success count
    if (success) {
      this.metrics.successfulSyntheses++;
    }
  }

  /**
   * Get service metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalSyntheses > 0 ? 
        this.metrics.successfulSyntheses / this.metrics.totalSyntheses : 0,
      status: 'healthy',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Health check for the service
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      // Simple health check - verify OpenAI client is available
      if (!this.openaiClient) {
        throw new Error('OpenAI client not available');
      }

      return {
        status: 'healthy',
        metrics: this.getMetrics(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new SimpleSynthesisService();
