import { FastifyPluginAsync } from 'fastify';
import { ClientsService } from './clients.service';
import { createClientSchema, updateClientProfileSchema } from './clients.schemas';
import { trackClientActivity } from '../rewards/rewards.hooks';

export const clientsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new ClientsService(fastify.prisma);

  // GET /clients/:phone/history
  // - cliente: only their own phone.
  // - barbero: only their own cuts with that client; otherwise a 200 empty history.
  fastify.get(
    '/clients/:phone/history',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      const { phone } = request.params as { phone: string };
      const user = request.authUser!;

      if (user.role === 'cliente') {
        if (!ClientsService.samePhone(user.phone, phone)) {
          return reply.status(403).send({
            error: 'FORBIDDEN',
            message: 'You can only view your own history',
          });
        }
        const history = await service.getClientHistory(user.id);
        await trackClientActivity(fastify.prisma, request, 'HISTORY_VIEW');
        return reply.status(200).send(history);
      }

      // Unknown phone and "no cuts with this barber" are deliberately indistinguishable:
      // same 200 empty shape, so existence cannot be enumerated.
      const target = await service.findClientByPhone(phone);
      const allowed = target
        ? await service.barberHasCutWithClient(user.id, target.id)
        : false;
      if (!target || !allowed) {
        return reply.status(200).send(ClientsService.emptyHistory(phone));
      }

      // Only this barber's own cuts (and their photos) are exposed.
      const history = await service.getClientHistory(target.id, user.id);
      return reply.status(200).send(history);
    }
  );

  fastify.post(
    '/clients',
    { preHandler: [fastify.authenticateBarber] },
    async (request, reply) => {
      const parseResult = createClientSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.format(),
        });
      }

      const created = await service.createClient(parseResult.data);
      return reply.status(201).send(created);
    }
  );

  // GET /clients/me (authenticated client only; identity comes from the token)
  fastify.get(
    '/clients/me',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      const user = request.authUser!;
      if (user.role !== 'cliente') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Client account required',
        });
      }
      const history = await service.getClientHistory(user.id);
      await trackClientActivity(fastify.prisma, request, 'HISTORY_VIEW');
      return reply.status(200).send(history);
    }
  );

  // PUT /clients/me (authenticated client only; updates only their own record)
  fastify.put(
    '/clients/me',
    { preHandler: [fastify.authenticateUser] },
    async (request, reply) => {
      const user = request.authUser!;
      if (user.role !== 'cliente') {
        return reply.status(403).send({
          error: 'FORBIDDEN',
          message: 'Client account required',
        });
      }

      const parseResult = updateClientProfileSchema.safeParse(request.body || {});
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          issues: parseResult.error.format(),
        });
      }

      try {
        const updated = await service.updateClientProfile(user.id, parseResult.data);
        return reply.status(200).send(updated);
      } catch (err: any) {
        if (err?.code === 'P2002') {
          return reply.status(409).send({
            error: 'PHONE_ALREADY_EXISTS',
            message: 'That phone number is already in use',
          });
        }
        throw err;
      }
    }
  );
};
