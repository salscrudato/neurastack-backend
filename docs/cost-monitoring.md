# NeuraStack Cost Monitoring & Dynamic Model Selection

## Overview

The NeuraStack backend includes a comprehensive cost monitoring system that tracks API usage, analyzes model performance, and provides dynamic model selection recommendations to optimize cost-effectiveness while maintaining quality.

## Features

### Real-Time Cost Tracking
- **Per-API Call Monitoring**: Tracks cost, response time, and quality for every AI model call
- **Hourly/Daily/Monthly Aggregation**: Provides cost breakdowns across different time periods
- **Model Performance Analysis**: Calculates cost efficiency (quality per dollar) for each model
- **Automatic Alerts**: Warns when approaching cost thresholds

### Dynamic Model Selection
- **Performance-Based Recommendations**: Suggests optimal models based on historical performance
- **Cost Efficiency Scoring**: Ranks models by quality-to-cost ratio
- **Trend Analysis**: Identifies performance patterns over time
- **Automatic Optimization**: Can automatically switch to more cost-effective models

### Persistent Data Storage
- **Local File Persistence**: Saves cost data to disk for analysis across restarts
- **Historical Analysis**: Maintains performance history for trend identification
- **Data Cleanup**: Automatically removes old data to prevent storage bloat

## Configuration

### Environment Variables

```bash
# Cost limits (in USD)
DAILY_COST_LIMIT=10.0          # Maximum daily spending
HOURLY_COST_LIMIT=2.0          # Maximum hourly spending  
MONTHLY_COST_LIMIT=200.0       # Maximum monthly spending

# Dynamic model selection
DYNAMIC_MODEL_SELECTION=true   # Enable automatic model recommendations
```

### Default Settings

```javascript
{
  thresholds: {
    dailyLimit: 10.0,
    hourlyLimit: 2.0,
    monthlyLimit: 200.0
  },
  modelSelection: {
    enabled: true,
    performanceWindow: 24 * 60 * 60 * 1000, // 24 hours
    minSampleSize: 10,
    costEfficiencyThreshold: 0.8
  }
}
```

## API Endpoints

### Cost Report
```http
GET /cost/report
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "costs": {
      "today": 2.45,
      "thisHour": 0.32,
      "dailyLimit": 10.0,
      "hourlyLimit": 2.0,
      "utilizationPercent": {
        "daily": "24.5",
        "hourly": "16.0"
      }
    },
    "modelPerformance": [
      {
        "model": "openai-gpt-4o-mini",
        "rank": 1,
        "calls": 45,
        "averageCost": 0.0023,
        "averageResponseTime": 1250,
        "averageQuality": 0.85,
        "costEfficiency": 369.57
      }
    ],
    "recommendations": [
      {
        "model": "openai-gpt-4o-mini",
        "costEfficiency": 369.57,
        "recommendation": "Excellent cost efficiency - highly recommended"
      }
    ],
    "settings": {
      "dynamicSelectionEnabled": true,
      "thresholds": {
        "dailyLimit": 10.0,
        "hourlyLimit": 2.0,
        "monthlyLimit": 200.0
      }
    }
  }
}
```

### Cost Optimization Recommendations
```http
GET /cost/recommendations
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "recommendations": [
      {
        "type": "model_optimization",
        "priority": "medium",
        "message": "openai-gpt-4o-mini shows best cost efficiency",
        "action": "Consider using openai-gpt-4o-mini for similar workloads"
      },
      {
        "type": "budget_projection",
        "priority": "info",
        "message": "Projected monthly cost: $73.50",
        "action": "Monitor usage patterns and adjust limits if needed"
      }
    ],
    "summary": {
      "totalRecommendations": 2,
      "highPriority": 0,
      "costOptimizationOpportunities": 1
    }
  }
}
```

## Cost Calculation

### Model Pricing (per 1K tokens)

| Model | Input Cost | Output Cost |
|-------|------------|-------------|
| GPT-4o-mini | $0.00015 | $0.0006 |
| GPT-4o | $0.005 | $0.015 |
| O1-preview | $0.015 | $0.06 |
| Gemini 1.5 Flash | $0.000075 | $0.0003 |
| Gemini 2.0 Flash | $0.001 | $0.004 |
| Claude 3 Haiku | $0.00025 | $0.00125 |
| Claude Opus 4 | $0.015 | $0.075 |

### Cost Efficiency Formula

