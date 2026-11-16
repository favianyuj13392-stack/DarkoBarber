import { Prisma, PrismaClient } from '@prisma/client';

/**
 * DB-backed in-chair photo consent. The barber opens a request, the authenticated client
 * answers it on their own device, and the barber reads the answer once.
 * Only ids and short text are stored, never image data.
 *
 * Env: PHOTO_CONSENT_TTL_SECONDS (default 600).
 */

const DEFAULT_TTL_SECONDS = 600;
// A barber may only ask a client they are currently serving: an accepted/pending chair
// handshake in this window, or an in-progress cut for that client.
const RECENT_BINDING_WINDOW_MS = 12 * 60 * 60 * 1000;

export function photoConsentTtlSeconds(): number {
  const n = Number(process.env.PHOTO_CONSENT_TTL_SECONDS);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_TTL_SECONDS;
}

const activeKeyOf = (barberId: string, clientId: string) => `${barberId}:${clientId}`;

export type ConsentRequestError = 'CLIENT_NOT_FOUND' | 'NOT_SERVING_CLIENT' | 'CUT_NOT_FOUND';

export interface CreateConsentInput {
  barberId: string;
  clientId?: string;
  clientPhone?: string;
  cutId?: string;
  styleName?: string;
  notes?: string;
}

export class PhotoConsentService {
  constructor(private readonly prisma: PrismaClient) {}

  private async expireStale(where: Prisma.PhotoConsentRequestWhereInput, now: Date) {
    await this.prisma.photoConsentRequest.updateMany({
      where: { ...where, status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED', activeKey: null },
    });
  }

  private async resolveClientId(input: CreateConsentInput): Promise<string | null> {
    if (input.clientId) {
      const c = await this.prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } });
      return c?.id ?? null;
    }
    const digits = (input.clientPhone || '').replace(/\D/g, '');
    if (!digits) return null;
    const c = await this.prisma.client.findFirst({
      where: {
        OR: [
          { phone: input.clientPhone },
          { phone: digits },
          { phone: `+591${digits.slice(-8)}` },
          { phone: digits.slice(-8) },
        ],
      },
      select: { id: true },
    });
    return c?.id ?? null;
  }

  async create(
    input: CreateConsentInput
  ): Promise<{ ok: true; request: { id: string; expiresAt: Date } } | { ok: false; error: ConsentRequestError }> {
    const clientId = await this.resolveClientId(input);
    if (!clientId) return { ok: false, error: 'CLIENT_NOT_FOUND' };

    const now = new Date();
    const [binding, activeCut] = await Promise.all([
      this.prisma.chairBindingRequest.findFirst({
        where: {
          barberId: input.barberId,
          clientId,
          status: { in: ['PENDING', 'ACCEPTED'] },
          createdAt: { gt: new Date(now.getTime() - RECENT_BINDING_WINDOW_MS) },
        },
        select: { id: true },
      }),
      this.prisma.cut.findFirst({
        where: { barberId: input.barberId, status: 'IN_PROGRESS', clientProfile: { clientId } },
        select: { id: true },
      }),
    ]);
    if (!binding && !activeCut) return { ok: false, error: 'NOT_SERVING_CLIENT' };

    if (input.cutId) {
      const cut = await this.prisma.cut.findFirst({
        where: { id: input.cutId, barberId: input.barberId, clientProfile: { clientId } },
        select: { id: true },
      });
      if (!cut) return { ok: false, error: 'CUT_NOT_FOUND' };
    }

    const expiresAt = new Date(now.getTime() + photoConsentTtlSeconds() * 1000);
    const activeKey = activeKeyOf(input.barberId, clientId);
    await this.expireStale({ activeKey }, now);

    const data = {
      cutId: input.cutId ?? null,
      styleName: input.styleName ?? null,
      notes: input.notes ?? null,
      expiresAt,
    };
    try {
      const row = await this.prisma.photoConsentRequest.create({
        data: { barberId: input.barberId, clientId, activeKey, ...data },
      });
      return { ok: true, request: { id: row.id, expiresAt: row.expiresAt } };
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
      // Re-asking supersedes the open request for the same pair.
      const updated = await this.prisma.photoConsentRequest.updateMany({
        where: { activeKey, status: 'PENDING' },
        data,
      });
      if (updated.count === 0) throw err;
      const row = await this.prisma.photoConsentRequest.findUniqueOrThrow({ where: { activeKey } });
      return { ok: true, request: { id: row.id, expiresAt: row.expiresAt } };
    }
  }

  /** Oldest open request addressed to this client. */
  async getPendingForClient(clientId: string) {
    const now = new Date();
    await this.expireStale({ clientId }, now);
    return this.prisma.photoConsentRequest.findFirst({
      where: { clientId, status: 'PENDING', expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
      include: { barber: { select: { id: true, displayName: true } }, client: { select: { phone: true } } },
    });
  }

  /** The client answers one of their own pending requests. Null when not answerable. */
  async respond(clientId: string, requestId: string, isPublic: boolean) {
    const now = new Date();
    const result = await this.prisma.photoConsentRequest.updateMany({
      where: { id: requestId, clientId, status: 'PENDING', expiresAt: { gt: now } },
      data: {
        status: isPublic ? 'GRANTED' : 'DENIED',
        isPublic,
        activeKey: null,
        respondedAt: now,
      },
    });
    if (result.count === 0) return null;
    return this.prisma.photoConsentRequest.findUniqueOrThrow({ where: { id: requestId } });
  }

  /**
   * Barber reads the client's answer once. With requestId, a still-pending or expired
   * request is reported through `status` so the UI can stop waiting.
   */
  async consumeResponseForBarber(barberId: string, requestId?: string) {
    const now = new Date();
    await this.expireStale({ barberId }, now);

    const answered = await this.prisma.photoConsentRequest.findFirst({
      where: {
        barberId,
        ...(requestId ? { id: requestId } : {}),
        status: { in: ['GRANTED', 'DENIED'] },
        responseConsumedAt: null,
      },
      orderBy: { respondedAt: 'desc' },
      include: { client: { select: { phone: true } } },
    });
    if (answered) {
      const claimed = await this.prisma.photoConsentRequest.updateMany({
        where: { id: answered.id, responseConsumedAt: null },
        data: { responseConsumedAt: now },
      });
      if (claimed.count === 1) return { answered, status: answered.status };
    }

    let status: string | null = null;
    if (requestId) {
      const row = await this.prisma.photoConsentRequest.findFirst({
        where: { id: requestId, barberId },
        select: { status: true },
      });
      status = row?.status ?? null;
    }
    return { answered: null, status };
  }
}
