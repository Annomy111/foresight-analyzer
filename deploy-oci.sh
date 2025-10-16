#!/bin/bash
# Foresight Analyzer - OCI Deployment Script
# Deploys backend to Oracle Cloud Compute Instance

set -e  # Exit on error

# Configuration
OCI_HOST="130.61.137.77"
OCI_USER="opc"
OCI_KEY="~/.ssh/berliner_ensemble_oracle"
APP_NAME="foresight-analyzer"
CONTAINER_PORT="8001"
GIT_REPO="https://github.com/Annomy111/foresight-analyzer.git"
GIT_BRANCH="main"

echo "🚀 Starting Foresight Analyzer Deployment to OCI..."
echo "Target: $OCI_USER@$OCI_HOST"
echo ""

# Create deployment directory
mkdir -p ~/.claude/deployments/${APP_NAME}
DEPLOY_LOG="$HOME/.claude/deployments/${APP_NAME}/deploy-$(date +%Y%m%d_%H%M%S).log"

echo "📝 Logging to: $DEPLOY_LOG"
exec > >(tee -a "$DEPLOY_LOG") 2>&1

# Step 1: Install Docker and Git if not present
echo ""
echo "Step 1/7: Installing Docker and Git on OCI instance..."
ssh -i $OCI_KEY $OCI_USER@$OCI_HOST << 'ENDSSH'
# Install Git
if ! command -v git &> /dev/null; then
    echo "Git not found. Installing..."
    sudo yum install -y git
fi

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "Docker not found. Installing..."
    sudo yum install -y yum-utils
    sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker $USER
    echo "Docker installed successfully!"
else
    echo "Docker already installed."
fi

git --version
sudo docker --version
sudo docker compose version
ENDSSH

# Step 2: Clone or update repository
echo ""
echo "Step 2/7: Cloning/updating repository..."
ssh -i $OCI_KEY $OCI_USER@$OCI_HOST << ENDSSH2
# Remove old directory if exists
rm -rf ~/${APP_NAME}

# Clone fresh
git clone -b ${GIT_BRANCH} ${GIT_REPO} ~/${APP_NAME}
cd ~/${APP_NAME}
echo "Repository cloned successfully!"
ls -la
ENDSSH2

# Step 3: Create .env file with API key
echo ""
echo "Step 3/7: Creating .env file..."
API_KEY=$(grep OPENROUTER_API_KEY .env | cut -d= -f2)
ssh -i $OCI_KEY $OCI_USER@$OCI_HOST << ENDSSH3
cd ~/${APP_NAME}/web/backend
cat > .env << 'EOF'
OPENROUTER_API_KEY=${API_KEY}
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
ENABLED_MODELS=openai/gpt-oss-20b,meta-llama/llama-3.3-70b-instruct,x-ai/grok-4-fast,deepseek/deepseek-chat-v3.1
ITERATIONS_PER_MODEL=10
CONCURRENT_REQUESTS=3
REQUEST_TIMEOUT=120
OUTPUT_DIR=/app/data/results
LOG_LEVEL=INFO
EOF
echo ".env file created"
ENDSSH3

# Step 4: Build Docker image
echo ""
echo "Step 4/7: Building Docker image..."
ssh -i $OCI_KEY $OCI_USER@$OCI_HOST << 'ENDSSH4'
cd ~/foresight-analyzer/web/backend
sudo docker build -t foresight-backend:latest .
echo "Docker image built successfully!"
ENDSSH4

# Step 5: Stop old container and start new one
echo ""
echo "Step 5/7: Starting container..."
ssh -i $OCI_KEY $OCI_USER@$OCI_HOST << ENDSSH5
# Stop and remove old container if exists
sudo docker stop foresight-backend 2>/dev/null || true
sudo docker rm foresight-backend 2>/dev/null || true

# Start new container
sudo docker run -d \
  --name foresight-backend \
  --restart unless-stopped \
  -p ${CONTAINER_PORT}:${CONTAINER_PORT} \
  -v ~/foresight-data:/app/data \
  --env-file ~/foresight-analyzer/web/backend/.env \
  foresight-backend:latest

echo "Container started!"
sleep 5
sudo docker ps | grep foresight
ENDSSH5

# Step 6: Health check
echo ""
echo "Step 6/7: Running health check..."
sleep 10
HEALTH_CHECK=$(curl -s http://$OCI_HOST:$CONTAINER_PORT/health || echo '{"status":"failed"}')
echo "Health Check Response:"
echo "$HEALTH_CHECK" | python3 -m json.tool

if echo "$HEALTH_CHECK" | grep -q '"status": "healthy"'; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "Backend API URL: http://$OCI_HOST:$CONTAINER_PORT"
    echo "Health Check: http://$OCI_HOST:$CONTAINER_PORT/health"
    echo "API Docs: http://$OCI_HOST:$CONTAINER_PORT/docs"
    echo ""
    echo "Next steps:"
    echo "1. Update frontend .env.production with: VITE_API_URL=http://$OCI_HOST:$CONTAINER_PORT"
    echo "2. Build and deploy frontend to Cloudflare Pages"
    echo ""
else
    echo ""
    echo "❌ Health check failed. Check logs:"
    echo "ssh -i $OCI_KEY $OCI_USER@$OCI_HOST 'sudo docker logs foresight-backend'"
    exit 1
fi
