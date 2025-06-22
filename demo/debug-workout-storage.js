/**
 * Debug Workout Storage Script
 * Investigates the workout storage and retrieval issue
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8080';
const TEST_USER_ID = 'debug-user-storage-test';

async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': TEST_USER_ID,
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
}

async function debugWorkoutStorage() {
  console.log('🔍 Debug: Workout Storage Investigation');
  console.log(`User ID: ${TEST_USER_ID}`);
  
  // Step 1: Check initial history (should be empty)
  console.log('\n1. Checking initial workout history...');
  const initialHistory = await makeRequest('GET', '/workout/workout-history?includeIncomplete=true&limit=50');
  
  if (initialHistory.success) {
    console.log(`✅ Initial history retrieved: ${initialHistory.data.data.workouts.length} workouts`);
    console.log(`   Stats: ${JSON.stringify(initialHistory.data.data.stats, null, 2)}`);
  } else {
    console.log(`❌ Failed to get initial history: ${initialHistory.error}`);
  }

  // Step 2: Generate a workout
  console.log('\n2. Generating a test workout...');
  const workoutData = {
    age: 30,
    fitnessLevel: 'intermediate',
    gender: 'male',
    weight: 170,
    goals: 'Build strength',
    equipment: 'Gym',
    injuries: 'None',
    timeAvailable: 45,
    daysPerWeek: 3,
    workoutType: 'Strength training',
    otherInformation: 'Debug test workout'
  };

  const workoutResult = await makeRequest('POST', '/workout/generate-workout', workoutData);
  
  if (workoutResult.success) {
    const workoutId = workoutResult.data.data.workoutId;
    console.log(`✅ Workout generated successfully`);
    console.log(`   Workout ID: ${workoutId}`);
    console.log(`   Type: ${workoutResult.data.data.workout.type}`);
    console.log(`   Duration: ${workoutResult.data.data.workout.duration}`);
    
    // Step 3: Immediately check if workout appears in history
    console.log('\n3. Checking if workout appears in history immediately...');
    const immediateHistory = await makeRequest('GET', '/workout/workout-history?includeIncomplete=true&limit=50');
    
    if (immediateHistory.success) {
      const workouts = immediateHistory.data.data.workouts;
      const foundWorkout = workouts.find(w => w.workoutId === workoutId);
      
      console.log(`   Total workouts in history: ${workouts.length}`);
      console.log(`   Generated workout found: ${!!foundWorkout}`);
      
      if (foundWorkout) {
        console.log(`   Found workout status: ${foundWorkout.status}`);
        console.log(`   Found workout type: ${foundWorkout.workout?.type || 'N/A'}`);
      } else {
        console.log(`   ❌ Generated workout NOT found in history`);
        console.log(`   Available workout IDs: ${workouts.map(w => w.workoutId).join(', ')}`);
      }
    } else {
      console.log(`   ❌ Failed to get immediate history: ${immediateHistory.error}`);
    }

    // Step 4: Wait a moment and check again
    console.log('\n4. Waiting 2 seconds and checking history again...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const delayedHistory = await makeRequest('GET', '/workout/workout-history?includeIncomplete=true&limit=50');
    
    if (delayedHistory.success) {
      const workouts = delayedHistory.data.data.workouts;
      const foundWorkout = workouts.find(w => w.workoutId === workoutId);
      
      console.log(`   Total workouts in history: ${workouts.length}`);
      console.log(`   Generated workout found: ${!!foundWorkout}`);
      
      if (foundWorkout) {
        console.log(`   ✅ Workout found after delay`);
      } else {
        console.log(`   ❌ Workout still not found after delay`);
      }
    }

    // Step 5: Complete the workout and check again
    console.log('\n5. Completing the workout...');
    const completionData = {
      workoutId,
      completed: true,
      completionPercentage: 100,
      actualDuration: 45,
      startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      completedAt: new Date().toISOString(),
      exercises: [
        {
          name: 'Test Exercise',
          completed: true,
          sets: [{ reps: 10, weight: 100, completed: true }]
        }
      ],
      feedback: {
        rating: 5,
        difficulty: 'appropriate',
        enjoyment: 'high',
        comments: 'Debug test completion'
      }
    };

    const completionResult = await makeRequest('POST', '/workout/workout-completion', completionData);
    
    if (completionResult.success) {
      console.log(`   ✅ Workout completed successfully`);
      console.log(`   Completion percentage: ${completionResult.data.data.completionPercentage}%`);
      
      // Check history after completion
      console.log('\n6. Checking history after completion...');
      const postCompletionHistory = await makeRequest('GET', '/workout/workout-history?includeIncomplete=true&includeDetails=true&limit=50');
      
      if (postCompletionHistory.success) {
        const workouts = postCompletionHistory.data.data.workouts;
        const foundWorkout = workouts.find(w => w.workoutId === workoutId);
        
        console.log(`   Total workouts in history: ${workouts.length}`);
        console.log(`   Completed workout found: ${!!foundWorkout}`);
        
        if (foundWorkout) {
          console.log(`   ✅ Completed workout found`);
          console.log(`   Status: ${foundWorkout.status}`);
          console.log(`   Has completion data: ${!!foundWorkout.completion}`);
          if (foundWorkout.completion) {
            console.log(`   Completion percentage: ${foundWorkout.completion.completionPercentage}%`);
          }
        } else {
          console.log(`   ❌ Completed workout not found`);
        }
        
        // Show stats
        const stats = postCompletionHistory.data.data.stats;
        console.log(`   Stats - Total: ${stats.totalWorkouts}, Completed: ${stats.completedWorkouts}, Rate: ${stats.completionRate}%`);
      }
    } else {
      console.log(`   ❌ Failed to complete workout: ${completionResult.error}`);
    }

  } else {
    console.log(`❌ Failed to generate workout: ${workoutResult.error}`);
  }

  console.log('\n🏁 Debug investigation complete');
}

if (require.main === module) {
  debugWorkoutStorage().catch(console.error);
}

module.exports = { debugWorkoutStorage };
