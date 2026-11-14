import { describe, it, expect } from 'vitest';
import {
  toLaPazDateString,
  laPazDaysBetween,
  isSameLaPazDay,
  getLaPazNowParts,
} from '../src/utils/la-paz-date';

describe('getLaPazNowParts', () => {
  it('2026-11-13T00:30:00Z is 2026-11-12 20:30 La Paz', () => {
    expect(getLaPazNowParts(new Date('2026-11-13T00:30:00Z'))).toEqual({
      dateString: '2026-11-12',
      hour: 20,
      minute: 30,
      minutesSinceMidnight: 1230,
    });
  });

  it('2026-11-13T03:59:59Z is 2026-11-12 23:59 La Paz', () => {
    const p = getLaPazNowParts(new Date('2026-11-13T03:59:59Z'));
    expect(p.dateString).toBe('2026-11-12');
    expect(p.hour).toBe(23);
    expect(p.minute).toBe(59);
    expect(p.minutesSinceMidnight).toBe(1439);
  });

  it('2026-11-13T04:00:00Z is midnight (hour 0, not 24) of the next La Paz day', () => {
    expect(getLaPazNowParts(new Date('2026-11-13T04:00:00Z'))).toEqual({
      dateString: '2026-11-13',
      hour: 0,
      minute: 0,
      minutesSinceMidnight: 0,
    });
  });
});

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
