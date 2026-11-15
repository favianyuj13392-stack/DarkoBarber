-- Booking lifecycle: add REJECTED and NO_SHOW to the "BookingStatus" enum.
--
-- Run ONCE manually against production (the project has no migrations folder),
-- before deploying the booking state machine. It is idempotent: IF NOT EXISTS
-- makes re-running a no-op. Existing rows are untouched.
--
-- Do NOT wrap this in BEGIN/COMMIT: a newly added enum value cannot be used in
-- the same transaction that created it, and ALTER TYPE ... ADD VALUE is not
-- allowed inside a transaction block on older PostgreSQL versions.

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';
