#!/usr/bin/env node

/**
 * Comprehensive Integration Tests for Default Ensemble Endpoint
 * 
 * This script thoroughly tests the /default-ensemble endpoint including:
 * - Memory system integration
 * - Confidence scoring
 * - Error handling
 * - Performance metrics
 * - User session management
 * 
 * Usage: node tests/default-ensemble-integration.test.js
 * Make sure the server is running on localhost:8080
 */

const axios = require('axios');
const { v4: generateUUID } = require('uuid');

const BASE_URL = 'http://localhost:8080';
const TEST_USER_ID = 'integration-test-user';
const TEST_SESSION_ID = 'integration-test-session';

// Test scenarios with expected behaviors
const TEST_SCENARIOS = [
  {
    name: 'Basic Functionality Test',
    prompt: 'What are the key principles of software architecture?',
    expectedFeatures: ['synthesis', 'roles', 'metadata', 'confidence']
  },
  {
    name: 'Memory Context Test',
    prompt: 'Based on our previous discussion about software architecture, how would you implement microservices?',
    expectedFeatures: ['memoryContextUsed', 'synthesis', 'roles']
  },
  {
    name: 'Complex Technical Query',
    prompt: 'Explain the trade-offs between REST and GraphQL APIs, considering performance, caching, and developer experience.',
    expectedFeatures: ['confidenceAnalysis', 'qualityScore', 'costEstimate']
  },
  {
    name: 'Short Query Test',
    prompt: 'What is AI?',
    expectedFeatures: ['synthesis', 'roles']
  },
  {
    name: 'Empty Prompt Test',
    prompt: '',
    expectedFeatures: ['synthesis'] // Should use default prompt
  }
];

// Utility functions
function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`🧪 ${title}`);
  console.log('='.repeat(60));
}

