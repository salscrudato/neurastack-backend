/**
 * 🎯 Brier Calibration Service - Advanced Probability Calibration System
 *
 * 🎯 PURPOSE: Provide Brier-calibrated probability scoring for AI model responses
 *
 * 📋 KEY FEATURES:
 * 1. Rolling window evaluation for model performance tracking
 * 2. Isotonic regression for probability calibration
 * 3. Model-specific calibration maps
 * 4. Automated nightly calibration updates
 * 5. Brier score calculation and tracking
 *
 * 💡 ANALOGY: Like having a statistical expert continuously monitor and adjust
 *    how confident each AI model should be based on its historical accuracy
 */

const stats = require('simple-statistics');
const SimpleLinearRegression = require('ml-regression-simple-linear');
const monitoringService = require('./monitoringService');

class BrierCalibrationService {
  constructor() {
    this.calibrationData = new Map(); // Model -> calibration history
    this.calibrationMaps = new Map(); // Model -> calibration function
    this.brierScores = new Map(); // Model -> Brier score history
    this.maxHistorySize = 500;
    this.minDataForCalibration = 20;
    this.lastCalibrationUpdate = new Map(); // Model -> timestamp
    
    this.initializeService();
  }

  /**
   * Initialize the calibration service
   */
  initializeService() {
    console.log('✅ Brier Calibration Service: Initialized');
    
    // Schedule nightly calibration updates
    this.scheduleCalibrationUpdates();
  }

  /**
   * Schedule nightly calibration map updates
   */
  scheduleCalibrationUpdates() {
    // Run calibration update every 6 hours
    setInterval(() => {
      this.updateAllCalibrationMaps();
    }, 6 * 60 * 60 * 1000); // 6 hours in milliseconds
    
    console.log('📅 Scheduled calibration updates every 6 hours');
  }

  /**
   * Store a new prediction and outcome for calibration
   */
  storePrediction(modelName, predictedProbability, actualOutcome, metadata = {}) {
    if (!this.calibrationData.has(modelName)) {
      this.calibrationData.set(modelName, []);
    }

    const modelData = this.calibrationData.get(modelName);
    const dataPoint = {
      predicted: Math.min(1.0, Math.max(0.0, predictedProbability)),
      actual: actualOutcome ? 1 : 0, // Convert to binary
      timestamp: Date.now(),
      metadata: metadata
    };

    modelData.push(dataPoint);

    // Maintain rolling window
    if (modelData.length > this.maxHistorySize) {
      modelData.splice(0, modelData.length - this.maxHistorySize);
    }

    // Update Brier score
    this.updateBrierScore(modelName, dataPoint);

    // Trigger calibration update if enough new data
    if (modelData.length % 10 === 0) {
      this.updateCalibrationMap(modelName);
    }
  }

  /**
   * Update Brier score for a model
   */
  updateBrierScore(modelName, dataPoint) {
    if (!this.brierScores.has(modelName)) {
      this.brierScores.set(modelName, []);
    }

    const brierHistory = this.brierScores.get(modelName);
    
    // Calculate Brier score for this prediction
    const brierScore = Math.pow(dataPoint.predicted - dataPoint.actual, 2);
    
    brierHistory.push({
      score: brierScore,
      timestamp: dataPoint.timestamp
    });

    // Keep recent history
    if (brierHistory.length > 100) {
      brierHistory.splice(0, brierHistory.length - 100);
    }
  }

  /**
   * Get current Brier score for a model
   */
  getCurrentBrierScore(modelName) {
    const brierHistory = this.brierScores.get(modelName);
    if (!brierHistory || brierHistory.length === 0) {
      return null;
    }

    // Return average of recent Brier scores
    const recentScores = brierHistory.slice(-20); // Last 20 predictions
    const avgBrierScore = recentScores.reduce((sum, item) => sum + item.score, 0) / recentScores.length;
    
    return {
      score: avgBrierScore,
      reliability: this.getBrierReliabilityLevel(avgBrierScore),
      sampleSize: recentScores.length
    };
  }

