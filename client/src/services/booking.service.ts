import { getStoredToken } from './auth.service';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'NO_SHOW';

/** Error returned by the bookings API: `code` is the server error code (e.g. SLOT_TAKEN). */
export class BookingApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number = 0) {
    super(message);
    this.name = 'BookingApiError';
    this.code = code;
    this.status = status;
  }
}

const BOOKING_ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Revisa los datos de la reserva e inténtalo de nuevo.',
  CONTACT_REQUIRED: 'Ingresa tu nombre y un teléfono válido para reservar.',
  INVALID_PHONE: 'El teléfono no es válido.',
  BOOKING_IN_PAST: 'Ese horario ya pasó. Elige otro turno.',
  BOOKING_TOO_SOON: 'Ese turno es demasiado próximo. Elige uno con más anticipación.',
  BOOKING_TOO_FAR: 'Esa fecha queda demasiado lejos para reservar. Elige una más cercana.',
  BARBER_NOT_WORKING: 'El barbero no atiende ese día.',
  OUTSIDE_WORKING_HOURS: 'Ese horario queda fuera del horario de atención del barbero.',
  INVALID_SLOT: 'Ese horario no es un turno válido.',
  SLOT_TAKEN: 'Ese turno acaba de ser reservado por otra persona. Elige otro horario.',
  TOO_MANY_ACTIVE_BOOKINGS:
    'Ya tienes el máximo de reservas activas. Cancela alguna o espera a que se complete.',
  SERVICE_NOT_FOUND: 'El servicio elegido ya no está disponible.',
  BARBER_NOT_FOUND: 'No encontramos a este barbero.',
  BOOKINGS_DISABLED: 'Este barbero no está aceptando reservas programadas.',
  BOOKING_NOT_FOUND: 'No encontramos esa reserva.',
  INVALID_TRANSITION: 'Esa reserva ya cambió de estado. Actualiza la bandeja.',
  BOOKING_NOT_STARTED: 'Solo puedes marcar la cita como atendida o ausente después de su hora.',
  TOO_LATE_TO_CANCEL: 'Ya no se puede cancelar: contacta directamente al barbero.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión.',
};

/** Human-readable (Spanish) message for any error thrown by the bookings API helpers. */
export function bookingErrorMessage(err: unknown): string {
  if (err instanceof BookingApiError) {
    return BOOKING_ERROR_MESSAGES[err.code] ?? err.message ?? 'No se pudo completar la operación.';
  }
  return 'No se pudo completar la operación.';
}

async function toBookingApiError(res: Response): Promise<BookingApiError> {
  let code = 'UNKNOWN';
  let message = 'No se pudo completar la operación.';
  try {
    const body = await res.json();
    if (body?.error) code = String(body.error);
    if (body?.message) message = String(body.message);
  } catch {
    // non-JSON error body
  }
  return new BookingApiError(code, message, res.status);
}


export interface DaySchedule {
  dayOfWeek: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  dayName: string;
  enabled: boolean;
  openTime: string;
  closeTime: string;
  hasBreak: boolean;
  breakStart?: string;
  breakEnd?: string;
}

export interface BarberWorkingHoursConfig {
  days: DaySchedule[];
  slotIntervalMin: number;
}

export interface BarberBooking {
  id: string;
  barberId: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  servicePriceBs: number;
  durationMin: number;
  date: string;
  time: string;
  status: BookingStatus;
  notes?: string;
  cancelReason?: string;
  createdAt: string;
}

export interface UpcomingBookingAlert {
  hasUpcoming: boolean;
  minutesLeft: number;
  booking: BarberBooking | null;
}

export interface BarberBookingSettings {
  acceptsBookings: boolean;
  bookingNoticeMin: number;
  workingHours?: BarberWorkingHoursConfig;
}

export interface SlotInfo {
  time: string;
  period: 'manana' | 'tarde' | 'noche';
  available: boolean;
}

