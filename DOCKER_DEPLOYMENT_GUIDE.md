# Sunday Quest - Docker Deployment Guide

## ✅ **What Was Fixed**

Added Sunday Quest environment variables to Docker configuration:
- `SUNDAY_QUEST_GAME_ID`
- `QUEST_SIGNER_PRIVATE_KEY`
- `BASE_SEPOLIA_RPC_URL`

These are now properly passed to the Docker container during build and runtime.

---

## 🚀 **Deploy to VPS**

### **Step 1: Update Your VPS .env File**

SSH to your VPS and add these variables:

```bash
# SSH to VPS
ssh execfi@srv906234

# Go to app directory
cd ~/app

# Edit .env file
nano .env
```

**Add these three lines:**
```bash
# Sunday Quest Configuration (ADD THESE)
SUNDAY_QUEST_GAME_ID=99
QUEST_SIGNER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE  # Your private key (same as GAME_SIGNER_PRIVATE_KEY or different)
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY_HERE
```

**Note:** 
- `QUEST_SIGNER_PRIVATE_KEY` can be the same as `GAME_SIGNER_PRIVATE_KEY` if you want
- Must start with `0x` and be 66 characters total
- `BASE_SEPOLIA_RPC_URL` can use your existing Alchemy key

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

---

### **Step 2: Pull Latest Code**

```bash
cd ~/app
git pull origin staging
```

---

### **Step 3: Rebuild Docker Container**

```bash
cd ~/app

# Stop current container
docker-compose down

# Rebuild with new environment variables
docker-compose build --no-cache

# Start container
docker-compose up -d
```

**This will:**
- ✅ Build with new Sunday Quest env vars
- ✅ Pass them to the running container
- ✅ Make claim API work properly

---

### **Step 4: Verify It Works**

Check the logs:

```bash
# View container logs
docker-compose logs -f execfi

# Or just tail recent logs
docker-compose logs --tail=50 execfi | grep -i "sunday\|claim"
```

---

### **Step 5: Test Claim API**

```bash
# Test the claim endpoint (replace with real completed quest)
curl -X POST https://your-domain.com/api/sunday-quest/claim \
  -H "Content-Type: application/json" \
  -d '{"questId": 1, "userAddress": "0x850BCbdf06D0798B41414E65ceaf192AD763F88d"}'
```

**Expected success:**
```json
{
  "success": true,
  "xpAwarded": 150,
  "signature": "0x1234...",
  "payload": { ... }
}
```

**If it fails, check logs:**
```bash
docker-compose logs execfi | grep "Claim API" | tail -20
```

You should now see detailed logging showing exactly what's happening.

---

## 📋 **GitHub Repository Secrets (If Using GitHub Actions)**

If you're deploying via GitHub Actions, add these secrets to your repo:

1. Go to: `https://github.com/YOUR_ORG/YOUR_REPO/settings/secrets/actions`

2. Click "New repository secret"

3. Add each secret:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `SUNDAY_QUEST_GAME_ID` | `99` | Just the number |
| `QUEST_SIGNER_PRIVATE_KEY` | `0xYOUR_KEY_HERE` | Full private key (66 chars) |
| `BASE_SEPOLIA_RPC_URL` | `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY` | Full Alchemy URL |

---

## 🔍 **Verify Environment Variables in Container**

After rebuilding, check if env vars are set inside the container:

```bash
# Check environment variables
docker-compose exec execfi env | grep -E "SUNDAY|QUEST_SIGNER|BASE_SEPOLIA"
```

**Expected output:**
```
SUNDAY_QUEST_GAME_ID=99
QUEST_SIGNER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_XP_REGISTRY_PROXY=0xBf227816Afc11b5DD720d601ECC14Fc5901C380b
```

If these are empty, your `.env` file isn't being read properly.

---

## 🆘 **Troubleshooting**

### **Issue: Variables still undefined in container**

**Fix 1: Check .env file location**
```bash
# .env should be in the same directory as docker-compose.yml
cd ~/app
ls -la .env
```

**Fix 2: Verify .env syntax**
```bash
# No spaces around =, no quotes needed
cat .env | grep -E "SUNDAY|QUEST_SIGNER|BASE_SEPOLIA"
```

**Correct:**
```bash
SUNDAY_QUEST_GAME_ID=99
QUEST_SIGNER_PRIVATE_KEY=0xYOUR_KEY_HERE
```

**Wrong:**
```bash
SUNDAY_QUEST_GAME_ID = 99  # ❌ Spaces around =
QUEST_SIGNER_PRIVATE_KEY="0xYOUR_KEY"  # ❌ Quotes
```

### **Issue: Build takes too long**

The `--no-cache` flag rebuilds everything. After first rebuild, you can use:
```bash
docker-compose build  # Faster, uses cache
docker-compose up -d
```

### **Issue: Still getting claim errors**

Check the detailed logs:
```bash
docker-compose logs execfi | grep "Claim API" | tail -30
```

With the new logging, you'll see:
- ✅ Environment variable validation
- ✅ Each step of signature generation
- ✅ Specific error messages

---

## 📊 **Complete Deployment Checklist**

- [ ] Added 3 env vars to VPS `.env` file
- [ ] Pulled latest code from staging
- [ ] Rebuilt Docker container with `docker-compose build --no-cache`
- [ ] Started container with `docker-compose up -d`
- [ ] Verified env vars in container with `docker-compose exec`
- [ ] Tested claim API endpoint
- [ ] Checked logs for "[Claim API]" messages
- [ ] (Optional) Added GitHub repository secrets

---

## 🎉 **Success!**

Once deployed, your Sunday Quest system will:
- ✅ Generate claim signatures properly
- ✅ Allow users to claim XP
- ✅ Auto-switch chains to Base Sepolia
- ✅ Track all quest progress
- ✅ Show malware UI on Sundays

**You're ready to launch! 🚀**
