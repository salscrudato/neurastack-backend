# Neurastack Backend API Documentation

## Overview

The Neurastack Backend is a microservice-based AI ensemble system with **cost-optimized tiers** that provides multi-vendor AI integrations with parallel processing, timeout handling, and synthesis capabilities. The system leverages different AI models based on the selected tier to balance cost and performance.

### Available Tiers

#### **Free Tier** (Default - `NEURASTACK_TIER=free`)
- **Models**: GPT-4o-mini, Gemini 1.5 Flash, Claude 3 Haiku
- **Cost**: ~$0.003-0.008 per request (90-95% cost savings vs premium)
- **Response Time**: 5-15 seconds
- **Quality**: 85-90% of premium tier
- **Rate Limits**: 10 requests/hour, 50 requests/day
- **Max Prompt**: 1000 characters
- **Word Limit**: 100 words per AI response

#### **Premium Tier** (`NEURASTACK_TIER=premium`)
- **Models**: GPT-4o, Gemini 2.0 Flash, Claude Opus
- **Cost**: ~$0.05-0.15 per request
- **Response Time**: 8-20 seconds
- **Quality**: 95-100%
- **Rate Limits**: 100 requests/hour, 1000 requests/day
- **Max Prompt**: 5000 characters
- **Word Limit**: 200 words per AI response

## Base URL

**Production**: `https://neurastack-backend-638289111765.us-central1.run.app`
**Development**: `http://localhost:8080`

## CORS Configuration

✅ **Supported Origins**:
- `https://neurastack.ai` and `https://www.neurastack.ai`
- `https://neurastack-frontend.web.app`
- `http://localhost:3000` and `http://localhost:3001` (development)
- Vercel (`*.vercel.app`), Netlify (`*.netlify.app`), Firebase (`*.firebase.app`, `*.web.app`) hosting platforms

✅ **Allowed Headers**: `Content-Type`, `Authorization`, `X-Requested-With`, `X-User-Id`

## Authentication

Currently, no authentication is required. The `X-User-Id` header is optional for user tracking.

---

## Endpoints

### 1. Health Check

**GET** `/health`

Simple health check endpoint to verify service availability.

**Response:**
```json
{
  "status": "ok",
  "message": "Neurastack backend healthy 🚀"
}
```

---

### 2. OpenAI Test

**GET** `/openai-test`

Tests OpenAI GPT-4o integration with a predefined prompt.

**Response (Success):**
```json
{
  "status": "ok",
  "model": "gpt-4o",
  "response": "AI response content..."
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Failed to fetch response from OpenAI."
}
```

---

### 3. X.AI Test

**GET** `/xai-test`

Simple endpoint to verify X.AI service availability.

**Response:**
```json
{
  "status": "ok",
  "message": "xAI test endpoint is working!"
}
```

---

### 4. X.AI Grok Test

**GET** `/xai-grok`

Tests X.AI Grok-3-mini integration with a predefined prompt.

**Response (Success):**
```json
{
  "status": "ok",
  "model": "grok-3-mini",
  "response": "Grok response content..."
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Failed to fetch response from X.AI.",
  "error": "Detailed error information"
}
```

---

### 5. Google Gemini Test

**GET** `/gemini-test`

Tests Google Gemini 2.0 Flash integration with a predefined prompt.

**Response (Success):**
```json
{
  "status": "ok",
  "model": "gemini-2.0-flash",
  "response": "Gemini response content..."
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Failed to fetch response from Gemini API.",
  "error": "Detailed error information"
}
```

---

### 6. Anthropic Claude Test

**GET** `/claude-test`

Tests Anthropic Claude Opus 4 integration with a predefined prompt.

**Response (Success):**
```json
{
  "status": "ok",
  "model": "claude-opus-4-20250514",
  "response": "Claude response content..."
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "Failed to fetch response from Claude API.",
  "error": "Detailed error information"
}
```

---

### 7. Enhanced 4-AI Ensemble with Production Features (Primary Endpoint)

**POST** `/default-ensemble`

The main production-grade ensemble endpoint that processes user prompts through multiple AI models with enhanced resilience, monitoring, and memory integration. Features circuit breakers, connection pooling, structured logging, and comprehensive error handling.

### 8. 4-AI Ensemble with Memory Integration (Legacy Endpoint)

**POST** `/ensemble-test`

Legacy ensemble endpoint maintained for backward compatibility. New applications should use `/default-ensemble`.

**Headers:**
- `Content-Type: application/json`
- `X-User-Id: string` (optional) - User identifier for memory tracking
- `X-Session-Id: string` (optional) - Session identifier for memory context
- `X-Correlation-ID: string` (optional) - Request correlation ID for tracking

