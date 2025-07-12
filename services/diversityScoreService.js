/**
 * 🎯 Diversity Score Service - Semantic Response Diversity Analysis
 *
 * 🎯 PURPOSE: Calculate semantic diversity between AI model responses using
 *            cosine similarity from embeddings to enhance voting mechanisms
 *
 * 📋 KEY FEATURES:
 * 1. Semantic distance calculation using embeddings
 * 2. Response diversity scoring and analysis
 * 3. Pairwise similarity matrix generation
 * 4. Diversity-based weight adjustments
 * 5. Clustering analysis for response grouping
 * 6. Novelty detection for unique responses
 *
 * 💡 ANALOGY: Like having a linguistics expert analyze how different
 *    each response is from others to reward unique perspectives
 */

const semanticConfidenceService = require('./semanticConfidenceService');
const monitoringService = require('./monitoringService');
const logger = require('../utils/visualLogger');

class DiversityScoreService {
  constructor() {
    this.embeddingCache = new Map();
    this.maxCacheSize = 500;
    this.diversityMetrics = new Map();
    
    // Configuration
    this.diversityThresholds = {
      veryLow: 0.2,    // Very similar responses
      low: 0.4,        // Somewhat similar
      moderate: 0.6,   // Moderately diverse
      high: 0.8,       // Highly diverse
      veryHigh: 1.0    // Maximum diversity
    };
    
    // Diversity weight multipliers
    this.diversityMultipliers = {
      veryLow: 0.8,    // Penalize very similar responses
      low: 0.9,        // Slight penalty for similarity
      moderate: 1.0,   // Neutral
      high: 1.1,       // Reward diversity
      veryHigh: 1.2    // Strong reward for uniqueness
    };

    logger.success(
      'Diversity Score Service: Initialized',
      {
        'Thresholds': Object.keys(this.diversityThresholds).join(', '),
        'Cache Size': this.maxCacheSize,
        'Status': 'Ready for diversity analysis'
      },
      'diversity'
    );
  }

  /**
   * Calculate comprehensive diversity scores for a set of responses
   */
  async calculateDiversityScores(roles) {
    try {
      const successful = roles.filter(r => r.status === 'fulfilled' && r.content);
      if (successful.length < 2) {
        return {
          overallDiversity: 0,
          pairwiseSimilarities: {},
          diversityWeights: {},
          clusterAnalysis: null,
          noveltyScores: {}
        };
      }

      // Generate embeddings for all responses
      const embeddings = await this.generateResponseEmbeddings(successful);
      
      // Calculate pairwise similarities
      const similarityMatrix = this.calculateSimilarityMatrix(embeddings);
      
      // Calculate diversity scores
      const diversityScores = this.calculateIndividualDiversityScores(similarityMatrix, successful);
      
      // Generate diversity weights
      const diversityWeights = this.calculateDiversityWeights(diversityScores);
      
      // Perform cluster analysis
      const clusterAnalysis = this.performClusterAnalysis(similarityMatrix, successful);
      
      // Calculate novelty scores
      const noveltyScores = await this.calculateNoveltyScores(successful, embeddings);
      
      // Calculate overall diversity
      const overallDiversity = this.calculateOverallDiversity(similarityMatrix);

      const result = {
        overallDiversity,
        pairwiseSimilarities: this.formatSimilarityMatrix(similarityMatrix, successful),
        diversityWeights,
        clusterAnalysis,
        noveltyScores,
        diversityDistribution: this.analyzeDiversityDistribution(diversityScores),
        semanticSpread: this.calculateSemanticSpread(embeddings)
      };

      // Log diversity analysis
      monitoringService.log('info', 'Diversity analysis completed', {
        responses: successful.length,
        overallDiversity: overallDiversity.toFixed(3),
        clusters: clusterAnalysis?.clusters?.length || 0,
        highDiversityResponses: Object.values(diversityScores).filter(s => s > 0.7).length
      });

      return result;
    } catch (error) {
      monitoringService.log('error', 'Failed to calculate diversity scores', {
        error: error.message,
        responses: roles.length
      });
      
      // Return default diversity scores on error
      return this.getDefaultDiversityScores(roles);
    }
  }

