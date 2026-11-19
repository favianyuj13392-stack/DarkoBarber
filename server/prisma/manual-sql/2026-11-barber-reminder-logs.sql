-- Migration: Barber reminder logs for PRO loyalty and retention notifications.
-- Tracks monthly reminder emails sent to prevent quota abuse (limit: 12/month).
-- Idempotent: safe to run manually against production PostgreSQL (Supabase).

CREATE TABLE IF NOT EXISTS "BarberReminderLog" (
  "id" TEXT PRIMARY KEY,
  "barberId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "BarberReminderLog_barberId_sentAt_idx" ON "BarberReminderLog"("barberId", "sentAt");
