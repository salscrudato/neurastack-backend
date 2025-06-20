const clients = require('./vendorClients');
const ensembleConfig = require('../config/ensemblePrompts');
const monitoringService = require('./monitoringService');
const cacheService = require('./cacheService');
const costMonitoringService = require('./costMonitoringService');

/**
 * Workout Generation Service
 * Handles AI-powered workout plan generation using optimized models
 */
class WorkoutService {
  constructor() {
    this.config = {
      timeoutMs: 15000, // 15 second timeout
      maxTokens: 1500,  // Sufficient for detailed workout plans
      temperature: 0.7  // Balanced creativity and consistency
    };
  }

  /**
   * Generate a personalized workout plan
   * @param {Object} userMetadata - User information and preferences
   * @param {Array} workoutHistory - Previous workout data
   * @param {string|Object} workoutRequest - Workout request (string for backward compatibility, object for enhanced structure)
   * @param {string} userId - Optional user ID for tracking
   * @returns {Promise<Object>} Generated workout plan
   */
  async generateWorkout(userMetadata, workoutHistory, workoutRequest, userId = null) {
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

      // Build the workout generation prompt
      const prompt = this.buildWorkoutPrompt(userMetadata, workoutHistory, workoutRequest);

      // Get the appropriate model based on tier
      const modelConfig = this.getModelConfig();

      // Generate workout using AI
      const aiResponse = await this.callAIModel(modelConfig, prompt, correlationId);

      // Parse and validate the response with original request context
      const workoutPlan = this.parseWorkoutResponse(aiResponse, workoutRequest);

      // Log success
      monitoringService.log('info', 'Workout generation completed', {
        userId,
        model: modelConfig.model,
        workoutType: workoutPlan.type || 'unknown'
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
            userId
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
      monitoringService.log('error', 'Workout generation failed', {
        userId,
        error: error.message,
        stack: error.stack
      }, correlationId);

      throw error;
    }
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

    // Handle both string and object formats
    if (typeof workoutRequest === 'string') {
      if (workoutRequest.trim().length === 0) {
        throw new Error('workoutRequest cannot be empty');
      }
      if (workoutRequest.length > 2000) {
        throw new Error('workoutRequest must be less than 2000 characters');
      }
    } else if (typeof workoutRequest === 'object') {
      // Validate enhanced format
      if (workoutRequest.workoutSpecification) {
        if (!workoutRequest.workoutSpecification.workoutType) {
          throw new Error('workoutSpecification.workoutType is required');
        }
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

    // Validate fitness level
    const validFitnessLevels = ['beginner', 'intermediate', 'advanced'];
    if (!validFitnessLevels.includes(userMetadata.fitnessLevel.toLowerCase())) {
      throw new Error('userMetadata.fitnessLevel must be one of: beginner, intermediate, advanced');
    }
  }

  /**
   * Get the appropriate AI model configuration based on tier
   */
  getModelConfig() {
    const tier = ensembleConfig.meta.tier;
    const models = ensembleConfig.models;

    // Use GPT-4o models for workout generation (best for structured output)
    return {
      provider: 'openai',
      model: models.gpt4o.model,
      tier: tier
    };
  }

  /**
   * Build the workout generation prompt with enhanced structured data processing
   */
  buildWorkoutPrompt(userMetadata, workoutHistory, workoutRequest) {
    // Parse structured workout request if it's an object
    const structuredRequest = this.parseWorkoutRequest(workoutRequest);

    const historyContext = workoutHistory && workoutHistory.length > 0
      ? `\n\nPrevious Workout History:\n${JSON.stringify(workoutHistory.slice(-5), null, 2)}` // Last 5 workouts
      : '\n\nNo previous workout history available.';

    // Build structured prompt with explicit workout type requirements
    const workoutTypeInstruction = structuredRequest.workoutType
      ? `\nIMPORTANT: The workout type MUST be "${structuredRequest.workoutType}". Set the "type" field to exactly "${structuredRequest.workoutType}".`
      : '';

    const specificRequirements = this.buildSpecificRequirements(structuredRequest, userMetadata);

    return `You are an expert fitness trainer and workout designer. Generate a personalized workout plan based on the structured user information and requirements.

User Information:
${JSON.stringify(userMetadata, null, 2)}${historyContext}

Structured Workout Requirements:
${JSON.stringify(structuredRequest, null, 2)}${workoutTypeInstruction}

${specificRequirements}

Please generate a comprehensive workout plan in the following JSON format:
{
  "type": "${structuredRequest.workoutType || 'strength/cardio/mixed/flexibility/pull/push/legs/upper/lower/full_body'}",
  "duration": "${structuredRequest.duration || userMetadata.timeAvailable || userMetadata.minutesPerSession || 30} minutes",
  "difficulty": "${userMetadata.fitnessLevel || 'beginner/intermediate/advanced'}",
  "equipment": ${JSON.stringify(userMetadata.equipment || [])},
  "exercises": [
    {
      "name": "Exercise Name",
      "category": "strength/cardio/flexibility",
      "sets": 3,
      "reps": "10-12 or time duration",
      "rest": "rest time between sets",
      "instructions": "Clear step-by-step instructions",
      "modifications": "Easier/harder variations",
      "targetMuscles": ["muscle", "groups"]
    }
  ],
  "warmup": [
    {
      "name": "Warmup Exercise",
      "duration": "3-5 minutes",
      "instructions": "How to perform"
    }
  ],
  "cooldown": [
    {
      "name": "Cooldown Exercise", 
      "duration": "5 minutes",
      "instructions": "How to perform"
    }
  ],
  "notes": "Additional tips, safety considerations, and progression advice",
  "calorieEstimate": "estimated calories burned",
  "tags": ["relevant", "workout", "tags"]
}

Important Guidelines:
1. Ensure the workout is appropriate for the user's age and fitness level
2. Consider any equipment limitations or preferences mentioned
3. Include proper warm-up and cool-down exercises
4. Provide clear, safe instructions for each exercise
5. Consider the user's workout history to avoid repetition and ensure progression
6. Make the workout engaging and achievable
7. Include modifications for different skill levels
8. CRITICAL: Use the exact workout type specified in the requirements - do not interpret or change it
9. Respond ONLY with valid JSON - no additional text or formatting`;
  }

  /**
   * Parse workout request - handle both string and enhanced structured object formats
   */
  parseWorkoutRequest(workoutRequest) {
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

      // Extract workout type from common patterns (order matters - more specific patterns first)
      const workoutTypePatterns = {
        'pilates': ['pilates'],
        'crossfit': ['crossfit', 'cross fit'],
        'yoga': ['yoga'],
        'pull': ['pull day', 'pull workout', 'pulling exercises'],
        'push': ['push day', 'push workout', 'pushing exercises'],
        'legs': ['leg day', 'leg workout'],
        'upper': ['upper body', 'upper workout'],
        'lower': ['lower body', 'lower workout'],
        'full_body': ['full body', 'total body', 'whole body'],
        'core': ['core', 'abs', 'abdominal', 'core strengthening'],
        'functional': ['functional', 'movement patterns'],
        'hiit': ['hiit', 'high intensity', 'interval training'],
        'cardio': ['cardio', 'cardiovascular', 'aerobic'],
        'flexibility': ['flexibility', 'stretching', 'yoga'],
        'strength': ['strength', 'weight training', 'resistance'],
        'mixed': ['mixed', 'combination', 'varied']
      };

      for (const [type, patterns] of Object.entries(workoutTypePatterns)) {
        if (patterns.some(pattern => lowerRequest.includes(pattern))) {
          structuredRequest.workoutType = type;
          break;
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

      if (typeDescriptions[structuredRequest.workoutType]) {
        requirements.push(`Workout Type Focus: ${typeDescriptions[structuredRequest.workoutType]}`);
      }
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
   * Call the AI model to generate workout
   */
  async callAIModel(modelConfig, prompt, correlationId) {
    try {
      const startTime = Date.now();

      const response = await Promise.race([
        clients.openai.chat.completions.create({
          model: modelConfig.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert fitness trainer. Generate workout plans in valid JSON format only.'
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI model timeout')), this.config.timeoutMs)
        )
      ]);

      const duration = Date.now() - startTime;
      const responseContent = response.choices[0].message.content;

      monitoringService.log('info', 'AI model call completed', {
        model: modelConfig.model,
        duration,
        tokensUsed: response.usage?.total_tokens || 'unknown'
      }, correlationId);

      // Track cost and performance for workout generation
      try {
        const promptTokens = response.usage?.prompt_tokens || Math.ceil(prompt.length / 4);
        const responseTokens = response.usage?.completion_tokens || Math.ceil(responseContent.length / 4);
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

      // Enhanced workout type consistency check
      if (originalRequest) {
        const structuredRequest = this.parseWorkoutRequest(originalRequest);
        if (structuredRequest.workoutType) {
          // Force the correct workout type if it was specified
          workoutPlan.type = structuredRequest.workoutType;

          // Ensure tags include the correct workout type
          if (!workoutPlan.tags) {
            workoutPlan.tags = [];
          }
          if (!workoutPlan.tags.includes(structuredRequest.workoutType)) {
            workoutPlan.tags.unshift(structuredRequest.workoutType);
          }

          // Add workout type labels to tags for better categorization
          const workoutTypeLabels = {
            'pilates': 'pilates workout',
            'crossfit': 'crossfit training',
            'yoga': 'yoga practice',
            'pull': 'pull day',
            'push': 'push day',
            'legs': 'leg day',
            'upper': 'upper body',
            'lower': 'lower body',
            'full_body': 'full body workout'
          };

          const typeLabel = workoutTypeLabels[structuredRequest.workoutType];
          if (typeLabel && !workoutPlan.tags.includes(typeLabel)) {
            workoutPlan.tags.push(typeLabel);
          }
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
   * Validate the generated workout plan
   */
  validateWorkoutPlan(workoutPlan) {
    const requiredFields = ['type', 'duration', 'exercises'];

    for (const field of requiredFields) {
      if (!workoutPlan[field]) {
        throw new Error(`Generated workout plan missing required field: ${field}`);
      }
    }

    if (!Array.isArray(workoutPlan.exercises) || workoutPlan.exercises.length === 0) {
      throw new Error('Generated workout plan must include at least one exercise');
    }

    // Validate each exercise has required fields
    workoutPlan.exercises.forEach((exercise, index) => {
      const requiredExerciseFields = ['name', 'instructions'];
      for (const field of requiredExerciseFields) {
        if (!exercise[field]) {
          throw new Error(`Exercise ${index + 1} missing required field: ${field}`);
        }
      }
    });
  }

  /**
   * Calculate quality score for workout generation
   */
  calculateWorkoutQuality(responseContent) {
    let quality = 0.5; // Base quality

    try {
      // Try to parse as JSON to check structure
      const parsed = JSON.parse(responseContent);

      // Check for required fields
      if (parsed.type && parsed.duration && parsed.exercises) {
        quality += 0.2;
      }

      // Check exercise count (good range is 4-12 exercises)
      if (parsed.exercises && Array.isArray(parsed.exercises)) {
        const exerciseCount = parsed.exercises.length;
        if (exerciseCount >= 4 && exerciseCount <= 12) {
          quality += 0.2;
        } else if (exerciseCount > 0) {
          quality += 0.1;
        }
      }

      // Check for warmup and cooldown
      if (parsed.warmup && parsed.cooldown) {
        quality += 0.1;
      }

      // Check for detailed instructions
      if (parsed.exercises && parsed.exercises.some(ex => ex.instructions && ex.instructions.length > 20)) {
        quality += 0.1;
      }

      // Check for safety considerations
      if (parsed.notes && parsed.notes.length > 10) {
        quality += 0.1;
      }

    } catch (parseError) {
      // If not valid JSON, lower quality
      quality -= 0.3;
    }

    return Math.max(0, Math.min(1, quality));
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
