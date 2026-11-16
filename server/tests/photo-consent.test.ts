import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';
import { resetChairBindRateLimit } from '../src/modules/presence/chair-bind-rate-limit';

describe('Photo consent requests', () => {
  let app: FastifyInstance;
  let barberA: { id: string };
  let barberB: { id: string };
  let owner: { id: string; phone: string | null };
  let stranger: { id: string };

  const clientTok = (id: string) => app.jwt.sign({ userId: id, role: 'cliente', deviceId: 'web-client' });
  const barberTok = (id: string) => app.jwt.sign({ userId: id, barberId: id, role: 'barbero' });
  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  const makeClient = (phone: string | null = null) =>
    app.prisma.client.create({
      data: { email: `c-${crypto.randomUUID()}@example.com`, displayName: 'Consent Client', phone },
    });

  const serve = (barberId: string, clientId: string) =>
    app.prisma.chairBindingRequest.create({
      data: { barberId, clientId, status: 'ACCEPTED', expiresAt: new Date(Date.now() + 60_000) },
    });

  const ask = (barberId: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/presence/chair/consent-request',
      headers: auth(barberTok(barberId)),
      payload,
    });

  const pending = (clientId: string) =>
    app.inject({ method: 'GET', url: '/presence/chair/consent-request', headers: auth(clientTok(clientId)) });

  const answer = (clientId: string, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/presence/chair/consent-response',
      headers: auth(clientTok(clientId)),
      payload,
    });

  const barberPoll = (barberId: string, qs = '') =>
    app.inject({
      method: 'GET',
      url: `/presence/chair/consent-response${qs}`,
      headers: auth(barberTok(barberId)),
    });

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    barberA = await app.prisma.barber.create({ data: { displayName: 'Barber A', email: `a-${crypto.randomUUID()}@example.com` } });
    barberB = await app.prisma.barber.create({ data: { displayName: 'Barber B', email: `b-${crypto.randomUUID()}@example.com` } });
    owner = await makeClient('+59171234567');
    stranger = await makeClient();
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  beforeEach(async () => {
    resetChairBindRateLimit();
    await app.prisma.photoConsentRequest.deleteMany({});
    await app.prisma.chairBindingRequest.deleteMany({});
    await serve(barberA.id, owner.id);
  });

  afterEach(() => {
    delete process.env.PHOTO_CONSENT_TTL_SECONDS;
  });

  it('runs the full request, answer and read cycle', async () => {
    const res = await ask(barberA.id, { clientId: owner.id, styleName: 'Mid Fade', notes: 'n' });
    expect(res.statusCode).toBe(200);
    const { requestId } = JSON.parse(res.body);

    const p = JSON.parse((await pending(owner.id)).body);
    expect(p.hasPending).toBe(true);
    expect(p.request.requestId).toBe(requestId);
    expect(p.request.barberName).toBe('Barber A');
    expect(p.request.styleName).toBe('Mid Fade');

    expect(JSON.parse((await barberPoll(barberA.id, `?requestId=${requestId}`)).body).status).toBe('PENDING');

    expect((await answer(owner.id, { requestId, isPublic: true })).statusCode).toBe(200);
    expect(JSON.parse((await pending(owner.id)).body).hasPending).toBe(false);

    const r = JSON.parse((await barberPoll(barberA.id)).body);
    expect(r.hasResponse).toBe(true);
    expect(r.response.isPublic).toBe(true);
    expect(r.response.requestId).toBe(requestId);
    expect(JSON.parse((await barberPoll(barberA.id)).body).hasResponse).toBe(false);

    const row = await app.prisma.photoConsentRequest.findUniqueOrThrow({ where: { id: requestId } });
    expect(row.status).toBe('GRANTED');
    expect(row.activeKey).toBeNull();
  });

  it('records a denial and resolves clients by phone', async () => {
    const { requestId } = JSON.parse((await ask(barberA.id, { clientPhone: '71234567' })).body);
    await answer(owner.id, { requestId, isPublic: false });
    const r = JSON.parse((await barberPoll(barberA.id)).body);
    expect(r.response.isPublic).toBe(false);
    expect((await app.prisma.photoConsentRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('DENIED');
  });

  it('survives an app restart (fresh instance, same database)', async () => {
    const { requestId } = JSON.parse((await ask(barberA.id, { clientId: owner.id })).body);
    const app2 = await buildApp();
    try {
      const res = await app2.inject({
        method: 'GET',
        url: '/presence/chair/consent-request',
        headers: auth(app2.jwt.sign({ userId: owner.id, role: 'cliente', deviceId: 'web-client' })),
      });
      expect(JSON.parse(res.body).request.requestId).toBe(requestId);
    } finally {
      await app2.close();
    }
  });

  it('expires requests on read according to PHOTO_CONSENT_TTL_SECONDS', async () => {
    process.env.PHOTO_CONSENT_TTL_SECONDS = '1';
    const { requestId } = JSON.parse((await ask(barberA.id, { clientId: owner.id })).body);
    await new Promise((r) => setTimeout(r, 1200));

    expect(JSON.parse((await pending(owner.id)).body).hasPending).toBe(false);
    expect((await answer(owner.id, { requestId, isPublic: true })).statusCode).toBe(404);
    const poll = JSON.parse((await barberPoll(barberA.id, `?requestId=${requestId}`)).body);
    expect(poll.hasResponse).toBe(false);
    expect(poll.status).toBe('EXPIRED');
  });

  it('only lets the addressed client answer (IDOR)', async () => {
    const { requestId } = JSON.parse((await ask(barberA.id, { clientId: owner.id })).body);
    expect(JSON.parse((await pending(stranger.id)).body).hasPending).toBe(false);
    expect((await answer(stranger.id, { requestId, isPublic: true })).statusCode).toBe(404);
    expect((await app.prisma.photoConsentRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('PENDING');
  });

  it('only lets the requesting barber read the answer', async () => {
    const { requestId } = JSON.parse((await ask(barberA.id, { clientId: owner.id })).body);
    await answer(owner.id, { requestId, isPublic: true });
    expect(JSON.parse((await barberPoll(barberB.id, `?requestId=${requestId}`)).body).hasResponse).toBe(false);
    expect(JSON.parse((await barberPoll(barberA.id, `?requestId=${requestId}`)).body).hasResponse).toBe(true);
  });

  it('refuses barbers who are not serving the client and validates the cut', async () => {
    expect((await ask(barberB.id, { clientId: owner.id })).statusCode).toBe(403);
    expect((await ask(barberA.id, { clientId: crypto.randomUUID() })).statusCode).toBe(404);
    expect((await ask(barberA.id, { clientId: owner.id, cutId: crypto.randomUUID() })).statusCode).toBe(404);
    expect((await ask(barberA.id, {})).statusCode).toBe(400);
  });

  it('requires the right role on every endpoint', async () => {
    expect((await app.inject({ method: 'GET', url: '/presence/chair/consent-request' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/presence/chair/consent-request', payload: {} })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/presence/chair/consent-request', headers: auth(barberTok(barberA.id)) })).statusCode
    ).toBe(403);
    expect(
      (await app.inject({ method: 'GET', url: '/presence/chair/consent-response', headers: auth(clientTok(owner.id)) })).statusCode
    ).toBe(401);
  });

  it('keeps a single open request per pair and never stores image data', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        ask(barberA.id, { clientId: owner.id, styleName: 's', photoUrl: 'data:image/jpeg;base64,AAAA' })
      )
    );
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    expect(new Set(results.map((r) => JSON.parse(r.body).requestId)).size).toBe(1);
    const row = await app.prisma.photoConsentRequest.findFirstOrThrow({});
    expect(JSON.stringify(row)).not.toContain('data:image');
  });
});
