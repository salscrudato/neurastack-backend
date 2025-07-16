# 🚀 NeuraStack Backend Deployment Guide

## One-Command Deployment

Deploy your NeuraStack backend to GitHub and Google Cloud Run with a single command:

```bash
./deploy.sh "Your commit message"
```

## Quick Start

### Prerequisites

1. **Install required tools:**
   ```bash
   # Google Cloud CLI
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   
   # Docker (if not already installed)
   # Visit: https://docs.docker.com/get-docker/
   ```

2. **Authenticate with Google Cloud:**
   ```bash
   gcloud auth login
   gcloud config set project neurastack-backend
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

### Basic Deployment

```bash
# Simple deployment with auto-generated commit message
./deploy.sh

# Custom commit message
./deploy.sh "Add new AI model support"

# Skip tests (faster deployment)
./deploy.sh "Quick fix" --skip-tests

# Force deployment even if tests fail
./deploy.sh "Emergency fix" --force
```

## NPM Scripts

The deployment system integrates with npm scripts for convenience:

```bash
# Standard deployment
npm run deploy

# Force deployment (skip tests, ignore failures)
npm run deploy:force

# Deploy without running tests
npm run deploy:skip-tests

# Verify deployment
npm run verify

# Check logs
npm run logs
npm run logs:follow
```

## Quick Deploy Helper

For common deployment scenarios, use the quick deploy helper:

```bash
# Quick deploy with auto-generated message
./scripts/quick-deploy.sh quick

# Emergency hotfix (skips tests, forces deployment)
./scripts/quick-deploy.sh hotfix

# Feature deployment
./scripts/quick-deploy.sh feature "Add new synthesis algorithm"

# Bug fix deployment
./scripts/quick-deploy.sh bugfix "Fix memory leak in voting service"

# Check deployment status
./scripts/quick-deploy.sh status

# View recent logs
./scripts/quick-deploy.sh logs

# Health check
./scripts/quick-deploy.sh health

# Rollback to previous version
./scripts/quick-deploy.sh rollback
```

## Deployment Process

The deployment script performs these steps automatically:

1. **Prerequisites Check**
   - Verifies Git, gcloud, and Docker are installed
   - Checks if you're in a git repository
   - Validates authentication

2. **Testing** (unless `--skip-tests`)
   - Runs `npm test`
   - Fails deployment if tests fail (unless `--force`)

3. **Git Operations**
   - Stages uncommitted changes
   - Commits with provided message
   - Pushes to GitHub

4. **Google Cloud Deployment**
   - Authenticates with Google Cloud
   - Enables required APIs
   - Deploys using Cloud Build
   - Configures Cloud Run service

5. **Verification**
   - Tests health endpoint
   - Runs comprehensive verification script
   - Displays deployment summary

## Configuration

### Environment Variables

Set these in Google Cloud Run console or `.env` file:

```bash
# Required API Keys
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
CLAUDE_API_KEY=your_claude_key
XAI_API_KEY=your_xai_key

# Firebase Configuration
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY=your_private_key

# Application Settings
NODE_ENV=production
TIER=free
PORT=8080
```

### Cloud Run Configuration

The deployment uses these Cloud Run settings:

- **Memory**: 1GB
- **CPU**: 1 vCPU
- **Concurrency**: 80 requests
- **Timeout**: 300 seconds
- **Max Instances**: 10
- **Region**: us-central1

Modify these in `deploy.config.js` if needed.

## Monitoring and Logs

### View Logs
```bash
# Recent logs
npm run logs

# Follow logs in real-time
npm run logs:follow

# Or use gcloud directly
gcloud logs tail --service=neurastack-backend --region=us-central1 --follow
```

### Health Monitoring
```bash
# Check service health
curl https://neurastack-backend-638289111765.us-central1.run.app/health

# Comprehensive verification
npm run verify
```

### Service Management
```bash
# Check service status
gcloud run services describe neurastack-backend --region=us-central1

# Update service configuration
gcloud run services update neurastack-backend --region=us-central1 --memory=2Gi

# View service metrics
gcloud run services list --region=us-central1
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   ```bash
   gcloud auth login
   gcloud config set project neurastack-backend
   ```

2. **Tests Failing**
   ```bash
   # Run tests locally first
   npm test
   
   # Or skip tests for emergency deployment
   ./deploy.sh "Emergency fix" --skip-tests --force
   ```

3. **Build Timeout**
   ```bash
   # Check build logs
   gcloud builds list --limit=5
   gcloud builds log [BUILD_ID]
   ```

4. **Service Not Responding**
   ```bash
   # Check service logs
   npm run logs
   
   # Restart service
   gcloud run services update neurastack-backend --region=us-central1
   ```

### Debug Mode

Enable verbose logging:
```bash
export DEBUG=true
./deploy.sh "Debug deployment"
```

## Security

### Environment Variables
- Never commit API keys to Git
- Use Google Cloud Secret Manager for sensitive data
- Set environment variables in Cloud Run console

### Access Control
- Service is deployed with `--allow-unauthenticated` for public access
- Implement authentication in your application code
- Use CORS settings to restrict origins

## Performance Optimization

### Cold Start Reduction
- Service keeps minimum 0 instances (cost-effective)
- Uses lightweight Node.js Alpine image
- Optimized dependencies and build process

### Scaling Configuration
- Auto-scales from 0 to 10 instances
- 80 concurrent requests per instance
- 300-second timeout for long-running requests

## Cost Management

### Free Tier Limits
- 2 million requests per month
- 400,000 GB-seconds per month
- 200,000 CPU-seconds per month

### Cost Optimization
- Uses minimum resources (1GB RAM, 1 CPU)
- Scales to zero when not in use
- Efficient caching and request handling

## Advanced Usage

### Custom Deployment Configuration

Edit `deploy.config.js` to customize:
- Cloud Run settings
- Environment variables
- Feature flags
- Performance tuning

### Multi-Environment Deployment

```bash
# Deploy to staging
ENVIRONMENT=staging ./deploy.sh "Staging deployment"

# Deploy to production
ENVIRONMENT=production ./deploy.sh "Production deployment"
```

### Rollback Deployment

```bash
# Interactive rollback
./scripts/quick-deploy.sh rollback

# Or use gcloud directly
gcloud run services update-traffic neurastack-backend \
  --to-revisions=neurastack-backend-00001-abc=100 \
  --region=us-central1
```

## Support

For deployment issues:
1. Check the logs: `npm run logs`
2. Verify service health: `npm run verify`
3. Review Google Cloud Console
4. Check GitHub Actions (if configured)

## Next Steps

After successful deployment:
1. Update frontend to use production URL
2. Set up monitoring and alerting
3. Configure custom domain (optional)
4. Set up CI/CD pipeline (optional)
5. Enable HTTPS and security headers
