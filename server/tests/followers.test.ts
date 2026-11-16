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

  describe('follow / unfollow', () => {
    const call = (method: 'POST' | 'PUT' | 'DELETE', barberId: string, token?: string, payload?: object) =>
      app.inject({
        method,
        url: `/barbers/${barberId}/follow`,
        headers: token ? bearer(token) : {},
        payload,
      });

    it('requires authentication', async () => {
      const barber = await createBarber();
      for (const m of ['POST', 'PUT', 'DELETE'] as const) {
        expect((await call(m, barber.id)).statusCode).toBe(401);
      }
    });

    it('forbids barbers from following', async () => {
      const barber = await createBarber();
      const other = await createBarber();
      for (const m of ['POST', 'PUT', 'DELETE'] as const) {
        expect((await call(m, barber.id, barberToken(other.id))).statusCode).toBe(403);
      }
      expect(await app.prisma.barberFollower.count()).toBe(0);
    });

    it('returns 404 for unknown barbers and for following an inactive one', async () => {
      const client = await createClient();
      const inactive = await createBarber(false);
      const t = clientToken(client.id);
      expect((await call('PUT', crypto.randomUUID(), t)).statusCode).toBe(404);
      expect((await call('PUT', inactive.id, t)).statusCode).toBe(404);
      expect((await call('POST', inactive.id, t)).statusCode).toBe(404);
      expect((await call('DELETE', crypto.randomUUID(), t)).statusCode).toBe(404);
    });

    it('takes identity from the JWT and ignores any clientId in the body', async () => {
      const barber = await createBarber();
      const me = await createClient();
      const victim = await createClient();
      const res = await call('PUT', barber.id, clientToken(me.id), { clientId: victim.id });
      expect(res.statusCode).toBe(200);
      const rows = await app.prisma.barberFollower.findMany({ where: { barberId: barber.id } });
      expect(rows.map((r) => r.clientId)).toEqual([me.id]);
    });

    it('PUT is idempotent and DELETE is idempotent', async () => {
      const barber = await createBarber();
      const client = await createClient();
      const t = clientToken(client.id);

      for (let i = 0; i < 2; i++) {
        const res = await call('PUT', barber.id, t);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ followerCount: 1, isFollowing: true });
      }
      for (let i = 0; i < 2; i++) {
        const res = await call('DELETE', barber.id, t);
        expect(res.statusCode).toBe(200);
        expect(JSON.parse(res.body)).toEqual({ followerCount: 0, isFollowing: false });
      }
    });

    it('legacy POST still toggles', async () => {
      const barber = await createBarber();
      const client = await createClient();
      const t = clientToken(client.id);
      expect(JSON.parse((await call('POST', barber.id, t)).body)).toEqual({ followerCount: 1, isFollowing: true });
      expect(JSON.parse((await call('POST', barber.id, t)).body)).toEqual({ followerCount: 0, isFollowing: false });
    });

    it('concurrent double-follow never 500s and leaves exactly one row', async () => {
      const barber = await createBarber();
      const client = await createClient();
      const t = clientToken(client.id);
      const results = await Promise.all(Array.from({ length: 10 }, () => call('PUT', barber.id, t)));
      expect(results.map((r) => r.statusCode)).toEqual(Array(10).fill(200));
      expect(await app.prisma.barberFollower.count({ where: { barberId: barber.id } })).toBe(1);
    });

    it('concurrent toggles and unfollows never 500', async () => {
      const barber = await createBarber();
      const client = await createClient();
      const t = clientToken(client.id);
      const toggles = await Promise.all(Array.from({ length: 10 }, () => call('POST', barber.id, t)));
      expect(toggles.every((r) => r.statusCode === 200)).toBe(true);
      expect(await app.prisma.barberFollower.count({ where: { barberId: barber.id } })).toBeLessThanOrEqual(1);

      await call('PUT', barber.id, t);
      const dels = await Promise.all(Array.from({ length: 10 }, () => call('DELETE', barber.id, t)));
      expect(dels.every((r) => r.statusCode === 200)).toBe(true);
      expect(await app.prisma.barberFollower.count({ where: { barberId: barber.id } })).toBe(0);
    });

    it('counts followers from distinct clients', async () => {
      const barber = await createBarber();
      const clients = await Promise.all([createClient(), createClient(), createClient()]);
      await Promise.all(clients.map((c) => call('PUT', barber.id, clientToken(c.id))));
      const res = await status(barber.id);
      expect(JSON.parse(res.body).followerCount).toBe(3);
    });
  });
});
