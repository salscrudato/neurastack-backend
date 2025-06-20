/**
 * Frontend Enhancement Tests
 * Tests for the enhanced monitoring dashboard UI functionality
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

describe('Frontend Enhancements', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // Create a mock DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="metricsContainer"></div>
          <div id="aiComparisonContainer"></div>
          <div id="costOptimizationContainer"></div>
          <div id="costEstimationResults"></div>
          <div id="tierComparisonContainer"></div>
          <div id="refreshCountdown" class="refresh-countdown"></div>
          
          <!-- Navigation tabs -->
          <button id="metricsTab" class="nav-tab active"></button>
          <button id="aiComparisonTab" class="nav-tab"></button>
          <button id="costAnalyticsTab" class="nav-tab"></button>
          
          <!-- Tab contents -->
          <div id="metricsTabContent" class="tab-content active"></div>
          <div id="aiComparisonTabContent" class="tab-content"></div>
          <div id="costAnalyticsTabContent" class="tab-content"></div>
          
          <!-- Cost estimation form -->
          <textarea id="costPrompt"></textarea>
          <select id="tierSelector">
            <option value="free">Free Tier</option>
            <option value="premium">Premium Tier</option>
          </select>
          <input type="number" id="requestCount" value="1">
          <button id="estimateCostBtn">Estimate Cost</button>
          
          <!-- AI comparison form -->
          <button id="loadComparisonBtn">Load Comparison</button>
          <select id="promptSelector">
            <option value="">Select prompt...</option>
          </select>
        </body>
      </html>
    `, { url: 'http://localhost' });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    dom.window.close();
  });

  describe('Tab Management', () => {
    // Mock the showTab function
    const showTab = (tabName) => {
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
      const selectedContent = document.getElementById(`${tabName}TabContent`);
      const selectedTab = document.getElementById(`${tabName}Tab`);

      if (selectedContent) {
        selectedContent.classList.add('active');
      }

      if (selectedTab) {
        selectedTab.classList.add('active');
      }
    };

    it('should switch to metrics tab correctly', () => {
      showTab('metrics');
      
      expect(document.getElementById('metricsTabContent').classList.contains('active')).toBe(true);
      expect(document.getElementById('metricsTab').classList.contains('active')).toBe(true);
      expect(document.getElementById('aiComparisonTabContent').classList.contains('active')).toBe(false);
      expect(document.getElementById('costAnalyticsTabContent').classList.contains('active')).toBe(false);
    });

    it('should switch to AI comparison tab correctly', () => {
      showTab('aiComparison');
      
      expect(document.getElementById('aiComparisonTabContent').classList.contains('active')).toBe(true);
      expect(document.getElementById('aiComparisonTab').classList.contains('active')).toBe(true);
      expect(document.getElementById('metricsTabContent').classList.contains('active')).toBe(false);
      expect(document.getElementById('costAnalyticsTabContent').classList.contains('active')).toBe(false);
    });

    it('should switch to cost analytics tab correctly', () => {
      showTab('costAnalytics');
      
      expect(document.getElementById('costAnalyticsTabContent').classList.contains('active')).toBe(true);
      expect(document.getElementById('costAnalyticsTab').classList.contains('active')).toBe(true);
      expect(document.getElementById('metricsTabContent').classList.contains('active')).toBe(false);
      expect(document.getElementById('aiComparisonTabContent').classList.contains('active')).toBe(false);
    });
  });

  describe('Health Score Calculations', () => {
    const calculateSystemHealth = (data) => {
      const successRate = parseFloat(data.requests?.successRate || 0);
      const responseTime = data.performance?.averageResponseTime || 0;
      const memoryUsage = data.system?.memoryUsageMB || 0;
      const cacheHitRate = data.cache?.hitRate || 0;

      let score = 0;
      score += (successRate / 100) * 40;
      score += Math.max(0, (2000 - responseTime) / 2000) * 30;
      score += Math.max(0, (512 - memoryUsage) / 512) * 20;
      score += (cacheHitRate / 100) * 10;

      score = Math.round(score);

      let status, label;
      if (score >= 85) {
        status = 'healthy';
        label = 'Excellent';
      } else if (score >= 70) {
        status = 'warning';
        label = 'Good';
      } else {
        status = 'critical';
        label = 'Needs Attention';
      }

      return { score, status, label };
    };

    it('should calculate excellent health score', () => {
      const data = {
        requests: { successRate: '98.5' },
        performance: { averageResponseTime: 800 },
        system: { memoryUsageMB: 200 },
        cache: { hitRate: 85 }
      };

      const health = calculateSystemHealth(data);
      expect(health.score).toBeGreaterThanOrEqual(85);
      expect(health.status).toBe('healthy');
      expect(health.label).toBe('Excellent');
    });

    it('should calculate warning health score', () => {
      const data = {
        requests: { successRate: '85.0' },
        performance: { averageResponseTime: 1500 },
        system: { memoryUsageMB: 400 },
        cache: { hitRate: 60 }
      };

      const health = calculateSystemHealth(data);
      expect(health.score).toBeGreaterThanOrEqual(70);
      expect(health.score).toBeLessThan(85);
      expect(health.status).toBe('warning');
      expect(health.label).toBe('Good');
    });

    it('should calculate critical health score', () => {
      const data = {
        requests: { successRate: '60.0' },
        performance: { averageResponseTime: 3000 },
        system: { memoryUsageMB: 600 },
        cache: { hitRate: 20 }
      };

      const health = calculateSystemHealth(data);
      expect(health.score).toBeLessThan(70);
      expect(health.status).toBe('critical');
      expect(health.label).toBe('Needs Attention');
    });
  });

  describe('Cost Estimation Display', () => {
    const displayCostEstimation = (data) => {
      const container = document.getElementById('costEstimationResults');
      
      container.innerHTML = `
        <div class="cost-estimation-results">
          <div class="estimation-header">
            <div class="estimation-title">Cost Estimation Results</div>
            <div class="tier-badge ${data.tier}">${data.tier} tier</div>
          </div>
          <div class="cost-breakdown">
            <div class="cost-item">
              <div class="cost-value">${data.costs.formatted.total}</div>
              <div class="cost-label">Total Cost</div>
            </div>
          </div>
        </div>
      `;
    };

    it('should display cost estimation results correctly', () => {
      const mockData = {
        tier: 'free',
        costs: {
          formatted: {
            total: '$0.000123',
            perRequest: '$0.000123'
          }
        }
      };

      displayCostEstimation(mockData);
      
      const container = document.getElementById('costEstimationResults');
      expect(container.innerHTML).toContain('Cost Estimation Results');
      expect(container.innerHTML).toContain('free tier');
      expect(container.innerHTML).toContain('$0.000123');
      expect(container.innerHTML).toContain('Total Cost');
    });
  });

  describe('AI Comparison Functions', () => {
    const getConfidenceClass = (confidence) => {
      if (confidence >= 0.8) return 'confidence-high';
      if (confidence >= 0.6) return 'confidence-medium';
      return 'confidence-low';
    };

    const getModelIcon = (model) => {
      const icons = {
        'gpt4o': '🤖',
        'gemini': '💎',
        'claude': '🧠'
      };
      return icons[model] || '🤖';
    };

    it('should return correct confidence classes', () => {
      expect(getConfidenceClass(0.9)).toBe('confidence-high');
      expect(getConfidenceClass(0.75)).toBe('confidence-medium');
      expect(getConfidenceClass(0.5)).toBe('confidence-low');
      expect(getConfidenceClass(0.8)).toBe('confidence-high');
      expect(getConfidenceClass(0.6)).toBe('confidence-medium');
    });

    it('should return correct model icons', () => {
      expect(getModelIcon('gpt4o')).toBe('🤖');
      expect(getModelIcon('gemini')).toBe('💎');
      expect(getModelIcon('claude')).toBe('🧠');
      expect(getModelIcon('unknown')).toBe('🤖');
    });
  });

  describe('Loading States', () => {
    const showLoadingState = () => {
      const metricsContainer = document.getElementById('metricsContainer');
      const costContainer = document.getElementById('costOptimizationContainer');
      
      metricsContainer.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <div class="loading-text">Fetching real-time metrics...</div>
        </div>
      `;
      
      if (costContainer) {
        costContainer.innerHTML = `
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading cost analytics...</div>
          </div>
        `;
      }
    };

    it('should display loading states correctly', () => {
      showLoadingState();
      
      const metricsContainer = document.getElementById('metricsContainer');
      const costContainer = document.getElementById('costOptimizationContainer');
      
      expect(metricsContainer.innerHTML).toContain('loading-state');
      expect(metricsContainer.innerHTML).toContain('Fetching real-time metrics...');
      expect(costContainer.innerHTML).toContain('loading-state');
      expect(costContainer.innerHTML).toContain('Loading cost analytics...');
    });
  });

  describe('Refresh Countdown', () => {
    const updateRefreshCountdown = (seconds) => {
      const countdownElement = document.getElementById('refreshCountdown');
      if (countdownElement && seconds > 0) {
        countdownElement.textContent = `Next refresh in ${seconds}s`;
        countdownElement.style.display = 'block';
      }
    };

    it('should update countdown display correctly', () => {
      updateRefreshCountdown(30);
      
      const countdownElement = document.getElementById('refreshCountdown');
      expect(countdownElement.textContent).toBe('Next refresh in 30s');
      expect(countdownElement.style.display).toBe('block');
    });

    it('should not display countdown for zero seconds', () => {
      const countdownElement = document.getElementById('refreshCountdown');
      countdownElement.style.display = 'none';
      
      updateRefreshCountdown(0);
      
      expect(countdownElement.style.display).toBe('none');
    });
  });
});
