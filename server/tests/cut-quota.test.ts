import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Plan } from '@prisma/client';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';
import {
  getPlanCutLimit,
  getMonthlyCutUsage,
  computeUsage,
  computeCancelAllowance,
} from '../src/modules/cuts/cut-quota';
import { getCutsConfig } from '../src/modules/cuts/cuts.config';
import { CutsService } from '../src/modules/cuts/cuts.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { laPazMonthStartUtc } from '../src/utils/la-paz-date';

describe('cut-quota: plan limits', () => {
  it('returns the monthly limit per plan and null for unlimited plans', () => {
    expect(getPlanCutLimit('GRATIS')).toBe(30);
    expect(getPlanCutLimit('PRO')).toBeNull();
  });
});

describe('cut-quota: config', () => {
  it('defaults to 5 and accepts values within 0-50', () => {
    expect(getCutsConfig({}).cancelAllowancePct).toBe(5);
    expect(getCutsConfig({ CUTS_CANCEL_ALLOWANCE_PCT: '10' }).cancelAllowancePct).toBe(10);
    expect(getCutsConfig({ CUTS_CANCEL_ALLOWANCE_PCT: '0' }).cancelAllowancePct).toBe(0);
    expect(getCutsConfig({ CUTS_CANCEL_ALLOWANCE_PCT: '50' }).cancelAllowancePct).toBe(50);
  });

  it('falls back to the default on invalid values', () => {
    for (const bad of ['', '  ', 'abc', '-1', '51', 'NaN', 'Infinity']) {
      expect(getCutsConfig({ CUTS_CANCEL_ALLOWANCE_PCT: bad }).cancelAllowancePct).toBe(5);
    }
  });
});

describe('cut-quota: computeUsage (pure)', () => {
  const counts = (finished: number, cancelled: number, inProgress = 0) => ({ finished, cancelled, inProgress });

  it('computes the allowance as ceil(limit * pct / 100), minimum 1', () => {
    expect(computeCancelAllowance(30, 5)).toBe(2);
    expect(computeCancelAllowance(60, 5)).toBe(3);
    expect(computeCancelAllowance(30, 0)).toBe(1);
    expect(computeCancelAllowance(10, 1)).toBe(1);
    expect(computeCancelAllowance(30, 50)).toBe(15);
  });

  it('does not count cancellations within the allowance', () => {
    expect(computeUsage(counts(59, 3), 60, 5)).toBe(59);
    expect(computeUsage(counts(0, 3), 60, 5)).toBe(0);
  });

  it('counts only the cancellations beyond the allowance', () => {
    expect(computeUsage(counts(59, 5), 60, 5)).toBe(61);
    expect(computeUsage(counts(0, 62), 60, 5)).toBe(59);
    expect(computeUsage(counts(0, 63), 60, 5)).toBe(60);
  });

  it('counts IN_PROGRESS cuts', () => {
    expect(computeUsage(counts(10, 0, 1), 60, 5)).toBe(11);
  });

  it('keeps a minimum allowance of 1 when pct is 0', () => {
    expect(computeUsage(counts(0, 1), 60, 0)).toBe(0);
    expect(computeUsage(counts(0, 2), 60, 0)).toBe(1);
  });

  it('scales with the plan limit', () => {
    expect(computeUsage(counts(0, 10), 200, 5)).toBe(0);
    expect(computeUsage(counts(0, 11), 200, 5)).toBe(1);
  });
});

