/**
 * 🧠 Semantic Confidence Service - Advanced AI Response Quality Analytics
 *
 * 🎯 PURPOSE: Provide sophisticated confidence scoring using embeddings, grammar analysis, and calibration
 *
 * 📋 KEY FEATURES:
 * 1. Embedding-based semantic similarity scoring
 * 2. Grammar and structure quality assessment
 * 3. Response latency factor analysis
 * 4. Reference answer comparison system
 * 5. Brier-calibrated probability tracking
 *
 * 💡 ANALOGY: Like having a panel of expert linguists and data scientists
 *    evaluate the quality and reliability of AI responses using multiple
 *    sophisticated metrics beyond simple word counting
 */

const { OpenAI } = require('openai');
const compromise = require('compromise');
const stats = require('simple-statistics');
const SimpleLinearRegression = require('ml-regression-simple-linear');
const monitoringService = require('./monitoringService');

class SemanticConfidenceService {
  constructor() {
    this.openaiClient = null;
    this.referenceAnswers = new Map(); // In-memory storage for reference answers
    this.calibrationData = new Map(); // Model calibration history
    this.embeddingCache = new Map(); // Cache for embeddings
    this.maxCacheSize = 1000;
    this.maxCalibrationHistory = 500;
    
    this.initializeOpenAI();
    this.initializeReferenceAnswers();
  }

