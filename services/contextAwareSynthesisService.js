/**
 * 🧠 Context-Aware Synthesis Service - Intelligent Response Synthesis
 *
 * 🎯 PURPOSE: Create intelligent synthesis that identifies best sections from each response,
 *            combines complementary information, and adapts strategy based on query type
 *
 * 📋 KEY FEATURES:
 * 1. Section-level analysis and extraction
 * 2. Complementary information combination
 * 3. Query-type adaptive synthesis strategies
 * 4. Content deduplication and optimization
 * 5. Coherent narrative construction
 * 6. Quality-driven content selection
 */

const monitoringService = require('./monitoringService');
const enhancedContentQualityService = require('./enhancedContentQualityService');

class ContextAwareSynthesisService {
  constructor() {
    this.config = {
      // Synthesis strategies by query type
      strategies: {
        factual: {
          prioritizeAccuracy: true,
          combineEvidence: true,
          includeMultiplePerspectives: false,
          maxSections: 5,
          preferStructured: true
        },
        creative: {
          prioritizeAccuracy: false,
          combineEvidence: false,
          includeMultiplePerspectives: true,
          maxSections: 7,
          preferStructured: false
        },
        technical: {
          prioritizeAccuracy: true,
          combineEvidence: true,
          includeMultiplePerspectives: false,
          maxSections: 6,
          preferStructured: true
        },
        comparative: {
          prioritizeAccuracy: true,
          combineEvidence: true,
          includeMultiplePerspectives: true,
          maxSections: 8,
          preferStructured: true
        },
        general: {
          prioritizeAccuracy: true,
          combineEvidence: true,
          includeMultiplePerspectives: true,
          maxSections: 6,
          preferStructured: true
        }
      },

      // Section types and their importance
      sectionTypes: {
        introduction: { weight: 0.9, required: true },
        explanation: { weight: 0.85, required: true },
        examples: { weight: 0.7, required: false },
        applications: { weight: 0.75, required: false },
        conclusion: { weight: 0.8, required: false },
        details: { weight: 0.6, required: false }
      },

      // Quality thresholds
      thresholds: {
        minSectionLength: 20,
        maxSectionLength: 200,
        minQualityScore: 0.4,
        redundancyThreshold: 0.7
      }
    };

    this.metrics = {
      synthesisOperations: 0,
      averageQualityImprovement: 0,
      sectionsExtracted: 0,
      redundancyReductions: 0
    };

    // Initialize OpenAI client for synthesis
    this.openaiClient = require('./vendorClients').openai;
  }

  /**
   * Main synthesis method with context awareness
   */
  async synthesizeWithContext(responses, originalPrompt, queryType = 'general', metadata = {}) {
    try {
      const synthesisStart = Date.now();
      const correlationId = metadata.correlationId || 'unknown';

      // Filter successful responses
      const successfulResponses = responses.filter(r => 
        r.status === 'fulfilled' && r.content && r.content.trim().length > 0);

      if (successfulResponses.length === 0) {
        return this.createEmptySynthesis(correlationId);
      }

      if (successfulResponses.length === 1) {
        return this.createSingleResponseSynthesis(successfulResponses[0], correlationId);
      }

      // Get synthesis strategy for query type
      const strategy = this.config.strategies[queryType] || this.config.strategies.general;

      // Extract and analyze sections from each response
      const analyzedSections = await this.extractAndAnalyzeSections(
        successfulResponses, originalPrompt, strategy);

      // Select best sections based on quality and complementarity
      const selectedSections = this.selectOptimalSections(
        analyzedSections, strategy, originalPrompt);

      // Combine sections into coherent synthesis
      const synthesizedContent = await this.combineIntoCoherentResponse(
        selectedSections, originalPrompt, queryType, strategy);

      // Validate and optimize final synthesis
      const optimizedSynthesis = await this.optimizeSynthesis(
        synthesizedContent, originalPrompt, successfulResponses);

      const result = {
        content: optimizedSynthesis.content,
        model: 'gpt-4o-mini',
        provider: 'openai',
        status: 'success',
        processingTime: Date.now() - synthesisStart,
        sourceCount: successfulResponses.length,
        synthesisMetadata: {
          queryType,
          strategy: strategy,
          sectionsUsed: selectedSections.length,
          qualityImprovement: optimizedSynthesis.qualityImprovement,
          sourcesContributed: this.getSourceContributions(selectedSections),
          synthesisMethod: 'context_aware_intelligent'
        }
      };

      // Update metrics
      this.updateMetrics(result, selectedSections);

      monitoringService.log('info', 'Context-aware synthesis completed', {
        queryType,
        sectionsUsed: selectedSections.length,
        qualityImprovement: optimizedSynthesis.qualityImprovement?.toFixed(3),
        processingTime: result.processingTime
      }, correlationId);

      return result;

    } catch (error) {
      monitoringService.log('error', 'Context-aware synthesis failed', {
        error: error.message,
        responsesCount: responses.length,
        queryType
      }, metadata.correlationId);

      return this.createFallbackSynthesis(responses, originalPrompt, metadata.correlationId);
    }
  }

