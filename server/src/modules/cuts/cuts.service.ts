import { PrismaClient } from '@prisma/client';
import { StartCutInput, FinalizeCutInput } from './cuts.schemas';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { AuthenticatedBarber } from '../../types';
import { PresenceService } from '../presence/presence.service';
import { getMonthlyCutUsage, getPlanCutLimit } from './cut-quota';

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
    // The month resets at 00:00 La Paz on day 1, regardless of the server timezone.
    const planLimit = getPlanCutLimit(barber.plan);
    if (planLimit !== null) {
      const { usage } = await getMonthlyCutUsage(this.prisma, barber.id);
      if (usage >= planLimit) {
        throw new ForbiddenError(
          'PLAN_LIMIT_REACHED',
          `Monthly cut limit reached for ${barber.plan} plan (${planLimit} cuts)`
        );
      }
    }

    // 4. Asegurar que existe un ClientProfile válido en PostgreSQL asociado al cliente correcto
    let profile = input.clientProfileId && input.clientProfileId !== 'client-active'
      ? await this.prisma.clientProfile.findUnique({
          where: { id: input.clientProfileId },
        })
      : null;

    if (!profile) {
      const cleanPhone = (input.clientPhone || '').replace(/\D/g, '');
      let client = cleanPhone
        ? await this.prisma.client.findFirst({
            where: {
              OR: [
                { phone: input.clientPhone },
                { phone: cleanPhone },
                { phone: `+591${cleanPhone.slice(-8)}` },
                { phone: cleanPhone.slice(-8) },
              ],
            },
            include: { profiles: true },
          })
        : null;

      if (!client && input.clientName) {
        client = await this.prisma.client.findFirst({
          where: {
            displayName: { contains: input.clientName, mode: 'insensitive' },
          },
          include: { profiles: true },
        });
      }

      if (!client) {
        client = await this.prisma.client.create({
          data: {
            displayName: input.clientName || 'Ernesto Salinas',
            phone: input.clientPhone || '+591 712 34567',
            email: `cliente-${cleanPhone || Date.now()}@fade.bo`,
            profiles: {
              create: [{ name: input.clientName || 'Ernesto Salinas' }],
            },
          },
          include: { profiles: true },
        });
      } else if (!client.phone && input.clientPhone) {
        await this.prisma.client.update({
          where: { id: client.id },
          data: { phone: input.clientPhone },
        });
      }

      profile =
        client.profiles[0] ||
        (await this.prisma.clientProfile.create({
          data: {
            clientId: client.id,
            name: client.displayName || 'Perfil Principal',
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
    // Ownership is enforced in the query: other barbers' cuts are indistinguishable from missing ones.
    const existing = await this.prisma.cut.findFirst({
      where: { id: cutId, barberId },
    });

    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Cut not found');
    }

    // Idempotent retry: an already finished cut owned by this barber returns the stored result.
    if (existing.status === 'FINISHED') {
      return existing;
    }

    if (existing.status !== 'IN_PROGRESS') {
      throw new NotFoundError('NOT_FOUND', 'Cut not found');
    }

    const cut = existing;

    const finishedAt = input.finishedAt ? new Date(input.finishedAt) : new Date();
    const durationMinutes = (finishedAt.getTime() - cut.startedAt.getTime()) / (1000 * 60);

    const isExpress = input.chips.adicionales?.includes('Corte Express') ?? false;
    const isRapid = isExpress ? (durationMinutes < 8) : (durationMinutes < 15);

    // Conditional update guards against a concurrent finalize/cancel between read and write.
    const updated = await this.prisma.cut.updateMany({
      where: { id: cut.id, barberId, status: 'IN_PROGRESS' },
      data: {
        status: 'FINISHED',
        finishedAt,
        chips: input.chips as any,
        rapidClosure: isRapid,
      },
    });
    if (updated.count === 0) {
      throw new NotFoundError('NOT_FOUND', 'Cut not found');
    }
    const finalizedCut = await this.prisma.cut.findUniqueOrThrow({ where: { id: cut.id } });

    // Guardar fotos del corte en PostgreSQL (CutPhoto)
    if (input.photos && input.photos.length > 0) {
      for (const photo of input.photos) {
        if (!photo.url) continue;
        try {
          await this.prisma.cutPhoto.create({
            data: {
              cutId: cut.id,
              r2Key: photo.url,
              // Always private on finalize; public only via the client's consent flow.
              isPublic: false,
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
