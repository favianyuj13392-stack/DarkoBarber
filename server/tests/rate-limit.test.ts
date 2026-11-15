import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

describe('Rate limiting', () => {
  let app: FastifyInstance;
  const saved: Record<string, string | undefined> = {};
  const keys = ['RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW_MS', 'AUTH_RATE_LIMIT_MAX', 'TRUST_PROXY'];

  beforeAll(async () => {
    for (const k of keys) saved[k] = process.env[k];
    process.env.RATE_LIMIT_MAX = '8';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.AUTH_RATE_LIMIT_MAX = '3';
    delete process.env.TRUST_PROXY;
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const login = (url: string, ip?: string) =>
    app.inject({
      method: 'POST',
      url,
      remoteAddress: ip,
      payload: { identifier: 'nobody', secret: '0000', type: 'pin', deviceId: 'd' },
    });

  it('returns 429 on auth endpoints beyond the limit, with Retry-After', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await login('/auth/login', '10.0.0.1');
      expect(res.statusCode).not.toBe(429);
    }
    const blocked = await login('/auth/login', '10.0.0.1');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.json().error).toBe('RATE_LIMITED');
  });

  it('shares the bucket between /auth/x and /api/auth/x', async () => {
    for (let i = 0; i < 3; i++) await login('/auth/login', '10.0.0.2');
    const res = await login('/api/auth/login', '10.0.0.2');
    expect(res.statusCode).toBe(429);
  });

  it('limits other auth endpoints independently per IP', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        remoteAddress: '10.0.0.3',
        payload: { email: 'nobody@example.com' },
      });
      expect(res.statusCode).not.toBe(429);
    }
    const blocked = await app.inject({
      method: 'POST',
      url: '/auth/forgot-password',
      remoteAddress: '10.0.0.3',
      payload: { email: 'nobody@example.com' },
    });
    expect(blocked.statusCode).toBe(429);

    // A different IP is unaffected.
    const other = await login('/auth/login', '10.0.0.4');
    expect(other.statusCode).not.toBe(429);
  });

  it('does not trust X-Forwarded-For unless TRUST_PROXY is configured', async () => {
    for (let i = 0; i < 3; i++) await login('/auth/register', '10.0.0.5');
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      remoteAddress: '10.0.0.5',
      headers: { 'x-forwarded-for': '203.0.113.99' },
      payload: {},
    });
    expect(res.statusCode).toBe(429);
  });

  it('applies the generous global limit to other routes and exempts /health', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({ method: 'GET', url: '/health', remoteAddress: '10.0.0.6' });
      expect(res.statusCode).toBe(200);
    }
    let last = 200;
    for (let i = 0; i < 10; i++) {
      const res = await app.inject({ method: 'GET', url: '/shops', remoteAddress: '10.0.0.7' });
      last = res.statusCode;
    }
    expect(last).toBe(429);
  });
});
