const request = require('supertest');
const app = require('../index');

// Mock the enhanced ensemble service for default-ensemble endpoint
jest.mock('../services/enhancedEnsembleRunner', () => ({
  runEnsemble: jest.fn()
}));

const enhancedEnsemble = require('../services/enhancedEnsembleRunner');

describe('Default Ensemble Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful enhanced ensemble response for default-ensemble endpoint
    enhancedEnsemble.runEnsemble.mockResolvedValue({
      synthesis: {
        content: 'Enhanced synthesized response with memory integration and confidence scoring.',
        confidence: 0.92,
        qualityScore: 0.88,
        metadata: {
          model: 'gpt-4o',
          provider: 'openai',
          processingTimeMs: 1250,
          tokenCount: 45
        }
      },
      roles: [
        {
          role: 'gpt4o',
          content: 'GPT-4o-mini response with memory context integration.',
          confidence: 0.89,
          quality: 0.85,
          metadata: {
            model: 'gpt-4o-mini',
            provider: 'openai',
            processingTimeMs: 850,
            tokenCount: 38,
            status: 'fulfilled'
          }
        },
        {
          role: 'gemini',
          content: 'Gemini Flash response leveraging conversation history.',
          confidence: 0.91,
          quality: 0.87,
          metadata: {
            model: 'gemini-1.5-flash',
            provider: 'gemini',
            processingTimeMs: 920,
            tokenCount: 42,
            status: 'fulfilled'
          }
        },
        {
          role: 'claude',
          content: 'Claude Haiku response with contextual awareness.',
          confidence: 0.86,
          quality: 0.83,
          metadata: {
            model: 'claude-3-5-haiku-latest',
            provider: 'claude',
            processingTimeMs: 780,
            tokenCount: 35,
            status: 'fulfilled'
          }
        }
      ],
      metadata: {
        totalProcessingTimeMs: 2850,
        memoryContextUsed: true,
        memoryTokensUsed: 156,
        confidenceAnalysis: {
          averageConfidence: 0.89,
          confidenceRange: 0.05,
          highConfidenceResponses: 3
        },
        costEstimate: {
          totalCost: 0.0085,
          breakdown: {
            gpt4o: 0.0032,
            gemini: 0.0018,
            claude: 0.0015,
            synthesis: 0.0020
          }
        },
        tier: 'free',
        responseQuality: 0.85
      }
    });
  });

  test('POST /default-ensemble should return synthesized response', async () => {
    const testPrompt = 'Should companies adopt AI for customer service?';

    const response = await request(app)
      .post('/default-ensemble')
      .send({ prompt: testPrompt })
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data).toBeDefined();
    expect(response.body.data.prompt).toBe(testPrompt);
    expect(response.body.data.userId).toBe('anonymous');
    expect(response.body.data.synthesis).toBeDefined();
    expect(response.body.data.roles).toHaveLength(3);
    expect(response.body.data.metadata.timestamp).toBeDefined();
    expect(response.body.data.synthesis.content).toBe('Enhanced synthesized response with memory integration and confidence scoring.');

    expect(enhancedEnsemble.runEnsemble).toHaveBeenCalledWith(testPrompt, 'anonymous', expect.any(String));
  });

  test('POST /default-ensemble should handle x-user-id header', async () => {
    const testPrompt = 'Test prompt';
    const userId = 'user123';

    const response = await request(app)
      .post('/default-ensemble')
      .set('x-user-id', userId)
      .send({ prompt: testPrompt })
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data.userId).toBe(userId);
    expect(enhancedEnsemble.runEnsemble).toHaveBeenCalledWith(testPrompt, userId, expect.any(String));
  });

  test('POST /default-ensemble should handle default prompt', async () => {
    const response = await request(app)
      .post('/default-ensemble')
      .send({})
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data.prompt).toBe('Quick sanity check: explain AI in 1-2 lines.');
    expect(response.body.data.userId).toBe('anonymous');
  });

  test('POST /default-ensemble should handle empty request body', async () => {
    const response = await request(app)
      .post('/default-ensemble')
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data.synthesis).toBeDefined();
  });

  test('POST /default-ensemble should handle ensemble errors', async () => {
    enhancedEnsemble.runEnsemble.mockRejectedValue(new Error('Ensemble service failed'));

    const response = await request(app)
      .post('/default-ensemble')
      .send({ prompt: 'Test prompt' })
      .expect(500);

    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Enhanced ensemble processing failed. Our team has been notified.');
    expect(response.body.error).toBe('Internal server error');
    expect(response.body.supportInfo).toBeDefined();
  });
});