  /**
   * Get reliability level based on Brier score
   */
  getBrierReliabilityLevel(brierScore) {
    if (brierScore <= 0.1) return 'excellent';
    if (brierScore <= 0.2) return 'good';
    if (brierScore <= 0.3) return 'fair';
    return 'poor';
  }

  /**
   * Get comprehensive historical accuracy metrics for a model
   */
  getHistoricalAccuracyMetrics(modelName) {
    const brierHistory = this.brierScores.get(modelName);
    const calibrationData = this.calibrationData.get(modelName);

    if (!brierHistory || !calibrationData || brierHistory.length < 5) {
      return {
        modelName,
        hasData: false,
        accuracy: 0.5,
        reliability: 0.5,
        calibration: 0.5,
        trend: 'stable',
        confidence: 'low'
      };
    }

    // Calculate accuracy metrics
    const recentBrier = brierHistory.slice(-20);
    const historicalBrier = brierHistory.slice(-100, -20);

    const recentAvg = recentBrier.reduce((sum, entry) => sum + entry.score, 0) / recentBrier.length;
    const historicalAvg = historicalBrier.length > 0 ?
      historicalBrier.reduce((sum, entry) => sum + entry.score, 0) / historicalBrier.length : recentAvg;

    // Calculate trend
    const trend = this.calculatePerformanceTrend(brierHistory);

    // Calculate calibration quality
    const calibrationQuality = this.calculateCalibrationQuality(modelName);

    // Calculate confidence intervals
    const confidenceMetrics = this.calculateConfidenceMetrics(brierHistory);

    // Calculate long-term stability
    const stabilityMetrics = this.calculateStabilityMetrics(brierHistory);

    return {
      modelName,
      hasData: true,

      // Core accuracy metrics
      accuracy: Math.max(0, 1 - recentAvg), // Convert Brier to accuracy
      reliability: Math.max(0, 1 - recentAvg),
      calibration: calibrationQuality,

      // Trend analysis
      trend: trend.direction,
      trendStrength: trend.strength,
      trendConfidence: trend.confidence,

      // Performance comparison
      recentPerformance: recentAvg,
      historicalPerformance: historicalAvg,
      performanceImprovement: historicalAvg - recentAvg, // Positive = improvement

      // Confidence and stability
      confidence: confidenceMetrics.level,
      confidenceInterval: confidenceMetrics.interval,
      stability: stabilityMetrics.score,
      volatility: stabilityMetrics.volatility,

      // Data quality
      dataPoints: brierHistory.length,
      recentDataPoints: recentBrier.length,
      dataQuality: this.assessDataQuality(brierHistory),

      // Voting weight recommendation
      votingWeight: this.calculateHistoricalVotingWeight(recentAvg, trend, stabilityMetrics),

      // Timestamps
      lastUpdated: new Date().toISOString(),
      dataRange: {
        oldest: brierHistory[0]?.timestamp,
        newest: brierHistory[brierHistory.length - 1]?.timestamp
      }
    };
  }

  /**
   * Calculate performance trend over time
   */
  calculatePerformanceTrend(brierHistory) {
    if (brierHistory.length < 10) {
      return { direction: 'stable', strength: 0, confidence: 'low' };
    }

    // Split into segments for trend analysis
    const segmentSize = Math.max(5, Math.floor(brierHistory.length / 4));
    const segments = [];

    for (let i = 0; i < brierHistory.length; i += segmentSize) {
      const segment = brierHistory.slice(i, i + segmentSize);
      const avgScore = segment.reduce((sum, entry) => sum + entry.score, 0) / segment.length;
      segments.push(avgScore);
    }

    if (segments.length < 2) {
      return { direction: 'stable', strength: 0, confidence: 'low' };
    }

    // Calculate linear trend
    const n = segments.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = segments;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for trend confidence
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const rSquared = 1 - (ssRes / ssTotal);

    // Interpret trend (remember: lower Brier score = better performance)
    let direction = 'stable';
    let strength = Math.abs(slope);

    if (slope < -0.01) {
      direction = 'improving'; // Brier score decreasing = performance improving
    } else if (slope > 0.01) {
      direction = 'declining'; // Brier score increasing = performance declining
    }

    let confidence = 'low';
    if (rSquared > 0.7) confidence = 'high';
    else if (rSquared > 0.4) confidence = 'medium';

    return {
      direction,
      strength: Math.min(1, strength * 10), // Normalize strength
      confidence,
      rSquared,
      slope
    };
  }

