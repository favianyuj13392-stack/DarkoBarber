import { getStoredToken } from './auth.service';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

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
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch (err) {
      console.warn('Could not fetch bookings from server:', err);
    }
  }

  // Fallback to local demo list
  const stored = localStorage.getItem('fade_barber_bookings');
  if (stored) {
    try {
      const parsed: BarberBooking[] = JSON.parse(stored);
      if (statusFilter) {
        return parsed.filter((b) => b.status === statusFilter);
      }
      return parsed;
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

  // Local storage update fallback
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

  // Local demo simulation: if there's a confirmed booking scheduled at 17:30
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

  return { acceptsBookings: true, bookingNoticeMin: 15 };
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

  return { acceptsBookings: settings.acceptsBookings ?? true, bookingNoticeMin: settings.bookingNoticeMin ?? 15 };
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
