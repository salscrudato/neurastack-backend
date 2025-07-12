# NeuraStack Frontend Integration Guide

## Overview
This guide provides comprehensive documentation for integrating with the NeuraStack AI Ensemble API, including explainability features, voting dashboards, and response breakdown interfaces.

## Enhanced Ensemble API

### Endpoint
```
POST /default-ensemble
```

### Request Parameters

#### Headers
- `x-user-id` (optional): User identifier for personalization
- `x-session-id` (optional): Session identifier for context management
- `x-correlation-id` (optional): Request tracking identifier

#### Body Parameters
```json
{
  "prompt": "string (required) - The user's question or request",
  "sessionId": "string (optional) - Session identifier",
  "tier": "string (optional) - 'free' or 'premium', defaults to 'free'",
  "explain": "boolean (optional) - Enable detailed explanation mode"
}
```

#### Query Parameters
- `explain=true` - Enable verbose explanation mode for debugging/analysis

### Response Structure

#### Standard Response
```json
{
  "status": "success",
  "data": {
    "prompt": "Original user prompt",
    "userId": "User identifier",
    "sessionId": "Session identifier",
    "synthesis": {
      "content": "Final synthesized response",
      "model": "Model used for synthesis",
      "provider": "AI provider",
      "confidence": {
        "score": 0.85,
        "level": "high",
        "factors": ["quality", "consensus", "reliability"]
      },
      "strategy": "consensus|best_response|comparative",
      "_confidenceDescription": "Overall confidence explanation"
    },
    "roles": [
      {
        "role": "gpt4o|gemini|claude",
        "content": "Individual model response",
        "model": "Specific model name",
        "provider": "AI provider",
        "confidence": {
          "score": 0.82,
          "level": "high",
          "factors": {
            "quality": 0.9,
            "consistency": 0.8,
            "reliability": 0.85
          }
        },
        "quality": {
          "wordCount": 150,
          "sentenceCount": 8,
          "complexity": "medium"
        },
        "metadata": {
          "processingTime": 2500,
          "tokenCount": 200,
          "complexity": "medium"
        }
      }
    ],
    "voting": {
      "winner": "gpt4o",
      "confidence": 0.87,
      "consensus": "strong|moderate|weak",
      "weights": {
        "gpt4o": 0.45,
        "gemini": 0.32,
        "claude": 0.23
      },
      "sophisticatedVoting": {
        "traditionalVoting": {},
        "hybridVoting": {},
        "diversityAnalysis": {},
        "historicalPerformance": {},
        "tieBreaking": {},
        "metaVoting": {},
        "abstention": {},
        "analytics": {}
      }
    },
    "metadata": {
      "totalRoles": 3,
      "successfulRoles": 3,
      "failedRoles": 0,
      "synthesisStatus": "success",
      "correlationId": "req_123456",
      "explainMode": false,
      "decisionTrace": {
        "timestamp": "2024-01-01T12:00:00Z",
        "correlationId": "req_123456",
        "steps": [
          {
            "step": "context_building",
            "description": "Retrieved conversation context",
            "outcome": "success"
          }
        ]
      }
    }
  }
}
```

#### Explanation Mode Response (when explain=true)
When `explain=true` is set, the response includes additional `explanation` object:

```json
{
  "explanation": {
    "decisionTrace": {
      "timestamp": "2024-01-01T12:00:00Z",
      "correlationId": "req_123456",
      "steps": [
        {
          "step": "context_building|model_execution|confidence_calculation|voting_weights|synthesis_strategy",
          "description": "Human-readable step description",
          "details": {},
          "outcome": "success|failure|completed"
        }
      ]
    },
    "visualizationData": {
      "voteDistribution": [
        {
          "model": "gpt4o",
          "weight": 0.45,
          "percentage": "45%"
        }
      ],
      "confidenceHistogram": [
        {
          "model": "gpt4o",
          "confidence": 0.85,
          "factors": {}
        }
      ],
      "processingTimeline": [
        {
          "step": "context_building",
          "description": "Retrieved conversation context",
          "outcome": "success",
          "duration": 150
        }
      ]
    },
    "modelComparison": {
      "responses": [
        {
          "model": "gpt4o",
          "provider": "OpenAI",
          "responseSnippet": "First 200 characters of response...",
          "wordCount": 150,
          "confidence": 0.85,
          "processingTime": 2500,
          "qualityMetrics": {}
        }
      ],
      "consensusAnalysis": {
        "agreementLevel": 0.78,
        "conflictPoints": [
          {
            "type": "confidence_mismatch",
            "models": ["gpt4o", "claude"],
            "difference": 0.35,
            "description": "Significant confidence difference"
          }
        ],
        "synthesisStrategy": "consensus"
      }
    },
    "performanceMetrics": {
      "totalProcessingTime": 3200,
      "parallelEfficiency": 0.85,
      "cacheHitRate": 0,
      "costEfficiency": {
        "estimatedCost": 0.0045,
        "costPerConfidencePoint": 0.0053,
        "inputTokens": 50,
        "outputTokens": 450,
        "totalTokens": 500
      }
    }
  }
}
```

## Frontend Integration Examples

### Basic Request
```javascript
const response = await fetch('/default-ensemble', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': 'user123',
    'x-session-id': 'session456'
  },
  body: JSON.stringify({
    prompt: "Explain quantum computing in simple terms",
    tier: "free"
  })
});

const data = await response.json();
console.log(data.data.synthesis.content); // Final response
```

