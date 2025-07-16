#!/bin/bash

# 🚀 NeuraStack Backend - One-Command Deploy Script
# Pushes to GitHub and deploys to Google Cloud Run in a single command
#
# Usage: ./deploy.sh [commit-message] [--skip-tests] [--force]
#
# Examples:
#   ./deploy.sh "Add new features"
#   ./deploy.sh "Fix bug" --skip-tests
#   ./deploy.sh "Emergency fix" --force

set -e  # Exit on any error

# Configuration
PROJECT_ID="neurastack-backend"
SERVICE_NAME="neurastack-backend"
REGION="us-central1"
GITHUB_REPO="salscrudato/neurastack-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
COMMIT_MESSAGE="${1:-Auto-deploy $(date '+%Y-%m-%d %H:%M:%S')}"
SKIP_TESTS=false
FORCE_DEPLOY=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --force)
      FORCE_DEPLOY=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [commit-message] [--skip-tests] [--force]"
      echo ""
      echo "Options:"
      echo "  --skip-tests    Skip running tests before deployment"
      echo "  --force         Force deployment even if tests fail"
      echo "  --help, -h      Show this help message"
      exit 0
      ;;
  esac
done

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check if git is installed and repo is initialized
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed"
        exit 1
    fi
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        log_error "Google Cloud CLI is not installed. Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Install from: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        log_warning ".env file not found. Make sure environment variables are set in Google Cloud Run"
    fi
    
    log_success "Prerequisites check passed"
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        log_warning "Skipping tests as requested"
        return 0
    fi
    
    log_step "Running tests..."
    
    if npm test; then
        log_success "All tests passed"
    else
        if [ "$FORCE_DEPLOY" = true ]; then
            log_warning "Tests failed but continuing with --force flag"
        else
            log_error "Tests failed. Use --force to deploy anyway or fix the tests"
            exit 1
        fi
    fi
}

# Git operations
git_operations() {
    log_step "Performing Git operations..."
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log_info "Found uncommitted changes, staging them..."
        git add .
    else
        log_info "No uncommitted changes found"
    fi
    
    # Check if there are staged changes
    if git diff-index --quiet --cached HEAD --; then
        log_info "No changes to commit"
    else
        log_info "Committing changes with message: '$COMMIT_MESSAGE'"
        git commit -m "$COMMIT_MESSAGE"
    fi
    
    # Push to GitHub
    log_step "Pushing to GitHub..."
    CURRENT_BRANCH=$(git branch --show-current)
    
    if git push origin "$CURRENT_BRANCH"; then
        log_success "Successfully pushed to GitHub ($CURRENT_BRANCH branch)"
    else
        log_error "Failed to push to GitHub"
        exit 1
    fi
}

# Google Cloud authentication check
check_gcloud_auth() {
    log_step "Checking Google Cloud authentication..."
    
    if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
        ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
        log_success "Authenticated as: $ACTIVE_ACCOUNT"
    else
        log_warning "Not authenticated with Google Cloud"
        log_info "Running: gcloud auth login"
        gcloud auth login
    fi
    
    # Set project
    log_info "Setting project to: $PROJECT_ID"
    gcloud config set project "$PROJECT_ID"
}

# Deploy to Google Cloud Run
deploy_to_cloud_run() {
    log_step "Deploying to Google Cloud Run..."
    
    # Enable required APIs (if not already enabled)
    log_info "Ensuring required APIs are enabled..."
    gcloud services enable run.googleapis.com --quiet
    gcloud services enable cloudbuild.googleapis.com --quiet
    
    # Deploy using Cloud Build (source-based deployment)
    log_info "Starting Cloud Build deployment..."
    
    if gcloud run deploy "$SERVICE_NAME" \
        --source . \
        --region "$REGION" \
        --allow-unauthenticated \
        --platform managed \
        --memory 1Gi \
        --cpu 1 \
        --concurrency 80 \
        --timeout 300 \
        --max-instances 10 \
        --quiet; then
        
        log_success "Successfully deployed to Google Cloud Run"
        
        # Get the service URL
        SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="value(status.url)")
        log_success "Service URL: $SERVICE_URL"
        
    else
        log_error "Deployment to Google Cloud Run failed"
        exit 1
    fi
}

# Verify deployment
verify_deployment() {
    log_step "Verifying deployment..."
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="value(status.url)" 2>/dev/null)
    
    if [ -z "$SERVICE_URL" ]; then
        log_error "Could not get service URL"
        return 1
    fi
    
    # Test health endpoint
    log_info "Testing health endpoint: $SERVICE_URL/health"
    
    if curl -s -f "$SERVICE_URL/health" > /dev/null; then
        log_success "Health check passed"
        
        # Run comprehensive verification if script exists
        if [ -f "scripts/verify-deployment.sh" ]; then
            log_info "Running comprehensive deployment verification..."
            chmod +x scripts/verify-deployment.sh
            NEURASTACK_BASE_URL="$SERVICE_URL" ./scripts/verify-deployment.sh
        fi
        
    else
        log_warning "Health check failed - service might still be starting up"
        log_info "You can manually check: $SERVICE_URL/health"
    fi
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    # Add any cleanup operations here if needed
}

# Main execution
main() {
    echo -e "${CYAN}"
    echo "🚀 NeuraStack Backend Deployment Script"
    echo "========================================"
    echo -e "${NC}"
    
    log_info "Starting deployment process..."
    log_info "Commit message: '$COMMIT_MESSAGE'"
    log_info "Skip tests: $SKIP_TESTS"
    log_info "Force deploy: $FORCE_DEPLOY"
    echo ""
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Execute deployment steps
    check_prerequisites
    run_tests
    git_operations
    check_gcloud_auth
    deploy_to_cloud_run
    verify_deployment
    
    echo ""
    echo -e "${GREEN}"
    echo "🎉 Deployment completed successfully!"
    echo "====================================="
    echo -e "${NC}"
    
    # Get final service URL
    SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format="value(status.url)" 2>/dev/null)
    
    echo -e "${CYAN}📊 Deployment Summary:${NC}"
    echo "• GitHub: https://github.com/$GITHUB_REPO"
    echo "• Production URL: $SERVICE_URL"
    echo "• Health Check: $SERVICE_URL/health"
    echo "• Memory API: $SERVICE_URL/memory/health"
    echo "• Admin Panel: $SERVICE_URL/admin"
    echo ""
    
    echo -e "${YELLOW}📝 Next Steps:${NC}"
    echo "1. Update frontend to use production URL"
    echo "2. Test all endpoints manually"
    echo "3. Monitor logs: gcloud logs tail --service=$SERVICE_NAME"
    echo "4. Check metrics in Google Cloud Console"
    echo ""
    
    log_success "All done! 🚀"
}

# Run main function
main "$@"
