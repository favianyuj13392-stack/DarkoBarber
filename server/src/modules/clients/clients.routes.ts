import { FastifyPluginAsync } from 'fastify';
import { ClientsService } from './clients.service';
import { createClientSchema } from './clients.schemas';

export const clientsRoutes: FastifyPluginAsync = async (fastify) => {
  const service = new ClientsService(fastify.prisma);

  fastify.get(
    '/clients/:phone/history',
    async (request, reply) => {
      const { phone } = request.params as { phone: string };
      const query = (request.query as { email?: string; name?: string }) || {};
      const history = await service.getClientHistory(phone, query);

      if (!history) {
        return reply.status(404).send({
          exists: false,
          phone,
        });
      }

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

  // GET /clients/me
  fastify.get('/clients/me', async (request, reply) => {
    const query = (request.query as { email?: string; phone?: string; name?: string }) || {};
    const client = await service.getClientHistory(query.phone || '', query);
    return reply.status(200).send(client || {});
  });

  // PUT /clients/me
  fastify.put('/clients/me', async (request, reply) => {
    const body = (request.body as { id?: string; email?: string; phone?: string; displayName?: string; avatarUrl?: string }) || {};
    const updated = await service.updateClientProfile(body);
    return reply.status(200).send(updated);
  });
};
