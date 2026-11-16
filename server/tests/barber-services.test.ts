import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { cleanDatabase } from './helpers';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { AppError } from '../src/utils/errors';

describe('Barber services', () => {
  let app: FastifyInstance;

  const createBarber = () =>
    app.prisma.barber.create({
      data: {
        phone: `7${Math.floor(1000000 + Math.random() * 8999999)}`,
        displayName: 'Service Barber',
      },
    });
  const barberToken = (id: string) => app.jwt.sign({ userId: id, barberId: id, role: 'barbero' });
  const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  it('returns an empty list for a new barber and does not write any rows on read', async () => {
    const barber = await createBarber();
    const res = await app.inject({
      method: 'GET',
      url: '/barbers/me/services',
      headers: bearer(barberToken(barber.id)),
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([]);
    expect(await app.prisma.barberService.count({ where: { barberId: barber.id } })).toBe(0);

    // A second read stays empty: nothing was seeded behind the first one.
    const again = await app.inject({
      method: 'GET',
      url: '/barbers/me/services',
      headers: bearer(barberToken(barber.id)),
    });
    expect(JSON.parse(again.body)).toEqual([]);
  });

  it('lists only the services the barber created explicitly', async () => {
    const barber = await createBarber();
    const headers = bearer(barberToken(barber.id));
    const created = await app.inject({
      method: 'POST',
      url: '/barbers/me/services',
      headers,
      payload: { name: 'Corte', priceBs: 50, durationMin: 30 },
    });
    expect(created.statusCode).toBeLessThan(300);
    const list = JSON.parse(
      (await app.inject({ method: 'GET', url: '/barbers/me/services', headers })).body
    );
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Corte');
  });

  it('still rejects a booking for a barber without services (SERVICE_NOT_FOUND)', async () => {
    const barber = await createBarber();
    const client = await app.prisma.client.create({
      data: { email: `c-${crypto.randomUUID()}@example.com`, displayName: 'Real Name', phone: '71234567' },
    });
    const bookings = new BookingsService(app.prisma);
    const err = await bookings
      .createBooking(
        {
          barberId: barber.id,
          serviceIds: ['does-not-exist'],
          date: '2026-11-14',
          time: '10:00',
          clientId: client.id,
        } as any,
        new Date('2026-11-13T14:00:00Z')
      )
      .then(
        () => null,
        (e) => e
      );
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('SERVICE_NOT_FOUND');
    expect((err as AppError).statusCode).toBe(404);
  });
});
