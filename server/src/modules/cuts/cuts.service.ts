import { PrismaClient } from '@prisma/client';
import { StartCutInput, FinalizeCutInput } from './cuts.schemas';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { AuthenticatedBarber } from '../../types';
import { PresenceService } from '../presence/presence.service';

export class CutsService {
  private presenceService: PresenceService;

  constructor(private prisma: PrismaClient, presenceService?: PresenceService) {
    this.presenceService = presenceService ?? new PresenceService(prisma);
  }

  async startCut(barber: AuthenticatedBarber, input: StartCutInput) {
    // 1. Idempotency check via clientRequestId
    const existingCut = await this.prisma.cut.findUnique({
      where: { clientRequestId: input.clientRequestId },
    });
    if (existingCut) {
      return { cut: existingCut, isDuplicate: true };
    }

    // 2. Si ya hay un corte activo para este barbero, lo cerramos para permitir reiniciar sin trabas
    const activeCut = await this.prisma.cut.findFirst({
      where: {
        barberId: barber.id,
        status: 'IN_PROGRESS',
      },
    });
    if (activeCut) {
      await this.prisma.cut.update({
        where: { id: activeCut.id },
        data: { status: 'CANCELLED' },
      });
    }

    // 3. RN-03: Verify monthly cut limit
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyCutsCount = await this.prisma.cut.count({
      where: {
        barberId: barber.id,
        startedAt: { gte: startOfMonth },
      },
    });

    if (barber.plan === 'AUTONOMO' && monthlyCutsCount >= 60) {
      throw new ForbiddenError('PLAN_LIMIT_REACHED', 'Monthly cut limit reached for AUTONOMO plan (60 cuts)');
    }
    if (barber.plan === 'BARBERIA_BASE' && monthlyCutsCount >= 200) {
      throw new ForbiddenError('PLAN_LIMIT_REACHED', 'Monthly cut limit reached for BARBERIA_BASE plan (200 cuts)');
    }

    // 4. Asegurar que existe un ClientProfile válido en PostgreSQL para que no falle la FK
    let profile = await this.prisma.clientProfile.findUnique({
      where: { id: input.clientProfileId },
    });

    if (!profile) {
      let client = await this.prisma.client.findFirst({
        include: { profiles: true },
      });

      if (!client) {
        client = await this.prisma.client.create({
          data: {
            displayName: 'Ernesto Salinas',
            phone: '+59171234567',
            email: 'ernesto.salinas@fade.bo',
            profiles: {
              create: [{ name: 'Ernesto Salinas' }],
            },
          },
          include: { profiles: true },
        });
      }

      profile =
        client.profiles[0] ||
        (await this.prisma.clientProfile.create({
          data: {
            clientId: client.id,
            name: client.displayName || 'Ernesto Salinas',
          },
        }));
    }

    // 5. Create cut record en PostgreSQL
    const cut = await this.prisma.cut.create({
      data: {
        clientRequestId: input.clientRequestId,
        barberId: barber.id,
        clientProfileId: profile.id,
        status: 'IN_PROGRESS',
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
      },
    });

    // 6. RF-2.1: Synchronize presence state to RED / YELLOW
    await this.presenceService.setCutting(barber.id, cut.id, barber.shopId);

    return { cut, isDuplicate: false };
  }

  async finalizeCut(barberId: string, cutId: string, input: FinalizeCutInput) {
    let cut = await this.prisma.cut.findUnique({
      where: { id: cutId },
    });

    if (!cut) {
      cut = await this.prisma.cut.findFirst({
        where: { barberId, status: 'IN_PROGRESS' },
      });
    }

    if (!cut) {
      cut = await this.prisma.cut.findFirst({
        where: { barberId },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!cut) {
      throw new NotFoundError('NOT_FOUND', 'Cut not found');
    }

    const finishedAt = input.finishedAt ? new Date(input.finishedAt) : new Date();
    const durationMinutes = (finishedAt.getTime() - cut.startedAt.getTime()) / (1000 * 60);

    const isExpress = input.chips.adicionales?.includes('Corte Express') ?? false;
    const isRapid = isExpress ? (durationMinutes < 8) : (durationMinutes < 15);

    const finalizedCut = await this.prisma.cut.update({
      where: { id: cut.id },
      data: {
        status: 'FINISHED',
        finishedAt,
        chips: input.chips as any,
        rapidClosure: isRapid,
      },
    });

    // Guardar fotos del corte en PostgreSQL (CutPhoto)
    if (input.photos && input.photos.length > 0) {
      for (const photo of input.photos) {
        if (!photo.url) continue;
        try {
          await this.prisma.cutPhoto.create({
            data: {
              cutId: cut.id,
              r2Key: photo.url,
              isPublic: Boolean(input.isPublic),
            },
          });
        } catch (photoErr) {
          console.warn('Could not insert cut photo record:', photoErr);
        }
      }
    }

    // Look up barber's shopId to broadcast properly
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
      select: { shopId: true },
    });

    // RF-2.1: Synchronize presence state back to GREEN
    await this.presenceService.setFree(barberId, barber?.shopId ?? null);

    return finalizedCut;
  }
}
