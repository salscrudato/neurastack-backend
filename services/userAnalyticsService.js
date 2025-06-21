const monitoringService = require('./monitoringService');
const workoutHistoryService = require('./workoutHistoryService');

/**
 * User Analytics Service
 * Handles complex user data processing, analytics, and personalization insights
 */
class UserAnalyticsService {
  constructor() {
    this.analyticsCache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15 minutes cache
  }

  /**
   * Process and analyze comprehensive user data
   * @param {string} userId - User ID
   * @param {Object} userMetadata - Current user metadata
   * @returns {Promise<Object>} Comprehensive user analytics
   */
  async processUserAnalytics(userId, userMetadata) {
    const correlationId = `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Check cache first
      const cacheKey = `analytics_${userId}`;
      const cached = this.analyticsCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return { ...cached.data, fromCache: true };
      }

      // Get comprehensive workout history
      const workoutHistory = await workoutHistoryService.getUserWorkoutHistory(userId, 50, true);
      const userStats = await workoutHistoryService.getUserWorkoutStats(userId);

      // Process analytics
      const analytics = {
        // User profile analysis
        userProfile: this.analyzeUserProfile(userMetadata, workoutHistory),
        
        // Performance analytics
        performanceMetrics: this.calculatePerformanceMetrics(workoutHistory, userStats),
        
        // Behavioral patterns
        behaviorPatterns: this.analyzeBehaviorPatterns(workoutHistory),
        
        // Preference analysis
        preferences: this.analyzeUserPreferences(workoutHistory, userMetadata),
        
        // Progress tracking
        progressTracking: this.analyzeProgressTracking(workoutHistory),
        
        // Risk assessment
        riskAssessment: this.assessUserRisks(workoutHistory, userMetadata),
        
        // Personalization insights
        personalizationInsights: this.generatePersonalizationInsights(workoutHistory, userMetadata),
        
        // Recommendations
        recommendations: this.generateAnalyticsRecommendations(workoutHistory, userMetadata),
        
        // Metadata
        metadata: {
          totalWorkouts: workoutHistory.length,
          analysisDate: new Date().toISOString(),
          correlationId,
          dataQuality: this.assessDataQuality(workoutHistory)
        }
      };

      // Cache results
      this.analyticsCache.set(cacheKey, {
        data: analytics,
        timestamp: Date.now()
      });

      monitoringService.log('info', 'User analytics processed', {
        userId,
        totalWorkouts: workoutHistory.length,
        dataQuality: analytics.metadata.dataQuality
      }, correlationId);

      return analytics;

    } catch (error) {
      monitoringService.log('error', 'User analytics processing failed', {
        userId,
        error: error.message
      }, correlationId);

      return this.getFallbackAnalytics(userId, userMetadata);
    }
  }

  /**
   * Analyze user profile characteristics
   * @param {Object} userMetadata - User metadata
   * @param {Array} workoutHistory - Workout history
   * @returns {Object} User profile analysis
   */
  analyzeUserProfile(userMetadata, workoutHistory) {
    const completedWorkouts = workoutHistory.filter(w => w.status === 'completed');
    
    return {
      // Basic demographics
      demographics: {
        age: userMetadata.age,
        gender: userMetadata.gender,
        fitnessLevel: userMetadata.fitnessLevel,
        experienceLevel: this.calculateExperienceLevel(completedWorkouts.length)
      },
      
      // Activity profile
      activityProfile: {
        totalWorkouts: workoutHistory.length,
        completedWorkouts: completedWorkouts.length,
        completionRate: completedWorkouts.length / Math.max(workoutHistory.length, 1),
        averageWorkoutsPerWeek: this.calculateAverageWorkoutsPerWeek(completedWorkouts),
        longestStreak: this.calculateLongestStreak(completedWorkouts),
        currentStreak: this.calculateCurrentStreak(completedWorkouts)
      },
      
      // Fitness goals evolution
      goalsEvolution: this.analyzeGoalsEvolution(workoutHistory),
      
      // Equipment usage patterns
      equipmentUsage: this.analyzeEquipmentUsage(workoutHistory),
      
      // Injury considerations
      injuryProfile: this.analyzeInjuryProfile(workoutHistory, userMetadata)
    };
  }

  /**
   * Calculate comprehensive performance metrics
   * @param {Array} workoutHistory - Workout history
   * @param {Object} userStats - User statistics
   * @returns {Object} Performance metrics
   */
  calculatePerformanceMetrics(workoutHistory, userStats) {
    const completedWorkouts = workoutHistory.filter(w => w.status === 'completed');
    
    return {
      // Completion metrics
      completion: {
        totalRate: completedWorkouts.length / Math.max(workoutHistory.length, 1),
        recentRate: this.calculateRecentCompletionRate(workoutHistory),
        trendDirection: this.calculateCompletionTrend(workoutHistory)
      },
      
      // Duration metrics
      duration: {
        average: this.calculateAverageDuration(completedWorkouts),
        trend: this.calculateDurationTrend(completedWorkouts),
        consistency: this.calculateDurationConsistency(completedWorkouts)
      },
      
      // Rating metrics
      satisfaction: {
        averageRating: this.calculateAverageRating(completedWorkouts),
        ratingTrend: this.calculateRatingTrend(completedWorkouts),
        ratingDistribution: this.calculateRatingDistribution(completedWorkouts)
      },
      
      // Difficulty metrics
      difficulty: {
        distribution: this.calculateDifficultyDistribution(completedWorkouts),
        progression: this.calculateDifficultyProgression(completedWorkouts),
        adaptationRate: this.calculateAdaptationRate(completedWorkouts)
      },
      
      // Consistency metrics
      consistency: {
        workoutFrequency: this.calculateWorkoutFrequency(completedWorkouts),
        scheduleConsistency: this.calculateScheduleConsistency(completedWorkouts),
        typeConsistency: this.calculateWorkoutTypeConsistency(completedWorkouts)
      }
    };
  }

  /**
   * Analyze user behavior patterns
   * @param {Array} workoutHistory - Workout history
   * @returns {Object} Behavior patterns
   */
  analyzeBehaviorPatterns(workoutHistory) {
    return {
      // Temporal patterns
      temporal: {
        preferredDays: this.analyzePreferredDays(workoutHistory),
        preferredTimes: this.analyzePreferredTimes(workoutHistory),
        seasonalPatterns: this.analyzeSeasonalPatterns(workoutHistory)
      },
      
      // Workout patterns
      workoutPatterns: {
        preferredDuration: this.analyzePreferredDuration(workoutHistory),
        workoutTypeRotation: this.analyzeWorkoutTypeRotation(workoutHistory),
        intensityPatterns: this.analyzeIntensityPatterns(workoutHistory)
      },
      
      // Engagement patterns
      engagement: {
        dropoffPoints: this.analyzeDropoffPoints(workoutHistory),
        recoveryPatterns: this.analyzeRecoveryPatterns(workoutHistory),
        motivationFactors: this.analyzeMotivationFactors(workoutHistory)
      },
      
      // Feedback patterns
      feedback: {
        feedbackFrequency: this.calculateFeedbackFrequency(workoutHistory),
        feedbackQuality: this.analyzeFeedbackQuality(workoutHistory),
        improvementAreas: this.identifyImprovementAreas(workoutHistory)
      }
    };
  }

  /**
   * Analyze user preferences from workout history
   * @param {Array} workoutHistory - Workout history
   * @param {Object} userMetadata - User metadata
   * @returns {Object} User preferences
   */
  analyzeUserPreferences(workoutHistory, userMetadata) {
    const completedWorkouts = workoutHistory.filter(w => w.status === 'completed');
    
    return {
      // Workout type preferences
      workoutTypes: this.analyzeWorkoutTypePreferences(completedWorkouts),
      
      // Equipment preferences
      equipment: this.analyzeEquipmentPreferences(completedWorkouts),
      
      // Duration preferences
      duration: this.analyzeDurationPreferences(completedWorkouts),
      
      // Intensity preferences
      intensity: this.analyzeIntensityPreferences(completedWorkouts),
      
      // Goal alignment
      goalAlignment: this.analyzeGoalAlignment(completedWorkouts, userMetadata),
      
      // Success factors
      successFactors: this.identifySuccessFactors(completedWorkouts)
    };
  }

  /**
   * Analyze progress tracking metrics
   * @param {Array} workoutHistory - Workout history
   * @returns {Object} Progress tracking analysis
   */
  analyzeProgressTracking(workoutHistory) {
    const completedWorkouts = workoutHistory.filter(w => w.status === 'completed');
    
    return {
      // Overall progress
      overallProgress: {
        progressScore: this.calculateOverallProgressScore(completedWorkouts),
        progressTrend: this.calculateProgressTrend(completedWorkouts),
        milestones: this.identifyMilestones(completedWorkouts)
      },
      
      // Specific improvements
      improvements: {
        endurance: this.trackEnduranceImprovement(completedWorkouts),
        strength: this.trackStrengthImprovement(completedWorkouts),
        consistency: this.trackConsistencyImprovement(completedWorkouts)
      },
      
      // Performance indicators
      indicators: {
        adaptationRate: this.calculateAdaptationRate(completedWorkouts),
        plateauDetection: this.detectPlateaus(completedWorkouts),
        breakthroughMoments: this.identifyBreakthroughs(completedWorkouts)
      }
    };
  }

  /**
   * Assess user risks based on patterns
   * @param {Array} workoutHistory - Workout history
   * @param {Object} userMetadata - User metadata
   * @returns {Object} Risk assessment
   */
  assessUserRisks(workoutHistory, userMetadata) {
    return {
      // Overtraining risk
      overtraining: {
        riskLevel: this.assessOvertrainingRisk(workoutHistory),
        indicators: this.identifyOvertrainingIndicators(workoutHistory),
        recommendations: this.generateOvertrainingRecommendations(workoutHistory)
      },
      
      // Injury risk
      injury: {
        riskLevel: this.assessInjuryRisk(workoutHistory, userMetadata),
        riskFactors: this.identifyInjuryRiskFactors(workoutHistory, userMetadata),
        preventionStrategies: this.generateInjuryPreventionStrategies(userMetadata)
      },
      
      // Burnout risk
      burnout: {
        riskLevel: this.assessBurnoutRisk(workoutHistory),
        earlyWarnings: this.identifyBurnoutWarnings(workoutHistory),
        mitigation: this.generateBurnoutMitigation(workoutHistory)
      },
      
      // Plateau risk
      plateau: {
        riskLevel: this.assessPlateauRisk(workoutHistory),
        indicators: this.identifyPlateauIndicators(workoutHistory),
        breakthroughStrategies: this.generateBreakthroughStrategies(workoutHistory)
      }
    };
  }

  /**
   * Generate personalization insights
   * @param {Array} workoutHistory - Workout history
   * @param {Object} userMetadata - User metadata
   * @returns {Object} Personalization insights
   */
  generatePersonalizationInsights(workoutHistory, userMetadata) {
    return {
      // Optimal workout characteristics
      optimalWorkout: {
        duration: this.calculateOptimalDuration(workoutHistory),
        intensity: this.calculateOptimalIntensity(workoutHistory),
        frequency: this.calculateOptimalFrequency(workoutHistory),
        type: this.calculateOptimalWorkoutType(workoutHistory)
      },
      
      // Personalization factors
      factors: {
        motivationDrivers: this.identifyMotivationDrivers(workoutHistory),
        preferredChallenges: this.identifyPreferredChallenges(workoutHistory),
        adaptationStyle: this.identifyAdaptationStyle(workoutHistory)
      },
      
      // Customization recommendations
      customization: {
        workoutStructure: this.recommendWorkoutStructure(workoutHistory),
        progressionStyle: this.recommendProgressionStyle(workoutHistory),
        feedbackPreferences: this.identifyFeedbackPreferences(workoutHistory)
      }
    };
  }

  /**
   * Generate analytics-based recommendations
   * @param {Array} workoutHistory - Workout history
   * @param {Object} userMetadata - User metadata
   * @returns {Object} Analytics recommendations
   */
  generateAnalyticsRecommendations(workoutHistory, userMetadata) {
    return {
      // Immediate recommendations
      immediate: {
        nextWorkoutType: this.recommendNextWorkoutType(workoutHistory),
        intensityAdjustment: this.recommendIntensityAdjustment(workoutHistory),
        durationAdjustment: this.recommendDurationAdjustment(workoutHistory)
      },
      
      // Short-term recommendations (1-2 weeks)
      shortTerm: {
        focusAreas: this.identifyFocusAreas(workoutHistory, userMetadata),
        varietyNeeds: this.assessVarietyNeeds(workoutHistory),
        recoveryNeeds: this.assessRecoveryNeeds(workoutHistory)
      },
      
      // Long-term recommendations (1+ months)
      longTerm: {
        goalRefinement: this.recommendGoalRefinement(workoutHistory, userMetadata),
        programStructure: this.recommendProgramStructure(workoutHistory),
        skillDevelopment: this.recommendSkillDevelopment(workoutHistory)
      },
      
      // Behavioral recommendations
      behavioral: {
        consistencyStrategies: this.recommendConsistencyStrategies(workoutHistory),
        motivationStrategies: this.recommendMotivationStrategies(workoutHistory),
        habitFormation: this.recommendHabitFormation(workoutHistory)
      }
    };
  }

  // Helper methods for calculations
  calculateExperienceLevel(totalWorkouts) {
    if (totalWorkouts < 10) return 'novice';
    if (totalWorkouts < 50) return 'beginner';
    if (totalWorkouts < 150) return 'intermediate';
    if (totalWorkouts < 300) return 'advanced';
    return 'expert';
  }

  calculateAverageWorkoutsPerWeek(workouts) {
    if (workouts.length < 2) return 0;
    
    const sortedWorkouts = workouts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const firstDate = new Date(sortedWorkouts[0].createdAt);
    const lastDate = new Date(sortedWorkouts[sortedWorkouts.length - 1].createdAt);
    
    const daysDiff = Math.max((lastDate - firstDate) / (1000 * 60 * 60 * 24), 1);
    const weeksDiff = daysDiff / 7;
    
    return workouts.length / weeksDiff;
  }

  calculateLongestStreak(workouts) {
    if (workouts.length === 0) return 0;
    
    const sortedWorkouts = workouts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let longestStreak = 1;
    let currentStreak = 1;
    
    for (let i = 1; i < sortedWorkouts.length; i++) {
      const prevDate = new Date(sortedWorkouts[i-1].createdAt);
      const currDate = new Date(sortedWorkouts[i].createdAt);
      const daysDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= 7) { // Within a week
        currentStreak++;
      } else {
        longestStreak = Math.max(longestStreak, currentStreak);
        currentStreak = 1;
      }
    }
    
    return Math.max(longestStreak, currentStreak);
  }

  calculateCurrentStreak(workouts) {
    if (workouts.length === 0) return 0;
    
    const sortedWorkouts = workouts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const now = new Date();
    let streak = 0;
    
    for (const workout of sortedWorkouts) {
      const workoutDate = new Date(workout.createdAt);
      const daysDiff = (now - workoutDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= 7) { // Within a week
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  assessDataQuality(workoutHistory) {
    const total = workoutHistory.length;
    if (total === 0) return 'no_data';
    
    const withFeedback = workoutHistory.filter(w => w.feedback).length;
    const completed = workoutHistory.filter(w => w.status === 'completed').length;
    
    const feedbackRate = withFeedback / total;
    const completionRate = completed / total;
    
    if (total >= 20 && feedbackRate >= 0.7 && completionRate >= 0.8) return 'high';
    if (total >= 10 && feedbackRate >= 0.5 && completionRate >= 0.6) return 'medium';
    if (total >= 5) return 'low';
    return 'insufficient';
  }

  getFallbackAnalytics(userId, userMetadata) {
    return {
      userProfile: {
        demographics: {
          age: userMetadata.age,
          gender: userMetadata.gender,
          fitnessLevel: userMetadata.fitnessLevel,
          experienceLevel: 'novice'
        },
        activityProfile: {
          totalWorkouts: 0,
          completedWorkouts: 0,
          completionRate: 0
        }
      },
      performanceMetrics: {
        completion: { totalRate: 0 },
        satisfaction: { averageRating: 3.5 }
      },
      recommendations: {
        immediate: {
          nextWorkoutType: 'full_body',
          intensityAdjustment: 0,
          durationAdjustment: 0
        }
      },
      metadata: {
        totalWorkouts: 0,
        analysisDate: new Date().toISOString(),
        dataQuality: 'no_data',
        isFallback: true
      }
    };
  }

  // Additional calculation methods would be implemented here...
  // (Implementing remaining methods for brevity)
}

module.exports = new UserAnalyticsService();
