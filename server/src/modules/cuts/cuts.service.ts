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

    // 2. RN-06: Check single active cut per barber
    const activeCut = await this.prisma.cut.findFirst({
      where: {
        barberId: barber.id,
        status: 'IN_PROGRESS',
      },
    });
    if (activeCut) {
      throw new ConflictError('ACTIVE_CUT_EXISTS', 'Active cut already in progress for this barber');
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

    // 4. Create cut record
    const cut = await this.prisma.cut.create({
      data: {
        clientRequestId: input.clientRequestId,
        barberId: barber.id,
        clientProfileId: input.clientProfileId,
        status: 'IN_PROGRESS',
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
      },
    });

    // 5. RF-2.1: Synchronize presence state to RED / YELLOW
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
      throw new NotFoundError('NOT_FOUND', 'Cut not found');
    }

    if (cut.barberId !== barberId) {
      throw new ForbiddenError('FORBIDDEN', 'Cannot finalize cut belonging to another barber');
    }

    const finishedAt = input.finishedAt ? new Date(input.finishedAt) : new Date();
    const durationMinutes = (finishedAt.getTime() - cut.startedAt.getTime()) / (1000 * 60);

    const isExpress = input.chips.adicionales?.includes('Corte Express') ?? false;
    const isRapid = isExpress ? (durationMinutes < 8) : (durationMinutes < 15);

    const finalizedCut = await this.prisma.cut.update({
      where: { id: cutId },
      data: {
        status: 'FINISHED',
        finishedAt,
        chips: input.chips as any,
        rapidClosure: isRapid,
      },
    });

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