  /**
   * Generate embeddings for all responses
   */
  async generateResponseEmbeddings(responses) {
    const embeddings = [];
    
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const cacheKey = `diversity_${response.role}_${this.hashContent(response.content)}`;
      
      try {
        let embedding;
        if (this.embeddingCache.has(cacheKey)) {
          embedding = this.embeddingCache.get(cacheKey);
        } else {
          embedding = await semanticConfidenceService.generateEmbedding(
            response.content,
            cacheKey
          );
          
          // Cache the embedding
          this.manageCacheSize();
          this.embeddingCache.set(cacheKey, embedding);
        }
        
        embeddings.push({
          role: response.role,
          model: response.metadata?.model || response.model || 'unknown',
          embedding,
          content: response.content
        });
      } catch (error) {
        console.warn(`⚠️ Failed to generate embedding for ${response.role}:`, error.message);
        // Use zero vector as fallback
        embeddings.push({
          role: response.role,
          model: response.metadata?.model || response.model || 'unknown',
          embedding: new Array(1536).fill(0), // text-embedding-3-small dimension
          content: response.content
        });
      }
    }
    
    return embeddings;
  }

  /**
   * Calculate similarity matrix between all response pairs
   */
  calculateSimilarityMatrix(embeddings) {
    const matrix = [];
    
    for (let i = 0; i < embeddings.length; i++) {
      const row = [];
      for (let j = 0; j < embeddings.length; j++) {
        if (i === j) {
          row.push(1.0); // Self-similarity
        } else {
          const similarity = this.cosineSimilarity(
            embeddings[i].embedding,
            embeddings[j].embedding
          );
          row.push(similarity);
        }
      }
      matrix.push(row);
    }
    
    return matrix;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate individual diversity scores for each response
   */
  calculateIndividualDiversityScores(similarityMatrix, responses) {
    const diversityScores = {};
    
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      
      // Calculate average dissimilarity with all other responses
      let totalDissimilarity = 0;
      let comparisons = 0;
      
      for (let j = 0; j < similarityMatrix[i].length; j++) {
        if (i !== j) {
          const dissimilarity = 1 - similarityMatrix[i][j];
          totalDissimilarity += dissimilarity;
          comparisons++;
        }
      }
      
      const averageDiversity = comparisons > 0 ? totalDissimilarity / comparisons : 0;
      diversityScores[response.role] = Math.max(0, Math.min(1, averageDiversity));
    }
    
    return diversityScores;
  }

  /**
   * Calculate diversity-based weight adjustments
   */
  calculateDiversityWeights(diversityScores) {
    const weights = {};
    
    for (const [role, score] of Object.entries(diversityScores)) {
      const diversityLevel = this.getDiversityLevel(score);
      const multiplier = this.diversityMultipliers[diversityLevel];
      weights[role] = multiplier;
    }
    
    return weights;
  }

  /**
   * Determine diversity level based on score
   */
  getDiversityLevel(score) {
    if (score >= this.diversityThresholds.veryHigh) return 'veryHigh';
    if (score >= this.diversityThresholds.high) return 'high';
    if (score >= this.diversityThresholds.moderate) return 'moderate';
    if (score >= this.diversityThresholds.low) return 'low';
    return 'veryLow';
  }

  /**
   * Perform cluster analysis on responses
   */
  performClusterAnalysis(similarityMatrix, responses) {
    try {
      // Simple clustering based on similarity threshold
      const clusters = [];
      const assigned = new Set();
      const clusterThreshold = 0.7; // High similarity threshold for clustering
      
      for (let i = 0; i < responses.length; i++) {
        if (assigned.has(i)) continue;
        
        const cluster = {
          id: clusters.length,
          responses: [responses[i].role],
          averageSimilarity: 0,
          size: 1
        };
        
        assigned.add(i);
        let totalSimilarity = 0;
        let comparisons = 0;
        
        // Find similar responses to add to cluster
        for (let j = i + 1; j < responses.length; j++) {
          if (assigned.has(j)) continue;
          
          if (similarityMatrix[i][j] >= clusterThreshold) {
            cluster.responses.push(responses[j].role);
            cluster.size++;
            assigned.add(j);
          }
          
          totalSimilarity += similarityMatrix[i][j];
          comparisons++;
        }
        
        cluster.averageSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
        clusters.push(cluster);
      }
      
      return {
        clusters,
        totalClusters: clusters.length,
        largestCluster: Math.max(...clusters.map(c => c.size)),
        averageClusterSize: clusters.reduce((sum, c) => sum + c.size, 0) / clusters.length
      };
    } catch (error) {
      console.warn('⚠️ Cluster analysis failed:', error.message);
      return null;
    }
  }

  /**
   * Calculate novelty scores based on historical responses
   */
  async calculateNoveltyScores(responses, embeddings) {
    const noveltyScores = {};
    
    // For now, use diversity as a proxy for novelty
    // In the future, this could compare against historical response embeddings
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      
      // Calculate novelty as inverse of maximum similarity with others
      let maxSimilarity = 0;
      for (let j = 0; j < embeddings.length; j++) {
        if (i !== j) {
          const similarity = this.cosineSimilarity(
            embeddings[i].embedding,
            embeddings[j].embedding
          );
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }
      
      const novelty = 1 - maxSimilarity;
      noveltyScores[response.role] = Math.max(0, Math.min(1, novelty));
    }
    
    return noveltyScores;
  }

  /**
   * Calculate overall diversity of the response set
   */
  calculateOverallDiversity(similarityMatrix) {
    let totalDissimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < similarityMatrix.length; i++) {
      for (let j = i + 1; j < similarityMatrix[i].length; j++) {
        const dissimilarity = 1 - similarityMatrix[i][j];
        totalDissimilarity += dissimilarity;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalDissimilarity / comparisons : 0;
  }

  /**
   * Format similarity matrix for output
   */
  formatSimilarityMatrix(matrix, responses) {
    const formatted = {};
    
    for (let i = 0; i < responses.length; i++) {
      const roleA = responses[i].role;
      formatted[roleA] = {};
      
      for (let j = 0; j < responses.length; j++) {
        const roleB = responses[j].role;
        formatted[roleA][roleB] = parseFloat(matrix[i][j].toFixed(3));
      }
    }
    
    return formatted;
  }

  /**
   * Analyze diversity distribution
   */
  analyzeDiversityDistribution(diversityScores) {
    const scores = Object.values(diversityScores);
    if (scores.length === 0) return null;
    
    const sorted = scores.sort((a, b) => a - b);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: scores.reduce((sum, s) => sum + s, 0) / scores.length,
      median: sorted[Math.floor(sorted.length / 2)],
      standardDeviation: this.calculateStandardDeviation(scores)
    };
  }

  /**
   * Calculate semantic spread of embeddings
   */
  calculateSemanticSpread(embeddings) {
    if (embeddings.length < 2) return 0;
    
    // Calculate centroid
    const dimensions = embeddings[0].embedding.length;
    const centroid = new Array(dimensions).fill(0);
    
    for (const emb of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        centroid[i] += emb.embedding[i];
      }
    }
    
    for (let i = 0; i < dimensions; i++) {
      centroid[i] /= embeddings.length;
    }
    
    // Calculate average distance from centroid
    let totalDistance = 0;
    for (const emb of embeddings) {
      const distance = 1 - this.cosineSimilarity(emb.embedding, centroid);
      totalDistance += distance;
    }
    
    return totalDistance / embeddings.length;
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Hash content for caching
   */
  hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Manage embedding cache size
   */
  manageCacheSize() {
    if (this.embeddingCache.size >= this.maxCacheSize) {
      const keysToDelete = Array.from(this.embeddingCache.keys()).slice(0, 50);
      keysToDelete.forEach(key => this.embeddingCache.delete(key));
    }
  }

  /**
   * Get default diversity scores on error
   */
  getDefaultDiversityScores(roles) {
    const successful = roles.filter(r => r.status === 'fulfilled');
    const diversityWeights = {};
    
    successful.forEach(role => {
      diversityWeights[role.role] = 1.0; // Neutral weight
    });
    
    return {
      overallDiversity: 0.5,
      pairwiseSimilarities: {},
      diversityWeights,
      clusterAnalysis: null,
      noveltyScores: {},
      diversityDistribution: null,
      semanticSpread: 0
    };
  }
}

module.exports = DiversityScoreService;
