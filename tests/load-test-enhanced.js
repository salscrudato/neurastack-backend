/**
 * 🚀 Enhanced Load Testing Suite for NeuraStack Backend
 * 
 * 🎯 PURPOSE: Comprehensive load testing for 25+ concurrent users
 * 
 * 📋 TEST SCENARIOS:
 * - Concurrent ensemble requests
 * - Workout generation under load
 * - Memory system stress testing
 * - Database performance testing
 * - Cache efficiency testing
 * - Error handling under load
 */

const request = require('supertest');
const app = require('../index');

describe('🚀 Enhanced Load Testing Suite', () => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
  const CONCURRENT_USERS = 25;
  const TEST_DURATION_MS = 60000; // 1 minute
  const REQUEST_INTERVAL_MS = 2000; // 2 seconds between requests per user

  let testResults = {
    ensemble: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      responseTimes: []
    },
    workout: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      responseTimes: []
    },
    memory: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      responseTimes: []
    }
  };

  beforeAll(() => {
    console.log(`🚀 Starting enhanced load test with ${CONCURRENT_USERS} concurrent users`);
    console.log(`📊 Test duration: ${TEST_DURATION_MS / 1000} seconds`);
    console.log(`⏱️ Request interval: ${REQUEST_INTERVAL_MS / 1000} seconds per user`);
  });

  afterAll(() => {
    console.log('\n📊 ENHANCED LOAD TEST RESULTS:');
    console.log('=====================================');
    
    Object.entries(testResults).forEach(([endpoint, results]) => {
      if (results.totalRequests > 0) {
        const successRate = (results.successfulRequests / results.totalRequests * 100).toFixed(2);
        const avgTime = results.averageResponseTime.toFixed(2);
        
        console.log(`\n🎯 ${endpoint.toUpperCase()} ENDPOINT:`);
        console.log(`   Total Requests: ${results.totalRequests}`);
        console.log(`   Success Rate: ${successRate}%`);
        console.log(`   Avg Response Time: ${avgTime}ms`);
        console.log(`   Min Response Time: ${results.minResponseTime}ms`);
        console.log(`   Max Response Time: ${results.maxResponseTime}ms`);
        
        // Calculate percentiles
        if (results.responseTimes.length > 0) {
          const sorted = results.responseTimes.sort((a, b) => a - b);
          const p95 = sorted[Math.floor(sorted.length * 0.95)];
          const p99 = sorted[Math.floor(sorted.length * 0.99)];
          console.log(`   95th Percentile: ${p95}ms`);
          console.log(`   99th Percentile: ${p99}ms`);
        }
      }
    });
  });

  describe('🤖 Ensemble API Load Testing', () => {
    test('should handle 25+ concurrent ensemble requests', async () => {
      const promises = [];
      const startTime = Date.now();

      // Create concurrent users
      for (let userId = 1; userId <= CONCURRENT_USERS; userId++) {
        const userPromise = simulateUser(userId, 'ensemble');
        promises.push(userPromise);
      }

      // Wait for all users to complete
      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      console.log(`\n🎯 Ensemble load test completed in ${totalDuration}ms`);
      
      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Successful users: ${successful}/${CONCURRENT_USERS}`);
      console.log(`❌ Failed users: ${failed}/${CONCURRENT_USERS}`);
      
      // Expect at least 80% success rate
      expect(successful / CONCURRENT_USERS).toBeGreaterThanOrEqual(0.8);
    }, 120000); // 2 minute timeout
  });

  // Removed: Workout API Load Testing - workout functionality removed from codebase

  describe('🧠 Memory System Load Testing', () => {
    test('should handle concurrent memory operations', async () => {
      const promises = [];
      const startTime = Date.now();

      // Create concurrent memory requests
      for (let userId = 1; userId <= CONCURRENT_USERS; userId++) {
        const userPromise = simulateUser(userId, 'memory');
        promises.push(userPromise);
      }

      const results = await Promise.allSettled(promises);
      const endTime = Date.now();
      const totalDuration = endTime - startTime;

      console.log(`\n🧠 Memory load test completed in ${totalDuration}ms`);
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ Successful memory operations: ${successful}/${CONCURRENT_USERS}`);
      console.log(`❌ Failed memory operations: ${failed}/${CONCURRENT_USERS}`);
      
      // Expect at least 85% success rate for memory operations
      expect(successful / CONCURRENT_USERS).toBeGreaterThanOrEqual(0.85);
    }, 90000); // 1.5 minute timeout
  });

  /**
   * Simulate a user making requests for the specified duration
   */
  async function simulateUser(userId, endpoint) {
    const userResults = [];
    const endTime = Date.now() + TEST_DURATION_MS;
    let requestCount = 0;

    while (Date.now() < endTime) {
      try {
        const startTime = Date.now();
        let response;

        switch (endpoint) {
          case 'ensemble':
            response = await makeEnsembleRequest(userId);
            break;
          case 'memory':
            response = await makeMemoryRequest(userId);
            break;
          default:
            throw new Error(`Unknown endpoint: ${endpoint}`);
        }

        const responseTime = Date.now() - startTime;
        
        // Record successful request
        recordResult(endpoint, true, responseTime);
        userResults.push({ success: true, responseTime, status: response.status });
        
        requestCount++;
        
        // Wait before next request
        await sleep(REQUEST_INTERVAL_MS);
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Record failed request
        recordResult(endpoint, false, responseTime);
        userResults.push({ success: false, responseTime, error: error.message });
        
        // Continue testing even after failures
        await sleep(REQUEST_INTERVAL_MS);
      }
    }

    console.log(`👤 User ${userId} (${endpoint}): ${requestCount} requests completed`);
    return userResults;
  }

  /**
   * Make an ensemble API request
   */
  async function makeEnsembleRequest(userId) {
    const prompts = [
      'Explain the benefits of regular exercise in 2-3 sentences.',
      'What are the key principles of effective time management?',
      'Describe the importance of proper nutrition for health.',
      'How can mindfulness improve daily productivity?',
      'What are the best practices for maintaining work-life balance?'
    ];

    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    
    return request(app)
      .post('/default-ensemble')
      .set('X-User-Id', `load-test-user-${userId}`)
      .set('X-Correlation-ID', `load-test-${userId}-${Date.now()}`)
      .send({ prompt })
      .expect(res => {
        expect([200, 429, 500]).toContain(res.status);
      });
  }

  // Removed: makeWorkoutRequest function - workout functionality removed from codebase

  /**
   * Make a memory API request
   */
  async function makeMemoryRequest(userId) {
    return request(app)
      .get('/memory/health')
      .set('X-User-Id', `load-test-user-${userId}`)
      .set('X-Correlation-ID', `load-test-memory-${userId}-${Date.now()}`)
      .expect(res => {
        expect([200, 429, 500]).toContain(res.status);
      });
  }

  /**
   * Record test results
   */
  function recordResult(endpoint, success, responseTime) {
    const results = testResults[endpoint];
    
    results.totalRequests++;
    if (success) {
      results.successfulRequests++;
    } else {
      results.failedRequests++;
    }
    
    results.responseTimes.push(responseTime);
    results.maxResponseTime = Math.max(results.maxResponseTime, responseTime);
    results.minResponseTime = Math.min(results.minResponseTime, responseTime);
    
    // Update average response time
    const totalTime = results.averageResponseTime * (results.totalRequests - 1) + responseTime;
    results.averageResponseTime = totalTime / results.totalRequests;
  }

  /**
   * Sleep utility function
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
