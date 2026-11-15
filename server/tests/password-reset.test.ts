import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';
import { emailService } from '../src/services/email/email.service';
import { hashSecret } from '../src/utils/crypto';
import { getPasswordResetTtlMinutes } from '../src/modules/auth/auth.service';

describe('Password reset', () => {
  let app: FastifyInstance;
  let sendSpy: ReturnType<typeof vi.spyOn>;

  const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

  const createClient = (password = 'OldPassword1!') =>
    app.prisma.client.create({
      data: {
        email: `c-${crypto.randomUUID()}@example.com`,
        displayName: 'Reset Client',
        passwordHash: hashSecret(password),
      },
    });

  const forgot = (email: string) =>
    app.inject({ method: 'POST', url: '/auth/forgot-password', payload: { email } });

  const reset = (token: string, newPassword = 'NewPassword1!') =>
    app.inject({ method: 'POST', url: '/auth/reset-password', payload: { token, newPassword } });

  const lastToken = (): string => {
    const call = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
    return (call[1] as { token: string }).token;
  };

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
  });

  afterAll(async () => {
    await app.prisma.passwordResetToken.deleteMany({});
    await cleanDatabase(app.prisma);
    await app.close();
  });

  beforeEach(async () => {
    await app.prisma.passwordResetToken.deleteMany({});
    sendSpy = vi
      .spyOn(emailService, 'sendPasswordResetEmail')
      .mockResolvedValue({ success: true, messageId: 'mock' });
  });

  afterEach(() => {
    sendSpy.mockRestore();
  });

  it('stores only a SHA-256 hash of a long url-safe token and never returns it', async () => {
    const client = await createClient();
    const res = await forgot(client.email as string);

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain(lastToken());

    const token = lastToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43,}$/);

    const rows = await app.prisma.passwordResetToken.findMany({ where: { email: client.email as string } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(sha256(token));
    expect(JSON.stringify(rows[0])).not.toContain(token);
  });

  it('gives the same response for unknown emails and sends nothing', async () => {
    const client = await createClient();
    const known = await forgot(client.email as string);
    sendSpy.mockClear();
    const unknown = await forgot(`nobody-${crypto.randomUUID()}@example.com`);

    expect(unknown.statusCode).toBe(known.statusCode);
    expect(unknown.body).toBe(known.body);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(await app.prisma.passwordResetToken.count()).toBe(1);
  });

  it('resets the password with a valid token and the token is single use', async () => {
    const client = await createClient();
    await forgot(client.email as string);
    const token = lastToken();

    const ok = await reset(token);
    expect(ok.statusCode).toBe(200);

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { identifier: client.email, secret: 'NewPassword1!', type: 'password', role: 'cliente' },
    });
    expect(login.statusCode).toBe(200);

    const again = await reset(token, 'AnotherPassword1!');
    expect(again.statusCode).toBe(400);
  });

  it('lets only one of two concurrent resets succeed', async () => {
    const client = await createClient();
    await forgot(client.email as string);
    const token = lastToken();

    const results = await Promise.all([reset(token, 'ConcurrentOne1!'), reset(token, 'ConcurrentTwo2!')]);
    const codes = results.map((r) => r.statusCode).sort();
    expect(codes).toEqual([200, 400]);
  });

  it('invalidates the previous token when a new one is requested', async () => {
    const client = await createClient();
    await forgot(client.email as string);
    const first = lastToken();
    await forgot(client.email as string);
    const second = lastToken();
    expect(second).not.toBe(first);

    expect((await reset(first)).statusCode).toBe(400);
    expect((await reset(second)).statusCode).toBe(200);
  });

  it('rejects expired, unknown and raw-hash tokens', async () => {
    const client = await createClient();
    await forgot(client.email as string);
    const token = lastToken();

    await app.prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await reset(token)).statusCode).toBe(400);
    expect((await reset('totally-unknown-token')).statusCode).toBe(400);
    // The stored hash itself must not work as a token.
    expect((await reset(sha256(token))).statusCode).toBe(400);
  });

  describe('session invalidation', () => {
    it('rejects a client JWT issued before the reset and accepts a fresh login', async () => {
      const client = await createClient();
      const oldLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: client.email, secret: 'OldPassword1!', type: 'password', role: 'cliente' },
      });
      const oldToken = JSON.parse(oldLogin.body).token as string;
      const me = (t: string) =>
        app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${t}` } });
      expect((await me(oldToken)).statusCode).toBe(200);

      await forgot(client.email as string);
      expect((await reset(lastToken())).statusCode).toBe(200);

      expect((await me(oldToken)).statusCode).toBe(401);

      const newLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { identifier: client.email, secret: 'NewPassword1!', type: 'password', role: 'cliente' },
      });
      expect(newLogin.statusCode).toBe(200);
      expect((await me(JSON.parse(newLogin.body).token)).statusCode).toBe(200);
    });

    it('rejects a barber JWT issued before the reset on barber routes and accepts a fresh login', async () => {
      const email = `b-${crypto.randomUUID()}@example.com`;
      await app.prisma.barber.create({
        data: {
          email,
          displayName: 'Reset Barber',
          passwordHash: hashSecret('OldPassword1!'),
          deviceId: 'dev-reset',
        },
      });
      const loginWith = (secret: string) =>
        app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { identifier: email, secret, type: 'password', role: 'barbero', deviceId: 'dev-reset' },
        });
      const profile = (t: string) =>
        app.inject({ method: 'GET', url: '/barbers/me', headers: { authorization: `Bearer ${t}` } });
      const me = (t: string) =>
        app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${t}` } });

      const oldToken = JSON.parse((await loginWith('OldPassword1!')).body).token as string;
      expect((await profile(oldToken)).statusCode).toBe(200);

      await forgot(email);
      expect((await reset(lastToken())).statusCode).toBe(200);

      expect((await profile(oldToken)).statusCode).toBe(401);
      expect((await me(oldToken)).statusCode).toBe(401);

      const fresh = await loginWith('NewPassword1!');
      expect(fresh.statusCode).toBe(200);
      expect((await profile(JSON.parse(fresh.body).token)).statusCode).toBe(200);
    });

    it('keeps tokens without a tv claim valid for accounts that never changed password', async () => {
      const client = await createClient();
      const legacy = app.jwt.sign({ userId: client.id, role: 'cliente', deviceId: 'web-client' });
      const res = await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${legacy}` } });
      expect(res.statusCode).toBe(200);
    });
  });

  it('honours PASSWORD_RESET_TTL_MINUTES with a 30 minute default', async () => {
    expect(getPasswordResetTtlMinutes({} as NodeJS.ProcessEnv)).toBe(30);
    expect(getPasswordResetTtlMinutes({ PASSWORD_RESET_TTL_MINUTES: 'abc' } as NodeJS.ProcessEnv)).toBe(30);
    expect(getPasswordResetTtlMinutes({ PASSWORD_RESET_TTL_MINUTES: '-5' } as NodeJS.ProcessEnv)).toBe(30);
    expect(getPasswordResetTtlMinutes({ PASSWORD_RESET_TTL_MINUTES: '10' } as NodeJS.ProcessEnv)).toBe(10);

    const client = await createClient();
    const before = Date.now();
    await forgot(client.email as string);
    const row = await app.prisma.passwordResetToken.findFirstOrThrow({ where: { email: client.email as string } });
    const minutes = (row.expiresAt.getTime() - before) / 60000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThanOrEqual(30.1);
  });
});
