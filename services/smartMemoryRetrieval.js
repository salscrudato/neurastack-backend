/**
 * Smart Memory Retrieval Service
 * Implements advanced filtering, scoring, and ranking for memory retrieval
 */

const { getMemoryManager } = require('./memoryManager');
const { getVectorDatabaseService } = require('./vectorDatabaseService');
const ContentAnalyzer = require('./contentAnalysis');

class SmartMemoryRetrieval {
  constructor() {
    this.memoryManager = getMemoryManager();
    this.vectorService = getVectorDatabaseService();
    this.contentAnalyzer = new ContentAnalyzer();
    
    // Retrieval configuration
    this.config = {
      maxMemories: 20,
      relevanceThreshold: 0.3,
      temporalDecayFactor: 0.1,
      semanticWeight: 0.4,
      temporalWeight: 0.3,
      importanceWeight: 0.2,
      contextualWeight: 0.1,
      diversityThreshold: 0.8
    };
  }

  /**
   * Retrieve memories with smart filtering and ranking
   * @param {Object} query 
   * @returns {Promise<Array>}
   */
  async retrieveSmartMemories(query) {
    try {
      const {
        userId,
        sessionId,
        currentPrompt,
        maxResults = this.config.maxMemories,
        memoryTypes = null,
        timeRange = null,
        minImportance = this.config.relevanceThreshold
      } = query;

      console.log(`🧠 Smart memory retrieval for user ${userId}`);

      // Step 1: Get candidate memories from multiple sources
      const candidates = await this.getCandidateMemories(userId, sessionId, memoryTypes, timeRange);
      
      if (candidates.length === 0) {
        console.log('📭 No candidate memories found');
        return [];
      }

      console.log(`📚 Found ${candidates.length} candidate memories`);

      // Step 2: Apply semantic filtering if prompt provided
      let semanticCandidates = candidates;
      if (currentPrompt && this.vectorService.isAvailable) {
        semanticCandidates = await this.applySemanticFiltering(candidates, currentPrompt);
        console.log(`🔍 Semantic filtering reduced to ${semanticCandidates.length} memories`);
      }

      // Step 3: Score and rank memories
      const scoredMemories = await this.scoreMemories(semanticCandidates, {
        currentPrompt,
        userId,
        sessionId
      });

      // Step 4: Apply diversity filtering
      const diverseMemories = this.applyDiversityFiltering(scoredMemories);

      // Step 5: Apply temporal and importance filters
      const filteredMemories = this.applyFinalFilters(diverseMemories, minImportance);

      // Step 6: Return top results
      const finalResults = filteredMemories
        .slice(0, maxResults)
        .map(memory => ({
          ...memory,
          retrievalScore: memory.smartScore,
          retrievalReason: memory.retrievalReason
        }));

      console.log(`✅ Smart retrieval completed: ${finalResults.length} memories selected`);
      
      return finalResults;

    } catch (error) {
      console.error('❌ Smart memory retrieval failed:', error);
      
      // Fallback to basic retrieval
      return await this.memoryManager.retrieveMemories({
        userId: query.userId,
        sessionId: query.sessionId,
        maxResults: query.maxResults || 10,
        minImportance: query.minImportance || 0.3
      });
    }
  }

  /**
   * Get candidate memories from multiple sources
   * @param {string} userId 
   * @param {string} sessionId 
   * @param {Array} memoryTypes 
   * @param {Object} timeRange 
   * @returns {Promise<Array>}
   */
  async getCandidateMemories(userId, sessionId, memoryTypes, timeRange) {
    const candidates = new Map(); // Use Map to avoid duplicates

    // Source 1: Session-specific memories
    const sessionMemories = await this.memoryManager.retrieveMemories({
      userId,
      sessionId,
      maxResults: 15,
      minImportance: 0.2
    });
    sessionMemories.forEach(memory => candidates.set(memory.id, memory));

    // Source 2: High-importance memories across sessions
    const importantMemories = await this.memoryManager.retrieveMemories({
      userId,
      maxResults: 20,
      minImportance: 0.7,
      memoryTypes: memoryTypes || ['semantic', 'long_term']
    });
    importantMemories.forEach(memory => candidates.set(memory.id, memory));

    // Source 3: Recent memories from other sessions
    const recentMemories = await this.memoryManager.retrieveMemories({
      userId,
      maxResults: 10,
      minImportance: 0.4,
      timeRange: timeRange || { days: 7 }
    });
    recentMemories.forEach(memory => candidates.set(memory.id, memory));

    return Array.from(candidates.values());
  }

  /**
   * Apply semantic filtering using vector similarity
   * @param {Array} memories 
   * @param {string} currentPrompt 
   * @returns {Promise<Array>}
   */
  async applySemanticFiltering(memories, currentPrompt) {
    try {
      // Get semantic similarity scores
      const vectorResults = await this.vectorService.searchSimilarMemories(currentPrompt, {
        maxResults: memories.length,
        threshold: 0.5
      });

      // Create similarity map
      const similarityMap = new Map();
      vectorResults.forEach(result => {
        similarityMap.set(result.id, result.score);
      });

      // Filter and enhance memories with similarity scores
      return memories
        .map(memory => ({
          ...memory,
          semanticSimilarity: similarityMap.get(memory.id) || 0
        }))
        .filter(memory => memory.semanticSimilarity > 0.3)
        .sort((a, b) => b.semanticSimilarity - a.semanticSimilarity);

    } catch (error) {
      console.warn('⚠️ Semantic filtering failed, using all candidates:', error.message);
      return memories.map(memory => ({ ...memory, semanticSimilarity: 0.5 }));
    }
  }

