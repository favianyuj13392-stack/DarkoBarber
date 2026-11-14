/**
 * Bookings configuration, read from environment variables.
 *
 * Variables (all optional; defaults shown):
 *   BOOKING_MAX_ADVANCE_DAYS=30        how many La Paz calendar days ahead a booking may be made
 *   BOOKING_CANCEL_MIN_HOURS=2         a client cannot cancel closer than this many hours to the start
 *                                      (the barber can always reject/cancel)
 *   BOOKING_MAX_ACTIVE_PER_CLIENT=3    max PENDING/CONFIRMED future bookings per identity
 *                                      (authenticated clientId, otherwise normalized phone)
 *
 * Accessors read process.env on every call so tests can override values.
 */

function positiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export interface BookingsConfig {
  maxAdvanceDays: number;
  cancelMinHours: number;
  maxActivePerClient: number;
}

export function getBookingsConfig(env: NodeJS.ProcessEnv = process.env): BookingsConfig {
  return {
    maxAdvanceDays: positiveInt(env.BOOKING_MAX_ADVANCE_DAYS, 30),
    cancelMinHours: positiveInt(env.BOOKING_CANCEL_MIN_HOURS, 2),
    maxActivePerClient: positiveInt(env.BOOKING_MAX_ACTIVE_PER_CLIENT, 3),
  };
}
