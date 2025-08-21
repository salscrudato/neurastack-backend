/**
 * 🔬 Advanced Synthesis Engine - Multi-Stage AI Response Synthesis
 *
 * 🎯 PURPOSE: Create superior synthesized responses through multi-stage processing,
 *            quality validation, and adaptive synthesis strategies
 *
 * 📋 KEY FEATURES:
 * 1. Multi-stage synthesis with iterative refinement
 * 2. Context-aware synthesis based on request type and user intent
 * 3. Quality validation with automatic re-synthesis if needed
 * 4. Adaptive synthesis strategies based on response characteristics
 * 5. Conflict resolution between contradictory AI responses
 * 6. Source attribution and confidence weighting
 * 7. Real-time quality scoring and optimization
 *
 * 💡 INNOVATION: Uses advanced prompt engineering and iterative refinement
 *    to create synthesis that's better than any individual AI response
 */

const monitoringService = require('./monitoringService');
const intelligentModelRouter = require('./intelligentModelRouter');
const logger = require('../utils/visualLogger');
const dynamicConfig = require('../config/dynamicConfig');

class AdvancedSynthesisEngine {
  constructor() {
    // Synthesis strategies for different request types
    this.synthesisStrategies = {
      analytical: {
        approach: 'evidence-based',
        focusAreas: ['accuracy', 'logical_flow', 'comprehensive_coverage'],
        synthesisPrompt: 'Create a comprehensive analysis that synthesizes the key insights while maintaining logical flow and evidence-based reasoning.'
      },
      creative: {
        approach: 'narrative-focused',
        focusAreas: ['creativity', 'engagement', 'originality'],
        synthesisPrompt: 'Combine the most creative and engaging elements while maintaining originality and narrative coherence.'
      },
      technical: {
        approach: 'precision-focused',
        focusAreas: ['accuracy', 'completeness', 'practical_utility'],
        synthesisPrompt: 'Create a technically accurate and complete response that combines the best practical insights and solutions.'
      },
      explanatory: {
        approach: 'clarity-focused',
        focusAreas: ['clarity', 'comprehensiveness', 'accessibility'],
        synthesisPrompt: 'Synthesize into a clear, comprehensive explanation that builds understanding progressively.'
      },
      conversational: {
        approach: 'engagement-focused',
        focusAreas: ['engagement', 'relatability', 'balanced_perspective'],
        synthesisPrompt: 'Create an engaging response that balances different perspectives while maintaining conversational flow.'
      },
      factual: {
        approach: 'accuracy-focused',
        focusAreas: ['accuracy', 'completeness', 'source_reliability'],
        synthesisPrompt: 'Synthesize the most accurate and reliable information while ensuring completeness and factual consistency.'
      }
    };

    // Quality thresholds for different synthesis stages
    this.qualityThresholds = {
      minimum: 0.6,
      target: 0.8,
      excellent: 0.9
    };

    // Synthesis models in order of preference
    this.synthesisModels = [
      'gpt-4o-mini',    // Primary: Best balance of quality and cost
      'claude-3-5-haiku', // Secondary: High quality analysis
      'gpt-4.1-nano'    // Fallback: Fast and cost-effective
    ];

    // Performance tracking
    this.metrics = {
      totalSyntheses: 0,
      successfulSyntheses: 0,
      qualityImprovements: 0,
      averageQualityScore: 0,
      averageProcessingTime: 0,
      strategiesUsed: new Map()
    };

    logger.success(
      'Advanced Synthesis Engine: Initialized',
      {
        'Synthesis Strategies': Object.keys(this.synthesisStrategies).length,
        'Quality Thresholds': `Min: ${this.qualityThresholds.minimum}, Target: ${this.qualityThresholds.target}`,
        'Multi-Stage Processing': 'Enabled',
        'Quality Validation': 'Active'
      },
      'synthesis'
    );
  }

