/**
 * Memory Manager for AI Ensemble System
 * Handles storage, retrieval, and lifecycle management of memories
 */

const admin = require('firebase-admin');
const { v4: generateUUID } = require('uuid');
const EnhancedMemoryWeights = require('./memoryWeights');
const ContentAnalyzer = require('./contentAnalysis');
const { MEMORY_TYPE_CONFIG } = require('../types/memory');

class MemoryManager {
  constructor() {
    this.firestore = admin.firestore();
    this.localCache = new Map(); // Fallback cache
    this.weightCalculator = new EnhancedMemoryWeights();
    this.contentAnalyzer = new ContentAnalyzer();
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
      console.log('✅ Firestore connection established');
    } catch (error) {
      this.isFirestoreAvailable = false;
      console.warn('⚠️ Firestore unavailable, using local cache:', error.message);
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
      const analysis = this.contentAnalyzer.analyzeContent(content, isUserPrompt);
      const memoryType = this.determineMemoryType(analysis);
      const userContext = await this.getUserContext(userId);
      
      const memory = {
        id: generateUUID(),
        userId,
        sessionId,
        memoryType,
        content: {
          original: content,
          compressed: this.contentAnalyzer.compressContent(content),
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
          tokenCount: this.contentAnalyzer.estimateTokenCount(content),
          compressedTokenCount: this.contentAnalyzer.estimateTokenCount(this.contentAnalyzer.compressContent(content)),
          modelUsed: modelUsed || null,
          ensembleMode: ensembleMode || false
        },
        weights: this.weightCalculator.calculateAdvancedWeights(
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
          // Query Firestore
          let firestoreQuery = this.firestore.collection('memories')
            .where('userId', '==', userId)
            .where('retention.isArchived', '==', includeArchived);

          if (sessionId) {
            firestoreQuery = firestoreQuery.where('sessionId', '==', sessionId);
          }

          if (memoryTypes && memoryTypes.length > 0) {
            firestoreQuery = firestoreQuery.where('memoryType', 'in', memoryTypes);
          }

          const snapshot = await firestoreQuery
            .orderBy('weights.composite', 'desc')
            .limit(maxResults * 2) // Get more to filter by importance
            .get();

          memories = snapshot.docs.map(doc => doc.data());
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
   * Get memory context for AI prompts with semantic search
   * @param {string} userId
   * @param {string} sessionId
   * @param {number} maxTokens
   * @param {string} currentPrompt - Current user prompt for semantic matching
   * @returns {Promise<string>}
   */
  async getMemoryContext(userId, sessionId, maxTokens = 2048, currentPrompt = null) {
    try {
      let memories = [];

      // Use traditional memory retrieval (vector search removed for simplicity)
      memories = await this.retrieveMemories({
        userId,
        sessionId,
        maxResults: 10,
        minImportance: 0.3
      });

      let context = '';
      let totalTokens = 0;

      for (const memory of memories) {
        const memoryText = `[${memory.memoryType}] ${memory.content.compressed}`;
        const tokenCount = this.contentAnalyzer.estimateTokenCount(memoryText);

        if (totalTokens + tokenCount <= maxTokens) {
          context += `${memoryText}\n`;
          totalTokens += tokenCount;
        } else {
          break;
        }
      }

      const searchMethod = memories.length > 0 && currentPrompt ? 'semantic+traditional' : 'traditional';
      console.log(`🧠 Generated memory context: ${totalTokens} tokens for user ${userId} (${searchMethod})`);
      return context.trim();
    } catch (error) {
      console.error('❌ Failed to get memory context:', error);
      return '';
    }
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
