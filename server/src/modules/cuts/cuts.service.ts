import { PrismaClient } from '@prisma/client';
import { StartCutInput, FinalizeCutInput } from './cuts.schemas';
import { AppError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { AuthenticatedBarber } from '../../types';
import { PresenceService } from '../presence/presence.service';
import { getMonthlyCutUsage, getPlanCutLimit } from './cut-quota';
import { laPazMonthStartUtc } from '../../utils/la-paz-date';
import { ClientsService } from '../clients/clients.service';
import { normalizePhone } from '../bookings/bookings.schemas';

type ResolvedClient =
  | { kind: 'profile'; profileId: string }
  | { kind: 'client'; clientId: string }
  | { kind: 'new-by-phone'; phone: string; name: string | null };

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

    // 1b. Identify the client before any side effect. A cut always belongs to a real,
    // identifiable client; nothing is invented when the request does not identify one.
    const resolved = await this.identifyClient(input);

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
    // Counted AFTER the auto-cancel above, so restarts also consume the cancellation allowance.
    // Note: check-then-create is not atomic; concurrent startCut calls can overshoot slightly.
    const planLimit = getPlanCutLimit(barber.plan);
    if (planLimit !== null) {
      const { usage } = await getMonthlyCutUsage(this.prisma, barber.id, barber.plan);
      if (usage >= planLimit) {
        throw new ForbiddenError(
          'PLAN_LIMIT_REACHED',
          `Monthly cut limit reached for ${barber.plan} plan (${planLimit} cuts)`
        );
      }
    }

    // 4. Resolve the ClientProfile the cut is attached to (creating a phone-identified
    // client only now, after the quota check, so a rejected start leaves no stray rows).
    const profileId = await this.materializeProfile(resolved);

    // 5. Create cut record en PostgreSQL
    // startedAt is client-supplied (offline sync). Clamp it to the current La Paz month so a
    // backdated value cannot move the cut out of the month it is counted against.
    const monthStart = laPazMonthStartUtc();
    const requestedStart = input.startedAt ? new Date(input.startedAt) : new Date();
    const startedAt = requestedStart < monthStart ? monthStart : requestedStart;
    const cut = await this.prisma.cut.create({
      data: {
        clientRequestId: input.clientRequestId,
        barberId: barber.id,
        clientProfileId: profileId,
        status: 'IN_PROGRESS',
        startedAt,
      },
    });

    // 6. RF-2.1: Synchronize presence state to RED / YELLOW
    await this.presenceService.setCutting(barber.id, cut.id, barber.shopId);

    return { cut, isDuplicate: false };
  }

  /**
   * Decides which real client a cut is for, without writing anything.
   * Accepts, in order: an existing clientProfileId, an existing clientId, or a valid phone
   * (matched exactly on its normalized forms; never by name). Anything else is rejected.
   */
  private async identifyClient(input: StartCutInput): Promise<ResolvedClient> {
    if (input.clientProfileId) {
      const profile = await this.prisma.clientProfile.findUnique({
        where: { id: input.clientProfileId },
        select: { id: true },
      });
      if (!profile) {
        throw new NotFoundError('CLIENT_PROFILE_NOT_FOUND', 'Client profile not found');
      }
      return { kind: 'profile', profileId: profile.id };
    }

    if (input.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: input.clientId },
        select: { id: true },
      });
      if (!client) {
        throw new NotFoundError('CLIENT_NOT_FOUND', 'Client not found');
      }
      return { kind: 'client', clientId: client.id };
    }

    if (!input.clientPhone) {
      throw new AppError(
        'CLIENT_REQUIRED',
        'A client profile, client id or phone number is required to start a cut',
        400
      );
    }
    const phone = normalizePhone(input.clientPhone);
    if (!phone) {
      throw new AppError('INVALID_PHONE', 'The client phone number is not valid', 400);
    }
    const existing = await new ClientsService(this.prisma).findClientByPhone(phone);
    if (existing) return { kind: 'client', clientId: existing.id };
    return { kind: 'new-by-phone', phone, name: input.clientName?.trim() || null };
  }

  private async materializeProfile(resolved: ResolvedClient): Promise<string> {
    if (resolved.kind === 'profile') return resolved.profileId;

    let clientId: string;
    let displayName: string | null;
    if (resolved.kind === 'client') {
      clientId = resolved.clientId;
      const existing = await this.prisma.client.findUniqueOrThrow({
        where: { id: clientId },
        select: { displayName: true, profiles: { orderBy: { createdAt: 'asc' }, take: 1 } },
      });
      if (existing.profiles[0]) return existing.profiles[0].id;
      displayName = existing.displayName;
    } else {
      // Walk-in with a real phone: only what the barber provided. No email, no invented name.
      const created = await this.prisma.client.create({
        data: { phone: resolved.phone, displayName: resolved.name },
        select: { id: true },
      });
      clientId = created.id;
      displayName = resolved.name;
    }

    const profile = await this.prisma.clientProfile.create({
      data: { clientId, name: displayName || 'Perfil Principal' },
      select: { id: true },
    });
    return profile.id;
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
