import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { BookingStatus } from '@prisma/client';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { ALLOWED_TRANSITIONS, BOOKING_STATUSES } from '../src/modules/bookings/bookings.status';
import { toLaPazDateString } from '../src/utils/la-paz-date';
import { AppError } from '../src/utils/errors';

// Friday 2026-11-13 10:00 La Paz.
const NOW = new Date('2026-11-13T14:00:00Z');
const PAST = { date: '2026-11-12', time: '10:00' }; // started yesterday
const FUTURE = { date: '2026-11-14', time: '10:00' }; // starts tomorrow
// Real-clock helper for HTTP tests (the routes are not clock-injectable).
const inDays = (n: number) => toLaPazDateString(new Date(Date.now() + n * 86_400_000));

describe('Bookings: state machine, client cancellation and client list', () => {
  let app: FastifyInstance;
  let service: BookingsService;
  let barberId: string;
  let otherBarberId: string;
  let clientId: string;
  let otherClientId: string;
  let phoneSeq = 0;

  const insert = (data: Record<string, unknown> = {}) =>
    app.prisma.booking.create({
      data: {
        barberId,
        clientId,
        clientName: 'Cliente',
        clientPhone: `+5916${String(1_000_000 + phoneSeq++)}`,
        serviceName: 'Corte',
        servicePriceBs: 50,
        durationMin: 30,
        ...PAST,
        status: BookingStatus.PENDING,
        ...data,
      } as any,
    });

  const codeOf = async (p: Promise<unknown>) => {
    const err = await p.then(
      () => null,
      (e) => e
    );
    expect(err).toBeInstanceOf(AppError);
    return { code: (err as AppError).code, status: (err as AppError).statusCode };
  };

  const clientToken = (id: string) => app.jwt.sign({ userId: id, role: 'cliente', deviceId: 'web-client' });
  const barberToken = (id: string) => app.jwt.sign({ userId: id, barberId: id, role: 'barbero' });
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barbers } = await seed();
    barberId = barbers[0].id;
    otherBarberId = barbers[1].id;
    service = new BookingsService(app.prisma);
    const mkClient = (phone: string, displayName: string) =>
      app.prisma.client.create({
        data: { email: `lc-${crypto.randomUUID()}@example.com`, displayName, phone },
      });
    clientId = (await mkClient('70010001', 'Client One')).id;
    otherClientId = (await mkClient('70010002', 'Client Two')).id;
  });

  beforeEach(async () => {
    await app.prisma.booking.deleteMany({});
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  describe('transition table (barber, booking already started)', () => {
    for (const from of BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        const allowed = ALLOWED_TRANSITIONS[from].includes(to);
        it(`${from} -> ${to} is ${allowed ? 'allowed' : 'rejected with INVALID_TRANSITION'}`, async () => {
          const b = await insert({ status: from });
          const attempt = service.updateBookingStatus(barberId, b.id, to, undefined, NOW);
          if (allowed) {
            const updated = await attempt;
            expect(updated.status).toBe(to);
          } else {
            expect(await codeOf(attempt)).toEqual({ code: 'INVALID_TRANSITION', status: 409 });
            expect((await app.prisma.booking.findUnique({ where: { id: b.id } }))!.status).toBe(from);
          }
        });
      }
    }

    it('encodes exactly the documented table', () => {
      expect(ALLOWED_TRANSITIONS.PENDING).toEqual(['CONFIRMED', 'REJECTED', 'CANCELLED']);
      expect(ALLOWED_TRANSITIONS.CONFIRMED).toEqual(['COMPLETED', 'CANCELLED', 'NO_SHOW']);
      for (const terminal of ['COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'] as const) {
        expect(ALLOWED_TRANSITIONS[terminal]).toEqual([]);
      }
    });
  });

  describe('COMPLETED / NO_SHOW only after the start (La Paz)', () => {
    it('rejects both before the start', async () => {
      const b = await insert({ ...FUTURE, status: BookingStatus.CONFIRMED });
      expect(await codeOf(service.updateBookingStatus(barberId, b.id, BookingStatus.COMPLETED, undefined, NOW))).toEqual({
        code: 'BOOKING_NOT_STARTED',
        status: 409,
      });
      expect((await codeOf(service.updateBookingStatus(barberId, b.id, BookingStatus.NO_SHOW, undefined, NOW))).code).toBe(
        'BOOKING_NOT_STARTED'
      );
    });

    it('allows exactly at the start minute and not one minute earlier', async () => {
      const b = await insert({ date: '2026-11-13', time: '10:00', status: BookingStatus.CONFIRMED });
      const early = new Date('2026-11-13T13:59:00Z'); // 09:59 La Paz
      expect((await codeOf(service.updateBookingStatus(barberId, b.id, BookingStatus.COMPLETED, undefined, early))).code).toBe(
        'BOOKING_NOT_STARTED'
      );
      const ok = await service.updateBookingStatus(barberId, b.id, BookingStatus.COMPLETED, undefined, NOW);
      expect(ok.status).toBe('COMPLETED');
    });

    it('uses La Paz time: 20:30 La Paz (00:30Z next day) has not reached a 21:00 booking', async () => {
      const b = await insert({ date: '2026-11-12', time: '21:00', status: BookingStatus.CONFIRMED });
      const lateNow = new Date('2026-11-13T00:30:00Z');
      expect((await codeOf(service.updateBookingStatus(barberId, b.id, BookingStatus.NO_SHOW, undefined, lateNow))).code).toBe(
        'BOOKING_NOT_STARTED'
      );
    });

    it('barber can confirm, reject and cancel future bookings at any time', async () => {
      const a = await insert({ ...FUTURE });
      const b = await insert({ ...FUTURE });
      const c = await insert({ ...FUTURE, status: BookingStatus.CONFIRMED });
      expect((await service.updateBookingStatus(barberId, a.id, BookingStatus.CONFIRMED, undefined, NOW)).status).toBe('CONFIRMED');
      expect((await service.updateBookingStatus(barberId, b.id, BookingStatus.REJECTED, 'No atiendo ese dia', NOW)).cancelReason).toBe('No atiendo ese dia');
      expect((await service.updateBookingStatus(barberId, c.id, BookingStatus.CANCELLED, undefined, NOW)).status).toBe('CANCELLED');
    });
  });

  describe('barber ownership', () => {
    it("another barber's booking is reported as not found", async () => {
      const b = await insert({ ...FUTURE });
      expect(await codeOf(service.updateBookingStatus(otherBarberId, b.id, BookingStatus.CONFIRMED, undefined, NOW))).toEqual({
        code: 'BOOKING_NOT_FOUND',
        status: 404,
      });
      expect((await codeOf(service.updateBookingStatus(barberId, crypto.randomUUID(), BookingStatus.CONFIRMED))).status).toBe(404);
      expect((await app.prisma.booking.findUnique({ where: { id: b.id } }))!.status).toBe('PENDING');
    });

    it('HTTP: owner can change status, another barber gets 404, a client token gets 401, bad status 400', async () => {
      const b = await insert({ ...FUTURE });
      const url = `/barbers/me/bookings/${b.id}`;

      const foreign = await app.inject({ method: 'PATCH', url, headers: auth(barberToken(otherBarberId)), payload: { status: 'CONFIRMED' } });
      expect(foreign.statusCode).toBe(404);

      const asClient = await app.inject({ method: 'PATCH', url, headers: auth(clientToken(clientId)), payload: { status: 'CONFIRMED' } });
      expect(asClient.statusCode).toBe(401);

      const invalid = await app.inject({ method: 'PATCH', url, headers: auth(barberToken(barberId)), payload: { status: 'BANANA' } });
      expect(invalid.statusCode).toBe(400);
      const missing = await app.inject({ method: 'PATCH', url, headers: auth(barberToken(barberId)), payload: {} });
      expect(missing.statusCode).toBe(400);

      const ok = await app.inject({ method: 'PATCH', url, headers: auth(barberToken(barberId)), payload: { status: 'CONFIRMED' } });
      expect(ok.statusCode).toBe(200);
      expect(JSON.parse(ok.body).status).toBe('CONFIRMED');

      const again = await app.inject({ method: 'PATCH', url, headers: auth(barberToken(barberId)), payload: { status: 'PENDING' } });
      expect(again.statusCode).toBe(409);
      expect(JSON.parse(again.body).error).toBe('INVALID_TRANSITION');
    });

    it('HTTP: barber list rejects an unknown status filter and accepts the new ones', async () => {
      await insert({ ...FUTURE, status: BookingStatus.REJECTED });
      const bad = await app.inject({ method: 'GET', url: '/barbers/me/bookings?status=NOPE', headers: auth(barberToken(barberId)) });
      expect(bad.statusCode).toBe(400);
      const ok = await app.inject({ method: 'GET', url: '/barbers/me/bookings?status=REJECTED', headers: auth(barberToken(barberId)) });
      expect(ok.statusCode).toBe(200);
      expect(JSON.parse(ok.body)).toHaveLength(1);
    });
  });

  describe('client cancellation', () => {
    it('allows PENDING and CONFIRMED bookings that start at least 2 hours from now (boundary inclusive)', async () => {
      // NOW = 10:00 La Paz; 12:00 is exactly 2h away.
      const pending = await insert({ date: '2026-11-13', time: '12:00' });
      const confirmed = await insert({ date: '2026-11-13', time: '12:00', status: BookingStatus.CONFIRMED });
      const a = await service.cancelBookingAsClient(clientId, pending.id, 'Cambio de planes', NOW);
      expect(a.status).toBe('CANCELLED');
      expect(a.cancelReason).toBe('Cambio de planes');
      expect((await service.cancelBookingAsClient(clientId, confirmed.id, undefined, NOW)).status).toBe('CANCELLED');
    });

    it('rejects with TOO_LATE_TO_CANCEL one minute inside the window, and after the start', async () => {
      const close = await insert({ date: '2026-11-13', time: '11:59' });
      const started = await insert({ date: '2026-11-13', time: '09:00' });
      expect(await codeOf(service.cancelBookingAsClient(clientId, close.id, undefined, NOW))).toEqual({
        code: 'TOO_LATE_TO_CANCEL',
        status: 409,
      });
      expect((await codeOf(service.cancelBookingAsClient(clientId, started.id, undefined, NOW))).code).toBe('TOO_LATE_TO_CANCEL');
      expect((await app.prisma.booking.findUnique({ where: { id: close.id } }))!.status).toBe('PENDING');
    });

    it('honors BOOKING_CANCEL_MIN_HOURS from the environment', async () => {
      process.env.BOOKING_CANCEL_MIN_HOURS = '5';
      try {
        const b = await insert({ date: '2026-11-13', time: '12:00' });
        expect((await codeOf(service.cancelBookingAsClient(clientId, b.id, undefined, NOW))).code).toBe('TOO_LATE_TO_CANCEL');
      } finally {
        delete process.env.BOOKING_CANCEL_MIN_HOURS;
      }
    });

    it('cannot cancel terminal bookings', async () => {
      for (const status of ['COMPLETED', 'CANCELLED', 'REJECTED', 'NO_SHOW'] as const) {
        const b = await insert({ ...FUTURE, status });
        expect((await codeOf(service.cancelBookingAsClient(clientId, b.id, undefined, NOW))).code).toBe('INVALID_TRANSITION');
      }
    });

    it("cannot cancel another client's or an anonymous booking (404)", async () => {
      const mine = await insert({ ...FUTURE });
      const anon = await insert({ ...FUTURE, clientId: null });
      expect(await codeOf(service.cancelBookingAsClient(otherClientId, mine.id, undefined, NOW))).toEqual({
        code: 'BOOKING_NOT_FOUND',
        status: 404,
      });
      expect((await codeOf(service.cancelBookingAsClient(clientId, anon.id, undefined, NOW))).code).toBe('BOOKING_NOT_FOUND');
      expect((await app.prisma.booking.findUnique({ where: { id: mine.id } }))!.status).toBe('PENDING');
    });

    describe('HTTP', () => {
      it('owner cancels (200); other client 404; barber token 403; no token 401', async () => {
        const b = await insert({ date: inDays(5), time: '10:00' });
        const url = `/bookings/${b.id}/cancel`;

        expect((await app.inject({ method: 'PATCH', url })).statusCode).toBe(401);
        expect((await app.inject({ method: 'PATCH', url, headers: auth(barberToken(barberId)) })).statusCode).toBe(403);
        expect((await app.inject({ method: 'PATCH', url, headers: auth(clientToken(otherClientId)) })).statusCode).toBe(404);

        const ok = await app.inject({ method: 'PATCH', url, headers: auth(clientToken(clientId)), payload: { cancelReason: 'No puedo ir' } });
        expect(ok.statusCode).toBe(200);
        expect(JSON.parse(ok.body)).toMatchObject({ status: 'CANCELLED', cancelReason: 'No puedo ir' });

        const again = await app.inject({ method: 'PATCH', url, headers: auth(clientToken(clientId)) });
        expect(again.statusCode).toBe(409);
        expect(JSON.parse(again.body).error).toBe('INVALID_TRANSITION');
      });

      it('too late to cancel returns 409 TOO_LATE_TO_CANCEL', async () => {
        // Starts in 30 min on the real clock: build it from La Paz parts of now + 30 min.
        const soon = new Date(Date.now() + 30 * 60_000);
        const date = toLaPazDateString(soon);
        const time = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'America/La_Paz',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).format(soon);
        const b = await insert({ date, time });
        const res = await app.inject({ method: 'PATCH', url: `/bookings/${b.id}/cancel`, headers: auth(clientToken(clientId)) });
        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body).error).toBe('TOO_LATE_TO_CANCEL');
      });
    });
  });

  describe('GET /clients/me/bookings', () => {
    it('returns only the caller bookings, newest first, with barber and service names', async () => {
      const oldOne = await insert({ date: '2026-10-01', time: '09:00', status: BookingStatus.COMPLETED });
      const later = await insert({ date: inDays(40), time: '15:00', serviceName: 'Combo' });
      const sameDayLate = await insert({ date: inDays(40), time: '16:30' });
      await insert({ clientId: otherClientId, date: inDays(41), time: '10:00' });
      await insert({ clientId: null, date: inDays(42), time: '10:00' });

      const res = await app.inject({ method: 'GET', url: '/clients/me/bookings', headers: auth(clientToken(clientId)) });
      expect(res.statusCode).toBe(200);
      const list = JSON.parse(res.body);
      expect(list.map((b: any) => b.id)).toEqual([sameDayLate.id, later.id, oldOne.id]);
      expect(list[1]).toMatchObject({ serviceName: 'Combo', barberName: 'Diego', status: 'PENDING' });
      expect(list[2]).toMatchObject({ status: 'COMPLETED', isUpcoming: false, canCancel: false });
      expect(list[0]).toMatchObject({ isUpcoming: true, canCancel: true });
      // No contact data of other people leaks into the shape.
      expect(list[0]).not.toHaveProperty('clientPhone');
    });

    it('the other client sees only their own, and a client without bookings gets []', async () => {
      await insert({ date: inDays(40), time: '15:00' });
      const other = await insert({ clientId: otherClientId, date: inDays(41), time: '10:00' });
      const res = await app.inject({ method: 'GET', url: '/clients/me/bookings', headers: auth(clientToken(otherClientId)) });
      expect(JSON.parse(res.body).map((b: any) => b.id)).toEqual([other.id]);

      const fresh = await app.prisma.client.create({ data: { email: `fresh-${crypto.randomUUID()}@example.com` } });
      const empty = await app.inject({ method: 'GET', url: '/clients/me/bookings', headers: auth(clientToken(fresh.id)) });
      expect(JSON.parse(empty.body)).toEqual([]);
    });

    it('requires a client: 401 without token, 403 for a barber token', async () => {
      expect((await app.inject({ method: 'GET', url: '/clients/me/bookings' })).statusCode).toBe(401);
      expect((await app.inject({ method: 'GET', url: '/clients/me/bookings', headers: auth(barberToken(barberId)) })).statusCode).toBe(403);
    });

    it('canCancel follows the cancellation window', async () => {
      const list = await service.getClientBookings(clientId, NOW);
      expect(list).toEqual([]);
      await insert({ date: '2026-11-13', time: '12:00' }); // exactly 2h
      await insert({ date: '2026-11-13', time: '11:30' }); // 1.5h
      const res = await service.getClientBookings(clientId, NOW);
      expect(res.map((b) => [b.time, b.canCancel])).toEqual([
        ['12:00', true],
        ['11:30', false],
      ]);
    });
  });

  describe('no demo data', () => {
    it('a barber without bookings gets an empty list and nothing is written to the database', async () => {
      const res = await app.inject({ method: 'GET', url: '/barbers/me/bookings', headers: auth(barberToken(otherBarberId)) });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual([]);
      expect(await app.prisma.booking.count({ where: { barberId: otherBarberId } })).toBe(0);
      expect(await app.prisma.booking.count({ where: { id: { startsWith: 'seed-bk' } } })).toBe(0);
    });
  });
});