  /**
   * Main synthesis method with multi-stage processing
   * @param {Array} roleOutputs - AI role responses
   * @param {string} userPrompt - Original user prompt
   * @param {string} correlationId - Request correlation ID
   * @param {Object} votingResult - Voting results for context
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {Object} Advanced synthesis result
   */
  async synthesizeWithAdvancedProcessing(roleOutputs, userPrompt, correlationId, votingResult = {}, userId = null, sessionId = null) {
    const startTime = Date.now();
    this.metrics.totalSyntheses++;

    try {
      // Stage 1: Analyze and prepare inputs
      const analysisResult = await this.analyzeInputs(roleOutputs, userPrompt, correlationId);
      
      if (!analysisResult.canSynthesize) {
        return this.createFallbackSynthesis(roleOutputs, userPrompt, correlationId, analysisResult.reason);
      }

      // Stage 2: Select optimal synthesis strategy
      const strategy = this.selectSynthesisStrategy(userPrompt, analysisResult);
      
      // Stage 3: Perform initial synthesis
      let synthesisResult = await this.performInitialSynthesis(
        analysisResult.processedInputs,
        userPrompt,
        strategy,
        correlationId
      );

      // Stage 4: Quality validation and iterative improvement
      synthesisResult = await this.validateAndImprove(
        synthesisResult,
        analysisResult,
        strategy,
        correlationId
      );

      // Stage 5: Final quality scoring and metadata
      const finalResult = await this.finalizeSynthesis(
        synthesisResult,
        analysisResult,
        strategy,
        startTime,
        correlationId
      );

      // Update metrics
      this.updateMetrics(finalResult, strategy.name, Date.now() - startTime);

      return finalResult;

    } catch (error) {
      logger.error('Advanced synthesis failed', { error: error.message, correlationId }, 'synthesis');
      return this.createFallbackSynthesis(roleOutputs, userPrompt, correlationId, 'synthesis_error', error);
    }
  }

  /**
   * Analyze inputs and prepare for synthesis
   * @param {Array} roleOutputs - AI role responses
   * @param {string} userPrompt - Original user prompt
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Analysis result
   */
  async analyzeInputs(roleOutputs, userPrompt, correlationId) {
    // Filter successful responses
    const successfulOutputs = roleOutputs.filter(r =>
      r.status === 'fulfilled' &&
      r.content &&
      r.content.trim().length > 10
    );

    if (successfulOutputs.length === 0) {
      return {
        canSynthesize: false,
        reason: 'no_successful_outputs',
        processedInputs: []
      };
    }

    // Analyze response characteristics
    const characteristics = this.analyzeResponseCharacteristics(successfulOutputs);
    
    // Detect conflicts and agreements
    const conflictAnalysis = await this.analyzeConflicts(successfulOutputs, userPrompt);
    
    // Process and rank inputs by quality
    const processedInputs = this.processAndRankInputs(successfulOutputs, characteristics);

    return {
      canSynthesize: true,
      processedInputs,
      characteristics,
      conflictAnalysis,
      inputCount: successfulOutputs.length,
      totalLength: successfulOutputs.reduce((sum, r) => sum + r.content.length, 0)
    };
  }

  /**
   * Analyze response characteristics for synthesis strategy selection
   * @param {Array} outputs - Successful outputs
   * @returns {Object} Response characteristics
   */
  analyzeResponseCharacteristics(outputs) {
    const characteristics = {
      averageLength: 0,
      hasStructuredContent: false,
      hasCodeBlocks: false,
      hasLists: false,
      hasNumericalData: false,
      sentimentVariance: 0,
      complexityLevel: 'medium'
    };

    let totalLength = 0;
    let structuredCount = 0;
    let codeCount = 0;
    let listCount = 0;
    let numericalCount = 0;

    outputs.forEach(output => {
      const content = output.content;
      totalLength += content.length;

      // Check for structured content
      if (content.includes('##') || content.includes('**') || content.includes('1.') || content.includes('•')) {
        structuredCount++;
      }

      // Check for code blocks
      if (content.includes('```') || content.includes('function') || content.includes('class ')) {
        codeCount++;
      }

      // Check for lists
      if (content.includes('\n-') || content.includes('\n*') || /\d+\.\s/.test(content)) {
        listCount++;
      }

      // Check for numerical data
      if (/\d+%|\$\d+|\d+\.\d+/.test(content)) {
        numericalCount++;
      }
    });

    characteristics.averageLength = totalLength / outputs.length;
    characteristics.hasStructuredContent = structuredCount > outputs.length * 0.5;
    characteristics.hasCodeBlocks = codeCount > 0;
    characteristics.hasLists = listCount > outputs.length * 0.3;
    characteristics.hasNumericalData = numericalCount > 0;

    // Determine complexity level
    if (characteristics.averageLength > 1000 || characteristics.hasCodeBlocks) {
      characteristics.complexityLevel = 'high';
    } else if (characteristics.averageLength < 300) {
      characteristics.complexityLevel = 'low';
    }

    return characteristics;
  }

