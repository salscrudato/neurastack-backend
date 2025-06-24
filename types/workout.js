/**
 * Workout Management Types and Schemas for Neurastack Backend
 * Defines the structure for workout generation, history, and feedback systems
 */

/**
 * @typedef {Object} WorkoutParameters
 * @property {string} fitnessLevel - User's fitness level: 'beginner', 'intermediate', 'advanced'
 * @property {string[]} fitnessGoals - Array of fitness goals
 * @property {string[]} equipment - Available equipment (can be empty for bodyweight)
 * @property {number} age - User's age (13-100)
 * @property {string} gender - 'male' or 'female'
 * @property {number} weight - User's weight in kg or lbs (30-500)
 * @property {string[]} injuries - Array of injury/limitation descriptions
 * @property {number} daysPerWeek - Workout frequency (1-7)
 * @property {number} minutesPerSession - Session duration (10-180)
 * @property {string} workoutType - Free form workout type description
 */

/**
 * @typedef {Object} WorkoutRecord
 * @property {string} workoutId - Unique workout identifier (UUID)
 * @property {string} userId - User identifier
 * @property {WorkoutParameters} parameters - Original workout parameters
 * @property {Object} generatedWorkout - AI-generated workout plan
 * @property {Object} metadata - Generation metadata
 * @property {string} status - 'generated', 'started', 'completed', 'incomplete', 'skipped'
 * @property {Date} createdAt - Workout creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 * @property {string} correlationId - Request correlation ID
 */

/**
 * @typedef {Object} ExerciseSet
 * @property {number} setNumber - Set number (1, 2, 3, etc.)
 * @property {number} reps - Number of repetitions completed
 * @property {number} weight - Weight used (in kg or lbs)
 * @property {number} duration - Duration in seconds (for time-based exercises)
 * @property {number} distance - Distance covered (for cardio exercises)
 * @property {string} restTime - Rest time after this set (e.g., "60s", "2min")
 * @property {boolean} completed - Whether this set was completed
 * @property {string} notes - Optional notes for this set
 */

/**
 * @typedef {Object} CompletedExercise
 * @property {string} name - Exercise name
 * @property {string} type - Exercise type: 'strength', 'cardio', 'flexibility', 'balance'
 * @property {string} muscleGroups - Primary muscle groups targeted
 * @property {ExerciseSet[]} sets - Array of completed sets
 * @property {number} totalReps - Total reps across all sets
 * @property {number} totalWeight - Total weight lifted (sum of all sets)
 * @property {number} totalDuration - Total exercise duration in seconds
 * @property {boolean} completed - Whether the entire exercise was completed
 * @property {string} difficulty - Perceived difficulty: 'too_easy', 'just_right', 'too_hard'
 * @property {string} notes - Exercise-specific notes
 */

/**
 * @typedef {Object} WorkoutCompletion
 * @property {string} workoutId - Associated workout ID
 * @property {string} userId - User identifier
 * @property {boolean} completed - Whether workout was fully completed
 * @property {number} completionPercentage - Percentage of workout completed (0-100)
 * @property {number} actualDuration - Actual workout duration in minutes
 * @property {Date} startedAt - When the workout was started
 * @property {Date} completedAt - When the workout was finished
 * @property {CompletedExercise[]} exercises - Detailed exercise completion data
 * @property {number} rating - Overall workout rating (1-5)
 * @property {string} difficulty - Overall perceived difficulty
 * @property {number} enjoyment - Enjoyment rating (1-5)
 * @property {number} energy - Energy level after workout (1-5)
 * @property {string} notes - General workout notes
 * @property {string[]} injuries - Any injuries that occurred
 * @property {Object} environment - Workout environment details
 * @property {Date} submittedAt - Completion data submission timestamp
 * @property {string} correlationId - Request correlation ID
 */

/**
 * @typedef {Object} WorkoutFeedback
 * @property {string} workoutId - Associated workout ID
 * @property {string} userId - User identifier
 * @property {boolean} completed - Whether workout was completed
 * @property {number} rating - User rating (1-5)
 * @property {string} difficulty - Perceived difficulty: 'too_easy', 'just_right', 'too_hard'
 * @property {number} actualDuration - Actual workout duration in minutes
 * @property {string[]} exercisesCompleted - List of completed exercises
 * @property {string[]} exercisesSkipped - List of skipped exercises
 * @property {string} notes - User notes/comments
 * @property {string[]} injuries - Any injuries that occurred
 * @property {number} enjoyment - Enjoyment rating (1-5)
 * @property {Date} submittedAt - Feedback submission timestamp
 * @property {string} correlationId - Request correlation ID
 */

