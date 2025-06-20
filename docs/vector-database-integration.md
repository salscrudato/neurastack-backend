# NeuraStack Vector Database Integration

## Overview

The NeuraStack backend integrates vector database capabilities to enable semantic similarity search for memory retrieval. This system uses embeddings to find contextually relevant memories based on semantic meaning rather than just keyword matching.

## Architecture

### Multi-Provider Support
- **Pinecone**: Cloud-native vector database (production recommended)
- **Weaviate**: Open-source vector database (self-hosted option)
- **In-Memory**: Fallback option using local storage (development/testing)

### Embedding Generation
- **Model**: OpenAI `text-embedding-ada-002`
- **Dimension**: 1536 dimensions
- **Caching**: Automatic embedding caching to reduce API calls
- **Input Limit**: 8000 characters per text

### Similarity Search
- **Algorithm**: Cosine similarity
- **Threshold**: Configurable (default: 0.7)
- **Results**: Ranked by similarity score
- **Filtering**: By user ID and memory types

## Configuration

### Environment Variables

```bash
# Vector database provider
VECTOR_DB_PROVIDER=memory  # 'pinecone', 'weaviate', or 'memory'

# Pinecone configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=us-west1-gcp
PINECONE_INDEX=neurastack-memories

# Weaviate configuration  
WEAVIATE_URL=localhost:8080
WEAVIATE_SCHEME=http
WEAVIATE_API_KEY=your_weaviate_api_key_here
```

### Default Settings

```javascript
{
  dimension: 1536,           // OpenAI embedding dimension
  maxResults: 10,            // Maximum search results
  similarityThreshold: 0.7,  // Minimum similarity score
  cacheSize: 1000           // Embedding cache size
}
```

## API Endpoints

### Vector Database Statistics
```http
GET /vector/stats
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "vectorDatabase": {
      "provider": "memory",
      "isAvailable": true,
      "memoryStoreSize": 150,
      "embeddingCacheSize": 45,
      "config": {
        "dimension": 1536,
        "maxResults": 10,
        "similarityThreshold": 0.7,
        "cacheSize": 1000
      }
    },
    "capabilities": {
      "semanticSearch": true,
      "embeddingGeneration": true,
      "similarityThreshold": 0.7,
      "maxResults": 10
    }
  }
}
```

### Vector Database Health Check
```http
GET /vector/health
```

**Response:**
```json
{
  "status": "healthy",
  "provider": "memory",
  "isAvailable": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Semantic Search Test
```http
POST /vector/search
Content-Type: application/json

