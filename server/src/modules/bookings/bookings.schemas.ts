import { z } from 'zod';
import { BOOKING_STATUSES } from './bookings.status';

/** True when 'YYYY-MM-DD' is a real calendar date (rejects 2026-02-30, 2026-13-01, ...). */
export function isRealCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Normalizes a Bolivian phone number to '+591XXXXXXXX' (8 local digits).
 * Accepts spaces, dashes, parentheses and an optional +591 / 591 prefix.
 * Returns null when the number does not look like a valid 8-digit local number.
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('591')) digits = digits.slice(3);
  if (!/^\d{8}$/.test(digits)) return null;
  return `+591${digits}`;
}

/** Max services that can be combined in one booking (one booking = one cut). */
export const MAX_SERVICES_PER_BOOKING = 5;

const serviceIdsSchema = z
  .array(z.string().trim().min(1).max(64))
  .min(1)
  .max(MAX_SERVICES_PER_BOOKING * 4) // hard cap before dedupe, to bound work on junk input
  .transform((ids) => [...new Set(ids)])
  .pipe(z.array(z.string()).min(1).max(MAX_SERVICES_PER_BOOKING));

function timeHHmm(field: string) {
  return z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: `${field} must be HH:mm (24h)` });
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export const createBookingSchema = z.object({
  serviceIds: serviceIdsSchema,
  date: z
    .string()
    .refine(isRealCalendarDate, { message: 'date must be a real calendar date (YYYY-MM-DD)' }),
  time: timeHHmm('time'),
  notes: z.string().trim().max(500).optional(),
});

export type CreateBookingBody = z.infer<typeof createBookingSchema>;

const statusEnum = z.enum(BOOKING_STATUSES);
const cancelReason = z.string().trim().max(300).optional();

export const updateStatusSchema = z.object({ status: statusEnum, cancelReason });
export const cancelBodySchema = z.object({ cancelReason });
export const listQuerySchema = z.object({ status: statusEnum.optional() });

export const SLOT_INTERVAL_MIN_RANGE = { min: 5, max: 240 } as const;
export const BOOKING_NOTICE_MIN_RANGE = { min: 0, max: 1440 } as const;

const daySchedule = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    dayName: z.string().trim().min(1).max(30),
    enabled: z.boolean(),
    openTime: timeHHmm('openTime'),
    closeTime: timeHHmm('closeTime'),
    hasBreak: z.boolean(),
    breakStart: timeHHmm('breakStart').optional(),
    breakEnd: timeHHmm('breakEnd').optional(),
  })
  .superRefine((d, ctx) => {
    // A rest day keeps whatever hours it had; only working days must be coherent.
    if (!d.enabled) return;
    if (toMin(d.openTime) >= toMin(d.closeTime)) {
      ctx.addIssue({ code: 'custom', path: ['closeTime'], message: 'closeTime must be after openTime' });
    }
    if (!d.hasBreak) return;
    if (!d.breakStart || !d.breakEnd) {
      ctx.addIssue({ code: 'custom', path: ['breakStart'], message: 'breakStart and breakEnd are required when hasBreak is true' });
      return;
    }
    if (toMin(d.breakStart) >= toMin(d.breakEnd)) {
      ctx.addIssue({ code: 'custom', path: ['breakEnd'], message: 'breakEnd must be after breakStart' });
    } else if (toMin(d.breakStart) < toMin(d.openTime) || toMin(d.breakEnd) > toMin(d.closeTime)) {
      ctx.addIssue({ code: 'custom', path: ['breakStart'], message: 'the break must fall inside the working hours' });
    }
  });

const workingHoursSchema = z
  .object({
    days: z.array(daySchedule).min(1).max(7),
    slotIntervalMin: z
      .number()
      .int()
      .min(SLOT_INTERVAL_MIN_RANGE.min)
      .max(SLOT_INTERVAL_MIN_RANGE.max),
  })
  .superRefine((wh, ctx) => {
    const seen = new Set<number>();
    wh.days.forEach((d, i) => {
      if (seen.has(d.dayOfWeek)) {
        ctx.addIssue({ code: 'custom', path: ['days', i, 'dayOfWeek'], message: 'dayOfWeek must not be repeated' });
      }
      seen.add(d.dayOfWeek);
    });
  });

/** Body of PATCH /barbers/me/booking-settings. Unknown keys are stripped, never persisted. */
export const updateBookingSettingsSchema = z
  .object({
    acceptsBookings: z.boolean().optional(),
    bookingNoticeMin: z
      .number()
      .int()
      .min(BOOKING_NOTICE_MIN_RANGE.min)
      .max(BOOKING_NOTICE_MIN_RANGE.max)
      .optional(),
    workingHours: workingHoursSchema.optional(),
  })
  .refine(
    (v) => v.acceptsBookings !== undefined || v.bookingNoticeMin !== undefined || v.workingHours !== undefined,
    { message: 'at least one setting must be provided' }
  );

export type UpdateBookingSettingsBody = z.infer<typeof updateBookingSettingsSchema>;