/**
 * @typedef {Object} WorkoutStats
 * @property {number} totalWorkouts - Total workouts generated
 * @property {number} completedWorkouts - Total completed workouts
 * @property {number} completionRate - Completion rate percentage
 * @property {number} averageRating - Average workout rating
 * @property {number} averageDuration - Average workout duration
 * @property {Object} preferredWorkoutTypes - Most frequent workout types
 * @property {Object} equipmentUsage - Equipment usage statistics
 * @property {Object} goalProgress - Progress towards fitness goals
 * @property {Date} lastWorkout - Last workout date
 * @property {number} currentStreak - Current workout streak
 * @property {number} longestStreak - Longest workout streak
 */

/**
 * @typedef {Object} WorkoutEvolution
 * @property {string} userId - User identifier
 * @property {Object} progressionRules - Rules for workout progression
 * @property {Object} adaptationFactors - Factors influencing workout adaptation
 * @property {Object} personalizedWeights - Weights for different workout aspects
 * @property {Date} lastUpdated - Last evolution update
 */

/**
 * Firestore collection names and structure
 */
const WORKOUT_COLLECTIONS = {
  WORKOUTS: 'workouts',
  COMPLETIONS: 'workout_completions',
  FEEDBACK: 'workout_feedback',
  STATS: 'workout_stats',
  EVOLUTION: 'workout_evolution',
  HISTORY: 'workout_history'
};

/**
 * Firestore indexes for optimal query performance
 */
const WORKOUT_INDEXES = [
  // Workouts collection indexes
  { collection: 'workouts', fields: ['userId', 'createdAt'], order: 'desc' },
  { collection: 'workouts', fields: ['userId', 'status', 'createdAt'], order: 'desc' },
  { collection: 'workouts', fields: ['userId', 'parameters.workoutType', 'createdAt'], order: 'desc' },
  { collection: 'workouts', fields: ['userId', 'parameters.fitnessLevel', 'createdAt'], order: 'desc' },
  
  // Feedback collection indexes
  { collection: 'workout_feedback', fields: ['userId', 'submittedAt'], order: 'desc' },
  { collection: 'workout_feedback', fields: ['workoutId', 'submittedAt'], order: 'desc' },
  { collection: 'workout_feedback', fields: ['userId', 'feedback.completed', 'submittedAt'], order: 'desc' },
  
  // Stats collection indexes
  { collection: 'workout_stats', fields: ['userId', 'lastUpdated'], order: 'desc' }
];

/**
 * Validation schemas for workout data
 */
const VALIDATION_SCHEMAS = {
  fitnessLevels: ['beginner', 'intermediate', 'advanced'],
  genders: ['male', 'female'],
  workoutStatuses: ['generated', 'started', 'completed', 'incomplete', 'skipped'],
  difficultyLevels: ['too_easy', 'just_right', 'too_hard'],
  ratingRange: { min: 1, max: 5 },
  ageRange: { min: 13, max: 100 },
  weightRange: { min: 30, max: 500 },
  daysPerWeekRange: { min: 1, max: 7 },
  minutesPerSessionRange: { min: 10, max: 180 }
};

/**
 * Common fitness goals mapping
 */
const FITNESS_GOALS = {
  WEIGHT_LOSS: 'weight_loss',
  MUSCLE_GAIN: 'muscle_gain',
  STRENGTH: 'strength',
  ENDURANCE: 'endurance',
  FLEXIBILITY: 'flexibility',
  TONING: 'toning',
  GENERAL_FITNESS: 'general_fitness',
  ATHLETIC_PERFORMANCE: 'athletic_performance',
  REHABILITATION: 'rehabilitation',
  STRESS_RELIEF: 'stress_relief'
};

/**
 * Common equipment types
 */
const EQUIPMENT_TYPES = {
  BODYWEIGHT: 'bodyweight',
  DUMBBELLS: 'dumbbells',
  BARBELL: 'barbell',
  RESISTANCE_BANDS: 'resistance_bands',
  KETTLEBELLS: 'kettlebells',
  PULL_UP_BAR: 'pull_up_bar',
  YOGA_MAT: 'yoga_mat',
  BENCH: 'bench',
  CARDIO_MACHINE: 'cardio_machine',
  CABLE_MACHINE: 'cable_machine',
  MEDICINE_BALL: 'medicine_ball',
  FOAM_ROLLER: 'foam_roller'
};

/**
 * Common injury/limitation types
 */
const INJURY_TYPES = {
  LOWER_BACK: 'lower_back',
  KNEE: 'knee',
  SHOULDER: 'shoulder',
  NECK: 'neck',
  ANKLE: 'ankle',
  WRIST: 'wrist',
  HIP: 'hip',
  ELBOW: 'elbow',
  CHRONIC_PAIN: 'chronic_pain',
  RECENT_SURGERY: 'recent_surgery'
};



module.exports = {
  WORKOUT_COLLECTIONS,
  WORKOUT_INDEXES,
  VALIDATION_SCHEMAS,
  FITNESS_GOALS,
  EQUIPMENT_TYPES,
  INJURY_TYPES
};
