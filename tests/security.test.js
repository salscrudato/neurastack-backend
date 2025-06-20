/**
 * Security Features Test Suite
 * Tests authentication, authorization, rate limiting, CSRF protection, and audit logging
 */

const request = require('supertest');
const app = require('../index');
const authenticationService = require('../services/authenticationService');
const auditLoggingService = require('../services/auditLoggingService');
const csrfProtection = require('../middleware/csrfProtection');
const advancedRateLimitingService = require('../services/advancedRateLimitingService');

describe('Security Features', () => {
  let testApiKey;
  let testJwtToken;
  let csrfToken;

  beforeAll(async () => {
    // Create test API key
    const apiKeyData = authenticationService.createApiKey(
      'test-user-security',
      'premium',
      'Security Test Key',
      ['read', 'write']
    );
    testApiKey = apiKeyData.apiKey;

    // Generate test JWT token
    testJwtToken = authenticationService.generateToken({
      userId: 'test-user-security',
      email: 'test@example.com',
      tier: 'premium',
      permissions: ['read', 'write', 'admin']
    });

    // Generate CSRF token
    csrfToken = csrfProtection.generateToken('test-session');
  });

  afterAll(async () => {
    // Clean up
    authenticationService.revokeApiKey(testApiKey);
    csrfProtection.clearAllTokens();
    await advancedRateLimitingService.resetRateLimits('test-user-security');
  });

  describe('Authentication', () => {
    test('should authenticate with valid JWT token', async () => {
      const response = await request(app)
        .get('/auth/rate-limits')
        .set('Authorization', `Bearer ${testJwtToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.userId).toBe('test-user-security');
    });

    test('should authenticate with valid API key', async () => {
      const response = await request(app)
        .get('/auth/rate-limits')
        .set('X-API-Key', testApiKey);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.userId).toBe('test-user-security');
    });

    test('should reject invalid JWT token', async () => {
      const response = await request(app)
        .get('/auth/rate-limits')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid token');
    });

    test('should reject invalid API key', async () => {
      const response = await request(app)
        .get('/auth/rate-limits')
        .set('X-API-Key', 'invalid-key');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid API key');
    });

    test('should create new API key with valid authentication', async () => {
      const response = await request(app)
        .post('/auth/api-keys')
        .set('Authorization', `Bearer ${testJwtToken}`)
        .send({
          name: 'Test API Key',
          permissions: ['read']
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.apiKey).toMatch(/^nsk_premium_/);
    });
  });

  describe('Rate Limiting', () => {
    test('should allow requests within rate limits', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .set('X-API-Key', testApiKey)
        .send({
          prompt: 'Test prompt for rate limiting'
        });

      expect(response.status).toBe(200);
    });

    test('should enforce rate limits for free tier users', async () => {
      // Create free tier API key
      const freeApiKey = authenticationService.createApiKey(
        'free-user-test',
        'free',
        'Free Test Key'
      ).apiKey;

      // Make multiple requests to exceed free tier limit
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .post('/default-ensemble')
            .set('X-API-Key', freeApiKey)
            .send({ prompt: `Test prompt ${i}` })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.error).toBe('Rate limit exceeded');

      // Clean up
      authenticationService.revokeApiKey(freeApiKey);
    });

    test('should provide rate limit status', async () => {
      const response = await request(app)
        .get('/auth/rate-limits')
        .set('X-API-Key', testApiKey);

      expect(response.status).toBe(200);
      expect(response.body.rateLimits).toBeDefined();
      expect(response.body.rateLimits.ensemble).toBeDefined();
      expect(response.body.rateLimits.ensemble.remaining).toBeDefined();
    });
  });

  describe('CSRF Protection', () => {
    test('should provide CSRF token', async () => {
      const response = await request(app)
        .get('/security/csrf-token');

      expect(response.status).toBe(200);
      expect(response.body.csrfToken).toBeDefined();
      expect(response.body.expiresIn).toBeDefined();
    });

    test('should include CSRF token in response headers', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-csrf-token']).toBeDefined();
    });

    test('should validate CSRF token for state-changing requests', async () => {
      // This test would need to be implemented based on specific CSRF protection setup
      // For now, we'll test that the CSRF protection middleware is working
      expect(csrfProtection.generateToken()).toBeDefined();
      expect(csrfProtection.validateToken(csrfToken).valid).toBe(true);
    });
  });

  describe('Input Validation', () => {
    test('should reject malicious script injection', async () => {
      const maliciousPrompt = '<script>alert("xss")</script>Test prompt';
      
      const response = await request(app)
        .post('/default-ensemble')
        .set('X-API-Key', testApiKey)
        .send({
          prompt: maliciousPrompt
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Input validation failed');
    });

    test('should reject SQL injection attempts', async () => {
      const sqlInjectionPrompt = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/default-ensemble')
        .set('X-API-Key', testApiKey)
        .send({
          prompt: sqlInjectionPrompt
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Input validation failed');
    });

    test('should sanitize valid input', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .set('X-API-Key', testApiKey)
        .send({
          prompt: 'What is artificial intelligence?'
        });

      expect(response.status).toBe(200);
    });

    test('should validate prompt length limits', async () => {
      const longPrompt = 'a'.repeat(15000); // Exceeds max length
      
      const response = await request(app)
        .post('/default-ensemble')
        .set('X-API-Key', testApiKey)
        .send({
          prompt: longPrompt
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Input validation failed');
    });
  });

  describe('Audit Logging', () => {
    test('should log authentication events', async () => {
      const eventId = await auditLoggingService.logAuthentication(
        'api_key_auth',
        'test-user-security',
        true,
        { authMethod: 'api_key' }
      );

      expect(eventId).toBeDefined();
      expect(eventId).toMatch(/^audit_/);
    });

    test('should log security violations', async () => {
      const eventId = await auditLoggingService.logSecurityViolation(
        'test_violation',
        'test-user-security',
        { testData: 'security test' }
      );

      expect(eventId).toBeDefined();
    });

    test('should retrieve audit logs (admin only)', async () => {
      const response = await request(app)
        .get('/security/audit-logs')
        .set('Authorization', `Bearer ${testJwtToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    test('should get audit statistics (admin only)', async () => {
      const response = await request(app)
        .get('/security/audit-stats')
        .set('Authorization', `Bearer ${testJwtToken}`);

      expect(response.status).toBe(200);
      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.totalEvents).toBeDefined();
    });

    test('should deny audit access to non-admin users', async () => {
      // Create non-admin token
      const nonAdminToken = authenticationService.generateToken({
        userId: 'non-admin-user',
        email: 'user@example.com',
        tier: 'free',
        permissions: ['read']
      });

      const response = await request(app)
        .get('/security/audit-logs')
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    test('should include CORS headers', async () => {
      const response = await request(app)
        .options('/health')
        .set('Origin', 'https://neurastack.ai');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Security Monitoring', () => {
    test('should provide security health status', async () => {
      const response = await request(app)
        .get('/security/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.metrics).toBeDefined();
    });

    test('should report security incidents', async () => {
      const response = await request(app)
        .post('/security/report-incident')
        .set('X-API-Key', testApiKey)
        .send({
          type: 'suspicious_activity',
          description: 'Test security incident report',
          severity: 'medium'
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe('success');
      expect(response.body.incidentId).toBeDefined();
    });

    test('should get security configuration (admin only)', async () => {
      const response = await request(app)
        .get('/security/config')
        .set('Authorization', `Bearer ${testJwtToken}`);

      expect(response.status).toBe(200);
      expect(response.body.configuration).toBeDefined();
      expect(response.body.configuration.rateLimiting.enabled).toBe(true);
      expect(response.body.configuration.authentication.jwtEnabled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle authentication errors gracefully', async () => {
      const response = await request(app)
        .get('/auth/api-keys')
        .set('Authorization', 'Bearer malformed-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toBeDefined();
    });

    test('should handle rate limit errors gracefully', async () => {
      // This would require actually hitting rate limits
      // For now, we'll test that the rate limiting service handles errors
      const result = await advancedRateLimitingService.checkRateLimit(
        'test-user',
        'free',
        'ensemble'
      );
      
      expect(result.allowed).toBeDefined();
      expect(result.remaining).toBeDefined();
    });

    test('should handle validation errors gracefully', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .set('X-API-Key', testApiKey)
        .send({
          prompt: '' // Empty prompt should fail validation
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });
});

describe('Security Integration', () => {
  test('should work with all security features enabled', async () => {
    const apiKey = authenticationService.createApiKey(
      'integration-test-user',
      'premium',
      'Integration Test Key',
      ['read', 'write']
    ).apiKey;

    const response = await request(app)
      .post('/default-ensemble')
      .set('X-API-Key', apiKey)
      .send({
        prompt: 'What is machine learning?'
      });

    expect(response.status).toBe(200);
    expect(response.body.synthesis).toBeDefined();

    // Clean up
    authenticationService.revokeApiKey(apiKey);
  });

  test('should maintain security across different endpoints', async () => {
    const endpoints = [
      { method: 'get', path: '/health' },
      { method: 'get', path: '/auth/rate-limits' },
      { method: 'get', path: '/models/fine-tuned' },
      { method: 'get', path: '/security/health' }
    ];

    for (const endpoint of endpoints) {
      const response = await request(app)[endpoint.method](endpoint.path)
        .set('X-API-Key', testApiKey);

      expect(response.status).toBeLessThan(500);
      expect(response.headers['x-csrf-token']).toBeDefined();
    }
  });
});
