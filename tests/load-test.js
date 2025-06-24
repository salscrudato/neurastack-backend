/**
 * Comprehensive Load Testing Suite for NeuraStack AI Ensemble
 * 
 * This test suite validates the production readiness of the AI ensemble API
 * for handling 25+ concurrent users with optimal performance.
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      concurrentUsers: 0,
      startTime: 0,
      endTime: 0
    };
  }

  /**
   * Generate realistic test prompts
   */
  getTestPrompts() {
    return [
      "What are the benefits of artificial intelligence in healthcare?",
      "Explain the concept of machine learning in simple terms",
      "How can businesses implement AI to improve efficiency?",
      "What are the ethical considerations of AI development?",
      "Describe the difference between AI, ML, and deep learning",
      "What is the future of autonomous vehicles?",
      "How does natural language processing work?",
      "What are the challenges in AI model deployment?",
      "Explain quantum computing and its potential impact",
      "How can AI help with climate change solutions?",
      "What is the role of data in AI systems?",
      "Describe the importance of AI safety and alignment",
      "How do neural networks learn and adapt?",
      "What are the applications of computer vision?",
      "Explain the concept of reinforcement learning",
      "How can AI improve cybersecurity?",
      "What is the impact of AI on job markets?",
      "Describe the evolution of AI from rule-based to modern systems",
      "How do recommendation systems work?",
      "What are the key components of an AI strategy?"
    ];
  }

  /**
   * Generate random user IDs for testing
   */
  generateUserId() {
    return `test-user-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Make a single API request
   */
  async makeRequest(prompt, userId) {
    const startTime = performance.now();
    
    try {
      const response = await axios.post(`${this.baseUrl}/default-ensemble`, {
        prompt,
        userId
      }, {
        timeout: 45000, // 45 second timeout
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': `load-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.successfulRequests++;
      this.results.responseTimes.push(responseTime);

      return {
        success: true,
        responseTime,
        status: response.status,
        dataSize: JSON.stringify(response.data).length,
        confidence: response.data?.data?.synthesis?.confidence?.score || 0,
        votingConsensus: response.data?.data?.voting?.consensus || 'unknown'
      };

    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.failedRequests++;
      this.results.errors.push({
        message: error.message,
        responseTime,
        timestamp: Date.now()
      });

      return {
        success: false,
        responseTime,
        error: error.message
      };
    }
  }

  /**
   * Simulate concurrent users
   */
  async simulateConcurrentUsers(userCount, requestsPerUser = 3) {
    console.log(`🚀 Starting load test with ${userCount} concurrent users, ${requestsPerUser} requests each`);
    
    this.results.startTime = Date.now();
    this.results.concurrentUsers = userCount;
    
    const prompts = this.getTestPrompts();
    const userPromises = [];

    // Create concurrent user simulations
    for (let i = 0; i < userCount; i++) {
      const userId = this.generateUserId();
      
      const userSimulation = async () => {
        const userResults = [];
        
        for (let j = 0; j < requestsPerUser; j++) {
          const prompt = prompts[Math.floor(Math.random() * prompts.length)];
          const result = await this.makeRequest(prompt, userId);
          userResults.push(result);
          
          // Random delay between requests (0.5-2 seconds)
          if (j < requestsPerUser - 1) {
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));
          }
        }
        
        return userResults;
      };

      userPromises.push(userSimulation());
    }

    // Wait for all users to complete
    const allResults = await Promise.all(userPromises);
    
    this.results.endTime = Date.now();
    this.results.totalRequests = userCount * requestsPerUser;

    return allResults.flat();
  }

  /**
   * Run stress test with increasing load
   */
  async runStressTest() {
    console.log('🔥 Starting comprehensive stress test...\n');

    const testScenarios = [
      { users: 5, requests: 2, name: 'Light Load' },
      { users: 10, requests: 3, name: 'Moderate Load' },
      { users: 15, requests: 3, name: 'Heavy Load' },
      { users: 25, requests: 2, name: 'Peak Load' },
      { users: 30, requests: 2, name: 'Stress Test' }
    ];

    const scenarioResults = [];

    for (const scenario of testScenarios) {
      console.log(`\n📊 Testing ${scenario.name}: ${scenario.users} users, ${scenario.requests} requests each`);
      
      // Reset results for this scenario
      this.resetResults();
      
      const results = await this.simulateConcurrentUsers(scenario.users, scenario.requests);
      const analysis = this.analyzeResults();
      
      scenarioResults.push({
        scenario: scenario.name,
        users: scenario.users,
        requests: scenario.requests,
        ...analysis
      });

      console.log(`✅ ${scenario.name} completed`);
      this.printResults();
      
      // Cool down between scenarios
      console.log('⏳ Cooling down for 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return scenarioResults;
  }

  /**
   * Reset results for new test
   */
  resetResults() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      concurrentUsers: 0,
      startTime: 0,
      endTime: 0
    };
  }

  /**
   * Analyze test results
   */
  analyzeResults() {
    const { responseTimes, totalRequests, successfulRequests, failedRequests, startTime, endTime } = this.results;
    
    if (responseTimes.length === 0) {
      return {
        successRate: 0,
        averageResponseTime: 0,
        medianResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        requestsPerSecond: 0,
        totalDuration: endTime - startTime
      };
    }

    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const totalDuration = endTime - startTime;

    return {
      successRate: (successfulRequests / totalRequests) * 100,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      medianResponseTime: sortedTimes[Math.floor(sortedTimes.length / 2)],
      p95ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
      p99ResponseTime: sortedTimes[Math.floor(sortedTimes.length * 0.99)],
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      requestsPerSecond: (totalRequests / totalDuration) * 1000,
      totalDuration,
      errorRate: (failedRequests / totalRequests) * 100
    };
  }

  /**
   * Print detailed results
   */
  printResults() {
    const analysis = this.analyzeResults();
    
    console.log('\n📈 LOAD TEST RESULTS');
    console.log('=' .repeat(50));
    console.log(`Total Requests: ${this.results.totalRequests}`);
    console.log(`Successful: ${this.results.successfulRequests} (${analysis.successRate.toFixed(2)}%)`);
    console.log(`Failed: ${this.results.failedRequests} (${analysis.errorRate.toFixed(2)}%)`);
    console.log(`Concurrent Users: ${this.results.concurrentUsers}`);
    console.log(`Total Duration: ${(analysis.totalDuration / 1000).toFixed(2)}s`);
    console.log(`Requests/Second: ${analysis.requestsPerSecond.toFixed(2)}`);
    console.log('\n⏱️  RESPONSE TIMES');
    console.log(`Average: ${analysis.averageResponseTime.toFixed(2)}ms`);
    console.log(`Median: ${analysis.medianResponseTime.toFixed(2)}ms`);
    console.log(`95th Percentile: ${analysis.p95ResponseTime.toFixed(2)}ms`);
    console.log(`99th Percentile: ${analysis.p99ResponseTime.toFixed(2)}ms`);
    console.log(`Min: ${analysis.minResponseTime.toFixed(2)}ms`);
    console.log(`Max: ${analysis.maxResponseTime.toFixed(2)}ms`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ ERRORS');
      const errorCounts = {};
      this.results.errors.forEach(error => {
        errorCounts[error.message] = (errorCounts[error.message] || 0) + 1;
      });
      
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`${error}: ${count} occurrences`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
  }

  /**
   * Validate production readiness
   */
  validateProductionReadiness(results) {
    const criteria = {
      successRate: 95, // Minimum 95% success rate
      averageResponseTime: 8000, // Maximum 8 second average response time
      p95ResponseTime: 15000, // Maximum 15 second 95th percentile
      errorRate: 5 // Maximum 5% error rate
    };

    const analysis = this.analyzeResults();
    const issues = [];

    if (analysis.successRate < criteria.successRate) {
      issues.push(`Success rate ${analysis.successRate.toFixed(2)}% below minimum ${criteria.successRate}%`);
    }

    if (analysis.averageResponseTime > criteria.averageResponseTime) {
      issues.push(`Average response time ${analysis.averageResponseTime.toFixed(2)}ms exceeds maximum ${criteria.averageResponseTime}ms`);
    }

    if (analysis.p95ResponseTime > criteria.p95ResponseTime) {
      issues.push(`95th percentile response time ${analysis.p95ResponseTime.toFixed(2)}ms exceeds maximum ${criteria.p95ResponseTime}ms`);
    }

    if (analysis.errorRate > criteria.errorRate) {
      issues.push(`Error rate ${analysis.errorRate.toFixed(2)}% exceeds maximum ${criteria.errorRate}%`);
    }

    return {
      ready: issues.length === 0,
      issues,
      analysis
    };
  }
}

