#!/bin/bash
# VPS Deployment Setup Script
# Run this on your VPS: execfi@31.97.110.176

set -e

echo "🚀 ExecFi VPS Deployment Setup"
echo "================================"
echo ""

# Step 1: GitHub Container Registry Authentication
echo "📦 Step 1: GitHub Container Registry Authentication"
echo ""
echo "You need a GitHub Personal Access Token (PAT) with 'read:packages' permission"
echo ""
echo "Create one here: https://github.com/settings/tokens"
echo "Required permissions: read:packages (for pulling images)"
echo ""
read -p "Enter your GitHub username: " GITHUB_USER
read -sp "Enter your GitHub Personal Access Token: " GITHUB_TOKEN
echo ""
echo ""

# Login to GHCR
echo "🔐 Logging into GitHub Container Registry..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin

if [ $? -eq 0 ]; then
    echo "✅ Successfully logged into GHCR"
else
    echo "❌ Failed to login to GHCR"
    exit 1
fi

echo ""

# Step 2: Create docker-compose.prod.yml
echo "📝 Step 2: Creating docker-compose.prod.yml..."
mkdir -p ~/execfi
cd ~/execfi

cat > docker-compose.prod.yml << 'EOF'
services:
  execfi:
    image: ghcr.io/flux-layer/execfi:staging
    ports:
      - "3290:3290"
    restart: unless-stopped
    container_name: execfi-app
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  watchtower:
    image: containrrr/watchtower:latest
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /root/.docker/config.json:/config.json:ro
    environment:
      - WATCHTOWER_POLL_INTERVAL=300
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_INCLUDE_RESTARTING=true
      - WATCHTOWER_LABEL_ENABLE=true
      - WATCHTOWER_ROLLING_RESTART=true
    command: --interval 300 --cleanup
EOF

echo "✅ docker-compose.prod.yml created"
echo ""

# Step 3: Pull initial image
echo "📥 Step 3: Pulling initial image..."
docker pull ghcr.io/flux-layer/execfi:staging

if [ $? -eq 0 ]; then
    echo "✅ Successfully pulled image"
else
    echo "❌ Failed to pull image. Check if the image exists and you have access."
    exit 1
fi

echo ""

# Step 4: Start services
echo "🚀 Step 4: Starting Docker services..."
docker compose -f docker-compose.prod.yml up -d

if [ $? -eq 0 ]; then
    echo "✅ Services started successfully"
else
    echo "❌ Failed to start services"
    exit 1
fi

echo ""

# Step 5: Verify services
echo "🔍 Step 5: Verifying services..."
echo ""
docker ps
echo ""

echo "✅ Setup Complete!"
echo ""
echo "📊 Service Status:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "📝 To view logs:"
echo "   docker compose -f ~/execfi/docker-compose.prod.yml logs -f execfi"
echo ""
echo "🔄 Watchtower will check for updates every 5 minutes"
echo "   When GitHub Actions pushes a new image, it will auto-deploy!"
echo ""
echo "🌐 Your app should be running at: http://31.97.110.176:3290"
echo "   (Remember to configure nginx to proxy to this port)"
