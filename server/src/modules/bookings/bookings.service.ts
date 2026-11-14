import { PrismaClient, BookingStatus } from '@prisma/client';
import { getLaPazNowParts, toLaPazDateString } from '../../utils/la-paz-date';
import { AppError } from '../../utils/errors';
import { getBookingsConfig } from './bookings.config';
import { isRealCalendarDate, normalizePhone } from './bookings.schemas';
import {
  dayNumber,
  dayOfWeekOf,
  formatMinutes,
  laPazLocalToUtc,
  localMinutes,
  nowLocalMinutes,
  parseTimeToMinutes,
  rangesOverlap,
} from './bookings.time';
import { CLIENT_CANCELLABLE_FROM, REQUIRES_START_PASSED, canTransition } from './bookings.status';

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

/** Statuses that hold a slot and count toward a client's active-bookings cap. */
export const ACTIVE_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

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

    const scheduledAt = laPazLocalToUtc(input.date, input.time);
    const identityWhere = contact.clientId
      ? { clientId: contact.clientId }
      : { clientId: null, clientPhone: contact.phone };
    const identityKey = contact.clientId ? `client:${contact.clientId}` : `phone:${contact.phone}`;
    const nowParts = getLaPazNowParts(now);
    const nowTime = formatMinutes(nowParts.minutesSinceMidnight);

    return this.prisma.$transaction(async (tx) => {
      // Serialize every booking write for this barber (and for this client identity) so two
      // concurrent requests cannot both pass the checks below. Lock order is always
      // barber -> identity, which rules out deadlocks. Both are transaction-scoped.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`barber:${barber.id}`}, 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-identity:${identityKey}`}, 0))`;

      const sameDay = await tx.booking.findMany({
        where: {
          barberId: barber.id,
          date: input.date,
          status: { in: ACTIVE_STATUSES },
        },
        select: { time: true, durationMin: true },
      });
      const clash = sameDay.some((b) => {
        const bStart = parseTimeToMinutes(b.time);
        return rangesOverlap(startMin, endMin, bStart, bStart + b.durationMin);
      });
      if (clash) {
        throw new AppError('SLOT_TAKEN', 'Ese horario ya no está disponible', 409);
      }

      const activeCount = await tx.booking.count({
        where: {
          ...identityWhere,
          status: { in: ACTIVE_STATUSES },
          OR: [
            { date: { gt: nowParts.dateString } },
            { date: nowParts.dateString, time: { gt: nowTime } },
          ],
        },
      });
      if (activeCount >= config.maxActivePerClient) {
        throw new AppError(
          'TOO_MANY_ACTIVE_BOOKINGS',
          `Ya tienes ${config.maxActivePerClient} reservas activas. Cancela o completa alguna antes de reservar otra`,
          409
        );
      }

      return tx.booking.create({
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
          scheduledAt,
          status: BookingStatus.PENDING,
          notes: input.notes || null,
        },
      });
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

  /**
   * Barber-driven status change. Ownership is verified (a booking of another barber is
   * reported as not found) and the transition must be allowed by the state machine.
   * COMPLETED / NO_SHOW additionally require the appointment start to have passed.
   */
  async updateBookingStatus(
    barberId: string,
    bookingId: string,
    status: BookingStatus,
    cancelReason?: string,
    now: Date = new Date()
  ) {
    const existing = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existing || existing.barberId !== barberId) {
      throw new AppError('BOOKING_NOT_FOUND', 'Reserva no encontrada', 404);
    }

    this.assertTransition(existing, status, now);
    return this.applyTransition(existing.id, existing.status, status, cancelReason);
  }

  /**
   * Client-driven cancellation of their own booking (PENDING or CONFIRMED), allowed only
   * while at least BOOKING_CANCEL_MIN_HOURS remain before the start.
   */
  async cancelBookingAsClient(
    clientId: string,
    bookingId: string,
    cancelReason?: string,
    now: Date = new Date()
  ) {
    const existing = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existing || !existing.clientId || existing.clientId !== clientId) {
      throw new AppError('BOOKING_NOT_FOUND', 'Reserva no encontrada', 404);
    }
    if (!CLIENT_CANCELLABLE_FROM.includes(existing.status)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `No se puede cancelar una reserva en estado ${existing.status}`,
        409
      );
    }

    const { cancelMinHours } = getBookingsConfig();
    const minutesToStart = this.startLocalMinutes(existing) - nowLocalMinutes(now);
    if (minutesToStart < cancelMinHours * 60) {
      throw new AppError(
        'TOO_LATE_TO_CANCEL',
        `Solo puedes cancelar con al menos ${cancelMinHours} horas de anticipación. Contacta al barbero`,
        409
      );
    }

    return this.applyTransition(existing.id, existing.status, BookingStatus.CANCELLED, cancelReason);
  }

  /** Client's own bookings (upcoming and past), newest first, with barber and service names. */
  async getClientBookings(clientId: string, now: Date = new Date()) {
    const rows = await this.prisma.booking.findMany({
      where: { clientId },
      include: { barber: { select: { displayName: true } } },
      orderBy: [{ date: 'desc' }, { time: 'desc' }, { createdAt: 'desc' }],
    });
    const nowLocal = nowLocalMinutes(now);
    const { cancelMinHours } = getBookingsConfig();

    return rows.map((b) => {
      const minutesToStart = this.startLocalMinutes(b) - nowLocal;
      return {
        id: b.id,
        barberId: b.barberId,
        barberName: b.barber.displayName,
        serviceName: b.serviceName,
        servicePriceBs: b.servicePriceBs,
        durationMin: b.durationMin,
        date: b.date,
        time: b.time,
        status: b.status,
        notes: b.notes,
        cancelReason: b.cancelReason,
        createdAt: b.createdAt,
        isUpcoming: minutesToStart > 0,
        canCancel:
          CLIENT_CANCELLABLE_FROM.includes(b.status) && minutesToStart >= cancelMinHours * 60,
      };
    });
  }

  private startLocalMinutes(b: { date: string; time: string }): number {
    return localMinutes(b.date, parseTimeToMinutes(b.time));
  }

  private assertTransition(
    booking: { status: BookingStatus; date: string; time: string },
    target: BookingStatus,
    now: Date
  ) {
    if (!canTransition(booking.status, target)) {
      throw new AppError(
        'INVALID_TRANSITION',
        `No se puede pasar una reserva de ${booking.status} a ${target}`,
        409
      );
    }
    if (
      REQUIRES_START_PASSED.includes(target) &&
      this.startLocalMinutes(booking) > nowLocalMinutes(now)
    ) {
      throw new AppError(
        'BOOKING_NOT_STARTED',
        'Solo puedes marcar la reserva como completada o ausente después de su hora de inicio',
        409
      );
    }
  }

  /** Compare-and-set on the current status so two racing updates cannot both apply. */
  private async applyTransition(
    id: string,
    from: BookingStatus,
    to: BookingStatus,
    cancelReason?: string
  ) {
    const result = await this.prisma.booking.updateMany({
      where: { id, status: from },
      data: { status: to, ...(cancelReason ? { cancelReason } : {}) },
    });
    if (result.count === 0) {
      throw new AppError('INVALID_TRANSITION', 'La reserva cambió de estado, vuelve a intentarlo', 409);
    }
    return this.prisma.booking.findUniqueOrThrow({ where: { id } });
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

  /**
   * Slot grid for one La Paz date. A slot is available only when a booking of
   * `serviceId`'s duration (or one grid interval when omitted) starting there would be
   * accepted by createBooking: it must fit before closing, avoid the break, not overlap
   * any PENDING/CONFIRMED booking (using each booking's real duration), and respect the
   * barber's notice time, the past, and the advance window. `now` is injectable.
   */
  async getBarberAvailability(
    barberId: string,
    dateStr?: string,
    now: Date = new Date(),
    opts: { serviceId?: string } = {}
  ) {
    const nowParts = getLaPazNowParts(now);
    const targetDate = dateStr || nowParts.dateString;
    if (!isRealCalendarDate(targetDate)) {
      throw new AppError('INVALID_DATE', 'La fecha debe tener el formato YYYY-MM-DD', 400);
    }
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

    const daySchedule = settings.workingHours.days.find(
      (d) => d.dayOfWeek === dayOfWeekOf(targetDate)
    );
    const window = resolveDayWindow(settings.workingHours, targetDate);

    if (!window || !daySchedule) {
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

    let durationMin = window.slotIntervalMin;
    if (opts.serviceId) {
      const svc = await this.prisma.barberService.findFirst({
        where: { id: opts.serviceId, barberId, isActive: true },
        select: { durationMin: true },
      });
      if (svc) durationMin = svc.durationMin;
    }

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        barberId,
        date: targetDate,
        status: { in: ACTIVE_STATUSES },
      },
      select: { time: true, durationMin: true },
    });
    const busy = existingBookings.map((b) => {
      const start = parseTimeToMinutes(b.time);
      return { start, end: start + b.durationMin };
    });

    const config = getBookingsConfig();
    const nowLocal = nowLocalMinutes(now);
    const tooFar = dayNumber(targetDate) - dayNumber(nowParts.dateString) > config.maxAdvanceDays;

    const allSlots: {
      time: string;
      period: 'manana' | 'tarde' | 'noche';
      available: boolean;
    }[] = [];
    const availableSlots: string[] = [];

    for (let m = window.openMin; m + window.slotIntervalMin <= window.closeMin; m += window.slotIntervalMin) {
      // Slots that start inside the break are not offered at all.
      if (window.breakStartMin >= 0 && m >= window.breakStartMin && m < window.breakEndMin) {
        continue;
      }

      const end = m + durationMin;
      const startLocal = localMinutes(targetDate, m);
      const blocked =
        tooFar ||
        end > window.closeMin ||
        (window.breakStartMin >= 0 &&
          rangesOverlap(m, end, window.breakStartMin, window.breakEndMin)) ||
        startLocal <= nowLocal ||
        startLocal < nowLocal + settings.bookingNoticeMin ||
        busy.some((b) => rangesOverlap(m, end, b.start, b.end));

      const timeStr = formatMinutes(m);
      const period: 'manana' | 'tarde' | 'noche' =
        m < 12 * 60 ? 'manana' : m < 18 * 60 ? 'tarde' : 'noche';

      allSlots.push({ time: timeStr, period, available: !blocked });
      if (!blocked) availableSlots.push(timeStr);
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
