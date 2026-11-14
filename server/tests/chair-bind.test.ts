import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';
import { resetChairBindRateLimit } from '../src/modules/presence/chair-bind-rate-limit';

describe('POST /presence/chair/bind', () => {
  let app: FastifyInstance;
  let barberA: { id: string; email: string | null };
  let barberB: { id: string; email: string | null };

  const clientToken = (id: string) => app.jwt.sign({ userId: id, role: 'cliente', deviceId: 'web-client' });
  const barberToken = (id: string) => app.jwt.sign({ userId: id, barberId: id, role: 'barbero' });

  const makeClient = (email: string | null = `c-${crypto.randomUUID()}@example.com`) =>
    app.prisma.client.create({ data: { email, displayName: 'Chair Client' } });

  const bind = (token: string | null, payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/presence/chair/bind',
      headers: token ? { authorization: `Bearer ${token}` } : {},
      payload,
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

  beforeEach(() => resetChairBindRateLimit());

  it('rejects unauthenticated requests with 401', async () => {
    const res = await bind(null, { barberId: barberA.id });
    expect(res.statusCode).toBe(401);
  });

  it('rejects barber tokens with 403', async () => {
    const res = await bind(barberToken(barberA.id), { barberId: barberB.id });
    expect(res.statusCode).toBe(403);
  });

  it('captures the authenticated client and stores signup signals', async () => {
    const client = await makeClient();
    const res = await bind(clientToken(client.id), {
      barberId: barberA.id,
      deviceId: 'device-123',
      client: { displayName: 'Spoofed', phone: '70000000' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.isFirstScan).toBe(true);
    expect(body.client.displayName).toBe('Chair Client');

    const row = await app.prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(row.firstScanBarberId).toBe(barberA.id);
    expect(row.firstScanAt).toBeInstanceOf(Date);
    expect(row.acquisitionStatus).toBe('PENDING');
    expect(row.signupIp).toBeTruthy();
    expect(row.signupDeviceId).toBe('device-123');
  });

  it('does not create clients from body-supplied name/phone', async () => {
    const before = await app.prisma.client.count();
    const client = await makeClient();
    await bind(clientToken(client.id), {
      barberId: barberA.id,
      client: { displayName: 'Ghost', phone: '71111111' },
    });
    expect(await app.prisma.client.count()).toBe(before + 1);
    expect(await app.prisma.client.findFirst({ where: { phone: '71111111' } })).toBeNull();
  });

  it('never re-assigns an already captured client', async () => {
    const client = await makeClient();
    const token = clientToken(client.id);
    await bind(token, { barberId: barberA.id, deviceId: 'first' });
    const again = await bind(token, { barberId: barberA.id, deviceId: 'second' });
    expect(again.statusCode).toBe(200);
    expect(JSON.parse(again.body).isFirstScan).toBe(false);
    const other = await bind(token, { barberId: barberB.id });
    expect(JSON.parse(other.body).isFirstScan).toBe(false);

    const row = await app.prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(row.firstScanBarberId).toBe(barberA.id);
    expect(row.signupDeviceId).toBe('first');
  });

  it('refuses a client whose email equals the barber email', async () => {
    const client = await makeClient(barberA.email!.toUpperCase());
    const res = await bind(clientToken(client.id), { barberId: barberA.id });
    expect(res.statusCode).toBe(403);
    const row = await app.prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(row.firstScanBarberId).toBeNull();
  });

  it('assigns only once under concurrent double-bind', async () => {
    const client = await makeClient();
    const token = clientToken(client.id);
    const results = await Promise.all([
      bind(token, { barberId: barberA.id }),
      bind(token, { barberId: barberB.id }),
    ]);
    const firsts = results.filter((r) => JSON.parse(r.body).isFirstScan === true);
    expect(firsts).toHaveLength(1);
    const row = await app.prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect([barberA.id, barberB.id]).toContain(row.firstScanBarberId);
  });

  it('validates the body and unknown barbers', async () => {
    const client = await makeClient();
    const token = clientToken(client.id);
    expect((await bind(token, {})).statusCode).toBe(400);
    expect((await bind(token, { barberId: 'x'.repeat(100) })).statusCode).toBe(400);
    expect((await bind(token, { barberId: barberA.id, deviceId: 'd'.repeat(200) })).statusCode).toBe(400);
    expect((await bind(token, { barberId: crypto.randomUUID() })).statusCode).toBe(404);
  });

  it('rate limits repeated binds per client', async () => {
    const client = await makeClient();
    const token = clientToken(client.id);
    let last = 200;
    for (let i = 0; i < 12; i++) {
      last = (await bind(token, { barberId: barberA.id })).statusCode;
    }
    expect(last).toBe(429);
  });
});
