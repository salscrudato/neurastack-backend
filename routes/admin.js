/**
 * 🎛️ Admin Routes - Model Management Interface
 * 
 * 🎯 PURPOSE: Provide simple web interface for managing AI models
 * 
 * 📋 FEATURES:
 * - View all configured AI models
 * - Enable/disable models in real-time
 * - Monitor model performance and costs
 * - Add new models without code changes
 * - Simple HTML interface (no complex frontend needed)
 */

const express = require('express');
const router = express.Router();
const { getModelConfigService } = require('../services/modelConfigService');
const monitoringService = require('../services/monitoringService');

/**
 * 🏠 Admin Dashboard - Main model management interface
 * GET /admin/dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const modelService = getModelConfigService();
    
    // 📋 Get models for both tiers
    const [freeModels, premiumModels] = await Promise.all([
      modelService.getActiveModels('free'),
      modelService.getActiveModels('premium')
    ]);

    // 📊 Get performance stats for each model
    const freeStats = freeModels.map(model => ({
      ...model,
      stats: modelService.getModelStats(model.id)
    }));

    const premiumStats = premiumModels.map(model => ({
      ...model,
      stats: modelService.getModelStats(model.id)
    }));

    // 🎨 Generate HTML dashboard
    const html = generateDashboardHTML(freeStats, premiumStats);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    monitoringService.log('error', 'Admin dashboard failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to load admin dashboard',
      error: error.message
    });
  }
});

/**
 * 🔄 Toggle Model Status - Enable/disable models
 * POST /admin/toggle-model
 */
router.post('/toggle-model', async (req, res) => {
  try {
    const { modelId, isActive } = req.body;
    
    if (!modelId) {
      return res.status(400).json({
        status: 'error',
        message: 'Model ID is required'
      });
    }

    const modelService = getModelConfigService();
    
    // 🔄 Update model status in database
    if (modelService.isFirestoreAvailable) {
      await modelService.db.collection('ai_models').doc(modelId).update({
        isActive: isActive,
        updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp()
      });
      
      // 🔄 Clear cache to force refresh
      modelService.clearCache();
      
      monitoringService.log('info', 'Model status updated', { modelId, isActive });
      
      res.json({
        status: 'success',
        message: `Model ${isActive ? 'enabled' : 'disabled'} successfully`,
        modelId,
        isActive
      });
    } else {
      res.status(503).json({
        status: 'error',
        message: 'Database not available - cannot update model status'
      });
    }

  } catch (error) {
    monitoringService.log('error', 'Model toggle failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to update model status',
      error: error.message
    });
  }
});

/**
 * 📊 Model Performance API - Get detailed stats
 * GET /admin/model-stats/:modelId
 */
