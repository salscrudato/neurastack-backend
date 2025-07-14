/**
 * Memory Manager - Simplified in-memory conversation storage
 */

const { v4: generateUUID } = require('uuid');

class MemoryManager {
  constructor() {
    this.localCache = new Map(); // In-memory storage
  }

  async storeMemory(userId, sessionId, content, isUserPrompt, responseQuality = 0.5, modelUsed, ensembleMode = false) {
    const memory = {
      id: generateUUID(),
      userId,
      sessionId,
      content,
      isUserPrompt,
      responseQuality,
      modelUsed,
      ensembleMode,
      createdAt: new Date()
    };
    this.localCache.set(memory.id, memory);
    return memory;
  }

  async retrieveMemories(params) {
    const { userId, sessionId, maxResults = 10 } = params;
    return Array.from(this.localCache.values())
      .filter(m => m.userId === userId && (!sessionId || m.sessionId === sessionId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, maxResults);
  }

  async getMemoryContext(userId, sessionId, maxTokens = 2048, currentPrompt = null) {
    const memories = await this.retrieveMemories({ userId, sessionId });
    let context = '';
    for (const memory of memories) {
      const memoryText = memory.content;
      if (this.estimateTokenCount(context + memoryText) <= maxTokens) {
        context += `${memoryText}\n`;
      } else {
        break;
      }
    }
    return context.trim();
  }

  estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
  }

  scheduleIntelligentForgetting(hours) {
    // Simple implementation - clear old memories periodically
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
      for (const [id, memory] of this.localCache.entries()) {
        if (memory.createdAt < cutoffTime) {
          this.localCache.delete(id);
        }
      }
    }, hours * 60 * 60 * 1000); // Run every specified hours
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