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

/** True when both instants fall on the same La Paz calendar day. */
export function isSameLaPazDay(a: Date, b: Date): boolean {
  return toLaPazDateString(a) === toLaPazDateString(b);
}
