-- Guarantee one follow row per (barber, client).
--
-- The Prisma schema already declares @@unique([barberId, clientId]); this script
-- makes sure production actually has the index, which the idempotent follow
-- endpoints rely on (INSERT ... ON CONFLICT DO NOTHING). Existing duplicates are
-- removed first (the oldest row per pair is kept) so the index can be created.
-- Idempotent: safe to run more than once. Run manually against production.

DELETE FROM "BarberFollower" f
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "barberId", "clientId"
           ORDER BY "createdAt" ASC, id ASC
         ) AS rn
  FROM "BarberFollower"
) d
WHERE f.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "BarberFollower_barberId_clientId_key"
  ON "BarberFollower" ("barberId", "clientId");
