import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

/**
 * Global rate limiting.
 *
 * Every request is limited per client IP. Sensitive unauthenticated endpoints
 * (login, register, password reset, email verification, Google login) get a much
 * stricter budget. Counters are per endpoint, and the optional `/api` prefix is
 * stripped from the key so `/auth/login` and `/api/auth/login` share one bucket
 * (the app mounts every route under both prefixes).
 *
 * Environment variables:
 *   RATE_LIMIT_MAX            requests per window per IP, all other routes (default 300)
 *   RATE_LIMIT_WINDOW_MS      window length in ms, shared by all limits (default 60000)
 *   AUTH_RATE_LIMIT_MAX       requests per window per IP, per auth endpoint (default 10)
 *
 * In NODE_ENV=test the defaults are effectively unlimited so unrelated suites are not
 * throttled; a test opts in by setting the variables above before building the app.
 * Client IP comes from the socket unless TRUST_PROXY is configured (see app.ts).
 *
 * The state is in-process (per instance), like the chair-bind limiter.
 */

export const AUTH_RATE_LIMITED_PATHS: ReadonlySet<string> = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/email/verify',
  '/clients/me/email/verify-request',
]);

const TEST_UNLIMITED = 1_000_000;

function positiveInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export interface RateLimitSettings {
  max: number;
  windowMs: number;
  authMax: number;
}

export function resolveRateLimitSettings(): RateLimitSettings {
  const isTest = process.env.NODE_ENV === 'test';
  return {
    max: positiveInt('RATE_LIMIT_MAX', isTest ? TEST_UNLIMITED : 300),
    windowMs: positiveInt('RATE_LIMIT_WINDOW_MS', 60_000),
    authMax: positiveInt('AUTH_RATE_LIMIT_MAX', isTest ? TEST_UNLIMITED : 10),
  };
}

/** Route pattern without the `/api` prefix, or null when the route is unknown (404). */
function normalizedRoute(url: string | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/api/') ? url.slice(4) : url;
}

export default fp(async (fastify) => {
  const settings = resolveRateLimitSettings();

  await fastify.register(rateLimit, {
    global: true,
    max: (request) =>
      AUTH_RATE_LIMITED_PATHS.has(normalizedRoute(request.routeOptions?.url) ?? '')
        ? settings.authMax
        : settings.max,
    // The plugin applies a single time window to its store; only the max differs.
    timeWindow: settings.windowMs,
    keyGenerator: (request) => {
      const route = normalizedRoute(request.routeOptions?.url) ?? '';
      const scope = AUTH_RATE_LIMITED_PATHS.has(route) ? route : '*';
      return `${request.ip}|${scope}`;
    },
    // Never throttle health probes.
    allowList: (request) => request.routeOptions?.url === '/health',
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'RATE_LIMITED',
      message: `Too many requests. Try again in ${Math.ceil(context.ttl / 1000)}s.`,
    }),
  });
});
