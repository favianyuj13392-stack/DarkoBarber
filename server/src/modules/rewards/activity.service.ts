import { PrismaClient, ClientActivityType } from '@prisma/client';
import { toLaPazDateString } from '../../utils/la-paz-date';

export class ActivityService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Records a client activity, at most one row per (client, type, La Paz day).
   * Returns true when a new row was created, false when deduplicated.
   * (Two truly concurrent calls could both insert; harmless, since qualification
   * only needs the existence of activity on a given day.)
   */
  async record(clientId: string, type: ClientActivityType, now: Date = new Date()): Promise<boolean> {
    // 36h look-back always covers the whole current La Paz day.
    const recent = await this.prisma.clientActivity.findMany({
      where: { clientId, type, createdAt: { gt: new Date(now.getTime() - 36 * 3600 * 1000) } },
      select: { createdAt: true },
    });

    const today = toLaPazDateString(now);
    if (recent.some((a) => toLaPazDateString(a.createdAt) === today)) {
      return false;
    }

    await this.prisma.clientActivity.create({ data: { clientId, type, createdAt: now } });
    return true;
  }
}
