/**
 * Advanced Ensemble Strategy Service
 * Implements weighted voting, confidence scoring, and intelligent response synthesis
 */

class AdvancedEnsembleStrategy {
  constructor() {
    this.modelWeights = new Map();
    this.performanceHistory = new Map();
    this.confidenceThresholds = {
      high: 0.8,
      medium: 0.6,
      low: 0.4
    };
    
    // Initialize default model weights based on tier and known performance
    this.initializeDefaultWeights();
  }

  /**
   * Initialize default model weights based on empirical performance
   */
  initializeDefaultWeights() {
    // Free tier models
    this.modelWeights.set('gpt-4o-mini', {
      accuracy: 0.85,
      speed: 0.9,
      costEfficiency: 0.95,
      reliability: 0.88,
      overall: 0.89
    });
    
    this.modelWeights.set('gemini-1.5-flash', {
      accuracy: 0.82,
      speed: 0.95,
      costEfficiency: 0.92,
      reliability: 0.85,
      overall: 0.86
    });
    
    this.modelWeights.set('claude-3-haiku-20240307', {
      accuracy: 0.88,
      speed: 0.85,
      costEfficiency: 0.90,
      reliability: 0.90,
      overall: 0.88
    });

    // Premium tier models
    this.modelWeights.set('gpt-4o', {
      accuracy: 0.95,
      speed: 0.75,
      costEfficiency: 0.70,
      reliability: 0.92,
      overall: 0.83
    });
    
    this.modelWeights.set('gemini-2.0-flash', {
      accuracy: 0.92,
      speed: 0.88,
      costEfficiency: 0.85,
      reliability: 0.89,
      overall: 0.89
    });
    
    this.modelWeights.set('claude-opus-4-20250514', {
      accuracy: 0.98,
      speed: 0.65,
      costEfficiency: 0.60,
      reliability: 0.95,
      overall: 0.80
    });

    // Synthesizer models
    this.modelWeights.set('o1-preview', {
      accuracy: 0.96,
      speed: 0.60,
      costEfficiency: 0.50,
      reliability: 0.94,
      overall: 0.75
    });
  }

