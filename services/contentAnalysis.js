/**
 * Content Analysis Service for Memory Management
 * Analyzes content to extract metadata for memory storage
 */

class ContentAnalyzer {
  /**
   * Analyze content and extract metadata
   * @param {string} content - The content to analyze
   * @param {boolean} isUserPrompt - Whether this is user input or AI response
   * @returns {import('../types/memory').ContentAnalysis}
   */
  analyzeContent(content, isUserPrompt = true) {
    const timestamp = new Date();
    const baseImportance = this.calculateBaseImportance(content, isUserPrompt);
    const sentiment = this.analyzeSentiment(content);
    const userIntent = this.detectUserIntent(content, isUserPrompt);
    const concepts = this.extractConcepts(content);
    const keywords = this.extractKeywords(content);
    const isQuestion = this.detectQuestion(content);
    const complexity = this.calculateComplexity(content);
    const topic = this.extractTopic(content, concepts);

    return {
      timestamp,
      baseImportance,
      sentiment,
      userIntent,
      concepts,
      keywords,
      isQuestion,
      complexity,
      topic
    };
  }

  /**
   * Calculate base importance score
   * @param {string} content 
   * @param {boolean} isUserPrompt 
   * @returns {number}
   */
  calculateBaseImportance(content, isUserPrompt) {
    let importance = isUserPrompt ? 0.3 : 0.1;
    
    // Boost for length (more detailed content)
    if (content.length > 500) importance += 0.2;
    if (content.length > 1000) importance += 0.1;
    
    // Boost for technical terms
    const technicalTerms = [
      'algorithm', 'api', 'database', 'microservice', 'architecture',
      'deployment', 'scaling', 'performance', 'security', 'authentication',
      'machine learning', 'ai', 'neural network', 'model', 'training'
    ];
    
    const technicalCount = technicalTerms.filter(term => 
      content.toLowerCase().includes(term)).length;
    importance += technicalCount * 0.05;
    
    // Boost for code snippets
    if (content.includes('```') || content.includes('function') || 
        content.includes('class') || content.includes('import')) {
      importance += 0.15;
    }
    
    return Math.min(importance, 1.0);
  }

  /**
   * Analyze sentiment of content
   * @param {string} content 
   * @returns {number} Sentiment score from -1 to 1
   */
  analyzeSentiment(content) {
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'perfect', 'love', 'like',
      'helpful', 'useful', 'effective', 'successful', 'positive', 'benefit'
    ];
    
    const negativeWords = [
      'bad', 'terrible', 'awful', 'hate', 'dislike', 'problem', 'issue',
      'error', 'fail', 'difficult', 'hard', 'negative', 'concern', 'worry'
    ];
    
    const words = content.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    const totalSentimentWords = positiveCount + negativeCount;
    if (totalSentimentWords === 0) return 0;
    
