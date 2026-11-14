import { PrismaClient } from '@prisma/client';
import { CreateClientInput, UpdateClientProfileInput } from './clients.schemas';

export class ClientsService {
  constructor(private prisma: PrismaClient) {}

  /** Last 8 digits of a phone number (local Bolivian number), or '' if too short. */
  static normalizePhone(phone: string | null | undefined): string {
    const digits = (phone || '').replace(/\D/g, '');
    return digits.length >= 8 ? digits.slice(-8) : digits;
  }

  /** True when both phones are non-empty and refer to the same local number. */
  static samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
    const na = ClientsService.normalizePhone(a);
    const nb = ClientsService.normalizePhone(b);
    return na.length > 0 && na === nb;
  }

  /** Resolves a client strictly by phone (exact normalized variants). No name/email matching. */
  async findClientByPhone(phone: string) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!cleanPhone) return null;
    const local = cleanPhone.slice(-8);
    const candidates = Array.from(new Set([phone, cleanPhone, local, `+591${local}`]));
    return this.prisma.client.findFirst({ where: { phone: { in: candidates } } });
  }

  async barberHasCutWithClient(barberId: string, clientId: string): Promise<boolean> {
    const count = await this.prisma.cut.count({
      where: { barberId, clientProfile: { clientId } },
    });
    return count > 0;
  }

  /**
   * Empty history returned to barbers when the client has no cuts with them or the phone
   * is unknown. Both cases are indistinguishable on purpose (no existence leak) and carry
   * no private client data; only the requested phone is echoed back.
   */
  static emptyHistory(phone: string) {
    return {
      client: {
        id: null,
        phone,
        displayName: null,
        avatarUrl: '/assets/images/1.png',
        isVerified: false,
      },
      cuts: [],
      profiles: [],
    };
  }

  /**
   * Builds the history of a single, already-authorized client.
   * When `barberId` is given, only cuts performed by that barber (and their photos) are exposed.
   */
  async getClientHistory(clientId: string, barberId?: string) {
    const matchingClients = await this.prisma.client.findMany({
      where: { id: clientId },
      include: {
        profiles: {
          include: {
            cuts: {
              where: { status: 'FINISHED', ...(barberId ? { barberId } : {}) },
              orderBy: { startedAt: 'desc' },
              include: {
                photos: true,
                barber: {
                  include: { shop: true },
                },
              },
            },
          },
        },
      },
    });

    if (!matchingClients || matchingClients.length === 0) {
      return null;
    }

    const client = matchingClients.find((c) => c.profiles.some((p) => p.cuts.length > 0)) || matchingClients[0];

    // Unify cuts from all matching profiles (deduplicating by cut ID)
    const rawCuts = matchingClients.flatMap((c) => c.profiles.flatMap((p) => p.cuts));
    const seenCutIds = new Set<string>();
    const allCuts = rawCuts.filter((c) => {
      if (seenCutIds.has(c.id)) return false;
      seenCutIds.add(c.id);
      return true;
    });

    return {
      client: {
        id: client.id,
        phone: client.phone,
        displayName: client.displayName,
        avatarUrl: client.avatarUrl || '/assets/images/1.png',
        isVerified: true,
      },
      cuts: allCuts.map((c) => {
        const chipsObj = (c.chips as any) || {};
        const styleName = chipsObj.tipoDegradado
          ? `${chipsObj.tipoDegradado} · ${chipsObj.parteSuperior || 'Texturizado'}`
          : 'Fade Clásico';

        return {
          id: c.id,
          date: new Intl.DateTimeFormat('es-BO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }).format(c.startedAt),
          rawDate: c.startedAt.toISOString(),
          monthGroup: new Intl.DateTimeFormat('es-BO', {
            month: 'long',
            year: 'numeric',
          }).format(c.startedAt),
          styleName,
          barberName: c.barber?.displayName || 'Barbero FADE',
          barberAvatar: c.barber?.avatarUrl || undefined,
          shopName: c.barber?.shop?.name || 'Fade Studio — Sopocachi',
          durationMinutes: c.finishedAt
            ? Math.round((c.finishedAt.getTime() - c.startedAt.getTime()) / 60000)
            : 35,
          priceBs: 60,
          barberNotes: chipsObj.barberNotes || chipsObj.notasEspeciales?.[0] || 'Corte finalizado en sillón.',
          photos: c.photos.map((ph, idx) => ({
            id: ph.id,
            url: ph.r2Key,
            angle:
              idx === 0
                ? 'Frontal'
                : idx === 1
                ? 'Lateral Izquierdo'
                : idx === 2
                ? 'Lateral Derecho'
                : 'Trasero',
            isPublic: ph.isPublic,
          })),
          coverPhoto: c.photos[0]?.r2Key || '/assets/images/1.png',
          category: chipsObj.barba?.included ? 'combo' : 'corte',
          isFavorite: false,
          isVerified: true,
          specs: {
            degradedNumber: chipsObj.baseLateral || '#0.5',
            fadeType: chipsObj.tipoDegradado || 'Mid Fade',
            upperTreatment: chipsObj.parteSuperior || 'Texturizado',
            beardTreatment: chipsObj.barba?.included ? 'Perfilado' : 'Sin barba',
          },
          chips: chipsObj,
        };
      }),
      profiles: client.profiles
        .filter((p) => !barberId || p.cuts.length > 0)
        .map((p) => ({
        id: p.id,
        name: p.name,
      })),
    };
  }

  async createClient(input: CreateClientInput) {
    let client = await this.prisma.client.findUnique({
      where: { phone: input.phone },
    });

    if (!client) {
      client = await this.prisma.client.create({
        data: { phone: input.phone },
      });
    }

    const profile = await this.prisma.clientProfile.create({
      data: {
        clientId: client.id,
        name: input.name,
      },
    });

    return {
      client: {
        id: client.id,
        phone: client.phone,
      },
      profile: {
        id: profile.id,
        name: profile.name,
      },
    };
  }

  /** Updates only the given (already authenticated) client. Identity is never taken from the body. */
  async updateClientProfile(clientId: string, data: UpdateClientProfileInput) {
    return this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(data.displayName ? { displayName: data.displayName } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
      select: { id: true, email: true, phone: true, displayName: true, avatarUrl: true },
    });
  }
}
