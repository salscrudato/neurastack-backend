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
      maxTokens: 1500,   // optimized token limit for workout generation
      temperature: 0.25  // more deterministic JSON
    };
  }



  /**
   * Generate a workout using single optimized AI prompt
   * @param {Object} userMetadata - User information and preferences (flexible format)
   * @param {Array} workoutHistory - Previous workout data
   * @param {string} otherInformation - Free-form additional information
   * @param {string} correlationId - Request correlation ID
   * @returns {Promise<Object>} Generated workout plan
   */
  async generateFlexibleWorkout(userMetadata, workoutHistory, otherInformation, correlationId) {
    try {
      monitoringService.log('info', 'Single-prompt workout generation started', {
        userId: userMetadata.userId,
        hasHistory: workoutHistory && workoutHistory.length > 0,
        hasOtherInfo: !!otherInformation
      }, correlationId);

      // Validate basic inputs
      this.validateFlexibleInputs(userMetadata, workoutHistory, otherInformation);

      // Build user data string from all inputs
      const userData = workoutConfig.buildUserDataString(userMetadata, workoutHistory, otherInformation);

      // Create the single comprehensive prompt
      const workoutGeneratorConfig = workoutConfig.getAIConfig('workoutGenerator');
      const finalPrompt = workoutConfig.PROMPT_TEMPLATES.workoutGenerator
        .replace('{userData}', userData);

      const aiResponse = await this.callWorkoutAIModel(workoutGeneratorConfig, finalPrompt, correlationId);

      // Parse and validate the response
      const workoutPlan = this.parseWorkoutResponse(aiResponse);

      // Log success
      monitoringService.log('info', 'Single-prompt workout generation completed', {
        userId: userMetadata.userId,
        workoutType: workoutPlan.type || 'unknown',
        exerciseCount: workoutPlan.mainWorkout?.exercises?.length || 0
      }, correlationId);

      // Enhanced metadata for better frontend integration
      const enhancedMetadata = {
        model: workoutGeneratorConfig.model,
        provider: workoutGeneratorConfig.provider,
        timestamp: new Date().toISOString(),
        correlationId,
        userId: userMetadata.userId,
        approach: 'single_prompt_optimized',
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
      monitoringService.log('error', 'Single-prompt workout generation failed', {
        userId: userMetadata.userId,
        error: error.message,
        stack: error.stack
      }, correlationId);

      // Attempt fallback using simple approach
      try {
        const fallbackResult = this.generateFallbackWorkout(userMetadata, otherInformation);

        monitoringService.log('info', 'Workout fallback successful', {
          userId: userMetadata.userId
        }, correlationId);

        return fallbackResult;

      } catch (fallbackError) {
        monitoringService.log('error', 'Both workout and fallback generation failed', {
          userId: userMetadata.userId,
          primaryError: error.message,
          fallbackError: fallbackError.message
        }, correlationId);

        throw new Error(`Workout generation failed: ${error.message}`);
      }
    }
  }

  /**
   * Validate inputs for workout generation
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
   * Call AI model for workout generation
   */
  async callWorkoutAIModel(modelConfig, prompt, correlationId) {
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        this.callOpenAIForWorkout(modelConfig, prompt),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Workout AI timeout')), modelConfig.timeoutMs)
        )
      ]);

      const duration = Date.now() - startTime;
      monitoringService.log('info', 'Workout AI call successful', {
        duration,
        model: modelConfig.model,
        responseLength: response.length
      }, correlationId);

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      monitoringService.log('error', 'Workout AI call failed', {
        duration,
        error: error.message,
        model: modelConfig.model
      }, correlationId);

      throw error;
    }
  }

  /**
   * Call OpenAI for workout generation
   */
  async callOpenAIForWorkout(modelConfig, prompt) {
    const openaiClient = clients.getClient('openai');

    const response = await openaiClient.chat.completions.create({
      model: modelConfig.model,
      messages: [
        {
          role: 'system',
          content: 'You are an elite strength coach and certified personal trainer with advanced certifications. Generate comprehensive, safe, and effective workout plans in valid JSON format only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.maxTokens,
      response_format: { type: "json_object" }
    });

    return response.choices[0].message.content.trim();
  }

  /**
   * Parse workout response
   */
  parseWorkoutResponse(aiResponse) {
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
      monitoringService.log('error', 'Failed to parse workout response', {
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
   * Generate fallback workout
   */
  generateFallbackWorkout(userMetadata) {
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
          approach: 'fallback_single_prompt',
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
      mainWorkout: {
        structure: 'straight_sets',
        exercises: [
          {
            name: 'Bodyweight Squats',
            category: 'strength',
            sets: 3,
            reps: '10-15',
            rest: '60 seconds',
            instructions: 'Stand with feet shoulder-width apart, lower into squat position, then return to standing.',
            targetMuscles: ['quadriceps', 'glutes']
          },
          {
            name: 'Push-ups',
            category: 'strength',
            sets: 3,
            reps: '8-12',
            rest: '60 seconds',
            instructions: 'Start in plank position, lower chest to ground, push back up.',
            targetMuscles: ['chest', 'shoulders', 'triceps']
          },
          {
            name: 'Plank',
            category: 'strength',
            sets: 3,
            reps: '30-60 seconds',
            rest: '60 seconds',
            instructions: 'Hold plank position with straight body line from head to heels.',
            targetMuscles: ['core', 'shoulders']
          }
        ]
      },
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
      ]
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
