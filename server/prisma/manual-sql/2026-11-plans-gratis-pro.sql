-- Migration: 2-tier pricing model (GRATIS, PRO)
-- Replaces legacy tiers (AUTONOMO, BARBERIA_BASE, ALTO_FLUJO).
--
-- Idempotent: safe to run manually against production PostgreSQL (Supabase).

DO $$
BEGIN
  -- Add new enum values if they don't already exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'GRATIS' AND enumtypid = '"Plan"'::regtype) THEN
    ALTER TYPE "Plan" ADD VALUE 'GRATIS';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PRO' AND enumtypid = '"Plan"'::regtype) THEN
    ALTER TYPE "Plan" ADD VALUE 'PRO';
  END IF;
END $$;

-- Update column default to GRATIS
ALTER TABLE "Barber" ALTER COLUMN "plan" SET DEFAULT 'GRATIS'::"Plan";

-- Migrate existing barbers to PRO for prospecting/testing as requested
UPDATE "Barber"
SET "plan" = 'PRO'::"Plan"
WHERE "plan"::text IN ('AUTONOMO', 'BARBERIA_BASE', 'ALTO_FLUJO');
