import { PrismaClient, BookingStatus } from '@prisma/client';
import { getLaPazNowParts, toLaPazDateString } from '../../utils/la-paz-date';
import { AppError } from '../../utils/errors';
import { getBookingsConfig } from './bookings.config';
import { normalizePhone } from './bookings.schemas';
import {
  dayNumber,
  dayOfWeekOf,
  laPazLocalToUtc,
  localMinutes,
  nowLocalMinutes,
  parseTimeToMinutes,
  rangesOverlap,
} from './bookings.time';

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
  /** Authenticated client id (from the token). Never taken from the request body. */
  clientId?: string | null;
  /** Contact data supplied in the body; used when the client profile lacks it (or anonymous). */
  clientName?: string;
  clientPhone?: string;
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
}

/** Working-day window of a barber for one date, in minutes since midnight. */
export interface DayWindow {
  dayName: string;
  openMin: number;
  closeMin: number;
  breakStartMin: number; // -1 when there is no break
  breakEndMin: number;
  slotIntervalMin: number;
}

/**
 * Resolves the barber's schedule for a 'YYYY-MM-DD' date, or null when it is a rest day.
 * Single source of truth for both slot generation and booking validation.
 */
export function resolveDayWindow(
  workingHours: BarberWorkingHoursConfig,
  date: string
): DayWindow | null {
  const daySchedule = workingHours.days.find((d) => d.dayOfWeek === dayOfWeekOf(date));
  if (!daySchedule || !daySchedule.enabled) return null;

  const openMin = parseTimeToMinutes(daySchedule.openTime);
  const closeMin = parseTimeToMinutes(daySchedule.closeTime);
  let breakStartMin = -1;
  let breakEndMin = -1;
  if (daySchedule.hasBreak && daySchedule.breakStart && daySchedule.breakEnd) {
    const bs = parseTimeToMinutes(daySchedule.breakStart);
    const be = parseTimeToMinutes(daySchedule.breakEnd);
    if (be > bs) {
      breakStartMin = bs;
      breakEndMin = be;
    }
  }
  return {
    dayName: daySchedule.dayName,
    openMin,
    closeMin,
    breakStartMin,
    breakEndMin,
    slotIntervalMin: workingHours.slotIntervalMin || 30,
  };
}

export class BookingsService {
  constructor(private prisma: PrismaClient) {}

