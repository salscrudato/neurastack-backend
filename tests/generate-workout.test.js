const request = require('supertest');
const app = require('../index');

describe('Generate Workout API', () => {
  const validWorkoutRequest = {
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

  const testUserId = 'test-user-123';

  describe('POST /workout/generate-workout', () => {
    it('should generate a workout with valid parameters', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(validWorkoutRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.workoutId).toBeDefined();
      expect(response.body.data.workout).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();
      expect(response.body.correlationId).toBeDefined();
      expect(response.body.timestamp).toBeDefined();

      // Validate workout structure
      const workout = response.body.data.workout;
      expect(workout.type).toBeDefined();
      expect(workout.duration).toBeDefined();
      expect(workout.difficulty).toBeDefined();
      expect(workout.equipment).toBeDefined();
      expect(workout.exercises).toBeDefined();
      expect(Array.isArray(workout.exercises)).toBe(true);
      expect(workout.exercises.length).toBeGreaterThan(0);

      // Validate exercise structure
      const exercise = workout.exercises[0];
      expect(exercise.name).toBeDefined();
      expect(exercise.sets).toBeDefined();
      expect(exercise.reps).toBeDefined();
      expect(exercise.instructions).toBeDefined();
    });

    it('should handle bodyweight workouts (no equipment)', async () => {
      const bodyweightRequest = {
        ...validWorkoutRequest,
        equipment: [],
        workoutType: 'Bodyweight Full Body'
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(bodyweightRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workout.equipment).toEqual([]);
    });

    it('should handle beginner fitness level', async () => {
      const beginnerRequest = {
        ...validWorkoutRequest,
        fitnessLevel: 'beginner',
        minutesPerSession: 30
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(beginnerRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workout.difficulty).toBe('beginner');
    });

    it('should handle advanced fitness level', async () => {
      const advancedRequest = {
        ...validWorkoutRequest,
        fitnessLevel: 'advanced',
        minutesPerSession: 90
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(advancedRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workout.difficulty).toBe('advanced');
    });

    it('should handle injury modifications', async () => {
      const injuryRequest = {
        ...validWorkoutRequest,
        injuries: ['lower_back', 'knee'],
        workoutType: 'Low Impact Strength'
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(injuryRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metadata.personalizedFactors.adaptedForInjuries).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidRequest = {
        fitnessLevel: 'intermediate'
        // Missing other required fields
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('required');
    });

    it('should return 400 for invalid fitness level', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        fitnessLevel: 'invalid_level'
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('fitnessLevel must be one of');
    });

    it('should return 400 for invalid age', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        age: 12 // Below minimum
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('age must be a number between 13 and 100');
    });

    it('should return 400 for invalid gender', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        gender: 'invalid_gender'
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('gender must be either "male" or "female"');
    });

    it('should return 400 for invalid weight', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        weight: 25 // Below minimum
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('weight must be a number between 30 and 500');
    });

    it('should return 400 for invalid days per week', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        daysPerWeek: 8 // Above maximum
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('daysPerWeek must be a number between 1 and 7');
    });

    it('should return 400 for invalid minutes per session', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        minutesPerSession: 5 // Below minimum
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('minutesPerSession must be a number between 10 and 180');
    });

    it('should work without X-User-Id header', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .send(validWorkoutRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workoutId).toBeDefined();
    });
  });

  describe('POST /workout/workout-feedback', () => {
    let workoutId;

    beforeEach(async () => {
      // Generate a workout first to get a workoutId
      const workoutResponse = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', testUserId)
        .send(validWorkoutRequest);
      
      workoutId = workoutResponse.body.data.workoutId;
    });

    it('should submit workout feedback successfully', async () => {
      const feedbackRequest = {
        workoutId,
        completed: true,
        rating: 4,
        difficulty: 'just_right',
        duration: 43,
        exercisesCompleted: ['Push-ups', 'Squats'],
        exercisesSkipped: [],
        notes: 'Great workout!',
        injuries: [],
        enjoyment: 5
      };

      const response = await request(app)
        .post('/workout/workout-feedback')
        .set('X-User-Id', testUserId)
        .send(feedbackRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('feedback received and processed');
      expect(response.body.data.workoutId).toBe(workoutId);
      expect(response.body.data.processed).toBe(true);
    });

    it('should handle incomplete workout feedback', async () => {
      const feedbackRequest = {
        workoutId,
        completed: false,
        rating: 2,
        difficulty: 'too_hard',
        notes: 'Too challenging for today'
      };

      const response = await request(app)
        .post('/workout/workout-feedback')
        .set('X-User-Id', testUserId)
        .send(feedbackRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
    });

    it('should return 400 for missing workoutId', async () => {
      const feedbackRequest = {
        completed: true,
        rating: 4
      };

      const response = await request(app)
        .post('/workout/workout-feedback')
        .set('X-User-Id', testUserId)
        .send(feedbackRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('workoutId is required');
    });

    it('should return 400 for missing completed field', async () => {
      const feedbackRequest = {
        workoutId,
        rating: 4
      };

      const response = await request(app)
        .post('/workout/workout-feedback')
        .set('X-User-Id', testUserId)
        .send(feedbackRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('completed must be a boolean value');
    });
  });

  describe('GET /workout/workout-history', () => {
    beforeEach(async () => {
      // Generate a few workouts for history
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/workout/generate-workout')
          .set('X-User-Id', testUserId)
          .send({
            ...validWorkoutRequest,
            workoutType: `Test Workout ${i + 1}`
          });
      }
    });

    it('should retrieve workout history', async () => {
      const response = await request(app)
        .get('/workout/workout-history')
        .set('X-User-Id', testUserId)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.workouts).toBeDefined();
      expect(Array.isArray(response.body.data.workouts)).toBe(true);
      expect(response.body.data.stats).toBeDefined();
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/workout/workout-history?limit=2')
        .set('X-User-Id', testUserId)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workouts.length).toBeLessThanOrEqual(2);
    });

    it('should handle includeIncomplete parameter', async () => {
      const response = await request(app)
        .get('/workout/workout-history?includeIncomplete=true')
        .set('X-User-Id', testUserId)
        .expect(200);

      expect(response.body.status).toBe('success');
    });
  });
});
