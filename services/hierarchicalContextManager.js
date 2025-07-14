/**
 * Hierarchical Context Manager - Simplified in-memory context retrieval
 */

const { getMemoryManager } = require('./memoryManager');

class HierarchicalContextManager {
  constructor() {
    this.memoryManager = getMemoryManager();
  }

  async getHierarchicalContext(userId, sessionId, maxTokens = 2048, currentPrompt = null) {
    const memories = await this.memoryManager.retrieveMemories({ userId, sessionId, maxResults: 10 });
    let context = memories.map(m => m.content).join('\n');
    const tokens = Math.ceil(context.length / 4);
    if (tokens > maxTokens) {
      context = context.substring(0, maxTokens * 4) + '...';
    }
    return { context, totalTokens: Math.ceil(context.length / 4) };
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