  /**
   * Calculate confidence score for a model response
   */
  calculateConfidenceScore(response, model, responseTime, context = {}) {
    let confidence = 0.5; // Base confidence

    // Response length analysis
    const responseLength = response.length;
    if (responseLength > 50 && responseLength < 2000) {
      confidence += 0.1;
    } else if (responseLength < 20) {
      confidence -= 0.2;
    } else if (responseLength > 3000) {
      confidence -= 0.1;
    }

    // Response time analysis
    const modelWeights = this.modelWeights.get(model) || { speed: 0.5 };
    const expectedTime = this.getExpectedResponseTime(model);
    const timeRatio = responseTime / expectedTime;
    
    if (timeRatio < 1.2) { // Within 20% of expected time
      confidence += 0.1;
    } else if (timeRatio > 2.0) { // More than 2x expected time
      confidence -= 0.1;
    }

    // Content quality indicators
    if (this.hasStructuredContent(response)) {
      confidence += 0.1;
    }
    
    if (this.hasSpecificDetails(response)) {
      confidence += 0.1;
    }
    
    if (this.hasErrorIndicators(response)) {
      confidence -= 0.3;
    }

    // Model reliability factor
    confidence += (modelWeights.reliability - 0.5) * 0.2;

    // Context relevance (if available)
    if (context.userPrompt && this.isRelevantToPrompt(response, context.userPrompt)) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get expected response time for a model
   */
  getExpectedResponseTime(model) {
    const baseTimes = {
      'gpt-4o-mini': 2000,
      'gpt-4o': 4000,
      'o1-preview': 8000,
      'gemini-1.5-flash': 1500,
      'gemini-2.0-flash': 2500,
      'claude-3-haiku-20240307': 2000,
      'claude-opus-4-20250514': 6000
    };
    
    return baseTimes[model] || 3000;
  }

  /**
   * Check if response has structured content
   */
  hasStructuredContent(response) {
    const structureIndicators = [
      /\d+\./,  // Numbered lists
      /[-*]\s/,  // Bullet points
      /#{1,6}\s/, // Headers
      /```/,     // Code blocks
      /\n\s*\n/  // Paragraph breaks
    ];
    
    return structureIndicators.some(pattern => pattern.test(response));
  }

  /**
   * Check if response has specific details
   */
  hasSpecificDetails(response) {
    const detailIndicators = [
      /\d+%/,           // Percentages
      /\$\d+/,          // Dollar amounts
      /\d+\s*(ms|seconds|minutes|hours|days)/, // Time units
      /\d+\s*(MB|GB|KB)/, // Data units
      /https?:\/\//,    // URLs
      /\b\d{4}\b/       // Years
    ];
    
    return detailIndicators.some(pattern => pattern.test(response));
  }

  /**
   * Check if response has error indicators
   */
  hasErrorIndicators(response) {
    const errorIndicators = [
      /\*\*Error\*\*/i,
      /failed to/i,
      /unable to/i,
      /sorry, I can't/i,
      /I don't have/i,
      /not available/i,
      /service issues/i
    ];
    
    return errorIndicators.some(pattern => pattern.test(response));
  }

  /**
   * Check if response is relevant to the user prompt
   */
  isRelevantToPrompt(response, userPrompt) {
    const promptKeywords = this.extractKeywords(userPrompt.toLowerCase());
    const responseKeywords = this.extractKeywords(response.toLowerCase());
    
    const overlap = promptKeywords.filter(keyword => 
      responseKeywords.some(respKeyword => 
        respKeyword.includes(keyword) || keyword.includes(respKeyword)
      )
    );
    
    return overlap.length / promptKeywords.length > 0.3; // 30% keyword overlap
  }

  /**
   * Extract keywords from text
   */
  extractKeywords(text) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Top 10 keywords
  }

  /**
   * Perform weighted voting on ensemble responses
   */
  performWeightedVoting(roleOutputs, context = {}) {
    const votingResults = [];
    
    for (const output of roleOutputs) {
      if (output.status !== 'fulfilled') {
        continue;
      }

      const modelWeights = this.modelWeights.get(output.model) || { overall: 0.5 };
      const confidence = this.calculateConfidenceScore(
        output.content, 
        output.model, 
        output.responseTime || 3000,
        context
      );
      
      const weightedScore = (modelWeights.overall * 0.6) + (confidence * 0.4);
      
      votingResults.push({
        ...output,
        confidence,
        modelWeight: modelWeights.overall,
        weightedScore,
        metadata: {
          confidenceLevel: this.getConfidenceLevel(confidence),
          modelReliability: modelWeights.reliability,
          expectedQuality: modelWeights.accuracy
        }
      });
    }

    // Sort by weighted score
    votingResults.sort((a, b) => b.weightedScore - a.weightedScore);
    
    return votingResults;
  }

  /**
   * Get confidence level category
   */
  getConfidenceLevel(confidence) {
    if (confidence >= this.confidenceThresholds.high) return 'high';
    if (confidence >= this.confidenceThresholds.medium) return 'medium';
    if (confidence >= this.confidenceThresholds.low) return 'low';
    return 'very_low';
  }

  /**
   * Generate synthesis strategy based on voting results
   */
  generateSynthesisStrategy(votingResults, userPrompt) {
    if (votingResults.length === 0) {
      return {
        strategy: 'error',
        primarySource: null,
        secondarySources: [],
        confidence: 0,
        reasoning: 'No valid responses available'
      };
    }

    const topResponse = votingResults[0];
    const highConfidenceResponses = votingResults.filter(r => r.confidence >= this.confidenceThresholds.high);
    
    let strategy;
    let reasoning;

    if (highConfidenceResponses.length >= 2) {
      strategy = 'consensus';
      reasoning = 'Multiple high-confidence responses available for synthesis';
    } else if (topResponse.confidence >= this.confidenceThresholds.high) {
      strategy = 'primary_with_support';
      reasoning = 'One high-confidence response with supporting evidence';
    } else if (topResponse.confidence >= this.confidenceThresholds.medium) {
      strategy = 'balanced_synthesis';
      reasoning = 'Medium confidence responses require balanced synthesis';
    } else {
      strategy = 'cautious';
      reasoning = 'Low confidence responses require cautious synthesis';
    }

    return {
      strategy,
      primarySource: topResponse,
      secondarySources: votingResults.slice(1, 3), // Top 2 supporting responses
      confidence: this.calculateOverallConfidence(votingResults),
      reasoning,
      metadata: {
        totalResponses: votingResults.length,
        highConfidenceCount: highConfidenceResponses.length,
        averageModelWeight: votingResults.reduce((sum, r) => sum + r.modelWeight, 0) / votingResults.length
      }
    };
  }

  /**
   * Calculate overall confidence for the ensemble
   */
  calculateOverallConfidence(votingResults) {
    if (votingResults.length === 0) return 0;
    
    // Weighted average of confidence scores
    const totalWeight = votingResults.reduce((sum, r) => sum + r.weightedScore, 0);
    const weightedConfidence = votingResults.reduce((sum, r) => 
      sum + (r.confidence * r.weightedScore), 0) / totalWeight;
    
    // Boost confidence if multiple models agree
    const agreementBonus = Math.min(0.1, (votingResults.length - 1) * 0.03);
    
    return Math.min(1, weightedConfidence + agreementBonus);
  }

  /**
   * Update model performance based on feedback
   */
  updateModelPerformance(model, metrics) {
    const { accuracy, responseTime, userSatisfaction, errorRate } = metrics;
    
    if (!this.performanceHistory.has(model)) {
      this.performanceHistory.set(model, []);
    }
    
    const history = this.performanceHistory.get(model);
    history.push({
      timestamp: Date.now(),
      accuracy,
      responseTime,
      userSatisfaction,
      errorRate
    });
    
    // Keep only recent history (last 100 entries)
    if (history.length > 100) {
      history.shift();
    }
    
    // Update model weights based on recent performance
    this.recalculateModelWeights(model);
  }

  /**
   * Recalculate model weights based on performance history
   */
  recalculateModelWeights(model) {
    const history = this.performanceHistory.get(model);
    if (!history || history.length < 5) return; // Need minimum data
    
    const recent = history.slice(-20); // Last 20 entries
    const currentWeights = this.modelWeights.get(model);
    
    const avgAccuracy = recent.reduce((sum, h) => sum + h.accuracy, 0) / recent.length;
    const avgSatisfaction = recent.reduce((sum, h) => sum + h.userSatisfaction, 0) / recent.length;
    const avgErrorRate = recent.reduce((sum, h) => sum + h.errorRate, 0) / recent.length;
    
    // Update weights with exponential moving average
    const alpha = 0.1; // Learning rate
    
    const newWeights = {
      ...currentWeights,
      accuracy: currentWeights.accuracy * (1 - alpha) + avgAccuracy * alpha,
      reliability: currentWeights.reliability * (1 - alpha) + (1 - avgErrorRate) * alpha,
      overall: currentWeights.overall * (1 - alpha) + 
               ((avgAccuracy + avgSatisfaction + (1 - avgErrorRate)) / 3) * alpha
    };
    
    this.modelWeights.set(model, newWeights);
    console.log(`📊 Updated weights for ${model}: overall=${newWeights.overall.toFixed(3)}`);
  }

  /**
   * Get ensemble strategy statistics
   */
  getStats() {
    const modelStats = {};
    
    for (const [model, weights] of this.modelWeights.entries()) {
      const history = this.performanceHistory.get(model) || [];
      modelStats[model] = {
        weights,
        historyCount: history.length,
        lastUpdated: history.length > 0 ? new Date(history[history.length - 1].timestamp) : null
      };
    }
    
    return {
      modelCount: this.modelWeights.size,
      confidenceThresholds: this.confidenceThresholds,
      modelStats
    };
  }
}

// Create singleton instance
const advancedEnsembleStrategy = new AdvancedEnsembleStrategy();

module.exports = advancedEnsembleStrategy;
