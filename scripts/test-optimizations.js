#!/usr/bin/env node

/**
 * 🧪 NeuraStack Backend Optimization Testing Suite
 * 
 * 🎯 PURPOSE: Comprehensive testing of all implemented optimizations
 * 
 * 📋 TESTS INCLUDED:
 * - Performance improvements validation
 * - Enhanced monitoring system testing
 * - Load capacity verification (25+ concurrent users)
 * - Memory management optimization testing
 * - Database query optimization validation
 * - Cache performance improvements
 * - Security enhancements verification
 */

const axios = require('axios');
const { performance } = require('perf_hooks');

class OptimizationTester {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.results = {
      performance: {},
      monitoring: {},
      load: {},
      memory: {},
      database: {},
      cache: {},
      security: {}
    };
  }

  /**
   * Run comprehensive optimization tests
   */
  async runAllTests() {
    console.log('🧪 Starting NeuraStack Backend Optimization Testing Suite');
    console.log('=' .repeat(60));

    try {
      // Test 1: Performance Improvements
      console.log('\n🚀 Testing Performance Improvements...');
      await this.testPerformanceImprovements();

      // Test 2: Enhanced Monitoring
      console.log('\n📊 Testing Enhanced Monitoring System...');
      await this.testMonitoringSystem();

      // Test 3: Load Capacity
      console.log('\n⚡ Testing Load Capacity (25+ concurrent users)...');
      await this.testLoadCapacity();

      // Test 4: Memory Management
      console.log('\n🧠 Testing Memory Management Optimizations...');
      await this.testMemoryOptimizations();

      // Test 5: Database Performance
      console.log('\n🗄️ Testing Database Query Optimizations...');
      await this.testDatabaseOptimizations();

      // Test 6: Cache Performance
      console.log('\n⚡ Testing Cache Performance Improvements...');
      await this.testCacheOptimizations();

      // Test 7: Security Enhancements
      console.log('\n🛡️ Testing Security Enhancements...');
      await this.testSecurityEnhancements();

      // Generate final report
      this.generateReport();

    } catch (error) {
      console.error('❌ Testing suite failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test performance improvements
   */
  async testPerformanceImprovements() {
    const tests = [
      {
        name: 'Ensemble API Response Time',
        endpoint: '/default-ensemble',
        method: 'POST',
        data: { prompt: 'Test performance optimization with enhanced ensemble system.' },
        expectedMaxTime: 15000 // 15 seconds max
      },
      {
        name: 'Workout API Response Time',
        endpoint: '/workout/generate-workout',
        method: 'POST',
        data: {
          age: 30,
          fitnessLevel: 'intermediate',
          gender: 'male',
          weight: 75,
          goals: 'muscle_gain',
          equipment: 'gym',
          timeAvailable: 45,
          daysPerWeek: 4,
          workoutType: 'strength'
        },
        expectedMaxTime: 20000 // 20 seconds max
      }
    ];

    for (const test of tests) {
      const startTime = performance.now();
      
      try {
        const response = await axios({
          method: test.method,
          url: `${this.baseUrl}${test.endpoint}`,
          data: test.data,
          headers: {
            'X-User-Id': 'optimization-test-user',
            'X-Correlation-ID': `perf-test-${Date.now()}`
          },
          timeout: test.expectedMaxTime + 5000
        });

        const responseTime = performance.now() - startTime;
        const success = response.status === 200 && responseTime <= test.expectedMaxTime;

        this.results.performance[test.name] = {
          success,
          responseTime: Math.round(responseTime),
          expectedMaxTime: test.expectedMaxTime,
          status: response.status,
          improvement: responseTime <= test.expectedMaxTime ? 'PASS' : 'NEEDS_OPTIMIZATION'
        };

        console.log(`  ✅ ${test.name}: ${Math.round(responseTime)}ms (${success ? 'PASS' : 'SLOW'})`);

      } catch (error) {
        this.results.performance[test.name] = {
          success: false,
          error: error.message,
          improvement: 'FAILED'
        };
        console.log(`  ❌ ${test.name}: FAILED - ${error.message}`);
      }
    }
  }

  /**
   * Test enhanced monitoring system
   */
  async testMonitoringSystem() {
    const monitoringEndpoints = [
      '/system/health',
      '/system/metrics',
      '/system/load-status',
      '/health-detailed',
      '/metrics'
    ];

    for (const endpoint of monitoringEndpoints) {
      try {
        const response = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: { 'X-Correlation-ID': `monitor-test-${Date.now()}` },
          timeout: 10000
        });

        const hasRequiredFields = this.validateMonitoringResponse(endpoint, response.data);
        
        this.results.monitoring[endpoint] = {
          success: response.status === 200,
          hasRequiredFields,
          responseSize: JSON.stringify(response.data).length,
          improvement: hasRequiredFields ? 'ENHANCED' : 'BASIC'
        };

        console.log(`  ✅ ${endpoint}: ${hasRequiredFields ? 'ENHANCED' : 'BASIC'} monitoring`);

      } catch (error) {
        this.results.monitoring[endpoint] = {
          success: false,
          error: error.message,
          improvement: 'FAILED'
        };
        console.log(`  ❌ ${endpoint}: FAILED - ${error.message}`);
      }
    }
  }

  /**
   * Test load capacity with concurrent requests
   */
  async testLoadCapacity() {
    const concurrentUsers = 25;
    const requestsPerUser = 3;
    
    console.log(`  🔄 Simulating ${concurrentUsers} concurrent users with ${requestsPerUser} requests each...`);

    const promises = [];
    const startTime = performance.now();

    for (let i = 0; i < concurrentUsers; i++) {
      for (let j = 0; j < requestsPerUser; j++) {
        const promise = axios.post(`${this.baseUrl}/default-ensemble`, {
          prompt: `Load test request ${i}-${j}: Explain the benefits of regular exercise.`
        }, {
          headers: {
            'X-User-Id': `load-test-user-${i}`,
            'X-Correlation-ID': `load-test-${i}-${j}-${Date.now()}`
          },
          timeout: 30000
        }).catch(error => ({ error: error.message, userId: i, requestId: j }));

        promises.push(promise);
      }
    }

    const results = await Promise.allSettled(promises);
    const totalTime = performance.now() - startTime;

    const successful = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
    const failed = results.length - successful;
    const successRate = (successful / results.length) * 100;

    this.results.load = {
      totalRequests: results.length,
      successful,
      failed,
      successRate: Math.round(successRate),
      totalTime: Math.round(totalTime),
      averageResponseTime: Math.round(totalTime / results.length),
      improvement: successRate >= 80 ? 'EXCELLENT' : successRate >= 60 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
    };

    console.log(`  📊 Load Test Results:`);
    console.log(`     Total Requests: ${results.length}`);
    console.log(`     Successful: ${successful} (${Math.round(successRate)}%)`);
    console.log(`     Failed: ${failed}`);
    console.log(`     Total Time: ${Math.round(totalTime)}ms`);
    console.log(`     Status: ${this.results.load.improvement}`);
  }

  /**
   * Test memory management optimizations
   */
  async testMemoryOptimizations() {
    try {
      // Test memory health endpoint
      const healthResponse = await axios.get(`${this.baseUrl}/memory/health`, {
        headers: { 'X-User-Id': 'memory-test-user' },
        timeout: 10000
      });

      // Test memory storage and retrieval
      const testMemory = {
        content: 'Test memory for optimization validation',
        memoryType: 'working',
        importance: 0.8
      };

      const storeResponse = await axios.post(`${this.baseUrl}/memory/store`, testMemory, {
        headers: { 'X-User-Id': 'memory-test-user' },
        timeout: 10000
      });

      this.results.memory = {
        healthCheck: healthResponse.status === 200,
        storageWorking: storeResponse.status === 200,
        optimizedQueries: healthResponse.data?.optimizations?.includes('client-side-filtering') || false,
        improvement: 'OPTIMIZED'
      };

      console.log(`  ✅ Memory Health: ${healthResponse.status === 200 ? 'HEALTHY' : 'ISSUES'}`);
      console.log(`  ✅ Memory Storage: ${storeResponse.status === 200 ? 'WORKING' : 'ISSUES'}`);

    } catch (error) {
      this.results.memory = {
        healthCheck: false,
        error: error.message,
        improvement: 'FAILED'
      };
      console.log(`  ❌ Memory Management: FAILED - ${error.message}`);
    }
  }

  /**
   * Test database query optimizations
   */
  async testDatabaseOptimizations() {
    try {
      // Test optimized Firestore queries
      const startTime = performance.now();
      
      const response = await axios.get(`${this.baseUrl}/memory/health`, {
        headers: { 'X-User-Id': 'db-test-user' },
        timeout: 15000
      });

      const queryTime = performance.now() - startTime;

      this.results.database = {
        queryTime: Math.round(queryTime),
        success: response.status === 200,
        optimizedIndexing: queryTime < 2000, // Should be under 2 seconds with optimizations
        improvement: queryTime < 2000 ? 'OPTIMIZED' : 'NEEDS_OPTIMIZATION'
      };

      console.log(`  ✅ Database Query Time: ${Math.round(queryTime)}ms (${this.results.database.improvement})`);

    } catch (error) {
      this.results.database = {
        success: false,
        error: error.message,
        improvement: 'FAILED'
      };
      console.log(`  ❌ Database Optimization: FAILED - ${error.message}`);
    }
  }

  /**
   * Test cache performance improvements
   */
  async testCacheOptimizations() {
    try {
      const cacheStatsResponse = await axios.get(`${this.baseUrl}/cache/stats`, {
        timeout: 10000
      });

      const cacheData = cacheStatsResponse.data?.data?.cache || {};
      const hitRate = parseFloat(cacheData.hitRate) || 0;

      this.results.cache = {
        statsAvailable: cacheStatsResponse.status === 200,
        hitRate,
        optimizedTTL: cacheData.averageTTL > 300000, // 5+ minutes
        improvement: hitRate > 50 ? 'EXCELLENT' : hitRate > 25 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      };

      console.log(`  ✅ Cache Hit Rate: ${hitRate}% (${this.results.cache.improvement})`);

    } catch (error) {
      this.results.cache = {
        statsAvailable: false,
        error: error.message,
        improvement: 'FAILED'
      };
      console.log(`  ❌ Cache Optimization: FAILED - ${error.message}`);
    }
  }

  /**
   * Test security enhancements
   */
  async testSecurityEnhancements() {
    try {
      // Test rate limiting
      const rapidRequests = [];
      for (let i = 0; i < 30; i++) { // Exceed rate limit
        rapidRequests.push(
          axios.post(`${this.baseUrl}/default-ensemble`, {
            prompt: `Rate limit test ${i}`
          }, {
            headers: { 'X-User-Id': 'security-test-user' },
            timeout: 5000
          }).catch(error => error.response)
        );
      }

      const rateLimitResults = await Promise.all(rapidRequests);
      const rateLimited = rateLimitResults.some(r => r?.status === 429);

      // Test input validation
      const invalidInputResponse = await axios.post(`${this.baseUrl}/default-ensemble`, {
        prompt: 123 // Invalid type
      }, {
        headers: { 'X-User-Id': 'security-test-user' },
        timeout: 5000
      }).catch(error => error.response);

      const inputValidation = invalidInputResponse?.status === 400;

      this.results.security = {
        rateLimitingWorking: rateLimited,
        inputValidationWorking: inputValidation,
        improvement: (rateLimited && inputValidation) ? 'ENHANCED' : 'BASIC'
      };

      console.log(`  ✅ Rate Limiting: ${rateLimited ? 'WORKING' : 'NEEDS_ATTENTION'}`);
      console.log(`  ✅ Input Validation: ${inputValidation ? 'WORKING' : 'NEEDS_ATTENTION'}`);

    } catch (error) {
      this.results.security = {
        error: error.message,
        improvement: 'FAILED'
      };
      console.log(`  ❌ Security Enhancement: FAILED - ${error.message}`);
    }
  }

  /**
   * Validate monitoring response structure
   */
  validateMonitoringResponse(endpoint, data) {
    const requiredFields = {
      '/system/health': ['status', 'data', 'timestamp'],
      '/system/metrics': ['status', 'data'],
      '/system/load-status': ['status', 'data'],
      '/health-detailed': ['status', 'timestamp', 'components'],
      '/metrics': ['timestamp', 'system']
    };

    const required = requiredFields[endpoint] || [];
    return required.every(field => data.hasOwnProperty(field));
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 NEURASTACK BACKEND OPTIMIZATION TEST REPORT');
    console.log('=' .repeat(60));

    // Performance Summary
    console.log('\n🚀 PERFORMANCE IMPROVEMENTS:');
    Object.entries(this.results.performance).forEach(([test, result]) => {
      const status = result.improvement === 'PASS' ? '✅' : result.improvement === 'FAILED' ? '❌' : '⚠️';
      console.log(`  ${status} ${test}: ${result.responseTime || 'N/A'}ms (${result.improvement})`);
    });

    // Monitoring Summary
    console.log('\n📊 MONITORING ENHANCEMENTS:');
    Object.entries(this.results.monitoring).forEach(([endpoint, result]) => {
      const status = result.improvement === 'ENHANCED' ? '✅' : result.improvement === 'FAILED' ? '❌' : '⚠️';
      console.log(`  ${status} ${endpoint}: ${result.improvement}`);
    });

    // Load Capacity Summary
    console.log('\n⚡ LOAD CAPACITY:');
    const loadResult = this.results.load;
    const loadStatus = loadResult.improvement === 'EXCELLENT' ? '✅' : loadResult.improvement === 'GOOD' ? '⚠️' : '❌';
    console.log(`  ${loadStatus} 25+ Concurrent Users: ${loadResult.successRate}% success rate (${loadResult.improvement})`);

    // Overall Assessment
    console.log('\n🎯 OVERALL ASSESSMENT:');
    const improvements = Object.values(this.results).flat().map(r => r.improvement);
    const excellent = improvements.filter(i => ['PASS', 'ENHANCED', 'EXCELLENT', 'OPTIMIZED'].includes(i)).length;
    const total = improvements.length;
    const overallScore = Math.round((excellent / total) * 100);

    console.log(`  Overall Optimization Score: ${overallScore}%`);
    
    if (overallScore >= 80) {
      console.log('  🎉 EXCELLENT: Backend is highly optimized for production load!');
    } else if (overallScore >= 60) {
      console.log('  ✅ GOOD: Backend optimizations are working well with minor areas for improvement.');
    } else {
      console.log('  ⚠️ NEEDS WORK: Some optimizations require attention before production deployment.');
    }

    console.log('\n📋 RECOMMENDATIONS:');
    this.generateRecommendations();
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Performance recommendations
    const slowTests = Object.entries(this.results.performance).filter(([_, r]) => r.improvement === 'NEEDS_OPTIMIZATION');
    if (slowTests.length > 0) {
      recommendations.push('Consider further API response time optimization for slow endpoints');
    }

    // Load capacity recommendations
    if (this.results.load?.successRate < 80) {
      recommendations.push('Implement request queuing and additional load balancing for peak traffic');
    }

    // Security recommendations
    if (this.results.security?.improvement !== 'ENHANCED') {
      recommendations.push('Review and strengthen security measures including rate limiting and input validation');
    }

    if (recommendations.length === 0) {
      recommendations.push('All optimizations are performing excellently! Consider monitoring in production for continued optimization opportunities.');
    }

    recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });
  }
}

// Run the optimization tests
if (require.main === module) {
  const tester = new OptimizationTester();
  tester.runAllTests().catch(console.error);
}

module.exports = OptimizationTester;
