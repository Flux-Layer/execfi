# Deployment Guide - ExecFi

This project uses **automated CI/CD** with GitHub Actions, Docker, and Watchtower for zero-downtime deployments to your Ubuntu VPS.

## Architecture Overview

```
GitHub (staging branch)
    ↓ push triggers
GitHub Actions
    ↓ builds Docker image
GitHub Container Registry (ghcr.io)
    ↓ Watchtower polls every 5 min
Ubuntu VPS
    ↓ serves via
Nginx Reverse Proxy
    ↓ protected by
Cloudflare (SSL + DDoS)
    ↓ serves
execfi.xyz
```

## Initial VPS Setup

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Nginx
sudo apt install nginx -y
```

### 2. Authenticate Docker with GitHub Container Registry

```bash
# Create GitHub Personal Access Token (PAT) with packages:read permission
# Go to: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
# Required scopes: read:packages

# Login to ghcr.io
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 3. Deploy Application

```bash
# Create app directory
mkdir -p /opt/execfi
cd /opt/execfi

# Download docker-compose.prod.yml
wget https://raw.githubusercontent.com/TopengDev/hq-hackathon-project-1/staging/docker-compose.prod.yml

# Set your GitHub repository name
export GITHUB_REPOSITORY=topengdev/hq-hackathon-project-1

# Start services
docker compose -f docker-compose.prod.yml up -d
```

### 4. Configure Nginx

```bash
# Copy nginx.conf from this repo to VPS
sudo cp nginx.conf /etc/nginx/sites-available/execfi.xyz

# Create symlink
sudo ln -s /etc/nginx/sites-available/execfi.xyz /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 5. Configure Cloudflare

Since you're using Cloudflare for DNS:

1. **DNS Records** (in Cloudflare dashboard):
   - A Record: `execfi.xyz` → `YOUR_VPS_IP` (🟠 Proxied)
   - A Record: `www.execfi.xyz` → `YOUR_VPS_IP` (🟠 Proxied)

2. **SSL/TLS Settings**:
   - Mode: **"Flexible"** (easiest) or **"Full"** (more secure)
   - "Flexible" = Cloudflare↔User (HTTPS), Cloudflare↔VPS (HTTP)
   - "Full" = End-to-end HTTPS (requires SSL cert on VPS)

3. **Recommended Cloudflare Settings**:
   - Security Level: Medium
   - Always Use HTTPS: ON
   - Automatic HTTPS Rewrites: ON
   - Brotli Compression: ON

## GitHub Repository Setup

### Required GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret

Add **ALL** these secrets from your `.env` file:

```
NEXT_PUBLIC_APP_NAME
NEXT_PUBLIC_PROJECT_ID
NEXT_PUBLIC_COIN_GECKO_API_KEY
NEXT_PUBLIC_PRIVY_APP_ID
NEXT_PUBLIC_PRIVY_APP_SECRET
NEXT_PUBLIC_ZERO_DEV_PROJECT_ID
NEXT_PUBLIC_ZERO_DEV_PASSKEY_SERVER_URL
NEXT_PUBLIC_BUNDLER_RPC
NEXT_PUBLIC_BICONOMY_BUNDLER
NEXT_PUBLIC_BICONOMY_PAYMASTER
NEXT_PUBLIC_BICONOMY_PAYMASTER_API_KEY
NEXT_PUBLIC_BICONOMY_API_KEY
NEXT_PUBLIC_BICONOMY_PROJECT_ID
NEXT_PUBLIC_LIFI_KEY
NEXT_PUBLIC_ALCHEMY_KEY
NEXT_PUBLIC_DEFAULT_CHAIN_ID
OPENROUTER_API_KEY
NEXT_PUBLIC_ENABLE_LIFI_EXECUTION
MAX_TX_AMOUNT_ETH
DAILY_SPEND_LIMIT_ETH
NEXT_PUBLIC_PRIVY_SIGNER_ID
NEXT_PUBLIC_PRIVY_NATIVE_TRANSFER_POLICY_ID
GAS_HEADROOM_MULT
MIN_BALANCE_AFTER_TX_ETH
CONFIRM_BEFORE_SEND
ENABLE_LIFI_PROVIDER
ENABLE_RELAY_PROVIDER
ENABLE_LOCAL_PROVIDER
ENABLE_COINGECKO_PROVIDER
NEXT_PUBLIC_LIFI_API_KEY
LIFI_API_KEY
COINGECKO_API_KEY
LIFI_PROVIDER_PRIORITY
RELAY_PROVIDER_PRIORITY
LOCAL_PROVIDER_PRIORITY
COINGECKO_PROVIDER_PRIORITY
TOKEN_SEARCH_TIMEOUT_MS
PROVIDER_HEALTH_CHECK_INTERVAL_MS
TOKEN_CACHE_TTL_SECONDS
```

### Enable GitHub Container Registry

Your repository must have **Packages** enabled (it's on by default for public repos).

## Deployment Workflow

### Automatic Deployment

1. **Push to `staging` branch**:
   ```bash
   git push origin staging
   ```

2. **GitHub Actions automatically**:
   - Builds Docker image with all secrets
   - Pushes to `ghcr.io/topengdev/hq-hackathon-project-1:staging`
   - Takes ~2-5 minutes

3. **Watchtower on VPS**:
   - Polls every 5 minutes for new images
   - Pulls new image automatically
   - Performs rolling restart (zero downtime)
   - Cleans up old images

### Manual Deployment

Trigger workflow manually:
- Go to GitHub → Actions → "Build and Deploy to VPS" → "Run workflow"

### Rollback

```bash
# SSH into VPS
cd /opt/execfi

