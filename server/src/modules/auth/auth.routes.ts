import { FastifyPluginAsync } from 'fastify';
import { AuthService, AuthResult } from './auth.service';
import {
  loginSchema,
  registerSchema,
  googleAuthSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schemas';
import { uploadBodyLimit } from '../../utils/body-limits';
import { RewardsService } from '../rewards/rewards.service';

/** Password-change counter embedded in the JWT as `tv`. */
const sessionVersion = (r: AuthResult): number =>
  r.barber?.tokenVersion ?? r.client?.tokenVersion ?? 0;

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
      tv: sessionVersion(authResult),
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
      tv: sessionVersion(result),
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
      tv: sessionVersion(authResult),
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

  // The profile may carry an inline avatar image (data URL), so it gets the upload limit.
  const profileRouteOptions = { bodyLimit: uploadBodyLimit(), preHandler: [fastify.authenticateBarber] };
  fastify.put('/auth/barber/profile', profileRouteOptions, updateBarberProfileHandler);
  fastify.put('/barbers/me', profileRouteOptions, updateBarberProfileHandler);

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

  // --- SERVICIOS & TARIFAS DEL BARBERO ---
  // GET /barbers/:barberId/services (Público: servicios activos del barbero para catálogo y reservas)
  fastify.get(
    '/barbers/:barberId/services',
    async (request: any, reply: any) => {
      const { barberId } = request.params as { barberId: string };
      const services = await service.getBarberServices(barberId);
      return reply.status(200).send(services);
    }
  );

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
  // Photos are sent inline as data URLs (and deleted by that same value), so the
  // portfolio routes get the larger upload body limit.
  fastify.post(
    '/barbers/me/portfolio',
    { bodyLimit: uploadBodyLimit(), preHandler: [fastify.authenticateBarber] },
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
    { bodyLimit: uploadBodyLimit(), preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const { photoUrl, photoUrls } = (request.body as { photoUrl?: string; photoUrls?: string[] }) || {};
      const targets = photoUrls && photoUrls.length > 0 ? photoUrls : photoUrl ? [photoUrl] : [];
      if (targets.length === 0) return reply.status(400).send({ error: 'PHOTO_URL_REQUIRED' });
      const profile = await service.deletePortfolioPhotos(barberId, targets);
      return reply.status(200).send(profile);
    }
  );

  // --- SISTEMA DE SEGUIDORES (FOLLOWERS) ---
  // Public read; when a bearer token is present it is validated so isFollowing
  // reflects the authenticated client. Without a token isFollowing is false.
  const optionalAuthUser = async (request: any, reply: any) => {
    if (!request.headers.authorization) return;
    return fastify.authenticateUser(request, reply);
  };

  fastify.get('/barbers/:barberId/follow', { preHandler: [optionalAuthUser] }, async (request: any, reply: any) => {
    const { barberId } = request.params as { barberId: string };
    const authUser = request.authUser;
    const clientId = authUser?.role === 'cliente' ? authUser.id : undefined;
    const status = await service.getBarberFollowStatus(barberId, clientId);
    if (!status) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Barber not found' });
    return reply.status(200).send(status);
  });

  // Only authenticated clients follow; identity always comes from the JWT.
  const followHandler =
    (action: 'toggleFollowBarber' | 'followBarber' | 'unfollowBarber') => async (request: any, reply: any) => {
      const { barberId } = request.params as { barberId: string };
      const authUser = request.authUser;
      if (!authUser) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      if (authUser.role !== 'cliente') {
        return reply.status(403).send({ error: 'FORBIDDEN', message: 'Only clients can follow barbers' });
      }
      const status = await service[action](barberId, authUser.id);
      if (!status) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Barber not found' });
      return reply.status(200).send(status);
    };

  // POST is the legacy toggle; PUT/DELETE are the idempotent operations.
  const followAuth = { preHandler: [fastify.authenticateUser] };
  fastify.post('/barbers/:barberId/follow', followAuth, followHandler('toggleFollowBarber'));
  fastify.put('/barbers/:barberId/follow', followAuth, followHandler('followBarber'));
  fastify.delete('/barbers/:barberId/follow', followAuth, followHandler('unfollowBarber'));

  // --- PROGRAMA DE CRECIMIENTO: GAMIFICACIÓN & ADQUISICIÓN ---
  fastify.get(
    '/barbers/me/acquisitions',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const data = await new RewardsService(fastify.prisma).getProgress(barberId);
      return reply.status(200).send(data);
    }
  );

  fastify.post(
    '/barbers/me/acquisitions/claim',
    { preHandler: [fastify.authenticateBarber] },
    async (request: any, reply: any) => {
      const barberId = request.barber?.id || request.authUser?.id;
      if (!barberId) return reply.status(401).send({ error: 'UNAUTHORIZED' });
      const result = await new RewardsService(fastify.prisma).createClaim(barberId);
      switch (result.outcome) {
        case 'CREATED':
          return reply.status(201).send({ success: true, claim: result.claim });
        case 'ALREADY_CLAIMED':
          return reply.status(409).send({
            error: 'ALREADY_CLAIMED',
            message: 'This reward was already claimed',
            claim: result.claim,
          });
        case 'GOAL_NOT_REACHED':
          return reply.status(400).send({
            error: 'GOAL_NOT_REACHED',
            message: 'Acquisition goal not reached yet',
            qualified: result.progress.qualified,
            goal: result.progress.goal,
          });
        default:
          return reply.status(403).send({
            error: 'FREE_MONTHS_CAP_REACHED',
            message: 'The maximum number of free months has already been earned',
            freeMonthsEarned: result.progress.freeMonthsEarned,
            maxFreeMonths: result.progress.maxFreeMonths,
          });
      }
    }
  );

  // --- RECUPERACIÓN DE CONTRASEÑA (PASSWORD RESET) ---
  fastify.post('/auth/forgot-password', async (request, reply) => {
    const parseResult = forgotPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        issues: parseResult.error.format(),
      });
    }

    const result = await service.requestPasswordReset(parseResult.data.email);
    return reply.status(200).send(result);
  });

  fastify.post('/auth/reset-password', async (request, reply) => {
    const parseResult = resetPasswordSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        issues: parseResult.error.format(),
      });
    }

    try {
      const result = await service.resetPassword(
        parseResult.data.token,
        parseResult.data.newPassword
      );
      return reply.status(200).send(result);
    } catch {
      // One generic answer for every failure so internals and causes never leak.
      return reply.status(400).send({
        error: 'INVALID_TOKEN',
        message: 'El código o enlace de recuperación es inválido o ha expirado.',
      });
    }
  });
};
