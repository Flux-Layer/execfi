ALTER TABLE "coinflip_history"
ADD COLUMN "serverSeed" VARCHAR(128),
ADD COLUMN "clientSeed" VARCHAR(64),
ADD COLUMN "serverSeedHash" VARCHAR(100),
ADD COLUMN "randomValue" INTEGER,
ADD COLUMN "revealedAt" TIMESTAMP(3);
