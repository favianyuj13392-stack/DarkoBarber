import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { BarberAuthPayload } from '../types';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret-for-darkobarber-pilot',
  });

  const authenticateBarber = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify<BarberAuthPayload>();
      const barber = await fastify.prisma.barber.findUnique({
        where: { id: decoded.barberId },
      });

      if (!barber) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Barber not found',
        });
      }

      if (barber.deviceId && decoded.deviceId !== barber.deviceId) {
        return reply.status(401).send({
          error: 'SESSION_SUPERSEDED',
          message: 'Session superseded by login on another device',
        });
      }

      request.barber = {
        id: barber.id,
        phone: barber.phone,
        displayName: barber.displayName,
        shopId: barber.shopId,
        deviceId: barber.deviceId,
        plan: barber.plan,
      };
    } catch (err) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid or missing authentication token',
      });
    }
  };

  fastify.decorate('authenticateBarber', authenticateBarber);
};

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['prisma-plugin'],
});
