const request = require('supertest');
const app = require('../index');

// Mock the enhanced ensemble service
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

describe('Tier System Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful responses
    enhancedEnsemble.runEnsemble.mockResolvedValue({
      synthesis: {
        content: 'Cost-optimized response from free tier models',
        model: 'gpt-4o-mini',
        provider: 'openai',
        status: 'success'
      },
      roles: [
        {
          role: 'gpt4o',
          content: 'GPT-4o-mini response',
          model: 'gpt-4o-mini',
          provider: 'openai',
          status: 'fulfilled',
          wordCount: 25
        },
        {
          role: 'gemini',
          content: 'Gemini 1.5 Flash response',
          model: 'gemini-1.5-flash',
          provider: 'gemini',
          status: 'fulfilled',
          wordCount: 28
        },
        {
          role: 'claude',
          content: 'Claude 3 Haiku response',
          model: 'claude-3-haiku-20240307',
          provider: 'claude',
          status: 'fulfilled',
          wordCount: 22
        }
      ],
      metadata: {
        totalRoles: 3,
        successfulRoles: 3,
        failedRoles: 0,
        synthesisStatus: 'success',
        processingTimeMs: 6500,
        correlationId: 'test-correlation-id',
        memoryContextUsed: false,
        responseQuality: 0.82
      }
    });

    enhancedEnsemble.getMetrics.mockResolvedValue({
      totalRequests: 50,
      successfulRequests: 47,
      averageProcessingTime: 6500
    });

    monitoringService.getDetailedMetrics.mockResolvedValue({
      requests: { total: 50, successful: 47, failed: 3 }
    });

    vendorClients.getMetrics.mockResolvedValue({
      'gpt-4o-mini': { successfulRequests: 47, totalRequests: 50 }
    });
  });

  describe('GET /tier-info', () => {
    test('should return current tier information', async () => {
      const response = await request(app)
        .get('/tier-info')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.currentTier).toBeDefined();
      expect(response.body.data.configuration).toBeDefined();
      expect(response.body.data.availableTiers).toBeDefined();
      expect(response.body.data.costComparison).toBeDefined();

      // Check that both tiers are available
      expect(response.body.data.availableTiers.free).toBeDefined();
      expect(response.body.data.availableTiers.premium).toBeDefined();

      // Verify free tier models
      const freeTier = response.body.data.availableTiers.free;
      expect(freeTier.models.gpt4o.model).toBe('gpt-4o-mini');
      expect(freeTier.models.gemini.model).toBe('gemini-1.5-flash');
      expect(freeTier.models.claude.model).toBe('claude-3-haiku-20240307');

      // Verify premium tier models
      const premiumTier = response.body.data.availableTiers.premium;
      expect(premiumTier.models.gpt4o.model).toBe('gpt-4o');
      expect(premiumTier.models.gemini.model).toBe('gemini-2.0-flash');
      expect(premiumTier.models.claude.model).toBe('claude-opus-4-20250514');
    });

    test('should include cost comparison information', async () => {
      const response = await request(app)
        .get('/tier-info')
        .expect(200);

      const costComparison = response.body.data.costComparison;
      expect(costComparison.free).toBeDefined();
      expect(costComparison.premium).toBeDefined();

      expect(costComparison.free.costSavings).toContain('90-95%');
      expect(costComparison.free.quality).toContain('85-90%');
      expect(costComparison.premium.quality).toContain('95-100%');
    });
  });

  describe('POST /estimate-cost', () => {
    test('should estimate cost for a given prompt', async () => {
      const testPrompt = 'What are the benefits of microservices architecture?';

      const response = await request(app)
        .post('/estimate-cost')
        .send({ prompt: testPrompt })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.prompt.length).toBe(testPrompt.length);
      expect(response.body.data.prompt.estimatedTokens).toBeGreaterThan(0);
      expect(response.body.data.estimatedCost.total).toMatch(/^\$\d+\.\d{6}$/);
      expect(response.body.data.comparison.free).toBeDefined();
      expect(response.body.data.comparison.premium).toBeDefined();
    });

    test('should estimate cost for specific tier', async () => {
      const testPrompt = 'Test prompt';

      const response = await request(app)
        .post('/estimate-cost')
        .send({ 
          prompt: testPrompt,
          tier: 'premium'
        })
        .expect(200);

      expect(response.body.data.tier).toBe('premium');
    });

    test('should require prompt for cost estimation', async () => {
      const response = await request(app)
        .post('/estimate-cost')
        .send({})
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Prompt is required');
    });
  });

  describe('Enhanced /default-ensemble with tier limits', () => {
    test('should enforce prompt length limits based on tier', async () => {
      // Test with prompt exceeding free tier limit (1000 chars)
      const longPrompt = 'a'.repeat(1001);

      const response = await request(app)
        .post('/default-ensemble')
        .send({ prompt: longPrompt })
        .expect(400);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Prompt too long');
      expect(response.body.tier).toBeDefined();
      expect(response.body.limits).toBeDefined();
    });

    test('should include tier information in successful responses', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .send({ prompt: 'Test prompt' })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.metadata.version).toBe('2.0');
      
      // Check that we're using the correct models for the tier
      const roles = response.body.data.roles;
      expect(roles.some(role => role.model === 'gpt-4o-mini')).toBe(true);
      expect(roles.some(role => role.model === 'gemini-1.5-flash')).toBe(true);
      expect(roles.some(role => role.model === 'claude-3-haiku-20240307')).toBe(true);
    });

    test('should handle rate limiting for free tier', async () => {
      // Mock rate limit exceeded error
      enhancedEnsemble.runEnsemble.mockRejectedValue(
        new Error('Rate limit exceeded: 10 requests per hour')
      );

      const response = await request(app)
        .post('/default-ensemble')
        .send({ prompt: 'Test prompt' })
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.retryable).toBe(true);
    });
  });

  describe('GET /metrics with tier information', () => {
    test('should include tier and cost information in metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body.tier).toBeDefined();
      expect(response.body.costEstimate).toBeDefined();
      expect(response.body.system).toBeDefined();
      expect(response.body.vendors).toBeDefined();
      expect(response.body.ensemble).toBeDefined();
    });
  });

  describe('Tier Configuration Validation', () => {
    test('should have valid model configurations for both tiers', () => {
      const ensembleConfig = require('../config/ensemblePrompts');
      
      // Check free tier models
      const freeModels = ensembleConfig.allModels.free;
      expect(freeModels.gpt4o.model).toBe('gpt-4o-mini');
      expect(freeModels.gemini.model).toBe('gemini-1.5-flash');
      expect(freeModels.claude.model).toBe('claude-3-haiku-20240307');

      // Check premium tier models
      const premiumModels = ensembleConfig.allModels.premium;
      expect(premiumModels.gpt4o.model).toBe('gpt-4o');
      expect(premiumModels.gemini.model).toBe('gemini-2.0-flash');
      expect(premiumModels.claude.model).toBe('claude-opus-4-20250514');
    });

    test('should have appropriate limits for each tier', () => {
      const ensembleConfig = require('../config/ensemblePrompts');
      
      const freeLimits = ensembleConfig.getTierConfig('free').limits;
      expect(freeLimits.requestsPerHour).toBe(10);
      expect(freeLimits.requestsPerDay).toBe(50);
      expect(freeLimits.maxPromptLength).toBe(1000);

      const premiumLimits = ensembleConfig.getTierConfig('premium').limits;
      expect(premiumLimits.requestsPerHour).toBe(100);
      expect(premiumLimits.requestsPerDay).toBe(1000);
      expect(premiumLimits.maxPromptLength).toBe(5000);
    });

    test('should provide cost estimation functionality', () => {
      const ensembleConfig = require('../config/ensemblePrompts');
      
      const freeCost = ensembleConfig.estimateCost(100, 150, 'free');
      const premiumCost = ensembleConfig.estimateCost(100, 150, 'premium');
      
      expect(freeCost).toBeGreaterThan(0);
      expect(premiumCost).toBeGreaterThan(freeCost);
      expect(premiumCost / freeCost).toBeGreaterThan(5); // Premium should be significantly more expensive
    });
  });
});
