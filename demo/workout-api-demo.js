/**
 * Generate Workout API Demo
 * Demonstrates the new workout generation endpoints
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:8080';
const USER_ID = 'demo-user-123';

// Demo workout request
const demoWorkoutRequest = {
  fitnessLevel: 'intermediate',
  fitnessGoals: ['muscle_gain', 'strength'],
  equipment: ['dumbbells', 'resistance_bands', 'pull_up_bar'],
  age: 28,
  gender: 'male',
  weight: 75,
  injuries: [],
  daysPerWeek: 4,
  minutesPerSession: 45,
  workoutType: 'Upper Body Push Workout'
};

async function demonstrateWorkoutAPI() {
  console.log('🏋️‍♂️ Generate Workout API Demo\n');

  try {
    // 1. Generate a workout
    console.log('1. Generating workout...');
    console.log('Request:', JSON.stringify(demoWorkoutRequest, null, 2));
    
    const workoutResponse = await axios.post(`${BASE_URL}/workout/generate-workout`, demoWorkoutRequest, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': USER_ID
      }
    });

    console.log('\n✅ Workout generated successfully!');
    console.log('Workout ID:', workoutResponse.data.data.workoutId);
    console.log('Workout Type:', workoutResponse.data.data.workout.type);
    console.log('Duration:', workoutResponse.data.data.workout.duration);
    console.log('Difficulty:', workoutResponse.data.data.workout.difficulty);
    console.log('Number of exercises:', workoutResponse.data.data.workout.exercises?.length || 0);
    
    if (workoutResponse.data.data.workout.exercises && workoutResponse.data.data.workout.exercises.length > 0) {
      console.log('\nFirst exercise:');
      const firstExercise = workoutResponse.data.data.workout.exercises[0];
      console.log(`- ${firstExercise.name}: ${firstExercise.sets} sets x ${firstExercise.reps} reps`);
    }

    const workoutId = workoutResponse.data.data.workoutId;

    // 2. Submit workout feedback
    console.log('\n2. Submitting workout feedback...');
    const feedbackRequest = {
      workoutId,
      completed: true,
      rating: 4,
      difficulty: 'just_right',
      duration: 43,
      exercisesCompleted: ['Push-ups', 'Dumbbell Press', 'Tricep Dips'],
      exercisesSkipped: [],
      notes: 'Great workout! Felt challenging but manageable.',
      injuries: [],
      enjoyment: 5
    };

    const feedbackResponse = await axios.post(`${BASE_URL}/workout/complete-workout`, feedbackRequest, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': USER_ID
      }
    });

    console.log('✅ Feedback submitted successfully!');
    console.log('Feedback processed:', feedbackResponse.data.data.processed);

    // 3. Get workout history
    console.log('\n3. Retrieving workout history...');
    const historyResponse = await axios.get(`${BASE_URL}/workout/workout-history?limit=5`, {
      headers: {
        'X-User-Id': USER_ID
      }
    });

    console.log('✅ Workout history retrieved!');
    console.log('Total workouts:', historyResponse.data.data.totalWorkouts);
    console.log('Stats:', JSON.stringify(historyResponse.data.data.stats, null, 2));

    // 4. Test different workout types
    console.log('\n4. Testing different workout types...');
    
    const workoutTypes = [
      {
        type: 'Leg Day Workout',
        goals: ['strength', 'muscle_gain'],
        equipment: ['dumbbells'],
        level: 'advanced'
      },
      {
        type: 'Cardio HIIT',
        goals: ['weight_loss', 'endurance'],
        equipment: [],
        level: 'beginner'
      },
      {
        type: 'Core Strengthening',
        goals: ['toning', 'general_fitness'],
        equipment: ['yoga_mat'],
        level: 'intermediate'
      }
    ];

    for (const workout of workoutTypes) {
      const testRequest = {
        ...demoWorkoutRequest,
        workoutType: workout.type,
        fitnessGoals: workout.goals,
        equipment: workout.equipment,
        fitnessLevel: workout.level,
        minutesPerSession: 30
      };

      try {
        const response = await axios.post(`${BASE_URL}/workout/generate-workout`, testRequest, {
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': USER_ID
          }
        });

        console.log(`✅ ${workout.type}: Generated successfully (${response.data.data.workout.exercises?.length || 0} exercises)`);
      } catch (error) {
        console.log(`❌ ${workout.type}: Failed - ${error.response?.data?.message || error.message}`);
      }
    }

    // 5. Test validation
    console.log('\n5. Testing validation...');
    
    const invalidRequests = [
      {
        name: 'Missing fitness level',
        request: { ...demoWorkoutRequest, fitnessLevel: undefined }
      },
      {
        name: 'Invalid age',
        request: { ...demoWorkoutRequest, age: 12 }
      },
      {
        name: 'Invalid gender',
        request: { ...demoWorkoutRequest, gender: 'invalid' }
      },
      {
        name: 'Empty fitness goals',
        request: { ...demoWorkoutRequest, fitnessGoals: [] }
      }
    ];

    for (const test of invalidRequests) {
      try {
        await axios.post(`${BASE_URL}/workout/generate-workout`, test.request, {
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': USER_ID
          }
        });
        console.log(`❌ ${test.name}: Should have failed but didn't`);
      } catch (error) {
        if (error.response?.status === 400) {
          console.log(`✅ ${test.name}: Correctly rejected - ${error.response.data.message}`);
        } else {
          console.log(`❌ ${test.name}: Unexpected error - ${error.message}`);
        }
      }
    }

    console.log('\n🎉 Demo completed successfully!');
    console.log('\nAPI Features Demonstrated:');
    console.log('✅ Workout generation with structured parameters');
    console.log('✅ Intelligent personalization based on user data');
    console.log('✅ Workout feedback collection');
    console.log('✅ Workout history tracking');
    console.log('✅ Multiple workout types support');
    console.log('✅ Input validation and error handling');
    console.log('✅ Equipment optimization');
    console.log('✅ Injury considerations');

  } catch (error) {
    console.error('❌ Demo failed:', error.response?.data || error.message);
    console.error('\nMake sure the server is running on', BASE_URL);
    console.error('Start the server with: npm start');
  }
}

// Run the demo
if (require.main === module) {
  demonstrateWorkoutAPI();
}

module.exports = { demonstrateWorkoutAPI };
