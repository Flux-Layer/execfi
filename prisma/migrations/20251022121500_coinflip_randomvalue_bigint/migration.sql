ALTER TABLE "coinflip_history"
  ALTER COLUMN "randomValue" TYPE BIGINT USING "randomValue"::BIGINT;
