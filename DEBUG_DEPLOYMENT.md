# Debugging Deployment Issues

## Issue: "manifest unknown" error

This means the Docker image doesn't exist in ghcr.io yet. Here's how to debug:

### Step 1: Check if image was pushed

Go to your GitHub repo → **Packages** (right sidebar)

You should see a package named `hq-hackathon-project-1-fe` with tag `staging`.

**If you DON'T see it:**
- The GitHub Actions build succeeded but didn't push the image
- This happens when GitHub Secrets are missing or build args fail

### Step 2: Verify GitHub Actions logs

1. Go to **Actions** tab in GitHub
2. Click the latest workflow run
3. Expand "Build and push Docker image" step
4. Look for errors like:
   ```
   ERROR: failed to solve: failed to compute cache key
   ```
   This means build args (secrets) are empty.

### Step 3: Add ALL GitHub Secrets

You MUST add all these secrets (from your `.env`) in:
**Settings → Secrets and variables → Actions**

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
INTEGRATOR_LIFI
NEXT_PUBLIC_LISK_MAINNET
NEXT_PUBLIC_LISK_TESTNET
```

### Step 4: Make package public (if private)

If the package exists but VPS can't pull it:

1. Go to the package page: `https://github.com/users/TopengDev/packages/container/hq-hackathon-project-1-fe`
2. Click **Package settings** (gear icon)
3. Scroll to **Danger Zone** → Change visibility to **Public**

OR authenticate your VPS Docker with:
```bash
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u TopengDev --password-stdin
```

### Step 5: Manual build & push (temporary solution)

If GitHub Actions still fails, build and push manually:

```bash
# On your local machine
docker login ghcr.io -u TopengDev

# Build with all secrets from .env
docker buildx build \
  --platform linux/amd64 \
  --build-arg-file .env \
  -t ghcr.io/topengdev/hq-hackathon-project-1-fe:staging \
  --push \
  .
```

### Step 6: Verify image exists

```bash
# On VPS
docker pull ghcr.io/topengdev/hq-hackathon-project-1-fe:staging
```

If this works, then:
```bash
cd /opt/execfi
docker compose -f docker-compose.prod.yml up -d
```

## Quick Fix Checklist

- [ ] All GitHub Secrets added
- [ ] Package visibility is Public (or VPS authenticated to ghcr.io)
- [ ] Correct repository name in workflow (`hq-hackathon-project-1-fe`)
- [ ] Latest code pushed to `staging` branch
- [ ] GitHub Actions workflow completed successfully
- [ ] Image visible in GitHub Packages
