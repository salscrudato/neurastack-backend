/**
 * Memory Manager - The AI's Memory System
 *
 * This service is like the AI's brain that remembers your conversations.
 * Just like how you remember past conversations with friends, this system
 * helps the AI remember what you've talked about before so it can give
 * better, more personalized responses.
 *
 * What this does:
 * - Stores important parts of your conversations in a database
 * - Remembers your preferences, interests, and past questions
 * - Retrieves relevant memories when you ask new questions
 * - Automatically forgets old, unimportant memories to save space
 * - Organizes memories by importance and type (short-term vs long-term)
 *
 * Think of it as giving the AI a memory so it can have more meaningful
 * conversations with you over time, just like a human would.
 */

const admin = require('firebase-admin'); // Google's database service for storing memories
const { v4: generateUUID } = require('uuid'); // Creates unique IDs for each memory
const { MEMORY_TYPE_CONFIG } = require('../types/memory'); // Configuration for different memory types
const logger = require('../utils/visualLogger'); // Enhanced visual logging system
const semanticSimilarityService = require('./semanticSimilarityService'); // Semantic search capabilities

/**
 * Memory Manager Class
 * This is the main class that handles all memory operations for the AI
 */
class MemoryManager {
  constructor() {
    // Connect to Google's Firestore database where we store memories
    this.firestore = admin.firestore();

    // Local backup storage in case the database is unavailable
    this.localCache = new Map(); // Fallback cache

    // Track whether the main database is working
    this.isFirestoreAvailable = true;
    
    // Test Firestore connectivity
    this.testFirestoreConnection();
  }

  /**
   * Test Firestore connection and set availability flag
   */
  async testFirestoreConnection() {
    try {
      await this.firestore.collection('_test').limit(1).get();
      this.isFirestoreAvailable = true;
      logger.success(
        'Memory system Firestore connection established',
        {
          'Database': 'neurastack-backend',
          'Collection': 'memories',
          'Status': 'Connected and ready'
        },
        'memory'
      );
    } catch (error) {
      this.isFirestoreAvailable = false;
      logger.warning(
        'Firestore unavailable - Memory system using local cache only',
        {
          'Error': error.message,
          'Fallback': 'Local cache active',
          'Impact': 'Memories will not persist between restarts'
        },
        'memory'
      );
    }
  }

