const monitoringService = require('./monitoringService');

/**
 * Fallback Workout Service
 * Provides reliable workout generation when primary services fail
 * Ensures consistent quality across all workout generation scenarios
 */
class FallbackWorkoutService {
  constructor() {
    this.fallbackTemplates = {
      beginner: {
        duration: 30,
        exerciseCount: 6,
        restTime: 90,
        intensity: 0.5
      },
      intermediate: {
        duration: 45,
        exerciseCount: 8,
        restTime: 60,
        intensity: 0.7
      },
      advanced: {
        duration: 60,
        exerciseCount: 10,
        restTime: 45,
        intensity: 0.85
      }
    };

    this.exerciseDatabase = {
      bodyweight: {
        upper_body: [
          { name: 'Push-ups', sets: 3, reps: '8-12', targetMuscles: ['chest', 'triceps', 'shoulders'] },
          { name: 'Pike Push-ups', sets: 3, reps: '6-10', targetMuscles: ['shoulders', 'triceps'] },
          { name: 'Tricep Dips', sets: 3, reps: '8-12', targetMuscles: ['triceps', 'chest'] },
          { name: 'Plank to Downward Dog', sets: 3, reps: '10', targetMuscles: ['core', 'shoulders'] }
        ],
        lower_body: [
          { name: 'Bodyweight Squats', sets: 3, reps: '12-15', targetMuscles: ['quadriceps', 'glutes'] },
          { name: 'Lunges', sets: 3, reps: '10 each leg', targetMuscles: ['quadriceps', 'glutes', 'hamstrings'] },
          { name: 'Glute Bridges', sets: 3, reps: '12-15', targetMuscles: ['glutes', 'hamstrings'] },
          { name: 'Calf Raises', sets: 3, reps: '15-20', targetMuscles: ['calves'] }
        ],
        core: [
          { name: 'Plank', sets: 3, reps: '30-60 seconds', targetMuscles: ['core', 'shoulders'] },
          { name: 'Mountain Climbers', sets: 3, reps: '20', targetMuscles: ['core', 'cardio'] },
          { name: 'Dead Bug', sets: 3, reps: '10 each side', targetMuscles: ['core', 'stability'] },
          { name: 'Bird Dog', sets: 3, reps: '10 each side', targetMuscles: ['core', 'back'] }
        ],
        cardio: [
          { name: 'Jumping Jacks', sets: 3, reps: '30 seconds', targetMuscles: ['cardio', 'full_body'] },
          { name: 'High Knees', sets: 3, reps: '30 seconds', targetMuscles: ['cardio', 'legs'] },
          { name: 'Burpees', sets: 3, reps: '5-8', targetMuscles: ['cardio', 'full_body'] },
          { name: 'Step-ups', sets: 3, reps: '10 each leg', targetMuscles: ['cardio', 'legs'] }
        ]
      },
      dumbbells: {
        upper_body: [
          { name: 'Dumbbell Chest Press', sets: 3, reps: '8-12', targetMuscles: ['chest', 'triceps', 'shoulders'] },
          { name: 'Dumbbell Rows', sets: 3, reps: '8-12', targetMuscles: ['back', 'biceps'] },
          { name: 'Shoulder Press', sets: 3, reps: '8-12', targetMuscles: ['shoulders', 'triceps'] },
          { name: 'Bicep Curls', sets: 3, reps: '10-15', targetMuscles: ['biceps'] }
        ],
        lower_body: [
          { name: 'Dumbbell Squats', sets: 3, reps: '10-15', targetMuscles: ['quadriceps', 'glutes'] },
          { name: 'Dumbbell Lunges', sets: 3, reps: '10 each leg', targetMuscles: ['quadriceps', 'glutes', 'hamstrings'] },
          { name: 'Romanian Deadlifts', sets: 3, reps: '10-12', targetMuscles: ['hamstrings', 'glutes'] },
          { name: 'Dumbbell Step-ups', sets: 3, reps: '10 each leg', targetMuscles: ['quadriceps', 'glutes'] }
        ]
      }
    };

    this.warmupExercises = [
      { name: 'Arm Circles', duration: 60, instructions: 'Stand with arms extended, make small circles forward then backward' },
      { name: 'Leg Swings', duration: 60, instructions: 'Hold wall for support, swing each leg forward and back' },
      { name: 'Torso Twists', duration: 60, instructions: 'Stand with feet hip-width apart, rotate torso left and right' },
      { name: 'Marching in Place', duration: 60, instructions: 'Lift knees high while marching in place' }
    ];

    this.cooldownExercises = [
      { name: 'Forward Fold', duration: 30, instructions: 'Stand and slowly fold forward, let arms hang' },
      { name: 'Chest Stretch', duration: 30, instructions: 'Place arm against wall, lean forward gently' },
      { name: 'Quad Stretch', duration: 30, instructions: 'Pull heel to glute, hold for balance' },
      { name: 'Deep Breathing', duration: 60, instructions: 'Inhale for 4 counts, exhale for 6 counts' }
    ];
  }