**Request Body:**
```typescript
interface EnsembleRequest {
  prompt?: string; // Optional. Defaults to "Quick sanity check: explain AI in 1-2 lines."
  sessionId?: string; // Optional. Session ID for memory context
}
```

**Example Request:**
```bash
curl -X POST https://neurastack-backend-638289111765.us-central1.run.app/default-ensemble \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user123" \
  -H "X-Session-Id: session456" \
  -H "X-Correlation-ID: req-12345" \
  -d '{"prompt":"Should we migrate our monolithic application to microservices?","sessionId":"session456"}'
```

**Response Schema:**
```typescript
interface EnsembleResponse {
  status: "success" | "error";
  data?: EnsembleData;
  message?: string;
  error?: string;
  timestamp?: string;
}

interface EnsembleData {
  prompt: string;
  userId: string;
  synthesis: SynthesisResult;
  roles: RoleResult[];
  metadata: EnsembleMetadata;
}

interface SynthesisResult {
  content: string;
  model: string;
  provider: "openai" | "gemini" | "claude";
  status: "success" | "failed";
  error?: string;
}

interface RoleResult {
  role: "gpt4o" | "gemini" | "claude";
  content: string;
  model: string;
  provider: "openai" | "gemini" | "claude";
  status: "fulfilled" | "rejected";
  wordCount: number;
}

interface EnsembleMetadata {
  totalRoles: number;
  successfulRoles: number;
  failedRoles: number;
  synthesisStatus: "success" | "failed";
  processingTimeMs: number;
  timestamp: string; // ISO 8601 format
  version: string; // API version
  correlationId: string; // Request tracking ID
  memoryContextUsed: boolean;
  responseQuality: number; // 0-1 quality score
}
```

**Example Response (Success):**
```json
{
  "status": "success",
  "data": {
    "prompt": "Should we migrate our monolithic application to microservices?",
    "userId": "user123",
    "synthesis": {
      "content": "Based on the comprehensive analysis from our AI ensemble...",
      "model": "gpt-4o",
      "provider": "openai",
      "status": "success"
    },
    "roles": [
      {
        "role": "evidence_analyst",
        "content": "Evidence-based analysis of microservices migration...",
        "model": "gpt-4o",
        "provider": "openai",
        "status": "fulfilled",
        "wordCount": 145
      },
      {
        "role": "innovator",
        "content": "Innovative approaches to microservices architecture...",
        "model": "gemini-2.0-flash",
        "provider": "gemini",
        "status": "fulfilled",
        "wordCount": 138
      },
      {
        "role": "risk_reviewer",
        "content": "Risk assessment for microservices migration...",
        "model": "claude-opus-4-20250514",
        "provider": "claude",
        "status": "fulfilled",
        "wordCount": 142
      }
    ],
    "metadata": {
      "totalRoles": 3,
      "successfulRoles": 3,
      "failedRoles": 0,
      "synthesisStatus": "success",
      "processingTimeMs": 12450,
      "timestamp": "2025-01-15T10:30:45.123Z"
    }
  }
}
```

**Example Response (Error):**
```json
{
  "status": "error",
  "message": "Ensemble failed.",
  "error": "Detailed error message",
  "timestamp": "2025-01-15T10:30:45.123Z"
}
```

---

## Enhanced Monitoring Endpoints

### Enhanced System Health Check

**GET** `/health-detailed`

Comprehensive health check with detailed component status and metrics.

**Response:**
```typescript
interface DetailedHealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  components: {
    system: SystemHealth;
    vendors: VendorHealth;
    ensemble: EnsembleHealth;
  };
}
```

### System Metrics

**GET** `/metrics`

Detailed system metrics for monitoring dashboards and alerting.

**Response:**
```typescript
interface MetricsResponse {
  timestamp: string;
  system: {
    requests: RequestMetrics;
    performance: PerformanceMetrics;
    resources: ResourceMetrics;
    errors: ErrorMetrics;
  };
  vendors: VendorMetrics;
  ensemble: EnsembleMetrics;
  tier: string; // Current tier (free/premium)
  costEstimate: string; // Estimated cost per request
}
```

### Tier Information

**GET** `/tier-info`

Get current tier configuration and available tier options.

**Response:**
```typescript
interface TierInfoResponse {
  status: "success";
  data: {
    currentTier: "free" | "premium";
    configuration: {
      models: Record<string, ModelConfig>;
      limits: TierLimits;
      estimatedCostPerRequest: string;
    };
    availableTiers: {
      free: TierDetails;
      premium: TierDetails;
    };
    costComparison: {
      free: TierComparison;
      premium: TierComparison;
    };
  };
  timestamp: string;
}
```

