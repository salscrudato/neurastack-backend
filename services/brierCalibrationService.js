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

module.exports = new BrierCalibrationService();
