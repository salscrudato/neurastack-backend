# Workout API Frontend Implementation Guide

## Quick Start

### Basic Request
```javascript
const response = await fetch('https://neurastack-backend-638289111765.us-central1.run.app/workout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': userId || 'anonymous'
  },
  body: JSON.stringify({
    userMetadata: {
      age: 25,
      fitnessLevel: 'intermediate', // 'beginner', 'intermediate', 'advanced'
      gender: 'male',
      weight: 70,
      goals: ['lose_weight', 'build_muscle'],
      equipment: ['dumbbells', 'resistance_bands'],
      timeAvailable: 30,
      injuries: [],
      daysPerWeek: 4,
      minutesPerSession: 30
    },
    workoutHistory: [], // Optional: previous workouts
    workoutRequest: 'Create a 30-minute strength workout for intermediate level'
  })
});

const data = await response.json();
```

## Request Structure

### Required Fields
```typescript
interface WorkoutRequest {
  userMetadata: {
    age: number;                    // 13-100
    fitnessLevel: string;          // Any string: 'beginner', 'intermediate', 'advanced', 'expert', 'professional', etc.
    gender?: string;               // Optional
    weight?: number;               // Optional
    goals?: string[];              // Optional: Any goals as strings
    equipment?: string[];          // Optional: Any equipment as strings
    timeAvailable?: number;        // Minutes available
    injuries?: string[];           // Optional: injury considerations
    daysPerWeek?: number;         // Optional: workout frequency
    minutesPerSession?: number;    // Optional: session duration
  };
  workoutHistory?: WorkoutPlan[];  // Optional: previous workouts
  workoutRequest: string;          // Natural language workout description
}
```

### Enhanced Format (Recommended)
```typescript
interface EnhancedWorkoutRequest {
  userMetadata: UserMetadata;      // Same as above
  workoutHistory?: WorkoutPlan[];
  workoutSpecification: {
    workoutType: string;           // Any workout type: 'strength', 'swimming', 'rock_climbing', etc.
    duration: number;              // Minutes
    difficulty: string;            // Any difficulty level: 'beginner', 'expert', 'professional', etc.
    focusAreas?: string[];         // Any focus areas as strings
    equipment?: string[];          // Any equipment as strings
  };
  additionalNotes?: string;        // Extra requirements
  workoutRequest: string;          // Fallback description
  requestId?: string;              // Optional: for tracking
  timestamp?: string;              // Optional: ISO timestamp
  sessionContext?: string;         // Optional: session identifier
  correlationId?: string;          // Optional: request correlation
}
```

## Workout Types

### Common Types (Optimized)
- `strength` - Weight training and resistance exercises
- `cardio` - Cardiovascular and aerobic exercises
- `flexibility` - Stretching and mobility work
- `hiit` - High-intensity interval training
- `yoga` - Yoga poses and flows
- `pilates` - Pilates exercises
- `crossfit` - CrossFit-style workouts
- `pull` - Pulling movements (back, biceps)
- `push` - Pushing movements (chest, shoulders, triceps)
- `legs` - Lower body focused
- `upper` - Upper body focused
- `lower` - Lower body focused
- `full_body` - Full body workout
- `core` - Core strengthening
- `functional` - Functional movement patterns
- `mixed` - Combination workout

### Custom Types (Flexible)
The API now accepts **any workout type** as a string. Examples:
- `swimming` - Swimming workouts
- `rock_climbing` - Rock climbing training
- `dance` - Dance fitness
- `martial_arts` - Martial arts training
- `cycling` - Cycling workouts
- `running` - Running programs
- `tennis` - Tennis training
- `basketball` - Basketball drills
- `soccer` - Soccer training
- `gymnastics` - Gymnastics routines

**Note**: Common types have optimized prompts, but custom types work equally well.

## Response Structure

```typescript
interface WorkoutResponse {
  status: 'success';
  data: {
    workout: {
      type: string;
      duration: string;
      difficulty: string;
      equipment: string[];
      exercises: Exercise[];
      warmup: WarmupExercise[];
      cooldown: CooldownExercise[];
      notes: string;
      calorieEstimate: string;
      tags: string[];
    };
    metadata: {
      model: string;
      provider: string;
      timestamp: string;
      correlationId: string;
      userId: string;
    };
  };
  correlationId: string;
  timestamp: string;
}

interface Exercise {
  name: string;
  category: string;
  sets: number;
  reps: string;
  rest: string;
  instructions: string;
  modifications: string;
  targetMuscles: string[];
}
```

