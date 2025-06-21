const progressiveOverloadService = require('./progressiveOverloadService');
const userAnalyticsService = require('./userAnalyticsService');
const monitoringService = require('./monitoringService');

/**
 * Workout Personalization Service
 * Integrates progressive overload, user analytics, and intelligent personalization
 */
class WorkoutPersonalizationService {
  constructor() {
    this.personalizationWeights = {
      progressiveOverload: 0.35,
      userPreferences: 0.25,
      performanceHistory: 0.20,
      riskAssessment: 0.15,
      goalAlignment: 0.05
    };

    this.fallbackStrategies = {
      newUser: 'conservative_foundation',
      dataInsufficient: 'preference_based',
      highRisk: 'safety_first',
      plateau: 'variety_focused'
    };
  }

  /**
   * Generate comprehensive workout personalization
   * @param {string} userId - User ID
   * @param {Object} userMetadata - User metadata
   * @param {string} workoutType - Requested workout type
   * @param {Object} workoutSpecification - Workout specification
   * @returns {Promise<Object>} Personalized workout configuration
   */
  async personalizeWorkout(userId, userMetadata, workoutType, workoutSpecification) {
    const correlationId = `personalization-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Get progressive overload analysis
      const progressiveOverload = await progressiveOverloadService.analyzeProgressiveOverload(
        userId, 
        userMetadata, 
        workoutType
      );

      // Get comprehensive user analytics
      const userAnalytics = await userAnalyticsService.processUserAnalytics(userId, userMetadata);

      // Generate personalized configuration
      const personalization = this.generatePersonalizedConfiguration(
        progressiveOverload,
        userAnalytics,
        userMetadata,
        workoutType,
        workoutSpecification
      );

      // Apply safety filters
      const safePersonalization = this.applySafetyFilters(personalization, userAnalytics);

      // Generate enhanced prompt modifications
      const promptEnhancements = this.generatePromptEnhancements(safePersonalization, userAnalytics);

      // Create response structure
      const result = {
        personalization: safePersonalization,
        promptEnhancements,
        analytics: {
          progressiveOverload: progressiveOverload.recommendations,
          userInsights: userAnalytics.personalizationInsights,
          riskAssessment: userAnalytics.riskAssessment
        },
        metadata: {
          personalizationConfidence: this.calculatePersonalizationConfidence(userAnalytics),
          dataQuality: userAnalytics.metadata.dataQuality,
          fallbackStrategy: this.determineFallbackStrategy(userAnalytics),
          correlationId
        }
      };

      monitoringService.log('info', 'Workout personalization completed', {
        userId,
        workoutType,
        confidence: result.metadata.personalizationConfidence,
        dataQuality: result.metadata.dataQuality
      }, correlationId);

      return result;

    } catch (error) {
      monitoringService.log('error', 'Workout personalization failed', {
        userId,
        workoutType,
        error: error.message
      }, correlationId);

      return this.getFallbackPersonalization(userId, userMetadata, workoutType, workoutSpecification);
    }
  }

  /**
   * Generate personalized workout configuration
   * @param {Object} progressiveOverload - Progressive overload analysis
   * @param {Object} userAnalytics - User analytics
   * @param {Object} userMetadata - User metadata
   * @param {string} workoutType - Workout type
   * @param {Object} workoutSpecification - Workout specification
   * @returns {Object} Personalized configuration
   */
  generatePersonalizedConfiguration(progressiveOverload, userAnalytics, userMetadata, workoutType, workoutSpecification) {
    const baseConfig = this.createBaseConfiguration(userMetadata, workoutSpecification);
    
    return {
      // Duration personalization
      duration: this.personalizeDuration(baseConfig, progressiveOverload, userAnalytics),
      
      // Intensity personalization
      intensity: this.personalizeIntensity(baseConfig, progressiveOverload, userAnalytics),
      
      // Volume personalization
      volume: this.personalizeVolume(baseConfig, progressiveOverload, userAnalytics),
      
      // Exercise selection personalization
      exerciseSelection: this.personalizeExerciseSelection(baseConfig, userAnalytics, workoutType),
      
      // Structure personalization
      structure: this.personalizeWorkoutStructure(baseConfig, userAnalytics),
      
      // Progression personalization
      progression: this.personalizeProgression(progressiveOverload, userAnalytics),
      
      // Recovery personalization
      recovery: this.personalizeRecovery(userAnalytics, userMetadata),
      
      // Motivation personalization
      motivation: this.personalizeMotivation(userAnalytics),
      
      // Safety personalization
      safety: this.personalizeSafety(userAnalytics, userMetadata)
    };
  }

  /**
   * Create base configuration from user metadata
   * @param {Object} userMetadata - User metadata
   * @param {Object} workoutSpecification - Workout specification
   * @returns {Object} Base configuration
   */
  createBaseConfiguration(userMetadata, workoutSpecification) {
    return {
      duration: workoutSpecification.duration || userMetadata.minutesPerSession || 30,
      intensity: this.mapFitnessLevelToIntensity(userMetadata.fitnessLevel),
      equipment: userMetadata.equipment || [],
      injuries: userMetadata.injuries || [],
      goals: userMetadata.goals || [],
      age: userMetadata.age,
      gender: userMetadata.gender,
      weight: userMetadata.weight,
      daysPerWeek: userMetadata.daysPerWeek || 3
    };
  }

  /**
   * Personalize workout duration
   * @param {Object} baseConfig - Base configuration
   * @param {Object} progressiveOverload - Progressive overload analysis
   * @param {Object} userAnalytics - User analytics
   * @returns {Object} Duration personalization
   */
  personalizeDuration(baseConfig, progressiveOverload, userAnalytics) {
    const baseDuration = baseConfig.duration;
    const preferences = userAnalytics.preferences?.duration;
    const performance = userAnalytics.performanceMetrics?.duration;
    
    let adjustedDuration = baseDuration;
    let reasoning = [];

    // Apply progressive overload duration adjustment
    if (progressiveOverload.recommendations.shouldProgress) {
      const durationIncrease = progressiveOverload.recommendations.durationRecommendation - baseDuration;
      if (durationIncrease > 0) {
        adjustedDuration += Math.min(durationIncrease, baseDuration * 0.15); // Max 15% increase
        reasoning.push('Progressive overload suggests duration increase');
      }
    }

    // Apply user preference adjustments
    if (preferences?.optimal && Math.abs(preferences.optimal - baseDuration) > 5) {
      const preferenceWeight = 0.3;
      adjustedDuration = adjustedDuration * (1 - preferenceWeight) + preferences.optimal * preferenceWeight;
      reasoning.push('Adjusted based on user duration preferences');
    }

    // Apply performance-based adjustments
    if (performance?.consistency < 0.7 && adjustedDuration > baseDuration) {
      adjustedDuration = Math.max(baseDuration, adjustedDuration * 0.9);
      reasoning.push('Reduced duration due to consistency concerns');
    }

    return {
      recommended: Math.round(adjustedDuration),
      original: baseDuration,
      adjustment: Math.round(adjustedDuration - baseDuration),
      reasoning,
      confidence: this.calculateDurationConfidence(userAnalytics)
    };
  }

  /**
   * Personalize workout intensity
   * @param {Object} baseConfig - Base configuration
   * @param {Object} progressiveOverload - Progressive overload analysis
   * @param {Object} userAnalytics - User analytics
   * @returns {Object} Intensity personalization
   */
  personalizeIntensity(baseConfig, progressiveOverload, userAnalytics) {
    const baseIntensity = baseConfig.intensity;
    const difficultyAnalysis = userAnalytics.performanceMetrics?.difficulty;
    const riskAssessment = userAnalytics.riskAssessment;
    
    let intensityModifier = 1.0;
    let reasoning = [];

    // Apply progressive overload intensity adjustment
    if (progressiveOverload.recommendations.shouldProgress) {
      intensityModifier += progressiveOverload.recommendations.intensityAdjustment;
      reasoning.push('Progressive overload suggests intensity increase');
    }

    // Apply difficulty-based adjustments
    if (difficultyAnalysis?.distribution) {
      const tooEasyPercentage = difficultyAnalysis.distribution.percentages?.too_easy || 0;
      const tooHardPercentage = difficultyAnalysis.distribution.percentages?.too_hard || 0;
      
      if (tooEasyPercentage > 40) {
        intensityModifier += 0.1;
        reasoning.push('Increased intensity - workouts reported as too easy');
      } else if (tooHardPercentage > 30) {
        intensityModifier -= 0.1;
        reasoning.push('Decreased intensity - workouts reported as too hard');
      }
    }

    // Apply risk-based adjustments
    if (riskAssessment?.overtraining?.riskLevel === 'high') {
      intensityModifier = Math.min(intensityModifier, 0.9);
      reasoning.push('Reduced intensity due to overtraining risk');
    }

    if (riskAssessment?.injury?.riskLevel === 'high') {
      intensityModifier = Math.min(intensityModifier, 0.85);
      reasoning.push('Reduced intensity due to injury risk');
    }

    // Calculate final intensity
    const finalIntensity = this.clampIntensity(baseIntensity * intensityModifier);

    return {
      recommended: finalIntensity,
      original: baseIntensity,
      modifier: intensityModifier,
      reasoning,
      confidence: this.calculateIntensityConfidence(userAnalytics)
    };
  }

  /**
   * Personalize workout volume
   * @param {Object} baseConfig - Base configuration
   * @param {Object} progressiveOverload - Progressive overload analysis
   * @param {Object} userAnalytics - User analytics
   * @returns {Object} Volume personalization
   */
  personalizeVolume(baseConfig, progressiveOverload, userAnalytics) {
    let volumeModifier = 1.0;
    let reasoning = [];

    // Apply progressive overload volume adjustment
    if (progressiveOverload.recommendations.shouldProgress) {
      volumeModifier += progressiveOverload.recommendations.volumeAdjustment;
      reasoning.push('Progressive overload suggests volume increase');
    }

    // Apply performance-based adjustments
    const completionRate = userAnalytics.performanceMetrics?.completion?.totalRate || 0;
    if (completionRate < 0.7) {
      volumeModifier = Math.min(volumeModifier, 0.9);
      reasoning.push('Reduced volume due to low completion rate');
    }

    // Apply recovery-based adjustments
    const recoveryNeeds = userAnalytics.recommendations?.shortTerm?.recoveryNeeds;
    if (recoveryNeeds === 'high') {
      volumeModifier *= 0.85;
      reasoning.push('Reduced volume for better recovery');
    }

    return {
      modifier: Math.max(0.7, Math.min(1.3, volumeModifier)), // Clamp between 70% and 130%
      reasoning,
      confidence: this.calculateVolumeConfidence(userAnalytics)
    };
  }

  /**
   * Personalize exercise selection
   * @param {Object} baseConfig - Base configuration
   * @param {Object} userAnalytics - User analytics
   * @param {string} workoutType - Workout type
   * @returns {Object} Exercise selection personalization
   */
  personalizeExerciseSelection(baseConfig, userAnalytics, workoutType) {
    const preferences = userAnalytics.preferences;
    const injuries = baseConfig.injuries;
    
    return {
      // Preferred exercise types
      preferredTypes: preferences?.workoutTypes?.top3 || [],
      
      // Equipment preferences
      preferredEquipment: preferences?.equipment?.mostUsed || baseConfig.equipment,
      
      // Injury modifications
      injuryModifications: this.generateInjuryModifications(injuries),
      
      // Variety needs
      varietyLevel: this.calculateVarietyLevel(userAnalytics),
      
      // Complexity level
      complexityLevel: this.calculateComplexityLevel(userAnalytics),
      
      // Focus areas
      focusAreas: userAnalytics.recommendations?.shortTerm?.focusAreas || []
    };
  }

  /**
   * Personalize workout structure
   * @param {Object} baseConfig - Base configuration
   * @param {Object} userAnalytics - User analytics
   * @returns {Object} Structure personalization
   */
  personalizeWorkoutStructure(baseConfig, userAnalytics) {
    const duration = baseConfig.duration;
    const preferences = userAnalytics.personalizationInsights?.customization?.workoutStructure;
    
    return {
      warmupDuration: this.calculateOptimalWarmup(duration, userAnalytics),
      cooldownDuration: this.calculateOptimalCooldown(duration, userAnalytics),
      mainWorkoutStructure: preferences?.structure || 'balanced',
      restPeriods: this.personalizeRestPeriods(userAnalytics),
      exerciseOrder: preferences?.exerciseOrder || 'compound_first'
    };
  }

  /**
   * Generate prompt enhancements for AI workout generation
   * @param {Object} personalization - Personalization configuration
   * @param {Object} userAnalytics - User analytics
   * @returns {Object} Prompt enhancements
   */
  generatePromptEnhancements(personalization, userAnalytics) {
    return {
      // Intensity guidance
      intensityGuidance: this.generateIntensityGuidance(personalization.intensity),
      
      // Volume guidance
      volumeGuidance: this.generateVolumeGuidance(personalization.volume),
      
      // Exercise selection guidance
      exerciseGuidance: this.generateExerciseGuidance(personalization.exerciseSelection),
      
      // Structure guidance
      structureGuidance: this.generateStructureGuidance(personalization.structure),
      
      // Progression guidance
      progressionGuidance: this.generateProgressionGuidance(personalization.progression),
      
      // Safety guidance
      safetyGuidance: this.generateSafetyGuidance(personalization.safety),
      
      // Motivation guidance
      motivationGuidance: this.generateMotivationGuidance(personalization.motivation),
      
      // User context
      userContext: this.generateUserContext(userAnalytics)
    };
  }

  /**
   * Apply safety filters to personalization
   * @param {Object} personalization - Personalization configuration
   * @param {Object} userAnalytics - User analytics
   * @returns {Object} Safety-filtered personalization
   */
  applySafetyFilters(personalization, userAnalytics) {
    const safePersonalization = { ...personalization };
    const riskAssessment = userAnalytics.riskAssessment;

    // Apply overtraining safety filters
    if (riskAssessment?.overtraining?.riskLevel === 'high') {
      safePersonalization.intensity.recommended = Math.min(
        safePersonalization.intensity.recommended, 
        0.7
      );
      safePersonalization.volume.modifier = Math.min(
        safePersonalization.volume.modifier, 
        0.8
      );
    }

    // Apply injury safety filters
    if (riskAssessment?.injury?.riskLevel === 'high') {
      safePersonalization.intensity.recommended = Math.min(
        safePersonalization.intensity.recommended, 
        0.6
      );
      safePersonalization.exerciseSelection.complexityLevel = 'basic';
    }

    // Apply burnout safety filters
    if (riskAssessment?.burnout?.riskLevel === 'high') {
      safePersonalization.duration.recommended = Math.min(
        safePersonalization.duration.recommended,
        safePersonalization.duration.original * 0.9
      );
      safePersonalization.motivation.focusArea = 'enjoyment';
    }

    return safePersonalization;
  }

  // Helper methods
  mapFitnessLevelToIntensity(fitnessLevel) {
    const intensityMap = {
      'beginner': 0.5,
      'intermediate': 0.7,
      'advanced': 0.85
    };
    return intensityMap[fitnessLevel] || 0.6;
  }

  clampIntensity(intensity) {
    return Math.max(0.3, Math.min(1.0, intensity));
  }

  calculatePersonalizationConfidence(userAnalytics) {
    const dataQuality = userAnalytics.metadata.dataQuality;
    const qualityScores = {
      'high': 0.9,
      'medium': 0.7,
      'low': 0.5,
      'insufficient': 0.3,
      'no_data': 0.2
    };
    return qualityScores[dataQuality] || 0.4;
  }

  determineFallbackStrategy(userAnalytics) {
    const totalWorkouts = userAnalytics.metadata.totalWorkouts;
    const dataQuality = userAnalytics.metadata.dataQuality;
    
    if (totalWorkouts === 0) return this.fallbackStrategies.newUser;
    if (dataQuality === 'insufficient' || dataQuality === 'low') return this.fallbackStrategies.dataInsufficient;
    if (userAnalytics.riskAssessment?.overtraining?.riskLevel === 'high') return this.fallbackStrategies.highRisk;
    if (userAnalytics.riskAssessment?.plateau?.riskLevel === 'high') return this.fallbackStrategies.plateau;
    
    return 'data_driven';
  }

  getFallbackPersonalization(userId, userMetadata, workoutType, workoutSpecification) {
    return {
      personalization: {
        duration: {
          recommended: userMetadata.minutesPerSession || 30,
          original: userMetadata.minutesPerSession || 30,
          adjustment: 0,
          reasoning: ['Using default duration - insufficient data'],
          confidence: 0.3
        },
        intensity: {
          recommended: this.mapFitnessLevelToIntensity(userMetadata.fitnessLevel),
          original: this.mapFitnessLevelToIntensity(userMetadata.fitnessLevel),
          modifier: 1.0,
          reasoning: ['Using fitness level-based intensity'],
          confidence: 0.5
        },
        volume: {
          modifier: 1.0,
          reasoning: ['Using standard volume'],
          confidence: 0.4
        }
      },
      promptEnhancements: {
        intensityGuidance: 'Use moderate intensity appropriate for fitness level',
        volumeGuidance: 'Use standard workout volume',
        exerciseGuidance: 'Focus on fundamental exercises with proper form'
      },
      metadata: {
        personalizationConfidence: 0.3,
        dataQuality: 'insufficient',
        fallbackStrategy: 'conservative_foundation',
        isFallback: true
      }
    };
  }

  // Additional helper methods would be implemented here...
  // (Implementing remaining calculation methods for brevity)
}

module.exports = new WorkoutPersonalizationService();
