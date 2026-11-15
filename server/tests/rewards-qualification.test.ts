import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { toLaPazDateString } from '../src/utils/la-paz-date';
import { cleanDatabase } from './helpers';
import { ActivityService } from '../src/modules/rewards/activity.service';
import { QualificationService } from '../src/modules/rewards/qualification.service';

// Signup: 2026-11-14 15:00Z == 11:00 La Paz on the 14th.
const SIGNUP = new Date('2026-11-14T15:00:00Z');
const SAME_DAY_LATE = new Date('2026-11-15T03:30:00Z'); // 23:30 La Paz on the 14th
const NEXT_DAY_EARLY = new Date('2026-11-15T04:05:00Z'); // 00:05 La Paz on the 15th
const NEXT_DAY = new Date('2026-11-15T16:00:00Z');

describe('Rewards: activity log and qualification', () => {
  let app: FastifyInstance;
  let barberId: string;
  let serviceId: string;
  let activity: ActivityService;
  let qualification: QualificationService;

  const makeClient = (
    overrides: Partial<{
      acquisitionStatus: 'PENDING' | 'QUALIFIED' | 'REVOKED' | null;
      emailVerifiedAt: Date | null;
      captured: boolean;
    }> = {}
  ) => {
    const { captured = true, acquisitionStatus = 'PENDING', emailVerifiedAt = new Date('2026-11-14T16:00:00Z') } = overrides;
    return app.prisma.client.create({
      data: {
        email: `q-${crypto.randomUUID()}@example.com`,
        firstScanBarberId: captured ? barberId : null,
        firstScanAt: captured ? SIGNUP : null,
        acquisitionStatus: captured ? acquisitionStatus : null,
        emailVerifiedAt,
      },
    });
  };

  const addActivity = (clientId: string, createdAt: Date) =>
    app.prisma.clientActivity.create({ data: { clientId, type: 'HISTORY_VIEW', createdAt } });

  const status = async (id: string) =>
    (await app.prisma.client.findUnique({ where: { id } }))!;

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const barber = await app.prisma.barber.create({
      data: { displayName: 'Rewards Barber', email: `rb-${crypto.randomUUID()}@example.com` },
    });
    barberId = barber.id;
    serviceId = (
      await app.prisma.barberService.create({
        data: { barberId, name: 'Corte', priceBs: 50, durationMin: 30 },
      })
    ).id;
    activity = new ActivityService(app.prisma);
    qualification = new QualificationService(app.prisma);
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  beforeEach(async () => {
    await app.prisma.cutPhoto.deleteMany({});
    await app.prisma.cut.deleteMany({});
    await app.prisma.clientProfile.deleteMany({});
    await app.prisma.client.deleteMany({});
  });

  describe('ActivityService.record', () => {
    it('dedupes by type per La Paz day', async () => {
      const client = await makeClient();
      expect(await activity.record(client.id, 'HISTORY_VIEW', new Date('2026-11-14T15:00:00Z'))).toBe(true);
      // 23:30 La Paz is still the same La Paz day even though it is past 00:00 UTC.
      expect(await activity.record(client.id, 'HISTORY_VIEW', new Date('2026-11-15T03:30:00Z'))).toBe(false);
      // A different type on the same day is a separate row.
      expect(await activity.record(client.id, 'CONSENT_UPDATE', new Date('2026-11-14T15:00:00Z'))).toBe(true);
      // 00:05 La Paz on the 15th is a new day.
      expect(await activity.record(client.id, 'HISTORY_VIEW', new Date('2026-11-15T04:05:00Z'))).toBe(true);

      const rows = await app.prisma.clientActivity.count({ where: { clientId: client.id } });
      expect(rows).toBe(3);
    });
  });

  describe('QualificationService.evaluate', () => {
    it('does not qualify with same-day activity only', async () => {
      const client = await makeClient();
      await addActivity(client.id, new Date('2026-11-14T18:00:00Z'));
      expect(await qualification.evaluate(client.id, NEXT_DAY)).toBe(false);
      expect((await status(client.id)).acquisitionStatus).toBe('PENDING');
    });

    it('does not qualify at 23:30 La Paz even though it is already the next day in UTC', async () => {
      const client = await makeClient();
      await addActivity(client.id, SAME_DAY_LATE);
      expect(await qualification.evaluate(client.id, NEXT_DAY)).toBe(false);
    });

    it('qualifies with activity on the next La Paz day and a verified email', async () => {
      const client = await makeClient();
      await addActivity(client.id, NEXT_DAY_EARLY);
      expect(await qualification.evaluate(client.id, NEXT_DAY)).toBe(true);

      const updated = await status(client.id);
      expect(updated.acquisitionStatus).toBe('QUALIFIED');
      expect(updated.qualifiedAt?.toISOString()).toBe(NEXT_DAY.toISOString());
    });

    it('does not qualify an unverified email', async () => {
      const client = await makeClient({ emailVerifiedAt: null });
      await addActivity(client.id, NEXT_DAY);
      expect(await qualification.evaluate(client.id, NEXT_DAY)).toBe(false);
      expect((await status(client.id)).acquisitionStatus).toBe('PENDING');
    });

    it('never qualifies REVOKED, non-captured or legacy (null status) clients', async () => {
      const revoked = await makeClient({ acquisitionStatus: 'REVOKED' });
      const notCaptured = await makeClient({ captured: false });
      const legacy = await makeClient({ acquisitionStatus: null });
      for (const c of [revoked, notCaptured, legacy]) {
        await addActivity(c.id, NEXT_DAY);
        expect(await qualification.evaluate(c.id, NEXT_DAY)).toBe(false);
      }
      expect((await status(revoked.id)).acquisitionStatus).toBe('REVOKED');
      expect((await status(legacy.id)).acquisitionStatus).toBeNull();
      expect((await status(notCaptured.id)).acquisitionStatus).toBeNull();
    });

    it('is idempotent and does not overwrite qualifiedAt', async () => {
      const client = await makeClient();
      await addActivity(client.id, NEXT_DAY);
      expect(await qualification.evaluate(client.id, NEXT_DAY)).toBe(true);
      const first = (await status(client.id)).qualifiedAt;

      expect(await qualification.evaluate(client.id, new Date('2026-11-20T10:00:00Z'))).toBe(false);
      expect((await status(client.id)).qualifiedAt?.toISOString()).toBe(first?.toISOString());
    });

    it('does not qualify unknown clients', async () => {
      expect(await qualification.evaluate(crypto.randomUUID())).toBe(false);
    });
  });

  describe('evaluateAllPendingForBarber', () => {
    it('qualifies only eligible pending clients of that barber', async () => {
      const eligible = await makeClient();
      const sameDay = await makeClient();
      const unverified = await makeClient({ emailVerifiedAt: null });
      await addActivity(eligible.id, NEXT_DAY);
      await addActivity(sameDay.id, new Date('2026-11-14T18:00:00Z'));
      await addActivity(unverified.id, NEXT_DAY);

      expect(await qualification.evaluateAllPendingForBarber(barberId, NEXT_DAY)).toBe(1);
      expect((await status(eligible.id)).acquisitionStatus).toBe('QUALIFIED');
      expect((await status(sameDay.id)).acquisitionStatus).toBe('PENDING');
      expect((await status(unverified.id)).acquisitionStatus).toBe('PENDING');
    });
  });

  describe('route hooks', () => {
    const clientToken = (id: string) => app.jwt.sign({ userId: id, role: 'cliente' });

    it('records HISTORY_VIEW for an authenticated client on GET /clients/me', async () => {
      const client = await makeClient();
      const res = await app.inject({
        method: 'GET',
        url: `/clients/me?email=${encodeURIComponent(client.email!)}`,
        headers: { authorization: `Bearer ${clientToken(client.id)}` },
      });
      expect(res.statusCode).toBe(200);
      const rows = await app.prisma.clientActivity.findMany({ where: { clientId: client.id } });
      expect(rows.map((r) => r.type)).toEqual(['HISTORY_VIEW']);
    });

    it('records nothing for anonymous requests or barber tokens', async () => {
      const client = await makeClient();
      const barberToken = app.jwt.sign({ userId: barberId, barberId, role: 'barbero' });

      const anon = await app.inject({ method: 'GET', url: `/clients/me?email=${encodeURIComponent(client.email!)}` });
      expect(anon.statusCode).toBe(401);
      await app.inject({
        method: 'GET',
        url: `/clients/me?email=${encodeURIComponent(client.email!)}`,
        headers: { authorization: `Bearer ${barberToken}` },
      });
      // A barber token whose id happens to equal a client id must still be ignored.
      const crossToken = app.jwt.sign({ userId: client.id, role: 'barbero' });
      await app.inject({
        method: 'GET',
        url: `/clients/me?email=${encodeURIComponent(client.email!)}`,
        headers: { authorization: `Bearer ${crossToken}` },
      });

      expect(await app.prisma.clientActivity.count()).toBe(0);
    });

    describe('booking endpoint (client account required)', () => {
      // Real clock (the route is not clock-injectable): book 3 La Paz days ahead, never a Sunday
      // (default working hours are Mon-Sat 09:00-20:00, 30 min slots, break 13:00-14:00).
      const futureDate = () => {
        let date = toLaPazDateString(new Date(Date.now() + 3 * 86_400_000));
        if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) {
          date = toLaPazDateString(new Date(Date.now() + 4 * 86_400_000));
        }
        return date;
      };
      let slot = 0;
      const bookingPayload = () => ({
        serviceIds: [serviceId],
        date: futureDate(),
        // Distinct 30 min slots between 09:00 and 11:30 so calls never collide.
        time: `${String(9 + Math.floor(slot / 2)).padStart(2, '0')}:${slot++ % 2 === 0 ? '00' : '30'}`,
      });
      const book = (headers: Record<string, string> = {}) =>
        app.inject({ method: 'POST', url: `/barbers/${barberId}/bookings`, headers, payload: bookingPayload() });

      beforeEach(async () => {
        slot = 0;
        await app.prisma.booking.deleteMany({});
      });

      // Booking identity comes from the profile, so the client needs a name and phone.
      let phoneSeq = 0;
      const makeBookingClient = async () => {
        const client = await makeClient();
        return app.prisma.client.update({
          where: { id: client.id },
          data: { displayName: 'Booker', phone: `7100${String(1000 + phoneSeq++)}` },
        });
      };

      it('records BOOKING_CREATED for a client token', async () => {
        const client = await makeBookingClient();
        const res = await book({ authorization: `Bearer ${clientToken(client.id)}` });
        expect(res.statusCode).toBe(201);
        const rows = await app.prisma.clientActivity.findMany({ where: { clientId: client.id } });
        expect(rows.map((r) => r.type)).toEqual(['BOOKING_CREATED']);
      });

      it('rejects anonymous, invalid and barber tokens and records nothing', async () => {
        const barberToken = app.jwt.sign({ userId: barberId, barberId, role: 'barbero' });

        expect((await book()).statusCode).toBe(401);
        expect((await book({ authorization: 'Bearer not-a-real-token' })).statusCode).toBe(401);
        expect((await book({ authorization: `Bearer ${barberToken}` })).statusCode).toBe(403);

        expect(await app.prisma.booking.count()).toBe(0);
        expect(await app.prisma.clientActivity.count()).toBe(0);
      });

      it('a tracking failure never breaks the booking', async () => {
        const client = await makeBookingClient();
        const spy = vi.spyOn(ActivityService.prototype, 'record').mockRejectedValue(new Error('boom'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
          const res = await book({ authorization: `Bearer ${clientToken(client.id)}` });
          expect(res.statusCode).toBe(201);
          expect(spy).toHaveBeenCalled();
        } finally {
          spy.mockRestore();
          warn.mockRestore();
        }
      });
    });

    it('records CONSENT_UPDATE only for photos owned by the authenticated client', async () => {
      const owner = await makeClient();
      const stranger = await makeClient();
      const profile = await app.prisma.clientProfile.create({ data: { clientId: owner.id, name: 'Owner' } });
      const cut = await app.prisma.cut.create({
        data: {
          clientRequestId: crypto.randomUUID(),
          barberId,
          clientProfileId: profile.id,
          status: 'FINISHED',
        },
      });
      const photo = await app.prisma.cutPhoto.create({ data: { cutId: cut.id, r2Key: 'k/photo.jpg' } });

      await app.inject({
        method: 'PATCH',
        url: `/photos/${photo.id}/consent`,
        headers: { authorization: `Bearer ${clientToken(stranger.id)}` },
        payload: { isPublic: true },
      });
      expect(await app.prisma.clientActivity.count({ where: { clientId: stranger.id } })).toBe(0);

      const res = await app.inject({
        method: 'PATCH',
        url: `/photos/${photo.id}/consent`,
        headers: { authorization: `Bearer ${clientToken(owner.id)}` },
        payload: { isPublic: true },
      });
      expect(res.statusCode).toBe(200);
      const rows = await app.prisma.clientActivity.findMany({ where: { clientId: owner.id } });
      expect(rows.map((r) => r.type)).toEqual(['CONSENT_UPDATE']);
    });

    it('a failure while tracking never breaks the main request', async () => {
      // /clients/me requires an existing client, so force the activity insert to fail instead.
      const client = await makeClient();
      const spy = vi.spyOn(ActivityService.prototype, 'record').mockRejectedValue(new Error('boom'));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const res = await app.inject({
          method: 'GET',
          url: '/clients/me',
          headers: { authorization: `Bearer ${clientToken(client.id)}` },
        });
        expect(res.statusCode).toBe(200);
        expect(spy).toHaveBeenCalled();
      } finally {
        spy.mockRestore();
        warn.mockRestore();
      }
    });
  });
});
