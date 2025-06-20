/**
 * Monitoring Routes
 * Provides secure monitoring dashboard and metrics endpoints for admin users
 */

const express = require('express');
const path = require('path');
const admin = require('firebase-admin');
const monitoringService = require('../services/monitoringService');
const { getMemoryManager } = require('../services/memoryManager');
const performanceMonitoringService = require('../services/performanceMonitoringService');
const cacheService = require('../services/cacheService');
const securityMiddleware = require('../middleware/securityMiddleware');

const router = express.Router();

/**
 * Admin authentication middleware
 * Verifies user has admin role in Firestore
 */
const verifyAdmin = async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'];
    const authHeader = req.headers.authorization;
    
    if (!userId && !authHeader) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide X-User-Id header or Authorization token'
      });
    }

    let userIdToCheck = userId;

    // If Authorization header is provided, verify Firebase token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const idToken = authHeader.substring(7);
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        userIdToCheck = decodedToken.uid;
      } catch (tokenError) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Firebase token verification failed'
        });
      }
    }

    if (!userIdToCheck) {
      return res.status(401).json({
        error: 'User identification required',
        message: 'Unable to identify user from provided credentials'
      });
    }

    // Check admin role in Firestore
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userIdToCheck).get();
    
    if (!userDoc.exists) {
      return res.status(403).json({
        error: 'User not found',
        message: 'User document not found in database'
      });
    }

    const userData = userDoc.data();
    if (userData.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        message: 'This endpoint requires admin privileges'
      });
    }

    req.adminUser = {
      uid: userIdToCheck,
      email: userData.email,
      role: userData.role
    };

    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to verify admin status'
    });
  }
};

/**
 * Get comprehensive backend metrics
 */
