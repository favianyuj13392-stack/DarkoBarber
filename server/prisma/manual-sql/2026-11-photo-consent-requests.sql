-- DB-backed in-chair photo consent (replaces the in-memory consent request/response maps).
-- Run manually against production AFTER 2026-11-chair-binding-requests.sql and BEFORE
-- deploying the matching server build. Idempotent: safe to run more than once.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PhotoConsentStatus') THEN
    CREATE TYPE "PhotoConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED', 'EXPIRED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "PhotoConsentRequest" (
  "id"                 TEXT NOT NULL,
  "barberId"           TEXT NOT NULL,
  "clientId"           TEXT NOT NULL,
  "cutId"              TEXT,
  "status"             "PhotoConsentStatus" NOT NULL DEFAULT 'PENDING',
  "activeKey"          TEXT,
  "isPublic"           BOOLEAN NOT NULL DEFAULT false,
  "styleName"          TEXT,
  "notes"              TEXT,
  "responseConsumedAt" TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "respondedAt"        TIMESTAMP(3),
  CONSTRAINT "PhotoConsentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PhotoConsentRequest_activeKey_key"
  ON "PhotoConsentRequest" ("activeKey");
CREATE INDEX IF NOT EXISTS "PhotoConsentRequest_clientId_status_expiresAt_idx"
  ON "PhotoConsentRequest" ("clientId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "PhotoConsentRequest_barberId_status_respondedAt_idx"
  ON "PhotoConsentRequest" ("barberId", "status", "respondedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PhotoConsentRequest_barberId_fkey') THEN
    ALTER TABLE "PhotoConsentRequest"
      ADD CONSTRAINT "PhotoConsentRequest_barberId_fkey"
      FOREIGN KEY ("barberId") REFERENCES "Barber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PhotoConsentRequest_clientId_fkey') THEN
    ALTER TABLE "PhotoConsentRequest"
      ADD CONSTRAINT "PhotoConsentRequest_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PhotoConsentRequest_cutId_fkey') THEN
    ALTER TABLE "PhotoConsentRequest"
      ADD CONSTRAINT "PhotoConsentRequest_cutId_fkey"
      FOREIGN KEY ("cutId") REFERENCES "Cut"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
