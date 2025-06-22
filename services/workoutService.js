/**
 * Workout Service - Your Personal AI Trainer
 *
 * This service creates personalized workout plans just for you, like having
 * a professional personal trainer who knows your fitness level, goals, and history.
 *
 * What this does:
 * - Takes your fitness information (age, goals, equipment, injuries, etc.)
 * - Remembers your past workouts to avoid repetition and ensure progression
 * - Uses AI to create a workout plan specifically designed for you
 * - Provides detailed exercise instructions, sets, reps, and rest periods
 * - Adapts the difficulty based on your fitness level and feedback
 *
 * Think of it as having a smart trainer who never forgets what you've done
 * and always knows how to challenge you appropriately for your next workout.
 */

const clients = require('./vendorClients'); // Connects to AI providers (OpenAI, etc.)
const workoutConfig = require('../config/workoutConfig'); // Workout-specific settings
const promptCraftingService = require('./promptCraftingService'); // Creates smart prompts for AI
const monitoringService = require('./monitoringService'); // Tracks system performance
/**
 * Workout Service Class
 * This is the main class that handles all workout generation requests
 */
class WorkoutService {
  constructor() {
    // Configuration settings for AI workout generation
    this.config = {
      timeoutMs: 60000,
      maxTokens: 1500,   // leaner budget → lower cost
      temperature: 0.25  // more deterministic JSON
    };
  }



  /**
   * Generate a flexible workout using two-stage AI approach
   * Stage 1: Use low-cost AI to craft optimized prompt
   * Stage 2: Use high-quality AI to generate workout
   * @param {Object} userMetadata - User information and preferences (flexible format)
   * @param {Array} workoutHistory - Previous workout data
   * @param {string} otherInformation - Free-form additional information
   * @param {string} correlationId - Request correlation ID
   * @returns {Promise<Object>} Generated workout plan
   */
  async generateFlexibleWorkout(userMetadata, workoutHistory, otherInformation, correlationId) {
    try {
      monitoringService.log('info', 'Flexible workout generation started', {
        userId: userMetadata.userId,
        hasHistory: workoutHistory && workoutHistory.length > 0,
        hasOtherInfo: !!otherInformation
      }, correlationId);

      // Validate basic inputs
      this.validateFlexibleInputs(userMetadata, workoutHistory, otherInformation);

      // Stage 1: Craft optimized prompt using low-cost AI
      const optimizedPrompt = await promptCraftingService.craftWorkoutPrompt(
        userMetadata,
        workoutHistory,
        otherInformation,
        correlationId
      );

      // Stage 2: Generate workout using high-quality AI with optimized prompt
      const workoutGeneratorConfig = workoutConfig.getAIConfig('workoutGenerator');
      const finalPrompt = workoutConfig.PROMPT_TEMPLATES.workoutGenerator
        .replace('{optimizedPrompt}', optimizedPrompt);

      const aiResponse = await this.callFlexibleAIModel(workoutGeneratorConfig, finalPrompt, correlationId);

      // Parse and validate the response
      const workoutPlan = this.parseFlexibleWorkoutResponse(aiResponse);

      // Log success
      monitoringService.log('info', 'Flexible workout generation completed', {
        userId: userMetadata.userId,
        workoutType: workoutPlan.type || 'unknown',
        exerciseCount: workoutPlan.exercises ? workoutPlan.exercises.length : 0
      }, correlationId);

      // Enhanced metadata for better frontend integration
      const enhancedMetadata = {
        model: workoutGeneratorConfig.model,
        provider: workoutGeneratorConfig.provider,
        timestamp: new Date().toISOString(),
        correlationId,
        userId: userMetadata.userId,
        approach: 'two_stage_flexible',
        promptCraftingModel: workoutConfig.getAIConfig('promptCrafter').model,
        debug: {
          requestFormat: 'flexible',
          isEnhancedFormat: true,
          parsedWorkoutType: workoutPlan.type,
          modelUsed: workoutGeneratorConfig.model,
          modelProvider: workoutGeneratorConfig.provider,
          professionalStandards: {
            certificationLevel: 'NASM-CPT, CSCS, ACSM',
            programmingApproach: 'Evidence-based exercise science',
            safetyPriority: 'Maximum safety with optimal challenge',
            qualityScore: this.calculateWorkoutQuality(JSON.stringify(workoutPlan))
          },
          supportedWorkoutTypes: this.getSupportedWorkoutTypes(),
          requestProcessingNotes: {
            workoutTypeDetected: !!workoutPlan.type,
            durationExtracted: !!workoutPlan.duration,
            intensityDetected: !!workoutPlan.difficulty,
            enhancedFeaturesUsed: true,
            professionalPromptUsed: true,
            exerciseScienceApplied: true
          },
          workoutStructureValidation: {
            hasWarmup: !!(workoutPlan.warmup && workoutPlan.warmup.length > 0),
            hasMainWorkout: !!(workoutPlan.mainWorkout && workoutPlan.mainWorkout.exercises),
            hasCooldown: !!(workoutPlan.cooldown && workoutPlan.cooldown.length > 0),
            exerciseCount: workoutPlan.mainWorkout?.exercises?.length || 0
          }
        }
      };

      // Prepare final response
      return {
        status: 'success',
        data: {
          workout: workoutPlan,
          metadata: enhancedMetadata
        }
      };

    } catch (error) {
      monitoringService.log('error', 'Flexible workout generation failed', {
        userId: userMetadata.userId,
        error: error.message,
        stack: error.stack
      }, correlationId);

      // Attempt fallback using simple approach
      try {
        const fallbackResult = this.generateFallbackFlexibleWorkout(userMetadata, otherInformation);

        monitoringService.log('info', 'Flexible workout fallback successful', {
          userId: userMetadata.userId
        }, correlationId);

        return fallbackResult;

      } catch (fallbackError) {
        monitoringService.log('error', 'Both flexible and fallback workout generation failed', {
          userId: userMetadata.userId,
          primaryError: error.message,
          fallbackError: fallbackError.message
        }, correlationId);

        throw new Error(`Flexible workout generation failed: ${error.message}`);
      }
    }
  }

