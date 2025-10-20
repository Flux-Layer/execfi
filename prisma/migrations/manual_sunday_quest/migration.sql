-- CreateEnum for Quest types
DO $$ BEGIN
 CREATE TYPE "QuestType" AS ENUM ('TRANSACTION', 'COMBO', 'EXPLORATION', 'ACHIEVEMENT', 'SOCIAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "QuestDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EPIC');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "QuestStatus" AS ENUM ('AVAILABLE', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'COMPLETED', 'CLAIMED', 'FAILED', 'EXPIRED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable quest_templates
CREATE TABLE IF NOT EXISTS "quest_templates" (
    "id" SERIAL NOT NULL,
    "questKey" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "questType" "QuestType" NOT NULL,
    "difficulty" "QuestDifficulty" NOT NULL,
    "requirements" JSONB NOT NULL,
    "baseXpReward" INTEGER NOT NULL,
    "bonusMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "estimatedTime" INTEGER NOT NULL,
    "iconUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quest_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable weekly_quest_rotations
CREATE TABLE IF NOT EXISTS "weekly_quest_rotations" (
    "id" SERIAL NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "questSlots" JSONB NOT NULL,
    "seed" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_quest_rotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable user_quest_progress
CREATE TABLE IF NOT EXISTS "user_quest_progress" (
    "id" SERIAL NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "rotationId" INTEGER NOT NULL,
    "questTemplateId" INTEGER NOT NULL,
    "status" "QuestStatus" NOT NULL,
    "progress" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "transactionHash" VARCHAR(66),
    "xpAwarded" INTEGER,

    CONSTRAINT "user_quest_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable quest_completion_events
CREATE TABLE IF NOT EXISTS "quest_completion_events" (
    "id" SERIAL NOT NULL,
    "userAddress" VARCHAR(42) NOT NULL,
    "questTemplateId" INTEGER NOT NULL,
    "rotationId" INTEGER NOT NULL,
    "completionProof" JSONB NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "xpAwarded" INTEGER NOT NULL,
    "transactionHash" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quest_completion_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "quest_templates_questKey_key" ON "quest_templates"("questKey");
CREATE INDEX IF NOT EXISTS "quest_templates_questType_idx" ON "quest_templates"("questType");
CREATE INDEX IF NOT EXISTS "quest_templates_difficulty_idx" ON "quest_templates"("difficulty");
CREATE INDEX IF NOT EXISTS "quest_templates_isActive_idx" ON "quest_templates"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_quest_rotations_weekStartDate_key" ON "weekly_quest_rotations"("weekStartDate");
CREATE INDEX IF NOT EXISTS "weekly_quest_rotations_weekStartDate_isActive_idx" ON "weekly_quest_rotations"("weekStartDate", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_quest_progress_userAddress_rotationId_questTemplateId_key" ON "user_quest_progress"("userAddress", "rotationId", "questTemplateId");
CREATE INDEX IF NOT EXISTS "user_quest_progress_userAddress_status_idx" ON "user_quest_progress"("userAddress", "status");
CREATE INDEX IF NOT EXISTS "user_quest_progress_rotationId_idx" ON "user_quest_progress"("rotationId");
CREATE INDEX IF NOT EXISTS "user_quest_progress_status_idx" ON "user_quest_progress"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quest_completion_events_userAddress_idx" ON "quest_completion_events"("userAddress");
CREATE INDEX IF NOT EXISTS "quest_completion_events_createdAt_idx" ON "quest_completion_events"("createdAt");

-- AddForeignKey
DO $$ BEGIN
 ALTER TABLE "user_quest_progress" ADD CONSTRAINT "user_quest_progress_questTemplateId_fkey" FOREIGN KEY ("questTemplateId") REFERENCES "quest_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
