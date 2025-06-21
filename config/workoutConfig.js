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
    maxTokens: 800,
    timeoutMs: 15000
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
  promptCrafter: `You are **Prompt Architect Pro**, an elite fitness‑domain prompt engineer.

INPUT (between <USER_DATA> tags)  
<USER_DATA>  
{userData}  
</USER_DATA>

TASKS  
1. Parse the input, normalising units and casing.  
2. Where essential data is missing, insert sensible defaults noted in **DEFAULTS** below—do *not* invent unrealistic values.  
3. Output a compact YAML block named **CLIENT_PROFILE** with these exact keys:  
   age, gender, weightLb, fitnessLevel, goals, equipment, injuries, daysPerWeek, minutesPerSession, preferredWorkoutStyle, notes  
4. Write a concise **PROGRAM_BRIEF** (≤ 120 words) summarising goals, constraints, safety flags and preferred style.  
5. Finish with the line: “Please follow the JSON schema provided by the caller.”  

REQUIREMENTS  
- Return a single text block that concatenates CLIENT_PROFILE, a blank line, PROGRAM_BRIEF, and the final instruction in the order shown.  
- Do **not** add commentary or additional sections.

DEFAULTS  
age: 30  
weightLb: 170  
fitnessLevel: beginner  
daysPerWeek: 3  
minutesPerSession: 45  
preferredWorkoutStyle: full_body`,

  // Stage 2: Workout Generation Template (will be dynamically filled by Stage 1)
  workoutGenerator: `{optimizedPrompt}

SYSTEM DIRECTIVES  
You are **Elite Strength Coach AI**. Using the CLIENT_PROFILE and PROGRAM_BRIEF above, create a single‑session workout that conforms exactly to the JSON_SCHEMA below.

RULES  
1. Return valid, minified JSON only – no markdown, comments or extra keys.  
2. Populate every required field; if unknown use null or a sensible default.  
3. Ensure exercise selection honours equipment availability, fitness level, time limits and any injuries.  
4. Keep total session time ≤ minutesPerSession.  
5. Include ≥ 3 coachingTips plus progressionNotes and safetyNotes.  
6. calorieEstimate must be an integer (kcal).  

JSON_SCHEMA
{
  "type": "workout_type",
  "duration": number_in_minutes,
  "difficulty": "beginner|intermediate|advanced",
  "equipment": ["equipment_list"],
  "targetMuscles": ["muscle_groups"],
  "calorieEstimate": number,
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": number,
      "reps": "rep_range_or_time",
      "rest": "rest_time",
      "instructions": "Detailed form and execution instructions",
      "modifications": "Easier/harder variations",
      "targetMuscles": ["primary_muscles"]
    }
  ],
  "warmup": [
    {
      "name": "Warmup Exercise",
      "duration": "time_duration",
      "instructions": "Detailed instructions"
    }
  ],
  "cooldown": [
    {
      "name": "Cooldown Exercise",
      "duration": "time_duration",
      "instructions": "Detailed instructions"
    }
  ],
  "coachingTips": ["tip1", "tip2", "tip3"],
  "progressionNotes": "How to progress this workout over time",
  "safetyNotes": "Important safety considerations"
}`
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
    
    // Workout history summary
    if (workoutHistory && workoutHistory.length > 0) {
      userData.push(`Recent Workout History: User has completed ${workoutHistory.length} recent workouts`);
      const recentTypes = workoutHistory.slice(0, 3).map(w => w.type || 'general').join(', ');
      userData.push(`Recent Workout Types: ${recentTypes}`);
    }
    
    return userData.join('\n');
  }
};
