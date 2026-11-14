import { describe, it, expect } from 'vitest';
import { toLaPazDateString, laPazDaysBetween, isSameLaPazDay } from '../src/utils/la-paz-date';

describe('la-paz-date helpers', () => {
  it('formats a mid-day instant as YYYY-MM-DD', () => {
    expect(toLaPazDateString(new Date('2026-11-14T15:00:00Z'))).toBe('2026-11-14');
  });

  it('treats 23:59 La Paz (03:59 UTC next day) as still the same La Paz day', () => {
    expect(toLaPazDateString(new Date('2026-11-15T03:59:59Z'))).toBe('2026-11-14');
  });

  it('rolls over at 00:00 La Paz == 04:00 UTC', () => {
    expect(toLaPazDateString(new Date('2026-11-15T03:59:59.999Z'))).toBe('2026-11-14');
    expect(toLaPazDateString(new Date('2026-11-15T04:00:00Z'))).toBe('2026-11-15');
  });

  it('20:00 La Paz on a day is 00:00 UTC of the next day yet remains the same La Paz day', () => {
    // 20:00 La Paz (UTC-4) == 00:00 UTC next day
    expect(toLaPazDateString(new Date('2026-11-15T00:00:00Z'))).toBe('2026-11-14');
  });

  it('handles month and year boundaries', () => {
    expect(toLaPazDateString(new Date('2027-01-01T03:30:00Z'))).toBe('2026-12-31');
    expect(toLaPazDateString(new Date('2027-01-01T04:00:00Z'))).toBe('2027-01-01');
  });

  it('computes calendar-day differences on La Paz dates, not elapsed hours', () => {
    const lateNight = new Date('2026-11-15T03:50:00Z'); // 23:50 on the 14th
    const justAfterMidnight = new Date('2026-11-15T04:10:00Z'); // 00:10 on the 15th
    expect(laPazDaysBetween(lateNight, justAfterMidnight)).toBe(1);
    expect(laPazDaysBetween(justAfterMidnight, lateNight)).toBe(-1);
    expect(laPazDaysBetween(new Date('2026-11-14T13:00:00Z'), new Date('2026-11-15T01:00:00Z'))).toBe(0);
    expect(laPazDaysBetween(new Date('2026-11-14T13:00:00Z'), new Date('2026-11-17T13:00:00Z'))).toBe(3);
  });

  it('isSameLaPazDay compares La Paz dates', () => {
    expect(isSameLaPazDay(new Date('2026-11-14T10:00:00Z'), new Date('2026-11-15T03:00:00Z'))).toBe(true);
    expect(isSameLaPazDay(new Date('2026-11-14T10:00:00Z'), new Date('2026-11-15T05:00:00Z'))).toBe(false);
  });
});
