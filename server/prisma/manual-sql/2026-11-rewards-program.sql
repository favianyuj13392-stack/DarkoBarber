-- Rewards program (part 1): acquisition qualification, activity log,
-- email verification tokens and reward claims.
--
-- Generated from `prisma migrate diff` (main schema -> feat/rewards-program schema),
-- then made idempotent by hand: enums/constraints are guarded with DO blocks,
-- tables/columns/indexes use IF NOT EXISTS. It is safe to run more than once.
-- Run manually against production (the project has no migrations folder).
--
-- Existing clients are NOT affected: "acquisitionStatus" is added as a nullable
-- column with no default, so every pre-existing row stays NULL (never counted).

BEGIN;

-- Enums
DO $$ BEGIN
  CREATE TYPE "AcquisitionStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClientActivityType" AS ENUM ('HISTORY_VIEW', 'CONSENT_UPDATE', 'BOOKING_CREATED', 'CUT_CONFIRMED', 'APP_SESSION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RewardType" AS ENUM ('ACQUISITION_BONUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RewardClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Client columns
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "acquisitionStatus" "AcquisitionStatus",
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "qualifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "signupDeviceId" TEXT,
  ADD COLUMN IF NOT EXISTS "signupIp" TEXT;

-- Tables
CREATE TABLE IF NOT EXISTS "ClientActivity" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "ClientActivityType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RewardClaim" (
    "id" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "type" "RewardType" NOT NULL,
    "goalKey" TEXT NOT NULL,
    "status" "RewardClaimStatus" NOT NULL DEFAULT 'PENDING',
    "qualifiedCountAtClaim" INTEGER NOT NULL,
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardClaim_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "ClientActivity_clientId_createdAt_idx" ON "ClientActivity"("clientId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_clientId_idx" ON "EmailVerificationToken"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "RewardClaim_barberId_type_goalKey_key" ON "RewardClaim"("barberId", "type", "goalKey");
CREATE INDEX IF NOT EXISTS "Client_firstScanBarberId_acquisitionStatus_idx" ON "Client"("firstScanBarberId", "acquisitionStatus");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "ClientActivity" ADD CONSTRAINT "ClientActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
