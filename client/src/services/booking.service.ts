import { getStoredToken } from './auth.service';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

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

const DEMO_BOOKINGS: BarberBooking[] = [
  {
    id: 'demo-bk-1',
    barberId: 'barber-brian',
    clientName: 'Carlos Mendizábal',
    clientPhone: '+591 78945612',
    serviceName: 'Low Fade Texturizado + Perfilado',
    servicePriceBs: 75,
    durationMin: 45,
    date: 'Hoy',
    time: '17:30',
    status: 'CONFIRMED',
    notes: 'Cliente puntual, prefiere tijera en la cúspide.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-bk-2',
    barberId: 'barber-brian',
    clientName: 'Andrés Villagómez',
    clientPhone: '+591 76543210',
    serviceName: 'Corte Clásico & Fade',
    servicePriceBs: 50,
    durationMin: 35,
    date: 'Hoy',
    time: '19:00',
    status: 'PENDING',
    notes: 'Primera vez en Fade Studio.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'demo-bk-3',
    barberId: 'barber-brian',
    clientName: 'Rodrigo Torrico',
    clientPhone: '+591 71239874',
    serviceName: 'Combo Fade + Barba Spa',
    servicePriceBs: 85,
    durationMin: 50,
    date: 'Mañana',
    time: '11:00',
    status: 'CONFIRMED',
    notes: 'Piel sensible en cuello.',
    createdAt: new Date().toISOString(),
  },
];

export async function fetchBarberBookings(statusFilter?: BookingStatus): Promise<BarberBooking[]> {
  const token = getStoredToken();
  if (token) {
    try {
      const url = statusFilter
        ? `/api/barbers/me/bookings?status=${statusFilter}`
        : '/api/barbers/me/bookings';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not fetch bookings from server:', err);
    }
  }

  // Fallback demo data
  const stored = localStorage.getItem('fade_barber_bookings');
  if (stored) {
    try {
      const parsed: BarberBooking[] = JSON.parse(stored);
      return statusFilter ? parsed.filter((b) => b.status === statusFilter) : parsed;
    } catch {
      // ignore
    }
  }

  localStorage.setItem('fade_barber_bookings', JSON.stringify(DEMO_BOOKINGS));
  return statusFilter ? DEMO_BOOKINGS.filter((b) => b.status === statusFilter) : DEMO_BOOKINGS;
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  cancelReason?: string
): Promise<BarberBooking> {
  const token = getStoredToken();
  if (token) {
    try {
      const res = await fetch(`/api/barbers/me/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, cancelReason }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not update booking status on server:', err);
    }
  }

  // Local optimistic update
  const list = await fetchBarberBookings();
  const index = list.findIndex((b) => b.id === bookingId);
  if (index !== -1) {
    list[index].status = status;
    if (cancelReason) list[index].cancelReason = cancelReason;
    localStorage.setItem('fade_barber_bookings', JSON.stringify(list));
    return list[index];
  }
  throw new Error('Reserva no encontrada');
}

export async function fetchUpcomingBookingAlert(): Promise<UpcomingBookingAlert> {
  const token = getStoredToken();
  if (token) {
    try {
      const res = await fetch('/api/barbers/me/bookings/upcoming-alert', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('Could not fetch upcoming booking alert:', err);
    }
  }

  return {
    hasUpcoming: true,
    minutesLeft: 14,
    booking: DEMO_BOOKINGS[0],
  };
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
  date?: string
): Promise<BarberAvailabilityResponse> {
  try {
    const url = date
      ? `/api/barbers/${barberId}/bookings/availability?date=${encodeURIComponent(date)}`
      : `/api/barbers/${barberId}/bookings/availability`;
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch barber availability from server:', err);
  }

  return {
    acceptsBookings: true,
    isWorkingDay: true,
    dayName: 'Hoy',
    availableSlots: ['09:30', '11:30', '14:00', '16:00', '17:00', '18:30', '19:30'],
    allSlots: [
      { time: '09:30', period: 'manana', available: true },
      { time: '10:30', period: 'manana', available: false },
      { time: '11:30', period: 'manana', available: true },
      { time: '14:00', period: 'tarde', available: true },
      { time: '15:00', period: 'tarde', available: false },
      { time: '16:00', period: 'tarde', available: true },
      { time: '17:00', period: 'tarde', available: true },
      { time: '17:45', period: 'tarde', available: false },
      { time: '18:30', period: 'noche', available: true },
      { time: '19:30', period: 'noche', available: true },
    ],
    workingHoursSummary: '09:00 - 20:00 (Descanso: 13:00 - 14:00)',
    workingHours: getDefaultWorkingHours(),
  };
}

export async function createClientBooking(data: {
  barberId: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  servicePriceBs: number;
  durationMin?: number;
  date: string;
  time: string;
  notes?: string;
}): Promise<BarberBooking> {
  const token = getStoredToken();
  try {
    const res = await fetch(`/api/barbers/${data.barberId}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not create booking on server:', err);
  }

  // Local optimistic creation
  const newBooking: BarberBooking = {
    id: `bk-${Date.now()}`,
    barberId: data.barberId,
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    serviceName: data.serviceName,
    servicePriceBs: data.servicePriceBs,
    durationMin: data.durationMin || 30,
    date: data.date,
    time: data.time,
    status: 'PENDING',
    notes: data.notes,
    createdAt: new Date().toISOString(),
  };

  const list = await fetchBarberBookings();
  const updated = [newBooking, ...list];
  localStorage.setItem('fade_barber_bookings', JSON.stringify(updated));
  return newBooking;
}
