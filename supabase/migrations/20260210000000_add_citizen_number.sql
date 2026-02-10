-- Add citizenNumber field to User table for "Ciudadano Digital" feature
ALTER TABLE "User" ADD COLUMN "citizenNumber" INTEGER;

-- Create unique index
CREATE UNIQUE INDEX "User_citizenNumber_key" ON "User"("citizenNumber");

-- Create a sequence starting from 1 for auto-assigning citizen numbers
CREATE SEQUENCE IF NOT EXISTS citizen_number_seq START WITH 1 INCREMENT BY 1;

-- Backfill existing users (ordered by creation date — earliest users get lowest numbers)
UPDATE "User"
SET "citizenNumber" = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS rn
  FROM "User"
) sub
WHERE "User".id = sub.id;

-- Set sequence to continue after the highest assigned number
SELECT setval('citizen_number_seq', COALESCE((SELECT MAX("citizenNumber") FROM "User"), 0));

-- Grant sequence usage to the app role so runtime nextval() calls work
GRANT USAGE, SELECT ON SEQUENCE citizen_number_seq TO mvga_app;