  /**
   * Extract and analyze sections from responses
   */
  async extractAndAnalyzeSections(responses, originalPrompt, strategy) {
    const allSections = [];

    for (const response of responses) {
      try {
        // Split response into logical sections
        const sections = this.splitIntoSections(response.content);

        // Analyze each section
        for (const section of sections) {
          if (section.content.length >= this.config.thresholds.minSectionLength) {
            const analysis = await this.analyzeSectionQuality(
              section, originalPrompt, response);

            if (analysis.qualityScore >= this.config.thresholds.minQualityScore) {
              allSections.push({
                ...section,
                sourceResponse: response.role,
                sourceModel: response.model,
                analysis,
                relevanceScore: this.calculateRelevanceScore(section.content, originalPrompt)
              });
            }
          }
        }
      } catch (error) {
        monitoringService.log('warn', 'Failed to analyze sections for response', {
          role: response.role,
          error: error.message
        });
      }
    }

    return allSections;
  }

  /**
   * Split response into logical sections
   */
  splitIntoSections(content) {
    const sections = [];

    // Split by double newlines (paragraphs)
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);

    // Split by headers if present
    const headerPattern = /^(#{1,3}\s+.+|[*]{2}.+[*]{2})/gm;
    const hasHeaders = headerPattern.test(content);

    if (hasHeaders) {
      const headerSections = content.split(headerPattern).filter(s => s.trim().length > 0);
      headerSections.forEach((section, index) => {
        const type = this.identifySectionType(section);
        sections.push({
          content: section.trim(),
          type,
          position: index,
          hasHeader: headerPattern.test(section)
        });
      });
    } else {
      // Use paragraph-based splitting
      paragraphs.forEach((paragraph, index) => {
        const type = this.identifySectionType(paragraph);
        sections.push({
          content: paragraph.trim(),
          type,
          position: index,
          hasHeader: false
        });
      });
    }

    return sections;
  }

  /**
   * Identify section type based on content
   */
  identifySectionType(content) {
    const contentLower = content.toLowerCase();

    // Introduction indicators
    if (contentLower.includes('introduction') || contentLower.includes('overview') ||
        content.split(/[.!?]/).length <= 2) {
      return 'introduction';
    }

    // Conclusion indicators
    if (contentLower.includes('conclusion') || contentLower.includes('summary') ||
        contentLower.includes('in summary') || contentLower.includes('finally')) {
      return 'conclusion';
    }

    // Example indicators
    if (contentLower.includes('example') || contentLower.includes('for instance') ||
        contentLower.includes('such as')) {
      return 'examples';
    }

    // Application indicators
    if (contentLower.includes('application') || contentLower.includes('use case') ||
        contentLower.includes('practical')) {
      return 'applications';
    }

    // Default to explanation
    return 'explanation';
  }

