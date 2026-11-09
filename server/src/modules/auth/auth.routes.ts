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

  // GET /shops (Público: lista de salones registrados)
  fastify.get('/shops', async (_request, reply) => {
    const shops = await service.getAllShops();
    return reply.status(200).send(shops);
  });

  // PUT /barbers/me/location & PUT /auth/barber/location
  const updateBarberLocationHandler = async (request: any, reply: any) => {
    const barberId = request.barber?.id || request.authUser?.id;
    if (!barberId) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Barber token required',
      });
    }

    const updated = await service.updateBarberLocation(barberId, request.body as any);
    return reply.status(200).send(updated);
  };

  fastify.put('/barbers/me/location', { preHandler: [fastify.authenticateBarber] }, updateBarberLocationHandler);
  fastify.put('/auth/barber/location', { preHandler: [fastify.authenticateBarber] }, updateBarberLocationHandler);

  // GET /barbers/me/subscription & GET /auth/barber/subscription
  const getSubscriptionHandler = async (request: any, reply: any) => {
    const barberId = request.barber?.id || request.authUser?.id;
    if (!barberId) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Barber token required',
      });
    }

    const sub = await service.getBarberSubscription(barberId);
    return reply.status(200).send(sub);
  };

  fastify.get('/barbers/me/subscription', { preHandler: [fastify.authenticateBarber] }, getSubscriptionHandler);
  fastify.get('/auth/barber/subscription', { preHandler: [fastify.authenticateBarber] }, getSubscriptionHandler);

  // POST /barbers/me/subscription/plan & POST /auth/barber/subscription/plan
  const updatePlanHandler = async (request: any, reply: any) => {
    const barberId = request.barber?.id || request.authUser?.id;
    if (!barberId) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Barber token required',
      });
    }

    const { plan } = (request.body as { plan: 'AUTONOMO' | 'BARBERIA_BASE' | 'ALTO_FLUJO' }) || {};
    if (!plan || !['AUTONOMO', 'BARBERIA_BASE', 'ALTO_FLUJO'].includes(plan)) {
      return reply.status(400).send({
        error: 'INVALID_PLAN',
        message: 'Plan must be AUTONOMO, BARBERIA_BASE or ALTO_FLUJO',
      });
    }

    const updated = await service.updateBarberPlan(barberId, plan);
    return reply.status(200).send(updated);
  };

  fastify.post('/barbers/me/subscription/plan', { preHandler: [fastify.authenticateBarber] }, updatePlanHandler);
  fastify.post('/auth/barber/subscription/plan', { preHandler: [fastify.authenticateBarber] }, updatePlanHandler);

  // --- SERVICIOS & TARIFAS DEL BARBERO ---
  fastify.get(
    '/barbers/me/services',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const services = await service.getBarberServices(barberId);
      return reply.status(200).send(services);
    }
  );

  fastify.post(
    '/barbers/me/services',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const created = await service.createBarberService(barberId, request.body as any);
      return reply.status(201).send(created);
    }
  );

  fastify.put(
    '/barbers/me/services/:serviceId',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const { serviceId } = request.params as { serviceId: string };
      const updated = await service.updateBarberService(barberId, serviceId, request.body as any);
      return reply.status(200).send(updated);
    }
  );

  fastify.delete(
    '/barbers/me/services/:serviceId',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const { serviceId } = request.params as { serviceId: string };
      await service.deleteBarberService(barberId, serviceId);
      return reply.status(200).send({ success: true });
    }
  );

  // --- GESTIÓN DE PORTAFOLIO (AÑADIR / ELIMINAR FOTOS) ---
  fastify.post(
    '/barbers/me/portfolio',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const { photoUrl } = (request.body as { photoUrl: string }) || {};
      if (!photoUrl) return reply.status(400).send({ error: 'PHOTO_URL_REQUIRED' });
      const profile = await service.addPortfolioPhoto(barberId, photoUrl);
      return reply.status(201).send(profile);
    }
  );

  fastify.delete(
    '/barbers/me/portfolio',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const { photoUrl } = (request.body as { photoUrl: string }) || {};
      if (!photoUrl) return reply.status(400).send({ error: 'PHOTO_URL_REQUIRED' });
      const profile = await service.deletePortfolioPhoto(barberId, photoUrl);
      return reply.status(200).send(profile);
    }
  );

  // --- SISTEMA DE SEGUIDORES (FOLLOWERS) ---
  fastify.get('/barbers/:barberId/follow', async (request: any, reply: any) => {
    const { barberId } = request.params as { barberId: string };
    const clientId = (request as any).authUser?.id;
    const status = await service.getBarberFollowStatus(barberId, clientId);
    return reply.status(200).send(status);
  });

  fastify.post(
    '/barbers/:barberId/follow',
    { preHandler: [fastify.authenticateUser] },
    async (request: any, reply: any) => {
      const { barberId } = request.params as { barberId: string };
      const clientId = request.authUser?.id || request.barber?.id;
      if (!clientId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const status = await service.toggleFollowBarber(barberId, clientId);
      return reply.status(200).send(status);
    }
  );

  // --- PROGRAMA DE CRECIMIENTO: GAMIFICACIÓN & ADQUISICIÓN ---
  fastify.get(
    '/barbers/me/acquisitions',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const data = await service.getBarberAcquisitions(barberId);
      return reply.status(200).send(data);
    }
  );

  fastify.post(
    '/barbers/me/acquisitions/claim',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const result = await service.claimFreeMonthReward(barberId);
      return reply.status(200).send(result);
    }
  );
};
