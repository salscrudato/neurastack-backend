/**
 * Enhanced Voting and Confidence System Test
 * Tests the improved voting algorithms with mock responses
 */

const axios = require('axios');

class EnhancedVotingTest {
  constructor() {
    this.baseUrl = 'http://localhost:8080';
    this.testResults = [];
  }

  /**
   * Run comprehensive voting system tests
   */
  async runTests() {
    console.log('🚀 Starting Enhanced Voting and Confidence Algorithm Tests\n');
    console.log('============================================================\n');

    const scenarios = this.getTestScenarios();
    
    for (const scenario of scenarios) {
      try {
        await this.testScenario(scenario);
      } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
        this.testResults.push({
          name: scenario.name,
          success: false,
          error: error.message
        });
      }
    }

    this.printSummary();
  }

  /**
   * Test scenarios with different response patterns
   */
  getTestScenarios() {
    return [
      {
        name: 'High Quality Technical Question',
        prompt: 'Explain the architectural differences between microservices and monolithic applications, including their respective advantages and trade-offs.',
        expectedConfidence: 'high',
        expectedConsensus: 'strong',
        description: 'Technical question that should produce detailed, high-quality responses'
      },
      {
        name: 'Simple Factual Question',
        prompt: 'What is the capital of France?',
        expectedConfidence: 'high',
        expectedConsensus: 'strong',
        description: 'Simple factual question with clear, consistent answers'
      },
      {
        name: 'Complex Subjective Question',
        prompt: 'What is the meaning of life and how should one find purpose?',
        expectedConfidence: 'medium',
        expectedConsensus: 'moderate',
        description: 'Philosophical question likely to produce varied responses'
      },
      {
        name: 'Ambiguous Question',
        prompt: 'How do you fix it?',
        expectedConfidence: 'low',
        expectedConsensus: 'weak',
        description: 'Vague question that should produce uncertain responses'
      },
      {
        name: 'Mathematical Problem',
        prompt: 'Solve the equation: 2x + 5 = 17, and explain the steps.',
        expectedConfidence: 'high',
        expectedConsensus: 'strong',
        description: 'Mathematical problem with clear, consistent solution'
      }
    ];
  }

  /**
   * Test a single scenario
   */
  async testScenario(scenario) {
    console.log(`🧪 Testing: ${scenario.name}`);
    console.log(`Prompt: "${scenario.prompt}"`);
    console.log(`Description: ${scenario.description}\n`);
    
    const response = await axios.post(`${this.baseUrl}/default-ensemble`, {
      prompt: scenario.prompt,
      userId: `test-enhanced-voting-${Date.now()}`
    }, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': `enhanced-voting-test-${Date.now()}`
      }
    });

    const data = response.data.data;
    this.analyzeResults(scenario, data);
  }

  /**
   * Analyze and display test results
   */
  analyzeResults(scenario, data) {
    const synthesis = data.synthesis;
    const voting = data.voting;
    const roles = data.roles;
    const metadata = data.metadata;

    console.log(`📊 Results for ${scenario.name}:`);
    console.log(`  Synthesis Confidence: ${synthesis.confidence.score.toFixed(3)} (${synthesis.confidence.level})`);
    console.log(`  Voting Winner: ${voting.winner || 'none'} (confidence: ${voting.confidence.toFixed(3)})`);
    console.log(`  Voting Consensus: ${voting.consensus}`);
    console.log(`  Model Agreement: ${metadata.confidenceAnalysis.modelAgreement.toFixed(3)}`);
    console.log(`  Response Consistency: ${metadata.confidenceAnalysis.responseConsistency.toFixed(3)}`);
    console.log(`  Successful Roles: ${roles.filter(r => r.status === 'fulfilled').length}/${roles.length}`);
    console.log(`  Processing Time: ${metadata.processingTime || 0}ms`);
    
    // Detailed voting analysis
    console.log(`  Voting Weights:`);
    Object.entries(voting.weights).forEach(([role, weight]) => {
      console.log(`    ${role}: ${(weight * 100).toFixed(1)}%`);
    });
    
    console.log(`  Voting Recommendation: ${voting.recommendation}`);
    
    // Quality analysis
    console.log(`  Quality Distribution:`);
    if (metadata.confidenceAnalysis.qualityDistribution) {
      Object.entries(metadata.confidenceAnalysis.qualityDistribution).forEach(([level, count]) => {
        console.log(`    ${level}: ${count} responses`);
      });
    }

    // Expectation validation
    const confidenceMatch = this.validateConfidenceLevel(synthesis.confidence.level, scenario.expectedConfidence);
    const consensusMatch = this.validateConsensusLevel(voting.consensus, scenario.expectedConsensus);
    
    console.log(`  Expected Confidence: ${scenario.expectedConfidence} - ${confidenceMatch ? '✅' : '❌'}`);
    console.log(`  Expected Consensus: ${scenario.expectedConsensus} - ${consensusMatch ? '✅' : '❌'}`);
    
    // Entropy analysis
    const entropy = this.calculateEntropy(voting.weights);
    console.log(`  📈 ${entropy < 0.8 ? 'Low' : entropy < 1.2 ? 'Medium' : 'High'} entropy voting distribution (${entropy < 0.8 ? 'focused' : entropy < 1.2 ? 'balanced' : 'dispersed'} consensus)`);
    
    console.log(''); // Empty line for readability

    this.testResults.push({
      name: scenario.name,
      success: true,
      confidenceMatch,
      consensusMatch,
      synthesisConfidence: synthesis.confidence.score,
      votingConfidence: voting.confidence,
      modelAgreement: metadata.confidenceAnalysis.modelAgreement,
      processingTime: metadata.processingTime || 0,
      entropy
    });
  }

  /**
   * Validate confidence level expectations
   */
  validateConfidenceLevel(actual, expected) {
    const levels = ['very-low', 'low', 'medium', 'high'];
    const actualIndex = levels.indexOf(actual);
    const expectedIndex = levels.indexOf(expected);
    
    // Allow for one level of tolerance
    return Math.abs(actualIndex - expectedIndex) <= 1;
  }

  /**
   * Validate consensus level expectations
   */
  validateConsensusLevel(actual, expected) {
    const levels = ['very-weak', 'weak', 'moderate', 'strong'];
    const actualIndex = levels.indexOf(actual);
    const expectedIndex = levels.indexOf(expected);
    
    // Allow for one level of tolerance
    return Math.abs(actualIndex - expectedIndex) <= 1;
  }

  /**
   * Calculate entropy of voting weights
   */
  calculateEntropy(weights) {
    const values = Object.values(weights).filter(w => w > 0);
    if (values.length === 0) return 0;
    
    return -values.reduce((sum, p) => sum + p * Math.log2(p), 0);
  }

  /**
   * Print comprehensive test summary
   */
  printSummary() {
    console.log('\n🎯 ENHANCED VOTING & CONFIDENCE TEST SUMMARY');
    console.log('============================================================');
    
    const successful = this.testResults.filter(r => r.success);
    const failed = this.testResults.filter(r => !r.success);
    
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}\n`);

    if (successful.length > 0) {
      console.log('📈 CONFIDENCE METRICS:');
      const avgSynthesisConfidence = successful.reduce((sum, r) => sum + r.synthesisConfidence, 0) / successful.length;
      const avgVotingConfidence = successful.reduce((sum, r) => sum + r.votingConfidence, 0) / successful.length;
      const avgModelAgreement = successful.reduce((sum, r) => sum + r.modelAgreement, 0) / successful.length;
      
      console.log(`  Average Synthesis Confidence: ${avgSynthesisConfidence.toFixed(3)}`);
      console.log(`  Average Voting Confidence: ${avgVotingConfidence.toFixed(3)}`);
      console.log(`  Average Model Agreement: ${avgModelAgreement.toFixed(3)}\n`);

      console.log('⏱️  PERFORMANCE METRICS:');
      const avgProcessingTime = successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length;
      const maxProcessingTime = Math.max(...successful.map(r => r.processingTime));
      const minProcessingTime = Math.min(...successful.map(r => r.processingTime));
      
      console.log(`  Average Processing Time: ${avgProcessingTime.toFixed(2)}ms`);
      console.log(`  Max Processing Time: ${maxProcessingTime}ms`);
      console.log(`  Min Processing Time: ${minProcessingTime}ms\n`);

      console.log('🎯 PREDICTION ACCURACY:');
      const confidenceMatches = successful.filter(r => r.confidenceMatch).length;
      const consensusMatches = successful.filter(r => r.consensusMatch).length;
      
      console.log(`  Confidence Level Predictions: ${confidenceMatches}/${successful.length} (${(confidenceMatches/successful.length*100).toFixed(1)}%)`);
      console.log(`  Consensus Level Predictions: ${consensusMatches}/${successful.length} (${(consensusMatches/successful.length*100).toFixed(1)}%)\n`);
    }

    if (failed.length > 0) {
      console.log('❌ FAILED TESTS:');
      failed.forEach(test => {
        console.log(`  ${test.name}: ${test.error}`);
      });
      console.log('');
    }

    // Overall assessment
    const successRate = successful.length / this.testResults.length;
    const avgAccuracy = successful.length > 0 ? 
      (successful.filter(r => r.confidenceMatch && r.consensusMatch).length / successful.length) : 0;

    console.log('🚀 OVERALL ASSESSMENT:');
    if (successRate >= 0.8 && avgAccuracy >= 0.6) {
      console.log('✅ EXCELLENT - Enhanced voting and confidence algorithms are working optimally');
    } else if (successRate >= 0.6 && avgAccuracy >= 0.4) {
      console.log('⚠️  GOOD - System is functional with room for improvement');
    } else {
      console.log('❌ NEEDS IMPROVEMENT - Significant issues detected');
    }
    
    console.log('============================================================\n');
    console.log('✅ All enhanced voting and confidence tests completed');
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new EnhancedVotingTest();
  tester.runTests().catch(console.error);
}

module.exports = EnhancedVotingTest;
