# NeuraStack Backend API Integration Guide

## Overview

The NeuraStack Backend provides a powerful AI ensemble API that combines multiple AI models (GPT-4o, Gemini, Claude) to deliver high-quality, confident responses with conversation memory and context awareness.

## Base URL

- **Development**: `http://localhost:8080`
- **Production**: `https://neurastack-backend-638289111765.us-central1.run.app`

## Authentication

Currently, the API uses header-based user identification:

```http
X-User-Id: your-user-id
X-Session-Id: your-session-id (optional, auto-generated if not provided)
X-Correlation-ID: your-correlation-id (optional, for request tracking)
```

## Core Endpoint: AI Ensemble

### POST /default-ensemble

The main endpoint that processes user prompts through multiple AI models and returns a synthesized response with confidence scoring and memory integration.

#### Request Format

```http
POST /default-ensemble
Content-Type: application/json
X-User-Id: user-123
X-Session-Id: session-456
X-Correlation-ID: correlation-789

{
  "prompt": "Your question or prompt here",
  "explain": false
}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | The user's question or prompt (3-5000 characters) |
| `explain` | boolean | No | Enable detailed explanation mode (default: false) |

#### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `X-User-Id` | string | Yes | Unique identifier for the user |
| `X-Session-Id` | string | No | Session ID for conversation continuity (auto-generated if not provided) |
| `X-Correlation-ID` | string | No | Request tracking ID (auto-generated if not provided) |

#### Response Format

```json
{
  "status": "success",
  "data": {
    "prompt": "Your original prompt",
    "userId": "user-123",
    "sessionId": "session-456",
    "synthesis": {
      "content": "Synthesized response combining all AI models",
      "confidence": 0.89,
      "qualityScore": 0.85,
      "metadata": {
        "model": "gpt-4o",
        "provider": "openai",
        "processingTimeMs": 1250,
        "tokenCount": 45
      }
    },
    "roles": [
      {
        "role": "gpt4o",
        "content": "GPT-4o response",
        "confidence": 0.89,
        "quality": 0.85,
        "metadata": {
          "model": "gpt-4o-mini",
          "provider": "openai",
          "processingTimeMs": 850,
          "tokenCount": 38,
          "status": "fulfilled"
        }
      }
    ],
    "metadata": {
      "totalProcessingTimeMs": 2850,
      "memoryContextUsed": true,
      "memoryTokensUsed": 156,
      "memoryEntriesUsed": 3,
      "memoryContextReason": null,
      "confidenceAnalysis": {
        "averageConfidence": 0.89,
        "confidenceRange": 0.05,
        "highConfidenceResponses": 3
      },
      "costEstimate": {
        "totalCost": 0.0085,
        "breakdown": {
          "gpt4o": 0.0032,
          "gemini": 0.0018,
          "claude": 0.0015,
          "synthesis": 0.0020
        }
      },
      "tier": "free",
      "responseQuality": 0.85,
      "correlationId": "correlation-789",
      "successfulRoles": 3,
      "totalRoles": 3
    }
  },
  "correlationId": "correlation-789"
}
```

## Response Field Descriptions

### Root Level Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Response status: "success" or "error" |
| `data` | object | Main response data containing all results |
| `correlationId` | string | Request tracking identifier |

### Data Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `prompt` | string | The original user prompt |
| `userId` | string | User identifier from request headers |
| `sessionId` | string | Session identifier for conversation continuity |
| `synthesis` | object | Final synthesized response combining all AI models |
| `roles` | array | Individual responses from each AI model |
| `metadata` | object | Processing metrics, memory info, and performance data |

### Synthesis Object

| Field | Type | Description |
|-------|------|-------------|
| `content` | string | The final synthesized response text |
| `confidence` | number | Overall confidence score (0-1) |
| `qualityScore` | number | Response quality assessment (0-1) |
| `metadata` | object | Processing details for the synthesis |

### Roles Array

Each role object contains:

| Field | Type | Description |
|-------|------|-------------|
| `role` | string | AI model identifier ("gpt4o", "gemini", "claude") |
| `content` | string | Individual model's response |
| `confidence` | number | Model-specific confidence score (0-1) |
| `quality` | number | Response quality score (0-1) |
| `metadata` | object | Model processing details |

### Metadata Object

| Field | Type | Description |
|-------|------|-------------|
| `totalProcessingTimeMs` | number | Total request processing time in milliseconds |
| `memoryContextUsed` | boolean | Whether conversation memory was used |
| `memoryTokensUsed` | number | Number of tokens used for memory context |
| `memoryEntriesUsed` | number | Number of conversation entries used for context |
| `memoryContextReason` | string | Reason if memory context was disabled |
| `confidenceAnalysis` | object | Detailed confidence metrics |
| `costEstimate` | object | API usage cost breakdown |
| `tier` | string | User tier ("free" or "premium") |
| `responseQuality` | number | Overall response quality score (0-1) |
| `correlationId` | string | Request tracking ID |
| `successfulRoles` | number | Number of AI models that responded successfully |
| `totalRoles` | number | Total number of AI models attempted |

## Memory System

The API automatically maintains conversation history within sessions:

- **Session-scoped**: Memory is isolated per session ID
- **Automatic storage**: User prompts and AI responses are automatically stored
- **Context integration**: Previous conversation turns are included in AI prompts
- **Token management**: Memory context is limited to prevent token overflow

## Error Handling

### Error Response Format

```json
{
  "status": "error",
  "message": "Error description",
  "correlationId": "correlation-789",
  "timestamp": "2025-01-20T12:00:00.000Z"
}
```

### Common Error Codes

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid prompt or parameters |
| 429 | Rate Limit Exceeded - Too many requests |
| 500 | Internal Server Error - Processing failure |

## Rate Limits

- **Free Tier**: 25 requests per hour
- **Premium Tier**: Higher limits (contact for details)

## Example Usage

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function callNeuraStackAPI(prompt, userId, sessionId) {
  try {
    const response = await axios.post('http://localhost:8080/default-ensemble', {
      prompt: prompt
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
        'X-Session-Id': sessionId
      },
      timeout: 30000
    });
    
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
const result = await callNeuraStackAPI(
  "What are the benefits of microservices architecture?",
  "user-123",
  "session-456"
);

console.log('Synthesis:', result.data.synthesis.content);
console.log('Confidence:', result.data.synthesis.confidence);
```

