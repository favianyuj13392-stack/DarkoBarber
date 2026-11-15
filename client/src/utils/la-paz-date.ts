/** Calendar-day helpers pinned to Bolivia time (America/La_Paz, UTC-4, no DST), like the server. */

export interface LaPazCalendarDay {
  /** 'YYYY-MM-DD' */
  fullDate: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  /** 1-12 */
  month: number;
  /** 1-31 */
  day: number;
}

/** 'YYYY-MM-DD' of the given instant on the La Paz calendar. */
export function toLaPazDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** `count` consecutive La Paz calendar days starting from the La Paz "today" of `now`. */
export function getLaPazDays(count: number, now: Date = new Date()): LaPazCalendarDay[] {
  const [y, m, d] = toLaPazDateString(now).split('-').map(Number);
  const days: LaPazCalendarDay[] = [];
  for (let i = 0; i < count; i++) {
    // UTC arithmetic keeps the calendar math independent of the device timezone.
    const utc = new Date(Date.UTC(y, m - 1, d + i));
    const yyyy = utc.getUTCFullYear();
    const mm = utc.getUTCMonth() + 1;
    const dd = utc.getUTCDate();
    days.push({
      fullDate: `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
      weekday: utc.getUTCDay(),
      month: mm,
      day: dd,
    });
  }
  return days;
}
