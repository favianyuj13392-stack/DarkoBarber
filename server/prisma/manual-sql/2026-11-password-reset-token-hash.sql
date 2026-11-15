-- Password reset tokens: store only a SHA-256 hash of the token.
--
-- Replaces "PasswordResetToken"."token" (plaintext) with "tokenHash".
-- Existing rows hold plaintext tokens that cannot be converted into valid
-- hashes of anything the user still has, so they are deleted: every
-- outstanding reset link becomes unusable and users must request a new one.
-- Idempotent: safe to run more than once. Run manually against production.

BEGIN;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'PasswordResetToken' AND column_name = 'token'
  ) THEN
    DELETE FROM "PasswordResetToken";
    DROP INDEX IF EXISTS "PasswordResetToken_token_key";
    DROP INDEX IF EXISTS "PasswordResetToken_token_idx";
    ALTER TABLE "PasswordResetToken" DROP COLUMN "token";
  END IF;
END $$;

ALTER TABLE "PasswordResetToken" ADD COLUMN IF NOT EXISTS "tokenHash" TEXT;

DO $$ BEGIN
  -- Only reachable when no plaintext column existed and rows lack a hash.
  DELETE FROM "PasswordResetToken" WHERE "tokenHash" IS NULL;
  ALTER TABLE "PasswordResetToken" ALTER COLUMN "tokenHash" SET NOT NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

COMMIT;