### Python

```python
import requests
import json

def call_neurastack_api(prompt, user_id, session_id):
    url = "http://localhost:8080/default-ensemble"
    
    headers = {
        "Content-Type": "application/json",
        "X-User-Id": user_id,
        "X-Session-Id": session_id
    }
    
    data = {
        "prompt": prompt
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"API Error: {e}")
        raise

# Usage
result = call_neurastack_api(
    "Explain the differences between REST and GraphQL",
    "user-123",
    "session-456"
)

print("Synthesis:", result["data"]["synthesis"]["content"])
print("Confidence:", result["data"]["synthesis"]["confidence"])
```

## Best Practices

1. **Session Management**: Use consistent session IDs for conversation continuity
2. **Error Handling**: Always implement proper error handling for API calls
3. **Timeout**: Set appropriate timeouts (recommended: 30 seconds)
4. **Rate Limiting**: Implement client-side rate limiting to avoid 429 errors
5. **Memory Efficiency**: Let the API handle memory management automatically
6. **Confidence Scores**: Use confidence scores to determine response reliability

## Additional Endpoints

### Health Check

#### GET /health

Check the API server status and basic functionality.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "message": "NeuraStack Backend is running",
  "timestamp": "2025-01-20T12:00:00.000Z",
  "version": "4.0"
}
```

### Memory Management

#### POST /memory/store

Manually store conversation entries (usually handled automatically).

```http
POST /memory/store
Content-Type: application/json

