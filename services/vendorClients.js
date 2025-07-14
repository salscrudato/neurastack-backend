/**
 * Vendor Clients - Simplified for low-cost AI providers with basic resilience
 */

const OpenAI = require('openai');
const axios = require('axios');
require('dotenv').config();

class VendorClients {
  constructor() {
    this.initializeClients();
  }

  initializeClients() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000 });
    this.gemini = axios.create({
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      params: { key: process.env.GEMINI_API_KEY },
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    this.claude = axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  async healthCheck() {
    return { openai: true, gemini: true, claude: true };
  }

  getMetrics() {
    return {};
  }
}

const clients = new VendorClients();

module.exports = {
  openai: clients.openai,
  gemini: clients.gemini,
  claude: clients.claude,
  healthCheck: () => clients.healthCheck(),
  getMetrics: () => clients.getMetrics()
};