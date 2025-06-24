// ===== AI Ensemble — Cost-Optimized Multi-Tier Approach =====

// Determine tier based on environment or user settings
const TIER = process.env.NEURASTACK_TIER || 'free'; // 'free', 'premium'

// Cost-optimized models for different tiers
const MODEL_CONFIGS = {
  free: {
    gpt4o: { provider: 'openai', model: 'gpt-4o-mini' },
    gemini: { provider: 'gemini', model: 'gemini-2.0-flash' },
    claude: { provider: 'claude', model: 'claude-3-5-haiku-latest' },
    synthesizer: { provider: 'openai', model: 'gpt-4o' } // Upgraded from gpt-4o-mini for better synthesis
  },
  premium: {
    gpt4o: { provider: 'openai', model: 'gpt-4o' },
    gemini: { provider: 'gemini', model: 'gemini-2.0-flash' },
    claude: { provider: 'claude', model: 'claude-3-5-haiku-latest' },
    synthesizer: { provider: 'openai', model: 'o1-preview' } // Upgraded to OpenAI's best reasoning model
  }
};

// Tier-specific configurations
const TIER_CONFIGS = {
  free: {
    sharedWordLimit: 600,        // Increased from 100 to allow comprehensive responses
    maxTokensPerRole: 1000,       // Increased from 150 to prevent truncation
    maxSynthesisTokens: 1200,     // Increased from 200 for better synthesis
    maxCharactersPerRole: 2500,  // Character limit for individual AI responses (free tier)
    timeoutMs: 50000,            // Increased from 10000 to prevent OpenAI timeouts
    requestsPerHour: 10,
    requestsPerDay: 50,
    maxPromptLength: 1500
  },
  premium: {
    sharedWordLimit: 600,        // Increased from 200 for even better responses
    maxTokensPerRole: 800,       // Increased from 250 for comprehensive answers
    maxSynthesisTokens: 1000,    // Increased from 400 for detailed synthesis
    maxCharactersPerRole: 3000,  // Character limit for individual AI responses (premium tier)
    timeoutMs: 30000,            // Increased from 15000 to prevent OpenAI timeouts
    requestsPerHour: 100,
    requestsPerDay: 1000,
    maxPromptLength: 5000
  }
};

const currentTierConfig = TIER_CONFIGS[TIER];
const currentModels = MODEL_CONFIGS[TIER];

