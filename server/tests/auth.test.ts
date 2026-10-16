import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';

describe('Auth Module Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    await seed();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should authenticate pilot barber with email and password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: 'diego@darkobarber.com',
        secret: 'Secret123!',
        type: 'password',
        deviceId: 'dev-iphone-14',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.barber.displayName).toBe('Diego');
    expect(body.barber.phone).toBe('77212345');

    const barberInDb = await app.prisma.barber.findUnique({
      where: { phone: '77212345' },
    });
    expect(barberInDb?.deviceId).toBe('dev-iphone-14');
  });

  it('should authenticate pilot barber with 4-digit numeric PIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: '77212345',
        secret: '1234',
        type: 'pin',
        deviceId: 'dev-pixel-7',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.barber.displayName).toBe('Diego');

    const barberInDb = await app.prisma.barber.findUnique({
      where: { phone: '77212345' },
    });
    expect(barberInDb?.deviceId).toBe('dev-pixel-7');
  });

  it('should reject invalid credentials with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: 'diego@darkobarber.com',
        secret: 'WrongPassword!',
        type: 'password',
        deviceId: 'dev-test',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('INVALID_CREDENTIALS');
  });

  it('should enforce single active device concurrency (SESSION_SUPERSEDED)', async () => {
    // 1. Barber logs in from dev-old-device
    const loginRes1 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: '77212345',
        secret: '1234',
        type: 'pin',
        deviceId: 'dev-old-device',
      },
    });
    expect(loginRes1.statusCode).toBe(200);
    const tokenA = JSON.parse(loginRes1.body).token;

    // Verify tokenA works on /auth/me
    const meRes1 = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(meRes1.statusCode).toBe(200);

    // 2. Barber logs in from dev-new-device
    const loginRes2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: '77212345',
        secret: '1234',
        type: 'pin',
        deviceId: 'dev-new-device',
      },
    });
    expect(loginRes2.statusCode).toBe(200);
    const tokenB = JSON.parse(loginRes2.body).token;

    // 3. Request with old tokenA must now be rejected with SESSION_SUPERSEDED
    const meResOld = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(meResOld.statusCode).toBe(401);
    const oldErrorBody = JSON.parse(meResOld.body);
    expect(oldErrorBody.error).toBe('SESSION_SUPERSEDED');

    // 4. Request with new tokenB succeeds
    const meResNew = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(meResNew.statusCode).toBe(200);
    const meBody = JSON.parse(meResNew.body);
    expect(meBody.id).toBeDefined();
    expect(meBody.displayName).toBe('Diego');
    expect(meBody.plan).toBe('AUTONOMO');
    expect(meBody).toHaveProperty('activeCutId');
  });

  it('should authenticate client with email and password and verify /auth/me', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        identifier: 'carlos@darkobarber.com',
        secret: 'Secret123!',
        type: 'password',
        role: 'cliente',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.role).toBe('cliente');
    expect(body.user.email).toBe('carlos@darkobarber.com');
    expect(body.user.displayName).toBe('Carlos Mendoza');

    // Verify /auth/me for client
    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${body.token}` },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.body);
    expect(meBody.role).toBe('cliente');
    expect(meBody.email).toBe('carlos@darkobarber.com');
    expect(meBody.displayName).toBe('Carlos Mendoza');
  });

  it('should register a new client and allow immediate login', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'valeria@darkobarber.com',
        password: 'Password123!',
        displayName: 'Valeria Rios',
        role: 'cliente',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.role).toBe('cliente');
    expect(body.user.email).toBe('valeria@darkobarber.com');
    expect(body.user.displayName).toBe('Valeria Rios');

    // Reject duplicate registration
    const dupRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'valeria@darkobarber.com',
        password: 'Password123!',
        displayName: 'Valeria Rios',
        role: 'cliente',
      },
    });
    expect(dupRes.statusCode).toBe(409);
    expect(JSON.parse(dupRes.body).error).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('should register a new barber with automated presence record initialization', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'rodrigo@darkobarber.com',
        password: 'Password123!',
        displayName: 'Rodrigo Barbero',
        role: 'barbero',
        deviceId: 'device-rodrigo-1',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.role).toBe('barbero');
    expect(body.user.plan).toBe('AUTONOMO');

    // Confirm presence was created in DB
    const presenceInDb = await app.prisma.presence.findUnique({
      where: { barberId: body.user.id },
    });
    expect(presenceInDb).toBeDefined();
    expect(presenceInDb?.status).toBe('GRAY');
  });

  it('should authenticate or register user via Google OAuth endpoint', async () => {
    // Generate valid base64 payload for Google ID token mock
    const googlePayload = {
      sub: 'google-sub-987654321',
      email: 'sofia.google@gmail.com',
      name: 'Sofia Google',
      picture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
    };
    const mockToken = `header.${Buffer.from(JSON.stringify(googlePayload)).toString('base64')}.signature`;

    const res = await app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: {
        idToken: mockToken,
        role: 'cliente',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.user.email).toBe('sofia.google@gmail.com');
    expect(body.user.displayName).toBe('Sofia Google');
    expect(body.user.role).toBe('cliente');
  });
});