### Cost Estimation

**POST** `/estimate-cost`

Estimate the cost for processing a specific prompt.

**Request Body:**
```typescript
interface CostEstimateRequest {
  prompt: string; // Required
  tier?: "free" | "premium"; // Optional, defaults to current tier
}
```

**Response:**
```typescript
interface CostEstimateResponse {
  status: "success";
  data: {
    prompt: {
      length: number;
      estimatedTokens: number;
    };
    tier: string;
    estimatedCost: {
      total: string; // e.g., "$0.003456"
      breakdown: {
        promptTokens: number;
        responseTokens: number;
        modelsUsed: number;
      };
    };
    comparison: {
      free: string; // Cost if using free tier
      premium: string; // Cost if using premium tier
    };
  };
  timestamp: string;
}
```

---

## Workout Generation Endpoint

### AI-Powered Workout Generation

**POST** `/workout`

Generate personalized workout plans using AI based on user metadata, workout history, and specific requests. This endpoint uses a single optimized AI model (GPT-4o/GPT-4o-mini) specifically chosen for structured workout plan generation.

**Headers:**
- `Content-Type: application/json`
- `X-User-Id: string` (optional) - User identifier for tracking and personalization

**Request Body:**
```typescript
interface WorkoutRequest {
  userMetadata: UserMetadata;
  workoutHistory?: WorkoutHistoryItem[];
  workoutRequest: string;
}

interface UserMetadata {
  age: number; // Required: 13-100
  fitnessLevel: "beginner" | "intermediate" | "advanced"; // Required
  gender?: "male" | "female" | "other";
  weight?: number; // in kg or lbs
  height?: number; // in cm or inches
  goals?: string[]; // e.g., ["weight_loss", "muscle_gain", "endurance"]
  equipment?: string[]; // Available equipment
  timeAvailable?: number; // Minutes available for workout
  injuries?: string[]; // Any injuries or limitations
  preferences?: string[]; // Workout preferences
}

interface WorkoutHistoryItem {
  date: string; // ISO date
  type: string; // Workout type
  duration: number; // Minutes
  exercises?: string[]; // Exercise names
  difficulty?: string;
  rating?: number; // 1-5 user rating
}
```

**Example Request:**
```bash
curl -X POST https://neurastack-backend-638289111765.us-central1.run.app/workout \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user123" \
  -d '{
    "userMetadata": {
      "age": 28,
      "fitnessLevel": "intermediate",
      "gender": "female",
      "weight": 65,
      "goals": ["strength", "toning"],
      "equipment": ["dumbbells", "resistance_bands"],
      "timeAvailable": 45,
      "injuries": ["lower_back"]
    },
    "workoutHistory": [
      {
        "date": "2025-01-10",
        "type": "strength",
        "duration": 40,
        "exercises": ["squats", "push_ups", "planks"],
        "difficulty": "intermediate",
        "rating": 4
      }
    ],
    "workoutRequest": "I want a full-body strength workout that focuses on my core and upper body, avoiding any exercises that strain my lower back"
  }'
```

**Response Schema:**
```typescript
interface WorkoutResponse {
  status: "success" | "error";
  data?: WorkoutData;
  message?: string;
  error?: string;
  timestamp: string;
  correlationId: string;
}

interface WorkoutData {
  workout: WorkoutPlan;
  metadata: WorkoutMetadata;
}

interface WorkoutPlan {
  type: "strength" | "cardio" | "mixed" | "flexibility";
  duration: string; // e.g., "45 minutes"
  difficulty: "beginner" | "intermediate" | "advanced";
  equipment: string[];
  exercises: Exercise[];
  warmup: WarmupExercise[];
  cooldown: CooldownExercise[];
  notes: string;
}

interface Exercise {
  name: string;
  category: "strength" | "cardio" | "flexibility";
  sets?: number;
  reps: string; // e.g., "10-12" or "30 seconds"
  rest: string; // Rest time between sets
  instructions: string;
  modifications: string;
  targetMuscles: string[];
}

interface WarmupExercise {
  name: string;
  duration: string;
  instructions: string;
}

interface CooldownExercise {
  name: string;
  duration: string;
  instructions: string;
}

interface WorkoutMetadata {
  model: string;
  provider: string;
  timestamp: string;
  correlationId: string;
  userId?: string;
}
```

