const { models, systemPrompts } = require('../config/ensemblePrompts');
const clients = require('./vendorClients');
const MemoryManager = require('./memoryManager');

const TIMEOUT_MS = 12_000; // 12 seconds hard timeout to avoid hanging

// Lazy initialization of memory manager
let memoryManager = null;

function getMemoryManager() {
  if (!memoryManager) {
    memoryManager = new MemoryManager();
  }
  return memoryManager;
}

/**
 * Call a specific AI role with the given user prompt
 * @param {string} role - The role to call (evidence_analyst, innovator, risk_reviewer)
 * @param {string} userPrompt - The user's input prompt
 * @returns {Promise<string>} The AI response content
 */
async function callRole(role, userPrompt) {
  const { provider, model } = models[role];

  try {
    switch (provider) {
      case 'openai':
        const openaiResponse = await clients.openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompts[role] },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 250, // Increased for 200 word limit
          temperature: 0.7
        });
        return openaiResponse.choices[0].message.content;

      case 'xai':
        const xaiResponse = await clients.xai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompts[role] },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 350, // Increased for reasoning models
          temperature: 0.7
        });
        // Handle Grok reasoning models that may have empty content but reasoning_content
        const content = xaiResponse.choices[0].message.content ||
                        xaiResponse.choices[0].message.reasoning_content ||
                        'No response generated';
        return content;

      case 'gemini':
        const geminiResponse = await clients.gemini.post(
          `/models/${model}:generateContent`,
          {
            contents: [{
              parts: [{
                text: `${systemPrompts[role]}\n\nUser: ${userPrompt}`
              }]
            }],
            generationConfig: {
              maxOutputTokens: 250,
              temperature: 0.7
            }
          }
        );
        return geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';

      case 'claude':
        const claudeResponse = await clients.claude.post('/messages', {
          model,
          max_tokens: 250,
          messages: [
            { role: 'user', content: `${systemPrompts[role]}\n\nUser: ${userPrompt}` }
          ]
        });
        return claudeResponse.data.content[0].text;

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (error) {
    console.error(`Error calling ${role} (${provider}):`, error.message);
    throw error;
  }
}

/**
 * Run the complete ensemble process with memory integration
 * @param {string} userPrompt - The user's input prompt
 * @param {string} userId - The user identifier for tracking
 * @param {string} sessionId - The session identifier for memory context
 * @returns {Promise<Object>} The complete ensemble response with memory integration
 */
