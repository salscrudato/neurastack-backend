/**
 * 🤖 Model Configuration Service - Database-Driven AI Model Management
 * 
 * 🎯 PURPOSE: Manage AI model configurations dynamically without code changes
 * 
 * 📋 EXECUTION FLOW:
 * 1. Load model configurations from database
 * 2. Provide real-time model switching capabilities
 * 3. Track model performance and costs
 * 4. Enable/disable models without deployment
 * 
 * 💡 BENEFITS:
 * - 🔄 Dynamic model switching without code changes
 * - 📊 Real-time performance tracking
 * - 💰 Cost monitoring and optimization
 * - 🎛️ Simple admin interface for model management
 * - 🔧 A/B testing capabilities
 */

const admin = require('firebase-admin');
const { v4: generateUUID } = require('uuid');

/**
 * 🤖 Model Configuration Manager Class
 */
class ModelConfigService {
  constructor() {
    // 🔥 STEP 1: Initialize database connection
    this.db = null;
    this.isFirestoreAvailable = false;
    
    // 📊 STEP 2: Initialize performance tracking
    this.modelMetrics = new Map();
    this.costTracking = new Map();
    
    // ⚡ STEP 3: Initialize cache for fast access
    this.configCache = new Map();
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
    
    // 🔧 STEP 4: Initialize service
    this.initializeService();
  }

  /**
   * 🔧 Initialize the model configuration service
   */
  async initializeService() {
    try {
      // 🔥 Connect to Firestore database
      if (admin.apps.length > 0) {
        this.db = admin.firestore();
        this.isFirestoreAvailable = true;
        console.log('🤖 Model Configuration Service initialized with Firestore');
        
        // 📋 Ensure default models exist
        await this.ensureDefaultModels();
      } else {
        console.warn('⚠️ Firebase not available - using fallback configuration');
        this.initializeFallbackConfig();
      }
    } catch (error) {
      console.error('❌ Failed to initialize Model Configuration Service:', error.message);
      this.initializeFallbackConfig();
    }
  }