{
  "userId": "user-123",
  "sessionId": "session-456",
  "content": "User message or AI response",
  "isUserPrompt": true,
  "responseQuality": 0.8,
  "modelUsed": "user",
  "ensembleMode": false
}
```

#### POST /memory/retrieve

Retrieve conversation history for a session.

```http
POST /memory/retrieve
Content-Type: application/json

{
  "userId": "user-123",
  "sessionId": "session-456",
  "maxResults": 10
}
```

#### POST /memory/context

Get formatted memory context for AI prompts.

```http
POST /memory/context
Content-Type: application/json

{
  "userId": "user-123",
  "sessionId": "session-456",
  "maxTokens": 1000
}
```

### System Metrics

#### GET /metrics

Get detailed system performance metrics.

```http
GET /metrics
```

**Response includes:**
- System performance metrics
- Vendor API status
- Ensemble processing statistics
- Memory usage information

## Conversation Flow Example

Here's how to implement a complete conversation flow:

```javascript
class NeuraStackClient {
  constructor(baseUrl, userId) {
    this.baseUrl = baseUrl;
    this.userId = userId;
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return `session_${this.userId}_${Date.now()}`;
  }

  async sendMessage(prompt) {
    try {
      const response = await axios.post(`${this.baseUrl}/default-ensemble`, {
        prompt: prompt
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': this.userId,
          'X-Session-Id': this.sessionId
        },
        timeout: 30000
      });

      return {
        success: true,
        message: response.data.data.synthesis.content,
        confidence: response.data.data.synthesis.confidence,
        memoryUsed: response.data.data.metadata.memoryContextUsed,
        processingTime: response.data.data.metadata.totalProcessingTimeMs
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async getConversationHistory() {
    try {
      const response = await axios.post(`${this.baseUrl}/memory/retrieve`, {
        userId: this.userId,
        sessionId: this.sessionId,
        maxResults: 20
      });

      return response.data.memories || [];
    } catch (error) {
      console.error('Failed to retrieve conversation history:', error);
      return [];
    }
  }
}

// Usage example
const client = new NeuraStackClient('http://localhost:8080', 'user-123');

// Send first message
const response1 = await client.sendMessage("What is machine learning?");
console.log('AI:', response1.message);

// Send follow-up message (will use conversation context)
const response2 = await client.sendMessage("How does it differ from traditional programming?");
console.log('AI:', response2.message);
console.log('Used memory context:', response2.memoryUsed);

// Get full conversation history
const history = await client.getConversationHistory();
console.log('Conversation history:', history);
```

## Advanced Configuration

### Environment Variables

The API behavior can be configured using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_CONTEXT_ENABLED` | `true` | Enable/disable conversation memory |
| `MEMORY_CLEANUP_INTERVAL_HOURS` | `24` | Hours between memory cleanup |
| `NEURASTACK_TIER` | `free` | API tier configuration |
| `RATE_LIMIT_MAX` | `100` | Maximum requests per window |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in milliseconds |

### Response Quality Indicators

Use these fields to assess response quality:

- **Confidence Score (0-1)**: Higher values indicate more reliable responses
- **Quality Score (0-1)**: Assessment of response structure and content
- **Model Agreement**: How much the different AI models agreed
- **Memory Context Used**: Whether conversation history was considered
- **Processing Time**: Faster responses may indicate cached or simpler queries

## Troubleshooting

### Common Issues

1. **Memory Context Not Working**
   - Ensure `MEMORY_CONTEXT_ENABLED=true` in environment
   - Check that session IDs are consistent across requests
   - Verify automatic memory storage is functioning

2. **Rate Limiting**
   - Implement exponential backoff for 429 errors
   - Monitor your request frequency
   - Consider upgrading to premium tier for higher limits

3. **Low Confidence Scores**
   - May indicate ambiguous or complex queries
   - Consider rephrasing the prompt for clarity
   - Check if multiple models disagreed significantly

4. **Timeout Errors**
   - Increase client timeout to 30+ seconds
   - Complex queries may take longer to process
   - Check server health and model availability

## Support

For technical support or questions about the API integration, please refer to the project documentation or contact the development team.
