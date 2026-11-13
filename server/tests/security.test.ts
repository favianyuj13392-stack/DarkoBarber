import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { hashSecret } from '../src/utils/crypto';
import { cleanDatabase } from './helpers';
import { resolveJwtSecret, TEST_JWT_SECRET } from '../src/utils/jwt-secret';

const chips = {
  baseLateral: 'Fade',
  tipoDegradado: 'Low',
  parteSuperior: 'Textured',
  barba: { included: false },
  adicionales: [],
};

describe('Security fixes', () => {
  let app: FastifyInstance;
  let tokenA: string;
  let tokenB: string;
  let barberAId: string;
  let profileId: string;

  const login = async (identifier: string, secret: string, deviceId: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier, secret, type: 'pin', deviceId },
    });
    return JSON.parse(res.body).token as string;
  };

  const createCut = (barberId: string, status: 'IN_PROGRESS' | 'FINISHED' | 'CANCELLED', suffix: string) =>
    app.prisma.cut.create({
      data: {
        clientRequestId: `sec-${suffix}`,
        barberId,
        clientProfileId: profileId,
        status,
        startedAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    });

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barber } = await seed();
    barberAId = barber.id;
    tokenA = await login('77212345', '1234', 'dev-sec-a');

    await app.prisma.barber.create({
      data: {
        phone: '77999111',
        email: 'sec-b@darkobarber.com',
        displayName: 'Barber B',
        pinHash: hashSecret('9999'),
        deviceId: 'dev-sec-b',
      },
    });
    tokenB = await login('77999111', '9999', 'dev-sec-b');

    const client = await app.prisma.client.create({
      data: { phone: '76000111', profiles: { create: [{ name: 'Sec Client' }] } },
      include: { profiles: true },
    });
    profileId = client.profiles[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  const finalize = (token: string, id: string, extra: Record<string, unknown> = {}, method: 'POST' | 'PATCH' = 'POST') =>
    app.inject({
      method,
      url: method === 'POST' ? `/cuts/${id}/finalize` : `/cuts/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { chips, ...extra },
    });

  describe('finalizeCut ownership', () => {
    it('returns 404 and leaves the cut unchanged when another barber finalizes it (both routes)', async () => {
      const cut = await createCut(barberAId, 'IN_PROGRESS', 'foreign');
      for (const method of ['POST', 'PATCH'] as const) {
        const res = await finalize(tokenB, cut.id, {}, method);
        expect(res.statusCode).toBe(404);
      }
      const after = await app.prisma.cut.findUniqueOrThrow({ where: { id: cut.id } });
      expect(after.status).toBe('IN_PROGRESS');
      expect(after.finishedAt).toBeNull();
      await app.prisma.cut.update({ where: { id: cut.id }, data: { status: 'CANCELLED' } });
    });

    it('does not finalize a CANCELLED cut', async () => {
      const cut = await createCut(barberAId, 'CANCELLED', 'cancelled');
      const res = await finalize(tokenA, cut.id);
      expect(res.statusCode).toBe(404);
      const after = await app.prisma.cut.findUniqueOrThrow({ where: { id: cut.id } });
      expect(after.status).toBe('CANCELLED');
    });

    it('unknown id does NOT finalize the barber latest in-progress cut', async () => {
      const latest = await createCut(barberAId, 'IN_PROGRESS', 'latest');
      const res = await finalize(tokenA, 'non-existent-id');
      expect(res.statusCode).toBe(404);
      const after = await app.prisma.cut.findUniqueOrThrow({ where: { id: latest.id } });
      expect(after.status).toBe('IN_PROGRESS');
      await app.prisma.cut.update({ where: { id: latest.id }, data: { status: 'CANCELLED' } });
    });

    it('stores photos as private even when input says isPublic: true', async () => {
      const cut = await createCut(barberAId, 'IN_PROGRESS', 'photos');
      const res = await finalize(tokenA, cut.id, {
        isPublic: true,
        photos: [{ url: 'cuts/photo-1.jpg', angle: 'Frontal' }],
      });
      expect(res.statusCode).toBe(200);
      const photos = await app.prisma.cutPhoto.findMany({ where: { cutId: cut.id } });
      expect(photos).toHaveLength(1);
      expect(photos[0].isPublic).toBe(false);
    });

    it('retry on an already FINISHED cut owned by the same barber returns the stored result', async () => {
      const cut = await createCut(barberAId, 'IN_PROGRESS', 'retry');
      const first = await finalize(tokenA, cut.id);
      expect(first.statusCode).toBe(200);
      const second = await finalize(tokenA, cut.id);
      expect(second.statusCode).toBe(200);
      const a = JSON.parse(first.body).cut;
      const b = JSON.parse(second.body).cut;
      expect(b.status).toBe('FINISHED');
      expect(b.finishedAt).toBe(a.finishedAt);
    });
  });

  describe('resolveJwtSecret', () => {
    it('throws outside test env when the secret is missing or too short', () => {
      expect(() => resolveJwtSecret({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
      expect(() => resolveJwtSecret({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
      expect(() =>
        resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'short' } as NodeJS.ProcessEnv)
      ).toThrow(/JWT_SECRET/);
      expect(() => resolveJwtSecret({ JWT_SECRET: 'x'.repeat(31) } as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
    });

    it('accepts a secret of 32+ chars outside test env', () => {
      const secret = 'x'.repeat(32);
      expect(resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret } as NodeJS.ProcessEnv)).toBe(secret);
    });

    it('falls back to a fixed test secret only when NODE_ENV is "test"', () => {
      expect(resolveJwtSecret({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(TEST_JWT_SECRET);
    });
  });
});
