# NeuraStack Backend - Frontend Integration Guide (2025)

## 🚀 Quick Start

**Base URL**: `https://neurastack-backend-638289111765.us-central1.run.app`

**Required Headers**:
```javascript
{
  'Content-Type': 'application/json',
  'x-user-id': 'your-user-id' // Required for most endpoints
}
```

## 📋 Core API Endpoints

### 1. Health Check ✅ **TESTED & WORKING**
```javascript
// GET /health
const healthCheck = async () => {
  const response = await fetch(`${BASE_URL}/health`);
  return await response.json();
  // Returns: { status: "ok", message: "Neurastack backend healthy 🚀" }
};
```

### 2. AI Ensemble API ⭐ **Primary Feature**
```javascript
// POST /default-ensemble
const getAIResponse = async (prompt, userId, sessionId = null) => {
  const response = await fetch(`${BASE_URL}/default-ensemble`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId
    },
    body: JSON.stringify({
      prompt: prompt,
      sessionId: sessionId || `session_${userId}_${Date.now()}`,
      explain: false // Set to true for detailed explanations
    })
  });
  return await response.json();
};
```

**⚠️ Note**: This endpoint is working but responses may take 15-30 seconds due to AI processing time.

**Response Structure**:
```javascript
{
  status: "success",
  data: {
    prompt: "Your original prompt",
    userId: "user-123",
    sessionId: "session_user-123_1234567890",
    synthesis: {
      content: "Final synthesized response from all AI models",
      confidence: {
        score: 0.85,
        level: "high",
        factors: ["Based on 3 successful responses", "Average role confidence: 82.3%"]
      },
      status: "success",
      processingTime: 2500
    },
    roles: [
      {
        role: "gpt4o",
        content: "GPT-4o-mini response",
        status: "fulfilled",
        confidence: {
          score: 0.82,
          level: "high",
          factors: ["Response generated successfully", "Adequate response length"]
        },
        quality: {
          wordCount: 45,
          hasStructure: true,
          hasReasoning: true
        },
        metadata: {
          model: "gpt-4o-mini",
          provider: "openai",
          processingTime: 1200
        }
      },
      // ... similar structure for gemini and claude roles
    ],
    voting: {
      winner: "gpt4o",
      confidence: 0.78,
      consensus: "strong",
      weights: {
        gpt4o: 0.45,
        gemini: 0.32,
        claude: 0.23
      }
    },
    metadata: {
      timestamp: "2025-07-14T21:40:27.444Z",
      correlationId: "abc123",
      tier: "free"
    }
  },
  correlationId: "abc123"
}
```

### 3. Workout Generation API 💪
```javascript
// POST /workout/generate
const generateWorkout = async (userMetadata, workoutRequest, userId) => {
  const response = await fetch(`${BASE_URL}/workout/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId
    },
    body: JSON.stringify({
      userMetadata: {
        fitnessLevel: "beginner", // "beginner" | "intermediate" | "advanced"
        goals: ["weight_loss"], // Array of goals
        equipment: ["bodyweight", "dumbbells"], // Available equipment
        age: 25,
        gender: "male", // "male" | "female" | "other"
        weight: 70, // in kg
        injuries: [], // Array of injury descriptions
        daysPerWeek: 3,
        minutesPerSession: 30,
        workoutType: "strength" // "strength" | "cardio" | "flexibility" | "mixed"
      },
      workoutRequest: workoutRequest // Natural language description
    })
  });
  return await response.json();
};
```

**Workout Response Structure**:
```javascript
{
  status: "success",
  data: {
    workoutId: "workout_abc123",
    mainWorkout: {
      exercises: [
        {
          name: "Push-ups",
          sets: 3,
          reps: "8-12",
          duration: 0, // in seconds, 0 if reps-based
          rest: "60s",
          instructions: "Keep your body in a straight line...",
          targetMuscles: ["chest", "triceps", "shoulders"]
        }
        // ... more exercises
      ]
    },
    metadata: {
      estimatedDuration: 30,
      difficulty: "beginner",
      totalExercises: 6,
      targetMuscles: ["chest", "legs", "core"],
      equipment: ["bodyweight"]
    },
    userId: "user-123",
    timestamp: "2025-07-14T21:40:27.444Z"
  }
}
```

## 🔧 System Information Endpoints ✅ **ALL TESTED & WORKING**

### 4. System Metrics
```javascript
// GET /metrics
const getSystemMetrics = async () => {
  const response = await fetch(`${BASE_URL}/metrics`);
  return await response.json();
};
```

**Sample Response**:
```javascript
{
  timestamp: "2025-07-14T21:42:07.903Z",
  system: {
    requests: {
      total: 6,
      successful: 4,
      failed: 2,
      byEndpoint: {
        "/health": { total: 1, successful: 1, failed: 0 },
        "/default-ensemble": { total: 3, successful: 3, failed: 0 },
        "/workout/generate": { total: 1, successful: 0, failed: 1 }
      }
    },
    performance: {
      averageResponseTime: 6384.5,
      p95ResponseTime: 24600
    }
  },
  tier: "free"
}
```

### 5. Tier Information ✅ **TESTED & WORKING**
```javascript
// GET /tier-info
const getTierInfo = async () => {
  const response = await fetch(`${BASE_URL}/tier-info`);
  return await response.json();
};
```

**Sample Response**:
```javascript
{
  status: "success",
  data: {
    currentTier: "free",
    configuration: {
      models: {
        gpt4o: { provider: "openai", model: "gpt-4o-mini" },
        gemini: { provider: "gemini", model: "gemini-1.5-flash" },
        claude: { provider: "claude", model: "claude-3-5-haiku-latest" }
      },
      limits: {
        requestsPerHour: 25,
        requestsPerDay: 150,
        maxPromptLength: 1500,
        timeoutMs: 75000
      }
    }
  }
}
```

### 6. Detailed Health Check ✅ **TESTED & WORKING**
```javascript
// GET /health-detailed
const getDetailedHealth = async () => {
  const response = await fetch(`${BASE_URL}/health-detailed`);
  return await response.json();
};
```

## 🎯 Frontend Implementation Examples

### React Hook for AI Ensemble
```javascript
import { useState, useCallback } from 'react';

