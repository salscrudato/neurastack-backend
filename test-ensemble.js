const axios = require('axios');

async function testEnsemble() {
  console.log('🧪 Testing AI Ensemble API...');

  // Production deployment test
  const testCases = [
    {
      name: "Production Test",
      prompt: "What is 2+2?",
      sessionId: "test-production"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: ${testCase.name}`);

    try {
      const response = await axios.post('http://localhost:8080/default-ensemble', {
        prompt: testCase.prompt,
        sessionId: testCase.sessionId
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-ID': `test-${testCase.sessionId}`
        },
        timeout: 30000
      });

      console.log(`✅ ${testCase.name} - Status:`, response.status);

      // Check synthesis status
      const synthesis = response.data.data.synthesis;
      if (synthesis.status === 'failed') {
        console.log(`❌ ${testCase.name} - Synthesis failed:`, synthesis.error);
        console.log(`❌ ${testCase.name} - Content preview:`, synthesis.content.substring(0, 100) + '...');

        // Check if it's the specific error we're looking for
        if (synthesis.error === 'votingResult is not defined') {
          console.log(`🎯 ${testCase.name} - Found the votingResult error!`);
        }
      } else {
        console.log(`✅ ${testCase.name} - Synthesis succeeded`);
      }

      // Check voting result
      const voting = response.data.data.voting;
      if (voting.winner) {
        console.log(`✅ ${testCase.name} - Voting winner:`, voting.winner, `(${(voting.confidence * 100).toFixed(1)}%)`);
      } else {
        console.log(`❌ ${testCase.name} - No voting winner found`);
      }

    } catch (error) {
      console.error(`❌ ${testCase.name} - Test failed:`, error.message);
      if (error.response) {
        console.error(`❌ ${testCase.name} - Response status:`, error.response.status);
        console.error(`❌ ${testCase.name} - Response data:`, error.response.data);
      }
    }
  }
}

testEnsemble();