    return (positiveCount - negativeCount) / totalSentimentWords;
  }

  /**
   * Detect user intent from content
   * @param {string} content 
   * @param {boolean} isUserPrompt 
   * @returns {string}
   */
  detectUserIntent(content, isUserPrompt) {
    if (!isUserPrompt) return 'response';
    
    const lowerContent = content.toLowerCase();
    
    // Question patterns
    if (lowerContent.includes('?') || lowerContent.startsWith('how') ||
        lowerContent.startsWith('what') || lowerContent.startsWith('why') ||
        lowerContent.startsWith('when') || lowerContent.startsWith('where')) {
      return 'question';
    }
    
    // Problem solving patterns
    if (lowerContent.includes('solve') || lowerContent.includes('fix') ||
        lowerContent.includes('debug') || lowerContent.includes('troubleshoot')) {
      return 'problem_solving';
    }
    
    // Learning patterns
    if (lowerContent.includes('learn') || lowerContent.includes('understand') ||
        lowerContent.includes('explain') || lowerContent.includes('teach')) {
      return 'learning';
    }
    
    // Creative patterns
    if (lowerContent.includes('create') || lowerContent.includes('design') ||
        lowerContent.includes('build') || lowerContent.includes('generate')) {
      return 'creative';
    }
    
    // Analysis patterns
    if (lowerContent.includes('analyze') || lowerContent.includes('compare') ||
        lowerContent.includes('evaluate') || lowerContent.includes('review')) {
      return 'analysis';
    }
    
    // Task patterns
    if (lowerContent.includes('do') || lowerContent.includes('perform') ||
        lowerContent.includes('execute') || lowerContent.includes('run')) {
      return 'task';
    }
    
    return 'conversation';
  }

  /**
   * Extract key concepts from content
   * @param {string} content 
   * @returns {string[]}
   */
  extractConcepts(content) {
    const conceptPatterns = [
      // Technology concepts
      /\b(api|database|microservice|architecture|deployment|scaling)\b/gi,
      /\b(machine learning|ai|neural network|algorithm|model)\b/gi,
      /\b(authentication|security|encryption|authorization)\b/gi,
      /\b(frontend|backend|fullstack|devops|cloud)\b/gi,
      
      // Programming concepts
      /\b(javascript|python|java|react|node\.?js|express)\b/gi,
      /\b(function|class|method|variable|array|object)\b/gi,
      /\b(async|await|promise|callback|event)\b/gi,
      
      // Business concepts
      /\b(user experience|performance|optimization|testing)\b/gi,
      /\b(requirements|specification|documentation|planning)\b/gi
    ];
    
    const concepts = new Set();
    
    conceptPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => concepts.add(match.toLowerCase()));
      }
    });
    
    return Array.from(concepts);
  }

  /**
   * Extract keywords from content
   * @param {string} content 
   * @returns {string[]}
   */
  extractKeywords(content) {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);
    
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    // Count word frequency
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Return top keywords by frequency
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Detect if content is a question
   * @param {string} content 
   * @returns {boolean}
   */
  detectQuestion(content) {
    return content.includes('?') || 
           /^(how|what|why|when|where|who|which|can|could|would|should|is|are|do|does|did)/i.test(content.trim());
  }

  /**
   * Calculate content complexity
   * @param {string} content 
   * @returns {number}
   */
  calculateComplexity(content) {
    let complexity = 0;
    
    // Length factor
    complexity += Math.min(content.length / 2000, 0.3);
    
    // Sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = content.length / sentences.length;
    complexity += Math.min(avgSentenceLength / 100, 0.2);
    
    // Technical terms
    const technicalTermCount = this.extractConcepts(content).length;
    complexity += Math.min(technicalTermCount / 10, 0.3);
    
    // Code presence
    if (content.includes('```') || content.includes('function') || content.includes('class')) {
      complexity += 0.2;
    }
    
    return Math.min(complexity, 1.0);
  }

  /**
   * Extract main topic from content
   * @param {string} content 
   * @param {string[]} concepts 
   * @returns {string}
   */
  extractTopic(content, concepts) {
    if (concepts.length > 0) {
      return concepts[0]; // Use the first concept as primary topic
    }
    
    // Fallback to first few words
    const words = content.split(/\s+/).slice(0, 3).join(' ');
    return words.toLowerCase();
  }

  /**
   * Compress content for storage efficiency
   * @param {string} content 
   * @returns {string}
   */
  compressContent(content) {
    let compressed = content;
    
    // Apply abbreviations
    compressed = this.applyAbbreviations(compressed);
    
    // Remove redundancy
    compressed = this.removeRedundancy(compressed);
    
    // Simplify structure
    compressed = this.simplifyStructure(compressed);
    
    return compressed;
  }

  /**
   * Apply common abbreviations
   * @param {string} content 
   * @returns {string}
   */
  applyAbbreviations(content) {
    const abbreviations = {
      'application': 'app',
      'database': 'db',
      'function': 'fn',
      'variable': 'var',
      'parameter': 'param',
      'configuration': 'config',
      'development': 'dev',
      'production': 'prod',
      'environment': 'env'
    };
    
    let result = content;
    Object.entries(abbreviations).forEach(([full, abbrev]) => {
      const regex = new RegExp(`\\b${full}\\b`, 'gi');
      result = result.replace(regex, abbrev);
    });
    
    return result;
  }

  /**
   * Remove redundant phrases
   * @param {string} content 
   * @returns {string}
   */
  removeRedundancy(content) {
    // Remove repeated phrases
    const sentences = content.split(/[.!?]+/);
    const uniqueSentences = [...new Set(sentences.map(s => s.trim()))];
    return uniqueSentences.join('. ');
  }

  /**
   * Simplify sentence structure
   * @param {string} content 
   * @returns {string}
   */
  simplifyStructure(content) {
    return content
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/([.!?])\s*\1+/g, '$1') // Remove repeated punctuation
      .trim();
  }

  /**
   * Estimate token count (rough approximation)
   * @param {string} text 
   * @returns {number}
   */
  estimateTokenCount(text) {
    return Math.ceil(text.length / 4); // Rough estimate: 4 chars per token
  }
}

module.exports = ContentAnalyzer;