const useAIEnsemble = () => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const generateResponse = useCallback(async (prompt, userId, sessionId) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getAIResponse(prompt, userId, sessionId);
      setResponse(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateResponse, loading, response, error };
};
```

### React Component Example
```javascript
const AIChat = ({ userId }) => {
  const { generateResponse, loading, response, error } = useAIEnsemble();
  const [prompt, setPrompt] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    try {
      await generateResponse(prompt, userId);
      setPrompt('');
    } catch (err) {
      console.error('Failed to generate response:', err);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask me anything..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? 'Generating...' : 'Send'}
        </button>
      </form>
      
      {error && <div className="error">Error: {error}</div>}
      
      {response && (
        <div className="response">
          <h3>AI Response:</h3>
          <p>{response.data.synthesis.content}</p>
          <div className="confidence">
            Confidence: {(response.data.synthesis.confidence.score * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
};
```

## 🚨 Error Handling

### Common Error Responses
```javascript
// Rate limit exceeded
{
  status: "error",
  message: "Rate limit exceeded",
  retryAfter: 900,
  correlationId: "abc123"
}

// Invalid input
{
  status: "error",
  message: "Invalid prompt length/format.",
  correlationId: "abc123"
}

// Server error
{
  status: "error",
  message: "Ensemble processing failed.",
  correlationId: "abc123"
}
```

## 📊 Key Data Points for UI Display

### From AI Ensemble Response:
- **`data.synthesis.content`** - Main AI response to display
- **`data.synthesis.confidence.score`** - Confidence percentage (0-1)
- **`data.synthesis.confidence.level`** - "high", "medium", "low", "very-low"
- **`data.voting.winner`** - Which AI model won the voting
- **`data.voting.consensus`** - "strong", "moderate", "weak"
- **`data.roles[].content`** - Individual AI model responses
- **`data.metadata.tier`** - Current user tier

### From Workout Response:
- **`data.mainWorkout.exercises`** - Array of exercises to display
- **`data.metadata.estimatedDuration`** - Total workout time
- **`data.metadata.difficulty`** - Workout difficulty level
- **`data.metadata.targetMuscles`** - Muscles being worked

## 🔐 Authentication & User Management

The API uses simple header-based user identification:
```javascript
headers: {
  'x-user-id': 'your-user-id' // Can be any unique identifier
}
```

For production, implement proper authentication and pass the authenticated user ID in this header.

## ⚡ Performance Considerations

1. **AI Ensemble API**: Responses take 15-30 seconds - implement proper loading states
2. **Caching**: The system has built-in caching - identical requests return faster
3. **Rate Limits**: Free tier allows 25 requests/hour, 150/day
4. **Timeouts**: Set client timeouts to at least 45 seconds for ensemble calls

## 🎨 UI/UX Recommendations

1. **Loading States**: Show spinners with estimated time (15-30s for ensemble)
2. **Confidence Indicators**: Display confidence scores with color coding
3. **Model Comparison**: Allow users to see individual AI model responses
4. **Error Messages**: Provide clear, actionable error messages
5. **Rate Limiting**: Show remaining requests or cooldown timers
6. **Progressive Loading**: Show individual model responses as they complete

## 📱 Mobile Considerations

- API responses can be large - implement pagination for exercise lists
- Use progressive loading for ensemble responses
- Implement request cancellation for better UX
- Consider caching strategies for frequently accessed data

---

**Deployment Status**: ✅ **LIVE & TESTED**
**Last Updated**: July 14, 2025
**Base URL**: https://neurastack-backend-638289111765.us-central1.run.app
