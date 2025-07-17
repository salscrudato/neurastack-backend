# 🎯 NeuraStack User Tier Management System

## 📋 Overview

The NeuraStack backend now includes a comprehensive user tier management system that allows users to be upgraded from the free tier to premium tier, providing enhanced AI capabilities and higher usage limits.

## 🆓 Free Tier vs ⭐ Premium Tier

### Free Tier Features:
- **Models**: GPT-4o-mini, Gemini 1.5 Flash, Claude 3.5 Haiku Latest
- **Rate Limits**: 25 requests/hour, 150 requests/day
- **Prompt Length**: Up to 5,000 characters
- **Features**: Basic ensemble, memory storage, caching
- **Cost**: $0/month

### Premium Tier Features:
- **Models**: GPT-4o (full model), Gemini 1.5 Flash, Claude 3.5 Haiku Latest
- **Rate Limits**: 150 requests/hour, 1,500 requests/day
- **Prompt Length**: Up to 8,000 characters
- **Features**: Advanced ensemble, priority processing, extended memory, analytics
- **Cost**: $29.99/month

## 🚀 How to Upgrade Users

### Method 1: API Endpoints

#### 1. Check User Tier Information
```bash
curl -X GET "http://localhost:8080/tiers/info/{userId}" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "user-123",
    "tier": "free",
    "config": {
      "name": "Free Tier",
      "maxRequestsPerHour": 25,
      "maxRequestsPerDay": 150,
      "maxPromptLength": 5000,
      "models": ["gpt-4o-mini", "gemini-1.5-flash", "claude-3-5-haiku-latest"],
      "features": ["basic_ensemble", "memory_storage", "caching"],
      "costPerMonth": 0
    },
    "userData": {
      "tierStartDate": "2025-07-17T11:40:53.171Z",
      "usage": {
        "requestsToday": 0,
        "requestsThisHour": 0,
        "totalRequests": 0
      },
      "isActive": true
    }
  }
}
```

#### 2. Upgrade User to Premium
```bash
curl -X POST "http://localhost:8080/tiers/upgrade" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "durationDays": 30,
    "reason": "Customer purchased premium plan"
  }'
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "success": true,
    "tier": "premium",
    "startDate": "2025-07-17T11:41:59.384Z",
    "endDate": "2025-08-16T11:41:59.384Z",
    "message": "Successfully upgraded to premium tier for 30 days"
  }
}
```

#### 3. Downgrade User to Free
```bash
curl -X POST "http://localhost:8080/tiers/downgrade" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "reason": "Subscription cancelled"
  }'
```

#### 4. Get Tier Configurations
```bash
curl -X GET "http://localhost:8080/tiers/config"
```

#### 5. Bulk Upgrade Multiple Users
```bash
curl -X POST "http://localhost:8080/tiers/bulk-upgrade" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["user-1", "user-2", "user-3"],
    "durationDays": 30,
    "reason": "Promotional upgrade"
  }'
```

### Method 2: Admin Interface

#### Admin Endpoints:
- **GET** `/admin/user-tier/{userId}` - Get user tier info
- **POST** `/admin/upgrade-user` - Upgrade user to premium
- **POST** `/admin/downgrade-user` - Downgrade user to free

#### Example Admin Upgrade:
```bash
curl -X POST "http://localhost:8080/admin/upgrade-user" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "durationDays": 30,
    "reason": "Admin upgrade"
  }'
```

## 🔄 Automatic Tier Detection

The system automatically detects user tiers for all API requests:

1. **Middleware Integration**: The `attachUserTier` middleware automatically fetches and caches user tier information
2. **Request Headers**: Tier information is added to response headers:
   - `X-User-Tier`: Current user tier
   - `X-Tier-Limits`: JSON object with tier limits
3. **Rate Limiting**: Automatic tier-based rate limiting
4. **Feature Access**: Tier-based feature validation

## 📊 Usage Examples

### Testing the System

1. **Create a test user and check tier:**
```bash
curl -s "http://localhost:8080/tiers/info/test-user-123"
```

2. **Upgrade to premium:**
```bash
curl -s -X POST "http://localhost:8080/tiers/upgrade" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-123", "durationDays": 30}'
```

3. **Test premium features:**
```bash
curl -s -X POST "http://localhost:8080/default-ensemble" \
  -H "Content-Type: application/json" \
  -H "x-user-id: test-user-123" \
  -d '{"prompt": "What is artificial intelligence?", "sessionId": "test"}'
```

### Integration with Payment Systems

For production use, integrate with payment processors:

```javascript
// Example: Stripe webhook handler
app.post('/webhooks/stripe', async (req, res) => {
  const event = req.body;
  
  if (event.type === 'invoice.payment_succeeded') {
    const customerId = event.data.object.customer;
    const userId = await getUserIdFromCustomerId(customerId);
    
    // Upgrade user to premium
    const tierService = getUserTierService();
    await tierService.upgradeToPremium(userId, {
      durationDays: 30,
      customerId: customerId,
      subscriptionId: event.data.object.subscription,
      reason: 'Payment successful'
    });
  }
  
  res.json({ received: true });
});
```

## 🗄️ Database Schema

The system stores user tier information in Firestore:

### Users Collection Structure:
```javascript
{
  userId: "user-123",
  tier: "premium",
  tierStartDate: Timestamp,
  tierEndDate: Timestamp,
  isActive: true,
  usage: {
    requestsToday: 0,
    requestsThisHour: 0,
    lastRequestDate: Timestamp,
    totalRequests: 0
  },
  billing: {
    customerId: "cus_stripe_123",
    subscriptionId: "sub_stripe_456",
    lastPaymentDate: Timestamp,
    nextBillingDate: Timestamp
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 🔧 Configuration

### Environment Variables:
```bash
# Tier-specific configurations are in .env
TIER_FREE_MAX_TOKENS_PER_ROLE=1200
TIER_FREE_REQUESTS_PER_HOUR=25
TIER_FREE_REQUESTS_PER_DAY=150
TIER_FREE_MAX_PROMPT_LENGTH=5000

TIER_PREMIUM_MAX_TOKENS_PER_ROLE=1600
TIER_PREMIUM_REQUESTS_PER_HOUR=150
TIER_PREMIUM_REQUESTS_PER_DAY=1500
TIER_PREMIUM_MAX_PROMPT_LENGTH=8000
```

## 🚨 Error Handling

The system includes comprehensive error handling:

- **Database Unavailable**: Falls back to free tier
- **Invalid User ID**: Returns appropriate error messages
- **Tier Expiration**: Automatically downgrades expired premium users
- **Rate Limiting**: Returns 429 status with retry information

## 📈 Monitoring and Analytics

The system logs all tier-related activities:

- User tier changes
- Usage patterns by tier
- Rate limit violations
- Feature access attempts

## 🔒 Security Considerations

- All tier operations are logged for audit trails
- User tier information is cached for performance
- Automatic cleanup of expired premium subscriptions
- Rate limiting prevents abuse

## 🎯 Next Steps

1. **Payment Integration**: Connect with Stripe, PayPal, or other payment processors
2. **Usage Analytics**: Implement detailed usage tracking and reporting
3. **Tier Customization**: Allow custom tier configurations per user
4. **Automated Billing**: Set up recurring billing and subscription management
5. **Usage Alerts**: Notify users when approaching tier limits

---

**🎉 The NeuraStack tier management system is now fully operational and ready for production use!**
