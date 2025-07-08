# NeuraStack Backend - Frontend API Integration Guide

## Overview
This comprehensive guide provides frontend developers with everything needed to integrate with the NeuraStack Backend APIs. The system provides AI ensemble responses, personalized workout generation, and workout tracking capabilities.

## Base URLs
- **Production**: `https://neurastack-backend-638289111765.us-central1.run.app`
- **Development**: `http://localhost:8080`

## Authentication & Headers
All endpoints support optional headers for enhanced functionality:

```javascript
const headers = {
  'Content-Type': 'application/json',
  'X-User-Id': 'user-123',           // Optional: User identification for personalization
  'X-Session-Id': 'session-456',     // Optional: Session tracking
  'X-Correlation-ID': 'req-789'      // Optional: Request correlation tracking
};
```

---

## 1. AI Ensemble API

### Endpoint: `POST /default-ensemble`

**Purpose**: Get intelligent AI responses synthesized from multiple models (GPT-4o, Gemini, Claude)

#### Request Structure
```javascript
{
  "prompt": "string",        // Required: User's question/request
  "sessionId": "string"      // Optional: Session context for conversation continuity
}
```

#### Response Structure
```javascript
{
  "status": "success",
  "data": {
    "prompt": "string",                    // Echo of original prompt
    "userId": "string",                    // User ID from header
    "synthesis": {
      "content": "string",                 // Final synthesized response
      "model": "gpt-4o",                  // Model used for synthesis
      "provider": "openai",               // AI provider
      "status": "success",                // Generation status
      "confidence": {
        "score": 0.85,                    // Confidence level (0-1)
        "level": "high",                  // "low", "medium", "high"
        "factors": ["model_agreement"]    // Factors affecting confidence
      },
      "qualityScore": 0.92,              // Response quality (0-1)
      "_confidenceDescription": "string"  // Human-readable confidence explanation
    },
    "roles": [                           // Individual model responses
      {
        "role": "primary",               // Model role in ensemble
        "content": "string",             // Individual model response
        "model": "gpt-4o-mini",         // Specific model used
        "provider": "openai",           // AI provider
        "status": "success",            // Generation status
        "confidence": {
          "score": 0.88,                // Individual confidence
          "level": "high",              // Confidence level
          "factors": ["response_length"] // Confidence factors
        },
        "qualityScore": 0.90,           // Response quality
        "metadata": {
          "tokens": 150,                // Token usage
          "responseTime": 2.3           // Response time in seconds
        }
      }
    ],
    "metadata": {
      "totalRoles": 3,                   // Number of AI models used
      "successfulRoles": 3,              // Successfully responded models
      "processingTimeMs": 8500,          // Total processing time
      "confidenceAnalysis": {
        "overallConfidence": 0.85,       // Final ensemble confidence
        "modelAgreement": 0.78,          // Agreement between models (0-1)
        "_modelAgreementDescription": "Measure of similarity between AI responses"
      },
      "costEstimate": {
        "totalTokens": 1250,             // Total tokens used
        "estimatedCost": "$0.0045"       // Estimated API cost
      }
    }
  },
  "timestamp": "2025-06-22T10:30:00Z",   // Response timestamp
  "correlationId": "req-12345"           // Request correlation ID
}
```

#### Key Frontend Integration Points

**Display Primary Response**:
```javascript
const primaryResponse = response.data.synthesis.content;
const confidence = response.data.synthesis.confidence.level; // "high", "medium", "low"
```

**Show Model Comparison** (Optional):
```javascript
response.data.roles.forEach(role => {
  console.log(`${role.model}: ${role.content.substring(0, 100)}...`);
});
```

**Cost Tracking**:
```javascript
const cost = response.data.metadata.costEstimate.estimatedCost;
const tokens = response.data.metadata.costEstimate.totalTokens;
```

---

## 2. Workout Generation API

### Endpoint: `POST /workout/generate-workout`

**Purpose**: Generate personalized workout plans using AI with flexible parameters

