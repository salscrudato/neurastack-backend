/**
 * 📝 Error Response Optimizer - Enhanced User-Friendly Error Responses
 *
 * 🎯 PURPOSE: Optimize error responses for better user experience with meaningful
 *            error messages, recovery suggestions, and status information
 *
 * 📋 KEY FEATURES:
 * 1. User-friendly error message generation
 * 2. Context-aware recovery suggestions
 * 3. Intelligent error categorization for users
 * 4. Progressive error disclosure based on user type
 * 5. Actionable error responses with next steps
 * 6. Error response personalization and localization
 */

const monitoringService = require('../services/monitoringService');
const { gracefulDegradationManager } = require('./gracefulDegradation');

// ==================== ERROR MESSAGE TEMPLATES ====================

/**
 * User-friendly error message templates
 */
const ERROR_MESSAGE_TEMPLATES = {
  'rate_limit': {
    user: "We're experiencing high demand right now. Please wait a moment and try again.",
    developer: "Rate limit exceeded. Current limit: {limit} requests per {window}. Retry after: {retryAfter}s",
    admin: "Rate limit triggered for {service}. Current usage: {current}/{limit}. Consider scaling or adjusting limits.",
    suggestions: [
      "Wait {retryAfter} seconds before trying again",
      "Consider upgrading to a higher tier for increased limits",
      "Try breaking your request into smaller parts"
    ]
  },
  'timeout': {
    user: "The request is taking longer than expected. We're working on it - please try again in a moment.",
    developer: "Request timeout after {timeout}ms. Service: {service}. Consider increasing timeout or optimizing the request.",
    admin: "Timeout in {service} after {timeout}ms. Check service performance and resource allocation.",
    suggestions: [
      "Try again in a few moments",
      "Check your internet connection",
      "Contact support if the problem persists"
    ]
  },
  'server_error': {
    user: "We're experiencing technical difficulties. Our team has been notified and is working on a fix.",
    developer: "Internal server error in {service}. Error ID: {errorId}. Check logs for details.",
    admin: "Server error in {service}: {error}. Immediate attention required. Error ID: {errorId}",
    suggestions: [
      "Try again in a few minutes",
      "Check our status page for updates",
      "Contact support with error ID: {errorId}"
    ]
  },
  'network_error': {
    user: "We're having trouble connecting to our services. Please check your connection and try again.",
    developer: "Network connectivity issue: {error}. Check service endpoints and network configuration.",
    admin: "Network error affecting {service}: {error}. Check infrastructure and connectivity.",
    suggestions: [
      "Check your internet connection",
      "Try refreshing the page",
      "Contact support if the issue continues"
    ]
  },
  'auth_error': {
    user: "Authentication failed. Please check your credentials and try again.",
    developer: "Authentication error: {error}. Verify API keys and authentication headers.",
    admin: "Authentication failure for {service}: {error}. Check credential configuration.",
    suggestions: [
      "Verify your login credentials",
      "Check if your session has expired",
      "Contact support if you continue having trouble"
    ]
  },
  'validation_error': {
    user: "There's an issue with your request. Please check the information and try again.",
    developer: "Validation failed: {error}. Check request format and required fields.",
    admin: "Validation error in {service}: {error}. Review input validation rules.",
    suggestions: [
      "Check that all required fields are filled",
      "Verify the format of your input",
      "Review the documentation for correct format"
    ]
  },
  'quota_exceeded': {
    user: "You've reached your usage limit. Please upgrade your plan or wait for the limit to reset.",
    developer: "Quota exceeded for {service}. Current usage: {current}/{limit}. Resets at: {resetTime}",
    admin: "Quota exceeded for user {userId} in {service}. Consider automatic scaling or user notification.",
    suggestions: [
      "Upgrade to a higher plan for more capacity",
      "Wait for your quota to reset at {resetTime}",
      "Contact sales for enterprise options"
    ]
  },
  'service_unavailable': {
    user: "This service is temporarily unavailable. We're working to restore it as quickly as possible.",
    developer: "Service {service} is currently unavailable. Status: {status}. Check service health endpoints.",
    admin: "Service {service} is down. Status: {status}. Immediate intervention required.",
    suggestions: [
      "Try again in a few minutes",
      "Check our status page for updates",
      "Use alternative features if available"
    ]
  }
};

/**
 * Recovery action templates
 */
const RECOVERY_ACTION_TEMPLATES = {
  'wait_and_retry': "Wait {delay} seconds and try again automatically",
  'manual_retry': "Click here to try again",
  'switch_provider': "Trying alternative service provider",
  'use_fallback': "Using simplified version of the feature",
  'contact_support': "Contact support with error code: {errorCode}",
  'check_status': "Check our status page for updates",
  'upgrade_plan': "Upgrade your plan for higher limits"
};

// ==================== ERROR RESPONSE OPTIMIZER ====================

