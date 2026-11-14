import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';
import { AuthService } from '../src/modules/auth/auth.service';

describe('Barber subscription La Paz month boundaries', () => {
  let app: FastifyInstance;
  let barberId: string;
  let clientProfileId: string;

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barber } = await seed();
    barberId = barber.id;
    const profile = await app.prisma.clientProfile.findFirstOrThrow({});
    clientProfileId = profile.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('counts cuts from 00:00 La Paz on day 1 and reports the La Paz month end', async () => {
    // 2026-11-01T03:00Z is 2026-10-31 23:00 La Paz: belongs to October, not November.
    await app.prisma.cut.create({
      data: { clientRequestId: 'tz-oct-31', barberId, clientProfileId, startedAt: new Date('2026-11-01T03:00:00Z') },
    });
    // 2026-11-01T04:00Z is exactly 00:00 La Paz on Nov 1: counts.
    await app.prisma.cut.create({
      data: { clientRequestId: 'tz-nov-1', barberId, clientProfileId, startedAt: new Date('2026-11-01T04:00:00Z') },
    });

    const service = new AuthService(app.prisma);
    // 2026-12-01T03:30Z is still November 30 in La Paz.
    const sub = await service.getBarberSubscription(barberId, new Date('2026-12-01T03:30:00Z'));
    expect(sub?.monthlyCutsCount).toBe(1);
    expect(sub?.nextBillingDate).toBe('2026-11-30T04:00:00.000Z');
  });
});