module.exports = LoadTester;

// Run tests if called directly
if (require.main === module) {
  const tester = new LoadTester();
  
  tester.runStressTest().then(results => {
    console.log('\n🎯 FINAL STRESS TEST SUMMARY');
    console.log('=' .repeat(60));
    
    results.forEach(result => {
      console.log(`\n${result.scenario}:`);
      console.log(`  Success Rate: ${result.successRate.toFixed(2)}%`);
      console.log(`  Avg Response Time: ${result.averageResponseTime.toFixed(2)}ms`);
      console.log(`  95th Percentile: ${result.p95ResponseTime.toFixed(2)}ms`);
      console.log(`  Requests/Second: ${result.requestsPerSecond.toFixed(2)}`);
    });

    // Validate production readiness with peak load results
    const peakLoadResult = results.find(r => r.scenario === 'Peak Load');
    if (peakLoadResult) {
      tester.results = {
        totalRequests: peakLoadResult.users * peakLoadResult.requests,
        successfulRequests: Math.round((peakLoadResult.users * peakLoadResult.requests) * (peakLoadResult.successRate / 100)),
        failedRequests: Math.round((peakLoadResult.users * peakLoadResult.requests) * (peakLoadResult.errorRate / 100)),
        responseTimes: [], // Would need to store actual times for full validation
        errors: []
      };

      const validation = tester.validateProductionReadiness();
      
      console.log('\n🚀 PRODUCTION READINESS ASSESSMENT');
      console.log('=' .repeat(60));
      console.log(`Status: ${validation.ready ? '✅ READY' : '❌ NOT READY'}`);
      
      if (!validation.ready) {
        console.log('\nIssues to address:');
        validation.issues.forEach(issue => console.log(`  - ${issue}`));
      }
    }

  }).catch(error => {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  });
}
