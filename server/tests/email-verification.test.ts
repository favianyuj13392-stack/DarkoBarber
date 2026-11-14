import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';
import { emailService } from '../src/services/email/email.service';
import { EmailVerificationService } from '../src/modules/rewards/email-verification.service';

describe('Client email verification', () => {
  let app: FastifyInstance;
  let sendSpy: ReturnType<typeof vi.spyOn>;

  const clientToken = (id: string) => app.jwt.sign({ userId: id, role: 'cliente', deviceId: 'web-client' });

  const createClient = (email: string | null = `c-${crypto.randomUUID()}@example.com`) =>
    app.prisma.client.create({ data: { email, displayName: 'Test Client' } });

  const extractToken = (): string => {
    const call = sendSpy.mock.calls[sendSpy.mock.calls.length - 1];
    const url = new URL((call[1] as { verifyUrl: string }).verifyUrl);
    return url.searchParams.get('token') as string;
  };

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  beforeEach(() => {
    sendSpy = vi
      .spyOn(emailService, 'sendEmailVerificationEmail')
      .mockResolvedValue({ success: true, messageId: 'mock' });
  });

  afterEach(() => {
    sendSpy.mockRestore();
  });

  it('creates a hashed token and sends the email when unverified', async () => {
    const client = await createClient();
    const res = await app.inject({
      method: 'POST',
      url: '/clients/me/email/verify-request',
      headers: { authorization: `Bearer ${clientToken(client.id)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ verified: false, sent: true });
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const [to, params] = sendSpy.mock.calls[0] as [string, { verifyUrl: string }];
    expect(to).toBe(client.email);
    expect(params.verifyUrl).toContain('/verify-email?token=');

    const rows = await app.prisma.emailVerificationToken.findMany({ where: { clientId: client.id } });
    expect(rows).toHaveLength(1);
    // Only a SHA-256 hex digest is stored, never the raw secret.
    expect(rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(extractToken()).not.toContain(rows[0].tokenHash);
  });

  it('returns verified:true without sending when already verified', async () => {
    const client = await createClient();
    await app.prisma.client.update({ where: { id: client.id }, data: { emailVerifiedAt: new Date() } });

    const res = await app.inject({
      method: 'POST',
      url: '/clients/me/email/verify-request',
      headers: { authorization: `Bearer ${clientToken(client.id)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ verified: true });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('enforces a 60s cooldown between sends', async () => {
    const client = await createClient();
    const headers = { authorization: `Bearer ${clientToken(client.id)}` };

    const first = await app.inject({ method: 'POST', url: '/clients/me/email/verify-request', headers });
    const second = await app.inject({ method: 'POST', url: '/clients/me/email/verify-request', headers });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.headers['retry-after']).toBeDefined();
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it('enforces the per La Paz day limit and resets on the next La Paz day', async () => {
    const client = await createClient();
    const service = new EmailVerificationService(app.prisma, emailService);
    const now = new Date('2026-11-14T15:00:00Z'); // 11:00 La Paz on the 14th

    // Three tokens already sent earlier on the same La Paz day.
    for (const iso of ['2026-11-14T13:00:00Z', '2026-11-14T13:10:00Z', '2026-11-14T13:20:00Z']) {
      await app.prisma.emailVerificationToken.create({
        data: {
          clientId: client.id,
          tokenHash: crypto.randomBytes(16).toString('hex'),
          expiresAt: new Date('2026-11-15T13:00:00Z'),
          createdAt: new Date(iso),
        },
      });
    }

    const limited = await service.requestVerification(client.id, now);
    expect(limited).toEqual({ status: 'RATE_LIMITED', reason: 'DAILY_LIMIT' });
    expect(sendSpy).not.toHaveBeenCalled();

    // 04:30 UTC on the 15th is 00:30 La Paz: a new La Paz day, so the quota resets.
    const nextDay = await service.requestVerification(client.id, new Date('2026-11-15T04:30:00Z'));
    expect(nextDay.status).toBe('SENT');
  });

  it('verifies with a valid token, marks it used and invalidates the others', async () => {
    const client = await createClient();
    const service = new EmailVerificationService(app.prisma, emailService);

    await service.requestVerification(client.id, new Date(Date.now() - 10 * 60 * 1000));
    const firstToken = extractToken();
    await service.requestVerification(client.id);
    const secondToken = extractToken();

    const res = await app.inject({ method: 'POST', url: '/auth/email/verify', payload: { token: secondToken } });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ verified: true });

    const updated = await app.prisma.client.findUnique({ where: { id: client.id } });
    expect(updated?.emailVerifiedAt).not.toBeNull();

    const unusedLeft = await app.prisma.emailVerificationToken.count({
      where: { clientId: client.id, usedAt: null },
    });
    expect(unusedLeft).toBe(0);

    // The other token issued earlier is invalidated too.
    const other = await app.inject({ method: 'POST', url: '/auth/email/verify', payload: { token: firstToken } });
    expect(other.statusCode).toBe(400);
  });

  it('rejects used, expired, malformed and unknown tokens with the same generic error', async () => {
    const client = await createClient();
    const service = new EmailVerificationService(app.prisma, emailService);

    await service.requestVerification(client.id);
    const token = extractToken();

    const ok = await app.inject({ method: 'POST', url: '/auth/email/verify', payload: { token } });
    expect(ok.statusCode).toBe(200);
    const reused = await app.inject({ method: 'POST', url: '/auth/email/verify', payload: { token } });

    const expiredClient = await createClient();
    await service.requestVerification(expiredClient.id);
    const expiredToken = extractToken();
    await app.prisma.emailVerificationToken.updateMany({
      where: { clientId: expiredClient.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await app.inject({ method: 'POST', url: '/auth/email/verify', payload: { token: expiredToken } });

    const unknown = await app.inject({
      method: 'POST',
      url: '/auth/email/verify',
      payload: { token: `${client.id}.${crypto.randomBytes(32).toString('hex')}` },
    });
    const malformed = await app.inject({ method: 'POST', url: '/auth/email/verify', payload: { token: 'garbage' } });
    const missing = await app.inject({ method: 'POST', url: '/auth/email/verify', payload: {} });

    const bodies = [reused, expired, unknown, malformed, missing].map((r) => {
      expect(r.statusCode).toBe(400);
      return r.body;
    });
    expect(new Set(bodies).size).toBe(1);

    const stillUnverified = await app.prisma.client.findUnique({ where: { id: expiredClient.id } });
    expect(stillUnverified?.emailVerifiedAt).toBeNull();
  });

  it('does not verify a different address if the email changed after the link was issued', async () => {
    const client = await createClient();
    const service = new EmailVerificationService(app.prisma, emailService);

    await service.requestVerification(client.id);
    const token = extractToken();
    await app.prisma.client.update({
      where: { id: client.id },
      data: { email: `changed-${crypto.randomUUID()}@example.com` },
    });

    const res = await app.inject({ method: 'POST', url: '/auth/email/verify', payload: { token } });
    expect(res.statusCode).toBe(400);
    const after = await app.prisma.client.findUnique({ where: { id: client.id } });
    expect(after?.emailVerifiedAt).toBeNull();
  });

  it('forbids barbers from requesting client email verification', async () => {
    const barber = await app.prisma.barber.create({
      data: { displayName: 'Barber', email: `b-${crypto.randomUUID()}@example.com` },
    });
    const token = app.jwt.sign({ userId: barber.id, barberId: barber.id, role: 'barbero' });

    const res = await app.inject({
      method: 'POST',
      url: '/clients/me/email/verify-request',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('requires authentication for verify-request', async () => {
    const res = await app.inject({ method: 'POST', url: '/clients/me/email/verify-request' });
    expect(res.statusCode).toBe(401);
  });

  describe('Google login', () => {
    const googleToken = (claims: Record<string, unknown>) =>
      `header.${Buffer.from(JSON.stringify(claims)).toString('base64')}.sig`;

    it('sets emailVerifiedAt when Google reports the email as verified', async () => {
      const email = `g-${crypto.randomUUID()}@example.com`;
      const res = await app.inject({
        method: 'POST',
        url: '/auth/google',
        payload: {
          role: 'cliente',
          idToken: googleToken({ sub: `sub-${crypto.randomUUID()}`, email, email_verified: true }),
        },
      });
      expect(res.statusCode).toBe(200);
      const client = await app.prisma.client.findFirst({ where: { email } });
      expect(client?.emailVerifiedAt).not.toBeNull();
    });

    it('does not set emailVerifiedAt when Google does not verify the email', async () => {
      const email = `g-${crypto.randomUUID()}@example.com`;
      await app.inject({
        method: 'POST',
        url: '/auth/google',
        payload: {
          role: 'cliente',
          idToken: googleToken({ sub: `sub-${crypto.randomUUID()}`, email, email_verified: false }),
        },
      });
      const client = await app.prisma.client.findFirst({ where: { email } });
      expect(client?.emailVerifiedAt).toBeNull();
    });

    it('verifies an existing password account on a Google verified login', async () => {
      const existing = await createClient();
      await app.inject({
        method: 'POST',
        url: '/auth/google',
        payload: {
          role: 'cliente',
          idToken: googleToken({ sub: `sub-${crypto.randomUUID()}`, email: existing.email, email_verified: true }),
        },
      });
      const after = await app.prisma.client.findUnique({ where: { id: existing.id } });
      expect(after?.emailVerifiedAt).not.toBeNull();
    });
  });
});
