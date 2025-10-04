# VPS Deployment Commands Reference

## 🚀 Quick Start

### **Initial Setup (One-time)**

```bash
# SSH to your VPS
ssh execfi@31.97.110.176

# Copy the deploy-setup.sh script to VPS
# (From your local machine)
scp deploy-setup.sh execfi@31.97.110.176:~/

# On VPS: Run the setup script
chmod +x ~/deploy-setup.sh
./deploy-setup.sh
```

---

## 📦 Manual Commands

### **Start Services**

```bash
cd ~/execfi
docker compose -f docker-compose.prod.yml up -d
```

### **Stop Services**

```bash
cd ~/execfi
docker compose -f docker-compose.prod.yml down
```

### **Restart Services**

```bash
cd ~/execfi
docker compose -f docker-compose.prod.yml restart
```

### **View Logs**

```bash
# All services
docker compose -f ~/execfi/docker-compose.prod.yml logs -f

# Just the app
docker compose -f ~/execfi/docker-compose.prod.yml logs -f execfi

# Just watchtower
docker compose -f ~/execfi/docker-compose.prod.yml logs -f watchtower

# Last 100 lines
docker compose -f ~/execfi/docker-compose.prod.yml logs --tail=100 execfi
```

### **Check Status**

```bash
# Docker containers status
docker ps

# Detailed service status
docker compose -f ~/execfi/docker-compose.prod.yml ps

# Check if app is responding
curl http://localhost:3290

# Check from outside
curl http://31.97.110.176:3290
```

---

## 🔄 Update & Deployment

### **Force Update (Manual)**

```bash
cd ~/execfi

# Pull latest image
docker pull ghcr.io/flux-layer/execfi:staging

# Restart with new image
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### **Check Watchtower Activity**

```bash
# See what watchtower is doing
docker logs watchtower --tail=50 -f

# Check last update
docker logs watchtower | grep "Updated"
```

### **Verify Image Version**

```bash
# Check current running image
docker inspect execfi-app | grep -A 5 "Image"

# List all execfi images
docker images | grep execfi
```

---

## 🧹 Cleanup

### **Remove Old Images**

```bash
# Remove dangling images (Watchtower does this automatically)
docker image prune -f

# Remove all unused images
docker image prune -a -f

# Check disk usage
docker system df
```

### **Reset Everything**

```bash
cd ~/execfi
docker compose -f docker-compose.prod.yml down
docker system prune -a -f --volumes
docker compose -f docker-compose.prod.yml up -d
```

---

## 🔐 GitHub Registry Authentication

### **Re-authenticate with GHCR**

```bash
# If you need to login again
docker login ghcr.io -u YOUR_GITHUB_USERNAME
# Enter your Personal Access Token when prompted
```

### **Verify Authentication**

```bash
# Check if you can pull the image
docker pull ghcr.io/flux-layer/execfi:staging
```

---

## 🐛 Troubleshooting

### **Container Not Starting**

```bash
# Check logs
docker logs execfi-app

# Check if port is already in use
sudo netstat -tulpn | grep 3290

# Inspect container
docker inspect execfi-app
```

### **Watchtower Not Updating**

```bash
# Check watchtower logs
docker logs watchtower

# Restart watchtower
docker restart watchtower

# Verify watchtower can access registry
docker exec watchtower sh -c "docker pull ghcr.io/flux-layer/execfi:staging"
```

### **Can't Pull Image**

```bash
# Check authentication
cat ~/.docker/config.json

# Re-login to GHCR
docker login ghcr.io

# Check if image exists
# Visit: https://github.com/orgs/flux-layer/packages/container/execfi
```

### **High CPU/Memory Usage**

```bash
# Check resource usage
docker stats

# Check system resources
free -h
df -h
```

---

## 📊 Monitoring

### **Real-time Resource Monitoring**

```bash
# Container stats
docker stats execfi-app

# System resources
htop  # or top
```

### **Health Checks**

```bash
# Check if app is healthy
curl -f http://localhost:3290 || echo "App not responding"

# Check nginx
sudo systemctl status nginx

