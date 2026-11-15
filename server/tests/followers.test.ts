import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';

describe('Followers', () => {
  let app: FastifyInstance;

  const createBarber = (isActive = true) =>
    app.prisma.barber.create({
      data: {
        phone: `7${Math.floor(1000000 + Math.random() * 8999999)}`,
        displayName: 'Follow Barber',
        isActive,
      },
    });

  const createClient = () =>
    app.prisma.client.create({
      data: { email: `c-${crypto.randomUUID()}@example.com`, displayName: 'Follow Client' },
    });

  const clientToken = (id: string) => app.jwt.sign({ userId: id, role: 'cliente' });
  const barberToken = (id: string) => app.jwt.sign({ userId: id, barberId: id, role: 'barbero' });
  const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

  const status = (barberId: string, token?: string) =>
    app.inject({
      method: 'GET',
      url: `/barbers/${barberId}/follow`,
      headers: token ? bearer(token) : {},
    });

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  beforeEach(async () => {
    await app.prisma.barberFollower.deleteMany({});
  });

  describe('GET /barbers/:id/follow', () => {
    it('returns the real count (0, not a fake baseline) for an unauthenticated caller', async () => {
      const barber = await createBarber();
      const res = await status(barber.id);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ followerCount: 0, isFollowing: false });
    });

    it('counts real rows and computes isFollowing for the authenticated client only', async () => {
      const barber = await createBarber();
      const a = await createClient();
      const b = await createClient();
      const c = await createClient();
      await app.prisma.barberFollower.createMany({
        data: [
          { barberId: barber.id, clientId: a.id },
          { barberId: barber.id, clientId: b.id },
        ],
      });

      const asA = JSON.parse((await status(barber.id, clientToken(a.id))).body);
      expect(asA).toEqual({ followerCount: 2, isFollowing: true });

      const asC = JSON.parse((await status(barber.id, clientToken(c.id))).body);
      expect(asC).toEqual({ followerCount: 2, isFollowing: false });

      const anon = JSON.parse((await status(barber.id)).body);
      expect(anon).toEqual({ followerCount: 2, isFollowing: false });
    });

    it('never reports isFollowing for a barber token', async () => {
      const barber = await createBarber();
      const other = await createBarber();
      const res = await status(barber.id, barberToken(other.id));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).isFollowing).toBe(false);
    });

    it('rejects an invalid bearer token with 401', async () => {
      const barber = await createBarber();
      const res = await status(barber.id, 'not-a-token');
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 for unknown and inactive barbers', async () => {
      const inactive = await createBarber(false);
      expect((await status(crypto.randomUUID())).statusCode).toBe(404);
      expect((await status(inactive.id)).statusCode).toBe(404);
    });
  });
});
