import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';

const ADMIN_KEY = 'test-admin-key-not-a-secret';

describe('Rewards: claims and admin review', () => {
  let app: FastifyInstance;
  let barberId: string;

  const barberToken = (id: string) => app.jwt.sign({ userId: id, barberId: id, role: 'barbero' });

  const qualifiedClients = async (n: number, extra: (i: number) => Record<string, unknown> = () => ({})) => {
    for (let i = 0; i < n; i++) {
      await app.prisma.client.create({
        data: {
          email: `k-${crypto.randomUUID()}@example.com`,
          firstScanBarberId: barberId,
          firstScanAt: new Date('2026-11-14T15:00:00Z'),
          qualifiedAt: new Date('2026-11-15T15:00:00Z'),
          acquisitionStatus: 'QUALIFIED',
          emailVerifiedAt: new Date('2026-11-14T16:00:00Z'),
          ...extra(i),
        },
      });
    }
  };

  const claim = () =>
    app.inject({
      method: 'POST',
      url: '/barbers/me/acquisitions/claim',
      headers: { authorization: `Bearer ${barberToken(barberId)}` },
    });

  const admin = (method: 'GET' | 'POST', url: string, opts: { key?: string | null; payload?: unknown } = {}) => {
    const key = opts.key === undefined ? ADMIN_KEY : opts.key;
    return app.inject({
      method,
      url: `/admin/rewards${url}`,
      headers: key ? { 'x-admin-key': key } : {},
      payload: opts.payload as any,
    });
  };

  const barberRow = () => app.prisma.barber.findUniqueOrThrow({ where: { id: barberId } });

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(app.prisma);
    process.env.REWARD_ACQUISITION_GOAL = '3';
    process.env.REWARD_MAX_FREE_MONTHS = '2';
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    barberId = (
      await app.prisma.barber.create({ data: { displayName: 'Claim Barber', email: `cb-${crypto.randomUUID()}@example.com` } })
    ).id;
  });

  afterEach(() => {
    delete process.env.REWARD_ACQUISITION_GOAL;
    delete process.env.REWARD_MAX_FREE_MONTHS;
    delete process.env.ADMIN_API_KEY;
  });

  describe('POST /barbers/me/acquisitions/claim', () => {
    it('returns 400 before the goal is reached', async () => {
      await qualifiedClients(2);
      const res = await claim();
      expect(res.statusCode).toBe(400);
      expect(await app.prisma.rewardClaim.count()).toBe(0);
    });

    it('creates a PENDING claim at the goal without crediting months', async () => {
      await qualifiedClients(3);
      const res = await claim();
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.claim).toMatchObject({ status: 'PENDING', goalKey: 'ACQ_3', qualifiedCountAtClaim: 3, type: 'ACQUISITION_BONUS' });
      expect((await barberRow()).freeMonthsEarned).toBe(0);
    });

    it('returns 409 with the existing claim on a second attempt', async () => {
      await qualifiedClients(3);
      const first = JSON.parse((await claim()).body);
      const res = await claim();
      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).claim.id).toBe(first.claim.id);
    });

    it('creates exactly one row under concurrent double-claim', async () => {
      await qualifiedClients(3);
      const results = await Promise.all([claim(), claim(), claim()]);
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
      expect(results.filter((r) => r.statusCode === 409)).toHaveLength(2);
      expect(await app.prisma.rewardClaim.count()).toBe(1);
    });

    it('refuses when the lifetime free-months cap is reached', async () => {
      await qualifiedClients(3);
      await app.prisma.barber.update({ where: { id: barberId }, data: { freeMonthsEarned: 2 } });
      const res = await claim();
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toBe('FREE_MONTHS_CAP_REACHED');
      expect(await app.prisma.rewardClaim.count()).toBe(0);
    });
  });

  describe('admin API access', () => {
    it('answers 404 when ADMIN_API_KEY is unset (fail closed)', async () => {
      delete process.env.ADMIN_API_KEY;
      expect((await admin('GET', '/claims', { key: ADMIN_KEY })).statusCode).toBe(404);
      expect((await admin('POST', '/claims/x/approve', { key: ADMIN_KEY })).statusCode).toBe(404);
    });

    it('answers 401 without a key and 403 with a wrong key', async () => {
      expect((await admin('GET', '/claims', { key: null })).statusCode).toBe(401);
      expect((await admin('GET', '/claims', { key: 'wrong-key' })).statusCode).toBe(403);
      expect((await admin('POST', '/claims/x/approve', { key: 'wrong-key' })).statusCode).toBe(403);
    });

    it('is also served under the /api prefix', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/admin/rewards/claims' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('admin review', () => {
    const createPendingClaim = async () => {
      await qualifiedClients(3);
      return JSON.parse((await claim()).body).claim.id as string;
    };

    it('lists claims with a review summary grouped by IP and device', async () => {
      await qualifiedClients(3, (i) => ({
        signupIp: i < 2 ? '10.0.0.1' : '10.0.0.2',
        signupDeviceId: 'dev-shared',
        email: i === 0 ? 'x@mailinator.com' : `k-${crypto.randomUUID()}@example.com`,
      }));
      expect((await claim()).statusCode).toBe(201);

      const res = await admin('GET', '/claims?status=PENDING');
      expect(res.statusCode).toBe(200);
      const [item] = JSON.parse(res.body).claims;
      expect(item.barber.email).toContain('cb-');
      expect(item.qualifiedCountAtClaim).toBe(3);
      expect(item.review.byIp[0]).toEqual({ value: '10.0.0.1', count: 2 });
      expect(item.review.byDevice[0]).toEqual({ value: 'dev-shared', count: 3 });
      expect(item.review.collidingIps).toBe(1);
      expect(item.review.collidingDevices).toBe(1);
      expect(item.review.disposableEmailCount).toBe(1);
      expect(item.review.avgHoursToQualify).toBe(24);
    });

    it('filters by status and rejects invalid status', async () => {
      await createPendingClaim();
      expect(JSON.parse((await admin('GET', '/claims?status=APPROVED')).body).claims).toHaveLength(0);
      expect((await admin('GET', '/claims?status=NOPE')).statusCode).toBe(400);
    });

    it('approve credits exactly once, even called twice concurrently', async () => {
      const id = await createPendingClaim();
      const results = await Promise.all([admin('POST', `/claims/${id}/approve`), admin('POST', `/claims/${id}/approve`)]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      expect((await barberRow()).freeMonthsEarned).toBe(1);
      const row = await app.prisma.rewardClaim.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe('APPROVED');
      expect(row.reviewedBy).toBe('admin');
      expect(row.reviewedAt).toBeInstanceOf(Date);

      expect((await admin('POST', `/claims/${id}/approve`)).statusCode).toBe(409);
      expect((await barberRow()).freeMonthsEarned).toBe(1);
    });

    it('approve rolls back when the barber is at the cap', async () => {
      const id = await createPendingClaim();
      await app.prisma.barber.update({ where: { id: barberId }, data: { freeMonthsEarned: 2 } });
      const res = await admin('POST', `/claims/${id}/approve`);
      expect(res.statusCode).toBe(409);
      expect((await app.prisma.rewardClaim.findUniqueOrThrow({ where: { id } })).status).toBe('PENDING');
      expect((await barberRow()).freeMonthsEarned).toBe(2);
    });

    it('reject requires a note and does not credit', async () => {
      const id = await createPendingClaim();
      expect((await admin('POST', `/claims/${id}/reject`, { payload: {} })).statusCode).toBe(400);
      const res = await admin('POST', `/claims/${id}/reject`, { payload: { note: 'Suspicious devices' } });
      expect(res.statusCode).toBe(200);
      const row = await app.prisma.rewardClaim.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: 'REJECTED', note: 'Suspicious devices' });
      expect((await barberRow()).freeMonthsEarned).toBe(0);
      expect((await admin('POST', `/claims/${id}/approve`)).statusCode).toBe(409);
    });

    it('reverse decrements once and optionally revokes qualified clients', async () => {
      const id = await createPendingClaim();
      await admin('POST', `/claims/${id}/approve`);
      expect((await barberRow()).freeMonthsEarned).toBe(1);

      const res = await admin('POST', `/claims/${id}/reverse`, { payload: { revokeClients: true } });
      expect(res.statusCode).toBe(200);
      expect((await barberRow()).freeMonthsEarned).toBe(0);
      expect(await app.prisma.client.count({ where: { acquisitionStatus: 'REVOKED' } })).toBe(3);
      expect((await app.prisma.rewardClaim.findUniqueOrThrow({ where: { id } })).status).toBe('REVERSED');

      expect((await admin('POST', `/claims/${id}/reverse`, { payload: {} })).statusCode).toBe(409);
      expect((await barberRow()).freeMonthsEarned).toBe(0);
    });

    it('reverse keeps clients qualified by default and never goes below zero', async () => {
      const id = await createPendingClaim();
      await admin('POST', `/claims/${id}/approve`);
      await app.prisma.barber.update({ where: { id: barberId }, data: { freeMonthsEarned: 0 } });
      expect((await admin('POST', `/claims/${id}/reverse`)).statusCode).toBe(200);
      expect((await barberRow()).freeMonthsEarned).toBe(0);
      expect(await app.prisma.client.count({ where: { acquisitionStatus: 'QUALIFIED' } })).toBe(3);
    });

    it('reverse of a PENDING claim is a conflict', async () => {
      const id = await createPendingClaim();
      expect((await admin('POST', `/claims/${id}/reverse`)).statusCode).toBe(409);
    });
  });
});
