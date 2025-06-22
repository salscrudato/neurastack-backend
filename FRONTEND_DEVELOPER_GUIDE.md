# NeuraStack Workout API - Frontend Developer Guide

## Overview
This guide provides comprehensive integration instructions for the NeuraStack Workout API, optimized for maximum response quality with minimal UI changes.

## API Endpoints

### 1. Generate Workout
**Endpoint:** `POST /api/workout/generate`

**Headers:**
```
Content-Type: application/json
X-User-Id: string (required)
X-Correlation-ID: string (optional)
```

**Request Body Structure:**
```json
{
  "age": number,                    // Required: 13-100
  "gender": string,                 // Optional: "male", "female", "other"
  "weight": number,                 // Optional: in lbs or kg
  "fitnessLevel": string,           // Required: "beginner", "intermediate", "advanced"
  "equipment": string[],            // Optional: ["Dumbbells", "Resistance Bands", etc.]
  "goals": string[],                // Optional: ["toning", "strength", "weight_loss", etc.]
  "injuries": string[],             // Optional: ["lower_back", "knee", etc.]
  "timeAvailable": number,          // Optional: minutes (10-120)
  "daysPerWeek": number,            // Optional: 1-7
  "workoutType": string,            // Optional: free-form text like "upper body strength training"
  "otherInformation": string        // Optional: free-form additional context
}
```

**Response Structure:**
```json
{
  "status": "success",
  "data": {
    "workout": {
      "type": "upper_body",
      "duration": 90,
      "difficulty": "beginner",
      "equipment": ["Dumbbells", "Resistance Bands"],
      "warmup": [
        {
          "name": "Arm Circles",
          "duration": "5 minutes",
          "instructions": "Stand with feet shoulder-width apart..."
        }
      ],
      "mainWorkout": {
        "structure": "circuit",
        "exercises": [
          {
            "name": "Dumbbell Shoulder Press",
            "category": "strength",
            "sets": 3,
            "reps": "12",
            "rest": "60 seconds",
            "instructions": "Sit or stand with a dumbbell...",
            "targetMuscles": ["shoulders", "triceps"]
          }
        ]
      },
      "cooldown": [
        {
          "name": "Child's Pose",
          "duration": "5 minutes",
          "instructions": "Kneel on the floor..."
        }
      ],
      "coachingTips": [
        "Focus on maintaining proper form to prevent injury.",
        "Control your breathing throughout each exercise."
      ]
    },
    "metadata": {
      "model": "gpt-4o",
      "provider": "openai",
      "timestamp": "2025-06-22T14:29:52.091Z",
      "correlationId": "d30c6b37",
      "userId": "salscru",
      "debug": {
        "requestFormat": "flexible",
        "isEnhancedFormat": true,
        "parsedWorkoutType": "upper_body",
        "professionalStandards": {
          "certificationLevel": "NASM-CPT, CSCS, ACSM",
          "programmingApproach": "Evidence-based exercise science",
          "qualityScore": 0.75
        },
        "workoutStructureValidation": {
          "hasWarmup": true,
          "hasMainWorkout": true,
          "hasCooldown": true,
          "exerciseCount": 3
        }
      }
    }
  },
  "correlationId": "d30c6b37",
  "timestamp": "2025-06-22T14:29:52.091Z"
}
```

### 2. Complete Workout
**Endpoint:** `POST /api/workout/complete`

**Request Body:**
```json
{
  "workoutId": "string",           // Required: from generate response
  "completed": boolean,            // Required: true/false
  "completionPercentage": number,  // Optional: 0-100
  "actualDuration": number,        // Optional: minutes
  "rating": number,                // Optional: 1-5
  "difficulty": string,            // Optional: "too_easy", "just_right", "too_hard"
  "enjoyment": number,             // Optional: 1-5
  "energy": string,                // Optional: "low", "medium", "high"
  "notes": string,                 // Optional: free-form feedback
  "exercises": [                   // Optional: per-exercise feedback
    {
      "name": "string",
      "completed": boolean,
      "actualSets": number,
      "actualReps": string,
      "notes": string
    }
  ]
}
```

### 3. Get Workout History
**Endpoint:** `GET /api/workout/history`

**Query Parameters:**
- `limit`: number (default: 20)
- `includeDetails`: boolean (default: false)
- `includeIncomplete`: boolean (default: false)

## Frontend Integration Best Practices

### 1. Data Collection Optimization
- **Maintain Current UI Flow**: Your existing 6-step onboarding is optimal
- **Enhanced Data Mapping**: Map UI selections to API fields:
  - Fitness Level → `fitnessLevel`
  - Goals → `goals` array
  - Equipment → `equipment` array
  - Time Commitment → `timeAvailable` and `daysPerWeek`
  - Injuries → `injuries` array

### 2. Request Optimization
```javascript
// Optimal request structure
const workoutRequest = {
  age: userProfile.age,
  gender: userProfile.gender,
  weight: userProfile.weight,
  fitnessLevel: userProfile.fitnessLevel,
  equipment: userProfile.selectedEquipment,
  goals: userProfile.selectedGoals,
  injuries: userProfile.selectedInjuries,
  timeAvailable: userProfile.minutesPerSession,
  daysPerWeek: userProfile.daysPerWeek,
  workoutType: currentWorkoutSelection, // From workout type screen
  otherInformation: userProfile.additionalNotes || ""
};
```

