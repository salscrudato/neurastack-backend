# NeuraStack Ensemble API - Frontend Integration Guide

## Response Structure Overview

The `/default-ensemble` endpoint returns a structured response with three main sections: `synthesis`, `roles`, and `metadata`.

## 📋 Complete Response Structure

```json
{
  "synthesis": {
    "content": "The final AI-generated response",
    "model": "gpt-4o-mini",
    "provider": "openai", 
    "status": "success",
    "strategy": "comparative",
    "confidence": 0.85
  },
  "roles": [
    {
      "role": "gpt4o",
      "status": "fulfilled",
      "content": "Individual AI model response",
      "confidence": {
        "score": 0.82,
        "factors": ["response_length", "coherence", "specificity"]
      },
      "metadata": {
        "model": "gpt-4o-mini",
        "provider": "openai",
        "responseTime": 1200,
        "tokenUsage": { "prompt": 150, "completion": 300 }
      }
    }
  ],
  "metadata": {
    "totalRoles": 3,
    "successfulRoles": 3,
    "failedRoles": 0,
    "synthesisStatus": "success",
    "sessionId": "session_user123_1234567890",
    "memoryContextUsed": true,
    "responseQuality": 0.85,
    "correlationId": "abc123def"
  }
}
```

## 🎯 Field Descriptions & Frontend Usage

### `synthesis` - The Final Answer
**What it is**: The optimized final response from multiple AI models
**Frontend use**: Display this as the main answer to the user

| Field | Type | Description | Frontend Usage |
|-------|------|-------------|----------------|
| `content` | string | Final synthesized response | Main content to display |
| `model` | string | AI model used for synthesis | Show in metadata/debug info |
| `provider` | string | AI provider (openai/claude/gemini) | Provider attribution |
| `status` | string | "success" or "error" | Handle error states |
| `strategy` | string | Synthesis method used | Optional: show processing method |
| `confidence` | number | Overall confidence (0-1) | Show confidence indicator |

### `roles` - Individual AI Responses
**What it is**: Raw responses from each AI model before synthesis
**Frontend use**: Show individual model perspectives or for debugging

| Field | Type | Description | Frontend Usage |
|-------|------|-------------|----------------|
| `role` | string | Model identifier (gpt4o, claude, gemini) | Model name display |
| `status` | string | "fulfilled" or "rejected" | Show which models succeeded |
| `content` | string | Individual model response | Compare different AI perspectives |
| `confidence.score` | number | Model confidence (0-1) | Individual confidence indicators |
| `metadata.responseTime` | number | Response time in milliseconds | Performance metrics |

### `metadata` - System Information
**What it is**: Processing statistics and system status
**Frontend use**: Show system health, performance metrics, debugging

| Field | Type | Description | Frontend Usage |
|-------|------|-------------|----------------|
| `totalRoles` | number | Total AI models called | System status indicator |
| `successfulRoles` | number | Models that responded successfully | Success rate display |
| `synthesisStatus` | string | Final synthesis result | Overall request status |
| `memoryContextUsed` | boolean | Whether user memory was used | Personalization indicator |
| `responseQuality` | number | Overall response quality (0-1) | Quality indicator |
| `correlationId` | string | Request tracking ID | Debug/support reference |

## 🚀 Frontend Implementation Examples

### Basic Response Display
```javascript
// Display main response
const mainResponse = response.synthesis.content;
const confidence = Math.round(response.synthesis.confidence * 100);

// Show confidence indicator
<div className="response">
  <p>{mainResponse}</p>
  <span className="confidence">Confidence: {confidence}%</span>
</div>
```

### Model Comparison View
```javascript
// Show individual model responses
const modelResponses = response.roles
  .filter(role => role.status === 'fulfilled')
  .map(role => ({
    name: role.role,
    content: role.content,
    confidence: Math.round(role.confidence.score * 100)
  }));
```

### System Status Indicator
```javascript
// Show system health
const systemHealth = {
  modelsUsed: response.metadata.totalRoles,
  successRate: Math.round((response.metadata.successfulRoles / response.metadata.totalRoles) * 100),
  memoryUsed: response.metadata.memoryContextUsed,
  quality: Math.round(response.metadata.responseQuality * 100)
};
```

## 🎨 UI/UX Recommendations

### Essential Elements
- **Main Response**: Always show `synthesis.content` prominently
- **Confidence Indicator**: Use `synthesis.confidence` for user trust
- **Loading States**: Handle async responses gracefully

### Optional Enhancements
- **Model Breakdown**: Show individual `roles` responses for transparency
- **Performance Metrics**: Display response times from `metadata`
- **Memory Indicator**: Show when `memoryContextUsed` is true

### Error Handling
```javascript
if (response.synthesis.status === 'error') {
  // Handle synthesis failure
  // Check individual roles for partial success
  const workingModels = response.roles.filter(r => r.status === 'fulfilled');
}
```

## 📊 Confidence Scoring Guide

| Score Range | Meaning | UI Treatment |
|-------------|---------|--------------|
| 0.8 - 1.0 | High confidence | Green indicator |
| 0.6 - 0.79 | Medium confidence | Yellow indicator |
| 0.4 - 0.59 | Low confidence | Orange indicator |
| 0.0 - 0.39 | Very low confidence | Red indicator |

## 🔧 Request Headers

Always include these headers for optimal tracking:
```javascript
headers: {
  'Content-Type': 'application/json',
  'X-User-ID': 'user123',           // Optional: user identification
  'X-Correlation-ID': 'unique-id'   // Optional: request tracking
}
```

This structure provides everything needed for a rich, informative frontend experience while maintaining simplicity for basic implementations.
