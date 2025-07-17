/**
 * Simplified Memory Manager - Session-based conversation history
 *
 * SIMPLIFIED ARCHITECTURE:
 * - Session-only persistence (no cross-session contamination)
 * - Simple conversation history storage
 * - No complex weighting or analytics
 * - Minimal context to avoid voting interference
 */

const { v4: generateUUID } = require('uuid');

class MemoryManager {
  constructor() {
    this.sessionHistory = new Map(); // Session-based storage: sessionId -> conversation[]
    this.maxHistoryPerSession = 10; // Limit history to prevent memory bloat
  }

  /**
   * Store a simple conversation entry
   */
  async storeMemory(userId, sessionId, content, isUserPrompt, responseQuality = 0.5, modelUsed, ensembleMode = false) {
    const sessionKey = `${userId}:${sessionId}`;

    // Get or create session history
    if (!this.sessionHistory.has(sessionKey)) {
      this.sessionHistory.set(sessionKey, []);
    }

    const history = this.sessionHistory.get(sessionKey);

    // Create simple memory entry
    const memory = {
      id: generateUUID(),
      userId,
      sessionId,
      content: content.trim(),
      isUserPrompt: Boolean(isUserPrompt),
      timestamp: new Date(),
      // Simplified: only store essential fields for API compatibility
      responseQuality: responseQuality || 0.5,
      modelUsed: modelUsed || 'unknown',
      ensembleMode: Boolean(ensembleMode)
    };

    // Add to session history
    history.push(memory);

    // Keep only recent entries to prevent memory bloat
    if (history.length > this.maxHistoryPerSession) {
      history.shift(); // Remove oldest entry
    }

    // Return memory with simplified structure for API compatibility
    return {
      ...memory,
      // Add mock fields for API compatibility
      memoryType: isUserPrompt ? 'user_input' : 'ai_response',
      content: {
        importance: 0.5 // Simplified constant
      },
      weights: {
        composite: 0.5 // Simplified constant
      }
    };
  }

  /**
   * Retrieve memories for a session (simplified)
   */
  async retrieveMemories(params) {
    const { userId, sessionId, maxResults = 10 } = params;
    const sessionKey = `${userId}:${sessionId}`;

    const history = this.sessionHistory.get(sessionKey) || [];

    // Return recent entries, most recent first
    return history
      .slice(-maxResults) // Get last N entries
      .reverse(); // Most recent first
  }

  /**
   * Get minimal context for AI prompts (simplified to avoid voting interference)
   */
  async getMemoryContext(userId, sessionId, maxTokens = 1000, currentPrompt = null) {
    const sessionKey = `${userId}:${sessionId}`;
    const history = this.sessionHistory.get(sessionKey) || [];

    // Only use last 2-3 exchanges to minimize voting impact
    const recentHistory = history.slice(-6); // Last 3 user-AI pairs max

    if (recentHistory.length === 0) {
      return '';
    }

    // Build minimal context
    let context = '';
    let tokenCount = 0;

    for (const memory of recentHistory.reverse()) { // Most recent first
      const line = `${memory.isUserPrompt ? 'User' : 'AI'}: ${memory.content}`;
      const lineTokens = this.estimateTokenCount(line);

      if (tokenCount + lineTokens > maxTokens) {
        break;
      }

      context = line + '\n' + context;
      tokenCount += lineTokens;
    }

    return context.trim();
  }

  /**
   * Simple token estimation
   */
  estimateTokenCount(text) {
    return Math.ceil((text || '').length / 4);
  }

  /**
   * Clean up old sessions periodically (simplified)
   */
  scheduleIntelligentForgetting(hours = 24) {
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));

      for (const [sessionKey, history] of this.sessionHistory.entries()) {
        // Remove sessions where all entries are older than cutoff
        const recentEntries = history.filter(entry => entry.timestamp > cutoffTime);

        if (recentEntries.length === 0) {
          this.sessionHistory.delete(sessionKey);
        } else {
          this.sessionHistory.set(sessionKey, recentEntries);
        }
      }

      console.log(`🧹 Memory cleanup completed. Active sessions: ${this.sessionHistory.size}`);
    }, hours * 60 * 60 * 1000);
  }
}

let memoryManagerInstance = null;

function getMemoryManager() {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager();
  }
  return memoryManagerInstance;
}

module.exports = { MemoryManager, getMemoryManager };