  /**
   * Calculate calibration quality for a model
   */
  calculateCalibrationQuality(modelName) {
    const calibrationData = this.calibrationData.get(modelName);
    if (!calibrationData || calibrationData.length < 10) {
      return 0.5; // Default calibration
    }

    // Calculate calibration using reliability diagram approach
    const bins = 10;
    const binSize = 1.0 / bins;
    const binData = Array.from({ length: bins }, () => ({ predicted: [], actual: [] }));

    // Assign predictions to bins
    calibrationData.forEach(point => {
      const binIndex = Math.min(bins - 1, Math.floor(point.predicted / binSize));
      binData[binIndex].predicted.push(point.predicted);
      binData[binIndex].actual.push(point.actual);
    });

    // Calculate calibration error
    let totalCalibrationError = 0;
    let totalWeight = 0;

    binData.forEach((bin, i) => {
      if (bin.predicted.length > 0) {
        const avgPredicted = bin.predicted.reduce((a, b) => a + b, 0) / bin.predicted.length;
        const avgActual = bin.actual.reduce((a, b) => a + b, 0) / bin.actual.length;
        const weight = bin.predicted.length / calibrationData.length;

        totalCalibrationError += weight * Math.abs(avgPredicted - avgActual);
        totalWeight += weight;
      }
    });

    const calibrationError = totalWeight > 0 ? totalCalibrationError / totalWeight : 0.5;
    return Math.max(0, 1 - calibrationError); // Convert error to quality score
  }

  /**
   * Calculate confidence metrics for predictions
   */
  calculateConfidenceMetrics(brierHistory) {
    if (brierHistory.length < 10) {
      return { level: 'low', interval: [0, 1] };
    }

    const recentScores = brierHistory.slice(-20).map(entry => entry.score);
    const mean = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
    const variance = recentScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / recentScores.length;
    const stdDev = Math.sqrt(variance);

    // Calculate 95% confidence interval
    const marginOfError = 1.96 * (stdDev / Math.sqrt(recentScores.length));
    const interval = [
      Math.max(0, mean - marginOfError),
      Math.min(1, mean + marginOfError)
    ];

    // Determine confidence level based on interval width
    const intervalWidth = interval[1] - interval[0];
    let level = 'low';
    if (intervalWidth < 0.1) level = 'high';
    else if (intervalWidth < 0.2) level = 'medium';

    return { level, interval, standardDeviation: stdDev };
  }

