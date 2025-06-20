/**
 * Context Compression Service
 * Implements advanced compression techniques for optimizing context usage
 */

const ContentAnalyzer = require('./contentAnalysis');

class ContextCompressionService {
  constructor() {
    this.contentAnalyzer = new ContentAnalyzer();
    
    // Compression configuration
    this.config = {
      maxCompressionRatio: 0.4, // Compress to 40% of original
      minCompressionRatio: 0.8, // Don't compress if already small
      keywordDensity: 0.15, // 15% of content should be keywords
      conceptRetention: 0.9, // Retain 90% of key concepts
      sentenceImportanceThreshold: 0.6,
      redundancyThreshold: 0.8
    };
  }

  /**
   * Compress context using multiple strategies
   * @param {string} content 
   * @param {number} targetTokens 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async compressContext(content, targetTokens, options = {}) {
    try {
      const originalTokens = this.contentAnalyzer.estimateTokenCount(content);
      
      // If already within target, return as-is
      if (originalTokens <= targetTokens) {
        return {
          compressed: content,
          originalTokens,
          compressedTokens: originalTokens,
          compressionRatio: 1.0,
          strategy: 'no_compression_needed'
        };
      }

      const targetRatio = targetTokens / originalTokens;
      
      // Choose compression strategy based on target ratio
      let compressionResult;
      
      if (targetRatio < 0.3) {
        // Aggressive compression needed
        compressionResult = await this.aggressiveCompression(content, targetTokens, options);
      } else if (targetRatio < 0.6) {
        // Moderate compression
        compressionResult = await this.moderateCompression(content, targetTokens, options);
      } else {
        // Light compression
        compressionResult = await this.lightCompression(content, targetTokens, options);
      }

      return {
        ...compressionResult,
        originalTokens,
        compressionRatio: compressionResult.compressedTokens / originalTokens
      };

    } catch (error) {
      console.error('❌ Context compression failed:', error);
      return {
        compressed: content.substring(0, targetTokens * 4), // Fallback truncation
        originalTokens: this.contentAnalyzer.estimateTokenCount(content),
        compressedTokens: targetTokens,
        compressionRatio: targetTokens / this.contentAnalyzer.estimateTokenCount(content),
        strategy: 'fallback_truncation',
        error: error.message
      };
    }
  }

  /**
   * Light compression - remove redundancy and filler words
   * @param {string} content 
   * @param {number} targetTokens 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async lightCompression(content, targetTokens, options) {
    const sentences = this.splitIntoSentences(content);
    const processedSentences = [];

    for (const sentence of sentences) {
      // Remove filler words and redundant phrases
      const compressed = this.removeFillerWords(sentence);
      const deduplicated = this.removeDuplicateInformation(compressed, processedSentences);
      
      if (deduplicated.trim()) {
        processedSentences.push(deduplicated);
      }
    }

    const result = processedSentences.join(' ');
    const resultTokens = this.contentAnalyzer.estimateTokenCount(result);

    // If still too long, truncate intelligently
    if (resultTokens > targetTokens) {
      return this.intelligentTruncation(result, targetTokens);
    }

    return {
      compressed: result,
      compressedTokens: resultTokens,
      strategy: 'light_compression'
    };
  }

  /**
   * Moderate compression - extractive summarization
   * @param {string} content 
   * @param {number} targetTokens 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async moderateCompression(content, targetTokens, options) {
    const sentences = this.splitIntoSentences(content);
    
    // Score sentences by importance
    const scoredSentences = sentences.map(sentence => ({
      text: sentence,
      score: this.calculateSentenceImportance(sentence, content, options)
    }));

    // Sort by importance and select top sentences
    scoredSentences.sort((a, b) => b.score - a.score);
    
    const selectedSentences = [];
    let currentTokens = 0;

    for (const sentence of scoredSentences) {
      const sentenceTokens = this.contentAnalyzer.estimateTokenCount(sentence.text);
      
      if (currentTokens + sentenceTokens <= targetTokens) {
        selectedSentences.push(sentence);
        currentTokens += sentenceTokens;
      }
    }

    // Reorder sentences to maintain logical flow
    const reorderedSentences = this.reorderSentences(selectedSentences, sentences);
    const result = reorderedSentences.map(s => s.text).join(' ');

    return {
      compressed: result,
      compressedTokens: this.contentAnalyzer.estimateTokenCount(result),
      strategy: 'extractive_summarization',
      sentencesRetained: selectedSentences.length,
      sentencesTotal: sentences.length
    };
  }

  /**
   * Aggressive compression - keyword and concept extraction
   * @param {string} content 
   * @param {number} targetTokens 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async aggressiveCompression(content, targetTokens, options) {
    // Extract key concepts and keywords
    const analysis = this.contentAnalyzer.analyzeContent(content, false);
    const keywords = analysis.keywords.slice(0, Math.floor(targetTokens * 0.3));
    const concepts = analysis.concepts.slice(0, Math.floor(targetTokens * 0.2));
    
    // Extract most important sentences
    const sentences = this.splitIntoSentences(content);
    const importantSentences = sentences
      .map(sentence => ({
        text: sentence,
        score: this.calculateSentenceImportance(sentence, content, options)
      }))
      .filter(s => s.score > this.config.sentenceImportanceThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.floor(targetTokens * 0.5));

    // Combine into compressed format
    const keywordSection = keywords.length > 0 ? `Key terms: ${keywords.join(', ')}` : '';
    const conceptSection = concepts.length > 0 ? `Concepts: ${concepts.join(', ')}` : '';
    const sentenceSection = importantSentences.map(s => s.text).join(' ');

    const sections = [keywordSection, conceptSection, sentenceSection].filter(Boolean);
    const result = sections.join('. ');

    return {
      compressed: result,
      compressedTokens: this.contentAnalyzer.estimateTokenCount(result),
      strategy: 'keyword_concept_extraction',
      keywordsExtracted: keywords.length,
      conceptsExtracted: concepts.length,
      sentencesExtracted: importantSentences.length
    };
  }

  /**
   * Split content into sentences
   * @param {string} content 
   * @returns {Array}
   */
  splitIntoSentences(content) {
    return content
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short fragments
  }

