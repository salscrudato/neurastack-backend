/**
 * Vector Database Service
 * Provides vector storage and similarity search capabilities with multiple provider support
 */

const crypto = require('crypto');

class VectorDatabaseService {
  constructor() {
    this.provider = process.env.VECTOR_DB_PROVIDER || 'memory'; // 'pinecone', 'weaviate', 'memory'
    this.client = null;
    this.isAvailable = false;
    this.memoryStore = new Map(); // Fallback in-memory vector store
    this.embeddingCache = new Map(); // Cache for embeddings
    
    // Configuration
    this.config = {
      dimension: 1536, // OpenAI embedding dimension
      maxResults: 10,
      similarityThreshold: 0.7,
      cacheSize: 1000
    };

    this.initializeProvider();
  }

  /**
   * Initialize the vector database provider
   */
  async initializeProvider() {
    try {
      switch (this.provider) {
        case 'pinecone':
          await this.initializePinecone();
          break;
        case 'weaviate':
          await this.initializeWeaviate();
          break;
        default:
          console.log('📝 Using in-memory vector store (no external provider configured)');
          this.isAvailable = true;
      }
    } catch (error) {
      console.warn('⚠️ Vector database initialization failed, using memory store:', error.message);
      this.provider = 'memory';
      this.isAvailable = true;
    }
  }

  /**
   * Initialize Pinecone client
   */
  async initializePinecone() {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY not provided');
    }

