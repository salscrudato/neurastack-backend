# Workout History API Documentation

## Overview

The NeuraStack Workout History system provides comprehensive tracking of workout completion data, including detailed exercise performance, sets, reps, weights, and user feedback. This enables rich analytics and personalized workout recommendations.

## Key Features

- **Detailed Exercise Tracking**: Sets, reps, weights, duration, and completion status
- **Comprehensive Feedback**: Rating, difficulty, enjoyment, energy levels
- **Clean History API**: Structured data optimized for frontend consumption
- **Automatic Analytics**: User statistics and progress tracking
- **Flexible Queries**: Include/exclude incomplete workouts and detailed data

---

## Endpoints

### 1. Record Workout Completion

**POST** `/workout/workout-completion`

Records detailed workout completion data including exercise performance and user feedback.

**Headers:**
- `Content-Type: application/json`
- `X-User-Id: string` (required) - User identifier

**Request Body:**
```typescript
interface WorkoutCompletionRequest {
  workoutId: string;                    // Required: Workout ID from generation
  completed: boolean;                   // Required: Whether workout was completed
  completionPercentage?: number;        // 0-100, defaults to 100 if completed
  actualDuration?: number;              // Actual workout duration in minutes
  startedAt?: string;                   // ISO timestamp when workout started
  completedAt?: string;                 // ISO timestamp when workout finished
  exercises: CompletedExercise[];       // Required: Array of exercise data
  rating?: number;                      // 1-5 overall workout rating
  difficulty?: string;                  // 'too_easy', 'just_right', 'too_hard'
  enjoyment?: number;                   // 1-5 enjoyment rating
  energy?: number;                      // 1-5 energy level after workout
  notes?: string;                       // General workout notes
  injuries?: string[];                  // Any injuries that occurred
  environment?: object;                 // Workout environment details
}

interface CompletedExercise {
  name: string;                         // Exercise name
  type?: string;                        // 'strength', 'cardio', 'flexibility'
  muscleGroups?: string;                // Primary muscle groups
  sets: ExerciseSet[];                  // Array of sets performed
  totalReps?: number;                   // Total reps across all sets
  totalWeight?: number;                 // Total weight lifted
  totalDuration?: number;               // Total exercise duration in seconds
  completed?: boolean;                  // Whether exercise was completed
  difficulty?: string;                  // Exercise-specific difficulty
  notes?: string;                       // Exercise-specific notes
}

interface ExerciseSet {
  setNumber: number;                    // Set number (1, 2, 3, etc.)
  reps?: number;                        // Repetitions completed
  weight?: number;                      // Weight used (kg or lbs)
  duration?: number;                    // Duration in seconds (for time-based)
  distance?: number;                    // Distance (for cardio)
  restTime?: string;                    // Rest time after set (e.g., "60s")
  completed?: boolean;                  // Whether this set was completed
  notes?: string;                       // Set-specific notes
}
```

**Example Request:**
```json
{
  "workoutId": "workout-123-abc",
  "completed": true,
  "completionPercentage": 95,
  "actualDuration": 42,
  "startedAt": "2025-01-21T10:00:00Z",
  "completedAt": "2025-01-21T10:42:00Z",
  "exercises": [
    {
      "name": "Push-ups",
      "type": "strength",
      "muscleGroups": "chest, shoulders, triceps",
      "sets": [
        {
          "setNumber": 1,
          "reps": 12,
          "weight": 0,
          "completed": true,
          "restTime": "60s"
        },
        {
          "setNumber": 2,
          "reps": 10,
          "weight": 0,
          "completed": true,
          "restTime": "60s"
        }
      ],
      "totalReps": 22,
      "totalWeight": 0,
      "completed": true,
      "difficulty": "just_right",
      "notes": "Good form maintained"
    },
    {
      "name": "Dumbbell Rows",
      "type": "strength",
      "muscleGroups": "back, biceps",
      "sets": [
        {
          "setNumber": 1,
          "reps": 12,
          "weight": 15,
          "completed": true,
          "restTime": "60s"
        }
      ],
      "totalReps": 12,
      "totalWeight": 180,
      "completed": true,
      "difficulty": "just_right"
    }
  ],
  "rating": 4,
  "difficulty": "just_right",
  "enjoyment": 4,
  "energy": 3,
  "notes": "Great workout! Felt strong on compound movements.",
  "injuries": [],
  "environment": {
    "location": "home_gym",
    "temperature": "comfortable"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Workout completion data saved successfully",
  "data": {
    "workoutId": "workout-123-abc",
    "completed": true,
    "completionPercentage": 95,
    "exercisesTracked": 2,
    "processed": true
  },
  "correlationId": "completion-123...",
  "timestamp": "2025-01-21T10:45:00Z"
}
```

