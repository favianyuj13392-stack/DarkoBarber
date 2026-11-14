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
    expect(getPlanCutLimit('AUTONOMO')).toBe(60);
    expect(getPlanCutLimit('BARBERIA_BASE')).toBe(200);
    expect(getPlanCutLimit('ALTO_FLUJO')).toBeNull();
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
    expect(computeCancelAllowance(60, 5)).toBe(3);
    expect(computeCancelAllowance(200, 5)).toBe(10);
    expect(computeCancelAllowance(60, 0)).toBe(1);
    expect(computeCancelAllowance(10, 1)).toBe(1);
    expect(computeCancelAllowance(60, 50)).toBe(30);
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

    const result = await getMonthlyCutUsage(app.prisma, barber.id, 'AUTONOMO');
    expect(result).toMatchObject({ finished: 3, cancelled: 1, inProgress: 1, usage: 4, cancelAllowance: 3 });
  });

  it('returns zeros for a barber without cuts', async () => {
    const result = await getMonthlyCutUsage(app.prisma, '00000000-0000-0000-0000-000000000000', 'AUTONOMO');
    expect(result).toEqual({ finished: 0, cancelled: 0, inProgress: 0, usage: 0, cancelAllowance: 3 });
  });

  it('AUTONOMO: 59 finished + 3 cancelled is allowed (usage 59)', async () => {
    await seedCuts('FINISHED', 59);
    await seedCuts('CANCELLED', 3);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'AUTONOMO')).usage).toBe(59);
    const { cut } = await startAs('AUTONOMO');
    expect(cut.status).toBe('IN_PROGRESS');
  });

  it('AUTONOMO: 59 finished + 5 cancelled is blocked (usage 61)', async () => {
    await seedCuts('FINISHED', 59);
    await seedCuts('CANCELLED', 5);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'AUTONOMO')).usage).toBe(61);
    await expectBlocked('AUTONOMO');
  });

  it('AUTONOMO: cancelling alone is allowed up to 62 cancelled and blocked at 63', async () => {
    await seedCuts('CANCELLED', 62);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'AUTONOMO')).usage).toBe(59);
    const { cut } = await startAs('AUTONOMO');
    expect(cut.status).toBe('IN_PROGRESS');

    await app.prisma.cut.deleteMany({});
    await seedCuts('CANCELLED', 63);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'AUTONOMO')).usage).toBe(60);
    await expectBlocked('AUTONOMO');
  });

  it('counts IN_PROGRESS cuts toward the limit', async () => {
    await seedCuts('FINISHED', 59);
    await seedCuts('IN_PROGRESS', 1);
    // startCut auto-cancels the active cut (cancelled 1, within allowance), so usage drops to 59.
    const { cut } = await startAs('AUTONOMO');
    expect(cut.status).toBe('IN_PROGRESS');
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'AUTONOMO')).usage).toBe(60);
  });

  it('BARBERIA_BASE: allows 10 free cancellations and limits at 200', async () => {
    await seedCuts('FINISHED', 199);
    await seedCuts('CANCELLED', 10);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'BARBERIA_BASE')).usage).toBe(199);
    await startAs('BARBERIA_BASE');

    await app.prisma.cut.deleteMany({});
    await seedCuts('FINISHED', 199);
    await seedCuts('CANCELLED', 12);
    expect((await getMonthlyCutUsage(app.prisma, barber.id, 'BARBERIA_BASE')).usage).toBe(201);
    await expectBlocked('BARBERIA_BASE');
  });

  it('respects a custom CUTS_CANCEL_ALLOWANCE_PCT', async () => {
    process.env.CUTS_CANCEL_ALLOWANCE_PCT = '10';
    await seedCuts('FINISHED', 54);
    await seedCuts('CANCELLED', 6);
    // allowance = ceil(60 * 10 / 100) = 6
    const result = await getMonthlyCutUsage(app.prisma, barber.id, 'AUTONOMO');
    expect(result.cancelAllowance).toBe(6);
    expect(result.usage).toBe(54);
    await startAs('AUTONOMO');
  });

  it('does not limit ALTO_FLUJO', async () => {
    await seedCuts('FINISHED', 300);
    const { cut } = await startAs('ALTO_FLUJO');
    expect(cut.status).toBe('IN_PROGRESS');
  });

  it('auto-cancelling the previous active cut on startCut consumes the cancellation allowance', async () => {
    await seedCuts('FINISHED', 58);
    await seedCuts('CANCELLED', 3);
    await seedCuts('IN_PROGRESS', 1);
    // Before the restart: 58 + 1 in progress + 0 over allowance = 59 (allowed).
    await startAs('AUTONOMO');
    const after = await getMonthlyCutUsage(app.prisma, barber.id, 'AUTONOMO');
    // The auto-cancel pushed cancelled to 4 (1 over allowance): 58 finished + 1 over + 1 new in progress.
    expect(after.cancelled).toBe(4);
    expect(after.usage).toBe(60);
    await expectBlocked('AUTONOMO');
  });

  it('getBarberSubscription reports the same usage and the cancellation allowance', async () => {
    await seedCuts('FINISHED', 10);
    await seedCuts('CANCELLED', 5);
    const sub = await new AuthService(app.prisma).getBarberSubscription(barber.id);
    expect(sub?.monthlyCutsCount).toBe(12);
    expect(sub?.maxCuts).toBe(60);
    expect(sub?.cancelledThisMonth).toBe(5);
    expect(sub?.cancelAllowance).toBe(3);
  });
});
