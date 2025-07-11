/**
 * Enhanced Analytics System Tests
 * Comprehensive testing of semantic confidence, Brier calibration, and advanced diagnostics
 */

const request = require('supertest');
const app = require('../index');
const semanticConfidenceService = require('../services/semanticConfidenceService');
const brierCalibrationService = require('../services/brierCalibrationService');

describe('Enhanced Analytics System', () => {
  
  describe('Semantic Confidence Service', () => {
    test('should initialize with reference answers', () => {
      const stats = semanticConfidenceService.getStats();
      expect(stats.referenceAnswersCount).toBeGreaterThan(0);
      expect(stats.referenceCategories).toContain('general');
      expect(stats.referenceCategories).toContain('technical');
    });

    test('should calculate semantic confidence for text', async () => {
      const testContent = 'Based on current research and best practices, I recommend implementing a comprehensive solution that addresses scalability and maintainability concerns.';
      const result = await semanticConfidenceService.calculateSemanticConfidence(testContent, 2000);
      
      expect(result).toHaveProperty('score');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result).toHaveProperty('components');
      expect(result.components).toHaveProperty('referenceSimilarity');
      expect(result.components).toHaveProperty('grammarScore');
      expect(result.components).toHaveProperty('latencyScore');
    });

    test('should generate embeddings and cache them', async () => {
      const text = 'Test embedding generation';
      const embedding1 = await semanticConfidenceService.generateEmbedding(text, 'test_key');
      const embedding2 = await semanticConfidenceService.generateEmbedding(text, 'test_key');
      
      expect(embedding1).toEqual(embedding2); // Should be cached
      expect(embedding1.length).toBe(1536); // text-embedding-3-small dimension
    });

    test('should calculate embedding-based uniqueness', async () => {
      const responses = [
        { content: 'This is a unique response about artificial intelligence and machine learning.' },
        { content: 'This discusses completely different topics like cooking and recipes.' },
        { content: 'Another response about AI and ML with similar concepts.' }
      ];
      
      const uniqueness = await semanticConfidenceService.calculateEmbeddingUniqueness(responses[0].content, responses);
      expect(uniqueness).toBeGreaterThanOrEqual(0);
      expect(uniqueness).toBeLessThanOrEqual(1);
    });

    test('should calculate toxicity scores', () => {
      const cleanText = 'This is a helpful and informative response.';
      const toxicText = 'This is stupid and worthless content.';
      
      const cleanScore = semanticConfidenceService.calculateToxicityScore(cleanText);
      const toxicScore = semanticConfidenceService.calculateToxicityScore(toxicText);
      
      expect(cleanScore).toBeLessThan(toxicScore);
      expect(cleanScore).toBeGreaterThanOrEqual(0);
      expect(toxicScore).toBeLessThanOrEqual(1);
    });

    test('should calculate readability metrics', () => {
      const simpleText = 'This is simple text. It has short sentences.';
      const complexText = 'This sophisticated implementation demonstrates comprehensive methodological approaches utilizing advanced algorithmic frameworks and systematic optimization strategies.';
      
      const simpleReadability = semanticConfidenceService.calculateReadability(simpleText);
      const complexReadability = semanticConfidenceService.calculateReadability(complexText);
      
      expect(simpleReadability.gradeLevel).toBeLessThan(complexReadability.gradeLevel);
      expect(simpleReadability).toHaveProperty('complexity');
      expect(complexReadability).toHaveProperty('avgSentenceLength');
    });

    test('should manage reference answers', () => {
      const initialCount = semanticConfidenceService.getStats().referenceAnswersCount;
      
      // Add new reference answer
      const added = semanticConfidenceService.addReferenceAnswer('test_category', 'Test reference content', 0.85);
      expect(added).toBe(true);
      expect(semanticConfidenceService.getStats().referenceAnswersCount).toBe(initialCount + 1);
      
      // Update reference answer
      const updated = semanticConfidenceService.updateReferenceAnswer('test_category', 'Updated test content', 0.90);
      expect(updated).toBe(true);
      
      // Remove reference answer
      const removed = semanticConfidenceService.removeReferenceAnswer('test_category');
      expect(removed).toBe(true);
      expect(semanticConfidenceService.getStats().referenceAnswersCount).toBe(initialCount);
    });

    test('should perform health check', async () => {
      const health = await semanticConfidenceService.healthCheck();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('openaiClient');
      expect(health).toHaveProperty('embeddingTest');
    });
  });

  describe('Brier Calibration Service', () => {
    test('should store and retrieve calibration data', () => {
      const modelName = 'test-model';
      const initialStats = brierCalibrationService.getCalibrationStats(modelName);
      expect(initialStats.dataPoints).toBe(0);
      
      // Store some predictions
      brierCalibrationService.storePrediction(modelName, 0.8, true);
      brierCalibrationService.storePrediction(modelName, 0.3, false);
      brierCalibrationService.storePrediction(modelName, 0.9, true);
      
      const updatedStats = brierCalibrationService.getCalibrationStats(modelName);
      expect(updatedStats.dataPoints).toBe(3);
    });

    test('should calculate Brier scores', () => {
      const modelName = 'brier-test-model';
      
      // Store predictions with known outcomes
      brierCalibrationService.storePrediction(modelName, 0.9, true);  // Good prediction
      brierCalibrationService.storePrediction(modelName, 0.1, false); // Good prediction
      brierCalibrationService.storePrediction(modelName, 0.9, false); // Bad prediction
      
      const brierScore = brierCalibrationService.getCurrentBrierScore(modelName);
      expect(brierScore).toHaveProperty('score');
      expect(brierScore).toHaveProperty('reliability');
      expect(brierScore.score).toBeGreaterThanOrEqual(0);
    });

    test('should provide calibrated probabilities', () => {
      const modelName = 'calibration-test-model';
      
      // Add sufficient data for calibration
      for (let i = 0; i < 25; i++) {
        const prob = Math.random();
        const outcome = prob > 0.5;
        brierCalibrationService.storePrediction(modelName, prob, outcome);
      }
      
      const calibrationResult = brierCalibrationService.getCalibratedProbability(modelName, 0.7);
      expect(calibrationResult).toHaveProperty('calibrated');
      expect(calibrationResult).toHaveProperty('raw');
      expect(calibrationResult).toHaveProperty('calibrationAvailable');
      expect(calibrationResult.calibrated).toBeGreaterThanOrEqual(0);
      expect(calibrationResult.calibrated).toBeLessThanOrEqual(1);
    });

    test('should provide service statistics', () => {
      const stats = brierCalibrationService.getServiceStats();
      expect(stats).toHaveProperty('totalModels');
      expect(stats).toHaveProperty('totalDataPoints');
      expect(stats).toHaveProperty('modelStats');
      expect(stats.totalModels).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Enhanced Ensemble API', () => {
    test('should return enhanced analytics in ensemble response', async () => {
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'Explain the benefits of artificial intelligence in healthcare.',
          userId: 'test-user-analytics'
        })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('metadata');
      expect(response.body.data.metadata).toHaveProperty('diagnostics');
      
      const diagnostics = response.body.data.metadata.diagnostics;
      expect(diagnostics).toHaveProperty('embeddingSimilarityMatrix');
      expect(diagnostics).toHaveProperty('modelCalibratedProb');
      expect(diagnostics).toHaveProperty('toxicityScore');
      expect(diagnostics).toHaveProperty('readability');
      expect(diagnostics).toHaveProperty('semanticQuality');
    }, 30000);

    test('should include description fields for all analytics', async () => {
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'What are the key principles of software engineering?',
          userId: 'test-user-descriptions'
        })
        .expect(200);

      const diagnostics = response.body.data.metadata.diagnostics;
      expect(diagnostics).toHaveProperty('_embeddingSimilarityMatrixDescription');
      expect(diagnostics).toHaveProperty('_modelCalibratedProbDescription');
      expect(diagnostics).toHaveProperty('_toxicityScoreDescription');
      expect(diagnostics).toHaveProperty('_readabilityDescription');
      expect(diagnostics).toHaveProperty('_semanticQualityDescription');
    }, 30000);

    test('should handle analytics failures gracefully', async () => {
      // Test with a prompt that might cause analytics issues
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: '', // Empty prompt
          userId: 'test-user-error-handling'
        })
        .expect(200);

      // Should still return a response even if analytics fail
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('metadata');
    }, 30000);
  });

  describe('Analytics Integration', () => {
    test('should maintain backwards compatibility', async () => {
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'Test backwards compatibility',
          userId: 'test-user-compatibility'
        })
        .expect(200);

      // Check that all original fields are still present
      expect(response.body.data).toHaveProperty('synthesis');
      expect(response.body.data).toHaveProperty('roles');
      expect(response.body.data.metadata).toHaveProperty('confidenceAnalysis');
      expect(response.body.data.metadata).toHaveProperty('costEstimate');
      
      // Check that new diagnostics field is added
      expect(response.body.data.metadata).toHaveProperty('diagnostics');
    }, 30000);

    test('should provide meaningful confidence improvements', async () => {
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'Provide a comprehensive analysis of machine learning algorithms including their strengths, weaknesses, and appropriate use cases.',
          userId: 'test-user-confidence'
        })
        .expect(200);

      const roles = response.body.data.roles;
      
      // Check that confidence scores are reasonable
      roles.forEach(role => {
        if (role.status === 'fulfilled') {
          expect(role.confidence.score).toBeGreaterThanOrEqual(0);
          expect(role.confidence.score).toBeLessThanOrEqual(1);
          expect(role.confidence).toHaveProperty('level');
          expect(['very-low', 'low', 'medium', 'high']).toContain(role.confidence.level);
        }
      });
    }, 30000);
  });
});
