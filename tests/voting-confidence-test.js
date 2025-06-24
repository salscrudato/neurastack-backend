/**
 * Voting and Confidence Algorithm Test Suite
 * 
 * This test suite validates the enhanced voting and confidence calculation
 * algorithms for the AI ensemble system.
 */

const axios = require('axios');

class VotingConfidenceTest {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.testResults = [];
  }

  /**
   * Test scenarios with expected confidence patterns
   */
  getTestScenarios() {
    return [
      {
        name: 'High Quality Technical Question',
        prompt: 'Explain the architectural differences between microservices and monolithic applications, including their respective advantages and trade-offs.',
        expectedConfidence: 'high',
        expectedConsensus: 'strong'
      },
      {
        name: 'Simple Factual Question',
        prompt: 'What is the capital of France?',
        expectedConfidence: 'high',
        expectedConsensus: 'strong'
      },
      {
        name: 'Complex Subjective Question',
        prompt: 'What is the meaning of life and how should one find purpose?',
        expectedConfidence: 'medium',
        expectedConsensus: 'moderate'
      },
      {
        name: 'Ambiguous Question',
        prompt: 'How do you fix it?',
        expectedConfidence: 'low',
        expectedConsensus: 'weak'
      },
      {
        name: 'Technical Deep Dive',
        prompt: 'Describe the implementation details of a distributed consensus algorithm like Raft, including leader election, log replication, and safety guarantees.',
        expectedConfidence: 'high',
        expectedConsensus: 'moderate'
      },
      {
        name: 'Current Events Question',
        prompt: 'What are the latest developments in quantum computing research?',
        expectedConfidence: 'medium',
        expectedConsensus: 'moderate'
      },
      {
        name: 'Mathematical Problem',
        prompt: 'Solve the equation: 2x + 5 = 17, and explain the steps.',
        expectedConfidence: 'high',
        expectedConsensus: 'strong'
      },
      {
        name: 'Creative Writing Request',
        prompt: 'Write a short story about a robot learning to paint.',
        expectedConfidence: 'medium',
        expectedConsensus: 'weak'
      }
    ];
  }

  /**
   * Test a single scenario
   */
  async testScenario(scenario) {
    console.log(`\n🧪 Testing: ${scenario.name}`);
    console.log(`Prompt: "${scenario.prompt}"`);
    
    try {
      const response = await axios.post(`${this.baseUrl}/default-ensemble`, {
        prompt: scenario.prompt,
        userId: `test-voting-${Date.now()}`
      }, {
        timeout: 45000,
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': `voting-test-${Date.now()}`
        }
      });

      const data = response.data.data;
      const synthesis = data.synthesis;
      const voting = data.voting;
      const roles = data.roles;
      const metadata = data.metadata;

      // Extract key metrics
      const result = {
        scenario: scenario.name,
        prompt: scenario.prompt,
        success: true,
        
        // Synthesis metrics
        synthesisConfidence: synthesis.confidence.score,
        synthesisLevel: synthesis.confidence.level,
        synthesisQuality: synthesis.qualityScore,
        
        // Voting metrics
        votingWinner: voting.winner,
        votingConfidence: voting.confidence,
        votingConsensus: voting.consensus,
        votingWeights: voting.weights,
        
        // Role analysis
        roleCount: roles.length,
        successfulRoles: roles.filter(r => r.status === 'fulfilled').length,
        averageRoleConfidence: this.calculateAverageRoleConfidence(roles),
        
        // Metadata analysis
        modelAgreement: metadata.confidenceAnalysis.modelAgreement,
        responseConsistency: metadata.confidenceAnalysis.responseConsistency,
        qualityDistribution: metadata.confidenceAnalysis.qualityDistribution,
        votingAnalysis: metadata.confidenceAnalysis.votingAnalysis,
        
        // Expected vs actual
        expectedConfidence: scenario.expectedConfidence,
        expectedConsensus: scenario.expectedConsensus,
        
        // Performance
        processingTime: metadata.processingTime || 0
      };

      this.testResults.push(result);
      this.analyzeScenarioResult(result);
      
      return result;

    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      
      const result = {
        scenario: scenario.name,
        prompt: scenario.prompt,
        success: false,
        error: error.message,
        expectedConfidence: scenario.expectedConfidence,
        expectedConsensus: scenario.expectedConsensus
      };
      
      this.testResults.push(result);
      return result;
    }
  }

  /**
   * Calculate average role confidence
   */
  calculateAverageRoleConfidence(roles) {
    const successfulRoles = roles.filter(r => r.status === 'fulfilled');
    if (successfulRoles.length === 0) return 0;
    
    const totalConfidence = successfulRoles.reduce((sum, role) => sum + role.confidence.score, 0);
    return totalConfidence / successfulRoles.length;
  }

  /**
   * Analyze individual scenario result
   */
  analyzeScenarioResult(result) {
    console.log(`\n📊 Results for ${result.scenario}:`);
    console.log(`  Synthesis Confidence: ${result.synthesisConfidence.toFixed(3)} (${result.synthesisLevel})`);
    console.log(`  Voting Consensus: ${result.votingConsensus} (confidence: ${result.votingConfidence.toFixed(3)})`);
    console.log(`  Model Agreement: ${result.modelAgreement.toFixed(3)}`);
    console.log(`  Successful Roles: ${result.successfulRoles}/${result.roleCount}`);
    console.log(`  Processing Time: ${result.processingTime}ms`);
    
    // Validate expectations
    const confidenceMatch = this.validateConfidenceLevel(result.synthesisConfidence, result.expectedConfidence);
    const consensusMatch = this.validateConsensusLevel(result.votingConsensus, result.expectedConsensus);
    
    console.log(`  Expected Confidence: ${result.expectedConfidence} - ${confidenceMatch ? '✅' : '❌'}`);
    console.log(`  Expected Consensus: ${result.expectedConsensus} - ${consensusMatch ? '✅' : '❌'}`);
    
    // Quality indicators
    if (result.synthesisConfidence > 0.8) {
      console.log(`  🎯 High confidence response detected`);
    }
    
    if (result.votingConsensus === 'strong' && result.modelAgreement > 0.7) {
      console.log(`  🤝 Strong model consensus achieved`);
    }
    
    if (result.votingAnalysis && result.votingAnalysis.distributionEntropy < 0.5) {
      console.log(`  📈 Low entropy voting distribution (focused consensus)`);
    }
  }

  /**
   * Validate confidence level against expectations
   */
  validateConfidenceLevel(score, expected) {
    switch (expected) {
      case 'high':
        return score >= 0.7;
      case 'medium':
        return score >= 0.4 && score < 0.8;
      case 'low':
        return score < 0.5;
      default:
        return true;
    }
  }

  /**
   * Validate consensus level against expectations
   */
  validateConsensusLevel(consensus, expected) {
    const consensusMap = {
      'strong': ['strong'],
      'moderate': ['strong', 'moderate'],
      'weak': ['strong', 'moderate', 'weak']
    };
    
    return consensusMap[expected]?.includes(consensus) || false;
  }

  /**
   * Run all voting and confidence tests
   */
  async runAllTests() {
    console.log('🚀 Starting Voting and Confidence Algorithm Tests\n');
    console.log('=' .repeat(60));
    
    const scenarios = this.getTestScenarios();
    const results = [];
    
    for (const scenario of scenarios) {
      const result = await this.testScenario(scenario);
      results.push(result);
      
      // Brief pause between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.generateSummaryReport();
    return results;
  }

  /**
   * Generate comprehensive summary report
   */
  generateSummaryReport() {
    console.log('\n\n🎯 VOTING & CONFIDENCE TEST SUMMARY');
    console.log('=' .repeat(60));
    
    const successfulTests = this.testResults.filter(r => r.success);
    const failedTests = this.testResults.filter(r => !r.success);
    
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Successful: ${successfulTests.length}`);
    console.log(`Failed: ${failedTests.length}`);
    
    if (successfulTests.length > 0) {
      // Confidence analysis
      const avgSynthesisConfidence = successfulTests.reduce((sum, r) => sum + r.synthesisConfidence, 0) / successfulTests.length;
      const avgVotingConfidence = successfulTests.reduce((sum, r) => sum + r.votingConfidence, 0) / successfulTests.length;
      const avgModelAgreement = successfulTests.reduce((sum, r) => sum + r.modelAgreement, 0) / successfulTests.length;
      
      console.log('\n📈 CONFIDENCE METRICS:');
      console.log(`  Average Synthesis Confidence: ${avgSynthesisConfidence.toFixed(3)}`);
      console.log(`  Average Voting Confidence: ${avgVotingConfidence.toFixed(3)}`);
      console.log(`  Average Model Agreement: ${avgModelAgreement.toFixed(3)}`);
      
      // Consensus distribution
      const consensusDistribution = {};
      successfulTests.forEach(r => {
        consensusDistribution[r.votingConsensus] = (consensusDistribution[r.votingConsensus] || 0) + 1;
      });
      
      console.log('\n🤝 CONSENSUS DISTRIBUTION:');
      Object.entries(consensusDistribution).forEach(([consensus, count]) => {
        const percentage = (count / successfulTests.length * 100).toFixed(1);
        console.log(`  ${consensus}: ${count} (${percentage}%)`);
      });
      
      // Performance metrics
      const avgProcessingTime = successfulTests.reduce((sum, r) => sum + (r.processingTime || 0), 0) / successfulTests.length;
      const maxProcessingTime = Math.max(...successfulTests.map(r => r.processingTime || 0));
      const minProcessingTime = Math.min(...successfulTests.map(r => r.processingTime || 0));
      
      console.log('\n⏱️  PERFORMANCE METRICS:');
      console.log(`  Average Processing Time: ${avgProcessingTime.toFixed(2)}ms`);
      console.log(`  Max Processing Time: ${maxProcessingTime}ms`);
      console.log(`  Min Processing Time: ${minProcessingTime}ms`);
      
      // Expectation validation
      let correctConfidencePredictions = 0;
      let correctConsensusPredictions = 0;
      
      successfulTests.forEach(r => {
        if (this.validateConfidenceLevel(r.synthesisConfidence, r.expectedConfidence)) {
          correctConfidencePredictions++;
        }
        if (this.validateConsensusLevel(r.votingConsensus, r.expectedConsensus)) {
          correctConsensusPredictions++;
        }
      });
      
      console.log('\n🎯 PREDICTION ACCURACY:');
      console.log(`  Confidence Level Predictions: ${correctConfidencePredictions}/${successfulTests.length} (${(correctConfidencePredictions/successfulTests.length*100).toFixed(1)}%)`);
      console.log(`  Consensus Level Predictions: ${correctConsensusPredictions}/${successfulTests.length} (${(correctConsensusPredictions/successfulTests.length*100).toFixed(1)}%)`);
    }
    
    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failedTests.forEach(test => {
        console.log(`  ${test.scenario}: ${test.error}`);
      });
    }
    
    // Overall assessment
    const overallSuccess = successfulTests.length / this.testResults.length;
    console.log('\n🚀 OVERALL ASSESSMENT:');
    
    if (overallSuccess >= 0.9) {
      console.log('✅ EXCELLENT - Voting and confidence algorithms are working optimally');
    } else if (overallSuccess >= 0.8) {
      console.log('✅ GOOD - Voting and confidence algorithms are working well');
    } else if (overallSuccess >= 0.7) {
      console.log('⚠️  ACCEPTABLE - Some issues detected, review recommended');
    } else {
      console.log('❌ NEEDS IMPROVEMENT - Significant issues detected');
    }
    
    console.log('=' .repeat(60));
  }
}

module.exports = VotingConfidenceTest;

// Run tests if called directly
if (require.main === module) {
  const tester = new VotingConfidenceTest();
  
  tester.runAllTests().then(() => {
    console.log('\n✅ All voting and confidence tests completed');
  }).catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
}
