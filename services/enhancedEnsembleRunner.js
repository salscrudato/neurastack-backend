/**
 * 🧠 Enhanced Ensemble Runner - Optimized for low-cost, scalable AI coordination
 *
 * 🎯 PURPOSE: Coordinate AI models for better responses with low-cost focus.
 * 📋 OPTIMIZATIONS: Simplified queuing/metrics, low-cost models, enhanced caching, removed high-cost providers.
 */

const ensembleConfig = require('../config/ensemblePrompts');
const { models, systemPrompts, limits, meta } = ensembleConfig;
const clients = require('./vendorClients');
const { getMemoryManager } = require('./memoryManager');
const { v4: generateUUID } = require('uuid');
const cacheService = require('./cacheService');
const { getHierarchicalContextManager } = require('./hierarchicalContextManager');
const enhancedSynthesisService = require('./enhancedSynthesisService');
const monitoringService = require('./monitoringService');
const providerReliabilityService = require('./providerReliabilityService');

// Performance services (simplified)
const EnsemblePerformanceOptimizer = require('./ensemblePerformanceOptimizer');
const EnhancedEnsembleCache = require('./enhancedEnsembleCache');
const ParallelEnsembleProcessor = require('./parallelEnsembleProcessor');

class EnhancedEnsembleRunner {
  constructor() {
    this.memoryManager = getMemoryManager();
    this.requestQueue = []; // Simplified single queue
    this.activeRequests = new Map();
    this.metrics = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, averageProcessingTime: 0, concurrentRequests: 0, maxConcurrentRequests: 0 };
    this.config = { maxConcurrentRequests: meta.tier === 'free' ? 30 : 60, timeoutMs: 45000, retryAttempts: 3, retryDelayMs: 800, maxPromptLength: 6000 };
    this.usageTracker = { hourlyRequests: new Map(), dailyRequests: new Map() };
    this.performanceOptimizer = new EnsemblePerformanceOptimizer(cacheService, monitoringService);
    this.enhancedCache = new EnhancedEnsembleCache(cacheService, monitoringService);
    this.parallelProcessor = new ParallelEnsembleProcessor({ maxConcurrentModels: 3, modelTimeout: 15000 });
    this.startMetricsCollection(); // Simplified
  }

  startMetricsCollection() {
    setInterval(() => this.collectRealTimeMetrics(), 5000);
  }

  collectRealTimeMetrics() {
    this.metrics.concurrentRequests = this.activeRequests.size;
    this.metrics.maxConcurrentRequests = Math.max(this.metrics.maxConcurrentRequests, this.metrics.concurrentRequests);
  }

  async enqueueRequest(requestData) {
    if (this.requestQueue.length >= 150) throw new Error('Queue full.');
    const request = { id: generateUUID(), data: requestData, timestamp: Date.now(), retryCount: 0 };
    this.requestQueue.push(request);
    this.processQueue();
    return request.id;
  }

  async processQueue() {
    if (this.metrics.concurrentRequests >= this.config.maxConcurrentRequests) return;
    while (this.requestQueue.length > 0 && this.metrics.concurrentRequests < this.config.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      this.executeRequest(request);
    }
  }

  async executeRequest(request) {
    const startTime = Date.now();
    this.metrics.concurrentRequests++;
    this.activeRequests.set(request.id, request);
    try {
      const result = await this.runEnsemble(request.data.prompt, request.data.userId, request.data.sessionId);
      this.activeRequests.delete(request.id);
      this.metrics.concurrentRequests--;
      this.metrics.successfulRequests++;
      this.updateAverageProcessingTime(Date.now() - startTime);
      this.processQueue();
      return result;
    } catch (error) {
      this.handleRequestError(request, error, Date.now() - startTime);
      throw error;
    }
  }

  handleRequestError(request, error, processingTime) {
    this.activeRequests.delete(request.id);
    this.metrics.concurrentRequests--;
    this.metrics.failedRequests++;
    if (request.retryCount < this.config.retryAttempts && this.isRetryableError(error)) {
      request.retryCount++;
      const delay = this.config.retryDelayMs * Math.pow(2, request.retryCount - 1);
      setTimeout(() => { this.requestQueue.unshift(request); this.processQueue(); }, delay);
    } else {
      this.processQueue();
    }
  }

  isRetryableError(error) {
    return ['timeout', 'network', 'rate_limit'].some(type => error.message.toLowerCase().includes(type));
  }

  updateAverageProcessingTime(processingTime) {
    const total = this.metrics.successfulRequests;
    this.metrics.averageProcessingTime = ((this.metrics.averageProcessingTime * (total - 1)) + processingTime) / total;
  }

  async callRoleWithResilience(role, userPrompt, correlationId) {
    const { provider, model } = models[role];
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        return await this.executeRoleCall(role, userPrompt, provider, model);
      } catch (error) {
        if (attempt === this.config.retryAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs * Math.pow(2, attempt - 1)));
      }
    }
  }

  async executeRoleCall(role, userPrompt, provider, model) {
    const maxTokens = limits.maxTokensPerRole || 250;
    const startTime = Date.now();
    let response;
    switch (provider) {
      case 'openai':
        const openaiResp = await clients.openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompts[role] }, { role: 'user', content: userPrompt }], max_tokens: maxTokens });
        response = openaiResp.choices[0].message.content;
        break;
      case 'gemini':
        const geminiResp = await clients.gemini.post(`/models/gemini-1.5-flash:generateContent`, { contents: [{ parts: [{ text: `${systemPrompts[role]}\n\n${userPrompt}` }] }], generationConfig: { maxOutputTokens: maxTokens } });
        response = geminiResp.data.candidates[0].content.parts[0].text;
        break;
      case 'claude':
        const claudeResp = await clients.claude.post('/messages', { model: 'claude-3-5-haiku-latest', max_tokens: maxTokens, messages: [{ role: 'user', content: `${systemPrompts[role]}\n\n${userPrompt}` }] });
        response = claudeResp.data.content[0].text;
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    const responseTime = Date.now() - startTime;
    return { role, content: response, status: 'fulfilled', model, provider, responseTime };
  }

  async runEnsemble(userPrompt, userId = 'anonymous', sessionId = null) {
    const correlationId = generateUUID().substring(0, 8);
    const startTime = Date.now();
    if (userPrompt.length > this.config.maxPromptLength) throw new Error('Prompt too long.');
    const cached = await this.enhancedCache.getCachedEnsembleResponse(userPrompt, userId, meta.tier);
    if (cached) return { ...cached, cached: true };
    this.metrics.totalRequests++;
    if (meta.tier === 'free') this.checkRateLimit(userId);
    sessionId = sessionId || `session_${userId}_${Date.now()}`;
    let context = '';
    try {
      context = await getHierarchicalContextManager().getHierarchicalContext(userId, sessionId, limits.maxTokensPerRole * 0.7, userPrompt).context;
    } catch {}
    const enhancedPrompt = context ? `${context}\n\n${userPrompt}` : userPrompt;
    const rolePromises = ['gpt4o', 'gemini', 'claude'].map(role => this.callRoleWithResilience(role, enhancedPrompt, correlationId));
    const roleOutputs = await Promise.allSettled(rolePromises);
    const synthesisResult = await enhancedSynthesisService.synthesizeWithEnhancements(roleOutputs.map(r => r.value || { status: 'rejected', error: r.reason }), userPrompt, correlationId, {}, userId, sessionId);
    const processingTime = Date.now() - startTime;
    await this.enhancedCache.cacheEnsembleResponse(userPrompt, userId, meta.tier, { synthesis: synthesisResult, roles: roleOutputs });
    return { synthesis: synthesisResult, roles: roleOutputs.map(r => r.value || {}), metadata: { processingTime } };
  }

  checkRateLimit(userId) {
    // Simplified rate limit check
    const now = Date.now();
    const hourKey = Math.floor(now / 3600000);
    const count = this.usageTracker.hourlyRequests.get(`${userId}-${hourKey}`) || 0;
    if (count >= 750) throw new Error('Rate limit exceeded.');
    this.usageTracker.hourlyRequests.set(`${userId}-${hourKey}`, count + 1);
  }

  getMetrics() {
    return this.metrics;
  }

  async healthCheck() {
    return { ensemble: { isHealthy: true, metrics: this.getMetrics() } };
  }
}

module.exports = new EnhancedEnsembleRunner();