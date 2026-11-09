import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { BookingsService } from './bookings.service';
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

      const body = request.body as { acceptsBookings?: boolean; bookingNoticeMin?: number };
      const settings = await service.updateBarberBookingSettings(barberId, body);
      return reply.status(200).send(settings);
    }
  );

  // PUBLIC / CLIENT: GET /api/barbers/:barberId/bookings/availability
  fastify.get('/barbers/:barberId/bookings/availability', async (request: any, reply) => {
    const { barberId } = request.params as { barberId: string };
    const settings = await service.getBarberBookingSettings(barberId);
    return reply.status(200).send(settings);
  });

  // PUBLIC / CLIENT: POST /api/barbers/:barberId/bookings
  fastify.post('/barbers/:barberId/bookings', async (request: any, reply) => {
    const { barberId } = request.params as { barberId: string };
    const body = request.body as {
      clientName: string;
      clientPhone: string;
      serviceName: string;
      servicePriceBs: number;
      durationMin?: number;
      date: string;
      time: string;
      notes?: string;
    };

    const booking = await service.createBooking({
      barberId,
      ...body,
    });

    return reply.status(201).send(booking);
  });
};

export default fp(bookingsRoutesPlugin);
