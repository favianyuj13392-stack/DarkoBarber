import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';

const SIGNUP = new Date('2026-11-14T15:00:00Z');
const NEXT_DAY = new Date('2026-11-15T16:00:00Z');

describe('Rewards: acquisition progress', () => {
  let app: FastifyInstance;
  let barberId: string;
  let otherBarberId: string;

  const barberToken = (id: string) => app.jwt.sign({ userId: id, barberId: id, role: 'barbero' });

  const makeClient = (
    owner: string | null,
    status: 'PENDING' | 'QUALIFIED' | 'REVOKED' | null,
    emailVerifiedAt: Date | null = new Date('2026-11-14T16:00:00Z')
  ) =>
    app.prisma.client.create({
      data: {
        email: `p-${crypto.randomUUID()}@example.com`,
        firstScanBarberId: owner,
        firstScanAt: owner ? SIGNUP : null,
        acquisitionStatus: status,
        emailVerifiedAt,
      },
    });

  const progress = async (id = barberId) => {
    const res = await app.inject({
      method: 'GET',
      url: '/barbers/me/acquisitions',
      headers: { authorization: `Bearer ${barberToken(id)}` },
    });
    expect(res.statusCode).toBe(200);
    return JSON.parse(res.body);
  };

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
    barberId = (
      await app.prisma.barber.create({ data: { displayName: 'P Barber', email: `pb-${crypto.randomUUID()}@example.com` } })
    ).id;
    otherBarberId = (
      await app.prisma.barber.create({ data: { displayName: 'Other', email: `po-${crypto.randomUUID()}@example.com` } })
    ).id;
  });

  afterEach(() => {
    delete process.env.REWARD_ACQUISITION_GOAL;
  });

  it('reports zero with no fake floor when there are no clients', async () => {
    const body = await progress();
    expect(body).toMatchObject({
      goal: 3,
      goalKey: 'ACQ_3',
      qualified: 0,
      pending: 0,
      remaining: 3,
      percentage: 0,
      goalReached: false,
      claim: null,
      freeMonthsEarned: 0,
      acquiredCount: 0,
      rewardUnlocked: false,
    });
    expect(body.maxFreeMonths).toBeGreaterThan(0);
  });

  it('counts only QUALIFIED toward the goal and shows PENDING separately', async () => {
    await makeClient(barberId, 'QUALIFIED');
    await makeClient(barberId, 'QUALIFIED');
    await makeClient(barberId, 'PENDING', null);
    await makeClient(barberId, 'REVOKED');
    const body = await progress();
    expect(body.qualified).toBe(2);
    expect(body.pending).toBe(1);
    expect(body.revoked).toBe(1);
    expect(body.remaining).toBe(1);
    expect(body.percentage).toBe(67);
    expect(body.goalReached).toBe(false);
  });

  it('excludes clients captured by other barbers and legacy NULL-status clients', async () => {
    await makeClient(otherBarberId, 'QUALIFIED');
    await makeClient(barberId, null);
    await makeClient(null, null);
    const body = await progress();
    expect(body.qualified).toBe(0);
    expect(body.pending).toBe(0);
  });

  it('lazily qualifies pending clients with verified email and later-day activity', async () => {
    const client = await makeClient(barberId, 'PENDING');
    await app.prisma.clientActivity.create({
      data: { clientId: client.id, type: 'HISTORY_VIEW', createdAt: NEXT_DAY },
    });
    const body = await progress();
    expect(body.qualified).toBe(1);
    expect(body.pending).toBe(0);
    const row = await app.prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(row.acquisitionStatus).toBe('QUALIFIED');
  });

  it('flags goalReached when qualified >= goal', async () => {
    for (let i = 0; i < 3; i++) await makeClient(barberId, 'QUALIFIED');
    const body = await progress();
    expect(body.goalReached).toBe(true);
    expect(body.rewardUnlocked).toBe(true);
    expect(body.percentage).toBe(100);
    expect(body.remaining).toBe(0);
  });
});