class ErrorResponseOptimizer {
  constructor() {
    this.responseCache = new Map(); // Cache optimized responses
    this.userPreferences = new Map(); // Store user preferences for error detail level
    this.responseMetrics = {
      totalResponses: 0,
      responsesByType: new Map(),
      userSatisfactionScore: 0,
      averageResponseTime: 0
    };
    
    console.log('📝 Error Response Optimizer initialized');
  }

  /**
   * Generate optimized error response for user
   */
  generateOptimizedResponse(error, context = {}) {
    const startTime = Date.now();
    
    try {
      const {
        userType = 'user', // user, developer, admin
        correlationId = null,
        serviceName = 'unknown',
        userId = null,
        requestContext = {}
      } = context;

      // Classify the error
      const classification = this.classifyErrorForResponse(error);
      
      // Get user preferences
      const preferences = this.getUserPreferences(userId, userType);
      
      // Generate base response
      const baseResponse = this.generateBaseResponse(error, classification, context);
      
      // Enhance with user-specific information
      const enhancedResponse = this.enhanceResponseForUser(baseResponse, preferences, context);
      
      // Add recovery suggestions
      const finalResponse = this.addRecoverySuggestions(enhancedResponse, classification, context);
      
      // Track metrics
      this.trackResponseMetrics(classification.subtype, Date.now() - startTime);
      
      return finalResponse;
      
    } catch (optimizationError) {
      monitoringService.log('error', 'Error response optimization failed', {
        error: optimizationError.message,
        originalError: error.message,
        correlationId: context.correlationId
      });
      
      // Return basic fallback response
      return this.generateFallbackResponse(error, context);
    }
  }

  /**
   * Classify error for response generation
   */
  classifyErrorForResponse(error) {
    const message = error.message || error.toString();
    
    // Use enhanced classification if available
    if (typeof error.classifyError === 'function') {
      return error.classifyError();
    }
    
    // Basic classification
    if (message.includes('rate_limit') || message.includes('429')) {
      return { type: 'operational', subtype: 'rate_limit', severity: 'medium' };
    }
    if (message.includes('timeout')) {
      return { type: 'operational', subtype: 'timeout', severity: 'medium' };
    }
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return { type: 'operational', subtype: 'server_error', severity: 'high' };
    }
    if (message.includes('network') || message.includes('ECONNRESET')) {
      return { type: 'operational', subtype: 'network_error', severity: 'high' };
    }
    if (message.includes('401') || message.includes('403')) {
      return { type: 'operational', subtype: 'auth_error', severity: 'high' };
    }
    if (message.includes('validation') || message.includes('400')) {
      return { type: 'operational', subtype: 'validation_error', severity: 'low' };
    }
    if (message.includes('quota') || message.includes('limit exceeded')) {
      return { type: 'operational', subtype: 'quota_exceeded', severity: 'medium' };
    }
    if (message.includes('unavailable') || message.includes('service down')) {
      return { type: 'operational', subtype: 'service_unavailable', severity: 'high' };
    }
    
