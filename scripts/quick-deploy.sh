#!/bin/bash

# 🚀 Quick Deploy Helper Script
# Provides shortcuts for common deployment scenarios

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_help() {
    echo -e "${BLUE}🚀 NeuraStack Quick Deploy Helper${NC}"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  quick           Quick deploy with auto-generated commit message"
    echo "  hotfix          Emergency deploy (skips tests, forces deployment)"
    echo "  feature <msg>   Deploy new feature with custom message"
    echo "  bugfix <msg>    Deploy bug fix with custom message"
    echo "  rollback        Rollback to previous version (interactive)"
    echo "  status          Check deployment status"
    echo "  logs            Show recent logs"
    echo "  health          Check service health"
    echo ""
    echo "Examples:"
    echo "  $0 quick"
    echo "  $0 hotfix"
    echo "  $0 feature 'Add new AI model support'"
    echo "  $0 bugfix 'Fix memory leak in synthesis service'"
    echo "  $0 status"
    echo ""
}

quick_deploy() {
    echo -e "${GREEN}🚀 Quick Deploy${NC}"
    ./deploy.sh "Quick deploy - $(date '+%Y-%m-%d %H:%M:%S')"
}

hotfix_deploy() {
    echo -e "${YELLOW}🔥 Hotfix Deploy (Emergency)${NC}"
    echo "⚠️  This will skip tests and force deployment!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ./deploy.sh "HOTFIX: Emergency deployment - $(date '+%Y-%m-%d %H:%M:%S')" --skip-tests --force
    else
        echo "Hotfix deployment cancelled."
    fi
}

feature_deploy() {
    local message="$1"
    if [ -z "$message" ]; then
        echo "Error: Feature message is required"
        echo "Usage: $0 feature 'Your feature description'"
        exit 1
    fi
    
    echo -e "${GREEN}✨ Feature Deploy${NC}"
    ./deploy.sh "feat: $message"
}

bugfix_deploy() {
    local message="$1"
    if [ -z "$message" ]; then
        echo "Error: Bugfix message is required"
        echo "Usage: $0 bugfix 'Your bugfix description'"
        exit 1
    fi
    
    echo -e "${GREEN}🐛 Bugfix Deploy${NC}"
    ./deploy.sh "fix: $message"
}

check_status() {
    echo -e "${BLUE}📊 Deployment Status${NC}"
    echo ""
    
    # Check if service exists
    if gcloud run services describe neurastack-backend --region=us-central1 &>/dev/null; then
        echo "✅ Service exists"
        
        # Get service details
        SERVICE_URL=$(gcloud run services describe neurastack-backend --region=us-central1 --format="value(status.url)")
        LAST_DEPLOYED=$(gcloud run services describe neurastack-backend --region=us-central1 --format="value(metadata.annotations.'serving.knative.dev/lastModifier')")
        
        echo "🌐 URL: $SERVICE_URL"
        echo "👤 Last deployed by: $LAST_DEPLOYED"
        
        # Check health
        echo ""
        echo "🏥 Health Check:"
        if curl -s -f "$SERVICE_URL/health" > /dev/null; then
            echo "✅ Service is healthy"
        else
            echo "❌ Service health check failed"
        fi
        
    else
        echo "❌ Service not found"
    fi
}

show_logs() {
    echo -e "${BLUE}📋 Recent Logs${NC}"
    gcloud logs tail --service=neurastack-backend --region=us-central1 --limit=50
}

check_health() {
    echo -e "${BLUE}🏥 Health Check${NC}"
    
    SERVICE_URL=$(gcloud run services describe neurastack-backend --region=us-central1 --format="value(status.url)" 2>/dev/null)
    
    if [ -z "$SERVICE_URL" ]; then
        echo "❌ Could not get service URL"
        exit 1
    fi
    
    echo "Testing: $SERVICE_URL/health"
    
    if curl -s -f "$SERVICE_URL/health"; then
        echo ""
        echo "✅ Service is healthy"
    else
        echo ""
        echo "❌ Service health check failed"
        exit 1
    fi
}

rollback_deployment() {
    echo -e "${YELLOW}🔄 Rollback Deployment${NC}"
    echo "⚠️  This will rollback to the previous revision"
    
    # Get current revision
    CURRENT_REVISION=$(gcloud run services describe neurastack-backend --region=us-central1 --format="value(status.latestReadyRevisionName)")
    echo "Current revision: $CURRENT_REVISION"
    
    # List recent revisions
    echo ""
    echo "Recent revisions:"
    gcloud run revisions list --service=neurastack-backend --region=us-central1 --limit=5
    
    echo ""
    read -p "Enter revision name to rollback to (or press Enter to cancel): " REVISION_NAME
    
    if [ -n "$REVISION_NAME" ]; then
        echo "Rolling back to revision: $REVISION_NAME"
        gcloud run services update-traffic neurastack-backend --to-revisions="$REVISION_NAME=100" --region=us-central1
        echo "✅ Rollback completed"
    else
        echo "Rollback cancelled"
    fi
}

# Main command handling
case "$1" in
    quick)
        quick_deploy
        ;;
    hotfix)
        hotfix_deploy
        ;;
    feature)
        feature_deploy "$2"
        ;;
    bugfix)
        bugfix_deploy "$2"
        ;;
    status)
        check_status
        ;;
    logs)
        show_logs
        ;;
    health)
        check_health
        ;;
    rollback)
        rollback_deployment
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
