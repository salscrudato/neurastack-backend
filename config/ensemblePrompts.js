// ===== AI Ensemble — Cost-Optimized Multi-Tier Approach =====

// Determine tier based on environment or user settings
const TIER = process.env.NEURASTACK_TIER || 'free'; // 'free', 'premium'

// Cost-optimized models for different tiers
const MODEL_CONFIGS = {
  free: {
    gpt4o: { provider: 'openai', model: 'gpt-4o-mini' }, // Keep as is - excellent value at $0.15/$0.60 per 1M tokens
    gemini: { provider: 'gemini', model: 'gemini-1.5-flash' }, // Switched to 1.5-flash - lower cost, tends to generate longer responses
    claude: { provider: 'claude', model: 'claude-3-5-haiku-latest' }, // Keep as is - good balance at $0.80/$4.00 per 1M tokens
    synthesizer: { provider: 'openai', model: 'gpt-4.1-mini' }, // Changed to 4.1-mini - 73% cheaper than gpt-4o, better quality
    fallback: { provider: 'openai', model: 'gpt-3.5-turbo' } // Added fallback option for reliability
  },
  premium: {
    gpt4o: { provider: 'openai', model: 'gpt-4o' }, // Full performance model for premium users
    gemini: { provider: 'gemini', model: 'gemini-2.5-flash' }, // Upgraded to 2.5 - better performance with 1M context window
    claude: { provider: 'claude', model: 'claude-3-5-haiku-latest' }, // Keep as is - fast, high-quality responses
    synthesizer: { provider: 'openai', model: 'gpt-4o' }, // Premium synthesis quality
    fallback: { provider: 'openai', model: 'gpt-4o-mini' } // Higher quality fallback for premium
  }
};

// Tier-specific configurations - Optimized for cost and performance
const TIER_CONFIGS = {
  free: {
    sharedWordLimit: 500,        // Optimized for cost while maintaining quality
    maxTokensPerRole: 900,       // Increased slightly for better responses under load
    maxSynthesisTokens: 1100,    // Increased for better synthesis quality
    maxCharactersPerRole: 2400,  // Increased for better response quality
    timeoutMs: 50000,            // Increased timeout for 25+ concurrent users (50 seconds)
    requestsPerHour: 25,         // Optimized for 25+ concurrent users
    requestsPerDay: 150,         // Increased daily limits for higher usage
    maxPromptLength: 1500,       // Increased for more detailed prompts
    enableCaching: true,         // Enable response caching for cost reduction
    cacheTTL: 600,              // Increased cache TTL for better performance (10 minutes)
    concurrencyLimit: 25        // Added explicit concurrency limit
  },
  premium: {
    sharedWordLimit: 800,        // Higher quality responses for premium
    maxTokensPerRole: 1600,      // Increased for premium quality under load
    maxSynthesisTokens: 2000,    // Higher synthesis quality
    maxCharactersPerRole: 3800,  // More comprehensive responses
    timeoutMs: 75000,            // Extended timeout for complex requests under load (75 seconds)
    requestsPerHour: 150,        // Increased limits for premium users
    requestsPerDay: 1500,        // Higher premium daily limits
    maxPromptLength: 4000,       // Longer prompts allowed for premium
    enableCaching: true,         // Enable caching for premium too
    cacheTTL: 300,              // Balanced cache for premium (5 minutes)
    concurrencyLimit: 50        // Higher concurrency limit for premium
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
      ? `You are ${currentModels.gemini.model}. Your task is to provide a thorough, comprehensive, and detailed response to the user's question or request.

IMPORTANT INSTRUCTIONS:
- Carefully analyze the user's prompt and respond with comprehensive detail
- Provide thorough explanations with examples, context, and supporting details
- Aim for responses that are informative and substantive (minimum 50-100 words)
- Include relevant background information, practical insights, and actionable advice
- Use clear structure with multiple paragraphs when appropriate
- Elaborate on key concepts and provide comprehensive coverage of the topic
- For creative requests, be imaginative, detailed, and expansive
- For informational requests, be thorough, accurate, and well-explained
- Ensure your response demonstrates depth of knowledge and understanding`
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
