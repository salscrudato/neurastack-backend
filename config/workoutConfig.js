/**
 * Workout Configuration
 * Centralized configuration for workout generation including prompts, templates, and AI settings
 */

const ensembleConfig = require('./ensemblePrompts');

// AI Model Configuration for Workout Generation
const WORKOUT_AI_CONFIG = {
  // Prompt crafting model (low-cost for initial prompt generation)
  promptCrafter: {
    provider: 'openai',
    model: 'gpt-4o-mini', // Low-cost model for prompt crafting
    temperature: 0.3,
    maxTokens: 1600,
    timeoutMs: 30000
  },
  
  // Workout generation model (higher quality for final workout)
  workoutGenerator: {
    provider: 'openai',
    model: 'gpt-4o', // Higher quality model for workout generation
    temperature: 0.2,
    maxTokens: 2500,
    timeoutMs: 45000
  }
};

// Prompt Templates
const PROMPT_TEMPLATES = {
  // Stage 1: Prompt Crafting Template
  promptCrafter: `
You are a senior prompt‑engineer for fitness coaching.

TASK  
Transform <USER_DATA> into two objects:  
1. CLIENT_PROFILE  → JSON with exactly:  
   age, gender, weightLb, fitnessLevel, goals,  
   equipment, injuries, daysPerWeek, minutesPerSession,  
   preferredWorkoutStyle, notes  
2. PROGRAM_BRIEF   → single string ≤120 words summarising goals,  
   constraints, safety flags, style preferences.

RULES  
- Normalise units (kg→lb, cm→in).  
- Fill absent non‑critical fields with sensible defaults (see DEFAULTS).  
- Return **only**:  
  { "CLIENT_PROFILE": { … }, "PROGRAM_BRIEF": "…" }

DEFAULTS = { age:30, weightLb:170, fitnessLevel:"beginner",  
             daysPerWeek:3, minutesPerSession:45,  
             preferredWorkoutStyle:"full_body" }

<USER_DATA>  
{userData}  
</USER_DATA>
`.trim(),

  // Stage 2: Workout Generation Template (will be dynamically filled by Stage 1)
  workoutGenerator: `
{optimizedPrompt}

SYSTEM  
You are an elite strength‑coach AI.

RETURN  
Only a minified JSON object that matches the schema WORKOUT_SCHEMA.

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

RULES
1. Honour CLIENT_PROFILE, PROGRAM_BRIEF, equipment & injuries.
2. CRITICAL: Total session time MUST equal minutesPerSession. Calculate: warmup + main workout + cooldown = minutesPerSession.
3. For 90-minute sessions: 10min warmup + 70min main workout + 10min cooldown.
4. Scale exercise count and sets to fill the time: beginners need 6-8 exercises, intermediates 8-10, advanced 10-12.
5. Provide ≥3 coachingTips. No extra keys or markdown.
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
