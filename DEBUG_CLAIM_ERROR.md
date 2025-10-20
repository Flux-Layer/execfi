# Debugging "Failed to generate claim signature" Error

## 🔍 **What Could Be Wrong**

The claim API needs these environment variables to work:

1. ✅ `QUEST_SIGNER_PRIVATE_KEY` - Private key to sign XP claims
2. ✅ `NEXT_PUBLIC_XP_REGISTRY_PROXY` - XP Registry contract address
3. ✅ `SUNDAY_QUEST_GAME_ID` - Game ID (should be 99)
4. ✅ `BASE_SEPOLIA_RPC_URL` - RPC endpoint for Base Sepolia

---

## 📝 **Check Your VPS Environment Variables**

On your VPS, run:

```bash
cd ~/app

# Check all required variables
echo "=== SUNDAY QUEST CONFIG ==="
echo "SUNDAY_QUEST_GAME_ID: $SUNDAY_QUEST_GAME_ID"
echo "QUEST_SIGNER_PRIVATE_KEY: ${QUEST_SIGNER_PRIVATE_KEY:0:10}... (length: ${#QUEST_SIGNER_PRIVATE_KEY})"
echo "NEXT_PUBLIC_XP_REGISTRY_PROXY: $NEXT_PUBLIC_XP_REGISTRY_PROXY"
echo "BASE_SEPOLIA_RPC_URL: ${BASE_SEPOLIA_RPC_URL:0:30}..."

# Or check .env file directly
grep -E "SUNDAY_QUEST|QUEST_SIGNER|XP_REGISTRY|BASE_SEPOLIA" .env
```

---

## ✅ **Expected Values**

Your `.env` on VPS should have:

```bash
# Sunday Quest Configuration
SUNDAY_QUEST_GAME_ID=99

# Quest Signer (MUST start with 0x and be 66 characters)
QUEST_SIGNER_PRIVATE_KEY=0x1234567890abcdef...  # 64 hex chars after 0x

# XP Registry (MUST start with 0x and be 42 characters)
NEXT_PUBLIC_XP_REGISTRY_PROXY=0xBf227816Afc11b5DD720d601ECC14Fc5901C380b

# RPC URL for Base Sepolia
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
```

---

## 🚨 **Common Mistakes**

### **1. Missing Private Key**
```bash
# ❌ Wrong: Missing or empty
QUEST_SIGNER_PRIVATE_KEY=

# ✅ Correct: Full private key with 0x prefix
QUEST_SIGNER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
```

### **2. Wrong Format**
```bash
# ❌ Wrong: No 0x prefix
QUEST_SIGNER_PRIVATE_KEY=1234567890abcdef...

# ❌ Wrong: Wrapped in quotes that get included
QUEST_SIGNER_PRIVATE_KEY="0x123..."

# ✅ Correct: Plain value with 0x prefix
QUEST_SIGNER_PRIVATE_KEY=0x123...
```

### **3. Missing XP Registry Address**
```bash
# ❌ Wrong: Empty or undefined
NEXT_PUBLIC_XP_REGISTRY_PROXY=

# ✅ Correct: Contract address
NEXT_PUBLIC_XP_REGISTRY_PROXY=0xBf227816Afc11b5DD720d601ECC14Fc5901C380b
```

---

## 🔧 **How to Fix**

### **Step 1: Pull Latest Code (with detailed logging)**

```bash
cd ~/app
git pull origin staging
```

### **Step 2: Update .env File**

```bash
cd ~/app
nano .env  # or vim .env
```

**Add/verify these lines:**
```bash
SUNDAY_QUEST_GAME_ID=99
QUEST_SIGNER_PRIVATE_KEY=0x... # YOUR PRIVATE KEY
NEXT_PUBLIC_XP_REGISTRY_PROXY=0xBf227816Afc11b5DD720d601ECC14Fc5901C380b
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

### **Step 3: Restart Your App**

```bash
# Restart to load new env vars
pm2 restart all
# or
docker-compose restart
# or
systemctl restart your-app
```

### **Step 4: Check Application Logs**

Now with detailed logging, you'll see exactly where it fails:

```bash
# PM2 logs
pm2 logs

# Docker logs
docker-compose logs -f app

# Or check log files
tail -f /var/log/your-app/error.log
```

---

## 📊 **What the Logs Will Show**

With the new logging, you'll see:

### **✅ Success:**
```
[Claim API] Processing claim for quest 1, user 0x850B...
[Claim API] Game ID: 99
[Claim API] XP Registry: 0xBf22...
[Claim API] Creating RPC client for Base Sepolia...
[Claim API] Reading nonce from XP Registry...
[Claim API] Nonce: 0
[Claim API] Creating signature payload...
[Claim API] Payload: { user: '0x850b...', gameId: '99', amount: '150', ... }
[Claim API] Creating signer account...
[Claim API] Signer address: 0x1C79...
[Claim API] Signing typed data...
[Claim API] Signature generated: 0x1234567890abcdef...
```

### **❌ Missing Env Var:**
```
[Claim API] QUEST_SIGNER_PRIVATE_KEY is missing or invalid
```

### **❌ RPC Error:**
```
[Claim API] Reading nonce from XP Registry...
[Claim API] Failed to generate claim signature: Error: could not coalesce error
[Claim API] Error details: could not coalesce error
```
This means RPC connection or contract call failed.

### **❌ Invalid Private Key:**
```
[Claim API] Creating signer account...
[Claim API] Failed to generate claim signature: Error: Invalid private key
```

---

## 🧪 **Test the Fix**

After fixing, test the claim API:

```bash
# Get a completed quest ID first, then:
curl -X POST https://your-domain.com/api/sunday-quest/claim \
  -H "Content-Type: application/json" \
  -d '{"questId": 1, "userAddress": "0x850BCbdf06D0798B41414E65ceaf192AD763F88d"}'
```

**Expected success response:**
```json
{
  "success": true,
  "xpAwarded": 150,
  "signature": "0x1234...",
  "payload": { ... }
}
```

---

## 🆘 **Still Having Issues?**

If it still fails, share these details:

```bash
# On VPS:
cd ~/app

# 1. Check env vars (redacted)
echo "QUEST_SIGNER_PRIVATE_KEY length: ${#QUEST_SIGNER_PRIVATE_KEY}"
echo "QUEST_SIGNER_PRIVATE_KEY starts with: ${QUEST_SIGNER_PRIVATE_KEY:0:4}"
echo "XP_REGISTRY_PROXY: $NEXT_PUBLIC_XP_REGISTRY_PROXY"

# 2. Check logs
pm2 logs --lines 50 | grep "Claim API"
# or
docker-compose logs app | grep "Claim API" | tail -20

# 3. Test RPC connection
curl https://base-sepolia.g.alchemy.com/v2/YOUR_KEY \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

Share the output of these commands!
