/**
 * Monitoring System Tests
 * Tests for the monitoring dashboard and metrics endpoints
 */

const request = require('supertest');
const app = require('../index');

describe('Monitoring System', () => {
  describe('GET /monitor', () => {
    it('should serve the monitoring dashboard HTML', async () => {
      const response = await request(app)
        .get('/monitor')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.text).toContain('NeuraStack Monitoring Dashboard');
      expect(response.text).toContain('Admin Login');
      expect(response.text).toContain('firebase.initializeApp');
    });
  });

  describe('GET /monitor/metrics', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/monitor/metrics')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Authentication required');
      expect(response.body).toHaveProperty('message', 'Please provide X-User-Id header or Authorization token');
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/monitor/metrics')
        .set('X-User-Id', 'non-admin-user')
        .expect(403);

      expect(response.body).toHaveProperty('error', 'User not found');
    });

    it('should return metrics for admin users', async () => {
      // This test requires the admin user to be set up in Firestore
      // In a real test environment, you'd mock the Firestore calls
      const response = await request(app)
        .get('/monitor/metrics')
        .set('X-User-Id', 'FkcjlhNTSodSGxYDjGOPQK9aIXL2')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('requests');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('storage');

      // Verify system metrics structure
      expect(response.body.system).toHaveProperty('status');
      expect(response.body.system).toHaveProperty('uptime');
      expect(response.body.system).toHaveProperty('memoryUsageMB');
      expect(response.body.system).toHaveProperty('environment');

      // Verify memory metrics structure
      expect(response.body.memory).toHaveProperty('workingMemorySize');
      expect(response.body.memory).toHaveProperty('shortTermMemorySize');
      expect(response.body.memory).toHaveProperty('longTermMemorySize');
      expect(response.body.memory).toHaveProperty('avgRetrievalTime');

      // Verify storage status
      expect(response.body.storage).toHaveProperty('firestoreAvailable');
      expect(response.body.storage).toHaveProperty('vectorDbAvailable');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to metrics endpoint', async () => {
      // Make multiple requests quickly to test rate limiting
      const promises = [];
      for (let i = 0; i < 65; i++) { // Exceed the 60 requests per minute limit
        promises.push(
          request(app)
            .get('/monitor/metrics')
            .set('X-User-Id', 'FkcjlhNTSodSGxYDjGOPQK9aIXL2')
        );
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/monitor')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'SAMEORIGIN');
      expect(response.headers).toHaveProperty('x-xss-protection', '0');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/monitor')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-credentials', 'true');
    });

    it('should include correlation ID in response', async () => {
      const response = await request(app)
        .get('/monitor/metrics')
        .set('X-User-Id', 'FkcjlhNTSodSGxYDjGOPQK9aIXL2')
        .expect(200);

      expect(response.headers).toHaveProperty('x-correlation-id');
      expect(response.headers['x-correlation-id']).toMatch(/^[a-f0-9]{8}$/);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid user IDs gracefully', async () => {
      const response = await request(app)
        .get('/monitor/metrics')
        .set('X-User-Id', 'invalid-user-id-that-does-not-exist')
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .get('/monitor/metrics')
        .set('X-User-Id', '')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Admin User Setup', () => {
  describe('Setup Script', () => {
    it('should have admin setup script available', () => {
      const fs = require('fs');
      const path = require('path');
      
      const scriptPath = path.join(__dirname, '../scripts/setup-admin-users.js');
      expect(fs.existsSync(scriptPath)).toBe(true);
    });
  });
});

describe('Memory Manager Metrics', () => {
  const { getMemoryManager } = require('../services/memoryManager');

  it('should provide system memory metrics', async () => {
    const memoryManager = getMemoryManager();
    const metrics = await memoryManager.getMemoryMetrics('system');

    expect(metrics).toHaveProperty('workingMemorySize');
    expect(metrics).toHaveProperty('shortTermMemorySize');
    expect(metrics).toHaveProperty('longTermMemorySize');
    expect(metrics).toHaveProperty('avgRetrievalTime');
    expect(metrics).toHaveProperty('firestoreAvailable');
    expect(metrics).toHaveProperty('lastUpdated');

    expect(typeof metrics.workingMemorySize).toBe('number');
    expect(typeof metrics.shortTermMemorySize).toBe('number');
    expect(typeof metrics.longTermMemorySize).toBe('number');
    expect(typeof metrics.avgRetrievalTime).toBe('number');
    expect(typeof metrics.firestoreAvailable).toBe('boolean');
  });
});
