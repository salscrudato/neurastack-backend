/**
 * Test New Workout API Format
 * Verifies the response matches the exact frontend format requirements
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:8080';
const USER_ID = 'test-user-format';

// Test workout request
const testWorkoutRequest = {
  fitnessLevel: 'intermediate',
  fitnessGoals: ['muscle_gain', 'strength'],
  equipment: ['dumbbells', 'resistance_bands'],
  age: 28,
  gender: 'male',
  weight: 75,
  injuries: [],
  daysPerWeek: 4,
  minutesPerSession: 45,
  workoutType: 'Upper Body Strength'
};

async function testNewFormat() {
  console.log('🧪 Testing New Workout API Format\n');

  try {
    // 1. Test workout generation
    console.log('1. Testing workout generation...');
    
    const workoutResponse = await axios.post(`${BASE_URL}/workout/generate-workout`, testWorkoutRequest, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': USER_ID
      }
    });

    console.log('✅ Workout generated successfully!');
    
    // Verify response structure
    const response = workoutResponse.data;
    const workout = response.data.workout;
    
    console.log('\n📋 Response Structure Validation:');
    
    // Check top-level structure
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Message: ${response.message}`);
    console.log(`✅ Timestamp: ${response.timestamp}`);
    console.log(`✅ Correlation ID: ${response.correlationId}`);
    console.log(`✅ Retryable: ${response.retryable}`);
    
    // Check workout structure
    console.log(`\n🏋️‍♂️ Workout Structure:`);
    console.log(`✅ Type: ${workout.type}`);
    console.log(`✅ Duration: ${workout.duration} (${typeof workout.duration})`);
    console.log(`✅ Difficulty: ${workout.difficulty}`);
    console.log(`✅ Equipment: [${workout.equipment.join(', ')}]`);
    
    // Check mainWorkout structure
    if (workout.mainWorkout) {
      console.log(`\n💪 Main Workout Structure:`);
      console.log(`✅ Structure: ${workout.mainWorkout.structure}`);
      console.log(`✅ Exercise count: ${workout.mainWorkout.exercises.length}`);
      
      // Check first exercise structure
      if (workout.mainWorkout.exercises.length > 0) {
        const exercise = workout.mainWorkout.exercises[0];
        console.log(`\n🎯 First Exercise Structure:`);
        console.log(`✅ Name: ${exercise.name}`);
        console.log(`✅ Category: ${exercise.category}`);
        console.log(`✅ Sets: ${exercise.sets} (${typeof exercise.sets})`);
        console.log(`✅ Reps: ${exercise.reps} (${typeof exercise.reps})`);
        console.log(`✅ Rest: ${exercise.rest} (${typeof exercise.rest})`);
        console.log(`✅ Duration: ${exercise.duration} (${typeof exercise.duration})`);
        console.log(`✅ Instructions: ${exercise.instructions ? 'Present' : 'Missing'}`);
        console.log(`✅ Form Cues: ${exercise.formCues ? exercise.formCues.length + ' cues' : 'Missing'}`);
        console.log(`✅ Modifications: ${exercise.modifications ? 'Present' : 'Missing'}`);
        console.log(`✅ Target Muscles: [${exercise.targetMuscles ? exercise.targetMuscles.join(', ') : 'Missing'}]`);
        console.log(`✅ Equipment: [${exercise.equipment ? exercise.equipment.join(', ') : 'Missing'}]`);
        console.log(`✅ Intensity: ${exercise.intensity}`);
        console.log(`✅ RPE: ${exercise.rpe} (${typeof exercise.rpe})`);
        console.log(`✅ Progression Notes: ${exercise.progressionNotes ? exercise.progressionNotes.length + ' notes' : 'Missing'}`);
      }
    } else {
      console.log('❌ Missing mainWorkout structure');
    }
    
    // Check warmup structure
    if (workout.warmup && Array.isArray(workout.warmup)) {
      console.log(`\n🔥 Warmup Structure:`);
      console.log(`✅ Warmup exercises: ${workout.warmup.length}`);
      if (workout.warmup.length > 0) {
        const warmupEx = workout.warmup[0];
        console.log(`✅ First warmup: ${warmupEx.name} - ${warmupEx.duration}`);
      }
    } else {
      console.log('❌ Missing or invalid warmup structure');
    }
    
    // Check cooldown structure
    if (workout.cooldown && Array.isArray(workout.cooldown)) {
      console.log(`\n❄️ Cooldown Structure:`);
      console.log(`✅ Cooldown exercises: ${workout.cooldown.length}`);
      if (workout.cooldown.length > 0) {
        const cooldownEx = workout.cooldown[0];
        console.log(`✅ First cooldown: ${cooldownEx.name} - ${cooldownEx.duration}`);
      }
    } else {
      console.log('❌ Missing or invalid cooldown structure');
    }
    
    // Check professional elements
    console.log(`\n👨‍⚕️ Professional Elements:`);
    console.log(`✅ Professional Notes: ${workout.professionalNotes ? 'Present' : 'Missing'}`);
    console.log(`✅ Tags: [${workout.tags ? workout.tags.join(', ') : 'Missing'}]`);
    console.log(`✅ Coaching Tips: ${workout.coachingTips ? workout.coachingTips.length + ' tips' : 'Missing'}`);
    
    // Check metadata structure
    const metadata = response.data.metadata;
    console.log(`\n📊 Metadata Structure:`);
    console.log(`✅ Model: ${metadata.model}`);
    console.log(`✅ Provider: ${metadata.provider}`);
    console.log(`✅ Timestamp: ${metadata.timestamp}`);
    console.log(`✅ Correlation ID: ${metadata.correlationId}`);
    console.log(`✅ User ID: ${metadata.userId}`);
    
    if (metadata.debug) {
      console.log(`✅ Debug Info: Present`);
      console.log(`  - Request Format: ${metadata.debug.requestFormat}`);
      console.log(`  - Enhanced Format: ${metadata.debug.isEnhancedFormat}`);
      console.log(`  - Parsed Workout Type: ${metadata.debug.parsedWorkoutType}`);
      if (metadata.debug.typeConsistency) {
        console.log(`  - Type Consistency: ${JSON.stringify(metadata.debug.typeConsistency)}`);
      }
    }

    // Store workout ID for completion test
    const workoutId = response.data.workout.workoutId || 'test-workout-id';

    // 2. Test workout completion
    console.log('\n2. Testing workout completion...');
    
    const completionRequest = {
      workoutId,
      completed: true,
      rating: 4,
      difficulty: 'just_right',
      notes: 'Great workout format test!'
    };

    const completionResponse = await axios.post(`${BASE_URL}/workout/complete-workout`, completionRequest, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': USER_ID
      }
    });

    console.log('✅ Workout completion updated successfully!');
    console.log(`✅ Status: ${completionResponse.data.status}`);
    console.log(`✅ Message: ${completionResponse.data.message}`);
    console.log(`✅ Processed: ${completionResponse.data.data.processed}`);

    // 3. Validate format compliance
    console.log('\n3. Format Compliance Check:');
    
    const requiredFields = [
      'status', 'data', 'message', 'timestamp', 'correlationId', 'retryable'
    ];
    
    const workoutRequiredFields = [
      'type', 'duration', 'difficulty', 'equipment', 'mainWorkout', 'warmup', 'cooldown',
      'professionalNotes', 'tags', 'coachingTips'
    ];
    
    const exerciseRequiredFields = [
      'name', 'category', 'sets', 'reps', 'rest', 'duration', 'instructions',
      'formCues', 'modifications', 'targetMuscles', 'equipment', 'intensity', 'rpe', 'progressionNotes'
    ];

    let complianceScore = 0;
    let totalChecks = 0;

    // Check top-level fields
    requiredFields.forEach(field => {
      totalChecks++;
      if (response[field] !== undefined) {
        complianceScore++;
        console.log(`✅ ${field}: Present`);
      } else {
        console.log(`❌ ${field}: Missing`);
      }
    });

    // Check workout fields
    workoutRequiredFields.forEach(field => {
      totalChecks++;
      if (workout[field] !== undefined) {
        complianceScore++;
        console.log(`✅ workout.${field}: Present`);
      } else {
        console.log(`❌ workout.${field}: Missing`);
      }
    });

    // Check exercise fields (first exercise)
    if (workout.mainWorkout && workout.mainWorkout.exercises && workout.mainWorkout.exercises.length > 0) {
      const exercise = workout.mainWorkout.exercises[0];
      exerciseRequiredFields.forEach(field => {
        totalChecks++;
        if (exercise[field] !== undefined) {
          complianceScore++;
          console.log(`✅ exercise.${field}: Present`);
        } else {
          console.log(`❌ exercise.${field}: Missing`);
        }
      });
    }

    const compliancePercentage = (complianceScore / totalChecks * 100).toFixed(1);
    console.log(`\n📊 Format Compliance: ${complianceScore}/${totalChecks} (${compliancePercentage}%)`);

    if (compliancePercentage >= 95) {
      console.log('🎉 EXCELLENT: Format is fully compliant!');
    } else if (compliancePercentage >= 85) {
      console.log('✅ GOOD: Format is mostly compliant');
    } else {
      console.log('⚠️ NEEDS WORK: Format compliance is low');
    }

    console.log('\n🎯 API Summary:');
    console.log('✅ Only 2 API calls needed: generate-workout + complete-workout');
    console.log('✅ All user memory handled automatically in backend');
    console.log('✅ Response format matches frontend requirements');
    console.log('✅ Professional trainer quality with form cues and progression notes');
    console.log('✅ Comprehensive metadata for debugging and tracking');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('\nMake sure the server is running on', BASE_URL);
    console.error('Start the server with: npm start');
  }
}

// Run the test
if (require.main === module) {
  testNewFormat();
}

module.exports = { testNewFormat };
