# NeuraStack Backend API Documentation

## Overview

NeuraStack Backend is a production-grade AI ensemble system providing multi-vendor AI integrations, intelligent memory management, and personalized workout generation. The system uses cost-optimized tiers to balance performance and cost efficiency.

### Base URLs
- **Production**: `https://neurastack-backend-638289111765.us-central1.run.app`
- **Development**: `http://localhost:8080`

### Authentication
- Optional `X-User-Id` header for user tracking and personalization
- Optional `X-Session-Id` header for session context
- Optional `X-Correlation-ID` header for request tracking

---

## Core Endpoints

### 1. AI Ensemble

**POST** `/default-ensemble`

The main AI ensemble endpoint that processes prompts through multiple AI models with synthesis.

**Headers:**
```
Content-Type: application/json
X-User-Id: string (optional)
X-Session-Id: string (optional)
X-Correlation-ID: string (optional)
```

**Request Body:**
```json
{
  "prompt": "Your question or request here",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "prompt": "Your question or request here",
    "userId": "user123",
    "synthesis": {
      "content": "Synthesized response from all AI models",
      "model": "gpt-4o",
      "provider": "openai",
      "status": "success",
      "confidence": {
        "score": 0.85,
        "level": "high",
        "factors": ["model_agreement", "response_quality"]
      },
      "_confidenceDescription": "Overall confidence in the synthesized response, calculated from individual model confidence scores (70%) plus synthesis quality factors (30%). Higher scores indicate more reliable responses.",
      "qualityScore": 0.92,
      "_qualityScoreDescription": "Response quality assessment based on content structure, length optimization, and reasoning indicators. Scores range 0-1 with higher values indicating better structured, more comprehensive responses."
    },
    "roles": [
      {
        "role": "gpt4o",
        "content": "GPT-4o response",
        "model": "gpt-4o-mini",
        "provider": "openai",
        "status": "fulfilled",
        "wordCount": 145,
        "confidence": { "score": 0.88, "level": "high" },
        "_confidenceDescription": "Individual model confidence calculated from response quality (length, structure, reasoning) and performance factors. Scores 0-1 where higher values indicate more reliable responses.",
        "_qualityDescription": "Response quality metrics including word count, sentence structure, reasoning indicators, and complexity assessment used for ensemble weighting.",
        "_metadataDescription": "Processing metrics including response time, token usage, and complexity scores that influence the model's weight in ensemble voting."
      }
    ],
    "voting": {
      "winner": "gpt4o",
      "_winnerDescription": "AI model selected as having the best response based on weighted voting algorithm considering confidence, response time, length optimization, and model reliability factors.",
      "confidence": 0.42,
      "_confidenceDescription": "Normalized weight (0-1) of the winning model's response. Higher values indicate stronger consensus that this model provided the best answer.",
      "consensus": "moderate",
      "_consensusDescription": "Strength of agreement in voting: 'strong' (winner >60% weight, >20% lead), 'moderate' (winner >45% weight), 'weak' (distributed weights). Strong consensus indicates high ensemble agreement.",
      "weights": {"gpt4o": 0.42, "gemini": 0.31, "claude": 0.27},
      "_weightsDescription": "Normalized voting weights for each model calculated from: base confidence × time performance × length optimization × model reliability. Shows relative contribution strength of each model."
    },
    "metadata": {
      "totalRoles": 3,
      "successfulRoles": 3,
      "processingTimeMs": 8500,
      "confidenceAnalysis": {
        "overallConfidence": 0.85,
        "_overallConfidenceDescription": "Final confidence score for the entire ensemble response, combining synthesis quality with voting consensus adjustments.",
        "modelAgreement": 0.78,
        "_modelAgreementDescription": "Measure of similarity between different AI model responses (0-1). Higher values indicate models provided consistent, aligned answers."
      },
      "costEstimate": {
        "totalTokens": 1250,
        "estimatedCost": "$0.0045"
      },
      "_costEstimateDescription": "Estimated API costs for this ensemble request including input/output tokens and per-model pricing. Helps track usage and optimize cost efficiency."
    }
  },
  "timestamp": "2025-06-22T10:30:00Z",
  "correlationId": "req-12345"
}
```

