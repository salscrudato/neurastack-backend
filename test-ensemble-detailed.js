const axios = require('axios');

async function testEnsembleDetailed() {
  console.log('🧪 Testing AI Ensemble API - Detailed Analysis...\n');

  const testCases = [
    {
      name: "Simple Math Test",
      prompt: "What is 2+2? Please explain your reasoning.",
      sessionId: "test-math"
    },
    {
      name: "Creative Writing Test", 
      prompt: "Write a short story about a robot learning to paint.",
      sessionId: "test-creative"
    },
    {
      name: "Technical Explanation Test",
      prompt: "Explain how machine learning works in simple terms.",
      sessionId: "test-technical"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`);
    console.log(`📝 Prompt: ${testCase.prompt}`);

    try {
      const startTime = Date.now();
      const response = await axios.post('https://neurastack-backend-638289111765.us-central1.run.app/default-ensemble', {
        prompt: testCase.prompt,
        sessionId: testCase.sessionId
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': `test-${testCase.sessionId}`,
          'X-User-Id': 'test-user'
        },
        timeout: 60000
      });

      const responseTime = Date.now() - startTime;
      console.log(`✅ ${testCase.name} - Status: ${response.status} (${responseTime}ms)`);

      const data = response.data.data;
      
      // Check synthesis
      const synthesis = data.synthesis;
      console.log(`📊 Synthesis Status: ${synthesis.status || 'success'}`);
      console.log(`📊 Synthesis Confidence: ${(synthesis.confidence?.score * 100 || 0).toFixed(1)}%`);
      console.log(`📊 Synthesis Length: ${synthesis.content?.length || 0} characters`);

      // Check individual AI responses
      console.log(`\n🤖 Individual AI Responses:`);
      const roles = data.roles || [];
      
      let successfulResponses = 0;
      let failedResponses = 0;
      
      roles.forEach((role, index) => {
        const status = role.status === 'fulfilled' ? '✅' : '❌';
        const confidence = role.confidence?.score ? `${(role.confidence.score * 100).toFixed(1)}%` : 'N/A';
        const responseTime = role.responseTime || role.metadata?.processingTime || 0;
        const wordCount = role.wordCount || 0;
        const provider = role.provider || 'unknown';
        const model = role.model || 'unknown';
        
        console.log(`   ${status} ${role.role} (${provider}/${model}): ${wordCount} words, ${confidence} confidence, ${responseTime}ms`);
        
        if (role.status === 'fulfilled') {
          successfulResponses++;
          // Show first 100 characters of response
          const preview = role.content?.substring(0, 100) || 'No content';
          console.log(`      Preview: "${preview}${role.content?.length > 100 ? '...' : ''}"`);
        } else {
          failedResponses++;
          console.log(`      Error: ${role.error || 'Unknown error'}`);
        }
      });

      // Check voting results
      const voting = data.voting;
      if (voting) {
        console.log(`\n🗳️  Voting Results:`);
        console.log(`   Winner: ${voting.winner} (${(voting.confidence * 100).toFixed(1)}% confidence)`);
        console.log(`   Consensus: ${voting.consensus}`);
        
        if (voting.weights) {
          console.log(`   Weights:`);
          Object.entries(voting.weights).forEach(([model, weight]) => {
            console.log(`     ${model}: ${(weight * 100).toFixed(1)}%`);
          });
        }
      }

      // Summary
      console.log(`\n📈 Summary for ${testCase.name}:`);
      console.log(`   ✅ Successful responses: ${successfulResponses}/3`);
      console.log(`   ❌ Failed responses: ${failedResponses}/3`);
      console.log(`   🎯 Success rate: ${((successfulResponses / 3) * 100).toFixed(1)}%`);
      console.log(`   ⏱️  Total response time: ${responseTime}ms`);

      // Check for specific issues
      if (successfulResponses < 3) {
        console.log(`\n⚠️  WARNING: Not all AI providers responded successfully!`);
        console.log(`   Expected: 3 responses (GPT-4o, Claude, Gemini)`);
        console.log(`   Actual: ${successfulResponses} successful responses`);
      }

      if (failedResponses > 0) {
        console.log(`\n🔍 Investigating failed responses...`);
        roles.filter(r => r.status !== 'fulfilled').forEach(role => {
          console.log(`   ❌ ${role.role}: ${role.error}`);
        });
      }

    } catch (error) {
      console.error(`❌ ${testCase.name} - Request failed:`, error.message);
      
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
    }

    console.log('\n' + '='.repeat(80));
  }

  console.log('\n🏁 Ensemble testing completed!');
}

// Run the test
testEnsembleDetailed().catch(console.error);
