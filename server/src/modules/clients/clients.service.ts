import { PrismaClient } from '@prisma/client';
import { CreateClientInput } from './clients.schemas';

export class ClientsService {
  constructor(private prisma: PrismaClient) {}

  async getClientHistory(phone: string) {
    const client = await this.prisma.client.findUnique({
      where: { phone },
      include: {
        profiles: {
          include: {
            cuts: {
              orderBy: { startedAt: 'desc' },
              include: {
                photos: true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      return null;
    }

    return {
      client: {
        id: client.id,
        phone: client.phone,
      },
      profiles: client.profiles.map((p) => ({
        id: p.id,
        name: p.name,
        cuts: p.cuts.map((c) => ({
          id: c.id,
          startedAt: c.startedAt.toISOString(),
          finishedAt: c.finishedAt ? c.finishedAt.toISOString() : null,
          chips: c.chips,
          rapidClosure: c.rapidClosure,
          photos: c.photos.map((ph) => ({
            id: ph.id,
            r2Key: ph.r2Key,
            isPublic: ph.isPublic,
          })),
        })),
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