#### Description Fields

All ensemble response fields ending with `_*Description` provide human-readable explanations of the confidence/voting/scoring mechanisms:

- **Purpose**: Explain how each calculated value is derived and what it means
- **Impact**: Describe how the values influence ensemble performance and reliability
- **Interpretation**: Provide guidance for understanding and using the metrics
- **Backwards Compatibility**: These fields can be safely ignored by existing implementations

Examples:
- `_confidenceDescription`: Explains how confidence scores are calculated
- `_winnerDescription`: Describes the voting algorithm for selecting the best model
- `_consensusDescription`: Explains voting agreement levels and their significance
- `_weightsDescription`: Details the weighted voting calculation methodology

These descriptions help frontend developers and users understand the ensemble's decision-making process and interpret the reliability indicators.

### 2. Workout Generation

**POST** `/workout/generate-workout`

Generate personalized workout plans using AI with flexible input parameters.

**Headers:**
```
Content-Type: application/json
X-User-Id: string (optional)
```

**Request Body:**
```json
{
  "age": 28,
  "fitnessLevel": "intermediate",
  "gender": "female",
  "weight": 65,
  "goals": ["strength", "toning"],
  "equipment": ["dumbbells", "resistance_bands"],
  "injuries": ["lower_back"],
  "timeAvailable": 45,
  "daysPerWeek": 4,
  "workoutType": "Upper body strength training",
  "otherInformation": "I prefer compound movements and want to avoid overhead pressing"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "workoutId": "workout-uuid-123",
    "workout": {
      "type": "upper_body",
      "duration": 45,
      "difficulty": "intermediate",
      "equipment": ["dumbbells", "resistance_bands"],
      "exercises": [
        {
          "name": "Dumbbell Chest Press",
          "sets": 3,
          "reps": "10-12",
          "rest": "60 seconds",
          "instructions": "Lie on bench, press dumbbells up from chest level...",
          "targetMuscles": ["chest", "shoulders", "triceps"]
        }
      ],
      "warmup": [
        {
          "name": "Arm Circles",
          "duration": "2 minutes",
          "instructions": "Stand with arms extended, make circles..."
        }
      ],
      "cooldown": [
        {
          "name": "Chest Stretch",
          "duration": "1 minute",
          "instructions": "Stand in doorway, stretch chest muscles..."
        }
      ],
      "coachingTips": [
        "Focus on proper form over heavy weights",
        "Control the movement on both up and down phases"
      ]
    },
    "metadata": {
      "model": "gpt-4o",
      "provider": "openai",
      "timestamp": "2025-06-22T10:30:00Z",
      "correlationId": "workout-abc123",
      "userId": "user123"
    }
  },
  "correlationId": "workout-abc123",
  "timestamp": "2025-06-22T10:30:00Z"
}
```

### 3. Workout Completion Tracking

**POST** `/workout/workout-completion`

Record detailed workout completion data with exercise tracking and feedback.

**Headers:**
```
Content-Type: application/json
X-User-Id: string (required)
```

**Request Body:**
```json
{
  "workoutId": "workout-uuid-123",
  "completed": true,
  "completionPercentage": 95,
  "actualDuration": 42,
  "startedAt": "2025-06-22T10:00:00Z",
  "completedAt": "2025-06-22T10:42:00Z",
  "exercises": [
    {
      "name": "Dumbbell Chest Press",
      "type": "strength",
      "muscleGroups": "chest, shoulders, triceps",
      "sets": [
        {
          "setNumber": 1,
          "reps": 12,
          "weight": 25,
          "completed": true,
          "restTime": "60s"
        },
        {
          "setNumber": 2,
          "reps": 10,
          "weight": 25,
          "completed": true,
          "restTime": "60s"
        }
      ],
      "totalReps": 22,
      "totalWeight": 550,
      "completed": true,
      "difficulty": "just_right"
    }
  ],
  "feedback": {
    "rating": 4,
    "difficulty": "just_right",
    "enjoyment": 4,
    "energy": 3,
    "notes": "Great workout! Felt strong on compound movements."
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Workout completion processed successfully",
  "data": {
    "workoutId": "workout-uuid-123",
    "completed": true,
    "completionPercentage": 95,
    "exercisesTracked": 1,
    "completedExercises": 1,
    "totalWeight": 550,
    "totalReps": 22,
    "actualDuration": 42,
    "processed": true,
    "nextRecommendations": {
      "restDays": 1,
      "focusAreas": ["Similar workout style recommended"],
      "adjustments": ["Ready for increased intensity"]
    }
  },
  "correlationId": "completion-abc123",
  "timestamp": "2025-06-22T10:45:00Z"
}
```

