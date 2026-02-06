-- Add role column to User table for admin authorization
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'USER';

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
