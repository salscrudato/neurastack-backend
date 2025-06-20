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

      // Add debugging information for frontend developers
      const debugInfo = this.generateDebugInfo(workoutRequest, workoutPlan, modelConfig);

      // Log success with enhanced information
      monitoringService.log('info', 'Workout generation completed', {
        userId,
        model: modelConfig.model,
        workoutType: workoutPlan.type || 'unknown',
        typeConsistency: workoutPlan.typeConsistency?.wasAdjusted || false,
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
   */
  getModelConfig() {
    const tier = ensembleConfig.meta.tier;
    const models = ensembleConfig.models;

    // Use cost-effective models with professional prompting for quality
    if (tier === 'premium') {
      // Premium tier: Use Claude Opus for superior exercise science knowledge
      return {
        provider: 'claude',
        model: models.claude.model, // claude-opus-4-20250514
        tier: tier
      };
    } else {
      // Free tier: Use GPT-4o-mini with professional prompting for cost efficiency
      return {
        provider: 'openai',
        model: models.gpt4o.model, // gpt-4o-mini with professional standards
        tier: tier
      };
    }
  }

  /**
   * Build professional workout generation prompt with elite personal trainer expertise
   */
  buildWorkoutPrompt(userMetadata, workoutHistory, workoutRequest) {
    // Parse structured workout request if it's an object
    const structuredRequest = this.parseWorkoutRequest(workoutRequest);

    // Build comprehensive client assessment
    const clientAssessment = this.buildClientAssessment(userMetadata, workoutHistory);

    // Build professional workout specification
    const workoutSpecification = this.buildWorkoutSpecification(structuredRequest, userMetadata);

    // Build professional requirements and safety considerations
    const professionalRequirements = this.buildProfessionalRequirements(structuredRequest, userMetadata);

    return `🏋️‍♂️ PROFESSIONAL WORKOUT PROGRAMMING SESSION

📋 CLIENT ASSESSMENT:
${clientAssessment}

🎯 WORKOUT SPECIFICATION:
${workoutSpecification}

⚡ PROFESSIONAL PROGRAMMING REQUIREMENTS:
${professionalRequirements}

🏆 GENERATE PROFESSIONAL WORKOUT PROGRAM:

Create a comprehensive, evidence-based workout program that demonstrates elite personal trainer expertise. Use the following professional JSON format:

{
  "type": "${structuredRequest.workoutType || 'functional_training'}",
  "duration": ${structuredRequest.duration || userMetadata.timeAvailable || userMetadata.minutesPerSession || 45},
  "difficulty": "${userMetadata.fitnessLevel || 'intermediate'}",
  "equipment": ${JSON.stringify(userMetadata.equipment || [])},
  "professionalNotes": {
    "trainerCertification": "NASM-CPT, CSCS, ACSM",
    "programmingPrinciples": ["Progressive Overload", "Specificity", "Recovery", "Individual Adaptation"],
    "safetyPriority": "Maximum safety with optimal challenge"
  },
  "warmup": {
    "duration": "8-10 minutes",
    "purpose": "Movement preparation, activation, injury prevention",
    "phases": [
      {
        "phase": "General Warm-up",
        "duration": "3-4 minutes",
        "exercises": [
          {
            "name": "Exercise Name",
            "duration": "60 seconds",
            "instructions": "Detailed coaching cues with biomechanical focus",
            "purpose": "Increase core temperature and blood flow"
          }
        ]
      },
      {
        "phase": "Dynamic Preparation",
        "duration": "4-5 minutes",
        "exercises": [
          {
            "name": "Movement-specific exercise",
            "sets": 1,
            "reps": "8-12",
            "instructions": "Professional form cues and movement quality focus",
            "purpose": "Prepare specific movement patterns"
          }
        ]
      }
    ]
  },
  "mainWorkout": {
    "structure": "Systematic progression from compound to isolation movements",
    "exercises": [
      {
        "name": "Exercise Name",
        "category": "compound/isolation/power/corrective",
        "primaryMuscles": ["specific muscle groups"],
        "secondaryMuscles": ["supporting muscles"],
        "sets": 3,
        "reps": "8-12",
        "restInterval": "90-120 seconds",
        "rpe": "7-8 (Rate of Perceived Exertion)",
        "tempo": "2-1-2-1 (eccentric-pause-concentric-pause)",
        "instructions": "Detailed step-by-step coaching with safety emphasis",
        "formCues": ["Key coaching points for proper technique"],
        "commonMistakes": ["What to avoid for safety and effectiveness"],
        "progressions": "How to make exercise more challenging",
        "regressions": "How to modify for limitations or beginners",
        "equipmentAlternatives": "Substitutions if equipment unavailable"
      }
    ]
  },
  "cooldown": {
    "duration": "8-10 minutes",
    "purpose": "Recovery initiation, flexibility, stress reduction",
    "phases": [
      {
        "phase": "Active Recovery",
        "duration": "3-4 minutes",
        "exercises": [
          {
            "name": "Low-intensity movement",
            "duration": "2-3 minutes",
            "instructions": "Gradual heart rate reduction protocol"
          }
        ]
      },
      {
        "phase": "Static Stretching",
        "duration": "5-6 minutes",
        "exercises": [
          {
            "name": "Targeted stretch",
            "duration": "30-60 seconds",
            "instructions": "Proper stretching technique and breathing",
            "targetMuscles": ["muscles worked during session"]
          }
        ]
      }
    ]
  },
  "professionalGuidance": {
    "intensityGuidance": "RPE scale usage and heart rate zones",
    "progressionPlan": "How to advance the program over time",
    "safetyConsiderations": "Injury prevention and contraindications",
    "recoveryRecommendations": "Rest periods and recovery protocols",
    "nutritionTips": "Pre/post workout nutrition guidance",
    "hydrationGuidance": "Fluid intake recommendations"
  },
  "calorieEstimate": "Professional estimation based on METs and body weight",
  "tags": ["evidence_based", "professional_programming", "safety_focused"],
  "nextSessionRecommendations": "Progression for subsequent workouts"
}

🎯 CRITICAL PROFESSIONAL STANDARDS:
1. Apply evidence-based exercise science principles throughout
2. Use proper periodization and progressive overload concepts
3. Include detailed biomechanical coaching cues for every exercise
4. Provide comprehensive safety considerations and contraindications
5. Ensure proper exercise sequencing based on energy systems and fatigue
6. Include RPE guidance and tempo recommendations for optimal adaptation
7. Provide both progressions and regressions for individual adaptation
8. Demonstrate the expertise level of a certified personal trainer with advanced education
9. MANDATORY: Use exact workout type "${structuredRequest.workoutType || 'functional_training'}" - do not modify
10. Respond ONLY with valid JSON - no additional text or markdown formatting

Generate a workout that clearly demonstrates professional personal training expertise and advanced exercise science knowledge.`;
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
    requirements.push(`   • Include RPE (Rate of Perceived Exertion) guidance for each exercise`);
    requirements.push(`   • Provide tempo recommendations for optimal muscle tension`);
    requirements.push(`   • Include breathing patterns and core engagement cues`);
    requirements.push(`   • Offer equipment alternatives for accessibility`);
    requirements.push(`   • Provide clear progression pathways for future sessions`);

    return requirements.join('\n');
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
          // Store the original AI-generated type for reference
          workoutPlan.originalType = workoutPlan.type;

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
            'full_body': 'full body workout',
            'upper_body': 'upper body',
            'lower_body': 'lower body',
            'leg_day': 'leg day',
            'push_day': 'push day',
            'pull_day': 'pull day',
            'hiit': 'high intensity interval training',
            'cardio': 'cardiovascular training',
            'strength': 'strength training',
            'flexibility': 'flexibility training',
            'functional': 'functional training'
          };

          const typeLabel = workoutTypeLabels[structuredRequest.workoutType];
          if (typeLabel && !workoutPlan.tags.includes(typeLabel)) {
            workoutPlan.tags.push(typeLabel);
          }

          // Add metadata about type consistency for frontend debugging
          workoutPlan.typeConsistency = {
            requested: structuredRequest.workoutType,
            aiGenerated: workoutPlan.originalType,
            final: workoutPlan.type,
            wasAdjusted: workoutPlan.originalType !== structuredRequest.workoutType
          };
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

    // Validate warmup structure
    if (!workoutPlan.warmup.phases || !Array.isArray(workoutPlan.warmup.phases)) {
      throw new Error('Professional workout plan must include structured warmup phases');
    }

    // Validate cooldown structure
    if (!workoutPlan.cooldown.phases || !Array.isArray(workoutPlan.cooldown.phases)) {
      throw new Error('Professional workout plan must include structured cooldown phases');
    }

    // Validate professional guidance
    if (!workoutPlan.professionalGuidance || !workoutPlan.professionalGuidance.safetyConsiderations) {
      throw new Error('Professional workout plan must include comprehensive safety guidance');
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
      if (parsed.warmup && parsed.cooldown && parsed.professionalGuidance) {
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
          ex.formCues && Array.isArray(ex.formCues) &&
          ex.rpe && ex.tempo
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

      // Check for professional notes and certifications
      if (parsed.professionalNotes && parsed.professionalNotes.trainerCertification) {
        quality += 0.1;
      }

      // Check for comprehensive guidance
      if (parsed.professionalGuidance &&
          parsed.professionalGuidance.intensityGuidance &&
          parsed.professionalGuidance.safetyConsiderations) {
        quality += 0.1;
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
      typeConsistency: workoutPlan.typeConsistency || null,
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
        hasProfessionalGuidance: !!workoutPlan.professionalGuidance,
        exerciseCount: workoutPlan.mainWorkout?.exercises?.length || 0
      }
    };
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