  /**
   * Generate fallback workout when primary services fail
   * @param {Object} userMetadata - User metadata
   * @param {string} workoutType - Workout type
   * @param {string} reason - Reason for fallback
   * @returns {Object} Fallback workout plan
   */
  generateFallbackWorkout(userMetadata, workoutType, reason = 'service_unavailable') {
    const correlationId = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      monitoringService.log('info', 'Generating fallback workout', {
        reason,
        workoutType,
        fitnessLevel: userMetadata.fitnessLevel
      }, correlationId);

      // Get template based on fitness level
      const template = this.getFallbackTemplate(userMetadata.fitnessLevel);
      
      // Determine equipment availability
      const equipment = this.determineAvailableEquipment(userMetadata.equipment);
      
      // Generate workout structure
      const workout = this.buildFallbackWorkout(template, workoutType, equipment, userMetadata);
      
      // Add fallback metadata
      workout.metadata = {
        isFallback: true,
        fallbackReason: reason,
        template: userMetadata.fitnessLevel,
        equipment,
        correlationId,
        timestamp: new Date().toISOString()
      };

      monitoringService.log('info', 'Fallback workout generated successfully', {
        workoutType: workout.type,
        exerciseCount: workout.mainWorkout.exercises.length,
        duration: workout.duration
      }, correlationId);

      return {
        status: 'success',
        data: {
          workout,
          metadata: {
            model: 'fallback_service',
            provider: 'neurastack_fallback',
            timestamp: new Date().toISOString(),
            correlationId,
            isFallback: true,
            fallbackReason: reason
          }
        }
      };

    } catch (error) {
      monitoringService.log('error', 'Fallback workout generation failed', {
        error: error.message,
        reason
      }, correlationId);

      return this.generateMinimalFallback(userMetadata, workoutType);
    }
  }

  /**
   * Get fallback template based on fitness level
   * @param {string} fitnessLevel - User's fitness level
   * @returns {Object} Fallback template
   */
  getFallbackTemplate(fitnessLevel) {
    const level = (fitnessLevel || 'intermediate').toLowerCase();
    return this.fallbackTemplates[level] || this.fallbackTemplates.intermediate;
  }

  /**
   * Determine available equipment
   * @param {Array} userEquipment - User's equipment list
   * @returns {string} Primary equipment type
   */
  determineAvailableEquipment(userEquipment) {
    if (!userEquipment || userEquipment.length === 0) return 'bodyweight';
    
    if (userEquipment.includes('dumbbells')) return 'dumbbells';
    if (userEquipment.includes('resistance_bands')) return 'resistance_bands';
    if (userEquipment.includes('kettlebells')) return 'kettlebells';
    
    return 'bodyweight';
  }

  /**
   * Build fallback workout structure
   * @param {Object} template - Workout template
   * @param {string} workoutType - Workout type
   * @param {string} equipment - Available equipment
   * @param {Object} userMetadata - User metadata
   * @returns {Object} Workout structure
   */
  buildFallbackWorkout(template, workoutType, equipment, userMetadata) {
    const duration = userMetadata.minutesPerSession || template.duration;
    const exerciseCount = Math.min(template.exerciseCount, Math.floor(duration / 5));

    // Determine workout focus
    const focus = this.determineWorkoutFocus(workoutType);
    
    // Select exercises
    const exercises = this.selectFallbackExercises(focus, equipment, exerciseCount, template);
    
    // Build warmup and cooldown
    const warmup = this.selectWarmupExercises(Math.floor(duration * 0.15));
    const cooldown = this.selectCooldownExercises(Math.floor(duration * 0.15));

    return {
      id: `fallback-${Date.now()}`,
      type: workoutType || 'Full Body Workout',
      duration,
      difficulty: userMetadata.fitnessLevel || 'intermediate',
      equipment: equipment === 'bodyweight' ? [] : [equipment],
      
      mainWorkout: {
        exercises: exercises.map(exercise => ({
          ...exercise,
          rest: `${template.restTime} seconds`,
          duration: 0,
          instructions: this.generateExerciseInstructions(exercise.name),
          modifications: this.generateModifications(exercise.name, userMetadata.injuries),
          equipment: equipment === 'bodyweight' ? [] : [equipment]
        }))
      },
      
      warmup: warmup.map(exercise => ({
        name: exercise.name,
        sets: 1,
        reps: 'hold',
        duration: exercise.duration,
        rest: 'none',
        instructions: [exercise.instructions],
        targetMuscles: ['mobility'],
        equipment: [],
        modifications: []
      })),
      
      cooldown: cooldown.map(exercise => ({
        name: exercise.name,
        sets: 1,
        reps: 'hold',
        duration: exercise.duration,
        rest: 'none',
        instructions: [exercise.instructions],
        targetMuscles: ['flexibility'],
        equipment: [],
        modifications: []
      })),
      
      targetMuscles: this.getTargetMuscles(exercises),
      estimatedCalories: this.estimateCalories(duration, template.intensity),
      safetyNotes: this.generateSafetyNotes(userMetadata.injuries)
    };
  }

  /**
   * Determine workout focus from type
   * @param {string} workoutType - Workout type
   * @returns {Array} Focus areas
   */
  determineWorkoutFocus(workoutType) {
    const type = (workoutType || '').toLowerCase();
    
    if (type.includes('upper')) return ['upper_body'];
    if (type.includes('lower') || type.includes('leg')) return ['lower_body'];
    if (type.includes('core')) return ['core'];
    if (type.includes('cardio')) return ['cardio'];
    if (type.includes('strength')) return ['upper_body', 'lower_body'];
    
    return ['upper_body', 'lower_body', 'core']; // Full body default
  }

  /**
   * Select exercises for fallback workout
   * @param {Array} focus - Focus areas
   * @param {string} equipment - Available equipment
   * @param {number} count - Number of exercises
   * @param {Object} template - Workout template
   * @returns {Array} Selected exercises
   */
  selectFallbackExercises(focus, equipment, count, template) {
    const exercises = [];
    const exercisePool = this.exerciseDatabase[equipment] || this.exerciseDatabase.bodyweight;
    
    // Distribute exercises across focus areas
    const exercisesPerFocus = Math.floor(count / focus.length);
    const remainder = count % focus.length;
    
    focus.forEach((focusArea, index) => {
      const focusExercises = exercisePool[focusArea] || exercisePool.upper_body;
      const exerciseCount = exercisesPerFocus + (index < remainder ? 1 : 0);
      
      for (let i = 0; i < exerciseCount && i < focusExercises.length; i++) {
        exercises.push({
          ...focusExercises[i],
          sets: this.adjustSetsForLevel(focusExercises[i].sets, template.intensity)
        });
      }
    });
    
    return exercises;
  }

  /**
   * Generate minimal fallback when all else fails
   * @param {Object} userMetadata - User metadata
   * @param {string} workoutType - Workout type
   * @returns {Object} Minimal workout
   */
  generateMinimalFallback(userMetadata, workoutType) {
    return {
      status: 'success',
      data: {
        workout: {
          id: `minimal-fallback-${Date.now()}`,
          type: workoutType || 'Basic Workout',
          duration: userMetadata.minutesPerSession || 30,
          difficulty: userMetadata.fitnessLevel || 'beginner',
          equipment: [],
          
          mainWorkout: {
            exercises: [
              {
                name: 'Bodyweight Squats',
                sets: 3,
                reps: '10-15',
                rest: '60 seconds',
                duration: 0,
                instructions: ['Stand with feet hip-width apart', 'Lower down as if sitting in a chair', 'Return to standing'],
                targetMuscles: ['quadriceps', 'glutes'],
                equipment: [],
                modifications: ['Hold onto a chair for support if needed']
              },
              {
                name: 'Push-ups',
                sets: 3,
                reps: '5-10',
                rest: '60 seconds',
                duration: 0,
                instructions: ['Start in plank position', 'Lower chest to ground', 'Push back up'],
                targetMuscles: ['chest', 'triceps', 'shoulders'],
                equipment: [],
                modifications: ['Perform on knees or against a wall']
              },
              {
                name: 'Plank',
                sets: 3,
                reps: '20-30 seconds',
                rest: '60 seconds',
                duration: 0,
                instructions: ['Hold plank position', 'Keep body straight', 'Breathe steadily'],
                targetMuscles: ['core'],
                equipment: [],
                modifications: ['Perform on knees if needed']
              }
            ]
          },
          
          warmup: [
            {
              name: 'Marching in Place',
              sets: 1,
              reps: 'hold',
              duration: 120,
              rest: 'none',
              instructions: ['March in place lifting knees'],
              targetMuscles: ['cardio'],
              equipment: [],
              modifications: []
            }
          ],
          
          cooldown: [
            {
              name: 'Deep Breathing',
              sets: 1,
              reps: 'hold',
              duration: 120,
              rest: 'none',
              instructions: ['Breathe deeply and slowly'],
              targetMuscles: ['relaxation'],
              equipment: [],
              modifications: []
            }
          ],
          
          targetMuscles: ['full_body'],
          estimatedCalories: 150,
          safetyNotes: ['Listen to your body', 'Stop if you feel pain', 'Stay hydrated']
        },
        metadata: {
          model: 'minimal_fallback',
          provider: 'neurastack_emergency',
          timestamp: new Date().toISOString(),
          isFallback: true,
          fallbackReason: 'emergency_fallback'
        }
      }
    };
  }

  // Helper methods
  selectWarmupExercises(duration) {
    const count = Math.max(2, Math.floor(duration / 60));
    return this.warmupExercises.slice(0, count);
  }

  selectCooldownExercises(duration) {
    const count = Math.max(2, Math.floor(duration / 30));
    return this.cooldownExercises.slice(0, count);
  }

  adjustSetsForLevel(baseSets, intensity) {
    if (intensity < 0.6) return Math.max(2, baseSets - 1);
    if (intensity > 0.8) return baseSets + 1;
    return baseSets;
  }

  generateExerciseInstructions(exerciseName) {
    const instructions = {
      'Push-ups': 'Start in plank position, lower chest to ground, push back up',
      'Squats': 'Stand with feet hip-width apart, lower down as if sitting, return to standing',
      'Plank': 'Hold plank position with straight body, engage core muscles'
    };
    return instructions[exerciseName] || 'Perform exercise with proper form and control';
  }

  generateModifications(exerciseName, injuries) {
    if (!injuries || injuries.length === 0) return [];
    
    const modifications = [];
    if (injuries.includes('lower_back') && exerciseName.includes('Squat')) {
      modifications.push('Reduce range of motion');
    }
    if (injuries.includes('knee') && exerciseName.includes('Lunge')) {
      modifications.push('Use shorter step');
    }
    return modifications;
  }

  getTargetMuscles(exercises) {
    const muscles = new Set();
    exercises.forEach(exercise => {
      exercise.targetMuscles.forEach(muscle => muscles.add(muscle));
    });
    return Array.from(muscles);
  }

  estimateCalories(duration, intensity) {
    return Math.round(duration * intensity * 5); // Rough estimate
  }

  generateSafetyNotes(injuries) {
    const notes = ['Listen to your body and stop if you feel pain', 'Stay hydrated throughout the workout'];
    
    if (injuries && injuries.length > 0) {
      notes.push('Pay special attention to your injury limitations');
      notes.push('Modify exercises as needed for comfort and safety');
    }
    
    return notes;
  }
}

module.exports = new FallbackWorkoutService();
