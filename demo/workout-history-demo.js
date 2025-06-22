#!/usr/bin/env node

/**
 * Workout History System Demo
 * Demonstrates the comprehensive workout completion and history tracking system
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8080';
const USER_ID = 'demo-user-123';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function generateWorkout() {
  log('blue', '\n🏋️ Step 1: Generating a workout...');
  
  try {
    const response = await axios.post(`${BASE_URL}/workout/generate-workout`, {
      age: 28,
      fitnessLevel: 'intermediate',
      gender: 'female',
      weight: 65,
      goals: ['strength', 'toning'],
      equipment: ['dumbbells', 'resistance_bands'],
      timeAvailable: 45,
      injuries: [],
      daysPerWeek: 4,
      workoutType: 'Upper body strength training',
      otherInformation: 'Focus on progressive overload and proper form'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': USER_ID
      }
    });

    const workoutData = response.data.data;
    log('green', `✅ Workout generated successfully!`);
    log('cyan', `   Workout ID: ${workoutData.workoutId}`);
    log('cyan', `   Type: ${workoutData.workout.type}`);
    log('cyan', `   Duration: ${workoutData.workout.duration} minutes`);
    log('cyan', `   Exercises: ${workoutData.workout.exercises?.length || 0}`);

    return workoutData;
  } catch (error) {
    log('red', `❌ Failed to generate workout: ${error.message}`);
    throw error;
  }
}

async function completeWorkout(workoutData) {
  log('blue', '\n💪 Step 2: Completing the workout with detailed data...');
  
  try {
    // Simulate detailed workout completion data
    const completionData = {
      workoutId: workoutData.workoutId,
      completed: true,
      completionPercentage: 95,
      actualDuration: 42,
      startedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(), // 42 minutes ago
      completedAt: new Date().toISOString(),
      exercises: [
        {
          name: 'Push-ups',
          type: 'strength',
          muscleGroups: 'chest, shoulders, triceps',
          sets: [
            { setNumber: 1, reps: 12, weight: 0, completed: true, restTime: '60s' },
            { setNumber: 2, reps: 10, weight: 0, completed: true, restTime: '60s' },
            { setNumber: 3, reps: 8, weight: 0, completed: true, restTime: '90s' }
          ],
          totalReps: 30,
          totalWeight: 0,
          totalDuration: 180,
          completed: true,
          difficulty: 'just_right',
          notes: 'Good form maintained throughout'
        },
        {
          name: 'Dumbbell Rows',
          type: 'strength',
          muscleGroups: 'back, biceps',
          sets: [
            { setNumber: 1, reps: 12, weight: 15, completed: true, restTime: '60s' },
            { setNumber: 2, reps: 12, weight: 15, completed: true, restTime: '60s' },
            { setNumber: 3, reps: 10, weight: 17.5, completed: true, restTime: '90s' }
          ],
          totalReps: 34,
          totalWeight: 525, // 15*12 + 15*12 + 17.5*10
          totalDuration: 240,
          completed: true,
          difficulty: 'just_right',
          notes: 'Increased weight on final set'
        },
        {
          name: 'Resistance Band Bicep Curls',
          type: 'strength',
          muscleGroups: 'biceps',
          sets: [
            { setNumber: 1, reps: 15, weight: 0, completed: true, restTime: '45s' },
            { setNumber: 2, reps: 15, weight: 0, completed: true, restTime: '45s' },
            { setNumber: 3, reps: 12, weight: 0, completed: false, restTime: '0s', notes: 'Skipped due to fatigue' }
          ],
          totalReps: 30,
          totalWeight: 0,
          totalDuration: 150,
          completed: false,
          difficulty: 'too_hard',
          notes: 'Need to adjust resistance level'
        }
      ],
      rating: 4,
      difficulty: 'just_right',
      enjoyment: 4,
      energy: 3,
      notes: 'Great workout! Felt strong on the compound movements. Need to work on endurance for isolation exercises.',
      injuries: [],
      environment: {
        location: 'home_gym',
        temperature: 'comfortable',
        equipment_condition: 'good'
      }
    };

    const response = await axios.post(`${BASE_URL}/workout/workout-completion`, completionData, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': USER_ID
      }
    });

    log('green', `✅ Workout completion recorded successfully!`);
    log('cyan', `   Completion: ${completionData.completionPercentage}%`);
    log('cyan', `   Duration: ${completionData.actualDuration} minutes`);
    log('cyan', `   Exercises tracked: ${completionData.exercises.length}`);
    log('cyan', `   Rating: ${completionData.rating}/5`);

    return response.data;
  } catch (error) {
    log('red', `❌ Failed to record workout completion: ${error.message}`);
    throw error;
  }
}

async function getWorkoutHistory() {
  log('blue', '\n📊 Step 3: Retrieving workout history...');
  
  try {
    // Get basic history
    const basicResponse = await axios.get(`${BASE_URL}/workout/workout-history?limit=5&includeIncomplete=true`, {
      headers: {
        'X-User-Id': USER_ID
      }
    });

    log('green', `✅ Basic workout history retrieved!`);
    log('cyan', `   Total workouts: ${basicResponse.data.data.stats.totalWorkouts}`);
    log('cyan', `   Completed: ${basicResponse.data.data.stats.completedWorkouts}`);
    log('cyan', `   Completion rate: ${basicResponse.data.data.stats.completionRate.toFixed(1)}%`);
    log('cyan', `   Average rating: ${basicResponse.data.data.stats.averageRating.toFixed(1)}/5`);

    // Get detailed history
    log('blue', '\n📋 Getting detailed workout history...');
    const detailedResponse = await axios.get(`${BASE_URL}/workout/workout-history?limit=3&includeDetails=true&includeIncomplete=true`, {
      headers: {
        'X-User-Id': USER_ID
      }
    });

    log('green', `✅ Detailed workout history retrieved!`);
    
    if (detailedResponse.data.data.workouts.length > 0) {
      const latestWorkout = detailedResponse.data.data.workouts[0];
      log('cyan', `\n   Latest workout details:`);
      log('cyan', `   - Date: ${new Date(latestWorkout.date).toLocaleDateString()}`);
      log('cyan', `   - Type: ${latestWorkout.type}`);
      log('cyan', `   - Status: ${latestWorkout.status}`);
      log('cyan', `   - Duration: ${latestWorkout.duration} minutes`);
      log('cyan', `   - Exercises: ${latestWorkout.exercises.length}`);
      
      if (latestWorkout.completionDetails) {
        log('cyan', `   - Actual duration: ${latestWorkout.completionDetails.actualDuration} minutes`);
        log('cyan', `   - Completion: ${latestWorkout.completionDetails.completionPercentage}%`);
        log('cyan', `   - Enjoyment: ${latestWorkout.completionDetails.enjoyment}/5`);
        log('cyan', `   - Energy after: ${latestWorkout.completionDetails.energy}/5`);
      }
    }

    return detailedResponse.data;
  } catch (error) {
    log('red', `❌ Failed to retrieve workout history: ${error.message}`);
    throw error;
  }
}

async function runDemo() {
  log('magenta', '🎯 Workout History System Demo');
  log('magenta', '===============================');
  
  try {
    // Step 1: Generate a workout
    const workoutData = await generateWorkout();
    
    // Step 2: Complete the workout with detailed tracking
    await completeWorkout(workoutData);
    
    // Step 3: Retrieve and display workout history
    await getWorkoutHistory();
    
    log('green', '\n🎉 Demo completed successfully!');
    log('yellow', '\n📝 Summary of new features:');
    log('yellow', '   • Detailed exercise tracking (sets, reps, weights)');
    log('yellow', '   • Comprehensive completion data');
    log('yellow', '   • Enhanced workout history with analytics');
    log('yellow', '   • Clean API for frontend integration');
    log('yellow', '   • Automatic user statistics calculation');
    
  } catch (error) {
    log('red', `\n💥 Demo failed: ${error.message}`);
    process.exit(1);
  }
}

// Run the demo if called directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { runDemo };