  /**
   * Remove filler words and phrases
   * @param {string} sentence 
   * @returns {string}
   */
  removeFillerWords(sentence) {
    const fillerWords = [
      'actually', 'basically', 'literally', 'really', 'very', 'quite', 'rather',
      'somewhat', 'pretty', 'fairly', 'just', 'simply', 'merely', 'only',
      'I think', 'I believe', 'in my opinion', 'it seems', 'perhaps', 'maybe'
    ];

    let result = sentence;
    fillerWords.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      result = result.replace(regex, '');
    });

    return result.replace(/\s+/g, ' ').trim();
  }

  /**
   * Remove duplicate information
   * @param {string} sentence 
   * @param {Array} existingSentences 
   * @returns {string}
   */
  removeDuplicateInformation(sentence, existingSentences) {
    const sentenceWords = new Set(sentence.toLowerCase().split(/\s+/));
    
    for (const existing of existingSentences) {
      const existingWords = new Set(existing.toLowerCase().split(/\s+/));
      const intersection = new Set([...sentenceWords].filter(x => existingWords.has(x)));
      const similarity = intersection.size / Math.min(sentenceWords.size, existingWords.size);
      
      if (similarity > this.config.redundancyThreshold) {
        return ''; // Skip this sentence as it's too similar
      }
    }
    
    return sentence;
  }

  /**
   * Calculate sentence importance score
   * @param {string} sentence 
   * @param {string} fullContent 
   * @param {Object} options 
   * @returns {number}
   */
  calculateSentenceImportance(sentence, fullContent, options = {}) {
    let score = 0;

    // Length factor (moderate length preferred)
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount >= 5 && wordCount <= 25) score += 0.2;

    // Keyword density
    const analysis = this.contentAnalyzer.analyzeContent(fullContent, false);
    const sentenceWords = sentence.toLowerCase().split(/\s+/);
    const keywordMatches = analysis.keywords.filter(keyword => 
      sentenceWords.some(word => word.includes(keyword.toLowerCase()))
    ).length;
    score += (keywordMatches / analysis.keywords.length) * 0.3;

    // Concept relevance
    const conceptMatches = analysis.concepts.filter(concept =>
      sentence.toLowerCase().includes(concept.toLowerCase())
    ).length;
    score += (conceptMatches / analysis.concepts.length) * 0.3;

    // Question or important statement indicators
    if (sentence.includes('?')) score += 0.1;
    if (/\b(important|key|critical|essential|main)\b/i.test(sentence)) score += 0.1;

    // Position factor (first and last sentences often important)
    if (options.isFirst) score += 0.1;
    if (options.isLast) score += 0.05;

    return Math.min(score, 1.0);
  }

  /**
   * Reorder sentences to maintain logical flow
   * @param {Array} selectedSentences 
   * @param {Array} originalOrder 
   * @returns {Array}
   */
  reorderSentences(selectedSentences, originalOrder) {
    const selectedTexts = new Set(selectedSentences.map(s => s.text));
    
    return originalOrder
      .filter(sentence => selectedTexts.has(sentence))
      .map(text => selectedSentences.find(s => s.text === text));
  }

  /**
   * Intelligent truncation as fallback
   * @param {string} content 
   * @param {number} targetTokens 
   * @returns {Object}
   */
  intelligentTruncation(content, targetTokens) {
    const sentences = this.splitIntoSentences(content);
    let result = '';
    let tokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.contentAnalyzer.estimateTokenCount(sentence);
      
      if (tokens + sentenceTokens <= targetTokens) {
        result += sentence + '. ';
        tokens += sentenceTokens;
      } else {
        break;
      }
    }

    return {
      compressed: result.trim(),
      compressedTokens: tokens,
      strategy: 'intelligent_truncation'
    };
  }
}

// Singleton instance
let contextCompressionServiceInstance = null;

/**
 * Get the singleton instance of ContextCompressionService
 * @returns {ContextCompressionService}
 */
function getContextCompressionService() {
  if (!contextCompressionServiceInstance) {
    contextCompressionServiceInstance = new ContextCompressionService();
  }
  return contextCompressionServiceInstance;
}

module.exports = { ContextCompressionService, getContextCompressionService };
