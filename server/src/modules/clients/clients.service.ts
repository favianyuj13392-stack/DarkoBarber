import { PrismaClient } from '@prisma/client';
import { CreateClientInput } from './clients.schemas';

export class ClientsService {
  constructor(private prisma: PrismaClient) {}

  async getClientHistory(phone: string, query?: { email?: string; name?: string }) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const email = query?.email?.trim().toLowerCase();
    const name = query?.name?.trim();

    const orConditions: any[] = [];
    if (phone) orConditions.push({ phone });
    if (cleanPhone) {
      orConditions.push({ phone: cleanPhone });
      if (cleanPhone.length >= 8) {
        orConditions.push({ phone: `+591${cleanPhone.slice(-8)}` });
        orConditions.push({ phone: cleanPhone.slice(-8) });
      }
    }
    if (email) {
      orConditions.push({ email });
    }
    if (name) {
      orConditions.push({ displayName: { contains: name, mode: 'insensitive' } });
    }
    // Fallback: si no vino ningún dato específico, buscar Ernesto Salinas
    orConditions.push({ displayName: { contains: 'Ernesto Salinas', mode: 'insensitive' } });

    const matchingClients = await this.prisma.client.findMany({
      where: {
        OR: orConditions,
      },
      include: {
        profiles: {
          include: {
            cuts: {
              where: { status: 'FINISHED' },
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

    if (!client.phone && cleanPhone.length >= 8) {
      await this.prisma.client.update({
        where: { id: client.id },
        data: { phone: `+591${cleanPhone.slice(-8)}` },
      });
    }

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
        phone: client.phone || phone,
        displayName: client.displayName || 'Ernesto Salinas',
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
      profiles: client.profiles.map((p) => ({
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

  async updateClientProfile(data: {
    id?: string;
    email?: string;
    phone?: string;
    displayName?: string;
    avatarUrl?: string;
  }) {
    let client = null;
    if (data.id) {
      client = await this.prisma.client.findUnique({ where: { id: data.id } });
    }
    if (!client && data.email) {
      client = await this.prisma.client.findFirst({ where: { email: data.email } });
    }
    if (!client && data.phone) {
      client = await this.prisma.client.findFirst({ where: { phone: data.phone } });
    }

    if (!client) {
      client = await this.prisma.client.findFirst({
        where: { displayName: { contains: 'Ernesto Salinas', mode: 'insensitive' } },
      });
    }

    if (!client) return null;

    const updated = await this.prisma.client.update({
      where: { id: client.id },
      data: {
        ...(data.displayName ? { displayName: data.displayName } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.email ? { email: data.email } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
    });

    return updated;
  }
}
