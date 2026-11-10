import { PrismaClient, BookingStatus } from '@prisma/client';

export interface DaySchedule {
  dayOfWeek: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  dayName: string;
  enabled: boolean;
  openTime: string; // "09:00"
  closeTime: string; // "20:00"
  hasBreak: boolean;
  breakStart?: string; // "13:00"
  breakEnd?: string; // "14:00"
}

export interface BarberWorkingHoursConfig {
  days: DaySchedule[];
  slotIntervalMin: number;
}

export function getDefaultWorkingHours(): BarberWorkingHoursConfig {
  const dayNames = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  const days: DaySchedule[] = [];
  for (let i = 0; i <= 6; i++) {
    const isSunday = i === 0;
    days.push({
      dayOfWeek: i,
      dayName: dayNames[i],
      enabled: !isSunday,
      openTime: '09:00',
      closeTime: '20:00',
      hasBreak: true,
      breakStart: '13:00',
      breakEnd: '14:00',
    });
  }
  return {
    days,
    slotIntervalMin: 30,
  };
}

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
      throw new Error('Reserva no encontrada o no pertenece al barbero');
    }

    const updated = await (this.prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        status,
        ...(cancelReason ? { cancelReason } : {}),
      },
    });

    return updated;
  }

  async getUpcomingAlert(barberId: string) {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const nowMinutesTotal = now.getHours() * 60 + now.getMinutes();

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
    const barber = await (this.prisma as any).barber.findUnique({
      where: { id: barberId },
      select: {
        acceptsBookings: true,
        bookingNoticeMin: true,
        workingHours: true,
      },
    });

    const defaultWH = getDefaultWorkingHours();
    const workingHours: BarberWorkingHoursConfig =
      (barber?.workingHours as unknown as BarberWorkingHoursConfig) || defaultWH;

    return {
      acceptsBookings: barber?.acceptsBookings ?? true,
      bookingNoticeMin: barber?.bookingNoticeMin ?? 15,
      workingHours,
    };
  }

  async updateBarberBookingSettings(
    barberId: string,
    data: {
      acceptsBookings?: boolean;
      bookingNoticeMin?: number;
      workingHours?: BarberWorkingHoursConfig;
    }
  ) {
    const updateData: any = {};
    if (data.acceptsBookings !== undefined) {
      updateData.acceptsBookings = data.acceptsBookings;
    }
    if (data.bookingNoticeMin !== undefined) {
      updateData.bookingNoticeMin = data.bookingNoticeMin;
    }
    if (data.workingHours !== undefined) {
      updateData.workingHours = data.workingHours;
    }

    const updated = await (this.prisma as any).barber.update({
      where: { id: barberId },
      data: updateData,
      select: {
        acceptsBookings: true,
        bookingNoticeMin: true,
        workingHours: true,
      },
    });

    const defaultWH = getDefaultWorkingHours();
    return {
      acceptsBookings: updated.acceptsBookings,
      bookingNoticeMin: updated.bookingNoticeMin,
      workingHours:
        (updated.workingHours as unknown as BarberWorkingHoursConfig) || defaultWH,
    };
  }

  async getBarberAvailability(barberId: string, dateStr?: string) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const settings = await this.getBarberBookingSettings(barberId);

    if (!settings.acceptsBookings) {
      return {
        acceptsBookings: false,
        isWorkingDay: false,
        dayName: '',
        availableSlots: [],
        allSlots: [],
        workingHoursSummary: 'Solo Walk-In (Atención por orden de llegada)',
        workingHours: settings.workingHours,
      };
    }

    // Determine day of week
    let dayOfWeek = 1;
    const match = targetDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const d = parseInt(match[3], 10);
      dayOfWeek = new Date(y, m, d).getDay();
    } else {
      const parsed = new Date(targetDate);
      if (!isNaN(parsed.getTime())) {
        dayOfWeek = parsed.getDay();
      }
    }

    const daySchedule = settings.workingHours.days.find(
      (d) => d.dayOfWeek === dayOfWeek
    );

    if (!daySchedule || !daySchedule.enabled) {
      return {
        acceptsBookings: true,
        isWorkingDay: false,
        dayName: daySchedule?.dayName || 'Descanso',
        availableSlots: [],
        allSlots: [],
        workingHoursSummary: `${daySchedule?.dayName || 'Día'}: Cerrado / Día de descanso`,
        workingHours: settings.workingHours,
      };
    }

    const slotInterval = settings.workingHours.slotIntervalMin || 30;
    const [openH, openM] = daySchedule.openTime.split(':').map(Number);
    const [closeH, closeM] = daySchedule.closeTime.split(':').map(Number);
    const openMin = (openH || 9) * 60 + (openM || 0);
    const closeMin = (closeH || 20) * 60 + (closeM || 0);

    let breakStartMin = -1;
    let breakEndMin = -1;
    if (daySchedule.hasBreak && daySchedule.breakStart && daySchedule.breakEnd) {
      const [bsh, bsm] = daySchedule.breakStart.split(':').map(Number);
      const [beh, bem] = daySchedule.breakEnd.split(':').map(Number);
      breakStartMin = (bsh || 13) * 60 + (bsm || 0);
      breakEndMin = (beh || 14) * 60 + (bem || 0);
    }

    // Get existing bookings for this barber on targetDate
    const existingBookings = await (this.prisma as any).booking.findMany({
      where: {
        barberId,
        date: targetDate,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
      select: { time: true },
    });
    const bookedTimes = new Set<string>(existingBookings.map((b: any) => b.time));

    const allSlots: {
      time: string;
      period: 'manana' | 'tarde' | 'noche';
      available: boolean;
    }[] = [];
    const availableSlots: string[] = [];

    for (let m = openMin; m + slotInterval <= closeMin; m += slotInterval) {
      // If within break window, skip slot
      if (breakStartMin >= 0 && breakEndMin > breakStartMin) {
        if (m >= breakStartMin && m < breakEndMin) {
          continue;
        }
      }

      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      const timeStr = `${hh}:${mm}`;

      const isBooked = bookedTimes.has(timeStr);
      const period: 'manana' | 'tarde' | 'noche' =
        m < 12 * 60 ? 'manana' : m < 18 * 60 ? 'tarde' : 'noche';

      allSlots.push({
        time: timeStr,
        period,
        available: !isBooked,
      });

      if (!isBooked) {
        availableSlots.push(timeStr);
      }
    }

    return {
      acceptsBookings: true,
      isWorkingDay: true,
      dayName: daySchedule.dayName,
      availableSlots,
      allSlots,
      workingHoursSummary: `${daySchedule.openTime} - ${daySchedule.closeTime}${
        daySchedule.hasBreak
          ? ` (Descanso: ${daySchedule.breakStart} - ${daySchedule.breakEnd})`
          : ''
      }`,
      workingHours: settings.workingHours,
    };
  }
}
