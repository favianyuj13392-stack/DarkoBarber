import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { BookingsService } from './bookings.service';
import { resolveClientId, trackClientActivity } from '../rewards/rewards.hooks';
import { createBookingSchema } from './bookings.schemas';
import { AppError } from '../../utils/errors';
import { BookingStatus } from '@prisma/client';

const bookingsRoutesPlugin: FastifyPluginAsync = async (fastify) => {
  const service = new BookingsService(fastify.prisma);

  // GET /api/barbers/me/bookings
  fastify.get(
    '/barbers/me/bookings',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });

      const query = request.query as { status?: BookingStatus };
      const bookings = await service.getBarberBookings(barberId, query.status);
      return reply.status(200).send(bookings);
    }
  );

  // PATCH /api/barbers/me/bookings/:bookingId
  fastify.patch(
    '/barbers/me/bookings/:bookingId',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });

      const { bookingId } = request.params as { bookingId: string };
      const body = request.body as { status: BookingStatus; cancelReason?: string };

      if (!body.status) {
        return reply.status(400).send({ error: 'STATUS_REQUIRED' });
      }

      const updated = await service.updateBookingStatus(
        barberId,
        bookingId,
        body.status,
        body.cancelReason
      );

      return reply.status(200).send(updated);
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

  // PUBLIC / CLIENT: GET /api/barbers/:barberId/bookings/availability?date=YYYY-MM-DD&serviceId=...
  // `serviceId` (optional) sizes the slots to that service's duration.
  fastify.get('/barbers/:barberId/bookings/availability', async (request: any, reply) => {
    const { barberId } = request.params as { barberId: string };
    const { date, serviceId } = (request.query || {}) as { date?: string; serviceId?: string };
    try {
      const availability = await service.getBarberAvailability(barberId, date, new Date(), {
        serviceId,
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
  // Body: { serviceId, date: 'YYYY-MM-DD', time: 'HH:mm', notes?, clientName?, clientPhone? }
  // Price/duration come from the BarberService. A valid CLIENT token supplies the identity
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
