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

    // Basic validation - only essential fields
    const validation = workoutConfig.VALIDATION_RULES;
    if (!age || age < validation.age.min || age > validation.age.max) {
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
    monitoringService.log('info', 'Flexible workout generated successfully', {
      userId,
      workoutId,
      workoutType: workoutResult.data.workout.type,
      exerciseCount: workoutResult.data.workout.exercises ? workoutResult.data.workout.exercises.length : 0,
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
    monitoringService.log('error', 'Flexible workout generation failed', {
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
 * Enhanced Workout Completion Endpoint
 * Captures detailed workout completion data including exercises, sets, reps, weights, and feedback
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
      rating,
      difficulty,
      enjoyment,
      energy,
      notes,
      injuries,
      environment
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

    if (!exercises || !Array.isArray(exercises)) {
      return res.status(400).json({
        status: 'error',
        message: 'exercises array is required',
        correlationId,
        timestamp: new Date().toISOString()
      });
    }

    // Log completion data received
    monitoringService.log('info', 'Detailed workout completion received', {
      userId,
      workoutId,
      completed,
      completionPercentage: completionPercentage || 0,
      exerciseCount: exercises.length,
      actualDuration: actualDuration || 0
    }, correlationId);

    // Create comprehensive completion record
    const completionRecord = {
      workoutId,
      userId,
      completed,
      completionPercentage: completionPercentage || (completed ? 100 : 0),
      actualDuration: actualDuration || 0,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      completedAt: completedAt ? new Date(completedAt) : new Date(),
      exercises: exercises.map(exercise => ({
        name: exercise.name || '',
        type: exercise.type || 'strength',
        muscleGroups: exercise.muscleGroups || '',
        sets: (exercise.sets || []).map(set => ({
          setNumber: set.setNumber || 1,
          reps: set.reps || 0,
          weight: set.weight || 0,
          duration: set.duration || 0,
          distance: set.distance || 0,
          restTime: set.restTime || '',
          completed: set.completed !== false, // Default to true
          notes: set.notes || ''
        })),
        totalReps: exercise.totalReps || 0,
        totalWeight: exercise.totalWeight || 0,
        totalDuration: exercise.totalDuration || 0,
        completed: exercise.completed !== false, // Default to true
        difficulty: exercise.difficulty || 'just_right',
        notes: exercise.notes || ''
      })),
      rating: rating || null,
      difficulty: difficulty || 'just_right',
      enjoyment: enjoyment || null,
      energy: energy || null,
      notes: notes || '',
      injuries: injuries || [],
      environment: environment || {},
      submittedAt: new Date(),
      correlationId
    };

    // Store detailed completion data
    await workoutHistoryService.storeWorkoutCompletion(completionRecord);

    // Update workout status
    await workoutHistoryService.updateWorkoutStatus(workoutId, completed ? 'completed' : 'incomplete');

    // Update user stats and analytics
    await workoutHistoryService.updateUserStats(userId);

    // Log success
    monitoringService.log('info', 'Detailed workout completion processed successfully', {
      userId,
      workoutId,
      completionProcessed: true,
      exercisesTracked: exercises.length
    }, correlationId);

    res.status(200).json({
      status: 'success',
      message: 'Workout completion data saved successfully',
      data: {
        workoutId,
        completed,
        completionPercentage: completionRecord.completionPercentage,
        exercisesTracked: exercises.length,
        processed: true
      },
      correlationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // Log error
    monitoringService.log('error', 'Workout completion processing failed', {
      userId: req.headers['x-user-id'] || 'anonymous',
      error: error.message,
      stack: error.stack
    }, correlationId);

    res.status(500).json({
      status: 'error',
      message: 'Failed to process workout completion data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      correlationId,
      timestamp: new Date().toISOString()
    });
  }
});

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
