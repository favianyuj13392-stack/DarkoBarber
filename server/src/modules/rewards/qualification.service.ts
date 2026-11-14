import { PrismaClient } from '@prisma/client';
import { laPazDaysBetween } from '../../utils/la-paz-date';
import { getRewardsConfig } from './rewards.config';

export class QualificationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Promotes a captured client from PENDING to QUALIFIED when:
   *  - it was captured by a barber (firstScanBarberId and firstScanAt set),
   *  - its acquisition status is PENDING (REVOKED / null never qualify),
   *  - its email is verified,
   *  - it has at least one activity at least REWARD_QUALIFY_MIN_DAYS_AFTER_SIGNUP
   *    La Paz calendar days after the La Paz date of firstScanAt.
   * Idempotent: the update is guarded on status PENDING. Returns true only when
   * this call performed the promotion.
   */
  async evaluate(clientId: string, now: Date = new Date()): Promise<boolean> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        firstScanBarberId: true,
        firstScanAt: true,
        acquisitionStatus: true,
        emailVerifiedAt: true,
      },
    });

    if (
      !client ||
      !client.firstScanBarberId ||
      !client.firstScanAt ||
      client.acquisitionStatus !== 'PENDING' ||
      !client.emailVerifiedAt
    ) {
      return false;
    }

    const { qualifyMinDaysAfterSignup } = getRewardsConfig();
    const firstScanAt = client.firstScanAt;

    const activities = await this.prisma.clientActivity.findMany({
      where: { clientId, createdAt: { gt: firstScanAt } },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const hasQualifyingActivity = activities.some(
      (a) => laPazDaysBetween(firstScanAt, a.createdAt) >= qualifyMinDaysAfterSignup
    );
    if (!hasQualifyingActivity) return false;

    const result = await this.prisma.client.updateMany({
      where: { id: clientId, acquisitionStatus: 'PENDING' },
      data: { acquisitionStatus: 'QUALIFIED', qualifiedAt: now },
    });
    return result.count === 1;
  }

  /**
   * Lazily evaluates every PENDING client of a barber that already has a verified
   * email. Returns how many were newly qualified. Intended to be called by the
   * barber progress / claim endpoints.
   */
  async evaluateAllPendingForBarber(barberId: string, now: Date = new Date()): Promise<number> {
    const pending = await this.prisma.client.findMany({
      where: {
        firstScanBarberId: barberId,
        acquisitionStatus: 'PENDING',
        emailVerifiedAt: { not: null },
      },
      select: { id: true },
    });

    let qualified = 0;
    for (const { id } of pending) {
      if (await this.evaluate(id, now)) qualified += 1;
    }
    return qualified;
  }
}
