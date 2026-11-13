import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';

describe('Clients Module Integration Tests', () => {
  let app: FastifyInstance;
  let token: string;
  let barberId: string;

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barber } = await seed();
    barberId = barber.id;

    // Login to get token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: '77212345',
        secret: '1234',
        type: 'pin',
        deviceId: 'dev-client-test',
      },
    });
    token = JSON.parse(loginRes.body).token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 404 with exists: false when client does not exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/clients/69000000/history',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.exists).toBe(false);
    expect(body.phone).toBe('69000000');
  });

  it('should create client and primary profile via POST /clients', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/clients',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        phone: '75551234',
        name: 'Mateo',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.client.phone).toBe('75551234');
    expect(body.profile.name).toBe('Mateo');

    // Verify in database
    const client = await app.prisma.client.findUnique({
      where: { phone: '75551234' },
      include: { profiles: true },
    });
    expect(client).toBeDefined();
    expect(client?.profiles[0].name).toBe('Mateo');
  });

  it('should retrieve client history with multiple profiles and completed cuts', async () => {
    // Setup Client with 2 profiles: Rodrigo and Rodrigo Jr.
    const client = await app.prisma.client.create({
      data: {
        phone: '71987654',
        profiles: {
          create: [
            { name: 'Rodrigo' },
            { name: 'Rodrigo Jr.' },
          ],
        },
      },
      include: { profiles: true },
    });

    const rodrigoProfile = client.profiles.find((p) => p.name === 'Rodrigo')!;
    const sonProfile = client.profiles.find((p) => p.name === 'Rodrigo Jr.')!;

    // Create completed cut for Rodrigo
    await app.prisma.cut.create({
      data: {
        clientRequestId: 'cut-req-test-1',
        barberId,
        clientProfileId: rodrigoProfile.id,
        status: 'FINISHED',
        chips: { baseLateral: '#1', tipoDegradado: 'Mid Fade' },
        startedAt: new Date(Date.now() - 3600000),
        finishedAt: new Date(Date.now() - 1800000),
        photos: {
          create: [{ r2Key: 'cuts/b1/c1/photo-1.webp', isPublic: false }],
        },
      },
    });

    // Create completed cut for Rodrigo Jr.
    await app.prisma.cut.create({
      data: {
        clientRequestId: 'cut-req-test-2',
        barberId,
        clientProfileId: sonProfile.id,
        status: 'FINISHED',
        chips: { baseLateral: '#2', tipoDegradado: 'Low Fade' },
        startedAt: new Date(Date.now() - 7200000),
        finishedAt: new Date(Date.now() - 5400000),
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/clients/71987654/history',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.client.phone).toBe('71987654');
    expect(body.profiles.length).toBe(2);

    const rodrigoData = body.profiles.find((p: any) => p.name === 'Rodrigo');
    expect(rodrigoData.cuts.length).toBe(1);
    expect(rodrigoData.cuts[0].chips.baseLateral).toBe('#1');
    expect(rodrigoData.cuts[0].photos.length).toBe(1);

    const sonData = body.profiles.find((p: any) => p.name === 'Rodrigo Jr.');
    expect(sonData.cuts.length).toBe(1);
    expect(sonData.cuts[0].chips.baseLateral).toBe('#2');
  });

  describe('authorization', () => {
    let ownerId: string;
    let otherId: string;
    let ownerToken: string;
    let otherToken: string;

    beforeAll(async () => {
      const owner = await app.prisma.client.create({
        data: {
          phone: '+59170011122',
          email: 'owner-client@darkobarber.com',
          displayName: 'Owner Client',
          profiles: { create: [{ name: 'Owner' }] },
        },
        include: { profiles: true },
      });
      const other = await app.prisma.client.create({
        data: {
          phone: '+59170033344',
          email: 'other-client@darkobarber.com',
          displayName: 'Other Client',
        },
      });
      ownerId = owner.id;
      otherId = other.id;
      ownerToken = app.jwt.sign({ userId: owner.id, role: 'cliente' });
      otherToken = app.jwt.sign({ userId: other.id, role: 'cliente' });
    });

    it('rejects unauthenticated access with 401', async () => {
      const calls = [
        { method: 'GET', url: '/clients/me' },
        { method: 'PUT', url: '/clients/me', payload: { displayName: 'Hacked' } },
      ] as const;
      for (const c of calls) {
        const res = await app.inject({ ...c } as any);
        expect(res.statusCode).toBe(401);
      }
    });

    it('GET /clients/me resolves only from token and rejects barbers', async () => {
      const ok = await app.inject({
        method: 'GET',
        url: '/clients/me?email=other-client@darkobarber.com&name=Other&phone=70033344',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(ok.statusCode).toBe(200);
      expect(JSON.parse(ok.body).client.id).toBe(ownerId);

      const barber = await app.inject({
        method: 'GET',
        url: '/clients/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(barber.statusCode).toBe(403);
    });

    it('PUT /clients/me updates only the authenticated client and ignores id/email from body', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/clients/me',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: {
          id: ownerId,
          email: 'owner-client@darkobarber.com',
          displayName: 'Other Renamed',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe(otherId);

      const owner = await app.prisma.client.findUnique({ where: { id: ownerId } });
      const other = await app.prisma.client.findUnique({ where: { id: otherId } });
      expect(owner?.displayName).toBe('Owner Client');
      expect(other?.displayName).toBe('Other Renamed');
      expect(other?.email).toBe('other-client@darkobarber.com');
    });

    it('PUT /clients/me returns 400 on invalid body and 409 on duplicate phone', async () => {
      const bad = await app.inject({
        method: 'PUT',
        url: '/clients/me',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { displayName: 12345, phone: { x: 1 } },
      });
      expect(bad.statusCode).toBe(400);
      expect(JSON.parse(bad.body).error).toBe('VALIDATION_ERROR');

      const dup = await app.inject({
        method: 'PUT',
        url: '/clients/me',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { phone: '+59170011122' },
      });
      expect(dup.statusCode).toBe(409);
      expect(JSON.parse(dup.body).error).toBe('PHONE_ALREADY_EXISTS');
    });

    it('never falls back to the Ernesto Salinas client', async () => {
      const ernesto = await app.prisma.client.create({
        data: { phone: '+59170099999', displayName: 'Ernesto Salinas' },
      });
      const stranger = await app.prisma.client.create({
        data: { phone: '+59170055566', displayName: 'No Cuts Client' },
      });
      const strangerToken = app.jwt.sign({ userId: stranger.id, role: 'cliente' });

      const res = await app.inject({
        method: 'GET',
        url: '/clients/me',
        headers: { authorization: `Bearer ${strangerToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.client.id).toBe(stranger.id);
      expect(body.client.displayName).toBe('No Cuts Client');

      const put = await app.inject({
        method: 'PUT',
        url: '/clients/me',
        headers: { authorization: `Bearer ${strangerToken}` },
        payload: { displayName: 'Renamed' },
      });
      expect(put.statusCode).toBe(200);
      const e = await app.prisma.client.findUnique({ where: { id: ernesto.id } });
      expect(e?.displayName).toBe('Ernesto Salinas');
    });
  });
});
