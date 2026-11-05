import { PrismaClient } from '@prisma/client';
import { CreateClientInput } from './clients.schemas';

export class ClientsService {
  constructor(private prisma: PrismaClient) {}

  async getClientHistory(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const client = await this.prisma.client.findFirst({
      where: {
        OR: [
          { phone },
          { phone: cleanPhone },
          { phone: `+591${cleanPhone.slice(-8)}` },
          { phone: cleanPhone.slice(-8) },
        ],
      },
      include: {
        profiles: {
          include: {
            cuts: {
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

    if (!client) {
      return null;
    }

    const allCuts = client.profiles.flatMap((p) => p.cuts);

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
          barberNotes: chipsObj.notasEspeciales?.[0] || 'Corte finalizado en sillón.',
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
}
