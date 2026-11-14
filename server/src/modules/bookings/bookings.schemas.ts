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

export const createBookingSchema = z.object({
  serviceIds: serviceIdsSchema,
  date: z
    .string()
    .refine(isRealCalendarDate, { message: 'date must be a real calendar date (YYYY-MM-DD)' }),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:mm (24h)' }),
  notes: z.string().trim().max(500).optional(),
  // Only used for anonymous requests (or when the client profile lacks them).
  clientName: z.string().trim().min(2).max(80).optional(),
  clientPhone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => normalizePhone(v) !== null, { message: 'clientPhone must be a valid phone number' })
    .optional(),
});

export type CreateBookingBody = z.infer<typeof createBookingSchema>;

const statusEnum = z.enum(BOOKING_STATUSES);
const cancelReason = z.string().trim().max(300).optional();

export const updateStatusSchema = z.object({ status: statusEnum, cancelReason });
export const cancelBodySchema = z.object({ cancelReason });
export const listQuerySchema = z.object({ status: statusEnum.optional() });
