import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { hashSecret } from '../src/utils/crypto';
import { cleanDatabase } from './helpers';

describe('Photos Module Integration Tests', () => {
  let app: FastifyInstance;
  let tokenBarberA: string;
  let tokenBarberB: string;
  let barberAId: string;
  let barberBId: string;
  let cutAId: string;

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barber } = await seed();
    barberAId = barber.id;

    // Login Barber A
    const loginResA = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: '77212345',
        secret: '1234',
        type: 'pin',
        deviceId: 'dev-photos-barber-a',
      },
    });
    tokenBarberA = JSON.parse(loginResA.body).token;

    // Create and login Barber B
    const barberB = await app.prisma.barber.create({
      data: {
        phone: '77999888',
        email: 'barberb@darkobarber.com',
        displayName: 'Barber B',
        pinHash: hashSecret('9999'),
        deviceId: 'dev-photos-barber-b',
      },
    });
    barberBId = barberB.id;

    const loginResB = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: '77999888',
        secret: '9999',
        type: 'pin',
        deviceId: 'dev-photos-barber-b',
      },
    });
    tokenBarberB = JSON.parse(loginResB.body).token;

    // Create Client and Cut for Barber A
    const client = await app.prisma.client.create({
      data: {
        phone: '76112233',
        profiles: {
          create: [{ name: 'Esteban' }],
        },
      },
      include: { profiles: true },
    });

    const cutA = await app.prisma.cut.create({
      data: {
        clientRequestId: 'cut-photo-test-a',
        barberId: barberAId,
        clientProfileId: client.profiles[0].id,
        status: 'IN_PROGRESS',
      },
    });
    cutAId = cutA.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate presigned upload URL targeting Cloudflare R2 for valid cut', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/cuts/${cutAId}/photos/presign`,
      headers: { authorization: `Bearer ${tokenBarberA}` },
      payload: { contentType: 'image/webp' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.presignedUrl).toBeDefined();
    expect(body.presignedUrl).toContain('r2.cloudflarestorage.com');
    expect(body.r2Key).toBeDefined();
    expect(body.r2Key).toMatch(new RegExp(`^cuts/${barberAId}/${cutAId}/[a-f0-9\\-]+\\.webp$`));
  });

  it('should reject presigning with 403 Forbidden when cut belongs to another barber', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/cuts/${cutAId}/photos/presign`,
      headers: { authorization: `Bearer ${tokenBarberB}` },
      payload: { contentType: 'image/webp' },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('should confirm photo upload with explicit in-chair consent (isPublic: true)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/cuts/${cutAId}/photos/confirm`,
      headers: { authorization: `Bearer ${tokenBarberA}` },
      payload: {
        r2Key: `cuts/${barberAId}/${cutAId}/photo-consent-yes.webp`,
        isPublic: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.photo).toBeDefined();
    expect(body.photo.isPublic).toBe(true);
    expect(body.photo.cutId).toBe(cutAId);
  });

  it('should default to isPublic: false when consent is absent upon confirmation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/cuts/${cutAId}/photos/confirm`,
      headers: { authorization: `Bearer ${tokenBarberA}` },
      payload: {
        r2Key: `cuts/${barberAId}/${cutAId}/photo-consent-default.webp`,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.photo).toBeDefined();
    expect(body.photo.isPublic).toBe(false);
  });
});
