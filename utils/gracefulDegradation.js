/**
 * 🎯 Graceful Degradation Manager - Intelligent Service Degradation for NeuraStack
 *
 * 🎯 PURPOSE: Intelligent service degradation that maintains core functionality
 *            even when non-critical components fail
 *
 * 📋 KEY FEATURES:
 * 1. Service criticality assessment and prioritization
 * 2. Intelligent feature disabling based on failure patterns
 * 3. Core functionality preservation during outages
 * 4. Automatic service level adjustment
 * 5. User experience optimization during degradation
 * 6. Recovery monitoring and service restoration
 */

const monitoringService = require('../services/monitoringService');
const { fallbackManager } = require('./fallbackManager');

// ==================== SERVICE CRITICALITY DEFINITIONS ====================

/**
 * Service criticality levels and their degradation strategies
 */
const SERVICE_CRITICALITY = {
  'core': {
    level: 1,
    description: 'Essential services that must remain operational',
    degradationStrategy: 'maintain_at_all_costs',
    fallbackRequired: true,
    services: ['ai_ensemble', 'basic_synthesis', 'error_handling']
  },
  'important': {
    level: 2,
    description: 'Important services that enhance user experience',
    degradationStrategy: 'graceful_fallback',
    fallbackRequired: true,
    services: ['enhanced_synthesis', 'voting', 'memory_management']
  },
  'optional': {
    level: 3,
    description: 'Optional services that can be disabled',
    degradationStrategy: 'disable_if_needed',
    fallbackRequired: false,
    services: ['analytics', 'caching', 'optimization']
  },
  'enhancement': {
    level: 4,
    description: 'Enhancement services that improve performance',
    degradationStrategy: 'disable_first',
    fallbackRequired: false,
    services: ['performance_monitoring', 'detailed_logging', 'metrics_collection']
  }
};

/**
 * Feature degradation levels
 */
const DEGRADATION_LEVELS = {
  'full': {
    level: 0,
    description: 'All features operational',
    restrictions: []
  },
  'enhanced': {
    level: 1,
    description: 'Enhanced features disabled',
    restrictions: ['detailed_analytics', 'performance_optimization', 'advanced_caching']
  },
  'standard': {
    level: 2,
    description: 'Standard functionality only',
    restrictions: ['enhanced_synthesis', 'complex_voting', 'memory_persistence']
  },
  'basic': {
    level: 3,
    description: 'Basic functionality only',
    restrictions: ['voting', 'memory_management', 'caching', 'analytics']
  },
  'minimal': {
    level: 4,
    description: 'Minimal core functionality',
    restrictions: ['synthesis', 'voting', 'memory', 'caching', 'analytics', 'optimization']
  },
  'emergency': {
    level: 5,
    description: 'Emergency mode - basic AI responses only',
    restrictions: ['all_non_essential']
  }
};

// ==================== GRACEFUL DEGRADATION MANAGER ====================

class GracefulDegradationManager {
  constructor() {
    this.currentDegradationLevel = 'full';
    this.serviceStates = new Map(); // Track individual service states
    this.degradationHistory = []; // Track degradation events
    this.activeRestrictions = new Set();
    this.degradationMetrics = {
      totalDegradations: 0,
      currentLevel: 'full',
      servicesAffected: 0,
      lastDegradation: null,
      recoveryTime: 0
    };
    
    this.isEnabled = process.env.GRACEFUL_DEGRADATION_ENABLED !== 'false';
    this.degradationThreshold = 0.3; // Health score threshold for degradation
    this.recoveryThreshold = 0.7; // Health score threshold for recovery
    
    // Initialize service states
    this.initializeServiceStates();
    
    console.log('🎯 Graceful Degradation Manager initialized');
    console.log(`   Degradation enabled: ${this.isEnabled}`);
    console.log(`   Current level: ${this.currentDegradationLevel}`);
  }

