#!/usr/bin/env node

/**
 * 🔍 Sophisticated Voting System Validation Script
 * 
 * This script validates the sophisticated voting system by:
 * 1. Testing core functionality with real API calls
 * 2. Validating performance under different scenarios
 * 3. Checking backward compatibility
 * 4. Verifying analytics and monitoring
 * 5. Testing error handling and edge cases
 */

const axios = require('axios');
const logger = require('../utils/visualLogger');

class SophisticatedVotingValidator {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.testResults = [];
    this.startTime = Date.now();
  }

  /**
   * Run comprehensive validation suite
   */
  async runValidation() {
    logger.success(
      'Sophisticated Voting Validation: Starting',
      {
        'Base URL': this.baseUrl,
        'Test Categories': 6,
        'Status': 'Initializing validation suite'
      },
      'validation'
    );

    try {
      // Test 1: Basic functionality
      await this.testBasicFunctionality();
      
      // Test 2: Sophisticated features
      await this.testSophisticatedFeatures();
      
      // Test 3: Analytics endpoint
      await this.testAnalyticsEndpoint();
      
      // Test 4: Performance validation
      await this.testPerformance();
      
      // Test 5: Error handling
      await this.testErrorHandling();
      
      // Test 6: Backward compatibility
      await this.testBackwardCompatibility();
      
      // Generate final report
      this.generateReport();
      
    } catch (error) {
      logger.error(
        'Sophisticated Voting Validation: Failed',
        {
          'Error': error.message,
          'Tests Completed': this.testResults.length,
          'Status': 'Validation failed'
        },
        'validation'
      );
    }
  }

  /**
   * Test basic ensemble functionality
   */
  async testBasicFunctionality() {
    logger.info('Testing basic ensemble functionality...', {}, 'validation');
    
    try {
      const response = await axios.post(`${this.baseUrl}/default-ensemble`, {
        prompt: 'Explain the concept of artificial intelligence in simple terms.',
        config: {
          timeout: 30000,
          maxTokens: 500
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'validation-test'
        },
        timeout: 35000
      });

      const result = response.data;
      
      // Validate response structure
      const validations = [
        { check: result.synthesis?.content, name: 'Synthesis content exists' },
        { check: result.voting?.winner, name: 'Voting winner exists' },
        { check: result.voting?.confidence !== undefined, name: 'Voting confidence exists' },
        { check: result.voting?.consensus, name: 'Voting consensus exists' },
        { check: result.voting?.weights, name: 'Voting weights exist' },
        { check: result.voting?.sophisticatedVoting, name: 'Sophisticated voting data exists' },
        { check: result.metadata?.version === '4.0', name: 'Version updated to 4.0' },
        { check: result.roles?.length > 0, name: 'Roles data exists' }
      ];

      const passed = validations.filter(v => v.check).length;
      const total = validations.length;

      this.testResults.push({
        category: 'Basic Functionality',
        passed,
        total,
        success: passed === total,
        details: validations,
        responseTime: response.headers['x-response-time'] || 'unknown'
      });

      logger.success(
        `Basic Functionality: ${passed}/${total} validations passed`,
        {
          'Winner': result.voting?.winner,
          'Confidence': result.voting?.confidence?.toFixed(3),
          'Consensus': result.voting?.consensus,
          'Features Used': result.voting?.sophisticatedVoting?.analytics?.sophisticatedFeaturesUsed?.length || 0
        },
        'validation'
      );

    } catch (error) {
      this.testResults.push({
        category: 'Basic Functionality',
        passed: 0,
        total: 8,
        success: false,
        error: error.message
      });

      logger.error('Basic functionality test failed', { error: error.message }, 'validation');
    }
  }

  /**
   * Test sophisticated voting features
   */
  async testSophisticatedFeatures() {
    logger.info('Testing sophisticated voting features...', {}, 'validation');
    
    const testCases = [
      {
        name: 'Diversity Analysis',
        prompt: 'Compare different approaches to machine learning: supervised, unsupervised, and reinforcement learning.',
        expectedFeatures: ['diversity_analysis']
      },
      {
        name: 'Potential Tie-Breaking',
        prompt: 'What is 2+2?',
        expectedFeatures: [] // Simple question might not trigger advanced features
      },
      {
        name: 'Complex Analysis',
        prompt: 'Analyze the philosophical implications of artificial consciousness and whether machines can truly think, considering multiple perspectives from cognitive science, philosophy of mind, and computer science.',
        expectedFeatures: ['diversity_analysis', 'historical_performance']
      }
    ];

    let totalPassed = 0;
    let totalTests = 0;

    for (const testCase of testCases) {
      try {
        const response = await axios.post(`${this.baseUrl}/default-ensemble`, {
          prompt: testCase.prompt,
          config: { timeout: 30000 }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'validation-sophisticated'
          },
          timeout: 35000
        });

        const result = response.data;
        const sophisticatedVoting = result.voting?.sophisticatedVoting;
        
        if (sophisticatedVoting) {
          totalTests += 4;
          
          // Check for sophisticated voting components
          if (sophisticatedVoting.traditionalVoting) totalPassed++;
          if (sophisticatedVoting.hybridVoting) totalPassed++;
          if (sophisticatedVoting.diversityAnalysis) totalPassed++;
          if (sophisticatedVoting.analytics) totalPassed++;
          
          logger.info(
            `Sophisticated Features - ${testCase.name}`,
            {
              'Features Used': sophisticatedVoting.analytics?.sophisticatedFeaturesUsed || [],
              'Diversity Score': sophisticatedVoting.diversityAnalysis?.overallDiversity?.toFixed(3) || 'N/A',
              'Tie Breaking': sophisticatedVoting.tieBreaking?.used || false,
              'Meta Voting': sophisticatedVoting.metaVoting?.used || false
            },
            'validation'
          );
        }

      } catch (error) {
        logger.warning(`Sophisticated features test failed for ${testCase.name}`, { error: error.message }, 'validation');
      }
    }

    this.testResults.push({
      category: 'Sophisticated Features',
      passed: totalPassed,
      total: totalTests,
      success: totalPassed > totalTests * 0.7, // 70% pass rate
      details: testCases
    });
  }

  /**
   * Test analytics endpoint
   */
  async testAnalyticsEndpoint() {
    logger.info('Testing voting analytics endpoint...', {}, 'validation');
    
    try {
      const response = await axios.get(`${this.baseUrl}/voting-analytics`, {
        timeout: 10000
      });

      const analytics = response.data.analytics;
      
      const validations = [
        { check: analytics.monitoring, name: 'Monitoring data exists' },
        { check: analytics.services, name: 'Service analytics exist' },
        { check: analytics.insights, name: 'Insights data exists' },
        { check: analytics.monitoring?.totalVotingDecisions !== undefined, name: 'Total voting decisions tracked' },
        { check: analytics.monitoring?.consensusDistribution, name: 'Consensus distribution exists' },
        { check: analytics.monitoring?.sophisticatedFeaturesUsage, name: 'Feature usage tracked' }
      ];

      const passed = validations.filter(v => v.check).length;
      const total = validations.length;

      this.testResults.push({
        category: 'Analytics Endpoint',
        passed,
        total,
        success: passed === total,
        details: validations
      });

      logger.success(
        `Analytics Endpoint: ${passed}/${total} validations passed`,
        {
          'Total Decisions': analytics.monitoring?.totalVotingDecisions || 0,
          'Average Confidence': analytics.monitoring?.averageConfidence || 'N/A',
          'System Health': analytics.insights?.systemHealth || 'unknown'
        },
        'validation'
      );

    } catch (error) {
      this.testResults.push({
        category: 'Analytics Endpoint',
        passed: 0,
        total: 6,
        success: false,
        error: error.message
      });

      logger.error('Analytics endpoint test failed', { error: error.message }, 'validation');
    }
  }

  /**
   * Test performance under load
   */
  async testPerformance() {
    logger.info('Testing performance characteristics...', {}, 'validation');
    
    const performanceTests = [];
    const concurrentRequests = 3; // Reduced for validation
    
    try {
      const startTime = Date.now();
      
      // Create concurrent requests
      const promises = Array.from({ length: concurrentRequests }, (_, i) => 
        axios.post(`${this.baseUrl}/default-ensemble`, {
          prompt: `Performance test ${i}: Explain quantum computing and its potential applications.`,
          config: { timeout: 25000 }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': `validation-perf-${i}`
          },
          timeout: 30000
        })
      );

      const results = await Promise.allSettled(promises);
      const totalTime = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      performanceTests.push({
        test: 'Concurrent Requests',
        successful,
        failed,
        totalTime,
        averageTime: totalTime / concurrentRequests
      });

      this.testResults.push({
        category: 'Performance',
        passed: successful,
        total: concurrentRequests,
        success: successful >= concurrentRequests * 0.8, // 80% success rate
        details: performanceTests
      });

      logger.success(
        `Performance: ${successful}/${concurrentRequests} requests successful`,
        {
          'Total Time': `${totalTime}ms`,
          'Average Time': `${Math.round(totalTime / concurrentRequests)}ms`,
          'Success Rate': `${((successful / concurrentRequests) * 100).toFixed(1)}%`
        },
        'validation'
      );

    } catch (error) {
      this.testResults.push({
        category: 'Performance',
        passed: 0,
        total: concurrentRequests,
        success: false,
        error: error.message
      });

      logger.error('Performance test failed', { error: error.message }, 'validation');
    }
  }

  /**
   * Test error handling
   */
  async testErrorHandling() {
    logger.info('Testing error handling...', {}, 'validation');
    
    const errorTests = [
      {
        name: 'Empty prompt',
        data: { prompt: '', config: {} },
        expectError: true
      },
      {
        name: 'Invalid config',
        data: { prompt: 'Test', config: { timeout: -1 } },
        expectError: false // Should handle gracefully
      },
      {
        name: 'Missing prompt',
        data: { config: {} },
        expectError: true
      }
    ];

    let passed = 0;
    
    for (const test of errorTests) {
      try {
        const response = await axios.post(`${this.baseUrl}/default-ensemble`, test.data, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        if (!test.expectError) {
          passed++;
          logger.info(`Error handling - ${test.name}: Handled gracefully`, {}, 'validation');
        } else {
          logger.warning(`Error handling - ${test.name}: Expected error but got success`, {}, 'validation');
        }

      } catch (error) {
        if (test.expectError) {
          passed++;
          logger.info(`Error handling - ${test.name}: Correctly returned error`, {}, 'validation');
        } else {
          logger.warning(`Error handling - ${test.name}: Unexpected error: ${error.message}`, {}, 'validation');
        }
      }
    }

    this.testResults.push({
      category: 'Error Handling',
      passed,
      total: errorTests.length,
      success: passed === errorTests.length,
      details: errorTests
    });
  }

  /**
   * Test backward compatibility
   */
  async testBackwardCompatibility() {
    logger.info('Testing backward compatibility...', {}, 'validation');
    
    try {
      const response = await axios.post(`${this.baseUrl}/default-ensemble`, {
        prompt: 'Test backward compatibility',
        config: { timeout: 20000 }
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 25000
      });

      const result = response.data;
      
      // Check that all traditional fields are still present
      const compatibilityChecks = [
        { check: result.synthesis, name: 'Synthesis field exists' },
        { check: result.voting?.winner, name: 'Winner field exists' },
        { check: result.voting?.confidence !== undefined, name: 'Confidence field exists' },
        { check: result.voting?.consensus, name: 'Consensus field exists' },
        { check: result.voting?.weights, name: 'Weights field exists' },
        { check: result.roles, name: 'Roles field exists' },
        { check: result.metadata, name: 'Metadata field exists' }
      ];

      const passed = compatibilityChecks.filter(c => c.check).length;
      const total = compatibilityChecks.length;

      this.testResults.push({
        category: 'Backward Compatibility',
        passed,
        total,
        success: passed === total,
        details: compatibilityChecks
      });

      logger.success(
        `Backward Compatibility: ${passed}/${total} checks passed`,
        {
          'All Fields Present': passed === total,
          'Version': result.metadata?.version,
          'Sophisticated Features': result.voting?.sophisticatedVoting ? 'Present' : 'Missing'
        },
        'validation'
      );

    } catch (error) {
      this.testResults.push({
        category: 'Backward Compatibility',
        passed: 0,
        total: 7,
        success: false,
        error: error.message
      });

      logger.error('Backward compatibility test failed', { error: error.message }, 'validation');
    }
  }

  /**
   * Generate comprehensive validation report
   */
  generateReport() {
    const totalTime = Date.now() - this.startTime;
    const totalTests = this.testResults.reduce((sum, r) => sum + r.total, 0);
    const totalPassed = this.testResults.reduce((sum, r) => sum + r.passed, 0);
    const successfulCategories = this.testResults.filter(r => r.success).length;
    
    logger.success(
      'Sophisticated Voting Validation: Complete',
      {
        'Total Time': `${totalTime}ms`,
        'Categories': `${successfulCategories}/${this.testResults.length}`,
        'Tests': `${totalPassed}/${totalTests}`,
        'Success Rate': `${((totalPassed / totalTests) * 100).toFixed(1)}%`,
        'Status': totalPassed >= totalTests * 0.8 ? 'PASSED' : 'NEEDS ATTENTION'
      },
      'validation'
    );

    // Detailed breakdown
    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      logger.info(
        `${status} ${result.category}: ${result.passed}/${result.total}`,
        {
          'Success': result.success,
          'Error': result.error || 'None'
        },
        'validation'
      );
    });

    // Recommendations
    const failedCategories = this.testResults.filter(r => !r.success);
    if (failedCategories.length > 0) {
      logger.warning(
        'Validation Issues Found',
        {
          'Failed Categories': failedCategories.map(c => c.category).join(', '),
          'Recommendation': 'Review failed tests and address issues before production deployment'
        },
        'validation'
      );
    } else {
      logger.success(
        'All Validations Passed',
        {
          'Status': 'Ready for production',
          'Recommendation': 'Sophisticated voting system is functioning correctly'
        },
        'validation'
      );
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:8080';
  const validator = new SophisticatedVotingValidator(baseUrl);
  
  validator.runValidation().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}

module.exports = SophisticatedVotingValidator;
