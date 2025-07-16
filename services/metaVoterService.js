/**
 * 🤖 Meta-Voter Service - AI-Powered Response Ranking
 *
 * 🎯 PURPOSE: Use GPT-3.5-turbo as a meta-voter to rank AI responses when
 *            traditional voting mechanisms are inconclusive or tied
 *
 * 📋 KEY FEATURES:
 * 1. AI-powered response ranking and evaluation
 * 2. Tie-breaking for inconclusive voting scenarios
 * 3. Quality assessment with detailed reasoning
 * 4. Fallback mechanisms for meta-voter failures
 * 5. Meta-voting decision tracking and analytics
 * 6. Bias detection and mitigation strategies
 *
 * 💡 ANALOGY: Like having a supreme court judge who reviews lower court
 *    decisions when they're tied or unclear, providing final arbitration
 */

const OpenAI = require('openai');
const dynamicConfig = require('../config/dynamicConfig');
const monitoringService = require('./monitoringService');
const logger = require('../utils/visualLogger');

class MetaVoterService {
  constructor() {
    this.openaiClient = null;
    this.metaVotingHistory = new Map();
    this.biasDetectionMetrics = new Map();
    
    // Configuration - using dynamic config
    this.metaVoterModel = dynamicConfig.metaVoter.model;
    this.maxTokens = dynamicConfig.metaVoter.maxTokens;
    this.temperature = dynamicConfig.metaVoter.temperature;
    this.timeout = dynamicConfig.metaVoter.timeout;

    // Thresholds for triggering meta-voting - using dynamic config
    this.triggerThresholds = {
      maxWeightDifference: dynamicConfig.metaVoter.triggerThresholds.maxWeightDifference,
      minConsensusStrength: dynamicConfig.metaVoter.triggerThresholds.minConsensusStrength,
      tieBreakingRequired: true   // Always available for tie-breaking
    };

    console.log('🚀 Meta Voter Service initialized with dynamic configuration');
    console.log(`   Model: ${this.metaVoterModel}`);
    console.log(`   Max Tokens: ${this.maxTokens}`);
    console.log(`   Temperature: ${this.temperature}`);
    console.log(`   Timeout: ${this.timeout}ms`);

    this.initializeOpenAI();
  }

