import { PrismaClient } from '@prisma/client';
import { laPazMonthStartUtc } from '../../utils/la-paz-date';

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

/** Monthly usage for a barber. Every cut counts, whatever its status. */
export async function getMonthlyCutUsage(
  prisma: PrismaClient,
  barberId: string,
  now: Date = new Date()
): Promise<MonthlyCutUsage> {
  const counts = await getMonthlyCutCounts(prisma, barberId, now);
  return { ...counts, usage: counts.inProgress + counts.finished + counts.cancelled };
}
