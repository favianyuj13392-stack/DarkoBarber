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

  const book = (over: Record<string, unknown> = {}, now: Date = NOW) =>
    service.createBooking(
      {
        barberId,
        serviceId: shortId,
        date: DAY,
        time: '10:00',
        clientName: 'Anon Client',
        clientPhone: nextPhone(),
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
      await book({ serviceId: longId }); // 10:00-10:45
      expect((await errorOf(book({ time: '10:30' }))).code).toBe('SLOT_TAKEN'); // starts inside
      expect((await errorOf(book({ time: '09:30', serviceId: longId }))).code).toBe('SLOT_TAKEN'); // ends inside (10:15)
    });

    it('rejects a booking that fully contains an existing one', async () => {
      await book({ time: '10:30' }); // 10:30-11:00
      expect((await errorOf(book({ time: '10:00', serviceId: longId }))).code).toBe('SLOT_TAKEN'); // 10:00-10:45
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
      await expect(book({ barberId: otherBarberId, serviceId: svc.id })).resolves.toBeTruthy();
    });
  });

  describe('availability', () => {
    const slotMap = (r: any) => Object.fromEntries(r.allSlots.map((s: any) => [s.time, s.available]));

    it('uses the real duration of existing bookings, not only their start time', async () => {
      await book({ serviceId: longId }); // 10:00-10:45
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
      const r = await service.getBarberAvailability(barberId, DAY, NOW, { serviceId: longId });
      const slots = slotMap(r);
      expect(slots['09:00']).toBe(true); // 09:00-09:45
      expect(slots['09:30']).toBe(false); // 09:30-10:15 hits the booking
      expect(slots['10:30']).toBe(true);
      expect(slots['12:30']).toBe(false); // 12:30-13:15 overlaps the break
      expect(slots['19:30']).toBe(false); // would end after closing
      expect(slots['19:00']).toBe(true); // 19:00-19:45
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

  describe('per-identity active bookings cap (default 3)', () => {
    it('anonymous: caps by normalized phone regardless of formatting', async () => {
      await book({ time: '10:00', clientPhone: '71234567' });
      await book({ time: '11:00', clientPhone: '+591 7123 4567' });
      await book({ time: '12:00', clientPhone: '591-71234567' });
      const err = await errorOf(book({ time: '15:00', clientPhone: '71234567' }));
      expect(err.code).toBe('TOO_MANY_ACTIVE_BOOKINGS');
      expect(err.statusCode).toBe(409);
      // A different phone is unaffected.
      await expect(book({ time: '15:00', clientPhone: '71234568' })).resolves.toBeTruthy();
    });

    it('authenticated: caps by clientId across barbers', async () => {
      const client = await app.prisma.client.create({
        data: { email: `cap-${crypto.randomUUID()}@example.com`, displayName: 'Capped', phone: '70555000' },
      });
      const other = await app.prisma.barberService.create({
        data: { barberId: otherBarberId, name: 'X', priceBs: 40, durationMin: 30 },
      });
      await book({ clientId: client.id, time: '10:00' });
      await book({ clientId: client.id, time: '11:00' });
      await book({ clientId: client.id, barberId: otherBarberId, serviceId: other.id, time: '10:00' });
      const err = await errorOf(book({ clientId: client.id, time: '15:00' }));
      expect(err.code).toBe('TOO_MANY_ACTIVE_BOOKINGS');
    });

    it('cancelled, completed and past bookings do not count', async () => {
      const phone = '+59172000000';
      await insertBooking({ clientPhone: phone, time: '10:00', status: 'CANCELLED' });
      await insertBooking({ clientPhone: phone, time: '11:00', status: 'COMPLETED' });
      await insertBooking({ clientPhone: phone, date: '2026-11-12', time: '10:00', status: 'CONFIRMED' }); // yesterday
      await insertBooking({ clientPhone: phone, date: '2026-11-13', time: '09:00', status: 'CONFIRMED' }); // earlier today
      await book({ clientPhone: '72000000', time: '12:00' });
      await book({ clientPhone: '72000000', time: '14:00' });
      await expect(book({ clientPhone: '72000000', time: '15:00' })).resolves.toBeTruthy();
      expect((await errorOf(book({ clientPhone: '72000000', time: '16:00' }))).code).toBe('TOO_MANY_ACTIVE_BOOKINGS');
    });

    it('honors BOOKING_MAX_ACTIVE_PER_CLIENT from the environment', async () => {
      process.env.BOOKING_MAX_ACTIVE_PER_CLIENT = '1';
      try {
        await book({ clientPhone: '73000000', time: '10:00' });
        expect((await errorOf(book({ clientPhone: '73000000', time: '11:00' }))).code).toBe('TOO_MANY_ACTIVE_BOOKINGS');
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

    it('N parallel HTTP requests for the same slot produce exactly one 201 and the rest SLOT_TAKEN', async () => {
      const date = futureDate();
      const N = 10;
      const results = await Promise.all(
        Array.from({ length: N }, (_, i) =>
          app.inject({
            method: 'POST',
            url: `/barbers/${barberId}/bookings`,
            payload: { serviceId: shortId, date, time: '10:00', clientName: `Racer ${i}`, clientPhone: nextPhone() },
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
      const results = await Promise.all(
        starts.map((time) =>
          app.inject({
            method: 'POST',
            url: `/barbers/${barberId}/bookings`,
            payload: { serviceId: longId, date, time, clientName: 'Racer', clientPhone: nextPhone() },
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
            payload: { serviceId: shortId, date, time },
          })
        )
      );
      expect(results.filter((r) => r.statusCode === 201)).toHaveLength(3);
      const rejected = results.filter((r) => r.statusCode !== 201);
      expect(rejected.every((r) => r.statusCode === 409 && JSON.parse(r.body).error === 'TOO_MANY_ACTIVE_BOOKINGS')).toBe(true);
      expect(await app.prisma.booking.count({ where: { clientId: client.id } })).toBe(3);
    });
  });
});
