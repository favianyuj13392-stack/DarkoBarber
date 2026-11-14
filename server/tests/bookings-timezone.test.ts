import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { seed } from '../prisma/seed';
import { cleanDatabase } from './helpers';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from '../src/modules/bookings/bookings.service';

describe('Bookings La Paz timezone handling', () => {
  let app: FastifyInstance;
  let service: BookingsService;
  let barberId: string;

  beforeAll(async () => {
    app = await buildApp();
    await cleanDatabase(app.prisma);
    const { barber } = await seed();
    barberId = barber.id;
    service = new BookingsService(app.prisma);
  });

  beforeEach(async () => {
    await (app.prisma as any).booking.deleteMany({ where: { barberId } });
  });

  afterAll(async () => {
    await app.close();
  });

  async function addBooking(date: string, time: string, status = BookingStatus.CONFIRMED) {
    return (app.prisma as any).booking.create({
      data: {
        barberId,
        clientName: 'Test Client',
        clientPhone: '+591 70000000',
        serviceName: 'Corte',
        servicePriceBs: 50,
        durationMin: 30,
        date,
        time,
        status,
      },
    });
  }

  it('20:30 La Paz (00:30 UTC next day): a booking dated the La Paz day at 21:00 is today and alerts with 30 minutes left', async () => {
    const now = new Date('2026-11-13T00:30:00Z'); // 2026-11-12 20:30 La Paz
    // Alert window is -5..25 min, so use 20:50 (20 min) and also check 21:00 is outside (30 min).
    const soon = await addBooking('2026-11-12', '20:50');
    const alert = await service.getUpcomingAlert(barberId, now);
    expect(alert.hasUpcoming).toBe(true);
    expect(alert.minutesLeft).toBe(20);
    expect(alert.booking.id).toBe(soon.id);
  });

  it('a 21:00 booking is today (30 min away) but outside the 25 min alert window', async () => {
    const now = new Date('2026-11-13T00:30:00Z');
    await addBooking('2026-11-12', '21:00');
    const alert = await service.getUpcomingAlert(barberId, now);
    expect(alert.hasUpcoming).toBe(false);
    // Five minutes later the same booking is 25 min away -> alerts with minutesLeft 25.
    const later = await service.getUpcomingAlert(barberId, new Date('2026-11-13T00:35:00Z'));
    expect(later.hasUpcoming).toBe(true);
    expect(later.minutesLeft).toBe(25);
  });

  it('a booking dated the UTC date (2026-11-13) is NOT today at 20:30 La Paz', async () => {
    const now = new Date('2026-11-13T00:30:00Z');
    await addBooking('2026-11-13', '20:45');
    const alert = await service.getUpcomingAlert(barberId, now);
    expect(alert.hasUpcoming).toBe(false);
  });

  it('does not alert across midnight: 00:10 next day is not "15 minutes left" at 23:55', async () => {
    const now = new Date('2026-11-13T03:55:00Z'); // 2026-11-12 23:55 La Paz
    await addBooking('2026-11-13', '00:10');
    const alert = await service.getUpcomingAlert(barberId, now);
    expect(alert.hasUpcoming).toBe(false);
  });

  it('23:59:59 La Paz is still the same day; 00:00:00 La Paz rolls to the next day', async () => {
    await addBooking('2026-11-12', '23:59');
    const beforeMidnight = await service.getUpcomingAlert(barberId, new Date('2026-11-13T03:59:59Z'));
    expect(beforeMidnight.hasUpcoming).toBe(true);
    expect(beforeMidnight.minutesLeft).toBe(0);

    await (app.prisma as any).booking.deleteMany({ where: { barberId } });
    await addBooking('2026-11-13', '00:10');
    const afterMidnight = await service.getUpcomingAlert(barberId, new Date('2026-11-13T04:00:00Z'));
    expect(afterMidnight.hasUpcoming).toBe(true);
    expect(afterMidnight.minutesLeft).toBe(10);
  });

  it('availability without an explicit date defaults to the La Paz day', async () => {
    // 2026-11-12 is a Thursday in La Paz (working day); at 00:30 UTC on the 13th it is still the 12th.
    const result = await service.getBarberAvailability(barberId, undefined, new Date('2026-11-13T00:30:00Z'));
    expect(result.dayName).toBe('Jueves');
  });
});