  /**
   * Initialize OpenAI client for embeddings
   */
  initializeOpenAI() {
    try {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 30000,
        maxRetries: 2
      });
      console.log('✅ Semantic Confidence Service: OpenAI client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI client for embeddings:', error.message);
    }
  }

  /**
   * Initialize reference answers for different task types
   */
  initializeReferenceAnswers() {
    // High-quality reference answers for different categories
    const referenceAnswers = [
      {
        category: 'general',
        content: 'Based on current research and best practices, I recommend a comprehensive approach that considers multiple factors. This solution addresses the core requirements while maintaining flexibility for future adaptations. The implementation should follow established patterns and include proper error handling.',
        quality: 0.95
      },
      {
        category: 'technical',
        content: 'The optimal solution involves implementing a modular architecture with clear separation of concerns. This approach ensures scalability, maintainability, and testability. Key considerations include performance optimization, security measures, and comprehensive documentation.',
        quality: 0.92
      },
      {
        category: 'analytical',
        content: 'After analyzing the available data and considering various factors, the evidence suggests a multi-faceted approach. The analysis reveals several key insights that inform the recommended strategy. This conclusion is supported by quantitative metrics and qualitative assessments.',
        quality: 0.90
      },
      {
        category: 'creative',
        content: 'This creative solution combines innovative thinking with practical implementation. The approach balances originality with feasibility, ensuring both uniqueness and effectiveness. The concept addresses the core challenge while opening possibilities for future enhancements.',
        quality: 0.88
      },
      {
        category: 'explanatory',
        content: 'To understand this concept, it helps to break it down into fundamental components. Each element plays a specific role in the overall system. The relationship between these components creates the desired outcome through well-defined interactions and processes.',
        quality: 0.91
      }
    ];

    // Store reference answers with embeddings
    referenceAnswers.forEach(ref => {
      this.referenceAnswers.set(ref.category, {
        content: ref.content,
        quality: ref.quality,
        embedding: null // Will be populated when first used
      });
    });

    console.log(`✅ Initialized ${referenceAnswers.length} reference answers for semantic comparison`);
  }

  /**
   * Generate embedding for text using OpenAI's text-embedding-3-small
   */
  async generateEmbedding(text, cacheKey = null) {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    // Check cache first
    if (cacheKey && this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    try {
      const response = await this.openaiClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit input length
        encoding_format: 'float'
      });

      const embedding = response.data[0].embedding;

      // Cache the embedding
      if (cacheKey) {
        this.manageCacheSize();
        this.embeddingCache.set(cacheKey, embedding);
      }

      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error.message);
      throw error;
    }
  }

  /**
   * Manage embedding cache size
   */
  manageCacheSize() {
    if (this.embeddingCache.size >= this.maxCacheSize) {
      // Remove oldest entries (simple FIFO)
      const keysToDelete = Array.from(this.embeddingCache.keys()).slice(0, 100);
      keysToDelete.forEach(key => this.embeddingCache.delete(key));
    }
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
   * Analyze grammar and structure quality using compromise NLP
   */
  analyzeGrammarQuality(text) {
    try {
      const doc = compromise(text);

      // Basic grammar and structure metrics
      const sentences = doc.sentences().out('array');
      const words = doc.terms().out('array'); // Use terms() instead of words()
      const nouns = doc.nouns().out('array');
      const verbs = doc.verbs().out('array');
      const adjectives = doc.adjectives().out('array');
      
      // Calculate grammar quality score
      let grammarScore = 0.5; // Base score
      
      // Sentence structure quality
      if (sentences.length > 0) {
        const avgWordsPerSentence = words.length / sentences.length;
        if (avgWordsPerSentence >= 8 && avgWordsPerSentence <= 25) {
          grammarScore += 0.2; // Good sentence length
        }
      }
      
      // Part-of-speech diversity
      const posRatio = (nouns.length + verbs.length + adjectives.length) / Math.max(words.length, 1);
      if (posRatio >= 0.4) {
        grammarScore += 0.15; // Good POS diversity
      }
      
      // Proper capitalization and punctuation
      if (/^[A-Z]/.test(text) && /[.!?]$/.test(text.trim())) {
        grammarScore += 0.1;
      }
      
      // Complex sentence structures
      if (text.includes(',') || text.includes(';') || text.includes(':')) {
        grammarScore += 0.1;
      }
      
      // Avoid repetitive patterns
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      const lexicalDiversity = uniqueWords.size / Math.max(words.length, 1);
      if (lexicalDiversity >= 0.6) {
        grammarScore += 0.05;
      }
      
      return Math.min(1.0, Math.max(0.0, grammarScore));
    } catch (error) {
      console.warn('Grammar analysis failed:', error.message);
      return 0.5; // Default score on error
    }
  }

  /**
   * Calculate latency factor based on response time
   */
  calculateLatencyFactor(latencyMs) {
    if (latencyMs <= 0) return 0.5; // Default for unknown latency
    
    // Logarithmic scaling as specified in requirements
    const logLatency = Math.log2(latencyMs);
    const factor = Math.max(0, 1 - (logLatency - 8) / 6);
    
    return Math.min(1.0, Math.max(0.0, factor));
  }

  /**
   * Determine content category for reference comparison
   */
  determineContentCategory(text) {
    const lowerText = text.toLowerCase();
    
    // Technical indicators
    if (/\b(implement|architecture|system|code|api|database|algorithm)\b/.test(lowerText)) {
      return 'technical';
    }
    
    // Analytical indicators
    if (/\b(analysis|data|research|study|evidence|statistics|metrics)\b/.test(lowerText)) {
      return 'analytical';
    }
    
    // Creative indicators
    if (/\b(creative|innovative|design|concept|idea|solution|approach)\b/.test(lowerText)) {
      return 'creative';
    }
    
    // Explanatory indicators
    if (/\b(explain|understand|concept|process|how|why|what|definition)\b/.test(lowerText)) {
      return 'explanatory';
    }
    
    return 'general'; // Default category
  }

  /**
   * Calculate semantic confidence score using embeddings
   */
  async calculateSemanticConfidence(content, responseTime = 0) {
    try {
      // Generate embedding for the response
      const responseEmbedding = await this.generateEmbedding(content, `response_${Date.now()}`);

      // Determine content category
      const category = this.determineContentCategory(content);

      // Get reference answer for this category
      const reference = this.referenceAnswers.get(category);
      if (!reference.embedding) {
        reference.embedding = await this.generateEmbedding(reference.content, `ref_${category}`);
      }

      // Calculate reference similarity (40% weight)
      const referenceSimilarity = this.cosineSimilarity(responseEmbedding, reference.embedding);
      const referenceScore = referenceSimilarity * 0.4;

      // Calculate grammar score (30% weight)
      const grammarScore = this.analyzeGrammarQuality(content) * 0.3;

      // Calculate latency factor (30% weight)
      const latencyScore = this.calculateLatencyFactor(responseTime) * 0.3;

      // Final semantic confidence score
      const semanticConfidence = referenceScore + grammarScore + latencyScore;

      return {
        score: Math.min(1.0, Math.max(0.0, semanticConfidence)),
        components: {
          referenceSimilarity: referenceSimilarity,
          referenceScore: referenceScore,
          grammarScore: grammarScore,
          latencyScore: latencyScore,
          category: category
        }
      };
    } catch (error) {
      console.error('Semantic confidence calculation failed:', error.message);
      return {
        score: 0.5,
        components: {
          referenceSimilarity: 0,
          referenceScore: 0,
          grammarScore: 0.5,
          latencyScore: 0.5,
          category: 'general',
          error: error.message
        }
      };
    }
  }

  /**
   * Calculate embedding-based uniqueness between responses
   */
  async calculateEmbeddingUniqueness(content, allResponses) {
    if (allResponses.length <= 1) return 1.0;

    try {
      // Generate embedding for current response
      const currentEmbedding = await this.generateEmbedding(content, `unique_${Date.now()}`);

      let totalDistance = 0;
      let comparisons = 0;

      // Calculate pairwise cosine distances
      for (const otherResponse of allResponses) {
        if (otherResponse.content !== content) {
          const otherEmbedding = await this.generateEmbedding(
            otherResponse.content,
            `unique_other_${Date.now()}_${comparisons}`
          );

          const similarity = this.cosineSimilarity(currentEmbedding, otherEmbedding);
          const distance = 1 - similarity; // Convert similarity to distance

          totalDistance += distance;
          comparisons++;
        }
      }

      // Return average pairwise distance (higher = more unique)
      return comparisons > 0 ? totalDistance / comparisons : 1.0;
    } catch (error) {
      console.error('Embedding uniqueness calculation failed:', error.message);
      return 0.5; // Default uniqueness on error
    }
  }

  /**
   * Store calibration data for a model
   */
  storeCalibrationData(modelName, predictedProb, actualOutcome) {
    if (!this.calibrationData.has(modelName)) {
      this.calibrationData.set(modelName, []);
    }

    const modelData = this.calibrationData.get(modelName);
    modelData.push({
      predicted: predictedProb,
      actual: actualOutcome,
      timestamp: Date.now()
    });

    // Keep only recent data
    if (modelData.length > this.maxCalibrationHistory) {
      modelData.splice(0, modelData.length - this.maxCalibrationHistory);
    }
  }

  /**
   * Calculate Brier-calibrated probability for a model
   */
  calculateCalibratedProbability(modelName, rawProbability) {
    const modelData = this.calibrationData.get(modelName);

    if (!modelData || modelData.length < 10) {
      // Not enough data for calibration, return raw probability
      return rawProbability;
    }

    try {
      // Prepare data for isotonic regression
      const xValues = modelData.map(d => d.predicted);
      const yValues = modelData.map(d => d.actual);

      // Simple linear regression as approximation for isotonic regression
      const regression = new SimpleLinearRegression(xValues, yValues);

      // Apply calibration
      const calibratedProb = regression.predict(rawProbability);

      // Ensure result is within [0, 1]
      return Math.min(1.0, Math.max(0.0, calibratedProb));
    } catch (error) {
      console.warn(`Calibration failed for model ${modelName}:`, error.message);
      return rawProbability;
    }
  }

  /**
   * Calculate toxicity score (simplified implementation)
   */
  calculateToxicityScore(content) {
    const toxicPatterns = [
      /\b(hate|stupid|idiot|dumb|worthless)\b/gi,
      /\b(kill|die|death|murder)\b/gi,
      /\b(racist|sexist|bigot)\b/gi
    ];

    let toxicityCount = 0;
    const wordCount = content.split(/\s+/).length;

    toxicPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        toxicityCount += matches.length;
      }
    });

    // Simple toxicity score: toxic words / total words
    return Math.min(1.0, toxicityCount / Math.max(wordCount, 1));
  }

  /**
   * Calculate readability metrics
   */
  calculateReadability(content) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const syllables = this.countSyllables(content);

    if (sentences.length === 0 || words.length === 0) {
      return { gradeLevel: 0, complexity: 'unknown' };
    }

    // Simplified Flesch-Kincaid Grade Level
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    const gradeLevel = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

    let complexity = 'simple';
    if (gradeLevel > 16) complexity = 'graduate';
    else if (gradeLevel > 13) complexity = 'college';
    else if (gradeLevel > 9) complexity = 'high-school';
    else if (gradeLevel > 6) complexity = 'middle-school';

    return {
      gradeLevel: Math.max(0, gradeLevel),
      complexity,
      avgSentenceLength,
      avgSyllablesPerWord
    };
  }

  /**
   * Count syllables in text (simplified)
   */
  countSyllables(text) {
    const words = text.toLowerCase().split(/\s+/);
    let totalSyllables = 0;

    words.forEach(word => {
      // Remove punctuation
      word = word.replace(/[^a-z]/g, '');
      if (word.length === 0) return;

      // Count vowel groups
      const vowelGroups = word.match(/[aeiouy]+/g);
      let syllables = vowelGroups ? vowelGroups.length : 1;

      // Adjust for silent e
      if (word.endsWith('e') && syllables > 1) {
        syllables--;
      }

      totalSyllables += Math.max(1, syllables);
    });

    return totalSyllables;
  }

  /**
   * Generate embedding similarity matrix for multiple responses
   */
  async generateEmbeddingSimilarityMatrix(responses) {
    const embeddings = [];

    // Generate embeddings for all responses
    for (let i = 0; i < responses.length; i++) {
      const embedding = await this.generateEmbedding(
        responses[i].content,
        `matrix_${i}_${Date.now()}`
      );
      embeddings.push(embedding);
    }

    // Calculate similarity matrix
    const matrix = [];
    for (let i = 0; i < embeddings.length; i++) {
      const row = [];
      for (let j = 0; j < embeddings.length; j++) {
        if (i === j) {
          row.push(1.0); // Self-similarity
        } else {
          const similarity = this.cosineSimilarity(embeddings[i], embeddings[j]);
          row.push(Math.round(similarity * 1000) / 1000); // Round to 3 decimal places
        }
      }
      matrix.push(row);
    }

    return matrix;
  }

  /**
   * Add a new high-quality reference answer
   */
  addReferenceAnswer(category, content, quality = 0.9) {
    if (!this.referenceAnswers.has(category)) {
      this.referenceAnswers.set(category, {
        content: content,
        quality: quality,
        embedding: null,
        dateAdded: new Date().toISOString()
      });

      console.log(`✅ Added new reference answer for category: ${category}`);
      return true;
    } else {
      console.warn(`⚠️ Reference answer for category ${category} already exists`);
      return false;
    }
  }

  /**
   * Update existing reference answer
   */
  updateReferenceAnswer(category, content, quality = 0.9) {
    if (this.referenceAnswers.has(category)) {
      this.referenceAnswers.set(category, {
        content: content,
        quality: quality,
        embedding: null, // Will be regenerated on next use
        dateUpdated: new Date().toISOString()
      });

      console.log(`✅ Updated reference answer for category: ${category}`);
      return true;
    } else {
      console.warn(`⚠️ Reference answer for category ${category} does not exist`);
      return false;
    }
  }

  /**
   * Get all reference answers
   */
  getAllReferenceAnswers() {
    const answers = {};
    for (const [category, data] of this.referenceAnswers.entries()) {
      answers[category] = {
        content: data.content,
        quality: data.quality,
        dateAdded: data.dateAdded,
        dateUpdated: data.dateUpdated,
        hasEmbedding: !!data.embedding
      };
    }
    return answers;
  }

  /**
   * Remove reference answer
   */
  removeReferenceAnswer(category) {
    if (this.referenceAnswers.has(category)) {
      this.referenceAnswers.delete(category);
      console.log(`✅ Removed reference answer for category: ${category}`);
      return true;
    } else {
      console.warn(`⚠️ Reference answer for category ${category} does not exist`);
      return false;
    }
  }

  /**
   * Preload all reference answer embeddings
   */
  async preloadReferenceEmbeddings() {
    console.log('🔄 Preloading reference answer embeddings...');

    let loadedCount = 0;
    for (const [category, reference] of this.referenceAnswers.entries()) {
      if (!reference.embedding) {
        try {
          reference.embedding = await this.generateEmbedding(reference.content, `ref_${category}`);
          loadedCount++;
        } catch (error) {
          console.error(`Failed to preload embedding for ${category}:`, error.message);
        }
      }
    }

    console.log(`✅ Preloaded ${loadedCount} reference answer embeddings`);
    return loadedCount;
  }

  /**
   * Export reference answers for backup
   */
  exportReferenceAnswers() {
    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      referenceAnswers: this.getAllReferenceAnswers()
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import reference answers from backup
   */
  importReferenceAnswers(jsonData) {
    try {
      const importData = JSON.parse(jsonData);

      if (!importData.referenceAnswers) {
        throw new Error('Invalid import data format');
      }

      let importedCount = 0;
      for (const [category, data] of Object.entries(importData.referenceAnswers)) {
        this.referenceAnswers.set(category, {
          content: data.content,
          quality: data.quality,
          embedding: null, // Will be regenerated
          dateAdded: data.dateAdded,
          dateUpdated: data.dateUpdated
        });
        importedCount++;
      }

      console.log(`✅ Imported ${importedCount} reference answers`);
      return importedCount;
    } catch (error) {
      console.error('Failed to import reference answers:', error.message);
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      embeddingCacheSize: this.embeddingCache.size,
      referenceAnswersCount: this.referenceAnswers.size,
      calibrationModels: Array.from(this.calibrationData.keys()),
      totalCalibrationData: Array.from(this.calibrationData.values())
        .reduce((sum, data) => sum + data.length, 0),
      referenceCategories: Array.from(this.referenceAnswers.keys()),
      preloadedEmbeddings: Array.from(this.referenceAnswers.values())
        .filter(ref => ref.embedding).length
    };
  }

  /**
   * Health check for the service
   */
  async healthCheck() {
    try {
      // Test embedding generation
      const testEmbedding = await this.generateEmbedding('test', 'health_check');

      return {
        status: 'healthy',
        openaiClient: !!this.openaiClient,
        embeddingTest: testEmbedding.length === 1536, // text-embedding-3-small dimension
        referenceAnswers: this.referenceAnswers.size,
        cacheSize: this.embeddingCache.size
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        openaiClient: !!this.openaiClient,
        referenceAnswers: this.referenceAnswers.size,
        cacheSize: this.embeddingCache.size
      };
    }
  }
}

module.exports = new SemanticConfidenceService();