    return { type: 'operational', subtype: 'unknown', severity: 'medium' };
  }

  /**
   * Get user preferences for error responses
   */
  getUserPreferences(userId, userType) {
    const defaultPreferences = {
      detailLevel: userType === 'developer' ? 'detailed' : userType === 'admin' ? 'technical' : 'simple',
      showTechnicalDetails: userType !== 'user',
      showRecoveryActions: true,
      showErrorCodes: userType !== 'user',
      language: 'en'
    };
    
    if (userId && this.userPreferences.has(userId)) {
      return { ...defaultPreferences, ...this.userPreferences.get(userId) };
    }
    
    return defaultPreferences;
  }

  /**
   * Generate base error response
   */
  generateBaseResponse(error, classification, context) {
    const template = ERROR_MESSAGE_TEMPLATES[classification.subtype] || ERROR_MESSAGE_TEMPLATES['server_error'];
    const { userType = 'user', correlationId, serviceName } = context;
    
    // Get appropriate message for user type
    let message = template[userType] || template.user;
    
    // Replace placeholders
    message = this.replacePlaceholders(message, {
      service: serviceName,
      error: error.message,
      errorId: correlationId,
      timeout: context.timeout || 30000,
      limit: context.limit || 100,
      window: context.window || '15 minutes',
      retryAfter: context.retryAfter || 60,
      current: context.current || 0,
      resetTime: context.resetTime || 'next hour',
      userId: context.userId || 'unknown'
    });
    
    return {
      status: 'error',
      error: {
        type: classification.subtype,
        severity: classification.severity,
        message,
        code: this.generateErrorCode(classification, context),
        timestamp: new Date().toISOString(),
        correlationId: correlationId || 'unknown'
      }
    };
  }

  /**
   * Enhance response for specific user
   */
  enhanceResponseForUser(baseResponse, preferences, context) {
    const enhanced = { ...baseResponse };
    
    // Add technical details if requested
    if (preferences.showTechnicalDetails) {
      enhanced.error.technical = {
        service: context.serviceName,
        endpoint: context.endpoint,
        method: context.method,
        stack: preferences.detailLevel === 'detailed' ? context.stack : undefined
      };
    }
    
    // Add error code if requested
    if (preferences.showErrorCodes) {
      enhanced.error.errorCode = enhanced.error.code;
    }
    
    // Add system status information
    const degradationStatus = gracefulDegradationManager.getDegradationStatus();
    if (degradationStatus.currentLevel !== 'full') {
      enhanced.systemStatus = {
        level: degradationStatus.currentLevel,
        description: degradationStatus.levelDescription,
        affectedFeatures: degradationStatus.activeRestrictions
      };
    }
    
    return enhanced;
  }

  /**
   * Add recovery suggestions to response
   */
  addRecoverySuggestions(response, classification, context) {
    const template = ERROR_MESSAGE_TEMPLATES[classification.subtype];
    
    if (template && template.suggestions) {
      response.recovery = {
        suggestions: template.suggestions.map(suggestion => 
          this.replacePlaceholders(suggestion, {
            retryAfter: context.retryAfter || 60,
            errorId: context.correlationId,
            resetTime: context.resetTime || 'next hour'
          })
        ),
        actions: this.generateRecoveryActions(classification, context),
        estimatedRecoveryTime: this.estimateRecoveryTime(classification, context)
      };
    }
    
    return response;
  }

  /**
   * Generate recovery actions
   */
  generateRecoveryActions(classification, context) {
    const actions = [];
    
    switch (classification.subtype) {
      case 'rate_limit':
        actions.push({
          type: 'wait_and_retry',
          label: 'Wait and retry automatically',
          delay: context.retryAfter || 60,
          automatic: true
        });
        break;
        
      case 'timeout':
        actions.push({
          type: 'manual_retry',
          label: 'Try again',
          automatic: false
        });
        break;
        
      case 'server_error':
        actions.push({
          type: 'manual_retry',
          label: 'Try again',
          automatic: false
        });
        actions.push({
          type: 'check_status',
          label: 'Check system status',
          url: '/status'
        });
        break;
        
      case 'auth_error':
        actions.push({
          type: 'reauthenticate',
          label: 'Sign in again',
          url: '/login'
        });
        break;
        
      case 'quota_exceeded':
        actions.push({
          type: 'upgrade_plan',
          label: 'Upgrade plan',
          url: '/upgrade'
        });
        break;
    }
    
    return actions;
  }

  /**
   * Estimate recovery time
   */
  estimateRecoveryTime(classification, context) {
    switch (classification.subtype) {
      case 'rate_limit':
        return context.retryAfter || 60;
      case 'timeout':
        return 30;
      case 'server_error':
        return 300; // 5 minutes
      case 'network_error':
        return 120; // 2 minutes
      case 'service_unavailable':
        return 600; // 10 minutes
      default:
        return 60;
    }
  }

  /**
   * Replace placeholders in message templates
   */
  replacePlaceholders(message, values) {
    return message.replace(/\{(\w+)\}/g, (match, key) => {
      return values[key] !== undefined ? values[key] : match;
    });
  }

  /**
   * Generate unique error code
   */
  generateErrorCode(classification, context) {
    const timestamp = Date.now().toString(36);
    const service = (context.serviceName || 'unknown').substring(0, 3).toUpperCase();
    const type = classification.subtype.substring(0, 3).toUpperCase();
    
    return `${service}-${type}-${timestamp}`;
  }

  /**
   * Generate fallback response when optimization fails
   */
  generateFallbackResponse(error, context) {
    return {
      status: 'error',
      error: {
        type: 'unknown',
        severity: 'medium',
        message: 'An unexpected error occurred. Please try again or contact support.',
        code: `FALLBACK-${Date.now().toString(36)}`,
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
   * Track response metrics
   */
  trackResponseMetrics(errorType, responseTime) {
    this.responseMetrics.totalResponses++;
    this.responseMetrics.averageResponseTime = 
      ((this.responseMetrics.averageResponseTime * (this.responseMetrics.totalResponses - 1)) + responseTime) / 
      this.responseMetrics.totalResponses;
    
    if (!this.responseMetrics.responsesByType.has(errorType)) {
      this.responseMetrics.responsesByType.set(errorType, 0);
    }
    this.responseMetrics.responsesByType.set(
      errorType, 
      this.responseMetrics.responsesByType.get(errorType) + 1
    );
  }

  /**
   * Get response metrics
   */
  getMetrics() {
    return {
      ...this.responseMetrics,
      responsesByType: Object.fromEntries(this.responseMetrics.responsesByType),
      cacheSize: this.responseCache.size,
      userPreferencesCount: this.userPreferences.size
    };
  }

  /**
   * Health check for response optimizer
   */
  async healthCheck() {
    return {
      status: 'healthy',
      metrics: this.getMetrics(),
      templatesLoaded: Object.keys(ERROR_MESSAGE_TEMPLATES).length,
      isOptimizing: true
    };
  }
}

// ==================== EXPORTS ====================

const errorResponseOptimizer = new ErrorResponseOptimizer();

module.exports = {
  ErrorResponseOptimizer,
  errorResponseOptimizer,
  ERROR_MESSAGE_TEMPLATES,
  RECOVERY_ACTION_TEMPLATES
};