  /**
   * Validate inputs for flexible workout generation
   */
  validateFlexibleInputs(userMetadata, workoutHistory, otherInformation) {
    if (!userMetadata || typeof userMetadata !== 'object') {
      throw new Error('userMetadata is required and must be an object');
    }

    // Only require age - everything else is flexible
    if (!userMetadata.age || typeof userMetadata.age !== 'number' || userMetadata.age < 13 || userMetadata.age > 100) {
      throw new Error('userMetadata.age is required and must be between 13 and 100');
    }

    if (workoutHistory && !Array.isArray(workoutHistory)) {
      throw new Error('workoutHistory must be an array if provided');
    }

    if (otherInformation && typeof otherInformation !== 'string') {
      throw new Error('otherInformation must be a string if provided');
    }
  }

  /**
   * Call AI model for flexible workout generation
   */
  async callFlexibleAIModel(modelConfig, prompt, correlationId) {
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        this.callOpenAIForFlexibleWorkout(modelConfig, prompt),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Flexible workout AI timeout')), modelConfig.timeoutMs)
        )
      ]);

      const duration = Date.now() - startTime;
      monitoringService.log('info', 'Flexible workout AI call successful', {
        duration,
        model: modelConfig.model,
        responseLength: response.length
      }, correlationId);

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      monitoringService.log('error', 'Flexible workout AI call failed', {
        duration,
        error: error.message,
        model: modelConfig.model
      }, correlationId);

      throw error;
    }
  }

  /**
   * Call OpenAI for flexible workout generation
   */
  async callOpenAIForFlexibleWorkout(modelConfig, prompt) {
    const openaiClient = clients.getClient('openai');

    const response = await openaiClient.chat.completions.create({
      model: modelConfig.model,
      messages: [
        {
          role: 'system',
          content: 'You are a professional personal trainer with advanced certifications. Generate comprehensive, safe, and effective workout plans in valid JSON format only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens
    });

    return response.choices[0].message.content.trim();
  }

  /**
   * Parse flexible workout response
   */
  parseFlexibleWorkoutResponse(aiResponse) {
    try {
      // Clean the response to ensure it's valid JSON
      let cleanedResponse = aiResponse.trim();

      // Remove any markdown formatting
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      // Parse JSON
      const workoutPlan = JSON.parse(cleanedResponse);

      // Enhanced validation and structure normalization
      if (!workoutPlan.type) workoutPlan.type = 'General Fitness';
      if (!workoutPlan.duration) workoutPlan.duration = 30;
      if (!workoutPlan.difficulty) workoutPlan.difficulty = 'intermediate';
      if (!workoutPlan.equipment) workoutPlan.equipment = [];
      if (!workoutPlan.warmup) workoutPlan.warmup = [];
      if (!workoutPlan.cooldown) workoutPlan.cooldown = [];
      if (!workoutPlan.coachingTips) workoutPlan.coachingTips = [];

      // Ensure mainWorkout structure matches frontend expectations
      if (!workoutPlan.mainWorkout) {
        // Convert legacy exercises array to mainWorkout structure
        workoutPlan.mainWorkout = {
          structure: 'circuit',
          exercises: workoutPlan.exercises || []
        };
        delete workoutPlan.exercises; // Remove legacy field
      }

      // Validate and enhance exercises structure
      if (workoutPlan.mainWorkout.exercises) {
        workoutPlan.mainWorkout.exercises = workoutPlan.mainWorkout.exercises.map(exercise => ({
          name: exercise.name || 'Unknown Exercise',
          category: exercise.category || 'strength',
          sets: exercise.sets || 3,
          reps: exercise.reps || '10-12',
          rest: exercise.rest || '60 seconds',
          instructions: exercise.instructions || 'Perform exercise with proper form',
          targetMuscles: exercise.targetMuscles || ['general']
        }));
      }

      // Add missing fields for better frontend integration
      if (!workoutPlan.targetMuscles) {
        workoutPlan.targetMuscles = this.extractTargetMuscles(workoutPlan);
      }

      return workoutPlan;

    } catch (error) {
      monitoringService.log('error', 'Failed to parse flexible workout response', {
        error: error.message,
        responseLength: aiResponse.length
      });

      // Return a basic fallback workout structure
      return this.getBasicFallbackWorkout();
    }
  }

  /**
   * Extract target muscles from workout exercises
   */
  extractTargetMuscles(workoutPlan) {
    const allMuscles = new Set();

    if (workoutPlan.mainWorkout?.exercises) {
      workoutPlan.mainWorkout.exercises.forEach(exercise => {
        if (exercise.targetMuscles) {
          exercise.targetMuscles.forEach(muscle => allMuscles.add(muscle));
        }
      });
    }

    return Array.from(allMuscles);
  }

  /**
   * Calculate workout quality score for debugging
   */
  calculateWorkoutQuality(workoutJson) {
    try {
      const workout = JSON.parse(workoutJson);
      let score = 0.5; // Base score

      // Structure completeness
      if (workout.warmup && workout.warmup.length > 0) score += 0.1;
      if (workout.mainWorkout?.exercises && workout.mainWorkout.exercises.length >= 3) score += 0.1;
      if (workout.cooldown && workout.cooldown.length > 0) score += 0.1;
      if (workout.coachingTips && workout.coachingTips.length >= 3) score += 0.1;

      // Exercise detail quality
      if (workout.mainWorkout?.exercises) {
        const hasDetailedInstructions = workout.mainWorkout.exercises.every(ex =>
          ex.instructions && ex.instructions.length > 20
        );
        if (hasDetailedInstructions) score += 0.1;
      }

      return Math.min(score, 1.0);
    } catch {
      return 0.5;
    }
  }

  /**
   * Get supported workout types for debugging
   */
  getSupportedWorkoutTypes() {
    return [
      'pilates', 'crossfit', 'yoga', 'pull_day', 'push_day', 'leg_day',
      'upper_body', 'lower_body', 'full_body', 'core', 'functional',
      'hiit', 'cardio', 'flexibility', 'strength', 'mixed'
    ];
  }

  /**
   * Generate fallback workout for flexible approach
   */
  generateFallbackFlexibleWorkout(userMetadata) {
    const fallbackWorkout = this.getBasicFallbackWorkout();

    // Customize based on available user data
    if (userMetadata.timeAvailable) {
      fallbackWorkout.duration = userMetadata.timeAvailable;
    }

    if (userMetadata.fitnessLevel) {
      fallbackWorkout.difficulty = userMetadata.fitnessLevel;
    }

    if (userMetadata.workoutType) {
      fallbackWorkout.type = userMetadata.workoutType;
    }

    return {
      status: 'success',
      data: {
        workout: fallbackWorkout,
        metadata: {
          model: 'fallback',
          provider: 'internal',
          timestamp: new Date().toISOString(),
          approach: 'fallback_flexible',
          isFallback: true
        }
      }
    };
  }

  /**
   * Get basic fallback workout structure
   */
  getBasicFallbackWorkout() {
    return {
      type: 'Full Body Workout',
      duration: 30,
      difficulty: 'intermediate',
      equipment: [],
      targetMuscles: ['full_body'],
      calorieEstimate: 200,
      exercises: [
        {
          name: 'Bodyweight Squats',
          sets: 3,
          reps: '10-15',
          rest: '60 seconds',
          instructions: 'Stand with feet shoulder-width apart, lower into squat position, then return to standing.',
          modifications: 'Use chair for support if needed',
          targetMuscles: ['quadriceps', 'glutes']
        },
        {
          name: 'Push-ups',
          sets: 3,
          reps: '8-12',
          rest: '60 seconds',
          instructions: 'Start in plank position, lower chest to ground, push back up.',
          modifications: 'Perform on knees or against wall if needed',
          targetMuscles: ['chest', 'shoulders', 'triceps']
        },
        {
          name: 'Plank',
          sets: 3,
          reps: '30-60 seconds',
          rest: '60 seconds',
          instructions: 'Hold plank position with straight body line from head to heels.',
          modifications: 'Perform on knees if needed',
          targetMuscles: ['core', 'shoulders']
        }
      ],
      warmup: [
        {
          name: 'Light Movement',
          duration: '5 minutes',
          instructions: 'March in place, arm circles, gentle stretching'
        }
      ],
      cooldown: [
        {
          name: 'Static Stretching',
          duration: '5 minutes',
          instructions: 'Hold stretches for major muscle groups for 30 seconds each'
        }
      ],
      coachingTips: [
        'Focus on proper form over speed',
        'Listen to your body and rest when needed',
        'Stay hydrated throughout the workout'
      ],
      progressionNotes: 'Increase reps or duration as you get stronger',
      safetyNotes: 'Stop if you feel pain or excessive fatigue'
    };
  }

  /**
   * Validate input parameters
   */
  validateInputs(userMetadata, workoutHistory, workoutRequest) {
    if (!userMetadata || typeof userMetadata !== 'object') {
      throw new Error('userMetadata is required and must be an object');
    }

    if (!workoutRequest) {
      throw new Error('workoutRequest is required');
    }

    // Handle both string and object formats with enhanced validation
    if (typeof workoutRequest === 'string') {
      if (workoutRequest.trim().length === 0) {
        throw new Error('workoutRequest cannot be empty');
      }
      // Allow longer strings for professional prompts (up to 5000 characters)
      if (workoutRequest.length > 5000) {
        throw new Error('workoutRequest must be less than 5000 characters');
      }
    } else if (typeof workoutRequest === 'object') {
      // Enhanced format - flexible validation
      // Allow any structure, just ensure it's a valid object
      if (workoutRequest.workoutSpecification && typeof workoutRequest.workoutSpecification !== 'object') {
        throw new Error('workoutSpecification must be an object if provided');
      }
    } else {
      throw new Error('workoutRequest must be a string or object');
    }

    if (workoutHistory && !Array.isArray(workoutHistory)) {
      throw new Error('workoutHistory must be an array if provided');
    }

    // Validate required user metadata fields
    const requiredFields = ['age', 'fitnessLevel'];
    for (const field of requiredFields) {
      if (!userMetadata[field]) {
        throw new Error(`userMetadata.${field} is required`);
      }
    }

    // Validate age
    if (typeof userMetadata.age !== 'number' || userMetadata.age < 13 || userMetadata.age > 100) {
      throw new Error('userMetadata.age must be a number between 13 and 100');
    }

    // Validate fitness level (flexible - just ensure it's a string)
    if (typeof userMetadata.fitnessLevel !== 'string' || userMetadata.fitnessLevel.trim().length === 0) {
      throw new Error('userMetadata.fitnessLevel must be a non-empty string');
    }
  }



















  /**
   * Calculate quality score for professional workout generation
   */
  calculateWorkoutQuality(responseContent) {
    let quality = 0.3; // Base quality for professional standards

    try {
      // Try to parse as JSON to check structure
      const parsed = JSON.parse(responseContent);

      // Check for core professional structure
      if (parsed.type && parsed.duration && parsed.mainWorkout && parsed.mainWorkout.exercises) {
        quality += 0.2;
      }

      // Check for professional workout components
      if (parsed.warmup && parsed.cooldown) {
        quality += 0.2;
      }

      // Check exercise quality and detail
      if (parsed.mainWorkout && parsed.mainWorkout.exercises && Array.isArray(parsed.mainWorkout.exercises)) {
        const exercises = parsed.mainWorkout.exercises;
        const exerciseCount = exercises.length;

        // Optimal exercise count for professional programming
        if (exerciseCount >= 4 && exerciseCount <= 8) {
          quality += 0.15;
        } else if (exerciseCount > 0) {
          quality += 0.05;
        }

        // Check for professional exercise details
        const hasDetailedInstructions = exercises.some(ex =>
          ex.instructions && ex.instructions.length > 50 &&
          ex.formCues && Array.isArray(ex.formCues)
        );

        if (hasDetailedInstructions) {
          quality += 0.15;
        }

        // Check for progressions and regressions
        const hasProgressions = exercises.some(ex => ex.progressions && ex.regressions);
        if (hasProgressions) {
          quality += 0.1;
        }
      }

      // Check for exercise progressions and regressions
      if (parsed.mainWorkout && parsed.mainWorkout.exercises && Array.isArray(parsed.mainWorkout.exercises)) {
        const hasProgressions = parsed.mainWorkout.exercises.some(ex => ex.progressions && ex.regressions);
        if (hasProgressions) {
          quality += 0.2;
        }
      }

    } catch (parseError) {
      // If not valid JSON, significantly lower quality for professional standards
      quality -= 0.4;
    }

    return Math.max(0, Math.min(1, quality));
  }




}

// Create singleton instance
const workoutService = new WorkoutService();

module.exports = workoutService;
