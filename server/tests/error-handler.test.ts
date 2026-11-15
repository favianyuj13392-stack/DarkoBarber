import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildApp } from '../src/app';
import { ConflictError, AppError } from '../src/utils/errors';

describe('Global error handler', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    // Routes registered after buildApp inherit the root error handler.
    app.get('/__test/boom', async () => {
      const e = new Error('connection to db at 10.0.0.5 failed: password=hunter2');
      e.stack = 'Error: secret stack frames';
      throw e;
    });
    app.get('/__test/prisma', async () => {
      const e: any = new Error('Invalid `prisma.user.findMany()` invocation: column "x" does not exist');
      e.code = 'P2022';
      throw e;
    });
    app.get('/__test/app-error', async () => {
      throw new ConflictError('SLOT_TAKEN', 'Slot already taken');
    });
    app.get('/__test/custom-app-error', async () => {
      throw new AppError('TEAPOT', 'short and stout', 418);
    });
    app.get('/__test/zod', async () => {
      z.object({ a: z.string() }).parse({});
    });
    app.post('/__test/echo', async (req) => req.body);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers unknown errors with a generic 500 and no internals', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/boom' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('Internal server error');
    expect(body.requestId).toBeTruthy();
    expect(res.body).not.toContain('hunter2');
    expect(res.body).not.toContain('stack');
    expect(res.body).not.toContain('10.0.0.5');
  });

  it('does not leak Prisma messages', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/prisma' });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('prisma');
    expect(res.body).not.toContain('P2022');
  });

  it('maps AppError classes to their status and code', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/app-error' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: 'SLOT_TAKEN', message: 'Slot already taken' });

    const custom = await app.inject({ method: 'GET', url: '/__test/custom-app-error' });
    expect(custom.statusCode).toBe(418);
    expect(custom.json()).toEqual({ error: 'TEAPOT', message: 'short and stout' });
  });

  it('maps thrown Zod errors to 400 VALIDATION_ERROR', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/zod' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.issues.a._errors.length).toBeGreaterThan(0);
  });

  it('keeps 4xx framework errors (invalid JSON) as client errors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/__test/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().statusCode).toBe(400);
  });

  it('returns a consistent JSON 404 for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope/nothing' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'NOT_FOUND', message: 'Route not found' });
  });
});
