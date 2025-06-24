const request = require('supertest');

// Mock Firebase Admin before importing the app
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        set: jest.fn(),
        get: jest.fn(() => Promise.resolve({ exists: false })),
        update: jest.fn()
      })),
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ docs: [] }))
          }))
        }))
      })),
      limit: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ docs: [] }))
      }))
    }))
  }))
}));

// Mock the workout history service
jest.mock('../services/workoutHistoryService', () => ({
  storeWorkout: jest.fn(() => Promise.resolve('test-workout-id')),
  storeFeedback: jest.fn(() => Promise.resolve()),
  updateWorkoutStatus: jest.fn(() => Promise.resolve()),
  getUserWorkoutHistory: jest.fn(() => Promise.resolve([])),
  getUserWorkoutStats: jest.fn(() => Promise.resolve({
    totalWorkouts: 0,
    completedWorkouts: 0,
    completionRate: 0,
    averageRating: 0
  }))
}));

const app = require('../index');

describe('Workout API Basic Tests', () => {
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

  describe('POST /workout/generate-workout', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/workout/generate-workout')
        .send({})
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('required');
    });

    it('should validate fitness level', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        fitnessLevel: 'invalid_level'
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('fitnessLevel must be one of');
    });

    it('should validate age range', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        age: 12
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('age must be a number between 13 and 100');
    });

    it('should validate gender', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        gender: 'invalid'
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('gender must be either "male" or "female"');
    });

    it('should validate weight range', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        weight: 25
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('weight must be a number between 30 and 500');
    });

    it('should validate days per week', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        daysPerWeek: 8
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('daysPerWeek must be a number between 1 and 7');
    });

    it('should validate minutes per session', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        minutesPerSession: 5
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('minutesPerSession must be a number between 10 and 180');
    });

    it('should validate fitness goals array', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        fitnessGoals: []
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('fitnessGoals must be a non-empty array');
    });

    it('should validate equipment array', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        equipment: 'not_an_array'
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('equipment must be an array');
    });

    it('should validate injuries array', async () => {
      const invalidRequest = {
        ...validWorkoutRequest,
        injuries: 'not_an_array'
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('injuries must be an array');
    });


  });

  describe('POST /workout/workout-feedback', () => {
    it('should validate required workoutId', async () => {
      const response = await request(app)
        .post('/workout/workout-feedback')
        .send({
          completed: true,
          rating: 4
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('workoutId is required');
    });

    it('should validate completed field', async () => {
      const response = await request(app)
        .post('/workout/workout-feedback')
        .send({
          workoutId: 'test-id',
          rating: 4
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('completed must be a boolean value');
    });
  });

  describe('GET /workout/workout-history', () => {
    it('should return workout history', async () => {
      const response = await request(app)
        .get('/workout/workout-history')
        .set('X-User-Id', 'test-user')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.workouts).toBeDefined();
      expect(response.body.data.stats).toBeDefined();
    });
  });
});
