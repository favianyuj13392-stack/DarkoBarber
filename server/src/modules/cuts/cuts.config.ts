/**
 * Cut quota configuration, read from environment variables.
 *
 * Variables (placeholder; set the real value in the deployment environment):
 *   CUTS_CANCEL_ALLOWANCE_PCT=5   percentage of the plan limit (0-50) of cancelled cuts per
 *                                 La Paz month that do not count toward the quota
 *
 * The accessor reads process.env on every call so tests can override values.
 */

export const DEFAULT_CUTS_CANCEL_ALLOWANCE_PCT = 5;
const MAX_CUTS_CANCEL_ALLOWANCE_PCT = 50;

function boundedNumber(raw: string | undefined, min: number, max: number, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export interface CutsConfig {
  cancelAllowancePct: number;
}

export function getCutsConfig(env: NodeJS.ProcessEnv = process.env): CutsConfig {
  return {
    cancelAllowancePct: boundedNumber(
      env.CUTS_CANCEL_ALLOWANCE_PCT,
      0,
      MAX_CUTS_CANCEL_ALLOWANCE_PCT,
      DEFAULT_CUTS_CANCEL_ALLOWANCE_PCT
    ),
  };
}