  /**
   * Store a new memory
   * @param {string} userId 
   * @param {string} sessionId 
   * @param {string} content 
   * @param {boolean} isUserPrompt 
   * @param {number} [responseQuality] 
   * @param {string} [modelUsed] 
   * @param {boolean} [ensembleMode] 
   * @returns {Promise<import('../types/memory').EnhancedMemorySchema>}
   */
  async storeMemory(userId, sessionId, content, isUserPrompt, responseQuality = 0.5, modelUsed, ensembleMode = false) {
    try {
      const analysis = this.analyzeContentSimple(content, isUserPrompt);
      const memoryType = this.determineMemoryType(analysis);
      const userContext = await this.getUserContext(userId);

      const memory = {
        id: generateUUID(),
        userId,
        sessionId,
        memoryType,
        content: {
          original: content,
          compressed: this.compressContentSimple(content),
          keywords: analysis.keywords,
          concepts: analysis.concepts,
          sentiment: analysis.sentiment,
          importance: analysis.baseImportance
        },
        metadata: {
          timestamp: analysis.timestamp,
          conversationTopic: analysis.topic,
          userIntent: analysis.userIntent,
          responseQuality,
          tokenCount: this.estimateTokenCount(content),
          compressedTokenCount: this.estimateTokenCount(this.compressContentSimple(content)),
          modelUsed: modelUsed || null,
          ensembleMode: ensembleMode || false
        },
        weights: this.calculateSimpleWeights(
          analysis,
          memoryType,
          { accessCount: 0, recentAccessCount: 0, timeSpanDays: 1 },
          userContext
        ),
        retention: this.calculateRetention(memoryType, analysis.baseImportance),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store in Firestore if available, and always store in local cache as backup
      if (this.isFirestoreAvailable) {
        try {
          await this.firestore.collection('memories').doc(memory.id).set(memory);
        } catch (error) {
          console.warn('⚠️ Failed to store in Firestore, using local cache only:', error.message);
          this.isFirestoreAvailable = false;
        }
      }

      // Vector database storage removed for simplicity

      // Always store in local cache as backup
      this.localCache.set(memory.id, memory);

      console.log(`📝 Memory stored: ${memory.id} (${memoryType}) for user ${userId}`);
      return memory;
    } catch (error) {
      console.error('❌ Failed to store memory:', error);
      throw error;
    }
  }

  /**
   * Retrieve memories based on criteria
   * @param {Object} params 
   * @param {string} params.userId 
   * @param {string} [params.sessionId] 
   * @param {import('../types/memory').MemoryType[]} [params.memoryTypes] 
   * @param {number} [params.maxResults] 
   * @param {number} [params.minImportance] 
   * @param {boolean} [params.includeArchived] 
   * @param {string} [params.query] 
   * @returns {Promise<import('../types/memory').EnhancedMemorySchema[]>}
   */
  async retrieveMemories(params) {
    const {
      userId,
      sessionId,
      memoryTypes,
      maxResults = 10,
      minImportance = 0.3,
      includeArchived = false,
      query
    } = params;

    try {
      let memories = [];

      if (this.isFirestoreAvailable) {
        try {
          // Use optimized Firestore query strategy to avoid complex index requirements
          let firestoreQuery = this.firestore.collection('memories')
            .where('userId', '==', userId);

          // Use simple ordering by creation time (requires minimal indexing)
          firestoreQuery = firestoreQuery
            .orderBy('createdAt', 'desc')
            .limit(maxResults * 3); // Get more results for client-side filtering

          const snapshot = await firestoreQuery.get();
          let allMemories = snapshot.docs.map(doc => doc.data());

          // Apply client-side filtering for complex conditions to avoid index requirements
          memories = allMemories
            .filter(memory => {
              // Filter by archived status
              const isArchived = memory.retention?.isArchived || false;
              if (isArchived !== includeArchived) return false;

              // Filter by session if specified
              if (sessionId && memory.sessionId !== sessionId) return false;

              // Filter by memory types if specified
              if (memoryTypes && memoryTypes.length > 0 && !memoryTypes.includes(memory.memoryType)) return false;

              // Filter by importance threshold
              const importance = memory.weights?.composite || 0;
              if (importance < minImportance) return false;

              return true;
            })
            .sort((a, b) => {
              // Sort by composite weight (importance) descending
              const weightA = a.weights?.composite || 0;
              const weightB = b.weights?.composite || 0;
              return weightB - weightA;
            })
            .slice(0, maxResults);

        } catch (error) {
          console.warn('⚠️ Firestore query failed, falling back to local cache:', error.message);
          this.isFirestoreAvailable = false;
          // Fall through to local cache
        }
      }

      if (!this.isFirestoreAvailable) {
        // Use local cache
        memories = Array.from(this.localCache.values())
          .filter(memory => memory.userId === userId)
          .filter(memory => !sessionId || memory.sessionId === sessionId)
          .filter(memory => !memoryTypes || memoryTypes.includes(memory.memoryType))
          .filter(memory => memory.retention.isArchived === includeArchived);
      }

      // Filter by importance and apply text search if query provided
      memories = memories
        .filter(memory => memory.content.importance >= minImportance)
        .filter(memory => !query || this.matchesQuery(memory, query))
        .sort((a, b) => b.weights.composite - a.weights.composite)
        .slice(0, maxResults);

      // Update access tracking
      await this.updateAccessTracking(memories);

      console.log(`🔍 Retrieved ${memories.length} memories for user ${userId}`);
      return memories;
    } catch (error) {
      console.error('❌ Failed to retrieve memories:', error);
      return [];
    }
  }

  /**
   * Get memory context for AI prompts with semantic search fallback
   * @param {string} userId
   * @param {string} sessionId
   * @param {number} maxTokens
   * @param {string} currentPrompt - Current user prompt for semantic matching
   * @returns {Promise<string>}
   */
  async getMemoryContext(userId, sessionId, maxTokens = 2048, currentPrompt = null) {
    try {
      let memories = [];
      let searchMethod = 'traditional';

      // First, try traditional memory retrieval
      memories = await this.retrieveMemories({
        userId,
        sessionId,
        maxResults: 15, // Get more candidates for semantic filtering
        minImportance: 0.2 // Lower threshold for initial retrieval
      });

      // If we have a current prompt and memories, use semantic search to improve relevance
      if (currentPrompt && memories.length > 0) {
        try {
          const semanticResults = await semanticSimilarityService.findSimilarMemories(
            currentPrompt,
            memories,
            10, // Max results after semantic filtering
            0.3 // Minimum similarity threshold
          );

          if (semanticResults.length > 0) {
            // Use semantically similar memories, sorted by relevance
            memories = semanticResults.map(result => ({
              ...result.memory,
              _semanticScore: result.similarity,
              _relevanceScore: result.relevanceScore,
              _matchType: result.matchType
            }));
            searchMethod = 'semantic+traditional';
            console.log(`🔍 Enhanced ${memories.length} memories with semantic search (avg similarity: ${this.calculateAverageSemanticScore(memories)})`);
          }
        } catch (semanticError) {
          console.warn('⚠️ Semantic search failed, using traditional results:', semanticError.message);
          // Continue with traditional results
        }
      }

      // If traditional search yielded few results, try semantic search fallback on broader dataset
      if (memories.length < 3 && currentPrompt) {
        try {
          console.log('🔄 Trying semantic search fallback with broader dataset...');
          const broaderMemories = await this.retrieveMemories({
            userId,
            maxResults: 50, // Much broader search
            minImportance: 0.1 // Very low threshold
          });

          if (broaderMemories.length > memories.length) {
            const fallbackResults = await semanticSimilarityService.findSimilarMemories(
              currentPrompt,
              broaderMemories,
              8,
              0.25 // Lower similarity threshold for fallback
            );

            if (fallbackResults.length > memories.length) {
              memories = fallbackResults.map(result => ({
                ...result.memory,
                _semanticScore: result.similarity,
                _relevanceScore: result.relevanceScore,
                _matchType: result.matchType + '_fallback'
              }));
              searchMethod = 'semantic_fallback';
              console.log(`🎯 Semantic fallback found ${memories.length} additional relevant memories`);
            }
          }
        } catch (fallbackError) {
          console.warn('⚠️ Semantic fallback also failed:', fallbackError.message);
        }
      }

      // Build context string with token limit
      let context = '';
      let totalTokens = 0;

      for (const memory of memories) {
        const semanticInfo = memory._matchType ? ` (${memory._matchType})` : '';
        const memoryText = `[${memory.memoryType}${semanticInfo}] ${memory.content.compressed}`;
        const tokenCount = this.estimateTokenCount(memoryText);

        if (totalTokens + tokenCount <= maxTokens) {
          context += `${memoryText}\n`;
          totalTokens += tokenCount;
        } else {
          break;
        }
      }

      console.log(`🧠 Generated memory context: ${totalTokens} tokens for user ${userId} (${searchMethod})`);
      return context.trim();
    } catch (error) {
      console.error('❌ Failed to get memory context:', error);
      return '';
    }
  }

  /**
   * Calculate average semantic score for logging
   * @param {Array} memories - Memories with semantic scores
   * @returns {number} Average score
   */
  calculateAverageSemanticScore(memories) {
    const scoresWithSemantic = memories.filter(m => m._semanticScore !== undefined);
    if (scoresWithSemantic.length === 0) return 0;

    const sum = scoresWithSemantic.reduce((acc, m) => acc + m._semanticScore, 0);
    return Math.round((sum / scoresWithSemantic.length) * 100) / 100;
  }

  /**
   * Get memories by their IDs
   * @param {string[]} memoryIds
   * @returns {Promise<Array>}
   */
  async getMemoriesByIds(memoryIds) {
    const memories = [];

    for (const id of memoryIds) {
      // Check local cache first
      if (this.localCache.has(id)) {
        memories.push(this.localCache.get(id));
        continue;
      }

      // Try Firestore
      if (this.isFirestoreAvailable) {
        try {
          const doc = await this.firestore.collection('memories').doc(id).get();
          if (doc.exists) {
            const memory = doc.data();
            this.localCache.set(id, memory); // Cache for future use
            memories.push(memory);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch memory ${id} from Firestore:`, error.message);
        }
      }
    }

    return memories;
  }

  /**
   * Get memory analytics for a user
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getMemoryMetrics(userId) {
    try {
      // For system-wide metrics, aggregate across all users
      if (userId === 'system') {
        return await this.getSystemMemoryMetrics();
      }

      const allMemories = await this.retrieveMemories({
        userId,
        maxResults: 1000,
        minImportance: 0,
        includeArchived: true
      });

      const metrics = {
        totalMemories: allMemories.length,
        memoryTypes: {},
        averageImportance: 0,
        averageCompositeScore: 0,
        archivedCount: 0,
        recentMemories: 0
      };

      if (allMemories.length === 0) return metrics;

      // Calculate metrics
      let totalImportance = 0;
      let totalComposite = 0;
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);

      allMemories.forEach(memory => {
        // Count by type
        metrics.memoryTypes[memory.memoryType] = (metrics.memoryTypes[memory.memoryType] || 0) + 1;

        // Sum for averages
        totalImportance += memory.content.importance;
        totalComposite += memory.weights.composite;

        // Count archived
        if (memory.retention.isArchived) metrics.archivedCount++;

        // Count recent
        if (memory.createdAt.getTime() > oneDayAgo) metrics.recentMemories++;
      });

      metrics.averageImportance = totalImportance / allMemories.length;
      metrics.averageCompositeScore = totalComposite / allMemories.length;

      return metrics;
    } catch (error) {
      console.error('❌ Failed to get memory metrics:', error);
      return { error: 'Failed to calculate metrics' };
    }
  }

  /**
   * Get system-wide memory metrics for monitoring dashboard
   * @returns {Promise<Object>}
   */
  async getSystemMemoryMetrics() {
    try {
      const startTime = Date.now();

      // Get metrics from local cache first (faster)
      const localCacheSize = this.localCache.size;
      let workingMemorySize = 0;
      let shortTermMemorySize = 0;
      let longTermMemorySize = 0;
      let semanticMemorySize = 0;
      let episodicMemorySize = 0;

      // Count by type from local cache
      for (const memory of this.localCache.values()) {
        switch (memory.memoryType) {
          case 'working':
            workingMemorySize++;
            break;
          case 'short_term':
            shortTermMemorySize++;
            break;
          case 'long_term':
            longTermMemorySize++;
            break;
          case 'semantic':
            semanticMemorySize++;
            break;
          case 'episodic':
            episodicMemorySize++;
            break;
        }
      }

      // If Firestore is available, get more comprehensive metrics
      if (this.isFirestoreAvailable) {
        try {
          const collections = await Promise.all([
            this.firestore.collection('memories').where('memoryType', '==', 'working').count().get(),
            this.firestore.collection('memories').where('memoryType', '==', 'short_term').count().get(),
            this.firestore.collection('memories').where('memoryType', '==', 'long_term').count().get(),
            this.firestore.collection('memories').where('memoryType', '==', 'semantic').count().get(),
            this.firestore.collection('memories').where('memoryType', '==', 'episodic').count().get()
          ]);

          workingMemorySize = collections[0].data().count;
          shortTermMemorySize = collections[1].data().count;
          longTermMemorySize = collections[2].data().count;
          semanticMemorySize = collections[3].data().count;
          episodicMemorySize = collections[4].data().count;
        } catch (firestoreError) {
          console.warn('⚠️ Failed to get Firestore memory counts, using local cache:', firestoreError.message);
        }
      }

      const retrievalTime = Date.now() - startTime;

      return {
        workingMemorySize,
        shortTermMemorySize,
        longTermMemorySize,
        semanticMemorySize,
        episodicMemorySize,
        totalMemories: workingMemorySize + shortTermMemorySize + longTermMemorySize + semanticMemorySize + episodicMemorySize,
        avgRetrievalTime: retrievalTime,
        localCacheSize,
        firestoreAvailable: this.isFirestoreAvailable,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to get system memory metrics:', error);
      return {
        workingMemorySize: 0,
        shortTermMemorySize: 0,
        longTermMemorySize: 0,
        semanticMemorySize: 0,
        episodicMemorySize: 0,
        totalMemories: 0,
        avgRetrievalTime: 0,
        localCacheSize: this.localCache.size,
        firestoreAvailable: this.isFirestoreAvailable,
        error: 'Failed to calculate system metrics'
      };
    }
  }

  /**
   * Determine memory type based on content analysis
   * @param {import('../types/memory').ContentAnalysis} analysis 
   * @returns {import('../types/memory').MemoryType}
   */
  determineMemoryType(analysis) {
    // Questions and interactions are episodic
    if (analysis.isQuestion || analysis.userIntent === 'question') {
      return 'episodic';
    }
    
    // High complexity content goes to long-term
    if (analysis.complexity > 0.7 || analysis.baseImportance > 0.8) {
      return 'long_term';
    }
    
    // Technical concepts are semantic
    if (analysis.concepts.length > 3) {
      return 'semantic';
    }
    
    // Default to short-term
    return 'short_term';
  }

  /**
   * Calculate retention settings for a memory
   * @param {import('../types/memory').MemoryType} memoryType 
   * @param {number} importance 
   * @returns {Object}
   */
  calculateRetention(memoryType, importance) {
    const now = new Date();
    const config = MEMORY_TYPE_CONFIG[memoryType];
    
    return {
      expiresAt: memoryType !== 'semantic' && importance < 0.7 ? 
        new Date(now.getTime() + config.ttl) : undefined,
      lastAccessed: now,
      accessCount: 0,
      decayRate: config.decayRate,
      isArchived: false
    };
  }

  /**
   * Get user context (placeholder for future enhancement)
   * @param {string} userId 
   * @returns {Promise<import('../types/memory').UserContext>}
   */
  async getUserContext(userId) {
    // Placeholder - could be enhanced with user profile data
    return {
      expertDomains: ['software', 'ai', 'web development'],
      commonConcepts: ['api', 'database', 'function'],
      preferences: ['analytical']
    };
  }

  /**
   * Check if memory matches search query
   * @param {import('../types/memory').EnhancedMemorySchema} memory 
   * @param {string} query 
   * @returns {boolean}
   */
  matchesQuery(memory, query) {
    const searchText = `${memory.content.original} ${memory.content.keywords.join(' ')} ${memory.content.concepts.join(' ')}`.toLowerCase();
    return searchText.includes(query.toLowerCase());
  }

  /**
   * Update access tracking for retrieved memories
   * @param {import('../types/memory').EnhancedMemorySchema[]} memories
   */
  async updateAccessTracking(memories) {
    const updatePromises = memories.map(async (memory) => {
      const updateData = {
        'retention.accessCount': admin.firestore.FieldValue.increment(1),
        'retention.lastAccessed': new Date()
      };

      if (this.isFirestoreAvailable) {
        return this.firestore.collection('memories').doc(memory.id).update(updateData);
      } else {
        // Update local cache
        const cached = this.localCache.get(memory.id);
        if (cached) {
          cached.retention.accessCount++;
          cached.retention.lastAccessed = new Date();
        }
      }
    });

    try {
      await Promise.all(updatePromises);
    } catch (error) {
      console.warn('⚠️ Failed to update access tracking:', error.message);
    }
  }

  /**
   * Simple content analysis replacement for removed contentAnalysis service
   * Provides basic analysis functionality for memory management
   */
  analyzeContentSimple(content, isUserPrompt) {
    const words = content.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Extract simple keywords (words longer than 3 characters, not common words)
    const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'way', 'she', 'use', 'her', 'many', 'oil', 'sit', 'set', 'run', 'eat', 'far', 'sea', 'eye']);
    const keywords = words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10); // Top 10 keywords

    // Simple concept extraction (look for technical terms)
    const concepts = words
      .filter(word => word.length > 5 && (word.includes('api') || word.includes('data') || word.includes('function') || word.includes('service')))
      .slice(0, 5);

    // Simple importance calculation
    const baseImportance = Math.min(0.9, Math.max(0.1,
      (content.length / 1000) * 0.3 +
      (keywords.length / 10) * 0.3 +
      (isUserPrompt ? 0.4 : 0.2)
    ));

    return {
      keywords,
      concepts,
      sentiment: 'neutral', // Simplified
      baseImportance,
      complexity: Math.min(0.9, sentences.length / 10),
      timestamp: new Date(),
      topic: keywords[0] || 'general',
      userIntent: isUserPrompt ? 'question' : 'response',
      isQuestion: isUserPrompt && content.includes('?')
    };
  }

  /**
   * Aggressive content compression for storage efficiency
   */
  compressContentSimple(content) {
    if (!content || content.length < 100) return content;

    // Aggressive compression for memories >200 tokens
    const estimatedTokens = this.estimateTokenCount(content);
    if (estimatedTokens > 200) {
      return this.aggressiveCompress(content);
    }

    // Standard compression for shorter content
    if (content.length <= 200) return content;
    return content.substring(0, 150) + '...' + content.substring(content.length - 50);
  }

  /**
   * Aggressive compression for large content (>200 tokens)
   */
  aggressiveCompress(content) {
    // Extract key sentences and concepts
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);

    // Keep only the most important sentences (first, last, and those with keywords)
    const importantSentences = [];
    const keywords = ['important', 'key', 'main', 'primary', 'essential', 'critical', 'significant'];

    // Always keep first sentence
    if (sentences.length > 0) {
      importantSentences.push(sentences[0]);
    }

    // Keep sentences with keywords
    sentences.slice(1, -1).forEach(sentence => {
      if (keywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        importantSentences.push(sentence);
      }
    });

    // Always keep last sentence if different from first
    if (sentences.length > 1 && sentences[sentences.length - 1] !== sentences[0]) {
      importantSentences.push(sentences[sentences.length - 1]);
    }

    // Join and apply standard compression
    const compressed = importantSentences.join('. ')
      .replace(/\s+/g, ' ')
      .replace(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|that|this|these|those)\b/gi, '')
      .replace(/[,;:]+/g, ',')
      .replace(/[.]{2,}/g, '...')
      .trim();

    // Ensure we've achieved significant compression
    const originalTokens = this.estimateTokenCount(content);
    const compressedTokens = this.estimateTokenCount(compressed);
    const compressionRatio = compressedTokens / originalTokens;

    console.log(`🗜️ Aggressive compression: ${originalTokens} → ${compressedTokens} tokens (${(compressionRatio * 100).toFixed(1)}%)`);

    return compressed;
  }

  /**
   * Simple token estimation replacement
   */
  estimateTokenCount(text) {
    // Rough estimation: 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Simple weight calculation replacement
   */
  calculateSimpleWeights(analysis, memoryType, usage, userContext) {
    const baseWeight = analysis.baseImportance;
    const typeMultiplier = {
      'working': 0.8,
      'short_term': 0.6,
      'long_term': 1.0,
      'semantic': 0.9,
      'episodic': 0.7
    }[memoryType] || 0.5;

    const composite = baseWeight * typeMultiplier;

    return {
      importance: baseWeight,
      recency: 1.0, // New memories have max recency
      frequency: 0.1, // New memories have low frequency
      context: 0.5, // Default context relevance
      composite: Math.min(0.99, composite)
    };
  }

  /**
   * Intelligent forgetting mechanism - periodically prune low-importance memories
   * @param {string} userId - Optional user ID to target specific user
   * @returns {Promise<Object>} Pruning statistics
   */
  async intelligentForgetting(userId = null) {
    try {
      console.log(`🧹 Starting intelligent forgetting process${userId ? ` for user ${userId}` : ' (all users)'}`);

      const stats = {
        totalMemoriesScanned: 0,
        memoriesRemoved: 0,
        memoriesArchived: 0,
        memoryTypesProcessed: {},
        spaceSavedTokens: 0,
        processingTime: Date.now()
      };

      // Get all memories for analysis
      let memories = [];
      if (userId) {
        memories = await this.retrieveMemories({
          userId,
          maxResults: 1000,
          minImportance: 0,
          includeArchived: true
        });
      } else {
        // Process all users (be careful with this in production)
        if (this.isFirestoreAvailable) {
          const snapshot = await this.firestore.collection('memories').limit(1000).get();
          memories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
          memories = Array.from(this.localCache.values());
        }
      }

      stats.totalMemoriesScanned = memories.length;

      // Analyze each memory for forgetting criteria
      const forgettingDecisions = await Promise.all(
        memories.map(memory => this.analyzeForgettingCriteria(memory))
      );

      // Process forgetting decisions
      for (let i = 0; i < memories.length; i++) {
        const memory = memories[i];
        const decision = forgettingDecisions[i];

        stats.memoryTypesProcessed[memory.memoryType] =
          (stats.memoryTypesProcessed[memory.memoryType] || 0) + 1;

        if (decision.action === 'remove') {
          await this.removeMemory(memory.id);
          stats.memoriesRemoved++;
          stats.spaceSavedTokens += memory.metadata?.tokenCount || 0;
          console.log(`🗑️ Removed memory ${memory.id}: ${decision.reason}`);
        } else if (decision.action === 'archive') {
          await this.archiveMemory(memory.id);
          stats.memoriesArchived++;
          console.log(`📦 Archived memory ${memory.id}: ${decision.reason}`);
        }
      }

      stats.processingTime = Date.now() - stats.processingTime;

      console.log(`✅ Intelligent forgetting completed:`, {
        scanned: stats.totalMemoriesScanned,
        removed: stats.memoriesRemoved,
        archived: stats.memoriesArchived,
        spaceSaved: `${stats.spaceSavedTokens} tokens`,
        duration: `${stats.processingTime}ms`
      });

      return stats;
    } catch (error) {
      console.error('❌ Intelligent forgetting failed:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Analyze memory for forgetting criteria
   * @param {Object} memory - Memory to analyze
   * @returns {Promise<Object>} Forgetting decision
   */
  async analyzeForgettingCriteria(memory) {
    const now = new Date();
    const memoryAge = now - new Date(memory.createdAt);
    const daysSinceCreated = memoryAge / (1000 * 60 * 60 * 24);
    const daysSinceAccessed = (now - new Date(memory.retention?.lastAccessed || memory.createdAt)) / (1000 * 60 * 60 * 24);

    // Get memory type configuration
    const typeConfig = MEMORY_TYPE_CONFIG[memory.memoryType] || MEMORY_TYPE_CONFIG.working;
    const maxAgeDays = typeConfig.ttl / (1000 * 60 * 60 * 24);

    // Criteria for removal
    if (memory.retention?.isArchived && daysSinceAccessed > 30) {
      return { action: 'remove', reason: 'Archived memory not accessed for 30+ days' };
    }

    if (daysSinceCreated > maxAgeDays * 2) {
      return { action: 'remove', reason: `Memory exceeded maximum age (${Math.round(daysSinceCreated)} > ${Math.round(maxAgeDays * 2)} days)` };
    }

    if (memory.weights?.composite < 0.1 && daysSinceAccessed > 7) {
      return { action: 'remove', reason: 'Very low importance and not accessed recently' };
    }

    if (memory.metadata?.responseQuality < 0.3 && daysSinceAccessed > 14) {
      return { action: 'remove', reason: 'Low quality response not accessed recently' };
    }

    // Criteria for archiving
    if (daysSinceCreated > maxAgeDays && !memory.retention?.isArchived) {
      return { action: 'archive', reason: `Memory exceeded standard age (${Math.round(daysSinceCreated)} > ${Math.round(maxAgeDays)} days)` };
    }

    if (memory.weights?.composite < 0.3 && daysSinceAccessed > 3) {
      return { action: 'archive', reason: 'Low importance and not recently accessed' };
    }

    if ((memory.retention?.accessCount || 0) === 0 && daysSinceCreated > 1) {
      return { action: 'archive', reason: 'Never accessed after creation' };
    }

    // Keep the memory
    return { action: 'keep', reason: 'Memory meets retention criteria' };
  }

  /**
   * Archive a memory (mark as archived but don't delete)
   * @param {string} memoryId - Memory ID to archive
   * @returns {Promise<boolean>} Success status
   */
  async archiveMemory(memoryId) {
    try {
      const updateData = {
        'retention.isArchived': true,
        'retention.archivedAt': new Date(),
        updatedAt: new Date()
      };

      if (this.isFirestoreAvailable) {
        await this.firestore.collection('memories').doc(memoryId).update(updateData);
      }

      // Update local cache
      if (this.localCache.has(memoryId)) {
        const memory = this.localCache.get(memoryId);
        memory.retention.isArchived = true;
        memory.retention.archivedAt = new Date();
        memory.updatedAt = new Date();
      }

      return true;
    } catch (error) {
      console.warn(`⚠️ Failed to archive memory ${memoryId}:`, error.message);
      return false;
    }
  }

  /**
   * Remove a memory completely
   * @param {string} memoryId - Memory ID to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeMemory(memoryId) {
    try {
      if (this.isFirestoreAvailable) {
        await this.firestore.collection('memories').doc(memoryId).delete();
      }

      // Remove from local cache
      this.localCache.delete(memoryId);

      return true;
    } catch (error) {
      console.warn(`⚠️ Failed to remove memory ${memoryId}:`, error.message);
      return false;
    }
  }

  /**
   * Schedule periodic intelligent forgetting
   * @param {number} intervalHours - Hours between forgetting cycles
   */
  scheduleIntelligentForgetting(intervalHours = 24) {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    setInterval(async () => {
      try {
        console.log('⏰ Starting scheduled intelligent forgetting...');
        await this.intelligentForgetting();
      } catch (error) {
        console.error('❌ Scheduled forgetting failed:', error.message);
      }
    }, intervalMs);

    console.log(`⏰ Intelligent forgetting scheduled every ${intervalHours} hours`);
  }
}

// Singleton instance
let memoryManagerInstance = null;

/**
 * Get the singleton instance of MemoryManager
 * @returns {MemoryManager}
 */
function getMemoryManager() {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager();
  }
  return memoryManagerInstance;
}

module.exports = { MemoryManager, getMemoryManager };
