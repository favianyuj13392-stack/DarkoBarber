import { PrismaClient, RewardClaimStatus } from '@prisma/client';
import { getRewardsConfig } from './rewards.config';

/** Small static list of throwaway-mail domains, used only as a review signal. */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'throwawaymail.com',
  'fakeinbox.com',
]);

export interface Collision {
  value: string;
  count: number;
}

export interface ReviewSummary {
  qualifiedClients: number;
  byIp: Collision[];
  byDevice: Collision[];
  collidingIps: number;
  collidingDevices: number;
  disposableEmailCount: number;
  avgHoursToQualify: number | null;
}

export type ClaimTransition =
  | { ok: true; claim: { id: string; status: RewardClaimStatus; barberId: string } }
  | { ok: false; reason: 'NOT_FOUND' | 'INVALID_STATE' | 'CAP_REACHED' };

const TOP_COLLISIONS = 5;

function groupCounts(values: Array<string | null>): Collision[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

class AbortTransition extends Error {
  constructor(public reason: 'INVALID_STATE' | 'CAP_REACHED') {
    super(reason);
  }
}

export class ClaimsAdminService {
  constructor(private prisma: PrismaClient) {}

  async buildReviewSummary(barberId: string): Promise<ReviewSummary> {
    const clients = await this.prisma.client.findMany({
      where: { firstScanBarberId: barberId, acquisitionStatus: 'QUALIFIED' },
      select: { email: true, signupIp: true, signupDeviceId: true, firstScanAt: true, qualifiedAt: true },
    });

    const byIp = groupCounts(clients.map((c) => c.signupIp));
    const byDevice = groupCounts(clients.map((c) => c.signupDeviceId));

    const disposableEmailCount = clients.filter((c) => {
      const domain = c.email?.split('@')[1]?.toLowerCase();
      return !!domain && DISPOSABLE_EMAIL_DOMAINS.has(domain);
    }).length;

    const deltas = clients
      .filter((c) => c.firstScanAt && c.qualifiedAt)
      .map((c) => (c.qualifiedAt!.getTime() - c.firstScanAt!.getTime()) / 3_600_000);
    const avgHoursToQualify = deltas.length
      ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
      : null;

    return {
      qualifiedClients: clients.length,
      byIp: byIp.slice(0, TOP_COLLISIONS),
      byDevice: byDevice.slice(0, TOP_COLLISIONS),
      collidingIps: byIp.filter((x) => x.count > 1).length,
      collidingDevices: byDevice.filter((x) => x.count > 1).length,
      disposableEmailCount,
      avgHoursToQualify,
    };
  }

  async listClaims(status?: RewardClaimStatus) {
    const claims = await this.prisma.rewardClaim.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'asc' },
      include: {
        barber: { select: { id: true, displayName: true, email: true, freeMonthsEarned: true } },
      },
    });

    return Promise.all(
      claims.map(async (claim) => ({
        id: claim.id,
        status: claim.status,
        type: claim.type,
        goalKey: claim.goalKey,
        qualifiedCountAtClaim: claim.qualifiedCountAtClaim,
        note: claim.note,
        reviewedAt: claim.reviewedAt,
        reviewedBy: claim.reviewedBy,
        createdAt: claim.createdAt,
        barber: claim.barber,
        review: await this.buildReviewSummary(claim.barberId),
      }))
    );
  }

  /** PENDING -> APPROVED and credit one free month, all in one transaction. */
  async approve(claimId: string): Promise<ClaimTransition> {
    const { maxFreeMonths } = getRewardsConfig();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const claim = await tx.rewardClaim.findUnique({ where: { id: claimId } });
        if (!claim) return { ok: false as const, reason: 'NOT_FOUND' as const };

        // Guarded transition: only one caller can move PENDING -> APPROVED.
        const moved = await tx.rewardClaim.updateMany({
          where: { id: claimId, status: 'PENDING' },
          data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: 'admin' },
        });
        if (moved.count !== 1) throw new AbortTransition('INVALID_STATE');

        const credited = await tx.barber.updateMany({
          where: { id: claim.barberId, freeMonthsEarned: { lt: maxFreeMonths } },
          data: { freeMonthsEarned: { increment: 1 } },
        });
        if (credited.count !== 1) throw new AbortTransition('CAP_REACHED'); // rolls back the status change

        return { ok: true as const, claim: { id: claim.id, status: 'APPROVED' as const, barberId: claim.barberId } };
      });
    } catch (err) {
      if (err instanceof AbortTransition) return { ok: false, reason: err.reason };
      throw err;
    }
  }

  /** PENDING -> REJECTED with a mandatory note. */
  async reject(claimId: string, note: string): Promise<ClaimTransition> {
    const claim = await this.prisma.rewardClaim.findUnique({ where: { id: claimId } });
    if (!claim) return { ok: false, reason: 'NOT_FOUND' };

    const moved = await this.prisma.rewardClaim.updateMany({
      where: { id: claimId, status: 'PENDING' },
      data: { status: 'REJECTED', note, reviewedAt: new Date(), reviewedBy: 'admin' },
    });
    if (moved.count !== 1) return { ok: false, reason: 'INVALID_STATE' };
    return { ok: true, claim: { id: claim.id, status: 'REJECTED', barberId: claim.barberId } };
  }

  /**
   * APPROVED -> REVERSED, removes one credited month (never below 0) and optionally
   * marks the barber's QUALIFIED clients as REVOKED.
   */
  async reverse(claimId: string, opts: { note?: string; revokeClients?: boolean } = {}): Promise<ClaimTransition> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const claim = await tx.rewardClaim.findUnique({ where: { id: claimId } });
        if (!claim) return { ok: false as const, reason: 'NOT_FOUND' as const };

        const moved = await tx.rewardClaim.updateMany({
          where: { id: claimId, status: 'APPROVED' },
          data: { status: 'REVERSED', note: opts.note ?? claim.note, reviewedAt: new Date(), reviewedBy: 'admin' },
        });
        if (moved.count !== 1) throw new AbortTransition('INVALID_STATE');

        await tx.barber.updateMany({
          where: { id: claim.barberId, freeMonthsEarned: { gt: 0 } },
          data: { freeMonthsEarned: { decrement: 1 } },
        });

        if (opts.revokeClients) {
          await tx.client.updateMany({
            where: { firstScanBarberId: claim.barberId, acquisitionStatus: 'QUALIFIED' },
            data: { acquisitionStatus: 'REVOKED' },
          });
        }

        return { ok: true as const, claim: { id: claim.id, status: 'REVERSED' as const, barberId: claim.barberId } };
      });
    } catch (err) {
      if (err instanceof AbortTransition) return { ok: false, reason: 'INVALID_STATE' };
      throw err;
    }
  }
}
