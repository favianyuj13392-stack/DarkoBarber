import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';

describe('Cuts Module Integration Tests', () => {
  let app: FastifyInstance;
  let token: string;
  let barberId: string;
  let profileId: string;

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barber } = await seed();
    barberId = barber.id;

    // Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: '77212345',
        secret: '1234',
        type: 'pin',
        deviceId: 'dev-cuts-test',
      },
    });
    token = JSON.parse(loginRes.body).token;

    // Create client & profile for cut tests
    const client = await app.prisma.client.create({
      data: {
        phone: '78889999',
        profiles: {
          create: [{ name: 'Lucas' }],
        },
      },
      include: { profiles: true },
    });
    profileId = client.profiles[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should start a new cut successfully (POST /cuts)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/cuts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        clientProfileId: profileId,
        clientRequestId: 'cut-req-unique-1',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.cut).toBeDefined();
    expect(body.cut.status).toBe('IN_PROGRESS');
    expect(body.cut.barberId).toBe(barberId);
  });

  it('should enforce RN-06: 409 Conflict if active cut already exists for barber', async () => {
    // We already have an IN_PROGRESS cut from previous test
    const res = await app.inject({
      method: 'POST',
      url: '/cuts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        clientProfileId: profileId,
        clientRequestId: 'cut-req-second-attempt',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('ACTIVE_CUT_EXISTS');
  });

  it('should guarantee idempotency for duplicate clientRequestId (200 OK, no duplicate)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/cuts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        clientProfileId: profileId,
        clientRequestId: 'cut-req-unique-1',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.cut.clientRequestId).toBe('cut-req-unique-1');
  });

  it('should finalize normal cut (>15 min) with rapidClosure: false', async () => {
    const activeCut = await app.prisma.cut.findFirst({
      where: { barberId, status: 'IN_PROGRESS' },
    });
    expect(activeCut).toBeDefined();

    // Set startedAt to 25 minutes ago
    const startedAt = new Date(Date.now() - 25 * 60 * 1000);
    await app.prisma.cut.update({
      where: { id: activeCut!.id },
      data: { startedAt },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/cuts/${activeCut!.id}/finalize`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        chips: {
          baseLateral: '#1',
          tipoDegradado: 'Mid Fade',
          parteSuperior: 'Tijera Texturizado',
          barba: { included: true, alturaMejilla: 'Media' },
          adicionales: ['Cejas navaja'],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.cut.status).toBe('FINISHED');
    expect(body.cut.rapidClosure).toBe(false);
  });

  it('should enforce RN-07: anti-rush flag (rapidClosure: true) when duration < 15 min without blocking', async () => {
    // Start fresh cut
    const startRes = await app.inject({
      method: 'POST',
      url: '/cuts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        clientProfileId: profileId,
        clientRequestId: 'cut-req-rush-test',
      },
    });
    expect(startRes.statusCode).toBe(201);
    const cutId = JSON.parse(startRes.body).cut.id;

    // Started 7 minutes ago
    await app.prisma.cut.update({
      where: { id: cutId },
      data: { startedAt: new Date(Date.now() - 7 * 60 * 1000) },
    });

    const finalizeRes = await app.inject({
      method: 'POST',
      url: `/cuts/${cutId}/finalize`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        chips: {
          baseLateral: '#0',
          tipoDegradado: 'High Fade',
          parteSuperior: 'Maquina',
          barba: { included: false },
          adicionales: [],
        },
      },
    });

    expect(finalizeRes.statusCode).toBe(200);
    const body = JSON.parse(finalizeRes.body);
    expect(body.cut.status).toBe('FINISHED');
    expect(body.cut.rapidClosure).toBe(true);
  });

  it('should evaluate express cut threshold (<8 min rapidClosure: true, >=8 min rapidClosure: false)', async () => {
    // 1. Express cut under 8 minutes (e.g. 5 minutes) -> rapidClosure: true
    const start1 = await app.inject({
      method: 'POST',
      url: '/cuts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        clientProfileId: profileId,
        clientRequestId: 'cut-express-5min',
      },
    });
    expect(start1.statusCode).toBe(201);
    const cut1Id = JSON.parse(start1.body).cut.id;

    await app.prisma.cut.update({
      where: { id: cut1Id },
      data: { startedAt: new Date(Date.now() - 5 * 60 * 1000) },
    });

    const finalize1 = await app.inject({
      method: 'POST',
      url: `/cuts/${cut1Id}/finalize`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        chips: {
          baseLateral: '#2',
          tipoDegradado: 'Tape Fade',
          parteSuperior: 'Normal',
          barba: { included: false },
          adicionales: ['Corte Express'],
        },
      },
    });
    expect(finalize1.statusCode).toBe(200);
    expect(JSON.parse(finalize1.body).cut.rapidClosure).toBe(true);

    // 2. Express cut over 8 minutes (e.g. 10 minutes) -> rapidClosure: false
    const start2 = await app.inject({
      method: 'POST',
      url: '/cuts',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        clientProfileId: profileId,
        clientRequestId: 'cut-express-10min',
      },
    });
    expect(start2.statusCode).toBe(201);
    const cut2Id = JSON.parse(start2.body).cut.id;

    await app.prisma.cut.update({
      where: { id: cut2Id },
      data: { startedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    const finalize2 = await app.inject({
      method: 'POST',
      url: `/cuts/${cut2Id}/finalize`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        chips: {
          baseLateral: '#2',
          tipoDegradado: 'Tape Fade',
          parteSuperior: 'Normal',
          barba: { included: false },
          adicionales: ['Corte Express'],
        },
      },
    });
    expect(finalize2.statusCode).toBe(200);
    expect(JSON.parse(finalize2.body).cut.rapidClosure).toBe(false);
  });
});