exports.runEnsemble = async (userPrompt, userId = 'anonymous', sessionId = null) => {
  const startTime = Date.now();
  console.log(`Starting ensemble for user ${userId} with prompt: "${userPrompt.substring(0, 100)}..."`);

  // Generate session ID if not provided
  if (!sessionId) {
    sessionId = `session_${userId}_${Date.now()}`;
  }

  try {

  // Step 1: Get memory context for enhanced prompts
  let memoryContext = '';
  try {
    memoryContext = await getMemoryManager().getMemoryContext(userId, sessionId, 1500); // Reserve tokens for response
    if (memoryContext) {
      console.log(`📚 Retrieved memory context: ${memoryContext.length} characters`);
    }
  } catch (error) {
    console.warn('⚠️ Failed to retrieve memory context:', error.message);
  }

  // Step 2: Enhance user prompt with memory context
  const enhancedPrompt = memoryContext ?
    `Context from previous conversations:\n${memoryContext}\n\nCurrent request: ${userPrompt}` :
    userPrompt;

  // Step 3: Call all three AI models in parallel with timeout protection
  const roleCalls = ['gpt4o', 'gemini', 'claude'].map(role =>
    Promise.race([
      callRole(role, enhancedPrompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      )
    ])
    .then(content => ({ role, content, status: 'fulfilled' }))
    .catch(error => ({
      role,
      content: `**Error**: ${error.message}`,
      status: 'rejected'
    }))
  );

  const roleOutputs = await Promise.all(roleCalls);

  // Log individual role results for debugging
  roleOutputs.forEach(output => {
    console.log(`${output.role} (${output.status}):`, output.content.substring(0, 100) + '...');
  });

  // Step 4: Prepare synthesis payload with user prompt and AI responses
  const modelNames = {
    gpt4o: 'GPT-4o',
    gemini: 'Gemini 2.0 Flash',
    claude: 'Claude Opus'
  };

  const synthPayload = `User Question: "${userPrompt}"

AI Responses:

${roleOutputs
    .map(output => `### ${modelNames[output.role] || output.role}\n${output.content}`)
    .join('\n\n')}`;

  // Step 5: Synthesize final response
  let finalResult = '';
  let synthesisStatus = 'failed';

  try {
    console.log('Starting synthesis...');
    const synthResponse = await clients.openai.chat.completions.create({
      model: models.synthesizer.model,
      messages: [
        { role: 'system', content: systemPrompts.synthesizer },
        { role: 'user', content: synthPayload }
      ],
      max_tokens: 400,
      temperature: 0.6
    });

    finalResult = synthResponse.choices[0].message.content;
    synthesisStatus = 'success';
    console.log('Ensemble completed successfully');
  } catch (synthError) {
    console.error('❌ Synthesis failed:', synthError.message);
    finalResult = 'Synthesis failed, but individual role responses are available.';
    synthesisStatus = 'failed';
  }

  // Step 6: Calculate response quality for memory storage
  const processingTime = Date.now() - startTime;
  const successfulRoles = roleOutputs.filter(r => r.status === 'fulfilled').length;
  const responseQuality = calculateResponseQuality(finalResult, processingTime, roleOutputs.length - successfulRoles, true);

  // Step 7: Store memories asynchronously (don't block response)
  setImmediate(async () => {
    try {
      // Store user prompt
      await getMemoryManager().storeMemory(
        userId,
        sessionId,
        userPrompt,
        true, // isUserPrompt
        responseQuality,
        'ensemble',
        true // ensembleMode
      );

      // Store synthesis result
      await getMemoryManager().storeMemory(
        userId,
        sessionId,
        finalResult,
        false, // isUserPrompt
        responseQuality,
        models.synthesizer.model,
        true // ensembleMode
      );

      console.log(`💾 Memories stored for user ${userId}, session ${sessionId}`);
    } catch (memoryError) {
      console.error('❌ Failed to store memories:', memoryError.message);
    }
  });

  // Return comprehensive response with all details
  return {
    synthesis: {
      content: finalResult,
      model: models.synthesizer.model,
      provider: models.synthesizer.provider,
      status: synthesisStatus
    },
    roles: roleOutputs.map(output => ({
      role: output.role,
      content: output.content,
      model: models[output.role].model,
      provider: models[output.role].provider,
      status: output.status,
      wordCount: output.content.split(' ').length
    })),
    metadata: {
      totalRoles: roleOutputs.length,
      successfulRoles,
      failedRoles: roleOutputs.length - successfulRoles,
      synthesisStatus,
      processingTimeMs: processingTime,
      sessionId,
      memoryContextUsed: !!memoryContext,
      responseQuality
    }
  };
  } catch (error) {
    console.error('❌ Ensemble failed:', error.message);
    return {
      synthesis: {
        content: 'Ensemble processing failed.',
        model: models.synthesizer.model,
        provider: models.synthesizer.provider,
        status: 'failed'
      },
      roles: [],
      metadata: {
        totalRoles: 0,
        successfulRoles: 0,
        failedRoles: 0,
        synthesisStatus: 'failed',
        processingTimeMs: Date.now() - startTime,
        sessionId,
        memoryContextUsed: false,
        responseQuality: 0,
        error: error.message
      }
    };
  }
};

/**
 * Calculate response quality score for memory storage
 * @param {string} result - The generated response
 * @param {number} executionTime - Processing time in milliseconds
 * @param {number} errorCount - Number of failed role calls
 * @param {boolean} ensembleMode - Whether ensemble mode was used
 * @returns {number} Quality score between 0 and 1
 */
function calculateResponseQuality(result, executionTime, errorCount, ensembleMode) {
  let quality = 0.5; // Base quality

  // Time factor (faster is better, up to a point)
  if (executionTime < 5000) quality += 0.2;
  else if (executionTime < 10000) quality += 0.1;
  else if (executionTime > 20000) quality -= 0.1;

  // Error factor
  if (errorCount === 0) quality += 0.2;
  else quality -= (errorCount * 0.1);

  // Ensemble mode bonus
  if (ensembleMode) quality += 0.1;

  // Content length factor (reasonable length is good)
  if (result && result.length > 50 && result.length < 2000) {
    quality += 0.1;
  }

  return Math.max(0, Math.min(1, quality));
}
