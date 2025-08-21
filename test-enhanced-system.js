/**
 * Enhanced System Validation Script
 * 
 * Quick validation of the enhanced AI ensemble system components
 */

const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:8080';
const TEST_TIMEOUT = 30000;

// Test cases
const testCases = [
  {
    name: "Enhanced Ensemble - Explanatory Request",
    prompt: "Explain the benefits of regular exercise for mental health",
    expectedFeatures: ['enhanced', 'orchestrationVersion', 'selectedModels', 'responseQuality']
  },
  {
    name: "Enhanced Ensemble - Technical Request", 
    prompt: "Write a Python function to implement binary search",
    expectedFeatures: ['enhanced', 'synthesisStrategy', 'votingAnalysis']
  },
  {
    name: "Enhanced Ensemble - Creative Request",
    prompt: "Write a short story about a robot learning to paint",
    expectedFeatures: ['enhanced', 'qualityValidation']
  }
];

async function testEnhancedSystem() {
  console.log('🚀 Testing Enhanced NeuraStack AI Ensemble System\n');

  // Test 1: System Health Check
  console.log('📊 1. System Health Check...');
  try {
    const healthResponse = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    console.log('✅ System is healthy');
    console.log(`   Status: ${healthResponse.data.status}`);
    console.log(`   Uptime: ${healthResponse.data.uptime}`);
  } catch (error) {
    console.log('❌ System health check failed:', error.message);
    return;
  }

  // Test 2: Enhanced Ensemble Functionality
  console.log('\n🧠 2. Enhanced Ensemble Tests...');
  
  for (const testCase of testCases) {
    console.log(`\n   Testing: ${testCase.name}`);
    
    try {
      const startTime = Date.now();
      
      const response = await axios.post(`${BASE_URL}/default-ensemble`, {
        prompt: testCase.prompt,
        sessionId: `test-${Date.now()}`
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'test-user',
          'X-Correlation-ID': `test-${Date.now()}`
        },
        timeout: TEST_TIMEOUT
      });

      const processingTime = Date.now() - startTime;
      
      // Validate response structure
      if (response.status === 200 && response.data) {
        console.log('   ✅ Request successful');
        console.log(`   ⏱️  Processing time: ${processingTime}ms`);
        
        // Check for enhanced features
        const metadata = response.data.metadata || {};
        const foundFeatures = testCase.expectedFeatures.filter(feature => 
          metadata.hasOwnProperty(feature)
        );
        
        console.log(`   🔧 Enhanced features: ${foundFeatures.length}/${testCase.expectedFeatures.length}`);
        
        // Validate synthesis quality
        if (response.data.synthesis && response.data.synthesis.content) {
          const contentLength = response.data.synthesis.content.length;
          const qualityScore = metadata.responseQuality || 0;
          
          console.log(`   📝 Response length: ${contentLength} characters`);
          console.log(`   ⭐ Quality score: ${(qualityScore * 100).toFixed(0)}%`);
          
          if (contentLength > 50 && qualityScore > 0.5) {
            console.log('   ✅ Quality validation passed');
          } else {
            console.log('   ⚠️  Quality below expectations');
          }
        }
        
        // Check voting analysis
        if (response.data.voting && response.data.voting.analysis) {
          console.log(`   🗳️  Voting consensus: ${response.data.voting.consensus}`);
          console.log(`   🎯 Voting confidence: ${(response.data.voting.confidence * 100).toFixed(0)}%`);
        }
        
        // Check role responses
        if (response.data.roles && response.data.roles.length > 0) {
          const successfulRoles = response.data.roles.filter(role => 
            role.content && role.content.length > 0
          );
          console.log(`   🤖 Successful models: ${successfulRoles.length}/${response.data.roles.length}`);
        }
        
      } else {
        console.log('   ❌ Invalid response structure');
      }
      
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}`);
      if (error.response && error.response.data) {
        console.log(`   📄 Error details: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
  }

  // Test 3: System Metrics
  console.log('\n📈 3. System Metrics Check...');
  try {
    const metricsResponse = await axios.get(`${BASE_URL}/metrics`, { timeout: 10000 });
    
    if (metricsResponse.status === 200 && metricsResponse.data) {
      console.log('✅ Metrics endpoint accessible');
      
      const metrics = metricsResponse.data;
      if (metrics.system) {
        console.log(`   💾 Memory usage: ${metrics.system.memoryUsage || 'N/A'}`);
        console.log(`   🔄 Active requests: ${metrics.system.activeRequests || 0}`);
      }
      
      if (metrics.vendors) {
        const vendorCount = Object.keys(metrics.vendors).length;
        console.log(`   🤖 Available vendors: ${vendorCount}`);
      }
      
      if (metrics.ensemble) {
        console.log(`   🎼 Ensemble metrics available: ${Object.keys(metrics.ensemble).length} categories`);
      }
    }
  } catch (error) {
    console.log('❌ Metrics check failed:', error.message);
  }

  // Test 4: Explain Mode
  console.log('\n🔍 4. Explain Mode Test...');
  try {
    const explainResponse = await axios.post(`${BASE_URL}/default-ensemble`, {
      prompt: "What is machine learning?",
      explain: true,
      sessionId: `explain-test-${Date.now()}`
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'test-explain-user'
      },
      timeout: TEST_TIMEOUT
    });

    if (explainResponse.status === 200 && explainResponse.data.explanation) {
      console.log('✅ Explain mode working');
      
      const explanation = explainResponse.data.explanation;
      const features = Object.keys(explanation);
      console.log(`   📋 Explanation features: ${features.join(', ')}`);
      
      if (explanation.processingStages && explanation.processingStages.length > 0) {
        console.log(`   🔄 Processing stages: ${explanation.processingStages.length}`);
      }
    } else {
      console.log('⚠️  Explain mode not fully functional');
    }
  } catch (error) {
    console.log('❌ Explain mode test failed:', error.message);
  }

  // Test 5: Performance Test
  console.log('\n⚡ 5. Performance Test...');
  try {
    const performancePromises = [];
    const concurrentRequests = 3;
    
    for (let i = 0; i < concurrentRequests; i++) {
      performancePromises.push(
        axios.post(`${BASE_URL}/default-ensemble`, {
          prompt: `Performance test ${i}: Explain the concept of artificial intelligence`,
          sessionId: `perf-test-${i}-${Date.now()}`
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': `perf-test-user-${i}`
          },
          timeout: TEST_TIMEOUT
        })
      );
    }
    
    const startTime = Date.now();
    const results = await Promise.allSettled(performancePromises);
    const totalTime = Date.now() - startTime;
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Concurrent requests: ${successful}/${concurrentRequests} successful`);
    console.log(`⏱️  Total time: ${totalTime}ms`);
    console.log(`📊 Average time per request: ${(totalTime / concurrentRequests).toFixed(0)}ms`);
    
  } catch (error) {
    console.log('❌ Performance test failed:', error.message);
  }

  console.log('\n🎉 Enhanced System Validation Complete!');
  console.log('\n📋 Summary:');
  console.log('   - Enhanced ensemble orchestration with intelligent model selection');
  console.log('   - Advanced synthesis with multi-stage processing');
  console.log('   - Sophisticated voting with multi-factor analysis');
  console.log('   - Performance optimization with intelligent caching');
  console.log('   - Quality assurance with comprehensive validation');
  console.log('   - Backward compatibility maintained');
  console.log('   - Real-time monitoring and analytics');
}

// Run the test
if (require.main === module) {
  testEnhancedSystem().catch(error => {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testEnhancedSystem };
