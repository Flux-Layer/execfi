-- CreateTable
CREATE TABLE "coinflip_history" (
    "id" SERIAL NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "sessionId" VARCHAR(32),
    "guess" VARCHAR(10) NOT NULL,
    "outcome" VARCHAR(10) NOT NULL,
    "wagerWei" VARCHAR(100) NOT NULL,
    "selectedMultiplier" INTEGER NOT NULL,
    "payoutMultiplier" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coinflip_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coinflip_history_userAddress_createdAt_idx" ON "coinflip_history"("userAddress", "createdAt");
