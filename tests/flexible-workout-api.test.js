const request = require('supertest');
const app = require('../index');

describe('Flexible Workout API', () => {
  describe('POST /workout/generate-workout', () => {
    
    test('should generate workout with minimal required data', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .send({
          age: 25
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workout).toBeDefined();
      expect(response.body.data.workout.type).toBeDefined();
      expect(response.body.data.workout.duration).toBeDefined();
      expect(response.body.data.workout.exercises).toBeDefined();
      expect(Array.isArray(response.body.data.workout.exercises)).toBe(true);
    }, 30000); // 30 second timeout for AI calls

    test('should handle flexible goals as string', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .send({
          age: 30,
          goals: 'Lose Weight and Build Muscle',
          timeAvailable: 45
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workout.duration).toBe(45);
    }, 30000);

    test('should handle comprehensive workout request', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .set('X-User-Id', 'test-user-123')
        .send({
          age: 32,
          fitnessLevel: 'advanced',
          gender: 'female',
          weight: 65,
          goals: ['Athletic Performance', 'Muscle Gain'],
          equipment: ['barbells', 'dumbbells', 'pull-up bar'],
          injuries: 'Previous shoulder injury',
          timeAvailable: 60,
          daysPerWeek: 5,
          workoutType: 'Push Day - Chest, Shoulders, Triceps',
          otherInformation: 'I compete in CrossFit and need functional movements with progressive overload'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workoutId).toBeDefined();
      expect(response.body.data.workout.duration).toBe(60);
      expect(response.body.data.metadata.approach).toBe('two_stage_flexible');
      expect(response.body.data.metadata.userId).toBe('test-user-123');
    }, 30000);

    test('should handle free-form otherInformation', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .send({
          age: 26,
          otherInformation: 'I work from home and sit all day. I want exercises that help with posture and core strength. I prefer bodyweight exercises and have limited space.'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workout).toBeDefined();
    }, 30000);

    test('should validate age requirement', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .send({
          fitnessLevel: 'intermediate'
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Age is required');
    });

    test('should validate age range', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .send({
          age: 12
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('between 13 and 100');
    });

    test('should include proper response structure', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .send({
          age: 29,
          fitnessLevel: 'intermediate'
        })
        .expect(200);

      // Check main structure
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('correlationId');
      expect(response.body).toHaveProperty('timestamp');

      // Check workout structure
      const workout = response.body.data.workout;
      expect(workout).toHaveProperty('type');
      expect(workout).toHaveProperty('duration');
      expect(workout).toHaveProperty('difficulty');
      expect(workout).toHaveProperty('exercises');
      expect(workout).toHaveProperty('warmup');
      expect(workout).toHaveProperty('cooldown');
      expect(workout).toHaveProperty('coachingTips');

      // Check metadata
      const metadata = response.body.data.metadata;
      expect(metadata).toHaveProperty('model');
      expect(metadata).toHaveProperty('provider');
      expect(metadata).toHaveProperty('timestamp');
      expect(metadata).toHaveProperty('approach');
    }, 30000);
  });

  describe('POST /workout/complete-workout', () => {
    let workoutId;

    beforeAll(async () => {
      // Generate a workout first to get a valid workoutId
      const response = await request(app)
        .post('/workout/generate-workout')
        .send({
          age: 25,
          fitnessLevel: 'intermediate'
        });
      
      workoutId = response.body.data.workoutId;
    }, 30000);

    test('should complete workout successfully', async () => {
      const response = await request(app)
        .post('/workout/complete-workout')
        .set('X-User-Id', 'test-user-123')
        .send({
          workoutId: workoutId,
          completed: true,
          rating: 4,
          difficulty: 'just_right',
          notes: 'Great workout!'
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.completed).toBe(true);
      expect(response.body.data.processed).toBe(true);
    });

    test('should validate workoutId requirement', async () => {
      const response = await request(app)
        .post('/workout/complete-workout')
        .send({
          completed: true
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('workoutId is required');
    });

    test('should validate completed field type', async () => {
      const response = await request(app)
        .post('/workout/complete-workout')
        .send({
          workoutId: workoutId,
          completed: 'yes'
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('completed must be a boolean');
    });
  });
});
