/**
 * Enhanced Input Validation Middleware
 * Provides comprehensive input validation, sanitization, and security checks
 */

const { body, query, param, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const auditLoggingService = require('../services/auditLoggingService');

class InputValidationMiddleware {
  constructor() {
    // Dangerous patterns to detect
    this.dangerousPatterns = [
      /(<script[^>]*>.*?<\/script>)/gi, // Script tags
      /(javascript:)/gi, // JavaScript protocol
      /(on\w+\s*=)/gi, // Event handlers
      /(<iframe[^>]*>.*?<\/iframe>)/gi, // Iframe tags
      /(eval\s*\()/gi, // Eval function
      /(document\.(write|writeln|cookie))/gi, // Document manipulation
      /(window\.(location|open))/gi, // Window manipulation
      /(\$\(.*\))/gi, // jQuery selectors (potential XSS)
      /(union\s+select)/gi, // SQL injection
      /(drop\s+table)/gi, // SQL injection
      /(insert\s+into)/gi, // SQL injection
      /(delete\s+from)/gi, // SQL injection
      /(update\s+.*\s+set)/gi, // SQL injection
      /(\.\.\/)/, // Path traversal
      /(\.\.\\)/, // Path traversal (Windows)
      /(%2e%2e%2f)/gi, // URL encoded path traversal
      /(%2e%2e%5c)/gi, // URL encoded path traversal (Windows)
    ];

    // Suspicious keywords
    this.suspiciousKeywords = [
      'admin', 'root', 'administrator', 'system', 'config', 'password',
      'token', 'secret', 'key', 'auth', 'login', 'sudo', 'chmod',
      'rm -rf', 'format c:', 'del /f', 'shutdown', 'reboot'
    ];
  }

  /**
   * Validate and sanitize prompt input
   */
  validatePrompt() {
    return [
      body('prompt')
        .isString()
        .withMessage('Prompt must be a string')
        .isLength({ min: 1, max: 10000 })
        .withMessage('Prompt must be between 1 and 10000 characters')
        .custom((value, { req }) => {
          // Check for dangerous patterns
          const violations = this.detectDangerousPatterns(value);
          if (violations.length > 0) {
            // Log security violation
            auditLoggingService.logSecurityViolation(
              'malicious_input_detected',
              req.userId || 'anonymous',
              {
                violations,
                input: value.substring(0, 200) + '...',
                ip: req.ip,
                userAgent: req.headers['user-agent']
              }
            );
            throw new Error('Input contains potentially malicious content');
          }
          return true;
        })
        .customSanitizer((value) => {
          // Sanitize the input
          return this.sanitizeInput(value);
        }),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate user ID
   */
  validateUserId() {
    return [
      body('userId')
        .optional()
        .isString()
        .withMessage('User ID must be a string')
        .isLength({ min: 1, max: 100 })
        .withMessage('User ID must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('User ID can only contain alphanumeric characters, hyphens, and underscores')
        .customSanitizer((value) => {
          return value ? value.trim().toLowerCase() : value;
        }),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate session ID
   */
  validateSessionId() {
    return [
      body('sessionId')
        .optional()
        .isString()
        .withMessage('Session ID must be a string')
        .isLength({ min: 1, max: 100 })
        .withMessage('Session ID must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Session ID can only contain alphanumeric characters, hyphens, and underscores'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate API key
   */
  validateApiKey() {
    return [
      query('api_key')
        .optional()
        .isString()
        .withMessage('API key must be a string')
        .matches(/^nsk_[a-zA-Z0-9_]+$/)
        .withMessage('Invalid API key format')
        .isLength({ min: 20, max: 100 })
        .withMessage('API key length is invalid'),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate workout request
   */
  validateWorkoutRequest() {
    return [
      body('userMetadata')
        .isObject()
        .withMessage('User metadata must be an object')
        .custom((value) => {
          const requiredFields = ['age', 'fitnessLevel', 'goals'];
          for (const field of requiredFields) {
            if (!value[field]) {
              throw new Error(`Missing required field: ${field}`);
            }
          }
          return true;
        }),
      body('userMetadata.age')
        .isInt({ min: 13, max: 120 })
        .withMessage('Age must be between 13 and 120'),
      body('userMetadata.fitnessLevel')
        .isIn(['beginner', 'intermediate', 'advanced'])
        .withMessage('Fitness level must be beginner, intermediate, or advanced'),
      body('workoutRequest')
        .isString()
        .withMessage('Workout request must be a string')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Workout request must be between 10 and 1000 characters')
        .customSanitizer((value) => {
          return this.sanitizeInput(value);
        }),
      body('workoutHistory')
        .optional()
        .isArray()
        .withMessage('Workout history must be an array')
        .custom((value) => {
          if (value && value.length > 50) {
            throw new Error('Workout history cannot exceed 50 entries');
          }
          return true;
        }),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate memory operations
   */
  validateMemoryOperation() {
    return [
      body('content')
        .isString()
        .withMessage('Content must be a string')
        .isLength({ min: 1, max: 5000 })
        .withMessage('Content must be between 1 and 5000 characters')
        .customSanitizer((value) => {
          return this.sanitizeInput(value);
        }),
      body('memoryTypes')
        .optional()
        .isArray()
        .withMessage('Memory types must be an array')
        .custom((value) => {
          if (value) {
            const validTypes = ['working', 'short_term', 'long_term', 'semantic', 'episodic'];
            const invalidTypes = value.filter(type => !validTypes.includes(type));
            if (invalidTypes.length > 0) {
              throw new Error(`Invalid memory types: ${invalidTypes.join(', ')}`);
            }
          }
          return true;
        }),
      this.handleValidationErrors
    ];
  }

  /**
   * Validate pagination parameters
   */
  validatePagination() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be between 1 and 1000'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
      this.handleValidationErrors
    ];
  }

  /**
   * Detect dangerous patterns in input
   */
  detectDangerousPatterns(input) {
    const violations = [];
    const lowerInput = input.toLowerCase();

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(input)) {
        violations.push({
          type: 'dangerous_pattern',
          pattern: pattern.toString(),
          matched: input.match(pattern)?.[0]
        });
      }
    }

    // Check for suspicious keywords
    for (const keyword of this.suspiciousKeywords) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        violations.push({
          type: 'suspicious_keyword',
          keyword: keyword
        });
      }
    }

    // Check for excessive special characters (potential obfuscation)
    const specialCharCount = (input.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
    const specialCharRatio = specialCharCount / input.length;
    if (specialCharRatio > 0.3) {
      violations.push({
        type: 'excessive_special_chars',
        ratio: specialCharRatio
      });
    }

    // Check for very long words (potential buffer overflow attempt)
    const words = input.split(/\s+/);
    const longWords = words.filter(word => word.length > 100);
    if (longWords.length > 0) {
      violations.push({
        type: 'excessively_long_words',
        count: longWords.length,
        maxLength: Math.max(...longWords.map(w => w.length))
      });
    }

    return violations;
  }

  /**
   * Sanitize input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;

    // Use DOMPurify to remove HTML/JavaScript
    let sanitized = DOMPurify.sanitize(input, { 
      ALLOWED_TAGS: [], 
      ALLOWED_ATTR: [] 
    });

    // Additional sanitization
    sanitized = sanitized
      .replace(/[<>]/g, '') // Remove any remaining angle brackets
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();

    return sanitized;
  }

  /**
   * Handle validation errors
   */
  handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const errorDetails = errors.array();
      
      // Log validation failure
      auditLoggingService.logSecurityViolation(
        'input_validation_failed',
        req.userId || 'anonymous',
        {
          errors: errorDetails,
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      );

      return res.status(400).json({
        error: 'Input validation failed',
        message: 'The provided input does not meet security requirements',
        details: errorDetails.map(err => ({
          field: err.path,
          message: err.msg,
          value: typeof err.value === 'string' && err.value.length > 50 
            ? err.value.substring(0, 50) + '...' 
            : err.value
        })),
        timestamp: new Date().toISOString()
      });
    }

    next();
  }

  /**
   * Content Security Policy validation
   */
  validateCSP() {
    return (req, res, next) => {
      // Check for CSP bypass attempts
      const suspiciousHeaders = [
        'x-forwarded-for',
        'x-real-ip',
        'x-originating-ip'
      ];

      for (const header of suspiciousHeaders) {
        if (req.headers[header]) {
          const value = req.headers[header];
          if (this.detectDangerousPatterns(value).length > 0) {
            auditLoggingService.logSecurityViolation(
              'malicious_header_detected',
              req.userId || 'anonymous',
              {
                header,
                value,
                ip: req.ip
              }
            );
          }
        }
      }

      next();
    };
  }

  /**
   * File upload validation
   */
  validateFileUpload(allowedTypes = [], maxSize = 5 * 1024 * 1024) {
    return (req, res, next) => {
      if (!req.file && !req.files) {
        return next();
      }

      const files = req.files || [req.file];
      
      for (const file of files) {
        // Check file type
        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({
            error: 'Invalid file type',
            message: `Only ${allowedTypes.join(', ')} files are allowed`
          });
        }

        // Check file size
        if (file.size > maxSize) {
          return res.status(400).json({
            error: 'File too large',
            message: `File size cannot exceed ${maxSize / (1024 * 1024)}MB`
          });
        }

        // Check for suspicious file names
        const violations = this.detectDangerousPatterns(file.originalname);
        if (violations.length > 0) {
          auditLoggingService.logSecurityViolation(
            'malicious_filename_detected',
            req.userId || 'anonymous',
            {
              filename: file.originalname,
              violations,
              ip: req.ip
            }
          );

          return res.status(400).json({
            error: 'Invalid filename',
            message: 'Filename contains potentially malicious content'
          });
        }
      }

      next();
    };
  }
}

module.exports = new InputValidationMiddleware();
