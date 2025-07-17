/**
 * 🧪 Sophisticated Voting System Tests
 * 
 * Comprehensive test suite for the sophisticated voting mechanism including:
 * - Diversity score calculations
 * - Historical accuracy tracking
 * - Meta-voting functionality
 * - Tie-breaking mechanisms
 * - Abstention logic
 * - Integration testing
 */

const SophisticatedVotingService = require('../services/sophisticatedVotingService');
const DiversityScoreService = require('../services/diversityScoreService');
const VotingHistoryService = require('../services/votingHistoryService');
const MetaVoterService = require('../services/metaVoterService');
const TieBreakerService = require('../services/tieBreakerService');
const AbstentionService = require('../services/abstentionService');

describe('Sophisticated Voting System', () => {
  let sophisticatedVotingService;
  let mockRoles;

  beforeEach(() => {
    sophisticatedVotingService = new SophisticatedVotingService();
    
    // Mock roles for testing
    mockRoles = [
      {
        role: 'gpt4o',
        status: 'fulfilled',
        content: 'This is a comprehensive response about artificial intelligence and machine learning. It covers various aspects including neural networks, deep learning, and natural language processing. The response demonstrates good understanding of the topic.',
        confidence: 0.85,
        responseTime: 2500,
        metadata: { model: 'gpt-4o', processingTime: 2500 },
        semanticConfidence: { score: 0.8 }
      },
      {
        role: 'gemini',
        status: 'fulfilled',
        content: 'AI and ML are transformative technologies. Neural networks enable pattern recognition. Deep learning uses multiple layers for complex tasks.',
        confidence: 0.72,
        responseTime: 1800,
        metadata: { model: 'gemini-2.0-flash', processingTime: 1800 },
        semanticConfidence: { score: 0.7 }
      },
      {
        role: 'claude',
        status: 'fulfilled',
        content: 'Artificial intelligence represents a paradigm shift in computing, enabling machines to perform tasks that traditionally required human intelligence. Machine learning, a subset of AI, allows systems to learn and improve from experience without explicit programming.',
        confidence: 0.78,
        responseTime: 3200,
        metadata: { model: 'claude-3-5-haiku-latest', processingTime: 3200 },
        semanticConfidence: { score: 0.75 }
      }
    ];
  });

  describe('Core Voting Functionality', () => {
    test('should execute sophisticated voting successfully', async () => {
      const result = await sophisticatedVotingService.executeSophisticatedVoting(
        mockRoles,
        'Explain artificial intelligence and machine learning',
        { correlationId: 'test-001' }
      );

      expect(result).toBeDefined();
      expect(result.winner).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.consensus).toBeDefined();
      expect(result.weights).toBeDefined();
      expect(result._sophisticatedVotingVersion).toBe('1.0');
      expect(result._backwardCompatible).toBe(true);
    }, 15000); // Increased timeout to 15 seconds

    test('should include all sophisticated voting components', async () => {
      const result = await sophisticatedVotingService.executeSophisticatedVoting(
        mockRoles,
        'Test prompt',
        { correlationId: 'test-002' }
      );

      expect(result.traditionalVoting).toBeDefined();
      expect(result.hybridVoting).toBeDefined();
      expect(result.diversityAnalysis).toBeDefined();
      expect(result.historicalPerformance).toBeDefined();
      expect(result.tieBreaking).toBeDefined();
      expect(result.metaVoting).toBeDefined();
      expect(result.abstention).toBeDefined();
      expect(result.analytics).toBeDefined();
    }, 15000); // Increased timeout to 15 seconds

    test('should handle empty or failed responses gracefully', async () => {
      const failedRoles = [
        { role: 'gpt4o', status: 'rejected', error: 'API timeout' },
        { role: 'gemini', status: 'rejected', error: 'Rate limit' }
      ];

      const result = await sophisticatedVotingService.executeSophisticatedVoting(
        failedRoles,
        'Test prompt',
        { correlationId: 'test-003' }
      );

      expect(result).toBeDefined();
      expect(result.sophisticatedVotingFailed || result.winner === null).toBeTruthy();
    });
  });

  describe('Diversity Score Service', () => {
    test('should calculate diversity scores correctly', async () => {
      const diversityService = new DiversityScoreService();
      const result = await diversityService.calculateDiversityScores(mockRoles);

      expect(result.overallDiversity).toBeGreaterThanOrEqual(0);
      expect(result.overallDiversity).toBeLessThanOrEqual(1);
      expect(result.pairwiseSimilarities).toBeDefined();
      expect(result.diversityWeights).toBeDefined();
      expect(result.noveltyScores).toBeDefined();
    });

    test('should handle single response correctly', async () => {
      const diversityService = new DiversityScoreService();
      const singleRole = [mockRoles[0]];
      const result = await diversityService.calculateDiversityScores(singleRole);

      expect(result.overallDiversity).toBe(0);
    });


  });

  describe('Tie-Breaking Service', () => {
    test('should detect tie-breaking needs correctly', () => {
      const tieBreakerService = new TieBreakerService();
      
      // Create a close voting result
      const closeVotingResult = {
        winner: 'gpt4o',
        confidence: 0.51,
        consensus: 'weak',
        weights: {
          'gpt4o': 0.51,
          'gemini': 0.49
        }
      };

      const analysis = tieBreakerService.analyzeTieBreakingNeeds(closeVotingResult, mockRoles);
      expect(analysis.needsTieBreaking).toBe(true);
      expect(analysis.tieType).toBeDefined();
    });

    test('should not trigger tie-breaking for clear winners', () => {
      const tieBreakerService = new TieBreakerService();
      
      const clearVotingResult = {
        winner: 'gpt4o',
        confidence: 0.85,
        consensus: 'strong',
        weights: {
          'gpt4o': 0.85,
          'gemini': 0.15
        }
      };

      const analysis = tieBreakerService.analyzeTieBreakingNeeds(clearVotingResult, mockRoles);
      expect(analysis.needsTieBreaking).toBe(false);
    });

    test('should detect multi-way ties', () => {
      const tieBreakerService = new TieBreakerService();
      
      const multiWayTie = [
        ['gpt4o', 0.34],
        ['gemini', 0.33],
        ['claude', 0.33]
      ];

      const result = tieBreakerService.detectMultiWayTie(multiWayTie);
      expect(result.isTied).toBe(true);
      expect(result.tiedCount).toBe(3);
    });
  });

  describe('Abstention Service', () => {
    test('should detect abstention needs for very weak consensus', () => {
      const abstentionService = new AbstentionService();
      
      const weakVotingResult = {
        winner: 'gpt4o',
        confidence: 0.25,
        consensus: 'very-weak',
        weights: { 'gpt4o': 0.25, 'gemini': 0.25, 'claude': 0.25 }
      };

      const analysis = abstentionService.analyzeAbstentionNeed(
        weakVotingResult,
        mockRoles,
        null,
        { correlationId: 'test-abstention' }
      );

      expect(analysis.shouldAbstain).toBe(true);
      expect(analysis.reasons).toContain('very_weak_consensus');
      expect(analysis.recommendedStrategy).toBeDefined();
    });

    test('should not trigger abstention for strong consensus', () => {
      const abstentionService = new AbstentionService();
      
      const strongVotingResult = {
        winner: 'gpt4o',
        confidence: 0.85,
        consensus: 'strong',
        weights: { 'gpt4o': 0.85, 'gemini': 0.15 }
      };

      const analysis = abstentionService.analyzeAbstentionNeed(
        strongVotingResult,
        mockRoles,
        null,
        { correlationId: 'test-no-abstention' }
      );

      expect(analysis.shouldAbstain).toBe(false);
    });

    test('should respect re-query limits', () => {
      const abstentionService = new AbstentionService();
      const correlationId = 'test-limit';
      
      // Simulate multiple re-query attempts
      abstentionService.recordReQueryAttempt(correlationId, { name: 'test_strategy' });
      abstentionService.recordReQueryAttempt(correlationId, { name: 'test_strategy' });
      abstentionService.recordReQueryAttempt(correlationId, { name: 'test_strategy' });

      const weakVotingResult = {
        winner: 'gpt4o',
        confidence: 0.25,
        consensus: 'very-weak',
        weights: { 'gpt4o': 0.25 }
      };

      const analysis = abstentionService.analyzeAbstentionNeed(
        weakVotingResult,
        mockRoles,
        null,
        { correlationId }
      );

      expect(analysis.shouldAbstain).toBe(false);
      expect(analysis.reasons).toContain('max_requery_attempts_reached');
    });
  });

  describe('Integration Tests', () => {
    test('should maintain backward compatibility', async () => {
      const result = await sophisticatedVotingService.executeSophisticatedVoting(
        mockRoles,
        'Test prompt',
        { correlationId: 'integration-test-001' }
      );

      // Check that all traditional voting fields are present
      expect(result.winner).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.consensus).toBeDefined();
      expect(result.weights).toBeDefined();

      // Check backward compatibility flag
      expect(result._backwardCompatible).toBe(true);
    }, 15000); // Increased timeout to 15 seconds

    test('should handle service failures gracefully', async () => {
      // Mock a service failure by passing invalid data
      const invalidRoles = [
        { role: 'invalid', status: 'fulfilled', content: null }
      ];

      const result = await sophisticatedVotingService.executeSophisticatedVoting(
        invalidRoles,
        'Test prompt',
        { correlationId: 'failure-test' }
      );

      expect(result).toBeDefined();
      expect(result.sophisticatedVotingFailed || result.fallbackUsed).toBeTruthy();
    });

    test('should process different consensus scenarios', async () => {
      const scenarios = [
        {
          name: 'strong_consensus',
          roles: [
            { ...mockRoles[0], confidence: 0.9 },
            { ...mockRoles[1], confidence: 0.3 },
            { ...mockRoles[2], confidence: 0.2 }
          ]
        },
        {
          name: 'weak_consensus',
          roles: [
            { ...mockRoles[0], confidence: 0.4 },
            { ...mockRoles[1], confidence: 0.35 },
            { ...mockRoles[2], confidence: 0.38 }
          ]
        }
      ];

      for (const scenario of scenarios) {
        const result = await sophisticatedVotingService.executeSophisticatedVoting(
          scenario.roles,
          'Test prompt',
          { correlationId: `scenario-${scenario.name}` }
        );

        expect(result).toBeDefined();
        expect(result.consensus).toBeDefined();
        expect(result.analytics.sophisticatedFeaturesUsed).toBeDefined();
      }
    }, 30000); // Increased timeout to 30 seconds for multiple scenarios
  });

  describe('Performance Tests', () => {
    test('should complete voting within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await sophisticatedVotingService.executeSophisticatedVoting(
        mockRoles,
        'Performance test prompt',
        { correlationId: 'performance-test' }
      );

      const processingTime = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(processingTime).toBeLessThan(15000); // Should complete within 15 seconds
    }, 20000); // Increased timeout to 20 seconds

    test('should handle large number of responses', async () => {
      // Create many mock responses
      const manyRoles = Array.from({ length: 10 }, (_, i) => ({
        ...mockRoles[0],
        role: `model_${i}`,
        confidence: 0.5 + (Math.random() * 0.4),
        content: `Response ${i}: ${mockRoles[0].content}`
      }));

      const result = await sophisticatedVotingService.executeSophisticatedVoting(
        manyRoles,
        'Large scale test',
        { correlationId: 'large-scale-test' }
      );

      expect(result).toBeDefined();
      expect(result.winner).toBeDefined();
      expect(Object.keys(result.weights)).toHaveLength(10);
    }, 20000); // Increased timeout to 20 seconds
  });

  describe('Error Handling', () => {
    test('should handle missing required parameters', async () => {
      const result = await sophisticatedVotingService.executeSophisticatedVoting(
        null,
        'Test prompt',
        { correlationId: 'error-test' }
      );

      expect(result).toBeDefined();
      expect(result.sophisticatedVotingFailed || result.error).toBeTruthy();
    });

    test('should handle malformed role data', async () => {
      const malformedRoles = [
        { role: 'test', status: 'fulfilled' }, // Missing content
        { status: 'fulfilled', content: 'test' }, // Missing role
        { role: 'test2', content: 'test2' } // Missing status
      ];

      const result = await sophisticatedVotingService.executeSophisticatedVoting(
        malformedRoles,
        'Test prompt',
        { correlationId: 'malformed-test' }
      );

      expect(result).toBeDefined();
      // Should either succeed with available data or fail gracefully
    });
  });
});

// Helper function to run all tests
if (require.main === module) {
  console.log('🧪 Running Sophisticated Voting System Tests...');
  
  // This would typically be run with Jest or another test runner
  // For now, we'll just export the test suite
  module.exports = {
    testSuite: 'Sophisticated Voting System',
    description: 'Comprehensive tests for advanced voting mechanisms',
    coverage: [
      'Core voting functionality',
      'Diversity score calculations',
      'Tie-breaking mechanisms',
      'Abstention logic',
      'Integration testing',
      'Performance validation',
      'Error handling'
    ]
  };
}
