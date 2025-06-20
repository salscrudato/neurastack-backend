# NeuraStack Caching System

## Overview

The NeuraStack backend implements a sophisticated caching system designed to optimize costs and improve performance by reducing redundant API calls to expensive AI models. The system supports both Redis (for production) and in-memory caching (for development/fallback).

## Architecture

### Dual-Layer Caching
- **Primary**: Redis (when available) - Persistent, shared across instances
- **Fallback**: In-memory cache - Local to each instance, automatic fallback

### Cache Types
1. **Ensemble Responses** - TTL: 5 minutes
2. **Workout Plans** - TTL: 30 minutes  
3. **Memory Queries** - TTL: 10 minutes
4. **Cost Estimates** - TTL: 1 minute
5. **Health Checks** - TTL: 30 seconds

## Configuration

### Environment Variables
```bash
# Optional - Redis URL for persistent caching
REDIS_URL=redis://localhost:6379
# or for cloud Redis:
REDIS_URL=redis://username:password@host:port
```

### Default TTL Settings
```javascript
{
  ensemble: 300,      // 5 minutes for ensemble responses
  workout: 1800,      // 30 minutes for workout plans
  memory: 600,        // 10 minutes for memory queries
  cost: 60,           // 1 minute for cost estimates
  health: 30          // 30 seconds for health checks
}
```

## API Endpoints

### Cache Statistics
```http
GET /cache/stats
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "cache": {
      "hits": 150,
      "misses": 50,
      "sets": 200,
      "deletes": 10,
      "errors": 2,
      "hitRate": "75.00%",
      "memoryEntries": 45,
      "redisAvailable": true
    },
    "performance": {
      "description": "Cache hit rate indicates the percentage of requests served from cache",
      "recommendation": "Good cache performance"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Cache Management
```http
POST /cache/clear
Content-Type: application/json

{
  "pattern": "ensemble"  // Optional: clear specific pattern
}
```

**Clear All Cache:**
```json
{}
```

**Clear Pattern-Specific Cache:**
```json
{
  "pattern": "workout"
}
```

## Caching Strategy

### Cache Keys
Cache keys are generated using SHA-256 hashes of input parameters:
```
Format: {prefix}:{hash}
Examples:
- ensemble:a1b2c3d4e5f6g7h8
- workout:x9y8z7w6v5u4t3s2
- cost:m1n2o3p4q5r6s7t8
```

### Cache Invalidation
- **Time-based**: Automatic expiration based on TTL
- **Pattern-based**: Manual invalidation by prefix
- **Quality-based**: Only cache high-quality responses (quality > 0.6)

### Cache Conditions

#### Ensemble Responses
- **Cached when**: Response quality > 0.6 and synthesis status = 'success'
- **Key factors**: User prompt, user ID, tier
- **Benefits**: Reduces cost by ~70% for repeated queries

#### Workout Plans
- **Cached when**: Successful generation
- **Key factors**: User metadata, workout history
- **Benefits**: Faster response for similar user profiles

#### Cost Estimates
- **Cached when**: Always (lightweight calculation)
- **Key factors**: Prompt content, tier
- **Benefits**: Instant cost feedback

## Performance Impact

### Cost Savings
- **Cache Hit**: $0.00 (no API calls)
- **Cache Miss**: Full API cost ($0.008-0.25 per request)
- **Expected Savings**: 40-60% cost reduction with 50%+ hit rate

### Response Time Improvements
- **Cached Response**: ~50-100ms
- **Fresh Response**: 5-30 seconds
- **Performance Gain**: 50-600x faster for cached responses

### Memory Usage
- **In-Memory Cache**: ~1-5MB typical usage
- **Redis**: Minimal local memory impact
- **Cleanup**: Automatic expired entry removal every 5 minutes

## Monitoring and Observability

### Key Metrics
- **Hit Rate**: Percentage of requests served from cache
- **Miss Rate**: Percentage requiring fresh API calls
- **Error Rate**: Cache operation failures
- **Memory Usage**: Current cache size

### Logging
All cache operations are logged with appropriate levels:
- **INFO**: Cache hits, successful operations
- **WARN**: Cache misses, fallback scenarios
- **ERROR**: Cache failures, connection issues

### Health Checks
Cache health is included in system health endpoints:
```http
GET /health-detailed
```

## Best Practices

### Development
1. **Local Development**: Works without Redis using in-memory cache
2. **Testing**: Cache can be cleared between tests
3. **Debugging**: Enable cache logging for troubleshooting

### Production
1. **Redis Setup**: Use managed Redis service (AWS ElastiCache, Google Cloud Memorystore)
2. **Monitoring**: Set up alerts for low hit rates or high error rates
3. **Scaling**: Redis supports multiple backend instances

### Optimization
1. **Hit Rate Target**: Aim for >50% hit rate
2. **TTL Tuning**: Adjust based on content freshness requirements
3. **Memory Limits**: Monitor and adjust cache size limits

## Troubleshooting

### Common Issues

#### Redis Connection Failed
```
⚠️ Redis connection refused, using memory cache
```
**Solution**: Check Redis URL and service availability

#### Low Hit Rate
```
Cache hit rate: 15%
```
**Solutions**:
- Increase TTL for stable content
- Review cache key generation
- Check if users are making similar requests

#### High Memory Usage
```
Memory cache entries: 10000+
```
**Solutions**:
- Enable Redis to offload memory
- Reduce TTL values
- Implement cache size limits

### Debug Commands

#### Check Cache Stats
```bash
curl http://localhost:8080/cache/stats
```

#### Clear All Cache
```bash
curl -X POST http://localhost:8080/cache/clear \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Clear Specific Pattern
```bash
curl -X POST http://localhost:8080/cache/clear \
  -H "Content-Type: application/json" \
  -d '{"pattern": "ensemble"}'
```

## Future Enhancements

### Planned Features
1. **Cache Warming**: Pre-populate cache with common queries
2. **Intelligent TTL**: Dynamic TTL based on content type and usage patterns
3. **Distributed Caching**: Multi-region cache synchronization
4. **Cache Analytics**: Detailed usage patterns and optimization recommendations

### Integration Opportunities
1. **CDN Integration**: Cache static responses at edge locations
2. **Database Caching**: Cache database query results
3. **API Response Compression**: Reduce cache storage requirements
4. **Smart Invalidation**: Context-aware cache invalidation strategies

## Security Considerations

### Data Privacy
- Cache keys use hashes, not raw user data
- Sensitive information is not stored in cache keys
- User-specific data is isolated by user ID

### Access Control
- Cache management endpoints should be restricted in production
- Redis should be secured with authentication
- Network access should be limited to backend services

### Compliance
- Cache TTL ensures data freshness requirements
- User data can be purged on request
- Audit logging for cache operations
