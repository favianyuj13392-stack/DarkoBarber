-- DB-backed chair handshake (replaces the in-memory pendingChairBindings map).
-- Run manually against production BEFORE deploying the matching server build.
-- Idempotent: safe to run more than once.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChairBindingStatus') THEN
    CREATE TYPE "ChairBindingStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ChairBindingRequest" (
  "id"            TEXT NOT NULL,
  "barberId"      TEXT NOT NULL,
  "clientId"      TEXT NOT NULL,
  "status"        "ChairBindingStatus" NOT NULL DEFAULT 'PENDING',
  "activeKey"     TEXT,
  "isFirstScan"   BOOLEAN NOT NULL DEFAULT false,
  "acquiredCount" INTEGER NOT NULL DEFAULT 0,
  "deliveredAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "respondedAt"   TIMESTAMP(3),
  CONSTRAINT "ChairBindingRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChairBindingRequest_activeKey_key"
  ON "ChairBindingRequest" ("activeKey");
CREATE INDEX IF NOT EXISTS "ChairBindingRequest_barberId_status_expiresAt_idx"
  ON "ChairBindingRequest" ("barberId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "ChairBindingRequest_clientId_idx"
  ON "ChairBindingRequest" ("clientId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChairBindingRequest_barberId_fkey') THEN
    ALTER TABLE "ChairBindingRequest"
      ADD CONSTRAINT "ChairBindingRequest_barberId_fkey"
      FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChairBindingRequest_clientId_fkey') THEN
    ALTER TABLE "ChairBindingRequest"
      ADD CONSTRAINT "ChairBindingRequest_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
