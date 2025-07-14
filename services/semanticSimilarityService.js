/**
 * Semantic Similarity Service - Simplified keyword-based memory search
 */

class SemanticSimilarityService {
  constructor() {}

  async findSimilarMemories(query, memories, maxResults = 10, minSimilarity = 0.3) {
    const queryLower = query.toLowerCase();
    const results = memories
      .filter(m => m.content.toLowerCase().includes(queryLower))
      .slice(0, maxResults);
    return results.map(m => ({ memory: m, similarity: 1 }));
  }
}

module.exports = new SemanticSimilarityService();