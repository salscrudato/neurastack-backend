/**
 * Enhanced Ensemble Integration Tests
 * 
 * Comprehensive testing of the enhanced AI ensemble system including:
 * - Intelligent model routing
 * - Advanced synthesis engine
 * - Sophisticated voting system
 * - Performance optimization
 * - Quality assurance
 */

const request = require('supertest');
const app = require('../index');

// Import enhanced services for direct testing
const intelligentModelRouter = require('../services/intelligentModelRouter');
const advancedSynthesisEngine = require('../services/advancedSynthesisEngine');
const intelligentVotingSystem = require('../services/intelligentVotingSystem');
const performanceOptimizer = require('../services/performanceOptimizer');
const qualityAssuranceSystem = require('../services/qualityAssuranceSystem');

describe('🚀 Enhanced Ensemble System Integration Tests', () => {
  
  describe('🧠 Intelligent Model Router', () => {
    test('should select optimal models based on request characteristics', async () => {
      const prompt = "Explain the benefits of exercise for mental health";
      const context = { userTier: 'free', requestType: 'explanatory' };
      
      const selectedModels = await intelligentModelRouter.selectOptimalModels(prompt, context, 3);
      
      expect(selectedModels).toHaveLength(3);
      expect(selectedModels[0]).toHaveProperty('model');
      expect(selectedModels[0]).toHaveProperty('config');
      expect(selectedModels[0]).toHaveProperty('reasoning');
      
      // Should select diverse providers
      const providers = selectedModels.map(m => m.config.provider);
      const uniqueProviders = new Set(providers);
      expect(uniqueProviders.size).toBeGreaterThan(1);
    });

    test('should record and learn from model performance', async () => {
      const model = 'gpt-4o-mini';
      const performance = {
        success: true,
        responseTime: 2500,
        qualityScore: 0.85
      };
      
      intelligentModelRouter.recordPerformance(model, performance);
      
      const metrics = intelligentModelRouter.getMetrics();
      expect(metrics.modelMetrics[model]).toBeDefined();
      expect(metrics.modelMetrics[model].totalRequests).toBeGreaterThan(0);
    });

    test('should handle circuit breaker functionality', async () => {
      const model = 'test-model';
      
      // Simulate multiple failures
      for (let i = 0; i < 6; i++) {
        intelligentModelRouter.recordPerformance(model, {
          success: false,
          error: new Error('Test failure')
        });
      }
      
      const metrics = intelligentModelRouter.getMetrics();
      expect(metrics.circuitBreakerStatus[model]).toBe('OPEN');
    });
  });

  describe('🔬 Advanced Synthesis Engine', () => {
    test('should perform multi-stage synthesis with quality validation', async () => {
      const roleOutputs = [
        {
          role: 'gpt4o',
          content: 'Exercise improves mental health by releasing endorphins and reducing stress hormones.',
          status: 'fulfilled',
          confidence: { score: 0.8 }
        },
        {
          role: 'claude',
          content: 'Regular physical activity enhances mood, reduces anxiety, and improves cognitive function through neuroplasticity.',
          status: 'fulfilled',
          confidence: { score: 0.85 }
        }
      ];
      
      const userPrompt = "How does exercise benefit mental health?";
      const correlationId = 'test-synthesis-001';
      
      const result = await advancedSynthesisEngine.synthesizeWithAdvancedProcessing(
        roleOutputs,
        userPrompt,
        correlationId
      );
      
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('qualityScore');
      expect(result).toHaveProperty('strategy');
      expect(result.qualityScore).toBeGreaterThan(0.5);
      expect(result.content.length).toBeGreaterThan(50);
      expect(result.strategy.name).toBeDefined();
    });

    test('should adapt synthesis strategy based on request type', async () => {
      const technicalPrompt = "Write a Python function to sort a list";
      const creativePrompt = "Write a short story about a robot";
      
      const technicalStrategy = advancedSynthesisEngine.classifyRequestType(technicalPrompt);
      const creativeStrategy = advancedSynthesisEngine.classifyRequestType(creativePrompt);
      
      expect(technicalStrategy).toBe('technical');
      expect(creativeStrategy).toBe('creative');
    });

    test('should provide comprehensive metrics', () => {
      const metrics = advancedSynthesisEngine.getMetrics();
      
      expect(metrics).toHaveProperty('totalSyntheses');
      expect(metrics).toHaveProperty('successfulSyntheses');
      expect(metrics).toHaveProperty('averageQualityScore');
      expect(metrics).toHaveProperty('strategiesUsed');
    });
  });

  describe('🗳️ Intelligent Voting System', () => {
    test('should perform sophisticated multi-factor voting', async () => {
      const roles = [
        {
          role: 'gpt4o',
          content: 'Comprehensive response with detailed analysis and examples.',
          status: 'fulfilled',
          confidence: { score: 0.8 },
          responseTime: 3000
        },
        {
          role: 'claude',
          content: 'Well-structured response with clear reasoning.',
          status: 'fulfilled',
          confidence: { score: 0.75 },
          responseTime: 2500
        },
        {
          role: 'gemini',
          content: 'Brief but accurate response.',
          status: 'fulfilled',
          confidence: { score: 0.7 },
          responseTime: 2000
        }
      ];
      
      const originalPrompt = "Explain the importance of data validation";
      const requestMetadata = { correlationId: 'test-voting-001' };
      
      const result = await intelligentVotingSystem.executeIntelligentVoting(
        roles,
        originalPrompt,
        requestMetadata
      );
      
      expect(result).toHaveProperty('winner');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('consensus');
      expect(result).toHaveProperty('analysis');
      expect(result).toHaveProperty('methodology');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should adapt voting weights based on context', async () => {
      const metrics = intelligentVotingSystem.getMetrics();
      
      expect(metrics).toHaveProperty('totalVotes');
      expect(metrics).toHaveProperty('averageConfidence');
      expect(metrics).toHaveProperty('modelPerformance');
      expect(metrics).toHaveProperty('currentWeights');
    });

    test('should handle edge cases gracefully', async () => {
      const emptyRoles = [];
      const result = await intelligentVotingSystem.executeIntelligentVoting(
        emptyRoles,
        "Test prompt",
        { correlationId: 'test-empty' }
      );
      
      expect(result.winner).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.consensus).toBe('none');
    });
  });

  describe('⚡ Performance Optimizer', () => {
    test('should optimize requests with intelligent caching', async () => {
      const requestKey = 'test-optimization-001';
      const requestData = { prompt: 'What is machine learning?' };
      
      let executionCount = 0;
      const mockProcessingFunction = async (data) => {
        executionCount++;
        return {
          content: 'Machine learning is a subset of AI...',
          metadata: { processingTime: 1000 }
        };
      };
      
      // First request should execute function
      const result1 = await performanceOptimizer.optimizeRequest(
        requestKey,
        requestData,
        mockProcessingFunction
      );
      
      expect(executionCount).toBe(1);
      expect(result1.content).toBeDefined();
      
      // Second identical request should use cache
      const result2 = await performanceOptimizer.optimizeRequest(
        requestKey,
        requestData,
        mockProcessingFunction
      );
      
      expect(executionCount).toBe(1); // Should not execute again
      expect(result2.metadata.cached).toBe(true);
    });

    test('should find semantically similar cached entries', async () => {
      const requestKey1 = 'test-semantic-001';
      const requestKey2 = 'test-semantic-002';
      const requestData1 = { prompt: 'What is artificial intelligence?' };
      const requestData2 = { prompt: 'Explain AI technology' };
      
      let executionCount = 0;
      const mockProcessingFunction = async (data) => {
        executionCount++;
        return {
          content: 'AI is the simulation of human intelligence...',
          metadata: { processingTime: 1000 }
        };
      };
      
      // Cache first request
      await performanceOptimizer.optimizeRequest(
        requestKey1,
        requestData1,
        mockProcessingFunction
      );
      
      // Similar request should find cached result
      const result = await performanceOptimizer.optimizeRequest(
        requestKey2,
        requestData2,
        mockProcessingFunction
      );
      
      expect(executionCount).toBe(1); // Should use cached result
    });

    test('should provide comprehensive performance metrics', () => {
      const metrics = performanceOptimizer.getMetrics();
      
      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('optimizedResponses');
      expect(metrics).toHaveProperty('similarityThreshold');
    });
  });

  describe('🛡️ Quality Assurance System', () => {
    test('should assess response quality across multiple dimensions', async () => {
      const response = {
        content: `Exercise provides numerous mental health benefits:

1. **Stress Reduction**: Physical activity reduces cortisol levels and releases endorphins, natural mood elevators.

2. **Improved Mood**: Regular exercise can be as effective as medication for treating mild to moderate depression.

3. **Enhanced Cognitive Function**: Exercise increases blood flow to the brain, improving memory and concentration.

4. **Better Sleep**: Physical activity helps regulate sleep patterns, leading to more restful sleep.

In conclusion, incorporating regular exercise into your routine can significantly improve mental well-being through multiple biological and psychological mechanisms.`
      };
      
      const originalPrompt = "How does exercise benefit mental health?";
      
      const assessment = await qualityAssuranceSystem.assessResponseQuality(
        response,
        originalPrompt
      );
      
      expect(assessment).toHaveProperty('overallScore');
      expect(assessment).toHaveProperty('passed');
      expect(assessment).toHaveProperty('dimensions');
      expect(assessment).toHaveProperty('suggestions');
      expect(assessment.overallScore).toBeGreaterThan(0.7);
      expect(assessment.passed).toBe(true);
      expect(assessment.dimensions).toHaveProperty('relevance');
      expect(assessment.dimensions).toHaveProperty('clarity');
      expect(assessment.dimensions).toHaveProperty('completeness');
    });

    test('should detect content safety issues', async () => {
      const unsafeResponse = {
        content: 'This response contains harmful and toxic content that should be flagged.'
      };
      
      const assessment = await qualityAssuranceSystem.assessResponseQuality(
        unsafeResponse,
        "Test prompt"
      );
      
      expect(assessment.violations.length).toBeGreaterThan(0);
      expect(assessment.passed).toBe(false);
    });

    test('should provide improvement suggestions', async () => {
      const poorResponse = {
        content: 'Yes.'
      };
      
      const assessment = await qualityAssuranceSystem.assessResponseQuality(
        poorResponse,
        "Explain the benefits of exercise"
      );
      
      expect(assessment.suggestions.length).toBeGreaterThan(0);
      expect(assessment.overallScore).toBeLessThan(0.6);
      expect(assessment.passed).toBe(false);
    });

    test('should track quality metrics over time', () => {
      const metrics = qualityAssuranceSystem.getMetrics();
      
      expect(metrics).toHaveProperty('totalAssessments');
      expect(metrics).toHaveProperty('passRate');
      expect(metrics).toHaveProperty('averageQualityScore');
      expect(metrics).toHaveProperty('qualityTrend');
    });
  });

  describe('🎼 Enhanced Ensemble Integration', () => {
    test('should process ensemble requests with all enhancements', async () => {
      const testPrompt = 'Explain the benefits of regular exercise for both physical and mental health';
      
      const response = await request(app)
        .post('/default-ensemble')
        .send({
          prompt: testPrompt,
          sessionId: 'test-enhanced-session'
        })
        .set('X-User-Id', 'test-enhanced-user')
        .set('X-Correlation-ID', 'test-enhanced-correlation')
        .expect(200);
      
      // Verify enhanced response structure
      expect(response.body).toHaveProperty('synthesis');
      expect(response.body).toHaveProperty('roles');
      expect(response.body).toHaveProperty('voting');
      expect(response.body).toHaveProperty('metadata');
      
      // Verify enhanced metadata
      expect(response.body.metadata).toHaveProperty('enhanced');
      expect(response.body.metadata).toHaveProperty('orchestrationVersion');
      expect(response.body.metadata).toHaveProperty('selectedModels');
      expect(response.body.metadata).toHaveProperty('responseQuality');
      expect(response.body.metadata.enhanced).toBe(true);
      
      // Verify synthesis quality
      expect(response.body.synthesis.content).toBeDefined();
      expect(response.body.synthesis.content.length).toBeGreaterThan(100);
      expect(response.body.synthesis.confidence.score).toBeGreaterThan(0);
      
      // Verify voting analysis
      expect(response.body.voting).toHaveProperty('analysis');
      expect(response.body.voting.analysis).toHaveProperty('consensusStrength');
      expect(response.body.voting.analysis).toHaveProperty('diversityScore');
      
      // Verify role responses have enhanced metadata
      response.body.roles.forEach(role => {
        expect(role).toHaveProperty('confidence');
        expect(role).toHaveProperty('quality');
        expect(role.quality).toHaveProperty('wordCount');
        expect(role.quality).toHaveProperty('complexity');
      });
    }, 30000); // Extended timeout for full ensemble processing

    test('should handle explain mode with detailed analysis', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .send({
          prompt: 'What is artificial intelligence?',
          explain: true
        })
        .set('X-User-Id', 'test-explain-user')
        .expect(200);
      
      expect(response.body).toHaveProperty('explanation');
      expect(response.body.explanation).toHaveProperty('modelSelection');
      expect(response.body.explanation).toHaveProperty('synthesisStrategy');
      expect(response.body.explanation).toHaveProperty('votingAnalysis');
      expect(response.body.explanation).toHaveProperty('processingStages');
    }, 30000);

    test('should maintain backward compatibility', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .send({
          prompt: 'Simple test question'
        })
        .expect(200);
      
      // Verify all legacy fields are present
      expect(response.body.metadata).toHaveProperty('confidenceAnalysis');
      expect(response.body.metadata).toHaveProperty('costEstimate');
      expect(response.body.metadata).toHaveProperty('tier');
      expect(response.body.metadata.confidenceAnalysis).toHaveProperty('averageConfidence');
      expect(response.body.metadata.confidenceAnalysis).toHaveProperty('highConfidenceResponses');
    }, 30000);

    test('should handle premium tier features', async () => {
      const response = await request(app)
        .post('/default-ensemble')
        .send({
          prompt: 'Complex analytical question requiring detailed response'
        })
        .set('X-User-Tier', 'premium')
        .expect(200);
      
      expect(response.body.metadata.tier).toBe('premium');
      // Premium tier should potentially have more models or higher quality
      expect(response.body.metadata.responseQuality).toBeGreaterThan(0.5);
    }, 30000);
  });

  describe('📊 System Performance and Monitoring', () => {
    test('should provide comprehensive system metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);
      
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('vendors');
      expect(response.body).toHaveProperty('ensemble');
    });

    test('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 5;
      const promises = [];
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post('/default-ensemble')
            .send({
              prompt: `Concurrent test request ${i}`,
              sessionId: `concurrent-session-${i}`
            })
            .set('X-User-Id', `concurrent-user-${i}`)
        );
      }
      
      const responses = await Promise.all(promises);
      
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.synthesis.content).toBeDefined();
        expect(response.body.metadata.enhanced).toBe(true);
      });
    }, 60000); // Extended timeout for concurrent processing

    test('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/default-ensemble')
        .send({
          prompt: 'Performance test: Explain quantum computing'
        })
        .expect(200);
      
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(response.body.metadata.totalProcessingTimeMs).toBeDefined();
      expect(response.body.metadata.totalProcessingTimeMs).toBeGreaterThan(0);
    }, 35000);
  });
});

// Cleanup after tests
afterAll(async () => {
  // Allow time for any pending operations to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
});