{
  "query": "How to optimize API performance?",
  "userId": "user123",
  "maxResults": 5,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "query": "How to optimize API performance?",
    "results": [
      {
        "id": "memory-uuid-1",
        "score": 0.89,
        "content": "API optimization involves caching, connection pooling, and efficient queries...",
        "metadata": {
          "timestamp": 1705312200000,
          "memoryType": "semantic"
        }
      }
    ],
    "totalResults": 3,
    "searchParams": {
      "maxResults": 5,
      "threshold": 0.7,
      "userId": "user123"
    }
  }
}
```

## Integration with Memory System

### Automatic Vector Storage

When memories are stored, vectors are automatically generated and stored:

```javascript
// Memory storage automatically includes vector generation
await memoryManager.storeMemory(
  userId, 
  sessionId, 
  content, 
  isUserPrompt, 
  responseQuality
);
// Vector is automatically stored in parallel
```

### Enhanced Memory Context

The memory context retrieval now uses semantic search:

```javascript
// Enhanced context retrieval with semantic search
const context = await memoryManager.getMemoryContext(
  userId, 
  sessionId, 
  maxTokens, 
  currentPrompt  // Used for semantic matching
);
```

### Search Priority

1. **Semantic Search**: If current prompt provided and vector DB available
2. **Traditional Search**: Fallback using keyword matching and weights
3. **Hybrid Results**: Combines both approaches for optimal relevance

## Provider-Specific Setup

### Pinecone Setup

1. **Create Account**: Sign up at [pinecone.io](https://pinecone.io)
2. **Create Index**: 
   ```bash
   # Index configuration
   Name: neurastack-memories
   Dimensions: 1536
   Metric: cosine
   ```
3. **Environment Variables**:
   ```bash
   VECTOR_DB_PROVIDER=pinecone
   PINECONE_API_KEY=your_api_key
   PINECONE_ENVIRONMENT=us-west1-gcp
   PINECONE_INDEX=neurastack-memories
   ```

### Weaviate Setup

1. **Docker Installation**:
   ```bash
   docker run -d \
     --name weaviate \
     -p 8080:8080 \
     -e QUERY_DEFAULTS_LIMIT=25 \
     -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \
     -e PERSISTENCE_DATA_PATH='/var/lib/weaviate' \
     semitechnologies/weaviate:latest
   ```

2. **Environment Variables**:
   ```bash
   VECTOR_DB_PROVIDER=weaviate
   WEAVIATE_URL=localhost:8080
   WEAVIATE_SCHEME=http
   ```

### In-Memory Setup

No additional setup required - works out of the box:
```bash
VECTOR_DB_PROVIDER=memory
```

## Performance Characteristics

### Embedding Generation
- **Latency**: ~200-500ms per text
- **Cost**: ~$0.0001 per 1K tokens
- **Caching**: Reduces repeated generation by 80-90%

### Search Performance

| Provider | Latency | Scalability | Cost |
|----------|---------|-------------|------|
| Pinecone | 50-200ms | Excellent | $0.096/1M queries |
| Weaviate | 10-100ms | Good | Self-hosted |
| Memory | 1-10ms | Limited | Free |

### Memory Usage

- **In-Memory Store**: ~1KB per vector
- **Embedding Cache**: ~6KB per cached embedding
- **Typical Usage**: 10-50MB for 10K memories

## Quality Improvements

### Semantic Understanding

Traditional keyword search vs. semantic search:

**Query**: "How to speed up database queries?"

**Keyword Match**: Finds memories containing "speed", "database", "queries"
**Semantic Match**: Finds memories about:
- Query optimization
- Database indexing
- Performance tuning
- Connection pooling
- Caching strategies

### Context Relevance

Semantic search provides more relevant context by understanding:
- **Intent**: What the user is trying to accomplish
- **Concepts**: Related technical concepts and terminology
- **Relationships**: How different topics connect

## Monitoring and Observability

### Logging

Vector operations are logged with appropriate levels:
```
📊 Vector stored: memory-uuid-1 (pinecone)
🔍 Vector search: 3 results (threshold: 0.7)
⚠️ Vector search failed, falling back to traditional retrieval
```

### Metrics

Key metrics tracked:
- Vector storage success rate
- Search latency and accuracy
- Embedding cache hit rate
- Provider availability

### Health Monitoring

Vector database health is included in system health checks:
```http
GET /health-detailed
```

## Best Practices

### Development

1. **Start with Memory Provider**: Use in-memory for development
2. **Test Semantic Search**: Use `/vector/search` endpoint for testing
3. **Monitor Embedding Costs**: Track OpenAI API usage
4. **Cache Optimization**: Monitor cache hit rates

### Production

1. **Use Pinecone**: Recommended for production deployments
2. **Monitor Performance**: Set up alerts for search latency
3. **Backup Strategy**: Ensure vector data is backed up
4. **Scaling**: Plan for vector storage growth

### Optimization

1. **Embedding Caching**: Maximize cache hit rates
2. **Batch Operations**: Process multiple vectors together
3. **Threshold Tuning**: Adjust similarity thresholds based on use case
4. **Result Filtering**: Use appropriate filters to reduce search space

## Troubleshooting

### Common Issues

**Vector Search Not Working:**
- Check provider configuration
- Verify API keys and connectivity
- Review similarity threshold settings

**Poor Search Results:**
- Lower similarity threshold
- Check embedding quality
- Verify memory content relevance

**High Latency:**
- Check provider performance
- Optimize embedding caching
- Consider result count limits

### Debug Commands

```bash
# Test vector database health
curl http://localhost:8080/vector/health

# Check vector statistics
curl http://localhost:8080/vector/stats

# Test semantic search
curl -X POST http://localhost:8080/vector/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test query", "maxResults": 3}'
```

## Future Enhancements

### Planned Features

1. **Multi-Modal Embeddings**: Support for image and audio content
2. **Custom Models**: Fine-tuned embeddings for domain-specific content
3. **Hybrid Search**: Combine semantic and keyword search
4. **Real-Time Updates**: Live vector updates for dynamic content

### Integration Opportunities

1. **RAG Systems**: Retrieval-Augmented Generation
2. **Recommendation Engine**: Content and user recommendations
3. **Clustering**: Automatic content categorization
4. **Anomaly Detection**: Identify unusual patterns in memories

## Security Considerations

### Data Privacy

- Embeddings don't contain raw text but preserve semantic meaning
- Vector data should be encrypted at rest and in transit
- Access controls should match memory access permissions

### API Security

- Vector database credentials should be secured
- Rate limiting on embedding generation
- Audit logging for vector operations

### Compliance

- GDPR: Vector data can be deleted on user request
- Data residency: Choose appropriate provider regions
- Retention: Align vector retention with memory retention policies
