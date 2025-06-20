# NeuraStack Backend Documentation

## Overview
NeuraStack is a production-grade AI ensemble system that combines multiple AI models (OpenAI GPT-4o, Google Gemini, Anthropic Claude, X.AI Grok) to provide optimized responses with memory management, caching, and comprehensive monitoring.

## Architecture
- **Microservice-based** with configuration-driven AI ensemble
- **Multi-tier system** (Free/Premium) with cost-optimized model selection
- **Memory management** with Firestore persistence and local fallback
- **Caching layer** with Redis primary and in-memory fallback
- **Security middleware** with rate limiting, CSRF protection, and input validation

## Core Services

### AI Ensemble System
- **Primary Endpoint**: `/default-ensemble` - Production-grade ensemble with circuit breakers
- **Legacy Endpoint**: `/ensemble-test` - Backward compatibility
- **Models**: GPT-4o-mini, Gemini Flash, Claude Haiku (free tier), upgraded models (premium)
- **Synthesis**: Weighted voting with confidence scoring and adaptive model selection

### Memory Management
- **Types**: Working, Short-term, Long-term, Semantic, Episodic
- **Storage**: Firestore primary, local cache fallback
- **Features**: Content compression, importance weighting, lifecycle management
- **Retention**: Automatic cleanup based on memory type and importance

### Workout Generation
- **Endpoint**: `/workout`
- **Input**: User metadata, workout history, preferences
- **Output**: Personalized workout plans with structured data

## API Endpoints

### Health & Status
```
GET /health - Basic health check
GET /memory/health - Memory system status
GET /auth/health - Authentication service status
GET /dashboard/health - Performance monitoring status
```

### Enhanced Monitoring Dashboard (Admin Only)
```
GET /monitor - Secure monitoring dashboard with Firebase authentication
GET /monitor/metrics - Backend metrics API (admin-only, requires authentication)
GET /monitor/ai-comparison - AI model comparison and analysis data
POST /monitor/cost-estimation - Real-time cost estimation for different tiers

Headers: Authorization: Bearer <firebase-token>, X-User-Id: <admin-uid>

# Enhanced Metrics Response
Response: {
  system: { status, uptime, memoryUsageMB, environment, version, activeConnections },
  requests: { total, successful, failed, successRate },
  performance: { averageResponseTime, p95ResponseTime, slowRequests },
  memory: { working, shortTerm, longTerm, semantic, episodic },
  errors: { total, rate, recent },
  cache: { hitRate, missRate, size },
  storage: { firestore, redis, vectorDb }
}

# AI Comparison Response
Response: {
  status: "success",
  sampleResponses: Array<{
    id: string,
    prompt: string,
    responses: { gpt4o, gemini, claude },
    synthesis: { content, confidence, qualityScore, strategy }
  }>,
  modelPerformance: {
    gpt4o: { model, provider, averageConfidence, averageResponseTime, strengths, weaknesses },
    gemini: { model, provider, averageConfidence, averageResponseTime, strengths, weaknesses },
    claude: { model, provider, averageConfidence, averageResponseTime, strengths, weaknesses }
  },
  confidenceMetrics: { highConfidenceThreshold, averageConsensusLevel, modelAgreementRate }
}

# Cost Estimation Request/Response
Request: { prompt: string, tier: "free"|"premium", requestCount: number }
Response: {
  status: "success",
  tier: string,
  costs: {
    individual: { gpt4oMini, geminiFlash, claudeHaiku },
    synthesis: number,
    total: number,
    perRequest: number,
    formatted: { total: string, perRequest: string }
  },
  comparison: { free?: string, premium?: string },
  savings?: { vsOnDemand: string, monthlyProjection: string }
}
```

### Alerting System (Admin Only)
```
# Alert Configurations
GET /api/alerts/configs - Get all alert configurations
GET /api/alerts/configs/:id - Get specific alert configuration
POST /api/alerts/configs - Create new alert configuration
PUT /api/alerts/configs/:id - Update alert configuration
DELETE /api/alerts/configs/:id - Delete alert configuration

# Notification Channels
GET /api/alerts/channels - Get all notification channels
GET /api/alerts/channels/:id - Get specific notification channel
PUT /api/alerts/channels/:id - Update notification channel

# Active Alerts
GET /api/alerts/active - Get all active alerts
POST /api/alerts/:id/acknowledge - Acknowledge an alert

# Alert History & Status
GET /api/alerts/history - Get alert history (with optional filters)
GET /api/alerts/status - Get alert engine status and statistics

# Alert Engine Control
POST /api/alerts/engine/start - Start the alert engine
POST /api/alerts/engine/stop - Stop the alert engine

# Testing & Logs
POST /api/alerts/test/email - Test email notification
POST /api/alerts/test/webhook - Test webhook notification
GET /api/alerts/delivery-logs - Get recent delivery logs

Headers: Authorization: Bearer <firebase-token>
```

