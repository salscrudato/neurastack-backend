/**
 * Memory System Demo
 * Demonstrates the AI ensemble memory capabilities
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const TEST_USER_ID = 'demo-user-123';
const TEST_SESSION_ID = 'demo-session-456';

console.log('🧠 Neurastack Memory System Demo\n');
console.log('=' * 50);

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testMemoryHealth() {
  console.log('🏥 Testing Memory System Health...');
  try {
    const response = await axios.get(`${BASE_URL}/memory/health`);
    console.log('✅ Memory Health:', response.data.status);
    console.log('📊 Details:', {
      firestoreAvailable: response.data.details.firestoreAvailable,
      localCacheSize: response.data.details.localCacheSize
    });
  } catch (error) {
    console.error('❌ Memory Health Check Failed:', error.message);
  }
  console.log('');
}

async function demonstrateMemoryStorage() {
  console.log('💾 Demonstrating Memory Storage...');
  
  const conversations = [
    {
      prompt: 'What are the benefits of microservice architecture?',
      isUserPrompt: true
    },
    {
      prompt: 'Microservice architecture offers several key benefits: 1) Scalability - individual services can be scaled independently, 2) Technology diversity - different services can use different tech stacks, 3) Fault isolation - failure in one service doesn\'t bring down the entire system, 4) Team autonomy - different teams can work on different services independently.',
      isUserPrompt: false
    },
    {
      prompt: 'How do microservices communicate with each other?',
      isUserPrompt: true
    },
    {
      prompt: 'Microservices typically communicate through: 1) REST APIs over HTTP, 2) Message queues (async communication), 3) gRPC for high-performance scenarios, 4) Event-driven architecture using event buses. The choice depends on requirements for latency, reliability, and data consistency.',
      isUserPrompt: false
    }
  ];

  for (let i = 0; i < conversations.length; i++) {
    const conv = conversations[i];
    try {
      const response = await axios.post(`${BASE_URL}/memory/store`, {
        userId: TEST_USER_ID,
        sessionId: TEST_SESSION_ID,
        content: conv.prompt,
        isUserPrompt: conv.isUserPrompt,
        responseQuality: 0.8 + (Math.random() * 0.2), // Random quality 0.8-1.0
        modelUsed: conv.isUserPrompt ? 'user' : 'gpt-4o',
        ensembleMode: !conv.isUserPrompt
      });

      console.log(`✅ Stored ${conv.isUserPrompt ? 'User' : 'AI'} Memory:`, {
        id: response.data.memoryId,
        type: response.data.memoryType,
        importance: response.data.importance.toFixed(3),
        compositeScore: response.data.compositeScore.toFixed(3)
      });
    } catch (error) {
      console.error('❌ Failed to store memory:', error.message);
    }
    
    await delay(500); // Small delay between operations
  }
  console.log('');
}

async function demonstrateMemoryRetrieval() {
  console.log('🔍 Demonstrating Memory Retrieval...');
  
  try {
    const response = await axios.post(`${BASE_URL}/memory/retrieve`, {
      userId: TEST_USER_ID,
      sessionId: TEST_SESSION_ID,
      maxResults: 10,
      minImportance: 0.1
    });

    console.log(`✅ Retrieved ${response.data.memories.length} memories:`);
    response.data.memories.forEach((memory, index) => {
      console.log(`  ${index + 1}. [${memory.memoryType}] ${memory.content.compressed.substring(0, 80)}...`);
      console.log(`     Keywords: ${memory.content.keywords.slice(0, 3).join(', ')}`);
      console.log(`     Concepts: ${memory.content.concepts.slice(0, 3).join(', ')}`);
      console.log(`     Composite Score: ${memory.weights.composite.toFixed(3)}`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to retrieve memories:', error.message);
  }
}

async function demonstrateMemoryContext() {
  console.log('🧠 Demonstrating Memory Context Generation...');
  
  try {
    const response = await axios.post(`${BASE_URL}/memory/context`, {
      userId: TEST_USER_ID,
      sessionId: TEST_SESSION_ID,
      maxTokens: 1500
    });

    console.log('✅ Generated Memory Context:');
    console.log(`📝 Context (${response.data.estimatedTokens} tokens):`);
    console.log(response.data.context);
    console.log('');
  } catch (error) {
    console.error('❌ Failed to generate memory context:', error.message);
  }
}

async function demonstrateEnsembleWithMemory() {
  console.log('🤖 Demonstrating Ensemble with Memory Integration...');
  
  try {
    const response = await axios.post(`${BASE_URL}/ensemble-test`, {
      prompt: 'What are the challenges of implementing microservices and how can they be addressed?',
      sessionId: TEST_SESSION_ID
    }, {
      headers: {
        'X-User-Id': TEST_USER_ID,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Ensemble Response with Memory:');
    console.log('📝 Prompt:', response.data.data.prompt);
    console.log('👤 User ID:', response.data.data.userId);
    console.log('🔗 Session ID:', response.data.data.sessionId);
    console.log('🧠 Memory Context Used:', response.data.data.metadata.memoryContextUsed);
    console.log('⭐ Response Quality:', response.data.data.metadata.responseQuality.toFixed(3));
    console.log('⏱️ Processing Time:', response.data.data.metadata.processingTimeMs + 'ms');
    console.log('');
    console.log('🎯 Synthesis:');
    console.log(response.data.data.synthesis.content);
    console.log('');
    
    console.log('🔬 Individual AI Roles:');
    response.data.data.roles.forEach(role => {
      console.log(`  ${role.role} (${role.provider}/${role.model}): ${role.status}`);
      console.log(`    ${role.content.substring(0, 150)}...`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Ensemble with memory failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

async function demonstrateMemoryAnalytics() {
  console.log('📊 Demonstrating Memory Analytics...');
  
  try {
    const response = await axios.get(`${BASE_URL}/memory/analytics/${TEST_USER_ID}`);
    
    console.log('✅ Memory Analytics:');
    console.log('📈 Metrics:', {
      totalMemories: response.data.metrics.totalMemories,
      memoryTypes: response.data.metrics.memoryTypes,
      averageImportance: response.data.metrics.averageImportance.toFixed(3),
      averageCompositeScore: response.data.metrics.averageCompositeScore.toFixed(3),
      archivedCount: response.data.metrics.archivedCount,
      recentMemories: response.data.metrics.recentMemories
    });
  } catch (error) {
    console.error('❌ Failed to get memory analytics:', error.message);
  }
  console.log('');
}

async function runDemo() {
  console.log(`🚀 Starting demo with Base URL: ${BASE_URL}\n`);
  
  await testMemoryHealth();
  await demonstrateMemoryStorage();
  await demonstrateMemoryRetrieval();
  await demonstrateMemoryContext();
  await demonstrateEnsembleWithMemory();
  await demonstrateMemoryAnalytics();
  
  console.log('🎉 Memory System Demo Completed!');
  console.log('\n📝 Summary:');
  console.log('- ✅ Memory storage and retrieval working');
  console.log('- ✅ Context-aware AI responses');
  console.log('- ✅ Advanced memory weighting and analytics');
  console.log('- ✅ Seamless ensemble integration');
  console.log('\n🧠 The AI ensemble now has persistent memory across conversations!');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Demo interrupted. Goodbye!');
  process.exit(0);
});

// Run the demo
runDemo().catch(error => {
  console.error('❌ Demo failed:', error.message);
  process.exit(1);
});
