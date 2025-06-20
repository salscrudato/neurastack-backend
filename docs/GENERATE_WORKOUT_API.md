# Generate Workout API Documentation

## Overview

The Generate Workout API provides a comprehensive workout generation system with intelligent history tracking and personalized recommendations. **Only 2 API calls are needed**: one to generate the workout and one to update completion. All user memory and personalization is handled automatically in the backend.

## Key Features
- **Simplified Integration**: Only 2 API calls required
- **Automatic Memory Management**: All user history handled in backend
- **Professional Quality**: Elite personal trainer level programming
- **Frontend-Optimized Format**: Exact response structure for seamless integration

## Base URL
```
https://neurastack-backend-638289111765.us-central1.run.app
```

## Authentication
- **Header**: `X-User-Id` (optional but recommended for personalization)
- **Type**: User identifier string

---

## Endpoints

### 1. Generate Workout

**POST** `/workout/generate-workout`

Creates a personalized workout plan based on structured user parameters.

#### Request Headers
```
Content-Type: application/json
X-User-Id: string (optional)
```

#### Request Body Schema

```typescript
interface GenerateWorkoutRequest {
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  fitnessGoals: string[];
  equipment: string[];
  age: number; // 13-100
  gender: 'male' | 'female';
  weight: number; // 30-500 (lbs or kg)
  injuries: string[];
  daysPerWeek: number; // 1-7
  minutesPerSession: number; // 10-180
  workoutType: string;
}
```

#### Field Descriptions

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `fitnessLevel` | string | ✅ | User's current fitness level | `"intermediate"` |
| `fitnessGoals` | array | ✅ | Array of fitness objectives | `["weight_loss", "muscle_gain"]` |
| `equipment` | array | ✅ | Available equipment (empty for bodyweight) | `["dumbbells", "resistance_bands"]` |
| `age` | number | ✅ | User's age in years | `28` |
| `gender` | string | ✅ | User's gender | `"female"` |
| `weight` | number | ✅ | User's weight | `65` |
| `injuries` | array | ✅ | Current injuries/limitations | `["lower_back"]` |
| `daysPerWeek` | number | ✅ | Workout frequency per week | `4` |
| `minutesPerSession` | number | ✅ | Duration per workout session | `45` |
| `workoutType` | string | ✅ | Type of workout desired | `"Upper Body Strength"` |

#### Example Request

```bash
curl -X POST https://neurastack-backend-638289111765.us-central1.run.app/workout/generate-workout \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user123" \
  -d '{
    "fitnessLevel": "intermediate",
    "fitnessGoals": ["muscle_gain", "strength"],
    "equipment": ["dumbbells", "resistance_bands", "pull_up_bar"],
    "age": 28,
    "gender": "male",
    "weight": 75,
    "injuries": [],
    "daysPerWeek": 4,
    "minutesPerSession": 60,
    "workoutType": "Upper Body Push Workout"
  }'
```

#### Response Schema

```typescript
interface GenerateWorkoutResponse {
  status: 'success' | 'error';
  data?: {
    workoutId: string;
    workout: WorkoutPlan;
    metadata: WorkoutMetadata;
  };
  correlationId: string;
  timestamp: string;
  message?: string;
}

interface WorkoutPlan {
  type: string;
  duration: string;
  difficulty: string;
  equipment: string[];
  exercises: Exercise[];
  warmup: WarmupExercise[];
  cooldown: CooldownExercise[];
  notes: string;
}

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  instructions: string;
  targetMuscles: string[];
  equipment: string;
  difficulty: string;
  modifications?: {
    easier: string;
    harder: string;
  };
}
```

#### Example Response