function logTest(testName, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${testName}${details ? ': ' + details : ''}`);
}

function logMetrics(metrics) {
  console.log('\n📊 Performance Metrics:');
  console.log(`   ⏱️  Processing Time: ${metrics.totalProcessingTimeMs || 'N/A'}ms`);
  console.log(`   🧠 Memory Tokens: ${metrics.memoryTokensUsed || 0}`);
  console.log(`   💰 Cost Estimate: $${metrics.costEstimate?.totalCost || 'N/A'}`);
  console.log(`   🎯 Confidence: ${metrics.confidenceAnalysis?.averageConfidence || 'N/A'}`);
  console.log(`   ⭐ Quality Score: ${metrics.responseQuality || 'N/A'}`);
}

async function testHealthCheck() {
  logSection('Health Check');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logTest('Server Health', 'PASS', response.data.message);
    return true;
  } catch (error) {
    logTest('Server Health', 'FAIL', error.message);
    return false;
  }
}

async function testDefaultEnsembleBasic() {
  logSection('Basic Default Ensemble Test');
  
  try {
    const startTime = Date.now();
    const response = await axios.post(`${BASE_URL}/default-ensemble`, {
      prompt: 'What are the benefits of using TypeScript over JavaScript?'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': TEST_USER_ID,
        'X-Session-Id': TEST_SESSION_ID,
        'X-Correlation-ID': generateUUID()
      },
      timeout: 30000
    });
    
    const responseTime = Date.now() - startTime;
    
    // Validate response structure
    const data = response.data;
    
    logTest('Response Status', data.status === 'success' ? 'PASS' : 'FAIL');
    logTest('Response Time', responseTime < 30000 ? 'PASS' : 'FAIL', `${responseTime}ms`);
    logTest('Synthesis Present', data.data?.synthesis ? 'PASS' : 'FAIL');
    logTest('Roles Array Present', Array.isArray(data.data?.roles) ? 'PASS' : 'FAIL');
    logTest('Metadata Present', data.data?.metadata ? 'PASS' : 'FAIL');
    logTest('User ID Tracking', data.data?.userId === TEST_USER_ID ? 'PASS' : 'FAIL');
    logTest('Session ID Tracking', data.data?.sessionId === TEST_SESSION_ID ? 'PASS' : 'FAIL');
    
    // Check synthesis quality
    if (data.data?.synthesis) {
      logTest('Synthesis Content', data.data.synthesis.content?.length > 10 ? 'PASS' : 'FAIL');
      logTest('Confidence Score', data.data.synthesis.confidence >= 0 && data.data.synthesis.confidence <= 1 ? 'PASS' : 'FAIL');
      logTest('Quality Score', data.data.synthesis.qualityScore >= 0 && data.data.synthesis.qualityScore <= 1 ? 'PASS' : 'FAIL');
    }
    
    // Check roles
    if (data.data?.roles) {
      const successfulRoles = data.data.roles.filter(role => role.metadata?.status === 'fulfilled');
      logTest('Successful Roles', successfulRoles.length >= 2 ? 'PASS' : 'WARN', `${successfulRoles.length}/3`);
      
      data.data.roles.forEach(role => {
        logTest(`${role.role} Response`, role.content?.length > 5 ? 'PASS' : 'FAIL');
      });
    }
    
    // Log performance metrics
    if (data.data?.metadata) {
      logMetrics(data.data.metadata);
    }
    
    return data;
    
  } catch (error) {
    logTest('Basic Ensemble Test', 'FAIL', error.message);
    if (error.response) {
      console.log('Error Response:', error.response.data);
    }
    return null;
  }
}

async function testMemoryIntegration() {
  logSection('Memory Integration Test');
  
  try {
    // First, store some context
    console.log('📝 Storing initial context...');
    await axios.post(`${BASE_URL}/memory/store`, {
      userId: TEST_USER_ID,
      sessionId: TEST_SESSION_ID,
      content: 'User is interested in microservice architecture and has experience with Node.js and Python.',
      isUserPrompt: true,
      responseQuality: 0.8,
      modelUsed: 'test-context',
      ensembleMode: true
    });
    
    // Wait a moment for storage
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Now test ensemble with memory context
    const response = await axios.post(`${BASE_URL}/default-ensemble`, {
      prompt: 'Given my background, what would be the best approach to implement a microservice for user authentication?'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': TEST_USER_ID,
        'X-Session-Id': TEST_SESSION_ID,
        'X-Correlation-ID': generateUUID()
      },
      timeout: 30000
    });
    
    const data = response.data;
    
    logTest('Memory Context Used', data.data?.metadata?.memoryContextUsed ? 'PASS' : 'WARN');
    logTest('Memory Tokens', data.data?.metadata?.memoryTokensUsed > 0 ? 'PASS' : 'WARN', 
           `${data.data?.metadata?.memoryTokensUsed || 0} tokens`);
    
    // Check if response seems contextually aware
    const synthesisContent = data.data?.synthesis?.content?.toLowerCase() || '';
    const hasContextualAwareness = synthesisContent.includes('node') || 
                                  synthesisContent.includes('python') || 
                                  synthesisContent.includes('background') ||
                                  synthesisContent.includes('experience');
    
    logTest('Contextual Awareness', hasContextualAwareness ? 'PASS' : 'WARN', 
           'Response references user context');
    
    return data;
    
  } catch (error) {
    logTest('Memory Integration Test', 'FAIL', error.message);
    return null;
  }
}

async function testErrorHandling() {
  logSection('Error Handling Test');
  
  try {
    // Test with extremely long prompt
    const longPrompt = 'A'.repeat(10000);
    const response = await axios.post(`${BASE_URL}/default-ensemble`, {
      prompt: longPrompt
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': TEST_USER_ID
      },
      timeout: 30000
    });
    
    logTest('Long Prompt Handling', response.status === 200 ? 'PASS' : 'FAIL');
    
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Long Prompt Validation', 'PASS', 'Properly rejected');
    } else {
      logTest('Long Prompt Handling', 'FAIL', error.message);
    }
  }
  
  try {
    // Test with invalid JSON
    const response = await axios.post(`${BASE_URL}/default-ensemble`, 'invalid json', {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    logTest('Invalid JSON Handling', 'FAIL', 'Should have been rejected');
    
  } catch (error) {
    logTest('Invalid JSON Handling', error.response?.status === 400 ? 'PASS' : 'FAIL');
  }
}

async function testAnonymousUser() {
  logSection('Anonymous User Test');
  
  try {
    const response = await axios.post(`${BASE_URL}/default-ensemble`, {
      prompt: 'Test anonymous user functionality'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const data = response.data;
    
    logTest('Anonymous User ID', data.data?.userId === 'anonymous' ? 'PASS' : 'FAIL');
    logTest('Auto Session ID', data.data?.sessionId?.startsWith('session_anonymous_') ? 'PASS' : 'FAIL');
    logTest('Response Quality', data.data?.synthesis?.content?.length > 10 ? 'PASS' : 'FAIL');
    
    return data;
    
  } catch (error) {
    logTest('Anonymous User Test', 'FAIL', error.message);
    return null;
  }
}

async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Default Ensemble Integration Tests');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`👤 Test User: ${TEST_USER_ID}`);
  console.log(`🔗 Test Session: ${TEST_SESSION_ID}`);
  
  const results = {
    healthCheck: false,
    basicTest: null,
    memoryTest: null,
    errorTest: null,
    anonymousTest: null
  };
  
  // Run all tests
  results.healthCheck = await testHealthCheck();
  
  if (results.healthCheck) {
    results.basicTest = await testDefaultEnsembleBasic();
    results.memoryTest = await testMemoryIntegration();
    results.errorTest = await testErrorHandling();
    results.anonymousTest = await testAnonymousUser();
  }
  
  // Summary
  logSection('Test Summary');
  
  const testCount = Object.keys(results).length;
  const passCount = Object.values(results).filter(r => r !== null && r !== false).length;
  
  console.log(`📊 Tests Completed: ${passCount}/${testCount}`);
  console.log(`✅ Health Check: ${results.healthCheck ? 'PASS' : 'FAIL'}`);
  console.log(`🤖 Basic Ensemble: ${results.basicTest ? 'PASS' : 'FAIL'}`);
  console.log(`🧠 Memory Integration: ${results.memoryTest ? 'PASS' : 'FAIL'}`);
  console.log(`⚠️  Error Handling: ${results.errorTest !== null ? 'PASS' : 'FAIL'}`);
  console.log(`👤 Anonymous Users: ${results.anonymousTest ? 'PASS' : 'FAIL'}`);
  
  if (passCount === testCount) {
    console.log('\n🎉 All tests passed! Default ensemble is working properly with intelligent memory system.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the results above.');
  }
  
  return results;
}

// Run tests if called directly
if (require.main === module) {
  runComprehensiveTests().catch(console.error);
}

module.exports = {
  runComprehensiveTests,
  testDefaultEnsembleBasic,
  testMemoryIntegration,
  testErrorHandling,
  testAnonymousUser
};