describe('cut-quota: database behavior', () => {
  let app: FastifyInstance;
  let barber: { id: string; shopId: string | null };
  let clientProfileId: string;
  let service: CutsService;
  let seq = 0;

  const monthStart = laPazMonthStartUtc();
  const inMonth = new Date(monthStart.getTime() + 60 * 60 * 1000);

  const seedCuts = async (
    status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED',
    count: number,
    startedAt: Date = inMonth
  ) => {
    if (count === 0) return;
    await app.prisma.cut.createMany({
      data: Array.from({ length: count }, () => ({
        clientRequestId: `quota-${++seq}`,
        barberId: barber.id,
        clientProfileId,
        status,
        startedAt,
      })),
    });
  };

  const startAs = (plan: Plan) =>
    service.startCut(
      { id: barber.id, phone: null, displayName: 'Test', shopId: barber.shopId, deviceId: null, plan },
      { clientRequestId: `quota-start-${++seq}`, clientProfileId }
    );

  const expectBlocked = async (plan: Plan) => {
    await expect(startAs(plan)).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
  };

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const seeded = await seed();
    barber = seeded.barber;
    clientProfileId = (await app.prisma.clientProfile.findFirstOrThrow({})).id;
    service = new CutsService(app.prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.prisma.cutPhoto.deleteMany({});
    await app.prisma.cut.deleteMany({});
  });

  afterEach(() => {
    delete process.env.CUTS_CANCEL_ALLOWANCE_PCT;
  });

  it('counts cuts by status within the La Paz month and ignores the previous month', async () => {
    await seedCuts('FINISHED', 2);
    await seedCuts('CANCELLED', 1);
    await seedCuts('IN_PROGRESS', 1);
    // One minute before 00:00 La Paz on day 1: previous month.
    await seedCuts('FINISHED', 5, new Date(monthStart.getTime() - 60 * 1000));
    // Exactly 00:00 La Paz on day 1: counts.
    await seedCuts('FINISHED', 1, monthStart);

    const result = await getMonthlyCutUsage(app.prisma, barber.id, 'GRATIS');
    expect(result).toMatchObject({ finished: 3, cancelled: 1, inProgress: 1, usage: 4, cancelAllowance: 2 });
  });

  it('returns zeros for a barber without cuts', async () => {
    const result = await getMonthlyCutUsage(app.prisma, '00000000-0000-0000-0000-000000000000', 'GRATIS');
    expect(result).toEqual({ finished: 0, cancelled: 0, inProgress: 0, usage: 0, cancelAllowance: 2 });
  });

  it('GRATIS: 29 finished + 2 cancelled is allowed (usage 29)', async () => {
    await seedCuts('FINISHED', 29);
    await seedCuts('CANCELLED', 2);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'GRATIS')).usage).toBe(29);
    const { cut } = await startAs('GRATIS');
    expect(cut.status).toBe('IN_PROGRESS');
  });

  it('GRATIS: 29 finished + 4 cancelled is blocked (usage 31)', async () => {
    await seedCuts('FINISHED', 29);
    await seedCuts('CANCELLED', 4);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'GRATIS')).usage).toBe(31);
    await expectBlocked('GRATIS');
  });

  it('GRATIS: cancelling alone is allowed up to 31 cancelled and blocked at 32', async () => {
    await seedCuts('CANCELLED', 31);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'GRATIS')).usage).toBe(29);
    const { cut } = await startAs('GRATIS');
    expect(cut.status).toBe('IN_PROGRESS');

    await app.prisma.cut.deleteMany({});
    await seedCuts('CANCELLED', 32);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'GRATIS')).usage).toBe(30);
    await expectBlocked('GRATIS');
  });

  it('counts IN_PROGRESS cuts toward the limit', async () => {
    await seedCuts('FINISHED', 29);
    await seedCuts('IN_PROGRESS', 1);
    // startCut auto-cancels the active cut (cancelled 1, within allowance), so usage drops to 29.
    const { cut } = await startAs('GRATIS');
    expect(cut.status).toBe('IN_PROGRESS');
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'GRATIS')).usage).toBe(30);
  });

  it('respects a custom CUTS_CANCEL_ALLOWANCE_PCT', async () => {
    process.env.CUTS_CANCEL_ALLOWANCE_PCT = '10';
    await seedCuts('FINISHED', 27);
    await seedCuts('CANCELLED', 3);
    // allowance = ceil(30 * 10 / 100) = 3
    const result = await getMonthlyCutUsage(app.prisma, barber.id, 'GRATIS');
    expect(result.cancelAllowance).toBe(3);
    expect(result.usage).toBe(27);
    await startAs('GRATIS');
  });

  it('does not limit PRO', async () => {
    await seedCuts('FINISHED', 300);
    const { cut } = await startAs('PRO');
    expect(cut.status).toBe('IN_PROGRESS');
  });

  it('auto-cancelling the previous active cut on startCut consumes the cancellation allowance', async () => {
    await seedCuts('FINISHED', 28);
    await seedCuts('CANCELLED', 2);
    await seedCuts('IN_PROGRESS', 1);
    // Before the restart: 28 + 1 in progress + 0 over allowance = 29 (allowed).
    await startAs('GRATIS');
    const after = await getMonthlyCutUsage(app.prisma, barber.id, 'GRATIS');
    // The auto-cancel pushed cancelled to 3 (1 over allowance): 28 finished + 1 over + 1 new in progress.
    expect(after.cancelled).toBe(3);
    expect(after.usage).toBe(30);
    await expectBlocked('GRATIS');
  });

  it('clamps a backdated startedAt to the current La Paz month so it cannot evade the quota', async () => {
    const { cut } = await service.startCut(
      { id: barber.id, phone: null, displayName: 'Test', shopId: barber.shopId, deviceId: null, plan: 'GRATIS' },
      {
        clientRequestId: `quota-backdate-${++seq}`,
        clientProfileId,
        startedAt: '2020-01-15T12:00:00Z',
      }
    );
    expect(cut.startedAt.getTime()).toBe(monthStart.getTime());
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'GRATIS')).inProgress).toBe(1);
  });

  it('getBarberSubscription reports the same usage and the cancellation allowance', async () => {
    await seedCuts('FINISHED', 10);
    await seedCuts('CANCELLED', 5);
    const sub = await new AuthService(app.prisma).getBarberSubscription(barber.id);
    expect(sub?.monthlyCutsCount).toBe(10);
    expect(sub?.maxCuts).toBe(9999);
    expect(sub?.cancelledThisMonth).toBe(5);
    expect(sub?.cancelAllowance).toBe(500);
  });
});