  /**
   * Initialize OpenAI client
   */
  initializeOpenAI() {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not found in environment variables');
      }

      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
        // Note: timeout should be passed in individual requests, not in constructor
      });

      logger.success(
        'Meta-Voter Service: OpenAI client initialized',
        {
          'Model': this.metaVoterModel,
          'Max Tokens': this.maxTokens,
          'Temperature': this.temperature,
          'Status': 'Ready for meta-voting'
        },
        'meta-voter'
      );
    } catch (error) {
      logger.warning(
        'Meta-Voter Service: OpenAI initialization failed',
        {
          'Error': error.message,
          'Impact': 'Meta-voting will not be available',
          'Fallback': 'Traditional voting only'
        },
        'meta-voter'
      );
    }
  }

  /**
   * Determine if meta-voting should be triggered
   */
  shouldTriggerMetaVoting(votingResult, roles) {
    if (!this.openaiClient) return false;

    const weights = Object.values(votingResult.weights).sort((a, b) => b - a);
    if (weights.length < 2) return false;

    // Check if top weights are very close (indicating a tie)
    const topWeightDifference = weights[0] - weights[1];
    const isCloseRace = topWeightDifference <= this.triggerThresholds.maxWeightDifference;

    // Check consensus strength
    const isWeakConsensus = votingResult.consensus === 'weak' || votingResult.consensus === 'very-weak';

    // Check if traditional voting failed to produce clear winner
    const isUnclearWinner = votingResult.confidence < this.triggerThresholds.minConsensusStrength;

    const shouldTrigger = isCloseRace || isWeakConsensus || isUnclearWinner;

    if (shouldTrigger) {
      monitoringService.log('info', 'Meta-voting triggered', {
        reason: isCloseRace ? 'close_race' : isWeakConsensus ? 'weak_consensus' : 'unclear_winner',
        topWeightDifference,
        consensus: votingResult.consensus,
        confidence: votingResult.confidence
      });
    }

    return shouldTrigger;
  }

  /**
   * Perform meta-voting analysis
   */
  async performMetaVoting(roles, originalPrompt, votingResult, requestMetadata = {}) {
    if (!this.openaiClient) {
      return this.getFallbackMetaVoting(votingResult);
    }

    try {
      const startTime = Date.now();
      
      // Prepare responses for meta-voting
      const responses = this.prepareResponsesForMetaVoting(roles);
      
      // Generate meta-voting prompt
      const metaPrompt = this.generateMetaVotingPrompt(originalPrompt, responses, votingResult);
      
      // Call meta-voter AI
      const metaVotingResult = await this.callMetaVoter(metaPrompt);
      
      // Process and validate meta-voting result
      const processedResult = this.processMetaVotingResult(metaVotingResult, roles, votingResult);
      
      // Record meta-voting decision
      await this.recordMetaVotingDecision({
        ...processedResult,
        originalVoting: votingResult,
        processingTime: Date.now() - startTime,
        requestMetadata
      });

      // Detect potential bias
      await this.detectMetaVotingBias(processedResult, roles);

      return processedResult;
    } catch (error) {
      monitoringService.log('error', 'Meta-voting failed', {
        error: error.message,
        fallbackUsed: true
      });
      
      return this.getFallbackMetaVoting(votingResult);
    }
  }

  /**
   * Prepare responses for meta-voting analysis
   */
  prepareResponsesForMetaVoting(roles) {
    const successful = roles.filter(r => r.status === 'fulfilled' && r.content);
    
    return successful.map((role, index) => ({
      id: `Response_${String.fromCharCode(65 + index)}`, // A, B, C, etc.
      model: role.metadata?.model || role.model || 'unknown',
      content: role.content.substring(0, 1500), // Limit content length
      confidence: role.confidence || 0,
      responseTime: role.responseTime || 0,
      role: role.role
    }));
  }

  /**
   * Generate meta-voting prompt
   */
  generateMetaVotingPrompt(originalPrompt, responses, votingResult) {
    const responseTexts = responses.map(r => 
      `**${r.id} (${r.model}):**\n${r.content}\n`
    ).join('\n');

    return `You are an expert AI response evaluator. Your task is to analyze and rank multiple AI responses to determine which provides the best answer to the user's question.

**Original User Question:**
${originalPrompt}

**AI Responses to Evaluate:**
${responseTexts}

**Current Voting Status:**
- Traditional voting is inconclusive (consensus: ${votingResult.consensus})
- Top responses are very close in quality
- Your meta-analysis is needed to break the tie

**Evaluation Criteria:**
1. **Accuracy & Correctness**: How factually accurate and correct is the response?
2. **Completeness**: Does it fully address the user's question?
3. **Clarity & Coherence**: How clear and well-structured is the response?
4. **Relevance**: How directly relevant is it to the question asked?
5. **Practical Value**: How useful is this response to the user?

**Required Output Format:**
Provide your analysis as a JSON object with this exact structure:
{
  "winner": "Response_X",
  "confidence": 0.85,
  "ranking": ["Response_A", "Response_B", "Response_C"],
  "reasoning": "Detailed explanation of your decision...",
  "scores": {
    "Response_A": {"accuracy": 0.8, "completeness": 0.9, "clarity": 0.7, "relevance": 0.9, "value": 0.8},
    "Response_B": {"accuracy": 0.9, "completeness": 0.8, "clarity": 0.9, "relevance": 0.8, "value": 0.9}
  },
  "strengths": {
    "Response_A": ["strength1", "strength2"],
    "Response_B": ["strength1", "strength2"]
  },
  "weaknesses": {
    "Response_A": ["weakness1"],
    "Response_B": ["weakness1"]
  }
}

Be objective, thorough, and provide clear reasoning for your decision. Focus on which response best serves the user's needs.`;
  }

  /**
   * Call meta-voter AI
   */
  async callMetaVoter(prompt) {
    const response = await this.openaiClient.chat.completions.create({
      model: this.metaVoterModel,
      messages: [
        {
          role: 'system',
          content: 'You are an expert AI response evaluator. Always respond with valid JSON in the exact format requested.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      response_format: { type: 'json_object' }
    });

    return response.choices[0].message.content;
  }

  /**
   * Process and validate meta-voting result
   */
  processMetaVotingResult(metaVotingResult, roles, originalVoting) {
    try {
      const parsed = JSON.parse(metaVotingResult);
      
      // Validate required fields
      if (!parsed.winner || !parsed.confidence || !parsed.ranking || !parsed.reasoning) {
        throw new Error('Invalid meta-voting result format');
      }

      // Map response IDs back to role names
      const responseMap = this.createResponseIdMap(roles);
      const winner = this.mapResponseIdToRole(parsed.winner, responseMap);
      
      if (!winner) {
        throw new Error('Invalid winner in meta-voting result');
      }

      // Calculate meta-voting confidence
      const metaConfidence = Math.max(0, Math.min(1, parsed.confidence));

      return {
        metaVotingUsed: true,
        metaWinner: winner,
        metaConfidence,
        metaRanking: parsed.ranking.map(id => this.mapResponseIdToRole(id, responseMap)).filter(Boolean),
        metaReasoning: parsed.reasoning,
        metaScores: this.processMetaScores(parsed.scores, responseMap),
        metaStrengths: this.processMetaFeedback(parsed.strengths, responseMap),
        metaWeaknesses: this.processMetaFeedback(parsed.weaknesses, responseMap),
        
        // Override original voting result
        finalWinner: winner,
        finalConfidence: metaConfidence,
        finalConsensus: metaConfidence > 0.8 ? 'strong' : metaConfidence > 0.6 ? 'moderate' : 'weak',
        
        // Preserve original voting for comparison
        originalWinner: originalVoting.winner,
        originalConfidence: originalVoting.confidence,
        votingOverridden: winner !== originalVoting.winner
      };
    } catch (error) {
      throw new Error(`Failed to process meta-voting result: ${error.message}`);
    }
  }

  /**
   * Create mapping between response IDs and role names
   */
  createResponseIdMap(roles) {
    const successful = roles.filter(r => r.status === 'fulfilled' && r.content);
    const map = {};
    
    successful.forEach((role, index) => {
      const responseId = `Response_${String.fromCharCode(65 + index)}`;
      map[responseId] = role.role;
    });
    
    return map;
  }

  /**
   * Map response ID back to role name
   */
  mapResponseIdToRole(responseId, responseMap) {
    return responseMap[responseId] || null;
  }

  /**
   * Process meta-voting scores
   */
  processMetaScores(scores, responseMap) {
    const processedScores = {};
    
    for (const [responseId, scoreObj] of Object.entries(scores || {})) {
      const role = this.mapResponseIdToRole(responseId, responseMap);
      if (role && scoreObj) {
        processedScores[role] = scoreObj;
      }
    }
    
    return processedScores;
  }

  /**
   * Process meta-voting feedback (strengths/weaknesses)
   */
  processMetaFeedback(feedback, responseMap) {
    const processedFeedback = {};
    
    for (const [responseId, items] of Object.entries(feedback || {})) {
      const role = this.mapResponseIdToRole(responseId, responseMap);
      if (role && Array.isArray(items)) {
        processedFeedback[role] = items;
      }
    }
    
    return processedFeedback;
  }

  /**
   * Get fallback meta-voting result when AI meta-voter fails
   */
  getFallbackMetaVoting(originalVoting) {
    return {
      metaVotingUsed: false,
      metaVotingFailed: true,
      fallbackUsed: true,
      
      // Use original voting result as fallback
      finalWinner: originalVoting.winner,
      finalConfidence: originalVoting.confidence * 0.9, // Slightly reduce confidence
      finalConsensus: originalVoting.consensus,
      
      originalWinner: originalVoting.winner,
      originalConfidence: originalVoting.confidence,
      votingOverridden: false,
      
      metaReasoning: 'Meta-voting service unavailable, using traditional voting result'
    };
  }

  /**
   * Record meta-voting decision for analysis
   */
  async recordMetaVotingDecision(metaVotingResult) {
    try {
      const record = {
        metaVotingId: `meta_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...metaVotingResult
      };

      this.metaVotingHistory.set(record.metaVotingId, record);

      // Keep only recent history
      if (this.metaVotingHistory.size > 500) {
        const oldestKeys = Array.from(this.metaVotingHistory.keys()).slice(0, 100);
        oldestKeys.forEach(key => this.metaVotingHistory.delete(key));
      }

      monitoringService.log('info', 'Meta-voting decision recorded', {
        metaVotingId: record.metaVotingId,
        winner: record.metaWinner,
        confidence: record.metaConfidence,
        overridden: record.votingOverridden
      });
    } catch (error) {
      monitoringService.log('error', 'Failed to record meta-voting decision', {
        error: error.message
      });
    }
  }

  /**
   * Detect potential bias in meta-voting decisions
   */
  async detectMetaVotingBias(metaResult, roles) {
    try {
      if (!metaResult.metaWinner) return;

      const winnerModel = roles.find(r => r.role === metaResult.metaWinner)?.metadata?.model || 'unknown';
      
      // Track model selection frequency
      if (!this.biasDetectionMetrics.has(winnerModel)) {
        this.biasDetectionMetrics.set(winnerModel, { wins: 0, total: 0 });
      }
      
      const modelMetrics = this.biasDetectionMetrics.get(winnerModel);
      modelMetrics.wins++;
      
      // Update total for all models
      for (const [model, metrics] of this.biasDetectionMetrics.entries()) {
        metrics.total++;
      }

      // Check for bias (if one model wins significantly more than expected)
      const totalDecisions = modelMetrics.total;
      if (totalDecisions > 20) {
        const winRate = modelMetrics.wins / totalDecisions;
        const expectedWinRate = 1 / this.biasDetectionMetrics.size; // Assuming equal capability
        const bias = winRate - expectedWinRate;
        
        if (Math.abs(bias) > 0.3) { // 30% deviation from expected
          monitoringService.log('warning', 'Potential meta-voting bias detected', {
            model: winnerModel,
            winRate: winRate.toFixed(3),
            expectedWinRate: expectedWinRate.toFixed(3),
            bias: bias.toFixed(3),
            totalDecisions
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ Bias detection failed:', error.message);
    }
  }

  /**
   * Get meta-voting statistics
   */
  getMetaVotingStats() {
    const recentDecisions = Array.from(this.metaVotingHistory.values()).slice(-100);
    
    if (recentDecisions.length === 0) {
      return { hasData: false };
    }

    const overrideRate = recentDecisions.filter(d => d.votingOverridden).length / recentDecisions.length;
    const avgConfidence = recentDecisions.reduce((sum, d) => sum + (d.metaConfidence || 0), 0) / recentDecisions.length;
    const avgProcessingTime = recentDecisions.reduce((sum, d) => sum + (d.processingTime || 0), 0) / recentDecisions.length;

    return {
      hasData: true,
      totalDecisions: recentDecisions.length,
      overrideRate: overrideRate.toFixed(3),
      averageConfidence: avgConfidence.toFixed(3),
      averageProcessingTime: Math.round(avgProcessingTime),
      biasMetrics: Object.fromEntries(this.biasDetectionMetrics)
    };
  }
}

module.exports = MetaVoterService;