**Example Response (Success):**
```json
{
  "status": "success",
  "data": {
    "workout": {
      "type": "strength",
      "duration": "45 minutes",
      "difficulty": "intermediate",
      "equipment": ["dumbbells", "resistance_bands"],
      "exercises": [
        {
          "name": "Dumbbell Chest Press",
          "category": "strength",
          "sets": 3,
          "reps": "10-12",
          "rest": "60 seconds",
          "instructions": "Lie on your back, press dumbbells up from chest level...",
          "modifications": "Use lighter weights or resistance bands for easier variation",
          "targetMuscles": ["chest", "shoulders", "triceps"]
        }
      ],
      "warmup": [
        {
          "name": "Arm Circles",
          "duration": "2 minutes",
          "instructions": "Stand with arms extended, make small circles..."
        }
      ],
      "cooldown": [
        {
          "name": "Chest Stretch",
          "duration": "1 minute",
          "instructions": "Stand in doorway, place forearm against frame..."
        }
      ],
      "notes": "Focus on proper form over heavy weights. Avoid any exercises that cause lower back discomfort.",
      "calorieEstimate": "250-300 calories",
      "tags": ["strength", "upper_body", "core", "back_friendly"]
    },
    "metadata": {
      "model": "gpt-4o-mini",
      "provider": "openai",
      "timestamp": "2025-01-15T10:30:45.123Z",
      "correlationId": "workout-1642248645123-abc123",
      "userId": "user123"
    }
  },
  "timestamp": "2025-01-15T10:30:45.123Z",
  "correlationId": "workout-1642248645123-abc123"
}
```

**Example Response (Error):**
```json
{
  "status": "error",
  "message": "userMetadata.age must be a number between 13 and 100",
  "timestamp": "2025-01-15T10:30:45.123Z",
  "correlationId": "workout-1642248645123-abc123",
  "retryable": false,
  "supportInfo": {
    "correlationId": "workout-1642248645123-abc123",
    "timestamp": "2025-01-15T10:30:45.123Z",
    "suggestion": "Please check your request parameters and try again"
  }
}
```

### Workout Service Health Check

**GET** `/workout/health`

Check the health status of the workout generation service.

**Response:**
```typescript
interface WorkoutHealthResponse {
  status: "healthy" | "unhealthy";
  endpoint: "/workout";
  model?: string;
  tier?: string;
  error?: string;
  timestamp: string;
}
```

**Example Response:**
```json
{
  "status": "healthy",
  "endpoint": "/workout",
  "model": "gpt-4o-mini",
  "tier": "free",
  "timestamp": "2025-01-15T10:30:45.123Z"
}
```

---

## Memory Management Endpoints

The memory system provides persistent context across conversations, enabling the AI ensemble to maintain awareness of previous interactions and provide more contextually relevant responses.

### 8. Store Memory

**POST** `/memory/store`

Store a new memory (user prompt or AI response) for future context.

**Request Body:**
```typescript
interface StoreMemoryRequest {
  userId: string;
  sessionId: string;
  content: string;
  isUserPrompt?: boolean; // Default: true
  responseQuality?: number; // 0-1 scale, optional
  modelUsed?: string; // Optional
  ensembleMode?: boolean; // Default: false
}
```

**Response:**
```typescript
interface StoreMemoryResponse {
  success: boolean;
  memoryId: string;
  memoryType: "working" | "short_term" | "long_term" | "semantic" | "episodic";
  importance: number;
  compositeScore: number;
}
```

### 9. Retrieve Memories

**POST** `/memory/retrieve`

Retrieve memories based on criteria for context or analysis.

**Request Body:**
```typescript
interface RetrieveMemoryRequest {
  userId: string;
  sessionId?: string; // Optional - filter by session
  memoryTypes?: MemoryType[]; // Optional - filter by types
  maxResults?: number; // Default: 10, max: 50
  minImportance?: number; // Default: 0.3, range: 0-1
  includeArchived?: boolean; // Default: false
  query?: string; // Optional - text search
}
```

### 10. Get Memory Context

**POST** `/memory/context`

Generate memory context for AI prompts.

**Request Body:**
```typescript
interface MemoryContextRequest {
  userId: string;
  sessionId: string;
  maxTokens?: number; // Default: 2048, range: 100-8000
}
```

**Response:**
```typescript
interface MemoryContextResponse {
  success: boolean;
  context: string;
  estimatedTokens: number;
}
```

### 11. Memory Analytics

**GET** `/memory/analytics/:userId`

Get memory usage analytics for a user.

**Response:**
```typescript
interface MemoryAnalyticsResponse {
  success: boolean;
  userId: string;
  metrics: {
    totalMemories: number;
    memoryTypes: Record<string, number>;
    averageImportance: number;
    averageCompositeScore: number;
    archivedCount: number;
    recentMemories: number;
  };
}
```

