import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { toLaPazDateString } from '../src/utils/la-paz-date';
import { AppError } from '../src/utils/errors';

// Friday 2026-11-13 10:00 La Paz.
const NOW = new Date('2026-11-13T14:00:00Z');
const DAY = '2026-11-14'; // Saturday, regular working day (09:00-20:00, break 13:00-14:00)

describe('Bookings: overlap, availability and concurrency', () => {
  let app: FastifyInstance;
  let service: BookingsService;
  let barberId: string;
  let otherBarberId: string;
  let shortId: string; // 30 min
  let longId: string; // 45 min
  let phoneSeq = 0;

  const nextPhone = () => `6${String(1_000_000 + phoneSeq++)}`;
  const makeClient = (data: Record<string, unknown> = {}) =>
    app.prisma.client.create({
      data: { email: `o-${crypto.randomUUID()}@example.com`, displayName: 'Client', phone: nextPhone(), ...data },
    });

  // A fresh client per call unless one is given, so the active-bookings cap does not interfere.
  const book = async (over: Record<string, unknown> = {}, now: Date = NOW) =>
    service.createBooking(
      {
        barberId,
        serviceIds: [shortId],
        date: DAY,
        time: '10:00',
        clientId: (over.clientId as string | undefined) ?? (await makeClient()).id,
        ...over,
      } as any,
      now
    );

  const errorOf = async (p: Promise<unknown>) => {
    const err = await p.then(
      () => null,
      (e) => e
    );
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  };

  const insertBooking = (data: Record<string, unknown>) =>
    app.prisma.booking.create({
      data: {
        barberId,
        clientName: 'Direct',
        clientPhone: '+59160000000',
        serviceName: 'Corte',
        servicePriceBs: 50,
        durationMin: 30,
        date: DAY,
        time: '10:00',
        ...data,
      } as any,
    });

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barbers } = await seed();
    barberId = barbers[0].id;
    otherBarberId = barbers[1].id;
    service = new BookingsService(app.prisma);
    const mk = (bId: string, durationMin: number) =>
      app.prisma.barberService.create({ data: { barberId: bId, name: `S${durationMin}`, priceBs: 50, durationMin } });
    shortId = (await mk(barberId, 30)).id;
    longId = (await mk(barberId, 45)).id;
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

  describe('overlap rule', () => {
    it('rejects the exact same start', async () => {
      await book();
      expect((await errorOf(book())).code).toBe('SLOT_TAKEN');
      expect((await errorOf(book())).statusCode).toBe(409);
    });

    it('rejects partial overlaps in both directions', async () => {
      await book({ serviceIds: [longId] }); // 10:00-10:45
      expect((await errorOf(book({ time: '10:30' }))).code).toBe('SLOT_TAKEN'); // starts inside
      expect((await errorOf(book({ time: '09:30', serviceIds: [longId] }))).code).toBe('SLOT_TAKEN'); // ends inside (10:15)
    });

    it('rejects a booking that fully contains an existing one', async () => {
      await book({ time: '10:30' }); // 10:30-11:00
      expect((await errorOf(book({ time: '10:00', serviceIds: [longId] }))).code).toBe('SLOT_TAKEN'); // 10:00-10:45
    });

    it('uses the summed duration of several services for the overlap check', async () => {
      await book({ serviceIds: [shortId, longId] }); // 10:00-11:15 (30 + 45)
      expect((await errorOf(book({ time: '11:00' }))).code).toBe('SLOT_TAKEN'); // inside the second half
      expect((await errorOf(book({ time: '09:30', serviceIds: [shortId, shortId, longId] }))).code).toBe('SLOT_TAKEN');
      await expect(book({ time: '11:30' })).resolves.toBeTruthy(); // after 11:15
    });

    it('allows adjacent bookings (end == next start) on both sides', async () => {
      await book({ time: '10:00' }); // 10:00-10:30
      await expect(book({ time: '10:30' })).resolves.toBeTruthy(); // starts exactly at the end
      await expect(book({ time: '09:30' })).resolves.toBeTruthy(); // ends exactly at the start
    });

    it('does not let CANCELLED or COMPLETED bookings block a slot', async () => {
      await insertBooking({ time: '10:00', status: 'CANCELLED', clientPhone: nextPhone() });
      await insertBooking({ time: '10:00', status: 'COMPLETED', clientPhone: nextPhone() });
      await expect(book({ time: '10:00' })).resolves.toBeTruthy();
    });

    it('is per barber: the same slot with another barber is fine', async () => {
      await book();
      const svc = await app.prisma.barberService.create({
        data: { barberId: otherBarberId, name: 'Otro', priceBs: 40, durationMin: 30 },
      });
      await expect(book({ barberId: otherBarberId, serviceIds: [svc.id] })).resolves.toBeTruthy();
    });
  });

  describe('availability', () => {
    const slotMap = (r: any) => Object.fromEntries(r.allSlots.map((s: any) => [s.time, s.available]));

    it('uses the real duration of existing bookings, not only their start time', async () => {
      await book({ serviceIds: [longId] }); // 10:00-10:45
      const r = await service.getBarberAvailability(barberId, DAY, NOW);
      const slots = slotMap(r);
      expect(slots['09:30']).toBe(true);
      expect(slots['10:00']).toBe(false);
      expect(slots['10:30']).toBe(false); // overlaps 10:30-10:45
      expect(slots['11:00']).toBe(true);
      expect(r.availableSlots).not.toContain('10:30');
    });

    it('sizes slots to the requested service duration', async () => {
      await book({ time: '10:00' }); // 10:00-10:30
      const r = await service.getBarberAvailability(barberId, DAY, NOW, { serviceIds: [longId] });
      const slots = slotMap(r);
      expect(slots['09:00']).toBe(true); // 09:00-09:45
      expect(slots['09:30']).toBe(false); // 09:30-10:15 hits the booking
      expect(slots['10:30']).toBe(true);
      expect(slots['12:30']).toBe(false); // 12:30-13:15 overlaps the break
      expect(slots['19:30']).toBe(false); // would end after closing
      expect(slots['19:00']).toBe(true); // 19:00-19:45
    });

    it('sizes slots to the summed duration of several services', async () => {
      const r = await service.getBarberAvailability(barberId, DAY, NOW, { serviceIds: [shortId, longId] }); // 75 min
      const slots = slotMap(r);
      expect(slots['11:00']).toBe(true); // 11:00-12:15
      expect(slots['12:00']).toBe(false); // 12:00-13:15 hits the break
      expect(slots['18:30']).toBe(true); // 18:30-19:45
      expect(slots['19:00']).toBe(false); // 19:00-20:15 passes closing
    });

    it('rejects unknown, inactive and foreign service ids like booking creation', async () => {
      const inactive = await app.prisma.barberService.create({
        data: { barberId, name: 'Old', priceBs: 10, durationMin: 20, isActive: false },
      });
      const foreign = await app.prisma.barberService.create({
        data: { barberId: otherBarberId, name: 'Other', priceBs: 10, durationMin: 20 },
      });
      for (const id of [crypto.randomUUID(), inactive.id, foreign.id]) {
        const err = await errorOf(service.getBarberAvailability(barberId, DAY, NOW, { serviceIds: [id] }));
        expect(err.code).toBe('SERVICE_NOT_FOUND');
        expect(err.statusCode).toBe(404);
      }
      // One bad id among valid ones is still rejected.
      const mixed = await errorOf(
        service.getBarberAvailability(barberId, DAY, NOW, { serviceIds: [shortId, crypto.randomUUID()] })
      );
      expect(mixed.code).toBe('SERVICE_NOT_FOUND');
    });

    it('keeps the default grid when no serviceIds are sent', async () => {
      const r = await service.getBarberAvailability(barberId, DAY, NOW, { serviceIds: [] });
      expect(r.isWorkingDay).toBe(true);
      expect(r.availableSlots.length).toBeGreaterThan(0);
    });

    it('marks past and inside-notice slots as unavailable for today', async () => {
      await app.prisma.barber.update({ where: { id: barberId }, data: { bookingNoticeMin: 60 } });
      // NOW is Friday 10:00 La Paz; notice 60 min -> first bookable start is 11:00.
      const r = await service.getBarberAvailability(barberId, '2026-11-13', NOW);
      const slots = slotMap(r);
      expect(slots['09:30']).toBe(false);
      expect(slots['10:00']).toBe(false);
      expect(slots['10:30']).toBe(false);
      expect(slots['11:00']).toBe(true);
    });

    it('marks everything unavailable beyond the advance window', async () => {
      const r = await service.getBarberAvailability(barberId, '2027-03-01', NOW);
      expect(r.availableSlots).toEqual([]);
      expect(r.allSlots.length).toBeGreaterThan(0);
    });

    it('rejects a malformed date with INVALID_DATE', async () => {
      expect((await errorOf(service.getBarberAvailability(barberId, '2026-02-30', NOW))).code).toBe('INVALID_DATE');
      expect((await errorOf(service.getBarberAvailability(barberId, 'tomorrow', NOW))).statusCode).toBe(400);
    });
  });

  describe('per-client active bookings cap (default 3)', () => {
    it('caps by clientId across barbers', async () => {
      const client = await makeClient({ displayName: 'Capped' });
      const other = await app.prisma.barberService.create({
        data: { barberId: otherBarberId, name: 'X', priceBs: 40, durationMin: 30 },
      });
      await book({ clientId: client.id, time: '10:00' });
      await book({ clientId: client.id, time: '11:00' });
      await book({ clientId: client.id, barberId: otherBarberId, serviceIds: [other.id], time: '10:00' });
      const err = await errorOf(book({ clientId: client.id, time: '15:00' }));
      expect(err.code).toBe('TOO_MANY_ACTIVE_BOOKINGS');
      expect(err.statusCode).toBe(409);
      // Another client is unaffected.
      await expect(book({ time: '15:00' })).resolves.toBeTruthy();
    });

    it('cancelled, completed and past bookings do not count', async () => {
      const client = await makeClient();
      const mine = { clientId: client.id, clientPhone: '+59172000000' };
      await insertBooking({ ...mine, time: '10:00', status: 'CANCELLED' });
      await insertBooking({ ...mine, time: '11:00', status: 'COMPLETED' });
      await insertBooking({ ...mine, date: '2026-11-12', time: '10:00', status: 'CONFIRMED' }); // yesterday
      await insertBooking({ ...mine, date: '2026-11-13', time: '09:00', status: 'CONFIRMED' }); // earlier today
      await book({ clientId: client.id, time: '12:00' });
      await book({ clientId: client.id, time: '14:00' });
      await expect(book({ clientId: client.id, time: '15:00' })).resolves.toBeTruthy();
      expect((await errorOf(book({ clientId: client.id, time: '16:00' }))).code).toBe('TOO_MANY_ACTIVE_BOOKINGS');
    });

    it('honors BOOKING_MAX_ACTIVE_PER_CLIENT from the environment', async () => {
      process.env.BOOKING_MAX_ACTIVE_PER_CLIENT = '1';
      try {
        const client = await makeClient();
        await book({ clientId: client.id, time: '10:00' });
        expect((await errorOf(book({ clientId: client.id, time: '11:00' }))).code).toBe('TOO_MANY_ACTIVE_BOOKINGS');
      } finally {
        delete process.env.BOOKING_MAX_ACTIVE_PER_CLIENT;
      }
    });
  });

  describe('concurrency (advisory lock)', () => {
    const futureDate = () => {
      let date = toLaPazDateString(new Date(Date.now() + 3 * 86_400_000));
      if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) {
        date = toLaPazDateString(new Date(Date.now() + 4 * 86_400_000));
      }
      return date;
    };

    const tokenFor = async () =>
      app.jwt.sign({ userId: (await makeClient({ displayName: 'Racer' })).id, role: 'cliente', deviceId: 'web-client' });

    it('N parallel HTTP requests for the same slot produce exactly one 201 and the rest SLOT_TAKEN', async () => {
      const date = futureDate();
      const N = 10;
      const tokens = await Promise.all(Array.from({ length: N }, tokenFor));
      const results = await Promise.all(
        tokens.map((token) =>
          app.inject({
            method: 'POST',
            url: `/barbers/${barberId}/bookings`,
            headers: { authorization: `Bearer ${token}` },
            payload: { serviceIds: [shortId], date, time: '10:00' },
          })
        )
      );
      const created = results.filter((r) => r.statusCode === 201);
      const taken = results.filter((r) => r.statusCode === 409);
      expect(created).toHaveLength(1);
      expect(taken).toHaveLength(N - 1);
      expect(taken.every((r) => JSON.parse(r.body).error === 'SLOT_TAKEN')).toBe(true);
      expect(await app.prisma.booking.count({ where: { barberId, date, time: '10:00' } })).toBe(1);
    });

    it('parallel overlapping (not identical) requests never double-book', async () => {
      const date = futureDate();
      const starts = ['10:00', '10:30', '10:00', '10:30', '10:00', '10:30'];
      const tokens = await Promise.all(starts.map(tokenFor));
      const results = await Promise.all(
        starts.map((time, i) =>
          app.inject({
            method: 'POST',
            url: `/barbers/${barberId}/bookings`,
            headers: { authorization: `Bearer ${tokens[i]}` },
            payload: { serviceIds: [longId], date, time },
          })
        )
      );
      // 45-min bookings at 10:00 and 10:30 overlap each other, so only one can win.
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
      expect(await app.prisma.booking.count({ where: { barberId, date } })).toBe(1);
    });

    it('parallel bookings of one client never exceed the active cap', async () => {
      const date = futureDate();
      const client = await app.prisma.client.create({
        data: { email: `race-${crypto.randomUUID()}@example.com`, displayName: 'Racer', phone: '70777000' },
      });
      const token = app.jwt.sign({ userId: client.id, role: 'cliente', deviceId: 'web-client' });
      const times = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
      const results = await Promise.all(
        times.map((time) =>
          app.inject({
            method: 'POST',
            url: `/barbers/${barberId}/bookings`,
            headers: { authorization: `Bearer ${token}` },
            payload: { serviceIds: [shortId], date, time },
          })
        )
      );
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(3);
      const rejected = results.filter((r) => r.statusCode !== 201);
      expect(rejected.every((r) => r.statusCode === 409 && JSON.parse(r.body).error === 'TOO_MANY_ACTIVE_BOOKINGS')).toBe(true);
      expect(await app.prisma.booking.count({ where: { clientId: client.id } })).toBe(3);
    });
  });

  describe('malformed stored working hours', () => {
    const setHours = (over: Record<string, unknown>, slotIntervalMin: unknown = 30) =>
      app.prisma.barber.update({
        where: { id: barberId },
        data: {
          workingHours: {
            slotIntervalMin,
            days: Array.from({ length: 7 }, (_, i) => ({
              dayOfWeek: i,
              dayName: `d${i}`,
              enabled: true,
              openTime: '09:00',
              closeTime: '20:00',
              hasBreak: false,
              ...over,
            })),
          } as any,
        },
      });

    it('treats a day with a malformed time as closed instead of bypassing the checks', async () => {
      for (const over of [
        { openTime: 'abc' },
        { closeTime: '25:99' },
        { openTime: '9am' },
        { hasBreak: true, breakStart: 'x', breakEnd: '14:00' },
        { openTime: '20:00', closeTime: '09:00' },
      ]) {
        await setHours(over);
        const err = await errorOf(book());
        expect(err.code).toBe('BARBER_NOT_WORKING');
        const r = await service.getBarberAvailability(barberId, DAY, NOW);
        expect(r.isWorkingDay).toBe(false);
        expect(r.availableSlots).toEqual([]);
      }
    });

    it('falls back to a 30 minute grid for a bad slot interval and always terminates', async () => {
      for (const bad of [-30, 0, 7.5, 1, 1000, 'x', null]) {
        await setHours({}, bad);
        const r = await service.getBarberAvailability(barberId, DAY, NOW);
        expect(r.allSlots[0].time).toBe('09:00');
        expect(r.allSlots[1].time).toBe('09:30');
      }
    });

    it('keeps a valid custom slot interval', async () => {
      await setHours({}, 15);
      const r = await service.getBarberAvailability(barberId, DAY, NOW);
      expect(r.allSlots[1].time).toBe('09:15');
    });

    it('treats a non-array days value as closed', async () => {
      await app.prisma.barber.update({
        where: { id: barberId },
        data: { workingHours: { days: 'nope', slotIntervalMin: 30 } as any },
      });
      const r = await service.getBarberAvailability(barberId, DAY, NOW);
      expect(r.isWorkingDay).toBe(false);
      expect((await errorOf(book())).code).toBe('BARBER_NOT_WORKING');
    });
  });
});
