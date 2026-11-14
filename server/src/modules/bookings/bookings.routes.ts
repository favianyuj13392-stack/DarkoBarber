import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { BookingsService } from './bookings.service';
import { resolveClientId, trackClientActivity } from '../rewards/rewards.hooks';
import {
  cancelBodySchema,
  createBookingSchema,
  listQuerySchema,
  MAX_SERVICES_PER_BOOKING,
  updateStatusSchema,
} from './bookings.schemas';
import { BOOKING_STATUSES } from './bookings.status';
import { AppError } from '../../utils/errors';

const bookingsRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new BookingsService(fastify.prisma);

  const sendAppError = (reply: any, err: unknown) => {
    if (err instanceof AppError) {
      return reply.status(err.statusCode).send({ error: err.code, message: err.message });
    }
    throw err;
  };

  // GET /api/barbers/me/bookings?status=
  fastify.get(
    '/barbers/me/bookings',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });

      const query = listQuerySchema.safeParse(request.query ?? {});
      if (!query.success) {
        return reply.status(400).send({
          error: 'INVALID_STATUS',
          message: `status must be one of ${BOOKING_STATUSES.join(', ')}`,
        });
      }
      const bookings = await service.getBarberBookings(barberId, query.data.status);
      return reply.status(200).send(bookings);
    }
  );

  // PATCH /api/barbers/me/bookings/:bookingId  { status, cancelReason? }
  // Barber-owned bookings only; transitions follow the state machine in bookings.status.ts.
  fastify.patch(
    '/barbers/me/bookings/:bookingId',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });

      const { bookingId } = request.params as { bookingId: string };
      const body = updateStatusSchema.safeParse(request.body ?? {});
      if (!body.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: `status must be one of ${BOOKING_STATUSES.join(', ')}`,
          issues: body.error.format(),
        });
      }

      try {
        const updated = await service.updateBookingStatus(
          barberId,
          bookingId,
          body.data.status,
          body.data.cancelReason
        );
        return reply.status(200).send(updated);
      } catch (err) {
        return sendAppError(reply, err);
      }
    }
  );

  // GET /api/clients/me/bookings: the authenticated client's bookings, newest first
  fastify.get(
    '/clients/me/bookings',
    { preHandler: [fastify.authenticateUser] },
    async (request: any, reply) => {
      if (request.authUser?.role !== 'cliente') {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Solo para clientes' });
      }
      const bookings = await service.getClientBookings(request.authUser.id);
      return reply.status(200).send(bookings);
    }
  );

  // PATCH /api/bookings/:bookingId/cancel  { cancelReason? }: the owning client cancels
  fastify.patch(
    '/bookings/:bookingId/cancel',
    { preHandler: [fastify.authenticateUser] },
    async (request: any, reply) => {
      if (request.authUser?.role !== 'cliente') {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Solo para clientes' });
      }
      const { bookingId } = request.params as { bookingId: string };
      const body = cancelBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Datos inválidos',
          issues: body.error.format(),
        });
      }

      try {
        const updated = await service.cancelBookingAsClient(
          request.authUser.id,
          bookingId,
          body.data.cancelReason
        );
        return reply.status(200).send(updated);
      } catch (err) {
        return sendAppError(reply, err);
      }
    }
  );

  // GET /api/barbers/me/bookings/upcoming-alert (Sinergia Walk-In)
  fastify.get(
    '/barbers/me/bookings/upcoming-alert',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });

      const alert = await service.getUpcomingAlert(barberId);
      return reply.status(200).send(alert);
    }
  );

  // GET /api/barbers/me/booking-settings
  fastify.get(
    '/barbers/me/booking-settings',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });

      const settings = await service.getBarberBookingSettings(barberId);
      return reply.status(200).send(settings);
    }
  );

  // PATCH /api/barbers/me/booking-settings
  fastify.patch(
    '/barbers/me/booking-settings',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });

      const body = request.body as {
        acceptsBookings?: boolean;
        bookingNoticeMin?: number;
        workingHours?: any;
      };
      const settings = await service.updateBarberBookingSettings(barberId, body);
      return reply.status(200).send(settings);
    }
  );

  // PUBLIC / CLIENT: GET /api/barbers/:barberId/bookings/availability?date=YYYY-MM-DD&serviceIds=a,b
  // `serviceIds` (optional, comma separated) sizes the slots to the summed service duration.
  fastify.get('/barbers/:barberId/bookings/availability', async (request: any, reply) => {
    const { barberId } = request.params as { barberId: string };
    const { date, serviceIds } = (request.query || {}) as { date?: string; serviceIds?: string };
    const ids = (serviceIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_SERVICES_PER_BOOKING);
    try {
      const availability = await service.getBarberAvailability(barberId, date, new Date(), {
        serviceIds: ids,
      });
      return reply.status(200).send(availability);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // PUBLIC (optional client auth): POST /api/barbers/:barberId/bookings
  // Body: { serviceIds: string[1..5], date: 'YYYY-MM-DD', time: 'HH:mm', notes?, clientName?, clientPhone? }
  // Price/duration are summed server-side from the BarberServices. A valid CLIENT token supplies the identity
  // (any clientId in the body is ignored); anonymous requests need clientName + clientPhone.
  fastify.post('/barbers/:barberId/bookings', async (request: any, reply) => {
    const { barberId } = request.params as { barberId: string };

    const parsed = createBookingSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Datos de reserva inválidos',
        issues: parsed.error.format(),
      });
    }

    const clientId = await resolveClientId(request, { optionalJwt: true });

    try {
      const booking = await service.createBooking({
        barberId,
        clientId,
        ...parsed.data,
      });
      // Public endpoint (no authenticate preHandler): a client token is optional here.
      await trackClientActivity(fastify.prisma, request, 'BOOKING_CREATED', { optionalJwt: true });

      return reply.status(201).send(booking);
    } catch (err) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
};

export default fp(bookingsRoutesPlugin);
