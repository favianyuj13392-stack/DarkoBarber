import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

describe('Request body limits', () => {
  let app: FastifyInstance;
  const saved: Record<string, string | undefined> = {};
  const keys = ['BODY_LIMIT_BYTES', 'UPLOAD_BODY_LIMIT_BYTES'];

  beforeAll(async () => {
    for (const k of keys) saved[k] = process.env[k];
    process.env.BODY_LIMIT_BYTES = '2048';
    process.env.UPLOAD_BODY_LIMIT_BYTES = '65536';
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

  const big = (bytes: number) => JSON.stringify({ identifier: 'x', secret: 'y'.repeat(bytes) });

  it('rejects oversized bodies on regular routes with 413', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: big(5000),
    });
    expect(res.statusCode).toBe(413);
  });

  it('still accepts small bodies on regular routes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: big(10),
    });
    expect(res.statusCode).not.toBe(413);
  });

  it('allows the larger upload limit on portfolio and profile routes (reaches auth, not 413)', async () => {
    const photo = JSON.stringify({ photoUrl: 'data:image/jpeg;base64,' + 'A'.repeat(5000) });
    for (const [method, url] of [
      ['POST', '/barbers/me/portfolio'],
      ['DELETE', '/barbers/me/portfolio'],
      ['PUT', '/barbers/me'],
      ['PUT', '/auth/barber/profile'],
      ['POST', '/api/barbers/me/portfolio'],
    ] as const) {
      const res = await app.inject({
        method,
        url,
        headers: { 'content-type': 'application/json' },
        payload: photo,
      });
      expect(res.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('still caps upload routes at the upload limit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/barbers/me/portfolio',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ photoUrl: 'A'.repeat(70000) }),
    });
    expect(res.statusCode).toBe(413);
  });
});