```
Cost Efficiency = Average Quality / (Average Cost * 1000)
```

Higher values indicate better cost efficiency (more quality per dollar).

## Performance Metrics

### Quality Scoring

Quality is calculated based on multiple factors:

**Ensemble Responses:**
- Response time (faster = higher quality)
- Error count (fewer errors = higher quality)
- Content length (optimal range = higher quality)
- Ensemble mode bonus

**Workout Plans:**
- JSON structure validity
- Required fields presence
- Exercise count (4-12 optimal)
- Warmup/cooldown inclusion
- Instruction detail level

### Model Performance Tracking

For each model, the system tracks:
- **Total API calls**
- **Average cost per call**
- **Average response time**
- **Average quality score**
- **Cost efficiency ratio**
- **Recent performance samples**

## Alerts and Thresholds

### Cost Alerts

**Hourly Limit Warning:**
```
🚨 Cost Alert: hourly_limit_exceeded - $2.15 exceeds limit of $2.00
```

**Daily Limit Critical:**
```
🚨 Cost Alert: daily_limit_exceeded - $10.50 exceeds limit of $10.00
```

### Model Recommendations

When dynamic selection is enabled, the system provides recommendations:

```javascript
{
  recommended: "openai-gpt-4o-mini",
  reason: "Higher cost efficiency",
  improvement: "25.3% better cost efficiency"
}
```

## Data Persistence

### Storage Location
```
data/cost-monitoring.json
```

### Data Structure
```json
{
  "daily": {
    "2024-01-15": 2.45
  },
  "hourly": {
    "2024-01-15-10": 0.32
  },
  "modelMetrics": {
    "openai-gpt-4o-mini": {
      "calls": 45,
      "totalCost": 0.103,
      "averageCost": 0.0023,
      "costEfficiency": 369.57
    }
  },
  "totalCosts": {
    "today": 2.45,
    "thisHour": 0.32,
    "thisMonth": 73.50
  }
}
```

### Automatic Cleanup

- **Data Retention**: 7 days for detailed metrics
- **Cleanup Frequency**: Every hour
- **Persistence**: Every 5 minutes
- **Daily Reports**: Generated automatically

## Integration

### Ensemble Runner Integration

Cost tracking is automatically integrated into:
- Individual AI model calls
- Synthesis operations
- Response quality assessment

### Workout Service Integration

Tracks costs for:
- Workout plan generation
- Model performance analysis
- Quality scoring based on JSON structure

## Monitoring and Observability

### Logging

All cost operations are logged:
```
💰 API Call Tracked: gpt-4o-mini - $0.0023 (1250ms, Q:0.85)
📊 Daily Cost Report: totalCost: $2.45, dailyUtilization: 24.5%
```

### Health Checks

Cost monitoring health is included in system health endpoints.

### Metrics Collection

- Real-time cost accumulation
- Performance trend analysis
- Model efficiency rankings
- Usage pattern identification

## Best Practices

### Cost Optimization

1. **Monitor Daily Reports**: Review cost patterns regularly
2. **Use Caching**: Implement response caching for repeated queries
3. **Model Selection**: Choose models based on cost efficiency rankings
4. **Set Appropriate Limits**: Configure realistic cost thresholds
5. **Quality vs Cost**: Balance quality requirements with cost constraints

### Performance Tuning

1. **Sample Size**: Ensure sufficient data for reliable recommendations
2. **Time Windows**: Adjust performance windows based on usage patterns
3. **Threshold Tuning**: Calibrate cost efficiency thresholds
4. **Alert Configuration**: Set up appropriate alert levels

### Production Deployment

1. **Monitoring Setup**: Configure cost alerts and dashboards
2. **Data Backup**: Regularly backup cost monitoring data
3. **Capacity Planning**: Use projections for budget planning
4. **Performance Reviews**: Regular analysis of model performance trends

## Troubleshooting

### Common Issues

**High Costs:**
- Check for inefficient model usage
- Review cache hit rates
- Analyze request patterns

**Low Quality Scores:**
- Investigate model performance
- Check response validation logic
- Review quality calculation parameters

**Missing Data:**
- Verify file permissions for data directory
- Check disk space availability
- Review error logs for persistence issues

### Debug Commands

```bash
# Check cost report
curl http://localhost:8080/cost/report

# Get recommendations
curl http://localhost:8080/cost/recommendations

# View detailed health
curl http://localhost:8080/health-detailed
```
