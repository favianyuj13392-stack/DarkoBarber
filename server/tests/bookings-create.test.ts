import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { createBookingSchema, isRealCalendarDate, normalizePhone } from '../src/modules/bookings/bookings.schemas';
import { toLaPazDateString } from '../src/utils/la-paz-date';
import { AppError } from '../src/utils/errors';

// 2026-11-13 is a Friday. 14:00Z == 10:00 La Paz.
const NOW = new Date('2026-11-13T14:00:00Z');
// Saturday 10:00 La Paz, used for the advance-days boundary (2026-12-14 is exactly +30 days, a Monday).
const NOW_SAT = new Date('2026-11-14T14:00:00Z');

// Default working hours: Mon-Sat 09:00-20:00, 30 min grid, break 13:00-14:00, Sunday closed.
describe('Bookings: create validation', () => {
  let app: FastifyInstance;
  let service: BookingsService;
  let barberId: string;
  let otherBarberId: string;
  let serviceId: string; // 30 min, 50 Bs
  let longServiceId: string; // 45 min, 80 Bs
  let foreignServiceId: string;
  let inactiveServiceId: string;

  let phoneSeq = 0;
  // Unique 8-digit phone per client (Client.phone is unique).
  const nextPhone = () => `7${String(1_000_000 + phoneSeq++)}`;
  const makeClient = (data: Record<string, unknown> = {}) =>
    app.prisma.client.create({
      data: { email: `c-${crypto.randomUUID()}@example.com`, displayName: 'Real Name', phone: nextPhone(), ...data },
    });

  // Every call uses a fresh client unless one is given, so the active-bookings cap never interferes.
  const create = async (over: Record<string, unknown> = {}, now: Date = NOW) =>
    service.createBooking(
      {
        barberId,
        serviceIds: [serviceId],
        date: '2026-11-14',
        time: '10:00',
        clientId: (over.clientId as string | undefined) ?? (await makeClient()).id,
        ...over,
      } as any,
      now
    );

  const expectError = async (p: Promise<unknown>, code: string, status: number) => {
    const err = await p.then(
      () => null,
      (e) => e
    );
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe(code);
    expect((err as AppError).statusCode).toBe(status);
  };

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barbers } = await seed();
    barberId = barbers[0].id;
    otherBarberId = barbers[1].id;
    service = new BookingsService(app.prisma);
    const mk = (bId: string, data: Partial<{ name: string; priceBs: number; durationMin: number; isActive: boolean }>) =>
      app.prisma.barberService.create({
        data: { barberId: bId, name: 'Svc', priceBs: 50, durationMin: 30, ...data },
      });
    serviceId = (await mk(barberId, { name: 'Corte', priceBs: 50, durationMin: 30 })).id;
    longServiceId = (await mk(barberId, { name: 'Combo', priceBs: 80, durationMin: 45 })).id;
    inactiveServiceId = (await mk(barberId, { name: 'Viejo', isActive: false })).id;
    foreignServiceId = (await mk(otherBarberId, { name: 'Ajeno' })).id;
  });

  beforeEach(async () => {
    await app.prisma.booking.deleteMany({});
    await app.prisma.barber.update({
      where: { id: barberId },
      data: { acceptsBookings: true, bookingNoticeMin: 15, workingHours: Prisma.DbNull },
    });
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  describe('schema helpers', () => {
    it('validates real calendar dates only', () => {
      expect(isRealCalendarDate('2026-11-13')).toBe(true);
      expect(isRealCalendarDate('2028-02-29')).toBe(true);
      expect(isRealCalendarDate('2026-02-29')).toBe(false);
      expect(isRealCalendarDate('2026-02-30')).toBe(false);
      expect(isRealCalendarDate('2026-13-01')).toBe(false);
      expect(isRealCalendarDate('2026-1-1')).toBe(false);
      expect(isRealCalendarDate('tomorrow')).toBe(false);
    });

    it('normalizes Bolivian phones and rejects garbage', () => {
      expect(normalizePhone('71234567')).toBe('+59171234567');
      expect(normalizePhone('+591 7123-4567')).toBe('+59171234567');
      expect(normalizePhone('591 71234567')).toBe('+59171234567');
      expect(normalizePhone('1234')).toBeNull();
      expect(normalizePhone('abc')).toBeNull();
    });

    it('rejects malformed time, date, oversized notes; strips price/duration/identity fields', () => {
      const base = { serviceIds: ['s'], date: '2026-11-14', time: '10:00' };
      expect(createBookingSchema.safeParse(base).success).toBe(true);
      expect(createBookingSchema.safeParse({ ...base, time: '9:00' }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...base, time: '24:00' }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...base, time: '10:60' }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...base, date: '2026-02-30' }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...base, notes: 'x'.repeat(501) }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...base, serviceIds: [] }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...base, serviceIds: [''] }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...base, serviceIds: 'a' }).success).toBe(false);
      const stripped = createBookingSchema.parse({
        ...base,
        clientName: 'Someone',
        clientPhone: '71234567',
        servicePriceBs: 1,
        durationMin: 1,
        clientId: 'someone-else',
        status: 'CONFIRMED',
      });
      expect(stripped).toEqual(base);
    });
  });

  describe('happy path and ownership of price/duration', () => {
    it('creates a PENDING booking taking name, price and duration from the barber service', async () => {
      const b = await create({ serviceIds: [longServiceId] });
      expect(b.status).toBe('PENDING');
      expect(b.serviceName).toBe('Combo');
      expect(b.servicePriceBs).toBe(80);
      expect(b.durationMin).toBe(45);
      expect(b.clientId).toBeTruthy();
      expect(b.clientName).toBe('Real Name');
      expect(b.clientPhone).toMatch(/^\+5917\d{7}$/);
      // 10:00 La Paz == 14:00 UTC
      expect(b.scheduledAt.toISOString()).toBe('2026-11-14T14:00:00.000Z');
    });

    it('works right after midnight La Paz: 20:30 La Paz (00:30Z next day) books tomorrow 09:00', async () => {
      const b = await create({ date: '2026-11-13', time: '09:00' }, new Date('2026-11-13T00:30:00Z'));
      expect(b.date).toBe('2026-11-13');
    });

    it('allows a booking that ends exactly at closing time and one that ends exactly at the break', async () => {
      await expect(create({ time: '19:30' })).resolves.toBeTruthy(); // 19:30 + 30 = 20:00
      await expect(create({ time: '12:30' })).resolves.toBeTruthy(); // ends 13:00 = break start
    });
  });

  describe('time rules (La Paz wall clock, injectable now)', () => {
    it('rejects the past and the current minute', async () => {
      await expectError(create({ date: '2026-11-13', time: '09:30' }), 'BOOKING_IN_PAST', 400);
      await expectError(create({ date: '2026-11-13', time: '10:00' }), 'BOOKING_IN_PAST', 400);
      await expectError(create({ date: '2026-11-12', time: '10:00' }), 'BOOKING_IN_PAST', 400);
    });

    it('uses La Paz, not UTC, for "today": at 20:30 La Paz the UTC date is already tomorrow', async () => {
      const lateNow = new Date('2026-11-13T00:30:00Z'); // Thu 2026-11-12 20:30 La Paz
      await expectError(create({ date: '2026-11-12', time: '09:00' }, lateNow), 'BOOKING_IN_PAST', 400);
    });

    it('applies the barber bookingNoticeMin', async () => {
      await app.prisma.barber.update({ where: { id: barberId }, data: { bookingNoticeMin: 60 } });
      await expectError(create({ date: '2026-11-13', time: '10:30' }), 'BOOKING_TOO_SOON', 400);
      await expect(create({ date: '2026-11-13', time: '11:00' })).resolves.toBeTruthy(); // exactly now + 60
    });

    it('limits the advance window to BOOKING_MAX_ADVANCE_DAYS (default 30)', async () => {
      await expect(create({ date: '2026-12-14', time: '10:00' }, NOW_SAT)).resolves.toBeTruthy(); // +30
      await expectError(create({ date: '2026-12-15', time: '10:00' }, NOW_SAT), 'BOOKING_TOO_FAR', 400);
    });

    it('honors BOOKING_MAX_ADVANCE_DAYS from the environment', async () => {
      process.env.BOOKING_MAX_ADVANCE_DAYS = '2';
      try {
        await expect(create({ date: '2026-11-16', time: '10:00' }, NOW_SAT)).resolves.toBeTruthy(); // +2
        await expectError(create({ date: '2026-11-17', time: '10:00' }, NOW_SAT), 'BOOKING_TOO_FAR', 400); // +3
      } finally {
        delete process.env.BOOKING_MAX_ADVANCE_DAYS;
      }
    });
  });

  describe('working hours', () => {
    it('rejects a rest day (Sunday)', async () => {
      await expectError(create({ date: '2026-11-15', time: '10:00' }), 'BARBER_NOT_WORKING', 409);
    });

    it('rejects before opening and when the duration does not fit before closing', async () => {
      await expectError(create({ time: '08:30' }), 'OUTSIDE_WORKING_HOURS', 409);
      await expectError(create({ time: '19:30', serviceIds: [longServiceId] }), 'OUTSIDE_WORKING_HOURS', 409);
      await expectError(create({ time: '20:00' }), 'OUTSIDE_WORKING_HOURS', 409);
    });

    it('rejects bookings overlapping the break', async () => {
      await expectError(create({ time: '13:00' }), 'OUTSIDE_WORKING_HOURS', 409);
      await expectError(create({ time: '12:30', serviceIds: [longServiceId] }), 'OUTSIDE_WORKING_HOURS', 409);
      await expect(create({ time: '14:00' })).resolves.toBeTruthy(); // starts exactly at break end
    });

    it('uses custom working hours when configured', async () => {
      const days = Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i,
        dayName: `d${i}`,
        enabled: true,
        openTime: '15:00',
        closeTime: '18:00',
        hasBreak: false,
      }));
      await app.prisma.barber.update({
        where: { id: barberId },
        data: { workingHours: { days, slotIntervalMin: 60 } },
      });
      await expectError(create({ time: '10:00' }), 'OUTSIDE_WORKING_HOURS', 409);
      await expect(create({ time: '16:00', date: '2026-11-15' })).resolves.toBeTruthy(); // Sunday enabled here
    });
  });

  describe('barber and service checks', () => {
    it('404 when the barber does not exist', async () => {
      await expectError(create({ barberId: crypto.randomUUID() }), 'BARBER_NOT_FOUND', 404);
    });

    it('409 when the barber has bookings switched off', async () => {
      await app.prisma.barber.update({ where: { id: barberId }, data: { acceptsBookings: false } });
      await expectError(create(), 'BOOKINGS_DISABLED', 409);
    });

    it('404 for unknown, foreign and inactive services', async () => {
      await expectError(create({ serviceIds: [crypto.randomUUID()] }), 'SERVICE_NOT_FOUND', 404);
      await expectError(create({ serviceIds: [foreignServiceId] }), 'SERVICE_NOT_FOUND', 404);
      await expectError(create({ serviceIds: [inactiveServiceId] }), 'SERVICE_NOT_FOUND', 404);
    });
  });

  describe('multiple services per booking', () => {
    let thirdServiceId: string; // 20 min, 30 Bs
    const extra: string[] = [];
    beforeAll(async () => {
      thirdServiceId = (
        await app.prisma.barberService.create({
          data: { barberId, name: 'Barba', priceBs: 30, durationMin: 20 },
        })
      ).id;
      for (let i = 0; i < 4; i++) {
        extra.push(
          (await app.prisma.barberService.create({ data: { barberId, name: `Extra${i}`, priceBs: 10, durationMin: 5 } })).id
        );
      }
    });

    it('sums price and duration and joins names, computed server-side', async () => {
      const b = await create({ serviceIds: [serviceId, thirdServiceId, longServiceId] });
      expect(b.serviceName).toBe('Corte + Barba + Combo');
      expect(b.servicePriceBs).toBe(50 + 30 + 80);
      expect(b.durationMin).toBe(30 + 20 + 45);
    });

    it('is one booking row (one cut) regardless of the number of services', async () => {
      await create({ serviceIds: [serviceId, thirdServiceId] });
      expect(await app.prisma.booking.count({ where: { barberId } })).toBe(1);
    });

    it('dedupes repeated ids at the schema level and in the service', async () => {
      const parsed = createBookingSchema.parse({
        serviceIds: ['a', 'b', 'a'],
        date: '2026-11-14',
        time: '10:00',
      });
      expect(parsed.serviceIds).toEqual(['a', 'b']);
      const b = await create({ serviceIds: [serviceId, serviceId] });
      expect(b.serviceName).toBe('Corte');
      expect(b.servicePriceBs).toBe(50);
      expect(b.durationMin).toBe(30);
    });

    it('accepts exactly 5 services and rejects 6 and empty lists at the schema', () => {
      const base = { date: '2026-11-14', time: '10:00' };
      const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);
      expect(createBookingSchema.safeParse({ ...base, serviceIds: ids(5) }).success).toBe(true);
      expect(createBookingSchema.safeParse({ ...base, serviceIds: ids(6) }).success).toBe(false);
      expect(createBookingSchema.safeParse({ ...base, serviceIds: [] }).success).toBe(false);
    });

    it('rejects the whole booking if any service is inactive, foreign or unknown', async () => {
      await expectError(create({ serviceIds: [serviceId, inactiveServiceId] }), 'SERVICE_NOT_FOUND', 404);
      await expectError(create({ serviceIds: [serviceId, foreignServiceId] }), 'SERVICE_NOT_FOUND', 404);
      await expectError(create({ serviceIds: [serviceId, crypto.randomUUID()] }), 'SERVICE_NOT_FOUND', 404);
      expect(await app.prisma.booking.count({ where: { barberId } })).toBe(0);
    });

    it('over HTTP: 6 services and the legacy single serviceId answer 400', async () => {
      const token = app.jwt.sign({ userId: (await makeClient()).id, role: 'cliente', deviceId: 'web-client' });
      const send = (serviceIds: string[]) =>
        app.inject({
          method: 'POST',
          url: `/barbers/${barberId}/bookings`,
          headers: { authorization: `Bearer ${token}` },
          payload: {
            serviceIds,
            date: toLaPazDateString(new Date(Date.now() + 3 * 86_400_000)),
            time: '10:00',
          },
        });
      const six = await send([serviceId, thirdServiceId, longServiceId, ...extra.slice(0, 3)]);
      expect(six.statusCode).toBe(400);
      expect(JSON.parse(six.body).error).toBe('VALIDATION_ERROR');
      const legacy = await app.inject({
        method: 'POST',
        url: `/barbers/${barberId}/bookings`,
        headers: { authorization: `Bearer ${token}` },
        payload: { serviceId, date: '2026-11-14', time: '10:00' },
      });
      expect(legacy.statusCode).toBe(400);
    });

    it('the total duration must fit before closing and avoid the break', async () => {
      // 30 + 20 + 45 = 95 min
      await expectError(create({ time: '19:00', serviceIds: [serviceId, thirdServiceId, longServiceId] }), 'OUTSIDE_WORKING_HOURS', 409);
      await expectError(create({ time: '12:00', serviceIds: [serviceId, thirdServiceId, longServiceId] }), 'OUTSIDE_WORKING_HOURS', 409);
      await expect(create({ time: '09:00', serviceIds: [serviceId, thirdServiceId, longServiceId] })).resolves.toBeTruthy();
    });
  });

  describe('authentication and identity', () => {
    const clientToken = (id: string) => app.jwt.sign({ userId: id, role: 'cliente', deviceId: 'web-client' });
    const futureDate = () => {
      let date = toLaPazDateString(new Date(Date.now() + 3 * 86_400_000));
      if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) {
        date = toLaPazDateString(new Date(Date.now() + 4 * 86_400_000));
      }
      return date;
    };
    const post = (payload: Record<string, unknown>, headers: Record<string, string> = {}) =>
      app.inject({
        method: 'POST',
        url: `/barbers/${barberId}/bookings`,
        headers,
        payload: { serviceIds: [serviceId], date: futureDate(), time: '10:00', ...payload },
      });

    it('rejects anonymous requests with 401 and creates nothing', async () => {
      const res = await post({ clientName: 'Visitante', clientPhone: '71234567' });
      expect(res.statusCode).toBe(401);
      expect(await app.prisma.booking.count()).toBe(0);
    });

    it('rejects garbage tokens with 401', async () => {
      const res = await post({}, { authorization: 'Bearer nope' });
      expect(res.statusCode).toBe(401);
    });

    it('rejects a barber token with 403', async () => {
      const barberToken = app.jwt.sign({ userId: barberId, barberId, role: 'barbero' });
      const res = await post({}, { authorization: `Bearer ${barberToken}` });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).error).toBe('FORBIDDEN');
      expect(await app.prisma.booking.count()).toBe(0);
    });

    it('a signed-in client books with name and phone taken from the profile', async () => {
      const me = await makeClient();
      const res = await post({}, { authorization: `Bearer ${clientToken(me.id)}` });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.clientId).toBe(me.id);
      expect(body.clientName).toBe('Real Name');
      expect(body.clientPhone).toBe(`+591${me.phone}`);
      expect(body.status).toBe('PENDING');
    });

    it('ignores identity, price, duration and status sent in the body', async () => {
      const me = await makeClient();
      const victim = await makeClient({ displayName: 'Victim' });
      const res = await post(
        {
          clientName: 'Fake Name',
          clientPhone: '60000000',
          clientId: victim.id,
          servicePriceBs: 1,
          durationMin: 5,
          serviceName: 'Hacked',
          status: 'CONFIRMED',
        },
        { authorization: `Bearer ${clientToken(me.id)}` }
      );
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.clientId).toBe(me.id);
      expect(body.clientName).toBe('Real Name');
      expect(body.clientPhone).toBe(`+591${me.phone}`);
      expect(body.servicePriceBs).toBe(50);
      expect(body.durationMin).toBe(30);
      expect(body.serviceName).toBe('Corte');
      expect(body.status).toBe('PENDING');
    });

    it('409 PROFILE_INCOMPLETE when the client profile has no name or phone', async () => {
      const noPhone = await makeClient({ phone: null });
      const noName = await makeClient({ displayName: null });
      for (const c of [noPhone, noName]) {
        const res = await post({ clientName: 'Given', clientPhone: '71234567' }, { authorization: `Bearer ${clientToken(c.id)}` });
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toBe('PROFILE_INCOMPLETE');
      }
      expect(await app.prisma.booking.count()).toBe(0);
    });

    it('maps validation and business errors to {error, message}', async () => {
      const auth = { authorization: `Bearer ${clientToken((await makeClient()).id)}` };
      const bad = await post({ date: '2026-02-30' }, auth);
      expect(bad.statusCode).toBe(400);
      expect(JSON.parse(bad.body).error).toBe('VALIDATION_ERROR');

      const missingService = await post({ serviceIds: [crypto.randomUUID()] }, auth);
      expect(missingService.statusCode).toBe(404);
      const parsed = JSON.parse(missingService.body);
      expect(parsed.error).toBe('SERVICE_NOT_FOUND');
      expect(typeof parsed.message).toBe('string');
    });
  });
});
