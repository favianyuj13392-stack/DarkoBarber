import { Prisma, PrismaClient } from '@prisma/client';

/**
 * DB-backed chair handshake. A client scans a barber's QR (POST /presence/chair/bind),
 * which creates a PENDING ChairBindingRequest; the barber picks it up by polling and
 * then accepts or dismisses it. Expiry is evaluated on read, no cron is required.
 *
 * Env: CHAIR_BIND_TTL_SECONDS (default 120).
 */

const DEFAULT_TTL_SECONDS = 120;

export function chairBindTtlSeconds(): number {
  const n = Number(process.env.CHAIR_BIND_TTL_SECONDS);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_TTL_SECONDS;
}

const activeKeyOf = (barberId: string, clientId: string) => `${barberId}:${clientId}`;

export interface CreateChairBindingInput {
  barberId: string;
  clientId: string;
  isFirstScan: boolean;
  acquiredCount: number;
}

export class ChairBindingService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Marks stale PENDING rows as EXPIRED and frees their active key. */
  private async expireStale(where: Prisma.ChairBindingRequestWhereInput, now: Date) {
    await this.prisma.chairBindingRequest.updateMany({
      where: { ...where, status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED', activeKey: null },
    });
  }

  /**
   * Creates (or refreshes) the single active pending request for (barber, client).
   * The unique activeKey makes concurrent duplicate scans converge on one row.
   */
  async createPending(input: CreateChairBindingInput) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + chairBindTtlSeconds() * 1000);
    const activeKey = activeKeyOf(input.barberId, input.clientId);

    await this.expireStale({ activeKey }, now);

    try {
      return await this.prisma.chairBindingRequest.create({
        data: {
          barberId: input.barberId,
          clientId: input.clientId,
          activeKey,
          isFirstScan: input.isFirstScan,
          acquiredCount: input.acquiredCount,
          expiresAt,
        },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      // A pending request already exists: refresh it so the barber sees it again.
      const existing = await this.prisma.chairBindingRequest.updateMany({
        where: { activeKey, status: 'PENDING' },
        data: { expiresAt, deliveredAt: null, acquiredCount: input.acquiredCount },
      });
      if (existing.count === 0) throw err;
      return this.prisma.chairBindingRequest.findUniqueOrThrow({ where: { activeKey } });
    }
  }

  /**
   * Barber poll: returns the oldest not-yet-delivered pending request addressed to this
   * barber and marks it delivered, so each handshake pops up once.
   */
  async claimNextForBarber(barberId: string) {
    const now = new Date();
    await this.expireStale({ barberId }, now);

    for (let attempt = 0; attempt < 3; attempt++) {
      const next = await this.prisma.chairBindingRequest.findFirst({
        where: { barberId, status: 'PENDING', deliveredAt: null, expiresAt: { gt: now } },
        orderBy: { createdAt: 'asc' },
        include: { client: true },
      });
      if (!next) return null;
      const claimed = await this.prisma.chairBindingRequest.updateMany({
        where: { id: next.id, status: 'PENDING', deliveredAt: null },
        data: { deliveredAt: now },
      });
      if (claimed.count === 1) return next;
    }
    return null;
  }

  /**
   * Barber accepts or dismisses a request addressed to them. Returns null when the
   * request does not exist, belongs to another barber, or is no longer pending/expired.
   */
  async respond(barberId: string, requestId: string, action: 'accept' | 'decline') {
    const now = new Date();
    const result = await this.prisma.chairBindingRequest.updateMany({
      where: { id: requestId, barberId, status: 'PENDING', expiresAt: { gt: now } },
      data: {
        status: action === 'accept' ? 'ACCEPTED' : 'CANCELLED',
        activeKey: null,
        respondedAt: now,
      },
    });
    if (result.count === 0) return null;
    return this.prisma.chairBindingRequest.findUniqueOrThrow({ where: { id: requestId } });
  }

  /** Client-side view of their own latest request (ownership enforced by clientId). */
  async getForClient(clientId: string, requestId: string) {
    const now = new Date();
    await this.expireStale({ id: requestId, clientId }, now);
    return this.prisma.chairBindingRequest.findFirst({ where: { id: requestId, clientId } });
  }
}
