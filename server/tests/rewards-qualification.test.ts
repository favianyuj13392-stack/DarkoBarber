import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
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

      await app.inject({ method: 'GET', url: `/clients/me?email=${encodeURIComponent(client.email!)}` });
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
      // Token for a client id that does not exist: the FK insert fails and is swallowed.
      const ghostToken = clientToken(crypto.randomUUID());
      const res = await app.inject({
        method: 'GET',
        url: '/clients/me?email=nobody@example.com',
        headers: { authorization: `Bearer ${ghostToken}` },
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