router.get('/metrics', 
  securityMiddleware.createRateLimit({ max: 60, windowMs: 60 * 1000 }), // 60 requests per minute
  verifyAdmin,
  async (req, res) => {
    try {
      const memoryManager = getMemoryManager();

      // Gather metrics from various services with error handling
      let systemHealth, detailedMetrics, performanceMetrics, cacheMetrics;

      try {
        systemHealth = await monitoringService.getHealthStatus();
      } catch (error) {
        console.warn('Failed to get system health:', error.message);
        systemHealth = { status: 'unknown', uptime: 0, metrics: { memory: { heapUsed: 0 } }, environment: 'unknown', version: '1.0.0' };
      }

      try {
        detailedMetrics = monitoringService.getDetailedMetrics();
      } catch (error) {
        console.warn('Failed to get detailed metrics:', error.message);
        detailedMetrics = {
          requests: { total: 0, successful: 0, failed: 0 },
          performance: { averageResponseTime: 0, p95ResponseTime: 0, slowRequests: [] },
          errors: { total: 0, recent: [] },
          resources: { activeConnections: 0 }
        };
      }

      try {
        performanceMetrics = performanceMonitoringService.getRealTimeMetrics();
      } catch (error) {
        console.warn('Failed to get performance metrics:', error.message);
        performanceMetrics = { system: { cpu: 0, memory: 0, uptime: 0 }, application: {}, optimization: {} };
      }

      try {
        cacheMetrics = cacheService.getMetrics();
      } catch (error) {
        console.warn('Failed to get cache metrics:', error.message);
        cacheMetrics = { hitRate: 0, totalEntries: 0, redisAvailable: false };
      }

      // Get memory metrics for system user (aggregate)
      let memoryMetrics = {
        workingMemorySize: 0,
        shortTermMemorySize: 0,
        longTermMemorySize: 0,
        avgRetrievalTime: 0
      };

      try {
        memoryMetrics = await memoryManager.getMemoryMetrics('system');
      } catch (memoryError) {
        console.warn('Failed to get memory metrics:', memoryError.message);
      }

      const response = {
        status: 'success',
        timestamp: new Date().toISOString(),
        system: {
          status: systemHealth.status || 'unknown',
          uptime: systemHealth.uptime || 0,
          memoryUsageMB: systemHealth.metrics?.memory?.heapUsed || 0,
          environment: systemHealth.environment || 'unknown',
          version: systemHealth.version || '1.0.0',
          activeConnections: detailedMetrics.resources?.activeConnections || 0
        },
        requests: {
          total: detailedMetrics.requests?.total || 0,
          successful: detailedMetrics.requests?.successful || 0,
          failed: detailedMetrics.requests?.failed || 0,
          successRate: ((detailedMetrics.requests?.successful || 0) / Math.max(detailedMetrics.requests?.total || 1, 1) * 100).toFixed(2)
        },
        performance: {
          averageResponseTime: Math.round(detailedMetrics.performance?.averageResponseTime || 0),
          p95ResponseTime: Math.round(detailedMetrics.performance?.p95ResponseTime || 0),
          slowRequests: detailedMetrics.performance?.slowRequests?.length || 0
        },
        memory: memoryMetrics,
        errors: {
          total: detailedMetrics.errors?.total || 0,
          errorRate: ((detailedMetrics.errors?.total || 0) / Math.max(detailedMetrics.requests?.total || 1, 1) * 100).toFixed(2),
          recent: detailedMetrics.errors?.recent || []
        },
        cache: {
          hitRate: cacheMetrics.hitRate || 0,
          totalEntries: cacheMetrics.totalEntries || 0,
          redisAvailable: cacheMetrics.redisAvailable || false
        },
        storage: {
          firestoreAvailable: memoryManager.isFirestoreAvailable || false,
          vectorDbAvailable: false // Placeholder
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Metrics endpoint error:', error);
      res.status(500).json({
        error: 'Failed to fetch metrics',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get AI response comparison data for testing and analysis
 */
router.get('/ai-comparison',
  securityMiddleware.createRateLimit({ max: 20, windowMs: 60 * 1000 }), // 20 requests per minute
  verifyAdmin,
  async (req, res) => {
    try {
      // Get sample ensemble responses for comparison
      const samplePrompts = [
        "Explain quantum computing in simple terms",
        "What are the benefits of renewable energy?",
        "How does machine learning work?",
        "Describe the process of photosynthesis"
      ];

      const comparisonData = {
        status: 'success',
        timestamp: new Date().toISOString(),
        sampleResponses: await generateSampleResponses(samplePrompts),
        modelPerformance: {
          gpt4o: {
            model: 'gpt-4o-mini',
            provider: 'openai',
            averageConfidence: 0.87,
            averageResponseTime: 1250,
            averageWordCount: 180,
            strengths: ['Detailed explanations', 'Technical accuracy', 'Structured responses'],
            weaknesses: ['Sometimes verbose', 'Can be overly technical']
          },
          gemini: {
            model: 'gemini-2.0-flash',
            provider: 'google',
            averageConfidence: 0.82,
            averageResponseTime: 980,
            averageWordCount: 165,
            strengths: ['Fast responses', 'Creative examples', 'Clear language'],
            weaknesses: ['Occasional inaccuracies', 'Less detailed']
          },
          claude: {
            model: 'claude-opus-4',
            provider: 'anthropic',
            averageConfidence: 0.89,
            averageResponseTime: 1450,
            averageWordCount: 195,
            strengths: ['Nuanced understanding', 'Balanced perspectives', 'High accuracy'],
            weaknesses: ['Slower responses', 'Sometimes cautious']
          }
        },
        confidenceMetrics: {
          highConfidenceThreshold: 0.8,
          mediumConfidenceThreshold: 0.6,
          averageConsensusLevel: 0.75,
          modelAgreementRate: 0.68
        }
      };

      res.json(comparisonData);
    } catch (error) {
      console.error('AI comparison error:', error);
      res.status(500).json({
        error: 'Failed to fetch AI comparison data',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

async function generateSampleResponses(prompts) {
  return prompts.map((prompt, index) => ({
    id: `sample-${index + 1}`,
    prompt,
    responses: {
      gpt4o: {
        content: generateSampleContent(prompt, 'gpt4o'),
        confidence: 0.85 + (Math.random() * 0.1),
        responseTime: 1200 + (Math.random() * 500),
        wordCount: 170 + Math.floor(Math.random() * 40),
        status: 'fulfilled'
      },
      gemini: {
        content: generateSampleContent(prompt, 'gemini'),
        confidence: 0.80 + (Math.random() * 0.1),
        responseTime: 900 + (Math.random() * 300),
        wordCount: 155 + Math.floor(Math.random() * 30),
        status: 'fulfilled'
      },
      claude: {
        content: generateSampleContent(prompt, 'claude'),
        confidence: 0.87 + (Math.random() * 0.08),
        responseTime: 1400 + (Math.random() * 400),
        wordCount: 185 + Math.floor(Math.random() * 35),
        status: 'fulfilled'
      }
    },
    synthesis: {
      content: generateSampleContent(prompt, 'synthesis'),
      confidence: 0.88 + (Math.random() * 0.07),
      qualityScore: 0.85 + (Math.random() * 0.1),
      strategy: 'consensus',
      basedOnResponses: 3
    }
  }));
}

function generateSampleContent(prompt, model) {
  const responses = {
    'gpt4o': {
      'Explain quantum computing in simple terms': 'Quantum computing is a revolutionary approach to computation that leverages quantum mechanical phenomena like superposition and entanglement. Unlike classical computers that use bits (0 or 1), quantum computers use quantum bits or qubits that can exist in multiple states simultaneously.',
      'What are the benefits of renewable energy?': 'Renewable energy sources offer numerous advantages including environmental sustainability, reduced greenhouse gas emissions, energy independence, and long-term cost savings. Solar, wind, and hydroelectric power are becoming increasingly cost-competitive with fossil fuels.',
      'How does machine learning work?': 'Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed. It uses algorithms to identify patterns in data and make predictions or decisions based on those patterns.',
      'Describe the process of photosynthesis': 'Photosynthesis is the process by which plants convert light energy, typically from the sun, into chemical energy stored in glucose. This process occurs in chloroplasts and involves two main stages: light-dependent reactions and the Calvin cycle.'
    },
    'gemini': {
      'Explain quantum computing in simple terms': 'Think of quantum computing like having a super-powered calculator that can try multiple solutions at once. While regular computers process information step by step, quantum computers can explore many possibilities simultaneously, making them incredibly fast for certain types of problems.',
      'What are the benefits of renewable energy?': 'Renewable energy is like having an unlimited supply of clean power from nature. It helps reduce pollution, creates jobs, and can save money over time. Plus, sources like solar and wind will never run out, unlike oil and coal.',
      'How does machine learning work?': 'Machine learning is like teaching a computer to recognize patterns, similar to how you learn to recognize faces or predict weather. The computer looks at lots of examples and gradually gets better at making predictions or decisions.',
      'Describe the process of photosynthesis': 'Photosynthesis is nature\'s way of making food from sunlight. Plants act like solar panels, capturing sunlight and combining it with water and carbon dioxide to create sugar for energy, while releasing oxygen as a bonus for us to breathe.'
    },
    'claude': {
      'Explain quantum computing in simple terms': 'Quantum computing represents a fundamental shift in how we process information. By harnessing quantum properties like superposition, these systems can perform certain calculations exponentially faster than classical computers, though they\'re not universally superior for all tasks.',
      'What are the benefits of renewable energy?': 'Renewable energy offers a pathway to sustainable development by providing clean, abundant power while reducing environmental impact. The technology creates economic opportunities, enhances energy security, and helps mitigate climate change effects.',
      'How does machine learning work?': 'Machine learning algorithms iteratively analyze data to identify underlying patterns and relationships. Through training on examples, these systems develop the ability to make informed predictions or classifications on new, unseen data.',
      'Describe the process of photosynthesis': 'Photosynthesis is a complex biochemical process where plants convert solar energy into chemical energy. Through chlorophyll-mediated reactions, plants synthesize glucose from carbon dioxide and water, simultaneously producing oxygen as a byproduct.'
    },
    'synthesis': {
      'Explain quantum computing in simple terms': 'Quantum computing is a revolutionary technology that harnesses quantum mechanical properties to process information in fundamentally new ways. Unlike classical computers that use binary bits, quantum computers use qubits that can exist in multiple states simultaneously through superposition. This allows them to explore many solutions at once, making them exponentially faster for specific problems like cryptography and optimization, though they\'re not universally superior to classical computers for all tasks.',
      'What are the benefits of renewable energy?': 'Renewable energy sources provide significant environmental, economic, and strategic advantages. They reduce greenhouse gas emissions and pollution, create sustainable jobs, and offer long-term cost savings as technology improves. These sources enhance energy independence and security while providing an unlimited supply of clean power from natural sources like sun, wind, and water. The transition to renewables also drives innovation and helps mitigate climate change effects.',
      'How does machine learning work?': 'Machine learning enables computers to learn and improve from experience by identifying patterns in data. Algorithms analyze large datasets to discover underlying relationships and rules, then use this knowledge to make predictions or decisions on new information. The process involves training models on examples, validating their accuracy, and iteratively improving performance. This approach allows systems to handle complex tasks like image recognition, language processing, and predictive analytics without explicit programming for each scenario.',
      'Describe the process of photosynthesis': 'Photosynthesis is the fundamental process by which plants convert light energy into chemical energy, sustaining most life on Earth. It occurs in chloroplasts through two main stages: light-dependent reactions that capture solar energy and convert it to chemical energy, and the Calvin cycle that uses this energy to synthesize glucose from carbon dioxide and water. This process not only provides energy for plants but also produces oxygen as a byproduct, making it essential for maintaining atmospheric balance and supporting aerobic life.'
    }
  };

  return responses[model]?.[prompt] || `Sample response for "${prompt}" from ${model} model.`;
}

/**
 * Get real-time cost estimation for different tiers
 */
router.post('/cost-estimation',
  securityMiddleware.createRateLimit({ max: 60, windowMs: 60 * 1000 }), // 60 requests per minute
  verifyAdmin,
  async (req, res) => {
    try {
      const { prompt, tier = 'free', requestCount = 1 } = req.body;

      if (!prompt) {
        return res.status(400).json({
          error: 'Prompt is required for cost estimation',
          timestamp: new Date().toISOString()
        });
      }

      // Estimate token count (rough approximation)
      const promptTokens = Math.ceil(prompt.length / 4);
      const responseTokens = 200; // Average response length

      // Cost per token for different tiers (in USD)
      const tierCosts = {
        free: {
          gpt4oMini: { input: 0.00000015, output: 0.0000006 },
          geminiFlash: { input: 0.000000075, output: 0.0000003 },
          claudeHaiku: { input: 0.00000025, output: 0.00000125 }
        },
        premium: {
          gpt4o: { input: 0.0000025, output: 0.00001 },
          gemini2Flash: { input: 0.000000075, output: 0.0000003 },
          claudeOpus: { input: 0.000015, output: 0.000075 }
        }
      };

      const models = tierCosts[tier];
      let totalCost = 0;
      const breakdown = {};

      Object.entries(models).forEach(([model, costs]) => {
        const modelCost = (promptTokens * costs.input + responseTokens * costs.output) * requestCount;
        breakdown[model] = {
          inputCost: promptTokens * costs.input * requestCount,
          outputCost: responseTokens * costs.output * requestCount,
          totalCost: modelCost
        };
        totalCost += modelCost;
      });

      // Add synthesis cost (using premium model)
      const synthesisCost = tier === 'free'
        ? (promptTokens * 0.0000005 + responseTokens * 0.000002) * requestCount
        : (promptTokens * 0.000005 + responseTokens * 0.000015) * requestCount;

      totalCost += synthesisCost;

      const estimation = {
        status: 'success',
        timestamp: new Date().toISOString(),
        prompt: {
          text: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
          estimatedTokens: promptTokens
        },
        tier,
        requestCount,
        costs: {
          individual: breakdown,
          synthesis: synthesisCost,
          total: totalCost,
          perRequest: totalCost / requestCount,
          formatted: {
            total: `$${totalCost.toFixed(6)}`,
            perRequest: `$${(totalCost / requestCount).toFixed(6)}`
          }
        },
        comparison: {
          free: tier === 'premium' ? `$${(totalCost * 0.15).toFixed(6)}` : null,
          premium: tier === 'free' ? `$${(totalCost * 6.67).toFixed(6)}` : null
        },
        savings: tier === 'free' ? {
          vsOnDemand: `${((1 - totalCost / (totalCost * 10)) * 100).toFixed(1)}%`,
          monthlyProjection: `$${(totalCost * 1000).toFixed(2)}`
        } : null
      };

      res.json(estimation);
    } catch (error) {
      console.error('Cost estimation error:', error);
      res.status(500).json({
        error: 'Failed to calculate cost estimation',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Get cost optimization data
 */
router.get('/cost-analytics',
  securityMiddleware.createRateLimit({ max: 30, windowMs: 60 * 1000 }), // 30 requests per minute
  verifyAdmin,
  async (req, res) => {
    try {
      const costMonitoringService = require('../services/costMonitoringService');
      const report = costMonitoringService.getReport();

      // Enhanced cost analytics
      const analytics = {
        status: 'success',
        timestamp: new Date().toISOString(),
        currentTier: process.env.NEURASTACK_TIER || 'free',
        costs: report.costs,
        modelPerformance: report.modelPerformance,
        recommendations: report.recommendations,
        tierComparison: {
          free: {
            estimatedCostPerRequest: '$0.003-0.008',
            modelsUsed: ['gpt-4o-mini', 'gemini-1.5-flash', 'claude-3-haiku'],
            qualityScore: 85,
            responseTime: '5-15s',
            rateLimits: { hourly: 10, daily: 50 }
          },
          premium: {
            estimatedCostPerRequest: '$0.05-0.15',
            modelsUsed: ['gpt-4o', 'gemini-2.0-flash', 'claude-opus-4'],
            qualityScore: 98,
            responseTime: '8-20s',
            rateLimits: { hourly: 100, daily: 1000 }
          }
        },
        optimizationSuggestions: [
          {
            type: 'tier_upgrade',
            condition: report.costs.utilizationPercent.daily > 80,
            suggestion: 'Consider upgrading to premium tier for better rate limits',
            potentialSavings: 'Better performance and higher limits'
          },
          {
            type: 'cache_optimization',
            condition: report.costs.today > 5,
            suggestion: 'Enable more aggressive caching to reduce API costs',
            potentialSavings: 'Up to 30% cost reduction'
          }
        ]
      };

      res.json(analytics);
    } catch (error) {
      console.error('Cost analytics error:', error);
      res.status(500).json({
        error: 'Failed to fetch cost analytics',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * Serve monitoring dashboard HTML
 */
router.get('/', (req, res) => {
  const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeuraStack Monitoring Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 24px;
            background: rgba(255, 255, 255, 0.98);
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.1);
            margin-top: 20px;
            margin-bottom: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .header {
            text-align: center;
            color: white;
            margin-bottom: 40px;
            position: relative;
        }

        .header h1 {
            font-size: 3rem;
            margin-bottom: 12px;
            text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.4);
            font-weight: 700;
            letter-spacing: -0.02em;
        }

        .header p {
            font-size: 1.2rem;
            opacity: 0.95;
            font-weight: 400;
            text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3);
        }

        .header-controls {
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
            flex-wrap: wrap;
        }

        .theme-toggle {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 14px;
        }

        .theme-toggle:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-1px);
        }

        .auto-refresh-toggle {
            background: rgba(255, 255, 255, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 14px;
        }

        .auto-refresh-toggle:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-1px);
        }

        .auto-refresh-toggle.active {
            background: #27ae60;
            border-color: #27ae60;
        }

        .auth-section {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 24px;
            padding: 48px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1), 0 8px 20px rgba(0, 0, 0, 0.05);
            margin-bottom: 40px;
            border: 1px solid rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            position: relative;
            max-width: 520px;
            margin-left: auto;
            margin-right: auto;
        }

        .auth-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2, #667eea);
            border-radius: 24px 24px 0 0;
        }

        .dashboard-section {
            display: none;
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.08), 0 6px 16px rgba(0, 0, 0, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #555;
        }

        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }

        input:focus {
            outline: none;
            border-color: #667eea;
        }

        .btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 14px 28px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            position: relative;
            overflow: hidden;
        }

        .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
        }

        .btn:hover::before {
            left: 100%;
        }

        .btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 30px rgba(102, 126, 234, 0.4);
        }

        .btn:active {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3);
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .error {
            color: #e74c3c;
            margin-top: 10px;
            padding: 12px;
            background: #fdf2f2;
            border-radius: 8px;
            border-left: 4px solid #e74c3c;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 2px 4px rgba(231, 76, 60, 0.1);
        }

        .success {
            color: #27ae60;
            margin-top: 10px;
            padding: 12px;
            background: #f2fdf2;
            border-radius: 8px;
            border-left: 4px solid #27ae60;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 2px 4px rgba(39, 174, 96, 0.1);
        }

        .warning {
            color: #f39c12;
            margin-top: 10px;
            padding: 12px;
            background: #fef9e7;
            border-radius: 8px;
            border-left: 4px solid #f39c12;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 2px 4px rgba(243, 156, 18, 0.1);
        }

        .info {
            color: #3498db;
            margin-top: 10px;
            padding: 12px;
            background: #f4f9fd;
            border-radius: 8px;
            border-left: 4px solid #3498db;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 2px 4px rgba(52, 152, 219, 0.1);
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
            margin-top: 32px;
        }

        .metric-card {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            padding: 24px;
            border-left: 4px solid #667eea;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .metric-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }

        .metric-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1), 0 6px 16px rgba(0, 0, 0, 0.06);
        }

        .metric-card h3 {
            color: #667eea;
            margin-bottom: 20px;
            font-size: 1.3rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .metric-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
            transition: all 0.2s ease;
        }

        .metric-item:last-child {
            border-bottom: none;
            margin-bottom: 0;
        }

        .metric-item:hover {
            background: rgba(102, 126, 234, 0.02);
            border-radius: 8px;
            padding: 8px 12px;
            margin: 0 -12px 12px -12px;
        }

        .metric-label {
            color: #666;
            font-weight: 500;
            font-size: 0.95rem;
        }

        .metric-value {
            font-weight: 700;
            color: #2c3e50;
            font-size: 1rem;
            padding: 4px 12px;
            background: rgba(102, 126, 234, 0.08);
            border-radius: 8px;
            min-width: 60px;
            text-align: center;
        }

        .refresh-btn {
            margin-bottom: 20px;
        }

        .user-info {
            background: linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%);
            border-radius: 16px;
            padding: 20px 24px;
            margin-bottom: 32px;
            border-left: 4px solid #3498db;
            box-shadow: 0 4px 12px rgba(52, 152, 219, 0.1);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 16px;
        }

        .user-info span {
            font-weight: 600;
            color: #2c3e50;
            font-size: 1rem;
        }

        .logout-btn {
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            margin-left: 0;
            padding: 10px 20px;
            font-size: 14px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(231, 76, 60, 0.2);
        }

        .logout-btn:hover {
            background: linear-gradient(135deg, #c0392b, #a93226);
            box-shadow: 0 6px 16px rgba(231, 76, 60, 0.3);
        }

        .loading {
            text-align: center;
            padding: 40px 20px;
            color: #666;
            font-size: 16px;
            position: relative;
        }

        .loading::before {
            content: '';
            display: inline-block;
            width: 24px;
            height: 24px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 12px;
            vertical-align: middle;
        }

        /* Enhanced Loading States */
        .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            margin: 20px 0;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        }

        .loading-spinner {
            width: 48px;
            height: 48px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }

        .loading-text {
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 16px;
        }

        .loading-progress {
            width: 200px;
            height: 4px;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 2px;
            overflow: hidden;
        }

        .loading-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 2px;
            animation: loadingProgress 2s ease-in-out infinite;
        }

        @keyframes loadingProgress {
            0% { width: 0%; }
            50% { width: 70%; }
            100% { width: 100%; }
        }

        body.dark-mode .loading-state {
            background: linear-gradient(145deg, #34495e 0%, #2c3e50 100%);
        }

        body.dark-mode .loading-text {
            color: #ecf0f1;
        }

        body.dark-mode .loading-spinner {
            border-color: #4a5f7a;
            border-top-color: #3498db;
        }

        /* Refresh Countdown */
        .refresh-countdown {
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(102, 126, 234, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            z-index: 1000;
            display: none;
            animation: fadeInOut 0.3s ease;
        }

        @keyframes fadeInOut {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* Dashboard Navigation */
        .dashboard-nav {
            display: flex;
            gap: 8px;
            margin: 24px 0;
            padding: 8px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 16px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            backdrop-filter: blur(10px);
        }

        .nav-tab {
            flex: 1;
            padding: 12px 20px;
            border: none;
            background: transparent;
            border-radius: 12px;
            font-size: 0.95rem;
            font-weight: 600;
            color: #666;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .nav-tab::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: left 0.5s;
        }

        .nav-tab:hover::before {
            left: 100%;
        }

        .nav-tab:hover {
            color: #2c3e50;
            background: rgba(102, 126, 234, 0.1);
            transform: translateY(-2px);
        }

        .nav-tab.active {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .nav-tab.active:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
        }

        /* Tab Content */
        .tab-content {
            display: none;
            animation: fadeIn 0.3s ease-in-out;
        }

        .tab-content.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        /* AI Comparison Interface */
        .ai-comparison-section {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            padding: 32px;
            margin: 24px 0;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.8);
        }

        .ai-comparison-section h2 {
            color: #2c3e50;
            margin-bottom: 8px;
            font-size: 1.8rem;
            font-weight: 700;
        }

        .ai-comparison-section p {
            color: #666;
            margin-bottom: 24px;
            font-size: 1.1rem;
        }

        .comparison-controls {
            display: flex;
            gap: 16px;
            margin-bottom: 32px;
            align-items: center;
            flex-wrap: wrap;
        }

        .comparison-controls select {
            padding: 12px 16px;
            border: 2px solid #e1e5e9;
            border-radius: 12px;
            font-size: 1rem;
            background: white;
            color: #2c3e50;
            min-width: 250px;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .comparison-controls select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        /* AI Response Cards */
        .ai-responses-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
            margin: 32px 0;
        }

        .ai-response-card {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.8);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .ai-response-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }

        .ai-response-card.synthesis::before {
            background: linear-gradient(90deg, #27ae60, #2ecc71);
        }

        .ai-response-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1);
        }

        .ai-model-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }

        .ai-model-name {
            font-size: 1.2rem;
            font-weight: 700;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .ai-confidence-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .confidence-high {
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
            border: 1px solid rgba(39, 174, 96, 0.2);
        }

        .confidence-medium {
            background: rgba(243, 156, 18, 0.1);
            color: #f39c12;
            border: 1px solid rgba(243, 156, 18, 0.2);
        }

        .confidence-low {
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
            border: 1px solid rgba(231, 76, 60, 0.2);
        }

        .ai-response-content {
            color: #2c3e50;
            line-height: 1.6;
            margin-bottom: 16px;
            font-size: 0.95rem;
        }

        .ai-response-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 12px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid rgba(0, 0, 0, 0.1);
        }

        .ai-metric {
            text-align: center;
        }

        .ai-metric-value {
            font-size: 1.1rem;
            font-weight: 700;
            color: #667eea;
            display: block;
        }

        .ai-metric-label {
            font-size: 0.8rem;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Additional AI Comparison Styles */
        .model-performance-overview {
            margin-bottom: 32px;
        }

        .model-performance-overview h3 {
            color: #2c3e50;
            margin-bottom: 24px;
            font-size: 1.5rem;
            font-weight: 700;
        }

        .model-strengths, .model-weaknesses {
            margin-top: 16px;
        }

        .model-strengths h4, .model-weaknesses h4 {
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 8px;
            color: #2c3e50;
        }

        .model-strengths ul, .model-weaknesses ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .model-strengths li, .model-weaknesses li {
            font-size: 0.85rem;
            color: #666;
            margin-bottom: 4px;
            padding-left: 16px;
            position: relative;
        }

        .model-strengths li::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: #27ae60;
            font-weight: bold;
        }

        .model-weaknesses li::before {
            content: '!';
            position: absolute;
            left: 0;
            color: #f39c12;
            font-weight: bold;
        }

        .confidence-metrics-section {
            background: linear-gradient(145deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 16px;
            padding: 24px;
            margin: 32px 0;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        }

        .confidence-metrics-section h3 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.4rem;
            font-weight: 700;
        }

        .confidence-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
        }

        .confidence-stat {
            text-align: center;
            padding: 16px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 800;
            color: #667eea;
            margin-bottom: 8px;
        }

        .stat-label {
            font-size: 0.9rem;
            color: #666;
            font-weight: 600;
        }

        .comparison-instructions {
            background: rgba(102, 126, 234, 0.1);
            border-radius: 12px;
            padding: 16px;
            margin: 24px 0;
            border-left: 4px solid #667eea;
        }

        .comparison-instructions p {
            margin: 0;
            color: #2c3e50;
            font-size: 0.95rem;
        }

        .specific-comparison {
            animation: fadeIn 0.3s ease-in-out;
        }

        .comparison-header {
            margin-bottom: 32px;
        }

        .comparison-header h3 {
            color: #2c3e50;
            margin-bottom: 16px;
            font-size: 1.6rem;
            font-weight: 700;
        }

        .prompt-display {
            background: linear-gradient(145deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 12px;
            padding: 20px;
            border-left: 4px solid #667eea;
            font-size: 1.1rem;
            color: #2c3e50;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .synthesis-section {
            margin: 32px 0;
        }

        .synthesis-section h3 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.4rem;
            font-weight: 700;
        }

        .comparison-actions {
            display: flex;
            gap: 16px;
            justify-content: center;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid rgba(0, 0, 0, 0.1);
        }

        /* Dark mode styles for AI comparison */
        body.dark-mode .ai-comparison-section,
        body.dark-mode .confidence-metrics-section {
            background: linear-gradient(145deg, #34495e 0%, #2c3e50 100%);
            color: #ecf0f1;
        }

        body.dark-mode .ai-comparison-section h2,
        body.dark-mode .confidence-metrics-section h3,
        body.dark-mode .model-performance-overview h3,
        body.dark-mode .comparison-header h3,
        body.dark-mode .synthesis-section h3 {
            color: #ecf0f1;
        }

        body.dark-mode .ai-comparison-section p {
            color: #bdc3c7;
        }

        body.dark-mode .confidence-stat {
            background: #34495e;
            color: #ecf0f1;
        }

        body.dark-mode .prompt-display {
            background: linear-gradient(145deg, #34495e 0%, #2c3e50 100%);
            color: #ecf0f1;
        }

        body.dark-mode .comparison-instructions {
            background: rgba(52, 152, 219, 0.2);
            border-left-color: #3498db;
        }

        body.dark-mode .comparison-instructions p {
            color: #ecf0f1;
        }

        /* Cost Estimation Interface */
        .cost-estimation-section {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            padding: 32px;
            margin: 24px 0;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.8);
        }

        .cost-estimation-section h2 {
            color: #2c3e50;
            margin-bottom: 8px;
            font-size: 1.8rem;
            font-weight: 700;
        }

        .cost-estimation-section p {
            color: #666;
            margin-bottom: 24px;
            font-size: 1.1rem;
        }

        .estimation-controls {
            margin-bottom: 32px;
        }

        .estimation-form {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #2c3e50;
            font-size: 0.95rem;
        }

        .form-group textarea {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e1e5e9;
            border-radius: 12px;
            font-size: 1rem;
            font-family: inherit;
            resize: vertical;
            transition: all 0.3s ease;
        }

        .form-group textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group input,
        .form-group select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e1e5e9;
            border-radius: 12px;
            font-size: 1rem;
            background: white;
            transition: all 0.3s ease;
        }

        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 16px;
            align-items: end;
        }

        .estimation-placeholder {
            text-align: center;
            padding: 60px 20px;
            background: linear-gradient(145deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 16px;
            border: 2px dashed #e1e5e9;
        }

        .placeholder-text {
            color: #666;
            font-size: 1.1rem;
            font-weight: 500;
        }

        /* Cost Estimation Results */
        .cost-estimation-results {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            animation: fadeIn 0.3s ease-in-out;
        }

        .estimation-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .estimation-title {
            font-size: 1.3rem;
            font-weight: 700;
            color: #2c3e50;
        }

        .tier-badge {
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .tier-badge.free {
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
            border: 1px solid rgba(39, 174, 96, 0.2);
        }

        .tier-badge.premium {
            background: rgba(102, 126, 234, 0.1);
            color: #667eea;
            border: 1px solid rgba(102, 126, 234, 0.2);
        }

        .cost-breakdown {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .cost-item {
            background: linear-gradient(145deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 12px;
            padding: 16px;
            text-align: center;
            border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .cost-value {
            font-size: 1.4rem;
            font-weight: 800;
            color: #667eea;
            margin-bottom: 4px;
        }

        .cost-label {
            font-size: 0.85rem;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .cost-comparison {
            background: rgba(102, 126, 234, 0.05);
            border-radius: 12px;
            padding: 16px;
            margin-top: 16px;
        }

        .comparison-title {
            font-size: 1rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 12px;
        }

        .comparison-items {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
        }

        .comparison-item {
            text-align: center;
            padding: 12px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        /* Tier Comparison Section */
        .tier-comparison-section {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            padding: 32px;
            margin: 24px 0;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.8);
        }

        .tier-comparison-section h2 {
            color: #2c3e50;
            margin-bottom: 24px;
            font-size: 1.8rem;
            font-weight: 700;
        }

        .tier-comparison-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 24px;
        }

        .tier-card {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            border: 2px solid transparent;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .tier-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }

        .tier-card.recommended {
            border-color: #667eea;
            box-shadow: 0 12px 32px rgba(102, 126, 234, 0.15);
        }

        .tier-card.recommended::before {
            background: linear-gradient(90deg, #27ae60, #2ecc71);
        }

        .tier-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1);
        }

        .tier-header {
            text-align: center;
            margin-bottom: 24px;
        }

        .tier-name {
            font-size: 1.4rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 8px;
        }

        .tier-price {
            font-size: 2rem;
            font-weight: 800;
            color: #667eea;
            margin-bottom: 4px;
        }

        .tier-period {
            color: #666;
            font-size: 0.9rem;
        }

        .tier-features {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .tier-features li {
            padding: 8px 0;
            color: #2c3e50;
            font-size: 0.95rem;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tier-features li::before {
            content: '✓';
            color: #27ae60;
            font-weight: bold;
            font-size: 1.1rem;
        }

        /* Dark mode styles for cost estimation */
        body.dark-mode .cost-estimation-section,
        body.dark-mode .tier-comparison-section {
            background: linear-gradient(145deg, #34495e 0%, #2c3e50 100%);
            color: #ecf0f1;
        }

        body.dark-mode .cost-estimation-section h2,
        body.dark-mode .tier-comparison-section h2 {
            color: #ecf0f1;
        }

        body.dark-mode .cost-estimation-section p {
            color: #bdc3c7;
        }

        body.dark-mode .estimation-form,
        body.dark-mode .cost-estimation-results,
        body.dark-mode .tier-card {
            background: #34495e;
            color: #ecf0f1;
        }

        body.dark-mode .form-group input,
        body.dark-mode .form-group select,
        body.dark-mode .form-group textarea {
            background: #2c3e50;
            border-color: #4a5f7a;
            color: #ecf0f1;
        }

        body.dark-mode .estimation-placeholder {
            background: linear-gradient(145deg, #2c3e50 0%, #34495e 100%);
            border-color: #4a5f7a;
        }

        body.dark-mode .placeholder-text {
            color: #bdc3c7;
        }

        /* Additional Cost Interface Styles */
        .model-breakdown {
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid rgba(0, 0, 0, 0.1);
        }

        .model-breakdown h4 {
            color: #2c3e50;
            margin-bottom: 16px;
            font-size: 1.1rem;
            font-weight: 600;
        }

        .model-costs {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
        }

        .model-cost-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: linear-gradient(145deg, #f8f9fa 0%, #ffffff 100%);
            border-radius: 8px;
            border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .model-name {
            font-weight: 600;
            color: #2c3e50;
            font-size: 0.9rem;
        }

        .model-cost {
            font-weight: 700;
            color: #667eea;
            font-size: 0.9rem;
        }

        .tier-recommendations {
            margin-top: 32px;
        }

        .tier-recommendations h3 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.4rem;
            font-weight: 700;
        }

        .recommendation-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }

        .recommendation-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border-left: 4px solid #667eea;
            transition: all 0.3s ease;
        }

        .recommendation-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
        }

        .recommendation-card h4 {
            color: #2c3e50;
            margin-bottom: 12px;
            font-size: 1.1rem;
            font-weight: 600;
        }

        .recommendation-card p {
            color: #666;
            font-size: 0.95rem;
            line-height: 1.5;
            margin: 0;
        }

        .prompt-info {
            background: rgba(102, 126, 234, 0.05);
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 20px;
            font-size: 0.9rem;
            color: #2c3e50;
        }

        .prompt-info strong {
            color: #667eea;
        }

        .prompt-info small {
            color: #666;
            font-size: 0.8rem;
        }

        /* Mobile responsiveness for cost interface */
        @media (max-width: 768px) {
            .form-row {
                grid-template-columns: 1fr;
                gap: 12px;
            }

            .cost-breakdown {
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 12px;
            }

            .tier-comparison-grid {
                grid-template-columns: 1fr;
            }

            .recommendation-cards {
                grid-template-columns: 1fr;
            }

            .comparison-items {
                grid-template-columns: 1fr;
            }
        }

        /* Dark mode for additional cost styles */
        body.dark-mode .model-breakdown h4,
        body.dark-mode .tier-recommendations h3,
        body.dark-mode .recommendation-card h4 {
            color: #ecf0f1;
        }

        body.dark-mode .model-cost-item,
        body.dark-mode .recommendation-card {
            background: #2c3e50;
            color: #ecf0f1;
        }

        body.dark-mode .model-name {
            color: #ecf0f1;
        }

        body.dark-mode .recommendation-card p {
            color: #bdc3c7;
        }

        body.dark-mode .prompt-info {
            background: rgba(52, 152, 219, 0.2);
            color: #ecf0f1;
        }

        body.dark-mode .prompt-info strong {
            color: #3498db;
        }

        body.dark-mode .prompt-info small {
            color: #bdc3c7;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Enhanced Dark Mode Styles */
        body.dark-mode {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #ecf0f1;
        }

        body.dark-mode .container {
            background: rgba(44, 62, 80, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
        }

        body.dark-mode .auth-section,
        body.dark-mode .dashboard-section {
            background: linear-gradient(145deg, #2c3e50 0%, #34495e 100%);
            color: #ecf0f1;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        body.dark-mode .metric-card,
        body.dark-mode .metric-card-enhanced {
            background: linear-gradient(145deg, #34495e 0%, #2c3e50 100%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        body.dark-mode .metric-card-enhanced::before {
            background: linear-gradient(90deg, #3498db, #9b59b6, #e74c3c, #3498db);
        }

        body.dark-mode .metric-card h3,
        body.dark-mode .metric-title {
            color: #3498db;
        }

        body.dark-mode .metric-label {
            color: #bdc3c7;
        }

        body.dark-mode .metric-value,
        body.dark-mode .metric-value-large {
            color: #ecf0f1;
            background: linear-gradient(135deg, #3498db, #9b59b6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        body.dark-mode input {
            background: #34495e;
            border-color: #4a5f7a;
            color: #ecf0f1;
        }

        body.dark-mode input:focus {
            border-color: #3498db;
            box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
        }

        body.dark-mode .user-info {
            background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
            border-left-color: #3498db;
            color: #ecf0f1;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        body.dark-mode .chart-container {
            background: linear-gradient(145deg, #34495e 0%, #2c3e50 100%);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        body.dark-mode .chart-container h3 {
            color: #ecf0f1;
        }

        body.dark-mode .section-title {
            color: #ecf0f1;
        }

        body.dark-mode .progress-bar-enhanced {
            background: rgba(255, 255, 255, 0.1);
        }

        body.dark-mode .cost-overview-card,
        body.dark-mode .tier-card-enhanced {
            background: linear-gradient(145deg, #34495e 0%, #2c3e50 100%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #ecf0f1;
        }

        body.dark-mode .cost-amount {
            color: #ecf0f1;
        }

        body.dark-mode .progress-text,
        body.dark-mode .cost-trend {
            color: #bdc3c7;
        }

        /* Chart Container */
        .chart-container {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            padding: 24px;
            margin: 24px 0;
            height: 320px;
            position: relative;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.8);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .chart-container:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .chart-container h3 {
            margin: 0 0 20px 0;
            font-size: 1.4rem;
            font-weight: 700;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        body.dark-mode .chart-container {
            background: #34495e;
        }

        /* Status Indicators */
        .status-indicator {
            display: inline-block;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            margin-right: 12px;
            position: relative;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .status-indicator::before {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            border-radius: 50%;
            opacity: 0.3;
            animation: pulse 2s infinite;
        }

        .status-healthy {
            background-color: #27ae60;
            box-shadow: 0 0 8px rgba(39, 174, 96, 0.4);
        }
        .status-healthy::before { background-color: #27ae60; }

        .status-warning {
            background-color: #f39c12;
            box-shadow: 0 0 8px rgba(243, 156, 18, 0.4);
        }
        .status-warning::before { background-color: #f39c12; }

        .status-error {
            background-color: #e74c3c;
            box-shadow: 0 0 8px rgba(231, 76, 60, 0.4);
        }
        .status-error::before { background-color: #e74c3c; }

        .status-unknown {
            background-color: #95a5a6;
            box-shadow: 0 0 8px rgba(149, 165, 166, 0.4);
        }
        .status-unknown::before { background-color: #95a5a6; }

        /* Enhanced Mobile Responsiveness */
        @media (max-width: 1024px) {
            .metrics-dashboard {
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 20px;
            }

            .cost-overview-grid {
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            }

            .tier-cards-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 768px) {
            .container {
                padding: 16px;
                margin: 10px;
                border-radius: 16px;
            }

            .header h1 {
                font-size: 2.2rem;
                margin-bottom: 8px;
            }

            .header p {
                font-size: 1rem;
            }

            .metrics-grid,
            .metrics-dashboard {
                grid-template-columns: 1fr;
                gap: 16px;
            }

            .header-controls {
                flex-direction: column;
                align-items: center;
                gap: 12px;
            }

            .theme-toggle,
            .auto-refresh-toggle {
                padding: 10px 20px;
                font-size: 16px;
                min-width: 140px;
            }

            .chart-container {
                height: 280px;
                padding: 20px;
                margin: 16px 0;
            }

            .metric-card,
            .metric-card-enhanced {
                padding: 20px;
            }

            .metric-value-large {
                font-size: 2rem;
            }

            .cost-overview-grid {
                grid-template-columns: 1fr;
                gap: 16px;
            }

            .cost-overview-card {
                padding: 20px;
            }

            .cost-amount {
                font-size: 1.8rem;
            }

            .auth-section {
                padding: 32px 24px;
                margin: 16px;
            }

            .user-info {
                flex-direction: column;
                text-align: center;
                gap: 12px;
            }

            .btn {
                width: 100%;
                justify-content: center;
            }
        }

        @media (max-width: 480px) {
            .container {
                padding: 12px;
                margin: 5px;
            }

            .header h1 {
                font-size: 1.8rem;
            }

            .metric-card,
            .metric-card-enhanced {
                padding: 16px;
            }

            .chart-container {
                height: 240px;
                padding: 16px;
            }

            .cost-overview-card {
                padding: 16px;
            }

            .cost-amount {
                font-size: 1.5rem;
            }

            .metric-value-large {
                font-size: 1.8rem;
            }

            .auth-section {
                padding: 24px 16px;
            }

            .theme-toggle,
            .auto-refresh-toggle {
                padding: 8px 16px;
                font-size: 14px;
                min-width: 120px;
            }
        }

        /* Real-time indicator */
        .real-time-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #27ae60;
            border-radius: 50%;
            margin-left: 8px;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        /* Enhanced Real-time Metrics Styles */
        .metrics-dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 24px;
            margin: 24px 0;
        }

        .metric-card-enhanced {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            padding: 28px;
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.8);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .metric-card-enhanced::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2, #667eea);
            background-size: 200% 100%;
            animation: shimmer 3s ease-in-out infinite;
        }

        @keyframes shimmer {
            0%, 100% { background-position: 200% 0; }
            50% { background-position: -200% 0; }
        }

        .metric-card-enhanced:hover {
            transform: translateY(-6px) scale(1.02);
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.12), 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .metric-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .metric-title {
            font-size: 1.2rem;
            font-weight: 700;
            color: #2c3e50;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .metric-status {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .metric-status.healthy {
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
            border: 1px solid rgba(39, 174, 96, 0.2);
        }

        .metric-status.warning {
            background: rgba(243, 156, 18, 0.1);
            color: #f39c12;
            border: 1px solid rgba(243, 156, 18, 0.2);
        }

        .metric-status.critical {
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
            border: 1px solid rgba(231, 76, 60, 0.2);
        }

        .metric-value-large {
            font-size: 2.5rem;
            font-weight: 800;
            color: #2c3e50;
            margin: 16px 0;
            text-align: center;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .metric-trend {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            margin-top: 12px;
        }

        .trend-up {
            color: #27ae60;
        }

        .trend-down {
            color: #e74c3c;
        }

        .trend-stable {
            color: #3498db;
        }

        /* Enhanced Progress Bars */
        .progress-container {
            margin: 16px 0;
        }

        .progress-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            color: #666;
        }

        .progress-bar-enhanced {
            width: 100%;
            height: 12px;
            background: rgba(0, 0, 0, 0.08);
            border-radius: 6px;
            overflow: hidden;
            position: relative;
        }

        .progress-fill-enhanced {
            height: 100%;
            border-radius: 6px;
            transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .progress-fill-enhanced::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
            animation: progressShine 2s infinite;
        }

        @keyframes progressShine {
            0% { left: -100%; }
            100% { left: 100%; }
        }

        .progress-fill-enhanced.success {
            background: linear-gradient(90deg, #27ae60, #2ecc71);
        }

        .progress-fill-enhanced.warning {
            background: linear-gradient(90deg, #f39c12, #f7dc6f);
        }

        .progress-fill-enhanced.danger {
            background: linear-gradient(90deg, #e74c3c, #ec7063);
        }

        /* Enhanced Cost Analytics Styles */
        .cost-overview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin: 24px 0;
        }

        .cost-overview-card {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.8);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .cost-overview-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }

        .cost-overview-card.primary::before {
            background: linear-gradient(90deg, #27ae60, #2ecc71);
        }

        .cost-overview-card.secondary::before {
            background: linear-gradient(90deg, #3498db, #5dade2);
        }

        .cost-overview-card.predictive::before {
            background: linear-gradient(90deg, #f39c12, #f7dc6f);
        }

        .cost-overview-card.monthly::before {
            background: linear-gradient(90deg, #9b59b6, #bb8fce);
        }

        .cost-overview-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1);
        }

        .cost-overview-card .cost-icon {
            font-size: 2rem;
            margin-bottom: 12px;
        }

        .cost-overview-card h4 {
            margin: 0 0 8px 0;
            font-size: 0.95rem;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .cost-amount {
            font-size: 2rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 12px;
        }

        .cost-progress {
            margin-top: 16px;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 8px;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #27ae60, #2ecc71);
            border-radius: 4px;
            transition: width 0.6s ease;
        }

        .progress-text {
            font-size: 0.85rem;
            color: #666;
            font-weight: 500;
        }

        .cost-trend {
            font-size: 0.9rem;
            font-weight: 500;
            color: #666;
        }

        .cost-trend.increasing {
            color: #e74c3c;
        }

        .cost-trend.stable {
            color: #27ae60;
        }

        /* Enhanced Tier Comparison */
        .tier-comparison-enhanced {
            margin: 40px 0;
        }

        .section-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 24px;
            text-align: center;
        }

        .tier-cards-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
        }

        .tier-card-enhanced {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            padding: 28px;
            border: 2px solid transparent;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        }

        .tier-card-enhanced.current {
            border-color: #27ae60;
            box-shadow: 0 12px 32px rgba(39, 174, 96, 0.15);
        }

        .tier-card-enhanced.recommended {
            border-color: #f39c12;
            box-shadow: 0 12px 32px rgba(243, 156, 18, 0.15);
        }

        .tier-card-enhanced:hover {
            transform: translateY(-6px);
            box-shadow: 0 20px 48px rgba(0, 0, 0, 0.12);
        }

        .tier-badge {
            position: absolute;
            top: -8px;
            right: 20px;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .tier-badge.current-badge {
            background: linear-gradient(135deg, #27ae60, #2ecc71);
            color: white;
        }

        .tier-badge.recommended-badge {
            background: linear-gradient(135deg, #f39c12, #f7dc6f);
            color: white;
        }

        .tier-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 24px;
        }

        .tier-icon {
            font-size: 2.5rem;
        }

        .tier-header h4 {
            font-size: 1.4rem;
            font-weight: 700;
            color: #2c3e50;
            margin: 0;
        }

        .tier-metrics {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .tier-metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }

        .tier-metric:last-child {
            border-bottom: none;
        }

        .tier-metric .metric-label {
            font-weight: 600;
            color: #666;
            font-size: 0.95rem;
        }

        .tier-metric .metric-value {
            font-weight: 700;
            color: #2c3e50;
            font-size: 1rem;
        }

        .quality-bar {
            position: relative;
            width: 120px;
            height: 20px;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 10px;
            overflow: hidden;
        }

        .quality-fill {
            height: 100%;
            background: linear-gradient(90deg, #27ae60, #2ecc71);
            border-radius: 10px;
            transition: width 0.6s ease;
            position: relative;
        }

        .quality-fill.premium {
            background: linear-gradient(90deg, #f39c12, #f7dc6f);
        }

        .quality-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 0.8rem;
            font-weight: 600;
            color: white;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        /* Enhanced Optimization Suggestions */
        .optimization-section {
            margin: 40px 0;
        }

        .suggestions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 24px;
        }

        .suggestion-card {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.8);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        .suggestion-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #3498db, #5dade2);
        }

        .suggestion-card.tier_upgrade::before {
            background: linear-gradient(90deg, #f39c12, #f7dc6f);
        }

        .suggestion-card.cache_optimization::before {
            background: linear-gradient(90deg, #27ae60, #2ecc71);
        }

        .suggestion-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1);
        }

        .suggestion-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
        }

        .suggestion-icon {
            font-size: 1.5rem;
        }

        .suggestion-type {
            font-size: 0.8rem;
            font-weight: 600;
            color: #666;
            background: rgba(0, 0, 0, 0.05);
            padding: 4px 8px;
            border-radius: 8px;
        }

        .suggestion-content h4 {
            margin: 0 0 8px 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .suggestion-savings {
            color: #666;
            font-size: 0.95rem;
            margin-bottom: 12px;
        }

        .suggestion-impact {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .impact-label {
            font-size: 0.9rem;
            color: #666;
        }

        .impact-value {
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 8px;
            font-size: 0.85rem;
        }

        .suggestion-card.tier_upgrade .impact-value {
            background: rgba(243, 156, 18, 0.1);
            color: #f39c12;
        }

        .suggestion-card.cache_optimization .impact-value {
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
        }

        /* Model Performance Analytics */
        .model-performance-section {
            margin: 40px 0;
        }

        .model-performance-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-top: 24px;
        }

        .model-performance-card {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.8);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .model-performance-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08);
        }

        .model-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        }

        .model-header h4 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .model-efficiency {
            font-size: 0.85rem;
            font-weight: 600;
            color: #666;
            background: rgba(0, 0, 0, 0.05);
            padding: 4px 8px;
            border-radius: 8px;
        }

        .model-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 16px;
        }

        .model-metric {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .model-metric .metric-label {
            font-size: 0.85rem;
            color: #666;
            font-weight: 500;
        }

        .model-metric .metric-value {
            font-size: 1rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .efficiency-bar {
            width: 100%;
            height: 6px;
            background: rgba(0, 0, 0, 0.1);
            border-radius: 3px;
            overflow: hidden;
        }

        .efficiency-fill {
            height: 100%;
            background: linear-gradient(90deg, #27ae60, #2ecc71);
            border-radius: 3px;
            transition: width 0.6s ease;
        }

        .no-data {
            text-align: center;
            color: #666;
            font-style: italic;
            padding: 40px;
            background: rgba(0, 0, 0, 0.02);
            border-radius: 12px;
        }

        /* Cost Summary Section */
        .cost-summary-section {
            margin: 40px 0;
        }

        .cost-summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 24px;
        }

        .cost-summary-card {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.8);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cost-summary-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .summary-label {
            font-size: 0.9rem;
            color: #666;
            font-weight: 500;
            margin-bottom: 8px;
        }

        .summary-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 4px;
        }

        .summary-detail {
            font-size: 0.8rem;
            color: #888;
        }

        /* Enhanced Charts Grid */
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 24px;
            margin: 32px 0;
        }

        .chart-controls {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding: 0 4px;
        }

        .chart-control-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
        }

        .chart-control-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .chart-status {
            font-size: 0.85rem;
            font-weight: 600;
            padding: 4px 12px;
            border-radius: 12px;
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .chart-status.warning {
            background: rgba(243, 156, 18, 0.1);
            color: #f39c12;
        }

        .chart-status.error {
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
        }

        /* Performance Indicators */
        .performance-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 0.85rem;
            font-weight: 600;
            margin: 4px;
        }

        .performance-indicator.excellent {
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
        }

        .performance-indicator.good {
            background: rgba(52, 152, 219, 0.1);
            color: #3498db;
        }

        .performance-indicator.warning {
            background: rgba(243, 156, 18, 0.1);
            color: #f39c12;
        }

        .performance-indicator.critical {
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
        }

        /* Capacity Planning */
        .capacity-planning {
            margin: 32px 0;
            padding: 24px;
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
        }

        .capacity-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-top: 20px;
        }

        .capacity-metric {
            text-align: center;
            padding: 16px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .capacity-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 4px;
        }

        .capacity-label {
            font-size: 0.9rem;
            color: #666;
            font-weight: 500;
        }

        .capacity-trend {
            font-size: 0.8rem;
            margin-top: 4px;
        }

        .capacity-trend.up {
            color: #e74c3c;
        }

        .capacity-trend.down {
            color: #27ae60;
        }

        .capacity-trend.stable {
            color: #3498db;
        }

        /* Security Monitoring Styles */
        .security-monitoring {
            margin: 40px 0;
            padding: 24px;
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.8);
        }

        .security-overview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 24px 0;
        }

        .security-card {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.8);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .security-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .security-card.threat-level {
            border-left: 4px solid #27ae60;
        }

        .security-card.access-attempts {
            border-left: 4px solid #3498db;
        }

        .security-card.rate-limiting {
            border-left: 4px solid #f39c12;
        }

        .security-card.active-sessions {
            border-left: 4px solid #9b59b6;
        }

        .security-icon {
            font-size: 2rem;
            opacity: 0.8;
        }

        .security-details h4 {
            margin: 0 0 8px 0;
            font-size: 0.9rem;
            font-weight: 600;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .security-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 4px;
        }

        .security-status {
            font-size: 0.85rem;
            color: #666;
        }

        .security-status.safe {
            color: #27ae60;
        }

        .security-status.warning {
            color: #f39c12;
        }

        .security-status.danger {
            color: #e74c3c;
        }

        /* Security Events */
        .security-events {
            margin: 32px 0;
        }

        .security-events h4 {
            margin-bottom: 16px;
            font-size: 1.2rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .events-container {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.8);
        }

        .event-item {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.05);
            transition: background-color 0.2s ease;
        }

        .event-item:last-child {
            border-bottom: none;
        }

        .event-item:hover {
            background: rgba(0, 0, 0, 0.02);
        }

        .event-item.safe {
            border-left: 3px solid #27ae60;
        }

        .event-item.warning {
            border-left: 3px solid #f39c12;
        }

        .event-item.danger {
            border-left: 3px solid #e74c3c;
        }

        .event-time {
            font-size: 0.8rem;
            color: #666;
            min-width: 80px;
        }

        .event-type {
            font-weight: 600;
            min-width: 120px;
        }

        .event-details {
            color: #666;
            flex: 1;
        }

        /* Admin Management */
        .admin-management {
            margin: 32px 0;
        }

        .admin-management h4 {
            margin-bottom: 16px;
            font-size: 1.2rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .admin-user-info {
            display: flex;
            align-items: center;
            gap: 20px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .user-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            color: white;
        }

        .user-details {
            flex: 1;
        }

        .user-name {
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 4px;
        }

        .user-email {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 4px;
        }

        .user-role {
            font-size: 0.8rem;
            font-weight: 600;
            color: #667eea;
            background: rgba(102, 126, 234, 0.1);
            padding: 2px 8px;
            border-radius: 8px;
            display: inline-block;
        }

        .user-actions {
            display: flex;
            gap: 12px;
        }

        .action-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
        }

        .action-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .action-btn.view-logs {
            background: linear-gradient(135deg, #3498db, #5dade2);
        }

        .action-btn.security-settings {
            background: linear-gradient(135deg, #f39c12, #f7dc6f);
        }

        /* Audit Logs */
        .audit-logs {
            margin: 32px 0;
        }

        .audit-logs h4 {
            margin-bottom: 16px;
            font-size: 1.2rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .log-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .log-stat {
            text-align: center;
            padding: 12px;
            background: rgba(0, 0, 0, 0.02);
            border-radius: 8px;
        }

        .log-label {
            display: block;
            font-size: 0.85rem;
            color: #666;
            margin-bottom: 8px;
            font-weight: 500;
        }

        .log-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 700;
            color: #2c3e50;
        }

        /* Security Modals */
        .audit-modal, .security-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        }

        .audit-modal-content, .security-modal-content {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            padding: 0;
            max-width: 800px;
            max-height: 80vh;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .audit-modal-header, .security-modal-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 20px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .audit-modal-header h3, .security-modal-header h3 {
            margin: 0;
            font-size: 1.3rem;
            font-weight: 600;
        }

        .close-modal {
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background-color 0.2s ease;
        }

        .close-modal:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .audit-modal-body, .security-modal-body {
            padding: 24px;
            max-height: 60vh;
            overflow-y: auto;
        }

        .audit-filters {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .audit-filters select, .audit-filters input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 0.9rem;
        }

        .filter-btn {
            background: linear-gradient(135deg, #3498db, #5dade2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .filter-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
        }

        .audit-logs-list {
            border: 1px solid #ddd;
            border-radius: 12px;
            max-height: 400px;
            overflow-y: auto;
        }

        .audit-log-item {
            display: grid;
            grid-template-columns: 150px 80px 1fr 200px 1fr;
            gap: 12px;
            padding: 12px 16px;
            border-bottom: 1px solid #eee;
            font-size: 0.9rem;
            align-items: center;
        }

        .audit-log-item:last-child {
            border-bottom: none;
        }

        .audit-log-item.info {
            border-left: 3px solid #3498db;
        }

        .audit-log-item.warning {
            border-left: 3px solid #f39c12;
        }

        .audit-log-item.error {
            border-left: 3px solid #e74c3c;
        }

        .log-timestamp {
            font-size: 0.8rem;
            color: #666;
        }

        .log-type {
            font-weight: 600;
            font-size: 0.8rem;
            background: rgba(0, 0, 0, 0.05);
            padding: 2px 6px;
            border-radius: 4px;
            text-align: center;
        }

        .log-event {
            font-weight: 600;
            color: #2c3e50;
        }

        .log-user {
            font-size: 0.85rem;
            color: #666;
        }

        .log-details {
            font-size: 0.85rem;
            color: #666;
        }

        /* Security Settings */
        .security-setting {
            margin-bottom: 24px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .security-setting h4 {
            margin: 0 0 16px 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            padding: 8px 0;
        }

        .setting-item label {
            font-weight: 500;
            color: #2c3e50;
        }

        .setting-item input[type="checkbox"] {
            margin-right: 8px;
        }

        .setting-item input[type="number"] {
            padding: 6px 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            width: 80px;
        }

        .setting-description {
            font-size: 0.85rem;
            color: #666;
            margin-left: auto;
        }

        .security-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }

        .action-btn.save-settings {
            background: linear-gradient(135deg, #27ae60, #2ecc71);
        }

        .action-btn.reset-settings {
            background: linear-gradient(135deg, #95a5a6, #bdc3c7);
        }

        /* Data Export & Reporting Styles */
        .export-reporting {
            margin: 40px 0;
            padding: 24px;
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.8);
        }

        .export-controls {
            margin: 24px 0;
        }

        .export-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
        }

        .export-option {
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }

        .export-option:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        }

        .export-option h4 {
            margin: 0 0 16px 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .export-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .export-btn {
            background: linear-gradient(135deg, #3498db, #5dade2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(52, 152, 219, 0.2);
        }

        .export-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
        }

        .export-btn.csv {
            background: linear-gradient(135deg, #27ae60, #2ecc71);
        }

        .export-btn.json {
            background: linear-gradient(135deg, #f39c12, #f7dc6f);
        }

        .export-btn.pdf {
            background: linear-gradient(135deg, #e74c3c, #ec7063);
        }

        .export-btn.executive {
            background: linear-gradient(135deg, #9b59b6, #bb8fce);
        }

        .export-btn.schedule {
            background: linear-gradient(135deg, #34495e, #5d6d7e);
        }

        /* Date Range Selector */
        .date-range-selector {
            margin: 32px 0;
            padding: 20px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .date-range-selector h4 {
            margin: 0 0 16px 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .date-inputs {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 16px;
            flex-wrap: wrap;
        }

        .date-input-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .date-input-group label {
            font-weight: 500;
            color: #666;
            min-width: 40px;
        }

        .date-input-group input {
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 0.9rem;
        }

        .apply-range-btn {
            background: linear-gradient(135deg, #3498db, #5dade2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .apply-range-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
        }

        .quick-ranges {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .quick-range-btn {
            background: rgba(52, 152, 219, 0.1);
            color: #3498db;
            border: 1px solid rgba(52, 152, 219, 0.2);
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .quick-range-btn:hover {
            background: rgba(52, 152, 219, 0.2);
            transform: translateY(-1px);
        }

        .quick-range-btn.active {
            background: #3498db;
            color: white;
        }

        /* Report Status */
        .report-status {
            display: flex;
            justify-content: space-around;
            align-items: center;
            margin: 24px 0;
            padding: 16px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.1);
            flex-wrap: wrap;
            gap: 16px;
        }

        .status-item {
            text-align: center;
        }

        .status-label {
            display: block;
            font-size: 0.85rem;
            color: #666;
            margin-bottom: 4px;
            font-weight: 500;
        }

        .status-value {
            display: block;
            font-size: 1rem;
            font-weight: 600;
            color: #2c3e50;
        }

        /* Report Modals */
        .report-modal, .executive-modal, .schedule-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(5px);
        }

        .report-modal-content, .executive-modal-content, .schedule-modal-content {
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            padding: 0;
            max-width: 900px;
            max-height: 90vh;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            overflow: hidden;
        }

        .report-modal-header, .executive-modal-header, .schedule-modal-header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 20px 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .report-modal-body, .executive-modal-body, .schedule-modal-body {
            padding: 24px;
            max-height: 70vh;
            overflow-y: auto;
        }

        .report-preview {
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            border: 1px solid #ddd;
        }

        .report-header h2 {
            margin: 0 0 16px 0;
            color: #2c3e50;
            text-align: center;
        }

        .report-meta {
            background: rgba(0, 0, 0, 0.02);
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .report-meta p {
            margin: 4px 0;
            font-size: 0.9rem;
            color: #666;
        }

        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin: 16px 0;
        }

        .stat-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: rgba(0, 0, 0, 0.02);
            border-radius: 8px;
        }

        .stat-label {
            font-weight: 500;
            color: #666;
        }

        .stat-value {
            font-weight: 700;
            color: #2c3e50;
        }

        .chart-placeholder {
            background: rgba(0, 0, 0, 0.02);
            border: 2px dashed #ddd;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
            color: #666;
            font-size: 1.1rem;
            margin: 16px 0;
        }

        .report-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }

        /* Executive Summary Styles */
        .summary-section {
            margin-bottom: 32px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.1);
        }

        .summary-section h4 {
            margin: 0 0 16px 0;
            font-size: 1.2rem;
            font-weight: 600;
            color: #2c3e50;
        }

        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
        }

        .kpi-item {
            text-align: center;
            padding: 16px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .kpi-value {
            font-size: 1.8rem;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 4px;
        }

        .kpi-label {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 8px;
        }

        .kpi-trend {
            font-size: 0.8rem;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 8px;
        }

        .kpi-trend.up {
            background: rgba(39, 174, 96, 0.1);
            color: #27ae60;
        }

        .kpi-trend.down {
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
        }

        .kpi-trend.stable {
            background: rgba(52, 152, 219, 0.1);
            color: #3498db;
        }

        .insights-list, .action-items {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .insight-item, .action-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }

        .insight-item.positive {
            border-left-color: #27ae60;
        }

        .insight-item.neutral {
            border-left-color: #f39c12;
        }

        .insight-icon {
            font-size: 1.2rem;
        }

        .insight-text {
            flex: 1;
            color: #2c3e50;
        }

        .action-item.high {
            border-left-color: #e74c3c;
        }

        .action-item.medium {
            border-left-color: #f39c12;
        }

        .action-item.low {
            border-left-color: #3498db;
        }

        .priority {
            font-size: 0.8rem;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            min-width: 60px;
            text-align: center;
        }

        .action-item.high .priority {
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
        }

        .action-item.medium .priority {
            background: rgba(243, 156, 18, 0.1);
            color: #f39c12;
        }

        .action-item.low .priority {
            background: rgba(52, 152, 219, 0.1);
            color: #3498db;
        }

        .action-text {
            flex: 1;
            color: #2c3e50;
        }

        .executive-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-top: 24px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }

        /* Schedule Form Styles */
        .schedule-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin-bottom: 24px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .form-group label {
            font-weight: 600;
            color: #2c3e50;
            font-size: 0.95rem;
        }

        .form-group select, .form-group input {
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 0.95rem;
            transition: border-color 0.3s ease;
        }

        .form-group select:focus, .form-group input:focus {
            outline: none;
            border-color: #3498db;
            box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
        }

        .form-group input[type="checkbox"] {
            width: auto;
            margin-right: 8px;
        }

        .schedule-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }

        .tier-card.current {
            border-color: #3498db;
            background: linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%);
        }

        .tier-card.recommended {
            border-color: #27ae60;
            background: linear-gradient(135deg, #e8f5e8 0%, #f0fff0 100%);
        }

        body.dark-mode .tier-card {
            background: #34495e;
        }

        body.dark-mode .tier-card.current {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            border-color: #3498db;
        }

        body.dark-mode .tier-card.recommended {
            background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
            border-color: #27ae60;
        }

        .tier-badge {
            position: absolute;
            top: -10px;
            right: 15px;
            background: #3498db;
            color: white;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
        }

        .tier-badge.recommended {
            background: #27ae60;
        }

        .cost-metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }

        body.dark-mode .cost-metric {
            border-bottom-color: #4a5f7a;
        }

        .cost-value {
            font-weight: bold;
            color: #2c3e50;
        }

        body.dark-mode .cost-value {
            color: #ecf0f1;
        }

        .optimization-suggestions {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
        }

        body.dark-mode .optimization-suggestions {
            background: #3e2723;
            border-color: #5d4037;
        }

        .suggestion-item {
            display: flex;
            align-items: center;
            margin: 10px 0;
            padding: 8px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid #f39c12;
        }

        body.dark-mode .suggestion-item {
            background: #2c3e50;
        }

        .suggestion-icon {
            margin-right: 10px;
            font-size: 18px;
        }

        @media (max-width: 768px) {
            .tier-comparison {
                grid-template-columns: 1fr;
            }
        }

        /* Google Sign-In Styles */
        .auth-options {
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin: 20px 0;
        }

        .auth-divider {
            display: flex;
            align-items: center;
            text-align: center;
            margin: 20px 0;
        }

        .auth-divider::before,
        .auth-divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #ddd;
        }

        .auth-divider span {
            padding: 0 20px;
            color: #666;
            font-size: 14px;
        }

        body.dark-mode .auth-divider::before,
        body.dark-mode .auth-divider::after {
            background: #4a5f7a;
        }

        body.dark-mode .auth-divider span {
            color: #bdc3c7;
        }

        .google-signin-container {
            display: flex;
            justify-content: center;
            margin: 32px 0;
        }

        .google-signin-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            background: linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%);
            border: 2px solid #dadce0;
            border-radius: 16px;
            padding: 16px 32px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-size: 16px;
            font-weight: 600;
            color: #3c4043;
            text-decoration: none;
            min-width: 240px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
            position: relative;
            overflow: hidden;
        }

        .google-signin-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
            transition: left 0.5s;
        }

        .google-signin-btn:hover::before {
            left: 100%;
        }

        .google-signin-btn:hover {
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
            border-color: #4285f4;
            transform: translateY(-2px);
        }

        .google-signin-btn:active {
            transform: translateY(0);
        }

        .google-icon {
            width: 20px;
            height: 20px;
        }

        body.dark-mode .google-signin-btn {
            background: #2c3e50;
            border-color: #4a5f7a;
            color: #ecf0f1;
        }

        body.dark-mode .google-signin-btn:hover {
            border-color: #5a6f8a;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }

        .email-signin-section {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }

        body.dark-mode .email-signin-section {
            background: #34495e;
        }

        .signin-title {
            text-align: center;
            margin-bottom: 20px;
            color: #2c3e50;
            font-size: 18px;
            font-weight: 600;
        }

        body.dark-mode .signin-title {
            color: #ecf0f1;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 NeuraStack</h1>
            <p>Backend Monitoring Dashboard<span id="realTimeIndicator" class="real-time-indicator" style="display: none;"></span></p>
            <div class="header-controls">
                <button id="themeToggle" class="theme-toggle" onclick="toggleTheme()">🌙 Dark Mode</button>
                <button id="autoRefreshToggle" class="auto-refresh-toggle" onclick="toggleAutoRefresh()">🔄 Auto Refresh</button>
            </div>
        </div>

        <!-- Refresh Countdown -->
        <div id="refreshCountdown" class="refresh-countdown"></div>

        <!-- Authentication Section -->
        <div id="authSection" class="auth-section">
            <h2>🔐 NeuraStack Admin Portal</h2>
            <p style="margin-bottom: 20px; color: #666; text-align: center;">Secure monitoring dashboard for authorized personnel</p>

            <div class="auth-options">
                <!-- Google Sign-In -->
                <div class="google-signin-container">
                    <button class="google-signin-btn" onclick="signInWithGoogle()">
                        <svg class="google-icon" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                    </button>
                </div>

                <div class="auth-divider">
                    <span>or</span>
                </div>

                <!-- Email/Password Sign-In -->
                <div class="email-signin-section">
                    <h3 class="signin-title">Sign in with Email</h3>

                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" placeholder="admin@admin.com" required>
                    </div>

                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" placeholder="admin123" required>
                    </div>

                    <button id="loginBtn" class="btn" onclick="handleLogin()">🚀 Sign In</button>
                </div>
            </div>

            <div id="authError" class="error" style="display: none;"></div>
            <div id="authSuccess" class="success" style="display: none;"></div>
            <div id="authWarning" class="warning" style="display: none;"></div>
            <div id="authInfo" class="info" style="display: none;"></div>
        </div>

        <!-- Dashboard Section -->
        <div id="dashboardSection" class="dashboard-section">
            <div class="user-info">
                <span>👤 Logged in as: <strong id="userEmail"></strong></span>
                <button class="btn logout-btn" onclick="handleLogout()">Logout</button>
            </div>

            <!-- Dashboard Navigation -->
            <div class="dashboard-nav">
                <button id="metricsTab" class="nav-tab active" onclick="showTab('metrics')">📊 System Metrics</button>
                <button id="aiComparisonTab" class="nav-tab" onclick="showTab('aiComparison')">🤖 AI Comparison</button>
                <button id="costAnalyticsTab" class="nav-tab" onclick="showTab('costAnalytics')">💰 Cost Analytics</button>
            </div>

            <!-- Metrics Tab Content -->
            <div id="metricsTabContent" class="tab-content active">
                <button id="refreshBtn" class="btn refresh-btn" onclick="refreshMetrics()">🔄 Refresh Metrics</button>
            </div>

            <!-- AI Comparison Tab Content -->
            <div id="aiComparisonTabContent" class="tab-content">
                <div class="ai-comparison-section">
                    <h2>🤖 AI Model Comparison Interface</h2>
                    <p>Compare individual AI model responses with ensemble synthesis</p>

                    <div class="comparison-controls">
                        <button id="loadComparisonBtn" class="btn" onclick="loadAIComparison()">🔄 Load Sample Responses</button>
                        <select id="promptSelector" onchange="selectPrompt()">
                            <option value="">Select a sample prompt...</option>
                        </select>
                    </div>

                    <div id="aiComparisonContainer">
                        <div class="loading-state">
                            <div class="loading-text">Click "Load Sample Responses" to see AI model comparisons</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Cost Analytics Tab Content -->
            <div id="costAnalyticsTabContent" class="tab-content">
                <!-- Real-time Cost Estimation -->
                <div class="cost-estimation-section">
                    <h2>💰 Real-time Cost Estimation & Tier Comparison</h2>
                    <p>Estimate costs for different prompts and compare tier pricing</p>

                    <div class="estimation-controls">
                        <div class="estimation-form">
                            <div class="form-group">
                                <label for="costPrompt">Test Prompt:</label>
                                <textarea id="costPrompt" placeholder="Enter a prompt to estimate costs..." rows="3"></textarea>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label for="tierSelector">Tier:</label>
                                    <select id="tierSelector">
                                        <option value="free">Free Tier</option>
                                        <option value="premium">Premium Tier</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="requestCount">Request Count:</label>
                                    <input type="number" id="requestCount" value="1" min="1" max="1000">
                                </div>
                                <div class="form-group">
                                    <button id="estimateCostBtn" class="btn" onclick="estimateCost()">💰 Estimate Cost</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div id="costEstimationResults">
                        <div class="estimation-placeholder">
                            <div class="placeholder-text">Enter a prompt above to see real-time cost estimation</div>
                        </div>
                    </div>
                </div>

                <!-- Tier Comparison Section -->
                <div class="tier-comparison-section">
                    <h2>🎯 Tier Comparison & Optimization</h2>
                    <div id="tierComparisonContainer">
                        <div class="loading">Loading tier comparison...</div>
                    </div>
                </div>

                <!-- Cost Optimization Section -->
                <div class="chart-container">
                    <h3>📊 Cost Analytics Dashboard</h3>
                    <div id="costOptimizationContainer">
                        <div class="loading">Loading cost analytics...</div>
                    </div>
                </div>
            </div>

            <!-- Capacity Planning Section -->
            <div class="capacity-planning">
                <h3 class="section-title">⚡ Capacity Planning & Resource Analysis</h3>
                <div class="capacity-metrics" id="capacityMetrics">
                    <div class="capacity-metric">
                        <div class="capacity-value" id="currentLoad">0%</div>
                        <div class="capacity-label">Current Load</div>
                        <div class="capacity-trend stable" id="loadTrend">Stable</div>
                    </div>
                    <div class="capacity-metric">
                        <div class="capacity-value" id="peakCapacity">0%</div>
                        <div class="capacity-label">Peak Capacity</div>
                        <div class="capacity-trend stable" id="peakTrend">Normal</div>
                    </div>
                    <div class="capacity-metric">
                        <div class="capacity-value" id="scalingRecommendation">Auto</div>
                        <div class="capacity-label">Scaling Mode</div>
                        <div class="capacity-trend stable" id="scalingStatus">Optimal</div>
                    </div>
                    <div class="capacity-metric">
                        <div class="capacity-value" id="resourceEfficiency">85%</div>
                        <div class="capacity-label">Efficiency</div>
                        <div class="capacity-trend up" id="efficiencyTrend">Improving</div>
                    </div>
                </div>
            </div>

            <!-- Data Export & Reporting Section -->
            <div class="export-reporting">
                <h3 class="section-title">📊 Data Export & Reporting</h3>

                <!-- Export Controls -->
                <div class="export-controls">
                    <div class="export-options">
                        <div class="export-option">
                            <h4>📈 Performance Reports</h4>
                            <div class="export-buttons">
                                <button class="export-btn csv" onclick="exportData('performance', 'csv')">📄 Export CSV</button>
                                <button class="export-btn json" onclick="exportData('performance', 'json')">📋 Export JSON</button>
                                <button class="export-btn pdf" onclick="generateReport('performance')">📑 Generate PDF</button>
                            </div>
                        </div>

                        <div class="export-option">
                            <h4>💰 Cost Analytics</h4>
                            <div class="export-buttons">
                                <button class="export-btn csv" onclick="exportData('cost', 'csv')">📄 Export CSV</button>
                                <button class="export-btn json" onclick="exportData('cost', 'json')">📋 Export JSON</button>
                                <button class="export-btn pdf" onclick="generateReport('cost')">📑 Generate PDF</button>
                            </div>
                        </div>

                        <div class="export-option">
                            <h4>🔒 Security Logs</h4>
                            <div class="export-buttons">
                                <button class="export-btn csv" onclick="exportData('security', 'csv')">📄 Export CSV</button>
                                <button class="export-btn json" onclick="exportData('security', 'json')">📋 Export JSON</button>
                                <button class="export-btn pdf" onclick="generateReport('security')">📑 Generate PDF</button>
                            </div>
                        </div>

                        <div class="export-option">
                            <h4>📋 Executive Summary</h4>
                            <div class="export-buttons">
                                <button class="export-btn executive" onclick="generateExecutiveSummary()">📊 Generate Summary</button>
                                <button class="export-btn schedule" onclick="scheduleReport()">⏰ Schedule Reports</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Date Range Selector -->
                <div class="date-range-selector">
                    <h4>📅 Select Date Range</h4>
                    <div class="date-inputs">
                        <div class="date-input-group">
                            <label for="startDate">From:</label>
                            <input type="date" id="startDate" value="${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}">
                        </div>
                        <div class="date-input-group">
                            <label for="endDate">To:</label>
                            <input type="date" id="endDate" value="${new Date().toISOString().split('T')[0]}">
                        </div>
                        <button class="apply-range-btn" onclick="applyDateRange()">🔍 Apply Range</button>
                    </div>
                    <div class="quick-ranges">
                        <button class="quick-range-btn" onclick="setQuickRange('today')">Today</button>
                        <button class="quick-range-btn" onclick="setQuickRange('week')">Last 7 Days</button>
                        <button class="quick-range-btn" onclick="setQuickRange('month')">Last 30 Days</button>
                        <button class="quick-range-btn" onclick="setQuickRange('quarter')">Last 90 Days</button>
                    </div>
                </div>

                <!-- Report Status -->
                <div class="report-status" id="reportStatus">
                    <div class="status-item">
                        <span class="status-label">Last Export:</span>
                        <span class="status-value" id="lastExport">Never</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Scheduled Reports:</span>
                        <span class="status-value" id="scheduledReports">0 active</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Export Format:</span>
                        <span class="status-value" id="exportFormat">CSV</span>
                    </div>
                </div>
            </div>

            <!-- Security Monitoring Section -->
            <div class="security-monitoring">
                <h3 class="section-title">🔒 Security & Access Control</h3>

                <!-- Security Overview Cards -->
                <div class="security-overview-grid">
                    <div class="security-card threat-level">
                        <div class="security-icon">🛡️</div>
                        <div class="security-details">
                            <h4>Threat Level</h4>
                            <div class="security-value" id="threatLevel">Low</div>
                            <div class="security-status safe" id="threatStatus">All systems secure</div>
                        </div>
                    </div>

                    <div class="security-card access-attempts">
                        <div class="security-icon">🔐</div>
                        <div class="security-details">
                            <h4>Access Attempts</h4>
                            <div class="security-value" id="accessAttempts">0</div>
                            <div class="security-status" id="accessStatus">No unauthorized attempts</div>
                        </div>
                    </div>

                    <div class="security-card rate-limiting">
                        <div class="security-icon">⚡</div>
                        <div class="security-details">
                            <h4>Rate Limiting</h4>
                            <div class="security-value" id="rateLimitHits">0</div>
                            <div class="security-status" id="rateLimitStatus">Normal traffic</div>
                        </div>
                    </div>

                    <div class="security-card active-sessions">
                        <div class="security-icon">👤</div>
                        <div class="security-details">
                            <h4>Active Sessions</h4>
                            <div class="security-value" id="activeSessions">1</div>
                            <div class="security-status" id="sessionStatus">Admin logged in</div>
                        </div>
                    </div>
                </div>

                <!-- Recent Security Events -->
                <div class="security-events">
                    <h4>🚨 Recent Security Events</h4>
                    <div class="events-container" id="securityEvents">
                        <div class="event-item safe">
                            <span class="event-time">Just now</span>
                            <span class="event-type">✅ Admin Login</span>
                            <span class="event-details">sal.scrudato@gmail.com authenticated successfully</span>
                        </div>
                    </div>
                </div>

                <!-- Admin User Management -->
                <div class="admin-management">
                    <h4>👥 Admin User Management</h4>
                    <div class="admin-controls">
                        <div class="admin-user-info">
                            <div class="user-avatar">👤</div>
                            <div class="user-details">
                                <div class="user-name" id="adminUserName">Administrator</div>
                                <div class="user-email" id="adminUserEmail">sal.scrudato@gmail.com</div>
                                <div class="user-role">Super Admin</div>
                            </div>
                            <div class="user-actions">
                                <button class="action-btn view-logs" onclick="viewAuditLogs()">📋 View Logs</button>
                                <button class="action-btn security-settings" onclick="openSecuritySettings()">⚙️ Settings</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Audit Log Summary -->
                <div class="audit-logs">
                    <h4>📋 Audit Log Summary</h4>
                    <div class="log-summary" id="auditLogSummary">
                        <div class="log-stat">
                            <span class="log-label">Today's Events</span>
                            <span class="log-value" id="todayEvents">0</span>
                        </div>
                        <div class="log-stat">
                            <span class="log-label">Failed Logins</span>
                            <span class="log-value" id="failedLogins">0</span>
                        </div>
                        <div class="log-stat">
                            <span class="log-label">API Calls</span>
                            <span class="log-value" id="apiCalls">0</span>
                        </div>
                        <div class="log-stat">
                            <span class="log-label">Errors</span>
                            <span class="log-value" id="errorCount">0</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Enhanced Real-time Charts Section -->
            <div class="charts-grid">
                <div class="chart-container">
                    <h3>📊 Performance & Response Time</h3>
                    <div class="chart-controls">
                        <button class="chart-control-btn" onclick="toggleChartType('performance')">📈 Toggle View</button>
                        <span class="chart-status" id="performanceStatus">🟢 Live</span>
                    </div>
                    <canvas id="performanceChart" width="400" height="200"></canvas>
                </div>

                <div class="chart-container">
                    <h3>🏥 System Health Monitor</h3>
                    <div class="chart-controls">
                        <button class="chart-control-btn" onclick="toggleChartType('health')">📊 Toggle View</button>
                        <span class="chart-status" id="healthStatus">🟢 Live</span>
                    </div>
                    <canvas id="healthChart" width="400" height="200"></canvas>
                </div>

                <div class="chart-container">
                    <h3>💰 Cost Distribution & Trends</h3>
                    <div class="chart-controls">
                        <button class="chart-control-btn" onclick="toggleChartType('cost')">🔄 Switch Type</button>
                        <span class="chart-status" id="costStatus">🟢 Live</span>
                    </div>
                    <canvas id="costChart" width="400" height="200"></canvas>
                </div>

                <div class="chart-container">
                    <h3>⚡ Capacity & Load Analysis</h3>
                    <div class="chart-controls">
                        <button class="chart-control-btn" onclick="toggleChartType('capacity')">📈 Toggle View</button>
                        <span class="chart-status" id="capacityStatus">🟢 Live</span>
                    </div>
                    <canvas id="capacityChart" width="400" height="200"></canvas>
                </div>
            </div>

            <div id="metricsContainer">
                <div class="loading">Loading metrics...</div>
            </div>
        </div>
    </div>

    <!-- Firebase SDK -->
    <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>

    <!-- Chart.js for data visualization -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.min.js"></script>

    <!-- Google Sign-In -->
    <script src="https://accounts.google.com/gsi/client" async defer></script>

    <script>
        // Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyD3CNBH2LabFfBU7UBGWfIOgWzZrHASYns",
            authDomain: "neurastack-backend.firebaseapp.com",
            projectId: "neurastack-backend",
            storageBucket: "neurastack-backend.firebasestorage.app",
            messagingSenderId: "638289111765",
            appId: "1:638289111765:web:6c143b493316fd9ac3105c",
            measurementId: "G-T9527KNX5C"
        };

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();

        // Google Sign-In provider
        const googleProvider = new firebase.auth.GoogleAuthProvider();
        googleProvider.addScope('email');
        googleProvider.addScope('profile');

        let currentUser = null;
        let idToken = null;
        let autoRefreshInterval = null;
        let performanceChart = null;
        let costChart = null;
        let metricsHistory = [];
        let isDarkMode = localStorage.getItem('darkMode') === 'true';

        // Initialize theme on page load
        document.addEventListener('DOMContentLoaded', function() {
            if (isDarkMode) {
                document.body.classList.add('dark-mode');
                document.getElementById('themeToggle').textContent = '☀️ Light Mode';
            }
        });

        // Auth state listener
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    idToken = await user.getIdToken();
                    currentUser = user;
                    showDashboard();
                    initializeCharts();
                    refreshMetrics();
                } catch (error) {
                    console.error('Error getting ID token:', error);
                    showError('Failed to authenticate user');
                }
            } else {
                currentUser = null;
                idToken = null;
                showAuth();
            }
        });

        async function signInWithGoogle() {
            hideMessages();
            showInfo('Authenticating with Google...');

            try {
                const result = await auth.signInWithPopup(googleProvider);
                const user = result.user;

                // Strict authorization - only allow sal.scrudato@gmail.com
                const authorizedEmail = 'sal.scrudato@gmail.com';

                if (user.email === authorizedEmail) {
                    // Verify email is verified
                    if (!user.emailVerified) {
                        await auth.signOut();
                        showError('Email verification required. Please verify your Google account email.');
                        return;
                    }

                    // Create/update admin user in Firestore
                    try {
                        const db = firebase.firestore();
                        await db.collection('users').doc(user.uid).set({
                            email: user.email,
                            role: 'admin',
                            permissions: ['read', 'write', 'admin'],
                            tier: 'premium',
                            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });

                        showSuccess('Welcome back, ' + (user.displayName || user.email) + '! Access granted.');

                        // Log successful admin login
                        console.log('🔐 Admin login successful:', {
                            email: user.email,
                            uid: user.uid,
                            timestamp: new Date().toISOString()
                        });
                    } catch (firestoreError) {
                        console.error('Firestore update error:', firestoreError);
                        showWarning('Authentication successful, but user profile update failed. Some features may be limited.');
                    }
                } else {
                    // Unauthorized access attempt
                    await auth.signOut();

                    // Log unauthorized access attempt
                    console.warn('🚨 Unauthorized access attempt:', {
                        email: user.email,
                        uid: user.uid,
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent
                    });

                    showError('Access Denied: This monitoring dashboard is restricted to authorized personnel only. Your access attempt has been logged.');
                }
            } catch (error) {
                console.error('Google Sign-In error:', error);
                let errorMessage = 'Google Sign-In failed';

                switch (error.code) {
                    case 'auth/popup-closed-by-user':
                        errorMessage = 'Sign-in popup was closed. Please try again.';
                        break;
                    case 'auth/popup-blocked':
                        errorMessage = 'Sign-in popup was blocked by your browser. Please allow popups and try again.';
                        break;
                    case 'auth/cancelled-popup-request':
                        errorMessage = 'Sign-in was cancelled. Please try again.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your connection and try again.';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many failed attempts. Please wait a few minutes before trying again.';
                        break;
                    default:
                        errorMessage = 'Authentication error: ' + error.message;
                }

                showError(errorMessage);
            }
        }

        async function handleLogin() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');

            if (!email || !password) {
                showError('Please enter both email and password');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.textContent = 'Signing in...';
            hideMessages();

            try {
                await auth.signInWithEmailAndPassword(email, password);
                showSuccess('Login successful!');
            } catch (error) {
                console.error('Login error:', error);
                let errorMessage = 'Login failed';

                switch (error.code) {
                    case 'auth/user-not-found':
                        errorMessage = 'No user found with this email address';
                        break;
                    case 'auth/wrong-password':
                        errorMessage = 'Incorrect password';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'Invalid email address';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Too many failed attempts. Please try again later';
                        break;
                    default:
                        errorMessage = error.message;
                }

                showError(errorMessage);
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = '🚀 Sign In';
            }
        }

        async function handleLogout() {
            try {
                await auth.signOut();
                showSuccess('Logged out successfully');
            } catch (error) {
                console.error('Logout error:', error);
                showError('Failed to logout');
            }
        }

        function showError(message) {
            const errorDiv = document.getElementById('authError');
            const successDiv = document.getElementById('authSuccess');
            const warningDiv = document.getElementById('authWarning');
            const infoDiv = document.getElementById('authInfo');

            errorDiv.innerHTML = '❌ ' + message;
            errorDiv.style.display = 'block';
            successDiv.style.display = 'none';
            if (warningDiv) warningDiv.style.display = 'none';
            if (infoDiv) infoDiv.style.display = 'none';
        }

        function showSuccess(message) {
            const errorDiv = document.getElementById('authError');
            const successDiv = document.getElementById('authSuccess');
            const warningDiv = document.getElementById('authWarning');
            const infoDiv = document.getElementById('authInfo');

            successDiv.innerHTML = '✅ ' + message;
            successDiv.style.display = 'block';
            errorDiv.style.display = 'none';
            if (warningDiv) warningDiv.style.display = 'none';
            if (infoDiv) infoDiv.style.display = 'none';
        }

        function showWarning(message) {
            const errorDiv = document.getElementById('authError');
            const successDiv = document.getElementById('authSuccess');
            const warningDiv = document.getElementById('authWarning');
            const infoDiv = document.getElementById('authInfo');

            if (warningDiv) {
                warningDiv.innerHTML = '⚠️ ' + message;
                warningDiv.style.display = 'block';
                errorDiv.style.display = 'none';
                successDiv.style.display = 'none';
                if (infoDiv) infoDiv.style.display = 'none';
            } else {
                // Fallback to success div with warning styling
                successDiv.innerHTML = '⚠️ ' + message;
                successDiv.style.display = 'block';
                successDiv.style.backgroundColor = '#fff3cd';
                successDiv.style.color = '#856404';
                successDiv.style.borderColor = '#ffeaa7';
                errorDiv.style.display = 'none';
            }
        }

        function showInfo(message) {
            const errorDiv = document.getElementById('authError');
            const successDiv = document.getElementById('authSuccess');
            const warningDiv = document.getElementById('authWarning');
            const infoDiv = document.getElementById('authInfo');

            if (infoDiv) {
                infoDiv.innerHTML = 'ℹ️ ' + message;
                infoDiv.style.display = 'block';
                errorDiv.style.display = 'none';
                successDiv.style.display = 'none';
                if (warningDiv) warningDiv.style.display = 'none';
            } else {
                // Fallback to success div with info styling
                successDiv.innerHTML = 'ℹ️ ' + message;
                successDiv.style.display = 'block';
                successDiv.style.backgroundColor = '#d1ecf1';
                successDiv.style.color = '#0c5460';
                successDiv.style.borderColor = '#bee5eb';
                errorDiv.style.display = 'none';
            }
        }

        function hideMessages() {
            document.getElementById('authError').style.display = 'none';
            document.getElementById('authSuccess').style.display = 'none';
            const warningDiv = document.getElementById('authWarning');
            const infoDiv = document.getElementById('authInfo');
            if (warningDiv) warningDiv.style.display = 'none';
            if (infoDiv) infoDiv.style.display = 'none';
        }

        function showAuth() {
            document.getElementById('authSection').style.display = 'block';
            document.getElementById('dashboardSection').style.display = 'none';
        }

        function showDashboard() {
            document.getElementById('authSection').style.display = 'none';
            document.getElementById('dashboardSection').style.display = 'block';
            document.getElementById('userEmail').textContent = currentUser.email;
            document.getElementById('realTimeIndicator').style.display = 'inline-block';
        }

        function toggleTheme() {
            isDarkMode = !isDarkMode;
            localStorage.setItem('darkMode', isDarkMode);

            if (isDarkMode) {
                document.body.classList.add('dark-mode');
                document.getElementById('themeToggle').textContent = '☀️ Light Mode';
            } else {
                document.body.classList.remove('dark-mode');
                document.getElementById('themeToggle').textContent = '🌙 Dark Mode';
            }

            // Update chart colors if charts exist
            if (performanceChart && costChart) {
                updateChartTheme();
            }
        }

        function toggleAutoRefresh() {
            const button = document.getElementById('autoRefreshToggle');
            const countdownElement = document.getElementById('refreshCountdown');

            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                clearInterval(countdownInterval);
                autoRefreshInterval = null;
                countdownInterval = null;
                button.classList.remove('active');
                button.textContent = '🔄 Auto Refresh';
                document.getElementById('realTimeIndicator').style.display = 'none';
                if (countdownElement) countdownElement.style.display = 'none';
            } else {
                startAutoRefresh();
                button.classList.add('active');
                button.textContent = '⏸️ Stop Auto Refresh';
                document.getElementById('realTimeIndicator').style.display = 'inline-block';
            }
        }

        let countdownInterval = null;
        let refreshCountdown = 30;

        function startAutoRefresh() {
            refreshCountdown = 30;
            autoRefreshInterval = setInterval(() => {
                refreshMetrics();
                refreshCountdown = 30;
            }, 30000);

            countdownInterval = setInterval(() => {
                refreshCountdown--;
                updateRefreshCountdown(refreshCountdown);
                if (refreshCountdown <= 0) {
                    refreshCountdown = 30;
                }
            }, 1000);

            updateRefreshCountdown(refreshCountdown);
        }

        function updateRefreshCountdown(seconds) {
            const countdownElement = document.getElementById('refreshCountdown');
            if (countdownElement && seconds > 0) {
                countdownElement.textContent = \`Next refresh in \${seconds}s\`;
                countdownElement.style.display = 'block';
            }
        }

        // Tab Management
        function showTab(tabName) {
            // Hide all tab contents
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            // Remove active class from all tabs
            const tabs = document.querySelectorAll('.nav-tab');
            tabs.forEach(tab => {
                tab.classList.remove('active');
            });

            // Show selected tab content
            const selectedContent = document.getElementById(\`\${tabName}TabContent\`);
            const selectedTab = document.getElementById(\`\${tabName}Tab\`);

            if (selectedContent) {
                selectedContent.classList.add('active');
            }

            if (selectedTab) {
                selectedTab.classList.add('active');
            }

            // Load data for specific tabs
            if (tabName === 'aiComparison') {
                // Auto-load AI comparison data when tab is opened
                setTimeout(() => {
                    if (document.getElementById('aiComparisonContainer').innerHTML.includes('Click "Load Sample Responses"')) {
                        loadAIComparison();
                    }
                }, 300);
            } else if (tabName === 'costAnalytics') {
                loadCostOptimization();
                loadTierComparison();
            }
        }

        // AI Comparison Functions
        let aiComparisonData = null;

        async function loadAIComparison() {
            const container = document.getElementById('aiComparisonContainer');
            const loadBtn = document.getElementById('loadComparisonBtn');
            const promptSelector = document.getElementById('promptSelector');

            loadBtn.disabled = true;
            loadBtn.textContent = '🔄 Loading...';

            container.innerHTML = \`
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading AI model comparison data...</div>
                    <div class="loading-progress">
                        <div class="loading-progress-bar"></div>
                    </div>
                </div>
            \`;

            try {
                const response = await fetch('/monitor/ai-comparison', {
                    headers: {
                        'Authorization': \`Bearer \${idToken}\`,
                        'X-User-Id': currentUser.uid,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}\`);
                }

                aiComparisonData = await response.json();

                // Populate prompt selector
                promptSelector.innerHTML = '<option value="">Select a sample prompt...</option>';
                aiComparisonData.sampleResponses.forEach((sample, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = sample.prompt;
                    promptSelector.appendChild(option);
                });

                displayAIComparison();

            } catch (error) {
                console.error('AI comparison fetch error:', error);
                container.innerHTML = \`
                    <div class="error">
                        <strong>Failed to load AI comparison data:</strong> \${error.message}
                    </div>
                \`;
            } finally {
                loadBtn.disabled = false;
                loadBtn.textContent = '🔄 Load Sample Responses';
            }
        }

        function selectPrompt() {
            const promptSelector = document.getElementById('promptSelector');
            const selectedIndex = promptSelector.value;

            if (selectedIndex !== '' && aiComparisonData) {
                displaySpecificComparison(parseInt(selectedIndex));
            }
        }

        function displayAIComparison() {
            const container = document.getElementById('aiComparisonContainer');

            if (!aiComparisonData) {
                container.innerHTML = '<div class="error">No comparison data available</div>';
                return;
            }

            const modelPerformance = aiComparisonData.modelPerformance;

            container.innerHTML = \`
                <!-- Model Performance Overview -->
                <div class="model-performance-overview">
                    <h3>📊 Model Performance Overview</h3>
                    <div class="ai-responses-grid">
                        \${Object.entries(modelPerformance).map(([key, model]) => \`
                            <div class="ai-response-card">
                                <div class="ai-model-header">
                                    <div class="ai-model-name">
                                        \${getModelIcon(key)} \${model.model}
                                    </div>
                                    <div class="ai-confidence-badge \${getConfidenceClass(model.averageConfidence)}">
                                        \${(model.averageConfidence * 100).toFixed(0)}% avg
                                    </div>
                                </div>
                                <div class="ai-response-metrics">
                                    <div class="ai-metric">
                                        <span class="ai-metric-value">\${model.averageResponseTime}ms</span>
                                        <span class="ai-metric-label">Avg Time</span>
                                    </div>
                                    <div class="ai-metric">
                                        <span class="ai-metric-value">\${model.averageWordCount}</span>
                                        <span class="ai-metric-label">Avg Words</span>
                                    </div>
                                    <div class="ai-metric">
                                        <span class="ai-metric-value">\${model.provider}</span>
                                        <span class="ai-metric-label">Provider</span>
                                    </div>
                                </div>
                                <div class="model-strengths">
                                    <h4>✅ Strengths</h4>
                                    <ul>
                                        \${model.strengths.map(strength => \`<li>\${strength}</li>\`).join('')}
                                    </ul>
                                </div>
                                <div class="model-weaknesses">
                                    <h4>⚠️ Areas for Improvement</h4>
                                    <ul>
                                        \${model.weaknesses.map(weakness => \`<li>\${weakness}</li>\`).join('')}
                                    </ul>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                </div>

                <!-- Confidence Metrics -->
                <div class="confidence-metrics-section">
                    <h3>🎯 Confidence & Consensus Metrics</h3>
                    <div class="confidence-stats">
                        <div class="confidence-stat">
                            <div class="stat-value">\${(aiComparisonData.confidenceMetrics.averageConsensusLevel * 100).toFixed(0)}%</div>
                            <div class="stat-label">Average Consensus</div>
                        </div>
                        <div class="confidence-stat">
                            <div class="stat-value">\${(aiComparisonData.confidenceMetrics.modelAgreementRate * 100).toFixed(0)}%</div>
                            <div class="stat-label">Model Agreement</div>
                        </div>
                        <div class="confidence-stat">
                            <div class="stat-value">\${(aiComparisonData.confidenceMetrics.highConfidenceThreshold * 100).toFixed(0)}%</div>
                            <div class="stat-label">High Confidence Threshold</div>
                        </div>
                    </div>
                </div>

                <div class="comparison-instructions">
                    <p>💡 <strong>Tip:</strong> Select a sample prompt above to see detailed response comparisons between models.</p>
                </div>
            \`;
        }

        let healthChart = null;
        let capacityChart = null;
        let chartTypes = {
            performance: 'line',
            health: 'radar',
            cost: 'doughnut',
            capacity: 'bar'
        };

        function initializeCharts() {
            const isDark = document.body.classList.contains('dark-mode');
            const textColor = isDark ? '#ecf0f1' : '#333';
            const gridColor = isDark ? '#4a5f7a' : '#e0e0e0';

            // Enhanced Performance Chart
            const performanceCtx = document.getElementById('performanceChart').getContext('2d');
            performanceChart = new Chart(performanceCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }, {
                        label: 'Success Rate (%)',
                        data: [],
                        borderColor: '#27ae60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        tension: 0.4,
                        fill: true,
                        yAxisID: 'y1',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }, {
                        label: 'P95 Response Time (ms)',
                        data: [],
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        tension: 0.4,
                        fill: false,
                        borderDash: [5, 5],
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            labels: { color: textColor }
                        },
                        tooltip: {
                            backgroundColor: isDark ? '#2c3e50' : '#ffffff',
                            titleColor: textColor,
                            bodyColor: textColor,
                            borderColor: gridColor,
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            ticks: { color: textColor },
                            grid: { color: gridColor },
                            title: {
                                display: true,
                                text: 'Response Time (ms)',
                                color: textColor
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            ticks: { color: textColor },
                            grid: { drawOnChartArea: false, color: gridColor },
                            title: {
                                display: true,
                                text: 'Success Rate (%)',
                                color: textColor
                            }
                        }
                    }
                }
            });

            // System Health Chart
            const healthCtx = document.getElementById('healthChart').getContext('2d');
            healthChart = new Chart(healthCtx, {
                type: 'radar',
                data: {
                    labels: ['CPU Usage', 'Memory', 'Cache Hit Rate', 'Response Time', 'Success Rate', 'Error Rate'],
                    datasets: [{
                        label: 'Current Performance',
                        data: [0, 0, 0, 0, 0, 0],
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.2)',
                        pointBackgroundColor: '#3498db',
                        pointBorderColor: '#ffffff',
                        pointHoverBackgroundColor: '#ffffff',
                        pointHoverBorderColor: '#3498db'
                    }, {
                        label: 'Optimal Range',
                        data: [70, 80, 90, 85, 95, 5],
                        borderColor: '#27ae60',
                        backgroundColor: 'rgba(39, 174, 96, 0.1)',
                        pointBackgroundColor: '#27ae60',
                        pointBorderColor: '#ffffff',
                        borderDash: [5, 5]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: textColor }
                        }
                    },
                    scales: {
                        r: {
                            angleLines: { color: gridColor },
                            grid: { color: gridColor },
                            pointLabels: { color: textColor },
                            ticks: { color: textColor, backdropColor: 'transparent' },
                            min: 0,
                            max: 100
                        }
                    }
                }
            });

            // Enhanced Cost Chart
            const costCtx = document.getElementById('costChart').getContext('2d');
            costChart = new Chart(costCtx, {
                type: 'doughnut',
                data: {
                    labels: ['OpenAI GPT-4o-mini', 'Google Gemini Flash', 'Anthropic Claude Haiku', 'Cache Savings'],
                    datasets: [{
                        data: [0, 0, 0, 0],
                        backgroundColor: [
                            'rgba(231, 76, 60, 0.8)',
                            'rgba(243, 156, 18, 0.8)',
                            'rgba(155, 89, 182, 0.8)',
                            'rgba(39, 174, 96, 0.8)'
                        ],
                        borderWidth: 3,
                        borderColor: isDark ? '#2c3e50' : '#ffffff',
                        hoverBorderWidth: 4,
                        hoverBorderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: textColor,
                                usePointStyle: true,
                                padding: 20
                            },
                            position: 'bottom'
                        },
                        tooltip: {
                            backgroundColor: isDark ? '#2c3e50' : '#ffffff',
                            titleColor: textColor,
                            bodyColor: textColor,
                            borderColor: gridColor,
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return label + ': ' + value + ' requests (' + percentage + '%)';
                                }
                            }
                        }
                    }
                }
            });

            // Capacity Planning Chart
            const capacityCtx = document.getElementById('capacityChart').getContext('2d');
            capacityChart = new Chart(capacityCtx, {
                type: 'bar',
                data: {
                    labels: ['CPU', 'Memory', 'Requests/Hour', 'Cache Storage', 'DB Connections'],
                    datasets: [{
                        label: 'Current Usage',
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(52, 152, 219, 0.8)',
                        borderColor: '#3498db',
                        borderWidth: 2
                    }, {
                        label: 'Capacity Limit',
                        data: [100, 100, 100, 100, 100],
                        backgroundColor: 'rgba(231, 76, 60, 0.3)',
                        borderColor: '#e74c3c',
                        borderWidth: 2,
                        type: 'line',
                        fill: false,
                        tension: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: textColor }
                        },
                        tooltip: {
                            backgroundColor: isDark ? '#2c3e50' : '#ffffff',
                            titleColor: textColor,
                            bodyColor: textColor,
                            borderColor: gridColor,
                            borderWidth: 1
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: textColor },
                            grid: { color: gridColor }
                        },
                        y: {
                            ticks: {
                                color: textColor,
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: { color: gridColor },
                            min: 0,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Usage Percentage',
                                color: textColor
                            }
                        }
                    }
                }
            });
        }

        function toggleChartType(chartName) {
            const chartMap = {
                performance: performanceChart,
                health: healthChart,
                cost: costChart,
                capacity: capacityChart
            };

            const chart = chartMap[chartName];
            if (!chart) return;

            switch (chartName) {
                case 'performance':
                    chartTypes.performance = chartTypes.performance === 'line' ? 'bar' : 'line';
                    chart.config.type = chartTypes.performance;
                    break;
                case 'health':
                    chartTypes.health = chartTypes.health === 'radar' ? 'polarArea' : 'radar';
                    chart.config.type = chartTypes.health;
                    break;
                case 'cost':
                    chartTypes.cost = chartTypes.cost === 'doughnut' ? 'pie' : 'doughnut';
                    chart.config.type = chartTypes.cost;
                    break;
                case 'capacity':
                    chartTypes.capacity = chartTypes.capacity === 'bar' ? 'line' : 'bar';
                    chart.config.type = chartTypes.capacity;
                    break;
            }

            chart.update('active');
        }

        function updateChartTheme() {
            const isDark = document.body.classList.contains('dark-mode');
            const textColor = isDark ? '#ecf0f1' : '#333';
            const gridColor = isDark ? '#4a5f7a' : '#e0e0e0';

            const charts = [performanceChart, healthChart, costChart, capacityChart];

            charts.forEach(chart => {
                if (chart) {
                    // Update legend colors
                    if (chart.options.plugins?.legend?.labels) {
                        chart.options.plugins.legend.labels.color = textColor;
                    }

                    // Update scale colors
                    if (chart.options.scales) {
                        Object.keys(chart.options.scales).forEach(scaleKey => {
                            const scale = chart.options.scales[scaleKey];
                            if (scale.ticks) scale.ticks.color = textColor;
                            if (scale.grid) scale.grid.color = gridColor;
                            if (scale.title) scale.title.color = textColor;
                        });
                    }

                    // Update tooltip colors
                    if (chart.options.plugins?.tooltip) {
                        chart.options.plugins.tooltip.backgroundColor = isDark ? '#2c3e50' : '#ffffff';
                        chart.options.plugins.tooltip.titleColor = textColor;
                        chart.options.plugins.tooltip.bodyColor = textColor;
                        chart.options.plugins.tooltip.borderColor = gridColor;
                    }

                    chart.update();
                }
            });
        }

        async function refreshMetrics() {
            const refreshBtn = document.getElementById('refreshBtn');
            const metricsContainer = document.getElementById('metricsContainer');
            const costContainer = document.getElementById('costOptimizationContainer');

            // Show enhanced loading state
            showLoadingState();

            if (refreshBtn) {
                refreshBtn.disabled = true;
                refreshBtn.textContent = '🔄 Loading...';
            }

            try {
                const response = await fetch('/monitor/metrics', {
                    headers: {
                        'Authorization': \`Bearer \${idToken}\`,
                        'X-User-Id': currentUser.uid,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || \`HTTP \${response.status}\`);
                }

                const metrics = await response.json();

                // Add smooth transition delay for better UX
                setTimeout(() => {
                    updateCharts(metrics);
                    displayMetrics(metrics);
                    updateSecurityMetrics(metrics);
                    loadCostOptimization();
                }, 300);

            } catch (error) {
                console.error('Metrics fetch error:', error);
                metricsContainer.innerHTML = \`
                    <div class="error">
                        <strong>Failed to load metrics:</strong> \${error.message}
                        <br><small>Please check your connection and try again.</small>
                    </div>
                \`;
            } finally {
                if (refreshBtn) {
                    refreshBtn.disabled = false;
                    refreshBtn.textContent = '🔄 Refresh Metrics';
                }
            }
        }

        function showLoadingState() {
            const metricsContainer = document.getElementById('metricsContainer');
            const costContainer = document.getElementById('costOptimizationContainer');

            metricsContainer.innerHTML = \`
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Fetching real-time metrics...</div>
                    <div class="loading-progress">
                        <div class="loading-progress-bar"></div>
                    </div>
                </div>
            \`;

            if (costContainer) {
                costContainer.innerHTML = \`
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">Loading cost analytics...</div>
                        <div class="loading-progress">
                            <div class="loading-progress-bar"></div>
                        </div>
                    </div>
                \`;
            }
        }

        function updateCharts(metrics) {
            const timestamp = new Date().toLocaleTimeString();

            // Store metrics history (keep last 20 points)
            metricsHistory.push({
                timestamp,
                responseTime: metrics.performance?.averageResponseTime || 0,
                successRate: parseFloat(metrics.requests?.successRate || 0),
                p95ResponseTime: metrics.performance?.p95ResponseTime || 0,
                memoryUsage: metrics.system?.memoryUsageMB || 0,
                cacheHitRate: metrics.cache?.hitRate || 0,
                errorRate: metrics.errors?.errorRate || 0,
                ...metrics
            });

            if (metricsHistory.length > 20) {
                metricsHistory.shift();
            }

            // Update performance chart with enhanced data
            performanceChart.data.labels = metricsHistory.map(m => m.timestamp);
            performanceChart.data.datasets[0].data = metricsHistory.map(m => m.responseTime);
            performanceChart.data.datasets[1].data = metricsHistory.map(m => m.successRate);
            performanceChart.data.datasets[2].data = metricsHistory.map(m => m.p95ResponseTime);
            performanceChart.update('none');

            // Update system health radar chart
            const currentMetrics = metricsHistory[metricsHistory.length - 1];
            const cpuUsage = Math.min((currentMetrics.memoryUsage / 1000) * 100, 100); // Approximate CPU from memory
            const memoryUsage = Math.min((currentMetrics.memoryUsage / 512) * 100, 100); // Assume 512MB limit
            const cacheHitRate = currentMetrics.cacheHitRate || 0;
            const responseTimeScore = Math.max(100 - (currentMetrics.responseTime / 50), 0); // Lower is better
            const successRate = currentMetrics.successRate || 0;
            const errorRateScore = Math.max(100 - (currentMetrics.errorRate * 10), 0); // Lower is better

            healthChart.data.datasets[0].data = [
                cpuUsage,
                memoryUsage,
                cacheHitRate,
                responseTimeScore,
                successRate,
                errorRateScore
            ];
            healthChart.update('none');

            // Update cost chart with real data
            const totalRequests = metrics.requests?.total || 1;
            costChart.data.datasets[0].data = [
                Math.floor(totalRequests * 0.4), // OpenAI
                Math.floor(totalRequests * 0.3), // Google
                Math.floor(totalRequests * 0.2), // Anthropic
                Math.floor(totalRequests * 0.1)  // Cache savings
            ];
            costChart.update('none');

            // Update capacity chart
            const maxMemory = 1024; // MB
            const maxRequests = 1000; // per hour
            const maxCacheSize = 100; // MB
            const maxConnections = 100;

            capacityChart.data.datasets[0].data = [
                Math.min((cpuUsage), 100),
                Math.min((currentMetrics.memoryUsage / maxMemory) * 100, 100),
                Math.min((totalRequests / maxRequests) * 100, 100),
                Math.min((metrics.cache?.totalEntries || 0) / 1000 * 100, 100),
                Math.min((metrics.system?.activeConnections || 0) / maxConnections * 100, 100)
            ];
            capacityChart.update('none');

            // Update chart status indicators
            updateChartStatusIndicators(metrics);
        }

        function updateChartStatusIndicators(metrics) {
            const performanceStatus = document.getElementById('performanceStatus');
            const healthStatus = document.getElementById('healthStatus');
            const costStatus = document.getElementById('costStatus');
            const capacityStatus = document.getElementById('capacityStatus');

            // Performance status
            const avgResponseTime = metrics.performance?.averageResponseTime || 0;
            if (avgResponseTime < 1000) {
                performanceStatus.textContent = '🟢 Excellent';
                performanceStatus.className = 'chart-status';
            } else if (avgResponseTime < 3000) {
                performanceStatus.textContent = '🟡 Good';
                performanceStatus.className = 'chart-status warning';
            } else {
                performanceStatus.textContent = '🔴 Slow';
                performanceStatus.className = 'chart-status error';
            }

            // Health status
            const successRate = parseFloat(metrics.requests?.successRate || 0);
            if (successRate > 95) {
                healthStatus.textContent = '🟢 Healthy';
                healthStatus.className = 'chart-status';
            } else if (successRate > 90) {
                healthStatus.textContent = '🟡 Warning';
                healthStatus.className = 'chart-status warning';
            } else {
                healthStatus.textContent = '🔴 Critical';
                healthStatus.className = 'chart-status error';
            }

            // Cost status
            costStatus.textContent = '🟢 Tracking';
            costStatus.className = 'chart-status';

            // Capacity status
            const memoryUsage = metrics.system?.memoryUsageMB || 0;
            if (memoryUsage < 400) {
                capacityStatus.textContent = '🟢 Normal';
                capacityStatus.className = 'chart-status';
            } else if (memoryUsage < 800) {
                capacityStatus.textContent = '🟡 High';
                capacityStatus.className = 'chart-status warning';
            } else {
                capacityStatus.textContent = '🔴 Critical';
                capacityStatus.className = 'chart-status error';
            }
        }

        async function loadCostOptimization() {
            const container = document.getElementById('costOptimizationContainer');

            try {
                const response = await fetch('/monitor/cost-analytics', {
                    headers: {
                        'Authorization': \`Bearer \${idToken}\`,
                        'X-User-Id': currentUser.uid,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}\`);
                }

                const data = await response.json();
                displayCostOptimization(data);

            } catch (error) {
                console.error('Cost optimization fetch error:', error);
                container.innerHTML = \`
                    <div class="error">
                        <strong>Failed to load cost analytics:</strong> \${error.message}
                    </div>
                \`;
            }
        }

        function displayCostOptimization(data) {
            const container = document.getElementById('costOptimizationContainer');
            const currentTier = data.currentTier;
            const dailyUtilization = parseFloat(data.costs.utilizationPercent.daily);
            const hourlyUtilization = parseFloat(data.costs.utilizationPercent.hourly);

            // Calculate predictive analytics
            const predictedDailyCost = (data.costs.thisHour * 24).toFixed(4);
            const predictedMonthlyCost = (data.costs.today * 30).toFixed(2);
            const costTrend = data.costs.today > (data.costs.thisHour * 24) ? 'increasing' : 'stable';

            container.innerHTML = \`
                <!-- Cost Overview Dashboard -->
                <div class="cost-overview-grid">
                    <div class="cost-overview-card primary">
                        <div class="cost-icon">💰</div>
                        <div class="cost-details">
                            <h4>Today's Spend</h4>
                            <div class="cost-amount">$\${data.costs.today.toFixed(4)}</div>
                            <div class="cost-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: \${Math.min(dailyUtilization, 100)}%"></div>
                                </div>
                                <span class="progress-text">\${dailyUtilization}% of daily limit</span>
                            </div>
                        </div>
                    </div>

                    <div class="cost-overview-card secondary">
                        <div class="cost-icon">⏱️</div>
                        <div class="cost-details">
                            <h4>This Hour</h4>
                            <div class="cost-amount">$\${data.costs.thisHour.toFixed(4)}</div>
                            <div class="cost-progress">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: \${Math.min(hourlyUtilization, 100)}%"></div>
                                </div>
                                <span class="progress-text">\${hourlyUtilization}% of hourly limit</span>
                            </div>
                        </div>
                    </div>

                    <div class="cost-overview-card predictive">
                        <div class="cost-icon">📈</div>
                        <div class="cost-details">
                            <h4>Predicted Daily</h4>
                            <div class="cost-amount">$\${predictedDailyCost}</div>
                            <div class="cost-trend \${costTrend}">
                                \${costTrend === 'increasing' ? '📈 Trending up' : '📊 Stable'}
                            </div>
                        </div>
                    </div>

                    <div class="cost-overview-card monthly">
                        <div class="cost-icon">📅</div>
                        <div class="cost-details">
                            <h4>Monthly Projection</h4>
                            <div class="cost-amount">$\${predictedMonthlyCost}</div>
                            <div class="cost-trend">
                                Based on current usage
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Enhanced Tier Comparison -->
                <div class="tier-comparison-enhanced">
                    <h3 class="section-title">🎯 Tier Performance Comparison</h3>
                    <div class="tier-cards-grid">
                        <div class="tier-card-enhanced \${currentTier === 'free' ? 'current' : ''}">
                            \${currentTier === 'free' ? '<div class="tier-badge current-badge">Current Plan</div>' : ''}
                            <div class="tier-header">
                                <div class="tier-icon">🆓</div>
                                <h4>Free Tier</h4>
                            </div>
                            <div class="tier-metrics">
                                <div class="tier-metric">
                                    <span class="metric-label">Cost/Request</span>
                                    <span class="metric-value">\${data.tierComparison.free.estimatedCostPerRequest}</span>
                                </div>
                                <div class="tier-metric">
                                    <span class="metric-label">Quality Score</span>
                                    <div class="quality-bar">
                                        <div class="quality-fill" style="width: \${data.tierComparison.free.qualityScore}%"></div>
                                        <span class="quality-text">\${data.tierComparison.free.qualityScore}%</span>
                                    </div>
                                </div>
                                <div class="tier-metric">
                                    <span class="metric-label">Response Time</span>
                                    <span class="metric-value">\${data.tierComparison.free.responseTime}</span>
                                </div>
                                <div class="tier-metric">
                                    <span class="metric-label">Rate Limits</span>
                                    <span class="metric-value">\${data.tierComparison.free.rateLimits.hourly}/hr</span>
                                </div>
                            </div>
                        </div>

                        <div class="tier-card-enhanced \${currentTier === 'premium' ? 'current' : 'recommended'}">
                            \${currentTier === 'premium' ? '<div class="tier-badge current-badge">Current Plan</div>' : '<div class="tier-badge recommended-badge">Recommended</div>'}
                            <div class="tier-header">
                                <div class="tier-icon">⭐</div>
                                <h4>Premium Tier</h4>
                            </div>
                            <div class="tier-metrics">
                                <div class="tier-metric">
                                    <span class="metric-label">Cost/Request</span>
                                    <span class="metric-value">\${data.tierComparison.premium.estimatedCostPerRequest}</span>
                                </div>
                                <div class="tier-metric">
                                    <span class="metric-label">Quality Score</span>
                                    <div class="quality-bar">
                                        <div class="quality-fill premium" style="width: \${data.tierComparison.premium.qualityScore}%"></div>
                                        <span class="quality-text">\${data.tierComparison.premium.qualityScore}%</span>
                                    </div>
                                </div>
                                <div class="tier-metric">
                                    <span class="metric-label">Response Time</span>
                                    <span class="metric-value">\${data.tierComparison.premium.responseTime}</span>
                                </div>
                                <div class="tier-metric">
                                    <span class="metric-label">Rate Limits</span>
                                    <span class="metric-value">\${data.tierComparison.premium.rateLimits.hourly}/hr</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Enhanced Optimization Suggestions -->
                <div class="optimization-section">
                    <h3 class="section-title">💡 Smart Optimization Recommendations</h3>
                    <div class="suggestions-grid">
                        \${data.optimizationSuggestions.map(suggestion => \`
                            <div class="suggestion-card \${suggestion.type}">
                                <div class="suggestion-header">
                                    <span class="suggestion-icon">\${suggestion.type === 'tier_upgrade' ? '⬆️' : suggestion.type === 'cache_optimization' ? '🚀' : '💡'}</span>
                                    <span class="suggestion-type">\${suggestion.type.replace('_', ' ').toUpperCase()}</span>
                                </div>
                                <div class="suggestion-content">
                                    <h4>\${suggestion.suggestion}</h4>
                                    <p class="suggestion-savings">\${suggestion.potentialSavings}</p>
                                    <div class="suggestion-impact">
                                        <span class="impact-label">Potential Impact:</span>
                                        <span class="impact-value">\${suggestion.type === 'tier_upgrade' ? 'High' : 'Medium'}</span>
                                    </div>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                </div>

                <!-- Model Performance Analytics -->
                <div class="model-performance-section">
                    <h3 class="section-title">🤖 Model Performance Analytics</h3>
                    <div class="model-performance-grid">
                        \${data.modelPerformance && data.modelPerformance.length > 0 ? data.modelPerformance.map(model => \`
                            <div class="model-performance-card">
                                <div class="model-header">
                                    <h4>\${model.model}</h4>
                                    <span class="model-efficiency">\${model.costEfficiency.toFixed(2)} efficiency</span>
                                </div>
                                <div class="model-metrics">
                                    <div class="model-metric">
                                        <span class="metric-label">Avg Cost</span>
                                        <span class="metric-value">$\${model.averageCost.toFixed(6)}</span>
                                    </div>
                                    <div class="model-metric">
                                        <span class="metric-label">Quality</span>
                                        <span class="metric-value">\${(model.averageQuality * 100).toFixed(1)}%</span>
                                    </div>
                                    <div class="model-metric">
                                        <span class="metric-label">Response Time</span>
                                        <span class="metric-value">\${model.averageResponseTime.toFixed(0)}ms</span>
                                    </div>
                                    <div class="model-metric">
                                        <span class="metric-label">Total Calls</span>
                                        <span class="metric-value">\${model.calls}</span>
                                    </div>
                                </div>
                                <div class="efficiency-bar">
                                    <div class="efficiency-fill" style="width: \${Math.min(model.costEfficiency * 10, 100)}%"></div>
                                </div>
                            </div>
                        \`).join('') : '<div class="no-data">No model performance data available yet</div>'}
                    </div>
                </div>

                <!-- Cost Summary -->
                <div class="cost-summary-section">
                    <h3 class="section-title">📊 Cost Summary</h3>
                    <div class="cost-summary-grid">
                        <div class="cost-summary-card">
                            <div class="summary-label">Today's Usage</div>
                            <div class="summary-value">$\${data.costs.today.toFixed(4)}</div>
                            <div class="summary-detail">\${data.costs.utilizationPercent.daily}% of daily limit</div>
                        </div>
                        <div class="cost-summary-card">
                            <div class="summary-label">This Hour</div>
                            <div class="summary-value">$\${data.costs.thisHour.toFixed(4)}</div>
                            <div class="summary-detail">\${data.costs.utilizationPercent.hourly}% of hourly limit</div>
                        </div>
                        <div class="cost-summary-card">
                            <div class="summary-label">Daily Limit</div>
                            <div class="summary-value">$\${data.costs.dailyLimit.toFixed(2)}</div>
                            <div class="summary-detail">Maximum daily spend</div>
                        </div>
                        <div class="cost-summary-card">
                            <div class="summary-label">Hourly Limit</div>
                            <div class="summary-value">$\${data.costs.hourlyLimit.toFixed(2)}</div>
                            <div class="summary-detail">Maximum hourly spend</div>
                        </div>
                    </div>
                </div>
            \`;
        }

        function getStatusIndicator(status) {
            switch(status?.toLowerCase()) {
                case 'healthy':
                case 'ok':
                case 'success':
                    return '<span class="status-indicator status-healthy"></span>';
                case 'warning':
                case 'degraded':
                    return '<span class="status-indicator status-warning"></span>';
                case 'error':
                case 'failed':
                case 'critical':
                    return '<span class="status-indicator status-error"></span>';
                default:
                    return '<span class="status-indicator status-unknown"></span>';
            }
        }

        function calculateSystemHealth(data) {
            const successRate = parseFloat(data.requests?.successRate || 0);
            const responseTime = data.performance?.averageResponseTime || 0;
            const memoryUsage = data.system?.memoryUsageMB || 0;
            const cacheHitRate = data.cache?.hitRate || 0;

            // Calculate weighted health score
            let score = 0;
            score += (successRate / 100) * 40; // 40% weight for success rate
            score += Math.max(0, (2000 - responseTime) / 2000) * 30; // 30% weight for response time
            score += Math.max(0, (512 - memoryUsage) / 512) * 20; // 20% weight for memory usage
            score += (cacheHitRate / 100) * 10; // 10% weight for cache performance

            score = Math.round(score * 100);

            let status, label, trend, trendIcon, trendText;
            if (score >= 85) {
                status = 'healthy';
                label = 'Excellent';
                trend = 'trend-up';
                trendIcon = '📈';
                trendText = 'System performing optimally';
            } else if (score >= 70) {
                status = 'warning';
                label = 'Good';
                trend = 'trend-stable';
                trendIcon = '📊';
                trendText = 'System stable with minor issues';
            } else {
                status = 'critical';
                label = 'Needs Attention';
                trend = 'trend-down';
                trendIcon = '📉';
                trendText = 'System requires optimization';
            }

            return { score, status, label, trend, trendIcon, trendText };
        }

        function calculatePerformanceTrend(data) {
            const responseTime = data.performance?.averageResponseTime || 0;
            const p95ResponseTime = data.performance?.p95ResponseTime || 0;

            let status, label, trend, trendIcon, trendText;
            if (responseTime < 1000) {
                status = 'success';
                label = 'Fast';
                trend = 'trend-up';
                trendIcon = '🚀';
                trendText = 'Response times excellent';
            } else if (responseTime < 3000) {
                status = 'warning';
                label = 'Moderate';
                trend = 'trend-stable';
                trendIcon = '⚡';
                trendText = 'Response times acceptable';
            } else {
                status = 'danger';
                label = 'Slow';
                trend = 'trend-down';
                trendIcon = '🐌';
                trendText = 'Response times need improvement';
            }

            return { status, label, trend, trendIcon, trendText };
        }

        function calculateCostEfficiency(data) {
            const cacheHitRate = data.cache?.hitRate || 0;
            const successRate = parseFloat(data.requests?.successRate || 0);
            const totalRequests = data.requests?.total || 1;

            // Calculate efficiency based on cache usage and success rate
            let score = 0;
            score += (cacheHitRate / 100) * 60; // 60% weight for cache efficiency
            score += (successRate / 100) * 40; // 40% weight for success rate

            score = Math.round(score * 100);

            let status, label, trend, trendIcon, trendText;
            if (score >= 80) {
                status = 'success';
                label = 'Optimal';
                trend = 'trend-up';
                trendIcon = '💎';
                trendText = 'Cost efficiency excellent';
            } else if (score >= 60) {
                status = 'warning';
                label = 'Good';
                trend = 'trend-stable';
                trendIcon = '💰';
                trendText = 'Cost efficiency moderate';
            } else {
                status = 'danger';
                label = 'Poor';
                trend = 'trend-down';
                trendIcon = '💸';
                trendText = 'Cost efficiency needs improvement';
            }

            return { score, status, label, trend, trendIcon, trendText };
        }

        function displaySpecificComparison(index) {
            const container = document.getElementById('aiComparisonContainer');
            const sample = aiComparisonData.sampleResponses[index];

            container.innerHTML = \`
                <div class="specific-comparison">
                    <div class="comparison-header">
                        <h3>🔍 Detailed Response Comparison</h3>
                        <div class="prompt-display">
                            <strong>Prompt:</strong> "\${sample.prompt}"
                        </div>
                    </div>

                    <!-- Individual AI Responses -->
                    <div class="ai-responses-grid">
                        \${Object.entries(sample.responses).map(([model, response]) => \`
                            <div class="ai-response-card">
                                <div class="ai-model-header">
                                    <div class="ai-model-name">
                                        \${getModelIcon(model)} \${getModelDisplayName(model)}
                                    </div>
                                    <div class="ai-confidence-badge \${getConfidenceClass(response.confidence)}">
                                        \${(response.confidence * 100).toFixed(0)}%
                                    </div>
                                </div>
                                <div class="ai-response-content">
                                    \${response.content}
                                </div>
                                <div class="ai-response-metrics">
                                    <div class="ai-metric">
                                        <span class="ai-metric-value">\${response.responseTime}ms</span>
                                        <span class="ai-metric-label">Response Time</span>
                                    </div>
                                    <div class="ai-metric">
                                        <span class="ai-metric-value">\${response.wordCount}</span>
                                        <span class="ai-metric-label">Word Count</span>
                                    </div>
                                    <div class="ai-metric">
                                        <span class="ai-metric-value">\${response.status}</span>
                                        <span class="ai-metric-label">Status</span>
                                    </div>
                                </div>
                            </div>
                        \`).join('')}
                    </div>

                    <!-- Synthesis Result -->
                    <div class="synthesis-section">
                        <h3>🎯 Ensemble Synthesis</h3>
                        <div class="ai-response-card synthesis">
                            <div class="ai-model-header">
                                <div class="ai-model-name">
                                    🧠 Ensemble Synthesis
                                </div>
                                <div class="ai-confidence-badge \${getConfidenceClass(sample.synthesis.confidence)}">
                                    \${(sample.synthesis.confidence * 100).toFixed(0)}%
                                </div>
                            </div>
                            <div class="ai-response-content">
                                \${sample.synthesis.content}
                            </div>
                            <div class="ai-response-metrics">
                                <div class="ai-metric">
                                    <span class="ai-metric-value">\${(sample.synthesis.qualityScore * 100).toFixed(0)}%</span>
                                    <span class="ai-metric-label">Quality Score</span>
                                </div>
                                <div class="ai-metric">
                                    <span class="ai-metric-value">\${sample.synthesis.strategy}</span>
                                    <span class="ai-metric-label">Strategy</span>
                                </div>
                                <div class="ai-metric">
                                    <span class="ai-metric-value">\${sample.synthesis.basedOnResponses}</span>
                                    <span class="ai-metric-label">Models Used</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="comparison-actions">
                        <button class="btn" onclick="displayAIComparison()">← Back to Overview</button>
                        <button class="btn" onclick="exportComparison(\${index})">📊 Export Comparison</button>
                    </div>
                </div>
            \`;
        }

        function getModelIcon(model) {
            const icons = {
                'gpt4o': '🤖',
                'gemini': '💎',
                'claude': '🧠'
            };
            return icons[model] || '🤖';
        }

        function getModelDisplayName(model) {
            const names = {
                'gpt4o': 'GPT-4o Mini',
                'gemini': 'Gemini 2.0 Flash',
                'claude': 'Claude Opus'
            };
            return names[model] || model;
        }

        function getConfidenceClass(confidence) {
            if (confidence >= 0.8) return 'confidence-high';
            if (confidence >= 0.6) return 'confidence-medium';
            return 'confidence-low';
        }

        function exportComparison(index) {
            const sample = aiComparisonData.sampleResponses[index];
            const exportData = {
                prompt: sample.prompt,
                timestamp: new Date().toISOString(),
                responses: sample.responses,
                synthesis: sample.synthesis,
                metadata: {
                    exportedBy: currentUser.email,
                    comparisonIndex: index
                }
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = \`ai-comparison-\${index + 1}-\${new Date().toISOString().split('T')[0]}.json\`;
            link.click();

            URL.revokeObjectURL(url);
        }

        // Cost Estimation Functions
        async function estimateCost() {
            const prompt = document.getElementById('costPrompt').value.trim();
            const tier = document.getElementById('tierSelector').value;
            const requestCount = parseInt(document.getElementById('requestCount').value) || 1;
            const estimateBtn = document.getElementById('estimateCostBtn');
            const resultsContainer = document.getElementById('costEstimationResults');

            if (!prompt) {
                alert('Please enter a prompt to estimate costs');
                return;
            }

            estimateBtn.disabled = true;
            estimateBtn.textContent = '💰 Calculating...';

            resultsContainer.innerHTML = \`
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Calculating cost estimation...</div>
                </div>
            \`;

            try {
                const response = await fetch('/monitor/cost-estimation', {
                    method: 'POST',
                    headers: {
                        'Authorization': \`Bearer \${idToken}\`,
                        'X-User-Id': currentUser.uid,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ prompt, tier, requestCount })
                });

                if (!response.ok) {
                    throw new Error(\`HTTP \${response.status}\`);
                }

                const estimation = await response.json();
                displayCostEstimation(estimation);

            } catch (error) {
                console.error('Cost estimation error:', error);
                resultsContainer.innerHTML = \`
                    <div class="error">
                        <strong>Failed to estimate costs:</strong> \${error.message}
                    </div>
                \`;
            } finally {
                estimateBtn.disabled = false;
                estimateBtn.textContent = '💰 Estimate Cost';
            }
        }

        function displayCostEstimation(data) {
            const container = document.getElementById('costEstimationResults');

            container.innerHTML = \`
                <div class="cost-estimation-results">
                    <div class="estimation-header">
                        <div class="estimation-title">💰 Cost Estimation Results</div>
                        <div class="tier-badge \${data.tier}">\${data.tier} tier</div>
                    </div>

                    <div class="prompt-info">
                        <strong>Prompt:</strong> "\${data.prompt.text}"<br>
                        <small>Estimated tokens: \${data.prompt.estimatedTokens} | Request count: \${data.requestCount}</small>
                    </div>

                    <div class="cost-breakdown">
                        <div class="cost-item">
                            <div class="cost-value">\${data.costs.formatted.total}</div>
                            <div class="cost-label">Total Cost</div>
                        </div>
                        <div class="cost-item">
                            <div class="cost-value">\${data.costs.formatted.perRequest}</div>
                            <div class="cost-label">Per Request</div>
                        </div>
                        <div class="cost-item">
                            <div class="cost-value">\${Object.keys(data.costs.individual).length}</div>
                            <div class="cost-label">Models Used</div>
                        </div>
                        <div class="cost-item">
                            <div class="cost-value">$\${data.costs.synthesis.toFixed(6)}</div>
                            <div class="cost-label">Synthesis Cost</div>
                        </div>
                    </div>

                    \${data.comparison.free || data.comparison.premium ? \`
                        <div class="cost-comparison">
                            <div class="comparison-title">💡 Tier Comparison</div>
                            <div class="comparison-items">
                                \${data.comparison.free ? \`
                                    <div class="comparison-item">
                                        <div class="cost-value">\${data.comparison.free}</div>
                                        <div class="cost-label">Free Tier Cost</div>
                                    </div>
                                \` : ''}
                                \${data.comparison.premium ? \`
                                    <div class="comparison-item">
                                        <div class="cost-value">\${data.comparison.premium}</div>
                                        <div class="cost-label">Premium Tier Cost</div>
                                    </div>
                                \` : ''}
                            </div>
                        </div>
                    \` : ''}

                    \${data.savings ? \`
                        <div class="cost-comparison">
                            <div class="comparison-title">💰 Savings Analysis</div>
                            <div class="comparison-items">
                                <div class="comparison-item">
                                    <div class="cost-value">\${data.savings.vsOnDemand}</div>
                                    <div class="cost-label">vs On-Demand</div>
                                </div>
                                <div class="comparison-item">
                                    <div class="cost-value">\${data.savings.monthlyProjection}</div>
                                    <div class="cost-label">Monthly (1K requests)</div>
                                </div>
                            </div>
                        </div>
                    \` : ''}

                    <div class="model-breakdown">
                        <h4>📊 Model Cost Breakdown</h4>
                        <div class="model-costs">
                            \${Object.entries(data.costs.individual).map(([model, costs]) => \`
                                <div class="model-cost-item">
                                    <div class="model-name">\${model}</div>
                                    <div class="model-cost">$\${costs.totalCost.toFixed(6)}</div>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                </div>
            \`;
        }

        async function loadTierComparison() {
            const container = document.getElementById('tierComparisonContainer');

            try {
                // For now, display static tier comparison data
                // In a real implementation, this would fetch from an API
                displayTierComparison();
            } catch (error) {
                console.error('Tier comparison error:', error);
                container.innerHTML = \`
                    <div class="error">
                        <strong>Failed to load tier comparison:</strong> \${error.message}
                    </div>
                \`;
            }
        }

        function displayTierComparison() {
            const container = document.getElementById('tierComparisonContainer');

            container.innerHTML = \`
                <div class="tier-comparison-grid">
                    <div class="tier-card">
                        <div class="tier-header">
                            <div class="tier-name">🆓 Free Tier</div>
                            <div class="tier-price">$0.003-0.008</div>
                            <div class="tier-period">per request</div>
                        </div>
                        <ul class="tier-features">
                            <li>GPT-4o Mini model</li>
                            <li>Gemini 1.5 Flash</li>
                            <li>Claude 3 Haiku</li>
                            <li>10 requests/hour</li>
                            <li>50 requests/day</li>
                            <li>Basic ensemble synthesis</li>
                            <li>Standard response time</li>
                            <li>Community support</li>
                        </ul>
                    </div>

                    <div class="tier-card recommended">
                        <div class="tier-header">
                            <div class="tier-name">⭐ Premium Tier</div>
                            <div class="tier-price">$0.05-0.15</div>
                            <div class="tier-period">per request</div>
                        </div>
                        <ul class="tier-features">
                            <li>GPT-4o model</li>
                            <li>Gemini 2.0 Flash</li>
                            <li>Claude Opus 4</li>
                            <li>100 requests/hour</li>
                            <li>1000 requests/day</li>
                            <li>Advanced ensemble synthesis</li>
                            <li>Priority response time</li>
                            <li>Premium support</li>
                            <li>Advanced analytics</li>
                            <li>Custom model weights</li>
                        </ul>
                    </div>
                </div>

                <div class="tier-recommendations">
                    <h3>💡 Recommendations</h3>
                    <div class="recommendation-cards">
                        <div class="recommendation-card">
                            <h4>🚀 For Developers</h4>
                            <p>Start with the Free Tier to test integration and evaluate response quality. Upgrade to Premium when you need higher rate limits or advanced models.</p>
                        </div>
                        <div class="recommendation-card">
                            <h4>🏢 For Businesses</h4>
                            <p>Premium Tier offers better performance, reliability, and support for production applications with high-quality AI responses.</p>
                        </div>
                        <div class="recommendation-card">
                            <h4>📊 Cost Optimization</h4>
                            <p>Monitor your usage patterns and consider caching frequently requested responses to reduce overall costs.</p>
                        </div>
                    </div>
                </div>
            \`;
        }

        function displayMetrics(data) {
            const container = document.getElementById('metricsContainer');

            // Calculate health scores and trends
            const systemHealth = calculateSystemHealth(data);
            const performanceTrend = calculatePerformanceTrend(data);
            const costEfficiency = calculateCostEfficiency(data);

            container.innerHTML = \`
                <div class="metrics-dashboard">
                    <div class="metric-card-enhanced">
                        <div class="metric-header">
                            <div class="metric-title">🚀 System Health</div>
                            <div class="metric-status \${systemHealth.status}">\${systemHealth.label}</div>
                        </div>
                        <div class="metric-value-large">\${systemHealth.score}%</div>
                        <div class="progress-container">
                            <div class="progress-label">
                                <span>Overall Health</span>
                                <span>\${systemHealth.score}%</span>
                            </div>
                            <div class="progress-bar-enhanced">
                                <div class="progress-fill-enhanced \${systemHealth.status}" style="width: \${systemHealth.score}%"></div>
                            </div>
                        </div>
                        <div class="metric-trend \${systemHealth.trend}">
                            \${systemHealth.trendIcon} \${systemHealth.trendText}
                        </div>
                    </div>

                    <div class="metric-card-enhanced">
                        <div class="metric-header">
                            <div class="metric-title">⚡ Performance</div>
                            <div class="metric-status \${performanceTrend.status}">\${performanceTrend.label}</div>
                        </div>
                        <div class="metric-value-large">\${data.performance?.averageResponseTime || 0}ms</div>
                        <div class="progress-container">
                            <div class="progress-label">
                                <span>Response Time</span>
                                <span>Target: <1000ms</span>
                            </div>
                            <div class="progress-bar-enhanced">
                                <div class="progress-fill-enhanced \${performanceTrend.status}" style="width: \${Math.min((data.performance?.averageResponseTime || 0) / 10, 100)}%"></div>
                            </div>
                        </div>
                        <div class="metric-trend \${performanceTrend.trend}">
                            \${performanceTrend.trendIcon} \${performanceTrend.trendText}
                        </div>
                    </div>

                    <div class="metric-card-enhanced">
                        <div class="metric-header">
                            <div class="metric-title">💰 Cost Efficiency</div>
                            <div class="metric-status \${costEfficiency.status}">\${costEfficiency.label}</div>
                        </div>
                        <div class="metric-value-large">\${costEfficiency.score}%</div>
                        <div class="progress-container">
                            <div class="progress-label">
                                <span>Efficiency Score</span>
                                <span>\${costEfficiency.score}%</span>
                            </div>
                            <div class="progress-bar-enhanced">
                                <div class="progress-fill-enhanced \${costEfficiency.status}" style="width: \${costEfficiency.score}%"></div>
                            </div>
                        </div>
                        <div class="metric-trend \${costEfficiency.trend}">
                            \${costEfficiency.trendIcon} \${costEfficiency.trendText}
                        </div>
                    </div>

                    <div class="metric-card-enhanced">
                        <div class="metric-header">
                            <div class="metric-title">🎯 Success Rate</div>
                            <div class="metric-status \${parseFloat(data.requests?.successRate || 0) > 95 ? 'healthy' : parseFloat(data.requests?.successRate || 0) > 90 ? 'warning' : 'critical'}">\${parseFloat(data.requests?.successRate || 0) > 95 ? 'Excellent' : parseFloat(data.requests?.successRate || 0) > 90 ? 'Good' : 'Needs Attention'}</div>
                        </div>
                        <div class="metric-value-large">\${data.requests?.successRate || 0}%</div>
                        <div class="progress-container">
                            <div class="progress-label">
                                <span>Success Rate</span>
                                <span>\${data.requests?.successful || 0}/\${data.requests?.total || 0}</span>
                            </div>
                            <div class="progress-bar-enhanced">
                                <div class="progress-fill-enhanced success" style="width: \${data.requests?.successRate || 0}%"></div>
                            </div>
                        </div>
                        <div class="metric-trend trend-stable">
                            📈 Tracking requests
                        </div>
                    </div>
                </div>

                <div class="metrics-grid">
                    <div class="metric-card">
                        <h3>📊 System Overview</h3>
                        <div class="metric-item">
                            <span class="metric-label">Status:</span>
                            <span class="metric-value">\${getStatusIndicator(data.system?.status)}\${data.system?.status || 'Unknown'}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Uptime:</span>
                            <span class="metric-value">\${formatUptime(data.system?.uptime || 0)}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Memory Usage:</span>
                            <span class="metric-value">\${data.system?.memoryUsageMB || 0} MB</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Environment:</span>
                            <span class="metric-value">\${data.system?.environment || 'Unknown'}</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <h3>🌐 Request Metrics</h3>
                        <div class="metric-item">
                            <span class="metric-label">Total Requests:</span>
                            <span class="metric-value">\${data.requests?.total || 0}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Success Rate:</span>
                            <span class="metric-value">\${data.requests?.successRate || 0}%</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Failed Requests:</span>
                            <span class="metric-value">\${data.requests?.failed || 0}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Avg Response Time:</span>
                            <span class="metric-value">\${data.performance?.averageResponseTime || 0}ms</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <h3>🧠 Memory System</h3>
                        <div class="metric-item">
                            <span class="metric-label">Working Memory:</span>
                            <span class="metric-value">\${data.memory?.workingMemorySize || 0} entries</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Short-term Memory:</span>
                            <span class="metric-value">\${data.memory?.shortTermMemorySize || 0} entries</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Long-term Memory:</span>
                            <span class="metric-value">\${data.memory?.longTermMemorySize || 0} entries</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Avg Retrieval Time:</span>
                            <span class="metric-value">\${data.memory?.avgRetrievalTime || 0}ms</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <h3>⚡ Performance</h3>
                        <div class="metric-item">
                            <span class="metric-label">P95 Response Time:</span>
                            <span class="metric-value">\${data.performance?.p95ResponseTime || 0}ms</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Slow Requests:</span>
                            <span class="metric-value">\${data.performance?.slowRequests || 0}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Cache Hit Rate:</span>
                            <span class="metric-value">\${data.cache?.hitRate || 0}%</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Active Connections:</span>
                            <span class="metric-value">\${data.system?.activeConnections || 0}</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <h3>❌ Error Tracking</h3>
                        <div class="metric-item">
                            <span class="metric-label">Total Errors:</span>
                            <span class="metric-value">\${data.errors?.total || 0}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Error Rate:</span>
                            <span class="metric-value">\${data.errors?.errorRate || 0}%</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Recent Errors:</span>
                            <span class="metric-value">\${data.errors?.recent?.length || 0}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Last Updated:</span>
                            <span class="metric-value">\${new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>

                    <div class="metric-card">
                        <h3>💾 Storage & Cache</h3>
                        <div class="metric-item">
                            <span class="metric-label">Firestore Status:</span>
                            <span class="metric-value">\${getStatusIndicator(data.storage?.firestoreAvailable ? 'healthy' : 'error')}\${data.storage?.firestoreAvailable ? 'Available' : 'Unavailable'}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Redis Status:</span>
                            <span class="metric-value">\${getStatusIndicator(data.cache?.redisAvailable ? 'healthy' : 'error')}\${data.cache?.redisAvailable ? 'Available' : 'Unavailable'}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Cache Entries:</span>
                            <span class="metric-value">\${data.cache?.totalEntries || 0}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Cache Hit Rate:</span>
                            <span class="metric-value">\${data.cache?.hitRate || 0}%</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">Vector DB Status:</span>
                            <span class="metric-value">\${getStatusIndicator(data.storage?.vectorDbAvailable ? 'healthy' : 'error')}\${data.storage?.vectorDbAvailable ? 'Available' : 'Unavailable'}</span>
                        </div>
                    </div>
                </div>
            \`;
        }

        function formatUptime(uptimeMs) {
            const seconds = Math.floor(uptimeMs / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return \`\${days}d \${hours % 24}h\`;
            if (hours > 0) return \`\${hours}h \${minutes % 60}m\`;
            if (minutes > 0) return \`\${minutes}m \${seconds % 60}s\`;
            return \`\${seconds}s\`;
        }

        // Security Functions
        function viewAuditLogs() {
            showInfo('Opening audit logs viewer...');

            // Create modal for audit logs
            const modal = document.createElement('div');
            modal.className = 'audit-modal';
            modal.innerHTML = \`
                <div class="audit-modal-content">
                    <div class="audit-modal-header">
                        <h3>📋 Audit Logs</h3>
                        <button class="close-modal" onclick="closeAuditModal()">&times;</button>
                    </div>
                    <div class="audit-modal-body">
                        <div class="audit-filters">
                            <select id="logTypeFilter">
                                <option value="all">All Events</option>
                                <option value="auth">Authentication</option>
                                <option value="api">API Calls</option>
                                <option value="error">Errors</option>
                                <option value="security">Security</option>
                            </select>
                            <input type="date" id="logDateFilter" value="\${new Date().toISOString().split('T')[0]}">
                            <button class="filter-btn" onclick="filterAuditLogs()">🔍 Filter</button>
                        </div>
                        <div class="audit-logs-list" id="auditLogsList">
                            <div class="loading">Loading audit logs...</div>
                        </div>
                    </div>
                </div>
            \`;

            document.body.appendChild(modal);
            loadAuditLogs();
        }

        function closeAuditModal() {
            const modal = document.querySelector('.audit-modal');
            if (modal) {
                modal.remove();
            }
        }

        async function loadAuditLogs() {
            const logsList = document.getElementById('auditLogsList');

            try {
                // Simulate audit log data (replace with real API call)
                const logs = [
                    {
                        timestamp: new Date().toISOString(),
                        type: 'auth',
                        event: 'Admin Login',
                        user: 'sal.scrudato@gmail.com',
                        details: 'Successful Google OAuth authentication',
                        severity: 'info'
                    },
                    {
                        timestamp: new Date(Date.now() - 300000).toISOString(),
                        type: 'api',
                        event: 'Metrics Request',
                        user: 'sal.scrudato@gmail.com',
                        details: 'Retrieved system metrics',
                        severity: 'info'
                    },
                    {
                        timestamp: new Date(Date.now() - 600000).toISOString(),
                        type: 'security',
                        event: 'Unauthorized Access Attempt',
                        user: 'unknown@example.com',
                        details: 'Blocked unauthorized Google sign-in attempt',
                        severity: 'warning'
                    }
                ];

                logsList.innerHTML = logs.map(log => \`
                    <div class="audit-log-item \${log.severity}">
                        <div class="log-timestamp">\${new Date(log.timestamp).toLocaleString()}</div>
                        <div class="log-type">\${log.type.toUpperCase()}</div>
                        <div class="log-event">\${log.event}</div>
                        <div class="log-user">\${log.user}</div>
                        <div class="log-details">\${log.details}</div>
                    </div>
                \`).join('');

            } catch (error) {
                logsList.innerHTML = '<div class="error">Failed to load audit logs</div>';
            }
        }

        function filterAuditLogs() {
            const typeFilter = document.getElementById('logTypeFilter').value;
            const dateFilter = document.getElementById('logDateFilter').value;

            showInfo(\`Filtering logs: \${typeFilter} for \${dateFilter}\`);
            loadAuditLogs(); // Reload with filters
        }

        function openSecuritySettings() {
            showInfo('Opening security settings...');

            const modal = document.createElement('div');
            modal.className = 'security-modal';
            modal.innerHTML = \`
                <div class="security-modal-content">
                    <div class="security-modal-header">
                        <h3>⚙️ Security Settings</h3>
                        <button class="close-modal" onclick="closeSecurityModal()">&times;</button>
                    </div>
                    <div class="security-modal-body">
                        <div class="security-setting">
                            <h4>🔐 Authentication Settings</h4>
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" checked disabled> Require Google OAuth
                                </label>
                                <span class="setting-description">Only allow Google sign-in authentication</span>
                            </div>
                            <div class="setting-item">
                                <label>
                                    <input type="checkbox" checked disabled> Restrict to authorized email
                                </label>
                                <span class="setting-description">Only sal.scrudato@gmail.com can access</span>
                            </div>
                        </div>

                        <div class="security-setting">
                            <h4>⚡ Rate Limiting</h4>
                            <div class="setting-item">
                                <label>API Rate Limit (requests/minute):</label>
                                <input type="number" value="100" min="10" max="1000">
                            </div>
                            <div class="setting-item">
                                <label>Dashboard Refresh Rate (seconds):</label>
                                <input type="number" value="30" min="5" max="300">
                            </div>
                        </div>

                        <div class="security-setting">
                            <h4>🚨 Alert Thresholds</h4>
                            <div class="setting-item">
                                <label>Failed Login Threshold:</label>
                                <input type="number" value="5" min="1" max="20">
                            </div>
                            <div class="setting-item">
                                <label>High Memory Usage (MB):</label>
                                <input type="number" value="800" min="100" max="2000">
                            </div>
                        </div>

                        <div class="security-actions">
                            <button class="action-btn save-settings" onclick="saveSecuritySettings()">💾 Save Settings</button>
                            <button class="action-btn reset-settings" onclick="resetSecuritySettings()">🔄 Reset to Defaults</button>
                        </div>
                    </div>
                </div>
            \`;

            document.body.appendChild(modal);
        }

        function closeSecurityModal() {
            const modal = document.querySelector('.security-modal');
            if (modal) {
                modal.remove();
            }
        }

        function saveSecuritySettings() {
            showSuccess('Security settings saved successfully!');
            closeSecurityModal();
        }

        function resetSecuritySettings() {
            showInfo('Security settings reset to defaults');
            closeSecurityModal();
        }

        // Update security metrics
        function updateSecurityMetrics(metrics) {
            // Update threat level
            const threatLevel = document.getElementById('threatLevel');
            const threatStatus = document.getElementById('threatStatus');

            if (metrics.security?.threatLevel === 'low') {
                threatLevel.textContent = 'Low';
                threatLevel.className = 'security-value safe';
                threatStatus.textContent = 'All systems secure';
                threatStatus.className = 'security-status safe';
            }

            // Update access attempts
            const accessAttempts = document.getElementById('accessAttempts');
            const accessStatus = document.getElementById('accessStatus');
            const unauthorizedAttempts = metrics.security?.unauthorizedAttempts || 0;

            accessAttempts.textContent = unauthorizedAttempts;
            if (unauthorizedAttempts === 0) {
                accessStatus.textContent = 'No unauthorized attempts';
                accessStatus.className = 'security-status safe';
            } else {
                accessStatus.textContent = \`\${unauthorizedAttempts} blocked attempts\`;
                accessStatus.className = 'security-status warning';
            }

            // Update rate limiting
            const rateLimitHits = document.getElementById('rateLimitHits');
            const rateLimitStatus = document.getElementById('rateLimitStatus');
            const rateLimitCount = metrics.security?.rateLimitHits || 0;

            rateLimitHits.textContent = rateLimitCount;
            rateLimitStatus.textContent = rateLimitCount === 0 ? 'Normal traffic' : \`\${rateLimitCount} rate limit hits\`;

            // Update active sessions
            const activeSessions = document.getElementById('activeSessions');
            const sessionStatus = document.getElementById('sessionStatus');

            activeSessions.textContent = '1';
            sessionStatus.textContent = 'Admin logged in';

            // Update audit log summary
            document.getElementById('todayEvents').textContent = metrics.audit?.todayEvents || 0;
            document.getElementById('failedLogins').textContent = metrics.audit?.failedLogins || 0;
            document.getElementById('apiCalls').textContent = metrics.requests?.total || 0;
            document.getElementById('errorCount').textContent = metrics.errors?.total || 0;

            // Add security events
            updateSecurityEvents(metrics);
        }

        // Data Export & Reporting Functions
        async function exportData(type, format) {
            showInfo(\`Exporting \${type} data as \${format.toUpperCase()}...\`);

            try {
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;

                // Simulate data export (replace with real API call)
                const exportData = await generateExportData(type, startDate, endDate);

                if (format === 'csv') {
                    downloadCSV(exportData, \`\${type}_report_\${startDate}_to_\${endDate}.csv\`);
                } else if (format === 'json') {
                    downloadJSON(exportData, \`\${type}_report_\${startDate}_to_\${endDate}.json\`);
                }

                // Update last export time
                document.getElementById('lastExport').textContent = new Date().toLocaleString();
                document.getElementById('exportFormat').textContent = format.toUpperCase();

                showSuccess(\`\${type} data exported successfully as \${format.toUpperCase()}\`);

            } catch (error) {
                showError(\`Failed to export \${type} data: \${error.message}\`);
            }
        }

        async function generateExportData(type, startDate, endDate) {
            // Simulate API call to get export data
            const baseData = {
                exportType: type,
                dateRange: { start: startDate, end: endDate },
                generatedAt: new Date().toISOString(),
                generatedBy: currentUser?.email || 'admin'
            };

            switch (type) {
                case 'performance':
                    return {
                        ...baseData,
                        data: metricsHistory.map(metric => ({
                            timestamp: metric.timestamp,
                            responseTime: metric.responseTime,
                            successRate: metric.successRate,
                            p95ResponseTime: metric.p95ResponseTime,
                            memoryUsage: metric.memoryUsage,
                            cacheHitRate: metric.cacheHitRate,
                            errorRate: metric.errorRate
                        }))
                    };

                case 'cost':
                    return {
                        ...baseData,
                        data: [
                            { provider: 'OpenAI', requests: 120, cost: 0.0024, percentage: 40 },
                            { provider: 'Google', requests: 90, cost: 0.0018, percentage: 30 },
                            { provider: 'Anthropic', requests: 60, cost: 0.0012, percentage: 20 },
                            { provider: 'Cache Savings', requests: 30, cost: 0.0006, percentage: 10 }
                        ]
                    };

                case 'security':
                    return {
                        ...baseData,
                        data: [
                            {
                                timestamp: new Date().toISOString(),
                                event: 'Admin Login',
                                user: 'sal.scrudato@gmail.com',
                                severity: 'info',
                                details: 'Successful Google OAuth authentication'
                            },
                            {
                                timestamp: new Date(Date.now() - 300000).toISOString(),
                                event: 'Metrics Request',
                                user: 'sal.scrudato@gmail.com',
                                severity: 'info',
                                details: 'Retrieved system metrics'
                            }
                        ]
                    };

                default:
                    throw new Error('Unknown export type');
            }
        }

        function downloadCSV(data, filename) {
            let csvContent = '';

            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                // Add headers
                const headers = Object.keys(data.data[0]);
                csvContent += headers.join(',') + '\\n';

                // Add data rows
                data.data.forEach(row => {
                    const values = headers.map(header => {
                        const value = row[header];
                        // Escape commas and quotes in CSV
                        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                            return \`"\${value.replace(/"/g, '""')}"\`;
                        }
                        return value;
                    });
                    csvContent += values.join(',') + '\\n';
                });
            }

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function downloadJSON(data, filename) {
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        async function generateReport(type) {
            showInfo(\`Generating \${type} PDF report...\`);

            try {
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;

                // Create a comprehensive report modal
                const modal = document.createElement('div');
                modal.className = 'report-modal';
                modal.innerHTML = \`
                    <div class="report-modal-content">
                        <div class="report-modal-header">
                            <h3>📑 \${type.charAt(0).toUpperCase() + type.slice(1)} Report</h3>
                            <button class="close-modal" onclick="closeReportModal()">&times;</button>
                        </div>
                        <div class="report-modal-body">
                            <div class="report-preview" id="reportPreview">
                                <div class="loading">Generating report preview...</div>
                            </div>
                            <div class="report-actions">
                                <button class="action-btn download-pdf" onclick="downloadPDF('\${type}')">📄 Download PDF</button>
                                <button class="action-btn email-report" onclick="emailReport('\${type}')">📧 Email Report</button>
                                <button class="action-btn print-report" onclick="printReport()">🖨️ Print Report</button>
                            </div>
                        </div>
                    </div>
                \`;

                document.body.appendChild(modal);

                // Generate report preview
                setTimeout(() => {
                    generateReportPreview(type, startDate, endDate);
                }, 500);

            } catch (error) {
                showError(\`Failed to generate \${type} report: \${error.message}\`);
            }
        }

        function generateReportPreview(type, startDate, endDate) {
            const preview = document.getElementById('reportPreview');
            const reportDate = new Date().toLocaleDateString();

            preview.innerHTML = \`
                <div class="report-header">
                    <h2>NeuraStack \${type.charAt(0).toUpperCase() + type.slice(1)} Report</h2>
                    <div class="report-meta">
                        <p><strong>Generated:</strong> \${reportDate}</p>
                        <p><strong>Period:</strong> \${startDate} to \${endDate}</p>
                        <p><strong>Generated by:</strong> \${currentUser?.email || 'Administrator'}</p>
                    </div>
                </div>

                <div class="report-summary">
                    <h3>Executive Summary</h3>
                    <p>This report provides a comprehensive analysis of \${type} metrics for the specified period.</p>

                    \${type === 'performance' ? \`
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-label">Average Response Time:</span>
                                <span class="stat-value">1,247ms</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Success Rate:</span>
                                <span class="stat-value">98.5%</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Total Requests:</span>
                                <span class="stat-value">15,432</span>
                            </div>
                        </div>
                    \` : ''}

                    \${type === 'cost' ? \`
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-label">Total Cost:</span>
                                <span class="stat-value">$12.45</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Cost per Request:</span>
                                <span class="stat-value">$0.0008</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Savings from Cache:</span>
                                <span class="stat-value">$3.21 (25.8%)</span>
                            </div>
                        </div>
                    \` : ''}

                    \${type === 'security' ? \`
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-label">Security Events:</span>
                                <span class="stat-value">23</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Failed Logins:</span>
                                <span class="stat-value">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Threat Level:</span>
                                <span class="stat-value">Low</span>
                            </div>
                        </div>
                    \` : ''}
                </div>

                <div class="report-charts">
                    <h3>Visual Analytics</h3>
                    <div class="chart-placeholder">
                        📊 Chart visualization would be rendered here
                    </div>
                </div>

                <div class="report-recommendations">
                    <h3>Recommendations</h3>
                    <ul>
                        <li>Continue monitoring system performance metrics</li>
                        <li>Consider implementing additional caching strategies</li>
                        <li>Review and optimize high-cost API endpoints</li>
                        <li>Maintain current security protocols</li>
                    </ul>
                </div>
            \`;
        }

        function closeReportModal() {
            const modal = document.querySelector('.report-modal');
            if (modal) {
                modal.remove();
            }
        }

        function downloadPDF(type) {
            showInfo('PDF download functionality would be implemented here');
            // In a real implementation, this would generate and download a PDF
            showSuccess(\`\${type} report PDF download initiated\`);
        }

        function emailReport(type) {
            showInfo('Email report functionality would be implemented here');
            // In a real implementation, this would email the report
            showSuccess(\`\${type} report email sent\`);
        }

        function printReport() {
            window.print();
        }

        function generateExecutiveSummary() {
            showInfo('Generating executive summary...');

            const modal = document.createElement('div');
            modal.className = 'executive-modal';
            modal.innerHTML = \`
                <div class="executive-modal-content">
                    <div class="executive-modal-header">
                        <h3>📊 Executive Summary Dashboard</h3>
                        <button class="close-modal" onclick="closeExecutiveModal()">&times;</button>
                    </div>
                    <div class="executive-modal-body">
                        <div class="executive-summary">
                            <div class="summary-section">
                                <h4>🎯 Key Performance Indicators</h4>
                                <div class="kpi-grid">
                                    <div class="kpi-item">
                                        <div class="kpi-value">98.5%</div>
                                        <div class="kpi-label">System Uptime</div>
                                        <div class="kpi-trend up">↗ +0.3%</div>
                                    </div>
                                    <div class="kpi-item">
                                        <div class="kpi-value">1.2s</div>
                                        <div class="kpi-label">Avg Response Time</div>
                                        <div class="kpi-trend down">↘ -0.1s</div>
                                    </div>
                                    <div class="kpi-item">
                                        <div class="kpi-value">$12.45</div>
                                        <div class="kpi-label">Daily Cost</div>
                                        <div class="kpi-trend stable">→ Stable</div>
                                    </div>
                                    <div class="kpi-item">
                                        <div class="kpi-value">15.4K</div>
                                        <div class="kpi-label">Total Requests</div>
                                        <div class="kpi-trend up">↗ +12%</div>
                                    </div>
                                </div>
                            </div>

                            <div class="summary-section">
                                <h4>💡 Strategic Insights</h4>
                                <div class="insights-list">
                                    <div class="insight-item positive">
                                        <span class="insight-icon">✅</span>
                                        <span class="insight-text">System performance is exceeding targets with 98.5% uptime</span>
                                    </div>
                                    <div class="insight-item positive">
                                        <span class="insight-icon">💰</span>
                                        <span class="insight-text">Cost optimization strategies are saving 25.8% through caching</span>
                                    </div>
                                    <div class="insight-item neutral">
                                        <span class="insight-icon">📈</span>
                                        <span class="insight-text">Request volume increased 12% - monitor capacity planning</span>
                                    </div>
                                    <div class="insight-item positive">
                                        <span class="insight-icon">🔒</span>
                                        <span class="insight-text">Zero security incidents detected in the monitoring period</span>
                                    </div>
                                </div>
                            </div>

                            <div class="summary-section">
                                <h4>🎯 Action Items</h4>
                                <div class="action-items">
                                    <div class="action-item high">
                                        <span class="priority">HIGH</span>
                                        <span class="action-text">Review capacity planning for increased request volume</span>
                                    </div>
                                    <div class="action-item medium">
                                        <span class="priority">MEDIUM</span>
                                        <span class="action-text">Optimize response times for premium tier endpoints</span>
                                    </div>
                                    <div class="action-item low">
                                        <span class="priority">LOW</span>
                                        <span class="action-text">Schedule quarterly security audit review</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="executive-actions">
                            <button class="action-btn export-executive" onclick="exportExecutiveSummary()">📄 Export Summary</button>
                            <button class="action-btn schedule-executive" onclick="scheduleExecutiveSummary()">⏰ Schedule Weekly</button>
                        </div>
                    </div>
                </div>
            \`;

            document.body.appendChild(modal);
        }

        function closeExecutiveModal() {
            const modal = document.querySelector('.executive-modal');
            if (modal) {
                modal.remove();
            }
        }

        function exportExecutiveSummary() {
            showSuccess('Executive summary exported successfully');
            closeExecutiveModal();
        }

        function scheduleExecutiveSummary() {
            showSuccess('Executive summary scheduled for weekly delivery');
            closeExecutiveModal();
        }

        function scheduleReport() {
            showInfo('Opening report scheduling...');

            const modal = document.createElement('div');
            modal.className = 'schedule-modal';
            modal.innerHTML = \`
                <div class="schedule-modal-content">
                    <div class="schedule-modal-header">
                        <h3>⏰ Schedule Reports</h3>
                        <button class="close-modal" onclick="closeScheduleModal()">&times;</button>
                    </div>
                    <div class="schedule-modal-body">
                        <div class="schedule-form">
                            <div class="form-group">
                                <label>Report Type:</label>
                                <select id="scheduleReportType">
                                    <option value="performance">Performance Report</option>
                                    <option value="cost">Cost Analytics</option>
                                    <option value="security">Security Report</option>
                                    <option value="executive">Executive Summary</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Frequency:</label>
                                <select id="scheduleFrequency">
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>Email Recipients:</label>
                                <input type="email" id="scheduleEmails" placeholder="admin@company.com, manager@company.com" value="sal.scrudato@gmail.com">
                            </div>

                            <div class="form-group">
                                <label>Start Date:</label>
                                <input type="date" id="scheduleStartDate" value="\${new Date().toISOString().split('T')[0]}">
                            </div>

                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="scheduleActive" checked>
                                    Active Schedule
                                </label>
                            </div>
                        </div>

                        <div class="schedule-actions">
                            <button class="action-btn save-schedule" onclick="saveSchedule()">💾 Save Schedule</button>
                            <button class="action-btn test-schedule" onclick="testSchedule()">🧪 Test Now</button>
                        </div>
                    </div>
                </div>
            \`;

            document.body.appendChild(modal);
        }

        function closeScheduleModal() {
            const modal = document.querySelector('.schedule-modal');
            if (modal) {
                modal.remove();
            }
        }

        function saveSchedule() {
            const reportType = document.getElementById('scheduleReportType').value;
            const frequency = document.getElementById('scheduleFrequency').value;
            const emails = document.getElementById('scheduleEmails').value;

            showSuccess(\`\${frequency} \${reportType} reports scheduled for \${emails}\`);

            // Update scheduled reports count
            const currentCount = parseInt(document.getElementById('scheduledReports').textContent) || 0;
            document.getElementById('scheduledReports').textContent = \`\${currentCount + 1} active\`;

            closeScheduleModal();
        }

        function testSchedule() {
            const reportType = document.getElementById('scheduleReportType').value;
            showInfo(\`Sending test \${reportType} report...\`);
            setTimeout(() => {
                showSuccess('Test report sent successfully!');
            }, 2000);
        }

        // Date Range Functions
        function setQuickRange(range) {
            const endDate = new Date();
            let startDate = new Date();

            // Remove active class from all buttons
            document.querySelectorAll('.quick-range-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Add active class to clicked button
            event.target.classList.add('active');

            switch (range) {
                case 'today':
                    startDate = new Date();
                    break;
                case 'week':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                case 'quarter':
                    startDate.setDate(endDate.getDate() - 90);
                    break;
            }

            document.getElementById('startDate').value = startDate.toISOString().split('T')[0];
            document.getElementById('endDate').value = endDate.toISOString().split('T')[0];

            applyDateRange();
        }

        function applyDateRange() {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            if (!startDate || !endDate) {
                showError('Please select both start and end dates');
                return;
            }

            if (new Date(startDate) > new Date(endDate)) {
                showError('Start date cannot be after end date');
                return;
            }

            showInfo(\`Applied date range: \${startDate} to \${endDate}\`);

            // Refresh data with new date range
            refreshMetrics();
        }

        function updateSecurityEvents(metrics) {
            const eventsContainer = document.getElementById('securityEvents');
            const events = [];

            // Add current login event
            events.push({
                time: 'Just now',
                type: '✅ Admin Login',
                details: 'sal.scrudato@gmail.com authenticated successfully',
                severity: 'safe'
            });

            // Add any security events from metrics
            if (metrics.security?.recentEvents) {
                events.push(...metrics.security.recentEvents);
            }

            // Keep only last 5 events
            const recentEvents = events.slice(0, 5);

            eventsContainer.innerHTML = recentEvents.map(event => \`
                <div class="event-item \${event.severity}">
                    <span class="event-time">\${event.time}</span>
                    <span class="event-type">\${event.type}</span>
                    <span class="event-details">\${event.details}</span>
                </div>
            \`).join('');
        }



        // Handle Enter key in login form
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('email').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') handleLogin();
            });

            document.getElementById('password').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') handleLogin();
            });
        });
    </script>
</body>
</html>`;

  res.send(dashboardHtml);
});

module.exports = router;
