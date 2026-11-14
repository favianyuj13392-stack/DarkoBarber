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

  const create = (over: Record<string, unknown> = {}, now: Date = NOW) =>
    service.createBooking(
      {
        barberId,
        serviceIds: [serviceId],
        date: '2026-11-14',
        time: '10:00',
        clientName: 'Anon Client',
        clientPhone: '71234567',
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

    it('rejects malformed time, date, oversized notes; strips price/duration/clientId', () => {
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
      expect(createBookingSchema.safeParse({ ...base, clientPhone: '12' }).success).toBe(false);
      const stripped = createBookingSchema.parse({
        ...base,
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
      expect(b.clientId).toBeNull();
      expect(b.clientPhone).toBe('+59171234567');
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
      const send = (serviceIds: string[]) =>
        app.inject({
          method: 'POST',
          url: `/barbers/${barberId}/bookings`,
          payload: {
            serviceIds,
            date: toLaPazDateString(new Date(Date.now() + 3 * 86_400_000)),
            time: '10:00',
            clientName: 'Multi Client',
            clientPhone: '71234567',
          },
        });
      const six = await send([serviceId, thirdServiceId, longServiceId, ...extra.slice(0, 3)]);
      expect(six.statusCode).toBe(400);
      expect(JSON.parse(six.body).error).toBe('VALIDATION_ERROR');
      const legacy = await app.inject({
        method: 'POST',
        url: `/barbers/${barberId}/bookings`,
        payload: { serviceId, date: '2026-11-14', time: '10:00', clientName: 'Old Client', clientPhone: '71234567' },
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

  describe('identity', () => {
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
    let phoneSeq = 0;
    // Unique 8-digit phone per client (Client.phone is unique).
    const nextPhone = () => `7${String(1_000_000 + phoneSeq++)}`;
    const makeClient = (data: Record<string, unknown> = {}) =>
      app.prisma.client.create({
        data: { email: `c-${crypto.randomUUID()}@example.com`, displayName: 'Real Name', phone: nextPhone(), ...data },
      });

    it('anonymous requests require name and phone', async () => {
      const res = await post({});
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('CONTACT_REQUIRED');

      const noPhone = await post({ clientName: 'Solo Nombre' });
      expect(JSON.parse(noPhone.body).error).toBe('CONTACT_REQUIRED');
    });

    it('anonymous request with valid contact data succeeds and stores no clientId', async () => {
      const res = await post({ clientName: 'Visitante', clientPhone: '+591 7123 4567' });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.clientId).toBeNull();
      expect(body.clientName).toBe('Visitante');
      expect(body.clientPhone).toBe('+59171234567');
    });

    it('maps validation and business errors to {error, message}', async () => {
      const bad = await post({ date: '2026-02-30', clientName: 'X Y', clientPhone: '71234567' });
      expect(bad.statusCode).toBe(400);
      expect(JSON.parse(bad.body).error).toBe('VALIDATION_ERROR');

      const badPhone = await post({ clientName: 'X Y', clientPhone: '12' });
      expect(badPhone.statusCode).toBe(400);

      const missingService = await post({ serviceIds: [crypto.randomUUID()], clientName: 'X Y', clientPhone: '71234567' });
      expect(missingService.statusCode).toBe(404);
      const parsed = JSON.parse(missingService.body);
      expect(parsed.error).toBe('SERVICE_NOT_FOUND');
      expect(typeof parsed.message).toBe('string');
    });

    it('ignores price, duration, status and clientId sent in the body', async () => {
      const victim = await makeClient({ displayName: 'Victim' });
      const res = await post({
        clientName: 'Visitante',
        clientPhone: '71234567',
        servicePriceBs: 1,
        durationMin: 5,
        serviceName: 'Hacked',
        status: 'CONFIRMED',
        clientId: victim.id,
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.servicePriceBs).toBe(50);
      expect(body.durationMin).toBe(30);
      expect(body.serviceName).toBe('Corte');
      expect(body.status).toBe('PENDING');
      expect(body.clientId).toBeNull();
    });

    it('an authenticated client takes identity from the profile and ignores body contact data and clientId', async () => {
      const me = await makeClient();
      const other = await makeClient({ displayName: 'Other' });
      const res = await post(
        { clientName: 'Fake Name', clientPhone: '60000000', clientId: other.id },
        { authorization: `Bearer ${clientToken(me.id)}` }
      );
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.clientId).toBe(me.id);
      expect(body.clientName).toBe('Real Name');
      expect(body.clientPhone).toBe(`+591${me.phone}`);
    });

    it('an authenticated client without phone/name in the profile must provide them', async () => {
      const bare = await makeClient({ displayName: null, phone: null });
      const missing = await post({}, { authorization: `Bearer ${clientToken(bare.id)}` });
      expect(missing.statusCode).toBe(400);
      expect(JSON.parse(missing.body).error).toBe('CONTACT_REQUIRED');

      const ok = await post(
        { clientName: 'Nombre Dado', clientPhone: '71234567' },
        { authorization: `Bearer ${clientToken(bare.id)}` }
      );
      expect(ok.statusCode).toBe(201);
      expect(JSON.parse(ok.body).clientId).toBe(bare.id);
    });

    it('a barber token or garbage token is treated as anonymous', async () => {
      const barberToken = app.jwt.sign({ userId: barberId, barberId, role: 'barbero' });
      const asBarber = await post(
        { clientName: 'Visitante', clientPhone: '71234567', time: '10:30' },
        { authorization: `Bearer ${barberToken}` }
      );
      expect(asBarber.statusCode).toBe(201);
      expect(JSON.parse(asBarber.body).clientId).toBeNull();

      const garbage = await post(
        { clientName: 'Visitante', clientPhone: '71234567', time: '11:00' },
        { authorization: 'Bearer nope' }
      );
      expect(garbage.statusCode).toBe(201);
    });
  });
});