  /**
   * Analyze section quality
   */
  async analyzeSectionQuality(section, originalPrompt, sourceResponse) {
    try {
      // Use enhanced content quality service for detailed analysis
      const qualityAssessment = await enhancedContentQualityService
        .assessContentQuality(section.content, { originalPrompt });

      // Additional section-specific scoring
      const sectionTypeWeight = this.config.sectionTypes[section.type]?.weight || 0.5;
      const lengthScore = this.calculateLengthScore(section.content.length);
      const coherenceScore = this.calculateCoherenceScore(section.content);

      const finalScore = (qualityAssessment.overallScore * 0.6) + 
                        (sectionTypeWeight * 0.2) + 
                        (lengthScore * 0.1) + 
                        (coherenceScore * 0.1);

      return {
        qualityScore: Math.max(0, Math.min(1, finalScore)),
        contentQuality: qualityAssessment,
        sectionTypeWeight,
        lengthScore,
        coherenceScore,
        sourceConfidence: sourceResponse.confidence?.score || 0.5
      };

    } catch (error) {
      return {
        qualityScore: 0.5,
        contentQuality: {},
        sectionTypeWeight: 0.5,
        lengthScore: 0.5,
        coherenceScore: 0.5,
        sourceConfidence: 0.5
      };
    }
  }

  /**
   * Calculate relevance score to original prompt
   */
  calculateRelevanceScore(content, originalPrompt) {
    if (!originalPrompt) return 0.5;

    const promptWords = originalPrompt.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3);
    const contentLower = content.toLowerCase();

