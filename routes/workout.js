const express = require('express');
const router = express.Router();
const workoutService = require('../services/workoutService');
const workoutHistoryService = require('../services/workoutHistoryService');
const monitoringService = require('../services/monitoringService');
const workoutConfig = require('../config/workoutConfig');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate Workout Endpoint - Flexible Version
 * Creates personalized workouts using dynamic AI prompt generation
 * Accepts flexible categories and free-form text input
 *
 * POST /generate-workout
 */
router.post('/generate-workout', async (req, res) => {
  const correlationId = req.correlationId || `workout-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const workoutId = uuidv4();

  try {
    // Extract flexible parameters from request body
    const {
      age,
      fitnessLevel,
      gender,
      weight,
      goals,           // Can be string or array - flexible
      equipment,       // Can be string or array - flexible
      injuries,        // Can be string or array - flexible
      timeAvailable,   // Duration in minutes
      daysPerWeek,
      workoutType,     // Free-form text
      otherInformation // New: free-form additional information
    } = req.body;

    const userId = req.headers['x-user-id'] || 'anonymous';

    // Log request start
    monitoringService.log('info', 'Flexible workout generation request received', {
      userId,
      workoutId,
      age,
      fitnessLevel,
      timeAvailable,
      hasOtherInfo: !!otherInformation
    }, correlationId);

    // Enhanced validation with better error messages
    const validation = workoutConfig.VALIDATION_RULES;

    // Validate age
    if (!age || typeof age !== 'number' || age < validation.age.min || age > validation.age.max) {
      return res.status(400).json({
        status: 'error',
        message: `Age is required and must be between ${validation.age.min} and ${validation.age.max}`,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Build flexible user metadata - no strict validation of categories
    const userMetadata = {
      age,
      fitnessLevel: fitnessLevel || 'intermediate',
      gender,
      weight,
      goals,           // Accept any format
      equipment,       // Accept any format
      injuries,        // Accept any format
      timeAvailable: timeAvailable || 30,
      daysPerWeek,
      workoutType,
      userId
    };

    // Automatically retrieve user's workout history
    const workoutHistory = await workoutHistoryService.getUserWorkoutHistory(userId, 10);

    // Generate workout using the new flexible service
    const workoutResult = await workoutService.generateFlexibleWorkout(
      userMetadata,
      workoutHistory,
      otherInformation || '',
      correlationId
    );

    // Store workout in history
    const workoutRecord = {
      workoutId,
      userId,
      parameters: userMetadata,
      otherInformation,
      workout: workoutResult.data.workout,
      metadata: workoutResult.data.metadata,
      createdAt: new Date().toISOString(),
      status: 'generated'
    };

    await workoutHistoryService.storeWorkout(workoutRecord);

    // Log success
    monitoringService.log('info', 'Single-prompt workout generated successfully', {
      userId,
      workoutId,
      workoutType: workoutResult.data.workout.type,
      exerciseCount: workoutResult.data.workout.mainWorkout?.exercises?.length || 0,
      duration: workoutResult.data.workout.duration
    }, correlationId);

    // Return structured response
    res.status(200).json({
      status: 'success',
      data: {
        workoutId,
        workout: workoutResult.data.workout,
        metadata: {
          ...workoutResult.data.metadata,
          correlationId,
          generatedAt: new Date().toISOString(),
          userId
        }
      },
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    monitoringService.log('error', 'Single-prompt workout generation failed', {
      error: error.message,
      stack: error.stack,
      workoutId
    }, correlationId);

    res.status(500).json({
      status: 'error',
      message: 'Failed to generate workout',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

// Removed old validation and helper functions - now using flexible AI-driven approach

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

/**
 * Optimized Workout Completion Endpoint
 * Handles comprehensive workout completion data with exercise tracking, feedback, and analytics
 * Designed for frontend data collection flow with robust validation and error handling
 *
 * POST /workout-completion
 */
router.post('/workout-completion', async (req, res) => {
  const correlationId = req.correlationId || `completion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const {
      workoutId,
      completed,
      completionPercentage,
      actualDuration,
      startedAt,
      completedAt,
      exercises,
      feedback
    } = req.body;

    const userId = req.headers['x-user-id'] || 'anonymous';

    // Enhanced validation with detailed error messages
    const validationErrors = [];

    if (!workoutId || typeof workoutId !== 'string') {
      validationErrors.push('workoutId is required and must be a string');
    }

    if (typeof completed !== 'boolean') {
      validationErrors.push('completed must be a boolean value');
    }

    if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
      validationErrors.push('exercises array is required and cannot be empty');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: validationErrors,
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Verify workout exists and belongs to user
    const existingWorkout = await workoutHistoryService.getWorkoutById(workoutId, userId);
    if (!existingWorkout) {
      return res.status(404).json({
        status: 'error',
        message: 'Workout not found or access denied',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Calculate completion metrics
    const totalExercises = exercises.length;
    const completedExercises = exercises.filter(ex => ex.completed !== false).length;
    const calculatedCompletionPercentage = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

    // Process exercise data with enhanced tracking
    const processedExercises = exercises.map((exercise, index) => {
      const sets = (exercise.sets || []).map((set, setIndex) => ({
        setNumber: setIndex + 1,
        reps: parseInt(set.reps) || 0,
        weight: parseFloat(set.weight) || 0,
        duration: parseInt(set.duration) || 0,
        distance: parseFloat(set.distance) || 0,
        restTime: set.restTime || '',
        completed: set.completed !== false,
        notes: set.notes || '',
        targetReps: set.targetReps || null,
        targetWeight: set.targetWeight || null
      }));

      // Calculate exercise totals
      const totalReps = sets.reduce((sum, set) => sum + set.reps, 0);
      const totalWeight = sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
      const totalDuration = sets.reduce((sum, set) => sum + set.duration, 0);
      const completedSets = sets.filter(set => set.completed).length;

      return {
        exerciseIndex: index + 1,
        name: exercise.name || '',
        type: exercise.type || 'strength',
        muscleGroups: exercise.muscleGroups || '',
        sets,
        totalSets: sets.length,
        completedSets,
        totalReps,
        totalWeight,
        totalDuration,
        completed: exercise.completed !== false,
        skipped: exercise.completed === false,
        difficulty: exercise.difficulty || null,
        notes: exercise.notes || '',
        targetSets: exercise.targetSets || null,
        targetReps: exercise.targetReps || null
      };
    });

    // Create comprehensive completion record
    const completionRecord = {
      workoutId,
      userId,
      completed,
      completionPercentage: completionPercentage || calculatedCompletionPercentage,
      actualDuration: parseInt(actualDuration) || 0,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      completedAt: completedAt ? new Date(completedAt) : new Date(),
      exercises: processedExercises,

      // Enhanced feedback processing
      feedback: {
        rating: feedback?.rating ? parseInt(feedback.rating) : null,
        difficulty: feedback?.difficulty || null,
        enjoyment: feedback?.enjoyment ? parseInt(feedback.enjoyment) : null,
        energy: feedback?.energy ? parseInt(feedback.energy) : null,
        notes: feedback?.notes || '',
        injuries: Array.isArray(feedback?.injuries) ? feedback.injuries : [],
        environment: feedback?.environment || {},
        wouldRecommend: feedback?.wouldRecommend || null
      },

      // Analytics data
      analytics: {
        totalExercises,
        completedExercises,
        skippedExercises: totalExercises - completedExercises,
        totalSets: processedExercises.reduce((sum, ex) => sum + ex.totalSets, 0),
        completedSets: processedExercises.reduce((sum, ex) => sum + ex.completedSets, 0),
        totalWeight: processedExercises.reduce((sum, ex) => sum + ex.totalWeight, 0),
        totalReps: processedExercises.reduce((sum, ex) => sum + ex.totalReps, 0),
        averageSetCompletion: processedExercises.length > 0 ?
          processedExercises.reduce((sum, ex) => sum + (ex.completedSets / Math.max(ex.totalSets, 1)), 0) / processedExercises.length : 0
      },

      submittedAt: new Date(),
      correlationId
    };

    // Log detailed completion data
    monitoringService.log('info', 'Optimized workout completion received', {
      userId,
      workoutId,
      completed,
      completionPercentage: completionRecord.completionPercentage,
      exerciseCount: totalExercises,
      completedExercises,
      actualDuration: completionRecord.actualDuration,
      hasRating: !!completionRecord.feedback.rating,
      hasFeedback: !!completionRecord.feedback.notes
    }, correlationId);

    // Store completion data with enhanced error handling
    try {
      await workoutHistoryService.storeWorkoutCompletion(completionRecord);
      await workoutHistoryService.updateWorkoutStatus(workoutId, completed ? 'completed' : 'incomplete');

      // Update user stats asynchronously for better performance
      setImmediate(async () => {
        try {
          await workoutHistoryService.updateUserStats(userId);
        } catch (statsError) {
          monitoringService.log('warn', 'Failed to update user stats after workout completion', {
            userId,
            workoutId,
            error: statsError.message
          }, correlationId);
        }
      });

    } catch (storageError) {
      monitoringService.log('error', 'Failed to store workout completion', {
        userId,
        workoutId,
        error: storageError.message,
        stack: storageError.stack
      }, correlationId);

      return res.status(500).json({
        status: 'error',
        message: 'Failed to save workout completion data',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Generate next workout recommendations
    const nextRecommendations = await generateNextWorkoutRecommendations(userId, completionRecord);

    // Success response with enhanced data
    res.status(200).json({
      status: 'success',
      message: 'Workout completion processed successfully',
      data: {
        workoutId,
        completed,
        completionPercentage: completionRecord.completionPercentage,
        exercisesTracked: totalExercises,
        completedExercises,
        skippedExercises: totalExercises - completedExercises,
        totalWeight: completionRecord.analytics.totalWeight,
        totalReps: completionRecord.analytics.totalReps,
        actualDuration: completionRecord.actualDuration,
        processed: true,
        nextRecommendations
      },
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    monitoringService.log('error', 'Workout completion processing failed', {
      userId: req.headers['x-user-id'] || 'anonymous',
      error: error.message,
      stack: error.stack
    }, correlationId);

    res.status(500).json({
      status: 'error',
      message: 'Internal server error during workout completion processing',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate next workout recommendations based on completion data
 * @param {string} userId - User ID
 * @param {Object} completionRecord - Workout completion data
 * @returns {Promise<Object>} Recommendations for next workout
 */
async function generateNextWorkoutRecommendations(userId, completionRecord) {
  try {
    const recommendations = {
      restDays: 1,
      focusAreas: [],
      adjustments: [],
      progressionSuggestions: []
    };

    // Analyze completion rate
    if (completionRecord.completionPercentage < 50) {
      recommendations.adjustments.push('Consider reducing workout intensity');
      recommendations.restDays = 2;
    } else if (completionRecord.completionPercentage === 100 && completionRecord.feedback.difficulty === 'easy') {
      recommendations.adjustments.push('Ready for increased intensity');
      recommendations.progressionSuggestions.push('Increase weight by 5-10%');
    }

    // Analyze feedback
    if (completionRecord.feedback.rating && completionRecord.feedback.rating >= 4) {
      recommendations.focusAreas.push('Similar workout style recommended');
    }

    if (completionRecord.feedback.energy && completionRecord.feedback.energy <= 2) {
      recommendations.restDays = Math.max(recommendations.restDays, 2);
      recommendations.adjustments.push('Consider active recovery session');
    }

    // Analyze exercise performance
    const struggledExercises = completionRecord.exercises.filter(ex =>
      ex.completedSets < ex.totalSets * 0.7
    );

    if (struggledExercises.length > 0) {
      recommendations.focusAreas.push(`Focus on: ${struggledExercises.map(ex => ex.name).join(', ')}`);
    }

    return recommendations;
  } catch (error) {
    monitoringService.log('warn', 'Failed to generate workout recommendations', {
      userId,
      error: error.message
    });
    return { restDays: 1, focusAreas: [], adjustments: [], progressionSuggestions: [] };
  }
}

/**
 * Get Workout History Endpoint
 * Returns clean, structured workout history for a user
 *
 * GET /workout-history
 */
router.get('/workout-history', async (req, res) => {
  const correlationId = req.correlationId || `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const userId = req.headers['x-user-id'] || req.query.userId;
    const limit = parseInt(req.query.limit) || 20;
    const includeDetails = req.query.includeDetails === 'true';
    const includeIncomplete = req.query.includeIncomplete === 'true';

    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'userId is required (via X-User-Id header or query parameter)',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Log history request
    monitoringService.log('info', 'Workout history requested', {
      userId,
      limit,
      includeDetails,
      includeIncomplete
    }, correlationId);

    // Get workout history with completion data
    const workoutHistory = await workoutHistoryService.getEnhancedWorkoutHistory(
      userId,
      limit,
      includeDetails,
      includeIncomplete
    );

    // Get user workout statistics
    const userStats = await workoutHistoryService.getUserWorkoutStats(userId);

    // Format response for frontend consumption
    const response = {
      status: 'success',
      data: {
        workouts: workoutHistory,
        stats: {
          totalWorkouts: userStats.totalWorkouts || 0,
          completedWorkouts: userStats.completedWorkouts || 0,
          completionRate: userStats.completionRate || 0,
          averageRating: userStats.averageRating || 0,
          averageDuration: userStats.averageDuration || 0,
          currentStreak: userStats.currentStreak || 0,
          longestStreak: userStats.longestStreak || 0,
          lastWorkout: userStats.lastWorkout || null,
          preferredWorkoutTypes: userStats.preferredWorkoutTypes || {},
          goalProgress: userStats.goalProgress || {}
        },
        metadata: {
          totalRecords: workoutHistory.length,
          includeDetails,
          includeIncomplete,
          generatedAt: new Date().toISOString()
        }
      },
      correlationId,
      timestamp: new Date().toISOString()
    };

    // Log success
    monitoringService.log('info', 'Workout history retrieved successfully', {
      userId,
      recordCount: workoutHistory.length,
      includeDetails
    }, correlationId);

    res.status(200).json(response);

  } catch (error) {
    // Log error
    monitoringService.log('error', 'Workout history retrieval failed', {
      userId: req.headers['x-user-id'] || req.query.userId,
      error: error.message,
      stack: error.stack
    }, correlationId);

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve workout history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
