-- Add transaction tracking fields to game_sessions
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "wagerTxHash" VARCHAR(66);
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "resultTxHash" VARCHAR(66);
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "xpTxHash" VARCHAR(66);
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "game_sessions" ADD COLUMN IF NOT EXISTS "verifiedBy" VARCHAR(42);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "game_sessions_createdAt_idx" ON "game_sessions"("createdAt");
CREATE INDEX IF NOT EXISTS "game_sessions_finalizedAt_idx" ON "game_sessions"("finalizedAt");
CREATE INDEX IF NOT EXISTS "game_sessions_userAddress_createdAt_idx" ON "game_sessions"("userAddress", "createdAt" DESC);
