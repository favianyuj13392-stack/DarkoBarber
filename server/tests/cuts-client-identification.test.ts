import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';

describe('Cuts: client identification (no invented clients)', () => {
  let app: FastifyInstance;
  let token: string;
  let reqSeq = 0;

  const start = (payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/cuts',
      headers: { authorization: `Bearer ${token}` },
      payload: { clientRequestId: `ident-${++reqSeq}`, ...payload },
    });

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    await seed();
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: '77212345', secret: '1234', type: 'pin', deviceId: 'dev-ident-test' },
    });
    token = JSON.parse(loginRes.body).token;
  });

  beforeEach(async () => {
    await app.prisma.cut.deleteMany({});
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  it('rejects a start with no client identification and creates nothing', async () => {
    const before = await app.prisma.client.count();
    const res = await start({});
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('CLIENT_REQUIRED');
    expect(await app.prisma.client.count()).toBe(before);
    expect(await app.prisma.cut.count()).toBe(0);
  });

  it('rejects the legacy "client-active" magic value', async () => {
    const before = await app.prisma.client.count();
    const res = await start({ clientProfileId: 'client-active', clientPhone: '71110001' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe('CLIENT_PROFILE_NOT_FOUND');
    expect(await app.prisma.client.count()).toBe(before);
  });

  it('rejects an invalid phone', async () => {
    const res = await start({ clientPhone: '123' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('INVALID_PHONE');
  });

  it('returns 404 for an unknown clientId', async () => {
    const res = await start({ clientId: 'does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe('CLIENT_NOT_FOUND');
  });

  it('never matches a client by name, even when the name is a substring', async () => {
    const existing = await app.prisma.client.create({
      data: { phone: '+59172220001', displayName: 'Carlos Mamani', profiles: { create: [{ name: 'Carlos Mamani' }] } },
    });
    const res = await start({ clientName: 'Carlos' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('CLIENT_REQUIRED');
    // A different phone with the same partial name must not attach to Carlos either.
    const res2 = await start({ clientName: 'Carlos', clientPhone: '72220002' });
    expect(res2.statusCode).toBe(201);
    const cut = JSON.parse(res2.body).cut;
    const profile = await app.prisma.clientProfile.findUniqueOrThrow({ where: { id: cut.clientProfileId } });
    expect(profile.clientId).not.toBe(existing.id);
  });

  it('attaches the cut to an existing client found by exact normalized phone', async () => {
    const existing = await app.prisma.client.create({
      data: { phone: '+59173330001', displayName: 'Real Person', profiles: { create: [{ name: 'Real Person' }] } },
    });
    const res = await start({ clientPhone: '73330001', clientName: 'Other Name' });
    expect(res.statusCode).toBe(201);
    const cut = JSON.parse(res.body).cut;
    const profile = await app.prisma.clientProfile.findUniqueOrThrow({ where: { id: cut.clientProfileId } });
    expect(profile.clientId).toBe(existing.id);
    const reloaded = await app.prisma.client.findUniqueOrThrow({ where: { id: existing.id } });
    expect(reloaded.displayName).toBe('Real Person');
  });

  it('attaches the cut to an existing client by clientId', async () => {
    const existing = await app.prisma.client.create({
      data: { phone: '+59174440001', displayName: 'By Id', profiles: { create: [{ name: 'By Id' }] } },
    });
    const res = await start({ clientId: existing.id });
    expect(res.statusCode).toBe(201);
    const profile = await app.prisma.clientProfile.findUniqueOrThrow({
      where: { id: JSON.parse(res.body).cut.clientProfileId },
    });
    expect(profile.clientId).toBe(existing.id);
  });

  it('creates a walk-in client with only the real phone and name provided (no fake email or defaults)', async () => {
    const res = await start({ clientPhone: '75550001', clientName: '  Walk In  ' });
    expect(res.statusCode).toBe(201);
    const profile = await app.prisma.clientProfile.findUniqueOrThrow({
      where: { id: JSON.parse(res.body).cut.clientProfileId },
      include: { client: true },
    });
    expect(profile.client.phone).toBe('+59175550001');
    expect(profile.client.email).toBeNull();
    expect(profile.client.displayName).toBe('Walk In');
    expect(profile.name).toBe('Walk In');
  });

  it('creates a nameless walk-in without inventing a name', async () => {
    const res = await start({ clientPhone: '75550002' });
    expect(res.statusCode).toBe(201);
    const profile = await app.prisma.clientProfile.findUniqueOrThrow({
      where: { id: JSON.parse(res.body).cut.clientProfileId },
      include: { client: true },
    });
    expect(profile.client.displayName).toBeNull();
    expect(profile.client.email).toBeNull();
  });

  it('does not leave a stray client behind when the start is rejected earlier', async () => {
    const before = await app.prisma.client.count();
    const res = await start({ clientPhone: 'abc' });
    expect(res.statusCode).toBe(400);
    expect(await app.prisma.client.count()).toBe(before);
  });
});
