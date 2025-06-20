/**
 * Advanced Features Test Suite
 * Tests fine-tuned models, vector database, caching, cost monitoring, and performance optimizations
 */

const request = require('supertest');
const app = require('../index');
const fineTunedModelService = require('../services/fineTunedModelService');
const vectorDatabaseService = require('../services/vectorDatabaseService');
const cacheService = require('../services/cacheService');
const costMonitoringService = require('../services/costMonitoringService');
const advancedEnsembleStrategy = require('../services/advancedEnsembleStrategy');
const authenticationService = require('../services/authenticationService');

describe('Advanced Features', () => {
  let testApiKey;
  let testJwtToken;

  beforeAll(async () => {
    // Create test credentials
    const apiKeyData = authenticationService.createApiKey(
      'advanced-test-user',
      'premium',
      'Advanced Features Test Key',
      ['read', 'write', 'admin']
    );
    testApiKey = apiKeyData.apiKey;

    testJwtToken = authenticationService.generateToken({
      userId: 'advanced-test-user',
      email: 'advanced@example.com',
      tier: 'premium',
      permissions: ['read', 'write', 'admin']
    });
  });

  afterAll(async () => {
    // Clean up
    authenticationService.revokeApiKey(testApiKey);
  });

  describe('Fine-Tuned Models', () => {
    test('should list available fine-tuned models', async () => {
      const response = await request(app)
        .get('/models/fine-tuned')
        .set('X-API-Key', testApiKey);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.models)).toBe(true);
      expect(response.body.models.length).toBeGreaterThan(0);
    });

    test('should get specific fine-tuned model details', async () => {
      const models = fineTunedModelService.getAvailableModels();
      if (models.length > 0) {
        const modelId = models[0].id;
        
        const response = await request(app)
          .get(`/models/fine-tuned/${modelId}`)
          .set('X-API-Key', testApiKey);

        expect(response.status).toBe(200);
        expect(response.body.model.id).toBe(modelId);
        expect(response.body.model.name).toBeDefined();
        expect(response.body.performance).toBeDefined();
      }
    });

    test('should compare multiple fine-tuned models', async () => {
      const models = fineTunedModelService.getAvailableModels();
      if (models.length >= 2) {
        const modelIds = models.slice(0, 2).map(m => m.id);
        
        const response = await request(app)
          .post('/models/fine-tuned/compare')
          .set('X-API-Key', testApiKey)
          .send({ modelIds });

        expect(response.status).toBe(200);
        expect(response.body.comparison).toBeDefined();
        expect(response.body.comparison.models.length).toBe(2);
        expect(response.body.comparison.recommendation).toBeDefined();
      }
    });

    test('should get model recommendations for specific purposes', async () => {
      const purposes = ['ensemble_synthesis', 'workout_generation', 'memory_synthesis'];
      
      for (const purpose of purposes) {
        const response = await request(app)
          .get(`/models/recommendations/${purpose}`)
          .set('X-API-Key', testApiKey);

        expect(response.status).toBe(200);
        expect(response.body.purpose).toBe(purpose);
        // Recommendation might be null if no fine-tuned models available
        expect(response.body.recommendation !== undefined).toBe(true);
      }
    });

    test('should track model performance', async () => {
      const models = fineTunedModelService.getAvailableModels();
      if (models.length > 0) {
        const modelId = models[0].id;
        
        await fineTunedModelService.trackModelUsage(
          modelId,
          850, // response time
          0.92, // quality
          0.002, // cost
          true // success
        );

        const performance = fineTunedModelService.getModelPerformance(modelId);
        expect(performance).toBeDefined();
        expect(performance.performance.totalRequests).toBeGreaterThan(0);
      }
    });

    test('should create fine-tuned model (admin only)', async () => {
      const response = await request(app)
        .post('/models/fine-tuned')
        .set('Authorization', `Bearer ${testJwtToken}`)
        .send({
          name: 'Test Fine-Tuned Model',
          baseModel: 'gpt-4o-mini',
          purpose: 'ensemble_synthesis',
          trainingDataPath: 'test-data.jsonl'
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.job.modelId).toBeDefined();
    });

    test('should get model service metrics (admin only)', async () => {
      const response = await request(app)
        .get('/models/metrics')
        .set('Authorization', `Bearer ${testJwtToken}`);

      expect(response.status).toBe(200);
      expect(response.body.metrics).toBeDefined();
      expect(response.body.metrics.totalModels).toBeDefined();
      expect(response.body.metrics.activeModels).toBeDefined();
    });
  });

  describe('Vector Database', () => {
    test('should store and retrieve vectors', async () => {
      const testText = 'This is a test memory for vector storage';
      const memoryId = 'test-memory-vector-1';

      // Store vector
      const stored = await vectorDatabaseService.storeVector(memoryId, testText);
      expect(stored).toBe(true);

      // Search for similar vectors
      const results = await vectorDatabaseService.searchSimilar(testText, 5);
      expect(Array.isArray(results)).toBe(true);
      
      if (results.length > 0) {
        expect(results[0].id).toBeDefined();
        expect(results[0].similarity).toBeDefined();
        expect(results[0].similarity).toBeGreaterThan(0);
      }
    });

    test('should handle vector database health check', async () => {
      const health = await vectorDatabaseService.healthCheck();
      expect(health.isHealthy).toBeDefined();
      expect(health.provider).toBeDefined();
      expect(health.vectorCount).toBeDefined();
    });

    test('should get vector database metrics', async () => {
      const metrics = vectorDatabaseService.getMetrics();
      expect(metrics.provider).toBeDefined();
      expect(metrics.isAvailable).toBeDefined();
      expect(metrics.vectorCount).toBeDefined();
    });

    test('should handle embedding generation', async () => {
      const text = 'Test text for embedding generation';
      const embedding = await vectorDatabaseService.generateEmbedding(text);
      
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
      expect(typeof embedding[0]).toBe('number');
    });
  });

  describe('Caching System', () => {
    test('should cache and retrieve ensemble responses', async () => {
      const prompt = 'Test prompt for caching';
      const userId = 'cache-test-user';
      const tier = 'premium';
      
      const testResponse = {
        synthesis: { content: 'Test cached response' },
        roles: [],
        metadata: { cached: false }
      };

      // Cache the response
      await cacheService.cacheEnsembleResponse(prompt, userId, tier, testResponse);

      // Retrieve from cache
      const cached = await cacheService.getCachedEnsembleResponse(prompt, userId, tier);
      expect(cached).toBeDefined();
      expect(cached.synthesis.content).toBe('Test cached response');
    });

    test('should cache workout plans', async () => {
      const userMetadata = { age: 25, fitnessLevel: 'intermediate' };
      const workoutHistory = [];
      const workoutRequest = 'Upper body strength training';

      const testWorkout = {
        workout: { type: 'strength', exercises: [] },
        metadata: { cached: false }
      };

      await cacheService.cacheWorkoutPlan(userMetadata, workoutHistory, workoutRequest, testWorkout);
      const cached = await cacheService.getCachedWorkoutPlan(userMetadata, workoutHistory, workoutRequest);

      expect(cached).toBeDefined();
      expect(cached.workout.type).toBe('strength');
    });

    test('should provide cache statistics', async () => {
      const stats = cacheService.getStats();
      expect(stats.hits).toBeDefined();
      expect(stats.misses).toBeDefined();
      expect(stats.sets).toBeDefined();
      expect(stats.hitRate).toBeDefined();
    });

    test('should handle cache health check', async () => {
      const health = cacheService.getHealthStatus();
      expect(health.status).toBeDefined();
      expect(health.redisAvailable).toBeDefined();
      expect(health.memoryUsage).toBeDefined();
    });
  });

  describe('Cost Monitoring', () => {
    test('should track API call costs', async () => {
      const modelConfig = { provider: 'openai', model: 'gpt-4o-mini' };
      const promptTokens = 100;
      const responseTokens = 150;
      const responseTime = 1200;
      const quality = 0.85;

      const result = await costMonitoringService.trackAPICall(
        modelConfig,
        promptTokens,
        responseTokens,
        responseTime,
        quality,
        'cost-test-user'
      );

      expect(result.cost).toBeDefined();
      expect(result.cost).toBeGreaterThan(0);
      expect(result.totalDailyCost).toBeDefined();
    });

    test('should provide cost analytics', async () => {
      const analytics = costMonitoringService.getCostAnalytics();
      expect(analytics.dailyCosts).toBeDefined();
      expect(analytics.modelPerformance).toBeDefined();
      expect(analytics.totalCosts).toBeDefined();
    });

    test('should get model recommendations', async () => {
      const recommendation = costMonitoringService.getModelRecommendation('openai');
      expect(recommendation).toBeDefined();
      expect(recommendation.recommended).toBeDefined();
      expect(recommendation.reason).toBeDefined();
    });

    test('should handle cost alerts', async () => {
      const alerts = await costMonitoringService.checkCostAlerts(0.01);
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Advanced Ensemble Strategy', () => {
    test('should perform weighted voting', async () => {
      const mockRoleOutputs = [
        {
          role: 'analyst',
          model: 'gpt-4o',
          content: 'Test response 1',
          status: 'fulfilled',
          responseTime: 1000
        },
        {
          role: 'creative',
          model: 'claude-3-haiku',
          content: 'Test response 2',
          status: 'fulfilled',
          responseTime: 800
        }
      ];

      const votingResults = advancedEnsembleStrategy.performWeightedVoting(
        mockRoleOutputs,
        { userPrompt: 'Test prompt' }
      );

      expect(Array.isArray(votingResults)).toBe(true);
      expect(votingResults.length).toBe(2);
      expect(votingResults[0].confidence).toBeDefined();
      expect(votingResults[0].weightedScore).toBeDefined();
    });

    test('should generate synthesis strategy', async () => {
      const mockVotingResults = [
        {
          role: 'analyst',
          confidence: 0.9,
          weightedScore: 0.85,
          content: 'High confidence response'
        },
        {
          role: 'creative',
          confidence: 0.6,
          weightedScore: 0.55,
          content: 'Lower confidence response'
        }
      ];

      const strategy = advancedEnsembleStrategy.generateSynthesisStrategy(
        mockVotingResults,
        'Test prompt'
      );

      expect(strategy.strategy).toBeDefined();
      expect(strategy.confidence).toBeDefined();
      expect(strategy.reasoning).toBeDefined();
    });

    test('should update model weights based on feedback', async () => {
      const feedback = {
        modelId: 'gpt-4o',
        quality: 0.9,
        responseTime: 1200,
        userRating: 5
      };

      advancedEnsembleStrategy.updateModelWeights('gpt-4o', feedback);
      const weights = advancedEnsembleStrategy.getModelWeights('gpt-4o');
      
      expect(weights).toBeDefined();
      expect(weights.overall).toBeDefined();
      expect(weights.accuracy).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    test('should track system performance metrics', async () => {
      // Make a request to generate metrics
      const response = await request(app)
        .post('/default-ensemble')
        .set('X-API-Key', testApiKey)
        .send({
          prompt: 'Performance monitoring test prompt'
        });

      expect(response.status).toBe(200);
      expect(response.body.metadata.processingTimeMs).toBeDefined();
      expect(response.body.metadata.responseQuality).toBeDefined();
    });

    test('should provide detailed health status', async () => {
      const response = await request(app)
        .get('/health-detailed');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.components).toBeDefined();
      expect(response.body.components.system).toBeDefined();
      expect(response.body.components.vendors).toBeDefined();
    });

    test('should track memory usage and performance', async () => {
      const response = await request(app)
        .post('/memory/store')
        .set('X-API-Key', testApiKey)
        .send({
          userId: 'performance-test-user',
          sessionId: 'performance-session',
          content: 'Test memory content for performance tracking',
          isUserPrompt: true,
          responseQuality: 0.85
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete ensemble workflow with all optimizations', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .set('X-API-Key', testApiKey)
        .send({
          prompt: 'Explain the benefits of artificial intelligence in healthcare',
          sessionId: 'integration-test-session'
        });

      expect(response.status).toBe(200);
      expect(response.body.synthesis).toBeDefined();
      expect(response.body.synthesis.content).toBeDefined();
      expect(response.body.roles).toBeDefined();
      expect(response.body.metadata).toBeDefined();
      expect(response.body.metadata.processingTimeMs).toBeDefined();
      expect(response.body.metadata.responseQuality).toBeDefined();
      
      // Check if fine-tuned models were used
      if (response.body.synthesis.isFineTuned) {
        expect(response.body.synthesis.fineTunedModelName).toBeDefined();
      }
    });

    test('should handle workout generation with all optimizations', async () => {
      const response = await request(app)
        .post('/workout')
        .set('X-API-Key', testApiKey)
        .send({
          userMetadata: {
            age: 28,
            fitnessLevel: 'intermediate',
            goals: ['strength', 'muscle_gain'],
            availableEquipment: ['dumbbells', 'barbell'],
            timeAvailable: 60
          },
          workoutHistory: [],
          workoutRequest: 'Full body strength training workout for muscle gain'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.workout).toBeDefined();
      expect(response.body.data.workout.exercises).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();
    });

    test('should maintain performance under load', async () => {
      const promises = [];
      const concurrentRequests = 5;

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post('/default-ensemble')
            .set('X-API-Key', testApiKey)
            .send({
              prompt: `Load test prompt ${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      const successfulResponses = responses.filter(r => r.status === 200);
      
      expect(successfulResponses.length).toBeGreaterThan(0);
      
      // Check that response times are reasonable
      successfulResponses.forEach(response => {
        expect(response.body.metadata.processingTimeMs).toBeLessThan(30000);
      });
    });
  });
});
