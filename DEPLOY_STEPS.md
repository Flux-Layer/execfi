# Sunday Quest - Quick Deployment Steps

## ✅ Pre-Flight Check

Your environment variables are already set:
- ✅ `SUNDAY_QUEST_GAME_ID=99`
- ✅ `QUEST_SIGNER_PRIVATE_KEY` (configured)
- ✅ `NEXT_PUBLIC_XP_REGISTRY_PROXY=0xBf227816Afc11b5DD720d601ECC14Fc5901C380b`
- ✅ Build passes
- ✅ Code ready

---

## 🚀 Deploy in 7 Steps

### Step 1: Commit Your Changes

```bash
# Commit the build fix
git add src/hooks/useGreenvalePlots.ts

# Commit Sunday Quest files (if not already committed)
git add -A

# Create commit
git commit -m "feat: Add Sunday Quest system with malware UI

- 4 active quests: ETH transfers, swaps, transactions, spree
- Weekly rotation system
- Malware-themed UI (Sunday only)
- Alchemy verification for swaps (supports ETH→Token)
- XP claiming with auto chain-switch
- Fixed swap detection bug (now detects native ETH swaps)
- Disabled 3 quest templates
- Fixed useGreenvalePlots build errors

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

### Step 2: Push to Staging/Main

```bash
# Push to your branch
git push origin staging

# Or merge to main and push
git checkout main
git merge staging
git push origin main
```

### Step 3: Run Database Migration

**On your production database:**

```bash
# Option A: Using Prisma (recommended)
npx prisma migrate deploy

# Option B: Manual SQL (if prisma doesn't work)
psql $DATABASE_URL -f prisma/migrations/manual_sunday_quest/migration.sql
```

This creates 4 tables:
- `quest_templates`
- `weekly_quest_rotations`
- `user_quest_progress`
- `quest_completion_events`

### Step 4: Seed Quest Templates

**Run the seeding script:**

```bash
node scripts/migrate-sunday-quest.js
```

This creates 10 quest templates (4 active, 6 disabled).

### Step 5: Verify Environment Variables

**Make sure these are set in production:**

```bash
# Critical for Sunday Quest
SUNDAY_QUEST_GAME_ID=99
QUEST_SIGNER_PRIVATE_KEY=0x... # Same as your game signer
NEXT_PUBLIC_XP_REGISTRY_PROXY=0xBf227816Afc11b5DD720d601ECC14Fc5901C380b

# Already configured (verify they're correct)
NEXT_PUBLIC_ALCHEMY_KEY=your_key
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/...
DATABASE_URL=postgresql://...
```

### Step 6: Deploy to Production

**Depending on your platform:**

**Vercel:**
```bash
vercel --prod
```

**Railway:**
```bash
# Just push - auto deploys
git push origin main
```

**Render/Heroku:**
- Push triggers automatic deployment

**Docker:**
```bash
docker build -t sunday-quest .
docker push your-registry/sunday-quest:latest
```

### Step 7: Test the Deployment

1. **Visit the Sunday Quest page:**
   ```
   https://your-domain.com/sunday-quest
   ```

2. **Check API endpoint:**
   ```bash
   curl https://your-domain.com/api/sunday-quest/current
   ```

3. **Test quest flow:**
   - ✅ Should see 4 active quests
   - ✅ Click "Start Quest"
   - ✅ Perform required action (swap, transfer, etc.)
   - ✅ Click "Check Progress" - should update
   - ✅ Complete quest
   - ✅ Click "Claim XP" - should auto-switch to Base Sepolia
   - ✅ Approve transaction
   - ✅ XP awarded!

4. **Verify malware alert:**
   - ✅ Shows on Sundays (UTC)
   - ❌ Hidden on weekdays

---

## 📋 Quick Verification Checklist

After deployment, verify:

```bash
# Check database tables exist
psql $DATABASE_URL -c "SELECT COUNT(*) FROM quest_templates;"
# Should return: 10

# Check active quests
psql $DATABASE_URL -c "SELECT questKey, name, isActive FROM quest_templates WHERE isActive = true;"
# Should return: 4 active quests

# Check rotation exists
psql $DATABASE_URL -c "SELECT * FROM weekly_quest_rotations ORDER BY weekStartDate DESC LIMIT 1;"
# Should return: Current week's rotation
```

---

## 🎯 What You're Deploying

| Feature | Description |
|---------|-------------|
| **ETH Enthusiast** | Transfer ETH 3x (80 XP) |
| **Swap Starter** | Complete 1 swap (150 XP) |
| **Transaction Novice** | 5 transactions (90 XP) |
| **Transaction Spree** | 10 transactions in 24h (500 XP) |
| **Malware UI** | Only shows on Sundays |
| **Swap Detection** | Supports ETH→Token & Token→Token |
| **Auto Chain Switch** | Switches to Base Sepolia for claims |
| **Weekly Rotation** | New quests each Sunday |

**Total XP Available:** 820 per week

---

## 🆘 Troubleshooting

**Migration fails:**
```bash
# Check if tables already exist
psql $DATABASE_URL -c "\dt quest_*"

# If they exist, skip migration
```

**Seeding fails:**
```bash
# Check if templates already exist
psql $DATABASE_URL -c "SELECT COUNT(*) FROM quest_templates;"

# If > 0, they're already seeded
```

**Swap verification returns 0:**
- Verify `NEXT_PUBLIC_ALCHEMY_KEY` is set
- Check user performed swaps AFTER quest start time
- Check Basescan to confirm swaps exist

**XP claim fails:**
- Verify `NEXT_PUBLIC_XP_REGISTRY_PROXY` is correct
- Ensure it's the PROXY address (not implementation)
- Check user has wallet connected

**Malware alert not showing:**
- Check if it's Sunday (UTC): `date -u`
- Check user is authenticated with Privy

---

## 🎉 You're Ready!

Once deployed:
1. ✅ Users see malware alert on Sundays
2. ✅ Can start and complete quests
3. ✅ Progress tracks in real-time
4. ✅ Can claim XP on Base Sepolia
5. ✅ Weekly rotation updates automatically

**Questions?** Check `SUNDAY_QUEST_DEPLOYMENT.md` for detailed guide.
