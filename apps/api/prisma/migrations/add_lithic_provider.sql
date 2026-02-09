-- Add Lithic card provider support to CardApplication
-- Created: 2026-02-09

DO $$ BEGIN
  CREATE TYPE "CardProvider" AS ENUM ('NONE', 'LITHIC', 'RAIN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "CardApplication"
  ADD COLUMN IF NOT EXISTS "provider" "CardProvider" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "lithicAccountHolderToken" TEXT,
  ADD COLUMN IF NOT EXISTS "lithicAccountToken" TEXT,
  ADD COLUMN IF NOT EXISTS "lithicCardToken" TEXT,
  ADD COLUMN IF NOT EXISTS "lithicFinancialAccountToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CardApplication_lithicAccountHolderToken_key"
  ON "CardApplication"("lithicAccountHolderToken");
CREATE UNIQUE INDEX IF NOT EXISTS "CardApplication_lithicAccountToken_key"
  ON "CardApplication"("lithicAccountToken");
CREATE UNIQUE INDEX IF NOT EXISTS "CardApplication_lithicCardToken_key"
  ON "CardApplication"("lithicCardToken");

-- Backfill existing Rain applications
UPDATE "CardApplication"
  SET "provider" = 'RAIN'
  WHERE "rainUserId" IS NOT NULL AND "provider" = 'NONE';
