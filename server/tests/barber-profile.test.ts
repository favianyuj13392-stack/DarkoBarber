import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';

describe('Barber profile: no invented defaults', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  it('returns empty bio, specialties and shop data for a barber that has none', async () => {
    const barber = await app.prisma.barber.create({
      data: {
        phone: `7${Math.floor(1000000 + Math.random() * 8999999)}`,
        displayName: 'Bare Barber',
      },
    });
    const token = app.jwt.sign({ userId: barber.id, barberId: barber.id, role: 'barbero' });
    const res = await app.inject({
      method: 'GET',
      url: '/barbers/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.bio).toBeNull();
    expect(body.specialties).toEqual([]);
    expect(body.shopName).toBeNull();
    expect(body.shopAddress).toBeNull();
    expect(body.shopZone).toBeNull();
  });
});
