/**
 * 🛡️ Enhanced Error Handling System - Comprehensive Integration
 *
 * 🎯 PURPOSE: Unified error handling system that integrates all error handling
 *            improvements including intelligent circuit breakers, advanced retries,
 *            comprehensive fallbacks, automated recovery, and graceful degradation
 *
 * 📋 KEY FEATURES:
 * 1. Unified error handling interface
 * 2. Intelligent error routing and processing
 * 3. Automated recovery orchestration
 * 4. Graceful degradation management
 * 5. Enhanced user experience optimization
 * 6. Comprehensive monitoring and analytics
 */

const { errorHandler, retryWithIntelligentBackoff } = require('./errorHandler');
const { fallbackManager } = require('./fallbackManager');
const { errorRecoveryAutomation } = require('./errorRecoveryAutomation');
const { gracefulDegradationManager } = require('./gracefulDegradation');
const { errorResponseOptimizer } = require('./errorResponseOptimizer');
const monitoringService = require('../services/monitoringService');

// ==================== ENHANCED ERROR HANDLING SYSTEM ====================

class EnhancedErrorHandlingSystem {
  constructor() {
    this.isInitialized = false;
    this.systemMetrics = {
      totalErrors: 0,
      recoveredErrors: 0,
      fallbacksUsed: 0,
      degradationsTriggered: 0,
      averageRecoveryTime: 0,
      systemHealthScore: 1.0
    };
    
    this.errorProcessingQueue = [];
    this.isProcessingQueue = false;
    
    console.log('🛡️ Enhanced Error Handling System initializing...');
  }

