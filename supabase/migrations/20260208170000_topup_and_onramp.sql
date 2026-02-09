-- Mobile Top-Ups (Reloadly)
DO $$
BEGIN
  CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS "TopUp" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
  "userId" TEXT NOT NULL,
  "recipientPhone" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "operatorId" INTEGER NOT NULL,
  "operatorName" TEXT NOT NULL,
  "amountUsd" DOUBLE PRECISION NOT NULL,
  "deliveredAmount" DOUBLE PRECISION,
  "deliveredCurrency" TEXT,
  "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
  "reloadlyTxId" TEXT,
  "customIdentifier" TEXT NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TopUp_pkey" PRIMARY KEY ("id")
);

-- The remote database may already have this table created by another path
-- (e.g. Prisma). Index/GRANT statements require ownership, so guard them to
-- avoid aborting the whole migration during launch.
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "TopUp_reloadlyTxId_key" ON "TopUp"("reloadlyTxId");
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "TopUp_customIdentifier_key" ON "TopUp"("customIdentifier");
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    CREATE INDEX IF NOT EXISTS "TopUp_userId_idx" ON "TopUp"("userId");
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    CREATE INDEX IF NOT EXISTS "TopUp_status_idx" ON "TopUp"("status");
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    GRANT USAGE ON TYPE "TopUpStatus" TO mvga_app;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    GRANT ALL PRIVILEGES ON TABLE "TopUp" TO mvga_app;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
