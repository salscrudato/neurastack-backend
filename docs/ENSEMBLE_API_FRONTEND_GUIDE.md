# NeuraStack Ensemble API - Frontend Integration Guide

## Overview
The NeuraStack Ensemble API provides intelligent AI responses by combining outputs from multiple AI models (GPT-4o, Gemini, Claude) into a single, high-quality synthesized response with detailed analytics and confidence metrics.

## Base URLs
- **Production**: `https://neurastack-backend-638289111765.us-central1.run.app`
- **Development**: `http://localhost:8080`

---

## API Endpoint

### POST `/default-ensemble`

**Purpose**: Get an intelligent AI response synthesized from multiple models with comprehensive analytics

#### Request Structure
```javascript
{
  "prompt": "Your question or request here",  // Required: User's input
  "sessionId": "optional-session-id"         // Optional: Session continuity
}
```

#### Headers
```javascript
{
  "Content-Type": "application/json",
  "X-User-Id": "user-123",           // Optional: User identification
  "X-Session-Id": "session-456",     // Optional: Session tracking
  "X-Correlation-ID": "req-789"      // Optional: Request correlation
}
```

---

## Response Structure & Frontend Mapping

Based on your current UI implementation, here's how to extract and display the key metrics:

### 1. Header Badges (Top of Modal)
```javascript
// Extract from response
const response = await fetch('/default-ensemble', {...});
const data = response.data;

// Confidence Badge - Green badge showing "100% CONFIDENCE"
const confidenceScore = Math.round(data.synthesis.confidence.score * 100);
const confidenceLevel = data.synthesis.confidence.level; // "high", "medium", "low"
// Display: `${confidenceScore}% CONFIDENCE`

// Models Badge - Blue badge showing "2/3 MODELS" 
const successfulModels = data.metadata.successfulRoles;
const totalModels = data.metadata.totalRoles;
// Display: `${successfulModels}/${totalModels} MODELS`

// Response Badge - Purple badge showing "5S RESPONSE"
const responseTimeSeconds = Math.round(data.metadata.processingTimeMs / 1000);
// Display: `${responseTimeSeconds}S RESPONSE`
```

### 2. Overall Confidence Circle
```javascript
// Large circular progress indicator showing "100%"
const overallConfidence = Math.round(data.metadata.confidenceAnalysis.overallConfidence * 100);
// Display: `${overallConfidence}%` with circular progress bar
// Label: "Overall Confidence"
```

### 3. Consensus Strength Section
```javascript
// Consensus strength indicator with "WEAK" label
const modelAgreement = data.metadata.confidenceAnalysis.modelAgreement;
const consensusLevel = modelAgreement > 0.8 ? "STRONG" : 
                      modelAgreement > 0.6 ? "MODERATE" : "WEAK";
const consensusPercentage = Math.round(modelAgreement * 100);

// Display: consensusLevel as badge (e.g., "WEAK")
// Label: "Consensus Strength"
// Subtitle: "Model agreement level"
```

### 4. Winning Model Section
```javascript
// Find the highest scoring model response
const winningRole = data.roles.reduce((prev, current) => 
  (prev.confidence.score > current.confidence.score) ? prev : current
);

const winnerExists = winningRole.confidence.score > 0.7; // Threshold for "winner"

if (winnerExists) {
  const winnerName = winningRole.model; // e.g., "gpt-4o-mini"
  const winnerScore = Math.round(winningRole.confidence.score * 100);
  // Display: winnerName and `${winnerScore}%`
} else {
  // Display: "No Winner" and "0%"
}

// Label: "Winning Model"
// Subtitle: "Best performing response"
```

### 5. Quality Distribution
```javascript
// Count high vs medium/low quality responses
const highQualityCount = data.roles.filter(role => role.qualityScore > 0.8).length;
const medLowQualityCount = data.roles.length - highQualityCount;

// Display two columns:
// Left: highQualityCount with "High Quality" label
// Right: medLowQualityCount with "Med/Low Quality" label
```

### 6. Response Analytics Grid
```javascript
// Response Time - with clock icon
const responseTime = `${Math.round(data.metadata.processingTimeMs / 1000)}s`;
// Display: responseTime with "RESPONSE TIME" label

// Success Rate - with target icon  
const successRate = Math.round((data.metadata.successfulRoles / data.metadata.totalRoles) * 100);
// Display: `${successRate}%` with "SUCCESS RATE" label

// Confidence - with trending up icon
const confidence = Math.round(data.synthesis.confidence.score * 100);
// Display: `${confidence}%` with "CONFIDENCE" label

// Agreement - with bar chart icon
const agreement = Math.round(data.metadata.confidenceAnalysis.modelAgreement * 100);
// Display: `${agreement}%` with "AGREEMENT" label

// Cost - with dollar icon
const cost = data.metadata.costEstimate.estimatedCost;
// Display: cost (e.g., "$0.112k") with "COST" label
```

### 7. Consistency Banner
```javascript
// Bottom banner showing consistency percentage
const consistency = Math.round(data.metadata.confidenceAnalysis.modelAgreement * 100);
// Display: `${consistency}% CONSISTENCY` in yellow banner
```

### 8. Fallback Provider Indicators
```javascript
// Check if any providers used fallback
const fallbacksUsed = data.roles.filter(role => role.isFallback).length;
const totalProviders = data.roles.length;

// Display fallback status
data.roles.forEach(role => {
  if (role.isFallback) {
    // Show fallback indicator
    const fallbackText = `${role.originalProvider} → ${role.fallbackProvider}`;
    // Display: "FALLBACK USED" badge or icon
    // Tooltip: `Original ${role.originalProvider} failed, using ${role.fallbackModel} fallback`
  }
});

// Overall fallback summary
if (fallbacksUsed > 0) {
  // Display: `${fallbacksUsed}/${totalProviders} providers using fallback`
  // Status: "System running on backup providers"
} else {
  // Display: "All primary providers operational"
}
```

