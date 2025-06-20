# Enhanced Workout API Schema

## Overview

This document outlines the enhanced workout API schema that optimizes data structure to eliminate duplication between `userMetadata` and `workoutRequest`, and ensures consistent workout type categorization.

## Enhanced Request Schema

### Primary Request Structure

```typescript
export interface EnhancedWorkoutAPIRequest {
  userMetadata: WorkoutUserMetadata;
  workoutHistory?: WorkoutHistoryEntry[];
  workoutSpecification: WorkoutSpecification; // Replaces string workoutRequest
  requestId?: string;
  timestamp?: string;
  sessionContext?: string;
}
```

### New Structured Workout Specification

```typescript
export interface WorkoutSpecification {
  // Primary workout categorization
  workoutType: WorkoutType; // Required - ensures consistent categorization
  
  // Time constraints
  duration?: number; // Minutes - overrides userMetadata.timeAvailable if specified
  
  // Intensity and focus
  intensity?: 'beginner' | 'intermediate' | 'advanced'; // Overrides userMetadata.fitnessLevel
  focus?: WorkoutFocus[]; // Specific muscle groups or training aspects
  
  // Workout structure preferences
  structure?: {
    warmupDuration?: number; // Minutes
    cooldownDuration?: number; // Minutes
    restBetweenSets?: number; // Seconds
    exerciseCount?: number; // Preferred number of exercises
  };
  
  // Special requirements
  constraints?: {
    avoidExercises?: string[]; // Exercise names to avoid
    preferredExercises?: string[]; // Exercise names to include if possible
    maxSets?: number; // Maximum sets per exercise
    minSets?: number; // Minimum sets per exercise
  };
  
  // Additional context (optional natural language)
  additionalNotes?: string; // For any specific requirements not covered above
}
```

### Workout Type Enum

```typescript
export type WorkoutType = 
  | 'pull'           // Pull day - back, biceps, rear delts
  | 'push'           // Push day - chest, shoulders, triceps  
  | 'legs'           // Leg day - quads, hamstrings, glutes, calves
  | 'upper'          // Upper body - all upper body muscles
  | 'lower'          // Lower body - all lower body muscles
  | 'full_body'      // Full body workout
  | 'cardio'         // Cardiovascular training
  | 'strength'       // General strength training
  | 'flexibility'    // Stretching and mobility
  | 'hiit'           // High-intensity interval training
  | 'mixed'          // Combination workout
  | 'core'           // Core-focused workout
  | 'functional';    // Functional movement patterns
```

### Workout Focus Options

```typescript
export type WorkoutFocus = 
  | 'strength'
  | 'endurance' 
  | 'power'
  | 'hypertrophy'
  | 'fat_loss'
  | 'mobility'
  | 'stability'
  | 'rehabilitation';
```

## Migration Guide

### Current vs Enhanced Structure

**Current Structure (with duplication):**
```typescript
{
  userMetadata: {
    timeAvailable: 30,
    fitnessLevel: 'beginner',
    equipment: ['dumbbells', 'barbell']
  },
  workoutRequest: "Create a pull day workout for 30 minutes with dumbbells and barbell for a beginner"
}
```

**Enhanced Structure (no duplication):**
```typescript
{
  userMetadata: {
    age: 33,
    gender: 'male',
    weight: 166,
    goals: ['lose_weight', 'build_muscle'],
    equipment: ['dumbbells', 'barbell', 'resistance_bands'],
    injuries: [],
    daysPerWeek: 6
  },
  workoutSpecification: {
    workoutType: 'pull',
    duration: 30,
    intensity: 'beginner',
    focus: ['strength', 'hypertrophy'],
    structure: {
      warmupDuration: 5,
      cooldownDuration: 5,
      restBetweenSets: 60
    }
  }
}
```

## Backend Processing Benefits

1. **Consistent Type Categorization**: The `workoutType` field ensures the AI returns exactly the requested workout type
2. **Reduced Parsing Errors**: Structured data eliminates natural language interpretation inconsistencies
3. **Better Validation**: Each field can be validated independently
4. **Improved Caching**: Structured requests enable better cache key generation
5. **Enhanced Personalization**: More granular control over workout parameters

## Implementation Steps

### Phase 1: Backward Compatibility
- Backend accepts both old string `workoutRequest` and new `workoutSpecification`
- If `workoutSpecification` is provided, it takes precedence
- String parsing logic remains as fallback