  /**
   * Initialize service states
   */
  initializeServiceStates() {
    for (const [criticality, config] of Object.entries(SERVICE_CRITICALITY)) {
      for (const service of config.services) {
        this.serviceStates.set(service, {
          criticality,
          status: 'operational',
          healthScore: 1.0,
          lastCheck: Date.now(),
          degradationLevel: 'full'
        });
      }
    }
  }

  /**
   * Assess system health and determine if degradation is needed
   */
  async assessSystemHealth(healthMetrics = {}) {
    if (!this.isEnabled) {
      return { degradationNeeded: false, reason: 'Degradation disabled' };
    }

    const systemHealth = await this.calculateSystemHealth(healthMetrics);
    const currentLevel = DEGRADATION_LEVELS[this.currentDegradationLevel];
    
    // Determine if degradation or recovery is needed
    if (systemHealth.overallScore < this.degradationThreshold) {
      const recommendedLevel = this.recommendDegradationLevel(systemHealth);
      
      if (recommendedLevel !== this.currentDegradationLevel) {
        return {
          degradationNeeded: true,
          currentLevel: this.currentDegradationLevel,
          recommendedLevel,
          reason: 'System health below threshold',
          healthScore: systemHealth.overallScore,
          failingServices: systemHealth.failingServices
        };
      }
    } else if (systemHealth.overallScore > this.recoveryThreshold && 
               currentLevel.level > 0) {
      const recommendedLevel = this.recommendRecoveryLevel(systemHealth);
      
      if (recommendedLevel !== this.currentDegradationLevel) {
        return {
          degradationNeeded: false,
          recoveryNeeded: true,
          currentLevel: this.currentDegradationLevel,
          recommendedLevel,
          reason: 'System health improved',
          healthScore: systemHealth.overallScore
        };
      }
    }

    return { 
      degradationNeeded: false, 
      recoveryNeeded: false,
      currentLevel: this.currentDegradationLevel,
      healthScore: systemHealth.overallScore
    };
  }

  /**
   * Calculate overall system health
   */
  async calculateSystemHealth(healthMetrics) {
    const serviceHealthScores = [];
    const failingServices = [];
    
    // Check individual service health
    for (const [serviceName, state] of this.serviceStates.entries()) {
      let healthScore = state.healthScore;
      
      // Update health score based on metrics if available
      if (healthMetrics[serviceName]) {
        healthScore = this.calculateServiceHealth(serviceName, healthMetrics[serviceName]);
        state.healthScore = healthScore;
        state.lastCheck = Date.now();
      }
      
      serviceHealthScores.push({
        service: serviceName,
        score: healthScore,
        criticality: state.criticality,
        weight: this.getCriticalityWeight(state.criticality)
      });
      
      if (healthScore < this.degradationThreshold) {
        failingServices.push({
          service: serviceName,
          score: healthScore,
          criticality: state.criticality
        });
      }
    }
    
    // Calculate weighted overall score
    const totalWeight = serviceHealthScores.reduce((sum, s) => sum + s.weight, 0);
    const weightedScore = serviceHealthScores.reduce((sum, s) => sum + (s.score * s.weight), 0);
    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    return {
      overallScore,
      serviceHealthScores,
      failingServices,
      criticalServicesHealthy: failingServices.filter(s => s.criticality === 'core').length === 0
    };
  }

