# Flexible Workout API Documentation

## Overview

The Flexible Workout API uses a two-stage AI approach to generate personalized workouts:
1. **Stage 1**: Low-cost AI crafts optimized prompts from user data
2. **Stage 2**: High-quality AI generates professional workouts

This approach provides maximum flexibility while maintaining cost efficiency and workout quality.

## Base URL
```
https://neurastack-backend-638289111765.us-central1.run.app
```

## Authentication
- Optional: Include `X-User-Id` header for personalized workout history
- No API key required for basic usage

---

## Generate Workout

**Endpoint**: `POST /workout/generate-workout`

### Request Headers
```
Content-Type: application/json
X-User-Id: string (optional) - User identifier for history tracking
```

### Request Body
```json
{
  "age": 25,                           // Required: 13-100
  "fitnessLevel": "intermediate",      // Required: any string (e.g., "beginner", "intermediate", "expert")
  "gender": "female",                  // Optional: any string
  "weight": 65,                        // Optional: number in kg/lbs
  "goals": "Lose Weight and Build Muscle", // Flexible: string or array
  "equipment": ["dumbbells", "yoga mat"],  // Flexible: string or array
  "injuries": "lower back issues",     // Flexible: string or array
  "timeAvailable": 45,                 // Optional: minutes (10-120)
  "daysPerWeek": 4,                    // Optional: 1-7
  "workoutType": "HIIT Strength Training", // Optional: any string
  "otherInformation": "I prefer high-intensity workouts and want to focus on functional movements" // Optional: free-form text
}
```

### Key Features
- **Flexible Categories**: Goals, equipment, and injuries accept both strings and arrays
- **Free-form Text**: `otherInformation` field for any additional context
- **No Strict Validation**: Categories like goals can be "Lose Weight" instead of coded values
- **Intelligent Processing**: AI understands natural language descriptions

### Response
```json
{
  "status": "success",
  "data": {
    "workoutId": "uuid-string",
    "workout": {
      "type": "HIIT Strength Training",
      "duration": 45,
      "difficulty": "intermediate",
      "equipment": ["dumbbells", "yoga mat"],
      "targetMuscles": ["full_body"],
      "calorieEstimate": 350,
      "exercises": [
        {
          "name": "Dumbbell Squats",
          "sets": 3,
          "reps": "12-15",
          "rest": "60 seconds",
          "instructions": "Stand with feet shoulder-width apart, hold dumbbells at shoulders...",
          "modifications": "Use lighter weight or bodyweight only",
          "targetMuscles": ["quadriceps", "glutes", "core"]
        }
      ],
      "warmup": [
        {
          "name": "Dynamic Stretching",
          "duration": "5 minutes",
          "instructions": "Arm circles, leg swings, torso twists"
        }
      ],
      "cooldown": [
        {
          "name": "Static Stretching",
          "duration": "5 minutes",
          "instructions": "Hold stretches for 30 seconds each"
        }
      ],
      "coachingTips": [
        "Focus on proper form over speed",
        "Breathe consistently throughout each exercise",
        "Adjust weights based on your strength level"
      ],
      "progressionNotes": "Increase weight by 5-10% when you can complete all reps easily",
      "safetyNotes": "Stop immediately if you feel sharp pain"
    },
    "metadata": {
      "model": "gpt-4o",
      "provider": "openai",
      "timestamp": "2025-01-21T10:30:00Z",
      "correlationId": "workout-123...",
      "userId": "user123",
      "approach": "two_stage_flexible",
      "promptCraftingModel": "gpt-4o-mini"
    }
  },
  "correlationId": "workout-123...",
  "timestamp": "2025-01-21T10:30:00Z"
}
```

---

## Complete Workout

**Endpoint**: `POST /workout/complete-workout`

### Request Body
```json
{
  "workoutId": "uuid-from-generate-response",
  "completed": true,
  "rating": 4,                    // Optional: 1-5
  "difficulty": "just_right",     // Optional: "too_easy", "just_right", "too_hard"
  "notes": "Great workout!"       // Optional: free-form feedback
}
```

### Response
```json
{
  "status": "success",
  "message": "Workout completion updated successfully",
  "data": {
    "workoutId": "uuid-string",
    "completed": true,
    "processed": true
  },
  "correlationId": "feedback-123...",
  "timestamp": "2025-01-21T10:45:00Z"
}
```

---

## Error Handling

### Error Response Format
```json
{
  "status": "error",
  "message": "Error description",
  "correlationId": "request-id",
  "timestamp": "2025-01-21T10:30:00Z"
}
```

### Common Error Codes
- `400`: Invalid request (e.g., age out of range)
- `500`: Server error (AI generation failed)

---

## Implementation Examples

### Basic Workout Request
```javascript
const response = await fetch('/workout/generate-workout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': 'user123'
  },
  body: JSON.stringify({
    age: 30,
    fitnessLevel: 'intermediate',
    goals: 'Build Strength',
    timeAvailable: 30
  })
});

const data = await response.json();
console.log(data.data.workout);
```

### Advanced Workout Request
```javascript
const workoutRequest = {
  age: 28,
  fitnessLevel: 'advanced',
  gender: 'male',
  weight: 80,
  goals: ['Muscle Gain', 'Athletic Performance'],
  equipment: 'Full gym access with barbells, dumbbells, and machines',
  injuries: 'Previous shoulder injury - avoid overhead pressing',
  timeAvailable: 60,
  daysPerWeek: 5,
  workoutType: 'Push Day - Chest, Shoulders, Triceps',
  otherInformation: 'I compete in powerlifting and need to focus on progressive overload. I prefer compound movements and can handle high intensity.'
};

const response = await fetch('/workout/generate-workout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': 'powerlifter123'
  },
  body: JSON.stringify(workoutRequest)
});
```

---

## Key Benefits

1. **Maximum Flexibility**: Accept any format for goals, equipment, injuries
2. **Natural Language**: Users can describe needs in plain English
3. **Cost Efficient**: Two-stage approach optimizes AI usage costs
4. **Professional Quality**: High-quality AI generates expert-level workouts
5. **Automatic History**: Backend handles all user memory and personalization
6. **Fallback Support**: Graceful degradation if AI services fail

---

## Migration from Previous API

If migrating from structured APIs, simply:
1. Change field names: `minutesPerSession` → `timeAvailable`
2. Use natural language: `goals: ['weight_loss']` → `goals: 'Lose Weight'`
3. Add `otherInformation` field for additional context
4. Remove strict validation - API handles flexible input

The new API is backward compatible with structured input while supporting much more flexible usage patterns.
