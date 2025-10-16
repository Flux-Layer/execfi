-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "userAddress" VARCHAR(42),
    "serverSeed" VARCHAR(100) NOT NULL,
    "serverSeedHash" VARCHAR(100) NOT NULL,
    "clientSeed" VARCHAR(100) NOT NULL,
    "createdAt" BIGINT NOT NULL,
    "wagerWei" VARCHAR(100),
    "nonceBase" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "rows" JSONB NOT NULL DEFAULT '[]',
    "currentRow" INTEGER NOT NULL DEFAULT 0,
    "currentMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "completedRows" INTEGER NOT NULL DEFAULT 0,
    "lockedTileCounts" JSONB NOT NULL DEFAULT '[]',
    "roundSummary" JSONB,
    "finalizedAt" BIGINT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "address" VARCHAR(42) NOT NULL,
    "onboardedAt" TIMESTAMP(3),
    "tutorialCompletedAt" TIMESTAMP(3),
    "tutorialSkipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "tutorial_progress" (
    "id" SERIAL NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "stepId" VARCHAR(100) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tutorial_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "fingerprint" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "onboardedAt" TIMESTAMP(3),
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingSkipped" BOOLEAN NOT NULL DEFAULT false,
    "userAddress" VARCHAR(42),
    "userAgent" TEXT,
    "locale" VARCHAR(10),
    "timezone" VARCHAR(50),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_progress" (
    "id" SERIAL NOT NULL,
    "deviceId" TEXT NOT NULL,
    "stepId" VARCHAR(100) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_sessions_userAddress_idx" ON "game_sessions"("userAddress");

-- CreateIndex
CREATE INDEX "game_sessions_isActive_idx" ON "game_sessions"("isActive");

-- CreateIndex
CREATE INDEX "game_sessions_expiresAt_idx" ON "game_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "game_sessions_userAddress_isActive_idx" ON "game_sessions"("userAddress", "isActive");

-- CreateIndex
CREATE INDEX "game_sessions_status_idx" ON "game_sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tutorial_progress_userAddress_stepId_key" ON "tutorial_progress"("userAddress", "stepId");

-- CreateIndex
CREATE INDEX "tutorial_progress_userAddress_idx" ON "tutorial_progress"("userAddress");

-- CreateIndex
CREATE UNIQUE INDEX "devices_fingerprint_key" ON "devices"("fingerprint");

-- CreateIndex
CREATE INDEX "devices_fingerprint_idx" ON "devices"("fingerprint");

-- CreateIndex
CREATE INDEX "devices_userAddress_idx" ON "devices"("userAddress");

-- CreateIndex
CREATE INDEX "devices_lastSeenAt_idx" ON "devices"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_deviceId_stepId_key" ON "onboarding_progress"("deviceId", "stepId");

-- CreateIndex
CREATE INDEX "onboarding_progress_deviceId_idx" ON "onboarding_progress"("deviceId");

-- AddForeignKey
ALTER TABLE "tutorial_progress" ADD CONSTRAINT "tutorial_progress_userAddress_fkey" FOREIGN KEY ("userAddress") REFERENCES "users"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