#### Request Structure
```javascript
{
  // Required Fields
  "age": 28,                           // Number: User age (13-100)
  
  // Core Workout Parameters
  "fitnessLevel": "intermediate",      // String: "beginner", "intermediate", "advanced"
  "gender": "male",                    // String: "male", "female", or any value
  "weight": 75,                        // Number: Weight in kg or lbs
  "timeAvailable": 45,                 // Number: Session duration in minutes (10-120)
  
  // Flexible Goal & Equipment (accepts any format)
  "goals": "muscle building",          // String or Array: Free-form fitness goals
  "equipment": ["dumbbells", "bench"], // String or Array: Available equipment
  "workoutType": "Upper Body Strength", // String: Free-form workout description
  
  // Optional Parameters
  "injuries": [],                      // String or Array: Injury descriptions
  "daysPerWeek": 4,                   // Number: Weekly workout frequency
  "otherInformation": "I prefer compound movements" // String: Additional context
}
```

#### Response Structure
```javascript
{
  "status": "success",
  "data": {
    "workoutId": "workout-uuid-123",     // Unique workout identifier
    "workout": {
      "type": "upper_body",              // Generated workout type
      "duration": 45,                    // Total duration in minutes
      "difficulty": "intermediate",       // Difficulty level
      "equipment": ["dumbbells", "bench"], // Equipment used
      "mainWorkout": {
        "structure": "straight_sets",    // Workout structure type
        "exercises": [
          {
            "name": "Dumbbell Chest Press",        // Exercise name
            "category": "strength",                // Exercise category
            "sets": 3,                            // Number of sets
            "reps": "10-12",                      // Rep range or count
            "rest": "60 seconds",                 // Rest period
            "instructions": "Lie on bench...",    // Form instructions
            "targetMuscles": ["chest", "shoulders"] // Target muscle groups
          }
        ]
      },
      "warmup": [
        {
          "name": "Arm Circles",         // Warmup exercise name
          "duration": "2 minutes",       // Duration
          "instructions": "Stand with arms extended..." // Instructions
        }
      ],
      "cooldown": [
        {
          "name": "Chest Stretch",       // Cooldown exercise name
          "duration": "1 minute",        // Duration
          "instructions": "Stand in doorway..." // Instructions
        }
      ],
      "coachingTips": [                  // Array of coaching advice
        "Focus on proper form over heavy weights",
        "Control the movement on both phases"
      ]
    },
    "metadata": {
      "model": "gpt-4o-mini",           // AI model used
      "provider": "openai",             // AI provider
      "generatedAt": "2025-06-22T10:30:00Z", // Generation timestamp
      "userId": "user123",              // User identifier
      "correlationId": "workout-abc123" // Request correlation ID
    }
  },
  "correlationId": "workout-abc123",
  "timestamp": "2025-06-22T10:30:00Z"
}
```

#### Key Frontend Integration Points

**Display Workout Overview**:
```javascript
const workout = response.data.workout;
const workoutId = response.data.workoutId; // Store for completion tracking

// Basic info
const type = workout.type;
const duration = workout.duration;
const difficulty = workout.difficulty;
```

**Render Exercise List**:
```javascript
workout.mainWorkout.exercises.forEach(exercise => {
  // Display: exercise.name, exercise.sets, exercise.reps, exercise.rest
  // Show: exercise.instructions, exercise.targetMuscles
});
```

**Show Warmup/Cooldown**:
```javascript
const warmupExercises = workout.warmup;
const cooldownExercises = workout.cooldown;
```

---

## 3. Workout Completion API

### Endpoint: `POST /workout/workout-completion`

**Purpose**: Record detailed workout completion data with exercise tracking

**Required Header**: `X-User-Id` must be provided

