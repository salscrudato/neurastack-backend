/**
 * 🧠 Enhanced Synthesis Service - Advanced AI Response Synthesis
 *
 * 🎯 PURPOSE: Provide sophisticated response synthesis using dedicated models
 *            with conflict resolution, source citation, and context integration
 *
 * 📋 KEY FEATURES:
 * 1. Dedicated synthesizer model (GPT-4o) for high-quality synthesis
 * 2. Conflict resolution with source citation
 * 3. Hierarchical context integration for personalization
 * 4. Post-synthesis validation with quality scoring
 * 5. Threshold-based regeneration for quality assurance
 * 6. Comprehensive analytics and monitoring
 *
 * 💡 ANALOGY: Like having an expert editor who takes multiple expert opinions,
 *    resolves conflicts, cites sources, and creates a cohesive final document
 *    that's better than any individual contribution
 */

const { OpenAI } = require('openai');
const semanticConfidenceService = require('./semanticConfidenceService');
const { getHierarchicalContextManager } = require('./hierarchicalContextManager');
const monitoringService = require('./monitoringService');
const { v4: generateUUID } = require('uuid');

class EnhancedSynthesisService {
  constructor() {
    this.openaiClient = null;
    this.metrics = {
      totalSyntheses: 0,
      successfulSyntheses: 0,
      regenerations: 0,
      averageQualityScore: 0,
      averageProcessingTime: 0,
      conflictResolutions: 0,
      contextIntegrations: 0
    };
    
    // Quality thresholds for regeneration
    this.qualityThresholds = {
      readability: 0.6,      // Minimum readability score
      factualConsistency: 0.7, // Minimum factual consistency
      novelty: 0.5,          // Minimum novelty score
      overall: 0.65          // Minimum overall quality score
    };
    
    this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client for synthesis
   */
  initializeOpenAI() {
    try {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 60000,
        maxRetries: 2
      });
      console.log('✅ Enhanced Synthesis Service: OpenAI client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI client for synthesis:', error.message);
    }
  }

  /**
   * Main synthesis method with enhanced features
   * @param {Array} roleOutputs - Array of AI role responses
   * @param {string} userPrompt - Original user prompt
   * @param {string} correlationId - Request correlation ID
   * @param {Object} votingResult - Voting analysis results
   * @param {string} userId - User ID for context
   * @param {string} sessionId - Session ID for context
   * @returns {Promise<Object>} Enhanced synthesis result
   */
  async synthesizeWithEnhancements(roleOutputs, userPrompt, correlationId, votingResult = {}, userId = null, sessionId = null) {
    const startTime = Date.now();
    this.metrics.totalSyntheses++;

    try {
      console.log(`🔄 [${correlationId}] Starting enhanced synthesis with conflict resolution...`);

      // Step 1: Filter and prepare successful responses
      const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled');
      if (successfulOutputs.length === 0) {
        return this.createFallbackSynthesis(userPrompt, correlationId);
      }

      // Step 2: Get hierarchical context for personalization
      const contextData = await this.getHierarchicalContext(userId, sessionId, userPrompt, correlationId);

      // Step 3: Analyze conflicts and prepare synthesis strategy
      const conflictAnalysis = await this.analyzeConflicts(successfulOutputs, userPrompt);

      // Step 4: Perform enhanced synthesis
      const synthesisResult = await this.performEnhancedSynthesis(
        successfulOutputs,
        userPrompt,
        contextData,
        conflictAnalysis,
        votingResult,
        correlationId
      );

      // Step 5: Post-synthesis validation
      const validationResult = await this.validateSynthesis(
        synthesisResult,
        successfulOutputs,
        userPrompt,
        correlationId
      );

      // Step 6: Regenerate if quality is below threshold
      let finalResult = synthesisResult;
      if (!validationResult.passesThreshold && this.metrics.regenerations < 2) {
        console.log(`🔄 [${correlationId}] Quality below threshold, regenerating...`);
        finalResult = await this.regenerateSynthesis(
          successfulOutputs,
          userPrompt,
          contextData,
          conflictAnalysis,
          votingResult,
          validationResult,
          correlationId
        );
        this.metrics.regenerations++;
      }

      // Step 7: Update metrics and return
      const processingTime = Date.now() - startTime;
      this.updateMetrics(finalResult, validationResult, processingTime);
      
      console.log(`✅ [${correlationId}] Enhanced synthesis completed in ${processingTime}ms`);

      return {
        ...finalResult,
        validation: validationResult,
        contextIntegration: !!contextData.context,
        conflictResolution: conflictAnalysis.hasConflicts,
        processingTime,
        regenerated: finalResult !== synthesisResult
      };

    } catch (error) {
      console.error(`❌ [${correlationId}] Enhanced synthesis failed:`, error.message);
      return this.createErrorSynthesis(error, userPrompt, correlationId);
    }
  }

  /**
   * Get hierarchical context for personalization
   */
  async getHierarchicalContext(userId, sessionId, userPrompt, correlationId) {
    if (!userId || !sessionId) {
      return { context: null, structure: null };
    }

    try {
      const contextResult = await Promise.race([
        getHierarchicalContextManager().getHierarchicalContext(userId, sessionId, 800, userPrompt),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Context timeout')), 3000)
        )
      ]);

      if (contextResult.context) {
        this.metrics.contextIntegrations++;
        console.log(`🏗️ [${correlationId}] Retrieved context: ${contextResult.totalTokens} tokens`);
      }

      return contextResult;
    } catch (error) {
      console.warn(`⚠️ [${correlationId}] Context retrieval failed:`, error.message);
      return { context: null, structure: null };
    }
  }

  /**
   * Analyze conflicts between AI responses
   */
  async analyzeConflicts(outputs, userPrompt) {
    const conflicts = [];
    const modelNames = {
      gpt4o: 'GPT-4o',
      gemini: 'Gemini',
      claude: 'Claude'
    };

    // Simple conflict detection based on response similarity
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        const similarity = await this.calculateResponseSimilarity(outputs[i].content, outputs[j].content);
        
        if (similarity < 0.6) { // Low similarity indicates potential conflict
          conflicts.push({
            models: [modelNames[outputs[i].role] || outputs[i].role, modelNames[outputs[j].role] || outputs[j].role],
            similarity,
            type: 'content_divergence'
          });
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      totalComparisons: (outputs.length * (outputs.length - 1)) / 2
    };
  }

  /**
   * Calculate similarity between two responses using embeddings
   */
  async calculateResponseSimilarity(content1, content2) {
    try {
      // Use semantic confidence service for embedding-based similarity
      const embedding1 = await semanticConfidenceService.generateEmbedding(content1, `sim_${Date.now()}_1`);
      const embedding2 = await semanticConfidenceService.generateEmbedding(content2, `sim_${Date.now()}_2`);
      
      return semanticConfidenceService.cosineSimilarity(embedding1, embedding2);
    } catch (error) {
      console.warn('Failed to calculate response similarity:', error.message);
      return 0.8; // Default to high similarity if calculation fails
    }
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalSyntheses > 0 ? 
        (this.metrics.successfulSyntheses / this.metrics.totalSyntheses) : 0,
      regenerationRate: this.metrics.totalSyntheses > 0 ? 
        (this.metrics.regenerations / this.metrics.totalSyntheses) : 0
    };
  }

  /**
   * Perform enhanced synthesis with conflict resolution and source citation
   */
  async performEnhancedSynthesis(outputs, userPrompt, contextData, conflictAnalysis, votingResult, correlationId) {
    const modelNames = {
      gpt4o: 'GPT-4o',
      gemini: 'Gemini',
      claude: 'Claude'
    };

    // Build synthesis prompt with context and conflict resolution
    let synthesisPrompt = `You are an expert AI synthesizer. Your task is to create a superior response by combining insights from multiple AI models, resolving conflicts, and citing sources.

**Original User Question:**
${userPrompt}`;

    // Add hierarchical context if available
    if (contextData.context) {
      synthesisPrompt += `

**User Context & History:**
${contextData.context}

Please use this context to personalize your response and make it more relevant to the user's background and previous interactions.`;
    }

    // Add AI responses with source attribution
    synthesisPrompt += `

**AI Responses to Synthesize:**
`;

    outputs.forEach((output, index) => {
      const modelName = modelNames[output.role] || output.role;
      const confidence = output.semanticConfidence?.calibratedConfidence || output.confidence?.score || 0.5;

      synthesisPrompt += `
### ${modelName} Response (Confidence: ${(confidence * 100).toFixed(1)}%):
${output.content}
`;
    });

    // Add conflict resolution instructions if conflicts detected
    if (conflictAnalysis.hasConflicts) {
      synthesisPrompt += `

**CONFLICT RESOLUTION REQUIRED:**
The AI models provided different perspectives. Please:
1. Identify where the responses differ or conflict
2. Cite specific sources when presenting different viewpoints (e.g., "GPT-4o suggests X, while Claude argues Y")
3. Resolve conflicts by providing balanced analysis or explaining why one approach might be better
4. Create a cohesive response that addresses all valid points`;

      this.metrics.conflictResolutions++;
    }

    // Add synthesis instructions
    synthesisPrompt += `

**SYNTHESIS INSTRUCTIONS:**
1. Create a comprehensive response that combines the best insights from all models
2. When models agree, synthesize their shared insights into a stronger argument
3. When models disagree, cite sources and provide balanced analysis
4. Eliminate redundancy while preserving all unique valuable content
5. Structure your response clearly with logical flow
6. Make the final response more valuable than any individual response
7. Ensure your synthesis directly addresses the user's original question
8. Be thorough yet concise - include everything important without unnecessary repetition

Create your synthesized response now:`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI synthesizer specializing in combining multiple AI responses into superior, cohesive answers with conflict resolution and source citation.'
          },
          { role: 'user', content: synthesisPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.3, // Lower temperature for more consistent synthesis
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const content = response.choices[0].message.content;

      return {
        content,
        model: 'gpt-4o',
        provider: 'openai',
        status: 'success',
        synthesisStrategy: 'enhanced_with_conflicts',
        sourceCitation: conflictAnalysis.hasConflicts,
        contextIntegrated: !!contextData.context
      };

    } catch (error) {
      console.error(`❌ [${correlationId}] Enhanced synthesis failed:`, error.message);
      throw error;
    }
  }

  /**
   * Validate synthesis quality using multiple metrics
   */
  async validateSynthesis(synthesisResult, originalOutputs, userPrompt, correlationId) {
    try {
      const content = synthesisResult.content;

      // 1. Readability analysis (Flesch-Kincaid)
      const readabilityMetrics = semanticConfidenceService.calculateReadability(content);
      const readabilityScore = this.normalizeReadabilityScore(readabilityMetrics);

      // 2. Factual consistency check using embeddings
      const factualConsistency = await this.checkFactualConsistency(content, originalOutputs);

      // 3. Novelty assessment
      const noveltyScore = await this.assessNovelty(content, originalOutputs);

      // 4. Overall quality calculation
      const overallQuality = (readabilityScore * 0.3) + (factualConsistency * 0.4) + (noveltyScore * 0.3);

      // 5. Check if passes thresholds
      const passesThreshold =
        readabilityScore >= this.qualityThresholds.readability &&
        factualConsistency >= this.qualityThresholds.factualConsistency &&
        noveltyScore >= this.qualityThresholds.novelty &&
        overallQuality >= this.qualityThresholds.overall;

      console.log(`📊 [${correlationId}] Validation scores - Readability: ${readabilityScore.toFixed(2)}, Factual: ${factualConsistency.toFixed(2)}, Novelty: ${noveltyScore.toFixed(2)}, Overall: ${overallQuality.toFixed(2)}`);

      return {
        readabilityScore,
        factualConsistency,
        noveltyScore,
        overallQuality,
        passesThreshold,
        readabilityMetrics,
        thresholds: this.qualityThresholds
      };

    } catch (error) {
      console.error(`❌ [${correlationId}] Validation failed:`, error.message);
      return {
        readabilityScore: 0.5,
        factualConsistency: 0.5,
        noveltyScore: 0.5,
        overallQuality: 0.5,
        passesThreshold: false,
        error: error.message
      };
    }
  }

  /**
   * Normalize readability score to 0-1 range
   */
  normalizeReadabilityScore(readabilityMetrics) {
    // Flesch-Kincaid grade level: lower is more readable
    // Convert to 0-1 score where 1 is most readable
    const gradeLevel = readabilityMetrics.gradeLevel || 12;

    // Optimal range is 6-10 grade level
    if (gradeLevel >= 6 && gradeLevel <= 10) {
      return 1.0;
    } else if (gradeLevel < 6) {
      return 0.8; // Too simple
    } else {
      return Math.max(0.3, 1.0 - ((gradeLevel - 10) * 0.1)); // Too complex
    }
  }

  /**
   * Check factual consistency using embedding similarity
   */
  async checkFactualConsistency(synthesisContent, originalOutputs) {
    try {
      const synthesisEmbedding = await semanticConfidenceService.generateEmbedding(
        synthesisContent,
        `synthesis_${Date.now()}`
      );

      let totalSimilarity = 0;
      let validComparisons = 0;

      for (const output of originalOutputs) {
        const outputEmbedding = await semanticConfidenceService.generateEmbedding(
          output.content,
          `original_${Date.now()}_${validComparisons}`
        );

        const similarity = semanticConfidenceService.cosineSimilarity(synthesisEmbedding, outputEmbedding);
        totalSimilarity += similarity;
        validComparisons++;
      }

      return validComparisons > 0 ? totalSimilarity / validComparisons : 0.5;
    } catch (error) {
      console.warn('Factual consistency check failed:', error.message);
      return 0.5;
    }
  }

  /**
   * Assess novelty of synthesis compared to original responses
   */
  async assessNovelty(synthesisContent, originalOutputs) {
    try {
      // Calculate how much new insight the synthesis provides
      const synthesisWords = new Set(synthesisContent.toLowerCase().split(/\s+/));
      let totalOriginalWords = new Set();

      originalOutputs.forEach(output => {
        const words = output.content.toLowerCase().split(/\s+/);
        words.forEach(word => totalOriginalWords.add(word));
      });

      // Calculate word-level novelty
      const uniqueWords = [...synthesisWords].filter(word => !totalOriginalWords.has(word));
      const wordNovelty = uniqueWords.length / synthesisWords.size;

      // Calculate structural novelty (sentence patterns)
      const synthesisSentences = synthesisContent.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const originalSentenceCount = originalOutputs.reduce((total, output) => {
        return total + output.content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      }, 0);

      const structuralNovelty = Math.min(1.0, synthesisSentences.length / Math.max(originalSentenceCount, 1));

      // Combine metrics
      return (wordNovelty * 0.6) + (structuralNovelty * 0.4);
    } catch (error) {
      console.warn('Novelty assessment failed:', error.message);
      return 0.5;
    }
  }

  /**
   * Regenerate synthesis with improved prompts based on validation feedback
   */
  async regenerateSynthesis(outputs, userPrompt, contextData, conflictAnalysis, votingResult, validationResult, correlationId) {
    console.log(`🔄 [${correlationId}] Regenerating synthesis with quality improvements...`);

    // Build improved prompt based on validation feedback
    let improvementInstructions = '';

    if (validationResult.readabilityScore < this.qualityThresholds.readability) {
      improvementInstructions += '\n- Improve readability: Use clearer language and better sentence structure';
    }

    if (validationResult.factualConsistency < this.qualityThresholds.factualConsistency) {
      improvementInstructions += '\n- Maintain factual consistency: Stay closer to the original responses';
    }

    if (validationResult.noveltyScore < this.qualityThresholds.novelty) {
      improvementInstructions += '\n- Add more synthesis value: Provide new insights beyond just combining responses';
    }

    // Perform synthesis with improvement instructions
    const modelNames = {
      gpt4o: 'GPT-4o',
      gemini: 'Gemini',
      claude: 'Claude'
    };

    let regenerationPrompt = `You are an expert AI synthesizer. Your previous synthesis attempt needs improvement. Please create a superior response by addressing the following quality issues:${improvementInstructions}

**Original User Question:**
${userPrompt}`;

    if (contextData.context) {
      regenerationPrompt += `

**User Context & History:**
${contextData.context}`;
    }

    regenerationPrompt += `

**AI Responses to Synthesize:**
`;

    outputs.forEach((output, index) => {
      const modelName = modelNames[output.role] || output.role;
      regenerationPrompt += `
### ${modelName} Response:
${output.content}
`;
    });

    regenerationPrompt += `

**ENHANCED SYNTHESIS INSTRUCTIONS:**
1. Address the quality improvement areas mentioned above
2. Create a comprehensive response that combines the best insights
3. Resolve any conflicts between responses with source citation
4. Ensure excellent readability and clear structure
5. Add valuable synthesis insights beyond just combining responses
6. Make the response directly address the user's question

Create your improved synthesized response now:`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert AI synthesizer focused on creating high-quality, readable, and insightful responses that exceed the quality of individual AI outputs.'
          },
          { role: 'user', content: regenerationPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.4, // Slightly higher for more creativity in regeneration
        presence_penalty: 0.2,
        frequency_penalty: 0.1
      });

      return {
        content: response.choices[0].message.content,
        model: 'gpt-4o',
        provider: 'openai',
        status: 'success',
        synthesisStrategy: 'enhanced_regenerated',
        regenerated: true
      };

    } catch (error) {
      console.error(`❌ [${correlationId}] Regeneration failed:`, error.message);
      // Return original synthesis if regeneration fails
      return outputs[0] || this.createFallbackSynthesis(userPrompt, correlationId);
    }
  }

  /**
   * Create fallback synthesis when no successful outputs available
   */
  createFallbackSynthesis(userPrompt, correlationId) {
    console.log(`⚠️ [${correlationId}] Creating fallback synthesis`);

    return {
      content: `I apologize, but I'm experiencing technical difficulties with my AI ensemble system. While I cannot provide the comprehensive multi-model analysis you would normally receive, I can offer that your question "${userPrompt}" is important and deserves a thoughtful response. Please try again in a moment, as our systems should be restored shortly.`,
      model: 'fallback',
      provider: 'system',
      status: 'fallback',
      synthesisStrategy: 'fallback'
    };
  }

  /**
   * Create error synthesis for system errors
   */
  createErrorSynthesis(error, userPrompt, correlationId) {
    console.error(`❌ [${correlationId}] Creating error synthesis:`, error.message);

    return {
      content: `I encountered an error while processing your request. Our AI synthesis system is temporarily unavailable. Please try again shortly.`,
      model: 'error',
      provider: 'system',
      status: 'error',
      synthesisStrategy: 'error',
      error: error.message
    };
  }

  /**
   * Update service metrics
   */
  updateMetrics(synthesisResult, validationResult, processingTime) {
    if (synthesisResult.status === 'success') {
      this.metrics.successfulSyntheses++;
    }

    // Update average quality score
    if (validationResult.overallQuality) {
      const totalSuccessful = this.metrics.successfulSyntheses;
      this.metrics.averageQualityScore =
        ((this.metrics.averageQualityScore * (totalSuccessful - 1)) + validationResult.overallQuality) / totalSuccessful;
    }

    // Update average processing time
    const totalSyntheses = this.metrics.totalSyntheses;
    this.metrics.averageProcessingTime =
      ((this.metrics.averageProcessingTime * (totalSyntheses - 1)) + processingTime) / totalSyntheses;
  }

  /**
   * Health check for the service
   */
  async healthCheck() {
    try {
      if (!this.openaiClient) {
        throw new Error('OpenAI client not initialized');
      }

      // Test basic functionality
      const testResponse = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 10
      });

      return {
        status: 'healthy',
        openaiClient: !!this.openaiClient,
        testResponse: !!testResponse.choices[0]?.message?.content,
        metrics: this.getMetrics()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        openaiClient: !!this.openaiClient,
        metrics: this.getMetrics()
      };
    }
  }
}

module.exports = new EnhancedSynthesisService();
