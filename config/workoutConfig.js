/**
 * Workout Configuration
 * Centralized configuration for workout generation including prompts, templates, and AI settings
 */

// AI Model Configuration for Workout Generation - Cost Optimized
const WORKOUT_AI_CONFIG = {
  // Single optimized workout generation model - using cost-effective GPT-4o-mini
  workoutGenerator: {
    provider: 'openai',
    model: 'gpt-4o-mini', // Cost-optimized model - $0.15/$0.60 per 1M tokens vs $2.50/$10.00 for gpt-4o
    temperature: 0.25,     // Deterministic for consistent workout quality
    maxTokens: 1500,       // Sufficient for comprehensive workout plans
    timeoutMs: 60000       // 60s timeout for reliable generation
  }
};

// Single Comprehensive Workout Generation Prompt Template
const PROMPT_TEMPLATES = {
  workoutGenerator: `
You are an elite strength coach and certified personal trainer (NASM-CPT, CSCS, ACSM) with advanced expertise in exercise science, biomechanics, and program design.

TASK: Create a personalized workout plan based on the user data provided below.

USER DATA:
{userData}

SYSTEM REQUIREMENTS:
1. Return ONLY a valid JSON object matching the WORKOUT_SCHEMA below
2. No markdown, explanations, or additional text
3. Ensure JSON is properly formatted and minified

WORKOUT_SCHEMA = {
  "type": "workout_type",
  "duration": "number(minutes)",
  "difficulty": "beginner|intermediate|advanced",
  "equipment": ["strings"],
  "mainWorkout": {
    "structure": "circuit|straight_sets|superset|pyramid",
    "exercises": [
      { "name": "...", "category": "strength|cardio|flexibility", "sets":0, "reps":"...", "rest":"...",
        "instructions":"...", "targetMuscles":["..."] }
    ]
  },
  "warmup":[{ "name":"...", "duration":"...", "instructions":"..." }],
  "cooldown":[{ "name":"...", "duration":"...", "instructions":"..." }],
  "coachingTips":["...", "...", "..."]
}

CRITICAL RULES:
1. SAFETY FIRST: Always consider injuries, limitations, and fitness level
2. TIME PRECISION: Total session time MUST equal the requested duration exactly
   - Calculate: warmup + main workout + cooldown = total duration
   - Example for 45min: 8min warmup + 32min main workout + 5min cooldown = 45min
3. PROGRESSIVE SCALING: Adjust exercise count and complexity based on fitness level:
   - Beginner: 6-8 exercises, simpler movements, longer rest periods
   - Intermediate: 8-10 exercises, moderate complexity, standard rest
   - Advanced: 10-12 exercises, complex movements, shorter rest periods
4. EQUIPMENT COMPLIANCE: Only use equipment explicitly mentioned by the user
5. GOAL ALIGNMENT: Structure workout to directly support stated fitness goals
6. INJURY ACCOMMODATION: Modify or avoid exercises that conflict with stated injuries
7. PROFESSIONAL STANDARDS: Include detailed form cues, proper exercise sequencing, and evidence-based programming
8. COACHING EXCELLENCE: Provide at least 3 actionable coaching tips for workout success

WORKOUT HISTORY INTEGRATION:
- If workout history is provided, consider previous exercises for progression and variety
- Implement progressive overload principles when appropriate
- Avoid excessive repetition of recent exercises unless specifically requested

RESPONSE FORMAT: Return only the JSON object with no additional formatting or text.
`.trim()
};

// Default workout parameters for fallback scenarios
const DEFAULT_WORKOUT_PARAMS = {
  duration: 45,
  difficulty: 'intermediate',
  equipment: [],
  type: 'full_body'
};

// Validation rules for user input
const VALIDATION_RULES = {
  age: { min: 13, max: 100 },
  duration: { min: 10, max: 120 },
  fitnessLevel: ['beginner', 'intermediate', 'advanced', 'expert'],
  // Note: We're removing strict validation for goals, equipment, etc. to allow free-form text
};

module.exports = {
  AI_CONFIG: WORKOUT_AI_CONFIG,
  PROMPT_TEMPLATES,
  DEFAULT_PARAMS: DEFAULT_WORKOUT_PARAMS,
  VALIDATION_RULES,
  
  // Helper function to get AI config based on stage
  getAIConfig: (stage) => {
    return WORKOUT_AI_CONFIG[stage] || WORKOUT_AI_CONFIG.workoutGenerator;
  },
  
  // Helper function to build user data string for prompt crafting
  buildUserDataString: (userMetadata, workoutHistory, otherInformation) => {
    const userData = [];
    
    // Basic user information
    if (userMetadata.age) userData.push(`Age: ${userMetadata.age}`);
    if (userMetadata.gender) userData.push(`Gender: ${userMetadata.gender}`);
    if (userMetadata.weight) userData.push(`Weight: ${userMetadata.weight}kg`);
    if (userMetadata.fitnessLevel) userData.push(`Fitness Level: ${userMetadata.fitnessLevel}`);
    
    // Goals (flexible - can be array or string)
    if (userMetadata.goals) {
      const goals = Array.isArray(userMetadata.goals) ? userMetadata.goals.join(', ') : userMetadata.goals;
      userData.push(`Goals: ${goals}`);
    }
    
    // Equipment (flexible - can be array or string)
    if (userMetadata.equipment) {
      const equipment = Array.isArray(userMetadata.equipment) ? userMetadata.equipment.join(', ') : userMetadata.equipment;
      userData.push(`Available Equipment: ${equipment}`);
    }
    
    // Injuries/limitations (flexible - can be array or string)
    if (userMetadata.injuries && userMetadata.injuries.length > 0) {
      const injuries = Array.isArray(userMetadata.injuries) ? userMetadata.injuries.join(', ') : userMetadata.injuries;
      userData.push(`Injuries/Limitations: ${injuries}`);
    }
    
    // Time constraints
    if (userMetadata.timeAvailable) userData.push(`Time Available: ${userMetadata.timeAvailable} minutes`);
    if (userMetadata.daysPerWeek) userData.push(`Workout Frequency: ${userMetadata.daysPerWeek} days per week`);
    
    // Workout type preference
    if (userMetadata.workoutType) userData.push(`Preferred Workout Type: ${userMetadata.workoutType}`);
    
    // Other free-form information
    if (otherInformation) userData.push(`Additional Information: ${otherInformation}`);
    
    // Enhanced workout history analysis for progressive overload
    if (workoutHistory && workoutHistory.length > 0) {
      userData.push(`Recent Workout History: User has completed ${workoutHistory.length} recent workouts`);
      const recentTypes = workoutHistory.slice(0, 3).map(w => w.type || 'general').join(', ');
      userData.push(`Recent Workout Types: ${recentTypes}`);

      // Progressive overload analysis
      const completedWorkouts = workoutHistory.filter(w => w.completed);
      if (completedWorkouts.length > 0) {
        const avgRating = completedWorkouts.reduce((sum, w) => sum + (w.feedback?.rating || 3), 0) / completedWorkouts.length;
        userData.push(`Average Workout Rating: ${avgRating.toFixed(1)}/5 (adjust difficulty accordingly)`);

        // Check for repeated exercises to suggest progression
        const recentExercises = completedWorkouts.slice(0, 2).flatMap(w =>
          w.workout?.mainWorkout?.exercises?.map(e => e.name) || []
        );
        if (recentExercises.length > 0) {
          userData.push(`Recent Exercises: ${recentExercises.slice(0, 5).join(', ')} (consider progression variants)`);
        }
      }
    }
    
    return userData.join('\n');
  }
};