## Error Handling

### Common Error Responses
```typescript
interface ErrorResponse {
  status: 'error';
  message: string;
  timestamp: string;
  correlationId: string;
  retryable?: boolean;
  supportInfo?: {
    correlationId: string;
    timestamp: string;
    suggestion: string;
  };
}
```

### Error Codes
- `400` - Invalid request data
- `429` - Rate limit exceeded
- `503` - Service temporarily unavailable
- `500` - Internal server error

### Implementation Example
```javascript
async function generateWorkout(requestData) {
  try {
    const response = await fetch('/workout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': getCurrentUserId()
      },
      body: JSON.stringify(requestData),
      timeout: 60000 // 60 second timeout
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 503 && error.retryable) {
        // Retry after delay for temporary issues
        await new Promise(resolve => setTimeout(resolve, 2000));
        return generateWorkout(requestData);
      }
      
      throw new Error(error.message || 'Workout generation failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Workout API Error:', error);
    throw error;
  }
}
```

## Best Practices

### 1. Request Optimization
```javascript
// ✅ Good: Structured request
const request = {
  userMetadata: {
    age: 30,
    fitnessLevel: 'intermediate',
    equipment: ['dumbbells', 'resistance_bands'],
    timeAvailable: 45
  },
  workoutSpecification: {
    workoutType: 'strength',
    duration: 45,
    difficulty: 'intermediate',
    focusAreas: ['chest', 'triceps']
  },
  workoutRequest: 'Create a 45-minute upper body strength workout'
};

// ❌ Avoid: Overly complex requests
const badRequest = {
  userMetadata: { /* minimal data */ },
  additionalNotes: 'Very long detailed requirements that create huge prompts...' // Too verbose
};
```

### 2. Timeout Handling
```javascript
// Set appropriate timeouts for complex requests
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000);

try {
  const response = await fetch('/workout', {
    method: 'POST',
    signal: controller.signal,
    // ... other options
  });
} finally {
  clearTimeout(timeoutId);
}
```

### 3. Caching Strategy
```javascript
// Cache workouts to reduce API calls
const cacheKey = `workout_${JSON.stringify(requestData)}`;
const cached = localStorage.getItem(cacheKey);

if (cached && Date.now() - JSON.parse(cached).timestamp < 3600000) {
  return JSON.parse(cached).data; // Use cached if < 1 hour old
}

const workout = await generateWorkout(requestData);
localStorage.setItem(cacheKey, JSON.stringify({
  data: workout,
  timestamp: Date.now()
}));
```

### 4. User Experience
```javascript
// Show loading states for better UX
function WorkoutGenerator() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateWorkout = async () => {
    setLoading(true);
    setProgress(0);

    // Simulate progress for long requests
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 2000);

    try {
      const workout = await api.generateWorkout(requestData);
      setProgress(100);
      return workout;
    } finally {
      clearInterval(progressInterval);
      setLoading(false);
    }
  };
}
```

## Health Check

```javascript
// Check API health before making requests
const healthCheck = await fetch('/workout/health');
const health = await healthCheck.json();

if (health.status !== 'healthy') {
  // Show maintenance message or fallback
  console.warn('Workout service unavailable');
}
```

## Rate Limits

- **Free Tier**: 5 requests/minute, 1 burst
- **Premium Tier**: 50 requests/minute, 10 burst
- **Enterprise Tier**: 500 requests/minute, 100 burst

Implement exponential backoff for rate limit errors:

```javascript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429 && i < maxRetries - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
        continue;
      }
      throw error;
    }
  }
}
```

## Quick Examples

### Simple Strength Workout
```javascript
const strengthWorkout = await generateWorkout({
  userMetadata: {
    age: 28,
    fitnessLevel: 'intermediate',
    equipment: ['dumbbells', 'barbell'],
    timeAvailable: 45
  },
  workoutRequest: 'Create a 45-minute strength training workout focusing on compound movements'
});
```

### HIIT Cardio Session
```javascript
const hiitWorkout = await generateWorkout({
  userMetadata: {
    age: 32,
    fitnessLevel: 'advanced',
    equipment: [],
    timeAvailable: 20
  },
  workoutSpecification: {
    workoutType: 'hiit',
    duration: 20,
    difficulty: 'advanced',
    focusAreas: ['cardio', 'fat_burning']
  },
  workoutRequest: 'High-intensity bodyweight HIIT workout'
});
```

