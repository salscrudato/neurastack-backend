/**
 * Tests for Enhanced Monitoring Dashboard Features
 * Tests the new AI comparison and cost estimation endpoints
 */

const request = require('supertest');
const app = require('../index');

describe('Enhanced Monitoring Dashboard', () => {
  let adminToken;
  let adminUserId;

  beforeAll(async () => {
    // Mock admin authentication
    adminToken = 'mock-admin-token';
    adminUserId = 'mock-admin-uid';
  });

  describe('AI Comparison Endpoint', () => {
    it('should return AI comparison data for admin users', async () => {
      const response = await request(app)
        .get('/monitor/ai-comparison')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-User-Id', adminUserId)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('sampleResponses');
      expect(response.body).toHaveProperty('modelPerformance');
      expect(response.body).toHaveProperty('confidenceMetrics');

      // Verify model performance structure
      const { modelPerformance } = response.body;
      expect(modelPerformance).toHaveProperty('gpt4o');
      expect(modelPerformance).toHaveProperty('gemini');
      expect(modelPerformance).toHaveProperty('claude');

      // Verify each model has required properties
      Object.values(modelPerformance).forEach(model => {
        expect(model).toHaveProperty('model');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('averageConfidence');
        expect(model).toHaveProperty('averageResponseTime');
        expect(model).toHaveProperty('averageWordCount');
        expect(model).toHaveProperty('strengths');
        expect(model).toHaveProperty('weaknesses');
      });

      // Verify sample responses structure
      expect(Array.isArray(response.body.sampleResponses)).toBe(true);
      if (response.body.sampleResponses.length > 0) {
        const sample = response.body.sampleResponses[0];
        expect(sample).toHaveProperty('id');
        expect(sample).toHaveProperty('prompt');
        expect(sample).toHaveProperty('responses');
        expect(sample).toHaveProperty('synthesis');
      }
    });

    it('should require admin authentication', async () => {
      await request(app)
        .get('/monitor/ai-comparison')
        .expect(401);
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests to test rate limiting
      const promises = Array(25).fill().map(() =>
        request(app)
          .get('/monitor/ai-comparison')
          .set('Authorization', `Bearer ${adminToken}`)
          .set('X-User-Id', adminUserId)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Cost Estimation Endpoint', () => {
    const validEstimationRequest = {
      prompt: 'Explain quantum computing in simple terms',
      tier: 'free',
      requestCount: 1
    };

    it('should return cost estimation for valid requests', async () => {
      const response = await request(app)
        .post('/monitor/cost-estimation')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-User-Id', adminUserId)
        .send(validEstimationRequest)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('prompt');
      expect(response.body).toHaveProperty('tier', 'free');
      expect(response.body).toHaveProperty('costs');

      // Verify cost structure
      const { costs } = response.body;
      expect(costs).toHaveProperty('individual');
      expect(costs).toHaveProperty('synthesis');
      expect(costs).toHaveProperty('total');
      expect(costs).toHaveProperty('perRequest');
      expect(costs).toHaveProperty('formatted');

      // Verify formatted costs
      expect(costs.formatted).toHaveProperty('total');
      expect(costs.formatted).toHaveProperty('perRequest');
      expect(costs.formatted.total).toMatch(/^\$\d+\.\d{6}$/);
      expect(costs.formatted.perRequest).toMatch(/^\$\d+\.\d{6}$/);

      // Verify individual model costs
      expect(typeof costs.individual).toBe('object');
      Object.values(costs.individual).forEach(modelCost => {
        expect(modelCost).toHaveProperty('inputCost');
        expect(modelCost).toHaveProperty('outputCost');
        expect(modelCost).toHaveProperty('totalCost');
        expect(typeof modelCost.totalCost).toBe('number');
      });
    });

    it('should handle premium tier estimation', async () => {
      const premiumRequest = {
        ...validEstimationRequest,
        tier: 'premium'
      };

      const response = await request(app)
        .post('/monitor/cost-estimation')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-User-Id', adminUserId)
        .send(premiumRequest)
        .expect(200);

      expect(response.body.tier).toBe('premium');
      expect(response.body.costs.total).toBeGreaterThan(0);
    });

    it('should handle multiple request counts', async () => {
      const multipleRequest = {
        ...validEstimationRequest,
        requestCount: 10
      };

      const response = await request(app)
        .post('/monitor/cost-estimation')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-User-Id', adminUserId)
        .send(multipleRequest)
        .expect(200);

      expect(response.body.requestCount).toBe(10);
      expect(response.body.costs.total).toBeGreaterThan(0);
      
      // Cost should scale with request count
      const perRequestCost = response.body.costs.total / 10;
      expect(Math.abs(response.body.costs.perRequest - perRequestCost)).toBeLessThan(0.000001);
    });

    it('should require prompt parameter', async () => {
      const invalidRequest = {
        tier: 'free',
        requestCount: 1
      };

      await request(app)
        .post('/monitor/cost-estimation')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-User-Id', adminUserId)
        .send(invalidRequest)
        .expect(400);
    });

    it('should default to free tier and 1 request', async () => {
      const minimalRequest = {
        prompt: 'Test prompt'
      };

      const response = await request(app)
        .post('/monitor/cost-estimation')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-User-Id', adminUserId)
        .send(minimalRequest)
        .expect(200);

      expect(response.body.tier).toBe('free');
      expect(response.body.requestCount).toBe(1);
    });

    it('should include tier comparison when applicable', async () => {
      const freeRequest = {
        ...validEstimationRequest,
        tier: 'free'
      };

      const response = await request(app)
        .post('/monitor/cost-estimation')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-User-Id', adminUserId)
        .send(freeRequest)
        .expect(200);

      expect(response.body.comparison).toHaveProperty('premium');
      expect(response.body.comparison.premium).toMatch(/^\$\d+\.\d{6}$/);
    });

    it('should require admin authentication', async () => {
      await request(app)
        .post('/monitor/cost-estimation')
        .send(validEstimationRequest)
        .expect(401);
    });
  });

  describe('Enhanced Metrics Endpoint', () => {
    it('should return enhanced metrics with new fields', async () => {
      const response = await request(app)
        .get('/monitor/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-User-Id', adminUserId)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('requests');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('storage');

      // Verify enhanced system metrics
      const { system } = response.body;
      expect(system).toHaveProperty('status');
      expect(system).toHaveProperty('uptime');
      expect(system).toHaveProperty('memoryUsageMB');
      expect(system).toHaveProperty('environment');
      expect(system).toHaveProperty('version');
      expect(system).toHaveProperty('activeConnections');

      // Verify performance metrics
      const { performance } = response.body;
      expect(performance).toHaveProperty('averageResponseTime');
      expect(performance).toHaveProperty('p95ResponseTime');
      expect(performance).toHaveProperty('slowRequests');

      // Verify request metrics with success rate
      const { requests } = response.body;
      expect(requests).toHaveProperty('total');
      expect(requests).toHaveProperty('successful');
      expect(requests).toHaveProperty('failed');
      expect(requests).toHaveProperty('successRate');
      expect(requests.successRate).toMatch(/^\d+\.\d{2}$/);
    });
  });
});
