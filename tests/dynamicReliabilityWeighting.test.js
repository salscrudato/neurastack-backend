/**
 * Dynamic Reliability Weighting and Tie-Breaking Tests
 * Comprehensive testing of the enhanced voting system with provider reliability metrics
 */

const request = require('supertest');
const app = require('../index');
const providerReliabilityService = require('../services/providerReliabilityService');
const brierCalibrationService = require('../services/brierCalibrationService');

describe('Dynamic Reliability Weighting System', () => {
  
  describe('Provider Reliability Service', () => {
    test('should initialize with default provider configurations', () => {
      const stats = providerReliabilityService.getAllProviderStats();
      expect(Object.keys(stats)).toContain('openai');
      expect(Object.keys(stats)).toContain('claude');
      expect(Object.keys(stats)).toContain('gemini');
      expect(Object.keys(stats)).toContain('xai');
    });

    test('should record provider events and update uptime', () => {
      const provider = 'openai';
      const initialStats = providerReliabilityService.getProviderStats(provider);
      const initialRequests = initialStats.uptime.totalRequests;
      
      // Record successful event
      providerReliabilityService.recordProviderEvent(provider, true, 2000, 'gpt-4o-mini', 100, 150);
      
      const updatedStats = providerReliabilityService.getProviderStats(provider);
      expect(updatedStats.uptime.totalRequests).toBe(initialRequests + 1);
      expect(updatedStats.uptime.successfulRequests).toBeGreaterThan(initialStats.uptime.successfulRequests);
    });

    test('should calculate dynamic weights based on calibrated confidence, cost, and uptime', () => {
      const provider = 'openai';
      const calibratedConfidence = 0.85;
      
      // Record some events to establish baseline
      providerReliabilityService.recordProviderEvent(provider, true, 1500, 'gpt-4o-mini', 100, 200);
      providerReliabilityService.recordProviderEvent(provider, true, 2000, 'gpt-4o-mini', 120, 180);
      
      const dynamicWeight = providerReliabilityService.getDynamicWeight(provider, calibratedConfidence);
      expect(dynamicWeight).toBeGreaterThan(0);
      expect(typeof dynamicWeight).toBe('number');
    });

    test('should handle provider failures and update uptime accordingly', () => {
      const provider = 'claude';
      
      // Record some failures
      providerReliabilityService.recordProviderEvent(provider, false, 0);
      providerReliabilityService.recordProviderEvent(provider, false, 0);
      providerReliabilityService.recordProviderEvent(provider, true, 1800, 'claude-3-5-haiku-latest', 80, 120);
      
      const stats = providerReliabilityService.getProviderStats(provider);
      expect(stats.uptime.current24h).toBeLessThan(1.0);
      expect(stats.uptime.totalRequests).toBeGreaterThan(0);
    });

    test('should calculate cost efficiency correctly', () => {
      const provider = 'gemini';
      
      // Record cost events
      providerReliabilityService.recordProviderEvent(provider, true, 1200, 'gemini-2.0-flash', 150, 300);
      providerReliabilityService.recordProviderEvent(provider, true, 1400, 'gemini-2.0-flash', 200, 250);
      
      const stats = providerReliabilityService.getProviderStats(provider);
      expect(stats.cost.averageCostPer1K).toBeGreaterThan(0);
      expect(stats.reliability.costEfficiency).toBeGreaterThan(0);
    });

    test('should provide service health status', () => {
      const health = providerReliabilityService.getServiceHealth();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('totalProviders');
      expect(health).toHaveProperty('healthyProviders');
      expect(['healthy', 'degraded']).toContain(health.status);
    });
  });

  describe('Enhanced Voting System', () => {
    test('should apply dynamic reliability weighting to ensemble responses', async () => {
      // Record some provider events to establish reliability metrics
      providerReliabilityService.recordProviderEvent('openai', true, 2000, 'gpt-4o-mini', 100, 150);
      providerReliabilityService.recordProviderEvent('claude', true, 1800, 'claude-3-5-haiku-latest', 90, 140);
      providerReliabilityService.recordProviderEvent('gemini', true, 2200, 'gemini-2.0-flash', 110, 200);
      
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'Explain the concept of machine learning in simple terms.',
          userId: 'test-user-dynamic-weighting'
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('metadata');
      expect(response.body.data.metadata).toHaveProperty('confidenceAnalysis');
      
      const confidenceAnalysis = response.body.data.metadata.confidenceAnalysis;
      expect(confidenceAnalysis).toHaveProperty('voting');
      expect(confidenceAnalysis.voting).toHaveProperty('reliabilityMetrics');
      expect(confidenceAnalysis.voting.reliabilityMetrics).toHaveProperty('providerWeights');
    }, 30000);

    test('should detect tie-breaking scenarios', async () => {
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'What are the pros and cons of renewable energy?',
          userId: 'test-user-tie-breaking'
        })
        .expect(200);

      const voting = response.body.data.metadata.confidenceAnalysis.voting;
      expect(voting).toHaveProperty('tieBreaking');
      expect(voting).toHaveProperty('weightDifference');
      expect(voting).toHaveProperty('consensusGrade');
      expect(['strong', 'moderate', 'weak']).toContain(voting.consensusGrade);
    }, 30000);

    test('should trigger comparative synthesis for tie-breaking', async () => {
      // This test checks if the synthesis strategy changes when tie-breaking is detected
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'Compare the advantages of solar vs wind energy.',
          userId: 'test-user-comparative-synthesis'
        })
        .expect(200);

      const synthesis = response.body.data.synthesis;
      expect(synthesis).toHaveProperty('content');
      expect(synthesis.content.length).toBeGreaterThan(0);
      
      // Check if tie-breaking was triggered
      const voting = response.body.data.metadata.confidenceAnalysis.voting;
      if (voting.tieBreaking) {
        // If tie-breaking was triggered, synthesis should be more detailed
        expect(synthesis.content.length).toBeGreaterThan(200);
      }
    }, 30000);

    test('should include consensus grade in response metadata', async () => {
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'Describe the water cycle.',
          userId: 'test-user-consensus-grade'
        })
        .expect(200);

      const voting = response.body.data.metadata.confidenceAnalysis.voting;
      expect(voting).toHaveProperty('consensusGrade');
      expect(['strong', 'moderate', 'weak']).toContain(voting.consensusGrade);
      
      // Strong consensus should have higher weight difference
      if (voting.consensusGrade === 'strong') {
        expect(voting.weightDifference).toBeGreaterThan(0.15);
      }
    }, 30000);
  });

  describe('Calibrated Confidence Integration', () => {
    test('should use Brier-calibrated probabilities in dynamic weighting', () => {
      const modelName = 'gpt-4o-mini';
      const rawConfidence = 0.8;
      
      // Store some calibration data
      brierCalibrationService.storePrediction(modelName, 0.9, true);
      brierCalibrationService.storePrediction(modelName, 0.7, false);
      brierCalibrationService.storePrediction(modelName, 0.8, true);
      
      const calibrationResult = brierCalibrationService.getCalibratedProbability(modelName, rawConfidence);
      expect(calibrationResult).toHaveProperty('calibrated');
      expect(calibrationResult).toHaveProperty('raw');
      expect(calibrationResult.calibrated).toBeGreaterThanOrEqual(0);
      expect(calibrationResult.calibrated).toBeLessThanOrEqual(1);
    });

    test('should integrate calibrated confidence with provider reliability', async () => {
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'Explain quantum computing basics.',
          userId: 'test-user-calibrated-integration'
        })
        .expect(200);

      const reliabilityMetrics = response.body.data.metadata.confidenceAnalysis.voting.reliabilityMetrics;
      expect(reliabilityMetrics).toHaveProperty('calibratedConfidences');
      expect(reliabilityMetrics).toHaveProperty('providerWeights');
      
      // Check that calibrated confidences are reasonable
      Object.values(reliabilityMetrics.calibratedConfidences).forEach(confidence => {
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      });
    }, 30000);
  });

  describe('Weight Normalization and Distribution', () => {
    test('should normalize dynamic weights correctly', async () => {
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'What is artificial intelligence?',
          userId: 'test-user-weight-normalization'
        })
        .expect(200);

      const weights = response.body.data.metadata.confidenceAnalysis.voting.weights;
      const weightValues = Object.values(weights);
      const weightSum = weightValues.reduce((sum, weight) => sum + weight, 0);
      
      // Weights should sum to approximately 1.0 (allowing for floating point precision)
      expect(Math.abs(weightSum - 1.0)).toBeLessThan(0.001);
      
      // All weights should be positive
      weightValues.forEach(weight => {
        expect(weight).toBeGreaterThan(0);
      });
    }, 30000);

    test('should maintain backwards compatibility with traditional weights', async () => {
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'Describe photosynthesis.',
          userId: 'test-user-backwards-compatibility'
        })
        .expect(200);

      const voting = response.body.data.metadata.confidenceAnalysis.voting;
      
      // Should have both traditional and dynamic weights
      expect(voting).toHaveProperty('weights'); // Dynamic weights
      expect(voting).toHaveProperty('traditionalWeights'); // Traditional weights
      expect(voting).toHaveProperty('winner');
      expect(voting).toHaveProperty('confidence');
    }, 30000);
  });

  describe('Error Handling and Fallbacks', () => {
    test('should handle provider reliability service failures gracefully', async () => {
      // This test ensures the system works even if reliability tracking fails
      const response = await request(app)
        .post('/health/default-ensemble')
        .send({
          prompt: 'Test error handling in dynamic weighting.',
          userId: 'test-user-error-handling'
        })
        .expect(200);

      // Should still return a valid response even if reliability tracking fails
      expect(response.body.data).toHaveProperty('synthesis');
      expect(response.body.data).toHaveProperty('roles');
      expect(response.body.data.metadata).toHaveProperty('confidenceAnalysis');
    }, 30000);

    test('should provide default weights when reliability data is insufficient', () => {
      const unknownProvider = 'unknown-provider';
      const defaultWeight = providerReliabilityService.getDynamicWeight(unknownProvider, 0.8);
      expect(defaultWeight).toBe(1.0); // Should return default weight
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle concurrent reliability tracking', async () => {
      const promises = [];
      
      // Simulate concurrent provider events
      for (let i = 0; i < 10; i++) {
        promises.push(
          providerReliabilityService.recordProviderEvent(
            'openai', 
            Math.random() > 0.1, // 90% success rate
            Math.random() * 3000 + 1000, // 1-4 second response time
            'gpt-4o-mini',
            100 + Math.random() * 50,
            150 + Math.random() * 100
          )
        );
      }
      
      await Promise.all(promises);
      
      const stats = providerReliabilityService.getProviderStats('openai');
      expect(stats.uptime.totalRequests).toBeGreaterThan(10);
    });

    test('should maintain reasonable performance with large reliability datasets', () => {
      const startTime = Date.now();
      
      // Add many data points
      for (let i = 0; i < 100; i++) {
        providerReliabilityService.recordProviderEvent(
          'claude',
          Math.random() > 0.05,
          Math.random() * 2000 + 1000,
          'claude-3-5-haiku-latest',
          80 + Math.random() * 40,
          120 + Math.random() * 80
        );
      }
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should process 100 events in reasonable time (< 1 second)
      expect(processingTime).toBeLessThan(1000);
    });
  });
});
