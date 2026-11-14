import { Prisma, PrismaClient, RewardClaim } from '@prisma/client';
import { getRewardsConfig } from './rewards.config';
import { QualificationService } from './qualification.service';

export const REWARD_TITLE = '1 Mes Gratis — Plan Barbería Base (Bs 110)';

export function acquisitionGoalKey(goal: number): string {
  return `ACQ_${goal}`;
}

export interface RewardsProgress {
  barberId: string;
  goal: number;
  goalKey: string;
  qualified: number;
  pending: number;
  revoked: number;
  remaining: number;
  percentage: number;
  goalReached: boolean;
  claim: { id: string; status: string } | null;
  freeMonthsEarned: number;
  maxFreeMonths: number;
  /** Legacy aliases kept for the existing frontend. */
  acquiredCount: number;
  rewardUnlocked: boolean;
  rewardTitle: string;
}

export class RewardsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Real acquisition progress. Lazily evaluates pending clients first so that the
   * numbers reflect qualification that happened since the last call. Only QUALIFIED
   * clients count toward the goal; there is no floor or demo padding.
   */
  async getProgress(barberId: string): Promise<RewardsProgress> {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
      select: { id: true, freeMonthsEarned: true },
    });
    if (!barber) throw new Error('Barber not found');

    await new QualificationService(this.prisma).evaluateAllPendingForBarber(barberId);

    const config = getRewardsConfig();
    const goalKey = acquisitionGoalKey(config.acquisitionGoal);

    const [grouped, claim] = await Promise.all([
      this.prisma.client.groupBy({
        by: ['acquisitionStatus'],
        where: { firstScanBarberId: barberId, acquisitionStatus: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.rewardClaim.findUnique({
        where: { barberId_type_goalKey: { barberId, type: 'ACQUISITION_BONUS', goalKey } },
        select: { id: true, status: true },
      }),
    ]);

    const countOf = (status: 'QUALIFIED' | 'PENDING' | 'REVOKED') =>
      grouped.find((g) => g.acquisitionStatus === status)?._count._all ?? 0;

    const qualified = countOf('QUALIFIED');
    const goalReached = qualified >= config.acquisitionGoal;

    return {
      barberId,
      goal: config.acquisitionGoal,
      goalKey,
      qualified,
      pending: countOf('PENDING'),
      revoked: countOf('REVOKED'),
      remaining: Math.max(0, config.acquisitionGoal - qualified),
      percentage: Math.min(100, Math.round((qualified / config.acquisitionGoal) * 100)),
      goalReached,
      claim: claim ? { id: claim.id, status: claim.status } : null,
      freeMonthsEarned: barber.freeMonthsEarned,
      maxFreeMonths: config.maxFreeMonths,
      acquiredCount: qualified,
      rewardUnlocked: goalReached,
      rewardTitle: REWARD_TITLE,
    };
  }

  /**
   * Creates the one-time acquisition bonus claim (status PENDING). It never touches
   * freeMonthsEarned: credit happens only when an admin approves the claim.
   * Atomicity/idempotency relies on the DB unique (barberId, type, goalKey).
   */
  async createClaim(barberId: string): Promise<CreateClaimResult> {
    const progress = await this.getProgress(barberId);

    const existing = await this.findClaim(barberId, progress.goalKey);
    if (existing) return { outcome: 'ALREADY_CLAIMED', claim: existing };

    if (!progress.goalReached) {
      return { outcome: 'GOAL_NOT_REACHED', progress };
    }
    if (progress.freeMonthsEarned >= progress.maxFreeMonths) {
      return { outcome: 'CAP_REACHED', progress };
    }

    try {
      const claim = await this.prisma.rewardClaim.create({
        data: {
          barberId,
          type: 'ACQUISITION_BONUS',
          goalKey: progress.goalKey,
          status: 'PENDING',
          qualifiedCountAtClaim: progress.qualified,
        },
      });
      return { outcome: 'CREATED', claim };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const raced = await this.findClaim(barberId, progress.goalKey);
        if (raced) return { outcome: 'ALREADY_CLAIMED', claim: raced };
      }
      throw err;
    }
  }

  private findClaim(barberId: string, goalKey: string) {
    return this.prisma.rewardClaim.findUnique({
      where: { barberId_type_goalKey: { barberId, type: 'ACQUISITION_BONUS', goalKey } },
    });
  }
}

export type CreateClaimResult =
  | { outcome: 'CREATED'; claim: RewardClaim }
  | { outcome: 'ALREADY_CLAIMED'; claim: RewardClaim }
  | { outcome: 'GOAL_NOT_REACHED'; progress: RewardsProgress }
  | { outcome: 'CAP_REACHED'; progress: RewardsProgress };
