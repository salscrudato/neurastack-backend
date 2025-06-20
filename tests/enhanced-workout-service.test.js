/**
 * Enhanced Workout Service Tests
 * Tests the improved workout service with structured data and type consistency
 */

const workoutService = require('../services/workoutService');

describe('Enhanced Workout Service', () => {
  const mockUserMetadata = {
    age: 33,
    gender: 'male',
    weight: 166,
    fitnessLevel: 'beginner',
    goals: ['lose_weight', 'build_muscle'],
    equipment: ['dumbbells', 'barbell', 'resistance_bands'],
    timeAvailable: 30,
    injuries: [],
    daysPerWeek: 6,
    minutesPerSession: 30
  };

  const mockWorkoutHistory = [];

  describe('parseWorkoutRequest', () => {
    test('should handle enhanced structured format', () => {
      const enhancedRequest = {
        workoutSpecification: {
          workoutType: 'pull',
          duration: 30,
          intensity: 'beginner',
          focus: ['strength', 'hypertrophy'],
          structure: {
            warmupDuration: 5,
            cooldownDuration: 5,
            restBetweenSets: 60
          },
          constraints: {
            avoidExercises: ['deadlift'],
            preferredExercises: ['rows']
          }
        }
      };

      const parsed = workoutService.parseWorkoutRequest(enhancedRequest);
      
      expect(parsed.workoutType).toBe('pull');
      expect(parsed.duration).toBe(30);
      expect(parsed.intensity).toBe('beginner');
      expect(parsed.focus).toEqual(['strength', 'hypertrophy']);
      expect(parsed.isEnhancedFormat).toBe(true);
      expect(parsed.structure.warmupDuration).toBe(5);
      expect(parsed.constraints.avoidExercises).toContain('deadlift');
    });

    test('should handle legacy string format', () => {
      const stringRequest = 'Create a pull day workout for 30 minutes';
      const parsed = workoutService.parseWorkoutRequest(stringRequest);
      
      expect(parsed.workoutType).toBe('pull');
      expect(parsed.duration).toBe(30);
      expect(parsed.isEnhancedFormat).toBe(false);
      expect(parsed.specificRequirements).toBe(stringRequest);
    });

    test('should extract workout types correctly from strings', () => {
      const testCases = [
        { input: 'pull day workout', expected: 'pull' },
        { input: 'push day training', expected: 'push' },
        { input: 'leg day session', expected: 'legs' },
        { input: 'upper body workout', expected: 'upper' },
        { input: 'full body training', expected: 'full_body' },
        { input: 'cardio session', expected: 'cardio' },
        { input: 'HIIT workout', expected: 'hiit' },
        { input: 'core strengthening', expected: 'core' }
      ];

      testCases.forEach(({ input, expected }) => {
        const parsed = workoutService.parseWorkoutRequest(input);
        expect(parsed.workoutType).toBe(expected);
      });
    });
  });

  describe('buildSpecificRequirements', () => {
    test('should build requirements for enhanced format', () => {
      const structuredRequest = {
        workoutType: 'pull',
        duration: 30,
        focus: ['strength', 'hypertrophy'],
        structure: {
          warmupDuration: 5,
          exerciseCount: 6
        },
        constraints: {
          avoidExercises: ['deadlift'],
          maxSets: 4
        },
        isEnhancedFormat: true
      };

      const requirements = workoutService.buildSpecificRequirements(structuredRequest, mockUserMetadata);
      
      expect(requirements).toContain('Workout Type Focus');
      expect(requirements).toContain('pulling movements');
      expect(requirements).toContain('Training Focus: strength, hypertrophy');
      expect(requirements).toContain('Warm-up Duration: 5 minutes');
      expect(requirements).toContain('Target Exercise Count: 6 exercises');
      expect(requirements).toContain('Avoid Exercises: deadlift');
      expect(requirements).toContain('Maximum Sets per Exercise: 4');
    });

    test('should handle legacy format requirements', () => {
      const legacyRequest = {
        workoutType: 'push',
        duration: 45,
        isEnhancedFormat: false
      };

      const requirements = workoutService.buildSpecificRequirements(legacyRequest, mockUserMetadata);
      
      expect(requirements).toContain('pushing movements');
      expect(requirements).toContain('45 minutes');
      expect(requirements).toContain('lose_weight, build_muscle');
    });
  });

  describe('parseWorkoutResponse', () => {
    test('should enforce workout type consistency', () => {
      const mockAIResponse = JSON.stringify({
        type: 'strength', // AI incorrectly categorized as strength
        duration: '30 minutes',
        exercises: [
          {
            name: 'Bent Over Row',
            category: 'strength',
            sets: 3,
            reps: '10-12',
            instructions: 'Pull the weight towards your chest'
          }
        ],
        tags: ['strength training']
      });

      const originalRequest = 'pull day workout';
      const parsed = workoutService.parseWorkoutResponse(mockAIResponse, originalRequest);
      
      // Should correct the type to match the request
      expect(parsed.type).toBe('pull');
      expect(parsed.tags).toContain('pull');
      expect(parsed.tags).toContain('pull day');
    });

    test('should handle enhanced format type enforcement', () => {
      const mockAIResponse = JSON.stringify({
        type: 'mixed', // AI incorrectly categorized
        duration: '30 minutes',
        exercises: [
          {
            name: 'Push-up',
            category: 'strength',
            sets: 3,
            reps: '10',
            instructions: 'Standard push-up'
          }
        ]
      });

      const enhancedRequest = {
        workoutSpecification: {
          workoutType: 'push',
          duration: 30
        }
      };

      const parsed = workoutService.parseWorkoutResponse(mockAIResponse, enhancedRequest);
      
      expect(parsed.type).toBe('push');
      expect(parsed.tags).toContain('push');
      expect(parsed.tags).toContain('push day');
    });
  });

  describe('Workout Type Validation', () => {
    test('should accept all supported workout types', () => {
      const supportedTypes = [
        'pull', 'push', 'legs', 'upper', 'lower', 'full_body',
        'cardio', 'strength', 'flexibility', 'hiit', 'mixed', 'core', 'functional'
      ];

      supportedTypes.forEach(type => {
        const request = { workoutSpecification: { workoutType: type } };
        const parsed = workoutService.parseWorkoutRequest(request);
        expect(parsed.workoutType).toBe(type);
      });
    });

    test('should accept custom workout types', () => {
      const customTypes = ['dance', 'swimming', 'rock_climbing', 'martial_arts'];

      customTypes.forEach(type => {
        const request = { workoutSpecification: { workoutType: type } };
        const parsed = workoutService.parseWorkoutRequest(request);
        expect(parsed.workoutType).toBe(type);
      });
    });

    test('should handle case-insensitive string parsing', () => {
      const testCases = [
        'PULL DAY WORKOUT',
        'Push Day Training',
        'leg day session',
        'UPPER BODY workout'
      ];

      testCases.forEach(input => {
        const parsed = workoutService.parseWorkoutRequest(input);
        expect(parsed.workoutType).toBeTruthy();
      });
    });

    test('should accept custom fitness levels', () => {
      const customLevels = ['expert', 'professional', 'elite', 'novice'];

      customLevels.forEach(level => {
        const userMetadata = { age: 25, fitnessLevel: level };
        const workoutRequest = 'Test workout';

        // Should not throw an error
        expect(() => {
          workoutService.validateInputs(userMetadata, [], workoutRequest);
        }).not.toThrow();
      });
    });
  });

  describe('Integration Tests', () => {
    // Mock the AI client to avoid actual API calls in tests
    beforeEach(() => {
      jest.spyOn(workoutService, 'callAIModel').mockResolvedValue(JSON.stringify({
        type: 'strength', // Will be corrected by our logic
        duration: '30 minutes',
        difficulty: 'beginner',
        equipment: ['dumbbells', 'barbell'],
        exercises: [
          {
            name: 'Bent Over Row',
            category: 'strength',
            sets: 3,
            reps: '10-12',
            rest: '60 seconds',
            instructions: 'Pull weight towards chest',
            targetMuscles: ['back', 'biceps']
          }
        ],
        warmup: [{ name: 'Arm Circles', duration: '5 minutes', instructions: 'Circle arms' }],
        cooldown: [{ name: 'Stretch', duration: '5 minutes', instructions: 'Stretch muscles' }],
        tags: ['strength training']
      }));
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should generate consistent workout with enhanced format', async () => {
      const enhancedRequest = {
        workoutSpecification: {
          workoutType: 'pull',
          duration: 30,
          intensity: 'beginner'
        }
      };

      const result = await workoutService.generateWorkout(
        mockUserMetadata,
        mockWorkoutHistory,
        enhancedRequest,
        'test-user'
      );

      expect(result.status).toBe('success');
      expect(result.data.workout.type).toBe('pull'); // Should be corrected from 'strength'
      expect(result.data.workout.tags).toContain('pull');
      expect(result.data.workout.tags).toContain('pull day');
    });

    test('should maintain backward compatibility with string requests', async () => {
      const stringRequest = 'Create a push day workout for 30 minutes';

      const result = await workoutService.generateWorkout(
        mockUserMetadata,
        mockWorkoutHistory,
        stringRequest,
        'test-user'
      );

      expect(result.status).toBe('success');
      expect(result.data.workout.type).toBe('push'); // Should be corrected
      expect(result.data.workout.duration).toContain('30');
    });
  });
});