  async getBarberBookings(
    barberId: string,
    statusFilter?: BookingStatus,
    now: Date = new Date()
  ) {
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
      const todayStr = toLaPazDateString(now);
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

  /**
   * Creates a PENDING booking. Price, duration and service name always come from the
   * barber's BarberService (never from the client). `now` is injectable for tests.
   */
  async createBooking(input: CreateBookingInput, now: Date = new Date()) {
    const config = getBookingsConfig();

    const barber = await this.prisma.barber.findUnique({
      where: { id: input.barberId },
      select: { id: true, acceptsBookings: true, bookingNoticeMin: true, workingHours: true },
    });
    if (!barber) {
      throw new AppError('BARBER_NOT_FOUND', 'Barbero no encontrado', 404);
    }
    if (!barber.acceptsBookings) {
      throw new AppError(
        'BOOKINGS_DISABLED',
        'Este barbero no está aceptando reservas programadas en este momento',
        409
      );
    }

    const barberService = await this.prisma.barberService.findFirst({
      where: { id: input.serviceId, barberId: barber.id, isActive: true },
    });
    if (!barberService) {
      throw new AppError('SERVICE_NOT_FOUND', 'El servicio no existe o no está disponible', 404);
    }

    const contact = await this.resolveContact(input);

    // --- Time rules (all La Paz wall-clock) ---
    const startMin = parseTimeToMinutes(input.time);
    const endMin = startMin + barberService.durationMin;
    const startLocal = localMinutes(input.date, startMin);
    const nowLocal = nowLocalMinutes(now);

    if (startLocal <= nowLocal) {
      throw new AppError('BOOKING_IN_PAST', 'No se puede reservar en una fecha u hora pasada', 400);
    }
    const noticeMin = barber.bookingNoticeMin ?? 0;
    if (startLocal < nowLocal + noticeMin) {
      throw new AppError(
        'BOOKING_TOO_SOON',
        `Este barbero requiere al menos ${noticeMin} minutos de anticipación`,
        400
      );
    }
    const today = getLaPazNowParts(now).dateString;
    if (dayNumber(input.date) - dayNumber(today) > config.maxAdvanceDays) {
      throw new AppError(
        'BOOKING_TOO_FAR',
        `Solo se puede reservar con hasta ${config.maxAdvanceDays} días de anticipación`,
        400
      );
    }

    // --- Working hours ---
    const workingHours =
      (barber.workingHours as unknown as BarberWorkingHoursConfig) || getDefaultWorkingHours();
    const window = resolveDayWindow(workingHours, input.date);
    if (!window) {
      throw new AppError('BARBER_NOT_WORKING', 'El barbero no atiende ese día', 409);
    }
    if (startMin < window.openMin || endMin > window.closeMin) {
      throw new AppError(
        'OUTSIDE_WORKING_HOURS',
        'El horario elegido queda fuera del horario de atención',
        409
      );
    }
    if (
      window.breakStartMin >= 0 &&
      rangesOverlap(startMin, endMin, window.breakStartMin, window.breakEndMin)
    ) {
      throw new AppError(
        'OUTSIDE_WORKING_HOURS',
        'El horario elegido coincide con el descanso del barbero',
        409
      );
    }
    if ((startMin - window.openMin) % window.slotIntervalMin !== 0) {
      throw new AppError('INVALID_SLOT', 'El horario elegido no es un turno válido', 400);
    }

    return (this.prisma as any).booking.create({
      data: {
        barberId: barber.id,
        clientId: contact.clientId,
        clientName: contact.name,
        clientPhone: contact.phone,
        serviceName: barberService.name,
        servicePriceBs: barberService.priceBs,
        durationMin: barberService.durationMin,
        date: input.date,
        time: input.time,
        scheduledAt: laPazLocalToUtc(input.date, input.time),
        status: BookingStatus.PENDING,
        notes: input.notes || null,
      },
    });
  }

  /**
   * Contact identity: an authenticated client's profile wins over body data (a body
   * clientId is never trusted); anonymous requests must supply name + phone.
   */
  private async resolveContact(
    input: CreateBookingInput
  ): Promise<{ clientId: string | null; name: string; phone: string }> {
    let clientId: string | null = null;
    let profileName: string | undefined;
    let profilePhone: string | undefined;

    if (input.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: input.clientId },
        select: { id: true, displayName: true, phone: true },
      });
      if (client) {
        clientId = client.id;
        profileName = client.displayName?.trim() || undefined;
        if (client.phone) profilePhone = normalizePhone(client.phone) ?? client.phone;
      }
    }

    let bodyPhone: string | undefined;
    if (input.clientPhone) {
      const normalized = normalizePhone(input.clientPhone);
      if (!normalized) {
        throw new AppError('INVALID_PHONE', 'El teléfono no es válido', 400);
      }
      bodyPhone = normalized;
    }

    const name = profileName || input.clientName?.trim();
    const phone = profilePhone || bodyPhone;
    if (!name || !phone) {
      throw new AppError(
        'CONTACT_REQUIRED',
        'Se requieren nombre y teléfono para reservar sin iniciar sesión',
        400
      );
    }
    return { clientId, name, phone };
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

  /**
   * Walk-in synergy alert. "Today" and "now" are La Paz wall-clock values
   * (bookings store date/time as La Paz local strings). Only same-day bookings
   * are considered: a booking just after midnight never alerts the previous day.
   */
  async getUpcomingAlert(barberId: string, now: Date = new Date()) {
    const { dateString: todayStr, minutesSinceMidnight: nowMinutesTotal } =
      getLaPazNowParts(now);

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

  async getBarberAvailability(barberId: string, dateStr?: string, now: Date = new Date()) {
    const targetDate = dateStr || toLaPazDateString(now);
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