  /**
   * Initialize the enhanced error handling system
   */
  async initialize() {
    if (this.isInitialized) {
      return { success: true, message: 'Already initialized' };
    }

    try {
      // Start background monitoring and health checks
      this.startSystemMonitoring();
      
      // Initialize component health checks
      await this.performInitialHealthChecks();
      
      this.isInitialized = true;
      
      console.log('✅ Enhanced Error Handling System initialized successfully');
      console.log('   🔧 Automated recovery: ENABLED');
      console.log('   🎯 Graceful degradation: ENABLED');
      console.log('   🛡️ Intelligent fallbacks: ENABLED');
      console.log('   📝 Response optimization: ENABLED');
      
      return { success: true, message: 'System initialized successfully' };
      
    } catch (error) {
      console.error('❌ Failed to initialize Enhanced Error Handling System:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Main error handling entry point
   */
  async handleError(error, context = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const {
      serviceName = 'unknown',
      correlationId = `error_${Date.now()}`,
      operation = null,
      userContext = {},
      skipRecovery = false,
      skipFallback = false
    } = context;

    this.systemMetrics.totalErrors++;

    try {
      monitoringService.log('info', `Processing error through enhanced system`, {
        errorType: error.constructor.name,
        serviceName,
        correlationId
      });

      // Step 1: Classify and analyze the error
      const errorAnalysis = await this.analyzeError(error, context);
      
      // Step 2: Attempt automated recovery if applicable
      let recoveryResult = null;
      if (!skipRecovery && errorAnalysis.recoverable) {
        recoveryResult = await this.attemptAutomatedRecovery(error, errorAnalysis, context);
      }

      // Step 3: If recovery failed, try fallback mechanisms
      let fallbackResult = null;
      if (!recoveryResult?.recovered && !skipFallback && errorAnalysis.fallbackAvailable) {
        fallbackResult = await this.attemptFallback(error, errorAnalysis, context);
      }

      // Step 4: Check if system degradation is needed
      await this.assessSystemDegradation(errorAnalysis, context);

      // Step 5: Generate optimized error response
      const errorResponse = await this.generateOptimizedResponse(
        error, 
        errorAnalysis, 
        recoveryResult, 
        fallbackResult, 
        context
      );

      // Step 6: Update metrics and monitoring
      this.updateSystemMetrics(errorAnalysis, recoveryResult, fallbackResult, Date.now() - startTime);

      return {
        handled: true,
        recovered: recoveryResult?.recovered || false,
        fallbackUsed: fallbackResult?.success || false,
        response: errorResponse,
        processingTime: Date.now() - startTime,
        correlationId
      };

    } catch (handlingError) {
      monitoringService.log('error', 'Error handling system failure', {
        originalError: error.message,
        handlingError: handlingError.message,
        correlationId
      });

      // Return basic error response as last resort
      return {
        handled: false,
        error: handlingError.message,
        response: this.generateEmergencyResponse(error, context),
        correlationId
      };
    }
  }

  /**
   * Analyze error for processing strategy
   */
  async analyzeError(error, context) {
    const classification = errorHandler.errorClassifier.classifyError(error, context);
    
    return {
      ...classification,
      recoverable: classification.retryable && classification.type === 'operational',
      fallbackAvailable: this.isFallbackAvailable(context.serviceName, classification),
      criticalityLevel: this.assessErrorCriticality(classification, context),
      impactScope: this.assessErrorImpact(classification, context),
      timestamp: Date.now()
    };
  }

  /**
   * Attempt automated recovery
   */
  async attemptAutomatedRecovery(error, analysis, context) {
    if (!analysis.recoverable) {
      return { recovered: false, reason: 'Error not recoverable' };
    }

    try {
      const recoveryResult = await errorRecoveryAutomation.attemptRecovery(error, context);
      
      if (recoveryResult.recovered) {
        this.systemMetrics.recoveredErrors++;
        monitoringService.log('info', 'Automated recovery successful', {
          serviceName: context.serviceName,
          recoveryAction: recoveryResult.action,
          correlationId: context.correlationId
        });
      }
      
      return recoveryResult;
      
    } catch (recoveryError) {
      monitoringService.log('error', 'Automated recovery failed', {
        error: recoveryError.message,
        correlationId: context.correlationId
      });
      
      return { recovered: false, reason: recoveryError.message };
    }
  }

  /**
   * Attempt fallback mechanisms
   */
  async attemptFallback(error, analysis, context) {
    try {
      let fallbackResult = null;
      
      switch (context.serviceName) {
        case 'ai_models':
          fallbackResult = await fallbackManager.getAIModelFallback(
            analysis.originalService || 'unknown', 
            context
          );
          break;
          
        case 'synthesis':
          fallbackResult = await fallbackManager.getSynthesisFallback(
            context.roleOutputs || [], 
            context.userPrompt || '', 
            context
          );
          break;
          
        case 'voting':
          fallbackResult = await fallbackManager.getVotingFallback(
            context.roleOutputs || [], 
            context
          );
          break;
          
        case 'database':
          fallbackResult = await fallbackManager.getDatabaseFallback(
            context.operation || 'unknown', 
            context.data || {}, 
            context
          );
          break;
          
        default:
          fallbackResult = { success: false, reason: 'No fallback available for service' };
      }
      
      if (fallbackResult && (fallbackResult.success !== false)) {
        this.systemMetrics.fallbacksUsed++;
        monitoringService.log('info', 'Fallback mechanism successful', {
          serviceName: context.serviceName,
          fallbackType: fallbackResult.fallbackType,
          correlationId: context.correlationId
        });
        
        return { success: true, result: fallbackResult };
      }
      
      return { success: false, reason: 'Fallback failed' };
      
    } catch (fallbackError) {
      monitoringService.log('error', 'Fallback mechanism failed', {
        error: fallbackError.message,
        correlationId: context.correlationId
      });
      
      return { success: false, reason: fallbackError.message };
    }
  }

  /**
   * Assess if system degradation is needed
   */
  async assessSystemDegradation(analysis, context) {
    if (analysis.criticalityLevel === 'critical' || analysis.impactScope === 'system_wide') {
      try {
        const healthMetrics = await this.gatherSystemHealthMetrics();
        const assessment = await gracefulDegradationManager.assessSystemHealth(healthMetrics);
        
        if (assessment.degradationNeeded) {
          const degradationResult = await gracefulDegradationManager.applyDegradation(
            assessment.recommendedLevel,
            `Error-triggered degradation: ${analysis.subtype}`
          );
          
          if (degradationResult.success) {
            this.systemMetrics.degradationsTriggered++;
            monitoringService.log('warn', 'System degradation applied', {
              level: assessment.recommendedLevel,
              reason: analysis.subtype,
              correlationId: context.correlationId
            });
          }
        }
        
      } catch (degradationError) {
        monitoringService.log('error', 'System degradation assessment failed', {
          error: degradationError.message,
          correlationId: context.correlationId
        });
      }
    }
  }

  /**
   * Generate optimized error response
   */
  async generateOptimizedResponse(error, analysis, recoveryResult, fallbackResult, context) {
    try {
      const responseContext = {
        ...context,
        userType: context.userContext?.type || 'user',
        recovered: recoveryResult?.recovered || false,
        fallbackUsed: fallbackResult?.success || false,
        systemStatus: gracefulDegradationManager.getDegradationStatus()
      };
      
      return errorResponseOptimizer.generateOptimizedResponse(error, responseContext);
      
    } catch (responseError) {
      monitoringService.log('error', 'Response optimization failed', {
        error: responseError.message,
        correlationId: context.correlationId
      });
      
      return this.generateEmergencyResponse(error, context);
    }
  }

  /**
   * Generate emergency response when all else fails
   */
  generateEmergencyResponse(error, context) {
    return {
      status: 'error',
      error: {
        type: 'system_error',
        message: 'A system error occurred. Please try again or contact support.',
        code: `EMERGENCY-${Date.now().toString(36)}`,
        timestamp: new Date().toISOString(),
        correlationId: context.correlationId || 'unknown'
      },
      recovery: {
        suggestions: ['Try again in a moment', 'Contact support if the problem persists'],
        actions: [{
          type: 'manual_retry',
          label: 'Try again',
          automatic: false
        }]
      }
    };
  }

  /**
   * Check if fallback is available for service
   */
  isFallbackAvailable(serviceName, classification) {
    const fallbackServices = ['ai_models', 'synthesis', 'voting', 'database'];
    return fallbackServices.includes(serviceName) && classification.type === 'operational';
  }

  /**
   * Assess error criticality
   */
  assessErrorCriticality(classification, context) {
    if (classification.severity === 'critical') return 'critical';
    if (classification.subtype === 'auth_error') return 'high';
    if (classification.subtype === 'server_error') return 'high';
    if (classification.severity === 'high') return 'medium';
    return 'low';
  }

  /**
   * Assess error impact scope
   */
  assessErrorImpact(classification, context) {
    const coreServices = ['ai_ensemble', 'synthesis', 'voting'];
    
    if (coreServices.includes(context.serviceName)) return 'system_wide';
    if (classification.severity === 'critical') return 'service_wide';
    return 'localized';
  }

  /**
   * Gather system health metrics
   */
  async gatherSystemHealthMetrics() {
    try {
      const [
        fallbackMetrics,
        recoveryMetrics,
        degradationMetrics
      ] = await Promise.all([
        fallbackManager.healthCheck(),
        errorRecoveryAutomation.healthCheck(),
        gracefulDegradationManager.healthCheck()
      ]);
      
      return {
        fallback: fallbackMetrics,
        recovery: recoveryMetrics,
        degradation: degradationMetrics,
        overall: this.systemMetrics
      };
      
    } catch (error) {
      monitoringService.log('error', 'Failed to gather system health metrics', {
        error: error.message
      });
      return {};
    }
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(analysis, recoveryResult, fallbackResult, processingTime) {
    // Update average recovery time
    if (recoveryResult?.recovered) {
      const currentAvg = this.systemMetrics.averageRecoveryTime;
      const totalRecovered = this.systemMetrics.recoveredErrors;
      this.systemMetrics.averageRecoveryTime = 
        ((currentAvg * (totalRecovered - 1)) + processingTime) / totalRecovered;
    }
    
    // Update system health score
    const successRate = (this.systemMetrics.recoveredErrors + this.systemMetrics.fallbacksUsed) / 
                       this.systemMetrics.totalErrors;
    this.systemMetrics.systemHealthScore = Math.max(0.1, Math.min(1.0, successRate));
  }

  /**
   * Start system monitoring
   */
  startSystemMonitoring() {
    if (this.monitoringInterval) return;
    
    this.monitoringInterval = setInterval(async () => {
      await this.performSystemHealthCheck();
      await this.processErrorQueue();
    }, 30000); // Every 30 seconds
    
    console.log('🔍 Enhanced error handling system monitoring started');
  }

  /**
   * Perform system health check
   */
  async performSystemHealthCheck() {
    try {
      const healthMetrics = await this.gatherSystemHealthMetrics();
      
      // Check if proactive degradation is needed
      const assessment = await gracefulDegradationManager.assessSystemHealth(healthMetrics);
      
      if (assessment.degradationNeeded || assessment.recoveryNeeded) {
        monitoringService.log('info', 'Proactive system adjustment needed', {
          assessment
        });
      }
      
    } catch (error) {
      monitoringService.log('error', 'System health check failed', {
        error: error.message
      });
    }
  }

  /**
   * Process error queue for batch operations
   */
  async processErrorQueue() {
    if (this.isProcessingQueue || this.errorProcessingQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      // Process up to 10 errors at a time
      const batch = this.errorProcessingQueue.splice(0, 10);
      
      for (const errorItem of batch) {
        await this.handleError(errorItem.error, errorItem.context);
      }
      
    } catch (error) {
      monitoringService.log('error', 'Error queue processing failed', {
        error: error.message
      });
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Perform initial health checks
   */
  async performInitialHealthChecks() {
    const components = [
      { name: 'fallbackManager', instance: fallbackManager },
      { name: 'errorRecoveryAutomation', instance: errorRecoveryAutomation },
      { name: 'gracefulDegradationManager', instance: gracefulDegradationManager },
      { name: 'errorResponseOptimizer', instance: errorResponseOptimizer }
    ];
    
    for (const component of components) {
      try {
        const health = await component.instance.healthCheck();
        console.log(`   ✅ ${component.name}: ${health.status}`);
      } catch (error) {
        console.log(`   ❌ ${component.name}: ${error.message}`);
      }
    }
  }

  /**
   * Get comprehensive system metrics
   */
  getSystemMetrics() {
    return {
      ...this.systemMetrics,
      isInitialized: this.isInitialized,
      queueSize: this.errorProcessingQueue.length,
      isProcessingQueue: this.isProcessingQueue
    };
  }

  /**
   * Health check for the entire system
   */
  async healthCheck() {
    const metrics = await this.gatherSystemHealthMetrics();
    
    return {
      status: this.systemMetrics.systemHealthScore > 0.7 ? 'healthy' : 
              this.systemMetrics.systemHealthScore > 0.4 ? 'degraded' : 'unhealthy',
      isInitialized: this.isInitialized,
      systemMetrics: this.getSystemMetrics(),
      componentHealth: metrics
    };
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('🛡️ Enhanced Error Handling System shutdown complete');
  }
}

// ==================== EXPORTS ====================

const enhancedErrorHandlingSystem = new EnhancedErrorHandlingSystem();

module.exports = {
  EnhancedErrorHandlingSystem,
  enhancedErrorHandlingSystem
};
