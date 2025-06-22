const request = require('supertest');
const app = require('../index');

describe('Optimized Workout Completion API', () => {
  const testUserId = 'test-user-completion';
  let testWorkoutId;

  beforeAll(async () => {
    // Generate a test workout first
    const workoutResponse = await request(app)
      .post('/workout/generate-workout')
      .set('X-User-Id', testUserId)
      .send({
        age: 30,
        fitnessLevel: 'intermediate',
        timeAvailable: 45,
        workoutType: 'upper body strength',
        equipment: ['Dumbbells'],
        goals: ['strength', 'muscle building']
      });

    expect(workoutResponse.status).toBe(200);
    testWorkoutId = workoutResponse.body.data.workoutId;
  });

  describe('POST /api/workout/workout-completion', () => {
    test('should successfully process comprehensive workout completion', async () => {
      const completionData = {
        workoutId: testWorkoutId,
        completed: true,
        completionPercentage: 95,
        actualDuration: 42,
        startedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
        completedAt: new Date().toISOString(),
        exercises: [
          {
            name: 'Dumbbell Shoulder Press',
            type: 'strength',
            muscleGroups: 'shoulders, triceps',
            completed: true,
            difficulty: 'just_right',
            notes: 'Felt great, good form maintained',
            sets: [
              {
                reps: 12,
                weight: 25,
                completed: true,
                targetReps: 12,
                targetWeight: 25,
                restTime: '60s'
              },
              {
                reps: 10,
                weight: 25,
                completed: true,
                targetReps: 12,
                targetWeight: 25,
                restTime: '60s'
              },
              {
                reps: 8,
                weight: 25,
                completed: true,
                targetReps: 12,
                targetWeight: 25,
                restTime: '60s'
              }
            ],
            targetSets: 3,
            targetReps: 12
          },
          {
            name: 'Dumbbell Bicep Curls',
            type: 'strength',
            muscleGroups: 'biceps',
            completed: true,
            difficulty: 'just_right',
            sets: [
              {
                reps: 15,
                weight: 20,
                completed: true,
                targetReps: 15,
                targetWeight: 20
              },
              {
                reps: 12,
                weight: 20,
                completed: true,
                targetReps: 15,
                targetWeight: 20
              }
            ],
            targetSets: 2,
            targetReps: 15
          }
        ],
        feedback: {
          rating: 4,
          difficulty: 'just_right',
          enjoyment: 4,
          energy: 3,
          notes: 'Great workout! Felt challenging but manageable.',
          injuries: [],
          environment: {
            location: 'home gym',
            temperature: 'comfortable'
          },
          wouldRecommend: true
        }
      };

      const response = await request(app)
        .post('/workout/workout-completion')
        .set('X-User-Id', testUserId)
        .send(completionData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('workoutId', testWorkoutId);
      expect(response.body.data).toHaveProperty('completed', true);
      expect(response.body.data).toHaveProperty('completionPercentage', 95);
      expect(response.body.data).toHaveProperty('exercisesTracked', 2);
      expect(response.body.data).toHaveProperty('completedExercises', 2);
      expect(response.body.data).toHaveProperty('skippedExercises', 0);
      expect(response.body.data).toHaveProperty('totalWeight');
      expect(response.body.data).toHaveProperty('totalReps');
      expect(response.body.data).toHaveProperty('nextRecommendations');
      expect(response.body.data.nextRecommendations).toHaveProperty('restDays');
      expect(response.body.data.nextRecommendations).toHaveProperty('focusAreas');
      expect(response.body.data.nextRecommendations).toHaveProperty('adjustments');
      expect(response.body.data.nextRecommendations).toHaveProperty('progressionSuggestions');
    });

    test('should handle partial workout completion', async () => {
      const partialCompletionData = {
        workoutId: testWorkoutId,
        completed: false,
        completionPercentage: 60,
        actualDuration: 25,
        exercises: [
          {
            name: 'Push-ups',
            completed: true,
            sets: [
              { reps: 10, weight: 0, completed: true },
              { reps: 8, weight: 0, completed: true }
            ]
          },
          {
            name: 'Squats',
            completed: false,
            sets: [
              { reps: 12, weight: 0, completed: true },
              { reps: 0, weight: 0, completed: false }
            ]
          }
        ],
        feedback: {
          rating: 3,
          difficulty: 'too_hard',
          notes: 'Had to stop early due to fatigue'
        }
      };

      const response = await request(app)
        .post('/workout/workout-completion')
        .set('X-User-Id', testUserId)
        .send(partialCompletionData);

      expect(response.status).toBe(200);
      expect(response.body.data.completed).toBe(false);
      expect(response.body.data.completionPercentage).toBe(60);
      expect(response.body.data.nextRecommendations.adjustments).toContain('Consider reducing workout intensity');
    });

    test('should validate required fields', async () => {
      const invalidData = {
        // Missing workoutId
        completed: true,
        exercises: []
      };

      const response = await request(app)
        .post('/workout/workout-completion')
        .set('X-User-Id', testUserId)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.errors).toContain('workoutId is required and must be a string');
    });

    test('should verify workout ownership', async () => {
      const completionData = {
        workoutId: testWorkoutId,
        completed: true,
        exercises: [
          {
            name: 'Test Exercise',
            completed: true,
            sets: [{ reps: 10, weight: 0, completed: true }]
          }
        ]
      };

      const response = await request(app)
        .post('/workout/workout-completion')
        .set('X-User-Id', 'different-user')
        .send(completionData);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Workout not found or access denied');
    });

    test('should handle missing exercises array', async () => {
      const invalidData = {
        workoutId: testWorkoutId,
        completed: true
        // Missing exercises array
      };

      const response = await request(app)
        .post('/workout/workout-completion')
        .set('X-User-Id', testUserId)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.errors).toContain('exercises array is required and cannot be empty');
    });
  });

  describe('Workout History Integration', () => {
    test('should retrieve workout history with completion data', async () => {
      const response = await request(app)
        .get('/workout/workout-history')
        .set('X-User-Id', testUserId)
        .query({ includeDetails: true, limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toHaveProperty('workouts');
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data.stats).toHaveProperty('totalWorkouts');
      expect(response.body.data.stats).toHaveProperty('completedWorkouts');
      expect(response.body.data.stats).toHaveProperty('completionRate');
    });
  });
});
