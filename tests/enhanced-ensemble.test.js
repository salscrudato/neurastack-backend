const request = require('supertest');
const app = require('../index');

// Mock the enhanced ensemble service to avoid real API calls in tests
jest.mock('../services/enhancedEnsembleRunner', () => ({
  runEnsemble: jest.fn(),
  getMetrics: jest.fn(),
  healthCheck: jest.fn()
}));

// Mock monitoring service
jest.mock('../services/monitoringService', () => ({
  log: jest.fn(),
  middleware: () => (req, res, next) => {
    req.correlationId = 'test-correlation-id';
    next();
  },
  getHealthStatus: jest.fn(),
  getDetailedMetrics: jest.fn()
}));

// Mock vendor clients
jest.mock('../services/vendorClients', () => ({
  healthCheck: jest.fn(),
  getMetrics: jest.fn()
}));

const enhancedEnsemble = require('../services/enhancedEnsembleRunner');
const monitoringService = require('../services/monitoringService');
const vendorClients = require('../services/vendorClients');

describe('Enhanced Ensemble Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful enhanced ensemble response
    enhancedEnsemble.runEnsemble.mockResolvedValue({
      synthesis: {
        content: 'This is an enhanced synthesized response with improved error handling.',
        model: 'gpt-4o',
        provider: 'openai',
        status: 'success'
      },
      roles: [
        {
          role: 'gpt4o',
          content: 'Enhanced GPT-4o response with circuit breaker protection',
          model: 'gpt-4o',
          provider: 'openai',
          status: 'fulfilled',
          wordCount: 28
        },
        {
          role: 'gemini',
          content: 'Enhanced Gemini response with connection pooling',
          model: 'gemini-2.0-flash',
          provider: 'gemini',
          status: 'fulfilled',
          wordCount: 32
        },
        {
          role: 'claude',
          content: 'Enhanced Claude response with retry logic',
          model: 'claude-opus-4-20250514',
          provider: 'claude',
          status: 'fulfilled',
          wordCount: 30
        }
      ],
      metadata: {
        totalRoles: 3,
        successfulRoles: 3,
        failedRoles: 0,
        synthesisStatus: 'success',
        processingTimeMs: 8500,
        correlationId: 'test-correlation-id',
        memoryContextUsed: true,
        responseQuality: 0.85
      }
    });

    // Mock health check responses
    monitoringService.getHealthStatus.mockResolvedValue({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: 3600000,
      version: '2.0'
    });

    vendorClients.healthCheck.mockResolvedValue({
      openai: { isHealthy: true, circuitBreakerState: 'CLOSED' },
      gemini: { isHealthy: true, circuitBreakerState: 'CLOSED' },
      claude: { isHealthy: true, circuitBreakerState: 'CLOSED' },
      xai: { isHealthy: true, circuitBreakerState: 'CLOSED' }
    });

    enhancedEnsemble.healthCheck.mockResolvedValue({
      ensemble: { isHealthy: true, metrics: { successRate: 0.95 } }
    });

    // Mock metrics responses
    monitoringService.getDetailedMetrics.mockResolvedValue({
      requests: { total: 100, successful: 95, failed: 5 },
      performance: { averageResponseTime: 8500, p95ResponseTime: 12000 }
    });

    vendorClients.getMetrics.mockResolvedValue({
      openai: { successfulRequests: 95, totalRequests: 100 },
      gemini: { successfulRequests: 93, totalRequests: 100 }
    });

    enhancedEnsemble.getMetrics.mockResolvedValue({
      totalRequests: 100,
      successfulRequests: 95,
      averageProcessingTime: 8500
    });
  });

  describe('POST /default-ensemble', () => {
    test('should return enhanced synthesized response', async () => {
      const testPrompt = 'How can we improve our API performance?';

      const response = await request(app)
        .post('/default-ensemble')
        .send({ prompt: testPrompt })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.prompt).toBe(testPrompt);
      expect(response.body.data.userId).toBe('anonymous');
      expect(response.body.data.synthesis).toBeDefined();
      expect(response.body.data.roles).toHaveLength(3);
      expect(response.body.data.metadata.version).toBe('2.0');
      expect(response.body.data.metadata.correlationId).toBeDefined();
      expect(response.body.correlationId).toBeDefined();

      expect(enhancedEnsemble.runEnsemble).toHaveBeenCalledWith(
        testPrompt, 
        'anonymous', 
        expect.any(String)
      );
    });

    test('should handle x-user-id header', async () => {
      const testPrompt = 'Test enhanced prompt';
      const userId = 'enhanced-user-123';

      const response = await request(app)
        .post('/default-ensemble')
        .set('x-user-id', userId)
        .send({ prompt: testPrompt })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.userId).toBe(userId);
      expect(enhancedEnsemble.runEnsemble).toHaveBeenCalledWith(
        testPrompt, 
        userId, 
        expect.any(String)
      );
    });

    test('should handle correlation ID header', async () => {
      const testPrompt = 'Test correlation tracking';
      const correlationId = 'custom-correlation-123';

      const response = await request(app)
        .post('/default-ensemble')
        .set('x-correlation-id', correlationId)
        .send({ prompt: testPrompt })
        .expect(200);

      expect(response.body.correlationId).toBeDefined();
    });

    test('should validate prompt length', async () => {
      const longPrompt = 'a'.repeat(5001); // Exceeds 5000 character limit

      const response = await request(app)
        .post('/default-ensemble')
        .send({ prompt: longPrompt })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Prompt too long');
      expect(response.body.correlationId).toBeDefined();
    });

    test('should handle enhanced ensemble errors gracefully', async () => {
      enhancedEnsemble.runEnsemble.mockRejectedValue(new Error('Enhanced ensemble service failed'));

      const response = await request(app)
        .post('/default-ensemble')
        .send({ prompt: 'Test error handling' })
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Enhanced ensemble processing failed');
      expect(response.body.correlationId).toBeDefined();
      expect(response.body.retryable).toBe(true);
      expect(response.body.supportInfo).toBeDefined();
      expect(response.body.supportInfo.correlationId).toBeDefined();
    });

    test('should handle default prompt', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .send({})
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.prompt).toBe('Quick sanity check: explain AI in 1-2 lines.');
    });

    test('should include enhanced metadata', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .send({ prompt: 'Test metadata' })
        .expect(200);

      const metadata = response.body.data.metadata;
      expect(metadata.version).toBe('2.0');
      expect(metadata.correlationId).toBeDefined();
      expect(metadata.memoryContextUsed).toBeDefined();
      expect(metadata.responseQuality).toBeDefined();
      expect(metadata.processingTimeMs).toBeDefined();
    });
  });

  describe('GET /health-detailed', () => {
    test('should return comprehensive health status', async () => {
      const response = await request(app)
        .get('/health-detailed')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBe('2.0');
      expect(response.body.components).toBeDefined();
      expect(response.body.components.system).toBeDefined();
      expect(response.body.components.vendors).toBeDefined();
      expect(response.body.components.ensemble).toBeDefined();
    });

    test('should return degraded status when vendors are unhealthy', async () => {
      vendorClients.healthCheck.mockResolvedValue({
        openai: { isHealthy: false, circuitBreakerState: 'OPEN' },
        gemini: { isHealthy: true, circuitBreakerState: 'CLOSED' },
        claude: { isHealthy: true, circuitBreakerState: 'CLOSED' }
      });

      const response = await request(app)
        .get('/health-detailed')
        .expect(200);

      expect(response.body.status).toBe('degraded');
    });

    test('should handle health check errors', async () => {
      monitoringService.getHealthStatus.mockRejectedValue(new Error('Health check failed'));

      const response = await request(app)
        .get('/health-detailed')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.message).toBe('Health check failed');
    });
  });

  describe('GET /metrics', () => {
    test('should return comprehensive metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.system).toBeDefined();
      expect(response.body.vendors).toBeDefined();
      expect(response.body.ensemble).toBeDefined();
    });

    test('should handle metrics collection errors', async () => {
      monitoringService.getDetailedMetrics.mockRejectedValue(new Error('Metrics failed'));

      const response = await request(app)
        .get('/metrics')
        .expect(500);

      expect(response.body.error).toBe('Failed to collect metrics');
    });
  });

  describe('Enhanced Error Handling', () => {
    test('should provide detailed error information in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      enhancedEnsemble.runEnsemble.mockRejectedValue(new Error('Detailed error message'));

      const response = await request(app)
        .post('/default-ensemble')
        .send({ prompt: 'Test error' })
        .expect(500);

      expect(response.body.error).toBe('Detailed error message');

      process.env.NODE_ENV = originalEnv;
    });

    test('should hide error details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      enhancedEnsemble.runEnsemble.mockRejectedValue(new Error('Detailed error message'));

      const response = await request(app)
        .post('/default-ensemble')
        .send({ prompt: 'Test error' })
        .expect(500);

      expect(response.body.error).toBe('Internal server error');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
