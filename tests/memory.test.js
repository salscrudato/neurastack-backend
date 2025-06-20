/**
 * Memory Management System Tests
 * Tests for the AI ensemble memory functionality
 */

const request = require('supertest');
const app = require('../index');

describe('Memory Management System', () => {
  const testUserId = 'test-user-memory';
  const testSessionId = 'test-session-memory';
  let testMemoryId = null;

  beforeAll(async () => {
    // Wait for app initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Memory Storage', () => {
    test('should store a user prompt memory', async () => {
      const response = await request(app)
        .post('/memory/store')
        .send({
          userId: testUserId,
          sessionId: testSessionId,
          content: 'How do I implement a microservice architecture?',
          isUserPrompt: true,
          responseQuality: 0.8,
          modelUsed: 'test-model',
          ensembleMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.memoryId).toBeDefined();
      expect(response.body.memoryType).toBeDefined();
      expect(response.body.importance).toBeGreaterThan(0);
      expect(response.body.compositeScore).toBeGreaterThan(0);

      testMemoryId = response.body.memoryId;
    });

    test('should store an AI response memory', async () => {
      const response = await request(app)
        .post('/memory/store')
        .send({
          userId: testUserId,
          sessionId: testSessionId,
          content: 'Microservice architecture involves breaking down applications into smaller, independent services that communicate via APIs. Key benefits include scalability, technology diversity, and fault isolation.',
          isUserPrompt: false,
          responseQuality: 0.9,
          modelUsed: 'gpt-4o',
          ensembleMode: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.memoryId).toBeDefined();
    });

    test('should reject invalid memory storage requests', async () => {
      const response = await request(app)
        .post('/memory/store')
        .send({
          userId: '', // Invalid empty userId
          sessionId: testSessionId,
          content: 'Test content'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    test('should reject content that is too long', async () => {
      const longContent = 'a'.repeat(25001); // Exceeds 25,000 character limit
      
      const response = await request(app)
        .post('/memory/store')
        .send({
          userId: testUserId,
          sessionId: testSessionId,
          content: longContent
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('25,000 characters');
    });
  });

  describe('Memory Retrieval', () => {
    test('should retrieve memories for a user', async () => {
      const response = await request(app)
        .post('/memory/retrieve')
        .send({
          userId: testUserId,
          maxResults: 10,
          minImportance: 0.1
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.memories)).toBe(true);
      expect(response.body.memories.length).toBeGreaterThan(0);
      expect(response.body.totalCount).toBeGreaterThan(0);

      // Check memory structure
      const memory = response.body.memories[0];
      expect(memory.id).toBeDefined();
      expect(memory.memoryType).toBeDefined();
      expect(memory.content).toBeDefined();
      expect(memory.content.compressed).toBeDefined();
      expect(memory.content.keywords).toBeDefined();
      expect(memory.content.concepts).toBeDefined();
      expect(memory.weights).toBeDefined();
    });

    test('should retrieve memories for a specific session', async () => {
      const response = await request(app)
        .post('/memory/retrieve')
        .send({
          userId: testUserId,
          sessionId: testSessionId,
          maxResults: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.memories.length).toBeGreaterThan(0);
    });

    test('should filter memories by memory types', async () => {
      const response = await request(app)
        .post('/memory/retrieve')
        .send({
          userId: testUserId,
          memoryTypes: ['short_term', 'long_term'],
          maxResults: 10
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // All returned memories should be of the specified types
      response.body.memories.forEach(memory => {
        expect(['short_term', 'long_term']).toContain(memory.memoryType);
      });
    });

    test('should search memories with query', async () => {
      const response = await request(app)
        .post('/memory/retrieve')
        .send({
          userId: testUserId,
          query: 'microservice',
          maxResults: 5
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Results should contain the search term
      if (response.body.memories.length > 0) {
        const hasSearchTerm = response.body.memories.some(memory => 
          memory.content.compressed.toLowerCase().includes('microservice') ||
          memory.content.keywords.some(keyword => keyword.includes('microservice')) ||
          memory.content.concepts.some(concept => concept.includes('microservice'))
        );
        expect(hasSearchTerm).toBe(true);
      }
    });

    test('should reject invalid retrieval requests', async () => {
      const response = await request(app)
        .post('/memory/retrieve')
        .send({
          userId: '', // Invalid empty userId
          maxResults: 10
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });
  });

  describe('Memory Context', () => {
    test('should generate memory context for AI prompts', async () => {
      const response = await request(app)
        .post('/memory/context')
        .send({
          userId: testUserId,
          sessionId: testSessionId,
          maxTokens: 1000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(typeof response.body.context).toBe('string');
      expect(response.body.estimatedTokens).toBeDefined();
      expect(response.body.estimatedTokens).toBeLessThanOrEqual(1000);
    });

    test('should handle empty context gracefully', async () => {
      const response = await request(app)
        .post('/memory/context')
        .send({
          userId: 'non-existent-user',
          sessionId: 'non-existent-session',
          maxTokens: 500
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.context).toBe('');
      expect(response.body.estimatedTokens).toBe(0);
    });
  });

  describe('Memory Analytics', () => {
    test('should provide memory analytics for a user', async () => {
      const response = await request(app)
        .get(`/memory/analytics/${testUserId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe(testUserId);
      expect(response.body.metrics).toBeDefined();
      expect(response.body.metrics.totalMemories).toBeGreaterThan(0);
      expect(response.body.metrics.memoryTypes).toBeDefined();
      expect(response.body.metrics.averageImportance).toBeGreaterThan(0);
      expect(response.body.metrics.averageCompositeScore).toBeGreaterThan(0);
    });

    test('should handle analytics for non-existent user', async () => {
      const response = await request(app)
        .get('/memory/analytics/non-existent-user');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metrics.totalMemories).toBe(0);
    });
  });

  describe('Memory Health Check', () => {
    test('should perform memory system health check', async () => {
      const response = await request(app)
        .get('/memory/health');

      expect(response.status).toBe(200);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.details).toBeDefined();
      expect(typeof response.body.details.firestoreAvailable).toBe('boolean');
      expect(typeof response.body.details.localCacheSize).toBe('number');
    });
  });

  describe('Ensemble Integration', () => {
    test('should integrate memory with ensemble endpoint', async () => {
      const response = await request(app)
        .post('/ensemble-test')
        .send({
          prompt: 'What are the best practices for API design in microservices?',
          sessionId: testSessionId
        })
        .set('X-User-Id', testUserId);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.sessionId).toBe(testSessionId);
      expect(response.body.data.userId).toBe(testUserId);
      expect(response.body.data.metadata.memoryContextUsed).toBeDefined();
      expect(response.body.data.metadata.responseQuality).toBeDefined();
    });
  });
});

describe('Memory System Edge Cases', () => {
  test('should handle concurrent memory operations', async () => {
    const testUserId = 'concurrent-test-user';
    const testSessionId = 'concurrent-test-session';
    
    // Create multiple concurrent store operations
    const storePromises = Array.from({ length: 5 }, (_, i) => 
      request(app)
        .post('/memory/store')
        .send({
          userId: testUserId,
          sessionId: testSessionId,
          content: `Concurrent test content ${i}`,
          isUserPrompt: true
        })
    );

    const results = await Promise.all(storePromises);
    
    // All operations should succeed
    results.forEach(response => {
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    // Verify all memories were stored
    const retrieveResponse = await request(app)
      .post('/memory/retrieve')
      .send({
        userId: testUserId,
        sessionId: testSessionId,
        maxResults: 10
      });

    expect(retrieveResponse.body.memories.length).toBe(5);
  });

  test('should handle malformed requests gracefully', async () => {
    const response = await request(app)
      .post('/memory/store')
      .send({
        // Missing required fields
        content: 'Test content'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request');
  });
});
