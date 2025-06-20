/**
 * Hierarchical Context Manager
 * Implements advanced context management with hierarchical structures,
 * intelligent compression, and optimized token usage
 */

const { getMemoryManager } = require('./memoryManager');
const cacheService = require('./cacheService');
const ContentAnalyzer = require('./contentAnalysis');
const { getContextCompressionService } = require('./contextCompressionService');
const { getSmartMemoryRetrieval } = require('./smartMemoryRetrieval');
const { getDynamicContextSizing } = require('./dynamicContextSizing');
const { getContextQualityMonitoring } = require('./contextQualityMonitoring');

class HierarchicalContextManager {
  constructor() {
    this.memoryManager = getMemoryManager();
    this.cacheService = cacheService;
    this.contentAnalyzer = new ContentAnalyzer();
    this.compressionService = getContextCompressionService();
    this.smartRetrieval = getSmartMemoryRetrieval();
    this.dynamicSizing = getDynamicContextSizing();
    this.qualityMonitoring = getContextQualityMonitoring();
    
    // Context optimization settings
    this.config = {
      maxUserProfileTokens: 150,
      maxSessionSummaryTokens: 200,
      maxThemeTokens: 100,
      maxRecentContextTokens: 300,
      compressionRatio: 0.6, // Target 60% of original size
      relevanceThreshold: 0.7,
      // Caching configuration
      userProfileCacheTTL: 7200, // 2 hours
      sessionSummaryCacheTTL: 1800, // 30 minutes
      themesCacheTTL: 3600, // 1 hour
      contextCacheTTL: 600, // 10 minutes
      precomputeThreshold: 5 // Precompute after 5 accesses
    };

    // Precomputation tracking
    this.precomputeQueue = new Map();
    this.accessCounts = new Map();
  }