#### Request Structure
```javascript
{
  // Basic Completion Info
  "workoutId": "workout-uuid-123",     // Required: From workout generation
  "completed": true,                   // Required: Boolean completion status
  "completionPercentage": 95,          // Optional: Percentage completed (0-100)
  "actualDuration": 42,                // Optional: Actual time spent (minutes)
  "startedAt": "2025-06-22T10:00:00Z", // Optional: Start timestamp
  "completedAt": "2025-06-22T10:42:00Z", // Optional: End timestamp
  
  // Detailed Exercise Tracking
  "exercises": [
    {
      "name": "Dumbbell Chest Press",   // Exercise name (match from workout)
      "type": "strength",               // Exercise type
      "muscleGroups": "chest, shoulders", // Target muscles
      "sets": [                         // Array of completed sets
        {
          "setNumber": 1,               // Set number
          "reps": 12,                   // Reps completed
          "weight": 25,                 // Weight used
          "completed": true,            // Set completion status
          "restTime": "60s"             // Rest time taken
        }
      ],
      "totalReps": 22,                  // Total reps for exercise
      "totalWeight": 550,               // Total weight moved
      "completed": true,                // Exercise completion status
      "difficulty": "just_right"        // Difficulty rating
    }
  ],
  
  // User Feedback
  "feedback": {
    "rating": 4,                        // Overall rating (1-5)
    "difficulty": "just_right",         // "too_easy", "just_right", "too_hard"
    "enjoyment": 4,                     // Enjoyment rating (1-5)
    "energy": 3,                        // Energy level after (1-5)
    "notes": "Great workout! Felt strong..." // Free-form notes
  }
}
```

#### Response Structure
```javascript
{
  "status": "success",
  "message": "Workout completion processed successfully",
  "data": {
    "workoutId": "workout-uuid-123",     // Workout identifier
    "completed": true,                   // Completion status
    "completionPercentage": 95,          // Completion percentage
    "exercisesTracked": 5,               // Number of exercises tracked
    "completedExercises": 5,             // Number completed
    "skippedExercises": 0,               // Number skipped
    "totalWeight": 1250,                 // Total weight moved (lbs/kg)
    "totalReps": 85,                     // Total reps completed
    "actualDuration": 42,                // Actual workout duration
    "processed": true,                   // Processing confirmation
    "nextRecommendations": {             // AI-generated recommendations
      "progressionSuggestions": ["Increase weight by 5lbs"],
      "recoveryAdvice": ["Take rest day tomorrow"],
      "nextWorkoutType": "lower_body"
    }
  },
  "correlationId": "completion-abc123",
  "timestamp": "2025-06-22T10:45:00Z"
}
```

---

## 4. Workout History API

### Endpoint: `GET /workout/workout-history`

**Purpose**: Retrieve user's workout history with analytics

**Required Header**: `X-User-Id` must be provided

#### Query Parameters
- `limit`: Number of workouts to return (default: 10, max: 50)
- `offset`: Number of workouts to skip for pagination (default: 0)