---

### 2. Get Workout History

**GET** `/workout/workout-history`

Retrieves user's workout history with optional detailed exercise data and analytics.

**Headers:**
- `X-User-Id: string` (required) - User identifier

**Query Parameters:**
- `limit?: number` - Number of workouts to retrieve (default: 20, max: 100)
- `includeDetails?: boolean` - Include detailed exercise completion data (default: false)
- `includeIncomplete?: boolean` - Include incomplete/skipped workouts (default: false)
- `userId?: string` - Alternative to X-User-Id header

**Example Request:**
```bash
GET /workout/workout-history?limit=10&includeDetails=true&includeIncomplete=false
X-User-Id: user-123
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "workouts": [
      {
        "workoutId": "workout-123-abc",
        "date": "2025-01-21T10:00:00Z",
        "status": "completed",
        "type": "Upper body strength",
        "duration": 45,
        "exercises": [
          {
            "name": "Push-ups",
            "sets": "3",
            "reps": "12-10-8",
            "type": "strength"
          }
        ],
        "rating": 4,
        "difficulty": "just_right",
        "completed": true,
        "completionDetails": {
          "actualDuration": 42,
          "completionPercentage": 95,
          "exerciseDetails": [...],
          "enjoyment": 4,
          "energy": 3,
          "notes": "Great workout!",
          "injuries": []
        }
      }
    ],
    "stats": {
      "totalWorkouts": 15,
      "completedWorkouts": 12,
      "completionRate": 80,
      "averageRating": 4.2,
      "averageDuration": 38,
      "currentStreak": 3,
      "longestStreak": 7,
      "lastWorkout": "2025-01-21T10:00:00Z",
      "preferredWorkoutTypes": {
        "strength": 8,
        "cardio": 4,
        "flexibility": 3
      },
      "goalProgress": {
        "strength": 75,
        "endurance": 60
      }
    },
    "metadata": {
      "totalRecords": 1,
      "includeDetails": true,
      "includeIncomplete": false,
      "generatedAt": "2025-01-21T10:45:00Z"
    }
  },
  "correlationId": "history-123...",
  "timestamp": "2025-01-21T10:45:00Z"
}
```

---

## Data Storage

The system stores data in the following Firestore collections:

- **`workouts`** - Generated workout plans
- **`workout_completions`** - Detailed completion data with exercise tracking
- **`workout_feedback`** - Simple feedback (legacy, maintained for compatibility)
- **`workout_stats`** - Calculated user statistics
- **`workout_evolution`** - User progression and adaptation data

---

## Integration Guide

### Frontend Integration

1. **Generate Workout**: Use existing `/workout/generate-workout` endpoint
2. **Track Completion**: Send detailed data to `/workout/workout-completion`
3. **Display History**: Fetch from `/workout/workout-history` with appropriate parameters
4. **Show Analytics**: Use the `stats` object from history response

### Recommended Workflow

```javascript
// 1. Generate workout
const workout = await generateWorkout(userPreferences);

// 2. User completes workout (track in your UI)
const completionData = {
  workoutId: workout.workoutId,
  completed: true,
  exercises: exerciseTrackingData,
  rating: userRating,
  // ... other completion data
};

// 3. Submit completion
await submitWorkoutCompletion(completionData);

// 4. Refresh history
const history = await getWorkoutHistory({ includeDetails: true });
```

---

## Benefits

- **Rich Analytics**: Track progress over time with detailed metrics
- **Personalization**: AI can use completion data for better recommendations
- **User Engagement**: Detailed tracking increases motivation and adherence
- **Scalable**: Clean separation between generation and completion data
- **Flexible**: Support for various exercise types and tracking methods