router.get('/model-stats/:modelId', async (req, res) => {
  try {
    const { modelId } = req.params;
    const modelService = getModelConfigService();
    
    const stats = modelService.getModelStats(modelId);
    
    if (!stats) {
      return res.status(404).json({
        status: 'error',
        message: 'Model statistics not found'
      });
    }

    res.json({
      status: 'success',
      data: {
        modelId,
        ...stats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get model statistics',
      error: error.message
    });
  }
});

/**
 * 🎨 Generate HTML Dashboard
 * @param {Array} freeModels - Free tier models with stats
 * @param {Array} premiumModels - Premium tier models with stats
 * @returns {string} HTML content
 */
function generateDashboardHTML(freeModels, premiumModels) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeuraStack Admin - Model Management</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f7fa; color: #2d3748; line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px;
            text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { font-size: 1.1rem; opacity: 0.9; }
        .tier-section { 
            background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;
        }
        .tier-title { 
            font-size: 1.5rem; margin-bottom: 20px; color: #2d3748;
            display: flex; align-items: center; gap: 10px;
        }
        .tier-badge { 
            padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;
        }
        .tier-free { background: #48bb78; color: white; }
        .tier-premium { background: #ed8936; color: white; }
        .models-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
        .model-card { 
            border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;
            transition: all 0.2s; background: #fafafa;
        }
        .model-card:hover { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .model-header { display: flex; justify-content: between; align-items: center; margin-bottom: 15px; }
        .model-name { font-weight: 600; font-size: 1.1rem; color: #2d3748; }
        .model-provider { 
            padding: 2px 8px; background: #edf2f7; border-radius: 4px; 
            font-size: 0.8rem; color: #4a5568; margin-left: 10px;
        }
        .model-status { 
            padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600;
        }
        .status-active { background: #c6f6d5; color: #22543d; }
        .status-inactive { background: #fed7d7; color: #742a2a; }
        .model-stats { margin-top: 15px; }
        .stat-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .stat-label { color: #718096; font-size: 0.9rem; }
        .stat-value { font-weight: 600; color: #2d3748; }
        .toggle-btn { 
            background: #4299e1; color: white; border: none; padding: 8px 16px;
            border-radius: 6px; cursor: pointer; font-size: 0.9rem; margin-top: 10px;
            transition: background 0.2s;
        }
        .toggle-btn:hover { background: #3182ce; }
        .toggle-btn.inactive { background: #e53e3e; }
        .toggle-btn.inactive:hover { background: #c53030; }
        .refresh-btn { 
            position: fixed; bottom: 30px; right: 30px; background: #48bb78;
            color: white; border: none; padding: 15px; border-radius: 50%;
            cursor: pointer; font-size: 1.2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .refresh-btn:hover { background: #38a169; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 NeuraStack Admin</h1>
            <p>AI Model Management Dashboard</p>
        </div>

        <div class="tier-section">
            <h2 class="tier-title">
                🆓 Free Tier Models
                <span class="tier-badge tier-free">Cost Optimized</span>
            </h2>
            <div class="models-grid">
                ${freeModels.map(model => generateModelCard(model)).join('')}
            </div>
        </div>

        <div class="tier-section">
            <h2 class="tier-title">
                ⭐ Premium Tier Models
                <span class="tier-badge tier-premium">Performance Optimized</span>
            </h2>
            <div class="models-grid">
                ${premiumModels.map(model => generateModelCard(model)).join('')}
            </div>
        </div>
    </div>

    <button class="refresh-btn" onclick="location.reload()" title="Refresh Dashboard">🔄</button>

    <script>
        async function toggleModel(modelId, currentStatus) {
            try {
                const response = await fetch('/admin/toggle-model', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelId, isActive: !currentStatus })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    location.reload(); // Refresh to show updated status
                } else {
                    alert('Failed to update model: ' + result.message);
                }
            } catch (error) {
                alert('Error updating model: ' + error.message);
            }
        }
    </script>
</body>
</html>`;
}

/**
 * 🎨 Generate individual model card HTML
 * @param {Object} model - Model data with stats
 * @returns {string} HTML for model card
 */
function generateModelCard(model) {
  const stats = model.stats || {};
  const isActive = model.isActive;
  
  return `
    <div class="model-card">
        <div class="model-header">
            <div>
                <span class="model-name">${model.name}</span>
                <span class="model-provider">${model.provider}</span>
            </div>
            <span class="model-status ${isActive ? 'status-active' : 'status-inactive'}">
                ${isActive ? '✅ Active' : '❌ Inactive'}
            </span>
        </div>
        
        <div class="model-stats">
            <div class="stat-row">
                <span class="stat-label">Total Requests:</span>
                <span class="stat-value">${stats.totalRequests || 0}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Success Rate:</span>
                <span class="stat-value">${stats.successRate ? (stats.successRate * 100).toFixed(1) + '%' : 'N/A'}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Avg Response Time:</span>
                <span class="stat-value">${stats.averageResponseTime ? stats.averageResponseTime.toFixed(0) + 'ms' : 'N/A'}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Total Cost:</span>
                <span class="stat-value">$${stats.totalCost ? stats.totalCost.toFixed(4) : '0.0000'}</span>
            </div>
        </div>
        
        <button class="toggle-btn ${!isActive ? 'inactive' : ''}" 
                onclick="toggleModel('${model.id}', ${isActive})">
            ${isActive ? '🔴 Disable Model' : '🟢 Enable Model'}
        </button>
    </div>`;
}

module.exports = router;