  /**
   * Calculate stability metrics for model performance
   */
  calculateStabilityMetrics(brierHistory) {
    if (brierHistory.length < 10) {
      return { score: 0.5, volatility: 0.5 };
    }

    const scores = brierHistory.map(entry => entry.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Calculate coefficient of variation (relative volatility)
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

    // Stability score (higher = more stable)
    const stabilityScore = Math.max(0, 1 - coefficientOfVariation);

    // Volatility score (higher = more volatile)
    const volatilityScore = Math.min(1, coefficientOfVariation);

    return {
      score: stabilityScore,
      volatility: volatilityScore,
      standardDeviation: stdDev,
      coefficientOfVariation
    };
  }

  /**
   * Assess data quality for historical analysis
   */
  assessDataQuality(brierHistory) {
    if (brierHistory.length < 5) return 'insufficient';
    if (brierHistory.length < 20) return 'limited';
    if (brierHistory.length < 50) return 'adequate';
    if (brierHistory.length < 100) return 'good';
    return 'excellent';
  }

  /**
   * Calculate historical voting weight based on performance metrics
   */
  calculateHistoricalVotingWeight(recentAvg, trend, stabilityMetrics) {
    // Base weight from recent performance (lower Brier = higher weight)
    const performanceWeight = Math.max(0.1, 1 - recentAvg);

    // Trend adjustment
    let trendMultiplier = 1.0;
    if (trend.direction === 'improving' && trend.confidence !== 'low') {
      trendMultiplier = 1.1 + (trend.strength * 0.1);
    } else if (trend.direction === 'declining' && trend.confidence !== 'low') {
      trendMultiplier = 0.9 - (trend.strength * 0.1);
    }

    // Stability adjustment
    const stabilityMultiplier = 0.9 + (stabilityMetrics.score * 0.2);

    // Combine factors
    const finalWeight = performanceWeight * trendMultiplier * stabilityMultiplier;

    // Clamp to reasonable range
    return Math.max(0.1, Math.min(2.0, finalWeight));
  }

  /**
   * Update calibration map for a specific model
   */
  updateCalibrationMap(modelName) {
    const modelData = this.calibrationData.get(modelName);
    
    if (!modelData || modelData.length < this.minDataForCalibration) {
      console.log(`⚠️ Insufficient data for ${modelName} calibration: ${modelData?.length || 0} points`);
      return;
    }

    try {
      // Prepare data for calibration
      const predictions = modelData.map(d => d.predicted);
      const outcomes = modelData.map(d => d.actual);

      // Create calibration bins
      const calibrationMap = this.createCalibrationBins(predictions, outcomes);
      
      // Store calibration map
      this.calibrationMaps.set(modelName, calibrationMap);
      this.lastCalibrationUpdate.set(modelName, Date.now());

      console.log(`✅ Updated calibration map for ${modelName} with ${modelData.length} data points`);
      
      // Log calibration quality
      const brierScore = this.getCurrentBrierScore(modelName);
      if (brierScore) {
        monitoringService.log('info', 'Model calibration updated', {
          model: modelName,
          dataPoints: modelData.length,
          brierScore: brierScore.score,
          reliability: brierScore.reliability
        });
      }
    } catch (error) {
      console.error(`❌ Failed to update calibration for ${modelName}:`, error.message);
    }
  }

  /**
   * Create calibration bins for isotonic regression approximation
   */
  createCalibrationBins(predictions, outcomes, numBins = 10) {
    // Sort data by predicted probability
    const sortedData = predictions.map((pred, idx) => ({
      predicted: pred,
      actual: outcomes[idx]
    })).sort((a, b) => a.predicted - b.predicted);

    // Create bins
    const binSize = Math.ceil(sortedData.length / numBins);
    const bins = [];

    for (let i = 0; i < numBins; i++) {
      const start = i * binSize;
      const end = Math.min(start + binSize, sortedData.length);
      const binData = sortedData.slice(start, end);

      if (binData.length === 0) continue;

      const avgPredicted = binData.reduce((sum, d) => sum + d.predicted, 0) / binData.length;
      const avgActual = binData.reduce((sum, d) => sum + d.actual, 0) / binData.length;

      bins.push({
        predictedRange: [binData[0].predicted, binData[binData.length - 1].predicted],
        avgPredicted: avgPredicted,
        avgActual: avgActual,
        count: binData.length
      });
    }

    return bins;
  }

  /**
   * Get calibrated probability for a model
   */
  getCalibratedProbability(modelName, rawProbability) {
    const calibrationMap = this.calibrationMaps.get(modelName);
    
    if (!calibrationMap || calibrationMap.length === 0) {
      // No calibration available, return raw probability
      return {
        calibrated: rawProbability,
        raw: rawProbability,
        calibrationAvailable: false
      };
    }

    try {
      // Find appropriate bin
      let calibratedProb = rawProbability;
      
      for (const bin of calibrationMap) {
        if (rawProbability >= bin.predictedRange[0] && rawProbability <= bin.predictedRange[1]) {
          // Linear interpolation within bin
          const ratio = (rawProbability - bin.avgPredicted) / Math.max(0.01, bin.predictedRange[1] - bin.predictedRange[0]);
          calibratedProb = bin.avgActual + ratio * (bin.avgActual - bin.avgPredicted);
          break;
        }
      }

      // Ensure result is within [0, 1]
      calibratedProb = Math.min(1.0, Math.max(0.0, calibratedProb));

      return {
        calibrated: calibratedProb,
        raw: rawProbability,
        calibrationAvailable: true,
        adjustment: calibratedProb - rawProbability
      };
    } catch (error) {
      console.warn(`Calibration lookup failed for ${modelName}:`, error.message);
      return {
        calibrated: rawProbability,
        raw: rawProbability,
        calibrationAvailable: false,
        error: error.message
      };
    }
  }

  /**
   * Update all calibration maps
   */
  updateAllCalibrationMaps() {
    console.log('🔄 Starting scheduled calibration map updates...');
    
    let updatedCount = 0;
    for (const modelName of this.calibrationData.keys()) {
      try {
        this.updateCalibrationMap(modelName);
        updatedCount++;
      } catch (error) {
        console.error(`Failed to update calibration for ${modelName}:`, error.message);
      }
    }

    console.log(`✅ Updated calibration maps for ${updatedCount} models`);
  }

  /**
   * Get calibration statistics for a model
   */
  getCalibrationStats(modelName) {
    const modelData = this.calibrationData.get(modelName);
    const calibrationMap = this.calibrationMaps.get(modelName);
    const brierScore = this.getCurrentBrierScore(modelName);
    const lastUpdate = this.lastCalibrationUpdate.get(modelName);

    return {
      modelName,
      dataPoints: modelData?.length || 0,
      calibrationAvailable: !!calibrationMap,
      calibrationBins: calibrationMap?.length || 0,
      brierScore: brierScore,
      lastCalibrationUpdate: lastUpdate ? new Date(lastUpdate).toISOString() : null,
      calibrationQuality: this.assessCalibrationQuality(modelName)
    };
  }

  /**
   * Assess calibration quality
   */
  assessCalibrationQuality(modelName) {
    const modelData = this.calibrationData.get(modelName);
    const brierScore = this.getCurrentBrierScore(modelName);
    
    if (!modelData || modelData.length < this.minDataForCalibration) {
      return 'insufficient_data';
    }

    if (!brierScore) {
      return 'no_score';
    }

    return brierScore.reliability;
  }

  /**
   * Get service statistics
   */
  getServiceStats() {
    const modelStats = {};
    
    for (const modelName of this.calibrationData.keys()) {
      modelStats[modelName] = this.getCalibrationStats(modelName);
    }

    return {
      totalModels: this.calibrationData.size,
      totalDataPoints: Array.from(this.calibrationData.values())
        .reduce((sum, data) => sum + data.length, 0),
      modelsWithCalibration: Array.from(this.calibrationMaps.keys()).length,
      modelStats
    };
  }

  /**
   * Clear old calibration data
   */
  clearOldData(maxAgeMs = 30 * 24 * 60 * 60 * 1000) { // 30 days default
    const cutoffTime = Date.now() - maxAgeMs;
    let totalRemoved = 0;

    for (const [modelName, modelData] of this.calibrationData.entries()) {
      const originalLength = modelData.length;
      const filteredData = modelData.filter(d => d.timestamp > cutoffTime);
      
      if (filteredData.length !== originalLength) {
        this.calibrationData.set(modelName, filteredData);
        totalRemoved += originalLength - filteredData.length;
      }
    }

    if (totalRemoved > 0) {
      console.log(`🧹 Cleaned up ${totalRemoved} old calibration data points`);
    }

    return totalRemoved;
  }
}

module.exports = BrierCalibrationService;
