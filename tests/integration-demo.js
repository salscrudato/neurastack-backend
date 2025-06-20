#!/usr/bin/env node

/**
 * Integration Demo Script
 * 
 * This script demonstrates the Neurastack Backend API functionality,
 * including the x-user-id header support in the ensemble endpoint.
 * 
 * Usage: node tests/integration-demo.js
 * 
 * Make sure the server is running on localhost:8080 before running this script.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8080';

async function testHealthEndpoint() {
  console.log('🔍 Testing Health Endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', response.data);
  } catch (error) {
    console.error('❌ Health Check Failed:', error.message);
  }
  console.log('');
}

async function testEnsembleWithUserID() {
  console.log('🤖 Testing Ensemble with User ID...');
  try {
    const response = await axios.post(`${BASE_URL}/default-ensemble`, {
      prompt: 'What are the key considerations for implementing AI in healthcare?'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'demo-user-12345'
      },
      timeout: 30000 // 30 second timeout
    });

    console.log('✅ Ensemble Response:');
    console.log('📝 Prompt:', response.data.data.prompt);
    console.log('👤 User ID:', response.data.data.userId);
    console.log('🎯 Synthesis:', response.data.data.synthesis.content.substring(0, 200) + '...');
    console.log('📊 Metadata:', {
      processingTime: response.data.data.metadata.processingTimeMs + 'ms',
      successfulRoles: response.data.data.metadata.successfulRoles,
      totalRoles: response.data.data.metadata.totalRoles
    });
    
    console.log('\n🔬 Individual AI Roles:');
    response.data.data.roles.forEach(role => {
      console.log(`  ${role.role} (${role.provider}/${role.model}): ${role.status}`);
      console.log(`    ${role.content.substring(0, 100)}...`);
    });

  } catch (error) {
    console.error('❌ Ensemble Test Failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
  console.log('');
}

async function testEnsembleWithoutUserID() {
  console.log('🤖 Testing Ensemble without User ID...');
  try {
    const response = await axios.post(`${BASE_URL}/default-ensemble`, {
      prompt: 'Quick test of the ensemble system'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Ensemble Response (Anonymous):');
    console.log('👤 User ID:', response.data.data.userId);
    console.log('📊 Processing Time:', response.data.data.metadata.processingTimeMs + 'ms');

  } catch (error) {
    console.error('❌ Anonymous Ensemble Test Failed:', error.message);
  }
  console.log('');
}

async function testXAIEndpoint() {
  console.log('🧠 Testing X.AI Endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/xai-test`);
    console.log('✅ X.AI Test:', response.data);
  } catch (error) {
    console.error('❌ X.AI Test Failed:', error.message);
  }
  console.log('');
}

async function runDemo() {
  console.log('🚀 Neurastack Backend Integration Demo\n');
  console.log('=' * 50);
  
  await testHealthEndpoint();
  await testXAIEndpoint();
  await testEnsembleWithUserID();
  await testEnsembleWithoutUserID();
  
  console.log('🎉 Demo completed!');
  console.log('\nNote: The ensemble tests may take 10-25 seconds to complete.');
  console.log('This is normal as the system calls multiple AI services in parallel.');
}

// Run the demo if this script is executed directly
if (require.main === module) {
  runDemo().catch(error => {
    console.error('Demo failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  testHealthEndpoint,
  testEnsembleWithUserID,
  testEnsembleWithoutUserID,
  testXAIEndpoint,
  runDemo
};