### Phase 2: Frontend Migration
- Update frontend to use new structured format
- Maintain old format for gradual rollout
- Add validation for new schema

### Phase 3: Full Migration
- Remove string parsing logic
- Make `workoutSpecification` required
- Remove deprecated `workoutRequest` field

## Response Consistency

With the enhanced schema, the API will guarantee:

- `response.data.workout.type` matches `request.workoutSpecification.workoutType`
- Tags include both the workout type and descriptive labels
- Duration matches requested time constraints
- Equipment usage aligns with user's available equipment
- Difficulty matches user's fitness level or specified intensity

## Frontend Integration Examples

### Enhanced Workout Request Builder

```typescript
// Enhanced workout request builder
const buildEnhancedWorkoutRequest = (
  profile: UserProfile,
  workoutType: WorkoutType,
  customOptions?: Partial<WorkoutSpecification>
): EnhancedWorkoutAPIRequest => {
  return {
    userMetadata: {
      age: profile.age,
      gender: profile.gender,
      weight: profile.weight,
      fitnessLevel: profile.fitnessLevel,
      goals: profile.goals,
      equipment: profile.availableEquipment,
      injuries: profile.injuries,
      daysPerWeek: profile.workoutFrequency,
      timeAvailable: profile.defaultSessionLength
    },
    workoutSpecification: {
      workoutType,
      duration: customOptions?.duration || profile.defaultSessionLength,
      intensity: customOptions?.intensity || profile.fitnessLevel,
      focus: customOptions?.focus || deriveFocusFromGoals(profile.goals),
      structure: {
        warmupDuration: 5,
        cooldownDuration: 5,
        restBetweenSets: 60,
        ...customOptions?.structure
      },
      constraints: customOptions?.constraints,
      additionalNotes: customOptions?.additionalNotes
    },
    workoutHistory: getRecentWorkouts(profile.userId, 5),
    requestId: generateRequestId(),
    timestamp: new Date().toISOString(),
    sessionContext: generateSessionContext(profile.userId, workoutType)
  };
};
```

### Response Post-Processing (Temporary Solution)

While migrating to the enhanced format, you can add this post-processing logic to handle AI categorization inconsistencies:

```typescript
// Post-process workout response to handle type mismatches
const postProcessWorkoutResponse = (
  response: WorkoutAPIResponse,
  requestedType: WorkoutType
): WorkoutAPIResponse => {
  if (response.status === 'success' && response.data?.workout) {
    const workout = response.data.workout;

    // Check if type matches request
    if (workout.type !== requestedType) {
      // Check if the requested type is in tags
      if (workout.tags?.includes(requestedType) ||
          workout.tags?.includes(`${requestedType} day`)) {
        // Correct the type
        workout.type = requestedType;
        console.log(`Corrected workout type from ${workout.type} to ${requestedType}`);
      }
    }

    // Ensure tags include the correct type
    if (!workout.tags?.includes(requestedType)) {
      workout.tags = workout.tags || [];
      workout.tags.unshift(requestedType);
    }
  }

  return response;
};

// Usage in your workout generation
const generateWorkout = async (workoutType: WorkoutType, profile: UserProfile) => {
  const request = buildEnhancedWorkoutRequest(profile, workoutType);
  const response = await neuraStackClient.generateWorkout(request);
  return postProcessWorkoutResponse(response, workoutType);
};
```

### Practical Usage Examples

```typescript
// Example 1: Basic pull day workout
const pullDayWorkout = await generateWorkout('pull', userProfile);

// Example 2: Custom duration and intensity
const customWorkout = await neuraStackClient.generateWorkout(
  buildEnhancedWorkoutRequest(userProfile, 'push', {
    duration: 45,
    intensity: 'intermediate',
    structure: {
      warmupDuration: 8,
      cooldownDuration: 7,
      exerciseCount: 8
    }
  })
);

// Example 3: Workout with constraints
const constrainedWorkout = await neuraStackClient.generateWorkout(
  buildEnhancedWorkoutRequest(userProfile, 'legs', {
    constraints: {
      avoidExercises: ['squats', 'lunges'], // Due to knee injury
      preferredExercises: ['leg press', 'leg curls'],
      maxSets: 3
    },
    additionalNotes: 'Focus on machine-based exercises due to knee sensitivity'
  })
);
```
