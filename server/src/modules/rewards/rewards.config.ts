/**
 * Rewards program configuration, read from environment variables.
 *
 * Variables (placeholders; set real values in the deployment environment):
 *   REWARD_ACQUISITION_GOAL=15              qualified clients needed per reward goal
 *   REWARD_MAX_FREE_MONTHS=3                cap on free months a barber can earn
 *   REWARD_QUALIFY_MIN_DAYS_AFTER_SIGNUP=1  La Paz calendar days between signup and qualifying activity
 *   ADMIN_API_KEY=change_me                 admin endpoints key; when unset, admin endpoints are DISABLED
 *   APP_PUBLIC_URL=https://example.com      public app URL used to build email links
 *   EMAIL_VERIFICATION_TTL_HOURS=24         email verification link lifetime
 *   EMAIL_VERIFICATION_MAX_PER_DAY=3        max verification emails per client per La Paz day
 *
 * Accessors read process.env on every call so tests can override values.
 */

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export interface RewardsConfig {
  acquisitionGoal: number;
  maxFreeMonths: number;
  qualifyMinDaysAfterSignup: number;
  /** undefined means admin endpoints are disabled. */
  adminApiKey: string | undefined;
  appPublicUrl: string;
  emailVerificationTtlHours: number;
  emailVerificationMaxPerDay: number;
}

export function getRewardsConfig(env: NodeJS.ProcessEnv = process.env): RewardsConfig {
  const adminKey = env.ADMIN_API_KEY?.trim();
  return {
    acquisitionGoal: positiveInt(env.REWARD_ACQUISITION_GOAL, 15),
    maxFreeMonths: positiveInt(env.REWARD_MAX_FREE_MONTHS, 3),
    qualifyMinDaysAfterSignup: positiveInt(env.REWARD_QUALIFY_MIN_DAYS_AFTER_SIGNUP, 1),
    adminApiKey: adminKey ? adminKey : undefined,
    appPublicUrl: (env.APP_PUBLIC_URL?.trim() || 'http://localhost:5173').replace(/\/+$/, ''),
    emailVerificationTtlHours: positiveInt(env.EMAIL_VERIFICATION_TTL_HOURS, 24),
    emailVerificationMaxPerDay: positiveInt(env.EMAIL_VERIFICATION_MAX_PER_DAY, 3),
  };
}