### 12. Memory Health Check

**GET** `/memory/health`

Check the health status of the memory system.

**Response:**
```typescript
interface MemoryHealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  timestamp: string;
  details: {
    firestoreAvailable: boolean;
    localCacheSize: number;
    testMemoryStored: boolean;
    testMemoryRetrieved: boolean;
  };
}
```

---

## AI Model Descriptions

### GPT-4o (OpenAI)
- **Purpose**: Provides comprehensive, accurate responses to user queries
- **Focus**: Direct, informative, and practical answers
- **Output**: Well-structured responses with clear explanations
- **Word Limit**: 200 words

### Gemini 2.0 Flash (Google)
- **Purpose**: Provides comprehensive, accurate responses to user queries
- **Focus**: Direct, informative, and practical answers
- **Output**: Well-structured responses with clear explanations
- **Word Limit**: 200 words

### Claude Opus (Anthropic)
- **Purpose**: Provides comprehensive, accurate responses to user queries
- **Focus**: Direct, informative, and practical answers
- **Output**: Well-structured responses with clear explanations
- **Word Limit**: 200 words

### Synthesizer (OpenAI GPT-4o)
- **Purpose**: Combines all three AI responses into one optimized answer
- **Focus**: Synthesizing the best insights from all models
- **Output**: Comprehensive, unified response that leverages all perspectives
- **Word Limit**: 300 words

---

## Performance Characteristics

### Enhanced Endpoint (`/default-ensemble`)
- **Average Response Time**: 8-20 seconds (improved with connection pooling)
- **Individual AI Timeout**: 15 seconds per role (increased for reliability)
- **Maximum Processing Time**: ~45 seconds total
- **Concurrent Processing**: All 3 specialist roles run in parallel
- **Synthesis**: Sequential after all roles complete
- **Circuit Breaker**: Automatic failover when services are degraded
- **Connection Pooling**: Reused connections for better performance
- **Retry Logic**: Automatic retries with exponential backoff
- **Request Tracking**: Full correlation ID tracking for debugging

### Legacy Endpoint (`/ensemble-test`)
- **Average Response Time**: 10-25 seconds
- **Individual AI Timeout**: 12 seconds per role
- **Maximum Processing Time**: ~45 seconds total
- **Concurrent Processing**: All 3 specialist roles run in parallel
- **Synthesis**: Sequential after all roles complete

---

## Status Codes

- **200**: Success - Request completed successfully
- **500**: Error - Server error or ensemble failure

---

## Frontend Integration Guide

### Basic Implementation

```typescript
async function callEnsemble(prompt: string, userId?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const response = await fetch('/ensemble-test', {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt })
  });

  return await response.json();
}
```

### Error Handling

```typescript
try {
  const result = await callEnsemble(userPrompt, currentUserId);
  if (result.status === 'success') {
    // Handle successful response
    displayResults(result.data);
  } else {
    // Handle error response
    showError(result.message);
  }
} catch (error) {
  // Handle network errors
  showError('Network error occurred');
}
```

### Loading States

- Show loading indicator for 10-25 seconds
- Consider showing progress for each AI role
- Provide timeout handling for requests over 60 seconds

### UI Recommendations

- Display synthesis prominently as the main result
- Show individual role responses in expandable sections
- Include model and provider information for transparency
- Display processing time and success metrics

---

## Testing

Run the test suite:
```bash
npm test
```

Individual test files:
- `tests/health.test.js` - Tests all individual AI service endpoints
- `tests/ensemble.test.js` - Tests the ensemble functionality

---

## Deployment

Deploy to Google Cloud Run:
```bash
gcloud run deploy neurastack-backend --source . --region us-central1 --allow-unauthenticated
```

---

## Environment Variables

Required environment variables:
- `OPENAI_API_KEY` - OpenAI API key
- `XAI_API_KEY` - X.AI API key  
- `GEMINI_API_KEY` - Google Gemini API key
- `CLAUDE_API_KEY` - Anthropic Claude API key
- `PORT` - Server port (defaults to 8080)

---

## Rate Limiting & Monitoring

- No current rate limits implemented
- Monitor `processingTimeMs` in responses for performance tracking
- Individual AI calls have 12-second timeouts to prevent hanging
- Failed individual roles don't prevent ensemble completion

---

## Security Considerations

- CORS properly configured for allowed origins
- No sensitive data logged in console outputs
- API keys secured via environment variables
- User IDs are optional and used only for tracking
