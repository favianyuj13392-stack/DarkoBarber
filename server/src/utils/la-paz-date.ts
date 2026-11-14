/**
 * Calendar-day helpers pinned to Bolivia time (America/La_Paz, UTC-4, no DST).
 * All "calendar day" business logic (rate limits, reward qualification) must use
 * these helpers instead of UTC date slicing.
 */

export const LA_PAZ_TIME_ZONE = 'America/La_Paz';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LA_PAZ_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Returns the La Paz calendar date of an instant as 'YYYY-MM-DD'. */
export function toLaPazDateString(date: Date): string {
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Whole calendar days from `from` to `to`, measured on La Paz dates
 * (positive when `to` is on a later La Paz day).
 */
export function laPazDaysBetween(from: Date, to: Date): number {
  const toUtcDay = (d: Date) => {
    const [y, m, day] = toLaPazDateString(d).split('-').map(Number);
    return Date.UTC(y, m - 1, day) / 86_400_000;
  };
  return Math.round(toUtcDay(to) - toUtcDay(from));
}

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LA_PAZ_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface LaPazNowParts {
  /** La Paz calendar date, 'YYYY-MM-DD'. */
  dateString: string;
  /** La Paz hour of day, 0-23. */
  hour: number;
  /** La Paz minute, 0-59. */
  minute: number;
  /** Minutes elapsed since 00:00 La Paz on `dateString`. */
  minutesSinceMidnight: number;
}

/** Wall-clock parts of an instant in La Paz time. `now` is injectable for tests. */
export function getLaPazNowParts(now: Date = new Date()): LaPazNowParts {
  const parts = clockFormatter.formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const hour = get('hour');
  const minute = get('minute');
  return {
    dateString: toLaPazDateString(now),
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

/**
 * UTC instant of 00:00 La Paz on the 1st of the La Paz calendar month containing `now`.
 * La Paz is UTC-4 year-round, so this is 04:00 UTC on that day.
 */
export function laPazMonthStartUtc(now: Date = new Date()): Date {
  const [y, m] = toLaPazDateString(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1, 4, 0, 0, 0));
}

/** True when both instants fall on the same La Paz calendar day. */
export function isSameLaPazDay(a: Date, b: Date): boolean {
  return toLaPazDateString(a) === toLaPazDateString(b);
}