export interface BarberAvailabilityResponse {
  acceptsBookings: boolean;
  isWorkingDay: boolean;
  dayName?: string;
  availableSlots: string[];
  allSlots: SlotInfo[];
  workingHoursSummary: string;
  workingHours?: BarberWorkingHoursConfig;
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

export async function fetchBarberBookings(statusFilter?: BookingStatus): Promise<BarberBooking[]> {
  const token = getStoredToken();
  if (!token) return [];
  const url = statusFilter
    ? `/api/barbers/me/bookings?status=${statusFilter}`
    : '/api/barbers/me/bookings';
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new BookingApiError('NETWORK_ERROR', 'Network error');
  }
  if (!res.ok) throw await toBookingApiError(res);
  return res.json();
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  cancelReason?: string
): Promise<BarberBooking> {
  const token = getStoredToken();
  if (!token) throw new BookingApiError('UNAUTHORIZED', 'Sesión no iniciada', 401);
  let res: Response;
  try {
    res = await fetch(`/api/barbers/me/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, cancelReason }),
    });
  } catch {
    throw new BookingApiError('NETWORK_ERROR', 'Network error');
  }
  if (!res.ok) throw await toBookingApiError(res);
  return res.json();
}

export async function fetchUpcomingBookingAlert(): Promise<UpcomingBookingAlert> {
  const none: UpcomingBookingAlert = { hasUpcoming: false, minutesLeft: 0, booking: null };
  const token = getStoredToken();
  if (!token) return none;
  try {
    const res = await fetch('/api/barbers/me/bookings/upcoming-alert', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Could not fetch upcoming booking alert:', err);
  }
  return none;
}

export async function fetchBookingSettings(barberId?: string): Promise<BarberBookingSettings> {
  const token = getStoredToken();
  try {
    const url = barberId
      ? `/api/barbers/${barberId}/bookings/availability`
      : '/api/barbers/me/booking-settings';
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch booking settings:', err);
  }

  return {
    acceptsBookings: true,
    bookingNoticeMin: 15,
    workingHours: getDefaultWorkingHours(),
  };
}

export async function updateBookingSettings(
  settings: Partial<BarberBookingSettings>
): Promise<BarberBookingSettings> {
  const token = getStoredToken();
  if (token) {
    try {
      const res = await fetch('/api/barbers/me/booking-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not update booking settings:', err);
    }
  }

  return {
    acceptsBookings: settings.acceptsBookings ?? true,
    bookingNoticeMin: settings.bookingNoticeMin ?? 15,
    workingHours: settings.workingHours ?? getDefaultWorkingHours(),
  };
}

export async function fetchBarberAvailability(
  barberId: string,
  date?: string,
  serviceId?: string
): Promise<BarberAvailabilityResponse> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (serviceId) params.set('serviceId', serviceId);
  const qs = params.toString();
  let res: Response;
  try {
    res = await fetch(`/api/barbers/${barberId}/bookings/availability${qs ? `?${qs}` : ''}`);
  } catch {
    throw new BookingApiError('NETWORK_ERROR', 'Network error');
  }
  if (!res.ok) throw await toBookingApiError(res);
  return res.json();
}

/**
 * Creates a booking. Price and duration are decided by the server from `serviceId`.
 * `clientName` / `clientPhone` are only needed when the user is not signed in as a client.
 */
export async function createClientBooking(data: {
  barberId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD (La Paz)
  time: string; // HH:mm (La Paz)
  notes?: string;
  clientName?: string;
  clientPhone?: string;
}): Promise<BarberBooking> {
  const token = getStoredToken();
  const { barberId, ...body } = data;
  let res: Response;
  try {
    res = await fetch(`/api/barbers/${barberId}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BookingApiError('NETWORK_ERROR', 'Network error');
  }
  if (!res.ok) throw await toBookingApiError(res);
  return res.json();
}
