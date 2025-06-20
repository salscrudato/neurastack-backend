/**
 * Memory Management API Routes
 * Provides endpoints for storing, retrieving, and managing AI ensemble memories
 */

const express = require('express');
const { getMemoryManager } = require('../services/memoryManager');
const securityMiddleware = require('../middleware/securityMiddleware');

const router = express.Router();

/**
 * Validation middleware for memory operations
 */
const validateMemoryRequest = (req, res, next) => {
  const { userId } = req.body;
  
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'userId is required and must be a non-empty string'
    });
  }
  
  next();
};

/**
 * Store a new memory
 * POST /memory/store
 */
router.post('/store', validateMemoryRequest, async (req, res) => {
  try {
    const {
      userId,
      sessionId,
      content,
      isUserPrompt = true,
      responseQuality,
      modelUsed,
      ensembleMode = false
    } = req.body;

    const userTier = req.userTier || 'free';

    // Check rate limits for free tier
    if (userTier === 'free') {
      const rateLimitResult = securityMiddleware.checkRateLimit(userId, 'memory');
      if (!rateLimitResult.allowed) {
        return res.status(429).json({
          status: 'error',
          message: 'Rate limit exceeded',
          details: rateLimitResult.message,
          retryAfter: rateLimitResult.retryAfter || 60,
          timestamp: new Date().toISOString(),
          correlationId
        });
      }
    }

    // Validate required fields
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sessionId is required and must be a string'
      });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'content is required and must be a non-empty string'
      });
    }

    if (content.length > 25000) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'content must be less than 25,000 characters'
      });
    }

    // Validate optional fields
    if (responseQuality !== undefined && (typeof responseQuality !== 'number' || responseQuality < 0 || responseQuality > 1)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'responseQuality must be a number between 0 and 1'
      });
    }

    const memory = await getMemoryManager().storeMemory(
      userId.trim(),
      sessionId.trim(),
      content.trim(),
      Boolean(isUserPrompt),
      responseQuality,
      modelUsed,
      Boolean(ensembleMode)
    );

    res.json({
      success: true,
      memoryId: memory.id,
      memoryType: memory.memoryType,
      importance: memory.content.importance,
      compositeScore: memory.weights.composite
    });
  } catch (error) {
    console.error('❌ Memory store error:', error);
    res.status(500).json({
      error: 'Failed to store memory',
      message: 'An internal error occurred while storing the memory'
    });
  }
});

/**
 * Retrieve memories based on criteria
 * POST /memory/retrieve
 */
router.post('/retrieve', validateMemoryRequest, async (req, res) => {
  try {
    const {
      userId,
      sessionId,
      memoryTypes,
      maxResults = 10,
      minImportance = 0.3,
      includeArchived = false,
      query
    } = req.body;

    // Validate optional fields
    if (memoryTypes && (!Array.isArray(memoryTypes) || 
        !memoryTypes.every(type => ['working', 'short_term', 'long_term', 'semantic', 'episodic'].includes(type)))) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'memoryTypes must be an array of valid memory types'
      });
    }

    if (typeof maxResults !== 'number' || maxResults < 1 || maxResults > 50) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'maxResults must be a number between 1 and 50'
      });
    }

    if (typeof minImportance !== 'number' || minImportance < 0 || minImportance > 1) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'minImportance must be a number between 0 and 1'
      });
    }

    const memories = await getMemoryManager().retrieveMemories({
      userId: userId.trim(),
      sessionId: sessionId?.trim(),
      memoryTypes,
      maxResults,
      minImportance,
      includeArchived: Boolean(includeArchived),
      query: query?.trim()
    });

    res.json({
      success: true,
      memories: memories.map(memory => ({
        id: memory.id,
        memoryType: memory.memoryType,
        content: {
          compressed: memory.content.compressed,
          keywords: memory.content.keywords,
          concepts: memory.content.concepts,
          importance: memory.content.importance
        },
        metadata: {
          timestamp: memory.metadata.timestamp,
          conversationTopic: memory.metadata.conversationTopic,
          userIntent: memory.metadata.userIntent,
          modelUsed: memory.metadata.modelUsed
        },
        weights: memory.weights,
        createdAt: memory.createdAt
      })),
      totalCount: memories.length
    });
  } catch (error) {
    console.error('❌ Memory retrieve error:', error);
    res.status(500).json({
      error: 'Failed to retrieve memories',
      message: 'An internal error occurred while retrieving memories'
    });
  }
});

/**
 * Get memory context for AI prompts
 * POST /memory/context
 */
router.post('/context', validateMemoryRequest, async (req, res) => {
  try {
    const {
      userId,
      sessionId,
      maxTokens = 2048
    } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'sessionId is required and must be a string'
      });
    }

    if (typeof maxTokens !== 'number' || maxTokens < 100 || maxTokens > 8000) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'maxTokens must be a number between 100 and 8000'
      });
    }

    const context = await getMemoryManager().getMemoryContext(
      userId.trim(),
      sessionId.trim(),
      maxTokens
    );

    res.json({
      success: true,
      context,
      estimatedTokens: Math.ceil(context.length / 4)
    });
  } catch (error) {
    console.error('❌ Memory context error:', error);
    res.status(500).json({
      error: 'Failed to get memory context',
      message: 'An internal error occurred while generating memory context'
    });
  }
});

/**
 * Get memory analytics for a user
 * GET /memory/analytics/:userId
 */
router.get('/analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'userId is required and must be a non-empty string'
      });
    }

    const metrics = await getMemoryManager().getMemoryMetrics(userId.trim());

    res.json({
      success: true,
      userId,
      metrics
    });
  } catch (error) {
    console.error('❌ Memory analytics error:', error);
    res.status(500).json({
      error: 'Failed to get memory analytics',
      message: 'An internal error occurred while calculating analytics'
    });
  }
});

/**
 * Health check for memory system
 * GET /memory/health
 */
router.get('/health', async (req, res) => {
  try {
    // Test memory manager functionality
    const testUserId = 'health-check-user';
    const testSessionId = 'health-check-session';
    const testContent = 'Health check test content';

    // Try to store and retrieve a test memory
    const manager = getMemoryManager();
    const memory = await manager.storeMemory(
      testUserId,
      testSessionId,
      testContent,
      true,
      0.5,
      'health-check',
      false
    );

    const retrieved = await manager.retrieveMemories({
      userId: testUserId,
      sessionId: testSessionId,
      maxResults: 1
    });

    const isHealthy = memory && retrieved.length > 0;

    res.json({
      status: isHealthy ? 'healthy' : 'degraded',
      message: isHealthy ? 'Memory system is operational' : 'Memory system has issues',
      timestamp: new Date().toISOString(),
      details: {
        firestoreAvailable: manager.isFirestoreAvailable,
        localCacheSize: manager.localCache.size,
        testMemoryStored: !!memory,
        testMemoryRetrieved: retrieved.length > 0
      }
    });
  } catch (error) {
    console.error('❌ Memory health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      message: 'Memory system health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