## Enhanced Type Consistency & Debugging

The workout API now includes enhanced type consistency checking and debugging information to help frontend developers handle workout type mismatches.

### Type Consistency Features

1. **Automatic Type Correction**: When you specify a `workoutType`, the API ensures the response matches exactly
2. **Original Type Preservation**: The AI's original type suggestion is preserved for reference
3. **Debug Information**: Comprehensive debugging data is included in the response

### Response Structure with Debug Info

```javascript
{
  "status": "success",
  "data": {
    "workout": {
      "type": "upper_body",           // Guaranteed to match your request
      "originalType": "pull",         // What the AI originally suggested
      "typeConsistency": {
        "requested": "upper_body",
        "aiGenerated": "pull",
        "final": "upper_body",
        "wasAdjusted": true
      },
      // ... rest of workout data
    },
    "metadata": {
      "debug": {
        "requestFormat": "object",
        "isEnhancedFormat": true,
        "parsedWorkoutType": "upper_body",
        "typeConsistency": { /* consistency info */ },
        "supportedWorkoutTypes": [
          "pilates", "crossfit", "yoga", "pull_day", "push_day",
          "leg_day", "upper_body", "lower_body", "full_body",
          "core", "functional", "hiit", "cardio", "flexibility",
          "strength", "mixed"
        ]
      }
    }
  }
}
```

### Supported Workout Types

The API supports comprehensive workout type matching:

- **Primary Types**: `upper_body`, `lower_body`, `full_body`, `leg_day`, `push_day`, `pull_day`
- **Specialty Types**: `pilates`, `crossfit`, `yoga`, `hiit`, `cardio`, `strength`, `flexibility`
- **Focus Types**: `core`, `functional`, `mixed`
- **Legacy Support**: `upper`, `lower`, `legs`, `push`, `pull` (automatically mapped to modern equivalents)
```

### Flexibility/Recovery Session
```javascript
const flexibilityWorkout = await generateWorkout({
  userMetadata: {
    age: 35,
    fitnessLevel: 'beginner',
    injuries: ['lower_back'],
    timeAvailable: 30
  },
  workoutSpecification: {
    workoutType: 'flexibility',
    duration: 30,
    difficulty: 'beginner'
  },
  additionalNotes: 'Focus on gentle stretching, avoid aggravating lower back injury',
  workoutRequest: 'Gentle flexibility workout safe for lower back issues'
});
```

## Performance Tips

### 1. Request Size Optimization
- Keep `additionalNotes` under 500 characters
- Limit `focusAreas` to 3-5 items
- Use structured `workoutSpecification` over long text descriptions

### 2. Concurrent Requests
```javascript
// ❌ Don't make multiple simultaneous requests
const workouts = await Promise.all([
  generateWorkout(request1),
  generateWorkout(request2),
  generateWorkout(request3)
]); // This may hit rate limits

// ✅ Queue requests with delays
async function generateMultipleWorkouts(requests) {
  const results = [];
  for (const request of requests) {
    results.push(await generateWorkout(request));
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
  }
  return results;
}
```

### 3. Error Recovery
```javascript
class WorkoutAPIClient {
  async generateWorkout(request, options = {}) {
    const { maxRetries = 2, retryDelay = 1000 } = options;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest(request);
      } catch (error) {
        if (attempt === maxRetries) throw error;

        if (error.status === 503 && error.retryable) {
          await this.delay(retryDelay * Math.pow(2, attempt));
          continue;
        }

        throw error; // Don't retry non-retryable errors
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Integration Examples

### React Hook
```javascript
import { useState, useCallback } from 'react';

export function useWorkoutGenerator() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workout, setWorkout] = useState(null);

  const generateWorkout = useCallback(async (request) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setWorkout(data.data.workout);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateWorkout, loading, error, workout };
}
```

### Vue Composable
```javascript
import { ref, computed } from 'vue';

export function useWorkoutAPI() {
  const loading = ref(false);
  const error = ref(null);
  const workout = ref(null);

  const isReady = computed(() => !loading.value && !error.value);

  async function generateWorkout(request) {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch('/workout', {
        method: 'POST',
        body: request
      });

      workout.value = response.data.workout;
      return response;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    generateWorkout,
    loading: readonly(loading),
    error: readonly(error),
    workout: readonly(workout),
    isReady
  };
}
```
