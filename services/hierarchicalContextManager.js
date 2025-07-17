/**
 * Simplified Hierarchical Context Manager
 *
 * SIMPLIFIED APPROACH:
 * - Minimal context to avoid voting interference
 * - Session-only context (no cross-session contamination)
 * - Optional context that can be disabled
 */

const { getMemoryManager } = require('./memoryManager');

class HierarchicalContextManager {
  constructor() {
    this.memoryManager = getMemoryManager();
    this.contextEnabled = process.env.MEMORY_CONTEXT_ENABLED === 'true' || false; // Disabled by default
  }

  /**
   * Get simplified context that won't interfere with voting
   */
  async getHierarchicalContext(userId, sessionId, maxTokens = 1000, currentPrompt = null) {
    // Return empty context if disabled (prevents voting interference)
    if (!this.contextEnabled) {
      return {
        context: '',
        totalTokens: 0,
        contextEnabled: false,
        reason: 'Memory context disabled to prevent voting interference'
      };
    }

    // Get minimal context from memory manager
    const context = await this.memoryManager.getMemoryContext(userId, sessionId, maxTokens, currentPrompt);

    return {
      context,
      totalTokens: this.memoryManager.estimateTokenCount(context),
      contextEnabled: true,
      entriesUsed: context ? context.split('\n').length : 0
    };
  }

  /**
   * Enable/disable context for testing
   */
  setContextEnabled(enabled) {
    this.contextEnabled = enabled;
    console.log(`🧠 Memory context ${enabled ? 'enabled' : 'disabled'}`);
  }
}

let hierarchicalContextManagerInstance = null;

function getHierarchicalContextManager() {
  if (!hierarchicalContextManagerInstance) {
    hierarchicalContextManagerInstance = new HierarchicalContextManager();
  }
  return hierarchicalContextManagerInstance;
}

module.exports = { HierarchicalContextManager, getHierarchicalContextManager };