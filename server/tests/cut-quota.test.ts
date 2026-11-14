import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';
import { getPlanCutLimit, getMonthlyCutUsage } from '../src/modules/cuts/cut-quota';

describe('cut-quota: plan limits', () => {
  it('returns the monthly limit per plan and null for unlimited plans', () => {
    expect(getPlanCutLimit('AUTONOMO')).toBe(60);
    expect(getPlanCutLimit('BARBERIA_BASE')).toBe(200);
    expect(getPlanCutLimit('ALTO_FLUJO')).toBeNull();
  });
});

describe('cut-quota: monthly usage counts', () => {
  let app: FastifyInstance;
  let barberId: string;
  let clientProfileId: string;
  const now = new Date('2026-11-15T15:00:00Z');

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barber } = await seed();
    barberId = barber.id;
    clientProfileId = (await app.prisma.clientProfile.findFirstOrThrow({})).id;

    const mk = (id: string, status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED', startedAt: string) => ({
      clientRequestId: id,
      barberId,
      clientProfileId,
      status,
      startedAt: new Date(startedAt),
    });
    await app.prisma.cut.createMany({
      data: [
        mk('q-fin-1', 'FINISHED', '2026-11-02T10:00:00Z'),
        mk('q-fin-2', 'FINISHED', '2026-11-03T10:00:00Z'),
        mk('q-can-1', 'CANCELLED', '2026-11-04T10:00:00Z'),
        mk('q-prog-1', 'IN_PROGRESS', '2026-11-05T10:00:00Z'),
        // 2026-11-01T03:59Z is Oct 31 23:59 La Paz: previous month.
        mk('q-old-1', 'FINISHED', '2026-11-01T03:59:00Z'),
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('counts cuts by status within the La Paz month', async () => {
    const result = await getMonthlyCutUsage(app.prisma, barberId, now);
    expect(result).toMatchObject({ finished: 2, cancelled: 1, inProgress: 1 });
  });

  it('currently counts every cut toward usage', async () => {
    const result = await getMonthlyCutUsage(app.prisma, barberId, now);
    expect(result.usage).toBe(4);
  });

  it('returns zeros for a barber without cuts', async () => {
    const result = await getMonthlyCutUsage(app.prisma, '00000000-0000-0000-0000-000000000000', now);
    expect(result).toEqual({ finished: 0, cancelled: 0, inProgress: 0, usage: 0 });
  });
});
