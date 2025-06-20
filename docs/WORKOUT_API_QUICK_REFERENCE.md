# Workout API Quick Reference

## Endpoint
```
POST https://neurastack-backend-638289111765.us-central1.run.app/workout
```

## Minimal Request
```javascript
{
  "userMetadata": {
    "age": 25,
    "fitnessLevel": "intermediate"
  },
  "workoutRequest": "Create a 30-minute strength workout"
}
```

## Complete Request
```javascript
{
  "userMetadata": {
    "age": 25,
    "fitnessLevel": "intermediate",
    "equipment": ["dumbbells", "resistance_bands"],
    "timeAvailable": 45,
    "goals": ["build_muscle", "lose_weight"],
    "injuries": []
  },
  "workoutSpecification": {
    "workoutType": "strength",
    "duration": 45,
    "difficulty": "intermediate",
    "focusAreas": ["chest", "triceps"]
  },
  "workoutHistory": [],
  "additionalNotes": "Focus on compound movements",
  "workoutRequest": "45-minute upper body strength workout"
}
```

## Workout Types
### Common Types (Optimized)
- `strength` - Weight training
- `cardio` - Cardiovascular exercise
- `flexibility` - Stretching/mobility
- `hiit` - High-intensity intervals
- `yoga` - Yoga poses
- `pilates` - Pilates exercises
- `pull` - Pulling movements
- `push` - Pushing movements
- `legs` - Lower body
- `upper` - Upper body
- `full_body` - Full body
- `core` - Core strengthening

### Custom Types (Flexible)
**Any string accepted**: `swimming`, `rock_climbing`, `dance`, `martial_arts`, `cycling`, `running`, `tennis`, `basketball`, `soccer`, `gymnastics`, etc.

## Fitness Levels
### Common Levels (Optimized)
- `beginner` - New to exercise
- `intermediate` - Regular exerciser
- `advanced` - Experienced athlete

### Custom Levels (Flexible)
**Any string accepted**: `expert`, `professional`, `elite`, `novice`, `recreational`, etc.

## Common Equipment
- `dumbbells` - Adjustable weights
- `barbell` - Olympic barbell
- `resistance_bands` - Elastic bands
- `kettlebell` - Kettlebell weights
- `pull_up_bar` - Pull-up bar
- `yoga_mat` - Exercise mat
- `medicine_ball` - Weighted ball
- `cable_machine` - Cable system
- `bodyweight` - No equipment needed

## Response Structure
```javascript
{
  "status": "success",
  "data": {
    "workout": {
      "type": "strength",
      "duration": "45 minutes",
      "difficulty": "intermediate",
      "equipment": ["dumbbells"],
      "exercises": [
        {
          "name": "Push-ups",
          "category": "strength",
          "sets": 3,
          "reps": "10-12",
          "rest": "60 seconds",
          "instructions": "...",
          "modifications": "...",
          "targetMuscles": ["chest", "triceps"]
        }
      ],
      "warmup": [...],
      "cooldown": [...],
      "notes": "..."
    },
    "metadata": {
      "model": "gpt-4o-mini",
      "provider": "openai",
      "timestamp": "2025-01-15T10:30:00Z",
      "correlationId": "abc123",
      "userId": "user123"
    }
  }
}
```

## Error Codes
- `400` - Bad request (invalid data)
- `429` - Rate limit exceeded
- `503` - Service unavailable (retry)
- `500` - Internal server error

## Headers
```javascript
{
  "Content-Type": "application/json",
  "X-User-ID": "user123" // Optional
}
```

## Rate Limits
- **Free**: 5 req/min, 1 burst
- **Premium**: 50 req/min, 10 burst
- **Enterprise**: 500 req/min, 100 burst

## Timeouts
- Set client timeout to 60+ seconds
- API processes complex requests up to 45 seconds
- Use loading states for better UX

## Best Practices
1. ✅ Use structured `workoutSpecification`
2. ✅ Keep `additionalNotes` under 500 chars
3. ✅ Implement retry logic for 503 errors
4. ✅ Cache responses to reduce API calls
5. ✅ Show loading states (requests can take 15-45s)
6. ❌ Don't make concurrent requests
7. ❌ Don't send overly long descriptions

## Health Check
```javascript
GET /workout/health
// Returns: { "status": "healthy", "model": "gpt-4o-mini" }
```

## Custom Workout Examples

### Swimming Workout
```javascript
{
  "userMetadata": {
    "age": 28,
    "fitnessLevel": "expert",
    "equipment": ["swimming_pool"],
    "goals": ["endurance", "technique_improvement"]
  },
  "workoutSpecification": {
    "workoutType": "swimming",
    "duration": 60,
    "difficulty": "expert",
    "focusAreas": ["freestyle", "technique", "endurance"]
  },
  "workoutRequest": "Create a swimming workout for expert level"
}
```

### Rock Climbing Workout
```javascript
{
  "userMetadata": {
    "age": 35,
    "fitnessLevel": "professional",
    "equipment": ["rock_climbing_wall", "harness", "climbing_shoes"],
    "goals": ["technique_improvement", "strength_building"]
  },
  "workoutSpecification": {
    "workoutType": "rock_climbing",
    "duration": 90,
    "difficulty": "professional",
    "focusAreas": ["grip_strength", "technique", "endurance"]
  },
  "workoutRequest": "Create a rock climbing workout for professional level"
}
```

## Example Implementation
```javascript
async function generateWorkout(request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch('/workout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': getCurrentUserId()
      },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 503 && error.retryable) {
        // Retry after 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        return generateWorkout(request);
      }
      throw new Error(error.message);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Common Issues & Solutions

### 503 Service Unavailable
- **Cause**: Complex request taking too long
- **Solution**: Retry after 2-3 seconds, simplify request

### 429 Rate Limited
- **Cause**: Too many requests
- **Solution**: Implement exponential backoff

### Long Response Times
- **Cause**: Complex AI processing
- **Solution**: Show progress indicators, set 60s timeout

### Request Too Large
- **Cause**: Very long additionalNotes or descriptions
- **Solution**: Limit text fields, use structured format
