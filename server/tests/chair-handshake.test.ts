import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';
import { resetChairBindRateLimit } from '../src/modules/presence/chair-bind-rate-limit';

describe('Chair handshake persistence', () => {
  let app: FastifyInstance;
  let barberA: { id: string };
  let barberB: { id: string };

  const clientToken = (a: FastifyInstance, id: string) =>
    a.jwt.sign({ userId: id, role: 'cliente', deviceId: 'web-client' });
  const barberToken = (a: FastifyInstance, id: string) =>
    a.jwt.sign({ userId: id, barberId: id, role: 'barbero' });

  const makeClient = () =>
    app.prisma.client.create({
      data: { email: `c-${crypto.randomUUID()}@example.com`, displayName: 'Chair Client', phone: `7${Math.floor(Math.random() * 1e7)}` },
    });

  const bind = (a: FastifyInstance, clientId: string, barberId: string) =>
    a.inject({
      method: 'POST',
      url: '/presence/chair/bind',
      headers: { authorization: `Bearer ${clientToken(a, clientId)}` },
      payload: { barberId },
    });

  const poll = (a: FastifyInstance, barberId: string) =>
    a.inject({
      method: 'GET',
      url: '/presence/chair/session',
      headers: { authorization: `Bearer ${barberToken(a, barberId)}` },
    });

  const respond = (a: FastifyInstance, barberId: string, requestId: string, action = 'accept') =>
    a.inject({
      method: 'POST',
      url: `/presence/chair/session/${requestId}/respond`,
      headers: { authorization: `Bearer ${barberToken(a, barberId)}` },
      payload: { action },
    });

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    barberA = await app.prisma.barber.create({
      data: { displayName: 'Barber A', email: `a-${crypto.randomUUID()}@example.com` },
    });
    barberB = await app.prisma.barber.create({
      data: { displayName: 'Barber B', email: `b-${crypto.randomUUID()}@example.com` },
    });
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  beforeEach(async () => {
    resetChairBindRateLimit();
    await app.prisma.chairBindingRequest.deleteMany({});
  });

  afterEach(() => {
    delete process.env.CHAIR_BIND_TTL_SECONDS;
  });

  it('persists the handshake and lets the barber pick it up once', async () => {
    const client = await makeClient();
    const res = await bind(app, client.id, barberA.id);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.requestId).toBeTruthy();

    const row = await app.prisma.chairBindingRequest.findUniqueOrThrow({ where: { id: body.requestId } });
    expect(row.status).toBe('PENDING');
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const first = JSON.parse((await poll(app, barberA.id)).body);
    expect(first.hasPending).toBe(true);
    expect(first.requestId).toBe(body.requestId);
    expect(first.client.displayName).toBe('Chair Client');
    expect(first.client.id).toBe(client.id);

    const second = JSON.parse((await poll(app, barberA.id)).body);
    expect(second.hasPending).toBe(false);
  });

  it('survives an app restart (fresh instance, same database)', async () => {
    const client = await makeClient();
    await bind(app, client.id, barberA.id);

    const app2 = await buildApp();
    try {
      const res = await poll(app2, barberA.id);
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).hasPending).toBe(true);
    } finally {
      await app2.close();
    }
  });

  it('expires requests on read according to CHAIR_BIND_TTL_SECONDS', async () => {
    process.env.CHAIR_BIND_TTL_SECONDS = '1';
    const client = await makeClient();
    const { requestId } = JSON.parse((await bind(app, client.id, barberA.id)).body);
    await new Promise((r) => setTimeout(r, 1200));

    expect(JSON.parse((await poll(app, barberA.id)).body).hasPending).toBe(false);
    const row = await app.prisma.chairBindingRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(row.status).toBe('EXPIRED');
    expect(row.activeKey).toBeNull();
    expect((await respond(app, barberA.id, requestId)).statusCode).toBe(404);

    // A fresh scan after expiry creates a new pending request.
    process.env.CHAIR_BIND_TTL_SECONDS = '120';
    const again = JSON.parse((await bind(app, client.id, barberA.id)).body);
    expect(again.requestId).not.toBe(requestId);
  });

  it('keeps a single active pending request per (barber, client) under concurrency', async () => {
    const client = await makeClient();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => bind(app, client.id, barberA.id))
    );
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    const ids = new Set(results.map((r) => JSON.parse(r.body).requestId));
    expect(ids.size).toBe(1);
    expect(await app.prisma.chairBindingRequest.count({ where: { status: 'PENDING' } })).toBe(1);
  });

  it('only shows and lets a barber act on requests addressed to them', async () => {
    const client = await makeClient();
    const { requestId } = JSON.parse((await bind(app, client.id, barberA.id)).body);

    expect(JSON.parse((await poll(app, barberB.id)).body).hasPending).toBe(false);
    expect((await respond(app, barberB.id, requestId)).statusCode).toBe(404);
    expect((await app.prisma.chairBindingRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('PENDING');

    // The query string cannot be used to read another barber's queue.
    const spoof = await app.inject({
      method: 'GET',
      url: `/presence/chair/session?barberId=${barberA.id}`,
      headers: { authorization: `Bearer ${barberToken(app, barberB.id)}` },
    });
    expect(JSON.parse(spoof.body).hasPending).toBe(false);

    const ok = await respond(app, barberA.id, requestId);
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body).status).toBe('ACCEPTED');
    expect((await respond(app, barberA.id, requestId)).statusCode).toBe(404);
  });

  it('requires authentication for the barber endpoints', async () => {
    expect((await app.inject({ method: 'GET', url: '/presence/chair/session' })).statusCode).toBe(401);
    const client = await makeClient();
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/presence/chair/session',
          headers: { authorization: `Bearer ${clientToken(app, client.id)}` },
        })
      ).statusCode
    ).toBe(401);
  });

  it('lets a client read only their own request', async () => {
    const owner = await makeClient();
    const other = await makeClient();
    const { requestId } = JSON.parse((await bind(app, owner.id, barberA.id)).body);

    const get = (id: string) =>
      app.inject({
        method: 'GET',
        url: `/presence/chair/bind/${requestId}`,
        headers: { authorization: `Bearer ${clientToken(app, id)}` },
      });
    const mine = await get(owner.id);
    expect(mine.statusCode).toBe(200);
    expect(JSON.parse(mine.body).status).toBe('PENDING');
    expect((await get(other.id)).statusCode).toBe(404);
  });

  it('lets the barber decline a request', async () => {
    const client = await makeClient();
    const { requestId } = JSON.parse((await bind(app, client.id, barberA.id)).body);
    const res = await respond(app, barberA.id, requestId, 'decline');
    expect(JSON.parse(res.body).status).toBe('CANCELLED');
    expect((await app.prisma.chairBindingRequest.findUniqueOrThrow({ where: { id: requestId } })).activeKey).toBeNull();
  });
});