```json
{
  "status": "success",
  "data": {
    "workoutId": "550e8400-e29b-41d4-a716-446655440000",
    "workout": {
      "type": "upper_body",
      "duration": "60 minutes",
      "difficulty": "intermediate",
      "equipment": ["dumbbells", "resistance_bands", "pull_up_bar"],
      "exercises": [
        {
          "name": "Dumbbell Bench Press",
          "sets": 3,
          "reps": "8-10",
          "rest": "60-90 seconds",
          "instructions": "Lie on bench, press dumbbells from chest to full extension",
          "targetMuscles": ["chest", "triceps", "shoulders"],
          "equipment": "dumbbells",
          "difficulty": "intermediate",
          "modifications": {
            "easier": "Reduce weight or perform incline press",
            "harder": "Increase weight or add pause at bottom"
          }
        }
      ],
      "warmup": [
        {
          "name": "Arm Circles",
          "duration": "30 seconds",
          "instructions": "Large circles forward and backward"
        }
      ],
      "cooldown": [
        {
          "name": "Chest Stretch",
          "duration": "30 seconds",
          "instructions": "Doorway stretch for chest and shoulders"
        }
      ],
      "notes": "Focus on controlled movements and proper form"
    },
    "metadata": {
      "workoutId": "550e8400-e29b-41d4-a716-446655440000",
      "correlationId": "workout-gen-1234567890-abc123",
      "personalizedFactors": {
        "historyConsidered": true,
        "adaptedForInjuries": false,
        "equipmentOptimized": true,
        "goalAligned": true
      },
      "model": "gpt-4o",
      "provider": "openai",
      "timestamp": "2025-01-20T10:30:00.000Z"
    }
  },
  "correlationId": "workout-gen-1234567890-abc123",
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

---

### 2. Complete Workout

**POST** `/workout/complete-workout`

Simple endpoint to mark workout as completed. All user learning and memory updates are handled automatically in the backend.

#### Request Body Schema

```typescript
interface CompleteWorkoutRequest {
  workoutId: string;
  completed: boolean;
  rating?: number; // 1-5 (optional)
  difficulty?: 'too_easy' | 'just_right' | 'too_hard'; // (optional)
  notes?: string; // (optional)
}
```

#### Example Request

```bash
curl -X POST https://neurastack-backend-638289111765.us-central1.run.app/workout/complete-workout \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user123" \
  -d '{
    "workoutId": "550e8400-e29b-41d4-a716-446655440000",
    "completed": true,
    "rating": 4,
    "difficulty": "just_right",
    "notes": "Great workout, felt challenging but manageable"
  }'
```

---

## API Summary

**Only 2 API calls needed:**
1. **Generate Workout** - Creates personalized workout with automatic history consideration
2. **Complete Workout** - Updates completion status with automatic learning

**All user memory is handled automatically in the backend:**
- Workout history tracking
- User preference learning
- Performance analytics
- Personalization improvements

---

## Common Fitness Goals

- `weight_loss` - Fat loss and calorie burning
- `muscle_gain` - Muscle building and hypertrophy
- `strength` - Maximal strength development
- `endurance` - Cardiovascular and muscular endurance
- `flexibility` - Mobility and flexibility improvement
- `toning` - Muscle definition and body composition
- `general_fitness` - Overall health and fitness
- `athletic_performance` - Sport-specific performance

## Common Equipment Types

- `bodyweight` - No equipment needed
- `dumbbells` - Adjustable or fixed dumbbells
- `resistance_bands` - Elastic resistance bands
- `pull_up_bar` - Pull-up/chin-up bar
- `kettlebells` - Kettlebell weights
- `barbell` - Olympic or standard barbell
- `bench` - Weight bench
- `yoga_mat` - Exercise mat
- `cardio_machine` - Treadmill, bike, etc.

## Common Injury Types

- `lower_back` - Lower back pain or injury
- `knee` - Knee pain or injury
- `shoulder` - Shoulder impingement or injury
- `neck` - Neck pain or stiffness
- `ankle` - Ankle sprain or instability
- `wrist` - Wrist pain or carpal tunnel
- `hip` - Hip pain or mobility issues
- `elbow` - Tennis/golfer's elbow

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "fitnessLevel is required",
  "workoutId": "550e8400-e29b-41d4-a716-446655440000",
  "correlationId": "workout-gen-1234567890-abc123",
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

### 503 Service Unavailable
```json
{
  "status": "error",
  "message": "Workout generation service temporarily unavailable",
  "workoutId": "550e8400-e29b-41d4-a716-446655440000",
  "correlationId": "workout-gen-1234567890-abc123",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "retryable": true
}
```

## Rate Limiting

- **Free Tier**: 10 workout generations per hour
- **Premium Tier**: 100 workout generations per hour
- **Burst Limit**: 5 requests per minute

## Best Practices

1. **Always include X-User-Id** for personalized recommendations
2. **Provide accurate user data** for better workout quality
3. **Submit feedback** to improve future recommendations
4. **Handle errors gracefully** with retry logic for 503 errors
5. **Cache workout plans** to reduce API calls
6. **Validate input parameters** before sending requests

## Integration Examples

### JavaScript/React
```javascript
const generateWorkout = async (workoutParams) => {
  try {
    const response = await fetch('/workout/generate-workout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: JSON.stringify(workoutParams)
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Workout generation failed:', error);
    throw error;
  }
};
```

### Python
```python
import requests

def generate_workout(workout_params, user_id):
    url = "https://neurastack-backend-638289111765.us-central1.run.app/workout/generate-workout"
    headers = {
        "Content-Type": "application/json",
        "X-User-Id": user_id
    }
    
    response = requests.post(url, json=workout_params, headers=headers)
    return response.json()
```
