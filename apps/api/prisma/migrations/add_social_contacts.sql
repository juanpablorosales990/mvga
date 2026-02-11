-- Social Contacts: Server-side contact sync for Cash App-style P2P
-- Phase 1 of social payments feature

-- Step 1: Create contacts table
CREATE TABLE IF NOT EXISTS "Contact" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" TEXT NOT NULL,
  "contactAddress" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- Step 2: Unique constraint (one entry per owner+address pair)
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_ownerId_contactAddress_key"
  ON "Contact"("ownerId", "contactAddress");

-- Step 3: Regular indexes
CREATE INDEX IF NOT EXISTS "Contact_ownerId_idx"
  ON "Contact"("ownerId");
CREATE INDEX IF NOT EXISTS "Contact_contactAddress_idx"
  ON "Contact"("contactAddress");

-- Step 4: Foreign key
ALTER TABLE "Contact"
  ADD CONSTRAINT "Contact_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Grant access to Railway app role
GRANT SELECT, INSERT, UPDATE, DELETE ON "Contact" TO mvga_app;
