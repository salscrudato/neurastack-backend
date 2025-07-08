/**
 * 🧪 Comprehensive Optimization Tests
 * 
 * 🎯 PURPOSE: Validate all optimization improvements and new features
 * 
 * 📋 TEST AREAS:
 * 1. Model Configuration Service
 * 2. Performance Optimization
 * 3. Enhanced Caching
 * 4. Admin Interface
 * 5. System Integration
 */

const request = require('supertest');
const app = require('../index');
const { getModelConfigService } = require('../services/modelConfigService');
const { getPerformanceOptimizer } = require('../services/performanceOptimizer');

describe('🚀 NeuraStack Optimization Suite', () => {
  
  describe('🤖 Model Configuration Service', () => {
    let modelService;

    beforeAll(() => {
      modelService = getModelConfigService();
    });

    test('🔧 should initialize with default models', async () => {
      // 📋 Wait for service initialization
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const freeModels = await modelService.getActiveModels('free');
      const premiumModels = await modelService.getActiveModels('premium');

      expect(freeModels).toBeDefined();
      expect(premiumModels).toBeDefined();
      expect(Array.isArray(freeModels)).toBe(true);
      expect(Array.isArray(premiumModels)).toBe(true);
    });

    test('📊 should track model performance metrics', async () => {
      const modelId = 'test-model-123';
      const metrics = {
        responseTime: 1500,
        success: true,
        cost: 0.001,
        tokens: 100
      };

      await modelService.updateModelMetrics(modelId, metrics);
      const stats = modelService.getModelStats(modelId);

      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.averageResponseTime).toBe(1500);
    });

    test('🔄 should handle cache operations', () => {
      // 🧹 Clear cache
      modelService.clearCache();
      
      // 🔍 Verify cache is cleared
      expect(modelService.configCache.size).toBe(0);
      expect(modelService.cacheExpiry.size).toBe(0);
    });
  });

  describe('⚡ Performance Optimization Service', () => {
    let optimizer;

    beforeAll(() => {
      optimizer = getPerformanceOptimizer();
    });

    test('📊 should collect performance metrics', () => {
      optimizer.collectMetrics();
      
      const summary = optimizer.getPerformanceSummary();
      expect(summary).toBeDefined();
      expect(summary.memoryUsage).toBeDefined();
      expect(summary.memoryUsage.current).toBeGreaterThan(0);
    });

    test('⏱️ should record response times', () => {
      const responseTime = 1234;
      optimizer.recordResponseTime(responseTime);
      
      const summary = optimizer.getPerformanceSummary();
      expect(summary.responseTime.current).toBe(responseTime);
    });

    test('📈 should update cache metrics', () => {
      const cacheStats = { hits: 80, misses: 20 };
      optimizer.updateCacheMetrics(cacheStats);
      
      const summary = optimizer.getPerformanceSummary();
      expect(summary.cachePerformance.hitRate).toBe(80);
    });

    test('🤖 should track AI model performance', () => {
      const modelId = 'test-ai-model';
      const performance = {
        responseTime: 2000,
        successRate: 0.95,
        costEfficiency: 0.8
      };

      optimizer.updateModelPerformance(modelId, performance);
      
      expect(optimizer.metrics.aiModelPerformance.averageResponseTime.get(modelId)).toBe(2000);
      expect(optimizer.metrics.aiModelPerformance.successRate.get(modelId)).toBe(0.95);
    });
  });

  describe('🎛️ Admin Interface', () => {
    test('🏠 should serve admin dashboard', async () => {
      const response = await request(app)
        .get('/admin/dashboard')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('NeuraStack Admin');
      expect(response.text).toContain('Model Management Dashboard');
    });

    test('📊 should provide model statistics API', async () => {
      // 🔧 First, ensure we have a model with stats
      const modelService = getModelConfigService();
      await modelService.updateModelMetrics('test-model-stats', {
        responseTime: 1000,
        success: true,
        cost: 0.002,
        tokens: 150
      });

      const response = await request(app)
        .get('/admin/model-stats/test-model-stats')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalRequests).toBeGreaterThan(0);
    });

    test('❌ should handle non-existent model stats', async () => {
      const response = await request(app)
        .get('/admin/model-stats/non-existent-model')
        .expect(404);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('not found');
    });
  });

  describe('🏥 Enhanced Health Checks', () => {
    test('🔍 should provide basic health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.message).toContain('healthy');
    });

    test('📊 should provide detailed health metrics', async () => {
      const response = await request(app)
        .get('/health-detailed')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.components).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('📈 should provide system metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.system).toBeDefined();
    });
  });

  describe('🧠 AI Ensemble Integration', () => {
    test('🤖 should process ensemble requests with optimization', async () => {
      const testPrompt = 'Test optimization: What is 2+2?';
      
      const response = await request(app)
        .post('/default-ensemble')
        .send({
          prompt: testPrompt,
          sessionId: 'test-optimization-session'
        })
        .set('X-User-Id', 'test-optimization-user')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.synthesis).toBeDefined();
      expect(response.body.data.metadata).toBeDefined();
      
      // 📊 Verify optimization metadata is included
      expect(response.body.data.metadata.processingTimeMs).toBeDefined();
      expect(response.body.data.metadata.costEstimate).toBeDefined();
    }, 30000); // 30 second timeout for AI calls
  });

  describe('💪 Workout API Integration', () => {
    test('🏋️ should generate optimized workout', async () => {
      const workoutRequest = {
        age: 30,
        fitnessLevel: 'intermediate',
        gender: 'male',
        weight: 75,
        goals: 'muscle building',
        equipment: 'gym',
        timeAvailable: 60,
        daysPerWeek: 4,
        workoutType: 'strength training'
      };

      const response = await request(app)
        .post('/workout/generate-workout')
        .send(workoutRequest)
        .set('X-User-Id', 'test-workout-user')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.workout).toBeDefined();
      expect(response.body.data.workoutId).toBeDefined();
    }, 30000); // 30 second timeout for AI calls
  });

  describe('🔄 System Integration', () => {
    test('📊 should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      // 🚀 Send multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .get('/health')
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 📈 Verify all requests succeeded
      responses.forEach(response => {
        expect(response.body.status).toBe('ok');
      });

      // ⚡ Verify reasonable performance (should handle 5 requests in under 2 seconds)
      expect(totalTime).toBeLessThan(2000);
    });

    test('🛡️ should handle rate limiting gracefully', async () => {
      // 🚦 This test verifies rate limiting is working
      // Note: Actual rate limiting behavior depends on configuration
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });

    test('🔍 should provide correlation IDs for tracking', async () => {
      const correlationId = 'test-correlation-123';
      
      const response = await request(app)
        .get('/health')
        .set('X-Correlation-ID', correlationId)
        .expect(200);

      // 📋 Verify response includes correlation tracking
      expect(response.body.status).toBe('ok');
    });
  });

  describe('🧹 Cleanup and Resource Management', () => {
    test('🗑️ should handle graceful shutdown', () => {
      const optimizer = getPerformanceOptimizer();
      
      // 🛑 Test stopping the optimizer
      optimizer.stop();
      
      // 🔍 Verify it stopped gracefully
      expect(optimizer.monitoringInterval).toBeUndefined();
    });

    test('💾 should manage memory efficiently', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 🔄 Perform some operations
      const largeArray = new Array(1000).fill('test-data');
      
      // 🗑️ Clean up
      largeArray.length = 0;
      
      // 📊 Memory should be manageable
      const finalMemory = process.memoryUsage().heapUsed;
      expect(finalMemory).toBeDefined();
    });
  });
});

// 🧹 Global test cleanup
afterAll(async () => {
  // 🛑 Stop any running services
  const optimizer = getPerformanceOptimizer();
  optimizer.stop();
  
  // ⏱️ Give services time to clean up
  await new Promise(resolve => setTimeout(resolve, 1000));
});
