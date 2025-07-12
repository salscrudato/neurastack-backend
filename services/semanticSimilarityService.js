/**
 * 🧠 Semantic Similarity Service - Advanced Memory Retrieval
 *
 * 🎯 PURPOSE: Provide semantic search capabilities with cosine similarity fallback
 *
 * 📋 KEY FEATURES:
 * - 🔍 Cosine similarity calculations for text matching
 * - 📊 TF-IDF vectorization for semantic analysis
 * - 🎯 Keyword-based similarity scoring
 * - 🚀 Fast fallback when vector search fails
 * - 📈 Relevance scoring and ranking
 * - 🛡️ Robust error handling and fallbacks
 *
 * 💡 ANALOGY: Like a smart librarian who can find related books
 *    - Even if the exact title isn't available
 *    - Uses content similarity and topic matching
 *    - Ranks results by relevance and importance
 */

class SemanticSimilarityService {
  constructor() {
    // Stop words to filter out during similarity calculation
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);

    // Cache for computed vectors to improve performance
    this.vectorCache = new Map();
    this.maxCacheSize = 1000;

    console.log('🧠 Semantic Similarity Service initialized');
  }

  /**
   * Find semantically similar memories using cosine similarity
   * @param {string} query - Search query
   * @param {Array} memories - Array of memory objects
   * @param {number} maxResults - Maximum number of results to return
   * @param {number} minSimilarity - Minimum similarity threshold (0-1)
   * @returns {Array} Ranked array of similar memories
   */
  async findSimilarMemories(query, memories, maxResults = 10, minSimilarity = 0.3) {
    try {
      console.log(`🔍 Semantic search for "${query.substring(0, 50)}..." in ${memories.length} memories`);

      if (!query || !memories || memories.length === 0) {
        return [];
      }

      // Prepare query vector
      const queryVector = this.createTextVector(query);
      const results = [];

      // Calculate similarity for each memory
      for (const memory of memories) {
        try {
          const similarity = await this.calculateMemorySimilarity(queryVector, memory);
          
          if (similarity >= minSimilarity) {
            results.push({
              memory,
              similarity,
              relevanceScore: this.calculateRelevanceScore(similarity, memory),
              matchType: this.determineMatchType(query, memory)
            });
          }
        } catch (error) {
          console.warn(`⚠️ Failed to calculate similarity for memory ${memory.id}:`, error.message);
        }
      }

      // Sort by relevance score (combination of similarity and memory importance)
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);

      const topResults = results.slice(0, maxResults);
      console.log(`✅ Found ${topResults.length} semantically similar memories (avg similarity: ${this.calculateAverageSimilarity(topResults)})`);

      return topResults;

    } catch (error) {
      console.error('❌ Semantic similarity search failed:', error.message);
      return this.fallbackKeywordSearch(query, memories, maxResults);
    }
  }

  /**
   * Calculate similarity between query vector and memory content
   * @param {Map} queryVector - Query text vector
   * @param {Object} memory - Memory object
   * @returns {Promise<number>} Similarity score (0-1)
   */
  async calculateMemorySimilarity(queryVector, memory) {
    // Create composite text from memory content
    const memoryText = this.createMemorySearchText(memory);
    const memoryVector = this.createTextVector(memoryText);

    // Calculate cosine similarity
    const cosineSimilarity = this.calculateCosineSimilarity(queryVector, memoryVector);

    // Boost similarity based on keyword matches
    const keywordBoost = this.calculateKeywordBoost(queryVector, memory);

    // Combine cosine similarity with keyword boost
    const finalSimilarity = Math.min(1.0, cosineSimilarity + (keywordBoost * 0.2));

    return finalSimilarity;
  }

  /**
   * Create text vector using TF-IDF-like approach
   * @param {string} text - Input text
   * @returns {Map} Vector representation
   */
  createTextVector(text) {
    const cacheKey = this.hashText(text);
    
    // Check cache first
    if (this.vectorCache.has(cacheKey)) {
      return this.vectorCache.get(cacheKey);
    }

    // Tokenize and clean text
    const tokens = this.tokenizeText(text);
    const vector = new Map();

    // Calculate term frequencies
    for (const token of tokens) {
      vector.set(token, (vector.get(token) || 0) + 1);
    }

    // Normalize by document length
    const magnitude = Math.sqrt(Array.from(vector.values()).reduce((sum, freq) => sum + freq * freq, 0));
    if (magnitude > 0) {
      for (const [term, freq] of vector.entries()) {
        vector.set(term, freq / magnitude);
      }
    }

    // Cache the result
    this.cacheVector(cacheKey, vector);

    return vector;
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Map} vector1 - First vector
   * @param {Map} vector2 - Second vector
   * @returns {number} Cosine similarity (0-1)
   */
  calculateCosineSimilarity(vector1, vector2) {
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    // Get all unique terms
    const allTerms = new Set([...vector1.keys(), ...vector2.keys()]);

    for (const term of allTerms) {
      const freq1 = vector1.get(term) || 0;
      const freq2 = vector2.get(term) || 0;

      dotProduct += freq1 * freq2;
      magnitude1 += freq1 * freq1;
      magnitude2 += freq2 * freq2;
    }

    // Avoid division by zero
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    const similarity = dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
    return Math.max(0, Math.min(1, similarity)); // Clamp to [0, 1]
  }

  /**
   * Calculate keyword-based boost for similarity
   * @param {Map} queryVector - Query vector
   * @param {Object} memory - Memory object
   * @returns {number} Boost factor (0-1)
   */
  calculateKeywordBoost(queryVector, memory) {
    const queryTerms = Array.from(queryVector.keys());
    const memoryKeywords = memory.content?.keywords || [];
    const memoryConcepts = memory.content?.concepts || [];

    let matches = 0;
    let totalTerms = queryTerms.length;

    for (const term of queryTerms) {
      // Check for exact keyword matches
      if (memoryKeywords.some(keyword => keyword.toLowerCase().includes(term.toLowerCase()))) {
        matches += 1;
      }
      // Check for concept matches
      else if (memoryConcepts.some(concept => concept.toLowerCase().includes(term.toLowerCase()))) {
        matches += 0.7; // Slightly lower weight for concept matches
      }
    }

    return totalTerms > 0 ? matches / totalTerms : 0;
  }

  /**
   * Calculate overall relevance score
   * @param {number} similarity - Semantic similarity score
   * @param {Object} memory - Memory object
   * @returns {number} Relevance score
   */
  calculateRelevanceScore(similarity, memory) {
    const importanceWeight = memory.weights?.composite || memory.content?.importance || 0.5;
    const recencyWeight = this.calculateRecencyWeight(memory);
    
    // Combine similarity with memory importance and recency
    return (similarity * 0.6) + (importanceWeight * 0.3) + (recencyWeight * 0.1);
  }

  /**
   * Calculate recency weight based on memory age
   * @param {Object} memory - Memory object
   * @returns {number} Recency weight (0-1)
   */
  calculateRecencyWeight(memory) {
    const now = new Date();
    const memoryDate = new Date(memory.createdAt || memory.metadata?.timestamp || now);
    const ageInDays = (now - memoryDate) / (1000 * 60 * 60 * 24);

    // Exponential decay: newer memories get higher weight
    return Math.exp(-ageInDays / 7); // Half-life of 7 days
  }

  /**
   * Determine the type of match found
   * @param {string} query - Search query
   * @param {Object} memory - Memory object
   * @returns {string} Match type
   */
  determineMatchType(query, memory) {
    const queryLower = query.toLowerCase();
    const contentLower = (memory.content?.original || '').toLowerCase();
    const keywords = (memory.content?.keywords || []).map(k => k.toLowerCase());

    if (contentLower.includes(queryLower)) {
      return 'exact_content';
    } else if (keywords.some(keyword => queryLower.includes(keyword))) {
      return 'keyword_match';
    } else {
      return 'semantic_similarity';
    }
  }

  /**
   * Create searchable text from memory object
   * @param {Object} memory - Memory object
   * @returns {string} Searchable text
   */
  createMemorySearchText(memory) {
    const parts = [
      memory.content?.original || '',
      memory.content?.compressed || '',
      (memory.content?.keywords || []).join(' '),
      (memory.content?.concepts || []).join(' '),
      memory.metadata?.conversationTopic || '',
      memory.metadata?.userIntent || ''
    ];

    return parts.filter(part => part && part.trim()).join(' ');
  }

  /**
   * Tokenize text for vector creation
   * @param {string} text - Input text
   * @returns {Array} Array of tokens
   */
  tokenizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.stopWords.has(token));
  }

  /**
   * Fallback keyword search when semantic search fails
   * @param {string} query - Search query
   * @param {Array} memories - Array of memories
   * @param {number} maxResults - Maximum results
   * @returns {Array} Search results
   */
  fallbackKeywordSearch(query, memories, maxResults) {
    console.log('🔄 Using fallback keyword search');

    const queryTerms = this.tokenizeText(query);
    const results = [];

    for (const memory of memories) {
      const searchText = this.createMemorySearchText(memory).toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        if (searchText.includes(term)) {
          score += 1;
        }
      }

      if (score > 0) {
        results.push({
          memory,
          similarity: score / queryTerms.length,
          relevanceScore: (score / queryTerms.length) * (memory.weights?.composite || 0.5),
          matchType: 'keyword_fallback'
        });
      }
    }

    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  /**
   * Utility functions
   */

  hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  cacheVector(key, vector) {
    if (this.vectorCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.vectorCache.keys().next().value;
      this.vectorCache.delete(firstKey);
    }
    this.vectorCache.set(key, vector);
  }

  calculateAverageSimilarity(results) {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + result.similarity, 0);
    return Math.round((sum / results.length) * 100) / 100;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      cacheSize: this.vectorCache.size,
      maxCacheSize: this.maxCacheSize,
      stopWordsCount: this.stopWords.size
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.vectorCache.clear();
    console.log('🧹 Semantic similarity cache cleared');
  }
}

module.exports = new SemanticSimilarityService();
