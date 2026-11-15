/**
 * Pure helpers for booking wall-clock arithmetic. Booking `date` ('YYYY-MM-DD') and
 * `time` ('HH:mm') are La Paz local values (UTC-4, no DST), so everything here works on
 * "La Paz local minutes" instead of Date objects to avoid host-timezone surprises.
 */

import { getLaPazNowParts } from '../../utils/la-paz-date';

const MINUTES_PER_DAY = 1440;
/** La Paz is UTC-4 year-round. */
const LA_PAZ_UTC_OFFSET_MIN = -4 * 60;

/** Days since the Unix epoch of a 'YYYY-MM-DD' calendar date. */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** 0 = Sunday ... 6 = Saturday, for a 'YYYY-MM-DD' calendar date. */
export function dayOfWeekOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 'HH:mm' -> minutes since midnight. */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** minutes since midnight -> 'HH:mm'. */
export function formatMinutes(total: number): string {
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Absolute "La Paz local minutes" of a date + time-of-day, comparable across days. */
export function localMinutes(date: string, minutesOfDay: number): number {
  return dayNumber(date) * MINUTES_PER_DAY + minutesOfDay;
}

/** Absolute La Paz local minutes of an instant. */
export function nowLocalMinutes(now: Date): number {
  const parts = getLaPazNowParts(now);
  return localMinutes(parts.dateString, parts.minutesSinceMidnight);
}

/** UTC instant of a La Paz local date + 'HH:mm'. */
export function laPazLocalToUtc(date: string, time: string): Date {
  return new Date(
    (localMinutes(date, parseTimeToMinutes(time)) - LA_PAZ_UTC_OFFSET_MIN) * 60_000
  );
}

/** True when [aStart, aEnd) and [bStart, bEnd) overlap (touching ranges do not). */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