  /**
   * 📋 Ensure default AI models exist in database
   */
  async ensureDefaultModels() {
    try {
      const modelsRef = this.db.collection('ai_models');
      const snapshot = await modelsRef.get();
      
      // 🔍 Check if models already exist
      if (!snapshot.empty) {
        console.log('✅ AI models already configured in database');
        return;
      }

      // 🔧 Create default model configurations
      const defaultModels = [
        {
          id: 'gpt-4o-mini-free',
          name: 'GPT-4o Mini (Free)',
          provider: 'openai',
          model: 'gpt-4o-mini',
          tier: 'free',
          isActive: true,
          priority: 1,
          costPerInputToken: 0.00015,
          costPerOutputToken: 0.0006,
          maxTokens: 800,
          timeoutMs: 30000,
          description: 'Cost-optimized GPT model for free tier users',
          capabilities: ['text-generation', 'reasoning', 'analysis']
        },
        {
          id: 'gemini-1-5-flash-free',
          name: 'Gemini 1.5 Flash (Free)',
          provider: 'gemini',
          model: 'gemini-1.5-flash',
          tier: 'free',
          isActive: true,
          priority: 2,
          costPerInputToken: 0.000075, // Lower cost than 2.5 Flash
          costPerOutputToken: 0.0003,
          maxTokens: 1200, // Increased token limit to encourage longer responses
          timeoutMs: 30000,
          description: 'Cost-effective Gemini model optimized for longer, detailed responses',
          capabilities: ['text-generation', 'multimodal', 'reasoning']
        },
        {
          id: 'claude-3-5-haiku-free',
          name: 'Claude 3.5 Haiku (Free)',
          provider: 'claude',
          model: 'claude-3-5-haiku-latest',
          tier: 'free',
          isActive: true,
          priority: 3,
          costPerInputToken: 0.00025,
          costPerOutputToken: 0.00125,
          maxTokens: 800,
          timeoutMs: 30000,
          description: 'Fast Claude model optimized for quick responses',
          capabilities: ['text-generation', 'analysis', 'reasoning']
        },
        {
          id: 'gpt-4o-premium',
          name: 'GPT-4o (Premium)',
          provider: 'openai',
          model: 'gpt-4o',
          tier: 'premium',
          isActive: true,
          priority: 1,
          costPerInputToken: 0.005,
          costPerOutputToken: 0.015,
          maxTokens: 1500,
          timeoutMs: 60000,
          description: 'Full-featured GPT-4o for premium users',
          capabilities: ['text-generation', 'reasoning', 'analysis', 'multimodal']
        }
      ];

      // 💾 Save default models to database
      const batch = this.db.batch();
      defaultModels.forEach(model => {
        const docRef = modelsRef.doc(model.id);
        batch.set(docRef, {
          ...model,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log('✅ Default AI models created in database');

    } catch (error) {
      console.error('❌ Failed to create default models:', error.message);
    }
  }

  /**
   * 🔄 Get active models for a specific tier
   * @param {string} tier - 'free' or 'premium'
   * @returns {Promise<Array>} Active models for the tier
   */
  async getActiveModels(tier = 'free') {
    try {
      // 🔍 Check cache first
      const cacheKey = `models_${tier}`;
      if (this.configCache.has(cacheKey) && Date.now() < this.cacheExpiry.get(cacheKey)) {
        return this.configCache.get(cacheKey);
      }

      if (!this.isFirestoreAvailable) {
        return this.getFallbackModels(tier);
      }

      // 📋 Query database for active models
      const modelsRef = this.db.collection('ai_models');
      const snapshot = await modelsRef
        .where('tier', '==', tier)
        .where('isActive', '==', true)
        .orderBy('priority')
        .get();

      const models = [];
      snapshot.forEach(doc => {
        models.push({ id: doc.id, ...doc.data() });
      });

      // 💾 Cache the results
      this.configCache.set(cacheKey, models);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      return models;

    } catch (error) {
      console.error('❌ Failed to get active models:', error.message);
      return this.getFallbackModels(tier);
    }
  }

  /**
   * 📊 Update model performance metrics
   * @param {string} modelId - Model identifier
   * @param {Object} metrics - Performance data
   */
  async updateModelMetrics(modelId, metrics) {
    try {
      const { responseTime, success, cost, tokens } = metrics;
      
      // 📊 Update local metrics
      if (!this.modelMetrics.has(modelId)) {
        this.modelMetrics.set(modelId, {
          totalRequests: 0,
          successfulRequests: 0,
          totalResponseTime: 0,
          totalCost: 0,
          totalTokens: 0
        });
      }

      const modelStats = this.modelMetrics.get(modelId);
      modelStats.totalRequests++;
      if (success) modelStats.successfulRequests++;
      modelStats.totalResponseTime += responseTime;
      modelStats.totalCost += cost || 0;
      modelStats.totalTokens += tokens || 0;

      // 💾 Update database if available
      if (this.isFirestoreAvailable) {
        const modelRef = this.db.collection('ai_models').doc(modelId);
        await modelRef.update({
          'metrics.totalRequests': admin.firestore.FieldValue.increment(1),
          'metrics.successfulRequests': success ? admin.firestore.FieldValue.increment(1) : admin.firestore.FieldValue.increment(0),
          'metrics.totalResponseTime': admin.firestore.FieldValue.increment(responseTime),
          'metrics.totalCost': admin.firestore.FieldValue.increment(cost || 0),
          'metrics.totalTokens': admin.firestore.FieldValue.increment(tokens || 0),
          'metrics.lastUsed': admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

    } catch (error) {
      console.error('❌ Failed to update model metrics:', error.message);
    }
  }

  /**
   * 🔄 Initialize fallback configuration when database is unavailable
   */
  initializeFallbackConfig() {
    console.log('🔧 Initializing fallback model configuration');
    
    // 📋 Hardcoded fallback models
    const fallbackModels = {
      free: [
        {
          id: 'gpt-4o-mini-fallback',
          name: 'GPT-4o Mini',
          provider: 'openai',
          model: 'gpt-4o-mini',
          isActive: true,
          priority: 1
        },
        {
          id: 'gemini-flash-fallback',
          name: 'Gemini Flash',
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          isActive: true,
          priority: 2
        }
      ],
      premium: [
        {
          id: 'gpt-4o-fallback',
          name: 'GPT-4o',
          provider: 'openai',
          model: 'gpt-4o',
          isActive: true,
          priority: 1
        }
      ]
    };

    // 💾 Cache fallback models
    this.configCache.set('models_free', fallbackModels.free);
    this.configCache.set('models_premium', fallbackModels.premium);
  }

  /**
   * 🔄 Get fallback models when database is unavailable
   */
  getFallbackModels(tier) {
    return this.configCache.get(`models_${tier}`) || [];
  }

  /**
   * 📊 Get model performance statistics
   * @param {string} modelId - Model identifier
   * @returns {Object} Performance statistics
   */
  getModelStats(modelId) {
    const stats = this.modelMetrics.get(modelId);
    if (!stats) return null;

    return {
      totalRequests: stats.totalRequests,
      successRate: stats.totalRequests > 0 ? (stats.successfulRequests / stats.totalRequests) : 0,
      averageResponseTime: stats.totalRequests > 0 ? (stats.totalResponseTime / stats.totalRequests) : 0,
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokens
    };
  }

  /**
   * 🔄 Clear configuration cache (force refresh)
   */
  clearCache() {
    this.configCache.clear();
    this.cacheExpiry.clear();
    console.log('🔄 Model configuration cache cleared');
  }
}

// 🔧 Create singleton instance
let modelConfigService = null;

/**
 * 🔧 Get or create model configuration service instance
 * @returns {ModelConfigService} Service instance
 */
function getModelConfigService() {
  if (!modelConfigService) {
    modelConfigService = new ModelConfigService();
  }
  return modelConfigService;
}

module.exports = {
  ModelConfigService,
  getModelConfigService
};
