# NeuraStack Backend Documentation

## Overview
NeuraStack is a production-grade AI ensemble system that combines multiple AI models (OpenAI GPT-4o, Google Gemini, Anthropic Claude) to provide optimized responses with intelligent memory management, workout generation, and comprehensive monitoring.

## Architecture
- **Microservice-based** with configuration-driven AI ensemble
- **Multi-tier system** (Free/Premium) with cost-optimized model selection
- **Memory management** with Firestore persistence and local fallback
- **Caching layer** with high-performance in-memory caching
- **Security middleware** with rate limiting and input validation

## Core Services

### AI Ensemble System
- **Primary Endpoint**: `/default-ensemble` - Production-grade ensemble with circuit breakers, confidence indicators, and quality metrics
- **Models**: GPT-4o-mini, Gemini Flash, Claude Haiku (free tier), upgraded models (premium)
- **Synthesis**: Weighted voting with confidence scoring, quality analysis, and adaptive model selection
- **Enhanced Features**: Response confidence indicators, quality metrics, model agreement analysis, cost estimation

### Memory Management
- **Types**: Working, Short-term, Long-term, Semantic, Episodic
- **Storage**: Firestore primary, local cache fallback
- **Features**: Content compression, importance weighting, lifecycle management
- **Retention**: Automatic cleanup based on memory type and importance

### Workout Generation
- **Endpoint**: `/workout/generate-workout` - AI-powered personalized workout generation
- **Input**: Flexible user metadata, workout history, preferences
- **Output**: Professional-grade workout plans with structured data

## API Endpoints

### Health & Status
```
GET /health - Basic health check
GET /memory/health - Memory system status
GET /workout/health - Workout service status
GET /health-detailed - Comprehensive system health
GET /metrics - System performance metrics
```

### AI Ensemble
```
POST /default-ensemble
Headers: X-User-Id, X-Session-Id, X-Correlation-ID
Body: { "prompt": "string", "sessionId": "string" }
Response: {
  status: "success",
  data: {
    synthesis: { content, confidence, qualityScore, metadata },
    roles: [{ content, confidence, quality, metadata }],
    metadata: { confidenceAnalysis, costEstimate, processingTimeMs }
  },
  timestamp: "ISO string"
}
```

### Memory Management
```
POST /memory/store - Store new memory
POST /memory/retrieve - Retrieve memories with context
POST /memory/context - Get memory context for AI prompts
GET /memory/analytics/:userId - Get memory usage analytics
```

### Workout Generation & Tracking
```
POST /workout/generate-workout - Generate personalized workout
POST /workout/workout-completion - Record detailed workout completion
GET /workout/workout-history - Retrieve workout history with analytics
POST /workout/complete-workout - Simple workout completion (legacy support)
```

## Data Models

### Ensemble Response
```typescript
interface EnsembleResponse {
  status: "success" | "error";
  data: {
    prompt: string;
    userId: string;
    synthesis: { content: string, confidence: ConfidenceScore, qualityScore: number };
    roles: Array<{ role: string, content: string, model: string, status: string, confidence: ConfidenceScore }>;
    metadata: { processingTimeMs: number, costEstimate: CostEstimate, confidenceAnalysis: object };
  };
  timestamp: string;
  correlationId: string;
}
```

### Workout Plan
```typescript
interface WorkoutPlan {
  type: string;
  duration: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  equipment: string[];
  exercises: Exercise[];
  warmup: WarmupExercise[];
  cooldown: CooldownExercise[];
  coachingTips: string[];
}
```

## Configuration

### Environment Variables
```
OPENAI_API_KEY - OpenAI API access
GEMINI_API_KEY - Google Gemini API access
CLAUDE_API_KEY - Anthropic Claude API access
PORT - Server port (default: 8080)
NEURASTACK_TIER - Tier configuration (free/premium, default: free)
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

## Security & Performance Features
- **CORS**: Configured for production domains
- **Rate Limiting**: IP-based rate limiting (100 requests per 15 minutes)
- **Input Validation**: Comprehensive request validation
- **Circuit Breakers**: Prevent cascade failures
- **Connection Pooling**: Optimized HTTP connections
- **Structured Logging**: Comprehensive request/response logging
- **Performance Metrics**: Response times, cache hit rates, error rates
- **Cost Monitoring**: Track API usage and costs per user/session

## Caching Strategy
- **Ensemble Responses**: 5 minutes TTL
- **Workout Plans**: 30 minutes TTL
- **Memory Queries**: 10 minutes TTL
- **Health Checks**: 30 seconds TTL

## Error Handling
- **Graceful Degradation**: Individual AI failures don't prevent ensemble completion
- **Timeout Protection**: 15-second timeouts for AI calls
- **Fallback Responses**: Cached or simplified responses when services fail
- **Comprehensive Logging**: Detailed error tracking and debugging

## Deployment
```bash
# Local Development
npm start

# Google Cloud Run
gcloud run deploy neurastack-backend --source . --region us-central1 --allow-unauthenticated
```

## Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:security
npm run test:advanced
npm run test:comprehensive

# Run tests with coverage
npm run test:coverage
```

## Recent Changes (Changelog)
- **2025-06-22**: Cleaned up legacy code and documentation, consolidated API endpoints
- **v2.0**: Enhanced ensemble with circuit breakers and production features
- **Memory System**: Comprehensive memory management with Firestore integration
- **Caching Layer**: Redis primary with in-memory fallback
- **Security Enhancements**: Rate limiting and input validation
- **Workout Generation**: Professional workout generation with completion tracking
- **Cost Optimization**: Multi-tier system with cost-optimized model selection

## Future Development Notes
- **Extensibility**: Add new AI providers by extending the ensemble runner
- **Model Upgrades**: Update model configurations in config files
- **Memory Enhancement**: Extend memory types and weighting algorithms
- **Performance**: Implement vector databases for semantic memory search
- **Analytics**: Add user behavior tracking and response quality metrics

## API Reference
For detailed API documentation including request/response schemas, authentication, and examples, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).