  /**
   * Calculate health score for a specific service
   */
  calculateServiceHealth(serviceName, metrics) {
    let score = 1.0;
    
    // Error rate factor
    if (metrics.errorRate !== undefined) {
      score *= Math.max(0, 1 - metrics.errorRate);
    }
    
    // Response time factor
    if (metrics.averageResponseTime !== undefined) {
      const timeoutThreshold = 10000; // 10 seconds
      score *= Math.max(0.1, 1 - (metrics.averageResponseTime / timeoutThreshold));
    }
    
    // Availability factor
    if (metrics.availability !== undefined) {
      score *= metrics.availability;
    }
    
    // Circuit breaker factor
    if (metrics.circuitBreakerOpen) {
      score *= 0.1; // Heavily penalize open circuit breakers
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get criticality weight for scoring
   */
  getCriticalityWeight(criticality) {
    const weights = {
      'core': 4,
      'important': 3,
      'optional': 2,
      'enhancement': 1
    };
    return weights[criticality] || 1;
  }

  /**
   * Recommend degradation level based on system health
   */
  recommendDegradationLevel(systemHealth) {
    const { overallScore, failingServices, criticalServicesHealthy } = systemHealth;
    
    // Emergency mode if core services are failing
    if (!criticalServicesHealthy) {
      return 'emergency';
    }
    
    // Determine level based on overall score
    if (overallScore < 0.1) return 'emergency';
    if (overallScore < 0.2) return 'minimal';
    if (overallScore < 0.4) return 'basic';
    if (overallScore < 0.6) return 'standard';
    if (overallScore < 0.8) return 'enhanced';
    
    return 'full';
  }

  /**
   * Recommend recovery level based on improved health
   */
  recommendRecoveryLevel(systemHealth) {
    const { overallScore } = systemHealth;
    
    // Gradually recover based on health score
    if (overallScore > 0.9) return 'full';
    if (overallScore > 0.8) return 'enhanced';
    if (overallScore > 0.6) return 'standard';
    if (overallScore > 0.4) return 'basic';
    if (overallScore > 0.2) return 'minimal';
    
    return 'emergency';
  }

  /**
   * Apply degradation to the specified level
   */
  async applyDegradation(targetLevel, reason = 'System health degraded') {
    if (!this.isEnabled) {
      return { success: false, reason: 'Degradation disabled' };
    }

    const previousLevel = this.currentDegradationLevel;
    const targetConfig = DEGRADATION_LEVELS[targetLevel];
    
    if (!targetConfig) {
      return { success: false, reason: `Invalid degradation level: ${targetLevel}` };
    }

    monitoringService.log('warn', `Applying graceful degradation`, {
      previousLevel,
      targetLevel,
      reason,
      restrictions: targetConfig.restrictions
    });

    try {
      // Apply restrictions
      await this.applyRestrictions(targetConfig.restrictions);
      
      // Update state
      this.currentDegradationLevel = targetLevel;
      this.degradationMetrics.currentLevel = targetLevel;
      this.degradationMetrics.totalDegradations++;
      this.degradationMetrics.lastDegradation = Date.now();
      
      // Record degradation event
      this.degradationHistory.push({
        timestamp: Date.now(),
        previousLevel,
        newLevel: targetLevel,
        reason,
        restrictions: [...targetConfig.restrictions]
      });
      
      // Notify services of degradation
      await this.notifyServicesOfDegradation(targetLevel);
      
      return {
        success: true,
        previousLevel,
        newLevel: targetLevel,
        restrictionsApplied: targetConfig.restrictions.length
      };
      
    } catch (error) {
      monitoringService.log('error', 'Failed to apply degradation', {
        targetLevel,
        error: error.message
      });
      
      return { success: false, reason: error.message };
    }
  }

  /**
   * Apply service restrictions
   */
  async applyRestrictions(restrictions) {
    this.activeRestrictions.clear();
    
    for (const restriction of restrictions) {
      this.activeRestrictions.add(restriction);
      
      // Apply specific restriction logic
      switch (restriction) {
        case 'enhanced_synthesis':
          await this.disableEnhancedSynthesis();
          break;
          
        case 'complex_voting':
          await this.disableComplexVoting();
          break;
          
        case 'memory_management':
          await this.disableMemoryManagement();
          break;
          
        case 'analytics':
          await this.disableAnalytics();
          break;
          
        case 'caching':
          await this.disableCaching();
          break;
          
        case 'all_non_essential':
          await this.disableAllNonEssential();
          break;
      }
    }
  }

  /**
   * Check if a feature is currently restricted
   */
  isFeatureRestricted(feature) {
    return this.activeRestrictions.has(feature) || 
           this.activeRestrictions.has('all_non_essential');
  }

  /**
   * Get current degradation status
   */
  getDegradationStatus() {
    const currentConfig = DEGRADATION_LEVELS[this.currentDegradationLevel];

    return {
      isEnabled: this.isEnabled,
      currentLevel: this.currentDegradationLevel,
      levelDescription: currentConfig.description,
      activeRestrictions: Array.from(this.activeRestrictions),
      restrictionCount: this.activeRestrictions.size,
      metrics: { ...this.degradationMetrics },
      serviceStates: Object.fromEntries(this.serviceStates)
    };
  }

  // ==================== RESTRICTION IMPLEMENTATION METHODS ====================

  /**
   * Disable enhanced synthesis
   */
  async disableEnhancedSynthesis() {
    monitoringService.log('info', 'Disabling enhanced synthesis due to degradation');
    // This would integrate with the synthesis service to use simpler synthesis
    return { disabled: 'enhanced_synthesis' };
  }

  /**
   * Disable complex voting
   */
  async disableComplexVoting() {
    monitoringService.log('info', 'Disabling complex voting due to degradation');
    // This would integrate with the voting service to use simple voting
    return { disabled: 'complex_voting' };
  }

  /**
   * Disable memory management
   */
  async disableMemoryManagement() {
    monitoringService.log('info', 'Disabling memory management due to degradation');
    // This would disable memory persistence and use session-only memory
    return { disabled: 'memory_management' };
  }

  /**
   * Disable analytics
   */
  async disableAnalytics() {
    monitoringService.log('info', 'Disabling analytics due to degradation');
    // This would disable detailed analytics collection
    return { disabled: 'analytics' };
  }

  /**
   * Disable caching
   */
  async disableCaching() {
    monitoringService.log('info', 'Disabling caching due to degradation');
    // This would disable caching mechanisms
    return { disabled: 'caching' };
  }

  /**
   * Disable all non-essential services
   */
  async disableAllNonEssential() {
    monitoringService.log('warn', 'Disabling all non-essential services - emergency mode');

    const disabledServices = [];

    // Disable all optional and enhancement services
    for (const [serviceName, state] of this.serviceStates.entries()) {
      if (state.criticality === 'optional' || state.criticality === 'enhancement') {
        state.status = 'disabled';
        disabledServices.push(serviceName);
      }
    }

    return { disabled: disabledServices };
  }

  /**
   * Notify services of degradation level change
   */
  async notifyServicesOfDegradation(level) {
    // This would notify all services about the new degradation level
    // Services can then adjust their behavior accordingly

    monitoringService.log('info', `Notifying services of degradation level: ${level}`, {
      activeServices: Array.from(this.serviceStates.keys()).filter(
        service => this.serviceStates.get(service).status === 'operational'
      )
    });
  }

  /**
   * Attempt to recover from degradation
   */
  async attemptRecovery() {
    if (this.currentDegradationLevel === 'full') {
      return { success: false, reason: 'Already at full capacity' };
    }

    const healthMetrics = await this.gatherHealthMetrics();
    const assessment = await this.assessSystemHealth(healthMetrics);

    if (assessment.recoveryNeeded) {
      return await this.applyRecovery(assessment.recommendedLevel);
    }

    return { success: false, reason: 'System not ready for recovery' };
  }

  /**
   * Apply recovery to a higher service level
   */
  async applyRecovery(targetLevel) {
    const previousLevel = this.currentDegradationLevel;
    const targetConfig = DEGRADATION_LEVELS[targetLevel];

    monitoringService.log('info', `Attempting recovery to level: ${targetLevel}`, {
      previousLevel,
      targetLevel
    });

    try {
      // Remove restrictions that are no longer needed
      await this.removeRestrictions(targetConfig.restrictions);

      // Update state
      this.currentDegradationLevel = targetLevel;
      this.degradationMetrics.currentLevel = targetLevel;

      if (targetLevel === 'full') {
        this.degradationMetrics.recoveryTime = Date.now() - (this.degradationMetrics.lastDegradation || Date.now());
      }

      // Record recovery event
      this.degradationHistory.push({
        timestamp: Date.now(),
        previousLevel,
        newLevel: targetLevel,
        reason: 'System health improved',
        type: 'recovery'
      });

      // Notify services of recovery
      await this.notifyServicesOfRecovery(targetLevel);

      return {
        success: true,
        previousLevel,
        newLevel: targetLevel,
        restrictionsRemoved: this.activeRestrictions.size
      };

    } catch (error) {
      monitoringService.log('error', 'Failed to apply recovery', {
        targetLevel,
        error: error.message
      });

      return { success: false, reason: error.message };
    }
  }

  /**
   * Remove restrictions during recovery
   */
  async removeRestrictions(allowedRestrictions) {
    const restrictionsToRemove = Array.from(this.activeRestrictions).filter(
      restriction => !allowedRestrictions.includes(restriction)
    );

    for (const restriction of restrictionsToRemove) {
      this.activeRestrictions.delete(restriction);

      // Re-enable specific features
      switch (restriction) {
        case 'enhanced_synthesis':
          await this.enableEnhancedSynthesis();
          break;

        case 'complex_voting':
          await this.enableComplexVoting();
          break;

        case 'memory_management':
          await this.enableMemoryManagement();
          break;

        case 'analytics':
          await this.enableAnalytics();
          break;

        case 'caching':
          await this.enableCaching();
          break;
      }
    }
  }

  /**
   * Enable enhanced synthesis
   */
  async enableEnhancedSynthesis() {
    monitoringService.log('info', 'Re-enabling enhanced synthesis');
    return { enabled: 'enhanced_synthesis' };
  }

  /**
   * Enable complex voting
   */
  async enableComplexVoting() {
    monitoringService.log('info', 'Re-enabling complex voting');
    return { enabled: 'complex_voting' };
  }

  /**
   * Enable memory management
   */
  async enableMemoryManagement() {
    monitoringService.log('info', 'Re-enabling memory management');
    return { enabled: 'memory_management' };
  }

  /**
   * Enable analytics
   */
  async enableAnalytics() {
    monitoringService.log('info', 'Re-enabling analytics');
    return { enabled: 'analytics' };
  }

  /**
   * Enable caching
   */
  async enableCaching() {
    monitoringService.log('info', 'Re-enabling caching');
    return { enabled: 'caching' };
  }

  /**
   * Notify services of recovery
   */
  async notifyServicesOfRecovery(level) {
    monitoringService.log('info', `Notifying services of recovery to level: ${level}`);
  }

  /**
   * Gather health metrics from various services
   */
  async gatherHealthMetrics() {
    // This would gather actual health metrics from services
    // For now, return mock data
    return {
      ai_ensemble: { errorRate: 0.1, averageResponseTime: 2000, availability: 0.95 },
      synthesis: { errorRate: 0.05, averageResponseTime: 1500, availability: 0.98 },
      voting: { errorRate: 0.02, averageResponseTime: 500, availability: 0.99 },
      memory_management: { errorRate: 0.03, averageResponseTime: 800, availability: 0.97 }
    };
  }

  /**
   * Get degradation metrics
   */
  getMetrics() {
    return {
      ...this.degradationMetrics,
      servicesAffected: Array.from(this.serviceStates.values()).filter(
        state => state.status !== 'operational'
      ).length,
      degradationHistory: this.degradationHistory.slice(-10) // Last 10 events
    };
  }

  /**
   * Health check for degradation manager
   */
  async healthCheck() {
    const operationalServices = Array.from(this.serviceStates.values()).filter(
      state => state.status === 'operational'
    ).length;

    const totalServices = this.serviceStates.size;
    const operationalPercentage = operationalServices / totalServices;

    return {
      status: operationalPercentage > 0.8 ? 'healthy' :
              operationalPercentage > 0.5 ? 'degraded' : 'unhealthy',
      currentLevel: this.currentDegradationLevel,
      operationalServices,
      totalServices,
      operationalPercentage,
      activeRestrictions: this.activeRestrictions.size,
      isEnabled: this.isEnabled
    };
  }
}

// ==================== EXPORTS ====================

const gracefulDegradationManager = new GracefulDegradationManager();

module.exports = {
  GracefulDegradationManager,
  gracefulDegradationManager,
  SERVICE_CRITICALITY,
  DEGRADATION_LEVELS
};