### AI Ensemble
```
POST /default-ensemble
Headers: X-User-Id, X-Session-Id, X-Correlation-ID
Body: { "prompt": "string", "sessionId": "string" }
Response: { status, data: { synthesis, roles, metadata }, timestamp }
```

### Memory Management
```
POST /memory/store - Store new memory
GET /memory/retrieve - Retrieve memories with context
POST /memory/search - Search memories by content
DELETE /memory/cleanup - Manual cleanup trigger
```

### Workout Generation
```
POST /workout
Body: { 
  "userMetadata": { age, fitnessLevel, goals },
  "workoutHistory": [],
  "preferences": "string"
}
Response: { workout: { exercises, duration, difficulty } }
```

## Data Models

### Ensemble Response
```typescript
interface EnsembleResponse {
  status: "success" | "error";
  data: {
    prompt: string;
    userId: string;
    sessionId: string;
    synthesis: { content: string, confidence: number, strategy: string };
    roles: Array<{ role: string, content: string, model: string, status: string }>;
    metadata: { processingTimeMs: number, modelsUsed: string[], cacheHit: boolean };
  };
  timestamp: string;
  correlationId: string;
}
```

### Memory Schema
```typescript
interface Memory {
  id: string;
  userId: string;
  sessionId: string;
  memoryType: "working" | "short_term" | "long_term" | "semantic" | "episodic";
  content: {
    original: string;
    compressed: string;
    keywords: string[];
    concepts: string[];
    sentiment: number;
    importance: number;
  };
  weights: { recency: number, frequency: number, importance: number, relevance: number };
  retention: { expiresAt: Date, priority: number };
  createdAt: Date;
  updatedAt: Date;
}
```

## Configuration

### Environment Variables
```
OPENAI_API_KEY - OpenAI API access
XAI_API_KEY - X.AI API access
GEMINI_API_KEY - Google Gemini API access
CLAUDE_API_KEY - Anthropic Claude API access
PORT - Server port (default: 8080)
```

### Model Configuration
```javascript
// Free Tier (Cost-optimized)
models: {
  gpt4o: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
  claude: "claude-3-haiku-20240307",
  synthesizer: "gpt-4o-mini"
}

// Premium Tier (Performance-optimized)
models: {
  gpt4o: "gpt-4o",
  gemini: "gemini-1.5-pro",
  claude: "claude-3-5-sonnet-20241022",
  synthesizer: "gpt-4o"
}
```

## Security Features
- **CORS**: Configured for production domains
- **Rate Limiting**: Advanced rate limiting with user-based quotas
- **Input Validation**: Comprehensive request validation
- **CSRF Protection**: Token-based CSRF protection
- **Security Headers**: Helmet.js security headers
- **Authentication**: Optional JWT-based authentication

## Enhanced Monitoring & Performance
- **Circuit Breakers**: Prevent cascade failures
- **Connection Pooling**: Optimized HTTP connections
- **Structured Logging**: Comprehensive request/response logging
- **Performance Metrics**: Response times, cache hit rates, error rates
- **Cost Monitoring**: Track API usage and costs per user/session
- **Enhanced Admin Dashboard**: Secure web-based monitoring interface with Firebase authentication
- **Real-time Metrics**: System health, memory usage, request statistics, error tracking
- **Real-time Alerting**: Configurable thresholds, email/webhook notifications, alert management

