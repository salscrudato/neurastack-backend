# Neurastack Backend API - Frontend Implementation Guide

## Overview
The Neurastack backend provides a powerful AI ensemble system that combines responses from multiple AI models (OpenAI GPT-4o, Google Gemini, and Anthropic Claude) into a single, optimized response. This guide explains how to integrate the API into your frontend application.

## Base URL
```
Production: https://neurastack-backend-638289111765.us-central1.run.app
```

## Authentication & Headers
All requests should include:
```javascript
const headers = {
  'Content-Type': 'application/json',
  'X-User-Id': userId, // Optional but recommended for tracking
  'X-Correlation-ID': correlationId // Optional for request tracking
};
```

## Core AI Ensemble Endpoint

### POST /default-ensemble
The main endpoint that processes user prompts through multiple AI models and returns individual responses plus a synthesized result.

**Request:**
```javascript
const response = await fetch(`${baseUrl}/default-ensemble`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': 'user123'
  },
  body: JSON.stringify({
    prompt: "Your user's question or request here"
  })
});
```

**Response Structure:**
```typescript
interface EnsembleResponse {
  status: 'success' | 'error';
  data?: {
    prompt: string;
    userId: string;
    sessionId: string;
    roles: IndividualAIResponse[];
    synthesis: SynthesisResponse;
    metadata: ResponseMetadata;
  };
  message?: string;
  timestamp: string;
  correlationId: string;
}

interface IndividualAIResponse {
  role: 'gpt4o' | 'gemini' | 'claude';
  content: string;
  status: 'fulfilled' | 'rejected';
  model: string;
  provider: string;
  wordCount: number;
  characterCount: number; // NEW: Character count for each response
}

interface SynthesisResponse {
  content: string; // Combined and optimized response (NO character limit)
  model: string;
  provider: string;
  wordCount: number;
}

interface ResponseMetadata {
  ensembleMode: boolean;
  modelsUsed: {
    gpt4o: string;
    gemini: string;
    claude: string;
    synthesizer: string;
  };
  executionTime: string;
  tokenCount: number;
  responseQuality: number;
}
```

**Example Implementation:**
```javascript
async function getAIResponse(userPrompt, userId = 'anonymous') {
  try {
    const response = await fetch('https://neurastack-backend-638289111765.us-central1.run.app/default-ensemble', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: JSON.stringify({
        prompt: userPrompt
      })
    });

    const data = await response.json();
    
    if (data.status === 'success') {
      // Individual AI responses (character limited: 2000-3000 chars)
      const gptResponse = data.data.roles.find(r => r.role === 'gpt4o');
      const geminiResponse = data.data.roles.find(r => r.role === 'gemini');
      const claudeResponse = data.data.roles.find(r => r.role === 'claude');
      
      // Synthesized response (unlimited length, best quality)
      const finalAnswer = data.data.synthesis.content;
      
      return {
        individualResponses: data.data.roles,
        synthesizedResponse: finalAnswer,
        metadata: data.data.metadata
      };
    } else {
      throw new Error(data.message || 'API request failed');
    }
  } catch (error) {
    console.error('AI API Error:', error);
    throw error;
  }
}
```

## Workout Generation Endpoint

### POST /workout
Generate personalized workout plans using AI based on user metadata and preferences.

**Request:**
```javascript
const workoutResponse = await fetch(`${baseUrl}/workout`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-Id': userId
  },
  body: JSON.stringify({
    userMetadata: {
      age: 28,
      fitnessLevel: 'intermediate', // 'beginner' | 'intermediate' | 'advanced'
      gender: 'female', // optional
      weight: 65, // optional
      goals: ['strength', 'toning'], // optional array
      equipment: ['dumbbells', 'resistance_bands'], // optional array
      timeAvailable: 45, // optional minutes
      injuries: ['lower_back'] // optional array
    },
    workoutHistory: [ // optional array
      {
        date: '2025-01-10',
        type: 'strength',
        duration: 40,
        exercises: ['squats', 'push_ups'],
        difficulty: 'intermediate',
        rating: 4
      }
    ],
    workoutRequest: 'I want a full-body strength workout focusing on core and upper body'
  })
});
```

**Response:**
```typescript
interface WorkoutResponse {
  status: 'success' | 'error';
  data?: {
    workout: WorkoutPlan;
    metadata: WorkoutMetadata;
  };
  message?: string;
  timestamp: string;
  correlationId: string;
}

interface WorkoutPlan {
  type: 'strength' | 'cardio' | 'mixed' | 'flexibility';
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  exercises: Exercise[];
  warmup: WarmupExercise[];
  cooldown: CooldownExercise[];
  notes: string;
  calorieEstimate: string;
  tags: string[];
}
```

