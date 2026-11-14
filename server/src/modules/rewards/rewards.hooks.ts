import { FastifyRequest } from 'fastify';
import { ClientActivityType, PrismaClient } from '@prisma/client';
import { ActivityService } from './activity.service';
import { QualificationService } from './qualification.service';

/**
 * Resolves the authenticated CLIENT id of a request, or null. Identity comes from
 * `request.authUser` (set by `fastify.authenticateUser`); barber-role users and
 * anonymous requests yield null (barbers never generate client activity).
 *
 * @param opts.optionalJwt ONLY for public endpoints that have no authenticate
 *   preHandler but accept an optional client token (currently
 *   POST /barbers/:barberId/bookings). The token is verified best-effort; a
 *   missing, invalid or barber-role token yields null instead of failing.
 */
export async function resolveClientId(
  request: FastifyRequest,
  opts: { optionalJwt?: boolean } = {}
): Promise<string | null> {
  if (request.authUser) {
    return request.authUser.role === 'cliente' ? request.authUser.id : null;
  }
  if (!opts.optionalJwt) return null;
  try {
    const decoded = await request.jwtVerify<{ userId?: string; role?: string }>();
    return decoded.role === 'cliente' && decoded.userId ? decoded.userId : null;
  } catch {
    return null;
  }
}

/** Evaluates qualification for a client, never throwing. */
export async function evaluateQualificationSafely(prisma: PrismaClient, clientId: string): Promise<void> {
  try {
    await new QualificationService(prisma).evaluate(clientId);
  } catch (err) {
    console.warn('[rewards] qualification evaluation failed:', err instanceof Error ? err.message : 'unknown error');
  }
}

/**
 * Records a client activity for the request's authenticated client and re-evaluates
 * qualification. Failures are caught and logged (no secrets) so they can never
 * break the main request.
 *
 * @param opts.ownedPhotoId when set, the activity is only recorded if that photo
 *   belongs to the authenticated client (prevents unrelated accounts from
 *   generating qualifying activity on photos that are not theirs).
 * @param opts.optionalJwt see {@link resolveClientId}; only for public endpoints.
 */
export async function trackClientActivity(
  prisma: PrismaClient,
  request: FastifyRequest,
  type: ClientActivityType,
  opts: { ownedPhotoId?: string; optionalJwt?: boolean } = {}
): Promise<void> {
  try {
    const clientId = await resolveClientId(request, { optionalJwt: opts.optionalJwt });
    if (!clientId) return;

    if (opts.ownedPhotoId) {
      const photo = await prisma.cutPhoto.findUnique({
        where: { id: opts.ownedPhotoId },
        select: { cut: { select: { clientProfile: { select: { clientId: true } } } } },
      });
      if (photo?.cut.clientProfile.clientId !== clientId) return;
    }

    await new ActivityService(prisma).record(clientId, type);
    await new QualificationService(prisma).evaluate(clientId);
  } catch (err) {
    console.warn('[rewards] activity tracking failed:', err instanceof Error ? err.message : 'unknown error');
  }
}
