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

  it('barber + nonexistent phone returns 200 with an empty history shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/clients/69000000/history',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toEqual({
      client: {
        id: null,
        phone: '69000000',
        displayName: null,
        avatarUrl: '/assets/images/1.png',
        isVerified: false,
      },
      cuts: [],
      profiles: [],
    });
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
    expect(body.cuts.length).toBe(2);

    const first = body.cuts.find((c: any) => c.chips.baseLateral === '#1');
    expect(first.photos.length).toBe(1);
    const second = body.cuts.find((c: any) => c.chips.baseLateral === '#2');
    expect(second.photos.length).toBe(0);
  });

  describe('authorization', () => {
    let ownerId: string;
    let otherId: string;
    let ownerToken: string;
    let otherToken: string;
    let strangerBarberToken: string;

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

      await app.prisma.cut.create({
        data: {
          clientRequestId: 'cut-req-authz-1',
          barberId,
          clientProfileId: owner.profiles[0].id,
          status: 'FINISHED',
          startedAt: new Date(Date.now() - 3600000),
          finishedAt: new Date(Date.now() - 1800000),
        },
      });

      const { hashSecret } = await import('../src/utils/crypto');
      await app.prisma.barber.create({
        data: {
          phone: '77000111',
          email: 'stranger-barber@darkobarber.com',
          displayName: 'Stranger Barber',
          pinHash: hashSecret('4321'),
          deviceId: 'dev-stranger',
        },
      });
      const login = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: '77000111', secret: '4321', type: 'pin', deviceId: 'dev-stranger' },
      });
      strangerBarberToken = JSON.parse(login.body).token;
    });

    it('rejects unauthenticated access with 401', async () => {
      const calls = [
        { method: 'GET', url: '/clients/70011122/history' },
        { method: 'GET', url: '/clients/me' },
        { method: 'PUT', url: '/clients/me', payload: { displayName: 'Hacked' } },
      ] as const;
      for (const c of calls) {
        const res = await app.inject({ ...c } as any);
        expect(res.statusCode).toBe(401);
      }
    });

    it('client history: owner 200, other client 403', async () => {
      const ok = await app.inject({
        method: 'GET',
        url: '/clients/70011122/history',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(ok.statusCode).toBe(200);
      expect(JSON.parse(ok.body).client.id).toBe(ownerId);

      const denied = await app.inject({
        method: 'GET',
        url: '/clients/70011122/history',
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(denied.statusCode).toBe(403);
    });

    it('client history: barber with a cut sees it, barber without cut gets 200 empty (no leak)', async () => {
      const ok = await app.inject({
        method: 'GET',
        url: '/clients/70011122/history',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(ok.statusCode).toBe(200);
      const okBody = JSON.parse(ok.body);
      expect(okBody.client.id).toBe(ownerId);
      expect(okBody.cuts.length).toBe(1);

      const empty = await app.inject({
        method: 'GET',
        url: '/clients/70011122/history',
        headers: { authorization: `Bearer ${strangerBarberToken}` },
      });
      expect(empty.statusCode).toBe(200);
      const body = JSON.parse(empty.body);
      expect(body.cuts).toEqual([]);
      expect(body.profiles).toEqual([]);
      expect(body.client.id).toBeNull();
      expect(body.client.displayName).toBeNull();

      // Existing-without-cuts and nonexistent phones must be indistinguishable.
      const unknown = await app.inject({
        method: 'GET',
        url: '/clients/60000001/history',
        headers: { authorization: `Bearer ${strangerBarberToken}` },
      });
      const unknownBody = JSON.parse(unknown.body);
      expect(unknown.statusCode).toBe(200);
      expect(Object.keys(unknownBody).sort()).toEqual(Object.keys(body).sort());
      expect(Object.keys(unknownBody.client).sort()).toEqual(Object.keys(body.client).sort());
    });

    it('client history: barber only sees own cuts and photos, not other barbers', async () => {
      const { hashSecret } = await import('../src/utils/crypto');
      const otherBarber = await app.prisma.barber.create({
        data: {
          phone: '77000222',
          email: 'other-barber@darkobarber.com',
          displayName: 'Other Barber',
          pinHash: hashSecret('5678'),
          deviceId: 'dev-other-barber',
        },
      });
      const shared = await app.prisma.client.create({
        data: {
          phone: '+59170077788',
          displayName: 'Shared Client',
          profiles: { create: [{ name: 'Shared' }, { name: 'Other Profile' }] },
        },
        include: { profiles: true },
      });
      const mine = shared.profiles.find((p) => p.name === 'Shared')!;
      const theirs = shared.profiles.find((p) => p.name === 'Other Profile')!;
      await app.prisma.cut.create({
        data: {
          clientRequestId: 'cut-req-own-1',
          barberId,
          clientProfileId: mine.id,
          status: 'FINISHED',
          startedAt: new Date(Date.now() - 3600000),
          finishedAt: new Date(Date.now() - 1800000),
          photos: { create: [{ r2Key: 'cuts/own/photo.webp', isPublic: false }] },
        },
      });
      await app.prisma.cut.create({
        data: {
          clientRequestId: 'cut-req-foreign-1',
          barberId: otherBarber.id,
          clientProfileId: mine.id,
          status: 'FINISHED',
          startedAt: new Date(Date.now() - 7200000),
          finishedAt: new Date(Date.now() - 5400000),
          photos: { create: [{ r2Key: 'cuts/foreign/photo.webp', isPublic: false }] },
        },
      });
      await app.prisma.cut.create({
        data: {
          clientRequestId: 'cut-req-foreign-2',
          barberId: otherBarber.id,
          clientProfileId: theirs.id,
          status: 'FINISHED',
          startedAt: new Date(Date.now() - 9200000),
          finishedAt: new Date(Date.now() - 9000000),
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/clients/70077788/history',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.cuts.length).toBe(1);
      expect(body.cuts[0].barberName).not.toBe('Other Barber');
      expect(body.cuts[0].photos.map((p: any) => p.url)).toEqual(['cuts/own/photo.webp']);
      expect(body.profiles.map((p: any) => p.name)).toEqual(['Shared']);
      expect(res.body).not.toContain('foreign');
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
