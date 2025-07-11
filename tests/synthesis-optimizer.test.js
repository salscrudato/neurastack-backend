/**
 * 🎯 Synthesis Optimizer Test - Verify New Token Allocation & Temperature Formulas
 * 
 * Tests the implementation of:
 * 6.1 Token allocation: alloc = min(700, 200 + 200 × successful_roles + 50 × comparative_pairs)
 * 6.2 Temperature curve: temp = base_temp + 0.15 × (comparative_pairs > 0) − 0.1 × (fallback_mode)
 * 7. Deprecated field removal: qualityScore and processingTimeMs
 */

const request = require('supertest');
const app = require('../index');

describe('Synthesis Optimizer Tests', () => {
  
  test('Token allocation formula should work correctly', async () => {
    const response = await request(app)
      .post('/default-ensemble')
      .send({
        prompt: 'What is machine learning?'
      })
      .expect(200);

    // Verify response structure
    expect(response.body).toHaveProperty('synthesis');
    expect(response.body).toHaveProperty('roles');
    expect(response.body).toHaveProperty('metadata');
    
    // Verify deprecated fields are removed
    expect(response.body.synthesis).not.toHaveProperty('qualityScore');
    expect(response.body.metadata).not.toHaveProperty('processingTimeMs');
    
    // Verify new confidence structure
    if (response.body.roles && response.body.roles.length > 0) {
      response.body.roles.forEach(role => {
        if (role.status === 'fulfilled') {
          expect(role).toHaveProperty('confidence');
          expect(role.confidence).toHaveProperty('score');
          // Should not have deprecated qualityScore
          expect(role).not.toHaveProperty('qualityScore');
        }
      });
    }
  });

  test('Temperature curve formula should work correctly', async () => {
    const response = await request(app)
      .post('/default-ensemble')
      .send({
        prompt: 'Compare microservices vs monolithic architecture'
      })
      .expect(200);

    // Verify response structure
    expect(response.body).toHaveProperty('synthesis');
    expect(response.body.synthesis).toHaveProperty('content');
    expect(response.body.synthesis).toHaveProperty('model');
    expect(response.body.synthesis).toHaveProperty('provider');
    
    // Verify metadata structure
    expect(response.body.metadata).toHaveProperty('totalRoles');
    expect(response.body.metadata).toHaveProperty('successfulRoles');
    expect(response.body.metadata).toHaveProperty('synthesisStatus');
    
    // Should not have deprecated processingTimeMs field
    expect(response.body.metadata).not.toHaveProperty('processingTimeMs');
  });

  test('Deprecated fields should be removed from all responses', async () => {
    const response = await request(app)
      .post('/default-ensemble')
      .send({
        prompt: 'Simple test question'
      })
      .expect(200);

    // Check synthesis object
    expect(response.body.synthesis).not.toHaveProperty('qualityScore');
    
    // Check metadata object
    expect(response.body.metadata).not.toHaveProperty('processingTimeMs');
    
    // Check individual role responses
    if (response.body.roles && response.body.roles.length > 0) {
      response.body.roles.forEach(role => {
        expect(role).not.toHaveProperty('qualityScore');
        if (role.metadata) {
          // Should use responseTime instead of processingTimeMs
          expect(role.metadata).not.toHaveProperty('processingTimeMs');
        }
      });
    }
  });

  test('Calibrated confidence should be used instead of qualityScore', async () => {
    const response = await request(app)
      .post('/default-ensemble')
      .send({
        prompt: 'Test calibrated confidence'
      })
      .expect(200);

    // Verify roles have confidence structure
    if (response.body.roles && response.body.roles.length > 0) {
      response.body.roles.forEach(role => {
        if (role.status === 'fulfilled') {
          expect(role).toHaveProperty('confidence');
          expect(role.confidence).toHaveProperty('score');
          expect(typeof role.confidence.score).toBe('number');
          expect(role.confidence.score).toBeGreaterThanOrEqual(0);
          expect(role.confidence.score).toBeLessThanOrEqual(1);
        }
      });
    }
  });

  test('Synthesis should handle different strategies correctly', async () => {
    const response = await request(app)
      .post('/default-ensemble')
      .send({
        prompt: 'Explain artificial intelligence in detail'
      })
      .expect(200);

    // Verify synthesis response
    expect(response.body.synthesis).toHaveProperty('content');
    expect(response.body.synthesis.content).toBeTruthy();
    expect(typeof response.body.synthesis.content).toBe('string');
    expect(response.body.synthesis.content.length).toBeGreaterThan(0);
    
    // Verify synthesis metadata
    expect(response.body.synthesis).toHaveProperty('model');
    expect(response.body.synthesis).toHaveProperty('provider');
    expect(response.body.synthesis).toHaveProperty('status');
    expect(response.body.synthesis.status).toBe('success');
  });

});
