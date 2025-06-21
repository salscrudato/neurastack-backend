/**
 * Prompt Crafting Service
 * Uses low-cost AI model to generate optimized prompts for workout generation
 */

const clients = require('./vendorClients');
const workoutConfig = require('../config/workoutConfig');
const monitoringService = require('./monitoringService');

class PromptCraftingService {
  constructor() {
    this.config = workoutConfig.getAIConfig('promptCrafter');
  }

  /**
   * Generate an optimized prompt for workout generation
   * @param {Object} userMetadata - User fitness data and preferences
   * @param {Array} workoutHistory - User's workout history
   * @param {string} otherInformation - Free-form additional information
   * @param {string} correlationId - Request correlation ID
   * @returns {Promise<string>} Optimized prompt for workout generation
   */
  async craftWorkoutPrompt(userMetadata, workoutHistory = [], otherInformation = '', correlationId) {
    try {
      monitoringService.log('info', 'Starting prompt crafting', {
        userId: userMetadata.userId || 'anonymous',
        hasHistory: workoutHistory.length > 0,
        hasOtherInfo: !!otherInformation
      }, correlationId);

      // Build user data string from flexible input
      const userData = workoutConfig.buildUserDataString(userMetadata, workoutHistory, otherInformation);
      
      // Create the prompt crafting request
      const promptCraftingPrompt = workoutConfig.PROMPT_TEMPLATES.promptCrafter
        .replace('{userData}', userData);

      // Call the low-cost AI model to craft the optimized prompt
      const optimizedPrompt = await this.callPromptCraftingAI(promptCraftingPrompt, correlationId);

      monitoringService.log('info', 'Prompt crafting completed', {
        originalDataLength: userData.length,
        optimizedPromptLength: optimizedPrompt.length
      }, correlationId);

      return optimizedPrompt;

    } catch (error) {
      monitoringService.log('error', 'Prompt crafting failed', {
        error: error.message,
        stack: error.stack
      }, correlationId);

      // Fallback to a basic prompt if crafting fails
      return this.generateFallbackPrompt(userMetadata, workoutHistory, otherInformation);
    }
  }

  /**
   * Call the prompt crafting AI model
   * @param {string} prompt - The prompt crafting request
   * @param {string} correlationId - Request correlation ID
   * @returns {Promise<string>} The crafted prompt
   */
  async callPromptCraftingAI(prompt, correlationId) {
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        this.callOpenAI(prompt),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Prompt crafting timeout')), this.config.timeoutMs)
        )
      ]);

      const duration = Date.now() - startTime;
      monitoringService.log('info', 'Prompt crafting AI call successful', {
        duration,
        model: this.config.model,
        responseLength: response.length
      }, correlationId);

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      monitoringService.log('error', 'Prompt crafting AI call failed', {
        duration,
        error: error.message,
        model: this.config.model
      }, correlationId);

      throw error;
    }
  }

  /**
   * Call OpenAI for prompt crafting
   * @param {string} prompt - The prompt to send
   * @returns {Promise<string>} The AI response
   */
  async callOpenAI(prompt) {
    const openaiClient = clients.getClient('openai');
    
    const response = await openaiClient.chat.completions.create({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert fitness prompt engineer. Create optimized, professional prompts for workout generation.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens
    });

    return response.choices[0].message.content.trim();
  }

  /**
   * Generate a fallback prompt when AI crafting fails
   * @param {Object} userMetadata - User fitness data
   * @param {Array} workoutHistory - User's workout history
   * @param {string} otherInformation - Additional information
   * @returns {string} Basic fallback prompt
   */
  generateFallbackPrompt(userMetadata, workoutHistory, otherInformation) {
    const userData = workoutConfig.buildUserDataString(userMetadata, workoutHistory, otherInformation);
    
    return `You are a professional personal trainer with advanced certifications. Create a personalized workout plan based on the following user information:

${userData}

Requirements:
- Generate a safe, effective workout appropriate for the user's fitness level
- Include proper warm-up and cool-down sequences
- Provide detailed exercise instructions and form cues
- Consider any injuries or limitations mentioned
- Structure the workout to meet the user's goals and time constraints
- Include coaching tips and progression guidance

Please provide a comprehensive workout plan that demonstrates professional expertise and prioritizes user safety while maximizing effectiveness.`;
  }

  /**
   * Validate user metadata for prompt crafting
   * @param {Object} userMetadata - User data to validate
   * @returns {Object} Validation result
   */
  validateUserMetadata(userMetadata) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!userMetadata.age || userMetadata.age < 13 || userMetadata.age > 100) {
      errors.push('Age must be between 13 and 100');
    }

    if (!userMetadata.fitnessLevel) {
      warnings.push('Fitness level not specified, will use intermediate as default');
    }

    // Check time constraints
    if (userMetadata.timeAvailable && (userMetadata.timeAvailable < 10 || userMetadata.timeAvailable > 120)) {
      warnings.push('Time available should be between 10-120 minutes for optimal workout design');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = new PromptCraftingService();
