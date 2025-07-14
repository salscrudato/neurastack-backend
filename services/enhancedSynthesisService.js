/**
 * Enhanced Synthesis Service - Simplified response synthesis
 */

const { OpenAI } = require('openai');

class EnhancedSynthesisService {
  constructor() {
    this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000 });
  }

  async synthesizeWithEnhancements(roleOutputs, userPrompt, correlationId, votingResult = {}, userId = null, sessionId = null) {
    const startTime = Date.now();
    try {
      const successfulOutputs = roleOutputs.filter(r => r.status === 'fulfilled');
      if (successfulOutputs.length === 0) {
        return { content: 'No responses available.', model: 'fallback', status: 'fallback' };
      }
      let prompt = `Synthesize: ${userPrompt}\n\nResponses:\n${successfulOutputs.map(o => o.content).join('\n')}`;
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500
      });
      return { content: response.choices[0].message.content, model: 'gpt-4o-mini', status: 'success' };
    } catch (error) {
      return { content: 'Synthesis failed.', model: 'error', status: 'error' };
    }
  }

  async healthCheck() {
    return { status: 'healthy' };
  }
}

module.exports = new EnhancedSynthesisService();