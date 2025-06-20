/**
 * Enhanced Memory Weighting System for AI Ensemble
 * Calculates sophisticated weights for memory prioritization
 */

const { WEIGHT_COEFFICIENTS } = require('../types/memory');

class EnhancedMemoryWeights {
  /**
   * Calculate advanced weights for a memory item
   * @param {import('../types/memory').ContentAnalysis} analysis 
   * @param {import('../types/memory').MemoryType} memoryType 
   * @param {import('../types/memory').AccessHistory} accessHistory 
   * @param {import('../types/memory').UserContext} userContext 
   * @returns {import('../types/memory').MemoryWeights}
   */
  calculateAdvancedWeights(analysis, memoryType, accessHistory, userContext) {
    const recency = this.calculateRecencyWeight(analysis.timestamp, memoryType);
    const importance = this.calculateImportanceWeight(analysis, userContext);
    const frequency = this.calculateFrequencyWeight(accessHistory);
    const emotional = this.calculateEmotionalWeight(analysis.sentiment, analysis.userIntent);
    const contextual = this.calculateContextualWeight(analysis, userContext);
    
    const composite = this.calculateCompositeScore({
      recency,
      importance,
      frequency,
      emotional,
      contextual
    }, memoryType, userContext);
    
    return { recency, importance, frequency, emotional, contextual, composite };
  }

  /**
   * Calculate recency weight based on timestamp and memory type
   * @param {Date} timestamp 
   * @param {import('../types/memory').MemoryType} memoryType 
   * @returns {number}
   */
  calculateRecencyWeight(timestamp, memoryType) {
    const now = Date.now();
    const age = now - timestamp.getTime();
    
    const decayRates = {
      working: 0.1,
      short_term: 0.05,
      long_term: 0.01,
      semantic: 0.005,
      episodic: 0.02
    };
    
    const decayRate = decayRates[memoryType];
    const hoursAge = age / (1000 * 60 * 60);
    return Math.exp(-decayRate * hoursAge);
  }

  /**
   * Calculate importance weight based on content analysis and user context
   * @param {import('../types/memory').ContentAnalysis} analysis 
   * @param {import('../types/memory').UserContext} userContext 
   * @returns {number}
   */
  calculateImportanceWeight(analysis, userContext) {
    let importance = analysis.baseImportance;
    
    // Boost for user's expert domains
    if (userContext.expertDomains.some(domain => 
      analysis.concepts.some(concept => concept.toLowerCase().includes(domain.toLowerCase())))) {
      importance *= 1.3;
    }
    
    // Boost for questions
    if (analysis.isQuestion) importance *= 1.2;
    
    // Boost for complex content
    if (analysis.complexity > 0.7) importance *= 1.1;
    
    // Boost for unique concepts
    const uniqueConcepts = analysis.concepts.filter(concept => 
      !userContext.commonConcepts.includes(concept));
    importance += uniqueConcepts.length * 0.05;
    
    return Math.min(importance, 1.0);
  }

  /**
   * Calculate frequency weight based on access history
   * @param {import('../types/memory').AccessHistory} accessHistory 
   * @returns {number}
   */
  calculateFrequencyWeight(accessHistory) {
    const totalAccesses = accessHistory.accessCount;
    const recentAccesses = accessHistory.recentAccessCount;
    const timeSpan = accessHistory.timeSpanDays;
    
    const baseFrequency = Math.log(totalAccesses + 1) / 10;
    const recentBoost = recentAccesses / Math.max(timeSpan, 1);
    
    return Math.min(baseFrequency + recentBoost, 1.0);
  }

  /**
   * Calculate emotional weight based on sentiment and user intent
   * @param {number} sentiment 
   * @param {string} userIntent 
   * @returns {number}
   */
  calculateEmotionalWeight(sentiment, userIntent) {
    const sentimentMagnitude = Math.abs(sentiment);
    
    const intentModifiers = {
      creative: 1.3,
      personal: 1.4,
      problem_solving: 1.2,
      learning: 1.1,
      conversation: 1.0,
      task: 0.9,
      analysis: 0.8,
      question: 1.0
    };
    
    const modifier = intentModifiers[userIntent] || 1.0;
    return Math.min(sentimentMagnitude * modifier, 1.0);
  }

  /**
   * Calculate contextual weight based on analysis and user context
   * @param {import('../types/memory').ContentAnalysis} analysis 
   * @param {import('../types/memory').UserContext} userContext 
   * @returns {number}
   */
  calculateContextualWeight(analysis, userContext) {
    let contextual = 0.5;
    
    // Boost for expert domain relevance
    if (userContext.expertDomains.some(domain => 
      analysis.concepts.includes(domain))) {
      contextual += 0.3;
    }
    
    // Boost for questions
    if (analysis.userIntent === 'question' || analysis.isQuestion) {
      contextual += 0.2;
    }
    
    return Math.min(contextual, 1.0);
  }

  /**
   * Calculate composite score using weighted coefficients
   * @param {Partial<import('../types/memory').MemoryWeights>} weights 
   * @param {import('../types/memory').MemoryType} memoryType 
   * @param {import('../types/memory').UserContext} userContext 
   * @returns {number}
   */
  calculateCompositeScore(weights, memoryType, userContext) {
    const coefficients = this.getDynamicCoefficients(memoryType, userContext);
    
    return (
      (weights.recency || 0) * coefficients.recency +
      (weights.importance || 0) * coefficients.importance +
      (weights.frequency || 0) * coefficients.frequency +
      (weights.emotional || 0) * coefficients.emotional +
      (weights.contextual || 0) * coefficients.contextual
    );
  }

  /**
   * Get dynamic coefficients based on memory type and user context
   * @param {import('../types/memory').MemoryType} memoryType 
   * @param {import('../types/memory').UserContext} userContext 
   * @returns {Object}
   */
  getDynamicCoefficients(memoryType, userContext) {
    const baseCoefficients = { ...WEIGHT_COEFFICIENTS[memoryType] };
    
    // Adjust for user preferences
    if (userContext.preferences?.includes('emotional')) {
      baseCoefficients.emotional *= 1.2;
    }
    
    if (userContext.preferences?.includes('analytical')) {
      baseCoefficients.importance *= 1.1;
      baseCoefficients.contextual *= 1.1;
    }
    
    return baseCoefficients;
  }
}

module.exports = EnhancedMemoryWeights;