### 4. Workout History

**GET** `/workout/workout-history`

Retrieve user's workout history with optional detailed data and analytics.

**Headers:**
```
X-User-Id: string (required)
```

**Query Parameters:**
- `limit`: number (default: 20, max: 100) - Number of workouts to retrieve
- `includeDetails`: boolean (default: false) - Include detailed exercise completion data
- `includeIncomplete`: boolean (default: false) - Include incomplete workouts

**Response:**
```json
{
  "status": "success",
  "data": {
    "workouts": [
      {
        "workoutId": "workout-uuid-123",
        "date": "2025-06-22T10:00:00Z",
        "status": "completed",
        "type": "upper_body",
        "duration": 45,
        "exercises": [
          {
            "name": "Dumbbell Chest Press",
            "sets": "3",
            "reps": "12-10",
            "type": "strength"
          }
        ],
        "rating": 4,
        "difficulty": "just_right",
        "completed": true
      }
    ],
    "stats": {
      "totalWorkouts": 15,
      "completedWorkouts": 12,
      "completionRate": 80,
      "averageRating": 4.2,
      "averageDuration": 42,
      "currentStreak": 3,
      "longestStreak": 7,
      "lastWorkout": "2025-06-22T10:00:00Z",
      "preferredWorkoutTypes": {
        "upper_body": 5,
        "full_body": 4,
        "cardio": 3
      }
    }
  },
  "correlationId": "history-abc123",
  "timestamp": "2025-06-22T10:45:00Z"
}
```

---

## Memory Management Endpoints

### Store Memory
**POST** `/memory/store`

### Retrieve Memories
**POST** `/memory/retrieve`

### Get Memory Context
**POST** `/memory/context`

### Memory Analytics
**GET** `/memory/analytics/:userId`

---

## Health & Monitoring Endpoints

### Basic Health Check
**GET** `/health`

### Detailed Health Check
**GET** `/health-detailed`

### System Metrics
**GET** `/metrics`

### Workout Service Health
**GET** `/workout/health`

### Memory System Health
**GET** `/memory/health`

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "status": "error",
  "message": "Error description",
  "correlationId": "request-id",
  "timestamp": "2025-06-22T10:30:00Z"
}
```

### Common HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

---

## Rate Limits
- 100 requests per 15 minutes per IP address
- Additional user-based limits may apply

## CORS Support
Configured for production domains including:
- `https://neurastack.ai`
- `https://neurastack-frontend.web.app`
- Development: `http://localhost:3000`, `http://localhost:3001`
- Hosting platforms: Vercel, Netlify, Firebase

---

## Model Configuration

### Free Tier (Default) - Cost Optimized
- GPT-4o-mini, Gemini 2.5 Flash, Claude 3.5 Haiku Latest
- Synthesizer: GPT-4.1-mini (73% cheaper than GPT-4o)
- Fallback: GPT-3.5-turbo for reliability
- Cost: ~$0.002-0.005 per request (40% reduction)
- Response Time: 5-15 seconds
- Rate Limits: 15 requests/hour, 100 requests/day

### Premium Tier
- GPT-4o, Gemini 2.0 Flash, Claude 3.5 Sonnet
- Cost: ~$0.05-0.15 per request
- Response Time: 8-20 seconds