## Error Handling

**Error Response Structure:**
```typescript
interface ErrorResponse {
  status: 'error';
  message: string;
  error?: string; // Only in development
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

**Error Handling Example:**
```javascript
async function handleAPICall(apiFunction) {
  try {
    return await apiFunction();
  } catch (error) {
    if (error.response) {
      const errorData = error.response.data;
      
      // Handle specific error types
      switch (error.response.status) {
        case 400:
          showUserError('Please check your input and try again');
          break;
        case 503:
          if (errorData.retryable) {
            showUserError('Service temporarily unavailable. Please try again in a moment.');
          }
          break;
        case 500:
          showUserError('An unexpected error occurred. Please contact support.');
          break;
        default:
          showUserError('Something went wrong. Please try again.');
      }
      
      // Log correlation ID for support
      console.error('API Error:', {
        correlationId: errorData.correlationId,
        message: errorData.message
      });
    }
  }
}
```

## Key Implementation Notes

### 1. Response Processing
- **Individual AI Responses**: Each AI model response is character-limited (2000-3000 chars) for optimal performance
- **Synthesized Response**: The final synthesis has NO character limit and provides the best combined answer
- **Use the synthesis for primary display**, individual responses for comparison/debugging

### 2. Character Limits
```javascript
// Individual AI responses are limited:
const gptResponse = data.data.roles.find(r => r.role === 'gpt4o');
console.log(`GPT Response: ${gptResponse.characterCount} characters`);

// Synthesis is unlimited:
const synthesis = data.data.synthesis;
console.log(`Synthesis: ${synthesis.content.length} characters (unlimited)`);
```

### 3. Timeout Handling
- API calls may take 15-30 seconds for complex requests
- Implement proper loading states and timeout handling
- Consider showing progress indicators for longer requests

### 4. User Experience Tips
```javascript
// Show individual AI responses for transparency
function displayAIResponses(roles) {
  roles.forEach(response => {
    if (response.status === 'fulfilled') {
      displayIndividualResponse(response.role, response.content, response.model);
    }
  });
}

// Use synthesis as the primary answer
function displayMainAnswer(synthesis) {
  displayPrimaryResponse(synthesis.content);
}
```

### 5. Health Monitoring
```javascript
// Check API health
const healthCheck = await fetch(`${baseUrl}/health`);
const workoutHealthCheck = await fetch(`${baseUrl}/workout/health`);
```

## Complete Example Implementation

```javascript
class NeurastackAPI {
  constructor(baseUrl, userId) {
    this.baseUrl = baseUrl;
    this.userId = userId;
  }

  async askAI(prompt) {
    const response = await fetch(`${this.baseUrl}/default-ensemble`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId
      },
      body: JSON.stringify({ prompt })
    });

    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        answer: data.data.synthesis.content, // Primary answer (unlimited)
        individualResponses: data.data.roles, // Individual AI responses (limited)
        metadata: data.data.metadata
      };
    }
    
    throw new Error(data.message);
  }

  async generateWorkout(userMetadata, workoutHistory, workoutRequest) {
    const response = await fetch(`${this.baseUrl}/workout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': this.userId
      },
      body: JSON.stringify({
        userMetadata,
        workoutHistory,
        workoutRequest
      })
    });

    const data = await response.json();
    
    if (data.status === 'success') {
      return data.data.workout;
    }
    
    throw new Error(data.message);
  }
}

// Usage
const api = new NeurastackAPI('https://neurastack-backend-638289111765.us-central1.run.app', 'user123');

// Get AI response
const aiResult = await api.askAI('Explain quantum computing in simple terms');
console.log('Main Answer:', aiResult.answer);
console.log('Individual AI Responses:', aiResult.individualResponses);

// Generate workout
const workout = await api.generateWorkout(
  { age: 25, fitnessLevel: 'beginner' },
  [],
  'I want a 30-minute bodyweight workout'
);
console.log('Generated Workout:', workout);
```

## Support & Debugging
- Use `correlationId` from responses for debugging
- Check `characterCount` in individual responses to understand truncation
- Monitor `executionTime` in metadata for performance insights
- Use health endpoints to verify service status

The API is designed to provide high-quality, comprehensive AI responses while maintaining optimal performance through intelligent character limiting and response synthesis.