    try {
      const { Pinecone } = require('@pinecone-database/pinecone');
      
      this.client = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
        environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp'
      });

      // Test connection
      const indexName = process.env.PINECONE_INDEX || 'neurastack-memories';
      this.index = this.client.index(indexName);
      
      console.log('✅ Pinecone vector database connected');
      this.isAvailable = true;
    } catch (error) {
      throw new Error(`Pinecone initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize Weaviate client
   */
  async initializeWeaviate() {
    if (!process.env.WEAVIATE_URL) {
      throw new Error('WEAVIATE_URL not provided');
    }

    try {
      const weaviate = require('weaviate-ts-client');
      
      this.client = weaviate.client({
        scheme: process.env.WEAVIATE_SCHEME || 'http',
        host: process.env.WEAVIATE_URL,
        apiKey: process.env.WEAVIATE_API_KEY ? 
          new weaviate.ApiKey(process.env.WEAVIATE_API_KEY) : undefined
      });

      // Test connection
      await this.client.misc.metaGetter().do();
      
      console.log('✅ Weaviate vector database connected');
      this.isAvailable = true;
    } catch (error) {
      throw new Error(`Weaviate initialization failed: ${error.message}`);
    }
  }

  /**
   * Generate embedding for text content
   */
  async generateEmbedding(text) {
    // Check cache first
    const textHash = crypto.createHash('md5').update(text).digest('hex');
    if (this.embeddingCache.has(textHash)) {
      return this.embeddingCache.get(textHash);
    }

    try {
      // Use OpenAI embeddings API
      const openai = require('../config/openai');
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text.substring(0, 8000) // Limit input length
      });

      const embedding = response.data[0].embedding;
      
      // Cache the embedding
      if (this.embeddingCache.size >= this.config.cacheSize) {
        // Remove oldest entry
        const firstKey = this.embeddingCache.keys().next().value;
        this.embeddingCache.delete(firstKey);
      }
      this.embeddingCache.set(textHash, embedding);

      return embedding;
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error.message);
      throw error;
    }
  }

  /**
   * Store memory with vector embedding
   */
  async storeMemoryVector(memoryId, content, metadata = {}) {
    try {
      const embedding = await this.generateEmbedding(content);
      const vector = {
        id: memoryId,
        values: embedding,
        metadata: {
          content: content.substring(0, 1000), // Store truncated content
          timestamp: Date.now(),
          ...metadata
        }
      };

      switch (this.provider) {
        case 'pinecone':
          await this.index.upsert([vector]);
          break;
        case 'weaviate':
          await this.storeInWeaviate(vector);
          break;
        default:
          this.memoryStore.set(memoryId, vector);
      }

      console.log(`📊 Vector stored: ${memoryId} (${this.provider})`);
      return true;
    } catch (error) {
      console.error('❌ Failed to store memory vector:', error.message);
      return false;
    }
  }

  /**
   * Store vector in Weaviate
   */
  async storeInWeaviate(vector) {
    await this.client.data
      .creator()
      .withClassName('Memory')
      .withId(vector.id)
      .withVector(vector.values)
      .withProperties(vector.metadata)
      .do();
  }

  /**
   * Search for similar memories using vector similarity
   */
  async searchSimilarMemories(queryText, options = {}) {
    try {
      const {
        maxResults = this.config.maxResults,
        threshold = this.config.similarityThreshold,
        userId = null,
        memoryTypes = null
      } = options;

      const queryEmbedding = await this.generateEmbedding(queryText);
      let results = [];

      switch (this.provider) {
        case 'pinecone':
          results = await this.searchPinecone(queryEmbedding, maxResults, userId, memoryTypes);
          break;
        case 'weaviate':
          results = await this.searchWeaviate(queryEmbedding, maxResults, userId, memoryTypes);
          break;
        default:
          results = await this.searchMemoryStore(queryEmbedding, maxResults, userId, memoryTypes);
      }

      // Filter by similarity threshold
      const filteredResults = results.filter(result => result.score >= threshold);
      
      console.log(`🔍 Vector search: ${filteredResults.length} results (threshold: ${threshold})`);
      return filteredResults;
    } catch (error) {
      console.error('❌ Vector search failed:', error.message);
      return [];
    }
  }

  /**
   * Search Pinecone index
   */
  async searchPinecone(queryEmbedding, maxResults, userId, memoryTypes) {
    const filter = {};
    if (userId) filter.userId = userId;
    if (memoryTypes) filter.memoryType = { $in: memoryTypes };

    const response = await this.index.query({
      vector: queryEmbedding,
      topK: maxResults,
      includeMetadata: true,
      filter: Object.keys(filter).length > 0 ? filter : undefined
    });

    return response.matches.map(match => ({
      id: match.id,
      score: match.score,
      content: match.metadata.content,
      metadata: match.metadata
    }));
  }

  /**
   * Search Weaviate
   */
  async searchWeaviate(queryEmbedding, maxResults, userId, memoryTypes) {
    let query = this.client.graphql
      .get()
      .withClassName('Memory')
      .withFields('content timestamp userId memoryType')
      .withNearVector({
        vector: queryEmbedding,
        certainty: 0.7
      })
      .withLimit(maxResults);

    if (userId || memoryTypes) {
      const where = {};
      if (userId) where.path = ['userId'];
      if (userId) where.operator = 'Equal';
      if (userId) where.valueString = userId;
      
      query = query.withWhere(where);
    }

    const response = await query.do();
    const memories = response.data.Get.Memory || [];

    return memories.map(memory => ({
      id: memory.id,
      score: memory._additional?.certainty || 0,
      content: memory.content,
      metadata: {
        timestamp: memory.timestamp,
        userId: memory.userId,
        memoryType: memory.memoryType
      }
    }));
  }

  /**
   * Search in-memory store using cosine similarity
   */
  async searchMemoryStore(queryEmbedding, maxResults, userId, memoryTypes) {
    const results = [];

    for (const [id, vector] of this.memoryStore.entries()) {
      // Apply filters
      if (userId && vector.metadata.userId !== userId) continue;
      if (memoryTypes && !memoryTypes.includes(vector.metadata.memoryType)) continue;

      const similarity = this.cosineSimilarity(queryEmbedding, vector.values);
      results.push({
        id,
        score: similarity,
        content: vector.metadata.content,
        metadata: vector.metadata
      });
    }

    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Delete memory vector
   */
  async deleteMemoryVector(memoryId) {
    try {
      switch (this.provider) {
        case 'pinecone':
          await this.index.deleteOne(memoryId);
          break;
        case 'weaviate':
          await this.client.data.deleter()
            .withClassName('Memory')
            .withId(memoryId)
            .do();
          break;
        default:
          this.memoryStore.delete(memoryId);
      }

      console.log(`🗑️ Vector deleted: ${memoryId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete memory vector:', error.message);
      return false;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      provider: this.provider,
      isAvailable: this.isAvailable,
      memoryStoreSize: this.memoryStore.size,
      embeddingCacheSize: this.embeddingCache.size,
      config: this.config
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      switch (this.provider) {
        case 'pinecone':
          await this.index.describeIndexStats();
          break;
        case 'weaviate':
          await this.client.misc.metaGetter().do();
          break;
        default:
          // Memory store is always healthy
          break;
      }

      return {
        status: 'healthy',
        provider: this.provider,
        isAvailable: this.isAvailable
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.provider,
        error: error.message
      };
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      provider: this.provider,
      isAvailable: this.isAvailable,
      vectorCount: this.vectors ? this.vectors.size : 0,
      embeddingDimensions: this.embeddingDimensions,
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const vectorDatabaseService = new VectorDatabaseService();

module.exports = vectorDatabaseService;
