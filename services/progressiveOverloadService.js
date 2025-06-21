const monitoringService = require('./monitoringService');
const workoutHistoryService = require('./workoutHistoryService');

/**
 * Progressive Overload Service
 * Handles intelligent workout progression based on user history and performance
 */
class ProgressiveOverloadService {
  constructor() {
    this.progressionFactors = {
      beginner: { volumeIncrease: 0.05, intensityIncrease: 0.03, frequencyIncrease: 0.02 },
      intermediate: { volumeIncrease: 0.03, intensityIncrease: 0.05, frequencyIncrease: 0.03 },
      advanced: { volumeIncrease: 0.02, intensityIncrease: 0.07, frequencyIncrease: 0.04 }
    };

    this.adaptationThresholds = {
      consistencyThreshold: 0.8, // 80% completion rate
      difficultyThreshold: 0.7,  // 70% "just_right" ratings
      ratingThreshold: 4.0,      // Average rating of 4+
      progressionWeeks: 2        // Weeks before considering progression
    };
  }

  /**
   * Analyze user's workout history and calculate progressive overload recommendations
   * @param {string} userId - User ID
   * @param {Object} userMetadata - Current user metadata
   * @param {string} workoutType - Type of workout being generated
   * @returns {Promise<Object>} Progressive overload analysis and recommendations
   */
  async analyzeProgressiveOverload(userId, userMetadata, workoutType) {
    const correlationId = `progression-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Get recent workout history (last 30 days)
      const recentWorkouts = await workoutHistoryService.getUserWorkoutHistory(userId, 20, false);
      
      if (recentWorkouts.length < 3) {
        return this.getNewUserProgression(userMetadata, workoutType);
      }

      // Analyze workout patterns
      const workoutAnalysis = this.analyzeWorkoutPatterns(recentWorkouts, workoutType);
      
      // Calculate progression metrics
      const progressionMetrics = this.calculateProgressionMetrics(workoutAnalysis, userMetadata);
      
      // Generate progression recommendations
      const recommendations = this.generateProgressionRecommendations(
        progressionMetrics, 
        userMetadata, 
        workoutType
      );

      monitoringService.log('info', 'Progressive overload analysis completed', {
        userId,
        workoutType,
        totalWorkouts: recentWorkouts.length,
        progressionReady: recommendations.shouldProgress
      }, correlationId);

      return {
        analysis: workoutAnalysis,
        metrics: progressionMetrics,
        recommendations,
        correlationId
      };

    } catch (error) {
      monitoringService.log('error', 'Progressive overload analysis failed', {
        userId,
        error: error.message
      }, correlationId);

      // Return safe fallback progression
      return this.getFallbackProgression(userMetadata, workoutType);
    }
  }

  /**
   * Analyze workout patterns from history
   * @param {Array} workouts - Recent workout history
   * @param {string} targetWorkoutType - Type of workout being analyzed
   * @returns {Object} Workout pattern analysis
   */
  analyzeWorkoutPatterns(workouts, targetWorkoutType) {
    const relevantWorkouts = this.filterRelevantWorkouts(workouts, targetWorkoutType);
    const completedWorkouts = relevantWorkouts.filter(w => w.status === 'completed');

    return {
      totalWorkouts: relevantWorkouts.length,
      completedWorkouts: completedWorkouts.length,
      completionRate: completedWorkouts.length / Math.max(relevantWorkouts.length, 1),
      
      // Duration analysis
      averageDuration: this.calculateAverageDuration(completedWorkouts),
      durationTrend: this.calculateDurationTrend(completedWorkouts),
      
      // Difficulty analysis
      difficultyDistribution: this.analyzeDifficultyDistribution(completedWorkouts),
      averageRating: this.calculateAverageRating(completedWorkouts),
      
      // Consistency analysis
      workoutFrequency: this.calculateWorkoutFrequency(completedWorkouts),
      consistencyScore: this.calculateConsistencyScore(completedWorkouts),
      
      // Recent performance
      recentPerformance: this.analyzeRecentPerformance(completedWorkouts.slice(0, 5)),
      
      // Workout type patterns
      workoutTypeDistribution: this.analyzeWorkoutTypeDistribution(relevantWorkouts),
      
      // Time-based patterns
      timePatterns: this.analyzeTimePatterns(completedWorkouts)
    };
  }

  /**
   * Calculate progression metrics based on workout analysis
   * @param {Object} analysis - Workout pattern analysis
   * @param {Object} userMetadata - User metadata
   * @returns {Object} Progression metrics
   */
  calculateProgressionMetrics(analysis, userMetadata) {
    const fitnessLevel = userMetadata.fitnessLevel || 'beginner';
    const factors = this.progressionFactors[fitnessLevel];

    return {
      readinessScore: this.calculateProgressionReadiness(analysis),
      volumeProgression: this.calculateVolumeProgression(analysis, factors),
      intensityProgression: this.calculateIntensityProgression(analysis, factors),
      frequencyProgression: this.calculateFrequencyProgression(analysis, factors),
      
      // Performance indicators
      performanceStability: this.calculatePerformanceStability(analysis),
      adaptationIndicators: this.calculateAdaptationIndicators(analysis),
      
      // Risk assessment
      overtrainingRisk: this.assessOvertrainingRisk(analysis),
      injuryRisk: this.assessInjuryRisk(analysis, userMetadata),
      
      // Confidence metrics
      dataConfidence: this.calculateDataConfidence(analysis),
      recommendationConfidence: this.calculateRecommendationConfidence(analysis)
    };
  }

  /**
   * Generate specific progression recommendations
   * @param {Object} metrics - Progression metrics
   * @param {Object} userMetadata - User metadata
   * @param {string} workoutType - Target workout type
   * @returns {Object} Progression recommendations
   */
  generateProgressionRecommendations(metrics, userMetadata, workoutType) {
    const shouldProgress = metrics.readinessScore >= this.adaptationThresholds.consistencyThreshold;
    
    const recommendations = {
      shouldProgress,
      progressionType: this.determineProgressionType(metrics, userMetadata),
      
      // Specific adjustments
      volumeAdjustment: shouldProgress ? metrics.volumeProgression : 0,
      intensityAdjustment: shouldProgress ? metrics.intensityProgression : 0,
      frequencyAdjustment: shouldProgress ? metrics.frequencyProgression : 0,
      
      // Duration recommendations
      durationRecommendation: this.calculateDurationRecommendation(metrics, userMetadata),
      
      // Exercise modifications
      exerciseProgression: this.generateExerciseProgression(metrics, workoutType),
      
      // Rest and recovery
      restRecommendations: this.generateRestRecommendations(metrics, userMetadata),
      
      // Safety considerations
      safetyNotes: this.generateSafetyNotes(metrics, userMetadata),
      
      // Next milestone
      nextMilestone: this.calculateNextMilestone(metrics, userMetadata),
      
      // Confidence and reasoning
      confidence: metrics.recommendationConfidence,
      reasoning: this.generateProgressionReasoning(metrics, shouldProgress)
    };

    return recommendations;
  }

  /**
   * Filter workouts relevant to the target workout type
   * @param {Array} workouts - All workouts
   * @param {string} targetType - Target workout type
   * @returns {Array} Filtered relevant workouts
   */
  filterRelevantWorkouts(workouts, targetType) {
    // Normalize workout type for comparison
    const normalizedTarget = this.normalizeWorkoutType(targetType);
    
    return workouts.filter(workout => {
      const workoutType = workout.parameters?.workoutType || workout.generatedWorkout?.type || '';
      const normalizedWorkoutType = this.normalizeWorkoutType(workoutType);
      
      // Direct match
      if (normalizedWorkoutType === normalizedTarget) return true;
      
      // Category match (e.g., "upper body" matches "upper body push")
      return this.isWorkoutTypeCompatible(normalizedWorkoutType, normalizedTarget);
    });
  }

  /**
   * Calculate average duration from completed workouts
   * @param {Array} workouts - Completed workouts
   * @returns {number} Average duration in minutes
   */
  calculateAverageDuration(workouts) {
    if (workouts.length === 0) return 0;
    
    const durations = workouts.map(w => 
      w.parameters?.minutesPerSession || 
      w.generatedWorkout?.duration || 
      30
    );
    
    return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  }

  /**
   * Calculate duration trend (increasing, stable, decreasing)
   * @param {Array} workouts - Completed workouts (newest first)
   * @returns {Object} Duration trend analysis
   */
  calculateDurationTrend(workouts) {
    if (workouts.length < 3) {
      return { trend: 'insufficient_data', slope: 0, confidence: 0 };
    }

    const recentDurations = workouts.slice(0, 5).map(w => 
      w.parameters?.minutesPerSession || w.generatedWorkout?.duration || 30
    );

    // Simple linear regression to determine trend
    const n = recentDurations.length;
    const x = Array.from({length: n}, (_, i) => i);
    const y = recentDurations;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    let trend = 'stable';
    if (slope > 1) trend = 'increasing';
    else if (slope < -1) trend = 'decreasing';
    
    return {
      trend,
      slope,
      confidence: Math.min(Math.abs(slope) / 2, 1),
      recentAverage: sumY / n
    };
  }

  /**
   * Analyze difficulty distribution from feedback
   * @param {Array} workouts - Completed workouts
   * @returns {Object} Difficulty distribution analysis
   */
  analyzeDifficultyDistribution(workouts) {
    const difficulties = { too_easy: 0, just_right: 0, too_hard: 0, unknown: 0 };
    
    workouts.forEach(workout => {
      const feedback = workout.feedback;
      if (feedback && feedback.difficulty) {
        difficulties[feedback.difficulty] = (difficulties[feedback.difficulty] || 0) + 1;
      } else {
        difficulties.unknown++;
      }
    });

    const total = workouts.length;
    return {
      counts: difficulties,
      percentages: {
        too_easy: (difficulties.too_easy / total) * 100,
        just_right: (difficulties.just_right / total) * 100,
        too_hard: (difficulties.too_hard / total) * 100,
        unknown: (difficulties.unknown / total) * 100
      },
      dominantDifficulty: Object.keys(difficulties).reduce((a, b) => 
        difficulties[a] > difficulties[b] ? a : b
      )
    };
  }

  /**
   * Calculate average rating from feedback
   * @param {Array} workouts - Completed workouts
   * @returns {number} Average rating (1-5)
   */
  calculateAverageRating(workouts) {
    const ratings = workouts
      .map(w => w.feedback?.rating)
      .filter(rating => rating && rating >= 1 && rating <= 5);
    
    if (ratings.length === 0) return 3.5; // Default neutral rating
    
    return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  }

  /**
   * Calculate workout frequency (workouts per week)
   * @param {Array} workouts - Completed workouts
   * @returns {number} Average workouts per week
   */
  calculateWorkoutFrequency(workouts) {
    if (workouts.length === 0) return 0;
    
    const sortedWorkouts = workouts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const firstWorkout = new Date(sortedWorkouts[sortedWorkouts.length - 1].createdAt);
    const lastWorkout = new Date(sortedWorkouts[0].createdAt);
    
    const daysDiff = Math.max((lastWorkout - firstWorkout) / (1000 * 60 * 60 * 24), 1);
    const weeksDiff = daysDiff / 7;
    
    return workouts.length / weeksDiff;
  }

  /**
   * Calculate consistency score based on workout patterns
   * @param {Array} workouts - Completed workouts
   * @returns {number} Consistency score (0-1)
   */
  calculateConsistencyScore(workouts) {
    if (workouts.length < 2) return 0;
    
    // Calculate gaps between workouts
    const sortedWorkouts = workouts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const gaps = [];
    
    for (let i = 1; i < sortedWorkouts.length; i++) {
      const gap = (new Date(sortedWorkouts[i].createdAt) - new Date(sortedWorkouts[i-1].createdAt)) / (1000 * 60 * 60 * 24);
      gaps.push(gap);
    }
    
    // Calculate coefficient of variation (lower = more consistent)
    const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgGap;
    
    // Convert to consistency score (0-1, higher = more consistent)
    return Math.max(0, 1 - (coefficientOfVariation / 2));
  }

  /**
   * Get progression recommendations for new users
   * @param {Object} userMetadata - User metadata
   * @param {string} workoutType - Workout type
   * @returns {Object} New user progression
   */
  getNewUserProgression(userMetadata, workoutType) {
    return {
      analysis: {
        totalWorkouts: 0,
        completedWorkouts: 0,
        completionRate: 0,
        isNewUser: true
      },
      metrics: {
        readinessScore: 0,
        dataConfidence: 0,
        recommendationConfidence: 0.7 // Moderate confidence for new users
      },
      recommendations: {
        shouldProgress: false,
        progressionType: 'foundation_building',
        volumeAdjustment: 0,
        intensityAdjustment: 0,
        frequencyAdjustment: 0,
        durationRecommendation: Math.min(userMetadata.minutesPerSession || 30, 30),
        exerciseProgression: {
          focus: 'form_and_technique',
          complexity: 'basic',
          modifications: ['focus_on_proper_form', 'start_with_bodyweight']
        },
        safetyNotes: [
          'Focus on proper form over intensity',
          'Start with shorter sessions to build consistency',
          'Listen to your body and rest when needed'
        ],
        confidence: 0.7,
        reasoning: 'New user - focusing on building foundation and consistency'
      },
      correlationId: `new-user-${Date.now()}`
    };
  }

  /**
   * Get fallback progression when analysis fails
   * @param {Object} userMetadata - User metadata
   * @param {string} workoutType - Workout type
   * @returns {Object} Fallback progression
   */
  getFallbackProgression(userMetadata, workoutType) {
    const fitnessLevel = userMetadata.fitnessLevel || 'beginner';
    
    return {
      analysis: {
        totalWorkouts: 0,
        completedWorkouts: 0,
        completionRate: 0,
        isFallback: true
      },
      metrics: {
        readinessScore: 0.5,
        dataConfidence: 0.3,
        recommendationConfidence: 0.5
      },
      recommendations: {
        shouldProgress: false,
        progressionType: 'maintenance',
        volumeAdjustment: 0,
        intensityAdjustment: 0,
        frequencyAdjustment: 0,
        durationRecommendation: userMetadata.minutesPerSession || 30,
        exerciseProgression: {
          focus: 'consistency',
          complexity: fitnessLevel === 'beginner' ? 'basic' : 'moderate'
        },
        safetyNotes: [
          'Maintain current workout intensity',
          'Focus on consistency over progression'
        ],
        confidence: 0.5,
        reasoning: 'Insufficient data - using conservative approach'
      },
      correlationId: `fallback-${Date.now()}`
    };
  }

  // Helper methods for calculations
  normalizeWorkoutType(type) {
    return type.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  isWorkoutTypeCompatible(type1, type2) {
    const compatibilityMap = {
      'upper_body': ['upper_body_push', 'upper_body_pull', 'chest', 'back', 'shoulders', 'arms'],
      'lower_body': ['lower_body_power', 'legs', 'glutes', 'leg_day'],
      'full_body': ['full_body_strength', 'functional', 'crossfit'],
      'strength': ['strength_training', 'powerlifting', 'muscle_gain'],
      'cardio': ['hiit', 'endurance', 'fat_burn']
    };

    for (const [category, types] of Object.entries(compatibilityMap)) {
      if ((type1.includes(category) || types.some(t => type1.includes(t))) &&
          (type2.includes(category) || types.some(t => type2.includes(t)))) {
        return true;
      }
    }

    return false;
  }

  calculateProgressionReadiness(analysis) {
    const weights = {
      completionRate: 0.4,
      consistencyScore: 0.3,
      averageRating: 0.2,
      recentPerformance: 0.1
    };

    const normalizedRating = Math.max(0, (analysis.averageRating - 2) / 3); // Normalize 2-5 to 0-1
    const recentPerformanceScore = analysis.recentPerformance?.averageRating ? 
      Math.max(0, (analysis.recentPerformance.averageRating - 2) / 3) : 0.5;

    return (
      analysis.completionRate * weights.completionRate +
      analysis.consistencyScore * weights.consistencyScore +
      normalizedRating * weights.averageRating +
      recentPerformanceScore * weights.recentPerformance
    );
  }

  calculateVolumeProgression(analysis, factors) {
    if (analysis.difficultyDistribution.percentages.too_easy > 50) {
      return factors.volumeIncrease * 1.5; // Increase more if too easy
    } else if (analysis.difficultyDistribution.percentages.just_right > 60) {
      return factors.volumeIncrease;
    }
    return 0; // No volume increase if too hard or mixed feedback
  }

  calculateIntensityProgression(analysis, factors) {
    const easyPercentage = analysis.difficultyDistribution.percentages.too_easy;
    const justRightPercentage = analysis.difficultyDistribution.percentages.just_right;
    
    if (easyPercentage > 40 && analysis.averageRating >= 4) {
      return factors.intensityIncrease;
    } else if (justRightPercentage > 70 && analysis.consistencyScore > 0.8) {
      return factors.intensityIncrease * 0.7;
    }
    return 0;
  }

  calculateFrequencyProgression(analysis, factors) {
    if (analysis.consistencyScore > 0.9 && analysis.completionRate > 0.85) {
      return factors.frequencyIncrease;
    }
    return 0;
  }

  // Additional helper methods would continue here...
  // (Implementing remaining calculation methods for brevity)
}

module.exports = new ProgressiveOverloadService();