### Explanation Mode Request
```javascript
const response = await fetch('/default-ensemble?explain=true', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': 'user123'
  },
  body: JSON.stringify({
    prompt: "Explain quantum computing",
    explain: true
  })
});

const data = await response.json();
console.log(data.explanation.decisionTrace); // Decision process
console.log(data.explanation.visualizationData); // Chart data
```

## React Component Examples

### Voting Dashboard Component
```jsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const VotingDashboard = ({ votingData }) => {
  const chartData = Object.entries(votingData.weights).map(([model, weight]) => ({
    model: model.toUpperCase(),
    weight: Math.round(weight * 100),
    confidence: votingData.roles?.find(r => r.role === model)?.confidence?.score || 0
  }));

  return (
    <div className="voting-dashboard">
      <h3>AI Model Voting Results</h3>
      <div className="winner-badge">
        Winner: {votingData.winner.toUpperCase()} 
        ({Math.round(votingData.confidence * 100)}% confidence)
      </div>
      
      <BarChart width={400} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="model" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="weight" fill="#8884d8" />
      </BarChart>
      
      <div className="consensus-indicator">
        Consensus: <span className={`consensus-${votingData.consensus}`}>
          {votingData.consensus.toUpperCase()}
        </span>
      </div>
    </div>
  );
};
```

### Response Breakdown Component
```jsx
import React, { useState } from 'react';

const ResponseBreakdown = ({ roles, explanation }) => {
  const [selectedModel, setSelectedModel] = useState(null);

  return (
    <div className="response-breakdown">
      <h3>Individual Model Responses</h3>
      
      <div className="model-tabs">
        {roles.map(role => (
          <button
            key={role.role}
            className={`model-tab ${selectedModel === role.role ? 'active' : ''}`}
            onClick={() => setSelectedModel(role.role)}
          >
            {role.role.toUpperCase()}
            <span className="confidence-badge">
              {Math.round(role.confidence.score * 100)}%
            </span>
          </button>
        ))}
      </div>
      
      {selectedModel && (
        <div className="model-response">
          {roles.filter(r => r.role === selectedModel).map(role => (
            <div key={role.role} className="response-card">
              <div className="response-header">
                <h4>{role.model} ({role.provider})</h4>
                <div className="metrics">
                  <span>Words: {role.quality?.wordCount || 0}</span>
                  <span>Time: {role.metadata?.processingTime || 0}ms</span>
                  <span>Confidence: {Math.round(role.confidence.score * 100)}%</span>
                </div>
              </div>
              
              <div className="response-content">
                {role.content}
              </div>
              
              {explanation && (
                <div className="response-analysis">
                  <h5>Quality Factors:</h5>
                  <ul>
                    {Object.entries(role.confidence.factors || {}).map(([factor, score]) => (
                      <li key={factor}>
                        {factor}: {Math.round(score * 100)}%
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## Key Data Points for UI Display

### Most Important Fields
1. **`data.synthesis.content`** - The final AI response to display to users
2. **`data.synthesis.confidence.score`** - Overall confidence (0-1) for UI indicators
3. **`data.voting.winner`** - Which AI model provided the best response
4. **`data.voting.consensus`** - Strength of agreement between models
5. **`data.metadata.successfulRoles`** - Number of AI models that responded successfully

### Confidence Indicators
- **High (0.8-1.0)**: Green indicator, "High confidence"
- **Medium (0.6-0.79)**: Yellow indicator, "Medium confidence"  
- **Low (0.4-0.59)**: Orange indicator, "Low confidence"
- **Very Low (0-0.39)**: Red indicator, "Very low confidence"

### Consensus Levels
- **very-strong**: 🟢 "Very Strong Agreement"
- **strong**: 🟢 "Strong Agreement"
- **moderate**: 🟡 "Moderate Agreement"
- **weak**: 🟠 "Weak Agreement"
- **very-weak**: 🔴 "Very Weak Agreement"

## Error Handling

### Error Response Format
```json
{
  "status": "error",
  "message": "Human-readable error message",
  "error": "Technical error details (development only)",
  "timestamp": "2024-01-01T12:00:00Z",
  "correlationId": "req_123456"
}
```

### Common Error Scenarios
1. **400 Bad Request**: Invalid prompt format or missing required fields
2. **429 Too Many Requests**: Rate limit exceeded (free tier)
3. **500 Internal Server Error**: AI service failures or system issues

### Recommended Error Handling
```javascript
try {
  const response = await fetch('/default-ensemble', options);
  const data = await response.json();
  
  if (data.status === 'error') {
    // Handle API-level errors
    showErrorMessage(data.message);
    return;
  }
  
  // Process successful response
  displayResponse(data.data);
  
} catch (error) {
  // Handle network/parsing errors
  showErrorMessage('Connection error. Please try again.');
}
```

## Performance Optimization

### Caching Strategy
- Responses are automatically cached server-side
- Identical prompts return cached results with `cached: true` flag
- Cache TTL varies by tier (free: 1 hour, premium: 30 minutes)

### Loading States
- Average response time: 3-8 seconds
- Show loading indicator immediately
- Consider timeout after 30 seconds
- Display partial results if available

### Rate Limiting
- Free tier: 10 requests per minute per user
- Premium tier: 60 requests per minute per user
- Implement client-side rate limiting to prevent errors

This guide provides the foundation for building rich, interactive frontends that leverage NeuraStack's advanced AI ensemble capabilities with full explainability and transparency features.
