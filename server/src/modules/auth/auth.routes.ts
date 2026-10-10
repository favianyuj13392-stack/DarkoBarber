import { FastifyPluginAsync } from 'fastify';
import { AuthService } from './auth.service';
import { loginSchema } from './auth.schemas';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new AuthService(fastify.prisma);

  fastify.post('/auth/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        issues: parseResult.error.format(),
      });
    }

    const barber = await service.authenticate(parseResult.data);
    if (!barber) {
      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Credenciales inválidas',
      });
    }

    const token = fastify.jwt.sign({
      barberId: barber.id,
      shopId: barber.shopId,
      deviceId: barber.deviceId!,
    });

    return reply.status(200).send({
      token,
      barber: {
        id: barber.id,
        displayName: barber.displayName,
        phone: barber.phone,
        plan: barber.plan,
        shopId: barber.shopId,
      },
    });
  });

  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const me = await service.getMe(request.barber.id);
      if (!me) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Barber profile not found',
        });
      }
      return reply.status(200).send(me);
    }
  );
};
