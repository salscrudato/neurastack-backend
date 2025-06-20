const express = require('express');
const router = express.Router();
const workoutService = require('../services/workoutService');
const workoutHistoryService = require('../services/workoutHistoryService');
const monitoringService = require('../services/monitoringService');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate Workout Endpoint
 * Creates personalized workouts based on structured user parameters
 * All user memory and history is handled automatically in the backend
 *
 * POST /generate-workout
 */
router.post('/generate-workout', async (req, res) => {
  const correlationId = req.correlationId || `workout-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const workoutId = uuidv4();

  try {
    // Extract structured parameters from request body
    const {
      fitnessLevel,
      fitnessGoals,
      equipment,
      age,
      gender,
      weight,
      injuries,
      daysPerWeek,
      minutesPerSession,
      workoutType
    } = req.body;

    const userId = req.headers['x-user-id'] || 'anonymous';

    // Automatically retrieve user's workout history for intelligent personalization
    const workoutHistory = await workoutHistoryService.getUserWorkoutHistory(userId, 10);

    // Log request start
    monitoringService.log('info', 'Generate workout request received', {
      userId,
      workoutId,
      fitnessLevel,
      workoutType,
      minutesPerSession,
      daysPerWeek
    }, correlationId);

    // Validate required parameters
    const validationError = validateWorkoutParameters({
      fitnessLevel,
      fitnessGoals,
      equipment,
      age,
      gender,
      weight,
      injuries,
      daysPerWeek,
      minutesPerSession,
      workoutType
    });

    if (validationError) {
      return res.status(400).json({
        status: 'error',
        message: validationError,
        workoutId,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Structure user metadata for workout service
    const userMetadata = {
      age,
      fitnessLevel,
      gender,
      weight,
      goals: fitnessGoals,
      equipment,
      timeAvailable: minutesPerSession,
      injuries,
      daysPerWeek,
      minutesPerSession
    };

    // Create workout specification
    const workoutSpecification = {
      workoutType,
      duration: minutesPerSession,
      intensity: fitnessLevel,
      focus: deriveWorkoutFocus(fitnessGoals, workoutType),
      structure: {
        warmupDuration: Math.max(3, Math.floor(minutesPerSession * 0.1)),
        cooldownDuration: Math.max(3, Math.floor(minutesPerSession * 0.1)),
        restBetweenSets: calculateRestTime(fitnessLevel),
        exerciseCount: calculateExerciseCount(minutesPerSession, fitnessLevel)
      },
      constraints: {
        equipment,
        injuries,
        timeLimit: minutesPerSession
      }
    };

    // Generate workout using enhanced service
    const workoutResult = await workoutService.generateWorkout(
      userMetadata,
      workoutHistory,
      `Generate a ${workoutType} workout for ${minutesPerSession} minutes`,
      userId,
      workoutSpecification
    );

    // Store workout in history with unique ID
    const workoutRecord = {
      workoutId,
      userId,
      parameters: {
        fitnessLevel,
        fitnessGoals,
        equipment,
        age,
        gender,
        weight,
        injuries,
        daysPerWeek,
        minutesPerSession,
        workoutType
      },
      generatedWorkout: workoutResult.data.workout,
      metadata: workoutResult.data.metadata,
      status: 'generated',
      createdAt: new Date(),
      correlationId
    };

    await workoutHistoryService.storeWorkout(workoutRecord);

    // Prepare response in exact frontend format
    const response = {
      status: 'success',
      data: {
        workout: {
          ...workoutResult.data.workout,
          // Ensure duration is a number
          duration: parseInt(workoutResult.data.workout.duration) || minutesPerSession
        },
        metadata: {
          model: workoutResult.data.metadata.model,
          provider: workoutResult.data.metadata.provider,
          timestamp: new Date().toISOString(),
          correlationId,
          userId,
          debug: {
            requestFormat: 'enhanced',
            isEnhancedFormat: true,
            parsedWorkoutType: workoutType,
            typeConsistency: {
              requested: workoutType,
              aiGenerated: workoutResult.data.workout.type,
              final: workoutResult.data.workout.type,
              wasAdjusted: false
            }
          }
        }
      },
      message: 'Workout generated successfully',
      timestamp: new Date().toISOString(),
      correlationId,
      retryable: false
    };

    // Log success
    monitoringService.log('info', 'Workout generated successfully', {
      userId,
      workoutId,
      exerciseCount: workoutResult.data.workout.exercises?.length || 0,
      duration: workoutResult.data.workout.duration,
      workoutType: workoutResult.data.workout.type
    }, correlationId);

    res.status(200).json(response);

  } catch (error) {
    // Log error
    monitoringService.log('error', 'Workout generation failed', {
      userId: req.headers['x-user-id'] || 'anonymous',
      workoutId,
      error: error.message,
      stack: error.stack
    }, correlationId);

    // Determine error type and status code
    let statusCode = 500;
    let errorMessage = 'Internal server error occurred during workout generation';

    if (error.message.includes('required') ||
        error.message.includes('must be') ||
        error.message.includes('invalid')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('timeout') ||
               error.message.includes('AI model')) {
      statusCode = 503;
      errorMessage = 'Workout generation service temporarily unavailable';
    }

    res.status(statusCode).json({
      status: 'error',
      message: errorMessage,
      workoutId,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString(),
      correlationId,
      retryable: statusCode === 503
    });
  }
});

/**
 * Validation function for workout parameters
 */
function validateWorkoutParameters(params) {
  const {
    fitnessLevel,
    fitnessGoals,
    equipment,
    age,
    gender,
    weight,
    injuries,
    daysPerWeek,
    minutesPerSession,
    workoutType
  } = params;

  // Required field validation
  if (!fitnessLevel) return 'fitnessLevel is required';
  if (!fitnessGoals || !Array.isArray(fitnessGoals) || fitnessGoals.length === 0) {
    return 'fitnessGoals must be a non-empty array';
  }
  if (!equipment || !Array.isArray(equipment)) {
    return 'equipment must be an array (can be empty for bodyweight workouts)';
  }
  if (!age || typeof age !== 'number' || age < 13 || age > 100) {
    return 'age must be a number between 13 and 100';
  }
  if (!gender || !['male', 'female'].includes(gender.toLowerCase())) {
    return 'gender must be either "male" or "female"';
  }
  if (!weight || typeof weight !== 'number' || weight < 30 || weight > 500) {
    return 'weight must be a number between 30 and 500';
  }
  if (!injuries || !Array.isArray(injuries)) {
    return 'injuries must be an array (can be empty if no injuries)';
  }
  if (!daysPerWeek || typeof daysPerWeek !== 'number' || daysPerWeek < 1 || daysPerWeek > 7) {
    return 'daysPerWeek must be a number between 1 and 7';
  }
  if (!minutesPerSession || typeof minutesPerSession !== 'number' || minutesPerSession < 10 || minutesPerSession > 180) {
    return 'minutesPerSession must be a number between 10 and 180';
  }
  if (!workoutType || typeof workoutType !== 'string' || workoutType.trim().length === 0) {
    return 'workoutType is required and must be a non-empty string';
  }

  // Validate fitness level
  const validFitnessLevels = ['beginner', 'intermediate', 'advanced'];
  if (!validFitnessLevels.includes(fitnessLevel.toLowerCase())) {
    return `fitnessLevel must be one of: ${validFitnessLevels.join(', ')}`;
  }

  return null; // No validation errors
}

/**
 * Helper function to derive workout focus from goals and type
 */
function deriveWorkoutFocus(fitnessGoals, workoutType) {
  const focus = [];

  // Map goals to focus areas
  const goalMapping = {
    'weight_loss': ['cardio', 'fat_burning'],
    'muscle_gain': ['strength', 'hypertrophy'],
    'strength': ['strength', 'power'],
    'endurance': ['cardio', 'endurance'],
    'flexibility': ['flexibility', 'mobility'],
    'toning': ['strength', 'endurance'],
    'general_fitness': ['strength', 'cardio'],
    'athletic_performance': ['power', 'agility', 'strength']
  };

  fitnessGoals.forEach(goal => {
    if (goalMapping[goal]) {
      focus.push(...goalMapping[goal]);
    }
  });

  // Add workout type specific focus
  if (workoutType.toLowerCase().includes('leg')) focus.push('lower_body');
  if (workoutType.toLowerCase().includes('upper')) focus.push('upper_body');
  if (workoutType.toLowerCase().includes('core')) focus.push('core');
  if (workoutType.toLowerCase().includes('cardio')) focus.push('cardio');
  if (workoutType.toLowerCase().includes('strength')) focus.push('strength');

  return [...new Set(focus)]; // Remove duplicates
}

/**
 * Calculate rest time based on fitness level
 */
function calculateRestTime(fitnessLevel) {
  const restTimes = {
    'beginner': 90,
    'intermediate': 60,
    'advanced': 45
  };
  return restTimes[fitnessLevel.toLowerCase()] || 60;
}

/**
 * Calculate exercise count based on session duration and fitness level
 */
function calculateExerciseCount(minutesPerSession, fitnessLevel) {
  const baseExercises = {
    'beginner': Math.floor(minutesPerSession / 8),
    'intermediate': Math.floor(minutesPerSession / 6),
    'advanced': Math.floor(minutesPerSession / 5)
  };

  const count = baseExercises[fitnessLevel.toLowerCase()] || Math.floor(minutesPerSession / 6);
  return Math.max(3, Math.min(count, 12)); // Between 3-12 exercises
}

/**
 * Workout Completion Update Endpoint
 * Simple endpoint to mark workout as completed and collect basic feedback
 * All user memory and learning is handled automatically in the backend
 *
 * POST /complete-workout
 */
router.post('/complete-workout', async (req, res) => {
  const correlationId = req.correlationId || `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const {
      workoutId,
      completed,
      rating,
      difficulty,
      notes
    } = req.body;

    const userId = req.headers['x-user-id'] || 'anonymous';

    // Validate required fields
    if (!workoutId) {
      return res.status(400).json({
        status: 'error',
        message: 'workoutId is required',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    if (typeof completed !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'completed must be a boolean value',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Log feedback received
    monitoringService.log('info', 'Workout feedback received', {
      userId,
      workoutId,
      completed,
      rating,
      difficulty
    }, correlationId);

    // Create simplified feedback record
    const feedbackRecord = {
      workoutId,
      userId,
      feedback: {
        completed,
        rating: rating || null,
        difficulty: difficulty || null,
        notes: notes || ''
      },
      submittedAt: new Date(),
      correlationId
    };

    // Store feedback and update workout status automatically
    await workoutHistoryService.storeFeedback(feedbackRecord);
    await workoutHistoryService.updateWorkoutStatus(workoutId, completed ? 'completed' : 'incomplete');

    // Automatically update user stats and learning algorithms in the background
    await workoutHistoryService.updateUserStats(userId);

    // Log success
    monitoringService.log('info', 'Workout feedback processed successfully', {
      userId,
      workoutId,
      feedbackProcessed: true
    }, correlationId);

    res.status(200).json({
      status: 'success',
      message: 'Workout completion updated successfully',
      data: {
        workoutId,
        completed,
        processed: true
      },
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Log error
    monitoringService.log('error', 'Workout feedback processing failed', {
      userId: req.headers['x-user-id'] || 'anonymous',
      error: error.message,
      stack: error.stack
    }, correlationId);

    res.status(500).json({
      status: 'error',
      message: 'Failed to process workout feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// Note: User workout history and memory is handled automatically in the backend
// The generate-workout endpoint automatically considers user history for personalization
// No separate history endpoint is needed for the frontend

module.exports = router;