  /**
   * Get optimized hierarchical context with dynamic sizing and intelligent caching
   * @param {string} userId
   * @param {string} sessionId
   * @param {number} maxTokens
   * @param {string} [currentPrompt]
   * @param {Object} [options] - Additional options for dynamic sizing
   * @returns {Promise<Object>}
   */
  async getHierarchicalContext(userId, sessionId, maxTokens = 2048, currentPrompt = null, options = {}) {
    const startTime = Date.now();
    const requestId = options.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Track access for precomputation
      this.trackAccess(userId, sessionId);

      // Calculate optimal context size dynamically
      const sizingRequest = {
        userTier: options.userTier || 'free',
        models: options.models || ['gpt-4o-mini'],
        currentPrompt,
        conversationHistory: options.conversationHistory || [],
        sessionComplexity: options.sessionComplexity || 'conversational',
        userPreferences: options.userPreferences || {},
        memoryImportance: options.memoryImportance || 0.5
      };

      const dynamicSizing = this.dynamicSizing.calculateOptimalContextSize(sizingRequest);
      const optimalTokens = Math.min(dynamicSizing.totalTokens, maxTokens);

      console.log(`🎯 Dynamic sizing: ${optimalTokens} tokens (${dynamicSizing.strategy}, ${Math.round(dynamicSizing.efficiency * 100)}% efficiency)`);

      // Check for cached complete context first
      const cacheKey = this.generateContextCacheKey(userId, sessionId, optimalTokens, currentPrompt);
      const cachedContext = await this.getCachedContext(cacheKey);

      if (cachedContext) {
        const processingTime = Date.now() - startTime;

        // Record quality metrics for cached context
        this.qualityMonitoring.recordContextGeneration({
          userId,
          sessionId,
          requestId,
          contextResult: cachedContext,
          processingTime,
          cacheHit: true,
          userTier: options.userTier || 'free'
        });

        console.log(`🎯 Using cached hierarchical context: ${cachedContext.totalTokens} tokens`);
        return {
          ...cachedContext,
          requestId,
          dynamicSizing: {
            requested: maxTokens,
            optimal: optimalTokens,
            efficiency: dynamicSizing.efficiency,
            strategy: dynamicSizing.strategy
          }
        };
      }

      // Build hierarchical context structure with caching
      const contextStructure = await this.buildContextStructureWithCaching(userId, sessionId, currentPrompt);

      // Optimize context using dynamic sizing breakdown
      const optimizedContext = await this.optimizeContextWithDynamicSizing(
        contextStructure,
        optimalTokens,
        dynamicSizing.breakdown
      );

      // Add dynamic sizing metadata
      optimizedContext.requestId = requestId;
      optimizedContext.dynamicSizing = {
        requested: maxTokens,
        optimal: optimalTokens,
        efficiency: dynamicSizing.efficiency,
        strategy: dynamicSizing.strategy,
        reasoning: dynamicSizing.reasoning
      };

      // Cache the result for future use
      await this.cacheContext(cacheKey, optimizedContext);

      // Schedule precomputation if threshold reached
      this.schedulePrecomputation(userId, sessionId);

      const processingTime = Date.now() - startTime;

      // Record quality metrics for new context
      this.qualityMonitoring.recordContextGeneration({
        userId,
        sessionId,
        requestId,
        contextResult: optimizedContext,
        processingTime,
        cacheHit: false,
        userTier: options.userTier || 'free'
      });

      console.log(`🏗️ Built hierarchical context: ${optimizedContext.totalTokens}/${optimalTokens} tokens (${Math.round(dynamicSizing.efficiency * 100)}% efficiency)`);

      return optimizedContext;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // Record error metrics
      this.qualityMonitoring.recordSystemPerformance({
        requestId,
        totalProcessingTime: processingTime,
        errorRate: 1.0
      });

      console.error('❌ Failed to build hierarchical context:', error);
      return {
        context: '',
        totalTokens: 0,
        structure: {},
        requestId,
        error: error.message
      };
    }
  }

  /**
   * Build comprehensive context structure
   * @param {string} userId 
   * @param {string} sessionId 
   * @param {string} [currentPrompt]
   * @returns {Promise<Object>}
   */
  async buildContextStructure(userId, sessionId, currentPrompt = null) {
    const [
      userProfile,
      sessionSummary,
      conversationThemes,
      relevantMemories,
      recentContext
    ] = await Promise.all([
      this.getUserProfile(userId),
      this.getSessionSummary(sessionId),
      this.getConversationThemes(userId, sessionId),
      this.getRelevantMemories(userId, sessionId, currentPrompt),
      this.getRecentContext(sessionId)
    ]);

    return {
      userProfile,
      sessionSummary,
      conversationThemes,
      relevantMemories,
      recentContext,
      metadata: {
        userId,
        sessionId,
        timestamp: new Date(),
        hasCurrentPrompt: !!currentPrompt
      }
    };
  }

  /**
   * Get enhanced user profile with learning patterns
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  async getUserProfile(userId) {
    try {
      const cacheKey = `hierarchical_user_profile:${userId}`;
      const cached = await this.cacheService?.get(cacheKey);
      if (cached) return cached;

      const userMemories = await this.memoryManager.retrieveMemories({
        userId,
        maxResults: 50,
        minImportance: 0.4
      });

      const profile = {
        expertDomains: this.extractExpertDomains(userMemories),
        communicationStyle: this.analyzeCommunicationStyle(userMemories),
        commonTopics: this.extractCommonTopics(userMemories),
        preferences: this.extractPreferences(userMemories),
        learningPatterns: this.analyzeLearningPatterns(userMemories),
        interactionHistory: this.summarizeInteractionHistory(userMemories)
      };

      // Cache for 2 hours
      await this.cacheService?.set(cacheKey, profile, 7200);
      return profile;
    } catch (error) {
      console.warn('⚠️ Failed to build user profile:', error.message);
      return this.getDefaultUserProfile();
    }
  }

  /**
   * Get session summary with key themes and decisions
   * @param {string} sessionId 
   * @returns {Promise<Object>}
   */
  async getSessionSummary(sessionId) {
    try {
      const cacheKey = `hierarchical_session_summary:${sessionId}`;
      const cached = await this.cacheService?.get(cacheKey);
      if (cached) return cached;

      const sessionMemories = await this.getSessionMemories(sessionId);
      if (sessionMemories.length === 0) return null;

      const summary = {
        mainTopics: this.extractMainTopics(sessionMemories),
        keyDecisions: this.extractKeyDecisions(sessionMemories),
        unresolvedQuestions: this.extractUnresolvedQuestions(sessionMemories),
        conversationFlow: this.analyzeConversationFlow(sessionMemories),
        sentiment: this.calculateSessionSentiment(sessionMemories),
        progressMade: this.analyzeProgressMade(sessionMemories)
      };

      // Cache for 30 minutes
      await this.cacheService?.set(cacheKey, summary, 1800);
      return summary;
    } catch (error) {
      console.warn('⚠️ Failed to build session summary:', error.message);
      return null;
    }
  }

  /**
   * Get conversation themes across sessions
   * @param {string} userId 
   * @param {string} sessionId 
   * @returns {Promise<Object>}
   */
  async getConversationThemes(userId, sessionId) {
    try {
      const cacheKey = `conversation_themes:${userId}:${sessionId}`;
      const cached = await this.cacheService?.get(cacheKey);
      if (cached) return cached;

      const recentMemories = await this.memoryManager.retrieveMemories({
        userId,
        maxResults: 30,
        minImportance: 0.5,
        memoryTypes: ['semantic', 'long_term']
      });

      const themes = {
        recurringTopics: this.identifyRecurringTopics(recentMemories),
        emergingPatterns: this.identifyEmergingPatterns(recentMemories),
        contextualConnections: this.findContextualConnections(recentMemories),
        topicEvolution: this.analyzeTopicEvolution(recentMemories)
      };

      // Cache for 1 hour
      await this.cacheService?.set(cacheKey, themes, 3600);
      return themes;
    } catch (error) {
      console.warn('⚠️ Failed to analyze conversation themes:', error.message);
      return { recurringTopics: [], emergingPatterns: [], contextualConnections: [], topicEvolution: [] };
    }
  }

  /**
   * Get relevant memories using smart retrieval strategies
   * @param {string} userId
   * @param {string} sessionId
   * @param {string} [currentPrompt]
   * @returns {Promise<Array>}
   */
  async getRelevantMemories(userId, sessionId, currentPrompt = null) {
    try {
      console.log(`🔍 Retrieving relevant memories for user ${userId}`);

      // Use smart memory retrieval for enhanced filtering and ranking
      const smartMemories = await this.smartRetrieval.retrieveSmartMemories({
        userId,
        sessionId,
        currentPrompt,
        maxResults: 10,
        memoryTypes: ['semantic', 'episodic', 'long_term', 'short_term'],
        minImportance: 0.3
      });

      if (smartMemories.length > 0) {
        console.log(`✅ Smart retrieval found ${smartMemories.length} relevant memories`);
        console.log(`📊 Top memory reasons: ${smartMemories.slice(0, 3).map(m => m.retrievalReason).join(', ')}`);
        return smartMemories;
      }

      // Fallback to traditional retrieval if smart retrieval fails
      console.log('⚠️ Smart retrieval returned no results, using fallback');
      const fallbackMemories = await this.memoryManager.retrieveMemories({
        userId,
        sessionId,
        maxResults: 8,
        minImportance: 0.4
      });

      return fallbackMemories;

    } catch (error) {
      console.warn('⚠️ Failed to get relevant memories:', error.message);

      // Final fallback to basic retrieval
      try {
        return await this.memoryManager.retrieveMemories({
          userId,
          sessionId,
          maxResults: 5,
          minImportance: 0.3
        });
      } catch (fallbackError) {
        console.error('❌ All memory retrieval methods failed:', fallbackError.message);
        return [];
      }
    }
  }

  /**
   * Get recent context from current session
   * @param {string} sessionId 
   * @returns {Promise<Object>}
   */
  async getRecentContext(sessionId) {
    try {
      const recentMemories = await this.memoryManager.retrieveMemories({
        sessionId,
        maxResults: 5,
        minImportance: 0.2,
        memoryTypes: ['working', 'short_term']
      });

      return {
        recentExchanges: this.extractRecentExchanges(recentMemories),
        currentFocus: this.identifyCurrentFocus(recentMemories),
        pendingQuestions: this.extractPendingQuestions(recentMemories),
        contextualCues: this.extractContextualCues(recentMemories)
      };
    } catch (error) {
      console.warn('⚠️ Failed to get recent context:', error.message);
      return { recentExchanges: [], currentFocus: null, pendingQuestions: [], contextualCues: [] };
    }
  }

  /**
   * Optimize context structure for token constraints
   * @param {Object} contextStructure 
   * @param {number} maxTokens 
   * @returns {Promise<Object>}
   */
  async optimizeContextForTokens(contextStructure, maxTokens) {
    const tokenBudget = {
      userProfile: Math.min(this.config.maxUserProfileTokens, Math.floor(maxTokens * 0.15)),
      sessionSummary: Math.min(this.config.maxSessionSummaryTokens, Math.floor(maxTokens * 0.20)),
      themes: Math.min(this.config.maxThemeTokens, Math.floor(maxTokens * 0.10)),
      relevantMemories: Math.floor(maxTokens * 0.45),
      recentContext: Math.min(this.config.maxRecentContextTokens, Math.floor(maxTokens * 0.10))
    };

    const optimizedSections = await Promise.all([
      this.compressUserProfile(contextStructure.userProfile, tokenBudget.userProfile),
      this.compressSessionSummary(contextStructure.sessionSummary, tokenBudget.sessionSummary),
      this.compressThemes(contextStructure.conversationThemes, tokenBudget.themes),
      this.compressMemories(contextStructure.relevantMemories, tokenBudget.relevantMemories),
      this.compressRecentContext(contextStructure.recentContext, tokenBudget.recentContext)
    ]);

    const [userProfile, sessionSummary, themes, memories, recentContext] = optimizedSections;
    
    const contextParts = [];
    let totalTokens = 0;

    // Build final context string
    if (userProfile.content) {
      contextParts.push(`[USER PROFILE]\n${userProfile.content}`);
      totalTokens += userProfile.tokens;
    }

    if (sessionSummary.content) {
      contextParts.push(`[SESSION SUMMARY]\n${sessionSummary.content}`);
      totalTokens += sessionSummary.tokens;
    }

    if (themes.content) {
      contextParts.push(`[CONVERSATION THEMES]\n${themes.content}`);
      totalTokens += themes.tokens;
    }

    if (memories.content) {
      contextParts.push(`[RELEVANT MEMORIES]\n${memories.content}`);
      totalTokens += memories.tokens;
    }

    if (recentContext.content) {
      contextParts.push(`[RECENT CONTEXT]\n${recentContext.content}`);
      totalTokens += recentContext.tokens;
    }

    return {
      context: contextParts.join('\n\n'),
      totalTokens,
      structure: {
        userProfile: userProfile.tokens,
        sessionSummary: sessionSummary.tokens,
        themes: themes.tokens,
        memories: memories.tokens,
        recentContext: recentContext.tokens
      },
      optimization: {
        targetTokens: maxTokens,
        actualTokens: totalTokens,
        efficiency: totalTokens / maxTokens,
        sectionsIncluded: contextParts.length
      }
    };
  }

  /**
   * Optimize context using dynamic sizing breakdown
   * @param {Object} contextStructure
   * @param {number} maxTokens
   * @param {Object} breakdown
   * @returns {Promise<Object>}
   */
  async optimizeContextWithDynamicSizing(contextStructure, maxTokens, breakdown) {
    console.log(`🎯 Optimizing with dynamic breakdown:`, breakdown);

    const optimizedSections = await Promise.all([
      this.compressUserProfile(contextStructure.userProfile, breakdown.userProfile || Math.floor(maxTokens * 0.15)),
      this.compressSessionSummary(contextStructure.sessionSummary, breakdown.sessionSummary || Math.floor(maxTokens * 0.20)),
      this.compressThemes(contextStructure.conversationThemes, breakdown.conversationThemes || Math.floor(maxTokens * 0.10)),
      this.compressMemories(contextStructure.relevantMemories, breakdown.relevantMemories || Math.floor(maxTokens * 0.45)),
      this.compressRecentContext(contextStructure.recentContext, breakdown.recentContext || Math.floor(maxTokens * 0.10))
    ]);

    const [userProfile, sessionSummary, themes, memories, recentContext] = optimizedSections;

    const contextParts = [];
    let totalTokens = 0;

    // Build final context string with dynamic allocation
    if (userProfile.content) {
      contextParts.push(`[USER PROFILE]\n${userProfile.content}`);
      totalTokens += userProfile.tokens;
    }

    if (sessionSummary.content) {
      contextParts.push(`[SESSION SUMMARY]\n${sessionSummary.content}`);
      totalTokens += sessionSummary.tokens;
    }

    if (themes.content) {
      contextParts.push(`[CONVERSATION THEMES]\n${themes.content}`);
      totalTokens += themes.tokens;
    }

    if (memories.content) {
      contextParts.push(`[RELEVANT MEMORIES]\n${memories.content}`);
      totalTokens += memories.tokens;
    }

    if (recentContext.content) {
      contextParts.push(`[RECENT CONTEXT]\n${recentContext.content}`);
      totalTokens += recentContext.tokens;
    }

    return {
      context: contextParts.join('\n\n'),
      totalTokens,
      structure: {
        userProfile: userProfile.tokens,
        sessionSummary: sessionSummary.tokens,
        themes: themes.tokens,
        memories: memories.tokens,
        recentContext: recentContext.tokens
      },
      optimization: {
        targetTokens: maxTokens,
        actualTokens: totalTokens,
        efficiency: totalTokens / maxTokens,
        sectionsIncluded: contextParts.length,
        dynamicBreakdown: breakdown,
        compressionStrategies: {
          userProfile: userProfile.strategy,
          sessionSummary: sessionSummary.strategy,
          themes: themes.strategy,
          memories: memories.strategy,
          recentContext: recentContext.strategy
        }
      }
    };
  }

  // ===== ANALYSIS METHODS =====

  /**
   * Extract expert domains from user memories
   * @param {Array} memories
   * @returns {Array}
   */
  extractExpertDomains(memories) {
    const domainCounts = {};

    memories.forEach(memory => {
      memory.content.concepts?.forEach(concept => {
        const domain = this.categorizeConcept(concept);
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      });
    });

    return Object.entries(domainCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([domain]) => domain);
  }

  /**
   * Analyze communication style from memories
   * @param {Array} memories
   * @returns {Object}
   */
  analyzeCommunicationStyle(memories) {
    let questionCount = 0;
    let technicalCount = 0;
    let sentimentSum = 0;
    let complexitySum = 0;

    memories.forEach(memory => {
      if (memory.content.keywords?.some(k => k.includes('?'))) questionCount++;
      if (memory.content.concepts?.some(c => this.isTechnicalConcept(c))) technicalCount++;
      sentimentSum += memory.content.sentiment || 0;
      complexitySum += memory.metadata?.complexity || 0.5;
    });

    const total = memories.length || 1;
    return {
      questionFrequency: questionCount / total,
      technicalOrientation: technicalCount / total,
      averageSentiment: sentimentSum / total,
      averageComplexity: complexitySum / total,
      style: this.determineStyle(questionCount / total, technicalCount / total)
    };
  }

  /**
   * Extract common topics from memories
   * @param {Array} memories
   * @returns {Array}
   */
  extractCommonTopics(memories) {
    const topicCounts = {};

    memories.forEach(memory => {
      const topic = memory.metadata?.conversationTopic || 'general';
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    return Object.entries(topicCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([topic, count]) => ({ topic, frequency: count }));
  }

  /**
   * Extract user preferences from interaction patterns
   * @param {Array} memories
   * @returns {Array}
   */
  extractPreferences(memories) {
    const preferences = [];

    const avgComplexity = memories.reduce((sum, m) => sum + (m.metadata?.complexity || 0.5), 0) / memories.length;
    if (avgComplexity > 0.7) preferences.push('detailed_explanations');
    if (avgComplexity < 0.3) preferences.push('concise_responses');

    const questionRatio = memories.filter(m => m.content.keywords?.some(k => k.includes('?'))).length / memories.length;
    if (questionRatio > 0.6) preferences.push('inquisitive');

    const technicalRatio = memories.filter(m =>
      m.content.concepts?.some(c => this.isTechnicalConcept(c))
    ).length / memories.length;
    if (technicalRatio > 0.5) preferences.push('technical');

    return preferences;
  }

  /**
   * Analyze learning patterns from memory progression
   * @param {Array} memories
   * @returns {Object}
   */
  analyzeLearningPatterns(memories) {
    const sortedMemories = memories.sort((a, b) =>
      new Date(a.createdAt) - new Date(b.createdAt)
    );

    const patterns = {
      topicProgression: this.analyzeTopicProgression(sortedMemories),
      complexityTrend: this.analyzeComplexityTrend(sortedMemories),
      questionEvolution: this.analyzeQuestionEvolution(sortedMemories),
      knowledgeBuilding: this.analyzeKnowledgeBuilding(sortedMemories)
    };

    return patterns;
  }

  /**
   * Summarize interaction history
   * @param {Array} memories
   * @returns {Object}
   */
  summarizeInteractionHistory(memories) {
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    const recentMemories = memories.filter(m =>
      new Date(m.createdAt).getTime() > oneWeekAgo
    );
    const monthlyMemories = memories.filter(m =>
      new Date(m.createdAt).getTime() > oneMonthAgo
    );

    return {
      totalInteractions: memories.length,
      recentActivity: recentMemories.length,
      monthlyActivity: monthlyMemories.length,
      averageSessionLength: this.calculateAverageSessionLength(memories),
      mostActiveTopics: this.extractCommonTopics(recentMemories).slice(0, 3),
      engagementLevel: this.calculateEngagementLevel(memories)
    };
  }

  /**
   * Get default user profile
   * @returns {Object}
   */
  getDefaultUserProfile() {
    return {
      expertDomains: ['general'],
      communicationStyle: {
        questionFrequency: 0.5,
        technicalOrientation: 0.3,
        averageSentiment: 0.1,
        averageComplexity: 0.5,
        style: 'balanced'
      },
      commonTopics: [{ topic: 'general', frequency: 1 }],
      preferences: ['balanced'],
      learningPatterns: {
        topicProgression: [],
        complexityTrend: 'stable',
        questionEvolution: 'consistent',
        knowledgeBuilding: 'gradual'
      },
      interactionHistory: {
        totalInteractions: 0,
        recentActivity: 0,
        monthlyActivity: 0,
        averageSessionLength: 0,
        mostActiveTopics: [],
        engagementLevel: 'new_user'
      }
    };
  }

  // ===== COMPRESSION METHODS =====

  /**
   * Compress user profile for token efficiency using advanced compression
   * @param {Object} profile
   * @param {number} maxTokens
   * @returns {Promise<Object>}
   */
  async compressUserProfile(profile, maxTokens) {
    if (!profile) return { content: '', tokens: 0 };

    // Build comprehensive profile text
    const profileParts = [];

    if (profile.expertDomains?.length > 0) {
      profileParts.push(`Expert in: ${profile.expertDomains.join(', ')}`);
    }

    if (profile.communicationStyle) {
      const style = profile.communicationStyle;
      profileParts.push(`Communication: ${style.style} (${Math.round(style.technicalOrientation * 100)}% technical, ${Math.round(style.questionFrequency * 100)}% questions)`);
    }

    if (profile.preferences?.length > 0) {
      profileParts.push(`Preferences: ${profile.preferences.join(', ')}`);
    }

    if (profile.interactionHistory) {
      const history = profile.interactionHistory;
      profileParts.push(`Activity: ${history.totalInteractions} interactions, ${history.engagementLevel} engagement`);
    }

    const fullContent = profileParts.join('. ');

    // Use advanced compression if content is too long
    if (this.contentAnalyzer.estimateTokenCount(fullContent) > maxTokens) {
      const compressionResult = await this.compressionService.compressContext(
        fullContent,
        maxTokens,
        { type: 'user_profile', preserveKeywords: true }
      );

      return {
        content: compressionResult.compressed,
        tokens: compressionResult.compressedTokens,
        compressionRatio: compressionResult.compressionRatio,
        strategy: compressionResult.strategy
      };
    }

    return {
      content: fullContent,
      tokens: this.contentAnalyzer.estimateTokenCount(fullContent),
      compressionRatio: 1.0,
      strategy: 'no_compression'
    };
  }

  /**
   * Compress session summary for token efficiency using advanced compression
   * @param {Object} summary
   * @param {number} maxTokens
   * @returns {Promise<Object>}
   */
  async compressSessionSummary(summary, maxTokens) {
    if (!summary) return { content: '', tokens: 0 };

    // Build comprehensive summary text
    const summaryParts = [];

    if (summary.mainTopics?.length > 0) {
      summaryParts.push(`Main topics discussed: ${summary.mainTopics.join(', ')}`);
    }

    if (summary.keyDecisions?.length > 0) {
      summaryParts.push(`Key decisions made: ${summary.keyDecisions.join('; ')}`);
    }

    if (summary.unresolvedQuestions?.length > 0) {
      summaryParts.push(`Unresolved questions: ${summary.unresolvedQuestions.join('; ')}`);
    }

    if (summary.progressMade) {
      summaryParts.push(`Progress: ${summary.progressMade}`);
    }

    if (summary.sentiment) {
      summaryParts.push(`Session tone: ${summary.sentiment}`);
    }

    const fullContent = summaryParts.join('. ');

    // Use advanced compression if content is too long
    if (this.contentAnalyzer.estimateTokenCount(fullContent) > maxTokens) {
      const compressionResult = await this.compressionService.compressContext(
        fullContent,
        maxTokens,
        { type: 'session_summary', preserveDecisions: true }
      );

      return {
        content: compressionResult.compressed,
        tokens: compressionResult.compressedTokens,
        compressionRatio: compressionResult.compressionRatio,
        strategy: compressionResult.strategy
      };
    }

    return {
      content: fullContent,
      tokens: this.contentAnalyzer.estimateTokenCount(fullContent),
      compressionRatio: 1.0,
      strategy: 'no_compression'
    };
  }

  /**
   * Compress conversation themes for token efficiency
   * @param {Object} themes
   * @param {number} maxTokens
   * @returns {Promise<Object>}
   */
  async compressThemes(themes, maxTokens) {
    if (!themes || !themes.recurringTopics?.length) return { content: '', tokens: 0 };

    const content = `Recurring: ${themes.recurringTopics.slice(0, 4).join(', ')}`;
    const tokens = this.contentAnalyzer.estimateTokenCount(content);

    return {
      content: tokens <= maxTokens ? content : this.truncateToTokens(content, maxTokens),
      tokens: Math.min(tokens, maxTokens)
    };
  }

  /**
   * Compress memories for token efficiency using advanced compression
   * @param {Array} memories
   * @param {number} maxTokens
   * @returns {Promise<Object>}
   */
  async compressMemories(memories, maxTokens) {
    if (!memories?.length) return { content: '', tokens: 0 };

    // Build comprehensive memory content
    const memoryTexts = memories.map(memory => {
      const content = memory.content.compressed || memory.content.original;
      return `[${memory.memoryType}] ${content}`;
    });

    const fullContent = memoryTexts.join('\n');
    const originalTokens = this.contentAnalyzer.estimateTokenCount(fullContent);

    // If content fits within limit, return as-is
    if (originalTokens <= maxTokens) {
      return {
        content: fullContent,
        tokens: originalTokens,
        compressionRatio: 1.0,
        strategy: 'no_compression',
        memoriesIncluded: memories.length
      };
    }

    // Use advanced compression for large memory sets
    const compressionResult = await this.compressionService.compressContext(
      fullContent,
      maxTokens,
      {
        type: 'memories',
        preserveMemoryTypes: true,
        prioritizeRecent: true
      }
    );

    return {
      content: compressionResult.compressed,
      tokens: compressionResult.compressedTokens,
      compressionRatio: compressionResult.compressionRatio,
      strategy: compressionResult.strategy,
      memoriesIncluded: memories.length,
      originalTokens
    };
  }

  /**
   * Compress recent context for token efficiency
   * @param {Object} recentContext
   * @param {number} maxTokens
   * @returns {Promise<Object>}
   */
  async compressRecentContext(recentContext, maxTokens) {
    if (!recentContext) return { content: '', tokens: 0 };

    const parts = [];
    if (recentContext.currentFocus) {
      parts.push(`Focus: ${recentContext.currentFocus}`);
    }
    if (recentContext.pendingQuestions?.length > 0) {
      parts.push(`Questions: ${recentContext.pendingQuestions.slice(0, 2).join('; ')}`);
    }

    const content = parts.join(' | ');
    const tokens = this.contentAnalyzer.estimateTokenCount(content);

    return {
      content: tokens <= maxTokens ? content : this.truncateToTokens(content, maxTokens),
      tokens: Math.min(tokens, maxTokens)
    };
  }

  // ===== UTILITY METHODS =====

  /**
   * Categorize a concept into a domain
   * @param {string} concept
   * @returns {string}
   */
  categorizeConcept(concept) {
    const lowerConcept = concept.toLowerCase();

    if (['api', 'database', 'server', 'code', 'function', 'programming'].some(term => lowerConcept.includes(term))) {
      return 'software_development';
    }
    if (['ai', 'machine learning', 'neural', 'model', 'algorithm'].some(term => lowerConcept.includes(term))) {
      return 'artificial_intelligence';
    }
    if (['business', 'strategy', 'management', 'process'].some(term => lowerConcept.includes(term))) {
      return 'business';
    }
    if (['design', 'ui', 'ux', 'interface', 'user'].some(term => lowerConcept.includes(term))) {
      return 'design';
    }

    return 'general';
  }

  /**
   * Check if a concept is technical
   * @param {string} concept
   * @returns {boolean}
   */
  isTechnicalConcept(concept) {
    const technicalTerms = ['api', 'database', 'server', 'code', 'function', 'algorithm', 'framework', 'library', 'protocol'];
    return technicalTerms.some(term => concept.toLowerCase().includes(term));
  }

  /**
   * Determine communication style
   * @param {number} questionFreq
   * @param {number} technicalFreq
   * @returns {string}
   */
  determineStyle(questionFreq, technicalFreq) {
    if (questionFreq > 0.7) return 'inquisitive';
    if (technicalFreq > 0.6) return 'technical';
    if (questionFreq < 0.3 && technicalFreq < 0.3) return 'direct';
    return 'balanced';
  }

  /**
   * Truncate content to fit within token limit
   * @param {string} content
   * @param {number} maxTokens
   * @returns {string}
   */
  truncateToTokens(content, maxTokens) {
    const words = content.split(' ');
    const avgTokensPerWord = 1.3; // Rough estimate
    const maxWords = Math.floor(maxTokens / avgTokensPerWord);

    if (words.length <= maxWords) return content;

    return words.slice(0, maxWords).join(' ') + '...';
  }

  // ===== PLACEHOLDER METHODS (simplified implementations) =====

  async getSessionMemories(sessionId) {
    return await this.memoryManager.retrieveMemories({
      sessionId,
      maxResults: 20,
      minImportance: 0.2
    });
  }

  extractMainTopics(memories) {
    return memories.map(m => m.metadata?.conversationTopic).filter(Boolean).slice(0, 5);
  }

  extractKeyDecisions(memories) {
    return memories.filter(m => m.content.keywords?.some(k =>
      ['decided', 'choose', 'selected', 'agreed'].some(term => k.toLowerCase().includes(term))
    )).map(m => m.content.compressed).slice(0, 3);
  }

  extractUnresolvedQuestions(memories) {
    return memories.filter(m => m.content.keywords?.some(k => k.includes('?')))
      .map(m => m.content.compressed).slice(0, 3);
  }

  analyzeConversationFlow(memories) {
    return memories.length > 5 ? 'detailed' : 'brief';
  }

  calculateSessionSentiment(memories) {
    const avgSentiment = memories.reduce((sum, m) => sum + (m.content.sentiment || 0), 0) / memories.length;
    return avgSentiment > 0.2 ? 'positive' : avgSentiment < -0.2 ? 'negative' : 'neutral';
  }

  analyzeProgressMade(memories) {
    return memories.length > 10 ? 'significant' : memories.length > 5 ? 'moderate' : 'initial';
  }

  identifyRecurringTopics(memories) {
    const topics = {};
    memories.forEach(m => {
      const topic = m.metadata?.conversationTopic;
      if (topic) topics[topic] = (topics[topic] || 0) + 1;
    });
    return Object.entries(topics).filter(([,count]) => count > 1).map(([topic]) => topic);
  }

  identifyEmergingPatterns(memories) {
    return []; // Placeholder for advanced pattern recognition
  }

  findContextualConnections(memories) {
    return []; // Placeholder for connection analysis
  }

  analyzeTopicEvolution(memories) {
    return []; // Placeholder for topic evolution tracking
  }

  parseContextToMemories(contextString) {
    return []; // Placeholder - would parse context string back to memory objects
  }

  getContextuallyRelevantMemories(userId, existingMemories) {
    return []; // Placeholder for contextual relevance analysis
  }

  mergeAndDeduplicateMemories(memories1, memories2) {
    const seen = new Set();
    const merged = [];

    [...memories1, ...memories2].forEach(memory => {
      if (!seen.has(memory.id)) {
        seen.add(memory.id);
        merged.push(memory);
      }
    });

    return merged;
  }

  scoreAndRankMemories(memories, currentPrompt) {
    return memories.sort((a, b) => (b.weights?.composite || 0) - (a.weights?.composite || 0));
  }

  extractRecentExchanges(memories) {
    return memories.slice(0, 3).map(m => m.content.compressed);
  }

  identifyCurrentFocus(memories) {
    return memories[0]?.metadata?.conversationTopic || null;
  }

  extractPendingQuestions(memories) {
    return memories.filter(m => m.content.keywords?.some(k => k.includes('?')))
      .map(m => m.content.compressed).slice(0, 2);
  }

  extractContextualCues(memories) {
    return memories.map(m => m.content.keywords).flat().slice(0, 5);
  }

  analyzeTopicProgression(memories) {
    return 'evolving'; // Simplified implementation
  }

  analyzeComplexityTrend(memories) {
    return 'increasing'; // Simplified implementation
  }

  analyzeQuestionEvolution(memories) {
    return 'deepening'; // Simplified implementation
  }

  analyzeKnowledgeBuilding(memories) {
    return 'progressive'; // Simplified implementation
  }

  calculateAverageSessionLength(memories) {
    return memories.length; // Simplified metric
  }

  calculateEngagementLevel(memories) {
    if (memories.length > 50) return 'high';
    if (memories.length > 20) return 'medium';
    if (memories.length > 5) return 'low';
    return 'new_user';
  }

  // ===== CACHING AND PRECOMPUTATION METHODS =====

  /**
   * Build context structure with intelligent caching
   * @param {string} userId
   * @param {string} sessionId
   * @param {string} [currentPrompt]
   * @returns {Promise<Object>}
   */
  async buildContextStructureWithCaching(userId, sessionId, currentPrompt = null) {
    const [
      userProfile,
      sessionSummary,
      conversationThemes,
      relevantMemories,
      recentContext
    ] = await Promise.all([
      this.getCachedUserProfile(userId),
      this.getCachedSessionSummary(sessionId),
      this.getCachedConversationThemes(userId, sessionId),
      this.getRelevantMemories(userId, sessionId, currentPrompt),
      this.getRecentContext(sessionId)
    ]);

    return {
      userProfile,
      sessionSummary,
      conversationThemes,
      relevantMemories,
      recentContext,
      metadata: {
        userId,
        sessionId,
        timestamp: new Date(),
        hasCurrentPrompt: !!currentPrompt,
        cached: true
      }
    };
  }

  /**
   * Get cached user profile or compute and cache
   * @param {string} userId
   * @returns {Promise<Object>}
   */
  async getCachedUserProfile(userId) {
    const cacheKey = `hierarchical_user_profile:${userId}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log(`🎯 Using cached user profile for ${userId}`);
        return cached;
      }
    }

    const profile = await this.getUserProfile(userId);

    if (this.cacheService && profile) {
      await this.cacheService.set(cacheKey, profile, this.config.userProfileCacheTTL);
      console.log(`💾 Cached user profile for ${userId}`);
    }

    return profile;
  }

  /**
   * Get cached session summary or compute and cache
   * @param {string} sessionId
   * @returns {Promise<Object>}
   */
  async getCachedSessionSummary(sessionId) {
    const cacheKey = `hierarchical_session_summary:${sessionId}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log(`🎯 Using cached session summary for ${sessionId}`);
        return cached;
      }
    }

    const summary = await this.getSessionSummary(sessionId);

    if (this.cacheService && summary) {
      await this.cacheService.set(cacheKey, summary, this.config.sessionSummaryCacheTTL);
      console.log(`💾 Cached session summary for ${sessionId}`);
    }

    return summary;
  }

  /**
   * Get cached conversation themes or compute and cache
   * @param {string} userId
   * @param {string} sessionId
   * @returns {Promise<Object>}
   */
  async getCachedConversationThemes(userId, sessionId) {
    const cacheKey = `conversation_themes:${userId}:${sessionId}`;

    if (this.cacheService) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log(`🎯 Using cached conversation themes for ${userId}:${sessionId}`);
        return cached;
      }
    }

    const themes = await this.getConversationThemes(userId, sessionId);

    if (this.cacheService && themes) {
      await this.cacheService.set(cacheKey, themes, this.config.themesCacheTTL);
      console.log(`💾 Cached conversation themes for ${userId}:${sessionId}`);
    }

    return themes;
  }

  /**
   * Generate cache key for complete context
   * @param {string} userId
   * @param {string} sessionId
   * @param {number} maxTokens
   * @param {string} [currentPrompt]
   * @returns {string}
   */
  generateContextCacheKey(userId, sessionId, maxTokens, currentPrompt = null) {
    const promptHash = currentPrompt ?
      require('crypto').createHash('md5').update(currentPrompt).digest('hex').substring(0, 8) :
      'no-prompt';

    return `hierarchical_context:${userId}:${sessionId}:${maxTokens}:${promptHash}`;
  }

  /**
   * Get cached complete context
   * @param {string} cacheKey
   * @returns {Promise<Object|null>}
   */
  async getCachedContext(cacheKey) {
    if (!this.cacheService) return null;

    try {
      return await this.cacheService.get(cacheKey);
    } catch (error) {
      console.warn('⚠️ Failed to get cached context:', error.message);
      return null;
    }
  }

  /**
   * Cache complete context
   * @param {string} cacheKey
   * @param {Object} context
   * @returns {Promise<void>}
   */
  async cacheContext(cacheKey, context) {
    if (!this.cacheService) return;

    try {
      await this.cacheService.set(cacheKey, context, this.config.contextCacheTTL);
      console.log(`💾 Cached complete context: ${cacheKey}`);
    } catch (error) {
      console.warn('⚠️ Failed to cache context:', error.message);
    }
  }

  /**
   * Track access for precomputation scheduling
   * @param {string} userId
   * @param {string} sessionId
   */
  trackAccess(userId, sessionId) {
    const key = `${userId}:${sessionId}`;
    const currentCount = this.accessCounts.get(key) || 0;
    this.accessCounts.set(key, currentCount + 1);
  }

  /**
   * Schedule precomputation if threshold reached
   * @param {string} userId
   * @param {string} sessionId
   */
  schedulePrecomputation(userId, sessionId) {
    const key = `${userId}:${sessionId}`;
    const accessCount = this.accessCounts.get(key) || 0;

    if (accessCount >= this.config.precomputeThreshold && !this.precomputeQueue.has(key)) {
      console.log(`📋 Scheduling precomputation for ${key} (${accessCount} accesses)`);

      this.precomputeQueue.set(key, {
        userId,
        sessionId,
        scheduledAt: Date.now(),
        priority: accessCount
      });

      // Execute precomputation asynchronously
      setImmediate(() => this.executePrecomputation(userId, sessionId));
    }
  }

  /**
   * Execute precomputation for frequently accessed contexts
   * @param {string} userId
   * @param {string} sessionId
   */
  async executePrecomputation(userId, sessionId) {
    try {
      console.log(`🔄 Executing precomputation for ${userId}:${sessionId}`);

      // Precompute common token sizes
      const commonTokenSizes = [512, 1024, 2048];

      for (const tokenSize of commonTokenSizes) {
        const cacheKey = this.generateContextCacheKey(userId, sessionId, tokenSize);
        const existing = await this.getCachedContext(cacheKey);

        if (!existing) {
          const contextStructure = await this.buildContextStructureWithCaching(userId, sessionId);
          const optimizedContext = await this.optimizeContextForTokens(contextStructure, tokenSize);
          await this.cacheContext(cacheKey, optimizedContext);

          console.log(`✅ Precomputed context for ${tokenSize} tokens`);
        }
      }

      // Remove from queue
      this.precomputeQueue.delete(`${userId}:${sessionId}`);

      console.log(`🎉 Precomputation completed for ${userId}:${sessionId}`);

    } catch (error) {
      console.error('❌ Precomputation failed:', error.message);
      this.precomputeQueue.delete(`${userId}:${sessionId}`);
    }
  }

  /**
   * Get caching statistics
   * @returns {Object}
   */
  getCachingStats() {
    return {
      accessCounts: Object.fromEntries(this.accessCounts),
      precomputeQueueSize: this.precomputeQueue.size,
      config: {
        userProfileCacheTTL: this.config.userProfileCacheTTL,
        sessionSummaryCacheTTL: this.config.sessionSummaryCacheTTL,
        themesCacheTTL: this.config.themesCacheTTL,
        contextCacheTTL: this.config.contextCacheTTL,
        precomputeThreshold: this.config.precomputeThreshold
      }
    };
  }

  /**
   * Clear caches for a user or session
   * @param {string} userId
   * @param {string} [sessionId]
   */
  async clearCaches(userId, sessionId = null) {
    if (!this.cacheService) return;

    try {
      const patterns = [
        `hierarchical_user_profile:${userId}`,
        `conversation_themes:${userId}:*`
      ];

      if (sessionId) {
        patterns.push(
          `hierarchical_session_summary:${sessionId}`,
          `hierarchical_context:${userId}:${sessionId}:*`
        );
      }

      // Note: This is a simplified implementation
      // In production, you'd need cache pattern deletion support
      console.log(`🧹 Cache clearing requested for patterns: ${patterns.join(', ')}`);

    } catch (error) {
      console.warn('⚠️ Failed to clear caches:', error.message);
    }
  }
}

// Singleton instance
let hierarchicalContextManagerInstance = null;

/**
 * Get the singleton instance of HierarchicalContextManager
 * @returns {HierarchicalContextManager}
 */
function getHierarchicalContextManager() {
  if (!hierarchicalContextManagerInstance) {
    hierarchicalContextManagerInstance = new HierarchicalContextManager();
  }
  return hierarchicalContextManagerInstance;
}

module.exports = { HierarchicalContextManager, getHierarchicalContextManager };
