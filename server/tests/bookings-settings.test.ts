import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';
import { getDefaultWorkingHours } from '../src/modules/bookings/bookings.service';

describe('Bookings: barber booking-settings validation', () => {
  let app: FastifyInstance;
  let barberId: string;
  let token: string;

  const patch = (payload: unknown, headers: Record<string, string> = { authorization: `Bearer ${token}` }) =>
    app.inject({ method: 'PATCH', url: '/barbers/me/booking-settings', headers, payload: payload as any });

  const stored = () =>
    app.prisma.barber.findUniqueOrThrow({
      where: { id: barberId },
      select: { acceptsBookings: true, bookingNoticeMin: true, workingHours: true },
    });

  /** Default config with one day overridden. */
  const withDay = (dayOfWeek: number, over: Record<string, unknown>) => {
    const wh = getDefaultWorkingHours();
    return { ...wh, days: wh.days.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...over } : d)) };
  };

  const expectRejected = async (payload: unknown) => {
    const before = await stored();
    const res = await patch(payload);
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('VALIDATION_ERROR');
    expect(await stored()).toEqual(before);
  };

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barbers } = await seed();
    barberId = barbers[0].id;
    token = app.jwt.sign({ userId: barberId, barberId, role: 'barbero' });
  });

  beforeEach(async () => {
    await app.prisma.barber.update({
      where: { id: barberId },
      data: { acceptsBookings: true, bookingNoticeMin: 15, workingHours: Prisma.DbNull },
    });
  });

  afterAll(async () => {
    await cleanDatabase(app.prisma);
    await app.close();
  });

  describe('valid input is saved', () => {
    it('saves a full working-hours config, notice and acceptsBookings', async () => {
      const wh = withDay(1, { openTime: '08:30', closeTime: '18:00', breakStart: '12:00', breakEnd: '13:00' });
      wh.slotIntervalMin = 45;
      const res = await patch({ acceptsBookings: false, bookingNoticeMin: 60, workingHours: wh });
      expect(res.statusCode).toBe(200);
      const row = await stored();
      expect(row.acceptsBookings).toBe(false);
      expect(row.bookingNoticeMin).toBe(60);
      expect(row.workingHours).toEqual(wh);
      expect(JSON.parse(res.body).workingHours).toEqual(wh);
    });

    it('accepts partial updates (only one field)', async () => {
      expect((await patch({ bookingNoticeMin: 0 })).statusCode).toBe(200);
      expect((await patch({ acceptsBookings: true })).statusCode).toBe(200);
      expect((await stored()).bookingNoticeMin).toBe(0);
    });

    it('accepts the exact default config the client sends, including a rest day with odd hours', async () => {
      expect((await patch({ workingHours: getDefaultWorkingHours() })).statusCode).toBe(200);
      // A disabled day keeps its hours untouched: only working days must be coherent.
      const odd = withDay(0, { enabled: false, openTime: '20:00', closeTime: '09:00' });
      expect((await patch({ workingHours: odd })).statusCode).toBe(200);
    });

    it('accepts a day without a break and a subset of days', async () => {
      const wh = withDay(2, { hasBreak: false, breakStart: undefined, breakEnd: undefined });
      expect((await patch({ workingHours: wh })).statusCode).toBe(200);
      const subset = { slotIntervalMin: 30, days: getDefaultWorkingHours().days.slice(1, 3) };
      expect((await patch({ workingHours: subset })).statusCode).toBe(200);
    });

    it('accepts the slot interval bounds (5 and 240)', async () => {
      for (const slotIntervalMin of [5, 240]) {
        const res = await patch({ workingHours: { ...getDefaultWorkingHours(), slotIntervalMin } });
        expect(res.statusCode).toBe(200);
      }
    });

    it('strips unknown keys instead of persisting them', async () => {
      const wh = { ...getDefaultWorkingHours(), evil: 'x' } as any;
      wh.days[0].extra = 1;
      const res = await patch({ workingHours: wh, role: 'admin', plan: 'PRO' });
      expect(res.statusCode).toBe(200);
      const row: any = await stored();
      expect(row.workingHours.evil).toBeUndefined();
      expect(row.workingHours.days[0].extra).toBeUndefined();
    });
  });

  describe('invalid input answers 400 and persists nothing', () => {
    it('rejects an empty body', async () => {
      await expectRejected({});
    });

    it('rejects a non-object workingHours and a missing/empty days array', async () => {
      await expectRejected({ workingHours: 'always' });
      await expectRejected({ workingHours: { slotIntervalMin: 30 } });
      await expectRejected({ workingHours: { days: [], slotIntervalMin: 30 } });
      await expectRejected({ workingHours: { days: 'mon', slotIntervalMin: 30 } });
    });

    it('rejects more than 7 days', async () => {
      const days = [...getDefaultWorkingHours().days, { ...getDefaultWorkingHours().days[1] }];
      await expectRejected({ workingHours: { days, slotIntervalMin: 30 } });
    });

    it('rejects dayOfWeek out of 0-6 or non-integer', async () => {
      await expectRejected({ workingHours: withDay(1, { dayOfWeek: 7 }) });
      await expectRejected({ workingHours: withDay(1, { dayOfWeek: -1 }) });
      await expectRejected({ workingHours: withDay(1, { dayOfWeek: 1.5 }) });
      await expectRejected({ workingHours: withDay(1, { dayOfWeek: '1' }) });
    });

    it('rejects duplicate days', async () => {
      const wh = getDefaultWorkingHours();
      wh.days[2] = { ...wh.days[2], dayOfWeek: 1 };
      await expectRejected({ workingHours: wh });
    });

    it('rejects malformed times', async () => {
      for (const bad of ['9:00', '24:00', '12:60', '09:00:00', '9am', '', 'abc', 900]) {
        await expectRejected({ workingHours: withDay(1, { openTime: bad }) });
      }
      await expectRejected({ workingHours: withDay(1, { closeTime: '25:00' }) });
      await expectRejected({ workingHours: withDay(1, { breakStart: '1pm' }) });
    });

    it('rejects open >= close on a working day', async () => {
      await expectRejected({ workingHours: withDay(1, { openTime: '18:00', closeTime: '09:00' }) });
      await expectRejected({ workingHours: withDay(1, { openTime: '10:00', closeTime: '10:00' }) });
    });

    it('rejects an incoherent break on a working day', async () => {
      await expectRejected({ workingHours: withDay(1, { breakStart: '14:00', breakEnd: '13:00' }) });
      await expectRejected({ workingHours: withDay(1, { breakStart: '13:00', breakEnd: '13:00' }) });
      await expectRejected({ workingHours: withDay(1, { breakStart: '08:00', breakEnd: '09:30' }) });
      await expectRejected({ workingHours: withDay(1, { breakStart: '19:30', breakEnd: '20:30' }) });
      await expectRejected({ workingHours: withDay(1, { hasBreak: true, breakStart: undefined, breakEnd: undefined }) });
    });

    it('rejects a slot interval that is not an integer in 5-240', async () => {
      for (const slotIntervalMin of [0, 4, 241, -30, 30.5, '30', null]) {
        await expectRejected({ workingHours: { ...getDefaultWorkingHours(), slotIntervalMin } });
      }
    });

    it('rejects out-of-range or wrongly typed notice and flag', async () => {
      await expectRejected({ bookingNoticeMin: -1 });
      await expectRejected({ bookingNoticeMin: 1441 });
      await expectRejected({ bookingNoticeMin: 15.5 });
      await expectRejected({ bookingNoticeMin: '15' });
      await expectRejected({ acceptsBookings: 'yes' });
    });

    it('does not save the valid fields when another field in the same request is invalid', async () => {
      await expectRejected({ acceptsBookings: false, bookingNoticeMin: 999_999 });
      await expectRejected({
        acceptsBookings: false,
        bookingNoticeMin: 30,
        workingHours: withDay(1, { openTime: '99:99' }),
      });
    });
  });

  describe('authentication', () => {
    it('requires a barber token', async () => {
      expect((await patch({ bookingNoticeMin: 10 }, {})).statusCode).toBe(401);
      expect((await stored()).bookingNoticeMin).toBe(15);
    });
  });
});
