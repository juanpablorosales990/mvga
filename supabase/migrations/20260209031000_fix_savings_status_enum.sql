-- Fix production mismatch: SavingsStatus enum missing 'PENDING'
-- This causes runtime errors when the API creates/cleans up pending savings deposits.

DO $$
BEGIN
  BEGIN
    -- Postgres 17 supports ADD VALUE IF NOT EXISTS.
    ALTER TYPE "SavingsStatus" ADD VALUE IF NOT EXISTS 'PENDING';
  EXCEPTION
    WHEN undefined_object THEN NULL;
    WHEN duplicate_object THEN NULL;
    WHEN insufficient_privilege THEN NULL;
  END;
END
$$;