# Check SSL certificates
sudo certbot certificates
```

---

## 🔄 Automatic Deployment Flow

### **How It Works**

1. **Developer pushes to GitHub** (main/staging/bugfix branches)
   ```
   git push origin bugfix/swap
   ```

2. **GitHub Actions runs** (`.github/workflows/deploy-staging.yml`)
   - Builds Docker image
   - Pushes to `ghcr.io/flux-layer/execfi:staging`

3. **Watchtower detects new image** (every 5 minutes)
   - Polls GHCR for image updates
   - Compares image digest

4. **Watchtower updates container**
   - Pulls new image
   - Gracefully stops old container
   - Starts new container
   - Removes old image

5. **App is live with new code** 🎉

### **Check Deployment Status**

```bash
# Watch watchtower logs during deployment
docker logs watchtower -f

# Expected output when deploying:
# - "Found new image for execfi-app"
# - "Stopping container execfi-app"
# - "Starting container execfi-app"
# - "Removing image..."
```

---

## 🔧 Advanced Configuration

### **Change Watchtower Poll Interval**

```bash
# Edit docker-compose.prod.yml
nano ~/execfi/docker-compose.prod.yml

# Change WATCHTOWER_POLL_INTERVAL value (in seconds)
# 300 = 5 minutes
# 60 = 1 minute
# 600 = 10 minutes

# Restart watchtower
docker compose -f ~/execfi/docker-compose.prod.yml restart watchtower
```

### **Enable Watchtower Notifications**

Add to watchtower service in docker-compose.prod.yml:

```yaml
environment:
  - WATCHTOWER_NOTIFICATIONS=slack
  - WATCHTOWER_NOTIFICATION_SLACK_HOOK_URL=YOUR_WEBHOOK
```

---

## 📝 Useful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# ExecFi deployment aliases
alias execfi-logs='docker compose -f ~/execfi/docker-compose.prod.yml logs -f execfi'
alias execfi-status='docker compose -f ~/execfi/docker-compose.prod.yml ps'
alias execfi-restart='docker compose -f ~/execfi/docker-compose.prod.yml restart execfi'
alias execfi-update='cd ~/execfi && docker pull ghcr.io/flux-layer/execfi:staging && docker compose -f docker-compose.prod.yml up -d --force-recreate'
alias watchtower-logs='docker logs watchtower -f'
```

Then reload: `source ~/.bashrc`

---

## 🎯 Quick Deployment Test

```bash
# 1. Push a change to GitHub
git add .
git commit -m "test deployment"
git push origin main

# 2. Wait for GitHub Actions to complete (check: https://github.com/flux-layer/execfi/actions)

# 3. Watch watchtower on VPS
ssh execfi@31.97.110.176
docker logs watchtower -f

# 4. Within 5 minutes, you should see:
#    - "Found new image"
#    - Container restart
#    - New version running

# 5. Verify new version
curl http://31.97.110.176:3290
```

---

## 🆘 Emergency Rollback

If a deployment breaks production:

```bash
# 1. Find previous image
docker images | grep execfi

# 2. Stop current container
docker stop execfi-app

# 3. Run previous image
docker run -d --name execfi-app-rollback \
  -p 3290:3290 \
  --restart unless-stopped \
  ghcr.io/flux-layer/execfi:staging@sha256:PREVIOUS_DIGEST

# 4. Remove broken container
docker rm execfi-app

# 5. Rename rollback
docker rename execfi-app-rollback execfi-app
```

Or:

```bash
# Quick rollback to any version
docker tag ghcr.io/flux-layer/execfi:GOOD_TAG ghcr.io/flux-layer/execfi:staging
docker compose -f ~/execfi/docker-compose.prod.yml up -d --force-recreate
```

---

## 📚 Additional Resources

- **Watchtower Docs:** https://containrrr.dev/watchtower/
- **Docker Compose Docs:** https://docs.docker.com/compose/
- **GHCR Docs:** https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry

---

**Need help?** Check logs first:
```bash
docker compose -f ~/execfi/docker-compose.prod.yml logs --tail=100
```
