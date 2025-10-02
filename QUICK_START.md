# Quick Start - ExecFi Deployment

## What's Ready

✅ Dockerized with multi-stage builds
✅ GitHub Actions CI/CD on `staging` branch pushes
✅ Watchtower auto-deployment (5 min polling)
✅ Nginx reverse proxy config
✅ Cloudflare-ready (SSL handled at edge)

## Deploy in 3 Steps

### 1. Add GitHub Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

Copy all values from your `.env` file. Required secrets listed in `DEPLOYMENT.md`.

### 2. Setup VPS

```bash
# Install Docker + Nginx
curl -fsSL https://get.docker.com | sudo sh
sudo apt install nginx -y

# Login to GitHub Container Registry
echo "YOUR_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Deploy app
mkdir -p /opt/execfi && cd /opt/execfi
# Copy docker-compose.prod.yml to VPS (scp or create manually)
export GITHUB_REPOSITORY=topengdev/hq-hackathon-project-1
docker compose -f docker-compose.prod.yml up -d

# Setup Nginx
sudo cp /path/to/nginx.conf /etc/nginx/sites-available/execfi.xyz
sudo ln -s /etc/nginx/sites-available/execfi.xyz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Configure Cloudflare DNS

- **A Record**: `execfi.xyz` → `YOUR_VPS_IP` (🟠 Proxied ON)
- **A Record**: `www.execfi.xyz` → `YOUR_VPS_IP` (🟠 Proxied ON)
- **SSL/TLS Mode**: Flexible (easiest) or Full
- **Always Use HTTPS**: ON

## That's It!

Now every push to `staging` automatically:
1. Builds Docker image in GitHub Actions (2-5 min)
2. Pushes to ghcr.io
3. Watchtower detects & deploys within 5 min
4. Zero downtime rolling restart

## Monitor Deployment

```bash
# View logs
docker logs -f execfi-app
docker logs -f watchtower

# Force update check
docker restart watchtower
```

## Known Issues Fixed

- ✅ Privy App ID validation during build (added `dynamic = 'force-dynamic'`)
- ✅ Missing LISK env vars in workflow
- ✅ Typo in Dockerfile (`NETX_PUBLIC_LISK_MAINNET` → `NEXT_PUBLIC_LISK_MAINNET`)

Full documentation in `DEPLOYMENT.md`.
