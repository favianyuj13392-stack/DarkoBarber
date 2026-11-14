/**
 * Minimal in-process fixed-window rate limiter for POST /presence/chair/bind.
 * State is per Node process (not shared across instances); it only needs to blunt
 * scripted abuse. Limits are configurable through environment variables:
 *   CHAIR_BIND_MAX_PER_CLIENT_PER_MIN (default 10)
 *   CHAIR_BIND_MAX_PER_IP_PER_MIN     (default 30)
 */

const WINDOW_MS = 60_000;
const MAX_ENTRIES = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function limitFromEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function hit(key: string, max: number, now: number): { ok: boolean; retryAfterSeconds: number } {
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    ok: bucket.count <= max,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

function prune(now: number): void {
  if (buckets.size < MAX_ENTRIES) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkChairBindRateLimit(
  clientId: string,
  ip: string | undefined,
  now: number = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  prune(now);
  const byClient = hit(`c:${clientId}`, limitFromEnv('CHAIR_BIND_MAX_PER_CLIENT_PER_MIN', 10), now);
  const byIp = hit(`i:${ip ?? 'unknown'}`, limitFromEnv('CHAIR_BIND_MAX_PER_IP_PER_MIN', 30), now);
  return {
    allowed: byClient.ok && byIp.ok,
    retryAfterSeconds: Math.max(byClient.retryAfterSeconds, byIp.retryAfterSeconds),
  };
}

/** Test helper. */
export function resetChairBindRateLimit(): void {
  buckets.clear();
}