  /**
   * Score memories using multiple factors
   * @param {Array} memories 
   * @param {Object} context 
   * @returns {Promise<Array>}
   */
  async scoreMemories(memories, context) {
    const now = Date.now();
    
    return memories.map(memory => {
      const scores = {
        semantic: memory.semanticSimilarity || 0,
        temporal: this.calculateTemporalScore(memory, now),
        importance: memory.weights?.composite || memory.content?.importance || 0,
        contextual: this.calculateContextualScore(memory, context)
      };

      // Calculate weighted composite score
      const smartScore = (
        scores.semantic * this.config.semanticWeight +
        scores.temporal * this.config.temporalWeight +
        scores.importance * this.config.importanceWeight +
        scores.contextual * this.config.contextualWeight
      );

      // Determine retrieval reason
      const retrievalReason = this.determineRetrievalReason(scores);

      return {
        ...memory,
        smartScore,
        scores,
        retrievalReason
      };
    }).sort((a, b) => b.smartScore - a.smartScore);
  }

  /**
   * Calculate temporal relevance score
   * @param {Object} memory 
   * @param {number} now 
   * @returns {number}
   */
  calculateTemporalScore(memory, now) {
    const createdAt = new Date(memory.createdAt).getTime();
    const lastAccessed = new Date(memory.retention?.lastAccessed || memory.createdAt).getTime();
    
    // Age factor (newer is better)
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    const ageFactor = Math.exp(-ageHours * this.config.temporalDecayFactor / 24);
    
    // Recent access factor
    const accessHours = (now - lastAccessed) / (1000 * 60 * 60);
    const accessFactor = Math.exp(-accessHours * this.config.temporalDecayFactor / 12);
    
    // Access frequency factor
    const accessCount = memory.retention?.accessCount || 0;
    const frequencyFactor = Math.min(accessCount / 10, 1.0);
    
    return (ageFactor * 0.5 + accessFactor * 0.3 + frequencyFactor * 0.2);
  }

  /**
   * Calculate contextual relevance score
   * @param {Object} memory 
   * @param {Object} context 
   * @returns {number}
   */
  calculateContextualScore(memory, context) {
    let score = 0.5; // Base score

    // Session relevance
    if (memory.sessionId === context.sessionId) {
      score += 0.3;
    }

    // Memory type relevance
    if (context.currentPrompt) {
      const promptAnalysis = this.contentAnalyzer.analyzeContent(context.currentPrompt, true);
      
      // Concept overlap
      const memoryConceptsSet = new Set(memory.content?.concepts || []);
      const promptConceptsSet = new Set(promptAnalysis.concepts || []);
      const conceptOverlap = [...memoryConceptsSet].filter(x => promptConceptsSet.has(x)).length;
      const maxConcepts = Math.max(memoryConceptsSet.size, promptConceptsSet.size);
      
      if (maxConcepts > 0) {
        score += (conceptOverlap / maxConcepts) * 0.2;
      }

      // Intent matching
      if (memory.metadata?.userIntent === promptAnalysis.userIntent) {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Apply diversity filtering to avoid redundant memories
   * @param {Array} memories 
   * @returns {Array}
   */
  applyDiversityFiltering(memories) {
    const selected = [];
    const usedConcepts = new Set();

    for (const memory of memories) {
      const memoryConcepts = new Set(memory.content?.concepts || []);
      
      // Calculate concept overlap with already selected memories
      const overlapRatio = [...memoryConcepts].filter(x => usedConcepts.has(x)).length / memoryConcepts.size;
      
      // Include if diversity threshold is met or if it's a high-scoring memory
      if (overlapRatio < this.config.diversityThreshold || memory.smartScore > 0.8) {
        selected.push(memory);
        memoryConcepts.forEach(concept => usedConcepts.add(concept));
      }
    }

    return selected;
  }

  /**
   * Apply final filters for importance and quality
   * @param {Array} memories 
   * @param {number} minImportance 
   * @returns {Array}
   */
  applyFinalFilters(memories, minImportance) {
    return memories.filter(memory => {
      // Importance filter
      if (memory.smartScore < minImportance) return false;
      
      // Quality filter (avoid corrupted or empty memories)
      if (!memory.content?.original || memory.content.original.length < 10) return false;
      
      // Archived filter
      if (memory.retention?.isArchived) return false;
      
      return true;
    });
  }

  /**
   * Determine why a memory was retrieved
   * @param {Object} scores 
   * @returns {string}
   */
  determineRetrievalReason(scores) {
    const maxScore = Math.max(...Object.values(scores));
    
    if (scores.semantic === maxScore && scores.semantic > 0.7) {
      return 'high_semantic_similarity';
    } else if (scores.importance === maxScore && scores.importance > 0.8) {
      return 'high_importance';
    } else if (scores.temporal === maxScore && scores.temporal > 0.6) {
      return 'recent_relevance';
    } else if (scores.contextual === maxScore && scores.contextual > 0.7) {
      return 'contextual_match';
    } else {
      return 'balanced_relevance';
    }
  }

  /**
   * Get retrieval statistics
   * @returns {Object}
   */
  getRetrievalStats() {
    return {
      config: this.config,
      vectorServiceAvailable: this.vectorService.isAvailable,
      lastRetrievalTime: this.lastRetrievalTime || null
    };
  }
}

// Singleton instance
let smartMemoryRetrievalInstance = null;

/**
 * Get the singleton instance of SmartMemoryRetrieval
 * @returns {SmartMemoryRetrieval}
 */
function getSmartMemoryRetrieval() {
  if (!smartMemoryRetrievalInstance) {
    smartMemoryRetrievalInstance = new SmartMemoryRetrieval();
  }
  return smartMemoryRetrievalInstance;
}

module.exports = { SmartMemoryRetrieval, getSmartMemoryRetrieval };