# List available images
docker images ghcr.io/topengdev/hq-hackathon-project-1

# Update docker-compose.prod.yml to specific tag
# Change: image: ghcr.io/.../hq-hackathon-project-1:staging
# To:     image: ghcr.io/.../hq-hackathon-project-1:staging-abc1234

# Restart
docker compose -f docker-compose.prod.yml up -d
```

## Monitoring

### Check Application Status

```bash
# View running containers
docker ps

# View app logs
docker logs -f execfi-app

# View Watchtower logs
docker logs -f watchtower

# Check nginx status
sudo systemctl status nginx

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Health Checks

```bash
# Check if app is responding
curl http://localhost:3290

# Check via nginx
curl http://YOUR_VPS_IP

# Check via domain
curl https://execfi.xyz
```

## Troubleshooting

### App not updating?

```bash
# Force Watchtower to check now
docker restart watchtower

# Manually pull latest image
docker pull ghcr.io/topengdev/hq-hackathon-project-1:staging
docker compose -f docker-compose.prod.yml up -d
```

### Nginx not serving?

```bash
# Check nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Check if app is running
curl http://localhost:3290
```

### Can't access ghcr.io?

```bash
# Re-authenticate
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# Verify authentication
cat ~/.docker/config.json
```

### Cloudflare showing errors?

- Check if VPS firewall allows port 80: `sudo ufw allow 80/tcp`
- Verify DNS propagation: `dig execfi.xyz`
- Check Cloudflare SSL mode matches your nginx config

## Security Notes

- **Secrets**: All sensitive data stored in GitHub Secrets, never committed to repo
- **Firewall**: Only ports 80 (HTTP) and 22 (SSH) need to be open
- **Cloudflare**: Provides DDoS protection and SSL termination
- **Docker**: Containers run as non-root user (nextjs:1001)
- **Updates**: Watchtower only updates containers with label `com.centurylinklabs.watchtower.enable=true`

## Cost Optimization

- Docker layer caching reduces build times
- `output: "standalone"` reduces image size by ~80%
- Watchtower cleanup removes old images automatically
- Cloudflare free tier handles SSL and caching

## Support

If deployment fails:
1. Check GitHub Actions logs
2. Check VPS docker logs: `docker logs execfi-app`
3. Verify GitHub Secrets are set correctly
4. Ensure VPS has internet access to ghcr.io
