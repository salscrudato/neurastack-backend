# NeuraStack Ensemble API - Frontend Developer Guide

## Overview
The NeuraStack Ensemble API provides intelligent AI responses by combining outputs from multiple AI models (GPT-4o, Gemini, Claude) into a single, high-quality synthesized response. This guide explains how to integrate with the API from your frontend application.

## Base URL
- **Development**: `http://localhost:8080`
- **Production**: `https://neurastack-backend-638289111765.us-central1.run.app`

## Authentication
No API key required. User identification is handled via headers.

## Ensemble Endpoint

### POST `/default-ensemble`

**Purpose**: Get an intelligent AI response synthesized from multiple models

**Headers**:
```
Content-Type: application/json
X-User-ID: string (required) - Unique identifier for the user
X-Correlation-ID: string (optional) - Request tracking ID
```

**Request Body**:
```json
{
  "prompt": "string (required, max 5000 chars) - The user's question or request",
  "sessionId": "string (optional) - Session identifier for conversation context"
}
```

**Example Request**:
```javascript
const response = await fetch('http://localhost:8080/default-ensemble', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-User-ID': 'user_12345',
    'X-Correlation-ID': 'req_' + Date.now()
  },
  body: JSON.stringify({
    prompt: "Explain quantum computing in simple terms",
    sessionId: "session_abc123"
  })
});

const data = await response.json();
```

## Response Format

### Success Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "prompt": "Explain quantum computing in simple terms",
    "userId": "user_12345",
    "sessionId": "session_abc123",
    "synthesis": {
      "content": "Quantum computing is a revolutionary technology...",
      "model": "gpt-4o",
      "provider": "openai",
      "status": "success",
      "overallConfidence": 0.85,
      "confidence": {
        "score": 0.85,
        "level": "high",
        "factors": ["Based on 3 successful responses", "High model agreement"]
      },
      "qualityScore": 0.92
    },
    "roles": [
      {
        "role": "gpt4o",
        "content": "Quantum computing uses quantum mechanics...",
        "status": "fulfilled",
        "model": "gpt-4o-mini",
        "provider": "openai",
        "responseTime": 850,
        "confidence": {
          "score": 0.8,
          "level": "high"
        }
      },
      {
        "role": "gemini",
        "content": "Think of quantum computers as...",
        "status": "fulfilled",
        "model": "gemini-1.5-flash",
        "provider": "gemini",
        "responseTime": 420
      },
      {
        "role": "claude",
        "content": "Quantum computing represents a paradigm shift...",
        "status": "fulfilled",
        "model": "claude-3-haiku-20240307",
        "provider": "claude",
        "responseTime": 1200
      }
    ],
    "metadata": {
      "totalRoles": 3,
      "successfulRoles": 3,
      "failedRoles": 0,
      "processingTimeMs": 2100,
      "responseQuality": 0.92,
      "correlationId": "req_1234567890",
      "timestamp": "2025-06-24T00:44:34.516Z",
      "version": "3.0",
      "confidenceAnalysis": {
        "overallConfidence": 0.85,
        "modelAgreement": 0.94,
        "qualityDistribution": {
          "high": 2,
          "medium": 1,
          "low": 0
        }
      },
      "costEstimate": {
        "totalCost": 0.000219,
        "breakdown": {
          "inputTokens": 8,
          "outputTokens": 272,
          "inputCost": 0.000002,
          "outputCost": 0.000218
        }
      }
    }
  }
}
```

### Error Response (500 Internal Server Error)
```json
{
  "status": "error",
  "message": "Enhanced ensemble processing failed. Our team has been notified.",
  "error": "Internal server error",
  "timestamp": "2025-06-24T00:44:34.516Z",
  "correlationId": "req_1234567890",
  "retryable": true,
  "supportInfo": {
    "correlationId": "req_1234567890",
    "timestamp": "2025-06-24T00:44:34.516Z",
    "suggestion": "Please try again in a few moments. If the issue persists, contact support with the correlation ID."
  }
}
```

## Key Response Fields

### Primary Response
- **`data.synthesis.content`**: The main AI response (use this for display)
- **`data.synthesis.confidence.score`**: Confidence level (0-1, higher is better)
- **`data.synthesis.qualityScore`**: Response quality (0-1, higher is better)

### Individual Model Responses
- **`data.roles[]`**: Array of responses from each AI model
- **`data.roles[].content`**: Individual model response
- **`data.roles[].responseTime`**: Time taken by each model (ms)
- **`data.roles[].status`**: "fulfilled" or "rejected"

### Metadata
- **`data.metadata.processingTimeMs`**: Total processing time
- **`data.metadata.successfulRoles`**: Number of models that responded
- **`data.metadata.costEstimate.totalCost`**: Request cost in USD

## Frontend Implementation Examples

### React Hook Example
```javascript
import { useState, useCallback } from 'react';

export const useEnsembleAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callEnsemble = useCallback(async (prompt, userId, sessionId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/default-ensemble', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
          'X-Correlation-ID': `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        body: JSON.stringify({ prompt, sessionId })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Request failed');
      }
      
      return data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { callEnsemble, loading, error };
};
```

### Vue.js Composable Example
```javascript
import { ref } from 'vue';

export function useEnsembleAPI() {
  const loading = ref(false);
  const error = ref(null);

  const callEnsemble = async (prompt, userId, sessionId) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch('/default-ensemble', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId
        },
        body: JSON.stringify({ prompt, sessionId })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message);
      }
      
      return data.data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return { callEnsemble, loading, error };
}
```

## Best Practices

### 1. User Experience
- **Show loading states**: Processing takes 3-8 seconds
- **Display confidence**: Use `synthesis.confidence.level` for UI indicators
- **Handle errors gracefully**: Show retry options for retryable errors
- **Session management**: Maintain consistent sessionId for conversations

### 2. Performance
- **Debounce requests**: Avoid rapid successive calls
- **Cache responses**: Consider client-side caching for repeated prompts
- **Timeout handling**: Set reasonable timeouts (10-15 seconds)

### 3. Error Handling
```javascript
try {
  const result = await callEnsemble(prompt, userId, sessionId);
  // Handle success
} catch (error) {
  if (error.retryable) {
    // Show retry button
  } else {
    // Show error message
  }
}
```

### 4. Response Processing
```javascript
const processEnsembleResponse = (data) => {
  return {
    mainResponse: data.synthesis.content,
    confidence: data.synthesis.confidence.level, // 'high', 'medium', 'low'
    processingTime: data.metadata.processingTimeMs,
    modelCount: data.metadata.successfulRoles,
    cost: data.metadata.costEstimate.totalCost
  };
};
```

## Rate Limits
- **Free tier**: 100 requests/hour, 1000 requests/day
- **No burst limits**: Requests are processed as received

## Support
For issues or questions:
- Include the `correlationId` from error responses
- Check server logs for detailed error information
- Typical response time: 3-8 seconds depending on model availability

## Changelog
- **v3.0**: Current version with enhanced confidence analysis and cost tracking
- **v2.0**: Added individual model responses and metadata
- **v1.0**: Basic ensemble functionality