### 3. Response Processing
```javascript
// Extract key workout data
const workout = response.data.workout;
const exercises = workout.mainWorkout.exercises;
const totalExercises = exercises.length;
const estimatedDuration = workout.duration;

// Use metadata for debugging and analytics
const metadata = response.data.metadata;
const qualityScore = metadata.debug.professionalStandards.qualityScore;
const exerciseCount = metadata.debug.workoutStructureValidation.exerciseCount;
```

### 4. Progressive Enhancement
- **Duration Matching**: The API now ensures workout duration matches `timeAvailable`
- **Exercise Scaling**: Exercise count automatically scales with fitness level and duration
- **Progressive Overload**: Subsequent workouts consider previous performance

### 5. Error Handling
```javascript
// Handle API errors gracefully
try {
  const response = await fetch('/api/workout/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': userId
    },
    body: JSON.stringify(workoutRequest)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  return data;
} catch (error) {
  // Fallback to cached workout or show error
  console.error('Workout generation failed:', error);
}
```

## Key Improvements Implemented

### Backend Optimizations
1. **Duration Accuracy**: Workouts now properly utilize full session time
2. **Enhanced Structure**: Consistent `mainWorkout.exercises` format
3. **Progressive Overload**: Automatic difficulty adjustment based on history
4. **Rich Metadata**: Comprehensive debugging and quality metrics

### Response Enhancements
1. **Structured Exercises**: All exercises include category, target muscles, detailed instructions
2. **Quality Scoring**: Each workout includes a quality score (0.5-1.0)
3. **Validation Metrics**: Structure validation ensures complete workouts
4. **Professional Standards**: NASM-CPT level programming principles

### Frontend Integration
1. **Minimal UI Changes**: Existing data collection flow remains optimal
2. **Enhanced Data Utilization**: Better mapping of user inputs to workout parameters
3. **Improved Analytics**: Rich metadata for tracking and optimization
4. **Flexible Input Handling**: Supports both structured and free-form inputs

## Testing Recommendations
1. Test with various duration combinations (30, 45, 60, 90 minutes)
2. Verify exercise count scales appropriately with fitness level
3. Confirm workout history influences subsequent generations
4. Validate metadata fields for analytics integration

## Performance Notes
- Average response time: 3-5 seconds
- Two-stage AI processing for optimal quality
- Automatic fallback for reliability
- Comprehensive error handling and logging

## Advanced Features

### 1. Workout Analytics
Use the metadata to track workout quality and user engagement:
```javascript
// Track workout quality metrics
const qualityMetrics = {
  qualityScore: metadata.debug.professionalStandards.qualityScore,
  exerciseCount: metadata.debug.workoutStructureValidation.exerciseCount,
  hasCompleteStructure: metadata.debug.workoutStructureValidation.hasWarmup &&
                       metadata.debug.workoutStructureValidation.hasMainWorkout &&
                       metadata.debug.workoutStructureValidation.hasCooldown,
  modelUsed: metadata.model,
  processingTime: metadata.timestamp
};
```

### 2. Progressive Overload Tracking
The API automatically considers workout history for progression:
- Previous workout ratings influence difficulty
- Exercise variations are suggested based on recent workouts
- Duration and intensity scale with user progress

### 3. Personalization Features
- **Equipment Optimization**: Workouts maximize available equipment usage
- **Injury Considerations**: Automatic exercise modifications for reported injuries
- **Goal Alignment**: Exercise selection prioritizes user's primary goals
- **Time Efficiency**: Workouts are structured to maximize results within available time

### 4. Quality Assurance
Every workout includes quality validation:
- Professional certification standards (NASM-CPT, CSCS, ACSM)
- Evidence-based exercise science principles
- Safety-first approach with proper progressions
- Comprehensive instruction quality (minimum 20 characters per exercise)

## Troubleshooting

### Common Issues
1. **Duration Mismatch**: Ensure `timeAvailable` is provided for accurate workout length
2. **Empty Equipment**: If no equipment specified, workouts default to bodyweight exercises
3. **Missing Instructions**: All exercises include detailed form cues and safety notes
4. **Incomplete Structure**: API ensures warmup, main workout, and cooldown are always included

### Error Codes
- `400`: Invalid request parameters (check required fields)
- `429`: Rate limiting (implement exponential backoff)
- `500`: Server error (use fallback workout or retry)

### Debugging
Use the `debug` metadata section to troubleshoot:
- `requestFormat`: Confirms request was processed correctly
- `workoutStructureValidation`: Verifies workout completeness
- `qualityScore`: Indicates workout quality (aim for >0.7)

## Migration Guide

### From Basic to Enhanced API
If migrating from a simpler workout API:

1. **Update Request Structure**: Add new optional fields gradually
2. **Handle New Response Format**: Update parsers for `mainWorkout.exercises` structure
3. **Utilize Metadata**: Implement analytics using the rich metadata provided
4. **Progressive Enhancement**: Start with basic fields, add advanced features incrementally

### Backward Compatibility
The API maintains backward compatibility:
- Legacy `exercises` array is automatically converted to `mainWorkout.exercises`
- Missing fields are populated with sensible defaults
- Existing UI flows require minimal changes

## Support and Resources

### API Status
Monitor API health at: `/api/health`

### Rate Limits
- 100 requests per minute per user
- 1000 requests per hour per user
- Implement client-side caching for optimal performance

### Best Practices Summary
1. Always include `X-User-Id` header for personalization
2. Provide `timeAvailable` for accurate workout duration
3. Use `otherInformation` field for special requirements
4. Implement proper error handling and fallbacks
5. Cache successful responses to reduce API calls
6. Track quality metrics for continuous improvement
