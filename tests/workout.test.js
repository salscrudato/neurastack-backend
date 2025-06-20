const request = require('supertest');
const express = require('express');
const healthRoutes = require('../routes/health');

// Mock the workout service
jest.mock('../services/workoutService', () => ({
  generateWorkout: jest.fn(),
  getHealthStatus: jest.fn()
}));

// Mock the monitoring service
jest.mock('../services/monitoringService', () => ({
  log: jest.fn()
}));

describe('Workout Endpoint', () => {
  let app;
  let workoutService;
  let monitoringService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', healthRoutes);
    
    workoutService = require('../services/workoutService');
    monitoringService = require('../services/monitoringService');
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /workout', () => {
    const validUserMetadata = {
      age: 28,
      fitnessLevel: 'intermediate',
      gender: 'female',
      weight: 65,
      goals: ['strength', 'toning'],
      equipment: ['dumbbells', 'resistance_bands'],
      timeAvailable: 45,
      injuries: ['lower_back']
    };

    const validWorkoutHistory = [
      {
        date: '2025-01-10',
        type: 'strength',
        duration: 40,
        exercises: ['squats', 'push_ups', 'planks'],
        difficulty: 'intermediate',
        rating: 4
      }
    ];

    const validWorkoutRequest = 'I want a full-body strength workout that focuses on my core and upper body, avoiding any exercises that strain my lower back';

    const mockWorkoutResponse = {
      status: 'success',
      data: {
        workout: {
          type: 'strength',
          duration: '45 minutes',
          difficulty: 'intermediate',
          equipment: ['dumbbells', 'resistance_bands'],
          exercises: [
            {
              name: 'Dumbbell Chest Press',
              category: 'strength',
              sets: 3,
              reps: '10-12',
              rest: '60 seconds',
              instructions: 'Lie on your back, press dumbbells up from chest level...',
              modifications: 'Use lighter weights or resistance bands for easier variation',
              targetMuscles: ['chest', 'shoulders', 'triceps']
            }
          ],
          warmup: [
            {
              name: 'Arm Circles',
              duration: '2 minutes',
              instructions: 'Stand with arms extended, make small circles...'
            }
          ],
          cooldown: [
            {
              name: 'Chest Stretch',
              duration: '1 minute',
              instructions: 'Stand in doorway, place forearm against frame...'
            }
          ],
          notes: 'Focus on proper form over heavy weights. Avoid any exercises that cause lower back discomfort.',
          calorieEstimate: '250-300 calories',
          tags: ['strength', 'upper_body', 'core', 'back_friendly']
        },
        metadata: {
          model: 'gpt-4o-mini',
          provider: 'openai',
          timestamp: '2025-01-15T10:30:45.123Z',
          userId: 'user123'
        }
      }
    };

    it('should return 200 with workout plan when request is valid', async () => {
      workoutService.generateWorkout.mockResolvedValue(mockWorkoutResponse);

      const response = await request(app)
        .post('/workout')
        .set('X-User-Id', 'user123')
        .send({
          userMetadata: validUserMetadata,
          workoutHistory: validWorkoutHistory,
          workoutRequest: validWorkoutRequest
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.workout.type).toBe('strength');
      expect(response.body.data.workout.exercises).toHaveLength(1);
      expect(response.body.data.metadata.model).toBe('gpt-4o-mini');
      expect(response.body.correlationId).toBeDefined();
      expect(response.body.timestamp).toBeDefined();

      expect(workoutService.generateWorkout).toHaveBeenCalledWith(
        validUserMetadata,
        validWorkoutHistory,
        validWorkoutRequest,
        'user123'
      );

      expect(monitoringService.log).toHaveBeenCalledWith(
        'info',
        'Workout generation request received',
        expect.objectContaining({
          userId: 'user123',
          hasMetadata: true,
          hasHistory: true,
          requestLength: validWorkoutRequest.length
        }),
        expect.any(String)
      );
    });

    it('should return 200 with workout plan when no workout history is provided', async () => {
      workoutService.generateWorkout.mockResolvedValue(mockWorkoutResponse);

      const response = await request(app)
        .post('/workout')
        .set('X-User-Id', 'user123')
        .send({
          userMetadata: validUserMetadata,
          workoutRequest: validWorkoutRequest
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(workoutService.generateWorkout).toHaveBeenCalledWith(
        validUserMetadata,
        [],
        validWorkoutRequest,
        'user123'
      );
    });

    it('should use anonymous user when X-User-Id header is not provided', async () => {
      workoutService.generateWorkout.mockResolvedValue(mockWorkoutResponse);

      const response = await request(app)
        .post('/workout')
        .send({
          userMetadata: validUserMetadata,
          workoutRequest: validWorkoutRequest
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(workoutService.generateWorkout).toHaveBeenCalledWith(
        validUserMetadata,
        [],
        validWorkoutRequest,
        'anonymous'
      );
    });

    it('should return 400 when userMetadata is missing', async () => {
      const response = await request(app)
        .post('/workout')
        .send({
          workoutRequest: validWorkoutRequest
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('userMetadata is required');
      expect(response.body.correlationId).toBeDefined();
      expect(workoutService.generateWorkout).not.toHaveBeenCalled();
    });

    it('should return 400 when workoutRequest is missing', async () => {
      const response = await request(app)
        .post('/workout')
        .send({
          userMetadata: validUserMetadata
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('workoutRequest is required');
      expect(response.body.correlationId).toBeDefined();
      expect(workoutService.generateWorkout).not.toHaveBeenCalled();
    });

    it('should return 400 when workout service throws validation error', async () => {
      const validationError = new Error('userMetadata.age must be a number between 13 and 100');
      workoutService.generateWorkout.mockRejectedValue(validationError);

      const response = await request(app)
        .post('/workout')
        .send({
          userMetadata: { ...validUserMetadata, age: 150 },
          workoutRequest: validWorkoutRequest
        })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('userMetadata.age must be a number between 13 and 100');
      expect(response.body.retryable).toBe(false);
      expect(response.body.supportInfo.suggestion).toContain('check your request parameters');
    });

    it('should return 503 when workout service times out', async () => {
      const timeoutError = new Error('AI model timeout');
      workoutService.generateWorkout.mockRejectedValue(timeoutError);

      const response = await request(app)
        .post('/workout')
        .send({
          userMetadata: validUserMetadata,
          workoutRequest: validWorkoutRequest
        })
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Workout generation service temporarily unavailable');
      expect(response.body.retryable).toBe(true);
      expect(response.body.supportInfo.suggestion).toContain('try again in a few moments');
    });

    it('should return 500 for unexpected errors', async () => {
      const unexpectedError = new Error('Unexpected database error');
      workoutService.generateWorkout.mockRejectedValue(unexpectedError);

      const response = await request(app)
        .post('/workout')
        .send({
          userMetadata: validUserMetadata,
          workoutRequest: validWorkoutRequest
        })
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Internal server error occurred during workout generation');
      expect(response.body.retryable).toBe(false);
    });
  });

  describe('GET /workout/health', () => {
    it('should return 200 when workout service is healthy', async () => {
      const healthStatus = {
        status: 'healthy',
        model: 'gpt-4o-mini',
        tier: 'free',
        timestamp: '2025-01-15T10:30:45.123Z'
      };

      workoutService.getHealthStatus.mockResolvedValue(healthStatus);

      const response = await request(app)
        .get('/workout/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.endpoint).toBe('/workout');
      expect(response.body.model).toBe('gpt-4o-mini');
      expect(response.body.tier).toBe('free');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return 503 when workout service is unhealthy', async () => {
      const healthStatus = {
        status: 'unhealthy',
        error: 'AI model unavailable',
        timestamp: '2025-01-15T10:30:45.123Z'
      };

      workoutService.getHealthStatus.mockResolvedValue(healthStatus);

      const response = await request(app)
        .get('/workout/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.endpoint).toBe('/workout');
      expect(response.body.error).toBe('AI model unavailable');
    });

    it('should return 503 when health check throws error', async () => {
      const error = new Error('Health check failed');
      workoutService.getHealthStatus.mockRejectedValue(error);

      const response = await request(app)
        .get('/workout/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.endpoint).toBe('/workout');
      expect(response.body.error).toBe('Health check failed');
    });
  });
});
