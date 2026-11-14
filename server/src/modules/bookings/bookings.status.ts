import { BookingStatus } from '@prisma/client';

/** Single source of truth for booking statuses accepted by the API. */
export const BOOKING_STATUSES = Object.values(BookingStatus) as [BookingStatus, ...BookingStatus[]];

/**
 * Booking state machine. A status missing from the map (or mapped to []) is terminal.
 *
 *   PENDING   -> CONFIRMED | REJECTED | CANCELLED
 *   CONFIRMED -> COMPLETED | CANCELLED | NO_SHOW
 */
export const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.REJECTED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.REJECTED]: [],
  [BookingStatus.NO_SHOW]: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Targets that only make sense once the appointment start has passed. */
export const REQUIRES_START_PASSED: readonly BookingStatus[] = [
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

/** Statuses a client may move a booking to (only CANCELLED, from PENDING/CONFIRMED). */
export const CLIENT_CANCELLABLE_FROM: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];
