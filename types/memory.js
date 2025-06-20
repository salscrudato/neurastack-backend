/**
 * Memory Management Types and Schemas for Neurastack Backend
 * Defines the structure for AI ensemble memory system
 */

/**
 * @typedef {Object} ContentAnalysis
 * @property {Date} timestamp
 * @property {number} baseImportance - 0-1 scale
 * @property {number} sentiment - -1 to 1 scale
 * @property {string} userIntent
 * @property {string[]} concepts
 * @property {string[]} keywords
 * @property {boolean} isQuestion
 * @property {number} complexity - 0-1 scale
 * @property {string} topic
 */

/**
 * @typedef {Object} AccessHistory
 * @property {number} accessCount
 * @property {number} recentAccessCount
 * @property {number} timeSpanDays
 */

/**
 * @typedef {Object} UserContext
 * @property {string[]} expertDomains
 * @property {string[]} commonConcepts
 * @property {string[]} preferences
 */

/**
 * @typedef {Object} MemoryWeights
 * @property {number} recency - 0-1 scale
 * @property {number} importance - 0-1 scale
 * @property {number} frequency - 0-1 scale
 * @property {number} emotional - 0-1 scale
 * @property {number} contextual - 0-1 scale
 * @property {number} composite - 0-1 scale (final score)
 */

/**
 * @typedef {'working'|'short_term'|'long_term'|'semantic'|'episodic'} MemoryType
 */

/**
 * @typedef {Object} EnhancedMemorySchema
 * @property {string} id - Unique identifier
 * @property {string} userId - User identifier
 * @property {string} sessionId - Session identifier
 * @property {MemoryType} memoryType
 * @property {Object} content
 * @property {string} content.original - Original content
 * @property {string} content.compressed - Compressed content
 * @property {string[]} content.keywords - Extracted keywords
 * @property {string[]} content.concepts - Extracted concepts
 * @property {number[]} [content.embedding] - Vector embedding (future)
 * @property {number} content.sentiment - Sentiment score (-1 to 1)
 * @property {number} content.importance - Importance score (0-1)
 * @property {Object} metadata
 * @property {Date} metadata.timestamp
 * @property {string} metadata.conversationTopic
 * @property {string} metadata.userIntent
 * @property {number} metadata.responseQuality - 0-1 scale
 * @property {number} metadata.tokenCount
 * @property {number} metadata.compressedTokenCount
 * @property {string} [metadata.modelUsed]
 * @property {boolean} [metadata.ensembleMode]
 * @property {MemoryWeights} weights
 * @property {Object} retention
 * @property {Date} [retention.expiresAt]
 * @property {Date} retention.lastAccessed
 * @property {number} retention.accessCount
 * @property {number} retention.decayRate
 * @property {boolean} retention.isArchived
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * Memory type configurations
 */
const MEMORY_TYPE_CONFIG = {
  working: {
    ttl: 1000 * 60 * 60, // 1 hour
    decayRate: 0.1,
    maxCount: 10
  },
  short_term: {
    ttl: 1000 * 60 * 60 * 24, // 1 day
    decayRate: 0.05,
    maxCount: 50
  },
  long_term: {
    ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
    decayRate: 0.01,
    maxCount: 200
  },
  semantic: {
    ttl: 1000 * 60 * 60 * 24 * 365, // 1 year
    decayRate: 0.005,
    maxCount: 100
  },
  episodic: {
    ttl: 1000 * 60 * 60 * 24 * 7, // 7 days
    decayRate: 0.02,
    maxCount: 30
  }
};

/**
 * Firestore indexes for optimal query performance
 */
const MEMORY_INDEXES = [
  { fields: ['userId', 'weights.composite'], order: 'desc' },
  { fields: ['userId', 'sessionId', 'createdAt'], order: 'desc' },
  { fields: ['userId', 'memoryType', 'weights.composite'], order: 'desc' },
  { fields: ['userId', 'retention.isArchived', 'weights.composite'], order: 'desc' },
  { fields: ['userId', 'metadata.conversationTopic', 'weights.composite'], order: 'desc' }
];

/**
 * Weight calculation coefficients by memory type
 */
const WEIGHT_COEFFICIENTS = {
  working: { 
    recency: 0.4, 
    importance: 0.3, 
    frequency: 0.1, 
    emotional: 0.1, 
    contextual: 0.1 
  },
  short_term: { 
    recency: 0.3, 
    importance: 0.4, 
    frequency: 0.15, 
    emotional: 0.1, 
    contextual: 0.05 
  },
  long_term: { 
    recency: 0.1, 
    importance: 0.5, 
    frequency: 0.2, 
    emotional: 0.1, 
    contextual: 0.1 
  },
  semantic: { 
    recency: 0.05, 
    importance: 0.6, 
    frequency: 0.25, 
    emotional: 0.05, 
    contextual: 0.05 
  },
  episodic: { 
    recency: 0.2, 
    importance: 0.4, 
    frequency: 0.2, 
    emotional: 0.15, 
    contextual: 0.05 
  }
};

module.exports = {
  MEMORY_TYPE_CONFIG,
  MEMORY_INDEXES,
  WEIGHT_COEFFICIENTS
};
