import { FastifyPluginAsync } from 'fastify';
import { AuthService } from './auth.service';
import { loginSchema, registerSchema, googleAuthSchema } from './auth.schemas';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new AuthService(fastify.prisma);

  // POST /auth/login
  fastify.post('/auth/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        issues: parseResult.error.format(),
      });
    }

    const authResult = await service.authenticate(parseResult.data);
    if (!authResult) {
      return reply.status(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Credenciales inválidas',
      });
    }

    const token = fastify.jwt.sign({
      userId: authResult.user.id,
      barberId: authResult.barber ? authResult.barber.id : undefined,
      role: authResult.role,
      shopId: authResult.user.shopId ?? null,
      deviceId: authResult.barber?.deviceId ?? parseResult.data.deviceId ?? 'web-client',
    });

    const response: Record<string, any> = {
      token,
      user: authResult.user,
    };

    if (authResult.barber) {
      response.barber = {
        id: authResult.barber.id,
        displayName: authResult.barber.displayName,
        phone: authResult.barber.phone,
        plan: authResult.barber.plan,
        shopId: authResult.barber.shopId,
      };
    }

    return reply.status(200).send(response);
  });

  // POST /auth/register
  fastify.post('/auth/register', async (request, reply) => {
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        issues: parseResult.error.format(),
      });
    }

    const { error, message, result } = await service.register(parseResult.data);
    if (error || !result) {
      return reply.status(409).send({
        error: error || 'REGISTRATION_FAILED',
        message: message || 'No se pudo completar el registro',
      });
    }

    const token = fastify.jwt.sign({
      userId: result.user.id,
      barberId: result.barber ? result.barber.id : undefined,
      role: result.role,
      shopId: result.user.shopId ?? null,
      deviceId: result.barber?.deviceId ?? parseResult.data.deviceId ?? 'web-client',
    });

    const response: Record<string, any> = {
      token,
      user: result.user,
    };

    if (result.barber) {
      response.barber = {
        id: result.barber.id,
        displayName: result.barber.displayName,
        phone: result.barber.phone,
        plan: result.barber.plan,
        shopId: result.barber.shopId,
      };
    }

    return reply.status(201).send(response);
  });

  // POST /auth/google
  fastify.post('/auth/google', async (request, reply) => {
    const parseResult = googleAuthSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        issues: parseResult.error.format(),
      });
    }

    const authResult = await service.googleAuth(parseResult.data);

    const token = fastify.jwt.sign({
      userId: authResult.user.id,
      barberId: authResult.barber ? authResult.barber.id : undefined,
      role: authResult.role,
      shopId: authResult.user.shopId ?? null,
      deviceId: authResult.barber?.deviceId ?? parseResult.data.deviceId ?? 'web-client',
    });

    const response: Record<string, any> = {
      token,
      user: authResult.user,
    };

    if (authResult.barber) {
      response.barber = {
        id: authResult.barber.id,
        displayName: authResult.barber.displayName,
        phone: authResult.barber.phone,
        plan: authResult.barber.plan,
        shopId: authResult.barber.shopId,
      };
    }

    return reply.status(200).send(response);
  });

  // GET /auth/me
  fastify.get(
    '/auth/me',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      const userId = request.authUser?.id || request.barber?.id;
      if (!userId) {
        return reply.status(401).send({
          error: 'UNAUTHORIZED',
          message: 'User ID missing in token',
        });
      }

      const me = await service.getMe(userId);
      if (!me) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Profile not found',
        });
      }

      return reply.status(200).send(me);
    }
  );

  // GET /auth/barber/profile & GET /barbers/me
  const getBarberProfileHandler = async (request: any, reply: any) => {
    const barberId = request.barber?.id || request.authUser?.id;
    if (!barberId) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Barber token required',
      });
    }

    const profile = await service.getBarberFullProfile(barberId);
    if (!profile) {
      return reply.status(404).send({
        error: 'NOT_FOUND',
        message: 'Barber not found',
      });
    }

    return reply.status(200).send(profile);
  };

  fastify.get('/auth/barber/profile', { preHandler: [fastify.authenticateBarber] }, getBarberProfileHandler);
  fastify.get('/barbers/me', { preHandler: [fastify.authenticateBarber] }, getBarberProfileHandler);

  // PUT /auth/barber/profile & PUT /barbers/me
  const updateBarberProfileHandler = async (request: any, reply: any) => {
    const barberId = request.barber?.id || request.authUser?.id;
    if (!barberId) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Barber token required',
      });
    }

    const updated = await service.updateBarberProfile(barberId, request.body as any);
    return reply.status(200).send(updated);
  };

  fastify.put('/auth/barber/profile', { preHandler: [fastify.authenticateBarber] }, updateBarberProfileHandler);
  fastify.put('/barbers/me', { preHandler: [fastify.authenticateBarber] }, updateBarberProfileHandler);
};