  /**
   * Analyze conflicts between responses
   * @param {Array} outputs - Successful outputs
   * @param {string} userPrompt - Original prompt
   * @returns {Object} Conflict analysis
   */
  async analyzeConflicts(outputs, userPrompt) {
    // Simple conflict detection based on contradictory keywords
    const conflictIndicators = [
      ['yes', 'no'],
      ['true', 'false'],
      ['correct', 'incorrect'],
      ['should', 'should not'],
      ['recommend', 'not recommend'],
      ['safe', 'unsafe'],
      ['good', 'bad']
    ];

    const conflicts = [];
    const agreements = [];

    // Check for contradictory statements
    for (let i = 0; i < outputs.length; i++) {
      for (let j = i + 1; j < outputs.length; j++) {
        const content1 = outputs[i].content.toLowerCase();
        const content2 = outputs[j].content.toLowerCase();

        for (const [term1, term2] of conflictIndicators) {
          if (content1.includes(term1) && content2.includes(term2)) {
            conflicts.push({
              models: [outputs[i].role, outputs[j].role],
              type: 'contradictory_terms',
              terms: [term1, term2]
            });
          }
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      agreements,
      consensusLevel: conflicts.length === 0 ? 'high' : conflicts.length < 2 ? 'medium' : 'low'
    };
  }

  /**
   * Process and rank inputs by quality
   * @param {Array} outputs - Successful outputs
   * @param {Object} characteristics - Response characteristics
   * @returns {Array} Processed and ranked inputs
   */
  processAndRankInputs(outputs, characteristics) {
    return outputs.map(output => {
      // Calculate quality score for this output
      const qualityScore = this.calculateOutputQuality(output, characteristics);
      
      return {
        ...output,
        qualityScore,
        wordCount: output.content.split(/\s+/).length,
        hasStructure: /#{1,3}\s|^\d+\.\s|\*\*.*\*\*/.test(output.content),
        hasExamples: /for example|such as|e\.g\.|i\.e\./i.test(output.content)
      };
    }).sort((a, b) => b.qualityScore - a.qualityScore);
  }

  /**
   * Calculate quality score for an individual output
   * @param {Object} output - AI output
   * @param {Object} characteristics - Overall characteristics
   * @returns {number} Quality score (0-1)
   */
  calculateOutputQuality(output, characteristics) {
    let score = 0.5; // Base score

    // Length appropriateness (not too short, not too long)
    const length = output.content.length;
    if (length > 100 && length < 2000) {
      score += 0.2;
    } else if (length >= 2000 && length < 4000) {
      score += 0.1;
    }

    // Structure and formatting
    if (/#{1,3}\s|^\d+\.\s|\*\*.*\*\*/.test(output.content)) {
      score += 0.15;
    }

    // Completeness indicators
    if (output.content.includes('conclusion') || output.content.includes('summary')) {
      score += 0.1;
    }

    // Examples and specificity
    if (/for example|such as|e\.g\.|specifically/i.test(output.content)) {
      score += 0.1;
    }

    // Confidence from the model itself
    if (output.confidence && output.confidence.score) {
      score += output.confidence.score * 0.2;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Select optimal synthesis strategy based on request and analysis
   * @param {string} userPrompt - Original prompt
   * @param {Object} analysisResult - Input analysis result
   * @returns {Object} Selected strategy with metadata
   */
  selectSynthesisStrategy(userPrompt, analysisResult) {
    // Classify request type (reuse from model router)
    const requestType = this.classifyRequestType(userPrompt);
    
    // Get base strategy
    let strategy = this.synthesisStrategies[requestType] || this.synthesisStrategies.conversational;
    
    // Adapt strategy based on analysis
    const adaptedStrategy = this.adaptStrategy(strategy, analysisResult, userPrompt);
    
    return {
      name: requestType,
      ...adaptedStrategy,
      metadata: {
        inputCount: analysisResult.inputCount,
        hasConflicts: analysisResult.conflictAnalysis.hasConflicts,
        complexityLevel: analysisResult.characteristics.complexityLevel
      }
    };
  }

  /**
   * Classify request type for synthesis strategy selection
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
   * Adapt synthesis strategy based on analysis results
   * @param {Object} baseStrategy - Base synthesis strategy
   * @param {Object} analysisResult - Analysis results
   * @param {string} userPrompt - Original prompt
   * @returns {Object} Adapted strategy
   */
  adaptStrategy(baseStrategy, analysisResult, userPrompt) {
    const adapted = { ...baseStrategy };
    
    // Adapt for conflicts
    if (analysisResult.conflictAnalysis.hasConflicts) {
      adapted.synthesisPrompt += ' Pay special attention to resolving any contradictions between the responses by evaluating the evidence and reasoning provided.';
      adapted.focusAreas.push('conflict_resolution');
    }
    
    // Adapt for complexity
    if (analysisResult.characteristics.complexityLevel === 'high') {
      adapted.synthesisPrompt += ' Maintain the technical depth while ensuring clarity and organization.';
    } else if (analysisResult.characteristics.complexityLevel === 'low') {
      adapted.synthesisPrompt += ' Expand on the key points to provide more comprehensive coverage.';
    }
    
    // Adapt for structured content
    if (analysisResult.characteristics.hasStructuredContent) {
      adapted.synthesisPrompt += ' Maintain clear structure with appropriate headings, lists, or numbered points.';
    }
    
    return adapted;
  }

  /**
   * Perform initial synthesis using selected strategy
   * @param {Array} processedInputs - Processed and ranked inputs
   * @param {string} userPrompt - Original prompt
   * @param {Object} strategy - Selected synthesis strategy
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Initial synthesis result
   */
  async performInitialSynthesis(processedInputs, userPrompt, strategy, correlationId) {
    // Select synthesis model
    const synthesisModel = await this.selectSynthesisModel(strategy, correlationId);

    // Create synthesis prompt
    const synthesisPrompt = this.createAdvancedSynthesisPrompt(
      processedInputs,
      userPrompt,
      strategy
    );

    // Perform synthesis
    const synthesisResult = await this.callSynthesisModel(
      synthesisModel,
      synthesisPrompt,
      strategy,
      correlationId
    );

    return {
      content: synthesisResult.content,
      model: synthesisModel,
      strategy: strategy.name,
      qualityScore: await this.calculateSynthesisQuality(synthesisResult.content, strategy),
      processingTime: synthesisResult.processingTime,
      stage: 'initial'
    };
  }

  /**
   * Select optimal synthesis model based on strategy and availability
   * @param {Object} strategy - Synthesis strategy
   * @param {string} correlationId - Correlation ID
   * @returns {string} Selected model name
   */
  async selectSynthesisModel(strategy, correlationId) {
    // For complex analytical tasks, prefer Claude
    if (strategy.name === 'analytical' || strategy.name === 'technical') {
      const claudeAvailable = await this.isModelAvailable('claude-3-5-haiku');
      if (claudeAvailable) return 'claude-3-5-haiku';
    }

    // For creative tasks, consider Grok if available
    if (strategy.name === 'creative') {
      const grokAvailable = await this.isModelAvailable('grok-2-1212');
      if (grokAvailable) return 'grok-2-1212';
    }

    // Default to GPT-4o-mini for most cases
    const gptAvailable = await this.isModelAvailable('gpt-4o-mini');
    if (gptAvailable) return 'gpt-4o-mini';

    // Fallback to nano model
    return 'gpt-4.1-nano';
  }

  /**
   * Check if a model is available (not circuit broken)
   * @param {string} model - Model name
   * @returns {boolean} Model availability
   */
  async isModelAvailable(model) {
    const metrics = intelligentModelRouter.getMetrics();
    return metrics.circuitBreakerStatus[model] !== 'OPEN';
  }

  /**
   * Create advanced synthesis prompt with strategy-specific instructions
   * @param {Array} processedInputs - Processed inputs
   * @param {string} userPrompt - Original prompt
   * @param {Object} strategy - Synthesis strategy
   * @returns {string} Synthesis prompt
   */
  createAdvancedSynthesisPrompt(processedInputs, userPrompt, strategy) {
    // Format inputs with quality scores and metadata
    const formattedInputs = processedInputs.map((input, index) => {
      const qualityIndicator = input.qualityScore > 0.8 ? '⭐ HIGH QUALITY' :
                              input.qualityScore > 0.6 ? '✓ GOOD QUALITY' : '• STANDARD';

      return `${qualityIndicator} Response ${index + 1} (${input.role || 'AI Model'}):
${input.content}

Quality Score: ${(input.qualityScore * 100).toFixed(0)}%
Word Count: ${input.wordCount}
${input.hasStructure ? 'Has Structure: Yes' : ''}
${input.hasExamples ? 'Has Examples: Yes' : ''}
---`;
    }).join('\n\n');

    // Create comprehensive synthesis prompt
    const prompt = `You are an expert synthesis specialist tasked with creating the best possible response by combining insights from multiple AI responses.

ORIGINAL USER QUESTION: "${userPrompt}"

SYNTHESIS STRATEGY: ${strategy.approach}
FOCUS AREAS: ${strategy.focusAreas.join(', ')}

AVAILABLE RESPONSES TO SYNTHESIZE:
${formattedInputs}

SYNTHESIS INSTRUCTIONS:
${strategy.synthesisPrompt}

QUALITY REQUIREMENTS:
- Create a response that is better than any individual input
- Maintain accuracy and factual consistency
- Ensure logical flow and clear organization
- Include the best insights from high-quality responses
- Resolve any contradictions by evaluating evidence
- Provide comprehensive coverage of the topic
- Use clear, engaging language appropriate for the context

${strategy.metadata.hasConflicts ?
  'CONFLICT RESOLUTION: There are contradictions between responses. Carefully evaluate the evidence and reasoning to provide the most accurate synthesis.' : ''}

Please create a synthesized response that combines the best elements while meeting all quality requirements:`;

    return prompt;
  }

  /**
   * Call synthesis model with error handling and retries
   * @param {string} model - Model to use
   * @param {string} prompt - Synthesis prompt
   * @param {Object} strategy - Strategy configuration
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Synthesis result
   */
  async callSynthesisModel(model, prompt, strategy, correlationId) {
    const startTime = Date.now();

    try {
      // Get vendor client
      const clients = require('./vendorClients');
      let response;

      // Call appropriate model
      switch (model) {
        case 'gpt-4o-mini':
        case 'gpt-4.1-nano':
          response = await clients.openai.chat.completions.create({
            model: model,
            messages: [
              {
                role: 'system',
                content: 'You are an expert synthesis specialist. Create comprehensive, high-quality responses by combining the best insights from multiple sources.'
              },
              { role: 'user', content: prompt }
            ],
            max_tokens: dynamicConfig.synthesis.maxTokens,
            temperature: 0.3,
            top_p: 0.9
          });
          break;

        case 'claude-3-5-haiku':
          response = await clients.claude.post('/messages', {
            model: model,
            max_tokens: dynamicConfig.synthesis.maxTokens,
            temperature: 0.3,
            messages: [{ role: 'user', content: prompt }]
          });
          break;

        case 'grok-2-1212':
          response = await clients.xai.post('/chat/completions', {
            model: model,
            messages: [
              {
                role: 'system',
                content: 'You are an expert synthesis specialist. Create comprehensive, high-quality responses by combining the best insights from multiple sources.'
              },
              { role: 'user', content: prompt }
            ],
            max_tokens: dynamicConfig.synthesis.maxTokens,
            temperature: 0.3,
            top_p: 0.9
          });
          break;

        default:
          throw new Error(`Unknown synthesis model: ${model}`);
      }

      // Extract content based on model response format
      let content;
      if (model.startsWith('gpt') || model.startsWith('grok')) {
        content = response.choices[0].message.content;
      } else if (model.startsWith('claude')) {
        content = response.data.content[0].text;
      }

      return {
        content,
        processingTime: Date.now() - startTime,
        model,
        success: true
      };

    } catch (error) {
      logger.error(`Synthesis model ${model} failed`, { error: error.message, correlationId }, 'synthesis');

      // Try fallback model if primary fails
      if (model !== 'gpt-4.1-nano') {
        return await this.callSynthesisModel('gpt-4.1-nano', prompt, strategy, correlationId);
      }

      throw error;
    }
  }

  /**
   * Calculate synthesis quality score
   * @param {string} content - Synthesized content
   * @param {Object} strategy - Strategy used
   * @returns {number} Quality score (0-1)
   */
  async calculateSynthesisQuality(content, strategy) {
    let score = 0.5; // Base score

    // Length appropriateness
    const length = content.length;
    if (length > 200 && length < 3000) {
      score += 0.15;
    } else if (length >= 3000 && length < 5000) {
      score += 0.1;
    }

    // Structure and organization
    if (/#{1,3}\s|^\d+\.\s|\*\*.*\*\*|^-\s/m.test(content)) {
      score += 0.15;
    }

    // Completeness indicators
    if (content.includes('conclusion') || content.includes('summary') || content.includes('in summary')) {
      score += 0.1;
    }

    // Examples and specificity
    if (/for example|such as|e\.g\.|specifically|instance/i.test(content)) {
      score += 0.1;
    }

    // Strategy-specific quality checks
    switch (strategy.name) {
      case 'analytical':
        if (/analysis|evidence|data|research|study/i.test(content)) score += 0.1;
        break;
      case 'technical':
        if (/implementation|solution|approach|method/i.test(content)) score += 0.1;
        break;
      case 'explanatory':
        if (/because|therefore|this means|as a result/i.test(content)) score += 0.1;
        break;
    }

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Validate synthesis quality and improve if needed
   * @param {Object} synthesisResult - Initial synthesis result
   * @param {Object} analysisResult - Input analysis
   * @param {Object} strategy - Synthesis strategy
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Validated and potentially improved synthesis
   */
  async validateAndImprove(synthesisResult, analysisResult, strategy, correlationId) {
    // Check if quality meets minimum threshold
    if (synthesisResult.qualityScore >= this.qualityThresholds.target) {
      return synthesisResult; // Quality is good enough
    }

    // If quality is below minimum, attempt improvement
    if (synthesisResult.qualityScore < this.qualityThresholds.minimum) {
      logger.info('Synthesis quality below minimum, attempting improvement', {
        currentScore: synthesisResult.qualityScore,
        correlationId
      }, 'synthesis');

      // Create improvement prompt
      const improvementPrompt = this.createImprovementPrompt(
        synthesisResult.content,
        strategy,
        analysisResult
      );

      try {
        // Attempt to improve synthesis
        const improvedResult = await this.callSynthesisModel(
          synthesisResult.model,
          improvementPrompt,
          strategy,
          correlationId
        );

        const improvedQuality = await this.calculateSynthesisQuality(improvedResult.content, strategy);

        if (improvedQuality > synthesisResult.qualityScore) {
          this.metrics.qualityImprovements++;
          return {
            ...improvedResult,
            qualityScore: improvedQuality,
            stage: 'improved',
            originalScore: synthesisResult.qualityScore
          };
        }
      } catch (error) {
        logger.warning('Synthesis improvement failed, using original', { error: error.message }, 'synthesis');
      }
    }

    return synthesisResult;
  }

  /**
   * Create improvement prompt for low-quality synthesis
   * @param {string} originalContent - Original synthesis content
   * @param {Object} strategy - Synthesis strategy
   * @param {Object} analysisResult - Analysis result
   * @returns {string} Improvement prompt
   */
  createImprovementPrompt(originalContent, strategy, analysisResult) {
    return `Please improve the following response to make it more comprehensive, well-structured, and valuable:

ORIGINAL RESPONSE:
${originalContent}

IMPROVEMENT REQUIREMENTS:
- Enhance clarity and organization
- Add more specific details and examples
- Improve logical flow and structure
- Ensure comprehensive coverage of the topic
- Make it more engaging and valuable to the reader

STRATEGY FOCUS: ${strategy.focusAreas.join(', ')}

Please provide an improved version that addresses these requirements:`;
  }

  /**
   * Finalize synthesis with metadata and quality scoring
   * @param {Object} synthesisResult - Synthesis result
   * @param {Object} analysisResult - Analysis result
   * @param {Object} strategy - Strategy used
   * @param {number} startTime - Processing start time
   * @param {string} correlationId - Correlation ID
   * @returns {Object} Final synthesis result
   */
  async finalizeSynthesis(synthesisResult, analysisResult, strategy, startTime, correlationId) {
    const totalProcessingTime = Date.now() - startTime;

    // Create final result with comprehensive metadata
    const finalResult = {
      content: synthesisResult.content,
      model: synthesisResult.model,
      provider: this.getProviderFromModel(synthesisResult.model),
      status: 'success',
      processingTime: totalProcessingTime,
      sourceCount: analysisResult.inputCount,
      qualityScore: synthesisResult.qualityScore,
      strategy: {
        name: strategy.name,
        approach: strategy.approach,
        focusAreas: strategy.focusAreas
      },
      metadata: {
        stage: synthesisResult.stage || 'initial',
        hasConflicts: analysisResult.conflictAnalysis.hasConflicts,
        conflictResolution: analysisResult.conflictAnalysis.hasConflicts ? 'applied' : 'none',
        inputComplexity: analysisResult.characteristics.complexityLevel,
        qualityImproved: synthesisResult.originalScore ? true : false,
        originalQualityScore: synthesisResult.originalScore || null
      },
      confidence: {
        score: synthesisResult.qualityScore,
        level: this.getConfidenceLevel(synthesisResult.qualityScore),
        factors: this.getConfidenceFactors(synthesisResult, analysisResult)
      }
    };

    // Log synthesis completion
    monitoringService.log('info', 'Advanced synthesis completed', {
      strategy: strategy.name,
      qualityScore: synthesisResult.qualityScore,
      processingTime: totalProcessingTime,
      sourceCount: analysisResult.inputCount,
      stage: synthesisResult.stage
    }, correlationId);

    return finalResult;
  }

  /**
   * Get provider name from model name
   * @param {string} model - Model name
   * @returns {string} Provider name
   */
  getProviderFromModel(model) {
    if (model.startsWith('gpt')) return 'openai';
    if (model.startsWith('claude')) return 'claude';
    if (model.startsWith('grok')) return 'xai';
    if (model.startsWith('gemini')) return 'gemini';
    return 'unknown';
  }

  /**
   * Get confidence level from quality score
   * @param {number} qualityScore - Quality score
   * @returns {string} Confidence level
   */
  getConfidenceLevel(qualityScore) {
    if (qualityScore >= 0.9) return 'very-high';
    if (qualityScore >= 0.8) return 'high';
    if (qualityScore >= 0.6) return 'medium';
    if (qualityScore >= 0.4) return 'low';
    return 'very-low';
  }

  /**
   * Get confidence factors for transparency
   * @param {Object} synthesisResult - Synthesis result
   * @param {Object} analysisResult - Analysis result
   * @returns {Array} Confidence factors
   */
  getConfidenceFactors(synthesisResult, analysisResult) {
    const factors = [];

    factors.push(`Based on ${analysisResult.inputCount} AI responses`);
    factors.push(`Quality score: ${(synthesisResult.qualityScore * 100).toFixed(0)}%`);

    if (synthesisResult.stage === 'improved') {
      factors.push('Quality improved through iterative refinement');
    }

    if (analysisResult.conflictAnalysis.hasConflicts) {
      factors.push('Conflicts resolved through evidence evaluation');
    } else {
      factors.push('High consensus among source responses');
    }

    if (analysisResult.characteristics.complexityLevel === 'high') {
      factors.push('Complex topic with comprehensive coverage');
    }

    return factors;
  }

  /**
   * Create fallback synthesis when advanced processing fails
   * @param {Array} roleOutputs - Original role outputs
   * @param {string} userPrompt - User prompt
   * @param {string} correlationId - Correlation ID
   * @param {string} reason - Failure reason
   * @param {Error} error - Error object if available
   * @returns {Object} Fallback synthesis result
   */
  createFallbackSynthesis(roleOutputs, userPrompt, correlationId, reason, error = null) {
    // Use simple fallback logic
    const successfulOutputs = roleOutputs.filter(r =>
      r.status === 'fulfilled' && r.content && r.content.trim().length > 0
    );

    let content;
    if (successfulOutputs.length > 0) {
      // Use the best available response
      const bestResponse = successfulOutputs.reduce((best, current) =>
        (current.confidence?.score || 0) > (best.confidence?.score || 0) ? current : best
      );
      content = bestResponse.content;
    } else {
      content = "I apologize, but I'm unable to provide a comprehensive response at this time. Please try again or rephrase your question.";
    }

    return {
      content,
      model: 'fallback',
      provider: 'system',
      status: 'fallback',
      processingTime: 0,
      sourceCount: successfulOutputs.length,
      qualityScore: 0.3,
      strategy: { name: 'fallback', approach: 'simple', focusAreas: ['availability'] },
      metadata: {
        stage: 'fallback',
        reason,
        error: error?.message || null
      },
      confidence: {
        score: 0.3,
        level: 'low',
        factors: [`Fallback synthesis due to: ${reason}`, `Based on ${successfulOutputs.length} responses`]
      }
    };
  }

  /**
   * Update performance metrics
   * @param {Object} result - Synthesis result
   * @param {string} strategy - Strategy used
   * @param {number} processingTime - Processing time
   */
  updateMetrics(result, strategy, processingTime) {
    if (result.status === 'success') {
      this.metrics.successfulSyntheses++;

      // Update average quality score
      const currentAvg = this.metrics.averageQualityScore;
      const count = this.metrics.successfulSyntheses;
      this.metrics.averageQualityScore =
        ((currentAvg * (count - 1)) + result.qualityScore) / count;
    }

    // Update average processing time
    const currentAvgTime = this.metrics.averageProcessingTime;
    const totalCount = this.metrics.totalSyntheses;
    this.metrics.averageProcessingTime =
      ((currentAvgTime * (totalCount - 1)) + processingTime) / totalCount;

    // Track strategy usage
    const strategyCount = this.metrics.strategiesUsed.get(strategy) || 0;
    this.metrics.strategiesUsed.set(strategy, strategyCount + 1);
  }

  /**
   * Get comprehensive metrics
   * @returns {Object} Synthesis engine metrics
   */
  getMetrics() {
    return {
      totalSyntheses: this.metrics.totalSyntheses,
      successfulSyntheses: this.metrics.successfulSyntheses,
      successRate: this.metrics.totalSyntheses > 0 ?
        ((this.metrics.successfulSyntheses / this.metrics.totalSyntheses) * 100).toFixed(1) + '%' : 'N/A',
      qualityImprovements: this.metrics.qualityImprovements,
      averageQualityScore: this.metrics.averageQualityScore.toFixed(2),
      averageProcessingTime: this.metrics.averageProcessingTime.toFixed(0) + 'ms',
      strategiesUsed: Object.fromEntries(this.metrics.strategiesUsed),
      qualityThresholds: this.qualityThresholds
    };
  }
}

// Export singleton instance
const advancedSynthesisEngine = new AdvancedSynthesisEngine();
module.exports = advancedSynthesisEngine;
