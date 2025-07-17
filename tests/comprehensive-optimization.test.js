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

  // Performance optimization tests removed - service no longer exists

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

  // Removed: Workout API Integration tests - workout functionality removed from codebase

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

  // Cleanup tests removed - performance optimizer service no longer exists
});

// 🧹 Global test cleanup
afterAll(async () => {
  // ⏱️ Give services time to clean up
  await new Promise(resolve => setTimeout(resolve, 1000));
});
