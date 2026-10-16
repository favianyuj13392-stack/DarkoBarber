import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { AuthPayload, BarberAuthPayload } from '../types';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret-for-darkobarber-pilot',
  });

  const authenticateBarber = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify<BarberAuthPayload>();
      const barberId = decoded.barberId || decoded.userId;

      if (!barberId) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Barber token required',
        });
      }

      const barber = await fastify.prisma.barber.findUnique({
        where: { id: barberId },
      });

      if (!barber) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Barber not found',
        });
      }

      if (barber.deviceId && decoded.deviceId && decoded.deviceId !== barber.deviceId) {
        return reply.status(401).send({
          error: 'SESSION_SUPERSEDED',
          message: 'Session superseded by login on another device',
        });
      }

      request.barber = {
        id: barber.id,
        phone: barber.phone,
        email: barber.email,
        displayName: barber.displayName,
        shopId: barber.shopId,
        deviceId: barber.deviceId,
        plan: barber.plan,
      };

      request.user = {
        id: barber.id,
        role: 'barbero',
        email: barber.email,
        displayName: barber.displayName,
        phone: barber.phone,
        avatarUrl: barber.avatarUrl,
        shopId: barber.shopId,
        plan: barber.plan,
        deviceId: barber.deviceId,
      };
      request.authUser = request.user;
    } catch (err) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid or missing authentication token',
      });
    }
  };

  const authenticateUser = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const decoded = await request.jwtVerify<AuthPayload>();
      const userId = decoded.userId || decoded.barberId;

      if (!userId) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'Invalid token payload',
        });
      }

      if (decoded.role === 'cliente') {
        const client = await fastify.prisma.client.findUnique({
          where: { id: userId },
        });

        if (!client) {
          return reply.status(401).send({
            error: 'UNAUTHORIZED',
            message: 'Client not found',
          });
        }

        request.user = {
          id: client.id,
          role: 'cliente',
          email: client.email,
          displayName: client.displayName,
          phone: client.phone,
          avatarUrl: client.avatarUrl,
          shopId: null,
        };
        request.authUser = request.user;
        return;
      }

      // Default to barber verification
      const barber = await fastify.prisma.barber.findUnique({
        where: { id: userId },
      });

      if (!barber) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'User not found',
        });
      }

      if (barber.deviceId && decoded.deviceId && decoded.deviceId !== barber.deviceId) {
        return reply.status(401).send({
          error: 'SESSION_SUPERSEDED',
          message: 'Session superseded by login on another device',
        });
      }

      request.barber = {
        id: barber.id,
        phone: barber.phone,
        email: barber.email,
        displayName: barber.displayName,
        shopId: barber.shopId,
        deviceId: barber.deviceId,
        plan: barber.plan,
      };

      request.user = {
        id: barber.id,
        role: 'barbero',
        email: barber.email,
        displayName: barber.displayName,
        phone: barber.phone,
        avatarUrl: barber.avatarUrl,
        shopId: barber.shopId,
        plan: barber.plan,
        deviceId: barber.deviceId,
      };
      request.authUser = request.user;
    } catch (err) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid or missing authentication token',
      });
    }
  };

  fastify.decorate('authenticateBarber', authenticateBarber);
  fastify.decorate('authenticateUser', authenticateUser);
};

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['prisma-plugin'],
});
