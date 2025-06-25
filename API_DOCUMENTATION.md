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
      "qualityScore": 0.92
    },
    "roles": [
      {
        "role": "gpt4o",
        "content": "GPT-4o response",
        "model": "gpt-4o-mini",
        "provider": "openai",
        "status": "fulfilled",
        "wordCount": 145,
        "confidence": { "score": 0.88, "level": "high" }
      }
    ],
    "metadata": {
      "totalRoles": 3,
      "successfulRoles": 3,
      "processingTimeMs": 8500,
      "costEstimate": {
        "totalTokens": 1250,
        "estimatedCost": "$0.0045"
      }
    }
  },
  "timestamp": "2025-06-22T10:30:00Z",
  "correlationId": "req-12345"
}
```

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
