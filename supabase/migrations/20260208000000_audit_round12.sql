-- =============================================================================
-- Audit Round 12 Migration
-- TransactionLog indexes + P2PTrade cascade protection
-- =============================================================================

-- 1. Add missing indexes on TransactionLog for query performance
CREATE INDEX IF NOT EXISTS "TransactionLog_confirmedAt_idx" ON "TransactionLog" ("confirmedAt");
CREATE INDEX IF NOT EXISTS "TransactionLog_walletAddress_confirmedAt_idx" ON "TransactionLog" ("walletAddress", "confirmedAt");

-- 2. Change P2PTrade -> P2POffer cascade from CASCADE to RESTRICT
--    Prevents accidental deletion of offers that have active trades with escrowed funds
ALTER TABLE "P2PTrade" DROP CONSTRAINT IF EXISTS "P2PTrade_offerId_fkey";
ALTER TABLE "P2PTrade" ADD CONSTRAINT "P2PTrade_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "P2POffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
