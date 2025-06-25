const request = require('supertest');
const express = require('express');
const healthRoutes = require('../routes/health');

// Mock the OpenAI module
jest.mock('../config/openai', () => ({
  chat: {
    completions: {
      create: jest.fn()
    }
  }
}));

// Mock axios for external API calls
jest.mock('axios');
const axios = require('axios');

describe('Health Router', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use('/', healthRoutes);
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        message: 'Neurastack backend healthy 🚀'
      });
    });
  });

  describe('GET /openai-test', () => {
    it('should return 200 with OpenAI response when API call succeeds', async () => {
      const mockOpenAIResponse = {
        model: 'gpt-4o',
        choices: [{
          message: {
            content: 'This is a test response from OpenAI'
          }
        }]
      };

      const openai = require('../config/openai');
      openai.chat.completions.create.mockResolvedValue(mockOpenAIResponse);

      const response = await request(app)
        .get('/openai-test')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        model: 'gpt-4o',
        response: 'This is a test response from OpenAI'
      });

      expect(openai.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello! Can you provide a brief overview of the Neurastack backend project?' }]
      });
    });

    it('should return 500 when OpenAI API call fails', async () => {
      const openai = require('../config/openai');
      openai.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/openai-test')
        .expect(500);

      expect(response.body).toEqual({
        status: 'error',
        message: 'Failed to fetch response from OpenAI.'
      });
    });
  });

  describe('GET /xai-test', () => {
    it('should return 200 with xAI test message', async () => {
      const response = await request(app)
        .get('/xai-test')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        message: 'xAI test endpoint is working!'
      });
    });
  });

  describe('GET /xai-grok', () => {
    it('should return 200 with Grok response when API call succeeds', async () => {
      const mockGrokResponse = {
        data: {
          model: 'grok-3-mini',
          choices: [{
            message: {
              content: '42, of course! The answer to life, the universe, and everything.'
            }
          }]
        }
      };

      axios.post.mockResolvedValue(mockGrokResponse);

      const response = await request(app)
        .get('/xai-grok')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        model: 'grok-3-mini',
        response: '42, of course! The answer to life, the universe, and everything.'
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.x.ai/v1/chat/completions',
        {
          model: 'grok-3-mini',
          messages: [
            {
              role: 'system',
              content: 'You are Grok, a chatbot inspired by the Hitchhiker\'s Guide to the Galaxy.'
            },
            {
              role: 'user',
              content: 'What is the meaning of life, the universe, and everything?'
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should return 500 when X.AI API call fails', async () => {
      const mockError = {
        response: {
          data: { error: 'API Error' }
        }
      };

      axios.post.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/xai-grok')
        .expect(500);

      expect(response.body).toEqual({
        status: 'error',
        message: 'Failed to fetch response from X.AI.',
        error: { error: 'API Error' }
      });
    });

    it('should handle error without response data', async () => {
      const mockError = new Error('Network Error');
      axios.post.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/xai-grok')
        .expect(500);

      expect(response.body).toEqual({
        status: 'error',
        message: 'Failed to fetch response from X.AI.',
        error: 'Network Error'
      });
    });
  });

  describe('GET /gemini-test', () => {
    it('should return 200 with Gemini response when API call succeeds', async () => {
      const mockGeminiResponse = {
        data: {
          candidates: [{
            content: {
              parts: [{
                text: 'AI works by processing data through neural networks to learn patterns and make predictions.'
              }]
            }
          }]
        }
      };

      axios.post.mockResolvedValue(mockGeminiResponse);

      const response = await request(app)
        .get('/gemini-test')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        model: 'gemini-2.0-flash',
        response: 'AI works by processing data through neural networks to learn patterns and make predictions.'
      });

      expect(axios.post).toHaveBeenCalledWith(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: 'Explain how AI works in a few words'
                }
              ]
            }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should return default response when no content is returned', async () => {
      const mockGeminiResponse = {
        data: {
          candidates: []
        }
      };

      axios.post.mockResolvedValue(mockGeminiResponse);

      const response = await request(app)
        .get('/gemini-test')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        model: 'gemini-2.5-flash',
        response: 'No response'
      });
    });

    it('should return 500 when Gemini API call fails', async () => {
      const mockError = {
        response: {
          data: { error: 'API Error' }
        }
      };

      axios.post.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/gemini-test')
        .expect(500);

      expect(response.body).toEqual({
        status: 'error',
        message: 'Failed to fetch response from Gemini API.',
        error: { error: 'API Error' }
      });
    });

    it('should handle error without response data', async () => {
      const mockError = new Error('Network Error');
      axios.post.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/gemini-test')
        .expect(500);

      expect(response.body).toEqual({
        status: 'error',
        message: 'Failed to fetch response from Gemini API.',
        error: 'Network Error'
      });
    });
  });

  describe('GET /claude-test', () => {
    it('should return 200 with Claude response when API call succeeds', async () => {
      const mockClaudeResponse = {
        data: {
          model: 'claude-3-5-haiku-latest',
          content: [{
            text: 'Neural networks are computer systems inspired by the human brain. They consist of interconnected nodes (neurons) that process information by recognizing patterns in data, learning from examples to make predictions or decisions.'
          }]
        }
      };

      axios.post.mockResolvedValue(mockClaudeResponse);

      const response = await request(app)
        .get('/claude-test')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        model: 'claude-3-5-haiku-latest',
        response: 'Neural networks are computer systems inspired by the human brain. They consist of interconnected nodes (neurons) that process information by recognizing patterns in data, learning from examples to make predictions or decisions.'
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: 'Explain the concept of neural networks in simple terms'
            }
          ]
        },
        {
          headers: {
            'x-api-key': process.env.CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          }
        }
      );
    });

    it('should return 500 when Claude API call fails', async () => {
      const mockError = {
        response: {
          data: { error: 'API Error' }
        }
      };

      axios.post.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/claude-test')
        .expect(500);

      expect(response.body).toEqual({
        status: 'error',
        message: 'Failed to fetch response from Claude API.',
        error: { error: 'API Error' }
      });
    });

    it('should handle error without response data', async () => {
      const mockError = new Error('Network Error');
      axios.post.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/claude-test')
        .expect(500);

      expect(response.body).toEqual({
        status: 'error',
        message: 'Failed to fetch response from Claude API.',
        error: 'Network Error'
      });
    });
  });
});
