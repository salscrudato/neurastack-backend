const clients = require('./vendorClients');
const ensembleConfig = require('../config/ensemblePrompts');
const workoutConfig = require('../config/workoutConfig');
const promptCraftingService = require('./promptCraftingService');
const monitoringService = require('./monitoringService');
const cacheService = require('./cacheService');
const costMonitoringService = require('./costMonitoringService');
const workoutPersonalizationService = require('./workoutPersonalizationService');
const fallbackWorkoutService = require('./fallbackWorkoutService');

/**
 * Workout Generation Service
 * Handles AI-powered workout plan generation using optimized models
 */
class WorkoutService {
  constructor() {
    this.config = {
      timeoutMs: 60000, // 60 second timeout for comprehensive professional workouts
      maxTokens: 2500,  // Increased for detailed professional programming
      temperature: 0.3  // Lower temperature for consistent, professional output
    };
  }

  /**
   * Generate a personalized workout plan
   * @param {Object} userMetadata - User information and preferences
   * @param {Array} workoutHistory - Previous workout data
   * @param {string|Object} workoutRequest - Workout request (string for backward compatibility, object for enhanced structure)
   * @param {string} userId - Optional user ID for tracking
   * @param {Object} workoutSpecification - Optional separate workout specification (enhanced frontend format)
   * @returns {Promise<Object>} Generated workout plan
   */
  async generateWorkout(userMetadata, workoutHistory, workoutRequest, userId = null, workoutSpecification = null) {
    const correlationId = `workout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      monitoringService.log('info', 'Workout generation started', {
        userId,
        requestLength: workoutRequest.length,
        hasHistory: workoutHistory && workoutHistory.length > 0
      }, correlationId);

      // Validate inputs
      this.validateInputs(userMetadata, workoutHistory, workoutRequest);

      // Check cache first for similar workout requests
      try {
        const cachedWorkout = await cacheService.getCachedWorkoutPlan(userMetadata, workoutHistory, workoutRequest);
        if (cachedWorkout) {
          monitoringService.log('info', 'Returning cached workout plan', { userId }, correlationId);
          return {
            ...cachedWorkout,
            cached: true,
            cacheTimestamp: new Date().toISOString()
          };
        }
      } catch (cacheError) {
        monitoringService.log('warn', 'Cache lookup failed for workout', {
          error: cacheError.message
        }, correlationId);
      }

      // Get intelligent personalization (Phase 1 implementation)
      let personalization = null;
      if (userId && userId !== 'anonymous') {
        try {
          const workoutType = typeof workoutRequest === 'string' ?
            this.extractWorkoutTypeFromRequest(workoutRequest) :
            workoutRequest.workoutType || workoutSpecification?.workoutType;

          personalization = await workoutPersonalizationService.personalizeWorkout(
            userId,
            userMetadata,
            workoutType,
            workoutSpecification
          );

          monitoringService.log('info', 'Workout personalization applied', {
            userId,
            confidence: personalization.metadata.personalizationConfidence,
            dataQuality: personalization.metadata.dataQuality
          }, correlationId);
        } catch (personalizationError) {
          monitoringService.log('warn', 'Workout personalization failed, using defaults', {
            userId,
            error: personalizationError.message
          }, correlationId);
        }
      }

      // Build the workout generation prompt with enhanced personalization
      const prompt = this.buildWorkoutPrompt(userMetadata, workoutHistory, workoutRequest, workoutSpecification, personalization);

      // Get the appropriate model based on tier
      const modelConfig = this.getModelConfig();

      // Generate workout using AI
      const aiResponse = await this.callAIModel(modelConfig, prompt, correlationId);

      // Parse and validate the response with original request context
      const enhancedRequest = workoutSpecification ? { workoutSpecification } : workoutRequest;

      // Debug: Log the AI response for troubleshooting
      console.log('🔍 AI Response (first 500 chars):', aiResponse.substring(0, 500));

      const workoutPlan = this.parseWorkoutResponse(aiResponse, enhancedRequest);

      // Add debugging information for frontend developers
      const debugInfo = this.generateDebugInfo(enhancedRequest, workoutPlan, modelConfig);

      // Log success with enhanced information
      monitoringService.log('info', 'Workout generation completed', {
        userId,
        model: modelConfig.model,
        workoutType: workoutPlan.type || 'unknown',

        requestFormat: debugInfo.requestFormat
      }, correlationId);

      // Prepare final response
      const finalResponse = {
        status: 'success',
        data: {
          workout: workoutPlan,
          metadata: {
            model: modelConfig.model,
            provider: modelConfig.provider,
            timestamp: new Date().toISOString(),
            correlationId,
            userId,
            debug: debugInfo
          }
        }
      };

      // Cache successful workout plans for future use
      try {
        await cacheService.cacheWorkoutPlan(userMetadata, workoutHistory, workoutRequest, finalResponse);
        monitoringService.log('info', 'Workout plan cached successfully', { userId }, correlationId);
      } catch (cacheError) {
        monitoringService.log('warn', 'Failed to cache workout plan', {
          error: cacheError.message
        }, correlationId);
      }

      return finalResponse;

    } catch (error) {
      monitoringService.log('error', 'Primary workout generation failed, attempting fallback', {
        userId,
        error: error.message,
        stack: error.stack
      }, correlationId);

      // Attempt fallback workout generation
      try {
        const workoutType = typeof workoutRequest === 'string' ?
          this.extractWorkoutTypeFromRequest(workoutRequest) :
          workoutRequest.workoutType || workoutSpecification?.workoutType || 'Full Body Workout';

        const fallbackResult = fallbackWorkoutService.generateFallbackWorkout(
          userMetadata,
          workoutType,
          'primary_service_failed'
        );

        monitoringService.log('info', 'Fallback workout generation successful', {
          userId,
          workoutType,
          fallbackReason: 'primary_service_failed'
        }, correlationId);

        return fallbackResult;

      } catch (fallbackError) {
        monitoringService.log('error', 'Both primary and fallback workout generation failed', {
          userId,
          primaryError: error.message,
          fallbackError: fallbackError.message
        }, correlationId);

        throw new Error(`Workout generation failed: ${error.message}`);
      }
    }
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

      // Prepare final response
      return {
        status: 'success',
        data: {
          workout: workoutPlan,
          metadata: {
            model: workoutGeneratorConfig.model,
            provider: workoutGeneratorConfig.provider,
            timestamp: new Date().toISOString(),
            correlationId,
            userId: userMetadata.userId,
            approach: 'two_stage_flexible',
            promptCraftingModel: workoutConfig.getAIConfig('promptCrafter').model
          }
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

      // Validate required fields
      if (!workoutPlan.type) workoutPlan.type = 'General Fitness';
      if (!workoutPlan.duration) workoutPlan.duration = 30;
      if (!workoutPlan.difficulty) workoutPlan.difficulty = 'intermediate';
      if (!workoutPlan.exercises) workoutPlan.exercises = [];
      if (!workoutPlan.warmup) workoutPlan.warmup = [];
      if (!workoutPlan.cooldown) workoutPlan.cooldown = [];
      if (!workoutPlan.coachingTips) workoutPlan.coachingTips = [];

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
   * Generate fallback workout for flexible approach
   */
  generateFallbackFlexibleWorkout(userMetadata, otherInformation) {
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
   * Get the appropriate AI model configuration for professional workout generation
   * Enhanced to use GPT-4o for structured workout generation
   */
  getModelConfig() {
    const tier = ensembleConfig.meta.tier;
    const models = ensembleConfig.models;

    // Always use GPT-4o for workout generation as requested
    // GPT-4o provides excellent structured output and exercise knowledge
    return {
      provider: 'openai',
      model: 'gpt-4o', // Use GPT-4o specifically for workout generation
      tier: tier,
      optimizedFor: 'structured_workout_generation'
    };
  }

  /**
   * Build professional workout generation prompt with elite personal trainer expertise
   * Enhanced for structured parameter handling, GPT-4o optimization, and intelligent personalization
   */
  buildWorkoutPrompt(userMetadata, workoutHistory, workoutRequest, workoutSpecification = null, personalization = null) {
    // Parse structured workout request - enhanced for new parameter format
    const structuredRequest = this.parseStructuredWorkoutRequest(userMetadata, workoutRequest, workoutSpecification);

    // Apply personalization adjustments to structured request
    if (personalization) {
      this.applyPersonalizationToRequest(structuredRequest, personalization);
    }

    // Build comprehensive client assessment with enhanced parameter support
    const clientAssessment = this.buildEnhancedClientAssessment(userMetadata, workoutHistory, structuredRequest);

    // Build professional workout specification with structured parameters
    const workoutSpec = this.buildStructuredWorkoutSpecification(structuredRequest, userMetadata);

    // Build professional requirements and safety considerations
    const professionalRequirements = this.buildEnhancedProfessionalRequirements(structuredRequest, userMetadata);

    // Add personalization guidance if available
    const personalizationGuidance = personalization ?
      this.buildPersonalizationGuidance(personalization) : '';

    return `🏋️‍♂️ ELITE PERSONAL TRAINER WORKOUT PROGRAMMING

📋 COMPREHENSIVE CLIENT ASSESSMENT:
${clientAssessment}

🎯 STRUCTURED WORKOUT SPECIFICATION:
${workoutSpec}

⚡ PROFESSIONAL PROGRAMMING REQUIREMENTS:
${professionalRequirements}

${personalizationGuidance ? `🧠 INTELLIGENT PERSONALIZATION GUIDANCE:
${personalizationGuidance}

` : ''}

🏆 GENERATE PROFESSIONAL WORKOUT PROGRAM:

Create a comprehensive, evidence-based workout program that demonstrates elite personal trainer expertise with advanced exercise science knowledge. Use the following professional JSON format:

{
  "type": "${structuredRequest.workoutType || 'functional_training'}",
  "duration": ${structuredRequest.minutesPerSession || structuredRequest.duration || userMetadata.timeAvailable || userMetadata.minutesPerSession || 45},
  "difficulty": "${structuredRequest.fitnessLevel || userMetadata.fitnessLevel || 'intermediate'}",
  "equipment": ${JSON.stringify(structuredRequest.equipment || userMetadata.equipment || [])},

  "mainWorkout": {
    "structure": "Exercise count and training focus description",
    "exercises": [
      {
        "name": "Exercise Name",
        "category": "strength",
        "sets": 3,
        "reps": "8-10",
        "rest": "90 seconds",
        "duration": 0,
        "instructions": "Detailed step-by-step instructions with proper form and technique",
        "formCues": [
          "Key form tip 1",
          "Key form tip 2",
          "Key form tip 3"
        ],
        "modifications": "Use lighter weight or perform easier variation",
        "targetMuscles": ["primary", "secondary", "stabilizers"],
        "equipment": ["required_equipment"],
        "intensity": "moderate",
        "rpe": 6,
        "progressionNotes": [
          "How to progress this exercise",
          "Advanced variation options"
        ]
      }
    ]
  },
  "warmup": [
    {
      "name": "Warmup Exercise",
      "duration": "2 minutes",
      "instructions": "Detailed warmup instructions"
    }
  ],

  "cooldown": [
    {
      "name": "Cooldown Exercise",
      "duration": "90 seconds",
      "instructions": "Detailed cooldown instructions"
    }
  ],

  "professionalNotes": "Focus on progressive overload and proper form. Ensure adequate rest between sessions.",

  "tags": ["${structuredRequest.workoutType || 'functional'}", "${structuredRequest.fitnessLevel || 'intermediate'}", "strength"],

  "coachingTips": [
    "Track your weights and reps for progressive overload",
    "Focus on form over weight - perfect technique prevents injury",
    "Stay hydrated and maintain steady breathing throughout"
  ]


}

🎯 CRITICAL PROFESSIONAL STANDARDS:
1. Apply evidence-based exercise science principles throughout
2. Use proper periodization and progressive overload concepts
3. Include detailed biomechanical coaching cues for every exercise
4. Provide comprehensive safety considerations and contraindications
5. Ensure proper exercise sequencing based on energy systems and fatigue
6. Provide both progressions and regressions for individual adaptation
7. Demonstrate the expertise level of a certified personal trainer with advanced education
8. MANDATORY: Use exact workout type "${structuredRequest.workoutType || 'functional_training'}" - do not modify
9. Respond ONLY with valid JSON - no additional text or markdown formatting

Generate a workout that clearly demonstrates professional personal training expertise and advanced exercise science knowledge.`;
  }

  /**
   * Build enhanced client assessment with structured parameter support
   */
  buildEnhancedClientAssessment(userMetadata, workoutHistory, structuredRequest) {
    const assessment = [];

    // Enhanced demographic and physical assessment
    assessment.push(`👤 CLIENT PROFILE:`);
    assessment.push(`   • Age: ${structuredRequest.age || userMetadata.age || 'Not specified'} years`);
    assessment.push(`   • Gender: ${structuredRequest.gender || userMetadata.gender || 'Not specified'}`);
    assessment.push(`   • Weight: ${structuredRequest.weight || userMetadata.weight || 'Not specified'} ${structuredRequest.weight ? 'lbs/kg' : ''}`);
    assessment.push(`   • Fitness Level: ${structuredRequest.fitnessLevel || userMetadata.fitnessLevel || 'Intermediate'}`);

    // Enhanced fitness goals assessment
    if (structuredRequest.fitnessGoals && structuredRequest.fitnessGoals.length > 0) {
      assessment.push(`\n🎯 FITNESS GOALS:`);
      structuredRequest.fitnessGoals.forEach(goal => {
        assessment.push(`   • ${goal.replace('_', ' ').toUpperCase()}`);
      });
    } else if (userMetadata.goals && userMetadata.goals.length > 0) {
      assessment.push(`\n🎯 FITNESS GOALS:`);
      userMetadata.goals.forEach(goal => {
        assessment.push(`   • ${goal.replace('_', ' ').toUpperCase()}`);
      });
    }

    // Enhanced equipment assessment
    const equipment = structuredRequest.equipment || userMetadata.equipment || [];
    assessment.push(`\n🏋️ AVAILABLE EQUIPMENT:`);
    if (equipment.length > 0) {
      equipment.forEach(item => {
        assessment.push(`   • ${item.replace('_', ' ').toUpperCase()}`);
      });
    } else {
      assessment.push(`   • BODYWEIGHT ONLY (No equipment available)`);
    }

    // Enhanced injury and limitation assessment
    const injuries = structuredRequest.injuries || userMetadata.injuries || [];
    assessment.push(`\n⚠️ INJURY/LIMITATION CONSIDERATIONS:`);
    if (injuries.length > 0) {
      injuries.forEach(injury => {
        assessment.push(`   • ${injury.replace('_', ' ').toUpperCase()} - Requires exercise modifications`);
      });
    } else {
      assessment.push(`   • No reported injuries or limitations`);
    }

    // Enhanced training schedule assessment
    if (structuredRequest.daysPerWeek || userMetadata.daysPerWeek) {
      const days = structuredRequest.daysPerWeek || userMetadata.daysPerWeek;
      assessment.push(`\n📅 TRAINING SCHEDULE:`);
      assessment.push(`   • Frequency: ${days} days per week`);
      assessment.push(`   • Session Duration: ${structuredRequest.minutesPerSession || userMetadata.minutesPerSession || userMetadata.timeAvailable || 45} minutes`);
      assessment.push(`   • Weekly Volume: ${days * (structuredRequest.minutesPerSession || userMetadata.minutesPerSession || userMetadata.timeAvailable || 45)} minutes total`);
    }

    // Enhanced training history context
    if (workoutHistory && workoutHistory.length > 0) {
      assessment.push(`\n📊 TRAINING HISTORY ANALYSIS:`);
      assessment.push(`   • Previous Sessions: ${workoutHistory.length} recorded workouts`);

      // Analyze recent workout patterns
      const recentWorkouts = workoutHistory.slice(0, 5);
      const workoutTypes = recentWorkouts.map(w => w.parameters?.workoutType || w.type).filter(Boolean);
      const uniqueTypes = [...new Set(workoutTypes)];

      if (uniqueTypes.length > 0) {
        assessment.push(`   • Recent Workout Types: ${uniqueTypes.join(', ')}`);
      }

      // Analyze completion rates
      const completedWorkouts = recentWorkouts.filter(w => w.status === 'completed');
      const completionRate = recentWorkouts.length > 0 ? (completedWorkouts.length / recentWorkouts.length) * 100 : 0;
      assessment.push(`   • Recent Completion Rate: ${completionRate.toFixed(0)}%`);

      // Analyze feedback patterns
      const workoutsWithFeedback = recentWorkouts.filter(w => w.feedback && w.feedback.feedback);
      if (workoutsWithFeedback.length > 0) {
        const avgRating = workoutsWithFeedback.reduce((sum, w) => sum + (w.feedback.feedback.rating || 0), 0) / workoutsWithFeedback.length;
        assessment.push(`   • Average Workout Rating: ${avgRating.toFixed(1)}/5`);

        const difficultyFeedback = workoutsWithFeedback.map(w => w.feedback.feedback.difficulty).filter(Boolean);
        if (difficultyFeedback.length > 0) {
          const mostCommonDifficulty = difficultyFeedback.reduce((a, b, i, arr) =>
            arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
          );
          assessment.push(`   • Most Common Difficulty Feedback: ${mostCommonDifficulty.replace('_', ' ')}`);
        }
      }
    } else {
      assessment.push(`\n📊 TRAINING HISTORY: New client - establishing baseline program`);
    }

    return assessment.join('\n');
  }

  /**
   * Build structured workout specification with enhanced parameters
   */
  buildStructuredWorkoutSpecification(structuredRequest, userMetadata) {
    const spec = [];

    spec.push(`🎯 STRUCTURED WORKOUT PARAMETERS:`);
    spec.push(`   • Workout Type: ${structuredRequest.workoutType || 'Functional Training'}`);
    spec.push(`   • Session Duration: ${structuredRequest.minutesPerSession || structuredRequest.duration || userMetadata.timeAvailable || userMetadata.minutesPerSession || 45} minutes`);
    spec.push(`   • Intensity Target: ${structuredRequest.intensityTarget || this.mapFitnessLevelToIntensity(structuredRequest.fitnessLevel || userMetadata.fitnessLevel)}`);
    spec.push(`   • Training Focus: ${structuredRequest.focus && structuredRequest.focus.length > 0 ? structuredRequest.focus.join(', ') : 'Balanced development'}`);

    // Enhanced goal-specific programming
    if (structuredRequest.fitnessGoals && structuredRequest.fitnessGoals.length > 0) {
      spec.push(`\n🎯 GOAL-SPECIFIC PROGRAMMING:`);
      structuredRequest.fitnessGoals.forEach(goal => {
        const goalSpecs = this.getGoalSpecificRequirements(goal);
        spec.push(`   • ${goal.replace('_', ' ').toUpperCase()}: ${goalSpecs}`);
      });
    }

    // Enhanced equipment optimization
    const equipment = structuredRequest.equipment || userMetadata.equipment || [];
    spec.push(`\n🏋️ EQUIPMENT OPTIMIZATION:`);
    if (equipment.length > 0) {
      spec.push(`   • Available Equipment: ${equipment.join(', ')}`);
      spec.push(`   • Equipment Strategy: Maximize utilization of available tools`);
    } else {
      spec.push(`   • Bodyweight Focus: Creative bodyweight progressions and variations`);
    }

    // Enhanced safety and modification protocols
    const injuries = structuredRequest.injuries || userMetadata.injuries || [];
    if (injuries.length > 0) {
      spec.push(`\n⚠️ SAFETY & MODIFICATION PROTOCOLS:`);
      injuries.forEach(injury => {
        const modifications = this.getInjuryModifications(injury);
        spec.push(`   • ${injury.replace('_', ' ').toUpperCase()}: ${modifications}`);
      });
    }

    return spec.join('\n');
  }

  /**
   * Get goal-specific programming requirements
   */
  getGoalSpecificRequirements(goal) {
    const requirements = {
      'weight_loss': 'High-intensity intervals, compound movements, metabolic conditioning',
      'muscle_gain': 'Progressive overload, hypertrophy rep ranges (8-12), adequate rest',
      'strength': 'Heavy compound lifts, low rep ranges (3-6), longer rest periods',
      'endurance': 'Sustained effort, circuit training, minimal rest periods',
      'flexibility': 'Dynamic warm-up, static stretching, mobility work',
      'toning': 'Moderate weights, higher reps (12-15), muscle definition focus',
      'general_fitness': 'Balanced approach, functional movements, varied training',
      'athletic_performance': 'Sport-specific movements, power development, agility work'
    };
    return requirements[goal] || 'Balanced training approach';
  }

  /**
   * Get injury-specific modifications
   */
  getInjuryModifications(injury) {
    const modifications = {
      'lower_back': 'Avoid spinal flexion, emphasize core stability, neutral spine',
      'knee': 'Limit deep knee flexion, avoid high-impact, focus on alignment',
      'shoulder': 'Avoid overhead movements, emphasize scapular stability',
      'neck': 'Avoid neck flexion/extension, maintain neutral cervical spine',
      'ankle': 'Modify jumping movements, focus on stability and mobility',
      'wrist': 'Avoid weight-bearing on hands, use alternative grip positions',
      'hip': 'Limit hip flexion, focus on hip stability and mobility',
      'elbow': 'Avoid repetitive gripping, modify pushing/pulling movements'
    };
    return modifications[injury] || 'Exercise modifications as needed for comfort and safety';
  }

  /**
   * Build comprehensive client assessment for professional programming
   */
  buildClientAssessment(userMetadata, workoutHistory) {
    const assessment = [];

    // Basic demographics and physical characteristics
    assessment.push(`👤 DEMOGRAPHICS:`);
    assessment.push(`   • Age: ${userMetadata.age} years`);
    assessment.push(`   • Gender: ${userMetadata.gender || 'Not specified'}`);
    assessment.push(`   • Weight: ${userMetadata.weight || 'Not specified'}lbs`);

    // Fitness and experience level
    assessment.push(`\n💪 FITNESS PROFILE:`);
    assessment.push(`   • Current Fitness Level: ${userMetadata.fitnessLevel || 'Intermediate'}`);
    assessment.push(`   • Experience Level: ${userMetadata.experienceLevel || userMetadata.fitnessLevel || 'Intermediate'}`);
    assessment.push(`   • Training Frequency: ${userMetadata.trainingFrequency || userMetadata.daysPerWeek || 3} days/week`);
    assessment.push(`   • Preferred Intensity: ${userMetadata.preferredIntensity || 'Moderate'}`);

    // Goals and objectives
    if (userMetadata.goals && userMetadata.goals.length > 0) {
      assessment.push(`\n🎯 PRIMARY GOALS:`);
      userMetadata.goals.forEach(goal => {
        assessment.push(`   • ${goal}`);
      });
    }

    // Equipment and training environment
    assessment.push(`\n🏋️ TRAINING ENVIRONMENT:`);
    assessment.push(`   • Environment Type: ${userMetadata.trainingEnvironment || (userMetadata.equipment && userMetadata.equipment.length > 0 ? 'Equipped' : 'Bodyweight')}`);
    assessment.push(`   • Available Time: ${userMetadata.timeAvailable || userMetadata.minutesPerSession || 45} minutes`);

    if (userMetadata.equipment && userMetadata.equipment.length > 0) {
      assessment.push(`   • Available Equipment: ${userMetadata.equipment.join(', ')}`);
    } else {
      assessment.push(`   • Available Equipment: Bodyweight only`);
    }

    // Injuries and limitations
    if (userMetadata.injuries && userMetadata.injuries.length > 0) {
      assessment.push(`\n⚠️ INJURY HISTORY & LIMITATIONS:`);
      userMetadata.injuries.forEach(injury => {
        assessment.push(`   • ${injury} - Requires exercise modifications and contraindication awareness`);
      });
    } else {
      assessment.push(`\n✅ INJURY STATUS: No reported injuries or limitations`);
    }

    // Training history context
    if (workoutHistory && workoutHistory.length > 0) {
      assessment.push(`\n📊 RECENT TRAINING HISTORY:`);
      assessment.push(`   • Previous Sessions: ${workoutHistory.length} recorded workouts`);
      const recentWorkout = workoutHistory[workoutHistory.length - 1];
      if (recentWorkout) {
        assessment.push(`   • Last Workout: ${recentWorkout.type || 'General'} (${recentWorkout.date || 'Recent'})`);
        assessment.push(`   • Last Session Rating: ${recentWorkout.rating || 'Not rated'}/5`);
      }
    } else {
      assessment.push(`\n📊 TRAINING HISTORY: New client - establishing baseline program`);
    }

    return assessment.join('\n');
  }

  /**
   * Build professional workout specification
   */
  buildWorkoutSpecification(structuredRequest, userMetadata) {
    const spec = [];

    spec.push(`🎯 WORKOUT PARAMETERS:`);
    spec.push(`   • Workout Type: ${structuredRequest.workoutType || 'Functional Training'}`);
    spec.push(`   • Session Duration: ${structuredRequest.duration || userMetadata.timeAvailable || userMetadata.minutesPerSession || 45} minutes`);
    spec.push(`   • Intensity Target: ${structuredRequest.intensityTarget || userMetadata.preferredIntensity || 'Moderate-High'}`);
    spec.push(`   • Volume Target: ${structuredRequest.volumeTarget || 'Moderate'}`);
    spec.push(`   • Complexity Level: ${structuredRequest.complexityLevel || userMetadata.fitnessLevel || 'Intermediate'}`);
    spec.push(`   • Safety Priority: ${structuredRequest.safetyPriority || 'High'}`);

    if (structuredRequest.focusAreas && structuredRequest.focusAreas.length > 0) {
      spec.push(`\n🔥 FOCUS AREAS:`);
      structuredRequest.focusAreas.forEach(area => {
        spec.push(`   • ${area}`);
      });
    }

    return spec.join('\n');
  }

  /**
   * Build enhanced professional requirements with structured parameter support
   */
  buildEnhancedProfessionalRequirements(structuredRequest, userMetadata) {
    const requirements = [];

    requirements.push(`🧠 ADVANCED EXERCISE SCIENCE APPLICATION:`);
    requirements.push(`   • Apply FITT-VP Principle (Frequency, Intensity, Time, Type, Volume, Progression)`);
    requirements.push(`   • Use Progressive Overload with structured parameter consideration`);
    requirements.push(`   • Implement Specificity Principle for goal achievement`);
    requirements.push(`   • Apply Recovery and Adaptation principles`);

    // Enhanced goal-specific requirements
    if (structuredRequest.fitnessGoals && structuredRequest.fitnessGoals.length > 0) {
      requirements.push(`\n🎯 GOAL-SPECIFIC PROGRAMMING REQUIREMENTS:`);
      structuredRequest.fitnessGoals.forEach(goal => {
        const goalRequirements = this.getAdvancedGoalRequirements(goal);
        requirements.push(`   • ${goal.replace('_', ' ').toUpperCase()}: ${goalRequirements}`);
      });
    }

    // Enhanced safety and biomechanics requirements
    requirements.push(`\n⚠️ SAFETY & BIOMECHANICS REQUIREMENTS:`);
    requirements.push(`   • Prioritize movement quality over quantity`);
    requirements.push(`   • Ensure proper warm-up and cool-down protocols`);
    requirements.push(`   • Apply joint-by-joint mobility/stability approach`);
    requirements.push(`   • Use appropriate exercise progressions and regressions`);

    // Enhanced age and fitness level considerations
    const age = structuredRequest.age || userMetadata.age;
    const fitnessLevel = structuredRequest.fitnessLevel || userMetadata.fitnessLevel;

    if (age) {
      requirements.push(`\n👤 AGE-SPECIFIC CONSIDERATIONS (${age} years):`);
      if (age < 18) {
        requirements.push(`   • Youth training: Focus on movement skills, avoid maximal loads`);
      } else if (age >= 65) {
        requirements.push(`   • Senior training: Emphasize balance, functional movements, fall prevention`);
      } else if (age >= 40) {
        requirements.push(`   • Master's training: Include mobility work, joint health, recovery focus`);
      } else {
        requirements.push(`   • Adult training: Full range of training modalities appropriate`);
      }
    }

    if (fitnessLevel) {
      requirements.push(`\n📊 FITNESS LEVEL ADAPTATIONS (${fitnessLevel.toUpperCase()}):`);
      const levelRequirements = this.getFitnessLevelRequirements(fitnessLevel);
      requirements.push(`   • ${levelRequirements}`);
    }

    // Enhanced equipment-specific requirements
    const equipment = structuredRequest.equipment || userMetadata.equipment || [];
    requirements.push(`\n🏋️ EQUIPMENT-SPECIFIC PROGRAMMING:`);
    if (equipment.length > 0) {
      requirements.push(`   • Maximize equipment utilization: ${equipment.join(', ')}`);
      requirements.push(`   • Ensure proper equipment setup and safety protocols`);
      requirements.push(`   • Use equipment-specific progression strategies`);
    } else {
      requirements.push(`   • Bodyweight mastery: Focus on movement quality and progression`);
      requirements.push(`   • Creative exercise variations without equipment`);
      requirements.push(`   • Leverage gravity and body positioning for resistance`);
    }

    // Enhanced injury prevention and modification requirements
    const injuries = structuredRequest.injuries || userMetadata.injuries || [];
    if (injuries.length > 0) {
      requirements.push(`\n🩺 INJURY MANAGEMENT & PREVENTION:`);
      injuries.forEach(injury => {
        const preventionStrategy = this.getInjuryPreventionStrategy(injury);
        requirements.push(`   • ${injury.replace('_', ' ').toUpperCase()}: ${preventionStrategy}`);
      });
    }

    // Enhanced time and frequency optimization
    const duration = structuredRequest.minutesPerSession || userMetadata.minutesPerSession || userMetadata.timeAvailable;
    const frequency = structuredRequest.daysPerWeek || userMetadata.daysPerWeek;

    if (duration || frequency) {
      requirements.push(`\n⏱️ TIME & FREQUENCY OPTIMIZATION:`);
      if (duration) {
        requirements.push(`   • Session Duration: ${duration} minutes - optimize exercise density`);
        if (duration <= 20) {
          requirements.push(`   • Short session strategy: High-intensity, compound movements`);
        } else if (duration >= 60) {
          requirements.push(`   • Extended session strategy: Include adequate rest and variety`);
        }
      }
      if (frequency) {
        requirements.push(`   • Weekly Frequency: ${frequency} days - ensure adequate recovery`);
        if (frequency >= 5) {
          requirements.push(`   • High frequency strategy: Vary intensity and muscle groups`);
        }
      }
    }

    requirements.push(`\n🏆 PROFESSIONAL STANDARDS:`);
    requirements.push(`   • Evidence-based exercise selection and programming`);
    requirements.push(`   • Clear, detailed exercise instructions with safety cues`);
    requirements.push(`   • Appropriate progression and regression options`);
    requirements.push(`   • Professional presentation and terminology`);

    return requirements.join('\n');
  }

  /**
   * Get advanced goal-specific requirements
   */
  getAdvancedGoalRequirements(goal) {
    const requirements = {
      'weight_loss': 'Metabolic conditioning, HIIT protocols, compound movements, caloric expenditure focus',
      'muscle_gain': 'Hypertrophy protocols, progressive overload, adequate volume, muscle protein synthesis optimization',
      'strength': 'Maximal strength protocols, neural adaptations, compound lifts, power development',
      'endurance': 'Aerobic capacity building, lactate threshold training, muscular endurance protocols',
      'flexibility': 'Static and dynamic stretching, PNF techniques, mobility enhancement',
      'toning': 'Muscle definition protocols, moderate resistance, higher volume, body composition focus',
      'general_fitness': 'Balanced training approach, functional movement patterns, overall health enhancement',
      'athletic_performance': 'Sport-specific training, power development, agility, reaction time enhancement'
    };
    return requirements[goal] || 'Comprehensive fitness development approach';
  }

  /**
   * Get fitness level specific requirements
   */
  getFitnessLevelRequirements(level) {
    const requirements = {
      'beginner': 'Movement pattern learning, basic exercises, longer rest periods, gradual progression',
      'intermediate': 'Increased complexity, moderate intensity, varied training stimuli, structured progression',
      'advanced': 'High intensity training, complex movements, shorter rest periods, advanced techniques'
    };
    return requirements[level] || 'Appropriate progression for fitness level';
  }

  /**
   * Get injury prevention strategies
   */
  getInjuryPreventionStrategy(injury) {
    const strategies = {
      'lower_back': 'Core strengthening, hip mobility, proper lifting mechanics, spinal neutral positioning',
      'knee': 'Quadriceps/hamstring balance, proper tracking, controlled movements, impact modification',
      'shoulder': 'Scapular stability, rotator cuff strengthening, proper overhead mechanics',
      'neck': 'Cervical spine stability, postural awareness, controlled range of motion',
      'ankle': 'Proprioception training, calf flexibility, controlled landing mechanics',
      'wrist': 'Grip strength variation, wrist mobility, alternative hand positions',
      'hip': 'Hip flexor stretching, glute activation, proper movement patterns',
      'elbow': 'Grip variation, controlled movements, proper arm positioning'
    };
    return strategies[injury] || 'Conservative approach with movement modifications';
  }

  /**
   * Build professional requirements and exercise science principles
   */
  buildProfessionalRequirements(structuredRequest, userMetadata) {
    const requirements = [];

    requirements.push(`🧠 EXERCISE SCIENCE APPLICATION:`);
    requirements.push(`   • Apply FITT Principle (Frequency, Intensity, Time, Type)`);
    requirements.push(`   • Use Progressive Overload for continuous adaptation`);
    requirements.push(`   • Implement Specificity Principle for goal achievement`);
    requirements.push(`   • Ensure adequate Recovery between training stimuli`);
    requirements.push(`   • Apply Individual Adaptation principles`);

    requirements.push(`\n⚡ PERIODIZATION & PROGRAMMING:`);
    requirements.push(`   • Use systematic exercise sequencing (compound → isolation)`);
    requirements.push(`   • Apply appropriate work-to-rest ratios for training goals`);
    requirements.push(`   • Implement proper movement patterns and muscle balance`);
    requirements.push(`   • Include corrective exercises if movement limitations present`);

    requirements.push(`\n🛡️ SAFETY & RISK MANAGEMENT:`);
    requirements.push(`   • Prioritize movement quality over quantity`);
    requirements.push(`   • Include comprehensive warm-up and cool-down protocols`);
    requirements.push(`   • Provide detailed form cues and safety considerations`);
    requirements.push(`   • Offer exercise progressions and regressions`);

    if (userMetadata.injuries && userMetadata.injuries.length > 0) {
      requirements.push(`   • CRITICAL: Avoid all contraindicated exercises for: ${userMetadata.injuries.join(', ')}`);
      requirements.push(`   • Implement corrective exercise strategies where appropriate`);
    }

    requirements.push(`\n📈 PROFESSIONAL COACHING ELEMENTS:`);
    requirements.push(`   • Include breathing patterns and core engagement cues`);
    requirements.push(`   • Offer equipment alternatives for accessibility`);
    requirements.push(`   • Provide clear progression pathways for future sessions`);

    return requirements.join('\n');
  }

  /**
   * Parse structured workout request with enhanced parameter support
   * Handles the new generate-workout endpoint parameters
   */
  parseStructuredWorkoutRequest(userMetadata, workoutRequest, workoutSpecification = null) {
    // If userMetadata contains structured parameters (from generate-workout endpoint)
    if (userMetadata && userMetadata.fitnessLevel && userMetadata.goals) {
      return {
        fitnessLevel: userMetadata.fitnessLevel,
        fitnessGoals: userMetadata.goals,
        equipment: userMetadata.equipment || [],
        age: userMetadata.age,
        gender: userMetadata.gender,
        weight: userMetadata.weight,
        injuries: userMetadata.injuries || [],
        daysPerWeek: userMetadata.daysPerWeek,
        minutesPerSession: userMetadata.minutesPerSession || userMetadata.timeAvailable,
        workoutType: this.extractWorkoutTypeFromRequest(workoutRequest),
        isStructuredFormat: true,
        duration: userMetadata.minutesPerSession || userMetadata.timeAvailable,
        intensityTarget: this.mapFitnessLevelToIntensity(userMetadata.fitnessLevel),
        focus: this.deriveFocusFromGoals(userMetadata.goals, workoutRequest)
      };
    }

    // Fallback to original parsing for backward compatibility
    return this.parseWorkoutRequest(workoutRequest, workoutSpecification);
  }

  /**
   * Extract workout type from request string
   */
  extractWorkoutTypeFromRequest(workoutRequest) {
    if (typeof workoutRequest === 'string') {
      const request = workoutRequest.toLowerCase();

      // Common workout type patterns
      const typePatterns = {
        'leg': 'leg_day',
        'push': 'push_day',
        'pull': 'pull_day',
        'upper': 'upper_body',
        'lower': 'lower_body',
        'full': 'full_body',
        'core': 'core',
        'cardio': 'cardio',
        'hiit': 'hiit',
        'strength': 'strength',
        'yoga': 'yoga',
        'pilates': 'pilates',
        'crossfit': 'crossfit'
      };

      for (const [pattern, type] of Object.entries(typePatterns)) {
        if (request.includes(pattern)) {
          return type;
        }
      }
    }

    return 'functional_training'; // Default
  }

  /**
   * Map fitness level to intensity target
   */
  mapFitnessLevelToIntensity(fitnessLevel) {
    const intensityMap = {
      'beginner': 'Low-Moderate',
      'intermediate': 'Moderate-High',
      'advanced': 'High-Very High'
    };
    return intensityMap[fitnessLevel] || 'Moderate';
  }

  /**
   * Derive focus areas from fitness goals and workout type
   */
  deriveFocusFromGoals(goals, workoutRequest) {
    const focus = [];

    if (goals && Array.isArray(goals)) {
      const goalFocusMap = {
        'weight_loss': ['cardio', 'fat_burning', 'metabolic'],
        'muscle_gain': ['strength', 'hypertrophy', 'progressive_overload'],
        'strength': ['strength', 'power', 'compound_movements'],
        'endurance': ['cardio', 'endurance', 'stamina'],
        'flexibility': ['flexibility', 'mobility', 'stretching'],
        'toning': ['strength', 'endurance', 'body_composition'],
        'general_fitness': ['functional', 'balanced', 'overall_health'],
        'athletic_performance': ['power', 'agility', 'sport_specific']
      };

      goals.forEach(goal => {
        if (goalFocusMap[goal]) {
          focus.push(...goalFocusMap[goal]);
        }
      });
    }

    // Add workout type specific focus
    if (typeof workoutRequest === 'string') {
      const request = workoutRequest.toLowerCase();
      if (request.includes('strength')) focus.push('strength');
      if (request.includes('cardio')) focus.push('cardio');
      if (request.includes('core')) focus.push('core');
      if (request.includes('functional')) focus.push('functional');
    }

    return [...new Set(focus)]; // Remove duplicates
  }

  /**
   * Parse workout request - handle both string and enhanced structured object formats
   */
  parseWorkoutRequest(workoutRequest, workoutSpecification = null) {
    // Handle enhanced frontend format where workoutSpecification is passed separately
    if (workoutSpecification) {
      return {
        workoutType: workoutSpecification.workoutType,
        duration: workoutSpecification.duration,
        intensity: workoutSpecification.difficulty || workoutSpecification.intensity,
        focusAreas: workoutSpecification.focusAreas,
        equipment: workoutSpecification.equipment,
        intensityTarget: workoutSpecification.intensityTarget,
        volumeTarget: workoutSpecification.volumeTarget,
        complexityLevel: workoutSpecification.complexityLevel,
        progressionStyle: workoutSpecification.progressionStyle,
        safetyPriority: workoutSpecification.safetyPriority,
        isEnhancedFormat: true
      };
    }

    // Handle enhanced structured format (new format)
    if (typeof workoutRequest === 'object' && workoutRequest !== null) {
      // Check if it's the new enhanced format with workoutSpecification
      if (workoutRequest.workoutSpecification) {
        return {
          workoutType: workoutRequest.workoutSpecification.workoutType,
          duration: workoutRequest.workoutSpecification.duration,
          intensity: workoutRequest.workoutSpecification.intensity,
          focus: workoutRequest.workoutSpecification.focus,
          structure: workoutRequest.workoutSpecification.structure,
          constraints: workoutRequest.workoutSpecification.constraints,
          additionalNotes: workoutRequest.workoutSpecification.additionalNotes,
          isEnhancedFormat: true
        };
      }

      // Handle legacy object format
      return {
        ...workoutRequest,
        isEnhancedFormat: false
      };
    }

    // Handle string format (backward compatibility)
    const structuredRequest = {
      workoutType: null,
      duration: null,
      focus: null,
      intensity: null,
      specificRequirements: workoutRequest,
      isEnhancedFormat: false
    };

    if (typeof workoutRequest === 'string') {
      const lowerRequest = workoutRequest.toLowerCase();

      // Extract workout type from common patterns - comprehensive and flexible approach
      const workoutTypePatterns = {
        'pilates': ['pilates'],
        'crossfit': ['crossfit', 'cross fit'],
        'yoga': ['yoga'],
        'pull_day': ['pull day', 'pull workout', 'pulling exercises', 'pull session'],
        'push_day': ['push day', 'push workout', 'pushing exercises', 'push session'],
        'leg_day': ['leg day', 'leg workout', 'legs workout', 'lower body'],
        'upper_body': ['upper body', 'upper workout', 'upper body workout'],
        'lower_body': ['lower body', 'lower workout', 'lower body workout'],
        'full_body': ['full body', 'total body', 'whole body', 'full body workout'],
        'core': ['core', 'abs', 'abdominal', 'core strengthening', 'core workout'],
        'functional': ['functional', 'movement patterns', 'functional training'],
        'hiit': ['hiit', 'high intensity', 'interval training', 'high intensity interval'],
        'cardio': ['cardio', 'cardiovascular', 'aerobic', 'cardio workout'],
        'flexibility': ['flexibility', 'stretching', 'mobility', 'flexibility training'],
        'strength': ['strength', 'weight training', 'resistance', 'strength training'],
        'mixed': ['mixed', 'combination', 'varied', 'hybrid'],
        // Legacy support for shorter forms
        'pull': ['pull day', 'pull workout', 'pulling exercises'],
        'push': ['push day', 'push workout', 'pushing exercises'],
        'legs': ['leg day', 'leg workout'],
        'upper': ['upper body', 'upper workout'],
        'lower': ['lower body', 'lower workout']
      };

      // Try to match known patterns, but don't restrict to only these
      for (const [type, patterns] of Object.entries(workoutTypePatterns)) {
        if (patterns.some(pattern => lowerRequest.includes(pattern))) {
          structuredRequest.workoutType = type;
          break;
        }
      }

      // If no pattern matched, try to extract any workout-related keywords
      if (!structuredRequest.workoutType) {
        const workoutKeywords = lowerRequest.match(/\b(workout|training|exercise|session|routine)\s+(\w+)/);
        if (workoutKeywords && workoutKeywords[2]) {
          structuredRequest.workoutType = workoutKeywords[2];
        }
      }

      // Extract duration
      const durationMatch = workoutRequest.match(/(\d+)\s*(?:min|minute|minutes)/i);
      if (durationMatch) {
        structuredRequest.duration = parseInt(durationMatch[1]);
      }

      // Extract intensity
      if (lowerRequest.includes('beginner') || lowerRequest.includes('easy')) {
        structuredRequest.intensity = 'beginner';
      } else if (lowerRequest.includes('advanced') || lowerRequest.includes('hard')) {
        structuredRequest.intensity = 'advanced';
      } else if (lowerRequest.includes('intermediate')) {
        structuredRequest.intensity = 'intermediate';
      }
    }

    return structuredRequest;
  }

  /**
   * Build specific requirements based on structured data (enhanced format support)
   */
  buildSpecificRequirements(structuredRequest, userMetadata) {
    const requirements = [];

    if (structuredRequest.workoutType) {
      const typeDescriptions = {
        'pilates': 'Focus on core strength, flexibility, and controlled movements with emphasis on proper form and breathing',
        'crossfit': 'High-intensity functional fitness combining weightlifting, cardio, and bodyweight movements',
        'yoga': 'Focus on flexibility, balance, mindfulness, and strength through flowing movements and poses',
        'pull': 'Focus on pulling movements targeting back, biceps, and rear deltoids (rows, pull-ups, face pulls)',
        'push': 'Focus on pushing movements targeting chest, shoulders, and triceps (push-ups, presses, dips)',
        'legs': 'Focus on lower body exercises targeting quads, hamstrings, glutes, and calves',
        'upper': 'Focus on upper body exercises targeting chest, back, shoulders, and arms',
        'lower': 'Focus on lower body exercises targeting legs and glutes',
        'full_body': 'Include exercises that work multiple muscle groups across the entire body',
        'cardio': 'Focus on cardiovascular exercises to improve heart health and endurance',
        'strength': 'Focus on resistance exercises to build muscle strength and size',
        'flexibility': 'Focus on stretching and mobility exercises to improve flexibility',
        'hiit': 'High-intensity interval training with alternating work and rest periods',
        'mixed': 'Combination of different exercise types for varied training stimulus',
        'core': 'Focus on core strengthening exercises targeting abs, obliques, and lower back',
        'functional': 'Focus on functional movement patterns that translate to daily activities'
      };

      // Use predefined description if available, otherwise use the workout type directly
      const description = typeDescriptions[structuredRequest.workoutType] ||
                         `Focus on ${structuredRequest.workoutType} training and exercises`;
      requirements.push(`Workout Type Focus: ${description}`);
    }

    // Enhanced format specific requirements
    if (structuredRequest.isEnhancedFormat) {
      if (structuredRequest.focus && structuredRequest.focus.length > 0) {
        requirements.push(`Training Focus: ${structuredRequest.focus.join(', ')} - emphasize these training aspects`);
      }

      if (structuredRequest.structure) {
        const struct = structuredRequest.structure;
        if (struct.warmupDuration) {
          requirements.push(`Warm-up Duration: ${struct.warmupDuration} minutes`);
        }
        if (struct.cooldownDuration) {
          requirements.push(`Cool-down Duration: ${struct.cooldownDuration} minutes`);
        }
        if (struct.restBetweenSets) {
          requirements.push(`Rest Between Sets: ${struct.restBetweenSets} seconds`);
        }
        if (struct.exerciseCount) {
          requirements.push(`Target Exercise Count: ${struct.exerciseCount} exercises`);
        }
      }

      if (structuredRequest.constraints) {
        const constraints = structuredRequest.constraints;
        if (constraints.avoidExercises && constraints.avoidExercises.length > 0) {
          requirements.push(`Avoid Exercises: ${constraints.avoidExercises.join(', ')}`);
        }
        if (constraints.preferredExercises && constraints.preferredExercises.length > 0) {
          requirements.push(`Preferred Exercises: ${constraints.preferredExercises.join(', ')}`);
        }
        if (constraints.maxSets) {
          requirements.push(`Maximum Sets per Exercise: ${constraints.maxSets}`);
        }
        if (constraints.minSets) {
          requirements.push(`Minimum Sets per Exercise: ${constraints.minSets}`);
        }
      }

      if (structuredRequest.additionalNotes) {
        requirements.push(`Additional Notes: ${structuredRequest.additionalNotes}`);
      }
    }

    // Standard requirements
    if (structuredRequest.duration || userMetadata.timeAvailable || userMetadata.minutesPerSession) {
      const duration = structuredRequest.duration || userMetadata.timeAvailable || userMetadata.minutesPerSession;
      requirements.push(`Time Constraint: Design the workout to fit exactly ${duration} minutes including warm-up and cool-down`);
    }

    if (userMetadata.goals && userMetadata.goals.length > 0) {
      requirements.push(`User Goals: ${userMetadata.goals.join(', ')} - tailor exercises to support these objectives`);
    }

    if (userMetadata.injuries && userMetadata.injuries.length > 0) {
      requirements.push(`Injury Considerations: Avoid or modify exercises that may aggravate: ${userMetadata.injuries.join(', ')}`);
    }

    if (userMetadata.equipment && userMetadata.equipment.length > 0) {
      requirements.push(`Available Equipment: ${userMetadata.equipment.join(', ')} - use only these equipment types`);
    }

    return requirements.length > 0 ? requirements.join('\n') : 'No specific additional requirements.';
  }

  /**
   * Call specific AI model based on provider with professional system prompts
   */
  async callSpecificAIModel(modelConfig, prompt) {
    const professionalSystemPrompt = this.getProfessionalSystemPrompt();

    if (modelConfig.provider === 'openai') {
      return clients.openai.chat.completions.create({
        model: modelConfig.model,
        messages: [
          { role: 'system', content: professionalSystemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      });
    } else if (modelConfig.provider === 'claude') {
      return clients.claude.messages.create({
        model: modelConfig.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: professionalSystemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      });
    }

    throw new Error(`Unsupported AI provider: ${modelConfig.provider}`);
  }

  /**
   * Get professional system prompt for elite personal trainer expertise
   */
  getProfessionalSystemPrompt() {
    return `You are an ELITE PERSONAL TRAINER with advanced certifications and 10+ years of professional experience:

🏆 CREDENTIALS & EXPERTISE:
- NASM-CPT (National Academy of Sports Medicine - Certified Personal Trainer)
- CSCS (Certified Strength and Conditioning Specialist)
- ACSM-CPT (American College of Sports Medicine)
- Corrective Exercise Specialist (NASM-CES)
- Performance Enhancement Specialist (NASM-PES)
- Functional Movement Screen (FMS) Level 2
- 10+ years designing personalized workout programs for diverse clientele

🧠 EXERCISE SCIENCE FOUNDATION:
- Advanced understanding of biomechanics, kinesiology, and exercise physiology
- Expert knowledge of periodization principles and progressive overload
- Specialization in movement quality, injury prevention, and performance optimization
- Evidence-based approach using peer-reviewed research and best practices

💪 PROFESSIONAL STANDARDS:
- Every workout must demonstrate the expertise of a certified professional
- Apply scientific principles of training adaptation and recovery
- Prioritize safety, proper form, and individual limitations
- Use professional terminology and coaching cues
- Provide detailed exercise progressions and regressions

🎯 WORKOUT PROGRAMMING EXPERTISE:
- Systematic approach to exercise selection and sequencing
- Proper warm-up protocols and movement preparation
- Strategic rest intervals based on training goals
- Comprehensive cool-down and recovery protocols
- Integration of corrective exercises when needed

CRITICAL: Generate workout plans that reflect the knowledge and expertise of a certified personal trainer with advanced education in exercise science. Every aspect should demonstrate professional competency and evidence-based programming.

Respond ONLY with valid JSON format - no additional text or formatting.`;
  }

  /**
   * Call the AI model to generate workout
   */
  async callAIModel(modelConfig, prompt, correlationId) {
    try {
      const startTime = Date.now();

      const response = await Promise.race([
        this.callSpecificAIModel(modelConfig, prompt),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI model timeout')), this.config.timeoutMs)
        )
      ]);

      const duration = Date.now() - startTime;

      // Handle different response formats based on provider
      let responseContent;
      let tokensUsed;

      if (modelConfig.provider === 'openai') {
        responseContent = response.choices[0].message.content;
        tokensUsed = response.usage?.total_tokens || 'unknown';
      } else if (modelConfig.provider === 'claude') {
        responseContent = response.content[0].text;
        tokensUsed = response.usage?.input_tokens + response.usage?.output_tokens || 'unknown';
      }

      monitoringService.log('info', 'AI model call completed', {
        model: modelConfig.model,
        provider: modelConfig.provider,
        duration,
        tokensUsed
      }, correlationId);

      // Track cost and performance for workout generation
      try {
        let promptTokens, responseTokens;

        if (modelConfig.provider === 'openai') {
          promptTokens = response.usage?.prompt_tokens || Math.ceil(prompt.length / 4);
          responseTokens = response.usage?.completion_tokens || Math.ceil(responseContent.length / 4);
        } else if (modelConfig.provider === 'claude') {
          promptTokens = response.usage?.input_tokens || Math.ceil(prompt.length / 4);
          responseTokens = response.usage?.output_tokens || Math.ceil(responseContent.length / 4);
        }

        const quality = this.calculateWorkoutQuality(responseContent);

        await costMonitoringService.trackAPICall(
          modelConfig,
          promptTokens,
          responseTokens,
          duration,
          quality,
          'workout-service'
        );
      } catch (costError) {
        monitoringService.log('warn', 'Failed to track workout generation cost', {
          error: costError.message
        }, correlationId);
      }

      return responseContent;

    } catch (error) {
      monitoringService.log('error', 'AI model call failed', {
        model: modelConfig.model,
        error: error.message
      }, correlationId);

      throw new Error(`Failed to generate workout: ${error.message}`);
    }
  }

  /**
   * Parse and validate the AI response with enhanced type consistency
   */
  parseWorkoutResponse(aiResponse, originalRequest = null) {
    try {
      // Clean the response - remove any markdown formatting or extra text
      let cleanResponse = aiResponse.trim();

      // Remove markdown code blocks if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // Parse JSON
      const workoutPlan = JSON.parse(cleanResponse);

      // Enhanced workout type consistency check with robust mapping
      if (originalRequest) {
        const structuredRequest = this.parseWorkoutRequest(originalRequest);
        if (structuredRequest.workoutType) {
          // Force the correct workout type if it was specified
          workoutPlan.type = structuredRequest.workoutType;
        }
      }

      // Validate required fields
      this.validateWorkoutPlan(workoutPlan);

      return workoutPlan;

    } catch (error) {
      throw new Error(`Failed to parse workout response: ${error.message}`);
    }
  }

  /**
   * Validate the generated professional workout plan
   */
  validateWorkoutPlan(workoutPlan) {
    // Check for core professional structure
    const requiredFields = ['type', 'duration', 'warmup', 'mainWorkout', 'cooldown'];

    for (const field of requiredFields) {
      if (!workoutPlan[field]) {
        throw new Error(`Professional workout plan missing required field: ${field}`);
      }
    }

    // Validate main workout structure
    if (!workoutPlan.mainWorkout.exercises || !Array.isArray(workoutPlan.mainWorkout.exercises) || workoutPlan.mainWorkout.exercises.length === 0) {
      throw new Error('Professional workout plan must include at least one main exercise');
    }

    // Validate each exercise has professional details
    workoutPlan.mainWorkout.exercises.forEach((exercise, index) => {
      const requiredExerciseFields = ['name', 'instructions', 'sets', 'reps'];
      for (const field of requiredExerciseFields) {
        if (!exercise[field]) {
          throw new Error(`Exercise ${index + 1} missing required professional field: ${field}`);
        }
      }

      // Check for professional coaching elements
      if (!exercise.formCues || !Array.isArray(exercise.formCues)) {
        throw new Error(`Exercise ${index + 1} missing professional form cues`);
      }
    });

    // Validate warmup structure (array format)
    if (!Array.isArray(workoutPlan.warmup)) {
      throw new Error('Professional workout plan must include warmup exercises array');
    }

    // Validate cooldown structure (array format)
    if (!Array.isArray(workoutPlan.cooldown)) {
      throw new Error('Professional workout plan must include cooldown exercises array');
    }

    // Validate professional notes and coaching tips
    if (!workoutPlan.professionalNotes) {
      throw new Error('Professional workout plan must include professional notes');
    }

    if (!workoutPlan.coachingTips || !Array.isArray(workoutPlan.coachingTips)) {
      throw new Error('Professional workout plan must include coaching tips array');
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

  /**
   * Generate debug information for frontend developers
   */
  generateDebugInfo(workoutRequest, workoutPlan, modelConfig) {
    const structuredRequest = this.parseWorkoutRequest(workoutRequest);

    return {
      requestFormat: typeof workoutRequest === 'string' ? 'string' : 'object',
      isEnhancedFormat: structuredRequest.isEnhancedFormat,
      parsedWorkoutType: structuredRequest.workoutType,

      modelUsed: modelConfig.model,
      modelProvider: modelConfig.provider,
      professionalStandards: {
        certificationLevel: 'NASM-CPT, CSCS, ACSM',
        programmingApproach: 'Evidence-based exercise science',
        safetyPriority: 'Maximum safety with optimal challenge',
        qualityScore: this.calculateWorkoutQuality(JSON.stringify(workoutPlan))
      },
      supportedWorkoutTypes: [
        'pilates', 'crossfit', 'yoga', 'pull_day', 'push_day', 'leg_day',
        'upper_body', 'lower_body', 'full_body', 'core', 'functional',
        'hiit', 'cardio', 'flexibility', 'strength', 'mixed'
      ],
      requestProcessingNotes: {
        workoutTypeDetected: !!structuredRequest.workoutType,
        durationExtracted: !!structuredRequest.duration,
        intensityDetected: !!structuredRequest.intensity,
        enhancedFeaturesUsed: structuredRequest.isEnhancedFormat,
        professionalPromptUsed: true,
        exerciseScienceApplied: true
      },
      workoutStructureValidation: {
        hasWarmup: !!workoutPlan.warmup,
        hasMainWorkout: !!workoutPlan.mainWorkout,
        hasCooldown: !!workoutPlan.cooldown,
        exerciseCount: workoutPlan.mainWorkout?.exercises?.length || 0
      }
    };
  }

  /**
   * Apply personalization adjustments to structured request
   * @param {Object} structuredRequest - Structured workout request
   * @param {Object} personalization - Personalization configuration
   */
  applyPersonalizationToRequest(structuredRequest, personalization) {
    // Apply duration personalization
    if (personalization.personalization.duration?.recommended) {
      structuredRequest.minutesPerSession = personalization.personalization.duration.recommended;
      structuredRequest.duration = personalization.personalization.duration.recommended;
    }

    // Apply intensity personalization
    if (personalization.personalization.intensity?.recommended) {
      structuredRequest.intensityTarget = personalization.personalization.intensity.recommended;
    }

    // Apply volume personalization
    if (personalization.personalization.volume?.modifier) {
      structuredRequest.volumeModifier = personalization.personalization.volume.modifier;
    }

    // Apply exercise selection personalization
    if (personalization.personalization.exerciseSelection) {
      const exerciseSelection = personalization.personalization.exerciseSelection;

      if (exerciseSelection.preferredEquipment) {
        structuredRequest.equipment = exerciseSelection.preferredEquipment;
      }

      if (exerciseSelection.focusAreas) {
        structuredRequest.focusAreas = exerciseSelection.focusAreas;
      }

      if (exerciseSelection.varietyLevel) {
        structuredRequest.varietyLevel = exerciseSelection.varietyLevel;
      }

      if (exerciseSelection.complexityLevel) {
        structuredRequest.complexityLevel = exerciseSelection.complexityLevel;
      }
    }

    // Apply structure personalization
    if (personalization.personalization.structure) {
      const structure = personalization.personalization.structure;

      if (structure.warmupDuration) {
        structuredRequest.warmupDuration = structure.warmupDuration;
      }

      if (structure.cooldownDuration) {
        structuredRequest.cooldownDuration = structure.cooldownDuration;
      }

      if (structure.restPeriods) {
        structuredRequest.restPeriods = structure.restPeriods;
      }
    }
  }

  /**
   * Build personalization guidance for AI prompt
   * @param {Object} personalization - Personalization configuration
   * @returns {string} Personalization guidance text
   */
  buildPersonalizationGuidance(personalization) {
    const guidance = [];

    guidance.push(`🧠 INTELLIGENT PERSONALIZATION INSIGHTS:`);
    guidance.push(`   • Data Quality: ${personalization.metadata.dataQuality.toUpperCase()}`);
    guidance.push(`   • Personalization Confidence: ${(personalization.metadata.personalizationConfidence * 100).toFixed(0)}%`);

    // Duration guidance
    if (personalization.personalization.duration?.reasoning?.length > 0) {
      guidance.push(`\n⏱️ DURATION PERSONALIZATION:`);
      personalization.personalization.duration.reasoning.forEach(reason => {
        guidance.push(`   • ${reason}`);
      });
      if (personalization.personalization.duration.adjustment !== 0) {
        guidance.push(`   • Recommended Duration: ${personalization.personalization.duration.recommended} minutes (${personalization.personalization.duration.adjustment > 0 ? '+' : ''}${personalization.personalization.duration.adjustment} min adjustment)`);
      }
    }

    // Intensity guidance
    if (personalization.personalization.intensity?.reasoning?.length > 0) {
      guidance.push(`\n💪 INTENSITY PERSONALIZATION:`);
      personalization.personalization.intensity.reasoning.forEach(reason => {
        guidance.push(`   • ${reason}`);
      });
      guidance.push(`   • Recommended Intensity Level: ${(personalization.personalization.intensity.recommended * 100).toFixed(0)}%`);
    }

    // Volume guidance
    if (personalization.personalization.volume?.reasoning?.length > 0) {
      guidance.push(`\n📊 VOLUME PERSONALIZATION:`);
      personalization.personalization.volume.reasoning.forEach(reason => {
        guidance.push(`   • ${reason}`);
      });
      const volumeChange = ((personalization.personalization.volume.modifier - 1) * 100).toFixed(0);
      if (Math.abs(volumeChange) > 5) {
        guidance.push(`   • Volume Adjustment: ${volumeChange > 0 ? '+' : ''}${volumeChange}%`);
      }
    }

    // Progressive overload insights
    if (personalization.analytics?.progressiveOverload) {
      const po = personalization.analytics.progressiveOverload;
      if (po.shouldProgress) {
        guidance.push(`\n📈 PROGRESSIVE OVERLOAD READY:`);
        guidance.push(`   • User is ready for progression based on performance history`);
        guidance.push(`   • Progression Type: ${po.progressionType || 'gradual_increase'}`);
        if (po.reasoning) {
          guidance.push(`   • Reasoning: ${po.reasoning}`);
        }
      }
    }

    // Risk assessment guidance
    if (personalization.analytics?.riskAssessment) {
      const risks = personalization.analytics.riskAssessment;
      const highRisks = [];

      if (risks.overtraining?.riskLevel === 'high') highRisks.push('overtraining');
      if (risks.injury?.riskLevel === 'high') highRisks.push('injury');
      if (risks.burnout?.riskLevel === 'high') highRisks.push('burnout');

      if (highRisks.length > 0) {
        guidance.push(`\n⚠️ RISK MITIGATION REQUIRED:`);
        highRisks.forEach(risk => {
          guidance.push(`   • HIGH ${risk.toUpperCase()} RISK - Apply conservative approach`);
        });
      }
    }

    // Prompt enhancements
    if (personalization.promptEnhancements) {
      const enhancements = personalization.promptEnhancements;

      if (enhancements.intensityGuidance) {
        guidance.push(`\n🎯 INTENSITY GUIDANCE: ${enhancements.intensityGuidance}`);
      }

      if (enhancements.exerciseGuidance) {
        guidance.push(`🏋️ EXERCISE SELECTION: ${enhancements.exerciseGuidance}`);
      }

      if (enhancements.safetyGuidance) {
        guidance.push(`🛡️ SAFETY PRIORITY: ${enhancements.safetyGuidance}`);
      }
    }

    return guidance.join('\n');
  }

  /**
   * Extract workout type from string request
   * @param {string} request - Workout request string
   * @returns {string} Extracted workout type
   */
  extractWorkoutTypeFromRequest(request) {
    if (!request || typeof request !== 'string') return 'functional_training';

    const lowerRequest = request.toLowerCase();

    // Common workout type patterns
    const patterns = {
      'upper body': 'upper_body',
      'lower body': 'lower_body',
      'full body': 'full_body',
      'push day': 'push_day',
      'pull day': 'pull_day',
      'leg day': 'leg_day',
      'strength': 'strength',
      'cardio': 'cardio',
      'hiit': 'hiit',
      'yoga': 'yoga',
      'pilates': 'pilates',
      'crossfit': 'crossfit',
      'core': 'core',
      'functional': 'functional'
    };

    for (const [pattern, type] of Object.entries(patterns)) {
      if (lowerRequest.includes(pattern)) {
        return type;
      }
    }

    return 'functional_training';
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      const modelConfig = this.getModelConfig();

      return {
        status: 'healthy',
        model: modelConfig.model,
        tier: modelConfig.tier,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
const workoutService = new WorkoutService();

module.exports = workoutService;