    const matchedWords = promptWords.filter(word => contentLower.includes(word));
    return promptWords.length > 0 ? matchedWords.length / promptWords.length : 0.5;
  }

  /**
   * Select optimal sections for synthesis
   */
  selectOptimalSections(sections, strategy, originalPrompt) {
    // Sort sections by combined quality and relevance score
    const scoredSections = sections.map(section => ({
      ...section,
      combinedScore: (section.analysis.qualityScore * 0.7) + (section.relevanceScore * 0.3)
    })).sort((a, b) => b.combinedScore - a.combinedScore);

    const selectedSections = [];
    const usedContent = new Set();

    // Ensure we have required section types
    const requiredTypes = Object.entries(this.config.sectionTypes)
      .filter(([type, config]) => config.required)
      .map(([type]) => type);

    // First, select best sections of required types
    for (const requiredType of requiredTypes) {
      const bestOfType = scoredSections.find(s => 
        s.type === requiredType && !this.isRedundant(s.content, usedContent));
      
      if (bestOfType) {
        selectedSections.push(bestOfType);
        usedContent.add(this.getContentSignature(bestOfType.content));
      }
    }

    // Then, fill remaining slots with best available sections
    for (const section of scoredSections) {
      if (selectedSections.length >= strategy.maxSections) break;
      
      if (!selectedSections.includes(section) && 
          !this.isRedundant(section.content, usedContent)) {
        selectedSections.push(section);
        usedContent.add(this.getContentSignature(section.content));
      }
    }

    return selectedSections;
  }

  /**
   * Check if content is redundant with already selected content
   */
  isRedundant(content, usedContent) {
    const signature = this.getContentSignature(content);
    
    for (const usedSignature of usedContent) {
      const similarity = this.calculateSimilarity(signature, usedSignature);
      if (similarity > this.config.thresholds.redundancyThreshold) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get content signature for similarity comparison
   */
  getContentSignature(content) {
    return content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10)
      .join(' ');
  }

  /**
   * Calculate similarity between two content signatures
   */
  calculateSimilarity(sig1, sig2) {
    const words1 = new Set(sig1.split(' '));
    const words2 = new Set(sig2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Helper methods for scoring
   */
  calculateLengthScore(length) {
    if (length < this.config.thresholds.minSectionLength) return 0.2;
    if (length > this.config.thresholds.maxSectionLength) return 0.7;
    return 1.0;
  }

  calculateCoherenceScore(content) {
    // Simple coherence based on sentence connectivity
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 1) return 0.5;

    const transitions = ['however', 'therefore', 'moreover', 'furthermore'];
    const transitionCount = transitions.filter(t => 
      content.toLowerCase().includes(t)).length;

    return Math.min(1, 0.5 + (transitionCount / sentences.length));
  }

  /**
   * Get source contributions for metadata
   */
  getSourceContributions(sections) {
    const contributions = {};
    sections.forEach(section => {
      contributions[section.sourceResponse] =
        (contributions[section.sourceResponse] || 0) + 1;
    });
    return contributions;
  }

  /**
   * Combine sections into coherent response
   */
  async combineIntoCoherentResponse(sections, originalPrompt, queryType, strategy) {
    try {
      // Sort sections by logical order
      const orderedSections = this.orderSectionsLogically(sections);

      // Create synthesis prompt
      const synthesisPrompt = this.createAdvancedSynthesisPrompt(
        orderedSections, originalPrompt, queryType, strategy);

      // Generate synthesis using OpenAI
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: this.getContextAwareSystemPrompt(queryType, strategy)
          },
          { role: 'user', content: synthesisPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.3,
        top_p: 0.9
      });

      return response.choices[0].message.content;

    } catch (error) {
      monitoringService.log('warn', 'AI synthesis failed, using template approach', {
        error: error.message
      });

      // Fallback to template-based synthesis
      return this.templateBasedSynthesis(sections, originalPrompt, queryType);
    }
  }

  /**
   * Order sections logically for coherent flow
   */
  orderSectionsLogically(sections) {
    const typeOrder = ['introduction', 'explanation', 'examples', 'applications', 'details', 'conclusion'];

    return sections.sort((a, b) => {
      const aIndex = typeOrder.indexOf(a.type);
      const bIndex = typeOrder.indexOf(b.type);

      // If both have defined order, use that
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If only one has defined order, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // Otherwise, use quality score
      return b.combinedScore - a.combinedScore;
    });
  }

  /**
   * Create advanced synthesis prompt
   */
  createAdvancedSynthesisPrompt(sections, originalPrompt, queryType, strategy) {
    const sectionTexts = sections.map((section, index) => {
      return `[Section ${index + 1} - ${section.type.toUpperCase()} from ${section.sourceResponse}]\n${section.content}`;
    }).join('\n\n---\n\n');

    return `Original Question: "${originalPrompt}"

Query Type: ${queryType}
Synthesis Strategy: ${JSON.stringify(strategy, null, 2)}

Available Sections:
${sectionTexts}

Instructions:
1. Create a comprehensive, coherent response that synthesizes the best information from the provided sections
2. Maintain logical flow and avoid redundancy
3. Prioritize accuracy and completeness based on the query type
4. Ensure the response directly addresses the original question
5. Combine complementary information from different sources
6. Use clear, engaging language appropriate for the query type

Please synthesize these sections into a single, high-quality response:`;
  }

  /**
   * Get context-aware system prompt
   */
  getContextAwareSystemPrompt(queryType, strategy) {
    const basePrompt = `You are an expert content synthesizer specializing in creating coherent, high-quality responses by combining information from multiple AI sources.`;

    const typeSpecificPrompts = {
      factual: `Focus on accuracy, evidence-based claims, and clear factual presentation. Prioritize verifiable information and avoid speculation.`,
      creative: `Embrace creativity and multiple perspectives. Combine ideas innovatively while maintaining coherence and engagement.`,
      technical: `Emphasize technical accuracy, detailed explanations, and structured presentation. Include specific technical details and methodologies.`,
      comparative: `Present balanced comparisons, highlight key differences and similarities, and provide comprehensive analysis from multiple angles.`,
      general: `Balance accuracy, clarity, and comprehensiveness. Ensure the response is well-structured and addresses all aspects of the question.`
    };

    return `${basePrompt}\n\n${typeSpecificPrompts[queryType] || typeSpecificPrompts.general}\n\nAlways create responses that are coherent, well-structured, and directly address the user's question.`;
  }

  /**
   * Template-based synthesis fallback
   */
  templateBasedSynthesis(sections, originalPrompt, queryType) {
    const orderedSections = this.orderSectionsLogically(sections);

    let synthesis = '';
    let currentType = '';

    for (const section of orderedSections) {
      // Add section header if type changes
      if (section.type !== currentType && section.type !== 'explanation') {
        if (synthesis.length > 0) synthesis += '\n\n';
        currentType = section.type;
      }

      // Add section content with minimal processing
      if (synthesis.length > 0) synthesis += '\n\n';
      synthesis += section.content;
    }

    return synthesis;
  }

  /**
   * Optimize final synthesis
   */
  async optimizeSynthesis(content, originalPrompt, originalResponses) {
    try {
      // Calculate quality improvement
      const originalQualities = await Promise.all(
        originalResponses.map(r =>
          enhancedContentQualityService.assessContentQuality(r.content, { originalPrompt }))
      );

      const avgOriginalQuality = originalQualities.reduce((sum, q) => sum + q.overallScore, 0) / originalQualities.length;

      const synthesisQuality = await enhancedContentQualityService
        .assessContentQuality(content, { originalPrompt });

      const qualityImprovement = synthesisQuality.overallScore - avgOriginalQuality;

      // Basic content optimization
      const optimizedContent = this.optimizeContent(content);

      return {
        content: optimizedContent,
        qualityImprovement,
        originalAvgQuality: avgOriginalQuality,
        synthesisQuality: synthesisQuality.overallScore
      };

    } catch (error) {
      return {
        content,
        qualityImprovement: 0,
        originalAvgQuality: 0.5,
        synthesisQuality: 0.5
      };
    }
  }

  /**
   * Basic content optimization
   */
  optimizeContent(content) {
    // Remove excessive whitespace
    let optimized = content.replace(/\n{3,}/g, '\n\n');

    // Ensure proper sentence spacing
    optimized = optimized.replace(/([.!?])\s*([A-Z])/g, '$1 $2');

    // Clean up list formatting
    optimized = optimized.replace(/^\s*[-•]\s*/gm, '• ');

    return optimized.trim();
  }

  /**
   * Fallback and empty result methods
   */
  createEmptySynthesis(correlationId) {
    return {
      content: 'I apologize, but I was unable to generate a response based on the available information.',
      model: 'fallback',
      provider: 'system',
      status: 'empty',
      processingTime: 0,
      sourceCount: 0,
      synthesisMetadata: {
        queryType: 'unknown',
        synthesisMethod: 'empty_fallback'
      }
    };
  }

  createSingleResponseSynthesis(response, correlationId) {
    return {
      content: response.content,
      model: response.model || 'unknown',
      provider: response.provider || 'unknown',
      status: 'single_source',
      processingTime: 0,
      sourceCount: 1,
      synthesisMetadata: {
        queryType: 'unknown',
        synthesisMethod: 'single_source_passthrough',
        sourceResponse: response.role
      }
    };
  }

  createFallbackSynthesis(responses, originalPrompt, correlationId) {
    const successfulResponses = responses.filter(r => r.status === 'fulfilled');

    if (successfulResponses.length === 0) {
      return this.createEmptySynthesis(correlationId);
    }

    // Use the highest confidence response as fallback
    const bestResponse = successfulResponses.reduce((best, current) => {
      const bestScore = best.confidence?.score || 0;
      const currentScore = current.confidence?.score || 0;
      return currentScore > bestScore ? current : best;
    });

    return {
      content: bestResponse.content,
      model: 'fallback',
      provider: 'system',
      status: 'fallback',
      processingTime: 0,
      sourceCount: successfulResponses.length,
      synthesisMetadata: {
        queryType: 'unknown',
        synthesisMethod: 'confidence_based_fallback',
        selectedSource: bestResponse.role
      }
    };
  }

  /**
   * Update service metrics
   */
  updateMetrics(result, sections) {
    this.metrics.synthesisOperations++;

    if (result.synthesisMetadata?.qualityImprovement) {
      this.metrics.averageQualityImprovement =
        (this.metrics.averageQualityImprovement + result.synthesisMetadata.qualityImprovement) / 2;
    }

    this.metrics.sectionsExtracted += sections.length;

    // Count redundancy reductions (sections that were filtered out)
    // This would need to be tracked during section selection
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      avgSectionsPerSynthesis: this.metrics.synthesisOperations > 0 ?
        this.metrics.sectionsExtracted / this.metrics.synthesisOperations : 0
    };
  }
}

module.exports = new ContextAwareSynthesisService();
