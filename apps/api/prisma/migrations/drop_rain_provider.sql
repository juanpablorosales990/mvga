-- Drop Rain-specific columns from CardApplication
ALTER TABLE "CardApplication" DROP COLUMN IF EXISTS "rainUserId";
ALTER TABLE "CardApplication" DROP COLUMN IF EXISTS "rainCardId";
ALTER TABLE "CardApplication" DROP COLUMN IF EXISTS "chainId";
ALTER TABLE "CardApplication" DROP COLUMN IF EXISTS "depositAddr";

-- Remove RAIN from CardProvider enum
-- Note: PostgreSQL doesn't support DROP VALUE from enum directly.
-- Existing rows with RAIN should not exist (Rain was never used in production).
-- If any exist, update them to NONE first:
UPDATE "CardApplication" SET "provider" = 'NONE' WHERE "provider" = 'RAIN';