#### Response Structure
```javascript
{
  "status": "success",
  "data": {
    "workouts": [                        // Array of workout history
      {
        "workoutId": "workout-uuid-123", // Workout identifier
        "date": "2025-06-22T10:00:00Z",  // Workout date
        "status": "completed",           // "generated", "completed", "incomplete"
        "type": "upper_body",            // Workout type
        "duration": 45,                  // Planned duration
        "actualDuration": 42,            // Actual duration (if completed)
        "exercises": [                   // Exercise summary
          {
            "name": "Dumbbell Chest Press",
            "sets": "3",
            "reps": "12-10",
            "type": "strength"
          }
        ],
        "rating": 4,                     // User rating (if provided)
        "difficulty": "just_right",      // Difficulty feedback
        "completed": true                // Completion status
      }
    ],
    "stats": {                          // User workout analytics
      "totalWorkouts": 15,              // Total workouts generated
      "completedWorkouts": 12,          // Total completed
      "completionRate": 80,             // Completion percentage
      "averageRating": 4.2,             // Average workout rating
      "averageDuration": 42,            // Average actual duration
      "currentStreak": 3,               // Current completion streak
      "longestStreak": 7,               // Longest completion streak
      "lastWorkout": "2025-06-22T10:00:00Z", // Last workout date
      "preferredWorkoutTypes": {        // Workout type preferences
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

## 5. Health & Status Endpoints

### Basic Health Check: `GET /health`
```javascript
{
  "status": "healthy",
  "timestamp": "2025-06-22T10:30:00Z",
  "uptime": "2 days, 14 hours, 32 minutes"
}
```

### Detailed Health: `GET /health-detailed`
```javascript
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "ai_ensemble": "operational",
    "workout_service": "operational",
    "memory_system": "operational"
  },
  "performance": {
    "averageResponseTime": "2.3s",
    "successRate": "99.2%"
  }
}
```

---

## Error Handling

All endpoints return consistent error responses:

```javascript
{
  "status": "error",
  "message": "Descriptive error message",
  "correlationId": "request-id",
  "timestamp": "2025-06-22T10:30:00Z"
}
```

### Common HTTP Status Codes
- `200`: Success
- `400`: Bad Request (validation errors, missing required fields)
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error

### Validation Error Example
```javascript
{
  "status": "error",
  "message": "Age is required and must be between 13 and 100",
  "correlationId": "req-123",
  "timestamp": "2025-06-22T10:30:00Z"
}
```

---

## Rate Limits & Performance

- **Rate Limit**: 100 requests per 15 minutes per IP address
- **Ensemble API**: 5-15 second response time (multiple AI calls)
- **Workout API**: 10-30 second response time (AI generation)
- **History API**: <1 second response time (database query)

---

## Frontend Implementation Tips

### 1. Loading States
```javascript
// Show loading for AI endpoints (ensemble, workout generation)
const [isLoading, setIsLoading] = useState(false);

// Ensemble and workout APIs can take 10-30 seconds
const handleEnsembleRequest = async () => {
  setIsLoading(true);
  try {
    const response = await fetch('/default-ensemble', {...});
    // Handle response
  } finally {
    setIsLoading(false);
  }
};
```

### 2. Error Handling
```javascript
const handleApiError = (error) => {
  if (error.status === 429) {
    showMessage("Rate limit exceeded. Please wait before trying again.");
  } else if (error.status === 400) {
    showMessage(`Validation error: ${error.message}`);
  } else {
    showMessage("Something went wrong. Please try again.");
  }
};
```

### 3. User ID Management
```javascript
// Generate or retrieve user ID for personalization
const userId = localStorage.getItem('userId') || generateUserId();
localStorage.setItem('userId', userId);

// Include in all requests
const headers = {
  'X-User-Id': userId,
  'Content-Type': 'application/json'
};
```

### 4. Workout Flow Integration
```javascript
// 1. Generate workout
const workout = await generateWorkout(userParams);
const workoutId = workout.data.workoutId;

// 2. Store workoutId for completion tracking
localStorage.setItem('currentWorkoutId', workoutId);

// 3. During workout, track progress locally
const exerciseProgress = trackExerciseCompletion();

// 4. Submit completion when done
await submitWorkoutCompletion(workoutId, exerciseProgress);

// 5. Show history and recommendations
const history = await getWorkoutHistory();
```

---

## CORS Configuration

The backend supports requests from:
- `https://neurastack.ai`
- `https://neurastack-frontend.web.app`
- `http://localhost:3000` (development)
- `http://localhost:3001` (development)
- Vercel, Netlify, and Firebase hosting domains

---

## Model Configuration & Costs

### Free Tier (Default)
- **Models**: GPT-4o-mini, Gemini 2.5 Flash, Claude 3.5 Haiku
- **Cost**: ~$0.002-0.005 per ensemble request
- **Performance**: Optimized for cost efficiency

### Premium Tier
- **Models**: GPT-4o, Gemini 2.0 Flash, Claude 3.5 Sonnet
- **Cost**: ~$0.05-0.15 per ensemble request
- **Performance**: Maximum quality responses

---

This guide provides everything needed to integrate with the NeuraStack Backend APIs. For additional support or questions, refer to the API documentation or contact the development team.
```
