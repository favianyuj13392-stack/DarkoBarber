import { PrismaClient } from '@prisma/client';
import { laPazMonthStartUtc } from '../../utils/la-paz-date';
import { getCutsConfig } from './cuts.config';

/** Monthly cut limits per plan. Plans missing here (ALTO_FLUJO) are unlimited. */
export const PLAN_CUT_LIMITS: Readonly<Record<string, number>> = {
  AUTONOMO: 60,
  BARBERIA_BASE: 200,
};

/** Returns the monthly cut limit for a plan, or null when the plan has no limit. */
export function getPlanCutLimit(plan: string): number | null {
  return PLAN_CUT_LIMITS[plan] ?? null;
}

export interface MonthlyCutCounts {
  inProgress: number;
  finished: number;
  cancelled: number;
}

export interface MonthlyCutUsage extends MonthlyCutCounts {
  /** Number of cuts that count against the plan limit this La Paz month. */
  usage: number;
  /** Cancelled cuts per month that do not count toward the quota. */
  cancelAllowance: number;
}

/** Display-only cap used to size the allowance for plans without a limit. */
const UNLIMITED_PLAN_DISPLAY_LIMIT = 9999;

/** Free cancellations per month: a percentage of the plan limit, never fewer than 1. */
export function computeCancelAllowance(limit: number, allowancePct: number): number {
  return Math.max(1, Math.ceil((limit * allowancePct) / 100));
}

/**
 * usage = finished + inProgress + max(0, cancelled - allowance)
 *
 * Cancelled cuts are free only up to a small allowance, so a barber cannot perform the
 * service and then cancel instead of finishing to avoid filling the quota.
 */
export function computeUsage(counts: MonthlyCutCounts, limit: number, allowancePct: number): number {
  const allowance = computeCancelAllowance(limit, allowancePct);
  return counts.finished + counts.inProgress + Math.max(0, counts.cancelled - allowance);
}

/** Counts a barber's cuts by status since 00:00 La Paz on day 1 of the month containing `now`. */
export async function getMonthlyCutCounts(
  prisma: PrismaClient,
  barberId: string,
  now: Date = new Date()
): Promise<MonthlyCutCounts> {
  const groups = await prisma.cut.groupBy({
    by: ['status'],
    where: { barberId, startedAt: { gte: laPazMonthStartUtc(now) } },
    _count: { _all: true },
  });
  const countOf = (status: string) => groups.find((g) => g.status === status)?._count._all ?? 0;
  return {
    inProgress: countOf('IN_PROGRESS'),
    finished: countOf('FINISHED'),
    cancelled: countOf('CANCELLED'),
  };
}

/** Monthly quota usage for a barber on a plan, using the configured cancellation allowance. */
export async function getMonthlyCutUsage(
  prisma: PrismaClient,
  barberId: string,
  plan: string,
  now: Date = new Date()
): Promise<MonthlyCutUsage> {
  const counts = await getMonthlyCutCounts(prisma, barberId, now);
  const limit = getPlanCutLimit(plan) ?? UNLIMITED_PLAN_DISPLAY_LIMIT;
  const { cancelAllowancePct } = getCutsConfig();
  return {
    ...counts,
    usage: computeUsage(counts, limit, cancelAllowancePct),
    cancelAllowance: computeCancelAllowance(limit, cancelAllowancePct),
  };
}