### New UI/UX Enhancements
- **Tabbed Interface**: Organized dashboard with System Metrics, AI Comparison, and Cost Analytics tabs
- **Real-time Metrics Visualization**: Enhanced metric cards with health scores, confidence indicators, and trend analysis
- **AI Model Comparison Interface**: Side-by-side comparison of individual AI model responses vs ensemble synthesis
- **Cost Optimization Dashboard**: Real-time cost estimation, tier comparison, and usage analytics
- **Enhanced Loading States**: Smooth progress indicators and loading animations
- **Dark Mode Support**: Complete dark theme with improved contrast and readability
- **Mobile Responsive Design**: Optimized for tablets and mobile devices
- **Auto-refresh Functionality**: Configurable auto-refresh with countdown indicators
- **Interactive Charts**: Hover effects, animations, and detailed metric breakdowns
- **Export Capabilities**: Download AI comparison data and cost analysis reports

## Real-time Alerting System
NeuraStack includes a comprehensive real-time alerting system that monitors system metrics and sends notifications when thresholds are exceeded.

### Features
- **Configurable Thresholds**: Set custom thresholds for various metrics
- **Multiple Notification Channels**: Email (SMTP) and webhook support
- **Alert Lifecycle Management**: Active, acknowledged, resolved states
- **Cooldown Periods**: Prevent alert spam with configurable cooldowns
- **Retry Logic**: Robust delivery with exponential backoff
- **Alert History**: Complete audit trail of all alerts
- **Admin Interface**: Web-based alert management and configuration

## Deployment
```bash
# Local Development
npm start

# Google Cloud Run
gcloud run deploy neurastack-backend --source . --region us-central1 --allow-unauthenticated
```

## Alerting System Configuration

### Environment Variables
Add these variables to your `.env` file:

```bash
# Email notification settings (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here

# Alert email recipients (comma-separated)
ALERT_EMAIL_RECIPIENTS=admin@neurastack.com,alerts@neurastack.com

# Webhook notification settings
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Dashboard and API URLs for alert notifications
DASHBOARD_URL=http://localhost:8080/monitor
API_BASE_URL=http://localhost:8080
```

### Default Alert Configurations
The system comes with pre-configured alerts for:

- **High Memory Usage**: Triggers when heap memory exceeds 500MB
- **Daily Cost Limit**: Critical alert when daily costs exceed $10
- **Hourly Cost Limit**: Warning when hourly costs exceed $2
- **High Response Time**: Warning when P95 response time exceeds 5 seconds
- **Low Success Rate**: Critical alert when success rate drops below 95%
- **Low Token Efficiency**: Warning when token efficiency drops below 50%
- **High Processing Latency**: Warning when processing time exceeds 5 seconds
- **High Error Rate**: Critical alert when error rate exceeds 5%
- **Low Cache Hit Rate**: Warning when cache hit rate drops below 20%

### Notification Channels
- **Email**: SMTP-based email notifications with HTML templates
- **Webhook**: HTTP POST notifications for Slack, Discord, or custom integrations

### Alert States
- **Active**: Alert condition is currently met
- **Acknowledged**: Alert has been acknowledged by an admin
- **Resolved**: Alert condition is no longer met
- **Suppressed**: Alert is temporarily disabled

## Monitoring Dashboard Setup

### Prerequisites
- Firebase project configured with Authentication enabled
- Admin user accounts created in Firestore
- Email/password authentication enabled in Firebase Console

### Setup Admin Users
```bash
# Create default admin user
npm run setup:admin

# Or create with custom credentials
ADMIN_EMAIL=your-admin@domain.com ADMIN_PASSWORD=your-secure-password npm run setup:admin
```

### Access Dashboard
1. Navigate to `/monitor` endpoint (e.g., `http://localhost:8080/monitor`)
2. Sign in with admin credentials
3. View real-time backend metrics and system health

