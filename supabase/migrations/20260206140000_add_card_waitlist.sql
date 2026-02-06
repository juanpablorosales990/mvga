-- Card Waitlist for Banking feature
CREATE TABLE IF NOT EXISTS "CardWaitlist" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "walletAddress" TEXT NOT NULL,
  "email" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "CardWaitlist_walletAddress_idx" ON "CardWaitlist" ("walletAddress");