---

## Complete Response Structure

```javascript
{
  "status": "success",
  "data": {
    "prompt": "string",
    "userId": "string",
    "synthesis": {
      "content": "string",                    // Main response to display
      "model": "gpt-4o",
      "provider": "openai", 
      "status": "success",
      "confidence": {
        "score": 0.85,                      // For confidence calculations
        "level": "high",                    // For confidence level display
        "factors": ["model_agreement"]
      },
      "qualityScore": 0.92                  // For quality analysis
    },
    "roles": [                              // Individual model responses
      {
        "role": "primary",
        "content": "string",
        "model": "gpt-4o-mini",            // For winner determination
        "provider": "openai",
        "status": "success",
        "confidence": {
          "score": 0.88,                    // For winner scoring
          "level": "high"
        },
        "qualityScore": 0.90,               // For quality distribution
        "isFallback": false,                // Indicates if fallback provider was used
        "originalProvider": "claude",       // Original provider (only if isFallback: true)
        "fallbackProvider": "openai",       // Fallback provider (only if isFallback: true)
        "fallbackModel": "gpt-4o-mini",     // Fallback model (only if isFallback: true)
        "metadata": {
          "tokens": 150,
          "responseTime": 2.3
        }
      }
    ],
    "metadata": {
      "totalRoles": 3,                      // For models badge
      "successfulRoles": 3,                 // For models badge & success rate
      "processingTimeMs": 8500,             // For response time
      "confidenceAnalysis": {
        "overallConfidence": 0.85,          // For overall confidence circle
        "modelAgreement": 0.78              // For consensus & agreement metrics
      },
      "costEstimate": {
        "totalTokens": 1250,
        "estimatedCost": "$0.0045"          // For cost display
      }
    }
  },
  "timestamp": "2025-06-22T10:30:00Z",
  "correlationId": "req-12345"
}
```

---

## Frontend Implementation Example

```javascript
const EnsembleAnalytics = ({ ensembleResponse }) => {
  const { data } = ensembleResponse;
  
  // Extract metrics for UI
  const confidence = Math.round(data.synthesis.confidence.score * 100);
  const modelsUsed = `${data.metadata.successfulRoles}/${data.metadata.totalRoles}`;
  const responseTime = Math.round(data.metadata.processingTimeMs / 1000);
  const overallConfidence = Math.round(data.metadata.confidenceAnalysis.overallConfidence * 100);
  const modelAgreement = Math.round(data.metadata.confidenceAnalysis.modelAgreement * 100);
  
  // Find winning model
  const winner = data.roles.reduce((prev, current) => 
    (prev.confidence.score > current.confidence.score) ? prev : current
  );
  
  // Quality distribution
  const highQuality = data.roles.filter(role => role.qualityScore > 0.8).length;
  const medLowQuality = data.roles.length - highQuality;
  
  return (
    <div className="ensemble-analytics">
      {/* Header badges */}
      <div className="badges">
        <Badge color="green">{confidence}% CONFIDENCE</Badge>
        <Badge color="blue">{modelsUsed} MODELS</Badge>
        <Badge color="purple">{responseTime}S RESPONSE</Badge>
      </div>
      
      {/* Overall confidence circle */}
      <CircularProgress value={overallConfidence} />
      
      {/* Consensus strength */}
      <div className="consensus">
        <Badge>{modelAgreement > 60 ? 'STRONG' : 'WEAK'}</Badge>
        <p>Consensus Strength</p>
      </div>
      
      {/* Winner section */}
      <div className="winner">
        <h3>{winner.confidence.score > 0.7 ? winner.model : 'No Winner'}</h3>
        <p>{Math.round(winner.confidence.score * 100)}%</p>
      </div>
      
      {/* Quality distribution */}
      <div className="quality">
        <div>{highQuality} High Quality</div>
        <div>{medLowQuality} Med/Low Quality</div>
      </div>
      
      {/* Analytics grid */}
      <div className="analytics-grid">
        <Metric icon="clock" value={`${responseTime}s`} label="RESPONSE TIME" />
        <Metric icon="target" value={`${Math.round((data.metadata.successfulRoles/data.metadata.totalRoles)*100)}%`} label="SUCCESS RATE" />
        <Metric icon="trending" value={`${confidence}%`} label="CONFIDENCE" />
        <Metric icon="chart" value={`${modelAgreement}%`} label="AGREEMENT" />
        <Metric icon="dollar" value={data.metadata.costEstimate.estimatedCost} label="COST" />
      </div>
      
      {/* Consistency banner */}
      <div className="consistency-banner">
        {modelAgreement}% CONSISTENCY
      </div>
    </div>
  );
};
```

---

## Error Handling

```javascript
{
  "status": "error",
  "message": "Error description",
  "correlationId": "request-id", 
  "timestamp": "2025-06-22T10:30:00Z"
}
```

---

## Performance Notes

- **Response Time**: 5-15 seconds (multiple AI model calls)
- **Rate Limit**: 100 requests per 15 minutes per IP
- **Timeout**: 30 seconds maximum
- **Cost**: ~$0.002-0.015 per request depending on tier

This guide provides all the data paths and calculations needed to recreate the ensemble analytics UI shown in your screenshots.