### Admin User Structure (Firestore)
```javascript
// Collection: users/{uid}
{
  email: "admin@admin.com",
  role: "admin",
  permissions: ["read", "write", "admin"],
  tier: "premium",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Default Admin Credentials
- **Email**: admin@admin.com
- **Password**: admin123
- **Note**: Change these credentials in production environments

### Enhanced Monitoring Metrics
- **System Health Score**: Calculated health score based on success rate, response time, memory usage, and cache performance
- **Real-time Performance Trends**: Visual indicators for system performance with trend analysis
- **Cost Efficiency Metrics**: Cost optimization scores and efficiency tracking
- **AI Model Performance**: Individual model confidence scores, response times, and quality metrics
- **System**: Status, uptime, memory usage, environment, active connections
- **Requests**: Total, success rate, failed requests, response times with percentiles
- **Memory**: Working/short-term/long-term memory sizes, retrieval times, compression ratios
- **Performance**: P95 response times, slow requests, cache hit rates, processing latency
- **Errors**: Total errors, error rates, recent error tracking with categorization
- **Storage**: Firestore/Redis availability, cache statistics, vector database status

### AI Comparison Features
- **Model Response Analysis**: Compare individual AI model outputs side-by-side
- **Confidence Scoring**: Visual confidence indicators for each model response
- **Quality Metrics**: Response time, word count, and accuracy measurements
- **Synthesis Analysis**: Detailed breakdown of ensemble synthesis strategy and quality
- **Export Functionality**: Download comparison data for analysis and reporting
- **Sample Prompts**: Pre-configured test prompts for model evaluation

### Cost Analytics Features
- **Real-time Cost Estimation**: Calculate costs for different prompts and request volumes
- **Tier Comparison**: Side-by-side comparison of Free vs Premium tier costs and features
- **Usage Projections**: Monthly cost projections based on current usage patterns
- **Model Cost Breakdown**: Detailed cost analysis per AI model and synthesis
- **Savings Analysis**: Cost efficiency metrics and optimization recommendations
- **Interactive Cost Calculator**: Dynamic cost estimation with adjustable parameters

## Caching Strategy
- **Ensemble Responses**: 5 minutes TTL
- **Workout Plans**: 30 minutes TTL
- **Memory Queries**: 10 minutes TTL
- **Cost Estimates**: 1 minute TTL
- **Health Checks**: 30 seconds TTL

## Error Handling
- **Graceful Degradation**: Individual AI failures don't prevent ensemble completion
- **Timeout Protection**: 12-second timeouts for AI calls
- **Fallback Responses**: Cached or simplified responses when services fail
- **Comprehensive Logging**: Detailed error tracking and debugging

## Recent Changes (Changelog)
- **2025-06-18**: Added secure monitoring dashboard with Firebase authentication and admin role-based access
- **v2.0**: Enhanced ensemble with circuit breakers and production features
- **Memory System**: Comprehensive memory management with Firestore integration
- **Caching Layer**: Redis primary with in-memory fallback
- **Security Enhancements**: Advanced rate limiting and CSRF protection
- **Workout Generation**: Dedicated workout endpoint with personalization
- **Cost Optimization**: Multi-tier system with cost-optimized model selection
- **Cleanup**: Removed unused dependencies (express-jwt, jwks-rsa, multer) and files

## Testing

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:security
npm run test:advanced
npm run test:comprehensive

# Run tests with coverage
npm run test:coverage

# Run alerting system tests
npm test tests/alerting-system.test.js
```

### Testing Alerting System
```bash
# Test email configuration
curl -X POST http://localhost:8080/api/alerts/test/email \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Test webhook configuration
curl -X POST http://localhost:8080/api/alerts/test/webhook \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"}'

# Get alert engine status
curl -X GET http://localhost:8080/api/alerts/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get active alerts
curl -X GET http://localhost:8080/api/alerts/active \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Acknowledge an alert
curl -X POST http://localhost:8080/api/alerts/ALERT_ID/acknowledge \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Alerting System Usage Examples

#### Creating a Custom Alert Configuration
```bash
curl -X POST http://localhost:8080/api/alerts/configs \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "custom_cpu_alert",
    "name": "High CPU Usage",
    "description": "Alert when CPU usage exceeds 80%",
    "metric": "system.cpu.usage",
    "threshold": 0.8,
    "operator": "greater_than",
    "severity": "warning",
    "enabled": true,
    "cooldownMinutes": 10,
    "channels": ["email", "webhook"]
  }'
```

#### Updating Notification Channel
```bash
curl -X PUT http://localhost:8080/api/alerts/channels/email \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "config": {
      "recipients": ["admin@company.com", "devops@company.com"],
      "subject_prefix": "[Production Alert]"
    }
  }'
```

## Future AI Development Notes
- **Extensibility**: Add new AI providers by extending the ensemble runner
- **Model Upgrades**: Update model configurations in config files
- **Memory Enhancement**: Extend memory types and weighting algorithms
- **Performance**: Implement vector databases for semantic memory search
- **Analytics**: Add user behavior tracking and response quality metrics
- **Advanced Alerting**: Machine learning-based anomaly detection and predictive alerts
