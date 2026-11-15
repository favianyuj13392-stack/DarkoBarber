-- Session invalidation after a password change.
--
-- Adds "tokenVersion" to Barber and Client. JWTs carry it as the `tv` claim and
-- are rejected once the account's value moves on (bumped by password reset).
-- Existing rows default to 0, which matches tokens issued before this change,
-- so no current session is logged out by running this script.
-- Idempotent: safe to run more than once. Run manually against production.

ALTER TABLE "Barber" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
