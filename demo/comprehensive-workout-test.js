/**
 * Comprehensive Workout API Testing Script
 * Tests all workout endpoints with consistent mocked user ID
 * 
 * This script thoroughly tests:
 * 1. Generate workout endpoint with various parameters
 * 2. Workout completion endpoint with exercise tracking
 * 3. Workout history endpoint with different query options
 * 4. Error handling and validation
 * 5. Data consistency across endpoints
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:8080';
const TEST_USER_ID = 'test-user-comprehensive-2025';
const CORRELATION_ID = `test-${Date.now()}`;

// Test data templates
const WORKOUT_TEMPLATES = {
  basic: {
    age: 28,
    fitnessLevel: 'intermediate',
    gender: 'male',
    weight: 175,
    goals: 'Build muscle and strength',
    equipment: 'Full gym access',
    injuries: 'None',
    timeAvailable: 45,
    daysPerWeek: 4,
    workoutType: 'Upper body strength training',
    otherInformation: 'I prefer compound movements and want to focus on progressive overload'
  },
  cardio: {
    age: 32,
    fitnessLevel: 'beginner',
    gender: 'female',
    weight: 140,
    goals: ['Weight loss', 'Cardiovascular health'],
    equipment: ['Treadmill', 'Dumbbells'],
    injuries: 'Previous knee injury',
    timeAvailable: 30,
    daysPerWeek: 3,
    workoutType: 'Low-impact cardio',
    otherInformation: 'Need modifications for knee-friendly exercises'
  },
  bodyweight: {
    age: 25,
    fitnessLevel: 'advanced',
    gender: 'non-binary',
    weight: 160,
    goals: 'Functional fitness',
    equipment: 'None - bodyweight only',
    injuries: [],
    timeAvailable: 60,
    daysPerWeek: 5,
    workoutType: 'Calisthenics and bodyweight training'
  }
};

// Helper functions
function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`🧪 ${title}`);
  console.log('='.repeat(60));
}

function logTest(testName) {
  console.log(`\n🔍 Testing: ${testName}`);
}

function logSuccess(message) {
  console.log(`✅ ${message}`);
}

function logError(message, error = null) {
  console.log(`❌ ${message}`);
  if (error) {
    console.log(`   Error: ${error.message || error}`);
  }
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

// API call wrapper with error handling
async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': TEST_USER_ID,
        'X-Correlation-ID': CORRELATION_ID,
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

// Test functions
async function testGenerateWorkout() {
  logSection('WORKOUT GENERATION TESTS');
  
  const workoutIds = [];

  // Test 1: Basic workout generation
  logTest('Basic workout generation');
  const basicResult = await makeRequest('POST', '/workout/generate-workout', WORKOUT_TEMPLATES.basic);
  
  if (basicResult.success) {
    logSuccess('Basic workout generated successfully');
    logInfo(`Workout ID: ${basicResult.data.data.workoutId}`);
    logInfo(`Workout Type: ${basicResult.data.data.workout.type}`);
    logInfo(`Exercise Count: ${basicResult.data.data.workout.exercises?.length || 0}`);
    logInfo(`Duration: ${basicResult.data.data.workout.duration} minutes`);
    workoutIds.push(basicResult.data.data.workoutId);
  } else {
    logError('Basic workout generation failed', basicResult.error);
  }

  // Test 2: Cardio workout with arrays
  logTest('Cardio workout with array parameters');
  const cardioResult = await makeRequest('POST', '/workout/generate-workout', WORKOUT_TEMPLATES.cardio);
  
  if (cardioResult.success) {
    logSuccess('Cardio workout generated successfully');
    logInfo(`Workout ID: ${cardioResult.data.data.workoutId}`);
    logInfo(`Workout Type: ${cardioResult.data.data.workout.type}`);
    workoutIds.push(cardioResult.data.data.workoutId);
  } else {
    logError('Cardio workout generation failed', cardioResult.error);
  }

  // Test 3: Bodyweight workout
  logTest('Bodyweight workout generation');
  const bodyweightResult = await makeRequest('POST', '/workout/generate-workout', WORKOUT_TEMPLATES.bodyweight);
  
  if (bodyweightResult.success) {
    logSuccess('Bodyweight workout generated successfully');
    logInfo(`Workout ID: ${bodyweightResult.data.data.workoutId}`);
    workoutIds.push(bodyweightResult.data.data.workoutId);
  } else {
    logError('Bodyweight workout generation failed', bodyweightResult.error);
  }

  return workoutIds;
}

async function testWorkoutCompletion(workoutIds) {
  logSection('WORKOUT COMPLETION TESTS');
  
  if (workoutIds.length === 0) {
    logError('No workout IDs available for completion testing');
    return;
  }

  const workoutId = workoutIds[0];

  // Test 1: Complete workout with full data
  logTest('Complete workout with full exercise data');
  const completionData = {
    workoutId,
    completed: true,
    completionPercentage: 85,
    actualDuration: 42,
    startedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    completedAt: new Date().toISOString(),
    exercises: [
      {
        name: 'Bench Press',
        completed: true,
        sets: [
          { reps: 10, weight: 135, completed: true },
          { reps: 8, weight: 145, completed: true },
          { reps: 6, weight: 155, completed: true }
        ]
      },
      {
        name: 'Squats',
        completed: true,
        sets: [
          { reps: 12, weight: 185, completed: true },
          { reps: 10, weight: 195, completed: true },
          { reps: 8, weight: 205, completed: false }
        ]
      }
    ],
    feedback: {
      rating: 4,
      difficulty: 'appropriate',
      enjoyment: 'high',
      comments: 'Great workout! The bench press felt really good today.'
    }
  };

  const completionResult = await makeRequest('POST', '/workout/workout-completion', completionData);
  
  if (completionResult.success) {
    logSuccess('Workout completion recorded successfully');
    logInfo(`Completion Percentage: ${completionResult.data.data.completionPercentage}%`);
    logInfo(`Total Weight: ${completionResult.data.data.totalWeight} lbs`);
    logInfo(`Total Reps: ${completionResult.data.data.totalReps}`);
  } else {
    logError('Workout completion failed', completionResult.error);
  }

  return workoutIds;
}

async function testWorkoutHistory() {
  logSection('WORKOUT HISTORY TESTS');

  // Test 1: Basic history retrieval
  logTest('Basic workout history retrieval');
  const basicHistoryResult = await makeRequest('GET', '/workout/workout-history');

  if (basicHistoryResult.success) {
    logSuccess('Basic workout history retrieved successfully');
    logInfo(`Total workouts: ${basicHistoryResult.data.data.workouts.length}`);
    logInfo(`Completion rate: ${basicHistoryResult.data.data.stats.completionRate}%`);
    logInfo(`Total completed: ${basicHistoryResult.data.data.stats.completedWorkouts}`);
  } else {
    logError('Basic workout history retrieval failed', basicHistoryResult.error);
  }

  // Test 2: History with details
  logTest('Workout history with details');
  const detailedHistoryResult = await makeRequest('GET', '/workout/workout-history?includeDetails=true&limit=5');

  if (detailedHistoryResult.success) {
    logSuccess('Detailed workout history retrieved successfully');
    const workouts = detailedHistoryResult.data.data.workouts;
    if (workouts.length > 0 && workouts[0].completion) {
      logInfo(`First workout completion: ${workouts[0].completion.completionPercentage}%`);
    }
  } else {
    logError('Detailed workout history retrieval failed', detailedHistoryResult.error);
  }

  // Test 3: History including incomplete workouts
  logTest('Workout history including incomplete workouts');
  const incompleteHistoryResult = await makeRequest('GET', '/workout/workout-history?includeIncomplete=true&limit=10');

  if (incompleteHistoryResult.success) {
    logSuccess('History with incomplete workouts retrieved successfully');
    const workouts = incompleteHistoryResult.data.data.workouts;
    const incompleteCount = workouts.filter(w => w.status !== 'completed').length;
    logInfo(`Incomplete workouts found: ${incompleteCount}`);
  } else {
    logError('History with incomplete workouts retrieval failed', incompleteHistoryResult.error);
  }
}

async function testValidationAndErrors() {
  logSection('VALIDATION AND ERROR HANDLING TESTS');

  // Test 1: Invalid age validation
  logTest('Invalid age validation');
  const invalidAgeData = { ...WORKOUT_TEMPLATES.basic, age: 150 };
  const invalidResult = await makeRequest('POST', '/workout/generate-workout', invalidAgeData);

  if (!invalidResult.success && invalidResult.status === 400) {
    logSuccess('Age validation working correctly');
  } else {
    logError('Age validation failed - should have rejected invalid age');
  }

  // Test 2: Missing required fields
  logTest('Missing required fields validation');
  const missingFieldsData = { fitnessLevel: 'beginner' }; // Missing age
  const missingResult = await makeRequest('POST', '/workout/generate-workout', missingFieldsData);

  if (!missingResult.success && missingResult.status === 400) {
    logSuccess('Required field validation working correctly');
  } else {
    logError('Required field validation failed');
  }

  // Test 3: Invalid completion data
  logTest('Invalid completion data validation');
  const invalidCompletionData = {
    workoutId: 'invalid-workout-id',
    completed: 'not-a-boolean', // Invalid type
    exercises: [] // Empty exercises array
  };

  const invalidCompletionResult = await makeRequest('POST', '/workout/workout-completion', invalidCompletionData);

  if (!invalidCompletionResult.success && invalidCompletionResult.status === 400) {
    logSuccess('Completion validation working correctly');
  } else {
    logError('Completion validation failed');
  }

  // Test 4: History without user ID (should fail)
  logTest('History without user ID validation');
  const noUserIdResult = await makeRequest('GET', '/workout/workout-history', null, { 'X-User-Id': '' });

  if (!noUserIdResult.success && noUserIdResult.status === 400) {
    logSuccess('User ID validation working correctly');
  } else {
    logError('User ID validation failed - should require user ID');
  }
}

async function testDataConsistency(workoutIds) {
  logSection('DATA CONSISTENCY TESTS');

  if (workoutIds.length === 0) {
    logError('No workout IDs available for consistency testing');
    return;
  }

  // Test 1: Verify generated workouts appear in history
  logTest('Generated workouts appear in history');
  const historyResult = await makeRequest('GET', '/workout/workout-history?limit=20');

  if (historyResult.success) {
    const historyWorkoutIds = historyResult.data.data.workouts.map(w => w.workoutId);
    const foundIds = workoutIds.filter(id => historyWorkoutIds.includes(id));

    if (foundIds.length === workoutIds.length) {
      logSuccess('All generated workouts found in history');
    } else {
      logError(`Only ${foundIds.length}/${workoutIds.length} generated workouts found in history`);
    }
  } else {
    logError('Could not retrieve history for consistency check', historyResult.error);
  }

  // Test 2: Verify user stats are updated
  logTest('User statistics are properly calculated');
  const statsResult = await makeRequest('GET', '/workout/workout-history');

  if (statsResult.success) {
    const stats = statsResult.data.data.stats;
    logSuccess('User statistics retrieved');
    logInfo(`Total workouts: ${stats.totalWorkouts}`);
    logInfo(`Completed workouts: ${stats.completedWorkouts}`);
    logInfo(`Completion rate: ${stats.completionRate}%`);
    logInfo(`Current streak: ${stats.currentStreak}`);

    // Verify stats make sense
    if (stats.totalWorkouts >= workoutIds.length) {
      logSuccess('Total workout count is consistent');
    } else {
      logError('Total workout count seems inconsistent');
    }
  } else {
    logError('Could not retrieve user statistics', statsResult.error);
  }
}

// Main test execution
async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Workout API Tests');
  console.log(`📋 Test User ID: ${TEST_USER_ID}`);
  console.log(`🔗 Base URL: ${BASE_URL}`);
  console.log(`📊 Correlation ID: ${CORRELATION_ID}`);

  const startTime = Date.now();

  try {
    // Run all test suites
    const workoutIds = await testGenerateWorkout();
    await testWorkoutCompletion(workoutIds);
    await testWorkoutHistory();
    await testValidationAndErrors();
    await testDataConsistency(workoutIds);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    logSection('TEST SUMMARY');
    logSuccess(`All tests completed in ${duration.toFixed(2)} seconds`);
    logInfo(`Generated ${workoutIds.length} test workouts`);
    logInfo(`Test User ID: ${TEST_USER_ID}`);
    logInfo('Check the server logs for detailed processing information');

  } catch (error) {
    logError('Test execution failed', error);
  }
}

// Run the tests
if (require.main === module) {
  runComprehensiveTests().catch(console.error);
}

module.exports = { runComprehensiveTests, TEST_USER_ID, WORKOUT_TEMPLATES };
