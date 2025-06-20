const request = require('supertest');
const app = require('../index');

// Mock the ensemble service to avoid real API calls in tests
jest.mock('../services/ensembleRunner', () => ({
  runEnsemble: jest.fn()
}));

const ensemble = require('../services/ensembleRunner');

describe('4-AI Ensemble Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful ensemble response
    ensemble.runEnsemble.mockResolvedValue({
      synthesis: {
        content: 'This is a synthesized response combining all perspectives.',
        model: 'gpt-4o',
        provider: 'openai',
        status: 'success'
      },
      roles: [
        {
          role: 'gpt4o',
          content: 'GPT-4o response content',
          model: 'gpt-4o',
          provider: 'openai',
          status: 'fulfilled',
          wordCount: 25
        },
        {
          role: 'gemini',
          content: 'Gemini response content',
          model: 'gemini-2.0-flash',
          provider: 'gemini',
          status: 'fulfilled',
          wordCount: 30
        },
        {
          role: 'claude',
          content: 'Claude response content',
          model: 'claude-opus-4-20250514',
          provider: 'claude',
          status: 'fulfilled',
          wordCount: 28
        }
      ],
      metadata: {
        totalRoles: 3,
        successfulRoles: 3,
        failedRoles: 0,
        synthesisStatus: 'success'
      }
    });
  });

  test('POST /ensemble-test should return synthesized response', async () => {
    const testPrompt = 'Should companies adopt AI for customer service?';

    const response = await request(app)
      .post('/ensemble-test')
      .send({ prompt: testPrompt })
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data).toBeDefined();
    expect(response.body.data.prompt).toBe(testPrompt);
    expect(response.body.data.userId).toBe('anonymous');
    expect(response.body.data.synthesis).toBeDefined();
    expect(response.body.data.roles).toHaveLength(3);
    expect(response.body.data.metadata.timestamp).toBeDefined();
    expect(response.body.data.synthesis.content).toBe('This is a synthesized response combining all perspectives.');

    expect(ensemble.runEnsemble).toHaveBeenCalledWith(testPrompt, 'anonymous', expect.any(String));
  });

  test('POST /ensemble-test should handle x-user-id header', async () => {
    const testPrompt = 'Test prompt';
    const userId = 'user123';

    const response = await request(app)
      .post('/ensemble-test')
      .set('x-user-id', userId)
      .send({ prompt: testPrompt })
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data.userId).toBe(userId);
    expect(ensemble.runEnsemble).toHaveBeenCalledWith(testPrompt, userId, expect.any(String));
  });

  test('POST /ensemble-test should handle default prompt', async () => {
    const response = await request(app)
      .post('/ensemble-test')
      .send({})
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data.prompt).toBe('Quick sanity check: explain AI in 1-2 lines.');
    expect(response.body.data.userId).toBe('anonymous');
  });

  test('POST /ensemble-test should handle empty request body', async () => {
    const response = await request(app)
      .post('/ensemble-test')
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data.synthesis).toBeDefined();
  });

  test('POST /ensemble-test should handle ensemble errors', async () => {
    ensemble.runEnsemble.mockRejectedValue(new Error('Ensemble service failed'));

    const response = await request(app)
      .post('/ensemble-test')
      .send({ prompt: 'Test prompt' })
      .expect(500);

    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Ensemble failed.');
    expect(response.body.error).toBe('Ensemble service failed');
    expect(response.body.timestamp).toBeDefined();
  });
});