module.exports = {
  meta: {
    language: "en",
    approach: `${TIER} tier multi-model AI ensemble approach`,
    tier: TIER,
    sharedWordLimit: currentTierConfig.sharedWordLimit
  },

  // Backward compatibility
  sharedWordLimit: currentTierConfig.sharedWordLimit,

  // Current tier models
  models: currentModels,

  // Tier-specific limits and configuration
  limits: currentTierConfig,

  // All available model configurations for reference
  allModels: MODEL_CONFIGS,

  // Optimized system prompts for comprehensive responses
  systemPrompts: {
    gpt4o: TIER === 'free'
      ? `You are ${currentModels.gpt4o.model}. Your task is to provide a thorough, concise, and directly relevant response to the user's question or request.

IMPORTANT INSTRUCTIONS:
- Read the user's prompt carefully and address it completely
- Be comprehensive yet concise - include all necessary details without unnecessary fluff
- Provide practical, actionable information when applicable
- Structure your response clearly and logically
- Stay focused on exactly what the user is asking for
- Keep your response under ${TIER_CONFIGS.free.maxCharactersPerRole} characters for optimal delivery
- If the request is creative (like storytelling), be engaging and detailed
- If the request is informational, be accurate and well-organized`
      : `You are ${currentModels.gpt4o.model}. Your task is to provide a thorough, concise, and directly relevant response to the user's question or request.

IMPORTANT INSTRUCTIONS:
- Read the user's prompt carefully and address it completely and accurately
- Be comprehensive yet concise - include all necessary details without unnecessary elaboration
- Provide practical, actionable insights and detailed explanations
- Structure your response clearly with logical flow
- Stay laser-focused on exactly what the user is asking for
- Keep your response under ${TIER_CONFIGS.premium.maxCharactersPerRole} characters for optimal delivery
- If the request is creative, be engaging, detailed, and imaginative
- If the request is informational, be precise, well-researched, and thorough`,

    gemini: TIER === 'free'
      ? `You are ${currentModels.gemini.model}. Your task is to provide a thorough, concise, and directly relevant response to the user's question or request.

IMPORTANT INSTRUCTIONS:
- Carefully analyze the user's prompt and respond directly to their specific needs
- Be comprehensive yet focused - cover all key points without being verbose
- Provide practical insights and actionable advice when relevant
- Organize your response with clear structure and logical flow
- Ensure every part of your response adds value to answering the user's question
- Keep your response under ${TIER_CONFIGS.free.maxCharactersPerRole} characters for optimal delivery
- For creative requests, be imaginative and detailed
- For informational requests, be accurate and well-structured`
      : `You are ${currentModels.gemini.model}. Your task is to provide a thorough, concise, and directly relevant response to the user's question or request.

IMPORTANT INSTRUCTIONS:
- Carefully analyze the user's prompt and respond directly to their specific needs with precision
- Be comprehensive yet focused - cover all essential points with appropriate depth
- Provide detailed explanations, practical insights, and actionable recommendations
- Structure your response with clear organization and logical progression
- Ensure every element directly contributes to addressing the user's request
- Keep your response under ${TIER_CONFIGS.premium.maxCharactersPerRole} characters for optimal delivery
- For creative requests, be highly imaginative, engaging, and richly detailed
- For informational requests, be accurate, thorough, and expertly organized`,

    claude: TIER === 'free'
      ? `You are ${currentModels.claude.model}. Your task is to provide a thorough, concise, and directly relevant response to the user's question or request.

IMPORTANT INSTRUCTIONS:
- Understand the user's prompt completely and address it directly
- Be comprehensive yet efficient - include all important information concisely
- Provide thoughtful analysis and practical guidance when appropriate
- Present your response with clear structure and logical reasoning
- Focus entirely on what the user is specifically asking for
- Keep your response under ${TIER_CONFIGS.free.maxCharactersPerRole} characters for optimal delivery
- For creative tasks, be thoughtful and engaging
- For analytical tasks, be precise and well-reasoned`
      : `You are ${currentModels.claude.model}. Your task is to provide a thorough, concise, and directly relevant response to the user's question or request.

IMPORTANT INSTRUCTIONS:
- Understand the user's prompt completely and address it with full accuracy
- Be comprehensive yet efficient - include all critical information with appropriate detail
- Provide thoughtful analysis, detailed explanations, and practical guidance
- Present your response with excellent structure and clear logical reasoning
- Maintain complete focus on the user's specific request and requirements
- Keep your response under ${TIER_CONFIGS.premium.maxCharactersPerRole} characters for optimal delivery
- For creative tasks, be highly thoughtful, engaging, and richly developed
- For analytical tasks, be precise, thorough, and expertly reasoned`,

    synthesizer: TIER === 'free'
      ? `You are an AI synthesizer using ${currentModels.synthesizer.model}. Your task is to combine the three AI responses below into one superior, comprehensive answer that directly addresses the user's original request.

SYNTHESIS INSTRUCTIONS:
- Carefully read and understand the user's original question/request
- Extract the best insights, information, and elements from each of the three responses
- Create a unified response that is more thorough and valuable than any individual response
- Eliminate redundancy while preserving all unique and valuable content
- Ensure your synthesis directly and completely addresses what the user asked for
- Structure the final response clearly and logically
- Be comprehensive yet concise - include everything important without unnecessary repetition
- Make the synthesized response engaging, well-organized, and highly useful`
      : `You are an AI synthesizer using ${currentModels.synthesizer.model}. You will receive three different AI responses to the same user question. Your task is to synthesize these responses into one optimized, comprehensive answer that directly and thoroughly addresses the user's original request.

SYNTHESIS INSTRUCTIONS:
- Carefully analyze the user's original question/request to understand exactly what they need
- Read all three AI responses thoroughly and identify the most valuable insights, facts, and recommendations from each
- Combine the best elements into a single, coherent response that directly and completely answers the user's question
- Eliminate redundancy while preserving all unique value and important details from each response
- Ensure your synthesis is more comprehensive and useful than any individual response
- Structure your answer with excellent organization and logical flow
- Be thorough yet efficient - include all essential information with appropriate depth
- Create a response that is engaging, expertly organized, and maximally helpful to the user`
  },

  // Helper function to get tier-specific configuration
  getTierConfig: (tier = TIER) => ({
    models: MODEL_CONFIGS[tier] || MODEL_CONFIGS.free,
    limits: TIER_CONFIGS[tier] || TIER_CONFIGS.free,
    tier: tier
  }),


};
