import { PrismaClient, BookingStatus } from '@prisma/client';

export interface CreateBookingInput {
  barberId: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  servicePriceBs: number;
  durationMin?: number;
  date: string;
  time: string;
  notes?: string;
}

export class BookingsService {
  constructor(private prisma: PrismaClient) {}

  async getBarberBookings(barberId: string, statusFilter?: BookingStatus) {
    const where: any = { barberId };
    if (statusFilter) {
      where.status = statusFilter;
    }

    const bookings = await (this.prisma as any).booking.findMany({
      where,
      orderBy: [{ date: 'asc' }, { time: 'asc' }, { createdAt: 'desc' }],
    });

    // If no bookings exist yet in database, seed realistic demo bookings for the barber
    if (bookings.length === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const demoSeed = [
        {
          id: `seed-bk-1`,
          barberId,
          clientName: 'Carlos Mendizábal',
          clientPhone: '+591 78945612',
          serviceName: 'Low Fade Texturizado + Perfilado',
          servicePriceBs: 75,
          durationMin: 45,
          date: todayStr,
          time: '17:30',
          status: BookingStatus.CONFIRMED,
          notes: 'Cliente puntual, prefiere tijera en la cúspide.',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: `seed-bk-2`,
          barberId,
          clientName: 'Andrés Villagómez',
          clientPhone: '+591 76543210',
          serviceName: 'Corte Clásico & Fade',
          servicePriceBs: 50,
          durationMin: 35,
          date: todayStr,
          time: '19:00',
          status: BookingStatus.PENDING,
          notes: 'Primera vez en Fade Studio.',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      for (const item of demoSeed) {
        await (this.prisma as any).booking.create({ data: item }).catch(() => null);
      }

      return (this.prisma as any).booking.findMany({
        where,
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      });
    }

    return bookings;
  }

  async createBooking(input: CreateBookingInput) {
    if (!input.barberId || !input.clientName || !input.clientPhone || !input.serviceName) {
      throw new Error('Datos incompletos para la reserva');
    }

    // Check if barber accepts bookings
    const barber = await this.prisma.barber.findUnique({
      where: { id: input.barberId },
      select: { acceptsBookings: true },
    });

    if (barber && !barber.acceptsBookings) {
      throw new Error('Este barbero no está aceptando reservas programadas en este momento');
    }

    const booking = await (this.prisma as any).booking.create({
      data: {
        barberId: input.barberId,
        clientId: input.clientId || null,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        serviceName: input.serviceName,
        servicePriceBs: input.servicePriceBs || 50,
        durationMin: input.durationMin || 30,
        date: input.date,
        time: input.time,
        status: BookingStatus.PENDING,
        notes: input.notes || null,
      },
    });

    return booking;
  }

  async updateBookingStatus(
    barberId: string,
    bookingId: string,
    status: BookingStatus,
    cancelReason?: string
  ) {
    const existing = await (this.prisma as any).booking.findUnique({
      where: { id: bookingId },
    });

    if (!existing || existing.barberId !== barberId) {
      throw new Error('Reserva no encontrada o no pertenece a este barbero');
    }

    const updated = await (this.prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        status,
        cancelReason: cancelReason || null,
      },
    });

    return updated;
  }

  /**
   * Sinergia Walk-In: Consulta si hay una cita confirmada en los próximos minutos
   */
  async getUpcomingAlert(barberId: string) {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const nowMinutesTotal = currentHour * 60 + currentMin;

    const confirmedToday = await (this.prisma as any).booking.findMany({
      where: {
        barberId,
        date: todayStr,
        status: BookingStatus.CONFIRMED,
      },
      orderBy: { time: 'asc' },
    });

    for (const b of confirmedToday) {
      const parts = b.time.split(':');
      if (parts.length === 2) {
        const slotMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        const diff = slotMinutes - nowMinutesTotal;
        // Alerta si la cita es dentro de los próximos 20 minutos o está empezando
        if (diff >= -5 && diff <= 25) {
          return {
            hasUpcoming: true,
            minutesLeft: Math.max(0, diff),
            booking: b,
          };
        }
      }
    }

    return {
      hasUpcoming: false,
      minutesLeft: 0,
      booking: null,
    };
  }

  async getBarberBookingSettings(barberId: string) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
      select: { acceptsBookings: true, bookingNoticeMin: true },
    });
    return {
      acceptsBookings: barber?.acceptsBookings ?? true,
      bookingNoticeMin: barber?.bookingNoticeMin ?? 15,
    };
  }

  async updateBarberBookingSettings(
    barberId: string,
    data: { acceptsBookings?: boolean; bookingNoticeMin?: number }
  ) {
    const updated = await this.prisma.barber.update({
      where: { id: barberId },
      data: {
        ...(data.acceptsBookings !== undefined ? { acceptsBookings: data.acceptsBookings } : {}),
        ...(data.bookingNoticeMin !== undefined ? { bookingNoticeMin: data.bookingNoticeMin } : {}),
      },
      select: { acceptsBookings: true, bookingNoticeMin: true },
    });
    return updated;
  }
}
