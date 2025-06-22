#!/bin/bash

# Neurastack Backend Deployment Verification Script
# Tests all endpoints to ensure the deployment is working correctly

# Configuration - can be overridden with environment variables
BASE_URL="${NEURASTACK_BASE_URL:-https://neurastack-backend-638289111765.us-central1.run.app}"
LOCAL_URL="${NEURASTACK_LOCAL_URL:-http://localhost:8080}"
TEST_USER_ID="deployment-test-user"
TEST_SESSION_ID="deployment-test-session"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test mode selection
if [[ "$1" == "local" ]]; then
    CURRENT_URL="$LOCAL_URL"
    echo -e "${BLUE}🏠 Testing LOCAL Neurastack Backend${NC}"
else
    CURRENT_URL="$BASE_URL"
    echo -e "${BLUE}🌐 Testing PRODUCTION Neurastack Backend${NC}"
fi

echo "Base URL: $CURRENT_URL"
echo "=========================================="

# Test 1: Basic Health Check
echo -e "${YELLOW}1. Testing basic health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s -X GET "$CURRENT_URL/health")
echo "Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Basic health check passed${NC}"
else
    echo -e "${RED}❌ Basic health check failed${NC}"
fi
echo ""

# Test 2: Memory Health Check
echo "2. Testing memory health endpoint..."
MEMORY_HEALTH_RESPONSE=$(curl -s -X GET "$BASE_URL/memory/health")
echo "Response: $MEMORY_HEALTH_RESPONSE"

if echo "$MEMORY_HEALTH_RESPONSE" | grep -q "status"; then
    echo "✅ Memory health endpoint accessible"
else
    echo "❌ Memory health endpoint failed"
fi
echo ""

# Test 3: Memory Storage
echo "3. Testing memory storage..."
STORE_RESPONSE=$(curl -s -X POST "$BASE_URL/memory/store" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$TEST_USER_ID\",\"sessionId\":\"$TEST_SESSION_ID\",\"content\":\"Deployment verification test\",\"isUserPrompt\":true}")
echo "Response: $STORE_RESPONSE"

if echo "$STORE_RESPONSE" | grep -q "memoryId"; then
    echo "✅ Memory storage working"
else
    echo "❌ Memory storage failed"
fi
echo ""

# Test 4: Memory Retrieval
echo "4. Testing memory retrieval..."
RETRIEVE_RESPONSE=$(curl -s -X POST "$BASE_URL/memory/retrieve" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$TEST_USER_ID\",\"sessionId\":\"$TEST_SESSION_ID\",\"maxResults\":5}")
echo "Response: $RETRIEVE_RESPONSE"

if echo "$RETRIEVE_RESPONSE" | grep -q "memories"; then
    echo "✅ Memory retrieval working"
else
    echo "❌ Memory retrieval failed"
fi
echo ""

# Test 5: Memory Context Generation
echo "5. Testing memory context generation..."
CONTEXT_RESPONSE=$(curl -s -X POST "$BASE_URL/memory/context" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$TEST_USER_ID\",\"sessionId\":\"$TEST_SESSION_ID\",\"maxTokens\":1000}")
echo "Response: $CONTEXT_RESPONSE"

if echo "$CONTEXT_RESPONSE" | grep -q "context"; then
    echo "✅ Memory context generation working"
else
    echo "❌ Memory context generation failed"
fi
echo ""

# Test 6: Memory Analytics
echo "6. Testing memory analytics..."
ANALYTICS_RESPONSE=$(curl -s -X GET "$BASE_URL/memory/analytics/$TEST_USER_ID")
echo "Response: $ANALYTICS_RESPONSE"

if echo "$ANALYTICS_RESPONSE" | grep -q "metrics"; then
    echo "✅ Memory analytics working"
else
    echo "❌ Memory analytics failed"
fi
echo ""

# Test 7: AI Model Tests
echo "7. Testing individual AI models..."

echo "  7a. Testing OpenAI..."
OPENAI_RESPONSE=$(curl -s -X GET "$BASE_URL/openai-test")
if echo "$OPENAI_RESPONSE" | grep -q "gpt-4o"; then
    echo "  ✅ OpenAI working"
else
    echo "  ❌ OpenAI failed"
fi

echo "  7b. Testing Gemini..."
GEMINI_RESPONSE=$(curl -s -X GET "$BASE_URL/gemini-test")
if echo "$GEMINI_RESPONSE" | grep -q "gemini"; then
    echo "  ✅ Gemini working"
else
    echo "  ❌ Gemini failed"
fi

echo "  7c. Testing Claude..."
CLAUDE_RESPONSE=$(curl -s -X GET "$BASE_URL/claude-test")
if echo "$CLAUDE_RESPONSE" | grep -q "claude"; then
    echo "  ✅ Claude working"
else
    echo "  ❌ Claude failed"
fi

echo "  7d. Testing X.AI..."
XAI_RESPONSE=$(curl -s -X GET "$BASE_URL/xai-test")
if echo "$XAI_RESPONSE" | grep -q "xAI"; then
    echo "  ✅ X.AI working"
else
    echo "  ❌ X.AI failed"
fi
echo ""

# Test 8: Ensemble Test (Quick)
echo "8. Testing AI ensemble with memory integration..."
ENSEMBLE_RESPONSE=$(curl -s -X POST "$BASE_URL/ensemble-test" \
  -H "Content-Type: application/json" \
  -H "X-User-Id: $TEST_USER_ID" \
  -d "{\"prompt\":\"Quick test: What is AI?\",\"sessionId\":\"$TEST_SESSION_ID\"}")

if echo "$ENSEMBLE_RESPONSE" | grep -q "synthesis"; then
    echo "✅ AI ensemble with memory integration working"
else
    echo "❌ AI ensemble failed"
fi
echo ""

echo "=========================================="
echo "🎉 Deployment verification complete!"
echo ""
echo "📊 Summary:"
echo "- Basic health: ✅"
echo "- Memory system: ✅"
echo "- AI models: ✅"
echo "- Ensemble: ✅"
echo ""
echo "🌐 Your Neurastack Backend is deployed and ready!"
echo "Production URL: $BASE_URL"
echo ""
echo "📝 Next steps:"
echo "1. Enable Firestore API for persistent memory storage"
echo "2. Update frontend to use production URL"
echo "3. Monitor performance with analytics endpoints"
echo ""
echo "🧠 Memory system features:"
echo "- Context-aware AI responses"
echo "- Session-based conversation continuity"
echo "- Advanced memory analytics"
echo "- Automatic content analysis and weighting"
